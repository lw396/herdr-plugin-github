import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import {
	DetailTabs,
	detailCommand,
	detailLocation,
	navigatedDetail,
	readyDetail,
} from "../../src/github/io/detail-tabs.ts";
import { commands, execCalls, machine, reset, screen, setShared } from "../fake-herdr.ts";

afterEach(() => {
	reset();
	Math.random = originalRandom;
	Date.now = originalNow;
});
const originalRandom = Math.random,
	originalNow = Date.now;
beforeEach(() => {
	spyOn(Math, "random").mockReturnValue(0.5);
	spyOn(Date, "now").mockReturnValue(1700000000000);
});
const reader = "detail-1700000000000-i";
const source = { pane: "center/p1", tab: "center/tb1", terminal: "center/t19" };
const detail = { pane: "center/p2", tab: "center/tb2", terminal: null, mod: "github" };
const space = { id: "center/s1", machine: "center", tabs: [{ id: source.tab }, { id: detail.tab }] };
const create = `~$ herdr-app do tab.new {"space":"center/s1","name":"#9789 · cli","mod":"github","props":{"role":"issue","reader":"${reader}"}}`;
const atSource = (withDetail = false) =>
	screen({
		spaces: [space],
		panes: withDetail ? [source, detail] : [source],
		focused: { space: space.id, tab: source.tab, pane: source.pane },
	});
const atDetail = () =>
	screen({
		spaces: [space],
		panes: [source, detail],
		focused: { space: space.id, tab: detail.tab, pane: detail.pane },
	});

test("the reader knows its own pane and shown tab even when keyboard focus is elsewhere", async () => {
	atSource();
	machine(null, { [create]: { stdout: '{"tab":"center/tb2","pane":"center/p2"}' } });
	await new DetailTabs().open({ kind: "issue", repo: "cli/cli", number: 9789 });
	screen({
		spaces: [{ ...space, active: true, tabs: [{ id: detail.tab, active: true }] }],
		panes: [source, detail],
		focused: { space: space.id, tab: detail.tab, pane: source.pane },
	});
	expect(detailLocation(reader)).toEqual({ pane: "center/p2", on: "center", visible: true });
	screen({ spaces: [{ ...space, active: true }], panes: [source, detail] });
	expect(detailLocation(reader)).toEqual({ pane: "center/p2", on: "center", visible: false });
	screen({ spaces: [{ ...space, active: false, tabs: [{ id: detail.tab, active: true }] }], panes: [detail] });
	expect(detailLocation(reader)?.visible).toBe(false);
	screen({ spaces: [space], panes: [source] });
	expect(detailLocation(reader)).toBeNull();
});

test("older reader metadata resolves its pane by tab, but zooming another pane hides it", () => {
	setShared("github.readers", { [reader]: { tab: detail.tab, request: "old", ready: "old" } });
	screen({
		spaces: [{ ...space, active: true, tabs: [{ id: detail.tab, active: true }] }],
		panes: [detail],
	});
	expect(detailLocation(reader)).toEqual({ pane: detail.pane, on: "center", visible: true });
	screen({
		spaces: [{ ...space, active: true, tabs: [{ id: detail.tab, active: true }] }],
		panes: [detail, { pane: "center/p3", tab: detail.tab, zoomed: true }],
	});
	expect(detailLocation(reader)?.visible).toBe(false);
});

test("open a native Herdr tab, then select that tab on a repeated click without splitting panes", async () => {
	atSource();
	// Herdr 0.1.13 src/window.rs new_mod_tab returns { space, tab, pane }.
	// Only tab is needed; terminal tab replies have a different shape.
	machine(null, { [create]: { stdout: '{"space":"center/s1","tab":"center/tb2","pane":"center/p2"}' } });
	const tabs = new DetailTabs();
	await tabs.open({ kind: "issue", repo: "cli/cli", number: 9789 });
	atDetail();
	tabs.deliver();
	expect(commands().filter((c) => c.name.startsWith("github.detail:"))).toEqual([]);
	readyDetail(reader);
	tabs.deliver();
	expect(detailCommand(commands().at(-1)!.name.slice(7), reader)).toEqual({
		kind: "issue",
		repo: "cli/cli",
		number: 9789,
	});

	machine(null, {}); // Creating another native tab would fail.
	atSource(true);
	await tabs.open({ kind: "issue", repo: "CLI/cli", number: 9789 });
	expect(commands()).toContainEqual({ name: "tab.select", args: { id: "center/tb2" } });
	expect(execCalls().filter((c) => c.command === "herdr-app")).toHaveLength(1);
	expect(commands().some((c) => c.name.startsWith("pane."))).toBe(false);
});

