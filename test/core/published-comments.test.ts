import { expect, test } from "bun:test";
import { parseComment } from "../../src/github/core/discussion.ts";
import { PublishedComments } from "../../src/github/core/published-comments.ts";
import type { PullTimelineItem } from "../../src/github/core/pull-timeline.ts";
import right from "../fixtures/pull-plugin-35-comment-right.json";

const comment = parseComment(right, "https://github.com/lw396/herdr-plugin-github/pull/35");
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
