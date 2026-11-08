import { afterEach, expect, test } from "bun:test";
import { pullListChanges } from "../../../src/github/pulls/io/pulls.ts";
import { machine, reset } from "../../fake-herdr.ts";

afterEach(reset);
test("PR list polling uses the remote validator for changed and unchanged responses", async () => {
	const command = "~$ gh api repos/owner/repo/pulls?state=all&sort=updated&per_page=1 --include";
	machine("remote", { [command]: { stdout: 'HTTP/2.0 200 OK\r\nETag: W/"one"\r\n\r\n{}' } });
	expect(await pullListChanges("owner/repo", null, "remote")).toEqual({ changed: true, etag: 'W/"one"' });
	machine("remote", {
		[`${command} -H If-None-Match: W/"one"`]: { stdout: "HTTP/2.0 304 Not Modified\r\n\r\n", code: 1 },
	});
	expect(await pullListChanges("owner/repo", 'W/"one"', "remote")).toEqual({ changed: false });
});
