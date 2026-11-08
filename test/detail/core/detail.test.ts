import { expect, test } from "bun:test";
import { detailKey, detailTabName } from "../../../src/github/detail/core/detail.ts";

test("an issue keeps the key saved tab identities used before PRs; a PR with its number has another", () => {
	expect(detailKey({ kind: "issue", repo: "CLI/cli", number: 7 })).toBe("cli/cli#7");
	expect(detailKey({ kind: "pr", repo: "CLI/cli", number: 7 })).toBe("cli/cli/pull/7");
});

test("tab names are short: number and repository name", () => {
	expect(detailTabName({ kind: "issue", repo: "lw396/herdr-plugin-github", number: 42 })).toBe(
		"#42 · herdr-plugin-github",
	);
});
