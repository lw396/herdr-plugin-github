// Whether the sidebar is shown: core's rule fed Herdr's live layout.
import { layout } from "herdr";
import { layoutShows } from "../core/visibility.ts";

/** The layout block holding the sidebar (layouts/github.json; the tab bar selects it by this id). */
export const SIDEBAR_SLOT = "github";

export const sidebarVisible = (): boolean => layoutShows(layout(), SIDEBAR_SLOT);
