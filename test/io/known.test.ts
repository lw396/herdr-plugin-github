// known.ts: the gh account per machine, the GitHub remote per folder, the "Assigned to me"
// group per machine, repository and login, each fetched once and then kept. Replies are the
// real ones used in gh.test.ts and issues.test.ts.
import { afterEach, describe, expect, test } from "bun:test";
import { machine, reset } from "../fake-herdr.ts";
import { ASSIGNED_QUERY } from "../../src/github/core/issues.ts";
import * as known from "../../src/github/io/known.ts";

afterEach(() => {
  reset();
  known.clear();
});

const LOGIN = "~$ gh api user --jq .login";
const REMOTES = "/w/app$ git remote -v";
const REMOTE_V = "origin\tgit@github.com:lw396/herdr-plugin-github.git (fetch)\norigin\tgit@github.com:lw396/herdr-plugin-github.git (push)\n";
const ASSIGNED = `~$ gh api graphql -f query=${ASSIGNED_QUERY} -f owner=lw396 -f name=herdr-plugin-github -f assignee=lw396`;
const ASSIGNED_REPLY = '{"data":{"repository":{"hasIssuesEnabled":true,"issues":{"totalCount":1,"pageInfo":{"hasNextPage":false,"endCursor":"Y3Vyc29yOnYyOpK0MjAyNi0xMS0wNlQxMzowMToxM1rPAAAAAXPrZ54="},"nodes":[{"number":11,"title":"Issues 标签页：\\"指派给我的\\"一组","updatedAt":"2026-11-06T13:01:13Z","url":"https://github.com/lw396/herdr-plugin-github/issues/11","assignees":{"nodes":[{"login":"lw396"}]}}]}}}}';

describe("account", () => {
  test("asked once per machine, then kept", async () => {
    machine("center", { [LOGIN]: { stdout: "lw396\n" } });
    expect(await known.account("center")).toEqual({ on: "center", status: { ok: true, user: "lw396" } });
    machine("center", {}); // asking again would now find no gh
    expect(await known.account("center")).toMatchObject({ status: { ok: true, user: "lw396" } });
    expect(known.peekAccount("center")).toMatchObject({ status: { ok: true } });
  });

  test("a machine's account is its own", async () => {
    machine(null, { [LOGIN]: { stdout: "here\n" } });
    machine("center", { [LOGIN]: { stdout: "there\n" } });
    await known.account(null);
    expect(known.peekAccount("center")).toBeUndefined();
    expect(await known.account("center")).toMatchObject({ status: { user: "there" } });
  });

  test("not signed in is not kept: signing in shows on the next look", async () => {
    machine("center", { [LOGIN]: { code: 4, stderr: "To get started with GitHub CLI, please run:  gh auth login\n" } });
    expect(await known.account("center")).toMatchObject({ status: { ok: false, reason: "auth" } });
    machine("center", { [LOGIN]: { stdout: "lw396\n" } });
    expect(await known.account("center")).toMatchObject({ status: { ok: true, user: "lw396" } });
  });

  test("force asks again (↻)", async () => {
    machine("center", { [LOGIN]: { stdout: "lw396\n" } });
    await known.account("center");
    machine("center", { [LOGIN]: { stdout: "other\n" } });
    expect(await known.account("center", true)).toMatchObject({ status: { user: "other" } });
  });

  test("two looks at once share one gh call", async () => {
    let calls = 0;
    machine("center", { get [LOGIN]() { calls++; return { stdout: "lw396\n" }; } });
    await Promise.all([known.account("center"), known.account("center")]);
    expect(calls).toBe(1);
  });
});

describe("remote", () => {
  test("per machine and folder, then kept", async () => {
    machine("center", { [REMOTES]: { stdout: REMOTE_V } });
    expect(await known.remote({ cwd: "/w/app", on: "center" })).toMatchObject({ owner: "lw396", repo: "herdr-plugin-github" });
    machine("center", {});
    expect(await known.remote({ cwd: "/w/app", on: "center" })).toMatchObject({ owner: "lw396" });
    expect(known.peekRemote({ cwd: "/w/app", on: null })).toBeUndefined();
  });

  test("no GitHub remote is not kept: adding one shows on the next look", async () => {
    machine(null, { "/w/notes$ git remote -v": { stdout: "" } });
    expect(await known.remote({ cwd: "/w/notes", on: null })).toBeNull();
    expect(known.peekRemote({ cwd: "/w/notes", on: null })).toBeUndefined();
    machine(null, { "/w/notes$ git remote -v": { stdout: REMOTE_V } });
    expect(await known.remote({ cwd: "/w/notes", on: null })).toMatchObject({ owner: "lw396" });
  });

  test("↻ while an older look is still out: the older answer, arriving last, is not kept", async () => {
    let answerOld!: (r: { stdout: string }) => void;
    machine("center", { [REMOTES]: new Promise((resolve) => (answerOld = resolve)) });
    const old = known.remote({ cwd: "/w/app", on: "center" });
    // The person points origin at their own repository and presses ↻; the slow first
    // `git remote -v` still answers with the old URL afterwards.
    machine("center", { [REMOTES]: { stdout: REMOTE_V } });
    expect(await known.remote({ cwd: "/w/app", on: "center" }, true)).toMatchObject({ owner: "lw396" });
    answerOld({ stdout: "origin\tgit@github.com:herdrdev/herdr-app.git (fetch)\norigin\tgit@github.com:herdrdev/herdr-app.git (push)\n" });
    await old;
    expect(known.peekRemote({ cwd: "/w/app", on: "center" })).toMatchObject({ owner: "lw396" });
  });

  test("git failing to run rejects and keeps nothing", async () => {
    machine("center", {});
    expect(await known.remote({ cwd: "/w/app", on: "center" }).catch((e: unknown) => e)).toBeInstanceOf(Error);
    expect(known.peekRemote({ cwd: "/w/app", on: "center" })).toBeUndefined();
  });
});

describe("assigned", () => {
  const REMOTE = { remote: "origin", host: "github.com", owner: "lw396", repo: "herdr-plugin-github" };

  test("per machine, repository and login, then kept", async () => {
    machine(null, { [ASSIGNED]: { stdout: ASSIGNED_REPLY } });
    expect(await known.assigned(REMOTE, "lw396", null)).toMatchObject({ total: 1, issues: [{ number: 11 }] });
    machine(null, {});
    expect(await known.assigned(REMOTE, "lw396", null)).toMatchObject({ total: 1 });
    expect(known.peekAssigned(REMOTE, "lw396", null)).toMatchObject({ total: 1 });
    expect(known.peekAssigned(REMOTE, "lw396", "center")).toBeUndefined();
    expect(known.peekAssigned(REMOTE, "someone-else", null)).toBeUndefined();
  });

  test("a 404 rejects and keeps nothing", async () => {
    machine(null, { [ASSIGNED]: {
      code: 1,
      stdout: '{"data":{"repository":null},"errors":[{"type":"NOT_FOUND","path":["repository"],"locations":[{"line":1,"column":41}],"message":"Could not resolve to a Repository with the name \'lw396/herdr-plugin-github\'."}]}',
      stderr: "gh: Could not resolve to a Repository with the name 'lw396/herdr-plugin-github'.\n",
    } });
    expect(await known.assigned(REMOTE, "lw396", null).catch((e: unknown) => e)).toMatchObject({ notFound: true });
    expect(known.peekAssigned(REMOTE, "lw396", null)).toBeUndefined();
  });
});
