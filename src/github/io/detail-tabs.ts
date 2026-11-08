// Detail panes (issues and PRs) are native Herdr tabs, not split panes or a second tab bar inside the mod.
import { exec, focused, panes, run, setShared, shared, spaces } from "herdr";
import { type DetailRef, detailKey, detailTabName } from "../core/detail.ts";

/** A reader tab, in shared metadata: what it shows and whether its init can take a command yet. */
interface ReaderTab {
	tab: string;
	pane?: string;
	identity?: string;
	request: string;
	ready: string | null;
}
/** A file changes the view inside a PR tab, never the tab's identity. */
type DetailTarget = DetailRef & { file?: string };

interface OpenReader {
	id: string;
	reader: ReaderTab;
}
const READERS = "github.readers";
/** The mod command that hands a reader its issue or PR (Herdr prefixes it with the mod's name). */
const COMMAND = "detail:";
const readers = (): Record<string, ReaderTab> => (shared(READERS) as Record<string, ReaderTab> | null) ?? {};
const reader = (id: string) => readers()[id];

/** Keep metadata only for live native tabs (plus the tab just confirmed by app IPC). */
function remember(id: string, value: ReaderTab): void {
	const live = new Set(spaces().flatMap((s) => s.tabs.map((t) => t.id)));
	const kept = Object.fromEntries(Object.entries(readers()).filter(([key, r]) => key === id || live.has(r.tab)));
	setShared(READERS, { ...kept, [id]: value });
}

/** Called after init installed the listener. Saved identities never load an issue or PR by themselves. */
export function readyDetail(id: string): void {
	const r = reader(id);
	if (r && r.ready !== r.request) remember(id, { ...r, ready: r.request });
}

/** Explicit clicks can reuse native tab frames; contents and pending opens are session-only. */
export class DetailTabs {
	private opened = new Map<string, string>();
	private pending = new Map<string, DetailTarget>();
	private creating = new Map<string, Promise<OpenReader>>();

	async open(ref: DetailRef, file?: string): Promise<void> {
		const space = focused()?.space,
			owner = spaces().find((s) => s.id === space);
		if (!space || !owner)
			throw new Error(`Select a Herdr space before opening ${ref.kind === "pr" ? "a pull request" : "an issue"}.`);
		const identity = `${space}:${detailKey(ref)}`;
		// Issue tabs from before short names; PR tabs never had them.
		const oldName = ref.kind === "issue" ? `#${ref.number} · ${ref.repo}`.toLowerCase() : null;
		// A tab that followed a link to another issue or PR no longer belongs to this one.
		const openedId = this.opened.get(identity);
		const existingId =
			(openedId && reader(openedId)?.identity === identity ? openedId : undefined) ??
			Object.entries(readers()).find(
				([, r]) =>
					r.identity === identity ||
					(!r.identity && owner.tabs.some((t) => t.id === r.tab && t.name.toLowerCase() === oldName)),
			)?.[0];
		const existing = existingId ? reader(existingId) : undefined;
		let target: OpenReader;
		if (existingId && existing && panes().some((p) => p.tab === existing.tab && p.mod === "github")) {
			target = { id: existingId, reader: existing };
		} else {
			if (existingId) this.pending.delete(existingId);
			let opening = this.creating.get(identity);
			if (!opening) {
				opening = this.create(space, ref);
				this.creating.set(identity, opening);
			}
			try {
				target = await opening;
			} finally {
				this.creating.delete(identity);
			}
			this.opened.set(identity, target.id);
		}
		this.pending.set(target.id, file && ref.kind === "pr" ? { ...ref, file } : ref);
		// A fresh handshake prevents persisted readiness from accepting an issue or PR before init.
		remember(target.id, { ...target.reader, identity, request: `${Date.now()}-${Math.random()}`, ready: null });
		const tabName = owner.tabs.find((t) => t.id === target.reader.tab)?.name;
		if (oldName && tabName?.toLowerCase() === oldName && tabName !== detailTabName(ref)) {
			run("tab.rename", { id: target.reader.tab, name: detailTabName(ref) });
		}
		if (focused()?.space === space) run("tab.select", { id: target.reader.tab });
	}

