// What each folder of src/github may import (AGENTS.md "Source and output").
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(import.meta.dir, "../src/github");

function imports(folder: string): { file: string; from: string }[] {
  return readdirSync(join(SRC, folder), { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(".ts"))
    .flatMap((f) => [...readFileSync(join(SRC, folder, f), "utf8").matchAll(/(?:^|\n)\s*(?:import|export)\b[^"']*?from\s*["']([^"']+)["']/g)]
      .map((m) => ({ file: `${folder}/${f}`, from: m[1]! })));
}

test("core/ is pure: it imports only core/", () => {
  expect(imports("core").filter(({ from }) => !from.startsWith("./"))).toEqual([]);
});

test("io/ reaches Herdr and core/, never the UI", () => {
  expect(imports("io").filter(({ from }) => from.startsWith("gpui") || from.includes("views/") || from === "../main.ts")).toEqual([]);
});
