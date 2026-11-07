// Real gh 2.96 REST replies captured on center, 2026-11-07.
import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { readProjects } from "../../src/github/io/projects.ts";
import * as pulls from "../../src/github/io/pulls.ts";
import { machine, reset } from "../fake-herdr.ts";

afterEach(reset);
const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), "utf8");
// Independent query specification: not derived from production's query.
// https://docs.github.com/en/graphql/reference/objects#pullrequest
const projectsQuery = `query($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      projectItems(first: 100, after: $after, includeArchived: true) {
        pageInfo { hasNextPage endCursor }
        nodes { project { title url } }
      }
    }
  }
}`;

function replies(number: number) {
	const prefix = `pull-cli-${number}`;
	return {
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
		number: 14974,
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
	expect(pull.comments).toHaveLength(1);
	expect(pull.comments[0]).toMatchObject({ id: 6694345158, author: "github-actions[bot]", reactions: [] });
	expect(pull.comments[0]?.markdown).toContain("**Please update your PR");
});
