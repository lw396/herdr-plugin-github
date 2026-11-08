// What each folder of src/github may import (AGENTS.md "Source and output").
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "../src/github");

function imports(folder: string): { file: string; from: string }[] {
	return readdirSync(join(SRC, folder), { recursive: true, encoding: "utf8" })
		.filter((f) => f.endsWith(".ts"))
		.flatMap((f) =>
			[
				...readFileSync(join(SRC, folder, f), "utf8").matchAll(
					/(?:^|\n)\s*(?:import|export)\b[^"']*?from\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']/g,
				),
			].map((m) => ({ file: `${folder}/${f}`, from: (m[1] ?? m[2])! })),
		);
}

test("core/ imports only core/ and the Markdown module's approved pure parsers", () => {
	const parsers = new Set(["mdast-util-from-markdown", "htmlparser2", "mdast"]); // mdast is type-only.
	expect(
		imports("core").filter(
			({ file, from }) => !from.startsWith("./") && !(file === "core/markdown.ts" && parsers.has(from)),
		),
	).toEqual([]);
});

test("io/ reaches Herdr and core/, never the UI", () => {
	expect(
		imports("io").filter(({ from }) => from.startsWith("gpui") || from.includes("views/") || from === "../main.ts"),
	).toEqual([]);
});
