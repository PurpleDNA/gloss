import { beforeEach, describe, expect, it } from "vitest";
import { captureSelection } from "../../src/background/capture";
import { installInnerText } from "../support/inner-text";

installInnerText();

/** Selects a node's contents the way a user drag would leave the selection. */
function select(node: Node) {
  const sel = window.getSelection()!;
  const range = document.createRange();
  range.selectNodeContents(node);
  sel.removeAllRanges();
  sel.addRange(range);
}

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

beforeEach(() => {
  document.body.innerHTML = "";
  document.title = "Thermodynamics";
  window.getSelection()?.removeAllRanges();
});

describe("captureSelection", () => {
  it("returns null when nothing is selected", () => {
    document.body.innerHTML = "<p>some prose</p>";
    expect(captureSelection()).toBeNull();
  });

  it("returns null for a whitespace-only selection", () => {
    document.body.innerHTML = "<p>   </p>";
    select(document.querySelector("p")!);
    expect(captureSelection()).toBeNull();
  });

  it("captures the selected text with the page's identity", () => {
    document.body.innerHTML = `<article><p>The <b>entropy</b> of the system rose. ${words(120)}</p></article>`;
    select(document.querySelector("b")!);

    const got = captureSelection()!;
    expect(got.text).toBe("entropy");
    expect(got.title).toBe("Thermodynamics");
    expect(got.url).toBe(location.href);
    expect(got.capturedAt).toBeGreaterThan(0);
  });

  it("climbs to an ancestor carrying enough prose to disambiguate the word", () => {
    // The whole point of the extension: the model sees the sentence, not the word.
    document.body.innerHTML = `<article><p>The <b>entropy</b> of the system rose steadily. ${words(120)}</p></article>`;
    select(document.querySelector("b")!);

    const got = captureSelection()!;
    expect(got.context).toContain("The entropy of the system rose steadily.");
    expect(got.context.length).toBeGreaterThan(400);
  });

  it("drops context that is merely the selection again", () => {
    // A short standalone paragraph adds tokens and no information.
    document.body.innerHTML = "<p>entropy</p>";
    select(document.querySelector("p")!);
    expect(captureSelection()!.context).toBe("");
  });

  it("collapses runs of spaces and blank lines", () => {
    document.body.innerHTML = `<article><p>The    entropy     of\t\tthe system.</p><p></p><p></p><p></p><p>${words(120)}</p></article>`;
    select(document.querySelector("p")!);
    const got = captureSelection()!;
    expect(got.context).toContain("The entropy of the system.");
    expect(got.context).not.toMatch(/\n{3,}/);
  });

  describe("when the surrounding container is huge", () => {
    const LIMIT = 2000;

    function longArticle(needle: string) {
      // The selection sits deep inside, far past a 2000-char slice from the top.
      document.body.innerHTML = `<article><p>${words(900)}</p><p>before <b>${needle}</b> after</p><p>${words(900)}</p></article>`;
    }

    it("keeps the context within the limit", () => {
      longArticle("entropy");
      select(document.querySelector("b")!);
      const got = captureSelection()!;
      expect(got.context.length).toBeLessThanOrEqual(LIMIT + 8); // plus the ellipses
    });

    it("centres the window on the selection rather than slicing from the top", () => {
      longArticle("entropy");
      select(document.querySelector("b")!);
      const got = captureSelection()!;
      expect(got.context).toContain("before entropy after");
    });

    it("marks both ends as truncated", () => {
      longArticle("entropy");
      select(document.querySelector("b")!);
      const got = captureSelection()!;
      expect(got.context.startsWith("... ")).toBe(true);
      expect(got.context.endsWith(" ...")).toBe(true);
    });

    it("does not cut a word in half at either edge", () => {
      longArticle("entropy");
      select(document.querySelector("b")!);
      const body = captureSelection()!.context.replace(/^\.\.\. /, "").replace(/ \.\.\.$/, "");
      // Every token in the fixture is a whole "wordN"; a mid-word cut leaves a stub.
      const tokens = body.split(/\s+/).filter((t) => /^word/.test(t));
      for (const t of tokens) expect(t).toMatch(/^word\d+$/);
    });

    it("falls back to the start when the selection is not in the text verbatim", () => {
      // A selection dragged across a paragraph break reads as "alphabeta", while
      // innerText puts a newline between them — so the needle is genuinely absent.
      document.body.innerHTML = `<article><p>${words(600)} alpha</p><p>beta ${words(600)}</p></article>`;
      const [first, second] = Array.from(document.querySelectorAll("p"));
      const sel = window.getSelection()!;
      const range = document.createRange();
      range.setStart(first.firstChild!, first.textContent!.lastIndexOf("alpha"));
      range.setEnd(second.firstChild!, 4);
      sel.removeAllRanges();
      sel.addRange(range);

      const got = captureSelection()!;
      expect(got.text).toBe("alphabeta");
      expect(got.context.startsWith("...")).toBe(false);
      expect(got.context).toContain("word0");
      expect(got.context.length).toBeLessThanOrEqual(LIMIT + 8);
    });
  });

  it("caps a very long selection at 8000 characters", () => {
    const huge = "x".repeat(9000);
    document.body.innerHTML = `<p>${huge}</p>`;
    select(document.querySelector("p")!);
    expect(captureSelection()!.text).toHaveLength(8000);
  });

  it("stays self-contained, so it survives serialization into the page", () => {
    // chrome.scripting.executeScript stringifies the function; a closure or an
    // import would arrive as a ReferenceError at runtime.
    const source = captureSelection.toString();
    expect(source).not.toMatch(/\bimport\b/);
    expect(() => new Function(`return (${source})`)()).not.toThrow();
  });
});
