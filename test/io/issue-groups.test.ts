// issue-groups.ts: issue groups per kind, machine, repository and login, fetched once and then kept.
// Replies are the real ones used in issues.test.ts (test/fixtures).
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { issueGroupQuery } from "../../src/github/core/issues.ts";
import type { RemoteRepo } from "../../src/github/core/remote.ts";
import * as kept from "../../src/github/io/issue-groups.ts";
import { execCalls, machine, reset } from "../fake-herdr.ts";

afterEach(() => {
	reset();
	kept.clear();
});

const fixture = (name: string): string => readFileSync(join(import.meta.dir, "../fixtures", name), "utf8");
/** Where groups are asked: the repository, with the gh account `login` on machine `on`. */
const at = (remote: RemoteRepo, login: string, on: string | null = null) => ({ remote, login, on, cwd: null });
const groupQuery = (kind: "assigned" | "open") =>
	issueGroupQuery(kind, { remote: "origin", host: "github.com", owner: "", repo: "" }, "", null).query;
const ASSIGNED = `~$ gh api graphql -F after=null -f query=${groupQuery("assigned")} -f owner=lw396 -f name=herdr-plugin-github -f assignee=lw396`;
const OPEN_CLI = `~$ gh api graphql -F after=null -f query=${groupQuery("open")} -f owner=cli -f name=cli`;
const OPEN_CLI_2 = `~$ gh api graphql -f query=${groupQuery("open")} -f owner=cli -f name=cli -f after=Y3Vyc29yOnYyOpK0MjAyNi0xMS0wMlQxNzowMDozMVrPAAAAAW3jAo8=`;

describe("issue groups", () => {
	const REMOTE = { remote: "origin", host: "github.com", owner: "lw396", repo: "herdr-plugin-github" };
	const CLI = { remote: "origin", host: "github.com", owner: "cli", repo: "cli" };

	test("per kind, machine, repository and login, then kept", async () => {
		machine(null, { [ASSIGNED]: { stdout: fixture("assigned-herdr-plugin-github.json") } });
		expect(await kept.issueGroup("assigned", at(REMOTE, "lw396", null))).toMatchObject({
			total: 1,
			rows: [{ number: 12 }],
		});
		machine(null, {});
		expect(await kept.issueGroup("assigned", at(REMOTE, "lw396", null))).toMatchObject({ total: 1 });
		expect(kept.peekIssueGroup("assigned", at(REMOTE, "lw396", null))).toMatchObject({ total: 1 });
		expect(kept.peekIssueGroup("open", at(REMOTE, "lw396", null))).toBeUndefined();
		expect(kept.peekIssueGroup("assigned", at(REMOTE, "lw396", "center"))).toBeUndefined();
		expect(kept.peekIssueGroup("assigned", at(REMOTE, "someone-else", null))).toBeUndefined();
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
		expect(await kept.issueGroup("assigned", at(REMOTE, "lw396", null)).catch((e: unknown) => e)).toMatchObject({
			notFound: true,
		});
		expect(kept.peekIssueGroup("assigned", at(REMOTE, "lw396", null))).toBeUndefined();
	});

	test("Load more: the next page joins the kept rows, so switching back shows all 60", async () => {
		machine(null, {
			[OPEN_CLI]: { stdout: fixture("open-cli-1.json") },
			[OPEN_CLI_2]: { stdout: fixture("open-cli-2.json") },
		});
		const first = await kept.issueGroup("open", at(CLI, "lw396", null));
		const both = await kept.moreIssues("open", at(CLI, "lw396", null), first);
		expect(both.rows).toHaveLength(60);
		expect(kept.peekIssueGroup("open", at(CLI, "lw396", null))?.rows).toHaveLength(60);
	});

	test("an issue closed in a reader leaves its kept groups at once; they are asked again on the next look", async () => {
		machine(null, {
			[ASSIGNED]: { stdout: fixture("assigned-herdr-plugin-github.json") },
			[OPEN_CLI]: { stdout: fixture("open-cli-1.json") },
		});
		await kept.issueGroup("assigned", at(REMOTE, "lw396", null));
		const cli = await kept.issueGroup("open", at(CLI, "lw396", null));
		kept.issueChanged({
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
		expect(kept.peekIssueGroup("assigned", at(REMOTE, "lw396", null))).toMatchObject({ total: 0, rows: [] });
		expect(kept.peekIssueGroup("open", at(CLI, "lw396", null))).toBe(cli);
		machine(null, {
			[ASSIGNED]: {
				stdout:
					'{"data":{"repository":{"hasIssuesEnabled":true,"issues":{"totalCount":0,"pageInfo":{"hasNextPage":false,"endCursor":null},"nodes":[]}}}}',
			},
		});
		await kept.issueGroup("assigned", at(REMOTE, "lw396", null));
		expect(execCalls().filter((c) => c.command === "gh")).toHaveLength(3);
		expect(await kept.issueGroup("open", at(CLI, "lw396", null))).toBe(cli);
	});

	test("↻ while Load more is still out: the refreshed first page stays, not the older rows plus page 2", async () => {
		let answerPage2!: (r: { stdout: string }) => void;
		machine(null, {
			[OPEN_CLI]: { stdout: fixture("open-cli-1.json") },
			[OPEN_CLI_2]: new Promise((resolve) => (answerPage2 = resolve)),
		});
		const first = await kept.issueGroup("open", at(CLI, "lw396", null));
		const loading = kept.moreIssues("open", at(CLI, "lw396", null), first);
		await kept.issueGroup("open", at(CLI, "lw396", null), true);
		answerPage2({ stdout: fixture("open-cli-2.json") });
		await loading;
		expect(kept.peekIssueGroup("open", at(CLI, "lw396", null))?.rows).toHaveLength(30);
	});
});
