/**
 * jsdom has no layout, so HTMLElement.innerText is undefined there. This is a
 * block-aware approximation, good enough to exercise captureSelection's
 * traversal and windowing. The real innerText is covered by the E2E capture
 * spec, which runs the same function inside a real browser.
 */
const BLOCK = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DIV", "DL", "DT", "DD", "FIGURE",
  "FOOTER", "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN",
  "NAV", "OL", "P", "PRE", "SECTION", "TABLE", "TR", "UL",
]);

/** Never rendered, so innerText does not see them — the <title> especially. */
const HIDDEN = new Set(["HEAD", "TITLE", "SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);

function render(el: Element): string {
  let out = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.textContent ?? "";
      continue;
    }
    if (!(node instanceof Element)) continue;
    if (HIDDEN.has(node.tagName)) continue;
    if (node.tagName === "BR") {
      out += "\n";
      continue;
    }
    const block = BLOCK.has(node.tagName);
    if (block && out && !out.endsWith("\n")) out += "\n";
    out += render(node);
    if (block) out += "\n";
  }
  return out;
}

export function installInnerText(): void {
  Object.defineProperty(HTMLElement.prototype, "innerText", {
    configurable: true,
    get(this: HTMLElement) {
      return render(this).replace(/\n{3,}/g, "\n\n").trim();
    },
  });
}
