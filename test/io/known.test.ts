// known.ts: the gh account per machine, the GitHub remote per folder, issue groups per kind,
// machine, repository and login, each fetched once and then kept. Replies are the real ones
// used in gh.test.ts and issues.test.ts (test/fixtures).
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { issueGroupQuery } from "../../src/github/core/issues.ts";
import { pullGroupQuery } from "../../src/github/core/pulls.ts";
import type { RemoteRepo } from "../../src/github/core/remote.ts";
import * as known from "../../src/github/io/known.ts";
import { execCalls, machine, reset } from "../fake-herdr.ts";

afterEach(() => {
	reset();
	known.clear();
});

const LOGIN = "~$ gh api user --jq .login";
const REMOTES = "/w/app$ git remote -v";
const REMOTE_V =
	"origin\tgit@github.com:lw396/herdr-plugin-github.git (fetch)\norigin\tgit@github.com:lw396/herdr-plugin-github.git (push)\n";
const fixture = (name: string): string => readFileSync(join(import.meta.dir, "../fixtures", name), "utf8");
/** Where groups are asked: the repository, with the gh account `login` on machine `on`. */
const at = (remote: RemoteRepo, login: string, on: string | null = null) => ({ remote, login, on, cwd: null });
const groupQuery = (kind: "assigned" | "open") =>
	issueGroupQuery(kind, { remote: "origin", host: "github.com", owner: "", repo: "" }, "", null).query;
const ALL_OPEN_QUERY = pullGroupQuery(
	"all",
	{ remote: "origin", host: "github.com", owner: "", repo: "" },
	"",
	null,
).query;
const ASSIGNED = `~$ gh api graphql -F after=null -f query=${groupQuery("assigned")} -f owner=lw396 -f name=herdr-plugin-github -f assignee=lw396`;
const OPEN_CLI = `~$ gh api graphql -F after=null -f query=${groupQuery("open")} -f owner=cli -f name=cli`;
const OPEN_CLI_2 = `~$ gh api graphql -f query=${groupQuery("open")} -f owner=cli -f name=cli -f after=Y3Vyc29yOnYyOpK0MjAyNi0xMS0wMlQxNzowMDozMVrPAAAAAW3jAo8=`;

test("a submitted review invalidates PR lists only for that repository machine, without fetching hidden groups", async () => {
	const remote = { remote: "origin", host: "github.com", owner: "lw396", repo: "herdr-plugin-github" };
	const command = `~$ gh api graphql -F after=null -f query=${ALL_OPEN_QUERY} -f owner=lw396 -f name=herdr-plugin-github`;
	for (const on of [null, "center"]) machine(on, { [command]: { stdout: fixture("pulls-all-plugin.json") } });
	await known.pullGroup("all", at(remote, "lw396", "center"));
	await known.pullGroup("all", at(remote, "lw396", null));
	known.pullsChanged("lw396/herdr-plugin-github", "center");
	expect(execCalls()).toHaveLength(2);
	machine("center", {
		[command]: {
			stdout: JSON.stringify({
				data: {
					repository: { pullRequests: { totalCount: 0, nodes: [], pageInfo: { hasNextPage: false, endCursor: null } } },
				},
			}),
		},
	});
	expect((await known.pullGroup("all", at(remote, "lw396", "center"))).rows).toEqual([]);
	expect((await known.pullGroup("all", at(remote, "lw396", null))).rows.length).toBeGreaterThan(0);
	expect(execCalls()).toHaveLength(3);
});

describe("account", () => {
	test("asked once per machine, then kept", async () => {
		machine("center", { [LOGIN]: { stdout: "lw396\n" } });
		expect(await known.account("center")).toEqual({ on: "center", status: { ok: true, user: "lw396" } });
		machine("center", {}); // asking again would now find no gh
		expect(await known.account("center")).toMatchObject({ status: { ok: true, user: "lw396" } });
		expect(known.peekAccount("center")).toMatchObject({ status: { ok: true } });
	});

	test("a machine's account is its own", async () => {
		machine(null, { [LOGIN]: { stdout: "here\n" } });
		machine("center", { [LOGIN]: { stdout: "there\n" } });
		await known.account(null);
		expect(known.peekAccount("center")).toBeUndefined();
		expect(await known.account("center")).toMatchObject({ status: { user: "there" } });
	});

	test("not signed in is not kept: signing in shows on the next look", async () => {
		machine("center", { [LOGIN]: { code: 4, stderr: "To get started with GitHub CLI, please run:  gh auth login\n" } });
		expect(await known.account("center")).toMatchObject({ status: { ok: false, reason: "auth" } });
		machine("center", { [LOGIN]: { stdout: "lw396\n" } });
		expect(await known.account("center")).toMatchObject({ status: { ok: true, user: "lw396" } });
	});

	test("↻ doesn't ask again: people rarely change their GitHub account, so a signed-in one is kept", async () => {
		machine("center", { [LOGIN]: { stdout: "lw396\n" } });
		await known.account("center");
		machine("center", { [LOGIN]: { code: 1, stderr: 'Get "https://api.github.com/user": EOF\n' } });
		expect(await known.account("center", true)).toMatchObject({ status: { ok: true, user: "lw396" } });
	});

	test("a connection that kept dropping is not kept: the next look asks again", async () => {
		machine("center", { [LOGIN]: { code: 1, stderr: 'Get "https://api.github.com/user": EOF\n' } });
		expect(await known.account("center")).toMatchObject({ status: { ok: false, reason: "error" } });
		machine("center", { [LOGIN]: { stdout: "lw396\n" } });
		expect(await known.account("center")).toMatchObject({ status: { ok: true, user: "lw396" } });
	});

	test("two looks at once share one gh call", async () => {
		let calls = 0;
		machine("center", {
			get [LOGIN]() {
				calls++;
				return { stdout: "lw396\n" };
			},
		});
		await Promise.all([known.account("center"), known.account("center")]);
		expect(calls).toBe(1);
	});
});

