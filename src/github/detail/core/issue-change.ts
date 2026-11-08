export interface IssueRow {
	number: number;
	title: string;
	assignees: string[];
	updatedAt: string;
	url: string;
}

export interface IssueChange {
	repo: string;
	state: "open" | "closed";
	issue: IssueRow;
}
