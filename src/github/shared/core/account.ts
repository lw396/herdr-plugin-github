import { explain } from "./gh.ts";

export type Status = { ok: true; user: string } | { ok: false; reason: "missing" | "auth" | "error"; message: string };

/** Which gh to talk to GitHub with: `on` is the folder's machine (null: this computer). */
export interface Account {
	on: string | null;
	status: Status;
}

/** The footer's short word for a gh that cannot be used; describeAccount says what to do about it. */
export const ACCOUNT_PROBLEM: Record<Extract<Status, { ok: false }>["reason"], string> = {
	missing: "gh is not installed",
	auth: "Not signed in to gh",
	error: "gh is not working",
};

export function describeAccount({ on, status }: Account): string {
	if (status.ok) return `signed in as ${status.user}${on ? ` on ${on}` : ""}`;
	const machine = on ?? "this computer",
		there = on ? ` on ${on}` : "";
	if (status.reason === "missing")
		return `gh is not installed on ${machine}: install it${on ? " there" : ""}, then run gh auth login${there}`;
	if (status.reason === "auth") return `not signed in on ${machine}: run gh auth login${there}`;
	return `gh on ${machine}: ${explain(status.message)}`;
}
