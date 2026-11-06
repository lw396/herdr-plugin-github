// Issue readers are native Herdr tabs, not split panes or a second tab bar inside the mod.
import { exec, focused, panes, run, shared, setShared, spaces } from "herdr";
import { issueKey, type IssueRef } from "../core/issue-detail.ts";

interface Reader { tab: string; request: string; ready: string | null }
interface OpenReader { id: string; reader: Reader }
const READERS = "github.readers";
const readers = (): Record<string, Reader> => (shared(READERS) as Record<string, Reader> | null) ?? {};
const reader = (id: string) => readers()[id];

/** Keep metadata only for live native tabs (plus the tab just confirmed by app IPC). */
function remember(id: string, value: Reader): void {
  const live = new Set(spaces().flatMap(s => s.tabs.map(t => t.id)));
  const kept = Object.fromEntries(Object.entries(readers()).filter(([key, r]) => key === id || live.has(r.tab)));
  setShared(READERS, { ...kept, [id]: value });
}

/** Called after init installed the view's listener. Shared state contains no issue selection. */
export function readyDetail(id: string): void {
  const r = reader(id);
  if (r && r.ready !== r.request) remember(id, { ...r, ready: r.request });
}

/** Only this session remembers which issue each native tab displays. */
export class DetailTabs {
  opened = new Map<string, string>();
  pending = new Map<string, IssueRef>();
  creating = new Map<string, Promise<OpenReader>>();

  async open(issue: IssueRef): Promise<void> {
    const space = focused()?.space;
    if (!space || !spaces().some(s => s.id === space)) throw new Error("Select a Herdr space before opening an issue.");
    const identity = `${space}:${issueKey(issue)}`;
    const existingId = this.opened.get(identity), existing = existingId ? reader(existingId) : undefined;
    let target: OpenReader;
    if (existingId && existing && panes().some(p => p.tab === existing.tab && p.mod === "github")) {
      target = { id: existingId, reader: existing };
    } else {
      if (existingId) this.pending.delete(existingId);
      let opening = this.creating.get(identity);
      if (!opening) {
        opening = this.create(space, issue);
        this.creating.set(identity, opening);
      }
      try { target = await opening; }
      finally { this.creating.delete(identity); }
      this.opened.set(identity, target.id);
    }
    this.pending.set(target.id, issue);
    // A fresh handshake prevents persisted readiness from accepting an issue before init.
    remember(target.id, { ...target.reader, request: `${Date.now()}-${Math.random()}`, ready: null });
    if (focused()?.space === space) run("tab.select", { id: target.reader.tab });
  }

  private async create(space: string, issue: IssueRef): Promise<OpenReader> {
    const id = `issue-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const args = { space, name: `#${issue.number} · ${issue.repo}`, mod: "github", props: { role: "issue", reader: id } };
    // Local IPC creates a tab on the selected space's machine. gh itself still runs there.
    const result = await exec("herdr-app", ["do", "tab.new", JSON.stringify(args)]);
    if (result.code !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || "Could not open the issue tab.");
    let reply: { tab?: string; pane?: string; error?: string };
    try { reply = JSON.parse(result.stdout) as typeof reply; }
    catch { throw new Error("Herdr returned an unreadable tab reply."); }
    if (!reply.tab || reply.error) throw new Error(reply.error ?? "Herdr did not return a new tab.");
    return { id, reader: { tab: reply.tab, request: "", ready: null } };
  }

  /** Live shared metadata re-renders the sidebar: no polling and no persisted issue mailbox. */
  deliver(): void {
    const tab = focused()?.tab;
    if (!tab) return;
    for (const [id, issue] of this.pending) {
      const r = reader(id);
      if (!r) { this.pending.delete(id); continue; }
      if (r.tab !== tab || r.ready !== r.request) continue;
      this.pending.delete(id);
      run(`github.issue:${JSON.stringify({ reader: id, ...issue })}`);
    }
  }
}

/** The native reader tab's space determines gh's machine, never current focus. */
export function detailMachine(id: string): { on: string | null } | null {
  const tab = reader(id)?.tab;
  const space = spaces().find(s => s.tabs.some(t => t.id === tab));
  return space ? { on: space.machine } : null;
}

/** Mod commands are broadcast: only the intended reader may accept this issue. */
export function issueCommand(command: string, id: string): IssueRef | null {
  if (!command.startsWith("issue:")) return null;
  try {
    const value = JSON.parse(command.slice(6)) as { reader?: string; repo?: string; number?: number } | null;
    if (value?.reader !== id || typeof value.repo !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(value.repo)
      || typeof value.number !== "number" || !Number.isSafeInteger(value.number) || value.number <= 0) return null;
    return { repo: value.repo, number: value.number };
  } catch { return null; }
}
