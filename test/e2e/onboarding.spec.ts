import { expect, seed, test } from "./fixtures";

test.describe("onboarding", () => {
  test("greets a fresh install with the hero and both ways in", async ({ panel }) => {
    await expect(panel.locator(".hero")).toHaveText("Understand anything");
    await expect(panel.getByRole("button", { name: "Set API key" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Connect OpenRouter" })).toBeVisible();
    await expect(panel.locator(".or")).toHaveText("or");
    await expect(panel.locator(".welcome-note")).toHaveText("Gloss needs an AI provider first.");

    // Nothing to type into until a provider exists.
    await expect(panel.locator(".composer")).toHaveCount(0);
  });

  test("the hero's two halves are actually different colours", async ({ panel }) => {
    const whole = panel.locator(".hero");
    const accented = panel.locator(".hero span");
    const [base, accent] = await Promise.all([
      whole.evaluate((el) => getComputedStyle(el).color),
      accented.evaluate((el) => getComputedStyle(el).color),
    ]);
    expect(base).not.toBe(accent);
  });

  test("Set API key opens settings", async ({ panel, context }) => {
    const opened = context.waitForEvent("page");
    await panel.getByRole("button", { name: "Set API key" }).click();
    const settings = await opened;
    expect(settings.url()).toContain("options.html");
    await expect(settings.getByRole("heading", { name: "Provider" })).toBeVisible();
  });

  test.describe("Connect OpenRouter", () => {
    test("signs in, stores the minted key, and lands in the conversation", async ({ panel, context }) => {
      await context.route("https://openrouter.ai/api/v1/auth/keys", (route) =>
        route.fulfill({ json: { key: "sk-or-v1-e2e" } }),
      );

      await panel.getByRole("button", { name: "Connect OpenRouter" }).click();

      // The welcome screen gives way to the composer.
      await expect(panel.locator(".welcome")).toHaveCount(0);
      await expect(panel.locator("textarea")).toBeVisible();

      const stored = await panel.evaluate(async () => {
        const got = await chrome.storage.local.get("gloss:key:openrouter");
        const settings = await chrome.storage.sync.get("gloss:settings");
        return {
          key: got["gloss:key:openrouter"],
          providerId: (settings["gloss:settings"] as { providerId?: string })?.providerId,
        };
      });
      expect(stored.key).toBe("sk-or-v1-e2e");
      // Connecting also makes OpenRouter the active provider.
      expect(stored.providerId).toBe("openrouter");
    });

    test("asks for host access before opening the sign-in tab", async ({ panel, context }) => {
      await context.route("https://openrouter.ai/api/v1/auth/keys", (route) =>
        route.fulfill({ json: { key: "sk-or-v1-e2e" } }),
      );
      await panel.getByRole("button", { name: "Connect OpenRouter" }).click();
      await expect(panel.locator(".welcome")).toHaveCount(0);

      const requests = await panel.evaluate(() => (window as any).__glossPermissionRequests);
      expect(requests).toEqual([{ origins: ["https://openrouter.ai/*"] }]);
    });

    test("sends a real PKCE challenge with the extension's redirect URL", async ({ panel, context }) => {
      await context.route("https://openrouter.ai/api/v1/auth/keys", (route) =>
        route.fulfill({ json: { key: "sk-or-v1-e2e" } }),
      );
      await panel.getByRole("button", { name: "Connect OpenRouter" }).click();
      await expect(panel.locator(".welcome")).toHaveCount(0);

      const [launched, redirect] = await panel.evaluate(() => [
        (window as any).__glossAuthLaunches[0] as string,
        chrome.identity.getRedirectURL(),
      ]);
      const url = new URL(launched);
      expect(url.origin + url.pathname).toBe("https://openrouter.ai/auth");
      expect(url.searchParams.get("callback_url")).toBe(redirect);
      expect(redirect).toMatch(/^https:\/\/[a-p]+\.chromiumapp\.org\/$/);
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      expect(url.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9\-_]{43}$/);
    });

    test("exchanges the code returned by the redirect", async ({ panel, context }) => {
      let body: Record<string, string> | null = null;
      await context.route("https://openrouter.ai/api/v1/auth/keys", (route) => {
        body = JSON.parse(route.request().postData() ?? "{}");
        return route.fulfill({ json: { key: "sk-or-v1-e2e" } });
      });
      await panel.getByRole("button", { name: "Connect OpenRouter" }).click();
      await expect(panel.locator(".welcome")).toHaveCount(0);

      expect(body!).toMatchObject({ code: "e2e-auth-code", code_challenge_method: "S256" });
      expect(body!.code_verifier).toMatch(/^[A-Za-z0-9\-_]{43}$/);
    });

    test("stays put and explains itself when the user cancels", async ({ panel }) => {
      await panel.evaluate(() => ((window as any).__glossCancelAuth = true));
      await panel.getByRole("button", { name: "Connect OpenRouter" }).click();

      await expect(panel.locator(".welcome .error")).toHaveText("Connection cancelled.");
      await expect(panel.locator(".hero")).toBeVisible();
      expect(await panel.evaluate(() => chrome.storage.local.get("gloss:key:openrouter"))).toEqual({});
    });

    test("reports a refused exchange rather than pretending to be connected", async ({ panel, context }) => {
      await context.route("https://openrouter.ai/api/v1/auth/keys", (route) =>
        route.fulfill({ status: 403, body: "nope" }),
      );
      await panel.getByRole("button", { name: "Connect OpenRouter" }).click();

      await expect(panel.locator(".welcome .error")).toContainText("403");
      await expect(panel.locator(".hero")).toBeVisible();
    });
  });

  test("a configured install skips onboarding entirely", async ({ panel }) => {
    await seed(panel, { keys: { openrouter: "sk-or-v1-existing" }, settings: { providerId: "openrouter" } });
    await expect(panel.locator(".welcome")).toHaveCount(0);
    await expect(panel.locator("textarea")).toBeVisible();
  });
});

test.describe("the animated logo", () => {
  type Page = import("@playwright/test").Page;

  // evaluateAll does not auto-wait, so an unguarded sample can read an empty page.
  test.beforeEach(async ({ panel }) => {
    await expect(panel.locator(".welcome .logo .logo-line")).toHaveCount(3);
  });

  /** Widths of the three lines at a given point in the loop, in milliseconds. */
  const widthsAt = (panel: Page, ms: number) =>
    panel.locator(".welcome .logo .logo-line").evaluateAll((els, t) => {
      for (const el of els) for (const a of el.getAnimations()) a.currentTime = t;
      return els.map((el) => getComputedStyle(el).width);
    }, ms);

  test("moves all three lines through the first 1.5s, out of step", async ({ panel }) => {
    const frames = [];
    for (const t of [0, 200, 400, 600, 800, 1000, 1200, 1400]) {
      frames.push(await widthsAt(panel, t));
    }

    for (const line of [0, 1, 2]) {
      const seen = new Set(frames.map((f) => f[line]));
      expect(seen.size, `line ${line + 1} never moved`).toBeGreaterThan(3);
    }
    // No frame has all three at the same width: they never march together.
    expect(frames.every((f) => f[0] === f[1] && f[1] === f[2])).toBe(false);
  });

  test("then rests for three seconds before going again", async ({ panel }) => {
    const resting = await widthsAt(panel, 0);

    // Everything from 1.5s to the end of the 4.5s cycle is stillness.
    for (const t of [1600, 2200, 3000, 3800, 4490]) {
      expect(await widthsAt(panel, t), `moved at ${t}ms`).toEqual(resting);
    }

    // And it is moving again right after the cycle restarts.
    expect(await widthsAt(panel, 4500 + 400)).not.toEqual(resting);
  });

  test("returns to exactly where it started, so the loop does not snap", async ({ panel }) => {
    expect(await widthsAt(panel, 1500)).toEqual(await widthsAt(panel, 0));
  });

  test("loops forever on a 4.5s cycle", async ({ panel }) => {
    const style = await panel.locator(".welcome .logo .line-2").evaluate((el) => {
      const s = getComputedStyle(el);
      return { name: s.animationName, duration: s.animationDuration, count: s.animationIterationCount };
    });
    expect(style.name).toBe("gloss-line-2");
    expect(style.duration).toBe("4.5s");
    expect(style.count).toBe("infinite");
  });

  test("leaves the header logo still", async ({ panel }) => {
    const header = await panel
      .locator(".bar .logo .line-2")
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(header).toBe("none");
  });

  test("holds still for anyone who asked for less motion", async ({ panel }) => {
    await panel.emulateMedia({ reducedMotion: "reduce" });
    await panel.reload();
    const name = await panel
      .locator(".welcome .logo .line-2")
      .evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe("none");
  });
});
