import { layout } from "herdr";
import { layoutShows } from "../core/visibility.ts";

/** The included layout and tab bar name the GitHub sidebar slot `github`. */
export const sidebarVisible = (): boolean => layoutShows(layout(), "github");
