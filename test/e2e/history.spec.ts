import { expect, seed, sseBody, test } from "./fixtures";

const CHAT = "https://openrouter.ai/api/v1/chat/completions";
type Page = import("@playwright/test").Page;

async function configured(panel: Page, settings: Record<string, unknown> = {}) {
  await seed(panel, {
    keys: { openrouter: "sk-or-v1-test" },
    settings: { providerId: "openrouter", ...settings },
  });
  await expect(panel.locator("textarea")).toBeEnabled();
}

async function answer(panel: Page, question: string, reply: string) {
  await panel.locator("textarea").fill(question);
  await panel.getByRole("button", { name: "Send" }).click();
  await expect(panel.locator(".msg.assistant").last()).toHaveText(reply);
}

async function openHistory(panel: Page) {
  await panel.getByRole("button", { name: "Menu" }).click();
  await panel.getByRole("button", { name: "History" }).click();
}

test.beforeEach(async ({ context }) => {
  let n = 0;
  await context.route(CHAT, (route) =>
    route.fulfill({
      headers: { "content-type": "text/event-stream" },
      body: sseBody([`answer ${++n}`]),
    }),
  );
});

test.describe("history", () => {
  test("keeps a finished conversation and reopens it", async ({ panel }) => {
    await configured(panel);
    await answer(panel, "what is entropy", "answer 1");

    await openHistory(panel);
    const row = panel.locator(".history-item", { hasText: "what is entropy" });
    await expect(row).toBeVisible();

    await row.click();
    await expect(panel.locator(".msg.user")).toHaveText("what is entropy");
    await expect(panel.locator(".msg.assistant")).toHaveText("answer 1");
  });

  test("lists the newest conversation first", async ({ panel }) => {
    await configured(panel);
    await answer(panel, "first question", "answer 1");
    // Dropping the session thread is what a browser restart does; without it the
    // next question continues the same conversation rather than starting one.
    await panel.evaluate(() => chrome.storage.session.remove("gloss:thread"));
    await panel.reload();
    await expect(panel.locator("textarea")).toBeEnabled();
    await answer(panel, "second question", "answer 2");

    await openHistory(panel);
    await expect(panel.locator(".history-item").first()).toContainText("second question");
  });

  test("deletes a single conversation", async ({ panel }) => {
    await configured(panel);
    await answer(panel, "forget me", "answer 1");

    await openHistory(panel);
    // The delete button sits beside the row's button, not inside it.
    const row = panel.locator(".history-list li", { hasText: "forget me" });
    await row.locator(".history-delete").click();
    await expect(row).toHaveCount(0);
    await expect(panel.locator(".history-item")).toHaveCount(0);
  });

  test("writes nothing at all when history is switched off", async ({ panel }) => {
    await configured(panel, { historyEnabled: false });
    await answer(panel, "not recorded", "answer 1");

    await openHistory(panel);
    await expect(panel.locator(".history-item")).toHaveCount(0);
    // Not merely hidden — never written.
    const count = await panel.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const req = indexedDB.open("gloss");
          req.onsuccess = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains("threads")) return resolve(0);
            const c = db.transaction("threads").objectStore("threads").count();
            c.onsuccess = () => resolve(c.result);
            c.onerror = () => resolve(-1);
          };
          req.onerror = () => resolve(0);
        }),
    );
    expect(count).toBe(0);
  });

  test("clearing history from settings empties the list", async ({ panel, options }) => {
    await configured(panel);
    await answer(panel, "temporary", "answer 1");

    await options.reload();
    await options.getByRole("button", { name: "Clear all history" }).click();
    await expect(options.locator(".saved")).toHaveText("History cleared");

    await panel.reload();
    await openHistory(panel);
    await expect(panel.locator(".history-item")).toHaveCount(0);
  });

  test("reports what is stored on disk", async ({ panel, options }) => {
    await configured(panel);
    await answer(panel, "counted", "answer 1");

    await options.reload();
    await expect(options.locator("section", { hasText: "Data" }).locator(".hint").first()).toContainText(
      "1 thread saved",
    );
  });
});
