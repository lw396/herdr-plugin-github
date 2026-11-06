import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { commands, execCalls, machine, reset, screen, setShared } from "../fake-herdr.ts";
import { DetailTabs, readyDetail, issueCommand, detailMachine, navigatedDetail } from "../../src/github/io/detail-tabs.ts";

afterEach(() => { reset(); Math.random = originalRandom; Date.now = originalNow; });
const originalRandom = Math.random, originalNow = Date.now;
beforeEach(() => { spyOn(Math, "random").mockReturnValue(0.5); spyOn(Date, "now").mockReturnValue(1700000000000); });
const reader = "issue-1700000000000-i";
const source = { pane: "center/p1", tab: "center/tb1", terminal: "center/t19" };
const detail = { pane: "center/p2", tab: "center/tb2", terminal: null, mod: "github" };
const space = { id: "center/s1", machine: "center", tabs: [{ id: source.tab }, { id: detail.tab }] };
const create = `~$ herdr-app do tab.new {"space":"center/s1","name":"#9789 · cli","mod":"github","props":{"role":"issue","reader":"${reader}"}}`;
const atSource = (withDetail = false) => screen({ spaces: [space], panes: withDetail ? [source, detail] : [source], focused: { space: space.id, tab: source.tab, pane: source.pane } });
const atDetail = () => screen({ spaces: [space], panes: [source, detail], focused: { space: space.id, tab: detail.tab, pane: detail.pane } });

test("open a native Herdr tab, then select that tab on a repeated click without splitting panes", async () => {
  atSource();
  // Herdr 0.1.13 src/window.rs new_mod_tab returns { space, tab, pane }.
  // Only tab is needed; terminal tab replies have a different shape.
  machine(null, { [create]: { stdout: '{"space":"center/s1","tab":"center/tb2","pane":"center/p2"}' } });
  const tabs = new DetailTabs();
  await tabs.open({ repo: "cli/cli", number: 9789 });
  atDetail();
  tabs.deliver();
  expect(commands().filter(c => c.name.startsWith("github.issue:"))).toEqual([]);
  readyDetail(reader);
  tabs.deliver();
  expect(issueCommand(commands().at(-1)!.name.slice(7), reader)).toEqual({ repo: "cli/cli", number: 9789 });

  machine(null, {}); // Creating another native tab would fail.
  atSource(true);
  await tabs.open({ repo: "CLI/cli", number: 9789 });
  expect(commands()).toContainEqual({ name: "tab.select", args: { id: "center/tb2" } });
  expect(execCalls().filter(c => c.command === "herdr-app")).toHaveLength(1);
  expect(commands().some(c => c.name.startsWith("pane."))).toBe(false);
});

test("different issues get separate native tabs and their machines do not follow focus", async () => {
  atSource();
  machine(null, { [create]: { stdout: '{"tab":"center/tb2","pane":"center/p2"}' } });
  const tabs = new DetailTabs();
  await tabs.open({ repo: "cli/cli", number: 9789 });
  atDetail();
  readyDetail(reader);
  tabs.deliver();

  spyOn(Math, "random").mockReturnValue(0.25);
  const next = '~$ herdr-app do tab.new {"space":"center/s1","name":"#13 · herdr-plugin-github","mod":"github","props":{"role":"issue","reader":"issue-1700000000000-9"}}';
  machine(null, { [next]: { stdout: '{"tab":"center/tb3","pane":"center/p3"}' } });
  await tabs.open({ repo: "lw396/herdr-plugin-github", number: 13 });
  screen({ spaces: [space, { id: "s-local", machine: null, tabs: [{ id: "tb-local" }] }],
    focused: { space: "s-local", tab: "tb-local" } });
  expect(detailMachine(reader)).toEqual({ on: "center" });
  expect(detailMachine("unknown-reader")).toBeNull();
  expect(execCalls().filter(c => c.command === "herdr-app")).toHaveLength(2);
  expect(commands().some(c => c.name.startsWith("pane."))).toBe(false);
});

