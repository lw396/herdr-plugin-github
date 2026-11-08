// Real gh 2.96 REST replies captured on center, 2026-11-07.
import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { projectsQuery as projectsQueryOf } from "../../../src/github/detail/core/projects.ts";
import { readProjects } from "../../../src/github/detail/io/projects.ts";
import * as pulls from "../../../src/github/pulls/io/pulls.ts";
import { machine, reset } from "../../fake-herdr.ts";

afterEach(reset);
const fixture = (name: string) => readFileSync(new URL(`../../fixtures/${name}`, import.meta.url), "utf8");
// The query itself is specified in test/detail/core/projects.test.ts.
const projectsQuery = projectsQueryOf({ kind: "pr", repo: "lw396/herdr-plugin-github", number: 35 }, null).query;

function replies(number: number) {
	const prefix = `pull-cli-${number}`;
	const sha = JSON.parse(fixture(`${prefix}.json`)).head.sha;
	return {
		"~$ gh api repos/cli/cli": {
			stdout: fixture("repository-cli-merge-methods.json"),
		},
		[`~$ gh api repos/cli/cli/issues/${number}/timeline?per_page=100 --paginate --slurp`]: { stdout: "[[]]" },
		[`~$ gh api repos/cli/cli/pulls/${number}/comments?per_page=100 --paginate --slurp`]: { stdout: "[[]]" },
		[`~$ gh api repos/cli/cli/commits/${sha}/check-runs?per_page=100 --paginate --slurp`]: {
			stdout: '[{"check_runs":[]}]',
		},
		[`~$ gh api repos/cli/cli/commits/${sha}/statuses?per_page=100 --paginate --slurp`]: { stdout: "[[]]" },
		[`~$ gh api repos/cli/cli/pulls/${number}`]: { stdout: fixture(`${prefix}.json`) },
		[`~$ gh api repos/cli/cli/issues/${number}`]: { stdout: fixture(`${prefix}-issue.json`) },
		[`~$ gh api repos/cli/cli/issues/${number}/comments?per_page=100 --paginate --slurp`]: {
			stdout: fixture(`${prefix}-comments.json`),
		},
		[`~$ gh api repos/cli/cli/pulls/${number}/reviews?per_page=100 --paginate --slurp`]: {
			stdout: fixture(`${prefix}-reviews.json`),
		},
	};
}

test("timeline pages and check-run object pages are read on the PR machine", async () => {
	const responses = replies(14974);
	const sha = JSON.parse(fixture("pull-cli-14974.json")).head.sha;
	responses["~$ gh api repos/cli/cli/issues/14974/timeline?per_page=100 --paginate --slurp"] = {
		stdout: JSON.stringify([
			[{ id: 1, event: "closed", actor: { login: "owner" }, created_at: "2026-11-07T00:00:00Z" }],
			[{ id: 2, event: "reopened", actor: { login: "owner" }, created_at: "2026-11-08T00:00:00Z" }],
		]),
	};
	responses[`~$ gh api repos/cli/cli/commits/${sha}/check-runs?per_page=100 --paginate --slurp`] = {
		stdout: JSON.stringify([
			{
				check_runs: [
					{
						id: 1,
						name: "CI",
						status: "queued",
						conclusion: null,
						html_url: "https://github.com/cli/cli/actions/runs/1",
					},
				],
			},
			{
				check_runs: [
					{
						id: 2,
						name: "Lint",
						status: "in_progress",
						conclusion: null,
						html_url: "https://github.com/cli/cli/actions/runs/2",
					},
				],
			},
		]),
	};
	machine("center", responses);
	const pull = await pulls.readPull("cli/cli", 14974, "center");
	expect(pull.timeline?.map((x) => x.verb)).toEqual(["commented", "reviewed", "closed this", "reopened this"]);
	expect(pull.checks?.map((x) => [x.name, x.status, x.duration])).toEqual([
		["CI", "queued", "—"],
		["Lint", "in_progress", "—"],
	]);
});

