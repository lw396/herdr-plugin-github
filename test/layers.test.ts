// What each folder of src/github may import (AGENTS.md "Change rules", ADR 0008).
// Feature folders first, then layers: each feature folder holds core/, io/ and views/;
// roles/ assembles them. A feature imports only its own level or lower ones.
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const SRC = join(import.meta.dir, "../src/github");

/** Lower levels first; siblings on one level never import each other. */
const LEVELS: Record<string, number> = {
	shared: 0,
	detail: 1,
	sidebar: 2,
	issues: 3,
	pulls: 3,
	roles: 4,
	"main.ts": 5,
};

interface Import {
	file: string;
	from: string;
	/** Relative imports: the target, relative to src/github. */
	target: string | null;
}

const sources = readdirSync(SRC, { recursive: true, encoding: "utf8" })
	.filter((f) => f.endsWith(".ts"))
	.map((f) => f.split("\\").join("/"));

const imports: Import[] = sources.flatMap((file) =>
	[
		...readFileSync(join(SRC, file), "utf8").matchAll(
			/(?:^|\n)\s*(import|export)\b(\s+type\b)?[^"']*?from\s*["']([^"']+)["']|\bimport\(?\s*["']([^"']+)["']/g,
		),
	].map((m) => {
		const from = (m[3] ?? m[4])!;
		const target = from.startsWith(".") ? relative(SRC, resolve(SRC, dirname(file), from)) : null;
		return { file, from, target };
	}),
);

const feature = (path: string): string => path.split("/")[0]!;
const layer = (path: string): string | undefined => path.split("/")[1];

test("every source file is in a known feature folder, under core/, io/ or views/ (roles/ and main.ts excepted)", () => {
	expect(
		sources.filter((f) => {
			if (f === "main.ts" || f === "runtime.d.ts") return false;
			if (feature(f) === "roles") return f.split("/").length !== 2;
			return !(feature(f) in LEVELS) || !["core", "io", "views"].includes(layer(f) ?? "");
		}),
	).toEqual([]);
});

test("core/ imports only core/, and only the Markdown module imports the approved pure parsers", () => {
	const parsers = new Set(["mdast-util-from-markdown", "htmlparser2", "mdast"]); // mdast is type-only.
	expect(
		imports.filter(
			({ file, from, target }) =>
				layer(file) === "core" &&
				(target ? layer(target) !== "core" : !(file === "detail/core/markdown.ts" && parsers.has(from))),
		),
	).toEqual([]);
});

test("io/ reaches Herdr and core/, never the UI", () => {
	expect(
		imports.filter(
			({ file, from, target }) =>
				layer(file) === "io" &&
				(from.startsWith("gpui") ||
					(target !== null && (layer(target) === "views" || feature(target) === "roles" || target === "main.ts"))),
		),
	).toEqual([]);
});

test("a feature imports only its own level or lower ones, never a sibling", () => {
	const wrong = imports.filter(({ file, target }) => {
		if (!target) return false;
		const a = feature(file),
			b = feature(target);
		return a !== b && LEVELS[b]! >= LEVELS[a]!;
	});
	expect(wrong.map(({ file, target }) => `${file} -> ${target}`)).toEqual([]);
});
