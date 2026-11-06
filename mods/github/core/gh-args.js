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
/**
 * Whether gh's stderr is a connection dropped before GitHub answered (`Get "https://…": EOF`),
 * not an answer from GitHub: asking again usually works.
 */
export function transient(stderr) {
    return /^(GET|POST|Get|Post) "https?:\/\/[^"]+": EOF$/m.test(stderr);
}
/** gh's failure (its stderr or message) as the sidebar says it: plain words for the network, else gh's own. */
export function explain(stderr) {
    if (transient(stderr))
        return "The connection to GitHub dropped. Try again.";
    if (/^error connecting to |^check your internet connection/m.test(stderr))
        return "Can't reach GitHub. Check the internet connection (or githubstatus.com).";
    return errorMessage(stderr);
}
