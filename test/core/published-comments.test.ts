import { expect, test } from "bun:test";
import { parseComment } from "../../src/github/core/discussion.ts";
import { PublishedComments } from "../../src/github/core/published-comments.ts";
import type { PullTimelineItem } from "../../src/github/core/pull-timeline.ts";
import right from "../fixtures/pull-plugin-35-comment-right.json";

const comment = parseComment(right, "https://github.com/lw396/herdr-plugin-github/pull/35");
test("submitted review stays visible until both endpoints observe it, without draft markers", () => {
	const published = new PublishedComments();
	const thread = published.add(comment, { path: "file", side: "RIGHT", line: 2, outdated: false });
	const item: PullTimelineItem = { ...comment, id: 99, kind: "review", verb: "reviewed", discussion: [] };
	published.activity(item, [thread]);
	expect(published.timeline([]).map((i) => i.id)).toEqual([99]);
	expect(published.timeline([item])).toEqual([item]);
	expect(published.threads([{ ...thread, comments: [{ ...comment, draft: true }] }])[0]?.comments).toEqual([comment]);
	expect(published.threads([])[0]?.comments).toEqual([comment]);
});

test("a submitted review keeps its acknowledged drafts when review metadata arrives before inline comments", () => {
	const published = new PublishedComments();
	const item: PullTimelineItem = {
		...comment,
		id: 99,
		kind: "review",
		verb: "reviewed",
		discussion: [{ root: comment.id, comment, path: "file", snippet: "" }],
	};
	published.activity(item);
	const lagging = { ...item, discussion: [] };
	expect(published.timeline([lagging])[0]?.discussion).toEqual(item.discussion);
	expect(published.timeline([item])).toEqual([item]);
	expect(published.timeline([])).toEqual([]);
});

test("submitting a draft reply keeps it in the diff while the published root is already visible", () => {
	const published = new PublishedComments();
	const thread = published.add(comment, { path: "file", side: "RIGHT", line: 2, outdated: false });
	const reply = { ...comment, id: 999, body: "Reply" };
	const item: PullTimelineItem = { ...comment, id: 99, kind: "review", verb: "reviewed", discussion: [] };
	published.activity(item, [{ ...thread, comments: [comment, reply] }]);
	expect(published.threads([thread])[0]?.comments).toEqual([comment, reply]);
	expect(published.threads([{ ...thread, comments: [comment, reply] }])[0]?.comments).toEqual([comment, reply]);
	expect(published.threads([])).toEqual([]);
});

test("submission promotes drafts without mutating inputs and groups only new conversation roots", () => {
	const published = new PublishedComments();
	const root = {
		id: "root",
		root: comment.id,
		path: "file",
		side: "RIGHT",
		line: 2,
		outdated: false,
		resolved: false,
		canResolve: false,
		canUnresolve: false,
		comments: [{ ...comment, draft: true }],
	} as const;
	const old = {
		...root,
		id: "old",
		root: 1,
		comments: [
			{ ...comment, id: 1 },
			{ ...comment, id: 2, draft: true },
		],
	};
	const threads = [{ ...root, comments: [...root.comments] }, old];
	const item: PullTimelineItem = { ...comment, id: 99, kind: "review", verb: "reviewed", discussion: [] };
	const result = published.submitted(item, threads);
	expect(result.flatMap((t) => t.comments).some((c) => c.draft)).toBe(false);
	expect(threads[0]?.comments[0]?.draft).toBe(true);
	expect(published.timeline([])[0]?.discussion.map((d) => d.root)).toEqual([comment.id]);
	expect(published.threads([])).toHaveLength(2);
});

test("an empty reply-only submission keeps its diff reply without a phantom timeline review", () => {
	const published = new PublishedComments();
	const thread = {
		id: "thread",
		root: comment.id,
		path: "file",
		side: "RIGHT" as const,
		line: 2,
		outdated: false,
		resolved: false,
		canResolve: false,
		canUnresolve: false,
		comments: [comment, { ...comment, id: 999, draft: true }],
	};
	const item: PullTimelineItem = {
		...comment,
		id: 99,
		body: "",
		markdown: "",
		kind: "review",
		verb: "reviewed",
		discussion: [],
	};
	expect(published.submitted(item, [thread])[0]?.comments[1]?.draft).toBeUndefined();
	expect(published.timeline([])).toEqual([]);
	expect(published.threads([])[0]?.comments.map((c) => c.id)).toEqual([comment.id, 999]);
});

const target = { path: "docs/pr-fixture.md", side: "RIGHT", line: 2, outdated: false } as const;

test("diff and timeline catch up independently without losing or duplicating an acknowledged comment", () => {
	const published = new PublishedComments();
	const thread = published.add(comment, target);
	// The discussion endpoint may already be current while the review endpoint still lags.
	published.threads([{ ...thread, id: "real-thread" }]);
	const timeline = published.timeline([]);
	expect(timeline).toHaveLength(1);
	expect(timeline[0]).toMatchObject({
		kind: "review",
		author: "lw396",
		discussion: [{ root: 4502971530, path: "docs/pr-fixture.md", comment }],
	});
	expect(published.timeline([])).toEqual(timeline);
	const review: PullTimelineItem = {
		...timeline[0]!,
		id: 5813962417,
		discussion: [{ root: comment.id, path: target.path, comment, snippet: right.diff_hunk }],
	};
	expect(published.timeline([review])).toEqual([review]);
	expect(published.timeline([])).toEqual([]);
	// The converse also holds: a timeline read must not clear the diff's acknowledgement.
	const other = new PublishedComments();
	other.add(comment, target);
	other.timeline([review]);
	expect(other.threads([])[0]?.comments).toEqual([comment]);
});

test("an acknowledged inline comment stays in the diff through stale and incomplete reads until GitHub catches up", () => {
	const published = new PublishedComments();
	published.add(comment, target);
	const local = published.threads([]);
	expect(local).toHaveLength(1);
	expect(local[0]).toMatchObject({
		root: 4502971530,
		path: "docs/pr-fixture.md",
		side: "RIGHT",
		line: 2,
		canResolve: false,
		comments: [comment],
	});
	expect(published.threads([])).toEqual(local);
	const metadata = { ...local[0]!, id: "real-thread", canResolve: true, comments: [] };
	expect(published.threads([metadata])).toEqual([{ ...metadata, comments: [comment] }]);
	const complete = { ...metadata, comments: [comment] };
	expect(published.threads([complete])).toEqual([complete]);
	// Once an authoritative read has observed it, a later deletion is respected.
	expect(published.threads([])).toEqual([]);
});
