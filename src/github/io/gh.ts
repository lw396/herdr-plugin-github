// The only file that reaches GitHub: `gh` on the folder's machine (`on`: null for this computer, ADR 0003).
import { type ExecResult, exec } from "herdr";
import { type Account, describeAccount, type Status } from "../core/account.ts";
import {
	type ApiOptions,
	apiArgs,
	type Change,
	errorMessage,
	explain,
	type Failure,
	graphqlArgs,
	parseJson,
	type Query,
	responseHeaders,
	transient,
} from "../core/gh.ts";

export class GhError extends Error {
	readonly code: number;
	readonly stderr: string;
	constructor(message: string, code: number, stderr: string) {
		super(message);
		this.code = code;
		this.stderr = stderr;
	}

	/** Not there, or not visible to this account: REST's 404, GraphQL's NOT_FOUND for a repository. */
	get notFound(): boolean {
		return /HTTP 404|Could not resolve to a Repository/.test(this.stderr + this.message);
	}

	/** The connection dropped: GitHub may or may not have done a write. */
	get transient(): boolean {
		return transient(this.stderr);
	}
}

/** A failed ask in the UI's words (a dropped connection reads as such, not as gh's `Post "…": EOF`). */
export function failureOf(e: unknown): Failure {
	if (e instanceof GhError) return { notFound: e.notFound, message: explain(e.message) };
	return { notFound: false, message: e instanceof Error ? e.message : String(e) };
}

/** How many times a read is asked in all when the connection drops before GitHub answers. */
const TRIES = 3;

/**
 * `gh <args>` → its result, or a GhError. A read is asked again when the connection drops; a write
 * never is: GitHub may already have done it. A conditional read's 304 is an answer, not a failure.
 */
async function execute(args: string[], on: string | null, read: boolean, conditional = false): Promise<ExecResult> {
	for (let tried = 1; ; tried++) {
		const r = await exec("gh", args, { on });
		if (r.code === 0 || (conditional && responseHeaders(r.stdout).status === 304)) return r;
		if (!read || tried >= TRIES || !transient(r.stderr)) throw new GhError(errorMessage(r.stderr), r.code, r.stderr);
	}
}

/** A conditional GET. gh exits 1 for 304 but keeps the status and headers in stdout. */
export async function changes(path: string, etag: string | null, on: string | null): Promise<Change> {
	const args = ["api", path, "--include"];
	if (etag) args.push("-H", `If-None-Match: ${etag}`);
	const headers = responseHeaders((await execute(args, on, true, true)).stdout);
	if (headers.status === 304) return { changed: false };
	if (headers.status !== 200) throw new Error("GitHub did not return an HTTP 200 or 304 response.");
	return { changed: true, etag: headers.etag };
}

type RestOptions = Omit<ApiOptions, "jq" | "slurp"> & { on: string | null };

const reads = (method: string | undefined): boolean => !method || method.toUpperCase() === "GET";

/** `gh api <path>`, parsed as JSON; paginated REST array pages become one list. */
export async function api(path: string, { on, ...options }: RestOptions): Promise<unknown> {
	const args = apiArgs(path, { ...options, slurp: options.paginate });
	const data = parseJson((await execute(args, on, reads(options.method))).stdout);
	return options.paginate && Array.isArray(data) && data.every(Array.isArray) ? data.flat() : data;
}

/** `gh api <path> --jq <filter>`: jq prints plain text (strings unquoted), trimmed here. */
export async function apiText(path: string, jq: string, { on, ...options }: RestOptions): Promise<string> {
	return (await execute(apiArgs(path, { ...options, jq }), on, reads(options.method))).stdout.trim();
}

/** `gh api graphql`, parsed; resolves with `data`. */
export async function graphql<T = unknown>(query: Query, on: string | null): Promise<T> {
	const read = !/^\s*mutation\b/.test(query.query);
	const out = parseJson((await execute(graphqlArgs(query), on, read)).stdout) as {
		data?: T;
		errors?: { message: string }[];
	} | null;
	if (out?.errors?.length) throw new GhError(out.errors.map((e) => e.message).join("; "), 1, "");
	return out?.data as T;
}

/**
 * The gh on that machine (ADR 0003). Never falls back to another machine's, so the account is the
 * one signed in where the folder is; when it can't be used, the reason is that machine's.
 */
export async function account(on: string | null): Promise<Account> {
	return { on, status: await status(on) };
}

async function status(on: string | null): Promise<Status> {
	try {
		return { ok: true, user: await apiText("user", ".login", { on }) };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		// exec itself rejected: gh didn't run (Herdr: "cannot run gh: ...", "cannot start gh: ..." on another machine).
		if (!(e instanceof GhError))
			return { ok: false, reason: /^cannot (run|start) gh\b/.test(message) ? "missing" : "error", message };
		if (/gh auth login|HTTP 401/.test(e.stderr)) return { ok: false, reason: "auth", message };
		return { ok: false, reason: "error", message };
	}
}

/** Rejects with what to do on that machine unless its gh is installed and signed in. */
export async function signedIn(on: string | null): Promise<void> {
	const a = await account(on);
	if (!a.status.ok) throw new Error(describeAccount(a).text);
}
