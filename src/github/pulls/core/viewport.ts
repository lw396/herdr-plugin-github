// Pixel windowing for rows that must register interactive handlers in the ordinary render snapshot.

export const clampOffset = (offset: number, total: number, height: number): number =>
	Math.max(0, Math.min(offset, Math.max(0, total - height)));

/** The items to draw, with a little overscan, and where the first of them starts. */
export function itemWindow(sizes: number[], requested: number, height: number) {
	const total = sizes.reduce((sum, size) => sum + size, 0);
	const offset = clampOffset(requested, total, height);
	const from = Math.max(0, offset - 44);
	const to = offset + height + 44;
	let start = 0,
		top = 0;
	while (start < sizes.length && top + (sizes[start] ?? 0) <= from) top += sizes[start++] ?? 0;
	let end = start,
		bottom = top;
	while (end < sizes.length && bottom < to) bottom += sizes[end++] ?? 0;
	return { start, end, top, offset, total };
}

/** A scrollbar's thumb, and the offset a thumb position stands for. */
export function scrollbar(offset: number, total: number, height: number) {
	const max = Math.max(0, total - height);
	const thumb = Math.min(height, Math.max(28, height ** 2 / Math.max(1, total)));
	const travel = height - thumb;
	return {
		max,
		thumb,
		top: max > 0 ? (offset / max) * travel : 0,
		offsetAt: (y: number): number => (travel > 0 ? clampOffset((y / travel) * max, total, height) : 0),
	};
}
