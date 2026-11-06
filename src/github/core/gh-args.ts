// Pure helpers for talking to `gh`: no `herdr` import, so `bun test` can load them.

/** `gh api` flags: -X, -F (typed), -f (string), --paginate, --jq, --cache ("60s"), --hostname. */
export interface ApiOptions {
  method?: string;
  fields?: Record<string, string | number | boolean>;
  rawFields?: Record<string, string>;
  paginate?: boolean;
  jq?: string;
  cache?: string;
  hostname?: string;
}

export type GraphqlVariables = Record<string, string | number | boolean | null>;

/** Arguments for `gh api <path>`; gh fills `{owner}`, `{repo}`, `{branch}` from the cwd's repo. */
export function apiArgs(path: string, options: ApiOptions = {}): string[] {
  const args = ["api", path];
  if (options.method && options.method.toUpperCase() !== "GET") args.push("-X", options.method.toUpperCase());
  for (const [key, value] of Object.entries(options.fields ?? {})) args.push("-F", `${key}=${value}`);
  for (const [key, value] of Object.entries(options.rawFields ?? {})) args.push("-f", `${key}=${value}`);
  if (options.paginate) args.push("--paginate");
  if (options.jq) args.push("--jq", options.jq);
  if (options.cache) args.push("--cache", options.cache);
  if (options.hostname) args.push("--hostname", options.hostname);
  return args;
}

/** Arguments for `gh api graphql`: string variables as -f, others as -F (keeps their JSON type). */
export function graphqlArgs(
  query: string,
  variables: GraphqlVariables = {},
  options: Omit<ApiOptions, "method" | "fields" | "rawFields"> = {},
): string[] {
  const rawFields: Record<string, string> = { query };
  const fields: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === "string") rawFields[key] = value;
    else fields[key] = value === null ? "null" : value;
  }
  return apiArgs("graphql", { ...options, fields, rawFields });
}

/** Parses gh's JSON output; --paginate prints pages back to back (`[...][...]`), joined here. */
export function parseJson(stdout: string): unknown {
  const text = stdout.trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    if (text.startsWith("[")) return JSON.parse(`[${text.slice(1, -1).replace(/\]\s*\[/g, ",")}]`);
    throw new Error(`gh printed something that isn't JSON: ${text.slice(0, 200)}`);
  }
}

/** The last non-empty line of gh's stderr. */
export function errorMessage(stderr: string): string {
  const lines = stderr.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.at(-1) ?? "gh failed";
}
