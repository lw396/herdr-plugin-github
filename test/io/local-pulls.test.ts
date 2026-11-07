import { afterEach, expect, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import { graphqlArgs } from "../../src/github/core/gh.ts";
import { localPullsQuery } from "../../src/github/core/pulls.ts";
import type { RemoteRepo } from "../../src/github/core/remote.ts";
import * as known from "../../src/github/io/known.ts";
import { execCalls, machine, reset } from "../fake-herdr.ts";

afterEach(() => {
	reset();
	known.clear();
});

const remote = { remote: "origin", host: "github.com", owner: "lw396", repo: "herdr-plugin-github" };
const where = { cwd: "/w/app", on: "center" };
/** The Local Pull Request Branches group of the focused folder /w/app on center, for the gh account `login`. */
const local = (r: RemoteRepo, login = "lw396") => ({ remote: r, login, ...where });
const branches = "/w/app$ git for-each-ref --format=%(refname:short) refs/heads";
const remotes = "/w/app$ git remote -v";
const query = `query($owner: String!, $name: String!, $branch0: String!, $branch1: String!, $branch2: String!) {
  repository(owner: $owner, name: $name) {
    branch0: pullRequests(first: 100, headRefName: $branch0, states: [OPEN, CLOSED, MERGED], orderBy: {field: UPDATED_AT, direction: DESC}) {
      pageInfo { hasNextPage }
      nodes { number title url updatedAt isDraft state author { login } headRepository { nameWithOwner } }
    }
    branch1: pullRequests(first: 100, headRefName: $branch1, states: [OPEN, CLOSED, MERGED], orderBy: {field: UPDATED_AT, direction: DESC}) {
      pageInfo { hasNextPage }
      nodes { number title url updatedAt isDraft state author { login } headRepository { nameWithOwner } }
    }
    branch2: pullRequests(first: 100, headRefName: $branch2, states: [OPEN, CLOSED, MERGED], orderBy: {field: UPDATED_AT, direction: DESC}) {
      pageInfo { hasNextPage }
      nodes { number title url updatedAt isDraft state author { login } headRepository { nameWithOwner } }
    }
  }
}`;
const asked = `~$ gh api graphql -f query=${query} -f owner=lw396 -f name=herdr-plugin-github -f branch0=master -f branch1=test/pr-fixture-a -f branch2=test/pr-fixture-draft`;
// Captured from gh on 2026-11-07. Variants below model states and forks from the ticket's specification.
const fixture = readFileSync(new URL("../fixtures/pulls-local-plugin.json", import.meta.url), "utf8");

test("local branches are batch-matched on their machine; a branch without a PR is omitted", async () => {
	machine("center", {
		[branches]: { stdout: "master\ntest/pr-fixture-a\ntest/pr-fixture-draft\n" },
		[remotes]: { stdout: "origin\thttps://github.com/lw396/herdr-plugin-github.git (fetch)\n" },
		[asked]: { stdout: fixture },
	});
	const page = await known.pullGroup("local", local(remote));
	expect(page.rows.map((p) => [p.number, p.state])).toEqual([
		[36, "draft"],
		[35, "open"],
	]);
	expect(page).toMatchObject({ total: 2, more: false, cursor: null });
	expect(execCalls().filter((c) => c.command === "gh")).toHaveLength(1);
});

test("a fork only matches its own heads, even when another fork has a newer same-name PR", async () => {
	const reply = JSON.parse(fixture);
	const nodes = reply.data.repository.branch1.nodes;
	nodes.unshift({ ...nodes[0], number: 99, headRepository: { nameWithOwner: "someone-else/herdr-plugin-github" } });
	machine("center", {
		[branches]: { stdout: "master\ntest/pr-fixture-a\ntest/pr-fixture-draft\n" },
		[remotes]: {
			stdout:
				"origin\thttps://github.com/lw396/herdr-plugin-github.git (fetch)\nupstream\thttps://github.com/parent/herdr-plugin-github.git (fetch)\n",
		},
		[asked.replace("-f owner=lw396", "-f owner=parent")]: { stdout: JSON.stringify(reply) },
	});
	expect(
		(await known.pullGroup("local", local({ ...remote, remote: "upstream", owner: "parent" }))).rows.map(
			(p) => p.number,
		),
	).toEqual([36, 35]);
});

test("a fork remote need not be named origin", async () => {
	machine("center", {
		[branches]: { stdout: "master\ntest/pr-fixture-a\ntest/pr-fixture-draft\n" },
		[remotes]: {
			stdout:
				"fork\thttps://github.com/lw396/herdr-plugin-github.git (fetch)\nupstream\thttps://github.com/parent/herdr-plugin-github.git (fetch)\n",
		},
		[asked.replace("-f owner=lw396", "-f owner=parent")]: { stdout: fixture },
	});
	expect(
		(await known.pullGroup("local", local({ ...remote, remote: "upstream", owner: "parent" }))).rows.map(
			(p) => p.number,
		),
	).toEqual([36, 35]);
});

test("the newest PR per branch can be closed or merged, not the older open PR", async () => {
	const reply = JSON.parse(fixture);
	const repo = reply.data.repository;
	repo.branch1.nodes.unshift({
		...repo.branch1.nodes[0],
		number: 80,
		state: "MERGED",
		updatedAt: "2026-11-08T12:00:00Z",
	});
	repo.branch2.nodes[0].state = "CLOSED";
	machine("center", {
		[branches]: { stdout: "master\ntest/pr-fixture-a\ntest/pr-fixture-draft\n" },
		[remotes]: { stdout: "origin\thttps://github.com/lw396/herdr-plugin-github.git (fetch)\n" },
		[asked]: { stdout: JSON.stringify(reply) },
	});
	expect((await known.pullGroup("local", local(remote))).rows.map((p) => [p.number, p.state])).toEqual([
		[80, "merged"],
		[36, "closed"],
	]);
});

test("a live merged-PR reply selects the latest PR for a reused branch", async () => {
	const cli = { ...remote, owner: "cli", repo: "cli" };
	const request = localPullsQuery(cli, ["bagtoad/triage-ghmock-skill"]);
	machine("center", {
		[branches]: { stdout: "bagtoad/triage-ghmock-skill\n" },
		[remotes]: { stdout: "origin\thttps://github.com/cli/cli.git (fetch)\n" },
		[`~$ gh ${graphqlArgs(request).join(" ")}`]: {
			stdout: readFileSync(new URL("../fixtures/pulls-local-merged-cli.json", import.meta.url), "utf8"),
		},
	});
	expect((await known.pullGroup("local", local(cli))).rows.map((p) => [p.number, p.state])).toEqual([
		[14976, "merged"],
	]);
});

test("only foreign or deleted head repositories means no local PRs", async () => {
	const reply = JSON.parse(fixture);
	reply.data.repository.branch1.nodes[0].headRepository = { nameWithOwner: "someone-else/herdr-plugin-github" };
	reply.data.repository.branch2.nodes[0].headRepository = null;
	machine("center", {
		[branches]: { stdout: "master\ntest/pr-fixture-a\ntest/pr-fixture-draft\n" },
		[remotes]: { stdout: "origin\thttps://github.com/lw396/herdr-plugin-github.git (fetch)\n" },
		[asked]: { stdout: JSON.stringify(reply) },
	});
	expect((await known.pullGroup("local", local(remote))).rows).toEqual([]);
});

test("no local branches needs no GitHub query", async () => {
	machine("center", { [branches]: { stdout: "" } });
	expect(await known.pullGroup("local", local(remote))).toEqual({ total: 0, more: false, cursor: null, rows: [] });
	expect(execCalls().some((c) => c.command === "gh")).toBe(false);
});

test("local groups page 30 matches from one batch and keep each checkout separate", async () => {
	const names = Array.from({ length: 31 }, (_, i) => `feature-${i}`);
	const request = localPullsQuery(remote, names);
	const sample = JSON.parse(fixture).data.repository.branch1.nodes[0];
	const repository = Object.fromEntries(
		names.map((_, i) => [
			`branch${i}`,
			{
				pageInfo: { hasNextPage: false },
				nodes: [{ ...sample, number: 1000 + i }],
			},
		]),
	);
	machine("center", {
		[branches]: { stdout: names.join("\n") },
		[remotes]: { stdout: "origin\thttps://github.com/lw396/herdr-plugin-github.git (fetch)\n" },
		[`~$ gh ${graphqlArgs(request).join(" ")}`]: {
			stdout: JSON.stringify({ data: { repository } }),
		},
	});
	const first = await known.pullGroup("local", local(remote));
	expect(first).toMatchObject({ total: 31, more: true, cursor: "30" });
	expect(first.rows).toHaveLength(30);
	const more = await known.morePulls("local", local(remote), first);
	expect(more).toMatchObject({ total: 31, more: false, cursor: null });
	expect(more.rows).toHaveLength(31);
	expect(await known.pullGroup("local", local(remote))).toBe(more);
	expect(known.peekPullGroup("local", { ...local(remote), cwd: "/w/other" })).toBeUndefined();
	expect(known.peekPullGroup("local", local(remote, "other-account"))).toBeUndefined();
	expect(execCalls().filter((c) => c.command === "gh")).toHaveLength(1);
});

test("unchanged local branch checks reuse the batch; explicit refresh still re-asks", async () => {
	let now = 100_000;
	const clock = spyOn(Date, "now").mockImplementation(() => now);
	try {
		machine("center", {
			[branches]: { stdout: "master\ntest/pr-fixture-a\ntest/pr-fixture-draft\n" },
			[remotes]: { stdout: "origin\thttps://github.com/lw396/herdr-plugin-github.git (fetch)\n" },
			[asked]: { stdout: fixture },
		});
		const first = await known.pullGroup("local", local(remote));
		now += 60_001;
		expect(await known.pullGroup("local", local(remote))).toBe(first);
		expect(execCalls().filter((c) => c.command === "gh")).toHaveLength(1);
		await known.pullGroup("local", local(remote), true);
		expect(execCalls().filter((c) => c.command === "gh")).toHaveLength(2);
		const request = localPullsQuery(remote, ["master", "test/pr-fixture-a"]);
		const reply = JSON.parse(fixture);
		delete reply.data.repository.branch2;
		machine("center", {
			[branches]: { stdout: "master\ntest/pr-fixture-a\n" },
			[remotes]: { stdout: "origin\thttps://github.com/lw396/herdr-plugin-github.git (fetch)\n" },
			[`~$ gh ${graphqlArgs(request).join(" ")}`]: { stdout: JSON.stringify(reply) },
		});
		expect((await known.pullGroup("local", local(remote))).rows.map((p) => p.number)).toEqual([35]);
		expect(execCalls().filter((c) => c.command === "gh")).toHaveLength(3);
	} finally {
		clock.mockRestore();
	}
});

test("a missing remote git never falls back to this computer", async () => {
	machine("center", {});
	await expect(known.pullGroup("local", local(remote))).rejects.toThrow("cannot start git");
	expect(execCalls().every((c) => c.on === "center")).toBe(true);
});
