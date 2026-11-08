// What the sidebar says about the gh on the folder's machine (ADR 0003).
import { describe, expect, test } from "bun:test";
import { describeAccount } from "../../../src/github/shared/core/account.ts";

describe("describeAccount", () => {
	test("local folder, signed in: the user", () => {
		expect(describeAccount({ on: null, status: { ok: true, user: "lw396" } })).toBe("signed in as lw396");
	});

	test("remote folder, signed in: the user and the machine", () => {
		expect(describeAccount({ on: "center", status: { ok: true, user: "server-account" } })).toBe(
			"signed in as server-account on center",
		);
	});

	const MISSING = {
		ok: false,
		reason: "missing",
		message: "cannot start gh: No such file or directory (os error 2)",
	} as const;
	const SIGNED_OUT = {
		ok: false,
		reason: "auth",
		message: "Alternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.",
	} as const;

	test("no gh on this computer: install it here", () => {
		expect(
			describeAccount({
				on: null,
				status: { ...MISSING, message: "cannot run gh: No such file or directory (os error 2)" },
			}),
		).toBe("gh is not installed on this computer: install it, then run gh auth login");
	});

	test("no gh on the folder's machine: install it on that machine", () => {
		expect(describeAccount({ on: "center", status: MISSING })).toBe(
			"gh is not installed on center: install it there, then run gh auth login on center",
		);
	});

	test("signed out on this computer: gh auth login here", () => {
		expect(describeAccount({ on: null, status: SIGNED_OUT })).toBe("not signed in on this computer: run gh auth login");
	});

	test("signed out on the folder's machine: gh auth login on that machine", () => {
		expect(describeAccount({ on: "center", status: SIGNED_OUT })).toBe(
			"not signed in on center: run gh auth login on center",
		);
	});

	test("a dropped connection: plain words and the machine", () => {
		const status = { ok: false, reason: "error", message: 'Get "https://api.github.com/user": EOF' } as const;
		expect(describeAccount({ on: "center", status })).toBe(
			"gh on center: The connection to GitHub dropped. Try again.",
		);
	});

	test("other failures: gh's message and the machine", () => {
		const status = { ok: false, reason: "error", message: "gh: Not Found (HTTP 404)" } as const;
		expect(describeAccount({ on: "center", status })).toBe("gh on center: gh: Not Found (HTTP 404)");
		expect(describeAccount({ on: null, status })).toBe("gh on this computer: gh: Not Found (HTTP 404)");
	});
});