describe("remote", () => {
	test("per machine and folder, then kept", async () => {
		machine("center", { [REMOTES]: { stdout: REMOTE_V } });
		expect(await known.remote({ cwd: "/w/app", on: "center" })).toMatchObject({
			owner: "lw396",
			repo: "herdr-plugin-github",
		});
		machine("center", {});
		expect(await known.remote({ cwd: "/w/app", on: "center" })).toMatchObject({ owner: "lw396" });
		expect(known.peekRemote({ cwd: "/w/app", on: null })).toBeUndefined();
	});

	test("no GitHub remote is not kept: adding one shows on the next look", async () => {
		machine(null, { "/w/notes$ git remote -v": { stdout: "" } });
		expect(await known.remote({ cwd: "/w/notes", on: null })).toBeNull();
		expect(known.peekRemote({ cwd: "/w/notes", on: null })).toBeUndefined();
		machine(null, { "/w/notes$ git remote -v": { stdout: REMOTE_V } });
		expect(await known.remote({ cwd: "/w/notes", on: null })).toMatchObject({ owner: "lw396" });
	});

	test("↻ while an older look is still out: the older answer, arriving last, is not kept", async () => {
		let answerOld!: (r: { stdout: string }) => void;
		machine("center", { [REMOTES]: new Promise((resolve) => (answerOld = resolve)) });
		const old = known.remote({ cwd: "/w/app", on: "center" });
		// The person points origin at their own repository and presses ↻; the slow first
		// `git remote -v` still answers with the old URL afterwards.
		machine("center", { [REMOTES]: { stdout: REMOTE_V } });
		expect(await known.remote({ cwd: "/w/app", on: "center" }, true)).toMatchObject({ owner: "lw396" });
		answerOld({
			stdout:
				"origin\tgit@github.com:herdrdev/herdr-app.git (fetch)\norigin\tgit@github.com:herdrdev/herdr-app.git (push)\n",
		});
		await old;
		expect(known.peekRemote({ cwd: "/w/app", on: "center" })).toMatchObject({ owner: "lw396" });
	});

	test("git failing to run rejects and keeps nothing", async () => {
		machine("center", {});
		expect(await known.remote({ cwd: "/w/app", on: "center" }).catch((e: unknown) => e)).toBeInstanceOf(Error);
		expect(known.peekRemote({ cwd: "/w/app", on: "center" })).toBeUndefined();
	});
});

