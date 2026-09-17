import { beforeEach, describe, expect, it } from "vitest";
import { applyTheme } from "../../src/lib/theme";

beforeEach(() => document.documentElement.removeAttribute("data-theme"));

describe("applyTheme", () => {
  it("stamps an explicit choice on the root", () => {
    applyTheme("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    applyTheme("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("removes the attribute for system, so prefers-color-scheme decides", () => {
    applyTheme("dark");
    applyTheme("system");
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });
});
