// The only file that reaches GitHub: `gh`, on the folder's machine (`on`, see account()).
import { type ExecResult, exec } from "herdr";
import type { Account, Status } from "../core/account.ts";
import { type Change, responseHeaders } from "../core/conditional.ts";
import {
	type ApiOptions,
	apiArgs,
	errorMessage,
	explain,
	type GraphqlVariables,
	graphqlArgs,
	parseJson,
	transient,
} from "../core/gh-args.ts";
import type { Failure } from "../core/issues.ts";

export type { Account, Status };

export interface Where {
	cwd?: string | null;
	on?: string | null;
}

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
}

/** A failed ask in the UI's words (a dropped connection reads as such, not as gh's `Post "…": EOF`). */
export function failureOf(e: unknown): Failure {
	if (e instanceof GhError) return { notFound: e.notFound, message: explain(e.message) };
	return { notFound: false, message: e instanceof Error ? e.message : String(e) };
}

/** How many times a read is asked in all when the connection drops before GitHub answers. */
const TRIES = 3;

/**
 * `gh <args>` → stdout, or a GhError. Herdr 0.1.13 exec: 30 s, 8 MiB. A `read` is asked again
 * when the connection drops (`Get "…": EOF`); a write never is: GitHub may already have done it.
 */
export async function gh(args: string[], where: Where = {}, read = false): Promise<string> {
	return (await execute(args, where, read)).stdout;
}

async function execute(args: string[], where: Where, read: boolean, conditional = false): Promise<ExecResult> {
	for (let tried = 1; ; tried++) {
		const r = await exec("gh", args, { cwd: where.cwd ?? undefined, on: where.on ?? null });
		if (r.code === 0 || (conditional && responseHeaders(r.stdout).status === 304)) return r;
		if (!read || tried >= TRIES || !transient(r.stderr)) throw new GhError(errorMessage(r.stderr), r.code, r.stderr);
	}
}

/** A conditional GET. gh exits 1 for 304 but keeps the status and headers in stdout. */
export async function changes(path: string, etag: string | null, where: Where = {}): Promise<Change> {
	const args = ["api", path, "--include"];
	if (etag) args.push("-H", `If-None-Match: ${etag}`);
	const result = await execute(args, where, true, true);
	const headers = responseHeaders(result.stdout);
	if (headers.status === 304) return { changed: false };
	if (headers.status !== 200) throw new Error("GitHub did not return an HTTP 200 or 304 response.");
	return { changed: true, etag: headers.etag };
}

const reads = (method: string | undefined): boolean => !method || method.toUpperCase() === "GET";

/** `gh api <path>`, parsed as JSON. */
export async function api(path: string, options: Omit<ApiOptions, "jq" | "slurp"> & Where = {}): Promise<unknown> {
	const { cwd, on, ...rest } = options;
	const data = parseJson(await gh(apiArgs(path, { ...rest, slurp: rest.paginate }), { cwd, on }, reads(rest.method)));
	// REST array pages become one list; object pages (e.g. GraphQL) retain their page structure.
	return rest.paginate && Array.isArray(data) && data.every(Array.isArray) ? data.flat() : data;
}

/** `gh api <path> --jq <filter>`: jq prints plain text (strings unquoted), trimmed here. */
export async function apiText(
	path: string,
	jq: string,
	options: Omit<ApiOptions, "jq" | "slurp"> & Where = {},
): Promise<string> {
	const { cwd, on, ...rest } = options;
	return (await gh(apiArgs(path, { ...rest, jq }), { cwd, on }, reads(rest.method))).trim();
}

/** `gh api graphql`, parsed; resolves with `data`. */
export async function graphql<T = unknown>(
	query: string,
	variables: GraphqlVariables = {},
	where: Where = {},
): Promise<T> {
	const read = !/^\s*mutation\b/.test(query);
	const out = parseJson(await gh(graphqlArgs(query, variables), where, read)) as {
		data?: T;
		errors?: { message: string }[];
	} | null;
	if (out?.errors?.length) throw new GhError(out.errors.map((e) => e.message).join("; "), 1, "");
	return out?.data as T;
}

/**
 * The gh on the folder's machine (ADR 0003): this computer's for a local folder, that
 * machine's for a remote one. Never falls back to the other, so the account is the one
 * signed in where the folder is; when it can't be used, the reason is that machine's.
 */
export async function account(on: string | null): Promise<Account> {
	return { on, status: await status({ on }) };
}

/** Whether gh is installed and signed in there. */
export async function status(where: Where = {}): Promise<Status> {
	try {
		const user = await apiText("user", ".login", where);
		return { ok: true, user };
	} catch (e) {
		const message = e instanceof Error ? e.message : String(e);
		// exec itself rejected: gh didn't run (Herdr: "cannot run gh: ...", "cannot start gh: ..." on another machine).
		if (!(e instanceof GhError))
			return { ok: false, reason: /^cannot (run|start) gh\b/.test(message) ? "missing" : "error", message };
		if (/gh auth login|HTTP 401/.test(e.stderr)) return { ok: false, reason: "auth", message };
		return { ok: false, reason: "error", message };
	}
}
