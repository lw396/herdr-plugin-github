import { expect, test } from "bun:test";
import { markdownSummary } from "../../src/github/core/markdown.ts";
import { PreviewIntent, parsePreview, previewKey } from "../../src/github/core/preview.ts";

test("late row exits cannot discard another row's preview request", () => {
	const hover = new PreviewIntent();
	const first = hover.enter("open#1");
	const second = hover.enter("open#2");
	expect(hover.leave("open#1")).toBe(false);
	expect(hover.current(first)).toBe(false);
	expect(hover.current(second)).toBe(true);
	expect(hover.leave("open#2")).toBe(true);
	expect(hover.current(second)).toBe(false);
	const returned = hover.enter("open#2");
	expect(hover.current(second)).toBe(false);
	expect(hover.current(returned)).toBe(true);
});

test("preview identity ignores repository casing but separates accounts, machines and kinds", () => {
	const ref = { kind: "pr", repo: "CLI/cli", number: 7 } as const;
	const key = previewKey(ref, "center", "reviewer");
	expect(key).toBe('["center","reviewer","cli/cli/pull/7"]');
	expect(previewKey({ ...ref, repo: "cli/CLI" }, "center", "reviewer")).toBe(key);
	expect(previewKey(ref, null, "reviewer")).not.toBe(key);
	expect(previewKey(ref, "center", "another")).not.toBe(key);
	expect(previewKey({ ...ref, kind: "issue" }, "center", "reviewer")).not.toBe(key);
});

test("hover summaries keep readable Markdown text without formatting, comments or image URLs", () => {
	expect(
		markdownSummary(
			"<!-- template -->\n# Summary\n\nFix **hover** and [links](https://example.com).\n\n![shot](https://example.com/image.png)\n\n`code` &amp; text",
		),
	).toBe("Summary Fix hover and links. shot code & text");
	expect(markdownSummary(" \n")).toBe("");
	expect(markdownSummary("😀".repeat(351))).toBe(`${"😀".repeat(350)}…`);
});

test("PR hover states distinguish merged, closed drafts and open drafts; empty descriptions remain empty", () => {
	const item = { title: "A PR", user: null, created_at: "2026-11-07T00:00:00Z", state: "open", body: null, labels: [] };
	expect(parsePreview({ ...item, draft: true }, "pr")).toMatchObject({ state: "draft", author: null, summary: "" });
	expect(parsePreview({ ...item, draft: true, state: "closed" }, "pr").state).toBe("closed");
	expect(parsePreview({ ...item, state: "closed", merged_at: "2026-11-07T01:00:00Z" }, "pr").state).toBe("merged");
	expect(parsePreview(item, "issue").state).toBe("open");
});
