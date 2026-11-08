// pulls.ts through a fake `exec`. Replies are real gh 2.96 output on center, 2026-11-07
// (test/fixtures/pulls-*.json: stdout as gh printed it; pulls-all-404.json: stdout, stderr and code).
import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pullGroupQuery } from "../../../src/github/pulls/core/pulls.ts";
import * as pulls from "../../../src/github/pulls/io/pulls.ts";
import { failureOf } from "../../../src/github/shared/core/gh.ts";
import { machine, reset } from "../../fake-herdr.ts";

afterEach(reset);

const ANY = { remote: "origin", host: "github.com", owner: "", repo: "" };
const ALL_OPEN_QUERY = pullGroupQuery("all", ANY, "", null).query;
const SEARCH_QUERY = pullGroupQuery("review", ANY, "", null).query;
const fixture = (name: string): string => readFileSync(join(import.meta.dir, "../../fixtures", name), "utf8");
const remote = (owner: string, repo: string) => ({ remote: "origin", host: "github.com", owner, repo });
const asked = (owner: string, name: string, after: string | null): string =>
	after === null
		? `~$ gh api graphql -F after=null -f query=${ALL_OPEN_QUERY} -f owner=${owner} -f name=${name}`
		: `~$ gh api graphql -f query=${ALL_OPEN_QUERY} -f owner=${owner} -f name=${name} -f after=${after}`;

test("All Open's first page is asked with the gh on the folder's machine", async () => {
	machine("center", { [asked("lw396", "herdr-plugin-github", null)]: { stdout: fixture("pulls-all-plugin.json") } });
	const page = await pulls.pullPage("all", remote("lw396", "herdr-plugin-github"), "lw396", "center", null);
	expect(page.rows.map((p) => [p.number, p.state])).toEqual([
		[36, "draft"],
		[35, "open"],
	]);
	expect(page.more).toBe(false);
});

test("Load more asks for the page after the last cursor", async () => {
	const cursor = "Y3Vyc29yOnYyOpK0MjAyNi0wOS0wN1QxNToxMDo0OFrO1-HpJQ==";
	machine(null, { [asked("cli", "cli", cursor)]: { stdout: fixture("pulls-all-cli-2.json") } });
	const page = await pulls.pullPage("all", remote("cli", "cli"), "lw396", null, cursor);
	expect(page).toMatchObject({ total: 59, more: false });
	expect(page.rows).toHaveLength(29);
});

test("a repository that isn't there (or can't be seen) is a not-found failure", async () => {
	machine(null, { [asked("lw396", "does-not-exist-for-pr-test", null)]: JSON.parse(fixture("pulls-all-404.json")) });
	const error = await pulls
		.pullPage("all", remote("lw396", "does-not-exist-for-pr-test"), "lw396", null, null)
		.catch((e) => e);
	expect(failureOf(error)).toMatchObject({ notFound: true });
});

const searched = (q: string): string => `~$ gh api graphql -F after=null -f query=${SEARCH_QUERY} -f q=${q}`;

test("Waiting For My Review searches for PRs asking the gh account for review", async () => {
	machine(null, {
		[searched("repo:cli/cli is:pr is:open review-requested:babakks sort:updated-desc")]: {
			stdout: fixture("pulls-review-cli.json"),
		},
	});
	const page = await pulls.pullPage("review", remote("cli", "cli"), "babakks", null, null);
	expect(page).toMatchObject({ total: 26, more: false });
	expect(page.rows[0]).toMatchObject({ number: 14964, state: "open", author: "dependabot" });
});

test("nobody asked: an empty group, not a failure", async () => {
	machine(null, {
		[searched("repo:lw396/herdr-plugin-github is:pr is:open review-requested:lw396 sort:updated-desc")]: {
			stdout: fixture("pulls-review-plugin.json"),
		},
	});
	expect(await pulls.pullPage("review", remote("lw396", "herdr-plugin-github"), "lw396", null, null)).toEqual({
		total: 0,
		more: false,
		cursor: null,
		rows: [],
	});
});

test("Created By Me searches for the gh account's open PRs on the folder's machine", async () => {
	machine("center", {
		[searched("repo:lw396/herdr-plugin-github is:pr is:open author:lw396 sort:updated-desc")]: {
			stdout: fixture("pulls-mine-plugin.json"),
		},
	});
	const page = await pulls.pullPage("mine", remote("lw396", "herdr-plugin-github"), "lw396", "center", null);
	expect(page.rows.map((p) => p.number)).toEqual([36, 35]);
});
