// The only file that reaches GitHub: `gh`, on this computer or the machine account() picks (`on`).
import { exec } from "herdr";
import { apiArgs, graphqlArgs, parseJson, errorMessage } from "./gh-args.js";
export class GhError extends Error {
    code;
    stderr;
    constructor(message, code, stderr) {
        super(message);
        this.code = code;
        this.stderr = stderr;
    }
    get notFound() {
        return /HTTP 404/.test(this.stderr + this.message);
    }
}
/** `gh <args>` → stdout, or a GhError. Herdr 0.1.13 exec: 30 s, 8 MiB. */
export async function gh(args, where = {}) {
    const r = await exec("gh", args, { cwd: where.cwd ?? undefined, on: where.on ?? null });
    if (r.code !== 0)
        throw new GhError(errorMessage(r.stderr), r.code, r.stderr);
    return r.stdout;
}
/** `gh api <path>`, parsed as JSON. */
export async function api(path, options = {}) {
    const { cwd, on, ...rest } = options;
    return parseJson(await gh(apiArgs(path, rest), { cwd, on }));
}
/** `gh api <path> --jq <filter>`: jq prints plain text (strings unquoted), trimmed here. */
export async function apiText(path, jq, options = {}) {
    const { cwd, on, ...rest } = options;
    return (await gh(apiArgs(path, { ...rest, jq }), { cwd, on })).trim();
}
/** `gh api graphql`, parsed; resolves with `data`. */
export async function graphql(query, variables = {}, where = {}) {
    const out = parseJson(await gh(graphqlArgs(query, variables), where));
    if (out?.errors?.length)
        throw new GhError(out.errors.map((e) => e.message).join("; "), 1, "");
    return out?.data;
}
/**
 * This computer's gh, so remote machines need only git. When it can't be used,
 * the gh on the space's machine; when neither can, this computer's reason.
 */
export async function account(spaceOn) {
    const here = await status();
    if (here.ok || !spaceOn)
        return { on: null, status: here };
    const there = await status({ on: spaceOn });
    return there.ok ? { on: spaceOn, status: there } : { on: null, status: here };
}
/** Whether gh is installed and signed in there. */
export async function status(where = {}) {
    try {
        const user = await apiText("user", ".login", where);
        return { ok: true, user };
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        // exec itself rejected: gh didn't run (Herdr: "cannot run gh: ...", "cannot start gh: ..." on another machine).
        if (!(e instanceof GhError))
            return { ok: false, reason: /^cannot (run|start) gh\b/.test(message) ? "missing" : "error", message };
        if (/gh auth login|HTTP 401/.test(e.stderr))
            return { ok: false, reason: "auth", message };
        return { ok: false, reason: "error", message };
    }
}
