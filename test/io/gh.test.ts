// gh.ts through a fake `exec`. Replies are real gh 2.96 output (stdout/stderr/exit code).
import { afterEach, describe, expect, test } from "bun:test";
import * as gh from "../../src/github/io/gh.ts";
import { machine, reset } from "../fake-herdr.ts";

afterEach(reset);

const NOT_SIGNED_IN = {
	code: 4,
	stderr:
		"To get started with GitHub CLI, please run:  gh auth login\nAlternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.\n",
};

const BAD_CREDENTIALS =
	'{\n  "message": "Bad credentials",\n  "documentation_url": "https://docs.github.com/rest",\n  "status": "401"\n}';

describe("status", () => {
	test("signed in: the account's login", async () => {
		machine(null, { "~$ gh api user --jq .login": { stdout: "lw396\n" } });
		expect(await gh.status()).toEqual({ ok: true, user: "lw396" });
	});

	test("never signed in: auth", async () => {
		machine(null, {
			"~$ gh api user --jq .login": {
				code: 4,
				stderr:
					"To get started with GitHub CLI, please run:  gh auth login\nAlternatively, populate the GH_TOKEN environment variable with a GitHub API authentication token.\n",
			},
		});
		expect(await gh.status()).toMatchObject({ ok: false, reason: "auth" });
	});

	test("revoked token: auth", async () => {
		machine(null, {
			"~$ gh api user --jq .login": { code: 1, stdout: BAD_CREDENTIALS, stderr: "gh: Bad credentials (HTTP 401)\n" },
		});
		expect(await gh.status()).toMatchObject({ ok: false, reason: "auth" });
	});

	test("gh not installed here: missing", async () => {
		machine(null, {});
		expect(await gh.status()).toMatchObject({ ok: false, reason: "missing" });
	});

	test("gh not installed on the space's machine: missing", async () => {
		machine("center", {});
		expect(await gh.status({ on: "center" })).toMatchObject({ ok: false, reason: "missing" });
	});

	test("asks the space's machine, not this one", async () => {
		machine(null, { "~$ gh api user --jq .login": { stdout: "here\n" } });
		machine("center", { "~$ gh api user --jq .login": { stdout: "there\n" } });
		expect(await gh.status({ on: "center" })).toEqual({ ok: true, user: "there" });
	});

	test("GitHub unreachable: error, not missing", async () => {
		machine(null, {
			"~$ gh api user --jq .login": {
				code: 1,
				stderr: "error connecting to api.github.com\ncheck your internet connection or https://githubstatus.com\n",
			},
		});
		expect(await gh.status()).toMatchObject({ ok: false, reason: "error" });
	});

	test("an HTTP 404 is an error, not a missing gh", async () => {
		machine(null, {
			"~$ gh api user --jq .login": {
				code: 1,
				stdout: '{"message":"Not Found","status":"404"}',
				stderr: "gh: Not Found (HTTP 404)\n",
			},
		});
		expect(await gh.status()).toMatchObject({ ok: false, reason: "error" });
	});
});

describe("account: the gh on the folder's machine", () => {
	const SIGNED_IN = (user: string) => ({ "~$ gh api user --jq .login": { stdout: `${user}\n` } });

	test("a local folder uses this computer's gh", async () => {
		machine(null, SIGNED_IN("lw396"));
		expect(await gh.account(null)).toEqual({ on: null, status: { ok: true, user: "lw396" } });
	});

	test("a remote folder uses that machine's gh, even when this computer's works", async () => {
		machine(null, SIGNED_IN("lw396"));
		machine("center", SIGNED_IN("server-account"));
		expect(await gh.account("center")).toEqual({ on: "center", status: { ok: true, user: "server-account" } });
	});

	test("no gh on the folder's machine: missing there, no falling back to this computer", async () => {
		machine(null, SIGNED_IN("lw396"));
		machine("center", {});
		expect(await gh.account("center")).toMatchObject({ on: "center", status: { ok: false, reason: "missing" } });
	});

	test("signed out on the folder's machine: auth there", async () => {
		machine(null, SIGNED_IN("lw396"));
		machine("center", { "~$ gh api user --jq .login": NOT_SIGNED_IN });
		expect(await gh.account("center")).toMatchObject({ on: "center", status: { ok: false, reason: "auth" } });
	});

	test("a local folder never asks another machine", async () => {
		machine(null, { "~$ gh api user --jq .login": NOT_SIGNED_IN });
		expect(await gh.account(null)).toMatchObject({ on: null, status: { ok: false, reason: "auth" } });
	});
});

