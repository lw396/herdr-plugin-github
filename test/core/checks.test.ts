import { expect, test } from "bun:test";
import { parseChecks } from "../../src/github/core/checks.ts";

test("checks include duration and browser target", () => {
	expect(
		parseChecks(
			[
				{
					check_runs: [
						{
							id: 1,
							name: "test",
							status: "completed",
							conclusion: "success",
							started_at: "2026-01-01T00:00:00Z",
							completed_at: "2026-01-01T00:01:05Z",
							html_url: "https://github.com/a/b/actions/runs/1",
						},
					],
				},
			],
			[],
		),
	).toEqual([
		{ id: "check-1", name: "test", status: "success", duration: "1m 5s", url: "https://github.com/a/b/actions/runs/1" },
	]);
});
