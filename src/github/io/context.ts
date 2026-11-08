// Where the person is working: the focused folder (GLOSSARY 焦点文件夹) and its machine, and whether
// the sidebar is shown. The rules are core's; this feeds them Herdr's live data and remembers the last
// folder, so focus on a pane without one (a detail pane, Files) keeps the current repository.
import { focused, layout, panes, spaces } from "herdr";
import { focusedFolder, type Location } from "../core/location.ts";
import { layoutShows } from "../core/visibility.ts";

let previous: Location | null = null;

export function location(): Location {
	previous = focusedFolder({ spaces: spaces(), panes: panes(), focused: focused() }, previous);
	return previous;
}

/** The layout block holding the sidebar (layouts/github.json; the tab bar selects it by this id). */
export const SIDEBAR_SLOT = "github";

export const sidebarVisible = (): boolean => layoutShows(layout(), SIDEBAR_SLOT);
