import type { Color } from "gpui-kit";
import type { PullState } from "../core/state.ts";

/** A PR state's Octicon, theme color and name, in the sidebar's rows and the PR page alike. */
export const PULL_STATES: Record<
	PullState,
	{ icon: string; color: (t: Record<string, Color>) => Color; label: string }
> = {
	open: { icon: "mods/github/assets/git-pull-request.svg", color: (t) => t.done, label: "Open" },
	draft: { icon: "mods/github/assets/git-pull-request-draft.svg", color: (t) => t.dim, label: "Draft" },
	merged: { icon: "mods/github/assets/git-merge.svg", color: (t) => t.ansi5, label: "Merged" },
	closed: { icon: "mods/github/assets/git-pull-request-closed.svg", color: (t) => t.blocked, label: "Closed" },
};
