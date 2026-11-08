import { readFileSync } from "node:fs";
export const fixture = (name: string) => readFileSync(new URL(`../../fixtures/${name}`, import.meta.url), "utf8");
export function replies(number: number) {
	const prefix = `pull-cli-${number}`;
	const sha = JSON.parse(fixture(`${prefix}.json`)).head.sha;
	return {
		"~$ gh api repos/cli/cli": {
			stdout: fixture("repository-cli-merge-methods.json"),
		},
		[`~$ gh api repos/cli/cli/issues/${number}/timeline?per_page=100 --paginate --slurp`]: { stdout: "[[]]" },
		[`~$ gh api repos/cli/cli/pulls/${number}/comments?per_page=100 --paginate --slurp`]: { stdout: "[[]]" },
		[`~$ gh api repos/cli/cli/commits/${sha}/check-runs?per_page=100 --paginate --slurp`]: {
			stdout: '[{"check_runs":[]}]',
		},
		[`~$ gh api repos/cli/cli/commits/${sha}/statuses?per_page=100 --paginate --slurp`]: { stdout: "[[]]" },
		[`~$ gh api repos/cli/cli/pulls/${number}`]: { stdout: fixture(`${prefix}.json`) },
		[`~$ gh api repos/cli/cli/issues/${number}`]: { stdout: fixture(`${prefix}-issue.json`) },
		[`~$ gh api repos/cli/cli/issues/${number}/comments?per_page=100 --paginate --slurp`]: {
			stdout: fixture(`${prefix}-comments.json`),
		},
		[`~$ gh api repos/cli/cli/pulls/${number}/reviews?per_page=100 --paginate --slurp`]: {
			stdout: fixture(`${prefix}-reviews.json`),
		},
	};
}
