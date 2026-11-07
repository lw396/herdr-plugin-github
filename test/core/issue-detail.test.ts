import { expect, test } from "bun:test";
import { parseIssueDetail } from "../../src/github/core/issue-detail.ts";

// Minimal REST shapes (worked examples): an issue and a timeline with one comment.
const issue = (body: string | null) => ({
	number: 1,
	title: "t",
	state: "open",
	user: { login: "a" },
	created_at: "2026-01-01T00:00:00Z",
	html_url: "https://github.com/o/r/issues/1",
	labels: [],
	assignees: [],
	milestone: null,
	body,
});
const comment = (body: string | null) => ({
	event: "commented",
	id: 7,
	user: { login: "b" },
	actor: { login: "b" },
	created_at: "2026-01-02T00:00:00Z",
	body,
	reactions: {},
});

test("the reader's Markdown is prepared once when the issue is parsed: images become links", () => {
	const detail = parseIssueDetail(issue("See ![shot](https://example.com/s.png)"), [
		comment('<img src="https://example.com/c.png">'),
	]);
	expect(detail.markdown).toBe("See [🖼 图片](<https://example.com/s.png>)");
	expect(detail.comments[0]?.markdown).toBe("[🖼 图片](<https://example.com/c.png>)");
});

test("an empty description or comment reads as no text, while the raw body stays empty", () => {
	const detail = parseIssueDetail(issue(null), [comment("")]);
	expect([detail.body, detail.markdown]).toEqual(["", "_No text._"]);
	expect([detail.comments[0]?.body, detail.comments[0]?.markdown]).toEqual(["", "_No text._"]);
});
