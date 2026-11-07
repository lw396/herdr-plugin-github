import { expect, test } from "bun:test";
import { ConditionalPoll } from "../../src/github/core/polling.ts";

test("hiding cancels a read, showing again refreshes immediately, and switching issues rejects old answers", () => {
	const poll = new ConditionalPoll();
	poll.sync("center:o/r#17", true);
	const hiddenRead = poll.begin()!;
	expect(poll.sync("center:o/r#17", false)).toBe(false);
	expect(poll.begin()).toBeNull();
	expect(poll.finish(hiddenRead, { changed: true, etag: '"hidden"' }).accepted).toBe(false);
	expect(poll.sync("center:o/r#17", true)).toBe(true);
	const firstIssue = poll.begin(true)!;
	expect(poll.sync("local:o/r#18", true)).toBe(true);
	expect(poll.finish(firstIssue, { changed: true, etag: '"first"' }).accepted).toBe(false);
	const otherIssue = poll.begin(true)!;
	expect(otherIssue.etag).toBeNull();
	expect(poll.reload(otherIssue, { changed: false })).toBe(true);
});

test("a failed discussion reload retries without accepting the probe validator", () => {
	const poll = new ConditionalPoll();
	poll.sync("o/r#17", true);
	const request = poll.begin()!;
	expect(poll.reload(request, { changed: true, etag: '"not-loaded"' })).toBe(true);
	expect(poll.begin()).toBeNull();
	poll.finish(request);
	const retry = poll.begin()!;
	expect(retry.etag).toBeNull();
	expect(poll.reload(retry, { changed: true, etag: '"loaded"' })).toBe(true);
});

test("a write invalidates an older read so it cannot erase the new comment", () => {
	const poll = new ConditionalPoll();
	poll.sync("o/r#17", true);
	const old = poll.begin()!;
	expect(poll.begin()).toBeNull();
	poll.invalidate();
	expect(poll.finish(old, { changed: true, etag: '"old"' })).toEqual({ accepted: false, notify: false });
	const fresh = poll.begin()!;
	expect(fresh.etag).toBeNull();
	expect(poll.reload(fresh, { changed: true, etag: '"new"' })).toBe(true);
});

test("a visible issue refreshes immediately, unchanged ticks keep its contents, and recovery redraws", () => {
	const poll = new ConditionalPoll();
	expect(poll.sync("center:o/r#17", true)).toBe(true);
	const first = poll.begin(true)!;
	expect(first.etag).toBeNull();
	expect(poll.reload(first, { changed: true, etag: 'W/"one"' })).toBe(true);
	expect(poll.finish(first, { changed: true, etag: 'W/"one"' })).toEqual({ accepted: true, notify: true });
	const unchanged = poll.begin()!;
	expect(unchanged.etag).toBe('W/"one"');
	expect(poll.reload(unchanged, { changed: false })).toBe(false);
	expect(poll.finish(unchanged, { changed: false })).toEqual({ accepted: true, notify: false });
	const failed = poll.begin()!;
	expect(poll.finish(failed)).toEqual({ accepted: true, notify: true });
	const recovered = poll.begin()!;
	expect(recovered.etag).toBeNull();
	expect(poll.finish(recovered, { changed: false })).toEqual({ accepted: true, notify: true });
});