describe("apiText", () => {
	test("jq output as plain text, in the repository's folder", async () => {
		machine("center", {
			"/w/app$ gh api repos/herdrdev/herdr-app --jq .full_name": { stdout: "herdrdev/herdr-app\n" },
		});
		expect(await gh.apiText("repos/herdrdev/herdr-app", ".full_name", { cwd: "/w/app", on: "center" })).toBe(
			"herdrdev/herdr-app",
		);
	});

	test("one value per line with --paginate", async () => {
		machine(null, {
			"~$ gh api repos/herdrdev/herdr-app/branches?per_page=1 --paginate --jq .[].name": {
				stdout: "feat/conditional-mods\nfix/durable-agent-session-capture\n",
			},
		});
		expect(await gh.apiText("repos/herdrdev/herdr-app/branches?per_page=1", ".[].name", { paginate: true })).toBe(
			"feat/conditional-mods\nfix/durable-agent-session-capture",
		);
	});

	test("a missing repository rejects with a 404 GhError", async () => {
		machine(null, {
			"~$ gh api repos/lw396/wechat-wcp --jq .full_name": {
				code: 1,
				stdout:
					'{"message":"Not Found","documentation_url":"https://docs.github.com/rest/repos/repos#get-a-repository","status":"404"}',
				stderr: "gh: Not Found (HTTP 404)\n",
			},
		});
		const error = await gh.apiText("repos/lw396/wechat-wcp", ".full_name").catch((e) => e);
		expect(error).toBeInstanceOf(gh.GhError);
		expect(error).toMatchObject({ message: "gh: Not Found (HTTP 404)", code: 1, notFound: true });
	});

	test("other failures are not 404s", async () => {
		machine(null, {
			"~$ gh api user --jq .login": { code: 1, stdout: BAD_CREDENTIALS, stderr: "gh: Bad credentials (HTTP 401)\n" },
		});
		expect(await gh.apiText("user", ".login").catch((e) => e)).toMatchObject({ notFound: false });
	});
});

describe("api", () => {
	test("pagination preserves literal brackets in text and accepts an empty last page", async () => {
		// --slurp's outer array is documented by gh api; body is a worked JSON-string example.
		machine("center", {
			"~$ gh api repos/o/r/issues/1/comments --paginate --slurp": { stdout: '[[{"body":"]["}],[{"body":"end"}],[]]' },
		});
		expect(await gh.api("repos/o/r/issues/1/comments", { on: "center", paginate: true })).toEqual([
			{ body: "][" },
			{ body: "end" },
		]);
	});

	test("paginated arrays arrive as one array", async () => {
		machine(null, {
			"~$ gh api repos/herdrdev/herdr-app/contributors?per_page=1 --paginate --slurp": {
				stdout: '[[{"login":"ogulcancelik","id":7064011}],[{"login":"dependabot[bot]","id":49699333}]]',
			},
		});
		expect(await gh.api("repos/herdrdev/herdr-app/contributors?per_page=1", { paginate: true })).toEqual([
			{ login: "ogulcancelik", id: 7064011 },
			{ login: "dependabot[bot]", id: 49699333 },
		]);
	});

	test("paginated object responses keep their page structure", async () => {
		machine(null, { "~$ gh api graphql --paginate --slurp": { stdout: '[{"data":{"n":1}},{"data":{"n":2}}]' } });
		expect(await gh.api("graphql", { paginate: true })).toEqual([{ data: { n: 1 } }, { data: { n: 2 } }]);
	});

	test("POST with fields", async () => {
		machine(null, {
			"~$ gh api repos/o/r/actions/runs/42/rerun -X POST -F enable_debug_logging=true": { stdout: "{}" },
		});
		expect(
			await gh.api("repos/o/r/actions/runs/42/rerun", { method: "POST", fields: { enable_debug_logging: true } }),
		).toEqual({});
	});
});

describe("failureOf: a failed ask in the UI's words", () => {
	test("a dropped connection reads as such, not as gh's EOF line; 404s are marked", () => {
		expect(gh.failureOf(new gh.GhError('Post "https://api.github.com/graphql": EOF', 1, ""))).toEqual({
			notFound: false,
			message: "The connection to GitHub dropped. Try again.",
		});
		expect(gh.failureOf(new gh.GhError("gh: Not Found (HTTP 404)", 1, "gh: Not Found (HTTP 404)\n"))).toEqual({
			notFound: true,
			message: "gh: Not Found (HTTP 404)",
		});
	});

	test("other errors keep their own message", () => {
		expect(gh.failureOf(new Error("cannot start gh: No such file or directory (os error 2)"))).toEqual({
			notFound: false,
			message: "cannot start gh: No such file or directory (os error 2)",
		});
		expect(gh.failureOf("plain")).toEqual({ notFound: false, message: "plain" });
	});
});

