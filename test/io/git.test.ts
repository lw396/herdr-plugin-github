// git.ts through a fake `exec`. Replies are real git output.
import { afterEach, expect, test } from "bun:test";
import { githubRemote } from "../../src/github/io/git.ts";
import { machine, reset } from "../fake-herdr.ts";

afterEach(reset);

const NOT_A_REPO = {
	code: 128,
	stderr:
		"fatal: not a git repository (or any parent up to mount point /)\nStopping at filesystem boundary (GIT_DISCOVERY_ACROSS_FILESYSTEM not set).\n",
};

test("the folder's GitHub remote", async () => {
	machine(null, {
		"/Users/apple/Work/lw396/wechat-mcp$ git remote -v": {
			stdout:
				"origin\thttps://github.com/lw396/wechat-wcp.git (fetch)\norigin\thttps://github.com/lw396/wechat-wcp.git (push)\n",
		},
	});
	expect(await githubRemote({ cwd: "/Users/apple/Work/lw396/wechat-mcp" })).toEqual({
		remote: "origin",
		host: "github.com",
		owner: "lw396",
		repo: "wechat-wcp",
	});
});

test("asks git on the space's machine", async () => {
	machine("center", {
		"/home/valian/work/app$ git remote -v": {
			stdout:
				"origin\tgit@github.com:herdrdev/herdr-app.git (fetch)\norigin\tgit@github.com:herdrdev/herdr-app.git (push)\n",
		},
	});
	expect(await githubRemote({ cwd: "/home/valian/work/app", on: "center" })).toMatchObject({
		owner: "herdrdev",
		repo: "herdr-app",
	});
});

test("outside a git repository: none", async () => {
	machine(null, { "/tmp$ git remote -v": NOT_A_REPO });
	expect(await githubRemote({ cwd: "/tmp" })).toBeNull();
});

test("a repository without remotes: none", async () => {
	machine(null, { "/w/new$ git remote -v": { stdout: "" } });
	expect(await githubRemote({ cwd: "/w/new" })).toBeNull();
});

test("no folder: none, without running git", async () => {
	machine(null, {});
	expect(await githubRemote({ cwd: null })).toBeNull();
});

test("git not installed: rejects with Herdr's reason", async () => {
	machine(null, {});
	await expect(githubRemote({ cwd: "/w/app" })).rejects.toThrow("cannot run git");
});
