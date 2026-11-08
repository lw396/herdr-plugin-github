// What gh is asked and what it answers: arguments, output and failures. io/gh.ts runs it.

/** `gh api` flags: -X, -F (typed), -f (string), --paginate, --slurp, --jq. */
export interface ApiOptions {
	method?: string;
	fields?: Record<string, string | number | boolean>;
	rawFields?: Record<string, string>;
	paginate?: boolean;
	slurp?: boolean;
	jq?: string;
}

export type GraphqlVariables = Record<string, string | number | boolean | null>;

export interface Query {
	query: string;
	variables: GraphqlVariables;
}

/** Arguments for `gh api <path>`; the path names its repository explicitly (ADR 0003). */
export function apiArgs(path: string, options: ApiOptions = {}): string[] {
	const args = ["api", path];
	if (options.method && options.method.toUpperCase() !== "GET") args.push("-X", options.method.toUpperCase());
	for (const [key, value] of Object.entries(options.fields ?? {})) args.push("-F", `${key}=${value}`);
	for (const [key, value] of Object.entries(options.rawFields ?? {})) args.push("-f", `${key}=${value}`);
	if (options.paginate) args.push("--paginate");
	if (options.slurp) args.push("--slurp");
	if (options.jq) args.push("--jq", options.jq);
	return args;
}

/** Arguments for `gh api graphql`: string variables as -f, others as -F (keeps their JSON type). */
export function graphqlArgs({ query, variables }: Query): string[] {
	const rawFields: Record<string, string> = { query };
	const fields: Record<string, string | number | boolean> = {};
	for (const [key, value] of Object.entries(variables)) {
		if (typeof value === "string") rawFields[key] = value;
		else fields[key] = value === null ? "null" : value;
	}
	return apiArgs("graphql", { fields, rawFields });
}

/** One JSON document; paginated requests use gh's --slurp instead of textual joining. */
export function parseJson(stdout: string): unknown {
	const text = stdout.trim();
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		throw new Error(`gh printed something that isn't JSON: ${text.slice(0, 200)}`);
	}
}

/** A conditional GET's answer: 304 (unchanged), or changed with its new ETag. */
export type Change = { changed: false } | { changed: true; etag: string | null };

/** `gh api --include` prints an HTTP status line, headers, then the body. */
export function responseHeaders(stdout: string): { status: number; etag: string | null } {
	const headers = stdout.split(/\r?\n\r?\n/, 1)[0] ?? "";
	return {
		status: Number(/^HTTP\/\S+\s+(\d+)/.exec(headers)?.[1]),
		etag: /^etag:\s*(.+)$/im.exec(headers)?.[1]?.trim() ?? null,
	};
}

export function errorMessage(stderr: string): string {
	const lines = stderr
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean);
	return lines.at(-1) ?? "gh failed";
}

/**
 * Whether gh's stderr is a connection dropped before GitHub answered (`Get "https://…": EOF`),
 * not an answer from GitHub: asking again usually works.
 */
export function transient(stderr: string): boolean {
	return /^(GET|POST|PATCH|Get|Post|Patch) "https?:\/\/[^"]+": EOF$/m.test(stderr);
}

/** gh's failure (its stderr or message) in plain words for the network, else gh's own. */
export function explain(stderr: string): string {
	if (transient(stderr)) return "The connection to GitHub dropped. Try again.";
	if (/^error connecting to |^check your internet connection/m.test(stderr))
		return "Can't reach GitHub. Check the internet connection (or githubstatus.com).";
	return errorMessage(stderr);
}

/** A failed ask as the UI says it: not there / not visible (404), or another reason. */
export interface Failure {
	notFound: boolean;
	message: string;
}
