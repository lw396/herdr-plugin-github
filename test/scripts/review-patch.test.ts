import { afterEach, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const temporary: string[] = [];
afterEach(() => {
	for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});
function repository() {
	const home = mkdtempSync(join(tmpdir(), "github-review-test-"));
	temporary.push(home);
	const cwd = join(home, "repo");
	mkdirSync(join(cwd, "scripts"), { recursive: true });
	copyFileSync(new URL("../../scripts/review-patch.sh", import.meta.url), join(cwd, "scripts/review-patch.sh"));
	const run = (...args: string[]) => Bun.spawnSync(args, { cwd });
	run("git", "init", "-q");
	writeFileSync(join(cwd, "tracked.txt"), "original\n");
	run("git", "add", ".");
	const committed = run(
		"git",
		"-c",
		"user.name=Test",
		"-c",
		"user.email=test@example.com",
		"commit",
		"-qm",
		"baseline",
	);
	expect(committed.exitCode).toBe(0);
	const output = join(home, "review.patch");
	return { cwd, output, run };
}

test("the review artifact includes staged, unstaged and new files, but not generated output", () => {
	const { cwd, output, run } = repository();
	writeFileSync(join(cwd, "tracked.txt"), "staged\n");
	run("git", "add", "tracked.txt");
	writeFileSync(join(cwd, "tracked.txt"), "staged\nunstaged\n");
	writeFileSync(join(cwd, "new file.txt"), "new source\n");
	mkdirSync(join(cwd, "mods/github"), { recursive: true });
	writeFileSync(join(cwd, "mods/github/main.js"), "generated\n");
	writeFileSync(join(cwd, "bun.lock"), "lockfile\n");
	const result = run("sh", "scripts/review-patch.sh", "HEAD", output);
	expect(result.exitCode).toBe(0);
	const patch = readFileSync(output, "utf8");
	expect(patch).toContain("+staged\n+unstaged");
	expect(patch).toContain("+new source");
	expect(patch).not.toContain("+generated");
	expect(patch).not.toContain("+lockfile");
});

test("an empty change is rejected instead of giving reviewers an empty artifact", () => {
	const { output, run } = repository();
	const result = run("sh", "scripts/review-patch.sh", "HEAD", output);
	expect(result.exitCode).toBe(1);
	expect(result.stderr.toString()).toContain("empty diff");
});
