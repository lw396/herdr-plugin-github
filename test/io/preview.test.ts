import { afterEach, expect, spyOn, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Previews } from "../../src/github/io/preview.ts";
import { execCalls, machine, reset } from "../fake-herdr.ts";

afterEach(() => {
	reset();
	Date.now = originalNow;
});
const originalNow = Date.now;
const ref = { kind: "pr", repo: "cli/cli", number: 14974 } as const;
const command = "~$ gh api repos/cli/cli/pulls/14974";
const reply = readFileSync(new URL("../fixtures/pull-cli-14974.json", import.meta.url), "utf8");

test("a hover reads only the PR summary on the repository machine, without comments or reviews", async () => {
	machine("center", { [command]: { stdout: reply } });
	const previews = new Previews();
	expect(await previews.load(ref, "center", "reviewer")).toEqual({
		title: "probe fork pr",
		author: "escaleraalcielo",
		createdAt: "2026-11-06T20:08:16Z",
		state: "closed",
		summary: "probe",
		labels: [
			{ name: "external", color: "#2700af" },
			{ name: "unmet-requirements", color: "#ee2329" },
		],
	});
	expect(execCalls()).toEqual([{ command: "gh", args: ["api", "repos/cli/cli/pulls/14974"], on: "center" }]);
});

test("repeated hovers reuse a minute-old cache, but another machine or account reads its own data", async () => {
	spyOn(Date, "now").mockReturnValue(1000);
	machine("center", { [command]: { stdout: reply } });
	machine(null, { [command]: { stdout: reply } });
	const previews = new Previews();
	await Promise.all([previews.load(ref, "center", "a"), previews.load(ref, "center", "a")]);
	await previews.load(ref, "center", "a");
	await previews.load({ ...ref, repo: "CLI/CLI" }, "center", "a");
	expect(previews.peek({ ...ref, repo: "CLI/CLI" }, "center", "a")?.title).toBe("probe fork pr");
	expect(execCalls()).toHaveLength(1);
	expect(previews.peek(ref, null, "a")).toBeUndefined();
	expect(previews.peek(ref, "center", "b")).toBeUndefined();
	await previews.load(ref, null, "a");
	await previews.load(ref, "center", "b");
	expect(execCalls()).toHaveLength(3);
	spyOn(Date, "now").mockReturnValue(61_000);
	await previews.load(ref, "center", "a");
	expect(execCalls()).toHaveLength(4);
});

test("failed remote hovers never fall back locally or cache the failure", async () => {
	machine("center", {});
	machine(null, { [command]: { stdout: reply } });
	const previews = new Previews();
	await expect(previews.load(ref, "center", "a")).rejects.toThrow("cannot start gh");
	expect(previews.peek(ref, "center", "a")).toBeUndefined();
	machine("center", { [command]: { stdout: reply } });
	expect((await previews.load(ref, "center", "a")).summary).toBe("probe");
	expect(execCalls().every((call) => call.on === "center")).toBe(true);
});

test("issue hover reads the issue endpoint and keeps its labels and creation date", async () => {
	machine("center", {
		"~$ gh api repos/lw396/herdr-plugin-github/issues/13": {
			stdout: readFileSync(new URL("../fixtures/issue-plugin-13.json", import.meta.url), "utf8"),
		},
	});
	const preview = await new Previews().load(
		{ kind: "issue", repo: "lw396/herdr-plugin-github", number: 13 },
		"center",
		"a",
	);
	expect(preview.title).toBe("issue 详情窗格（只读）");
	expect(preview.state).toBe("open");
	expect(preview.labels).toEqual([
		{ name: "wayfinder:task", color: "#0e8a16" },
		{ name: "ready-for-agent", color: "#006b75" },
	]);
});
