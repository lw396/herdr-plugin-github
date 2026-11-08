// The small session-cached excerpt shown while hovering an issue or PR row.
import { type DetailKind, type DetailRef, detailKey } from "../../detail/core/detail.ts";
import { type Label, parseLabel } from "../../detail/core/labels.ts";
import { markdownSummary } from "../../detail/core/markdown.ts";
import { type PullState, pullState } from "../../detail/core/state.ts";

/** Fetch a little before the native card opens; slow remote machines can still show a loading state. */
export const PREVIEW_DWELL_MS = 200;
export const PREVIEW_OPEN_MS = 500;
export const PREVIEW_CLOSE_MS = 200;

/** The same identity scopes cached data, errors and native card state. */
export function previewKey(ref: DetailRef, on: string | null, login: string): string {
	return JSON.stringify([on, login, detailKey(ref)]);
}

/** A row can revoke only its own intent; re-entering creates a fresh request ticket. */
export class PreviewIntent {
	private active: { row: string } | null = null;

	enter(row: string): { row: string } {
		this.active = { row };
		return this.active;
	}

	leave(row: string): boolean {
		if (this.active?.row !== row) return false;
		this.active = null;
		return true;
	}

	current(ticket: { row: string }): boolean {
		return this.active === ticket;
	}
}

export interface Preview {
	title: string;
	author: string | null;
	createdAt: string;
	state: PullState;
	summary: string;
	labels: Label[];
}

/** The common REST issue / pull fields; no timeline, checks, comments or reviews are requested. */
export function parsePreview(data: unknown, kind: DetailKind): Preview {
	const item = data as {
		title: string;
		user: { login: string } | null;
		created_at: string;
		state: "open" | "closed";
		merged_at?: string | null;
		draft?: boolean;
		body: string | null;
		labels: (string | { name: string; color?: string })[];
	};
	const state = kind === "pr" ? pullState(item.merged_at ? "merged" : item.state, item.draft ?? false) : item.state;
	return {
		title: item.title,
		author: item.user?.login ?? null,
		createdAt: item.created_at,
		state,
		summary: markdownSummary(item.body ?? ""),
		labels: item.labels.map(parseLabel),
	};
}
