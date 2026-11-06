// Where the person is working: the focused folder (GLOSSARY 焦点文件夹) and its machine.
// The rule is core/location.ts; this feeds it Herdr's live data and remembers the last answer,
// so focus on a pane without a folder (a detail pane, Files) keeps the current repository.
import { spaces, panes, focused } from "herdr";
import { focusedFolder } from "../core/location.js";
let previous = null;
export function location() {
    previous = focusedFolder({ spaces: spaces(), panes: panes(), focused: focused() }, previous);
    return previous;
}
/** A stable key for "the same place", to drop stale async results. */
export const locationKey = () => JSON.stringify(location());
