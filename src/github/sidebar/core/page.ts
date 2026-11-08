/** Rows per page: the first page, and each Load more. */
export const PAGE = 30;

export interface Page<R> {
	total: number;
	more: boolean;
	cursor: string | null;
	rows: R[];
}

/**
 * The loaded rows followed by the next page's (Load more); total, more and cursor from the page.
 * A row updated between the loads can come again: it stays where it was, once.
 */
export function appendPage<R extends { number: number }, P extends Page<R>>(group: P, page: P): P {
	const shown = new Set(group.rows.map((r) => r.number));
	return { ...page, rows: [...group.rows, ...page.rows.filter((r) => !shown.has(r.number))] };
}
