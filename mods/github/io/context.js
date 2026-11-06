// Where the person is working: the focused pane's folder, and the machine it is on.
// Same rule as Herdr's shipped `changes` and `files` mods.
import { spaces, panes, focused } from "herdr";
export function location() {
    const space = spaces().find((s) => s.active), f = focused();
    const pane = f?.pane ? panes().find((p) => p.pane === f.pane) : null;
    // A focused layout terminal block has no pane: its address says the machine ("vps/t7").
    const on = f?.pane === null ? (f.terminal?.includes("/") ? f.terminal.split("/")[0] ?? null : null) : space?.machine ?? null;
    return { cwd: pane?.cwd || f?.cwd || space?.folder || null, on, space: space?.id ?? null };
}
/** A stable key for "the same place", to drop stale async results. */
export const locationKey = () => JSON.stringify(location());
