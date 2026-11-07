// context.ts through the fake Herdr screen: the focused folder follows focus as it moves.
import { afterEach, expect, test } from "bun:test";
import { currentBranch, location, locationKey } from "../../src/github/io/context.ts";
import { execCalls, reset, screen } from "../fake-herdr.ts";

afterEach(reset);

const SPACE = {
	id: "center/sp3870c5d8830571046adbca0cb0b3075d",
	active: true,
	folder: "/home/valian",
	machine: "center",
};
const REPO = "/home/valian/work/ai/herdr/herdr-plugin-github";

test("the branch stays live while focus is on a reader, without commands or a repository refresh", () => {
	const terminal = { pane: "center/p1", terminal: "center/t19", cwd: REPO, branch: "main" };
	const detail = { pane: "center/p2", terminal: null, mod: "github", cwd: null };
	screen({
		spaces: [SPACE],
		panes: [terminal, detail],
		focused: { pane: terminal.pane, terminal: terminal.terminal, cwd: REPO },
	});
	const key = locationKey();
	expect(currentBranch()).toBe("main");
	screen({ spaces: [SPACE], panes: [{ ...terminal, branch: "feat/issues" }, detail], focused: { pane: detail.pane } });
	expect(currentBranch()).toBe("feat/issues");
	expect(locationKey()).toBe(key);
	expect(execCalls()).toEqual([]);
});

test("moving to a non-git folder clears the branch, and switching machines does not reuse it", () => {
	const terminal = { pane: "center/p1", terminal: "center/t19", cwd: REPO, branch: "main" };
	screen({
		spaces: [SPACE],
		panes: [terminal],
		focused: { pane: terminal.pane, terminal: terminal.terminal, cwd: REPO },
	});
	expect(currentBranch()).toBe("main");
	screen({
		spaces: [SPACE],
		panes: [{ ...terminal, cwd: "/tmp", branch: null }],
		focused: { pane: terminal.pane, terminal: terminal.terminal, cwd: "/tmp" },
	});
	expect(currentBranch()).toBeNull();
	screen({
		spaces: [{ id: "local/s1", active: true, folder: REPO, machine: null }],
		panes: [terminal, { pane: "p-local", terminal: "t1", cwd: REPO, branch: "local-branch" }],
		focused: { pane: "github-detail", terminal: null },
	});
	expect(currentBranch()).toBe("local-branch");
	expect(execCalls()).toEqual([]);
});

test("focus moving from a terminal to a detail pane keeps the terminal's folder", () => {
	const panes = [
		{ pane: "p6f324caa2dac0202acbfa577db133312", terminal: "center/t19", cwd: REPO },
		{ pane: "p2", terminal: null, mod: "github", cwd: null },
	];
	screen({
		spaces: [SPACE],
		panes,
		focused: { pane: "p6f324caa2dac0202acbfa577db133312", terminal: "center/t19", cwd: REPO },
	});
	expect(location()).toEqual({ cwd: REPO, on: "center", space: SPACE.id });

	screen({ spaces: [SPACE], panes, focused: { pane: "p2", terminal: null, cwd: null } });
	expect(location()).toEqual({ cwd: REPO, on: "center", space: SPACE.id });
});
