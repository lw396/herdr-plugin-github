import { afterEach, expect, test } from "bun:test";
import { pullChanges, pullListChanges } from "../../src/github/io/pulls.ts";
import { machine, reset } from "../fake-herdr.ts";

afterEach(reset);
for (const [name, path, read] of [
	[
		"list",
		"pulls?state=all&sort=updated&per_page=1",
		(tag: string | null) => pullListChanges("owner/repo", tag, "remote"),
	],
	["detail", "pulls/12", (tag: string | null) => pullChanges("owner/repo", 12, tag, "remote")],
] as const) {
	test(`${name}: changed and unchanged responses use the remote validator`, async () => {
		const command = `~$ gh api repos/owner/repo/${path} --include`;
		machine("remote", { [command]: { stdout: 'HTTP/2.0 200 OK\r\nETag: W/"one"\r\n\r\n{}' } });
		expect(await read(null)).toEqual({ changed: true, etag: 'W/"one"' });
		machine("remote", {
			[`${command} -H If-None-Match: W/"one"`]: { stdout: "HTTP/2.0 304 Not Modified\r\n\r\n", code: 1 },
		});
		expect(await read('W/"one"')).toEqual({ changed: false });
	});
}
