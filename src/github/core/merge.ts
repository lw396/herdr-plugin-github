export type MergeMethod = "merge" | "squash" | "rebase";
export interface MergeInfo {
	methods: MergeMethod[];
	reason: string | null;
	sha: string;
	headRepo: string | null;
	headRef: string;
	deletable: boolean;
}
export function mergeInfo(
	p: {
		mergeable?: boolean | null;
		mergeable_state?: string;
		draft?: boolean;
		state: string;
		merged?: boolean;
		head: { sha: string; ref: string; repo: { full_name: string; default_branch: string } | null };
	},
	r: Record<string, unknown>,
): MergeInfo {
	const methods = (["merge", "squash", "rebase"] as MergeMethod[]).filter((m) => r[`allow_${m}_merge`] === true);
	const reasons: Record<string, string> = {
		dirty: "This branch has conflicts that must be resolved",
		blocked: "Merging is blocked by branch protection rules (required checks or reviews)",
		behind: "This branch is out-of-date with the base branch",
		unknown: "Checking mergeability…",
		unstable: "Checks have not passed",
	};
	const reason = p.merged
		? "Pull request successfully merged"
		: p.state !== "open"
			? "Pull request is closed"
			: p.draft
				? "This pull request is still a draft"
				: p.mergeable !== true
					? (reasons[p.mergeable_state ?? "unknown"] ?? "Checking mergeability…")
					: p.mergeable_state !== "clean" && p.mergeable_state !== "has_hooks"
						? (reasons[p.mergeable_state ?? "unknown"] ?? `Merging is blocked: ${p.mergeable_state}`)
						: methods.length === 0
							? "No merge methods are enabled"
							: null;
	return {
		methods,
		reason,
		sha: p.head.sha,
		headRepo: p.head.repo?.full_name ?? null,
		headRef: p.head.ref,
		deletable: Boolean(p.merged && p.head.repo && p.head.ref !== p.head.repo.default_branch),
	};
}
