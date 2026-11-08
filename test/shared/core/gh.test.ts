import { describe, expect, test } from "bun:test";
import {
	apiArgs,
	errorMessage,
	explain,
	failureOf,
	GhError,
	graphqlArgs,
	parseJson,
	transient,
} from "../../../src/github/shared/core/gh.ts";

describe("apiArgs", () => {
	test("GET is the default and adds no -X", () => {
		expect(apiArgs("repos/cli/cli")).toEqual(["api", "repos/cli/cli"]);
	});

	test("method, fields and flags", () => {
		expect(
			apiArgs("repos/cli/cli/actions/runs/1/rerun", {
				method: "post",
				fields: { debug: true },
				rawFields: { note: "x" },
				paginate: true,
				jq: ".id",
			}),
		).toEqual([
			"api",
			"repos/cli/cli/actions/runs/1/rerun",
			"-X",
			"POST",
			"-F",
			"debug=true",
			"-f",
			"note=x",
			"--paginate",
			"--jq",
			".id",
		]);
	});
});

describe("graphqlArgs", () => {
	test("strings go as -f, other values as -F", () => {
		expect(graphqlArgs({ query: "query($n:Int!,$o:String!){x}", variables: { n: 5, o: "me" } })).toEqual([
			"api",
			"graphql",
			"-F",
			"n=5",
			"-f",
			"query=query($n:Int!,$o:String!){x}",
			"-f",
			"o=me",
		]);
	});
});

describe("parseJson", () => {
	test("empty output is null", () => expect(parseJson("  \n")).toBeNull());
	test("one document", () => expect(parseJson('{"a":1}')).toEqual({ a: 1 }));
	test("slurped pages are a JSON document, not a text substitution", () =>
		expect(parseJson('[[{"body":"]["}],[{"body":"end"}],[]]')).toEqual([[{ body: "][" }], [{ body: "end" }], []]));
	test("concatenated documents are rejected", () => expect(() => parseJson('[{"a":1}]\n[{"a":2}]')).toThrow());
	test("not JSON throws", () => expect(() => parseJson("oops")).toThrow());
});

test("errorMessage takes gh's last line", () => {
	expect(errorMessage("warning\nHTTP 404: Not Found (https://api.github.com/x)\n")).toBe(
		"HTTP 404: Not Found (https://api.github.com/x)",
	);
	expect(errorMessage("")).toBe("gh failed");
});

describe("transient: a dropped connection worth asking again (real gh 2.96 stderr on center, exit 1)", () => {
	test("GET dropped mid-way", () => expect(transient('Get "https://api.github.com/user": EOF\n')).toBe(true));
	test("GraphQL POST dropped mid-way", () =>
		expect(transient('Post "https://api.github.com/graphql": EOF\n')).toBe(true));
	test("closing an issue (PATCH) dropped mid-way", () =>
		expect(transient('Patch "https://api.github.com/repos/lw396/no-such-repo-xyz/issues/1": EOF\n')).toBe(true));
	test("GitHub's own answers are not", () => {
		expect(transient("gh: Not Found (HTTP 404)\n")).toBe(false);
		expect(transient("gh: Bad credentials (HTTP 401)\n")).toBe(false);
		expect(transient("To get started with GitHub CLI, please run:  gh auth login\n")).toBe(false);
	});
});

describe("explain: gh's failure as the sidebar says it (real gh 2.96 stderr)", () => {
	test("a dropped connection", () => {
		expect(explain('Post "https://api.github.com/graphql": EOF')).toBe("The connection to GitHub dropped. Try again.");
		expect(explain('Get "https://api.github.com/user": EOF\n')).toBe("The connection to GitHub dropped. Try again.");
	});

	test("GitHub can't be reached at all", () => {
		expect(
			explain("error connecting to api.github.com\ncheck your internet connection or https://githubstatus.com\n"),
		).toBe("Can't reach GitHub. Check the internet connection (or githubstatus.com).");
		// Only the last line, as GhError.message and the account's status keep it.
		expect(explain("check your internet connection or https://githubstatus.com")).toBe(
			"Can't reach GitHub. Check the internet connection (or githubstatus.com).",
		);
	});

	test("anything else: gh's own words", () => {
		expect(explain("gh: Bad credentials (HTTP 401)")).toBe("gh: Bad credentials (HTTP 401)");
	});
});

describe("failureOf: a failed ask in the UI's words", () => {
	test("a dropped connection reads as such, not as gh's EOF line; 404s are marked", () => {
		expect(failureOf(new GhError('Post "https://api.github.com/graphql": EOF', 1, ""))).toEqual({
			notFound: false,
			message: "The connection to GitHub dropped. Try again.",
		});
		expect(failureOf(new GhError("gh: Not Found (HTTP 404)", 1, "gh: Not Found (HTTP 404)\n"))).toEqual({
			notFound: true,
			message: "gh: Not Found (HTTP 404)",
		});
	});

	test("other errors keep their own message", () => {
		expect(failureOf(new Error("cannot start gh: No such file or directory (os error 2)"))).toEqual({
			notFound: false,
			message: "cannot start gh: No such file or directory (os error 2)",
		});
		expect(failureOf("plain")).toEqual({ notFound: false, message: "plain" });
	});
});
