import { expect, seed, sseBody, startChatServer, test } from "./fixtures";

const CHAT = "https://openrouter.ai/api/v1/chat/completions";

/** A configured install: key present, OpenRouter selected. */
async function configured(panel: import("@playwright/test").Page) {
  await seed(panel, {
    keys: { openrouter: "sk-or-v1-test" },
    settings: { providerId: "openrouter" },
  });
  await expect(panel.locator("textarea")).toBeEnabled();
}

async function ask(panel: import("@playwright/test").Page, question: string) {
  await panel.locator("textarea").fill(question);
  await panel.getByRole("button", { name: "Send" }).click();
}

test.describe("asking a question", () => {
  test.beforeEach(async ({ panel }) => configured(panel));

  test("streams an answer into the thread", async ({ panel, context }) => {
    await context.route(CHAT, (route) =>
      route.fulfill({
        headers: { "content-type": "text/event-stream" },
        body: sseBody(["Entropy ", "is a measure of disorder."]),
      }),
    );

    await ask(panel, "what is entropy");
    await expect(panel.locator(".msg.user")).toHaveText("what is entropy");
    await expect(panel.locator(".msg.assistant")).toHaveText("Entropy is a measure of disorder.");
  });

  test("renders the answer as markdown, not as raw text", async ({ panel, context }) => {
    await context.route(CHAT, (route) =>
      route.fulfill({
        headers: { "content-type": "text/event-stream" },
        body: sseBody(["**bold** and `code`\n\n- one\n- two"]),
      }),
    );

    await ask(panel, "format something");
    await expect(panel.locator(".msg.assistant strong")).toHaveText("bold");
    await expect(panel.locator(".msg.assistant code")).toHaveText("code");
    await expect(panel.locator(".msg.assistant li")).toHaveCount(2);
  });

  test("never renders HTML the model sent", async ({ panel, context }) => {
    await context.route(CHAT, (route) =>
      route.fulfill({
        headers: { "content-type": "text/event-stream" },
        body: sseBody(['<img src=x onerror="window.__pwned = true">']),
      }),
    );

    await ask(panel, "try an injection");
    await expect(panel.locator(".msg.assistant")).toContainText("<img");
    expect(await panel.locator(".msg.assistant img").count()).toBe(0);
    expect(await panel.evaluate(() => (window as any).__pwned)).toBeUndefined();
  });

  test("sends the model, the system prompt and the key the settings hold", async ({ panel, context }) => {
    let request: any;
    await context.route(CHAT, (route) => {
      request = {
        body: JSON.parse(route.request().postData() ?? "{}"),
        auth: route.request().headers().authorization,
      };
      return route.fulfill({
        headers: { "content-type": "text/event-stream" },
        body: sseBody(["ok"]),
      });
    });

    await ask(panel, "what is entropy");
    await expect(panel.locator(".msg.assistant")).toHaveText("ok");

    expect(request.auth).toBe("Bearer sk-or-v1-test");
    expect(request.body.model).toBe("google/gemma-4-26b-a4b-it:free");
    expect(request.body.stream).toBe(true);
    expect(request.body.messages[0].role).toBe("system");
    expect(request.body.messages[0].content).toContain("You are Gloss.");
    expect(request.body.messages[1]).toEqual({ role: "user", content: "what is entropy" });
  });

  test("carries the conversation into a follow-up", async ({ panel, context }) => {
    const bodies: any[] = [];
    await context.route(CHAT, (route) => {
      bodies.push(JSON.parse(route.request().postData() ?? "{}"));
      return route.fulfill({
        headers: { "content-type": "text/event-stream" },
        body: sseBody([`answer ${bodies.length}`]),
      });
    });

    await ask(panel, "first question");
    await expect(panel.locator(".msg.assistant")).toHaveText("answer 1");
    await ask(panel, "second question");
    await expect(panel.locator(".msg.assistant").nth(1)).toHaveText("answer 2");

    // The second request must replay the whole exchange, minus the system turn.
    expect(bodies[1].messages.slice(1)).toEqual([
      { role: "user", content: "first question" },
      { role: "assistant", content: "answer 1" },
      { role: "user", content: "second question" },
    ]);
  });

  test("shows a thinking state until the first token lands", async ({ panel, context }) => {
    let release: () => void;
    const held = new Promise<void>((r) => (release = r));
    await context.route(CHAT, async (route) => {
      await held;
      return route.fulfill({
        headers: { "content-type": "text/event-stream" },
        body: sseBody(["finally"]),
      });
    });

    await ask(panel, "slow one");
    await expect(panel.locator(".msg.assistant .pulse")).toBeVisible();
    release!();
    await expect(panel.locator(".msg.assistant")).toHaveText("finally");
  });

  test("surfaces the provider's error message", async ({ panel, context }) => {
    await context.route(CHAT, (route) =>
      route.fulfill({ status: 404, json: { error: { message: "No endpoints found for model" } } }),
    );

    await ask(panel, "bad model");
    await expect(panel.locator(".error")).toHaveText("No endpoints found for model");
    // The question stays on screen so it can be retried.
    await expect(panel.locator(".msg.user")).toHaveText("bad model");
  });

  test("restores the thread when the panel is closed and reopened", async ({ panel, context }) => {
    await context.route(CHAT, (route) =>
      route.fulfill({
        headers: { "content-type": "text/event-stream" },
        body: sseBody(["remembered"]),
      }),
    );

    await ask(panel, "what is entropy");
    await expect(panel.locator(".msg.assistant")).toHaveText("remembered");

    await panel.reload();
    await expect(panel.locator(".msg.user")).toHaveText("what is entropy");
    await expect(panel.locator(".msg.assistant")).toHaveText("remembered");
  });
});

