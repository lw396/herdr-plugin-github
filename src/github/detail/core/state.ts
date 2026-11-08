export type PullState = "open" | "draft" | "merged" | "closed";

/** Draft styling applies only to open PRs; merged and closed always take precedence. */
export function pullState(state: Exclude<PullState, "draft">, draft: boolean): PullState {
	return state === "open" && draft ? "draft" : state;
}