describe("graphql", () => {
	const QUERY = "query($o:String!,$n:String!){repository(owner:$o,name:$n){nameWithOwner stargazerCount}}";

	test("resolves with data", async () => {
		machine(null, {
			[`~$ gh api graphql -f query=${QUERY} -f o=herdrdev -f n=herdr-app`]: {
				stdout: '{"data":{"repository":{"nameWithOwner":"herdrdev/herdr-app","stargazerCount":2078}}}',
			},
		});
		expect(await gh.graphql(QUERY, { o: "herdrdev", n: "herdr-app" })).toEqual({
			repository: { nameWithOwner: "herdrdev/herdr-app", stargazerCount: 2078 },
		});
	});

	test("a query error rejects with GitHub's message", async () => {
		machine(null, {
			"~$ gh api graphql -f query={ viewer { nope } }": {
				code: 1,
				stdout:
					'{"errors":[{"path":["query","viewer","nope"],"extensions":{"code":"undefinedField","typeName":"User","fieldName":"nope"},"locations":[{"line":1,"column":12}],"message":"Field \'nope\' doesn\'t exist on type \'User\'"}]}',
				stderr: "gh: Field 'nope' doesn't exist on type 'User'\n",
			},
		});
		expect(await gh.graphql("{ viewer { nope } }").catch((e) => e)).toMatchObject({
			message: "gh: Field 'nope' doesn't exist on type 'User'",
		});
	});
});

describe('a dropped connection (real gh 2.96 on center: exit 1, `Get "…": EOF`)', () => {
	const EOF_USER = { code: 1, stderr: 'Get "https://api.github.com/user": EOF\n' };
	const EOF_GRAPHQL = { code: 1, stderr: 'Post "https://api.github.com/graphql": EOF\n' };
	/** A reply that is `drops` dropped connections, then `then`; counts the asks. */
	function flaky(drops: number, drop: object, then: object) {
		const asked = { count: 0 };
		return {
			asked,
			get reply() {
				asked.count++;
				return asked.count <= drops ? drop : then;
			},
		};
	}

	test("reading asks again: the login check gets through on the third try", async () => {
		const f = flaky(2, EOF_USER, { stdout: "lw396\n" });
		machine("center", {
			get "~$ gh api user --jq .login"() {
				return f.reply;
			},
		});
		expect(await gh.status({ on: "center" })).toEqual({ ok: true, user: "lw396" });
		expect(f.asked.count).toBe(3);
	});

	test("three drops in a row: an error, not missing or signed out", async () => {
		const f = flaky(9, EOF_USER, { stdout: "lw396\n" });
		machine("center", {
			get "~$ gh api user --jq .login"() {
				return f.reply;
			},
		});
		expect(await gh.status({ on: "center" })).toMatchObject({
			ok: false,
			reason: "error",
			message: 'Get "https://api.github.com/user": EOF',
		});
		expect(f.asked.count).toBe(3);
	});

	test("a GraphQL query asks again", async () => {
		const f = flaky(1, EOF_GRAPHQL, { stdout: '{"data":{"viewer":{"login":"lw396"}}}' });
		machine(null, {
			get "~$ gh api graphql -f query={ viewer { login } }"() {
				return f.reply;
			},
		});
		expect(await gh.graphql("{ viewer { login } }")).toEqual({ viewer: { login: "lw396" } });
		expect(f.asked.count).toBe(2);
	});

	test("a write never asks twice: GitHub may have done it before the connection dropped", async () => {
		const f = flaky(
			1,
			{ code: 1, stderr: 'Post "https://api.github.com/repos/o/r/actions/runs/42/rerun": EOF\n' },
			{ stdout: "{}" },
		);
		machine(null, {
			get "~$ gh api repos/o/r/actions/runs/42/rerun -X POST"() {
				return f.reply;
			},
		});
		expect(await gh.api("repos/o/r/actions/runs/42/rerun", { method: "POST" }).catch((e: unknown) => e)).toBeInstanceOf(
			gh.GhError,
		);
		expect(f.asked.count).toBe(1);
	});

	test("nor does a GraphQL mutation", async () => {
		const f = flaky(1, EOF_GRAPHQL, { stdout: "{}" });
		machine(null, {
			get "~$ gh api graphql -f query=mutation { closeIssue }"() {
				return f.reply;
			},
		});
		expect(await gh.graphql("mutation { closeIssue }").catch((e: unknown) => e)).toBeInstanceOf(gh.GhError);
		expect(f.asked.count).toBe(1);
	});
});
