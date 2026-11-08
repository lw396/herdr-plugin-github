// Comment, close and reopen through a fake `exec`. Replies are real gh 2.96 output on test issue
// lw396/herdr-plugin-github#20, 2026-11-06 (test/fixtures/*-plugin-20.json are stdout as gh printed it).
import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { addComment, setIssueState } from "../../../src/github/issues/io/issues.ts";
import { failureOf } from "../../../src/github/shared/io/gh.ts";
import { machine, reset } from "../../fake-herdr.ts";

afterEach(reset);

const fixture = (name: string): string => readFileSync(join(import.meta.dir, "../../fixtures", name), "utf8");
const REPO = "lw396/herdr-plugin-github";
const BODY = "第一条评论\n\n- 多行\n- `代码`";
const comment = `~$ gh api repos/${REPO}/issues/20/comments -X POST -f body=${BODY}`;

test("a new comment is posted with the reader machine's gh and comes back as the timeline shows it", async () => {
	machine("center", { [comment]: { stdout: fixture("comment-plugin-20.json") } });
	expect(await addComment(REPO, 20, BODY, "center")).toEqual({
		id: 6692220155,
		author: "lw396",
		createdAt: "2026-11-06T18:23:19Z",
		body: BODY,
		markdown: BODY,
		reactions: [],
	});
});

/** What the reader says when a write fails (the comment box keeps its text: the view's part). */
const said = (p: Promise<unknown>) =>
	p.then(
		() => null,
		(e: unknown) => failureOf(e),
	);

test("a blank comment or a missing issue fails with GitHub's own words", async () => {
	machine(null, {
		[`~$ gh api repos/${REPO}/issues/20/comments -X POST -f body=`]: {
			code: 1,
			stderr: "gh: Validation Failed (HTTP 422)\n",
			stdout:
				'{"message":"Validation Failed","errors":[{"resource":"IssueComment","code":"unprocessable","field":"data","message":"Body cannot be blank"}],"documentation_url":"https://docs.github.com/rest/issues/comments#create-an-issue-comment","status":"422"}',
		},
		[`~$ gh api repos/${REPO}/issues/999999/comments -X POST -f body=x`]: {
			code: 1,
			stderr: "gh: Not Found (HTTP 404)\n",
			stdout:
				'{"message":"Not Found","documentation_url":"https://docs.github.com/rest/issues/comments#create-an-issue-comment","status":"404"}',
		},
	});
	expect(await said(addComment(REPO, 20, "", null))).toEqual({
		notFound: false,
		message: "gh: Validation Failed (HTTP 422)",
	});
	expect(await said(addComment(REPO, 999999, "x", null))).toEqual({
		notFound: true,
		message: "gh: Not Found (HTTP 404)",
	});
});

test("a dropped connection while posting is never posted again: GitHub may already have the comment", async () => {
	machine(null, {
		[comment]: { code: 1, stderr: `Post "https://api.github.com/repos/${REPO}/issues/20/comments": EOF\n` },
	});
	expect(await said(addComment(REPO, 20, BODY, null))).toMatchObject({ notFound: false });
	const { execCalls } = await import("../../fake-herdr.ts");
	expect(execCalls()).toHaveLength(1);
});

const row = {
	number: 20,
	title: "测试用，可删：#15 的评论、关闭和重新打开",
	assignees: ["lw396"],
	url: "https://github.com/lw396/herdr-plugin-github/issues/20",
};

test("close and reopen: the issue's new state, and its row for the sidebar's groups", async () => {
	machine("center", {
		[`~$ gh api repos/${REPO}/issues/20 -X PATCH -f state=closed`]: { stdout: fixture("closed-plugin-20.json") },
		[`~$ gh api repos/${REPO}/issues/20 -X PATCH -f state=open`]: { stdout: fixture("reopened-plugin-20.json") },
	});
	expect(await setIssueState(REPO, 20, "closed", "center")).toEqual({
		repo: REPO,
		state: "closed",
		issue: { ...row, updatedAt: "2026-11-06T18:23:20Z" },
	});
	expect(await setIssueState(REPO, 20, "open", "center")).toEqual({
		repo: REPO,
		state: "open",
		issue: { ...row, updatedAt: "2026-11-06T18:23:21Z" },
	});
});

test("closing without the rights to: GitHub's reason", async () => {
	machine(null, {
		"~$ gh api repos/cli/cli/issues/9789 -X PATCH -f state=closed": {
			code: 1,
			stderr: "gh: Must have admin rights to Repository. (HTTP 403)\n",
			stdout:
				'{"message":"Must have admin rights to Repository.","documentation_url":"https://docs.github.com/rest/issues/issues#update-an-issue","status":"403"}',
		},
	});
	expect(await said(setIssueState("cli/cli", 9789, "closed", null))).toEqual({
		notFound: false,
		message: "gh: Must have admin rights to Repository. (HTTP 403)",
	});
});

test("no gh on the reader's machine: rejects as Herdr does", async () => {
	machine("center", {});
	expect(await said(setIssueState(REPO, 20, "closed", "center"))).toEqual({
		notFound: false,
		message: "cannot start gh: No such file or directory (os error 2)",
	});
});
