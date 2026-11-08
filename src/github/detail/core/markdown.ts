import { Parser } from "htmlparser2";
import type { Image, ImageReference, Nodes } from "mdast";
import { fromMarkdown } from "mdast-util-from-markdown";
import type { DetailRef } from "./detail.ts";

/** A link resolved against the issue or PR page (Herdr's QuickJS has the WHATWG URL); only HTTP(S) opens. */
export function browserUrl(href: string, base: string): string | null {
	if (!href.trim()) return null;
	let resolved: URL;
	try {
		resolved = new URL(href.trim(), base);
	} catch {
		return null;
	}
	return resolved.protocol === "http:" || resolved.protocol === "https:" ? resolved.href : null;
}

/** owner/repo of a github.com URL path, or null. GitHub owner and repository names are case-insensitive. */
function githubPath(href: string): string[] | null {
	let url: URL;
	try {
		url = new URL(href);
	} catch {
		return null;
	}
	if (url.protocol !== "https:" && url.protocol !== "http:") return null;
	if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;
	return url.pathname.split("/").filter(Boolean);
}

/** The github.com repository an issue or PR URL belongs to, as owner/repo; otherwise null. */
function ownRepository(url: string): string | null {
	const own = githubPath(url);
	return own && own.length >= 2 ? `${own[0]}/${own[1]}` : null;
}

/** A PR or issue of the reader's repository; foreign repositories and non-detail paths stay in the browser. */
export function detailLink(href: string, base: string): DetailRef | null {
	const target = browserUrl(href, base);
	const repo = ownRepository(base);
	const path = target ? githubPath(target) : null;
	if (
		!repo ||
		!path ||
		path.length !== 4 ||
		(path[2] !== "issues" && path[2] !== "pull") ||
		!/^[1-9]\d*$/.test(path[3]!)
	)
		return null;
	if (`${path[0]}/${path[1]}`.toLowerCase() !== repo.toLowerCase()) return null;
	const number = Number(path[3]);
	return Number.isSafeInteger(number) ? { kind: path[2] === "pull" ? "pr" : "issue", repo, number } : null;
}

/** A compact plain-text hover excerpt: no remote images, markup or template comments. */
export function markdownSummary(markdown: string): string {
	function text(node: Nodes): string {
		if (node.type === "text" || node.type === "inlineCode" || node.type === "code") return node.value;
		if (node.type === "image" || node.type === "imageReference") return node.alt ?? "";
		if (!("children" in node)) return "";
		const separator = node.type === "paragraph" || node.type === "heading" ? "" : " ";
		return node.children.map(text).join(separator);
	}
	const plain = text(fromMarkdown(markdown)).replace(/\s+/g, " ").trim();
	const characters = [...plain];
	return characters.length > 350 ? `${characters.slice(0, 350).join("")}…` : plain;
}

const link = (text: string, url: string): string => `[${text}](<${url.replace(/</g, "%3C").replace(/>/g, "%3E")}>)`;

/**
 * What the reader renders for a body on the page `url`: images, and #123 references to a github.com page's
 * repository, as links; source offsets keep all other Markdown verbatim. An empty body reads as no text.
 */
export function readerMarkdown(body: string, url: string): string {
	return links(body || "_No text._", url);
}

// GitHub's autolinked reference: #<number> after a non-word character, not followed by a word character.
const REFERENCE = /#([1-9]\d*)(?![\w-])/g;
const BEFORE_REFERENCE = /[\s([{"',;:!?*_~]/;
// A ; that ends a character reference (&amp; &#38; &#x26;) is not punctuation before a reference.
const CHARACTER_REFERENCE = /&(?:[a-z][a-z\d]*|#\d+|#x[\da-f]+);$/i;

/** One parse for both rewrites: parsing is slow in QuickJS. */
function links(markdown: string, url: string): string {
	// #123 links only where detailLink opens them in the reader: a github.com page's own repository.
	const repository = ownRepository(url);
	const references = repository !== null && /#[1-9]/.test(markdown);
	if (!references && !markdown.includes("![") && !/<img/i.test(markdown)) return markdown;
	const definitions = new Map<string, string>();
	const images: (Image | ImageReference)[] = [];
	const patches: { start: number; end: number; text: string; url: string }[] = [];
	function visit(node: Nodes, inLink: boolean): void {
		if (references && !inLink && node.type === "text") {
			const start = node.position!.start.offset!,
				end = node.position!.end.offset!;
			// Match the source, not node.value: escapes and character references are not references.
			for (const match of markdown.slice(start, end).matchAll(REFERENCE)) {
				const at = start + match.index!,
					before = markdown[at - 1];
				if (
					before !== undefined &&
					(!BEFORE_REFERENCE.test(before) || CHARACTER_REFERENCE.test(markdown.slice(Math.max(0, at - 12), at)))
				)
					continue;
				patches.push({
					start: at,
					end: at + match[0].length,
					text: match[0],
					url: `https://github.com/${repository}/issues/${match[1]}`,
				});
			}
		}
		if (node.type === "definition" && !definitions.has(node.identifier)) definitions.set(node.identifier, node.url);
		if (node.type === "image" || node.type === "imageReference") images.push(node);
		if (node.type === "html") {
			const start = node.position!.start.offset!,
				end = node.position!.end.offset!;
			const parser = new Parser(
				{
					onopentag(name, attributes) {
						if (name === "img" && attributes.src !== undefined)
							patches.push({
								start: start + parser.startIndex,
								end: start + parser.endIndex + 1,
								text: "🖼 Image",
								url: attributes.src,
							});
					},
				},
				{ decodeEntities: true },
			);
			// Parse the original span: node.value can normalize CRLF and shift source offsets.
			parser.end(markdown.slice(start, end));
		}
		const linked = inLink || node.type === "link" || node.type === "linkReference";
		if ("children" in node) for (const child of node.children) visit(child, linked);
	}
	visit(fromMarkdown(markdown), false);
	for (const image of images) {
		const url = image.type === "image" ? image.url : definitions.get(image.identifier);
		if (url !== undefined)
			patches.push({ start: image.position!.start.offset!, end: image.position!.end.offset!, text: "🖼 Image", url });
	}
	patches.sort((a, b) => a.start - b.start);
	let result = "",
		copied = 0;
	for (const patch of patches) {
		result += markdown.slice(copied, patch.start) + link(patch.text, patch.url);
		copied = patch.end;
	}
	return result + markdown.slice(copied);
}
