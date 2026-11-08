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

/** Unfinished or failed: what holds back a merge that requires passing checks. */
export const checkHolds = (check: PullCheck): boolean => /fail|pending|queued|progress|error/i.test(check.status);
