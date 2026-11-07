import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { projectsQuery } from "../../src/github/core/projects.ts";
import { readProjects } from "../../src/github/io/projects.ts";
import { machine, reset } from "../fake-herdr.ts";

afterEach(reset);
const asked = (after: string | null = null) =>
	`~$ gh api graphql -F number=13 ${after === null ? "-F after=null " : ""}-f query=${projectsQuery({ kind: "issue", repo: "lw396/herdr-plugin-github", number: 13 }, null).query} -f owner=lw396 -f name=herdr-plugin-github${after ? ` -f after=${after}` : ""}`;

// Schema-shaped example from GitHub's Issue.projectItems / ProjectV2 reference:
// https://docs.github.com/en/graphql/reference/objects#issue
// https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects
// Live queries with this account return the real read:project error covered below.
test("read the issue's real Projects through gh on its own machine", async () => {
	machine("center", {
		[asked()]: {
			stdout: JSON.stringify({
				data: {
					repository: {
						issue: {
							projectItems: {
								pageInfo: { hasNextPage: false, endCursor: null },
								nodes: [{ project: { title: "Project title", url: "https://github.com/orgs/octo-org/projects/5" } }],
							},
						},
					},
				},
			}),
		},
	});
	expect(await readProjects({ kind: "issue", repo: "lw396/herdr-plugin-github", number: 13 }, "center")).toEqual({
		ok: true,
		projects: [{ title: "Project title", url: "https://github.com/orgs/octo-org/projects/5" }],
	});
});

test("missing read:project is a machine-specific notice, not an empty Projects result", async () => {
	const denied = JSON.parse(readFileSync(new URL("../fixtures/projects-denied.json", import.meta.url), "utf8"));
	machine("center", { [asked()]: denied });
	machine(null, {});
	expect(await readProjects({ kind: "issue", repo: "lw396/herdr-plugin-github", number: 13 }, "center")).toEqual({
		ok: false,
		message: "Projects require read:project. Run gh auth refresh -h github.com -s read:project on center.",
	});
});

test("every Projects page is read and kept in order", async () => {
	machine(null, {
		[asked()]: {
			stdout: JSON.stringify({
				data: {
					repository: {
						issue: {
							projectItems: {
								pageInfo: { hasNextPage: true, endCursor: "next-project" },
								nodes: [{ project: { title: "First project", url: "https://github.com/orgs/octo-org/projects/5" } }],
							},
						},
					},
				},
			}),
		},
		[asked("next-project")]: {
			stdout: JSON.stringify({
				data: {
					repository: {
						issue: {
							projectItems: {
								pageInfo: { hasNextPage: false, endCursor: null },
								nodes: [{ project: { title: "Next project", url: "https://github.com/orgs/octo-org/projects/6" } }],
							},
						},
					},
				},
			}),
		},
	});
	expect(await readProjects({ kind: "issue", repo: "lw396/herdr-plugin-github", number: 13 }, null)).toEqual({
		ok: true,
		projects: [
			{ title: "First project", url: "https://github.com/orgs/octo-org/projects/5" },
			{ title: "Next project", url: "https://github.com/orgs/octo-org/projects/6" },
		],
	});
});

test("an empty successful connection really means no Projects", async () => {
	machine(null, {
		[asked()]: {
			stdout:
				'{"data":{"repository":{"issue":{"projectItems":{"pageInfo":{"hasNextPage":false,"endCursor":null},"nodes":[]}}}}}',
		},
	});
	expect(await readProjects({ kind: "issue", repo: "lw396/herdr-plugin-github", number: 13 }, null)).toEqual({
		ok: true,
		projects: [],
	});
});

test("a missing remote gh never falls back to another account for Projects", async () => {
	machine("center", {});
	machine(null, {
		[asked()]: {
			stdout:
				'{"data":{"repository":{"issue":{"projectItems":{"pageInfo":{"hasNextPage":false,"endCursor":null},"nodes":[]}}}}}',
		},
	});
	expect(await readProjects({ kind: "issue", repo: "lw396/herdr-plugin-github", number: 13 }, "center")).toEqual({
		ok: false,
		message: "Projects unavailable on center. cannot start gh: No such file or directory (os error 2)",
	});
});

test("an unreadable Projects page is not misreported as no Projects", async () => {
	machine("center", { [asked()]: { stdout: '{"data":{"repository":{"issue":null}}}' } });
	expect(await readProjects({ kind: "issue", repo: "lw396/herdr-plugin-github", number: 13 }, "center")).toMatchObject({
		ok: false,
	});
});
