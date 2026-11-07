// pulls.ts through a fake `exec`. Replies are real gh 2.96 output on center, 2026-11-07
// (test/fixtures/pulls-*.json: stdout as gh printed it; pulls-all-404.json: stdout, stderr and code).
import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ALL_OPEN_QUERY } from "../../src/github/core/pulls.ts";
import { failureOf } from "../../src/github/io/gh.ts";
import * as pulls from "../../src/github/io/pulls.ts";
import { machine, reset } from "../fake-herdr.ts";

afterEach(reset);

const fixture = (name: string): string => readFileSync(join(import.meta.dir, "../fixtures", name), "utf8");
const remote = (owner: string, repo: string) => ({ remote: "origin", host: "github.com", owner, repo });
const asked = (owner: string, name: string, after: string | null): string =>
	after === null
		? `~$ gh api graphql -F after=null -f query=${ALL_OPEN_QUERY} -f owner=${owner} -f name=${name}`
		: `~$ gh api graphql -f query=${ALL_OPEN_QUERY} -f owner=${owner} -f name=${name} -f after=${after}`;

test("All Open's first page is asked with the gh on the folder's machine", async () => {
	machine("center", { [asked("lw396", "herdr-plugin-github", null)]: { stdout: fixture("pulls-all-plugin.json") } });
	const page = await pulls.pullPage("all", remote("lw396", "herdr-plugin-github"), "center", null);
	expect(page.pulls.map((p) => [p.number, p.state])).toEqual([
		[36, "draft"],
		[35, "open"],
	]);
	expect(page.more).toBe(false);
});

test("Load more asks for the page after the last cursor", async () => {
	const cursor = "Y3Vyc29yOnYyOpK0MjAyNi0wOS0wN1QxNToxMDo0OFrO1-HpJQ==";
	machine(null, { [asked("cli", "cli", cursor)]: { stdout: fixture("pulls-all-cli-2.json") } });
	const page = await pulls.pullPage("all", remote("cli", "cli"), null, cursor);
	expect(page).toMatchObject({ total: 59, more: false });
	expect(page.pulls).toHaveLength(29);
});

test("a repository that isn't there (or can't be seen) is a not-found failure", async () => {
	machine(null, { [asked("lw396", "does-not-exist-for-pr-test", null)]: JSON.parse(fixture("pulls-all-404.json")) });
	const error = await pulls.pullPage("all", remote("lw396", "does-not-exist-for-pr-test"), null, null).catch((e) => e);
	expect(failureOf(error)).toMatchObject({ notFound: true });
});