test("different issues get separate native tabs and their machines do not follow focus", async () => {
	atSource();
	machine(null, { [create]: { stdout: '{"tab":"center/tb2","pane":"center/p2"}' } });
	const tabs = new DetailTabs();
	await tabs.open({ kind: "issue", repo: "cli/cli", number: 9789 });
	atDetail();
	readyDetail(reader);
	tabs.deliver();

	spyOn(Math, "random").mockReturnValue(0.25);
	const next =
		'~$ herdr-app do tab.new {"space":"center/s1","name":"#13 · herdr-plugin-github","mod":"github","props":{"role":"issue","reader":"detail-1700000000000-9"}}';
	machine(null, { [next]: { stdout: '{"tab":"center/tb3","pane":"center/p3"}' } });
	await tabs.open({ kind: "issue", repo: "lw396/herdr-plugin-github", number: 13 });
	screen({
		spaces: [space, { id: "s-local", machine: null, tabs: [{ id: "tb-local" }] }],
		panes: [source, detail],
		focused: { space: "s-local", tab: "tb-local" },
	});
	expect(detailLocation(reader)?.on).toBe("center");
	expect(detailLocation("unknown-reader")).toBeNull();
	expect(execCalls().filter((c) => c.command === "herdr-app")).toHaveLength(2);
	expect(commands().some((c) => c.name.startsWith("pane."))).toBe(false);
});

test("a tab that followed a link belongs to the linked issue; its first issue gets a new tab", async () => {
	atSource();
	machine(null, { [create]: { stdout: '{"tab":"center/tb2","pane":"center/p2"}' } });
	const tabs = new DetailTabs();
	await tabs.open({ kind: "issue", repo: "cli/cli", number: 9789 });
	atDetail();
	readyDetail(reader);
	tabs.deliver();

	navigatedDetail(reader, { kind: "issue", repo: "cli/cli", number: 1 });
	expect(commands()).toContainEqual({ name: "tab.rename", args: { id: detail.tab, name: "#1 · cli" } });
	expect(detailLocation(reader)?.on).toBe("center");

	machine(null, {}); // The linked issue reuses its tab.
	atSource(true);
	await tabs.open({ kind: "issue", repo: "cli/cli", number: 1 });
	expect(commands().at(-1)).toEqual({ name: "tab.select", args: { id: detail.tab } });
	expect(execCalls().filter((c) => c.command === "herdr-app")).toHaveLength(1);

	spyOn(Math, "random").mockReturnValue(0.25);
	const next = create.replace(reader, "detail-1700000000000-9");
	machine(null, { [next]: { stdout: '{"tab":"center/tb3","pane":"center/p3"}' } });
	await tabs.open({ kind: "issue", repo: "cli/cli", number: 9789 });
	expect(execCalls().filter((c) => c.command === "herdr-app")).toHaveLength(2);
	expect(commands().at(-1)).toEqual({ name: "tab.select", args: { id: "center/tb3" } });
});

test("rapid repeated clicks while creating a native tab do not create duplicates", async () => {
	atSource();
	let finish!: (reply: { stdout: string }) => void;
	machine(null, {
		[create]: new Promise((resolve) => {
			finish = resolve;
		}),
	});
	const tabs = new DetailTabs();
	const first = tabs.open({ kind: "issue", repo: "cli/cli", number: 9789 });
	const second = tabs.open({ kind: "issue", repo: "cli/cli", number: 9789 });
	finish({ stdout: '{"tab":"center/tb2","pane":"center/p2"}' });
	await Promise.all([first, second]);
	expect(execCalls().filter((c) => c.command === "herdr-app")).toHaveLength(1);
});

test("closing an unvisited issue tab allows the same issue to be opened again", async () => {
	atSource();
	machine(null, { [create]: { stdout: '{"tab":"center/tb2","pane":"center/p2"}' } });
	const tabs = new DetailTabs();
	await tabs.open({ kind: "issue", repo: "cli/cli", number: 9789 });
	// The first tab closes before its queued issue has been delivered.
	atSource();
	spyOn(Math, "random").mockReturnValue(0.25);
	const next = create.replace(reader, "detail-1700000000000-9");
	machine(null, { [next]: { stdout: '{"tab":"center/tb3","pane":"center/p3"}' } });
	await tabs.open({ kind: "issue", repo: "cli/cli", number: 9789 });
	expect(execCalls().filter((c) => c.command === "herdr-app")).toHaveLength(2);
	expect(commands()).toContainEqual({ name: "tab.select", args: { id: "center/tb3" } });
});

test("a fresh sidebar session does not replay previously opened issue contents", async () => {
	atSource();
	machine(null, { [create]: { stdout: '{"tab":"center/tb2","pane":"center/p2"}' } });
	const tabs = new DetailTabs();
	await tabs.open({ kind: "issue", repo: "cli/cli", number: 9789 });
	atDetail();
	readyDetail(reader);
	tabs.deliver();
	const sent = commands().length;
	const restarted = new DetailTabs();
	restarted.deliver();
	expect(commands()).toHaveLength(sent);
	atSource(true);
	machine(null, {});
	await restarted.open({ kind: "issue", repo: "cli/cli", number: 9789 });
	expect(execCalls().filter((c) => c.command === "herdr-app")).toHaveLength(1);
	expect(commands()).toContainEqual({ name: "tab.select", args: { id: "center/tb2" } });
	expect(
		detailCommand('detail:{"reader":"someone-else","kind":"issue","repo":"cli/cli","number":9789}', reader),
	).toBeNull();
});

