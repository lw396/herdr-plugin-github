// issues.ts through a fake `exec`. Replies are real gh 2.96 output (`gh api graphql`), 2026-11-06:
// test/fixtures/*.json are stdout as gh printed it.
import { afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type GroupKind, groupQuery } from "../../src/github/core/issues.ts";
import { GhError } from "../../src/github/io/gh.ts";
import * as issues from "../../src/github/io/issues.ts";
import { machine, reset } from "../fake-herdr.ts";

afterEach(reset);

const fixture = (name: string): string => readFileSync(join(import.meta.dir, "../fixtures", name), "utf8");
const remote = (owner: string, repo: string) => ({ remote: "origin", host: "github.com", owner, repo });

/** The command gh gets for a page: `after` null is the first page (-F, a JSON null), else the cursor (-f). */
function asked(kind: GroupKind, owner: string, name: string, after: string | null, assignee?: string): string {
	const first = after === null ? "-F after=null " : "";
	const next = after === null ? "" : ` -f after=${after}`;
	return `~$ gh api graphql ${first}-f query=${groupQuery(kind)} -f owner=${owner} -f name=${name}${next}${assignee ? ` -f assignee=${assignee}` : ""}`;
}

describe("issue list changes", () => {
	test("a 404 is still a repository failure, not an unchanged list", async () => {
		machine(null, {
			"~$ gh api repos/lw396/does-not-exist-for-poll-test/issues?state=all&sort=updated&per_page=1 --include":
				JSON.parse(fixture("issues-poll-404.json")),
		});
		expect(
			await issues.listChanges("lw396/does-not-exist-for-poll-test", null, null).catch((e: unknown) => e),
		).toMatchObject({ code: 1, notFound: true });
	});

	test("304 means unchanged even though gh exits 1; the previous ETag is sent verbatim", async () => {
		machine("center", {
			'~$ gh api repos/lw396/herdr-plugin-github/issues?state=all&sort=updated&per_page=1 --include -H If-None-Match: W/"d4c47c7cdfe7d905ae24de722f838dadda87cf5a7451338ef032764adfe92162"':
				JSON.parse(fixture("issues-poll-304.json")),
		});
		expect(
			await issues.listChanges(
				"lw396/herdr-plugin-github",
				'W/"d4c47c7cdfe7d905ae24de722f838dadda87cf5a7451338ef032764adfe92162"',
				"center",
			),
		).toEqual({ changed: false });
	});

	test("a first read on the folder's machine returns the new ETag", async () => {
		machine("center", {
			"~$ gh api repos/lw396/herdr-plugin-github/issues?state=all&sort=updated&per_page=1 --include": JSON.parse(
				fixture("issues-poll-200.json"),
			),
		});
		expect(await issues.listChanges("lw396/herdr-plugin-github", null, "center")).toEqual({
			changed: true,
			etag: 'W/"d4c47c7cdfe7d905ae24de722f838dadda87cf5a7451338ef032764adfe92162"',
		});
	});
});