test("PR Projects load every page through the reader's machine", async () => {
	const query = projectsQuery;
	const first = `~$ gh api graphql -F number=35 -F after=null -f query=${query} -f owner=lw396 -f name=herdr-plugin-github`;
	const next = `~$ gh api graphql -F number=35 -f query=${query} -f owner=lw396 -f name=herdr-plugin-github -f after=next`;
	// Schema-shaped: the live account lacks read:project (the next test records that failure).
	const page = (title: string, more: boolean) =>
		JSON.stringify({
			data: {
				repository: {
					pullRequest: {
						projectItems: {
							pageInfo: { hasNextPage: more, endCursor: more ? "next" : null },
							nodes: [{ project: { title, url: "https://github.com/users/lw396/projects/1" } }],
						},
					},
				},
			},
		});
	machine("center", { [first]: { stdout: page("First", true) }, [next]: { stdout: page("Second", false) } });
	expect(await readProjects({ kind: "pr", repo: "lw396/herdr-plugin-github", number: 35 }, "center")).toEqual({
		ok: true,
		projects: [
			{ title: "First", url: "https://github.com/users/lw396/projects/1" },
			{ title: "Second", url: "https://github.com/users/lw396/projects/1" },
		],
	});
});

test("PR Projects use pullRequest, not an issue query, and lack of scope stays optional", async () => {
	const query = projectsQuery;
	const asked = `~$ gh api graphql -F number=35 -F after=null -f query=${query} -f owner=lw396 -f name=herdr-plugin-github`;
	machine("center", { [asked]: JSON.parse(fixture("projects-denied.json")) });
	expect(await readProjects({ kind: "pr", repo: "lw396/herdr-plugin-github", number: 35 }, "center")).toEqual({
		ok: false,
		message: "Projects require read:project. Run gh auth refresh -h github.com -s read:project on center.",
	});
});

test("all review pages are included, not just the first", async () => {
	const responses = replies(14976);
	const reviews = JSON.parse(fixture("pull-cli-14976-reviews.json"))[0];
	responses["~$ gh api repos/cli/cli/pulls/14976/reviews?per_page=100 --paginate --slurp"] = {
		stdout: JSON.stringify([reviews.slice(0, 1), reviews.slice(1)]),
	};
	machine("center", responses);
	expect((await pulls.readPull("cli/cli", 14976, "center")).reviewers).toContainEqual({
		name: "tidy-dev",
		state: "approved",
		team: false,
	});
});

test("a failed discussion read is an error, not an empty discussion", async () => {
	machine("center", {
		...replies(14974),
		"~$ gh api repos/cli/cli/issues/14974/comments?per_page=100 --paginate --slurp": {
			code: 1,
			stderr: "gh: Not Found (HTTP 404)\n",
		},
	});
	await expect(pulls.readPull("cli/cli", 14974, "center")).rejects.toMatchObject({ notFound: true });
});

test("a missing remote gh never falls back to a working local account", async () => {
	machine("center", {});
	machine(null, replies(14974));
	await expect(pulls.readPull("cli/cli", 14974, "center")).rejects.toThrow("cannot start gh");
});

test("a merged PR includes requested reviewers and their submitted review states", async () => {
	machine("center", replies(14976));
	const pull = await pulls.readPull("cli/cli", 14976, "center");
	expect(pull.state).toBe("merged");
	expect(pull.reviewers).toEqual([
		{ name: "tidy-dev", state: "approved", team: false },
		{ name: "copilot-pull-request-reviewer[bot]", state: "commented", team: false },
		{ name: "sergiou87", state: "requested", team: false },
		{ name: "babakks", state: "requested", team: false },
	]);
});

test("read a closed fork PR and its Markdown discussion using the reader machine's gh", async () => {
	machine("center", replies(14974));
	const pull = await pulls.readPull("cli/cli", 14974, "center");
	expect(pull).toMatchObject({
		title: "probe fork pr",
		state: "closed",
		author: "escaleraalcielo",
		head: "escaleraalcielo:probe",
		base: "cli:trunk",
		assignees: [],
		milestone: null,
		labels: [
			{ name: "external", color: "#2700af" },
			{ name: "unmet-requirements", color: "#ee2329" },
		],
		url: "https://github.com/cli/cli/pull/14974",
	});
	const comments = pull.timeline.filter((item) => item.kind === "comment");
	expect(comments).toHaveLength(1);
	expect(comments[0]).toMatchObject({ id: 6694345158, author: "github-actions[bot]", reactions: [] });
	expect(comments[0]?.markdown).toContain("**Please update your PR");
});
