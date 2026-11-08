// Pixel windowing for rows that must register interactive handlers in the ordinary render snapshot.
export function itemWindow(sizes: number[], requested: number, height: number) {
	const total = sizes.reduce((sum, size) => sum + size, 0);
	const offset = Math.max(0, Math.min(requested, Math.max(0, total - height)));
	const from = Math.max(0, offset - 44);
	const to = offset + height + 44;
	let start = 0,
		top = 0;
	while (start < sizes.length && top + sizes[start]! <= from) top += sizes[start++]!;
	let end = start,
		bottom = top;
	while (end < sizes.length && bottom < to) bottom += sizes[end++]!;
	return { start, end, top, offset, total };
}
