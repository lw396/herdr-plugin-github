import { expect, test } from "bun:test";
import { itemWindow, scrollbar } from "../../src/github/core/viewport.ts";

test("windowing a large diff describes only visible rows plus a small overscan", () => {
	const sizes = Array(10000).fill(22);
	const result = itemWindow(sizes, 2200, 440);
	expect(result).toMatchObject({ start: 98, end: 122, top: 2156, offset: 2200, total: 220000 });
});

test("measured compact discussions replace estimates and clamp a formerly lower scroll position", () => {
	expect(itemWindow([22, 340, 22, 22], 300, 100).offset).toBe(300);
	expect(itemWindow([22, 120, 22, 22], 300, 100)).toMatchObject({ offset: 86, total: 186, start: 1, end: 4 });
	expect(itemWindow([22, 220, 22, 22], 300, 100)).toMatchObject({ offset: 186, total: 286 });
});

test("mixed code, editor and discussion heights remain reachable and clamp at either end", () => {
	const sizes = [22, 220, 22, 340, 22];
	expect(itemWindow(sizes, 240, 100)).toMatchObject({ start: 1, end: 4, top: 22, offset: 240, total: 626 });
	expect(itemWindow(sizes, -100, 100).offset).toBe(0);
	expect(itemWindow(sizes, 9999, 100)).toMatchObject({ start: 3, end: 5, top: 264, offset: 526 });
	expect(itemWindow([], 999, 100)).toEqual({ start: 0, end: 0, top: 0, offset: 0, total: 0 });
});

test("dragging the thumb from its top or bottom reaches either end, and its position maps back to the offset", () => {
	const bar = scrollbar(300, 1000, 200);
	expect(bar.offsetAt(bar.top)).toBeCloseTo(300);
	expect(bar.offsetAt(-50)).toBe(0);
	expect(bar.offsetAt(200)).toBe(800);
	expect(scrollbar(0, 100, 200)).toMatchObject({ max: 0, top: 0 });
	expect(scrollbar(0, 100, 200).offsetAt(50)).toBe(0);
});
