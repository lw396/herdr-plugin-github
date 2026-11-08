// A PR head commit's check runs and commit statuses, as the description page lists them.
export interface PullCheck {
	id: string;
	name: string;
	/** A check run's conclusion or status, or a commit status's state, as GitHub words it. */
	status: string;
	duration: string;
	url: string;
}

interface CheckRun {
	id: number;
	name: string;
	status: string;
	conclusion: string | null;
	started_at: string | null;
	completed_at: string | null;
	html_url: string;
}
interface Status {
	id: number;
	context: string;
	state: string;
	target_url: string | null;
}

/** Check-run pages are objects, not arrays; statuses list the newest first for each context. */
export function parseChecks(pages: unknown, statuses: unknown[]): PullCheck[] {
	const checks = (Array.isArray(pages) ? pages : [pages])
		.flatMap((p) => (p as { check_runs: CheckRun[] }).check_runs)
		.map((c) => {
			const seconds =
				c.started_at && c.completed_at
					? Math.max(0, Math.floor((Date.parse(c.completed_at) - Date.parse(c.started_at)) / 1000))
					: null;
			return {
				id: `check-${c.id}`,
				name: c.name,
				status: c.conclusion ?? c.status,
				duration: seconds === null ? "—" : `${Math.floor(seconds / 60)}m ${seconds % 60}s`,
				url: c.html_url,
			};
		});
	const seen = new Set<string>();
	for (const s of statuses as Status[]) {
		if (seen.has(s.context)) continue;
		seen.add(s.context);
		checks.push({ id: `status-${s.id}`, name: s.context, status: s.state, duration: "—", url: s.target_url ?? "" });
	}
	return checks;
}

/** Compact status-card heading; each check keeps its detail in the expandable list. */
export function checkSummary(checks: Pick<PullCheck, "status">[]): {
	label: string;
	tone: "done" | "dim" | "blocked" | "working";
	icon: string;
} {
	if (!checks.length) return { label: "No checks reported", tone: "dim", icon: "○" };
	const counts = { failed: 0, pending: 0, successful: 0, other: 0 };
	for (const { status } of checks) {
		if (/^(failure|error|timed_out|cancelled|action_required|startup_failure|stale)$/.test(status)) counts.failed++;
		else if (/^(pending|queued|in_progress|waiting|requested)$/.test(status)) counts.pending++;
		else if (status === "success") counts.successful++;
		else counts.other++;
	}
	const label = (Object.entries(counts) as [keyof typeof counts, number][])
		.filter(([, count]) => count > 0)
		.map(([kind, count]) => `${count} ${kind} check${count === 1 ? "" : "s"}`)
		.join(", ");
	return {
		label,
		tone: counts.failed ? "blocked" : counts.pending ? "working" : counts.other ? "dim" : "done",
		icon: counts.failed ? "×" : counts.pending || counts.other ? "○" : "✓",
	};
}

/** Unfinished or failed: what holds back a merge that requires passing checks. */
export const checkHolds = (check: PullCheck): boolean => /fail|pending|queued|progress|error/i.test(check.status);
