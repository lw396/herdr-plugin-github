// The only file that reaches GitHub: `gh`, on the folder's machine (`on`, see account()).
import { exec } from "herdr";
import { apiArgs, graphqlArgs, parseJson, errorMessage, type ApiOptions, type GraphqlVariables } from "../core/gh-args.ts";
import type { Account, Status } from "../core/account.ts";

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

  get notFound(): boolean {
    return /HTTP 404/.test(this.stderr + this.message);
  }
}

/** `gh <args>` → stdout, or a GhError. Herdr 0.1.13 exec: 30 s, 8 MiB. */
export async function gh(args: string[], where: Where = {}): Promise<string> {
  const r = await exec("gh", args, { cwd: where.cwd ?? undefined, on: where.on ?? null });
  if (r.code !== 0) throw new GhError(errorMessage(r.stderr), r.code, r.stderr);
  return r.stdout;
}

/** `gh api <path>`, parsed as JSON. */
export async function api(path: string, options: Omit<ApiOptions, "jq"> & Where = {}): Promise<unknown> {
  const { cwd, on, ...rest } = options;
  return parseJson(await gh(apiArgs(path, rest), { cwd, on }));
}

/** `gh api <path> --jq <filter>`: jq prints plain text (strings unquoted), trimmed here. */
export async function apiText(path: string, jq: string, options: Omit<ApiOptions, "jq"> & Where = {}): Promise<string> {
  const { cwd, on, ...rest } = options;
  return (await gh(apiArgs(path, { ...rest, jq }), { cwd, on })).trim();
}

/** `gh api graphql`, parsed; resolves with `data`. */
export async function graphql<T = unknown>(query: string, variables: GraphqlVariables = {}, where: Where = {}): Promise<T> {
  const out = parseJson(await gh(graphqlArgs(query, variables), where)) as { data?: T; errors?: { message: string }[] } | null;
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
    if (!(e instanceof GhError)) return { ok: false, reason: /^cannot (run|start) gh\b/.test(message) ? "missing" : "error", message };
    if (/gh auth login|HTTP 401/.test(e.stderr)) return { ok: false, reason: "auth", message };
    return { ok: false, reason: "error", message };
  }
}
