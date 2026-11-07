// The sidebar footer: which gh account on which machine, and a failed check for list changes.
import { describe, expect, test } from "bun:test";
import { footerStatus } from "../../src/github/core/status.ts";

const NOW = Date.parse("2026-11-07T08:00:00Z");
const SIGNED_IN = { on: "center", status: { ok: true, user: "lw396" } } as const;

describe("footerStatus", () => {
	test("gh not known yet: checking, on the folder's machine", () => {
		expect(
			footerStatus({ account: undefined, on: "center", checkedAt: null, failed: false, polling: false }, NOW),
		).toEqual({ tone: "pending", account: "Checking gh…", machine: "center", sync: null });
	});

	test("signed in and polling fine: only the account and machine, no second line", () => {
		expect(
			footerStatus({ account: SIGNED_IN, on: "center", checkedAt: null, failed: false, polling: true }, NOW),
		).toEqual({ tone: "ok", account: "lw396", machine: "center", sync: null });
		expect(
			footerStatus({ account: SIGNED_IN, on: null, checkedAt: NOW - 3 * 60_000, failed: false, polling: true }, NOW),
		).toEqual({ tone: "ok", account: "lw396", machine: "this computer", sync: null });
	});

	test("a failed check is a problem, but still says when the lists were last fresh", () => {
		const s = footerStatus(
			{ account: SIGNED_IN, on: "center", checkedAt: NOW - 120_000, failed: true, polling: true },
			NOW,
		);
		expect(s).toEqual({ tone: "problem", account: "lw396", machine: "center", sync: "Check failed · last ok 2m ago" });
		const never = footerStatus({ account: SIGNED_IN, on: "center", checkedAt: null, failed: true, polling: true }, NOW);
		expect(never.sync).toBe("Check failed · retrying every 60s");
	});

	test("no GitHub repository here: the account, without a sync line", () => {
		const s = footerStatus({ account: SIGNED_IN, on: "center", checkedAt: null, failed: false, polling: false }, NOW);
		expect(s).toEqual({ tone: "ok", account: "lw396", machine: "center", sync: null });
	});

	test("gh missing or signed out: a short problem; the list says what to do", () => {
		const auth = { on: "devbox", status: { ok: false, reason: "auth", message: "…" } } as const;
		expect(footerStatus({ account: auth, on: "devbox", checkedAt: null, failed: false, polling: false }, NOW)).toEqual({
			tone: "problem",
			account: "Not signed in to gh",
			machine: "devbox",
			sync: null,
		});
		const missing = { on: null, status: { ok: false, reason: "missing", message: "…" } } as const;
		expect(
			footerStatus({ account: missing, on: null, checkedAt: null, failed: false, polling: false }, NOW).account,
		).toBe("gh is not installed");
		const error = { on: null, status: { ok: false, reason: "error", message: "…" } } as const;
		expect(
			footerStatus({ account: error, on: null, checkedAt: null, failed: false, polling: false }, NOW).account,
		).toBe("gh is not working");
	});
});
