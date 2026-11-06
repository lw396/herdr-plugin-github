// Issue readers are native Herdr tabs, not split panes or a second tab bar inside the mod.
import { exec, focused, panes, run, shared, setShared, spaces } from "herdr";
import { issueKey } from "../core/issue-detail.js";
const key = (id) => `github.reader.${id}`;
const reader = (id) => shared(key(id));
/** Called after init installed the view's listener. Shared state contains no issue selection. */
export function readyDetail(id) {
    const r = reader(id);
    if (r && r.ready !== r.request)
        setShared(key(id), { ...r, ready: r.request });
}
/** Only this session remembers which issue each native tab displays. */
export class DetailTabs {
    opened = new Map();
    pending = new Map();
    creating = new Map();
    async open(issue) {
        const space = focused()?.space;
        if (!space || !spaces().some(s => s.id === space))
            throw new Error("Select a Herdr space before opening an issue.");
        const identity = `${space}:${issueKey(issue)}`;
        let id = this.opened.get(identity), r = id ? reader(id) : null;
        if (!r || !panes().some(p => p.pane === r.pane && p.tab === r.tab && p.mod === "github")) {
            let opening = this.creating.get(identity);
            if (!opening) {
                opening = this.create(space, issue);
                this.creating.set(identity, opening);
            }
            try {
                const created = await opening;
                id = created.id;
                r = created.reader;
            }
            catch (e) {
                this.creating.delete(identity);
                throw e;
            }
            this.opened.set(identity, id);
        }
        this.pending.set(id, issue);
        // A fresh handshake prevents persisted readiness from accepting an issue before init.
        setShared(key(id), { ...r, request: `${Date.now()}-${Math.random()}`, ready: null });
        if (focused()?.space === space)
            run("tab.select", { id: r.tab });
    }
    async create(space, issue) {
        const id = `issue-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const args = { space, name: `#${issue.number} · ${issue.repo}`, mod: "github", props: { role: "issue", reader: id } };
        // Local IPC creates a tab on the selected space's machine. gh itself still runs there.
        const result = await exec("herdr-app", ["do", "tab.new", JSON.stringify(args)]);
        if (result.code !== 0)
            throw new Error(result.stderr.trim() || result.stdout.trim() || "Could not open the issue tab.");
        let reply;
        try {
            reply = JSON.parse(result.stdout);
        }
        catch {
            throw new Error("Herdr returned an unreadable tab reply.");
        }
        if (!reply.tab || !reply.pane || reply.error)
            throw new Error(reply.error ?? "Herdr did not return a new tab.");
        return { id, reader: { tab: reply.tab, pane: reply.pane, request: "", ready: null } };
    }
    /** Live shared metadata re-renders the sidebar: no polling and no persisted issue mailbox. */
    deliver() {
        const tab = focused()?.tab;
        if (!tab)
            return;
        for (const [id, issue] of this.pending) {
            const r = reader(id);
            if (r?.tab !== tab || r.ready !== r.request)
                continue;
            this.pending.delete(id);
            for (const [identity, opened] of this.opened)
                if (opened === id)
                    this.creating.delete(identity);
            run(`github.issue:${JSON.stringify({ reader: id, ...issue })}`);
        }
    }
}
/** The native reader tab's space determines gh's machine, never current focus. */
export function detailMachine(id) {
    const tab = reader(id)?.tab;
    const space = spaces().find(s => s.tabs.some(t => t.id === tab));
    return space ? { on: space.machine } : null;
}
/** Mod commands are broadcast: only the intended reader may accept this issue. */
export function issueCommand(command, id) {
    if (!command.startsWith("issue:"))
        return null;
    try {
        const value = JSON.parse(command.slice(6));
        if (value?.reader !== id || typeof value.repo !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(value.repo)
            || typeof value.number !== "number" || !Number.isSafeInteger(value.number) || value.number <= 0)
            return null;
        return { repo: value.repo, number: value.number };
    }
    catch {
        return null;
    }
}
