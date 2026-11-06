import { fromMarkdown } from "mdast-util-from-markdown";
import { Parser } from "htmlparser2";
import type { Nodes, Image, ImageReference } from "mdast";

/** Browser actions need absolute HTTP(S) URLs; do not rely on DOM URL APIs in QuickJS. */
export function browserUrl(href: string, base: string): string | null {
  const url = href.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (!url || /^[a-z][a-z\d+.-]*:/i.test(url)) return null;
  const origin = /^https?:\/\/[^/?#]+/i.exec(base)?.[0];
  if (!origin) return null;
  if (url.startsWith("//")) return `${origin.split(":")[0]}:${url}`;
  if (url.startsWith("/")) return origin + url;
  const document = base.replace(/[?#].*$/, "");
  if (url.startsWith("#")) return base.split("#")[0] + url;
  if (url.startsWith("?")) return document + url;
  // The system browser performs dot-segment normalization when opening the absolute URL.
  return document.replace(/[^/]*$/, "") + url;
}

const link = (url: string): string => `[🖼 图片](<${url.replace(/</g, "%3C").replace(/>/g, "%3E")}>)`;

/** Images become browser links; source offsets preserve all other Markdown verbatim. */
export function imageLinks(markdown: string): string {
  if (!markdown.includes("![") && !/<img/i.test(markdown)) return markdown;
  const definitions = new Map<string, string>();
  const images: (Image | ImageReference)[] = [];
  const patches: { start: number; end: number; url: string }[] = [];
  function visit(node: Nodes): void {
    if (node.type === "definition" && !definitions.has(node.identifier)) definitions.set(node.identifier, node.url);
    if (node.type === "image" || node.type === "imageReference") images.push(node);
    if (node.type === "html") {
      const start = node.position!.start.offset!, end = node.position!.end.offset!;
      const parser = new Parser({ onopentag(name, attributes) {
        if (name === "img" && attributes.src !== undefined) patches.push({
          start: start + parser.startIndex, end: start + parser.endIndex + 1, url: attributes.src,
        });
      } }, { decodeEntities: true });
      // Parse the original span: node.value can normalize CRLF and shift source offsets.
      parser.end(markdown.slice(start, end));
    }
    if ("children" in node) node.children.forEach(visit);
  }
  visit(fromMarkdown(markdown));
  for (const image of images) {
    const url = image.type === "image" ? image.url : definitions.get(image.identifier);
    if (url !== undefined) patches.push({ start: image.position!.start.offset!, end: image.position!.end.offset!, url });
  }
  patches.sort((a, b) => a.start - b.start);
  let result = "", copied = 0;
  for (const patch of patches) {
    result += markdown.slice(copied, patch.start) + link(patch.url);
    copied = patch.end;
  }
  return result + markdown.slice(copied);
}
