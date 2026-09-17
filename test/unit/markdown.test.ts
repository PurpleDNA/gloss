import { describe, expect, it } from "vitest";
import { markdown } from "../../src/lib/markdown";

describe("markdown", () => {
  it("wraps plain lines in paragraphs", () => {
    expect(markdown("hello")).toBe("<p>hello</p>");
  });

  describe("escaping — model output is untrusted input", () => {
    it("neutralises a script tag", () => {
      const html = markdown('<script>alert("x")</script>');
      expect(html).not.toContain("<script");
      expect(html).toContain("&lt;script&gt;");
    });

    it("neutralises an img onerror payload", () => {
      expect(markdown('<img src=x onerror="alert(1)">')).not.toContain("<img");
    });

    it("escapes quotes so an attribute cannot be broken out of", () => {
      expect(markdown('say "hi"')).toBe("<p>say &quot;hi&quot;</p>");
    });

    it("does not linkify a javascript: URL", () => {
      // It stays inert text; only http(s) targets ever become an anchor.
      const html = markdown("[click](javascript:alert(1))");
      expect(html).not.toContain("<a ");
      expect(html).not.toContain("href");
      expect(html).toBe("<p>[click](javascript:alert(1))</p>");
    });

    it("escapes HTML inside a code fence", () => {
      const html = markdown("```\n<script>x</script>\n```");
      expect(html).toContain("<pre><code>&lt;script&gt;x&lt;/script&gt;</code></pre>");
    });
  });

  describe("inline", () => {
    it("renders bold, italic and code", () => {
      expect(markdown("**b** and *i* and `c`")).toBe(
        "<p><strong>b</strong> and <em>i</em> and <code>c</code></p>",
      );
    });

    it("linkifies http(s) links only, with a safe rel", () => {
      expect(markdown("[docs](https://example.com/a)")).toBe(
        '<p><a href="https://example.com/a" target="_blank" rel="noreferrer">docs</a></p>',
      );
    });

    it("leaves an asterisk inside a word alone", () => {
      expect(markdown("a*b*c")).toBe("<p>a*b*c</p>");
    });
  });

  describe("blocks", () => {
    it("groups consecutive bullets into one list", () => {
      expect(markdown("- one\n- two")).toBe("<ul><li>one</li><li>two</li></ul>");
    });

    it("closes a list when prose resumes", () => {
      expect(markdown("- one\n\nafter")).toBe("<ul><li>one</li></ul><p>after</p>");
    });

    it("maps headings down two levels, clamped at h6", () => {
      expect(markdown("# top")).toBe("<h3>top</h3>");
      expect(markdown("#### deep")).toBe("<h6>deep</h6>");
    });

    it("keeps a language hint on a fence", () => {
      expect(markdown("```ts\nconst a = 1;\n```")).toBe(
        '<pre data-lang="ts"><code>const a = 1;</code></pre>',
      );
    });

    it("keeps fenced content verbatim rather than parsing it as markdown", () => {
      const html = markdown("```\n- not a list\n**not bold**\n```");
      expect(html).toContain("- not a list");
      expect(html).not.toContain("<li>");
      expect(html).not.toContain("<strong>");
    });

    it("renders prose either side of a fence", () => {
      expect(markdown("before\n```\ncode\n```\nafter")).toBe(
        "<p>before</p><pre><code>code</code></pre><p>after</p>",
      );
    });

    it("cannot be tricked by a literal fence placeholder in the text", () => {
      // The placeholder is only safe because escaping runs first; assert that.
      const html = markdown("<<GLOSSFENCE:0>>\n\n```\nreal\n```");
      expect(html).toContain("&lt;&lt;GLOSSFENCE:0&gt;&gt;");
      expect(html).toContain("<pre><code>real</code></pre>");
    });
  });

  it("returns an empty string for empty input", () => {
    expect(markdown("")).toBe("");
  });
});
