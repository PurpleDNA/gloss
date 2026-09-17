import { expect, seed, sseBody, test, trigger } from "./fixtures";

const CHAT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * The core path: highlight, right-click, and an answer is already arriving.
 * Triggers are fired from the extension's real service worker.
 */
let asked: string[] = [];

test.beforeEach(async ({ context, panel }) => {
  asked = [];
  await context.route(CHAT, (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    asked.push(body.messages.at(-1).content);
    return route.fulfill({
      headers: { "content-type": "text/event-stream" },
      body: sseBody([`answer ${asked.length}`]),
    });
  });
  await seed(panel, { keys: { openrouter: "sk-or-v1-test" }, settings: { providerId: "openrouter" } });
  await expect(panel.locator("textarea")).toBeEnabled();
});

test.describe("a selection trigger", () => {
  test("asks the moment the panel receives it, with no click from the user", async ({ context, panel }) => {
    await trigger(context, {
      text: "entropy",
      context: "The entropy of the system rose steadily.",
      title: "Thermodynamics",
      url: "https://example.com/thermo",
    });

    await expect(panel.locator(".msg.assistant")).toHaveText("answer 1");
    // The first turn shows the selection, not the assembled prompt.
    await expect(panel.locator(".first-turn .msg.user")).toHaveText("entropy");

    const prompt = asked[0];
    expect(prompt).toContain("Page: Thermodynamics");
    expect(prompt).toContain("The entropy of the system rose steadily.");
    expect(prompt).toContain("Explain this, as it is used here: entropy");
  });

  test("shows the surrounding context it is about to send", async ({ context, panel }) => {
    await trigger(context, { text: "entropy", context: "The entropy of the system rose." });
    await expect(panel.locator(".msg.assistant")).toHaveText("answer 1");
    await expect(panel.locator(".first-turn")).toContainText("entropy");
  });

  test("does not re-ask when the panel is merely reopened", async ({ context, panel }) => {
    await trigger(context, { text: "entropy", context: "Some surrounding prose." });
    await expect(panel.locator(".msg.assistant")).toHaveText("answer 1");

    await panel.reload();
    await expect(panel.locator(".msg.assistant")).toHaveText("answer 1");
    expect(asked).toHaveLength(1);
  });

  test("re-asks when the same text is selected again", async ({ context, panel }) => {
    // A fresh trigger id is what tells a new ask from a reopen.
    await trigger(context, { text: "entropy", context: "Some surrounding prose." });
    await expect(panel.locator(".msg.assistant")).toHaveText("answer 1");

    await trigger(context, { text: "entropy", context: "Some surrounding prose." });
    await expect(panel.locator(".msg.assistant")).toHaveText("answer 2");
    expect(asked).toHaveLength(2);
  });

  test("a new selection replaces the previous conversation", async ({ context, panel }) => {
    await trigger(context, { text: "entropy", context: "prose one" });
    await expect(panel.locator(".msg.assistant")).toHaveText("answer 1");

    await trigger(context, { text: "enthalpy", context: "prose two" });
    await expect(panel.locator(".first-turn .msg.user")).toHaveText("enthalpy");
    await expect(panel.locator(".msg.assistant")).toHaveCount(1);
  });

  test("keeps a typed conversation when a trigger captured nothing", async ({ context, panel }) => {
    // Opening the panel from the toolbar must not throw away what you were doing.
    await panel.locator("textarea").fill("a question I typed");
    await panel.getByRole("button", { name: "Send" }).click();
    await expect(panel.locator(".msg.assistant")).toHaveText("answer 1");

    await trigger(context, null, "empty");
    await expect(panel.locator(".msg.user")).toHaveText("a question I typed");
    await expect(panel.locator(".msg.assistant")).toHaveText("answer 1");
    expect(asked).toHaveLength(1);
  });

  test("explains a page it was not allowed to read", async ({ context, panel }) => {
    await trigger(context, null, "restricted");
    await expect(panel.locator(".notice").first()).toContainText("Can't read this page");
    await expect(panel.locator("textarea")).toBeEnabled();
    expect(asked).toHaveLength(0);
  });

  test("explains an empty selection", async ({ context, panel }) => {
    await trigger(context, null, "empty");
    await expect(panel.locator(".notice").first()).toContainText("Nothing selected");
    expect(asked).toHaveLength(0);
  });

  test("answers a trigger that arrived before the panel was open", async ({ context, panel }) => {
    // Storage is written first precisely so a cold panel does not miss it.
    await panel.close();
    await trigger(context, { text: "entropy", context: "Some surrounding prose." });

    const reopened = await context.newPage();
    await reopened.goto(panel.url());
    await expect(reopened.locator(".msg.assistant")).toHaveText("answer 1");
  });

  test("waits for a provider rather than losing the selection", async ({ context, panel }) => {
    await panel.evaluate(() => chrome.storage.local.remove("gloss:key:openrouter"));
    await panel.reload();
    await expect(panel.locator(".welcome")).toBeVisible();

    await trigger(context, { text: "entropy", context: "Some surrounding prose." });
    await expect(panel.locator(".welcome")).toBeVisible();
    expect(asked).toHaveLength(0);

    // Connecting then answers the question that was already waiting.
    await context.route("https://openrouter.ai/api/v1/auth/keys", (route) =>
      route.fulfill({ json: { key: "sk-or-v1-late" } }),
    );
    await panel.getByRole("button", { name: "Connect OpenRouter" }).click();
    await expect(panel.locator(".msg.assistant")).toHaveText("answer 1");
  });
});
