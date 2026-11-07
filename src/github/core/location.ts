// The focused folder (GLOSSARY 焦点文件夹) and its machine, from Herdr's live data.

/** A folder, the machine it is on (`on`: null for this computer), and the space shown then. */
export interface Location {
	cwd: string | null;
	on: string | null;
	space: string | null;
}

/** The parts of Herdr's spaces(), panes() and focused() the rule reads. */
export interface Herdr {
	spaces: { id: string; active: boolean; folder: string; machine: string | null }[];
	panes: { pane: string; terminal: string | null; mod?: string; cwd: string | null }[];
	focused: { pane: string | null; terminal: string | null; cwd: string | null } | null;
}

/**
 * Where the focused terminal is. When focus is on something without a folder of its own
 * (a mod pane such as a detail pane, the Files panel), the previous folder stays while the
 * same space is shown; otherwise the shown space's folder.
 */
export function focusedFolder(herdr: Herdr, previous: Location | null): Location {
	const space = herdr.spaces.find((s) => s.active),
		f = herdr.focused,
		id = space?.id ?? null;
	// A focused layout terminal block has no pane: its address says the machine ("center/t19").
	if (f && !f.pane && f.terminal && f.cwd) {
		return { cwd: f.cwd, on: f.terminal.includes("/") ? (f.terminal.split("/")[0] ?? null) : null, space: id };
	}
	const pane = f?.pane ? herdr.panes.find((p) => p.pane === f.pane) : null;
	if (pane?.terminal)
		return { cwd: pane.cwd || f?.cwd || space?.folder || null, on: space?.machine ?? null, space: id };
	if (previous && previous.space === id) return previous;
	return { cwd: space?.folder || null, on: space?.machine ?? null, space: id };
}