describe("issuePage", () => {
	test("Assigned: the folder machine's gh, the repository's open issues assigned to its login", async () => {
		machine("center", {
			[asked("assigned", "lw396", "herdr-plugin-github", null, "lw396")]: {
				stdout: fixture("assigned-herdr-plugin-github.json"),
			},
		});
		expect(await issues.issuePage("assigned", remote("lw396", "herdr-plugin-github"), "lw396", "center", null)).toEqual(
			{
				issuesEnabled: true,
				total: 1,
				more: false,
				cursor: "Y3Vyc29yOnYyOpK0MjAyNi0xMS0wNlQxMzoyODo1M1rPAAAAAXProvM=",
				issues: [
					{
						number: 12,
						title: "Issues 标签页：Open、Closed、折叠和加载更多",
						assignees: ["lw396"],
						updatedAt: "2026-11-06T13:28:53Z",
						url: "https://github.com/lw396/herdr-plugin-github/issues/12",
					},
				],
			},
		);
	});

	test("Closed: the repository's closed issues, most recently updated first", async () => {
		machine(null, {
			[asked("closed", "lw396", "herdr-plugin-github", null)]: { stdout: fixture("closed-herdr-plugin-github.json") },
		});
		const page = await issues.issuePage("closed", remote("lw396", "herdr-plugin-github"), "lw396", null, null);
		expect(page.issues.map((i) => i.number)).toEqual([11, 10, 2]);
		expect(page).toMatchObject({ total: 3, more: false });
	});

	test("Open, more than a page (cli/cli): 30 rows, and another page follows", async () => {
		machine(null, { [asked("open", "cli", "cli", null)]: { stdout: fixture("open-cli-1.json") } });
		const page = await issues.issuePage("open", remote("cli", "cli"), "lw396", null, null);
		expect(page.issues).toHaveLength(30);
		expect(page.issues.slice(0, 4).map((i) => i.number)).toEqual([13118, 14962, 9789, 14615]);
		expect(page).toMatchObject({
			total: 1058,
			more: true,
			cursor: "Y3Vyc29yOnYyOpK0MjAyNi0xMS0wMlQxNzowMDozMVrPAAAAAW3jAo8=",
		});
	});

	test("the next page: after the last page's cursor", async () => {
		machine(null, {
			[asked("open", "cli", "cli", "Y3Vyc29yOnYyOpK0MjAyNi0xMS0wMlQxNzowMDozMVrPAAAAAW3jAo8=")]: {
				stdout: fixture("open-cli-2.json"),
			},
		});
		const page = await issues.issuePage(
			"open",
			remote("cli", "cli"),
			"lw396",
			null,
			"Y3Vyc29yOnYyOpK0MjAyNi0xMS0wMlQxNzowMDozMVrPAAAAAW3jAo8=",
		);
		expect(page.issues.slice(0, 4).map((i) => i.number)).toEqual([14895, 14856, 14855, 14822]);
		expect(page).toMatchObject({ more: true, cursor: "Y3Vyc29yOnYyOpK0MjAyNi0xMC0yNVQxNToxNzozNVrPAAAAAS_2QAQ=" });
	});

	test("Issues turned off (torvalds/linux): an empty group that says so", async () => {
		machine(null, {
			[asked("open", "torvalds", "linux", null)]: {
				stdout:
					'{"data":{"repository":{"hasIssuesEnabled":false,"issues":{"totalCount":0,"pageInfo":{"hasNextPage":false,"endCursor":null},"nodes":[]}}}}',
			},
		});
		expect(await issues.issuePage("open", remote("torvalds", "linux"), "lw396", null, null)).toMatchObject({
			issuesEnabled: false,
			issues: [],
		});
	});

	test("no such repository (or not visible to this account): a GhError that is notFound", async () => {
		machine(null, {
			[asked("open", "lw396", "wechat-wcp", null)]: {
				code: 1,
				stdout:
					'{"data":{"repository":null},"errors":[{"type":"NOT_FOUND","path":["repository"],"locations":[{"line":1,"column":41}],"message":"Could not resolve to a Repository with the name \'lw396/wechat-wcp\'."}]}',
				stderr: "gh: Could not resolve to a Repository with the name 'lw396/wechat-wcp'.\n",
			},
		});
		const error = await issues
			.issuePage("open", remote("lw396", "wechat-wcp"), "lw396", null, null)
			.catch((e: unknown) => e);
		expect(error).toBeInstanceOf(GhError);
		expect(error).toMatchObject({ notFound: true });
	});

	test("not signed in: a GhError with gh's message", async () => {
		machine(null, {
			[asked("open", "lw396", "herdr-plugin-github", null)]: {
				code: 4,
				stderr:
					"To get started with GitHub CLI, please run:  gh auth login\nAlternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.\n",
			},
		});
		expect(
			await issues
				.issuePage("open", remote("lw396", "herdr-plugin-github"), "lw396", null, null)
				.catch((e: unknown) => e),
		).toMatchObject({ code: 4, notFound: false });
	});

	test("no gh on the folder's machine: rejects as Herdr does", async () => {
		machine("center", {});
		expect(
			await issues
				.issuePage("open", remote("lw396", "herdr-plugin-github"), "lw396", "center", null)
				.catch((e: unknown) => e),
		).toMatchObject({ message: "cannot start gh: No such file or directory (os error 2)" });
	});
});
