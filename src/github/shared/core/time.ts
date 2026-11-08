// Times as the sidebar shows them.

const MINUTE = 60_000,
	HOUR = 60 * MINUTE,
	DAY = 24 * HOUR;

/** How long ago `iso` was at `now` (ms), short: now, 45m, 2h, 3d, 3mo, 2y. */
export function relativeTime(iso: string, now: number): string {
	const ago = now - Date.parse(iso);
	if (ago < MINUTE) return "now";
	if (ago < HOUR) return `${Math.floor(ago / MINUTE)}m`;
	if (ago < DAY) return `${Math.floor(ago / HOUR)}h`;
	if (ago < 30 * DAY) return `${Math.floor(ago / DAY)}d`;
	if (ago < 365 * DAY) return `${Math.floor(ago / (30 * DAY))}mo`;
	return `${Math.floor(ago / (365 * DAY))}y`;
}
