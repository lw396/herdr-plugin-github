// `gh api --include` prints an HTTP status line, headers, then the body.
export type Change = { changed: false } | { changed: true; etag: string | null };

export function responseHeaders(stdout: string): { status: number; etag: string | null } {
	const headers = stdout.split(/\r?\n\r?\n/, 1)[0] ?? "";
	return {
		status: Number(/^HTTP\/\S+\s+(\d+)/.exec(headers)?.[1]),
		etag: /^etag:\s*(.+)$/im.exec(headers)?.[1]?.trim() ?? null,
	};
}
