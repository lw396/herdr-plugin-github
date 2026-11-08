// pull-groups.ts: PR groups per kind, machine, repository and login, fetched once and then kept.
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pullGroupQuery } from "../../../src/github/pulls/core/pulls.ts";
import * as kept from "../../../src/github/pulls/io/groups.ts";
import type { RemoteRepo } from "../../../src/github/shared/core/remote.ts";
import { execCalls, machine, reset } from "../../fake-herdr.ts";

afterEach(() => {
	reset();
	kept.clear();
});

const fixture = (name: string): string => readFileSync(join(import.meta.dir, "../../fixtures", name), "utf8");
/** Where groups are asked: the repository, with the gh account `login` on machine `on`. */
const at = (remote: RemoteRepo, login: string, on: string | null = null) => ({ remote, login, on, cwd: null });
const ALL_OPEN_QUERY = pullGroupQuery(
	"all",
	{ remote: "origin", host: "github.com", owner: "", repo: "" },
	"",
	null,
).query;

test("a submitted review invalidates PR lists only for that repository machine, without fetching hidden groups", async () => {
	const remote = { remote: "origin", host: "github.com", owner: "lw396", repo: "herdr-plugin-github" };
	const command = `~$ gh api graphql -F after=null -f query=${ALL_OPEN_QUERY} -f owner=lw396 -f name=herdr-plugin-github`;
	for (const on of [null, "center"]) machine(on, { [command]: { stdout: fixture("pulls-all-plugin.json") } });
	await kept.pullGroup("all", at(remote, "lw396", "center"));
	await kept.pullGroup("all", at(remote, "lw396", null));
	kept.pullsChanged("lw396/herdr-plugin-github", "center");
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
	expect((await kept.pullGroup("all", at(remote, "lw396", "center"))).rows).toEqual([]);
	expect((await kept.pullGroup("all", at(remote, "lw396", null))).rows.length).toBeGreaterThan(0);
	expect(execCalls()).toHaveLength(3);
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
		const first = await kept.pullGroup("all", at(CLI, "lw396", null));
		expect(first.rows).toHaveLength(30);
		expect(await kept.pullGroup("all", at(CLI, "lw396", null))).toBe(first);
		expect(kept.peekPullGroup("all", at(CLI, "lw396", "center"))).toBeUndefined();
		await kept.morePulls("all", at(CLI, "lw396", null), first);
		expect(kept.peekPullGroup("all", at(CLI, "lw396", null))?.rows).toHaveLength(59);
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
	await kept.pullGroup("all", at(CLI, "lw396", null));
	expect(kept.peekPullGroup("all", at(CLI, "someone-else", null))).toBeUndefined();
});
