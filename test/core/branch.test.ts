import { expect, test } from "bun:test";
import { folderBranch } from "../../src/github/core/branch.ts";

const where = { cwd: "/work/app", on: "center", space: "center/s1" };
const terminal = { pane: "center/p1", terminal: "center/t1", cwd: "/work/app", branch: "feat/issues" };

test("other folders and machines never supply the current branch", () => {
	const panes = [
		{ ...terminal, pane: "p-local", terminal: "t1", branch: "local-only" },
		{ ...terminal, cwd: "/work/another-repo", branch: "other-repo" },
	];
	expect(folderBranch({ panes, focused: null }, where)).toBeNull();
	expect(folderBranch({ panes: [...panes, terminal], focused: null }, where)).toBe("feat/issues");
});

test("a non-git folder or missing branch metadata has no card; a layout terminal can use its model pane", () => {
	const focused = { pane: null, terminal: terminal.terminal, cwd: where.cwd };
	expect(folderBranch({ panes: [{ ...terminal, branch: null }], focused }, where)).toBeNull();
	expect(folderBranch({ panes: [], focused }, where)).toBeNull();
	expect(folderBranch({ panes: [terminal], focused }, where)).toBe("feat/issues");
});

test("the current folder gets its branch from Herdr, including when focus moves to a mod", () => {
	const panes = [terminal, { pane: "center/p2", terminal: null, cwd: null, branch: null }];
	expect(
		folderBranch({ panes, focused: { pane: terminal.pane, terminal: terminal.terminal, cwd: where.cwd } }, where),
	).toBe("feat/issues");
	expect(folderBranch({ panes, focused: { pane: "center/p2", terminal: null, cwd: null } }, where)).toBe("feat/issues");
});
