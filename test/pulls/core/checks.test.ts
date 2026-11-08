import { expect, test } from "bun:test";
import { checkSummary, parseChecks } from "../../../src/github/pulls/core/checks.ts";

test("a passing check is summarized like the VS Code status card", () => {
	expect(checkSummary([{ status: "success" }])).toEqual({ label: "1 successful check", tone: "done", icon: "✓" });
});

test("empty, pending, failed and skipped checks never show a successful summary", () => {
	expect(checkSummary([])).toEqual({ label: "No checks reported", tone: "dim", icon: "○" });
	expect(checkSummary([{ status: "success" }, { status: "in_progress" }])).toEqual({
		label: "1 pending check, 1 successful check",
		tone: "working",
		icon: "○",
	});
	expect(checkSummary([{ status: "timed_out" }, { status: "action_required" }, { status: "pending" }])).toEqual({
		label: "2 failed checks, 1 pending check",
		tone: "blocked",
		icon: "×",
	});
	expect(checkSummary([{ status: "skipped" }, { status: "neutral" }])).toEqual({
		label: "2 other checks",
		tone: "dim",
		icon: "○",
	});
});

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
