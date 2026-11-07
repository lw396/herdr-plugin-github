// The focused folder (GLOSSARY 焦点文件夹): where the focused terminal is, kept while focus
// is on a pane without a folder of its own, within the same space. Inputs are shaped like
// Herdr 0.1.13's spaces(), panes() and focused(); ids and addresses are real ones from `herdr-app status`.
import { describe, expect, test } from "bun:test";
import { focusedFolder, type Herdr } from "../../src/github/core/location.ts";

const LOCAL = { id: "sp1", active: true, folder: "/Users/lw/work", machine: null };
const CENTER = {
	id: "center/sp3870c5d8830571046adbca0cb0b3075d",
	active: true,
	folder: "/home/valian",
	machine: "center",
};

const terminalPane = (pane: string, cwd: string | null) => ({ pane, terminal: "t1", cwd });
const modPane = (pane: string, mod: string) => ({ pane, terminal: null, mod, cwd: null });

const focus = (f: Partial<NonNullable<Herdr["focused"]>>): Herdr["focused"] => ({
	pane: null,
	terminal: null,
	cwd: null,
	...f,
});

describe("focusedFolder", () => {
	test("a focused terminal pane: its folder, on its space's machine", () => {
		const herdr: Herdr = {
			spaces: [CENTER],
			panes: [terminalPane("p6f324caa2dac0202acbfa577db133312", "/home/valian/work/ai/herdr/herdr-plugin-github")],
			focused: focus({
				pane: "p6f324caa2dac0202acbfa577db133312",
				terminal: "center/t19",
				cwd: "/home/valian/work/ai/herdr/herdr-plugin-github",
			}),
		};
		expect(focusedFolder(herdr, null)).toEqual({
			cwd: "/home/valian/work/ai/herdr/herdr-plugin-github",
			on: "center",
			space: CENTER.id,
		});
	});

	test("a focused layout terminal block: focused().cwd, on the machine its address names", () => {
		// A block has no pane; its address says the machine ("center/t19"), whatever the shown space.
		const herdr: Herdr = {
			spaces: [LOCAL],
			panes: [],
			focused: focus({ terminal: "center/t19", cwd: "/home/valian/work/app" }),
		};
		expect(focusedFolder(herdr, null)).toEqual({ cwd: "/home/valian/work/app", on: "center", space: LOCAL.id });
	});

	test("a layout terminal block on this computer: no machine", () => {
		const herdr: Herdr = { spaces: [CENTER], panes: [], focused: focus({ terminal: "t7", cwd: "/Users/lw/work/app" }) };
		expect(focusedFolder(herdr, null)).toEqual({ cwd: "/Users/lw/work/app", on: null, space: CENTER.id });
	});

	const BEFORE = { cwd: "/Users/lw/work/herdr-plugin-github", on: null, space: LOCAL.id };

	test("a focused mod pane (a detail pane): the previous folder stays", () => {
		const herdr: Herdr = {
			spaces: [LOCAL],
			panes: [terminalPane("p1", "/Users/lw/work/other"), modPane("p2", "github")],
			focused: focus({ pane: "p2" }),
		};
		expect(focusedFolder(herdr, BEFORE)).toEqual(BEFORE);
	});

	test("focus on nothing with a folder (Files in the side panel): the previous folder stays", () => {
		const herdr: Herdr = { spaces: [LOCAL], panes: [], focused: focus({}) };
		expect(focusedFolder(herdr, BEFORE)).toEqual(BEFORE);
	});

	test("a layout terminal block that hasn't reported its folder yet: the previous folder stays", () => {
		const herdr: Herdr = { spaces: [LOCAL], panes: [], focused: focus({ terminal: "center/t19" }) };
		expect(focusedFolder(herdr, BEFORE)).toEqual(BEFORE);
	});

	test("another space shown, focus on a mod pane there: that space's folder, not the previous one", () => {
		const herdr: Herdr = {
			spaces: [{ ...LOCAL, active: false }, CENTER],
			panes: [modPane("p2", "github")],
			focused: focus({ pane: "p2" }),
		};
		expect(focusedFolder(herdr, BEFORE)).toEqual({ cwd: "/home/valian", on: "center", space: CENTER.id });
	});

	test("no previous folder (the sidebar opened on a mod pane): the shown space's folder, on its machine", () => {
		const herdr: Herdr = {
			spaces: [{ ...LOCAL, active: false }, CENTER],
			panes: [modPane("p2", "github")],
			focused: focus({ pane: "p2" }),
		};
		expect(focusedFolder(herdr, null)).toEqual({ cwd: "/home/valian", on: "center", space: CENTER.id });
	});

	test("no previous folder and no shown space: nowhere", () => {
		expect(focusedFolder({ spaces: [], panes: [], focused: null }, null)).toEqual({ cwd: null, on: null, space: null });
	});

	test("a terminal pane that hasn't reported its folder yet: the space's folder", () => {
		const herdr: Herdr = {
			spaces: [CENTER],
			panes: [terminalPane("p1", null)],
			focused: focus({ pane: "p1", terminal: "center/t1" }),
		};
		expect(focusedFolder(herdr, null)).toEqual({ cwd: "/home/valian", on: "center", space: CENTER.id });
	});

	test("back on a terminal in another repository: switches", () => {
		const herdr: Herdr = {
			spaces: [LOCAL],
			panes: [terminalPane("p1", "/Users/lw/work/other")],
			focused: focus({ pane: "p1", terminal: "t1", cwd: "/Users/lw/work/other" }),
		};
		expect(focusedFolder(herdr, BEFORE)).toEqual({ cwd: "/Users/lw/work/other", on: null, space: LOCAL.id });
	});
});
