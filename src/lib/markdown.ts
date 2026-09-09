/**
 * Deliberately tiny markdown renderer. The source is HTML-escaped up front, so
 * there is no injection surface and no dependency.
 */
const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ESCAPES[c]);

function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|\W)\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
    );
}

export function markdown(src: string): string {
  // Escape before anything else. That makes a raw "<" impossible in the
  // remaining text, so the fence placeholder below cannot collide with content.
  let text = escape(src);

  const fences: string[] = [];
  text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, lang: string, code: string) => {
    const attr = lang ? ` data-lang="${lang}"` : "";
    fences.push(`<pre${attr}><code>${code.replace(/\n$/, "")}</code></pre>`);
    return `<<GLOSSFENCE:${fences.length - 1}>>`;
  });

  const out: string[] = [];
  let list: string[] | null = null;

  const flush = () => {
    if (list) {
      out.push(`<ul>${list.map((li) => `<li>${inline(li)}</li>`).join("")}</ul>`);
      list = null;
    }
  };

  for (const line of text.split("\n")) {
    const fence = line.match(/^<<GLOSSFENCE:(\d+)>>$/);
    if (fence) {
      flush();
      out.push(fences[Number(fence[1])]);
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      (list ??= []).push(bullet[1]);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flush();
      const level = Math.min(heading[1].length + 2, 6);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (!line.trim()) {
      flush();
      continue;
    }

    flush();
    out.push(`<p>${inline(line)}</p>`);
  }

  flush();
  return out.join("");
}
