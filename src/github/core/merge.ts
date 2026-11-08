import { checkHolds, type PullCheck } from "./checks.ts";
import type { Reviewer } from "./reviewers.ts";

export type MergeMethod = "merge" | "squash" | "rebase";
export interface MergeInfo {
	methods: MergeMethod[];
	reason: string | null;
	sha: string;
	headRepo: string | null;
	headRef: string;
	deletable: boolean;
}

export interface RestMergePull {
	mergeable?: boolean | null;
	mergeable_state?: string;
	draft?: boolean;
	state: string;
	merged?: boolean;
	head: { sha: string; ref: string; repo: { full_name: string; default_branch: string } | null };
}

const CHECKS = "Checks have not passed";
const BLOCKED = "Merging is blocked by branch protection rules (required checks or reviews)";
const CHECKING = "Checking mergeability…";
const REASONS: Record<string, string> = {
	dirty: "This branch has conflicts that must be resolved",
	behind: "This branch is out-of-date with the base branch",
	unknown: CHECKING,
	unstable: CHECKS,
};

/** Branch protection does not say which rule blocks: name the reviews and checks that can. */
function blockers(reviewers: Reviewer[], checks: PullCheck[]): string[] {
	return [
		reviewers.some((r) => r.state === "changes_requested") && "Changes requested",
		reviewers.some((r) => r.state === "requested") && "Review required",
		checks.some(checkHolds) && CHECKS,
	].filter((x): x is string => Boolean(x));
}

function reason(p: RestMergePull, methods: MergeMethod[], reviewers: Reviewer[], checks: PullCheck[]): string | null {
	if (p.merged) return "Pull request successfully merged";
	if (p.state !== "open") return "Pull request is closed";
	if (p.draft) return "This pull request is still a draft";
	const state = p.mergeable_state ?? "unknown";
	if (p.mergeable === true && (state === "clean" || state === "has_hooks"))
		return methods.length === 0 ? "No merge methods are enabled" : null;
	if (state === "blocked") {
		const causes = blockers(reviewers, checks);
		return causes.length ? `${BLOCKED}: ${causes.join("; ")}` : BLOCKED;
	}
	return REASONS[state] ?? (p.mergeable === true ? `Merging is blocked: ${state}` : CHECKING);
}

/** `repository` carries which merge methods it allows (`allow_<method>_merge`). */
export function mergeInfo(
	p: RestMergePull,
	repository: Record<string, unknown>,
	reviewers: Reviewer[] = [],
	checks: PullCheck[] = [],
): MergeInfo {
	const methods = (["merge", "squash", "rebase"] as MergeMethod[]).filter(
		(m) => repository[`allow_${m}_merge`] === true,
	);
	return {
		methods,
		reason: reason(p, methods, reviewers, checks),
		sha: p.head.sha,
		headRepo: p.head.repo?.full_name ?? null,
		headRef: p.head.ref,
		deletable: Boolean(p.merged && p.head.repo && p.head.ref !== p.head.repo.default_branch),
	};
}
