import { captureSelection } from "../../src/background/capture";
import { expect, test } from "./fixtures";

/**
 * The real thing: a real page, a real Selection, and the real innerText that
 * jsdom cannot provide. Playwright serializes the function into the page
 * exactly as chrome.scripting.executeScript does, so this also proves the
 * function survives serialization.
 */
const words = (n: number, prefix = "word") =>
  Array.from({ length: n }, (_, i) => `${prefix}${i}`).join(" ");

async function pageWith(page: import("@playwright/test").Page, body: string, title = "Test Page") {
  await page.setContent(`<!doctype html><html><head><title>${title}</title></head><body>${body}</body></html>`);
}

async function selectIn(page: import("@playwright/test").Page, selector: string) {
  await page.evaluate((sel) => {
    const node = document.querySelector(sel)!;
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  }, selector);
}

test.describe("capturing a selection", () => {
  test("returns null when the user selected nothing", async ({ page }) => {
    await pageWith(page, "<p>some prose</p>");
    expect(await page.evaluate(captureSelection)).toBeNull();
  });

  test("takes the highlighted word with the page's identity", async ({ page }) => {
    await pageWith(page, `<article><p>The <b>entropy</b> of the system rose. ${words(150)}</p></article>`);
    await selectIn(page, "b");

    const got = (await page.evaluate(captureSelection))!;
    expect(got.text).toBe("entropy");
    expect(got.title).toBe("Test Page");
    expect(got.capturedAt).toBeGreaterThan(0);
  });

  test("carries the sentence the word sat in — the whole point of the extension", async ({ page }) => {
    await pageWith(
      page,
      `<article><p>The <b>entropy</b> of the system rose steadily all afternoon. ${words(150)}</p></article>`,
    );
    await selectIn(page, "b");

    const got = (await page.evaluate(captureSelection))!;
    expect(got.context).toContain("The entropy of the system rose steadily all afternoon.");
  });

  test("climbs past a wrapper too small to disambiguate anything", async ({ page }) => {
    // The span alone says nothing; the article around it does.
    await pageWith(
      page,
      `<article><h1>Thermodynamics</h1><p><span><b>entropy</b></span></p><p>${words(150)}</p></article>`,
    );
    await selectIn(page, "b");

    const got = (await page.evaluate(captureSelection))!;
    expect(got.context.length).toBeGreaterThan(400);
    expect(got.context).toContain("Thermodynamics");
  });

  test("drops context that is only the selection repeated", async ({ page }) => {
    await pageWith(page, "<p>entropy</p>");
    await selectIn(page, "p");
    expect((await page.evaluate(captureSelection))!.context).toBe("");
  });

  test("ignores script and style text, which innerText never shows", async ({ page }) => {
    await pageWith(
      page,
      `<article><style>.x{color:red}</style><script>var secret = "do not send";</script>
       <p>The <b>entropy</b> of the system. ${words(150)}</p></article>`,
    );
    await selectIn(page, "b");

    const got = (await page.evaluate(captureSelection))!;
    expect(got.context).not.toContain("do not send");
    expect(got.context).not.toContain("color:red");
  });

  test("windows a long article around the selection instead of slicing the top", async ({ page }) => {
    await pageWith(
      page,
      `<article><p>${words(900, "top")}</p><p>before <b>entropy</b> after</p><p>${words(900, "bottom")}</p></article>`,
    );
    await selectIn(page, "b");

    const got = (await page.evaluate(captureSelection))!;
    expect(got.context).toContain("before entropy after");
    expect(got.context.length).toBeLessThanOrEqual(2008);
    expect(got.context.startsWith("...")).toBe(true);
    expect(got.context.endsWith("...")).toBe(true);
    // It is a window around the word, not the head of the article.
    expect(got.context).not.toContain("top0 ");
  });

  test("caps a runaway selection at 8000 characters", async ({ page }) => {
    await pageWith(page, `<p>${"x".repeat(9000)}</p>`);
    await selectIn(page, "p");
    expect((await page.evaluate(captureSelection))!.text).toHaveLength(8000);
  });

  test("collapses the whitespace a page's markup leaves behind", async ({ page }) => {
    await pageWith(
      page,
      `<article><p>The     entropy
        of      the system.</p><p>${words(150)}</p></article>`,
    );
    await selectIn(page, "p");

    const got = (await page.evaluate(captureSelection))!;
    expect(got.context).not.toMatch(/ {2}/);
    expect(got.context).not.toMatch(/\n{3}/);
  });

  test("reads a selection inside a shadow-free nested layout", async ({ page }) => {
    await pageWith(
      page,
      `<main><section><div><article><p>A <b>quark</b> is a particle. ${words(150)}</p></article></div></section></main>`,
    );
    await selectIn(page, "b");

    const got = (await page.evaluate(captureSelection))!;
    expect(got.text).toBe("quark");
    expect(got.context).toContain("A quark is a particle.");
  });
});