describe("issue groups", () => {
	const REMOTE = { remote: "origin", host: "github.com", owner: "lw396", repo: "herdr-plugin-github" };
	const CLI = { remote: "origin", host: "github.com", owner: "cli", repo: "cli" };

	test("per kind, machine, repository and login, then kept", async () => {
		machine(null, { [ASSIGNED]: { stdout: fixture("assigned-herdr-plugin-github.json") } });
		expect(await known.issueGroup("assigned", at(REMOTE, "lw396", null))).toMatchObject({
			total: 1,
			rows: [{ number: 12 }],
		});
		machine(null, {});
		expect(await known.issueGroup("assigned", at(REMOTE, "lw396", null))).toMatchObject({ total: 1 });
		expect(known.peekIssueGroup("assigned", at(REMOTE, "lw396", null))).toMatchObject({ total: 1 });
		expect(known.peekIssueGroup("open", at(REMOTE, "lw396", null))).toBeUndefined();
		expect(known.peekIssueGroup("assigned", at(REMOTE, "lw396", "center"))).toBeUndefined();
		expect(known.peekIssueGroup("assigned", at(REMOTE, "someone-else", null))).toBeUndefined();
	});

	test("a 404 rejects and keeps nothing", async () => {
		machine(null, {
			[ASSIGNED]: {
				code: 1,
				stdout:
					'{"data":{"repository":null},"errors":[{"type":"NOT_FOUND","path":["repository"],"locations":[{"line":1,"column":41}],"message":"Could not resolve to a Repository with the name \'lw396/herdr-plugin-github\'."}]}',
				stderr: "gh: Could not resolve to a Repository with the name 'lw396/herdr-plugin-github'.\n",
			},
		});
		expect(await known.issueGroup("assigned", at(REMOTE, "lw396", null)).catch((e: unknown) => e)).toMatchObject({
			notFound: true,
		});
		expect(known.peekIssueGroup("assigned", at(REMOTE, "lw396", null))).toBeUndefined();
	});

	test("Load more: the next page joins the kept rows, so switching back shows all 60", async () => {
		machine(null, {
			[OPEN_CLI]: { stdout: fixture("open-cli-1.json") },
			[OPEN_CLI_2]: { stdout: fixture("open-cli-2.json") },
		});
		const first = await known.issueGroup("open", at(CLI, "lw396", null));
		const both = await known.moreIssues("open", at(CLI, "lw396", null), first);
		expect(both.rows).toHaveLength(60);
		expect(known.peekIssueGroup("open", at(CLI, "lw396", null))?.rows).toHaveLength(60);
	});

	test("an issue closed in a reader leaves its kept groups at once; they are asked again on the next look", async () => {
		machine(null, {
			[ASSIGNED]: { stdout: fixture("assigned-herdr-plugin-github.json") },
			[OPEN_CLI]: { stdout: fixture("open-cli-1.json") },
		});
		await known.issueGroup("assigned", at(REMOTE, "lw396", null));
		const cli = await known.issueGroup("open", at(CLI, "lw396", null));
		known.issueChanged({
			repo: "LW396/Herdr-Plugin-GitHub",
			state: "closed",
			issue: {
				number: 12,
				title: "Issues 标签页：Open、Closed、折叠和加载更多",
				assignees: ["lw396"],
				updatedAt: "2026-11-06T18:00:00Z",
				url: "https://github.com/lw396/herdr-plugin-github/issues/12",
			},
		});
		expect(known.peekIssueGroup("assigned", at(REMOTE, "lw396", null))).toMatchObject({ total: 0, rows: [] });
		expect(known.peekIssueGroup("open", at(CLI, "lw396", null))).toBe(cli);
		machine(null, {
			[ASSIGNED]: {
				stdout:
					'{"data":{"repository":{"hasIssuesEnabled":true,"issues":{"totalCount":0,"pageInfo":{"hasNextPage":false,"endCursor":null},"nodes":[]}}}}',
			},
		});
		await known.issueGroup("assigned", at(REMOTE, "lw396", null));
		expect(execCalls().filter((c) => c.command === "gh")).toHaveLength(3);
		expect(await known.issueGroup("open", at(CLI, "lw396", null))).toBe(cli);
	});

	test("↻ while Load more is still out: the refreshed first page stays, not the older rows plus page 2", async () => {
		let answerPage2!: (r: { stdout: string }) => void;
		machine(null, {
			[OPEN_CLI]: { stdout: fixture("open-cli-1.json") },
			[OPEN_CLI_2]: new Promise((resolve) => (answerPage2 = resolve)),
		});
		const first = await known.issueGroup("open", at(CLI, "lw396", null));
		const loading = known.moreIssues("open", at(CLI, "lw396", null), first);
		await known.issueGroup("open", at(CLI, "lw396", null), true);
		answerPage2({ stdout: fixture("open-cli-2.json") });
		await loading;
		expect(known.peekIssueGroup("open", at(CLI, "lw396", null))?.rows).toHaveLength(30);
	});
});

describe("PR groups", () => {
	const CLI = { remote: "origin", host: "github.com", owner: "cli", repo: "cli" };
	const ALL = `~$ gh api graphql -F after=null -f query=${ALL_OPEN_QUERY} -f owner=cli -f name=cli`;
	const ALL_2 = `~$ gh api graphql -f query=${ALL_OPEN_QUERY} -f owner=cli -f name=cli -f after=Y3Vyc29yOnYyOpK0MjAyNi0wOS0wN1QxNToxMDo0OFrO1-HpJQ==`;

	test("per kind, machine and repository, then kept; Load more joins the kept rows", async () => {
		machine(null, {
			[ALL]: { stdout: fixture("pulls-all-cli-1.json") },
			[ALL_2]: { stdout: fixture("pulls-all-cli-2.json") },
		});
		const first = await known.pullGroup("all", at(CLI, "lw396", null));
		expect(first.rows).toHaveLength(30);
		expect(await known.pullGroup("all", at(CLI, "lw396", null))).toBe(first);
		expect(known.peekPullGroup("all", at(CLI, "lw396", "center"))).toBeUndefined();
		await known.morePulls("all", at(CLI, "lw396", null), first);
		expect(known.peekPullGroup("all", at(CLI, "lw396", null))?.rows).toHaveLength(59);
		expect(execCalls().filter((c) => c.command === "gh")).toHaveLength(2);
	});
});

test("a PR group kept for one account is not shown to another on the same machine", async () => {
	const CLI = { remote: "origin", host: "github.com", owner: "cli", repo: "cli" };
	machine(null, {
		[`~$ gh api graphql -F after=null -f query=${ALL_OPEN_QUERY} -f owner=cli -f name=cli`]: {
			stdout: fixture("pulls-all-cli-1.json"),
		},
	});
	await known.pullGroup("all", at(CLI, "lw396", null));
	expect(known.peekPullGroup("all", at(CLI, "someone-else", null))).toBeUndefined();
});