test("a tab that followed a link belongs to the linked issue; its first issue gets a new tab", async () => {
  atSource();
  machine(null, { [create]: { stdout: '{"tab":"center/tb2","pane":"center/p2"}' } });
  const tabs = new DetailTabs();
  await tabs.open({ repo: "cli/cli", number: 9789 });
  atDetail();
  readyDetail(reader);
  tabs.deliver();

  navigatedDetail(reader, { repo: "cli/cli", number: 1 });
  expect(commands()).toContainEqual({ name: "tab.rename", args: { id: detail.tab, name: "#1 · cli" } });
  expect(detailMachine(reader)).toEqual({ on: "center" });

  machine(null, {}); // The linked issue reuses its tab.
  atSource(true);
  await tabs.open({ repo: "cli/cli", number: 1 });
  expect(commands().at(-1)).toEqual({ name: "tab.select", args: { id: detail.tab } });
  expect(execCalls().filter(c => c.command === "herdr-app")).toHaveLength(1);

  spyOn(Math, "random").mockReturnValue(0.25);
  const next = create.replace(reader, "issue-1700000000000-9");
  machine(null, { [next]: { stdout: '{"tab":"center/tb3","pane":"center/p3"}' } });
  await tabs.open({ repo: "cli/cli", number: 9789 });
  expect(execCalls().filter(c => c.command === "herdr-app")).toHaveLength(2);
  expect(commands().at(-1)).toEqual({ name: "tab.select", args: { id: "center/tb3" } });
});

test("rapid repeated clicks while creating a native tab do not create duplicates", async () => {
  atSource();
  let finish!: (reply: { stdout: string }) => void;
  machine(null, { [create]: new Promise(resolve => { finish = resolve; }) });
  const tabs = new DetailTabs();
  const first = tabs.open({ repo: "cli/cli", number: 9789 });
  const second = tabs.open({ repo: "cli/cli", number: 9789 });
  finish({ stdout: '{"tab":"center/tb2","pane":"center/p2"}' });
  await Promise.all([first, second]);
  expect(execCalls().filter(c => c.command === "herdr-app")).toHaveLength(1);
});

test("closing an unvisited issue tab allows the same issue to be opened again", async () => {
  atSource();
  machine(null, { [create]: { stdout: '{"tab":"center/tb2","pane":"center/p2"}' } });
  const tabs = new DetailTabs();
  await tabs.open({ repo: "cli/cli", number: 9789 });
  // The first tab closes before its queued issue has been delivered.
  atSource();
  spyOn(Math, "random").mockReturnValue(0.25);
  const next = create.replace(reader, "issue-1700000000000-9");
  machine(null, { [next]: { stdout: '{"tab":"center/tb3","pane":"center/p3"}' } });
  await tabs.open({ repo: "cli/cli", number: 9789 });
  expect(execCalls().filter(c => c.command === "herdr-app")).toHaveLength(2);
  expect(commands()).toContainEqual({ name: "tab.select", args: { id: "center/tb3" } });
});

test("a fresh sidebar session does not replay previously opened issue contents", async () => {
  atSource();
  machine(null, { [create]: { stdout: '{"tab":"center/tb2","pane":"center/p2"}' } });
  const tabs = new DetailTabs();
  await tabs.open({ repo: "cli/cli", number: 9789 });
  atDetail();
  readyDetail(reader);
  tabs.deliver();
  const sent = commands().length;
  const restarted = new DetailTabs();
  restarted.deliver();
  expect(commands()).toHaveLength(sent);
  atSource(true);
  machine(null, {});
  await restarted.open({ repo: "cli/cli", number: 9789 });
  expect(execCalls().filter(c => c.command === "herdr-app")).toHaveLength(1);
  expect(commands()).toContainEqual({ name: "tab.select", args: { id: "center/tb2" } });
  expect(issueCommand('issue:{"reader":"someone-else","repo":"cli/cli","number":9789}', reader)).toBeNull();
});

test("existing long tab names are shortened and reused after upgrading the mod", async () => {
  setShared("github.readers", { [reader]: { tab: detail.tab, request: "old", ready: "old" } });
  screen({ spaces: [{ ...space, tabs: [{ id: source.tab }, { id: detail.tab, name: "#9789 · cli/cli" }] }],
    panes: [source, detail], focused: { space: space.id, tab: source.tab, pane: source.pane } });
  machine(null, {});
  await new DetailTabs().open({ repo: "cli/cli", number: 9789 });
  expect(execCalls()).toEqual([]);
  expect(commands()).toContainEqual({ name: "tab.rename", args: { id: detail.tab, name: "#9789 · cli" } });
  expect(commands()).toContainEqual({ name: "tab.select", args: { id: detail.tab } });
});

test("a failed native tab creation can be retried, without selecting a nonexistent tab", async () => {
  atSource();
  machine(null, { [create]: { code: 1, stderr: "layout on center is unavailable" } });
  const tabs = new DetailTabs();
  expect(await tabs.open({ repo: "cli/cli", number: 9789 }).catch(e => e)).toMatchObject({
    message: "layout on center is unavailable",
  });
  expect(commands()).toEqual([]);
  machine(null, { [create]: { stdout: '{"tab":"center/tb2","pane":"center/p2"}' } });
  await tabs.open({ repo: "cli/cli", number: 9789 });
  expect(commands()).toContainEqual({ name: "tab.select", args: { id: "center/tb2" } });
});
