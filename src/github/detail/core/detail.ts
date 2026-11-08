export type DetailKind = "issue" | "pr";

export interface DetailRef {
	kind: DetailKind;
	repo: string;
	number: number;
}

/** Identifies the object across views; an issue's key predates PRs and is kept for saved tab identities. */
export const detailKey = (ref: DetailRef): string =>
	`${ref.repo.toLowerCase()}${ref.kind === "pr" ? "/pull/" : "#"}${ref.number}`;

/** Session-only navigation; issue and PR links share one history inside a native tab. */
export class DetailNavigation {
	ref: DetailRef | null = null;
	private history: DetailRef[] = [];

	get previous(): DetailRef | null {
		return this.history.at(-1) ?? null;
	}

	open(ref: DetailRef): boolean {
		if (this.ref && detailKey(this.ref) === detailKey(ref)) return false;
		this.history = [];
		this.ref = ref;
		return true;
	}

	follow(ref: DetailRef): boolean {
		if (this.ref && detailKey(this.ref) === detailKey(ref)) return false;
		if (this.ref) this.history.push(this.ref);
		this.ref = ref;
		return true;
	}

	back(): DetailRef | null {
		const previous = this.history.pop();
		if (!previous) return null;
		this.ref = previous;
		return previous;
	}
}

/** `owner/name` as GraphQL's repository(owner:, name:) arguments. */
export function ownerName(repo: string): { owner: string; name: string } {
	const [owner = "", name = ""] = repo.split("/");
	return { owner, name };
}

/** Keep native tabs compact; the full repository remains visible in the reader's link tooltip. */
export const detailTabName = (ref: DetailRef): string => `#${ref.number} · ${ref.repo.split("/").at(-1)}`;

/** Its page on github.com, before GitHub has answered with its own. */
export const detailUrl = (ref: DetailRef): string =>
	`https://github.com/${ref.repo}/${ref.kind === "pr" ? "pull" : "issues"}/${ref.number}`;

export const notVisible = (ref: DetailRef): string =>
	`${ref.repo} #${ref.number} isn't on GitHub, or this account can't see it.`;
