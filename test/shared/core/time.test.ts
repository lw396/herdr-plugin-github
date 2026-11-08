// Relative times in the sidebar's rows, short like the map's mock-up ("#42 Login fails   2h").
import { describe, expect, test } from "bun:test";
import { relativeTime } from "../../../src/github/shared/core/time.ts";

// `updatedAt` of lw396/herdr-plugin-github#11, from the real GraphQL reply.
const UPDATED = "2026-11-06T13:01:13Z";
const at = (iso: string) => Date.parse(iso);

describe("relativeTime", () => {
	test("under a minute: now", () => expect(relativeTime(UPDATED, at("2026-11-06T13:02:00Z"))).toBe("now"));
	test("minutes", () => expect(relativeTime(UPDATED, at("2026-11-06T13:46:13Z"))).toBe("45m"));
	test("hours", () => expect(relativeTime(UPDATED, at("2026-11-06T15:30:00Z"))).toBe("2h"));
	test("days", () => expect(relativeTime(UPDATED, at("2026-11-09T13:01:13Z"))).toBe("3d"));
	test("months", () => expect(relativeTime("2026-07-21T17:58:38Z", at("2026-11-06T13:01:13Z"))).toBe("3mo"));
	test("years", () => expect(relativeTime("2024-06-14T17:31:12Z", at("2026-11-06T13:01:13Z"))).toBe("2y"));
	test("a clock behind GitHub's: now, not a negative time", () =>
		expect(relativeTime(UPDATED, at("2026-11-06T13:00:00Z"))).toBe("now"));
});
