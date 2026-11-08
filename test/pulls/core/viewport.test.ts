import { expect, test } from "bun:test";
import { itemWindow, scrollbar } from "../../../src/github/pulls/core/viewport.ts";

/** The drawn items cover the viewport, and the first of them starts at `top`. */
function expectCovers(sizes: number[], requested: number, height: number) {
	const w = itemWindow(sizes, requested, height);
	const start = sizes.slice(0, w.start).reduce((a, b) => a + b, 0);
	const end = start + sizes.slice(w.start, w.end).reduce((a, b) => a + b, 0);
	expect(w.top).toBe(start);
	expect(start).toBeLessThanOrEqual(w.offset);
	expect(end).toBeGreaterThanOrEqual(Math.min(w.offset + height, w.total));
	return w;
}

test("a large diff draws only the items around the viewport", () => {
	const sizes = Array(10000).fill(22);
	const w = expectCovers(sizes, 2200, 440);
	expect(w).toMatchObject({ offset: 2200, total: 220000 });
	expect(w.end - w.start).toBeLessThan(40);
});

test("mixed code, editor and discussion heights stay covered anywhere, and the offset clamps at either end", () => {
	const sizes = [22, 220, 22, 340, 22];
	for (const offset of [0, 21, 22, 240, 400, 526]) expectCovers(sizes, offset, 100);
	expect(itemWindow(sizes, -100, 100).offset).toBe(0);
	expect(itemWindow(sizes, 9999, 100).offset).toBe(526);
	expect(itemWindow([], 999, 100)).toEqual({ start: 0, end: 0, top: 0, offset: 0, total: 0 });
});

test("a measured card shorter than its estimate pulls a formerly lower scroll position back inside", () => {
	expect(itemWindow([22, 340, 22, 22], 300, 100).offset).toBe(300);
	expect(expectCovers([22, 120, 22, 22], 300, 100).offset).toBe(86);
});

test("dragging the thumb from its top or bottom reaches either end, and its position maps back to the offset", () => {
	const bar = scrollbar(300, 1000, 200);
	expect(bar.offsetAt(bar.top)).toBeCloseTo(300);
	expect(bar.offsetAt(-50)).toBe(0);
	expect(bar.offsetAt(200)).toBe(800);
	expect(scrollbar(0, 100, 200)).toMatchObject({ max: 0, top: 0 });
	expect(scrollbar(0, 100, 200).offsetAt(50)).toBe(0);
});
