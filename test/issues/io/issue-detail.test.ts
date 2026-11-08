// Captured REST replies from gh api, 2026-11-06/07; no cwd, on the pane's machine.
// The timeline (issues/N/timeline) carries both comments and label/assignment activity.
import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { issueChanges, readIssue } from "../../../src/github/issues/io/issues.ts";
import { machine, reset } from "../../fake-herdr.ts";

afterEach(reset);
const fixture = (name: string) => readFileSync(new URL(`../../fixtures/${name}`, import.meta.url), "utf8");
const TIMELINE = "/timeline?per_page=100 --paginate --slurp";

// gh 2.96, 2026-11-07: first GET, unchanged GET, then a real new comment and the same conditional GET.
test("new comments change the issue validator; unchanged discussions return 304 on the reader machine", async () => {
	const path = "~$ gh api repos/lw396/herdr-plugin-github/issues/17 --include";
	const etag = 'W/"4e1d128d63c6bad4ac465901e7acc7dca2f6b708dbd12dc81c1529cb946ae44f"';
	machine("center", { [path]: JSON.parse(fixture("issue-poll-before.json")) });
	expect(await issueChanges("lw396/herdr-plugin-github", 17, null, "center")).toEqual({ changed: true, etag });
	machine("center", { [`${path} -H If-None-Match: ${etag}`]: JSON.parse(fixture("issue-poll-304.json")) });
	expect(await issueChanges("lw396/herdr-plugin-github", 17, etag, "center")).toEqual({ changed: false });
	machine("center", { [`${path} -H If-None-Match: ${etag}`]: JSON.parse(fixture("issue-poll-after-comment.json")) });
	expect(await issueChanges("lw396/herdr-plugin-github", 17, etag, "center")).toEqual({
		changed: true,
		etag: 'W/"2ac14621bcc9bc8014fb54aaf3f1fbf68b1fd16da99ad94db2dca9f8d6aaea92"',
	});
});

test("one timeline read gives the issue's complete discussion and activity on the pane machine's gh", async () => {
	machine("center", {
		"~$ gh api repos/cli/cli/issues/9789": { stdout: fixture("issue-cli-9789.json") },
		[`~$ gh api repos/cli/cli/issues/9789${TIMELINE}`]: { stdout: `[${fixture("timeline-cli-9789.json")}]` },
	});
	const issue = await readIssue("cli/cli", 9789, "center");
	expect(issue).toMatchObject({
		title: "`gh auth login --with-token` hangs",
		state: "open",
		author: "jtmcg",
		assignees: [],
		milestone: null,
		labels: [
			{ name: "bug", color: "#d73a4a" },
			{ name: "priority-3", color: "#eded04" },
			{ name: "help wanted", color: "#98f9f0" },
			{ name: "gh-auth", color: "#9a3d69" },
		],
		url: "https://github.com/cli/cli/issues/9789",
	});
	expect(issue.markdown).toContain("gh auth login --with-token");
	// The same three comments the comments endpoint returns (ids, authors, times, reactions).
	expect(issue.comments.map((c) => [c.id, c.author, c.createdAt])).toEqual([
		[2426092653, "williammartin", "2024-10-21T09:17:22Z"],
		[5993632414, "babakks", "2026-10-05T11:35:56Z"],
		[6679707396, "mithilesh-iitm", "2026-11-06T07:32:15Z"],
	]);
	expect(issue.comments[0]?.reactions).toEqual([
		{ emoji: "👍", count: 1 },
		{ emoji: "❤️", count: 1 },
	]);
	expect(issue.comments[1]?.reactions).toEqual([]);
	// Label changes from the same reply; mentions, references and subscriptions are not shown.
	expect(issue.activities.map((a) => [a.id, a.kind])).toEqual([
		[14728059939, "labeled"],
		[14728060915, "labeled"],
		[14728062449, "unlabeled"],
		[14728062451, "labeled"],
		[14728062455, "labeled"],
		[14728062457, "labeled"],
		[32503471799, "labeled"],
		[32503509142, "unlabeled"],
		[32503509195, "unlabeled"],
		[32503509309, "labeled"],
	]);
});