test.describe("before a provider can answer", () => {
  test("disables the composer and says why when host access is missing", async ({ panel }) => {
    await seed(panel, { keys: { openrouter: "sk-or-v1-test" }, settings: { providerId: "openrouter" } });
    // An init script, so the flag survives the reload that follows.
    await panel.addInitScript(() => ((window as any).__glossDenyPermission = true));
    await panel.reload();

    await expect(panel.locator(".notice").first()).toContainText("One permission left");
    await expect(panel.locator("textarea")).toBeDisabled();
    await expect(panel.locator("textarea")).toHaveAttribute("placeholder", "Add a key in Settings");
  });
});

test.describe("a stream that is still open", () => {
  // Driven through the registry's local-Ollama provider against a real server,
  // which is the only way to hold a response open mid-answer.
  let chat: Awaited<ReturnType<typeof startChatServer>>;

  test.beforeEach(async ({ panel }) => {
    chat = await startChatServer();
    await seed(panel, { keys: { ollama: "ignored" }, settings: { providerId: "ollama" } });
    await expect(panel.locator("textarea")).toBeEnabled();
  });

  test.afterEach(async () => chat.close());

  test("shows Stop while tokens are still arriving", async ({ panel }) => {
    await ask(panel, "long one");
    await chat.waitForRequest();
    chat.push("first half ");

    await expect(panel.locator(".msg.assistant")).toHaveText("first half");
    await expect(panel.getByRole("button", { name: "Stop" })).toBeVisible();

    chat.push("second half");
    chat.finish();
    await expect(panel.locator(".msg.assistant")).toHaveText("first half second half");
    await expect(panel.getByRole("button", { name: "Speak" })).toBeVisible();
  });

  test("keeps what arrived when the user stops it", async ({ panel }) => {
    await ask(panel, "long one");
    await chat.waitForRequest();
    chat.push("partial answer");
    await expect(panel.locator(".msg.assistant")).toHaveText("partial answer");

    await panel.getByRole("button", { name: "Stop" }).click();

    // An abort is a choice, not a failure: no error, and the text stays.
    await expect(panel.locator(".error")).toHaveCount(0);
    await expect(panel.locator(".msg.assistant")).toHaveText("partial answer");
    await expect(panel.locator("textarea")).toBeEnabled();
  });

  test("survives the connection dropping mid-answer", async ({ panel }) => {
    await ask(panel, "unlucky one");
    await chat.waitForRequest();
    chat.push("half an ans");
    await expect(panel.locator(".msg.assistant")).toHaveText("half an ans");

    await chat.close();
    // Whatever arrived is kept rather than blanked.
    await expect(panel.locator(".msg.assistant")).toHaveText("half an ans");
    await expect(panel.locator("textarea")).toBeEnabled();
  });
});
