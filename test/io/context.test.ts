// context.ts through the fake Herdr screen: the focused folder follows focus as it moves.
import { afterEach, expect, test } from "bun:test";
import { reset, screen } from "../fake-herdr.ts";
import { location } from "../../src/github/io/context.ts";

afterEach(reset);

const SPACE = { id: "center/sp3870c5d8830571046adbca0cb0b3075d", active: true, folder: "/home/valian", machine: "center" };
const REPO = "/home/valian/work/ai/herdr/herdr-plugin-github";

test("focus moving from a terminal to a detail pane keeps the terminal's folder", () => {
  const panes = [
    { pane: "p6f324caa2dac0202acbfa577db133312", terminal: "center/t19", cwd: REPO },
    { pane: "p2", terminal: null, mod: "github", cwd: null },
  ];
  screen({ spaces: [SPACE], panes, focused: { pane: "p6f324caa2dac0202acbfa577db133312", terminal: "center/t19", cwd: REPO } });
  expect(location()).toEqual({ cwd: REPO, on: "center", space: SPACE.id });

  screen({ spaces: [SPACE], panes, focused: { pane: "p2", terminal: null, cwd: null } });
  expect(location()).toEqual({ cwd: REPO, on: "center", space: SPACE.id });
});
