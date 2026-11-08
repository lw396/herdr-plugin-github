import { afterEach, expect, test } from "bun:test";
import { PullReader } from "../../../src/github/pulls/io/pulls.ts";
import { type Machine, machine, reset } from "../../fake-herdr.ts";
import { fixture, replies } from "./replies.ts";

afterEach(reset);
const sha = JSON.parse(fixture("pull-cli-14974.json")).head.sha;
const paths = [
	"pulls/14974",
	"issues/14974",
	"pulls/14974/reviews",
	"pulls/14974/comments",
	`commits/${sha}/check-runs`,
	`commits/${sha}/statuses`,
];
const auth = { "~$ gh api user --jq .login": { stdout: "reader\n" } };
function probes(etag: string | null, changed?: string): Machine {
	return Object.fromEntries(
		paths.map((path) => {
			const updated = !etag || path === changed;
			return [
				`~$ gh api repos/cli/cli/${path} --include${etag ? ` -H If-None-Match: ${etag}` : ""}`,
				updated
					? { stdout: 'HTTP/2.0 200 OK\r\nETag: "v1"\r\n\r\n{}' }
					: { stdout: "HTTP/2.0 304 Not Modified\r\n\r\n", code: 1 },
			];
		}),
	);
}
async function loaded(): Promise<PullReader> {
	const reader = new PullReader("cli/cli", 14974, "center");
	machine("center", { ...auth, ...replies(14974) });
	expect((await reader.refresh(true))?.title).toBe("probe fork pr");
	machine("center", { ...probes(null), ...replies(14974) });
	await reader.refresh();
	return reader;
}

test("unchanged PR resources keep the discussion without reading it or checking login again", async () => {
	const reader = await loaded();
	machine("center", probes('"v1"'));
	expect(await reader.refresh()).toBeNull();
});

for (const path of paths) {
	test(`a changed ${path} reloads even when every other PR resource is unchanged`, async () => {
		const reader = await loaded();
		machine("center", { ...probes('"v1"', path), ...replies(14974) });
		expect((await reader.refresh())?.state).toBe("closed");
	});
}

test("a failed discussion reload does not accept its probe validators", async () => {
	const reader = await loaded();
	machine("center", {
		...probes('"v1"', "pulls/14974/reviews"),
		...replies(14974),
		"~$ gh api repos/cli/cli/issues/14974/comments?per_page=100 --paginate --slurp": {
			code: 1,
			stderr: "gh: Not Found (HTTP 404)",
		},
	});
	await expect(reader.refresh()).rejects.toMatchObject({ notFound: true });
	machine("center", { ...probes(null), ...replies(14974) });
	expect((await reader.refresh())?.state).toBe("closed");
});

test("a superseded read cannot install its validators after a forced refresh", async () => {
	const reader = await loaded();
	let finish!: (reply: { stdout: string }) => void;
	const slow = new Promise<{ stdout: string }>((resolve) => {
		finish = resolve;
	});
	machine("center", {
		...probes('"v1"'),
		'~$ gh api repos/cli/cli/pulls/14974 --include -H If-None-Match: "v1"': slow,
	});
	const old = reader.refresh();
	machine("center", { ...auth, ...replies(14974) });
	expect((await reader.refresh(true))?.state).toBe("closed");
	finish({ stdout: 'HTTP/2.0 200 OK\r\nETag: "obsolete"\r\n\r\n{}' });
	expect(await old).toBeNull();
	machine("center", { ...probes(null), ...replies(14974) });
	expect((await reader.refresh())?.state).toBe("closed");
});

test("a changed head switches commit-check probes to the new SHA", async () => {
	const reader = await loaded();
	const next = "new-head";
	const raw = JSON.parse(fixture("pull-cli-14974.json"));
	const response = Object.fromEntries(
		Object.entries(replies(14974)).map(([key, value]) => [key.replace(sha, next), value]),
	);
	response["~$ gh api repos/cli/cli/pulls/14974"] = {
		stdout: JSON.stringify({ ...raw, head: { ...raw.head, sha: next } }),
	};
	machine("center", { ...auth, ...response });
	expect((await reader.refresh(true))?.headSha).toBe(next);
	const newProbes = Object.fromEntries(
		Object.entries(probes(null)).map(([key, value]) => [key.replace(sha, next), value]),
	);
	machine("center", { ...newProbes, ...response });
	expect((await reader.refresh())?.headSha).toBe(next);
});

test("hiding during a probe prevents the full read and does not accept its validators", async () => {
	const reader = await loaded();
	let visible = true;
	let finish!: (reply: { stdout: string }) => void;
	const slow = new Promise<{ stdout: string }>((resolve) => {
		finish = resolve;
	});
	machine("center", {
		...probes('"v1"'),
		'~$ gh api repos/cli/cli/pulls/14974 --include -H If-None-Match: "v1"': slow,
	});
	const hidden = reader.refresh(false, () => visible);
	visible = false;
	finish({ stdout: 'HTTP/2.0 200 OK\r\nETag: "hidden"\r\n\r\n{}' });
	expect(await hidden).toBeNull();
	machine("center", probes('"v1"'));
	expect(await reader.refresh()).toBeNull();
});