test("all timeline pages become one chronologically ordered discussion", async () => {
	// Real pages captured with per_page=20 (20 + 13 events), as --slurp prints them.
	machine(null, {
		"~$ gh api repos/cli/cli/issues/9789": { stdout: fixture("issue-cli-9789.json") },
		[`~$ gh api repos/cli/cli/issues/9789${TIMELINE}`]: { stdout: fixture("timeline-cli-9789-pages.json") },
	});
	const issue = await readIssue("cli/cli", 9789, null);
	expect(issue.comments.map((c) => c.id)).toEqual([2426092653, 5993632414, 6679707396]);
	expect(issue.activities).toHaveLength(10);
});

test("label and assignment activity on the assigned issue", async () => {
	machine(null, {
		"~$ gh api repos/lw396/herdr-plugin-github/issues/13": { stdout: fixture("issue-plugin-13.json") },
		[`~$ gh api repos/lw396/herdr-plugin-github/issues/13${TIMELINE}`]: {
			stdout: `[${fixture("timeline-plugin-13.json")}]`,
		},
	});
	const issue = await readIssue("lw396/herdr-plugin-github", 13, null);
	expect(issue).toMatchObject({ author: "lw396", assignees: ["lw396"], milestone: null });
	expect(issue.activities).toEqual([
		{
			id: 35331262662,
			kind: "labeled",
			actor: "lw396",
			createdAt: "2026-11-06T09:01:24Z",
			labels: [{ name: "wayfinder:task", color: "#0e8a16" }],
		},
		{
			id: 35331263090,
			kind: "labeled",
			actor: "lw396",
			createdAt: "2026-11-06T09:01:24Z",
			labels: [{ name: "ready-for-agent", color: "#006b75" }],
		},
		{ id: 35356295613, kind: "assigned", actor: "lw396", createdAt: "2026-11-06T14:23:16Z", assignee: "lw396" },
	]);
});

test("a closed issue retains its milestone, assignee and labels", async () => {
	machine(null, {
		"~$ gh api repos/microsoft/vscode/issues/346509": { stdout: fixture("issue-vscode-346509.json") },
		[`~$ gh api repos/microsoft/vscode/issues/346509${TIMELINE}`]: { stdout: "[[]]" },
	});
	expect(await readIssue("microsoft/vscode", 346509, null)).toMatchObject({
		title: "Resending the same message to another model doesn't work",
		state: "closed",
		author: "ulugbekna",
		milestone: "1.146.0",
		assignees: ["justschen"],
		labels: [{ name: "unreleased", color: "#d1b697" }],
		comments: [],
		activities: [],
	});
});

test("a timeline read failure rejects rather than showing an incomplete discussion", async () => {
	machine("center", {
		"~$ gh api repos/cli/cli/issues/9789": { stdout: fixture("issue-cli-9789.json") },
		[`~$ gh api repos/cli/cli/issues/9789${TIMELINE}`]: { code: 1, stderr: "gh: Not Found (HTTP 404)\n" },
	});
	expect(await readIssue("cli/cli", 9789, "center").catch((e) => e)).toMatchObject({ notFound: true });
});

test("a missing remote gh never falls back to this computer", async () => {
	machine("center", {});
	machine(null, {
		"~$ gh api repos/cli/cli/issues/9789": { stdout: fixture("issue-cli-9789.json") },
		[`~$ gh api repos/cli/cli/issues/9789${TIMELINE}`]: { stdout: "[[]]" },
	});
	expect(await readIssue("cli/cli", 9789, "center").catch((e) => e)).toMatchObject({
		message: "cannot start gh: No such file or directory (os error 2)",
	});
});
