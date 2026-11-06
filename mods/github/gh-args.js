// Pure helpers for talking to `gh`: no `herdr` import, so `bun test` can load them.
/** Arguments for `gh api <path>`; gh fills `{owner}`, `{repo}`, `{branch}` from the cwd's repo. */
export function apiArgs(path, options = {}) {
    const args = ["api", path];
    if (options.method && options.method.toUpperCase() !== "GET")
        args.push("-X", options.method.toUpperCase());
    for (const [key, value] of Object.entries(options.fields ?? {}))
        args.push("-F", `${key}=${value}`);
    for (const [key, value] of Object.entries(options.rawFields ?? {}))
        args.push("-f", `${key}=${value}`);
    if (options.paginate)
        args.push("--paginate");
    if (options.jq)
        args.push("--jq", options.jq);
    if (options.cache)
        args.push("--cache", options.cache);
    if (options.hostname)
        args.push("--hostname", options.hostname);
    return args;
}
/** Arguments for `gh api graphql`: string variables as -f, others as -F (keeps their JSON type). */
export function graphqlArgs(query, variables = {}, options = {}) {
    const rawFields = { query };
    const fields = {};
    for (const [key, value] of Object.entries(variables)) {
        if (typeof value === "string")
            rawFields[key] = value;
        else
            fields[key] = value === null ? "null" : value;
    }
    return apiArgs("graphql", { ...options, fields, rawFields });
}
/** Parses gh's JSON output; --paginate prints pages back to back (`[...][...]`), joined here. */
export function parseJson(stdout) {
    const text = stdout.trim();
    if (!text)
        return null;
    try {
        return JSON.parse(text);
    }
    catch {
        if (text.startsWith("["))
            return JSON.parse(`[${text.slice(1, -1).replace(/\]\s*\[/g, ",")}]`);
        throw new Error(`gh printed something that isn't JSON: ${text.slice(0, 200)}`);
    }
}
/** The last non-empty line of gh's stderr. */
export function errorMessage(stderr) {
    const lines = stderr.split("\n").map((l) => l.trim()).filter(Boolean);
    return lines.at(-1) ?? "gh failed";
}