test("existing long tab names are shortened and reused after upgrading the mod", async () => {
	setShared("github.readers", { [reader]: { tab: detail.tab, request: "old", ready: "old" } });
	screen({
		spaces: [{ ...space, tabs: [{ id: source.tab }, { id: detail.tab, name: "#9789 · cli/cli" }] }],
		panes: [source, detail],
		focused: { space: space.id, tab: source.tab, pane: source.pane },
	});
	machine(null, {});
	await new DetailTabs().open({ kind: "issue", repo: "cli/cli", number: 9789 });
	expect(execCalls()).toEqual([]);
	expect(commands()).toContainEqual({ name: "tab.rename", args: { id: detail.tab, name: "#9789 · cli" } });
	expect(commands()).toContainEqual({ name: "tab.select", args: { id: detail.tab } });
});

test("a failed native tab creation can be retried, without selecting a nonexistent tab", async () => {
	atSource();
	machine(null, { [create]: { code: 1, stderr: "layout on center is unavailable" } });
	const tabs = new DetailTabs();
	expect(await tabs.open({ kind: "issue", repo: "cli/cli", number: 9789 }).catch((e) => e)).toMatchObject({
		message: "layout on center is unavailable",
	});
	expect(commands()).toEqual([]);
	machine(null, { [create]: { stdout: '{"tab":"center/tb2","pane":"center/p2"}' } });
	await tabs.open({ kind: "issue", repo: "cli/cli", number: 9789 });
	expect(commands()).toContainEqual({ name: "tab.select", args: { id: "center/tb2" } });
});

test("a PR opens its own native tab in the PR role, and a repeated click selects it", async () => {
	atSource();
	const pr = `~$ herdr-app do tab.new {"space":"center/s1","name":"#42 · cli","mod":"github","props":{"role":"pr","reader":"${reader}"}}`;
	machine(null, { [pr]: { stdout: '{"tab":"center/tb2","pane":"center/p2"}' } });
	const tabs = new DetailTabs();
	await tabs.open({ kind: "pr", repo: "cli/cli", number: 42 });
	atDetail();
	readyDetail(reader);
	tabs.deliver();
	expect(detailCommand(commands().at(-1)!.name.slice(7), reader)).toEqual({ kind: "pr", repo: "cli/cli", number: 42 });

	machine(null, {});
	atSource(true);
	await tabs.open({ kind: "pr", repo: "CLI/cli", number: 42 });
	expect(commands().at(-1)).toEqual({ name: "tab.select", args: { id: detail.tab } });
	expect(execCalls().filter((c) => c.command === "herdr-app")).toHaveLength(1);
});

test("an issue and a PR with the same number do not share a tab", async () => {
	atSource();
	machine(null, { [create.replace("#9789", "#7")]: { stdout: '{"tab":"center/tb2","pane":"center/p2"}' } });
	const tabs = new DetailTabs();
	await tabs.open({ kind: "issue", repo: "cli/cli", number: 7 });
	atDetail();
	readyDetail(reader);
	tabs.deliver();

	spyOn(Math, "random").mockReturnValue(0.25);
	const pr = `~$ herdr-app do tab.new {"space":"center/s1","name":"#7 · cli","mod":"github","props":{"role":"pr","reader":"detail-1700000000000-9"}}`;
	machine(null, { [pr]: { stdout: '{"tab":"center/tb3","pane":"center/p3"}' } });
	atSource(true);
	await tabs.open({ kind: "pr", repo: "cli/cli", number: 7 });
	expect(execCalls().filter((c) => c.command === "herdr-app")).toHaveLength(2);
	expect(commands().at(-1)).toEqual({ name: "tab.select", args: { id: "center/tb3" } });
});

test("an issue tab that followed a link to a PR belongs to that PR", async () => {
	atSource();
	machine(null, { [create]: { stdout: '{"tab":"center/tb2","pane":"center/p2"}' } });
	const tabs = new DetailTabs();
	await tabs.open({ kind: "issue", repo: "cli/cli", number: 9789 });
	atDetail();
	readyDetail(reader);
	tabs.deliver();

	navigatedDetail(reader, { kind: "pr", repo: "cli/cli", number: 42 });
	machine(null, {});
	atSource(true);
	await tabs.open({ kind: "pr", repo: "cli/cli", number: 42 });
	expect(commands().at(-1)).toEqual({ name: "tab.select", args: { id: detail.tab } });
	expect(execCalls().filter((c) => c.command === "herdr-app")).toHaveLength(1);
});
