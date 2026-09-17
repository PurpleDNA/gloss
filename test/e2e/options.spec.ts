import { expect, test } from "./fixtures";

test.describe("settings", () => {
  test("lists every provider, flagging the free ones", async ({ options }) => {
    const names = options.locator(".provider .provider-name");
    await expect(names).toHaveText(["Claude", "Gemini", "OpenRouter", "OpenAI", "Ollama (local)"]);
    await expect(options.locator(".provider", { has: options.locator(".badge.free") })).toHaveCount(3);
  });

  test("switching provider switches the key section with it", async ({ options }) => {
    await expect(options.getByRole("heading", { name: "Claude key" })).toBeVisible();
    await options.getByRole("button", { name: /^Gemini/ }).click();
    await expect(options.getByRole("heading", { name: "Gemini key" })).toBeVisible();
    await expect(options.locator("input[type=password]")).toHaveAttribute("placeholder", "AIza...");
  });

  test("saves a key, badges it, and confirms it is ready", async ({ options }) => {
    await options.locator("input[type=password]").fill("sk-ant-e2e");
    await options.getByRole("button", { name: "Save" }).click();

    await expect(options.locator(".saved")).toHaveText(/Ready/);
    await expect(options.locator(".provider", { hasText: "Claude" }).locator(".badge.ok")).toHaveText(
      "key set",
    );
    expect(
      await options.evaluate(() => chrome.storage.local.get("gloss:key:anthropic")),
    ).toEqual({ "gloss:key:anthropic": "sk-ant-e2e" });
  });

  test("hides a key behind a reveal toggle", async ({ options }) => {
    const field = options.locator("input[type=password], input[type=text]").first();
    await field.fill("sk-ant-secret");
    await expect(field).toHaveAttribute("type", "password");
    await options.getByRole("button", { name: "Show" }).click();
    await expect(field).toHaveAttribute("type", "text");
  });

  test("deletes a key on request", async ({ options }) => {
    await options.locator("input[type=password]").fill("sk-ant-e2e");
    await options.getByRole("button", { name: "Save" }).click();
    await expect(options.locator(".badge.ok")).toBeVisible();

    await options.getByRole("button", { name: "Delete Claude key" }).click();
    await expect(options.locator(".saved")).toHaveText("Claude key deleted");
    await expect(options.locator(".badge.ok")).toHaveCount(0);
  });

  test("offers Connect only for the provider that can mint a key", async ({ options }) => {
    await expect(options.getByRole("button", { name: "Connect OpenRouter" })).toHaveCount(0);
    await options.getByRole("button", { name: /^OpenRouter/ }).click();
    await expect(options.getByRole("button", { name: "Connect OpenRouter" })).toBeVisible();
    await expect(options.locator(".or")).toHaveText("or paste a key");
  });

  test("connecting from settings fills the key field in place", async ({ options, context }) => {
    await context.route("https://openrouter.ai/api/v1/auth/keys", (route) =>
      route.fulfill({ json: { key: "sk-or-v1-from-settings" } }),
    );
    await options.getByRole("button", { name: /^OpenRouter/ }).click();
    await options.getByRole("button", { name: "Connect OpenRouter" }).click();

    await expect(options.locator(".saved")).toHaveText(/Connected/);
    await options.getByRole("button", { name: "Show" }).click();
    await expect(options.locator("input[type=text]").first()).toHaveValue("sk-or-v1-from-settings");
  });

  test("keeps a separate model per provider", async ({ options }) => {
    await options.locator("select").first().selectOption("claude-opus-5");
    await options.getByRole("button", { name: /^Gemini/ }).click();
    await expect(options.locator("select").first()).not.toHaveValue("claude-opus-5");

    await options.getByRole("button", { name: /^Claude/ }).click();
    await expect(options.locator("select").first()).toHaveValue("claude-opus-5");
  });

  test("accepts a typed model id when the list is stale", async ({ options }) => {
    // Providers rename and retire models constantly; this is the escape hatch.
    await options.locator("select").first().selectOption("__custom");
    const custom = options.locator("input[type=text]").last();
    await expect(custom).toBeVisible();
    await custom.fill("some/new-model:free");

    await expect
      .poll(async () =>
        options.evaluate(async () => {
          const got = await chrome.storage.sync.get("gloss:settings");
          return (got["gloss:settings"] as { models: Record<string, string> }).models.anthropic;
        }),
      )
      .toBe("some/new-model:free");

    // And it survives a reload rather than snapping back to the default.
    await options.reload();
    await expect(options.locator("select").first()).toHaveValue("__custom");
    await expect(options.locator("input[type=text]").last()).toHaveValue("some/new-model:free");
  });

  test("stays in Custom mode while the field is still empty", async ({ options }) => {
    await options.locator("select").first().selectOption("__custom");
    await expect(options.locator("select").first()).toHaveValue("__custom");
    await expect(options.locator("input[type=text]").last()).toBeVisible();
  });

  test("saves the prompt template on blur, and resets it", async ({ options }) => {
    const template = options.locator("textarea").first();
    const original = await template.inputValue();
    await template.fill("Define {selection} in one line");
    await template.blur();
    await expect(options.locator(".saved")).toHaveText("Question saved");

    await options.reload();
    await expect(options.locator("textarea").first()).toHaveValue("Define {selection} in one line");

    await options.getByRole("button", { name: "Reset to default" }).first().click();
    await expect(options.locator("textarea").first()).toHaveValue(original);
  });

  test("warns when a template drops {selection} entirely", async ({ options }) => {
    // Without it the highlighted text never reaches the model at all.
    const template = options.locator("textarea").first();
    await template.fill("Explain the page");
    await expect(options.locator(".warn")).toContainText("{selection}");
  });

  test("saves the system prompt separately", async ({ options }) => {
    const system = options.locator("textarea.system-prompt");
    await system.fill("Answer in one word.");
    await system.blur();
    await expect(options.locator(".saved")).toHaveText("System prompt saved");
    expect(await options.evaluate(() => chrome.storage.sync.get("gloss:system"))).toEqual({
      "gloss:system": "Answer in one word.",
    });
  });

  test("turns history off and back on", async ({ options }) => {
    const toggle = options.locator(".toggle input[type=checkbox]");
    await expect(toggle).toBeChecked();
    await toggle.uncheck();

    await expect
      .poll(async () =>
        options.evaluate(async () => {
          const got = await chrome.storage.sync.get("gloss:settings");
          return (got["gloss:settings"] as { historyEnabled: boolean }).historyEnabled;
        }),
      )
      .toBe(false);
  });

  test("resets every setting", async ({ options }) => {
    await options.getByRole("button", { name: /^Gemini/ }).click();
    await options.getByRole("button", { name: "Reset settings" }).click();
    await expect(options.locator(".saved")).toHaveText("Settings reset");
    await expect(options.getByRole("heading", { name: "Claude key" })).toBeVisible();
  });
});
