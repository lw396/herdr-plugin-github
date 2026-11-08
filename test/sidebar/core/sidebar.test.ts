// What the sidebar says besides its rows: problems in the list's place, no repository, and the footer.
import { describe, expect, test } from "bun:test";
import { footerStatus, listNotice, noRepository } from "../../../src/github/sidebar/core/sidebar.ts";

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

describe("listNotice: what the list's place says instead of rows", () => {
	const REMOTE = { remote: "origin", host: "github.com", owner: "lw396", repo: "herdr-plugin-github" };
	const SIGNED_IN = { on: "center", status: { ok: true, user: "lw396" } } as const;

	test("gh not signed in on the folder's machine: what to run where", () => {
		const account = { on: "center", status: { ok: false, reason: "auth", message: "" } } as const;
		expect(listNotice({ account, remote: REMOTE })).toBe("not signed in on center: run gh auth login on center");
	});

	test("no gh on the folder's machine", () => {
		const account = {
			on: null,
			status: { ok: false, reason: "missing", message: "cannot run gh: No such file or directory (os error 2)" },
		} as const;
		expect(listNotice({ account, remote: REMOTE })).toBe(
			"gh is not installed on this computer: install it, then run gh auth login",
		);
	});

	test("no GitHub remote: not a problem, so no notice (the sidebar shows noRepository instead)", () => {
		expect(listNotice({ account: SIGNED_IN, remote: null })).toBeNull();
	});
	test("the repository isn't on GitHub, or this account can't see it (404)", () => {
		expect(
			listNotice({
				account: SIGNED_IN,
				remote: REMOTE,
				failure: {
					notFound: true,
					message: "gh: Could not resolve to a Repository with the name 'lw396/herdr-plugin-github'.",
				},
			}),
		).toBe(
			"lw396/herdr-plugin-github (remote \"origin\") isn't on GitHub, or lw396 can't see it. Check git remote -v.",
		);
	});

	test("other failures: gh's message", () => {
		expect(
			listNotice({
				account: SIGNED_IN,
				remote: REMOTE,
				failure: { notFound: false, message: "error connecting to api.github.com" },
			}),
		).toBe("error connecting to api.github.com");
	});

	test("Issues turned off", () => {
		expect(listNotice({ account: SIGNED_IN, remote: REMOTE, issuesEnabled: false })).toBe(
			"Issues are turned off for lw396/herdr-plugin-github.",
		);
	});

	test("a list to show, or nothing known yet: no notice", () => {
		expect(listNotice({ account: SIGNED_IN, remote: REMOTE, issuesEnabled: true })).toBeNull();
		expect(listNotice({ account: undefined, remote: undefined })).toBeNull();
	});
});

describe("noRepository: what the sidebar says in a folder without a GitHub remote", () => {
	test("names the folder, and how to get a list here", () => {
		expect(noRepository("/Users/apple")).toEqual({
			title: "No GitHub repository",
			detail: "apple has no GitHub remote. Focus a terminal in a repository cloned from GitHub.",
		});
	});

	test("a trailing slash, the root, no folder", () => {
		expect(noRepository("/home/valian/work/").detail).toStartWith("work has no GitHub remote.");
		expect(noRepository("/").detail).toStartWith("/ has no GitHub remote.");
		expect(noRepository(null).detail).toBe("Focus a terminal in a repository cloned from GitHub.");
	});
});
