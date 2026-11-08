// Where the person is working: the focused folder (GLOSSARY 焦点文件夹) and its machine. The rules are
// core's; this feeds them Herdr's live data and remembers the last folder, so focus on a pane without
// one (a detail pane, Files) keeps the current repository.
import { focused, panes, spaces } from "herdr";
import { focusedFolder, type Location } from "../core/location.ts";

let previous: Location | null = null;

export function location(): Location {
	previous = focusedFolder({ spaces: spaces(), panes: panes(), focused: focused() }, previous);
	return previous;
}
