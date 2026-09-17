import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATE, VARIABLES, buildPrompt } from "../../src/prompts/templates";
import type { Capture } from "../../src/lib/types";

const capture: Capture = {
  text: "entropy",
  context: "The entropy of the system rose steadily.",
  url: "https://example.com/thermo",
  title: "Thermodynamics",
  capturedAt: 0,
};

describe("buildPrompt", () => {
  it("prepends page metadata and surrounding context by default", () => {
    const prompt = buildPrompt(DEFAULT_TEMPLATE, capture);
    expect(prompt).toContain("Page: Thermodynamics");
    expect(prompt).toContain("URL: https://example.com/thermo");
    expect(prompt).toContain("Surrounding context:");
    expect(prompt).toContain(capture.context);
    expect(prompt.endsWith("Explain this, as it is used here: entropy")).toBe(true);
  });

  it("does not prepend context when the template places it itself", () => {
    const prompt = buildPrompt("Context: {context}\nWord: {selection}", capture);
    // The whole point: exactly one copy of the context, not two.
    expect(prompt.split(capture.context)).toHaveLength(2);
    expect(prompt).not.toContain("Surrounding context:");
    expect(prompt).not.toContain("Page: ");
  });

  it("substitutes every documented variable", () => {
    const template = VARIABLES.map((v) => `${v}=[{${v}}]`).join(" ");
    const prompt = buildPrompt(template, capture);
    expect(prompt).toContain("selection=[entropy]");
    expect(prompt).toContain("context=[The entropy of the system rose steadily.]");
    expect(prompt).toContain("title=[Thermodynamics]");
    expect(prompt).toContain("url=[https://example.com/thermo]");
  });

  it("replaces every occurrence of a repeated placeholder", () => {
    expect(buildPrompt("{selection} vs {selection}", { ...capture, context: "", title: "", url: "" })).toBe(
      "entropy vs entropy",
    );
  });

  it("falls back to (untitled) when a page has a URL but no title", () => {
    const prompt = buildPrompt(DEFAULT_TEMPLATE, { ...capture, title: "" });
    expect(prompt).toContain("Page: (untitled)");
  });

  it("omits the page block entirely when there is no title or URL", () => {
    const prompt = buildPrompt(DEFAULT_TEMPLATE, { ...capture, title: "", url: "" });
    expect(prompt).not.toContain("Page:");
    expect(prompt).toContain("Surrounding context:");
  });

  it("omits the context block when nothing surrounded the selection", () => {
    const prompt = buildPrompt(DEFAULT_TEMPLATE, { ...capture, context: "" });
    expect(prompt).not.toContain("Surrounding context:");
    expect(prompt).toContain("Page: Thermodynamics");
  });
});
