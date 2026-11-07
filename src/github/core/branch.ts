import type { Herdr, Location } from "./location.ts";

/** Herdr already knows the branch. Match the kept folder and machine, never an unrelated space branch. */
export function folderBranch(herdr: Pick<Herdr, "panes" | "focused">, where: Location): string | null {
	if (!where.cwd) return null;
	const matching = herdr.panes.filter((p) => {
		if (!p.terminal || p.cwd !== where.cwd) return false;
		const on = p.terminal.includes("/") ? p.terminal.split("/")[0] : null;
		return on === where.on;
	});
	const pane =
		matching.find((p) => p.pane === herdr.focused?.pane || p.terminal === herdr.focused?.terminal) ?? matching[0];
	return pane?.branch || null;
}
