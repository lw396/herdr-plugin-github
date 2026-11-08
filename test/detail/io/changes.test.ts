// Writes made in one view reach the others through Herdr's shared metadata (re-rendering every mod).
import { afterEach, expect, test } from "bun:test";
import { announce, Notices } from "../../../src/github/detail/io/changes.ts";
import { reset, setShared, shared } from "../../fake-herdr.ts";

afterEach(reset);

const row = {
	number: 20,
	title: "t",
	assignees: ["lw396"],
	updatedAt: "2026-11-06T18:23:20Z",
	url: "https://github.com/o/r/issues/20",
};
const closed = { repo: "o/r", number: 20, state: { repo: "o/r", state: "closed" as const, issue: row } };
const comment = {
	repo: "o/r",
	number: 20,
	comment: { id: 1, author: "lw396", createdAt: "2026-11-06T18:23:19Z", body: "x", markdown: "x", reactions: [] },
};

test("views listening receive each write once, in order", () => {
	const sidebar = new Notices(),
		reader = new Notices();
	expect(sidebar.take()).toEqual([]);
	announce(comment);
	announce(closed);
	expect(sidebar.take()).toEqual([comment, closed]);
	expect(sidebar.take()).toEqual([]);
	expect(reader.take()).toEqual([comment, closed]);
});

test("a view that starts later does not replay earlier writes", () => {
	announce(closed);
	const later = new Notices();
	expect(later.take()).toEqual([]);
	announce(comment);
	expect(later.take()).toEqual([comment]);
});

test("a write announced from an older copy of the log still reaches a view that took the newer one", () => {
	const sidebar = new Notices();
	const before = shared("github.changes");
	announce(comment);
	expect(sidebar.take()).toEqual([comment]);
	// Another mod instance read the log before that write landed, then announced its own over it.
	setShared("github.changes", before);
	announce(closed);
	expect(sidebar.take()).toEqual([closed]);
});

test("a view that missed more writes than are kept receives the kept ones", () => {
	const slow = new Notices();
	for (let i = 0; i < 30; i++) announce({ ...comment, number: i });
	const taken = slow.take();
	expect(taken.length).toBeGreaterThan(0);
	expect(taken.at(-1)).toEqual({ ...comment, number: 29 });
});
