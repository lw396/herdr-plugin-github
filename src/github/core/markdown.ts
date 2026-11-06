import { fromMarkdown } from "mdast-util-from-markdown";
import { Parser } from "htmlparser2";
import type { Nodes, Image, ImageReference } from "mdast";

/** A link resolved against the issue page (Herdr's QuickJS has the WHATWG URL); only HTTP(S) opens. */
export function browserUrl(href: string, base: string): string | null {
  if (!href.trim()) return null;
  let resolved: URL;
  try { resolved = new URL(href.trim(), base); } catch { return null; }
  return resolved.protocol === "http:" || resolved.protocol === "https:" ? resolved.href : null;
}

/** owner/repo of a github.com URL path, or null. GitHub owner and repository names are case-insensitive. */
function githubPath(href: string): string[] | null {
  let url: URL;
  try { url = new URL(href); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;
  return url.pathname.split("/").filter(Boolean);
}

/** An issue of the reader's own repository (the issue URL's repository), resolved like browserUrl; otherwise null. */
export function issueLink(href: string, issueUrl: string): { repo: string; number: number } | null {
  const target = browserUrl(href, issueUrl);
  if (!target) return null;
  const own = githubPath(issueUrl), path = githubPath(target);
  if (!own || !path || own.length < 2 || path.length !== 4 || path[2] !== "issues" || !/^[1-9]\d*$/.test(path[3]!)) return null;
  if (path[0]!.toLowerCase() !== own[0]!.toLowerCase() || path[1]!.toLowerCase() !== own[1]!.toLowerCase()) return null;
  const number = Number(path[3]);
  return Number.isSafeInteger(number) ? { repo: `${own[0]}/${own[1]}`, number } : null;
}

const link = (text: string, url: string): string => `[${text}](<${url.replace(/</g, "%3C").replace(/>/g, "%3E")}>)`;

/** What the reader renders for a body: images and #123 references as links; an empty body reads as no text. */
export function readerMarkdown(body: string, issueUrl: string): string {
  return links(body || "_No text._", issueUrl);
}

/** Images become browser links; source offsets preserve all other Markdown verbatim. */
export function imageLinks(markdown: string): string {
  return links(markdown, null);
}

// GitHub's autolinked reference: #<number> after a non-word character, not followed by a word character.
const REFERENCE = /#([1-9]\d*)(?![\w-])/g;
const BEFORE_REFERENCE = /[\s([{"',;:!?*_~]/;

/** One parse for both rewrites (parsing is slow in QuickJS); a null issue URL rewrites images only. */
function links(markdown: string, issueUrl: string | null): string {
  const references = issueUrl !== null && /#[1-9]/.test(markdown);
  if (!references && !markdown.includes("![") && !/<img/i.test(markdown)) return markdown;
  const repository = issueUrl?.replace(/\/issues\/\d+.*$/, "");
  const definitions = new Map<string, string>();
  const images: (Image | ImageReference)[] = [];
  const patches: { start: number; end: number; text: string; url: string }[] = [];
  function visit(node: Nodes, inLink: boolean): void {
    // A link's text is already a link.
    if (references && !inLink && node.type === "text") {
      const start = node.position!.start.offset!, end = node.position!.end.offset!;
      // Match the source, not node.value: escapes and character references are not references.
      for (const match of markdown.slice(start, end).matchAll(REFERENCE)) {
        const at = start + match.index!, before = markdown[at - 1];
        if (before === undefined || BEFORE_REFERENCE.test(before)) patches.push({
          start: at, end: at + match[0].length, text: match[0], url: `${repository}/issues/${match[1]}`,
        });
      }
    }
    if (node.type === "definition" && !definitions.has(node.identifier)) definitions.set(node.identifier, node.url);
    if (node.type === "image" || node.type === "imageReference") images.push(node);
    if (node.type === "html") {
      const start = node.position!.start.offset!, end = node.position!.end.offset!;
      const parser = new Parser({
        onopentag(name, attributes) {
          if (name === "img" && attributes.src !== undefined) patches.push({
            start: start + parser.startIndex, end: start + parser.endIndex + 1, text: "🖼 图片", url: attributes.src,
          });
        }
      }, { decodeEntities: true });
      // Parse the original span: node.value can normalize CRLF and shift source offsets.
      parser.end(markdown.slice(start, end));
    }
    const linked = inLink || node.type === "link" || node.type === "linkReference";
    if ("children" in node) for (const child of node.children) visit(child, linked);
  }
  visit(fromMarkdown(markdown), false);
  for (const image of images) {
    const url = image.type === "image" ? image.url : definitions.get(image.identifier);
    if (url !== undefined) patches.push({ start: image.position!.start.offset!, end: image.position!.end.offset!, text: "🖼 图片", url });
  }
  patches.sort((a, b) => a.start - b.start);
  let result = "", copied = 0;
  for (const patch of patches) {
    result += markdown.slice(copied, patch.start) + link(patch.text, patch.url);
    copied = patch.end;
  }
  return result + markdown.slice(copied);
}
