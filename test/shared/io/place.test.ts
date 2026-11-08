// place.ts: the gh account per machine and the GitHub remote per folder, each asked once and then kept.
import { afterEach, describe, expect, test } from "bun:test";
import * as place from "../../../src/github/shared/io/place.ts";
import { machine, reset } from "../../fake-herdr.ts";

afterEach(() => {
	reset();
	place.clear();
});

const LOGIN = "~$ gh api user --jq .login";
const REMOTES = "/w/app$ git remote -v";
const REMOTE_V =
	"origin\tgit@github.com:lw396/herdr-plugin-github.git (fetch)\norigin\tgit@github.com:lw396/herdr-plugin-github.git (push)\n";

describe("account", () => {
	test("asked once per machine, then kept", async () => {
		machine("center", { [LOGIN]: { stdout: "lw396\n" } });
		expect(await place.account("center")).toEqual({ on: "center", status: { ok: true, user: "lw396" } });
		machine("center", {}); // asking again would now find no gh
		expect(await place.account("center")).toMatchObject({ status: { ok: true, user: "lw396" } });
		expect(place.peekAccount("center")).toMatchObject({ status: { ok: true } });
	});

	test("a machine's account is its own", async () => {
		machine(null, { [LOGIN]: { stdout: "here\n" } });
		machine("center", { [LOGIN]: { stdout: "there\n" } });
		await place.account(null);
		expect(place.peekAccount("center")).toBeUndefined();
		expect(await place.account("center")).toMatchObject({ status: { user: "there" } });
	});

	test("not signed in is not kept: signing in shows on the next look", async () => {
		machine("center", { [LOGIN]: { code: 4, stderr: "To get started with GitHub CLI, please run:  gh auth login\n" } });
		expect(await place.account("center")).toMatchObject({ status: { ok: false, reason: "auth" } });
		machine("center", { [LOGIN]: { stdout: "lw396\n" } });
		expect(await place.account("center")).toMatchObject({ status: { ok: true, user: "lw396" } });
	});

	test("↻ doesn't ask again: people rarely change their GitHub account, so a signed-in one is kept", async () => {
		machine("center", { [LOGIN]: { stdout: "lw396\n" } });
		await place.account("center");
		machine("center", { [LOGIN]: { code: 1, stderr: 'Get "https://api.github.com/user": EOF\n' } });
		expect(await place.account("center", true)).toMatchObject({ status: { ok: true, user: "lw396" } });
	});

	test("a connection that kept dropping is not kept: the next look asks again", async () => {
		machine("center", { [LOGIN]: { code: 1, stderr: 'Get "https://api.github.com/user": EOF\n' } });
		expect(await place.account("center")).toMatchObject({ status: { ok: false, reason: "error" } });
		machine("center", { [LOGIN]: { stdout: "lw396\n" } });
		expect(await place.account("center")).toMatchObject({ status: { ok: true, user: "lw396" } });
	});

	test("two looks at once share one gh call", async () => {
		let calls = 0;
		machine("center", {
			get [LOGIN]() {
				calls++;
				return { stdout: "lw396\n" };
			},
		});
		await Promise.all([place.account("center"), place.account("center")]);
		expect(calls).toBe(1);
	});
});

describe("remote", () => {
	test("per machine and folder, then kept", async () => {
		machine("center", { [REMOTES]: { stdout: REMOTE_V } });
		expect(await place.remote({ cwd: "/w/app", on: "center" })).toMatchObject({
			owner: "lw396",
			repo: "herdr-plugin-github",
		});
		machine("center", {});
		expect(await place.remote({ cwd: "/w/app", on: "center" })).toMatchObject({ owner: "lw396" });
		expect(place.peekRemote({ cwd: "/w/app", on: null })).toBeUndefined();
	});

	test("no GitHub remote is not kept: adding one shows on the next look", async () => {
		machine(null, { "/w/notes$ git remote -v": { stdout: "" } });
		expect(await place.remote({ cwd: "/w/notes", on: null })).toBeNull();
		expect(place.peekRemote({ cwd: "/w/notes", on: null })).toBeUndefined();
		machine(null, { "/w/notes$ git remote -v": { stdout: REMOTE_V } });
		expect(await place.remote({ cwd: "/w/notes", on: null })).toMatchObject({ owner: "lw396" });
	});

	test("↻ while an older look is still out: the older answer, arriving last, is not kept", async () => {
		let answerOld!: (r: { stdout: string }) => void;
		machine("center", { [REMOTES]: new Promise((resolve) => (answerOld = resolve)) });
		const old = place.remote({ cwd: "/w/app", on: "center" });
		// The person points origin at their own repository and presses ↻; the slow first
		// `git remote -v` still answers with the old URL afterwards.
		machine("center", { [REMOTES]: { stdout: REMOTE_V } });
		expect(await place.remote({ cwd: "/w/app", on: "center" }, true)).toMatchObject({ owner: "lw396" });
		answerOld({
			stdout:
				"origin\tgit@github.com:herdrdev/herdr-app.git (fetch)\norigin\tgit@github.com:herdrdev/herdr-app.git (push)\n",
		});
		await old;
		expect(place.peekRemote({ cwd: "/w/app", on: "center" })).toMatchObject({ owner: "lw396" });
	});

	test("git failing to run rejects and keeps nothing", async () => {
		machine("center", {});
		expect(await place.remote({ cwd: "/w/app", on: "center" }).catch((e: unknown) => e)).toBeInstanceOf(Error);
		expect(place.peekRemote({ cwd: "/w/app", on: "center" })).toBeUndefined();
	});
});
