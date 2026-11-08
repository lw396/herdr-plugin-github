// A small cache for what the sidebar shows: kept per key, fresh for a while, shown even when stale.
import { describe, expect, test } from "bun:test";
import { Cache } from "../../src/github/core/cache.ts";

describe("Cache", () => {
	test("a value set is there, fresh within its age", () => {
		const cache = new Cache<string>(10);
		cache.set("center|/w/app", "lw396/herdr-plugin-github", 1_000);
		expect(cache.get("center|/w/app")).toBe("lw396/herdr-plugin-github");
		expect(cache.fresh("center|/w/app", 60_000, 1_000 + 59_999)).toBe(true);
	});

	test("past its age: still there to show, but not fresh", () => {
		const cache = new Cache<string>(10);
		cache.set("k", "v", 1_000);
		expect(cache.fresh("k", 60_000, 61_000)).toBe(false);
		expect(cache.get("k")).toBe("v");
	});

	test("an unknown key: nothing, and not fresh", () => {
		const cache = new Cache<string>(10);
		expect(cache.get("k")).toBeUndefined();
		expect(cache.fresh("k", 60_000, 0)).toBe(false);
	});

	test("null is a value (no GitHub remote), not a miss", () => {
		const cache = new Cache<string | null>(10);
		cache.set("k", null, 0);
		expect(cache.has("k")).toBe(true);
		expect(cache.get("k")).toBeNull();
	});

	test("deleting one entry leaves other cached results intact", () => {
		const cache = new Cache<string>(2);
		cache.set("failed", "unavailable", 0);
		cache.set("kept", "ready", 0);
		cache.delete("failed");
		cache.delete("missing");
		expect(cache.has("failed")).toBe(false);
		expect(cache.get("failed")).toBeUndefined();
		expect(cache.fresh("failed", 1000, 0)).toBe(false);
		expect(cache.get("kept")).toBe("ready");
	});

	test("over its limit, the least recently used goes", () => {
		const cache = new Cache<number>(2);
		cache.set("a", 1, 0);
		cache.set("b", 2, 0);
		cache.get("a");
		cache.set("c", 3, 0);
		expect([cache.has("a"), cache.has("b"), cache.has("c")]).toEqual([true, false, true]);
	});
});
