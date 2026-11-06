// The gh that talks to GitHub: the one on the folder's machine (ADR 0003), and what the sidebar says about it.
/** The sidebar's gh line: who is signed in where, or what to do on which machine. */
export function describeAccount(account) {
    const { on, status } = account;
    if (status.ok)
        return { ok: true, text: `signed in as ${status.user}` + (on ? ` on ${on}` : "") };
    const machine = on ?? "this computer", there = on ? ` on ${on}` : "";
    if (status.reason === "missing") {
        return { ok: false, text: `gh is not installed on ${machine}: install it${on ? " there" : ""}, then run gh auth login${there}` };
    }
    if (status.reason === "auth")
        return { ok: false, text: `not signed in on ${machine}: run gh auth login${there}` };
    return { ok: false, text: `gh on ${machine}: ${status.message}` };
}
