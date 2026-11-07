// What a detail pane shows: one issue or one PR of a repository.

export type DetailKind = "issue" | "pr";

export interface DetailRef {
	kind: DetailKind;
	repo: string;
	number: number;
}

/** Identifies the object across views; an issue's key predates PRs and is kept for saved tab identities. */
export const detailKey = (ref: DetailRef): string =>
	`${ref.repo.toLowerCase()}${ref.kind === "pr" ? "/pull/" : "#"}${ref.number}`;

/** Keep native tabs compact; the full repository remains visible in the reader's link tooltip. */
export const detailTabName = (ref: { repo: string; number: number }): string =>
	`#${ref.number} · ${ref.repo.split("/").at(-1)}`;
