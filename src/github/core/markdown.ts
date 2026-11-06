/** Apply a prose transformation without changing fenced/indented code, code spans or escapes. */
function prose(markdown: string, transform: (text: string) => string): string {
  const protectedParts: string[] = [];
  const protect = (text: string): string => {
    protectedParts.push(text);
    return `\u0000${protectedParts.length - 1}\u0000`;
  };
  // Fences need matching delimiters; a closing fence may be longer than its opening one.
  let fence: { char: string; length: number } | null = null;
  let code = "", text = "";
  for (const line of markdown.match(/[^\n]*\n|[^\n]+$/g) ?? []) {
    if (fence) {
      code += line;
      const end = /^ {0,3}(`+|~+)[ \t]*(?:\n)?$/.exec(line);
      if (end && end[1]![0] === fence.char && end[1]!.length >= fence.length) {
        text += protect(code);
        code = "";
        fence = null;
      }
    } else {
      const start = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (start) {
        fence = { char: start[1]![0]!, length: start[1]!.length };
        code = line;
      } else text += /^(?: {4}|\t)/.test(line) ? protect(line) : line;
    }
  }
  if (code) text += protect(code);
  text = text.replace(/\\[\\!`]|(`+)[\s\S]*?\1(?!`)/g, protect);
  return transform(text).replace(/\u0000(\d+)\u0000/g, (_all, index: string) => protectedParts[Number(index)]!);
}

/** A Markdown destination, including balanced parentheses and optional title. */
function destination(text: string, start: number): { url: string; end: number } | null {
  let i = start;
  while (/\s/.test(text[i] ?? "") && i < text.length) i++;
  const from = i;
  let url: string;
  if (text[i] === "<") {
    const end = text.indexOf(">", i + 1);
    if (end < 0) return null;
    url = text.slice(i + 1, end);
    i = end + 1;
  } else {
    let depth = 0;
    for (; i < text.length; i++) {
      const c = text[i];
      if (c === "\\") { i++; continue; }
      if (c === "(") depth++;
      else if (c === ")") { if (depth === 0) break; depth--; }
      else if (/\s/.test(c!)) break;
    }
    url = text.slice(from, i).replace(/\\([()])/g, "$1");
  }
  const end = /^\s*(?:"[^"]*"|'[^']*'|\([^)]*\))?\s*\)/.exec(text.slice(i));
  return end && url ? { url, end: i + end[0].length } : null;
}

const link = (url: string): string => `[🖼 图片](<${url.replace(/</g, "%3C").replace(/>/g, "%3E")}>)`;

/** Images are links until the person chooses to open them in the browser. */
export function imageLinks(markdown: string): string {
  return prose(markdown, text => {
    text = text.replace(/<img\b(?:[^"'<>]|"[^"]*"|'[^']*')*>/gi, tag => {
      const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i.exec(tag);
      return src ? link((src[1] ?? src[2] ?? src[3]!).replace(/&amp;/gi, "&")) : tag;
    });
    let result = "", copied = 0;
    for (const match of text.matchAll(/!\[[^\]]*\]\(/g)) {
      if (match.index < copied) continue;
      const target = destination(text, match.index + match[0].length);
      if (!target) continue;
      result += text.slice(copied, match.index) + link(target.url);
      copied = target.end;
    }
    result += text.slice(copied);
    const normalize = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();
    const references = new Map<string, string>();
    for (const m of text.matchAll(/^ {0,3}\[([^\]]+)\]:\s*(?:<([^>\n]+)>|(\S+))/gm)) {
      const label = normalize(m[1]!);
      if (!references.has(label)) references.set(label, m[2] ?? m[3]!);
    }
    return result.replace(/!\[([^\]]*)\](?:\[([^\]]*)\])?/g, (all, alt: string, label: string | undefined) => {
      const url = references.get(normalize(label || alt));
      return url ? link(url) : all;
    });
  });
}