	private async create(space: string, ref: DetailRef): Promise<OpenReader> {
		const id = `detail-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		const args = { space, name: detailTabName(ref), mod: "github", props: { role: ref.kind, reader: id } };
		// Local IPC creates a tab on the selected space's machine. gh itself still runs there.
		const result = await exec("herdr-app", ["do", "tab.new", JSON.stringify(args)]);
		if (result.code !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || "Could not open the tab.");
		let reply: { tab?: string; pane?: string; error?: string };
		try {
			reply = JSON.parse(result.stdout) as typeof reply;
		} catch {
			throw new Error("Herdr returned an unreadable tab reply.");
		}
		if (!reply.tab || reply.error) throw new Error(reply.error ?? "Herdr did not return a new tab.");
		return { id, reader: { tab: reply.tab, pane: reply.pane, request: "", ready: null } };
	}

	/** Live shared metadata re-renders the sidebar: no polling and no persisted mailbox. */
	deliver(): void {
		const tab = focused()?.tab;
		if (!tab) return;
		for (const [id, ref] of this.pending) {
			const r = reader(id);
			if (!r) {
				this.pending.delete(id);
				continue;
			}
			if (r.tab !== tab || r.ready !== r.request) continue;
			this.pending.delete(id);
			run(`github.${COMMAND}${JSON.stringify({ reader: id, ...ref })}`);
		}
	}
}

/** A reader that followed a link now belongs to that issue or PR: the sidebar finds its tab for it, and the tab is named after it. */
export function navigatedDetail(id: string, ref: DetailRef): void {
	const r = reader(id),
		space = spaces().find((s) => s.tabs.some((t) => t.id === r?.tab));
	if (!r || !space) return;
	remember(id, { ...r, identity: `${space.id}:${detailKey(ref)}` });
	const name = detailTabName(ref);
	if (space.tabs.find((t) => t.id === r.tab)?.name !== name) run("tab.rename", { id: r.tab, name });
}

/**
 * The reader's pane, its space's machine (gh runs there, never where focus is) and whether it is shown.
 * Metadata saved before tab.new returned the pane id resolves the tab's lone GitHub pane.
 */
export function detailLocation(id: string): { pane: string; on: string | null; visible: boolean } | null {
	const r = reader(id);
	if (!r) return null;
	const space = spaces().find((s) => s.tabs.some((t) => t.id === r.tab));
	const tab = space?.tabs.find((t) => t.id === r.tab);
	const all = panes().filter((p) => p.tab === r.tab);
	const pane = all.find((p) => p.mod === "github" && (!r.pane || p.pane === r.pane));
	if (!space || !tab || !pane) return null;
	return {
		pane: pane.pane,
		on: space.machine,
		visible: Boolean(space.active && tab.active && !all.some((p) => p.zoomed && p.pane !== pane.pane)),
	};
}

/** Close a reader that received no item, never an unrelated focused pane or a hidden pending tab. */
export function closeEmptyDetail(id: string): void {
	const location = detailLocation(id);
	if (location?.visible) run("pane.close", { pane: location.pane });
}

/** Mod commands are broadcast: only the intended reader may accept this issue or PR. */
export function detailCommand(command: string, id: string): DetailTarget | null {
	if (!command.startsWith(COMMAND)) return null;
	try {
		const value = JSON.parse(command.slice(COMMAND.length)) as {
			reader?: string;
			kind?: string;
			repo?: string;
			number?: number;
			file?: unknown;
		} | null;
		if (
			value?.reader !== id ||
			(value.kind !== "issue" && value.kind !== "pr") ||
			typeof value.repo !== "string" ||
			!/^[\w.-]+\/[\w.-]+$/.test(value.repo) ||
			typeof value.number !== "number" ||
			!Number.isSafeInteger(value.number) ||
			value.number <= 0
		)
			return null;
		if (value.file !== undefined && (value.kind !== "pr" || typeof value.file !== "string" || !value.file)) return null;
		const ref: DetailTarget = { kind: value.kind, repo: value.repo, number: value.number };
		if (typeof value.file === "string") ref.file = value.file;
		return ref;
	} catch {
		return null;
	}
}
