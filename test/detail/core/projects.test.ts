import { expect, test } from "bun:test";
import { projectsQuery } from "../../../src/github/detail/core/projects.ts";

// GitHub GraphQL schema: Issue.projectItems and PullRequest.projectItems
// (https://docs.github.com/en/graphql/reference/objects#pullrequest). Archived items still belong to the item.
const query = (field: string) => `query($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    ${field}(number: $number) {
      projectItems(first: 100, after: $after, includeArchived: true) {
        pageInfo { hasNextPage endCursor }
        nodes { project { title url } }
      }
    }
  }
}`;

test("an issue's and a PR's Projects are asked through their own field, a page at a time", () => {
	expect(projectsQuery({ kind: "issue", repo: "lw396/herdr-plugin-github", number: 13 }, null)).toEqual({
		query: query("issue"),
		variables: { owner: "lw396", name: "herdr-plugin-github", number: 13, after: null },
	});
	expect(projectsQuery({ kind: "pr", repo: "lw396/herdr-plugin-github", number: 35 }, "next")).toEqual({
		query: query("pullRequest"),
		variables: { owner: "lw396", name: "herdr-plugin-github", number: 35, after: "next" },
	});
});
