var __defProp = Object.defineProperty;
var __export = (target, all2) => {
  for (var name in all2)
    __defProp(target, name, { get: all2[name], enumerable: true });
};

// src/github/main.ts
import { View } from "gpui-kit";
import { props as props4 } from "herdr";

// src/github/views/pane.ts
import { h_flex } from "gpui-base";
import { div as div2, image, svg as svg2 } from "gpui-kit";
import { home, panes, props, run } from "herdr";

// src/github/views/ui.ts
import { div, svg } from "gpui-kit";
import { theme } from "herdr";
var colors = () => theme();
var spinner = (size = 12) => svg("mods/github/assets/spinner.svg").size(size).flex_none().text_color(colors().dim).spin(900);
var stop = (_e, cx) => cx.stop_propagation();
function link(id, url, label) {
  return div().id(id).cursor_pointer().on_mouse_down("left", stop).on_click((_e, cx) => {
    cx.stop_propagation();
    cx.open_url(url);
  }).child(label);
}
function chip(label, border, background) {
  return div().px(8).py(3).rounded(12).border_1().border_color(border).bg(background).text_size(12).child(label);
}
var PULL_STATES = {
  open: { icon: "mods/github/assets/git-pull-request.svg", color: (t) => t.done, label: "Open" },
  draft: { icon: "mods/github/assets/git-pull-request-draft.svg", color: (t) => t.dim, label: "Draft" },
  merged: { icon: "mods/github/assets/git-merge.svg", color: (t) => t.ansi5, label: "Merged" },
  closed: { icon: "mods/github/assets/git-pull-request-closed.svg", color: (t) => t.blocked, label: "Closed" }
};
var square = (el) => el.size(36).flex_none().flex().items_center().justify_center();
function button(id, label, tip, act) {
  const t = colors();
  return div().id(id).px(6).py(2).rounded(6).text_size(12).text_color(t.dim).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).tooltip(tip).accessibility_label(tip).on_mouse_down("left", stop).on_click((e, cx) => {
    cx.stop_propagation();
    act(e, cx);
  }).child(label);
}

// src/github/views/pane.ts
function icon(program, color) {
  if (!program?.icon) return null;
  return program.tint ? svg2(program.icon).size(14).flex_none().text_color(color) : image(program.icon).w(14).h(14).flex_none();
}
function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(`${h}/`) ? `~${cwd.slice(h.length)}` : cwd;
}
var Pane = class {
  hovered = false;
  init() {
  }
  button(id, picture, command, args) {
    const t = colors();
    return div2().id(id).p(3).rounded(4).text_color(t.dim).hover((s) => s.bg(t.hover).text_color(t.foreground)).on_click((_e, cx) => {
      cx.stop_propagation();
      run(command, args);
    }).child(svg2(`mods/pane/${picture}.svg`).size(14));
  }
  render(_cx) {
    const t = colors(), p = panes().find((p2) => p2.pane === props()?.pane);
    if (!p) return div2();
    const github = p.mod === "github";
    const name = github ? "GitHub" : (p.program?.agent || p.program?.shell) && p.program.name || p.title || p.program?.name || "shell";
    const pic = github ? svg2("mods/github/assets/github.svg").size(14).flex_none().text_color(t.dim) : icon(p.program, t.dim);
    const st = p.status, pane = p.pane;
    return h_flex().id(`pane-head-${pane}`).size_full().px(10).gap(8).items_center().bg(t.background).border_b(1).border_color(t.border).text_size(12).on_hover((hovered, cx) => {
      this.hovered = hovered;
      cx.notify();
    }).on_click(() => run("pane.focus", { pane })).when(Boolean(pic), (el) => el.child(pic ?? div2())).child(div2().flex_none().truncate().max_w(260).font_medium().text_color(t.foreground).child(name)).child(div2().flex_1().truncate().text_color(t.dim).child(folder(p.cwd))).when(
      st === "working",
      (el) => el.child(svg2("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900))
    ).when(
      st === "blocked",
      (el) => el.child(
        div2().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(`${t.blocked}26`).text_size(10.5).font_semibold().text_color(t.blocked).child("Needs you")
      )
    ).when(st === "done", (el) => el.child(div2().size(7).flex_none().rounded(4).bg(t.done))).when(
      this.hovered,
      (el) => el.child(this.button(`ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane })).child(this.button(`ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane })).child(this.button(`ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane })).child(this.button(`ph-x-${pane}`, "close", "pane.close", { pane }))
    );
  }
};

// src/github/views/panel.ts
import { h_flex as h_flex6, v_flex as v_flex5 } from "gpui-base";
import { div as div9, svg as svg6 } from "gpui-kit";
import { closeOverlay, props as props2 } from "herdr";

// src/github/core/gh.ts
function apiArgs(path, options = {}) {
  const args = ["api", path];
  if (options.method && options.method.toUpperCase() !== "GET") args.push("-X", options.method.toUpperCase());
  for (const [key, value] of Object.entries(options.fields ?? {})) args.push("-F", `${key}=${value}`);
  for (const [key, value] of Object.entries(options.rawFields ?? {})) args.push("-f", `${key}=${value}`);
  if (options.paginate) args.push("--paginate");
  if (options.slurp) args.push("--slurp");
  if (options.jq) args.push("--jq", options.jq);
  return args;
}
function graphqlArgs({ query, variables }) {
  const rawFields = { query };
  const fields = {};
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === "string") rawFields[key] = value;
    else fields[key] = value === null ? "null" : value;
  }
  return apiArgs("graphql", { fields, rawFields });
}
function parseJson(stdout) {
  const text3 = stdout.trim();
  if (!text3) return null;
  try {
    return JSON.parse(text3);
  } catch {
    throw new Error(`gh printed something that isn't JSON: ${text3.slice(0, 200)}`);
  }
}
function responseHeaders(stdout) {
  const headers = stdout.split(/\r?\n\r?\n/, 1)[0] ?? "";
  return {
    status: Number(/^HTTP\/\S+\s+(\d+)/.exec(headers)?.[1]),
    etag: /^etag:\s*(.+)$/im.exec(headers)?.[1]?.trim() ?? null
  };
}
function errorMessage(stderr) {
  const lines = stderr.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.at(-1) ?? "gh failed";
}
function transient(stderr) {
  return /^(GET|POST|PATCH|Get|Post|Patch) "https?:\/\/[^"]+": EOF$/m.test(stderr);
}
function explain(stderr) {
  if (transient(stderr)) return "The connection to GitHub dropped. Try again.";
  if (/^error connecting to |^check your internet connection/m.test(stderr))
    return "Can't reach GitHub. Check the internet connection (or githubstatus.com).";
  return errorMessage(stderr);
}

// src/github/core/account.ts
function describeAccount(account3) {
  const { on, status: status2 } = account3;
  if (status2.ok) return { ok: true, text: `signed in as ${status2.user}${on ? ` on ${on}` : ""}` };
  const machine = on ?? "this computer", there = on ? ` on ${on}` : "";
  if (status2.reason === "missing") {
    return {
      ok: false,
      text: `gh is not installed on ${machine}: install it${on ? " there" : ""}, then run gh auth login${there}`
    };
  }
  if (status2.reason === "auth") return { ok: false, text: `not signed in on ${machine}: run gh auth login${there}` };
  return { ok: false, text: `gh on ${machine}: ${explain(status2.message)}` };
}

// src/github/core/polling.ts
var ConditionalPoll = class {
  key = null;
  visible = false;
  etag = null;
  failed = false;
  pending = null;
  get shown() {
    return this.visible;
  }
  /** What is polled (null: nothing) and whether it is shown; returns whether it needs a refresh now. */
  sync(key, visible) {
    const changed = key !== this.key;
    const refresh = visible && key !== null && (changed || !this.visible);
    if (changed) {
      this.etag = null;
      this.failed = false;
    }
    if (changed || !visible) this.pending = null;
    this.key = key;
    this.visible = visible;
    return refresh;
  }
  /** A local write or failed reload wins over an older read, and the next check asks without a validator. */
  invalidate() {
    this.pending = null;
    this.etag = null;
  }
  /** A check to make, or null while hidden or another is out; a forced one replaces the one out. */
  begin(force = false) {
    if (!this.key || !this.visible || this.pending && !force) return null;
    const request = { etag: this.etag, force };
    this.pending = request;
    return request;
  }
  current(request) {
    return this.visible && this.pending === request;
  }
  /** Whether the check's answer calls for reading the contents again. */
  reload(request, change) {
    return this.current(request) && (request.force || change.changed);
  }
  /**
   * Finish only after any required reload succeeds (no `change`: it failed, so the next check asks
   * again without a validator). `notify`: what is shown changed or recovered.
   */
  finish(request, change) {
    if (!this.current(request)) return { accepted: false, notify: false };
    const notify = !change || change.changed || request.force || this.failed;
    this.pending = null;
    this.failed = !change;
    if (!change) this.etag = null;
    else if (change.changed) this.etag = change.etag;
    return { accepted: true, notify };
  }
};

// src/github/core/sidebar.ts
var POLL_SECONDS = 60;
function noRepository(cwd) {
  const hint = "Focus a terminal in a repository cloned from GitHub.";
  const name = cwd ? cwd.replace(/\/+$/, "").split("/").pop() || "/" : null;
  return { title: "No GitHub repository", detail: name ? `${name} has no GitHub remote. ${hint}` : hint };
}
function listNotice(s) {
  if (s.account && !s.account.status.ok) return describeAccount(s.account).text;
  if (s.remote === null) return null;
  const repo = s.remote ? `${s.remote.owner}/${s.remote.repo}` : "the repository";
  if (s.failure?.notFound && s.remote) {
    const user = s.account?.status.ok ? s.account.status.user : "this account";
    return `${repo} (remote "${s.remote.remote}") isn't on GitHub, or ${user} can't see it. Check git remote -v.`;
  }
  if (s.failure) return s.failure.message;
  if (s.issuesEnabled === false) return `Issues are turned off for ${repo}.`;
  return null;
}
var PROBLEM = { missing: "gh is not installed", auth: "Not signed in to gh", error: "gh is not working" };
var ago = (ms) => ms < 6e4 ? "just now" : `${Math.floor(ms / 6e4)}m ago`;
function footerStatus(s, now) {
  const machine = s.on ?? "this computer";
  if (!s.account) return { tone: "pending", account: "Checking gh\u2026", machine, sync: null };
  const { status: status2 } = s.account;
  if (!status2.ok) return { tone: "problem", account: PROBLEM[status2.reason], machine, sync: null };
  if (!s.polling || !s.failed) return { tone: "ok", account: status2.user, machine, sync: null };
  const last = s.checkedAt === null ? null : ago(Math.max(0, now - s.checkedAt));
  const sync = last ? `Check failed \xB7 last ok ${last}` : `Check failed \xB7 retrying every ${POLL_SECONDS}s`;
  return { tone: "problem", account: status2.user, machine, sync };
}

// src/github/io/changes.ts
import { setShared, shared } from "herdr";
var CHANGES = "github.changes";
var KEPT = 20;
var log = () => shared(CHANGES)?.notices ?? [];
function announce(notice) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  setShared(CHANGES, { notices: [...log(), { id, notice }].slice(-KEPT) });
}
var Notices = class {
  taken = new Set(log().map((n) => n.id));
  /** Notices announced since the last take, oldest first. */
  take() {
    const notices = log(), fresh = notices.filter((n) => !this.taken.has(n.id));
    this.taken = new Set(notices.map((n) => n.id));
    return fresh.map((n) => n.notice);
  }
};

// src/github/io/context.ts
import { focused, layout, panes as panes2, spaces } from "herdr";

// src/github/core/location.ts
function focusedFolder(herdr, previous3) {
  const space = herdr.spaces.find((s) => s.active), f = herdr.focused, id = space?.id ?? null;
  if (f && !f.pane && f.terminal && f.cwd) {
    return { cwd: f.cwd, on: f.terminal.includes("/") ? f.terminal.split("/")[0] ?? null : null, space: id };
  }
  const pane = f?.pane ? herdr.panes.find((p) => p.pane === f.pane) : null;
  if (pane?.terminal)
    return { cwd: pane.cwd || f?.cwd || space?.folder || null, on: space?.machine ?? null, space: id };
  if (previous3 && previous3.space === id) return previous3;
  return { cwd: space?.folder || null, on: space?.machine ?? null, space: id };
}

// src/github/core/visibility.ts
function layoutShows(tree, id) {
  if (!tree || typeof tree !== "object") return false;
  const node2 = tree;
  if (node2.hidden) return false;
  if (node2.id === id) return true;
  const children = node2.children ?? [];
  return children.some(
    (child, index2) => (node2.type !== "stack" || (node2.active ? child.id === node2.active : index2 === 0)) && layoutShows(child, id)
  );
}

// src/github/io/context.ts
var previous = null;
function location() {
  previous = focusedFolder({ spaces: spaces(), panes: panes2(), focused: focused() }, previous);
  return previous;
}
var sidebarVisible = () => layoutShows(layout(), "github");

// src/github/io/detail-tabs.ts
import { exec, focused as focused2, panes as panes3, run as run2, setShared as setShared2, shared as shared2, spaces as spaces2 } from "herdr";

// src/github/core/detail.ts
var detailKey = (ref) => `${ref.repo.toLowerCase()}${ref.kind === "pr" ? "/pull/" : "#"}${ref.number}`;
var DetailNavigation = class {
  ref = null;
  history = [];
  get previous() {
    return this.history.at(-1) ?? null;
  }
  open(ref) {
    if (this.ref && detailKey(this.ref) === detailKey(ref)) return false;
    this.history = [];
    this.ref = ref;
    return true;
  }
  follow(ref) {
    if (this.ref && detailKey(this.ref) === detailKey(ref)) return false;
    if (this.ref) this.history.push(this.ref);
    this.ref = ref;
    return true;
  }
  back() {
    const previous3 = this.history.pop();
    if (!previous3) return null;
    this.ref = previous3;
    return previous3;
  }
};
var detailTabName = (ref) => `#${ref.number} \xB7 ${ref.repo.split("/").at(-1)}`;
var detailUrl = (ref) => `https://github.com/${ref.repo}/${ref.kind === "pr" ? "pull" : "issues"}/${ref.number}`;
var notVisible = (ref) => `${ref.repo} #${ref.number} isn't on GitHub, or this account can't see it.`;

// src/github/io/detail-tabs.ts
var READERS = "github.readers";
var COMMAND = "detail:";
var readers = () => shared2(READERS) ?? {};
var reader = (id) => readers()[id];
function remember(id, value) {
  const live = new Set(spaces2().flatMap((s) => s.tabs.map((t) => t.id)));
  const kept = Object.fromEntries(Object.entries(readers()).filter(([key, r]) => key === id || live.has(r.tab)));
  setShared2(READERS, { ...kept, [id]: value });
}
function readyDetail(id) {
  const r = reader(id);
  if (r && r.ready !== r.request) remember(id, { ...r, ready: r.request });
}
var DetailTabs = class {
  opened = /* @__PURE__ */ new Map();
  pending = /* @__PURE__ */ new Map();
  creating = /* @__PURE__ */ new Map();
  async open(ref, file) {
    const space = focused2()?.space, owner = spaces2().find((s) => s.id === space);
    if (!space || !owner)
      throw new Error(`Select a Herdr space before opening ${ref.kind === "pr" ? "a pull request" : "an issue"}.`);
    const identity = `${space}:${detailKey(ref)}`;
    const oldName = ref.kind === "issue" ? `#${ref.number} \xB7 ${ref.repo}`.toLowerCase() : null;
    const openedId = this.opened.get(identity);
    const existingId = (openedId && reader(openedId)?.identity === identity ? openedId : void 0) ?? Object.entries(readers()).find(
      ([, r]) => r.identity === identity || !r.identity && owner.tabs.some((t) => t.id === r.tab && t.name.toLowerCase() === oldName)
    )?.[0];
    const existing = existingId ? reader(existingId) : void 0;
    let target;
    if (existingId && existing && panes3().some((p) => p.tab === existing.tab && p.mod === "github")) {
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
    remember(target.id, { ...target.reader, identity, request: `${Date.now()}-${Math.random()}`, ready: null });
    const tabName = owner.tabs.find((t) => t.id === target.reader.tab)?.name;
    if (oldName && tabName?.toLowerCase() === oldName && tabName !== detailTabName(ref)) {
      run2("tab.rename", { id: target.reader.tab, name: detailTabName(ref) });
    }
    if (focused2()?.space === space) run2("tab.select", { id: target.reader.tab });
  }
  async create(space, ref) {
    const id = `detail-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const args = { space, name: detailTabName(ref), mod: "github", props: { role: ref.kind, reader: id } };
    const result = await exec("herdr-app", ["do", "tab.new", JSON.stringify(args)]);
    if (result.code !== 0) throw new Error(result.stderr.trim() || result.stdout.trim() || "Could not open the tab.");
    let reply;
    try {
      reply = JSON.parse(result.stdout);
    } catch {
      throw new Error("Herdr returned an unreadable tab reply.");
    }
    if (!reply.tab || reply.error) throw new Error(reply.error ?? "Herdr did not return a new tab.");
    return { id, reader: { tab: reply.tab, pane: reply.pane, request: "", ready: null } };
  }
  /** Live shared metadata re-renders the sidebar: no polling and no persisted mailbox. */
  deliver() {
    const tab = focused2()?.tab;
    if (!tab) return;
    for (const [id, ref] of this.pending) {
      const r = reader(id);
      if (!r) {
        this.pending.delete(id);
        continue;
      }
      if (r.tab !== tab || r.ready !== r.request) continue;
      this.pending.delete(id);
      run2(`github.${COMMAND}${JSON.stringify({ reader: id, ...ref })}`);
    }
  }
};
function navigatedDetail(id, ref) {
  const r = reader(id), space = spaces2().find((s) => s.tabs.some((t) => t.id === r?.tab));
  if (!r || !space) return;
  remember(id, { ...r, identity: `${space.id}:${detailKey(ref)}` });
  const name = detailTabName(ref);
  if (space.tabs.find((t) => t.id === r.tab)?.name !== name) run2("tab.rename", { id: r.tab, name });
}
function detailLocation(id) {
  const r = reader(id);
  if (!r) return null;
  const space = spaces2().find((s) => s.tabs.some((t) => t.id === r.tab));
  const tab = space?.tabs.find((t) => t.id === r.tab);
  const all2 = panes3().filter((p) => p.tab === r.tab);
  const pane = all2.find((p) => p.mod === "github" && (!r.pane || p.pane === r.pane));
  if (!space || !tab || !pane) return null;
  return {
    pane: pane.pane,
    on: space.machine,
    visible: Boolean(space.active && tab.active && !all2.some((p) => p.zoomed && p.pane !== pane.pane))
  };
}
function closeEmptyDetail(id) {
  const location2 = detailLocation(id);
  if (location2?.visible) run2("pane.close", { pane: location2.pane });
}
function detailCommand(command, id) {
  if (!command.startsWith(COMMAND)) return null;
  try {
    const value = JSON.parse(command.slice(COMMAND.length));
    if (value?.reader !== id || value.kind !== "issue" && value.kind !== "pr" || typeof value.repo !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(value.repo) || typeof value.number !== "number" || !Number.isSafeInteger(value.number) || value.number <= 0)
      return null;
    if (value.file !== void 0 && (value.kind !== "pr" || typeof value.file !== "string" || !value.file)) return null;
    const ref = { kind: value.kind, repo: value.repo, number: value.number };
    if (typeof value.file === "string") ref.file = value.file;
    return ref;
  } catch {
    return null;
  }
}

// src/github/io/gh.ts
import { exec as exec2 } from "herdr";
var GhError = class extends Error {
  code;
  stderr;
  constructor(message, code, stderr) {
    super(message);
    this.code = code;
    this.stderr = stderr;
  }
  /** Not there, or not visible to this account: REST's 404, GraphQL's NOT_FOUND for a repository. */
  get notFound() {
    return /HTTP 404|Could not resolve to a Repository/.test(this.stderr + this.message);
  }
  /** The connection dropped: GitHub may or may not have done a write. */
  get transient() {
    return transient(this.stderr);
  }
};
function failureOf(e) {
  if (e instanceof GhError) return { notFound: e.notFound, message: explain(e.message) };
  return { notFound: false, message: e instanceof Error ? e.message : String(e) };
}
var TRIES = 3;
async function execute(args, on, read, conditional = false) {
  for (let tried = 1; ; tried++) {
    const r = await exec2("gh", args, { on });
    if (r.code === 0 || conditional && responseHeaders(r.stdout).status === 304) return r;
    if (!read || tried >= TRIES || !transient(r.stderr)) throw new GhError(errorMessage(r.stderr), r.code, r.stderr);
  }
}
async function changes(path, etag, on) {
  const args = ["api", path, "--include"];
  if (etag) args.push("-H", `If-None-Match: ${etag}`);
  const headers = responseHeaders((await execute(args, on, true, true)).stdout);
  if (headers.status === 304) return { changed: false };
  if (headers.status !== 200) throw new Error("GitHub did not return an HTTP 200 or 304 response.");
  return { changed: true, etag: headers.etag };
}
var reads = (method) => !method || method.toUpperCase() === "GET";
async function api(path, { on, ...options }) {
  const args = apiArgs(path, { ...options, slurp: options.paginate });
  const data = parseJson((await execute(args, on, reads(options.method))).stdout);
  return options.paginate && Array.isArray(data) && data.every(Array.isArray) ? data.flat() : data;
}
async function apiText(path, jq, { on, ...options }) {
  return (await execute(apiArgs(path, { ...options, jq }), on, reads(options.method))).stdout.trim();
}
async function graphql(query, on) {
  const read = !/^\s*mutation\b/.test(query.query);
  const out = parseJson((await execute(graphqlArgs(query), on, read)).stdout);
  if (out?.errors?.length) throw new GhError(out.errors.map((e) => e.message).join("; "), 1, "");
  return out?.data;
}
async function account(on) {
  return { on, status: await status(on) };
}
async function status(on) {
  try {
    return { ok: true, user: await apiText("user", ".login", { on }) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (!(e instanceof GhError))
      return { ok: false, reason: /^cannot (run|start) gh\b/.test(message) ? "missing" : "error", message };
    if (/gh auth login|HTTP 401/.test(e.stderr)) return { ok: false, reason: "auth", message };
    return { ok: false, reason: "error", message };
  }
}
async function signedIn(on) {
  const a = await account(on);
  if (!a.status.ok) throw new Error(describeAccount(a).text);
}

// node_modules/entities/dist/decode-codepoint.js
var c1 = [
  8364,
  0,
  8218,
  402,
  8222,
  8230,
  8224,
  8225,
  710,
  8240,
  352,
  8249,
  338,
  0,
  381,
  0,
  0,
  8216,
  8217,
  8220,
  8221,
  8226,
  8211,
  8212,
  732,
  8482,
  353,
  8250,
  339,
  0,
  382,
  376
];
function isInvalidCodePoint(codePoint) {
  return codePoint === 0 || codePoint >= 55296 && codePoint <= 57343 || codePoint > 1114111;
}
function replaceCodePoint(codePoint) {
  if (isInvalidCodePoint(codePoint)) {
    return 65533;
  }
  if (codePoint >= 128 && codePoint <= 159) {
    return c1[codePoint - 128] || codePoint;
  }
  return codePoint;
}
function replaceCodePointXML(codePoint) {
  return isInvalidCodePoint(codePoint) ? 65533 : codePoint;
}

// node_modules/entities/dist/internal/decode-shared.js
var BASE91_INVERSE = /* @__PURE__ */ (() => {
  const table = new Uint8Array(127);
  let code = 0;
  for (let char = 33; char <= 126; char++) {
    if (char !== 34 && char !== 36 && char !== 92) {
      table[char] = code++;
    }
  }
  return table;
})();
function decodeTrieDict(input, resultLength, atomCount, dict1AtomCount, ngramCount, dictSize) {
  const base = 91;
  const inputLength = input.length;
  const twoCharBias = dictSize * (base - 1);
  let pos = 0;
  const readSlotCode = () => {
    const c12 = BASE91_INVERSE[input.charCodeAt(pos++)];
    return c12 < dictSize ? c12 : c12 * base - twoCharBias + BASE91_INVERSE[input.charCodeAt(pos++)];
  };
  const dict2AtomCount = atomCount - dict1AtomCount;
  const slotCount = atomCount + ngramCount;
  const single = new Int32Array(slotCount);
  single.fill(-1, dict1AtomCount, dictSize);
  single.fill(-1, dictSize + dict2AtomCount, slotCount);
  const start = new Int32Array(slotCount);
  const length = new Int32Array(slotCount);
  function decodeDelta(count, off) {
    let previous3 = 0;
    let slot = off;
    const end = off + count;
    while (slot < end) {
      const code = BASE91_INVERSE[input.charCodeAt(pos++)];
      if (code < 89) {
        previous3 += code;
        single[slot++] = previous3;
      } else if (code === 89) {
        let runLength = BASE91_INVERSE[input.charCodeAt(pos++)] + 2;
        while (runLength--)
          single[slot++] = ++previous3;
      } else {
        const next = BASE91_INVERSE[input.charCodeAt(pos++)];
        previous3 += 89 + // eslint-disable-next-line unicorn/prefer-minimal-ternary -- branches read a different number of side-effecting input bytes
        (next < 90 ? next * base + BASE91_INVERSE[input.charCodeAt(pos++)] : BASE91_INVERSE[input.charCodeAt(pos++)] * 8281 + BASE91_INVERSE[input.charCodeAt(pos++)] * base + BASE91_INVERSE[input.charCodeAt(pos++)]);
        single[slot++] = previous3;
      }
    }
  }
  decodeDelta(dict1AtomCount, 0);
  decodeDelta(dict2AtomCount, dictSize);
  const references = new Int32Array(ngramCount * 2);
  let poolSize = 0;
  let ngramIndex = 0;
  function readNgramReferences(count, startSlot) {
    for (let index2 = 0; index2 < count; index2++) {
      const slot = startSlot + index2;
      const a = readSlotCode();
      const b = readSlotCode();
      references[ngramIndex * 2] = a;
      references[ngramIndex * 2 + 1] = b;
      ngramIndex += 1;
      start[slot] = poolSize;
      const entryLength = (single[a] < 0 ? length[a] : 1) + (single[b] < 0 ? length[b] : 1);
      length[slot] = entryLength;
      poolSize += entryLength;
    }
  }
  readNgramReferences(ngramCount - dictSize + dict1AtomCount, dictSize + dict2AtomCount);
  readNgramReferences(dictSize - dict1AtomCount, dict1AtomCount);
  const pool = new Uint16Array(poolSize);
  let write = 0;
  for (let index2 = 0; index2 < ngramIndex; index2++) {
    for (let half = 0; half < 2; half++) {
      const source = references[index2 * 2 + half];
      const value = single[source];
      if (value < 0) {
        let read = start[source];
        const readEnd = read + length[source];
        while (read < readEnd)
          pool[write++] = pool[read++];
      } else {
        pool[write++] = value;
      }
    }
  }
  const out = new Uint16Array(resultLength);
  let outIndex = 0;
  while (pos < inputLength) {
    let slot = BASE91_INVERSE[input.charCodeAt(pos++)];
    if (slot >= dictSize) {
      slot = slot * base - twoCharBias + BASE91_INVERSE[input.charCodeAt(pos++)];
    }
    const value = single[slot];
    if (value < 0) {
      let read = start[slot];
      const readEnd = read + length[slot];
      while (read < readEnd)
        out[outIndex++] = pool[read++];
    } else {
      out[outIndex++] = value;
    }
  }
  return out;
}

// node_modules/entities/dist/generated/decode-data-html.js
var htmlDecodeTree = /* @__PURE__ */ decodeTrieDict("!}.&u%}'&}*'~!6*)%&,~!J~!J~%L~y<~!R,~~%Lu~~#GD~~#|)1#%}^%}2%+#.##%##%}&%##%'#%##&%#%#'%#&#%#&#'#%%#&#%##%#)%''%&%#%#'%#%%#%%}%%%#%#&(23#%%#&-%0%('1#(##%#'##+%'*.:1}#%#6-+(%'%%#%%%}#L'2351&('%}&/N'(0(/*-%(%%}#'+&T%7.2}#&%&#%#36/5##%&%%#&#%%#))2%%##%&&'0~!#*+&'%1~!%).'3q?&%'1~!.##%6(~!+%%%(Gw'rT~!E#<nA%#jZ~!H%(~!42##~!*31&~!G%U~#)5~#`3~!J~!Z~%]~%Y~%C~!q~!u~#kz~%#~!6'~!D~!U~!?~#T~!c%~!G#'~%7|~!G~!J~!G&~#pb~(Df}#%}*&}#%##%##%##&#-}&'#'&%#.++}%mI,#,@&(}*%}*'%&##&#%##%}&0}#.},U},%}+%}&%}#%##&}B%(}(%}+%)})%##%#&}&%##%&}<%}>%#%&}*%}(%}9%}/%})%}*%}*%}?&}&%}3%}&*#%})%#%#)}#&#-#+*%E%%'%'#%}#*V##&##I}#&&##%&%#&&Qf%%))w/0+&%#(#.%-''''++++7}>%4'',##1,#%#&%##&#'##&#*#9)%&%}#*}%,#+P(%A&%#'&##wSD',9E00#y#@}(+}&%&>~!#~!X}#*}(&&}(&}(,%}%&#+&}#&}I%#%}%)#(},'%#*}4%%#%}(''}#/##(##),%-##%%)#&}(.}&%#&}%%}*&#%},&&}&%}#%*'#%})%}D&}&%}-&}6&#&}-,%}#%})-(~+`~,=?~I9'9%~!,#%})%})%}@%}?%}(~!?~#<~#pP~#BG~#=1#%K+~#?#~%;)~#A~#mF1~#A'~'X%'~#lR~#N~'N~#r~#m#-~#i'?%#'%~#B%##%,%#~#_%#0%~#]732~,w~2+#:&#%&'0%&>%}#>##F+)#%&&#(+_}4&}-%}(&}@&}O7Fdf0@+/v4}&WU##&/0#&'('B#%}.%}'+#%}#%%&#&%#%##+#&#)#6#'#.},%}c%},%#%##%&#&%#&~#>'*-.%##%##%}#%%}%'~#)D1}#%*&~#_%%'(~#S2%'.}#~#=##*'*-%}&'%'##&&~'E%.#&~#M4}%%##&'%#~#O1##%&#'+~#<B%##%%'%+~#;#@%}#&%#&&%#(~#H1}'%'##&&~#?A}&'~#D#%32}'&&&&~#[}'(#%}'~#;C})&}%%#%~#=&%,3}%'(#%%~#^'#&&)#%'~#Y%-~#d-%'~#^%%&#&&&}#~#b~2t*&'~&(~&@~0%~e~3}%*''0})&}+~!9##-}#%-hD*)1fC#%/&/fB#40~!+#)*4~!+~!K'&:~!/*7~!.#~!H~!L':~%x&~!H#~!*~%1~!I#~!+A~#p'~!F~~#-#~,,(~.Z~!V~%;'B'mq-W~!N~%I%#&&#&}#%},%%}'%}+X#%}#&}(%}'%}<%}#%}%%'}'%}:~![)9@~%>~#UA%-%##&~!C%~!-.9:~!1~!-^2/:a~!y,D*J#-5)/4~%23,~#G~!L1~!0X3`~!2+~!!0-~&E~!W~!o,>Y&]~%cZx_&~#O*9#A#'#+I'%#)~!0B*-5A+-((F&*M#)(-7-5+'-3a5Vi~!Y~!?+[)%3),ERHm~!+:D,VG.+)?fB%%*(%)'(#&80%1'8`K8?`+'Z#&O&'H5#*9)A%%5&3))0%39+.*7#()&&*=4@**L)<'_&*+..;(#*+)./&0#3)%')-8(4ixD(&.}%,('aI:,)%,k2231T)I'#/-W7,/'Q#.'Y24+h')37</31&83##&0#),H(?'&?/1##%#&&#%''-%&&&#(&''&#.-'%#%%(,')*'&#&#'##%(%(#%('#&##%%%%('%#%#%%#%#&%##h>w+v<ayvyvcg.uuhKr}g/v|g>u9i[~>g5uI~=RvdwEg;v/g;uk!!TTSx]@RT!U!#!@VBRUU!'UTe-d0c`e&gSdicedFcrdTaqb.kYcAohdYd@a3e+d}dMdtd.aJ#bqcK`dle/e.e'dwdPdodddjbEb}ogd^ofdpduc6j?l%d{drdqc)d7bacOdQ%T#Y)X.sR[yH>6Vyv3[xwLu>vo'!*.[yBacahoj>6Rew3[xqdZa#!a&#^(X-[yG>6Vyu3[xvg3sEr|g.u/Ri9db0T#^(Xa)!-[y;>6Vylg4wKs{JwNZt3@3r=c4Z([xlg;wKt!cpq's@v7A'*a(a+!-a#[y<3Dt?3Dt'>6Vym3[xmg9rxsNJwLZt4~?r?db1T#`-!(Xa,!0[yS>6Vz%NuQs.g4wKtnJwNZtS@3r>c4Z([y%g;wKtrdga8!a(!#&T*Y-Xa#!a0<or[yc3Dtq>6Vz43[y3JwNZtf@3s!Ju}!%Dti:pm3c_%X#tjB5pkd6q!r]u?voC'*-a.a2!0a&a+[yI3DtI3Ds~3DtH>6Vyw3[xx;:s#~<5pKJwNZtE@3r~d`a)!a2T#a.(!+U.X1[yT3Dt`3Dtv>6Vz&3[y&g9rxwzcxstPu.<rAJwLZtT~?r@dZa%!a.&^*Za(/Reu[ya>6Vz23[y1g3sEr}wkg{NuQRg{ci(U#5@b`~,cg#U(2WnH5wugcRh7dX#T(Y,a'Ta!!a,[yZ<]mj>6Vz,3[y+Pv#5ReZKu+=,%!H}7ABwkaS?Rh:BcW(X#<]mrj:ubv/ARekdg%!(!a.*Ta(Y.X1!#sP>Rl*Dt6[y>>6Vyo3Wf*jOvuumvuRgRJuq*!:9<B@bX~3jVv&v@s@5Re[d/rQt{uAvo&a&a*)a2!,0Wf!3Dt0=Bs'>6Re}3[xy~<5s%JwJZt1~Gs)c;&!#2sJkNuXvzq7rxu,Re8dka4!a8(aEZ+a@Y.X1Xa)[yd=Bs(3DtP>6Vz53[y4cX#X&Re:avRe9~<5s&JwJZtQ~Gs*i^rzvdRg+Jv{%!2sbB@bX}kdga,!Za?&^*T1/!a'Dt+[y6>6Vyf3Wf%g/u;s4hGu6?Rh-JvZ,!c%#&RoX54Rivj7uyvf8RgTKvZB%*!2sGh<vu5Rgq<=C::9bb~#dZ#T&Ta6Y.X*Dt>[y93Wf)coZ(T,6VyifluvRgC@95@B@bX~/hFu34cC#T,k/unq8w8Q5RkUklwQuzunq8w8Q5Rk8d/rJu?v8w9)-&!a0a;a&aIWejg3sEr/h1s<DtDJvyZqY5aws3Jvy!&Wei~Hr1:au5@Bag>23E~5c:Z&bX};kKv?w&unuVu5Rjc;>bs)#~@:Rh.=ay<a]C;b`}Vd6s/t{uAvoaxa()!a,a7%-a#a2Dt,[yF2Wo[>6Vyt3[xuNuPRi&NuPwpi#RoWh?vf8Ri%Jv]!%Ri:KvxD!.'2WeAjZu`q9rxu,Re7woeAg-unLq(qA_/*2Wg_g3u5q^9:4E}/jTrxrzv=Wkkd~0UX#^^Xa-a1a5T&a=U1a'*aEa]!a*aPaA-adok[y54Rn>;:p3~Dp5g9rpsFNvZqjg3uJp4~<5p0Pw;5qlJwNZt*@3p1Pw:5p/Ou!5p2JvG'!6Vye=<qnJvh_[xhg3v,Rh3kOwOw-sDuev/Re^dha[a%!%!a+#Ta7)-5TaCaO!aka!a)sf[yb2>Rl!9ARiq5E}Qg=ucRkBE|oJrJ_@Wk~@Wk{JrJ_@Wk|@WkyJrJ_@Wk}@WkzJvO_[y2g-vMRmiKuYC!)&>Ri;>Ri<@3RkNc](X#@9Rk=g5vuRmhKvDB!+'=]meg3u4Rmgd)#Y'Vz3CARmfd`a+!%T'!+#Ta1Ta6TaM-sTDt9[yA9sYd'%Y#s[[xpj:ueunaXRgEjRq,v-vuqdd2'`#6Rev<32@5>:2<E}5xIo9a*X#Y(;5RePJvD_g>vyRgNj8w)v8<wggs:RgXiZt|vjx,hSq3ah!-(~@:Ro/Ou!5RhWj^v(pyw8unRhUdx-UY#^Ua.a3a70!)%UX1TaDa)'omRiRRhE[y:3Dsz=Br,>6Vyj3[xkg6ruwjcqsrPw;5r*Ku]D'Zt-@3r(~?r.i[vwv]dU1a--U#`a4(g/vsRhPOu!5RhLj:rmu9Wo!~@:wdh@g/vsRiTjXuvvNr}:RhBj^v(pyw8unRn]dz1UYa'a+^Y(!aETZalaRY.Ta?a4[yDJw1!#qLsW>6Vyrfzq-pLflpwRe|Js>%!Dt@3Dt&Jvy_[xs~HrnjMuwpsw'RecKu+D#'!t<~Grl~?rjg5u-x,gwp{ah!-(~@:Rg~Ou!5Rh'jXuvvNr}:Rh#cW#X/c;&!#2sLi[v7u7RgpJv)(!iLrxu,Re6j7v@s@5Se[e7d`aW!Za(a`T.a#!a3!&aDa-!9)Dt_=6s+3[x~~DR|h~DS6avhGun5RkZj3w)v-]mkKunB!&*]kb97R|i<ARk<c:Z(6Vy}Juh'!wziMRoS:F|vkLuauJv5vtvQRh1d='T+Y#VyO~DR|jcF#T'7R|g97R|kJv3'!ay<Rj,Jvh&!:ReXcsa6*a+#a#_aIRf9aLRf?c,Z&Rf5Rf7c.Z&Rf;Rf>cQ#%T'p-Rf8Rf=ct#%'(*!,p,Rf4p+Rf6Rf:Rf<d~'Ua%U*^UYa(!a,-!#a4YaTalaEX0a8a<Weo3Dt/3Dsx=Br93Wen~Dr;~<5p<JwNZt2@3p=Pw:5p;Ou!5r3c7&!#:p>3Ds}KvGB)_6Vyk2sM=<r7x'eovA(!hFu1ARf}cV#X&@r5j6rvwQa^Rf3c=Za'wkghJv__g;unRggA53B9=b^}%j6uduo5Jq;!(hIv%2Re`Ou4ARe_e%a#^^^Xa&!a*a2!&a6YaP!*ad!#a:aE/5Rn?[y@>6Vyp;:pE~DrY~<5pBJwNZt8@3pCh=rt3rWPw:5pAJup_[xoNuPpF9c!#'45pD5ARn)d8#X'X*3@rU72s]h>v<<sSjJpqvewOJq/(!hNw'5ReBk0s2u3w/w'5ReE5@Jq.!a+JQ!&WeU23d(#Y&RjG5]jBk!u7w&u0udARjEe#+^^^Ub#!a2/a`Z(agT1!a-a;|@TaG!aS[yV=Re~fow'RguNuPRe?bz#'>RoUWeL>:Cbb|?JwPZtVg6ruRmzJvD'!6Vz(g/vmRh~Jvy_[y(g9voRgyx*cy(#2>Ri2B9b]~9kIw9u7rluJu3Rg]dI#a%UY'@=p%CAx.gQZ&RhwwygtRm{x5g_Z'+ABqR9Woa=Bp&dV#^*Xa'!&@o{g4v]Rk;Jv{!%Rk[wkkiA5RkiwwfUB=x,fUuqC&*!>RfTg8v0RfV~ARfSd;rJsAuAv9wR'ae+/aO!a@aza/a#[yQ@Wg!2Wemg3sEr0JvB_g>uvReWg2v+Re=KupB_+[y!2AbY~-~Hr2AJwD!(h<~El>h<~El?Kun@+_:9b`}Kg-v/Ri3g;vtwyk_9]k_d=&T#*U.6qh@Ab`|K9:H|CJv[!&3Dtex'fDwC%!Rf[9WlMd[(^X,!a%Z06Vz!@WgBg=v~Rgvg,QRe@awd,#Y+jTv|Q~EfWj]uNr|~FRfXdy#Y&^Ua%!aO.!(a)Ua;=!a@aKap!a-,a!Ta]a[rSa]p?[y82sK=Bq~;:p:~<5p8Pw:5p7d'#Y'Wf(;RnRi[u4w&RgJJvG'!6Vyh=<r#ijuuv/sIKuYD'ZtG@3p9~Gr&d2#`(g<vtRgFj`u5w&rqpxRf2CJuY!+:wfnTOu!5Rg}jNs1ucv&RfwJvA!&3@q|BDcC#T,k/unq8w8Q5RkTklwQuzunq8w8Q5Rk9dga#!a'!a=#a0!:+Tb*b@aO.a4!aba8aFJv^}?!VyR~Dr<g;u%Rn.~<5p[x'e`wNZtR@3p]Pw:5pZhNvjBp.woe_g5u-r4JwF!%DtO3:ooc7&!#:p^3DtpLuGw(!+%)Dtk6Vz#2sd=<r8d'#Y([y#<x3gJt`w@!)%}MRiowzikRij=]ilxAf3,U(#B2Rf#g0v-Rm[ck{`U#]giKv3>)!&6Ri154s,KuGB_%@r68r:dJ|t`#X(9<E|u2@H|rx3gJu?w'!+'1Nu7Reg4=H~+9<wxgY95Rm]xLggZ-`(X}U2:Ri4h<uOawRmsJv__5@bb{jbV~3dka#a'a]!,#a+U=a>b6a3b%!/aKa/)!arwve^VyJ;:pR~DpTg3uJpS~<5pOPw;5qmPw:5pNOu!5pQJvG'!6Vyx=<qoJvA!{~Jup!%@qk7Rn/KvyD!}''[xz;>wkh'?Rh,x8gyt`w5D!&),(SgyccRgztJ@3pPB5p#d'(Y#<]mmifubw&RgoJvE&!82s^JvF&!8Rf,ADb]~;x=h'rNu]vK!,%'*0RnORh)4Rh*AqQg-vaRnNg;wHwkh'ba~4cE#Ta*x3gctyw@'!+%RnFRnD<4Rn@hFvK5RnCxWg[#`&a0Ua()`1Rm75Rg[c]%X#qi8Rg^NvdRj>BwzgZauwji7Rm6A4wgg]d1#&(*,.0a#Rm;Rm<Rm=Rm>Rm?Rm@RmARmBe%#^^^Xaea?aC/b+(,!a+a#!a/!>a&Ta<aKbD!2wphBRnk[yPw}hE|.=Br-3Dtm>6Vy~g6urRf.x,hPrNav!%'RnqRo%Ro#Nu;q[Pw;5r+JwNZtM@3r)d'#Y'Weh;xChL#`&RnmRnoKu}>%(!Rne~Bs-;2wjcussJv+'!aYSO}6@B<5?ba~8LrNvj!.%*ROwungw~ng~:9;Ri^>wtnig;wHRnixDh@|(UZ.x1h@|)!#:2<H|*xHn]#-UX'3Ro)z=iT}6ARns=Bwsn_wpnaRncw]aR(#UXa&Ua*a/=]iPd'#Y&Ro'WnXf{QRm2hNvj]nZd`'T~&1`{|`#9b]{}c:'!#Wl{>@=be}]?cl{{U#:5Abb}Jds#^YaF!a*b4a#a3aPa>&Tb!bH!*a_!Eau?/a&RjY<]gj>6Vz*;:pe~DrZg,QRj1JwNZtX@wihspcJvZ&!VyX9WmOJu|!|N2WmHJvh&!]ht~Bpbcn&T(!#RmQ<s7Nu;padH#X'`+WmJ@>RmKCARhnKup=!)&Wf+:RhqNuPpf9c!#'45pd5AwghpARn(Ls@w!%,)!RmP@Wfe<E|IJva!&WmNg8vsRmLd`*.`#Y'Xa!axRn*]hrA8Rhug5s@rXg8u!RmMd8#X'X*3@rV72smdI*#UY&RmICARho~GsgxVgd)Ta'U-Y&Xa!T#RnEWnA@Wffg1uDRi0hFvK5RnBxGnG&#`%owp)@wsf+bX}Ze-*1!a*^^^Ua|!#a.aq&Ya2!a>.a6!a:aO`aJDtL[y`@Wg#>6Vz12@wzoYRoZNuPRi!NuPRhzg=ucRi,@=b`{Yg=ucRi-ACJvB!&Sh[ebSh]ebi`wUuFRm4Jw2_[y0JvB!.<Ju(!&SoG}6Shd}6<Ju(!&SoH}6She}6Kur@._g5vHRieJvx!{L2G{Kx6gd'T#?Rh82Wi5cZ#X(g1w)Rm5dW-Y(Ta#!a)!#aYa=wnfE=su2>>bU{0j9udv:<svj8uQv-7RgHdE%#^'sq9sp=>Bb_{TJv`!&g/r|snj6v(us5d,#Y(56H}[978H}]Jw5!&g1rushJvB!+j;v{u5?zDhd}6}bj;v{u5?zDhe}6}ce*#`(^^^a[aea!=!a6a*aoXb1a.!aAbL!b>,b'aL!aV@Wf|2Wlg3[y/JwNZt^@3piPw:5pgJunZou3@rsJva&!Vy_g<v~Rm#JvG'!6Vz0=<r{Ju{%!:pj@WfsiXuJu3Rm:JvZ&!WfA~Bph@c4Z&Dtwax5rubx(#:awRk1@d,#Y&RfjRfid1#,Y(@Wfp2Wlrg5s@ryKu[@!,'=]ig9wlk?Rk>g5u-rqJvy'!@9RkQcH(T#=>Ri~@<wkj(Wj(KuZB*!&<7rw@9RkRcH(T#=>Ri}@<wkj)Wj)dg(Ta2Xa9X#`-!a*CARhg@@=I}d9x;c~#X%so=<sj>2@@=aybb}XjWv0Q~EfEj3vLv;<d,#Y(56H}`978H}_dgaPaFa'a/!#a3Y0a_a;a|!1(a7-[yE3[xt;:pJNvZrrg3uJrvJwNZt=@3pIh=rt3rxPw:5pGOu!5rpJvG'!6Vys=<rz@c4Z&Dt(ax5rtJvZ!&~BpH@wsfNg-vaRlNci*U#=<wei<F}a5@Jq.!a*JQ!%@qZ23d(#Y&RjH5]jCk!u7w&u0udARjFd/prq=tyvpaEa(a:.!a1aZ(@@=I}:9wpd%=<sX55w_h}@@=I{t=ay<aU@@=I}T=ay<2@@=I})?C9:9au@9Cb]}DP~=x-fAZ(2Wl1=ay<aU@@=I}>5@d##Y+jTv|vV~EfFj]uNpn~FRfGdgaK!Z2&!a8a-Tb({E!acTbM*!a(DtY[yYd'%Y#sl[y*hHvh>Re5x2c{Z}.j4uCvcawRiMd+#X+_x&d!},<5RkX;2Hzw@x,gavfB-!{CcF&T#Roe;RodwWbBg5urRgaKvHC*_6Vz+<4opieuew&Rmq@d]&Y)X,T#X0Rh}<BqP=4qS9:ReMg/ujReNJw0!/<Jui%!bd{kawwnemRelAxUa?a3#*.&UX(Ya+a/RhvRnQ<o}9Wmtd-#Y&RgSRmw9;Rmxay=Rmyg-vaRmuxEhSrNu,v-voC!%(aR.a(a7+1Ro1>Ro5CE{A9b]{@;5x#eO{:g;urRi+KrNA!%(Ro3>Ro79;Ri_Ku@>{;&!x%gX|{KunA_+g5QRj/g3u5Rj#g>uERj%wio/xRhS&!,!#^1U}wba{8>>@=be}qC@:D5ba{7Ku+A&!}x?ba}t>>@=be}se(aA^^^Uat!b0#{pa+awUazbGa#aLb9bgaWac'a5TbS=Br!d1#`%scp_Jvl!#rT>Re0JvX&!VyN=H{Fcm#U&:pY=ReaJv2&!]h0=]nUJvG'!6Vy|=<r%JrM_=]h2@Wlud'#)U'Wf'b]{i=]h/Jvh!&~BpWg=v]RnMx+ny#'Nu;pVwjnu=]nwxJnx,T#`&Reqwjnt=]nvieu9vrRjLLuYwP(#+!th@wih5pX~Gr'g5v/Rh4KunA'!-CARnP@wwiN:Rm_9x'cvw>!|l=<saKvAA!0&3@q}>w^e1bp#&Re2Re3BDx7gH#T|f5H|eKuZ>!%(:qNAH{]Jv6!+3B2B9=b^{X<5<B92:E{ZLvhwA(a;a%!igQuyRmad+#Y}m@3Rh5d8#X'X*:AqUAHzmaxwbh<aXRnVcF}RT#Nw&cj#U(BWnug/vsRntdka)(a3+.Zb7aYYan1!bVa@Xa}[y^@b[{G=H{+hFu73Rj&Pv#5ReQcK%T#sig1v{Rj'Ku+D#'!t]~Grm~?rkKuMB!01d5#`'Vy.ta3Dtu~Hroc8#'{^45s85AwZbP&!#Rn!wghxWn#KvEA!)&2RlA2RlBx:h|#(T,=]j09Wobz>x]z/@awRoTd+#Y(az]hFhCrm4d,#Y+jTv|Q~EfMj]uNr|~FRfOdCa!Xa9_X#@<plJvf!%b`{(9;Rgwc;.!#2x7cw#T|UDb]|T5Ju={(!=@E{&Jv)&!Ab`{'awJvf!~*>>@=be{#KuY>!+&4Ezyi[ugv&RjIdea+T)#UXa&T-T&a!Rh9auRmW=]kLg5vuRn+g3u4Rn-Ow6ARn,hHus5xNk?#UX(U~)/g8v0RkD~AwkkF?Ri.OuNBwkkA?Ri/d|a2`a*^UYa.!aBTZaTa'Xa;!(!2!-a#b2[yC>6Vyq3[xr2Wi?g1rusVh%s?DtF~<5rbJs;%!DtBfswKtCj[uvuSsEu3RgVx3o:u+wN'*Zt;@3rd~Grh~?rfg8w)Lq)qE&-a%!>bI|`jWv0vV~EfCjTv|vV~Ef@j]uNpn~FRfBcK#T']gWNu7x,k7q4ai(0!hHv8<RhmkMu9vrsBuev/RhlCJvB!,g<v{wchh~@:Rhji[vrv{wchi~@:RhkdS&a5UY#Ta!RgPwwiI5BwciI~@:Rh`x'iJvj'!5]iJPu8Bwch]~@:Rhach)U#h3rp]gLh@t|Ax,hTq3ah!-(~@:Ro0Ou!5RhXj^v(pyw8unRhVd|)`,^UYas!a?/a2Z'a^Ta{Tb7Ta(a#!a,Wf&9sZ3DtAadamov=Bqt3[xig8vsRm~>waiL2b`{QJv*_Ouv2qgj<v]v2BqfdR'X*X#Y-@3qr~Gqv~?p6hHv-]glPup5Lq+q?_%*b_{qF{n9b^{rOu4ARhpKvCD!+&~Bqp:5Dbb}nwoiKl&unuTuBv]v+ueunaXRf0=Jvh!0nKufu8v1w&w7q%w&uHrz:Rgnj5w,uxDJq/(!hNw'5ReCk0s2u3w/w'5ReFd>Za&!*UaA=<wkgsRnSJv^!%Refifw3vyRgOKu_B'!,<]gkiiu:w&Rh<=C@a^<B57@2F{[<B5@aW:=3away9A5aW=<B=C@a^<B57@2F{Ie-#`(^^^bCara.b8aza6!/bZ,!adTbnTbOb+aFaS!aAT9@Wf~2Wli3Dtl2@d,#Y&RfnRfmJwJZtN~GqyJva&!VyMg<v~Rm%iXuJu3Rm9Jv[_=]ih9wlkDRkCd1#`(@Wg>2Wls3cH#T(@<Rj*=>Ri|b~'#23s9h<~El.d'#Y&Dtxi^rzvdRl#d*#U%(o|B2s`hJwSaxRmDKv4B&!1:Rmdd5#`'Vx}to~Hq{x'f1v3(!BA5ba|bJv_&!Wfug1v]ReIdO+U/Y#&G}-8wze=Rh{g1v]ReHg/uQRf/by#)ibQwERl/cH#T(@<Rj+=>Ri{cNu+vlax-!(#a0qa9<Rii2;;bU{H;x<i=&X#Rk`<4wwi=C9H~8xAI(Y#<azRi@45wXI<B9;5bb~7dL(X#Xa(+!aL6Vy{g5QqOau:5au2@ay547EzbxOcU(UX-T#Ta#:Cbb|A?wjh/b_|SOw6ARgtihr}u7Rhy<d1#T)X1@@=I|~=ay<2@@=aybb}Sj3vLv;<d,#Y(56H}A978H}@dGpvs@uAu`vcw9*!aFa+ai%(b!aXa8.a?a[ozWey=sU2@G}Nch&U#Rf_WexKu+D#'!t:~Gr`~?r^j]uNr|~FRg*j^psurwJt|RmcKv)@&!)7Rkv~Br[@wxfO:Rl3co#U'6Rezj_q#vIuavjRltwzeyh@vr5JqD0!>aY?C9:9au@9Cb]}9cl#U*5;5<H||jbuus1ucv&Rfvg1v~d/pppzqFr^a--a~!aMat1(hFv;Wiz@@=Izoj5uuv-7Rix~Cw`fk2WlVcZ#X,k)u3vWs@u2]ktg;wEx'fBq(_2Wg/jTv|vV~EfoJv]!15x'hzqG!(P~EfU~CRl_j6v(us5x4i-#T(2WmZ?C2F|d>Kq<aj1!*jTqIsBv=Wl`~Cw`fi2WlWj`v0u*~>RlR=c>Z,k#u3vWs@u2]kr<c1Z+jTqIsBv=Wla~Cw`fm2WlXdmb3!a{(arZa`bkTa%TbQTa-a9+c'!aM!/[yL=Bqug.w'RifhFvyDRj.g>vgwyk^9]k^Jv3_@WfbAARkhJw2_[x|JvB_wkoIRoKwkoJRoLd'(Y#<]gm=<9<H|yd'%_X#skDtb3awwqkgNulRkgdB#^',9:p'hJwSaxRmEBwVb8@4=H|qLu+w50&!)@3qs~?pU>Awwn;;Rn=c:Z'ARn<=<qwKvC@!/&~BqqJv6!&]eVb^z^xRge'/a%+^`#Sge}6<4Rn3=]n0Pw2>Rn8Jw0!&>Rn:>Rn6cY#a7+!a&=<wkaNw~h3z_c5Z{=wjh#=]nLKv^D!&)Vyz=bW|swYb<WetcG#T(2wxa@qVx@gD#Y&b^|V5JwG&!5bb|pg/w&RgD@x=kHs=uAvn!a%%/'+RmSRh694Ro`g-vaRmRhHv-]mlxCcS#`&ba~.5cD#Ta)P~=d,#Y(56H{>978H{Dd_#{2^Y%_+qbbb{6g3sERhsbU{?dfa.,`a(Xa<!aiX#(55RiG54RiHcI#T'WiU3RiVNvdwtfcRlKNvdd,#Y&RlHRlExQgf.1*^T'X#Sgf}6Wn4=]hfPrk>Rn7Jw0!&>Rn5>Rn9Lunw?&a2!,5<oq@@wqfdRlJj5Q~=d,#Y(~ARfcOuN]fdDKw;ay(}i!547E}j?cI#T(@5bV}iCbV}hdv(^^Tb?a40,b##Tbo!a*bR!a<b|a/!aKai!aU[yK=]o^g:v>ReGJwPZtK<7Rh+h<~El,Pv#5ReR@awwxjCg,ulRjDJv6&!]j!z?aQeeg>w=Sh<eeJw;!&axEzOg,Qosc!#*:wkeJ]eJ>x'h-u(!%Ro.w~h.zPdNZ(X,Ya![x{;9ReY;wkgxRiF:x?ap#Y&RmUg<s2Rkod]+UY0TZ'!a&A9sw<=bczLNvuw{gqzNhJwSaxRmCKuLay!#&s_Rf-55b^{uJvZa!!c%#(55Ri654wmiu5RiuawLu,vp!+}^%b_}Y9;wkgxba}o>A9:=b^}zKuh=a''!3awRk3c*'!#aHRk6c+Z&Rk5Rk4Jv)&!awRjSawd9*`#0?C2@EzMj8u<uJ5RmbjQrquJu3x,k>uq@_+=ayb^|W~ARkEOuN]k@7dhzV^X/X&a-#zRzSb`zXcJzTT#2WkVKvDBzW!%FzY9;5bbzWjQrquJu3Jw3%!b`zU=ayb^zQd:#X(T-a!6Vyywxh}=b]{Jg=u1RiAdGp~qHtzv!w(wA+a+a;<!aJaYai'anasb(=azRmV:Cbb{MLq2vb!%')RjuRjrRjtRjqx3jnqCw3!%')Rk(Rk+Rk&Rk)Lq2vb!%')Rj{RjxRjzRjwLq2vb!%')RjsRjpRjfRjex3jcqCw3!%')Rk'Rk*RjkRjl9<CbbzfOu4ARhxLq2vb!%')RjyRjvRjhRjgx=joq*uKvb!%')+-Rk.Rk%Rj~Rk-Rk#Rj}x=jdq*uKvb!%')+-Rk,Rk!Rj|RjmRjjRjidAq&qKs@uAv8Aa.'*-a@a&0!aM@a5[y73Dsy3Ds|3Dt):wxgI2sHJwJZt.~Gqxwsf0ikrzt}Rl0Jvy_[xj~HqzKv_A|D!&WfP8axRoVcf,U#k(v]v+ueunaXRf1Ju}'!g8u#Ri=jQw!sCunLprq>!,')~<5qeGzq9F{W=c##%s5au:5aU3CBE|;d4#X(D!a&6Vygx(b;#(=]ed?C2F{N<capoq2r[a&!aPa9,'Pw;5s:@@=I|,55w_h|@@=IzcP~=x'fCqB_2Wl2>aU@@=I|1OuNBc1Z+jTqIsBv=Wlc~Cw`fl2WlZ~AcTa%!Z+jTqIsBv=Wlb~Cw`fh2WlYk+uNqJsBv=WlSg,u3dca3#UXaMYa)TaB-=cM|7T#<bI}l5@B932:aV2G{BOuNBJq:|M!5Ezt=<B=C@a^<B57@2F{v>cB{/T#=ay<bI{3Jv6!a.6BKq0ah&+!5E}HP~Ef{978BaU@@=Iza<7d#.Y#978BaU@@=IzH~AJq0!(@@=IzG978BaU@@=IzFe,aU*Y&^^^bvJb,b:bFad!a,c2Ta>aL.bo6!a#CbTa'T#Re{2Wlh2@G{yg6t~Ro_NvdRfticuRQRllJv3&!x&c|zs@Jw3!%RflwpfkRlpKuL;%(!Re<@G|C2GzdhIvuBwgjAg-u0RjAKQB%!(GzZ@G|5NuuRl7d='T+Y#Vy[g<v~Rm!==G|>JvA!)@wma=]m1ifuaw&RmnLs@vT'!|/+[y,g:v>ReTJw1!#qX=x!eC{bLu+wT&)ZtZauq_~Graci&U#F|89:r_Lupvq!.)&2RlG8RfaC=x!eF{_h?rpWlmd&'!#X|&]k::xJey#`'T|+<E|&2@H|%dE#(^,g;u.RiEg6vjRiC9xCkA{O|zY#g=ucRmXKs0@!&*@G|m@awRknJuh!,3d(}gY}eJvj!%Rm):Jw3!%Rm+Rm-Ls0w(&!a(a#@b[|6cZ#X'7RkxWgAOu4ARn'dH'U#Y*Vz-Wm'CARm}d]*#a%^a*T'aK!a<9bV{PC=p*Jw4!&SgxcbB5r]idw(wBRmF7xFkt#&`(Rm/Rm8E|!JuY_9:Rl5=wrgr2:bbxd@xXfB(a*#T+!.X0X1Ta/a'T&RlDRfL>RlyARl9b[z[>RfZ:RlL:RfRwlg/ARl;9;RlxKv,A/!%7s69<74=BA5ba{-8Bde#`a<XaKYa1,a'P~=wxfB2bZ}}?C972@@=I}r8@55B9;5bb}G978B2@@=aybb}3j3vLv;<Jw3&!>Rfk=ayb^}4~Ad1#`*@@=aybb{w2@>==<bbz]dx+UY#^UaF!a9!bB'Ya1.!ajXa#%olRhD[y=3Dt#Ov5BrHKuMB%!(Rf^Wep~HrJwkiQjKr|~FRg)Ku+D#'!t5~GrF~?rDdV)UY,Z/_7RkuG{<~BrBg,rlsO:235B@bX}|d?a1!#`(6Vyn5@d##Y+jTv|vV~EfIj]uNpn~FRfH7Lq2vb1!a9-978BaU@@=Iz9978BbU}#~AJq0!(@@=Iz8978BaU@@=Iz7~AJQ|}!978BbU}!JvkaK!AdUa21-U#`a+(g/vsRn~Ou!5RPj:rmu9WhOjXuvvNr}:RhAj^v(pyw8unRn[kPr}p|u7vwv]RiSBd;pppzq@qHQa?(b.!a.a`@.|xa(hFv;Wiyj5uuv-7Riw~Cw`fg2WlU978BbU|wOuNBJqG!(P~EfD~CRlQcZ#X,k)u3vWs@u2]ksg;wEx'f@q1_2Wg.j]uNpn~FRfqJv]!15x'h{qG!(@@=IzK~CRl^j6v(us5x4i,#T(2WmY?C2F{1>Kq<aj1!*jTqIsBv=Wld~Cw`fj2Wl[j`v0u*~>RlT=c>Z,k#u3vWs@u2]kq<c1Z+jTqIsBv=Wle~Cw`fn2Wl]dn1#c(a(b^a2!b/bAT(bj!aDa7bu,a_a{c0!2T0g:v>ReD2@G{42@G{5~DpM~<5rc=Bx6i>{RT#RnI@zCx]y]z:2Jv[!zr5Awyk]9]k]dD(Y+X#6Vz.g=wKtgwhaCwgmTWj2Lu,w%_+/[y-B;b^xeg3u3Rj-2@bX{*KrJ<!+'@Wg(g?QRlC@Jv`!%b[zIwsfII}8JQ_@w|kW|=Jv(%!AqcOuNBJvEzh!bYzjLs@wP#(0!oy@>RkdJwMZtc3Dtd@BcG#T'9bWxg2@2Fznd*#Y+;2x'c}w<zizixNgwa#Z'U+!/!a'!a+w~g~z6wcn{Rn}wcnzRn|5Rh%=]nJg5vuRmvNvdRlvcprJu}w*az*a#!%.a.'Bot9qT]kj@Wg'ay2Gzv@Jv`!%b[zEwsfHI}1;ck#Ux`<Cbbx_Lu+w!a&0*!wko*wwo,So,}6Juqxf!E}PigQuyRm`d3(`#8>Rn%:A5B;bZ~%KvhCa!a2!x>k7#Uxb@b{#xaRk7Jw0!)>wwhlShl}6>wwhmShm}6CJvB!.x'hhvj{!!5Bwkhhbaz}x'hivjz~!5Bwkhibaz|xEhTrNu,v-vpD!a%&/)a3a.,%Ro2t[CE{)@3re9b]{%wjo09:rgc:Z&Ro6=<riifuaw&RmoKrNA!%(Ro4>Ro89;Ri`dSaL'UYzxZb)7Rka3xRhT&!,!#^1U}vbaz{>>@=be}yC@:D5bazzKu+A&!}{?ba}y>>@=be}wxBh[t`u~vJvr!%a!a()a,a0a4RoC=]o;Ju(!%RoGRhdwjh`=]oAg>w#Ro?g5vuRo=NvdRl|Ku]C.!&;RoEJvB!%RoORoMBx'h[v+_?w~h`}~5?w~hd~!xKh]oiptu-utv.vp!#%&a30a@a'a+(a/aOp(o~p!RoDJu(!%RoHRhewjha=]oBNvdRl}g>w#Ro@g5vuRo>c[#X']o<CauRoRAd-#Y':RkpauRoQKu]C.!&;RoFJvB!%RoNRoPBx'h]v+_?w~ha}t5?w~he}ue!/UbhYacXaW^Tc&a;b:a-c/#b&aja1(!cL+!bKbt!bmcRc9aIc?8[yW3Dtt94Rg`Jv}!&SiRMzBhEebShEMNuPRe>x7gL#TzuwjirRipc<Z&>on;>z=h-MSh.Mwqczx'a7vj&!>Re4@=ResJt__NuPRi*NuPRi)j]uNr|~FRfzKrJ>_+@Wfy@Wf]2WocKrJ<!+'@Wg%g/QRl@@Jv`!&awRl<wsfFIzgLu(w*!.*&ShBMwvhIRhI9;RhNx1hK'!#Sn]Mx1hK~0!#:2<H~7cNu+w7D*'1ZtW>Rn1~?rOc:Z&Rn2=<rQ<7wjh&=BSnLMc]#X(6Vz)w[b=a!U#9wzgMc3#&(RgMRitRis<x,gKt`ax!&+SioM=BSilMc3#&(RgKRinRimKurB,!&SiQMzBhDebShDM6BJQ!(P~Efx978B2@@=I}WLrJw!!,a*&@G}O@9wkibRid@@x'fKwC!&SlDMSfLMjUv~Q~EfKKv3@a+!(hFv-]mpx/hYZ(C5RiWz<o/MwkhY?So/M@x,gbvfB*&!SgEM:SoeeehFu3:Rgbda(,^TZa)X/7Sg[eb:2RgI~BrMC@wgkc:wwkcRerx3h(uUvK!&*,SnOM4Sh*MArRg;wHRh(x=h;rJvPwI!a4',a'0@Wg&=BSh/Mg>w=Rh=g3w*wwgGRgGcW(X#;Sg}M2Gzk@Jv`!&awRl=wsfGIz`dKZ*T'Y-:RhR7RhQg5u-p`j6v(us5d,#Y+~Awkia?RicOuNBwkibba}Ld6p~tyu_vbAa'a+!a/'a3aEa8a!>Sh,ebJv{!&Sh@ebSaReb9;SgwebNuPRi(NvdRl)NuPRi'hHu^<Rm^Jvv_@Wl(g;u1Si/ebKu'B&!*Sh?eb@Wl'z@aPeb95Si.ebcpputyvjB)!,&a+0a%ShAMWeK@G}C@WfJ9;RhMwvhH9w{ia}ix,hJvRA1(!zAn[MRhHx1hJ~*!#hFv(BSn[MBJQ!(@@=I~'978B2@@=I}2db.Ua<'X}+T#a0XaG2G}E;wkg|wuh!Rh!x,hZu,@)!&So0MVy)C5RiXACJvB!&5RiY5RiZg8w)cG}*T#2@bU}=KsA>(!a.3wkhZba~(x,h^u(A!&(SoCMRhb5Bz=h[eb?w~hb~6x,h_u(A!&(SoDMRhc5Bz=h]eb?w~hc~6e)aA1T#T,^^^c-bMb&blcPaP(a/!0!bA=b5c@a(!bfbrc#2afwmhARnjwchORnp2Wlf3DtsNvdRl-2@wpa<]m0bx(#:awRk2@Jw3!%RfhwpfgRlnKQB%!(G{V@G|'NuuRl6d='T+Y#VyUg<v~Rl~==G|<Jv+'!aYShC}6@B<5?ba~8@Jw3'!g2QRljhLrpWlOd+#Y'g.w'rIg>w*wgj@g-u0Rj@Lu+wT&)ZtUauq]~GrGci&U#F|39:rELrNvj!.%*RhCwunfw~nf~:9;Ri]>wtnhg;wHRnhx3hDs@v~!/+'@Wfr@9RkSNu&Rlo=@<5GzoKs0@_+@Wl+@awRkmJuh!-3d(}pY#qWJvj!%Rm(:Jw3!%Rm,Rm*de&!1U-U#`)Re;@G|.@9Ri82@wjfvRlq=@<5GzpLvOvr!).&2RlF8Rf`C=x!eE{.Jw3_g2QRlkhLrpWlPde(!#U{s,UXa*Ta'[y'g:v>ReS;x0PZ&RnlRnn~HrKJw1}f!=x!eB|2w]aP(#Xa&a*Ta.Ua2a7=]iOd'#Y&Ro&WnWg;u.RiDg6vjRiBNvdRlzhNvj]nYJuW_2Wm3x)kFze{9d])!a.!,Y01!#&aC!a3RndC=ox~BrC@2b^{pg,rlse7x'ksuq!%Rm.E{xidw(wBRmGx9o+)X#wwo-So-}69:Rl4@xSf@a#XZ'X)X,Ta(/ARl8b[xc>RfY:RlI:RfQwlg.ARl:9;Rlwdn'#^XafaQa1X1TaHTa)@b[{zcZ#X'7RkwWg@Ou4ARn&x)kG#{,g7u/RkGdH'U#Y*Vz'Wm&CARm|bx#(A]gUbUzJj9Q~=d,#Y(56H}l978H{U7d,0#U*2>ABb_xZ978BbU{e~AJQ{g!978BbU{hxMh?ad{oUYZ.x1h?{l!#:2<H{mx3n[t{vl!,&a%3Ro(z=iS}6ARnr=Bwsn^wvn`Rnbd`*T}B0!#^X'BG{c9b]{a>>@=be}F?JvS!&BG{d7BG}(Bde#`a1X,Ya@!a'P~=wxf@2bZ}I56B2@@=aybb}08@55B9;5bb}<j3vLv;<Jw3&!>Rfg=ayb^}&OuNBKuLA!)a!P~=x#fD{f2@>==<bbzl?C972@@=Ix^d6rSu,v7w*C(0a)a6#B+a%!sQ[y?3Dt%3[xn~<5rLOu!5p@Ku+D#'!t7~GrP~?rNKvlaya7'!h+v-5qMg=t|cd,U#5AAaa5Abb{S@52B5@a[@52B5Gx[iXueu;d<#`a(!/549C;ag>23ExY5@Dah89b^~689Jv)!~2b[~1Lv'w(%*!a#bX|aPrmawRe]keu7uhv-q6rxu,q`xTo]/a5aU!bNaDXbi!b-!ao!b<bwA!#5@B932:aV2G|:d-)Y#hJrL>RhG<7@C5<H|_=Cau:5aj5@B932:bJ|ng>vIbs)#?C2F|9jPv0w.vISh-MKvUaz(.!9ABbb|[5;5<H|Eg>unwfh;9:4E|YjQsBt|vjx'hYq3!(?C2F|J:2<BaY?C2F|GOu!5x,g|p{ah!-(?C2F|c9:4E|OjXuvvNr}:Rh&i[w*t|cd+U#jJvsu)vsSn~Mkfrmu9p}u7vwv]So!McW#Xa!ax5@A5aY:5;5<H|>kJv~vYrquJu3x4ib#T)2@SmZM?C2F|Bj:rmu9@xPhI(a*a#U#`a3-5Abb|L~@:RhK9:4E|0@52B5G|#C::aY?C2F|-:2<BaY?C2F|.5Jvk!a)javYrquJu3x4ia#T)2@SmYM?C2F|HAxPhH(!a#U#`a*-5Abb|4~@:RhJ9:4E|R@52B5G|F:2<BaY?C2F|Sc^#Xa2j=Qq5CJvB!-g<v{z;hhM?C2F|Zi[vrv{z;hiM?C2F|XKsA>!a)-g<v{z;h[eb?C2F|]i[vrv{z;h]eb?C2F|^iZu.vix,hZq3ah!.(?C2F|QOu!5ShXM:2<BaY?C2F|P", 13494, 2713, 49, 25, 61);

// node_modules/entities/dist/generated/decode-data-xml.js
var xmlDecodeTree = /* @__PURE__ */ new Uint16Array([
  512,
  26465,
  29036,
  7,
  0,
  2,
  4,
  116,
  24638,
  116,
  24636,
  8693,
  29807,
  24610,
  621,
  1,
  0,
  0,
  3,
  112,
  24614,
  111,
  115,
  24615
]);

// node_modules/entities/dist/internal/bin-trie-flags.js
var BinTrieFlags;
(function(BinTrieFlags2) {
  BinTrieFlags2[BinTrieFlags2["VALUE_LENGTH"] = 49152] = "VALUE_LENGTH";
  BinTrieFlags2[BinTrieFlags2["FLAG13"] = 8192] = "FLAG13";
  BinTrieFlags2[BinTrieFlags2["BRANCH_LENGTH"] = 8064] = "BRANCH_LENGTH";
  BinTrieFlags2[BinTrieFlags2["JUMP_TABLE"] = 127] = "JUMP_TABLE";
  BinTrieFlags2[BinTrieFlags2["VALUE_MASK"] = 8191] = "VALUE_MASK";
})(BinTrieFlags || (BinTrieFlags = {}));

// node_modules/entities/dist/decode.js
var CharCodes;
(function(CharCodes3) {
  CharCodes3[CharCodes3["AMP"] = 38] = "AMP";
  CharCodes3[CharCodes3["NUM"] = 35] = "NUM";
  CharCodes3[CharCodes3["SEMI"] = 59] = "SEMI";
  CharCodes3[CharCodes3["EQUALS"] = 61] = "EQUALS";
  CharCodes3[CharCodes3["ZERO"] = 48] = "ZERO";
  CharCodes3[CharCodes3["NINE"] = 57] = "NINE";
  CharCodes3[CharCodes3["LOWER_A"] = 97] = "LOWER_A";
  CharCodes3[CharCodes3["LOWER_X"] = 120] = "LOWER_X";
})(CharCodes || (CharCodes = {}));
var TO_LOWER_BIT = 32;
function isNumber(code) {
  return code - CharCodes.ZERO >>> 0 <= 9;
}
function isHexadecimalCharacter(code) {
  return (code | TO_LOWER_BIT) - CharCodes.LOWER_A >>> 0 <= 5;
}
function isAlpha(code) {
  return (code | TO_LOWER_BIT) - CharCodes.LOWER_A >>> 0 <= 25;
}
function isEntityInAttributeInvalidEnd(code) {
  return code === CharCodes.EQUALS || isAlpha(code) || isNumber(code);
}
var EntityDecoderState;
(function(EntityDecoderState2) {
  EntityDecoderState2[EntityDecoderState2["EntityStart"] = 0] = "EntityStart";
  EntityDecoderState2[EntityDecoderState2["NumericStart"] = 1] = "NumericStart";
  EntityDecoderState2[EntityDecoderState2["NumericDecimal"] = 2] = "NumericDecimal";
  EntityDecoderState2[EntityDecoderState2["NumericHex"] = 3] = "NumericHex";
  EntityDecoderState2[EntityDecoderState2["NamedEntity"] = 4] = "NamedEntity";
})(EntityDecoderState || (EntityDecoderState = {}));
var DecodingMode;
(function(DecodingMode2) {
  DecodingMode2[DecodingMode2["Legacy"] = 0] = "Legacy";
  DecodingMode2[DecodingMode2["Strict"] = 1] = "Strict";
  DecodingMode2[DecodingMode2["Attribute"] = 2] = "Attribute";
})(DecodingMode || (DecodingMode = {}));
var EntityDecoder = class {
  decodeTree;
  emitCodePoint;
  errors;
  /** The current state of the decoder. */
  state = EntityDecoderState.EntityStart;
  /** Characters that were consumed while parsing an entity. */
  consumed = 1;
  /**
   * The result of the entity.
   *
   * For named entities: the trie index of the best legacy match so far
   * (0 = none). For numeric entities: the accumulated code point.
   */
  result = 0;
  /** The current index in the decode tree. */
  treeIndex = 0;
  /**
   * Characters consumed since the last recorded legacy match, plus one.
   * Invariant at the top of the `stateNamedEntity` loop: `excess` equals
   * the number of unrecorded consumed characters + 1.
   */
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: False positive (read via destructuring)
  excess = 1;
  /** The mode in which the decoder is operating. */
  decodeMode = DecodingMode.Strict;
  /** The number of characters that have been consumed in the current run. */
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: False positive
  runConsumed = 0;
  constructor(decodeTree, emitCodePoint, errors) {
    this.decodeTree = decodeTree;
    this.emitCodePoint = emitCodePoint;
    this.errors = errors;
  }
  /**
   * Resets the instance to make it reusable.
   * @param decodeMode Entity decoding mode to use.
   */
  startEntity(decodeMode) {
    this.decodeMode = decodeMode;
    this.state = EntityDecoderState.EntityStart;
    this.result = 0;
    this.treeIndex = 0;
    this.excess = 1;
    this.consumed = 1;
    this.runConsumed = 0;
  }
  /**
   * Write an entity to the decoder. This can be called multiple times with partial entities.
   * If the entity is incomplete, the decoder will return -1.
   *
   * Mirrors the non-streaming `decodeWithTrie`, but with the ability to stop decoding if the
   * entity is incomplete, and resume when the next string is written.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The offset at which the entity begins. Should be 0 if this is not the first call.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  write(input, offset) {
    switch (this.state) {
      case EntityDecoderState.EntityStart: {
        if (input.charCodeAt(offset) === CharCodes.NUM) {
          this.state = EntityDecoderState.NumericStart;
          this.consumed += 1;
          return this.stateNumericStart(input, offset + 1);
        }
        this.state = EntityDecoderState.NamedEntity;
        return this.stateNamedEntity(input, offset);
      }
      case EntityDecoderState.NumericStart: {
        return this.stateNumericStart(input, offset);
      }
      case EntityDecoderState.NumericDecimal: {
        return this.stateNumericDecimal(input, offset);
      }
      case EntityDecoderState.NumericHex: {
        return this.stateNumericHex(input, offset);
      }
      default: {
        return this.stateNamedEntity(input, offset);
      }
    }
  }
  /**
   * Switches between the numeric decimal and hexadecimal states.
   *
   * Equivalent to the `Numeric character reference state` in the HTML spec.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  // eslint-disable-next-line unicorn/consistent-class-member-order
  stateNumericStart(input, offset) {
    if (offset >= input.length) {
      return -1;
    }
    if ((input.charCodeAt(offset) | TO_LOWER_BIT) === CharCodes.LOWER_X) {
      this.state = EntityDecoderState.NumericHex;
      this.consumed += 1;
      return this.stateNumericHex(input, offset + 1);
    }
    this.state = EntityDecoderState.NumericDecimal;
    return this.stateNumericDecimal(input, offset);
  }
  /**
   * Parses a hexadecimal numeric entity.
   *
   * Equivalent to the `Hexademical character reference state` in the HTML
   * spec. Digit parsing matches the hex loop in `parseNumericEntity`.
   * The accumulated value is preserved for numeric validation callbacks.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericHex(input, offset) {
    const inputLength = input.length;
    let { result } = this;
    let { consumed } = this;
    while (offset < inputLength) {
      const char = input.charCodeAt(offset);
      if (isNumber(char) || isHexadecimalCharacter(char)) {
        const digit = char <= CharCodes.NINE ? char - CharCodes.ZERO : (char | TO_LOWER_BIT) - CharCodes.LOWER_A + 10;
        result = result * 16 + digit;
        consumed += 1;
        offset += 1;
      } else {
        this.result = result;
        this.consumed = consumed;
        return this.emitNumericEntity(char, 3);
      }
    }
    this.result = result;
    this.consumed = consumed;
    return -1;
  }
  /**
   * Parses a decimal numeric entity.
   *
   * Equivalent to the `Decimal character reference state` in the HTML
   * spec. Digit parsing matches the decimal loop in `parseNumericEntity`.
   * The accumulated value is preserved for numeric validation callbacks.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNumericDecimal(input, offset) {
    const inputLength = input.length;
    let { result } = this;
    let { consumed } = this;
    while (offset < inputLength) {
      const digit = input.charCodeAt(offset) - CharCodes.ZERO;
      if (digit >>> 0 > 9) {
        this.result = result;
        this.consumed = consumed;
        return this.emitNumericEntity(digit + CharCodes.ZERO, 2);
      }
      result = result * 10 + digit;
      consumed += 1;
      offset += 1;
    }
    this.result = result;
    this.consumed = consumed;
    return -1;
  }
  /**
   * Validate and emit a numeric entity.
   *
   * Implements the logic from the `Hexademical character reference start
   * state` and `Numeric character reference end state` in the HTML spec.
   * @param lastCp The last code point of the entity. Used to see if the
   *               entity was terminated with a semicolon.
   * @param expectedLength The minimum number of characters that should be
   *                       consumed. Used to validate that at least one digit
   *                       was consumed.
   * @returns The number of characters that were consumed.
   */
  emitNumericEntity(lastCp, expectedLength) {
    if (this.consumed <= expectedLength) {
      this.errors?.absenceOfDigitsInNumericCharacterReference(this.consumed);
      return 0;
    }
    if (lastCp === CharCodes.SEMI) {
      this.consumed += 1;
    } else if (this.decodeMode === DecodingMode.Strict) {
      return 0;
    }
    this.emitCodePoint((this.decodeTree === xmlDecodeTree ? replaceCodePointXML : replaceCodePoint)(this.result), this.consumed);
    if (this.errors) {
      if (lastCp !== CharCodes.SEMI) {
        this.errors.missingSemicolonAfterCharacterReference();
      }
      this.errors.validateNumericCharacterReference(this.result);
    }
    return this.consumed;
  }
  /**
   * Flush locally-tracked walk state back to the fields, then emit the
   * recorded legacy match or reject (cold path — at most once per
   * entity). Called after failed navigation (leaf node, branch miss, or
   * compact-run mismatch). In attribute mode, reject if no legacy was
   * recorded at the current node, if we descended past it, or if the
   * pending input character is an invalid attribute terminator.
   * @param consumed Locally-tracked consumed count.
   * @param excess Locally-tracked excess count.
   * @param char Pending input character (may be the mismatching char).
   * @param valueLength Value length at the current trie node.
   */
  flushAndEmitLegacyOrReject(consumed, excess, char, valueLength) {
    this.consumed = consumed;
    this.excess = excess;
    return this.result === 0 || this.decodeMode === DecodingMode.Attribute && (valueLength === 0 || excess > 1 || isEntityInAttributeInvalidEnd(char)) ? 0 : this.emitNotTerminatedNamedEntity();
  }
  /**
   * Parses a named entity.
   *
   * Equivalent to the `Named character reference state` in the HTML spec.
   * @param input The string containing the entity (or a continuation of the entity).
   * @param offset The current offset.
   * @returns The number of characters that were consumed, or -1 if the entity is incomplete.
   */
  stateNamedEntity(input, offset) {
    const { decodeTree } = this;
    const inputLength = input.length;
    const isStrict = this.decodeMode === DecodingMode.Strict;
    let { treeIndex } = this;
    let { excess } = this;
    let { consumed } = this;
    let current = decodeTree[treeIndex];
    while (offset < inputLength) {
      while ((current & (BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13)) === 0 && (current & BinTrieFlags.JUMP_TABLE) !== 0) {
        const char2 = input.charCodeAt(offset);
        const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
        const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
        if (branchCount === 0) {
          if (char2 !== jumpOffset) {
            return this.flushAndEmitLegacyOrReject(consumed, excess, char2, 0);
          }
          treeIndex += 1;
        } else {
          const slot = char2 - jumpOffset;
          if (slot >>> 0 >= branchCount) {
            return this.flushAndEmitLegacyOrReject(consumed, excess, char2, 0);
          }
          const stored = decodeTree[treeIndex + 1 + slot];
          if (stored === 0) {
            return this.flushAndEmitLegacyOrReject(consumed, excess, char2, 0);
          }
          treeIndex = treeIndex + branchCount + stored & 65535;
        }
        current = decodeTree[treeIndex];
        offset += 1;
        excess += 1;
        if (offset >= inputLength)
          break;
      }
      if (offset >= inputLength)
        break;
      if ((current & (BinTrieFlags.VALUE_LENGTH | BinTrieFlags.FLAG13)) === BinTrieFlags.FLAG13) {
        const runLength = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
        let { runConsumed } = this;
        if (runConsumed === 0) {
          const char2 = input.charCodeAt(offset);
          if (char2 !== (current & BinTrieFlags.JUMP_TABLE)) {
            return this.flushAndEmitLegacyOrReject(consumed, excess, char2, 0);
          }
          offset += 1;
          excess += 1;
          runConsumed = 1;
        }
        while (runConsumed < runLength) {
          if (offset >= inputLength) {
            this.treeIndex = treeIndex;
            this.excess = excess;
            this.consumed = consumed;
            this.runConsumed = runConsumed;
            return -1;
          }
          const charIndexInPacked = runConsumed - 1;
          const packedWord = decodeTree[treeIndex + 1 + (charIndexInPacked >> 1)];
          const expectedChar = packedWord >> ((charIndexInPacked & 1) << 3) & 255;
          const char2 = input.charCodeAt(offset);
          if (char2 !== expectedChar) {
            this.runConsumed = 0;
            return this.flushAndEmitLegacyOrReject(consumed, excess, char2, 0);
          }
          offset += 1;
          excess += 1;
          runConsumed += 1;
        }
        this.runConsumed = 0;
        treeIndex += 1 + (runLength >> 1);
        current = decodeTree[treeIndex];
        continue;
      }
      const valueLength = current >>> 14;
      const char = input.charCodeAt(offset);
      if (valueLength !== 0) {
        if (!isStrict && (current & BinTrieFlags.FLAG13) === 0) {
          this.result = treeIndex;
          consumed += excess - 1;
          excess = 1;
        }
        if (char === CharCodes.SEMI) {
          return this.emitNamedEntityData(treeIndex, valueLength, consumed + excess);
        }
        if (valueLength === 1) {
          return this.flushAndEmitLegacyOrReject(consumed, excess, char, valueLength);
        }
      }
      const next = determineBranch(decodeTree, current, treeIndex + (valueLength || 1), char);
      if (next < 0) {
        return this.flushAndEmitLegacyOrReject(consumed, excess, char, valueLength);
      }
      treeIndex = next;
      current = decodeTree[treeIndex];
      offset += 1;
      excess += 1;
    }
    if (!isStrict && current >>> 14 !== 0 && (current & BinTrieFlags.FLAG13) === 0) {
      this.result = treeIndex;
      consumed += excess - 1;
      excess = 1;
    }
    this.treeIndex = treeIndex;
    this.excess = excess;
    this.consumed = consumed;
    return -1;
  }
  /**
   * Emit a named entity that was not terminated with a semicolon.
   * @returns The number of characters consumed.
   */
  emitNotTerminatedNamedEntity() {
    const { result, decodeTree } = this;
    const valueLength = decodeTree[result] >>> 14;
    this.emitNamedEntityData(result, valueLength, this.consumed);
    this.errors?.missingSemicolonAfterCharacterReference();
    return this.consumed;
  }
  /**
   * Emit a named entity.
   * @param result The index of the entity in the decode tree.
   * @param valueLength Encoded value length (header plus any value words).
   * @param consumed The number of characters consumed.
   * @returns The number of characters consumed.
   */
  emitNamedEntityData(result, valueLength, consumed) {
    const { decodeTree } = this;
    this.emitCodePoint(valueLength === 1 ? decodeTree[result] & BinTrieFlags.VALUE_MASK : decodeTree[result + 1], consumed);
    if (valueLength === 3) {
      this.emitCodePoint(decodeTree[result + 2], consumed);
    }
    return consumed;
  }
  /**
   * Signal to the parser that the end of the input was reached.
   *
   * Remaining data will be emitted and relevant errors will be produced.
   * @returns The number of characters consumed.
   */
  end() {
    switch (this.state) {
      case EntityDecoderState.NamedEntity: {
        return this.result !== 0 && (this.decodeMode !== DecodingMode.Attribute || this.result === this.treeIndex) ? this.emitNotTerminatedNamedEntity() : 0;
      }
      // Otherwise, emit a numeric entity if we have one.
      case EntityDecoderState.NumericDecimal: {
        return this.emitNumericEntity(0, 2);
      }
      case EntityDecoderState.NumericHex: {
        return this.emitNumericEntity(0, 3);
      }
      case EntityDecoderState.NumericStart: {
        this.errors?.absenceOfDigitsInNumericCharacterReference(this.consumed);
        return 0;
      }
      default: {
        return 0;
      }
    }
  }
};
function determineBranch(decodeTree, current, nodeIndex, char) {
  const branchCount = (current & BinTrieFlags.BRANCH_LENGTH) >> 7;
  const jumpOffset = current & BinTrieFlags.JUMP_TABLE;
  if (jumpOffset) {
    if (branchCount === 0) {
      return char === jumpOffset ? nodeIndex : -1;
    }
    const slot = char - jumpOffset;
    if (slot >>> 0 >= branchCount)
      return -1;
    const stored = decodeTree[nodeIndex + slot];
    return stored === 0 ? -1 : nodeIndex + branchCount + stored - 1 & 65535;
  }
  if (branchCount === 0)
    return -1;
  const packedKeySlots = branchCount + 1 >> 1;
  const branchEnd = nodeIndex + packedKeySlots + branchCount;
  for (let index2 = 0; index2 < branchCount; index2++) {
    const packed = decodeTree[nodeIndex + (index2 >> 1)];
    const key = packed >> ((index2 & 1) << 3) & 255;
    if (key === char) {
      const pointerIndex = nodeIndex + packedKeySlots + index2;
      return branchEnd + decodeTree[pointerIndex] & 65535;
    }
    if (key > char)
      return -1;
  }
  return -1;
}

// node_modules/htmlparser2/dist/Tokenizer.js
var CharCodes2;
(function(CharCodes3) {
  CharCodes3[CharCodes3["Tab"] = 9] = "Tab";
  CharCodes3[CharCodes3["NewLine"] = 10] = "NewLine";
  CharCodes3[CharCodes3["FormFeed"] = 12] = "FormFeed";
  CharCodes3[CharCodes3["CarriageReturn"] = 13] = "CarriageReturn";
  CharCodes3[CharCodes3["Space"] = 32] = "Space";
  CharCodes3[CharCodes3["ExclamationMark"] = 33] = "ExclamationMark";
  CharCodes3[CharCodes3["Number"] = 35] = "Number";
  CharCodes3[CharCodes3["Amp"] = 38] = "Amp";
  CharCodes3[CharCodes3["SingleQuote"] = 39] = "SingleQuote";
  CharCodes3[CharCodes3["DoubleQuote"] = 34] = "DoubleQuote";
  CharCodes3[CharCodes3["Dash"] = 45] = "Dash";
  CharCodes3[CharCodes3["Slash"] = 47] = "Slash";
  CharCodes3[CharCodes3["Zero"] = 48] = "Zero";
  CharCodes3[CharCodes3["Nine"] = 57] = "Nine";
  CharCodes3[CharCodes3["Semi"] = 59] = "Semi";
  CharCodes3[CharCodes3["Lt"] = 60] = "Lt";
  CharCodes3[CharCodes3["Eq"] = 61] = "Eq";
  CharCodes3[CharCodes3["Gt"] = 62] = "Gt";
  CharCodes3[CharCodes3["Questionmark"] = 63] = "Questionmark";
  CharCodes3[CharCodes3["UpperA"] = 65] = "UpperA";
  CharCodes3[CharCodes3["LowerA"] = 97] = "LowerA";
  CharCodes3[CharCodes3["UpperF"] = 70] = "UpperF";
  CharCodes3[CharCodes3["LowerF"] = 102] = "LowerF";
  CharCodes3[CharCodes3["UpperZ"] = 90] = "UpperZ";
  CharCodes3[CharCodes3["LowerZ"] = 122] = "LowerZ";
  CharCodes3[CharCodes3["LowerX"] = 120] = "LowerX";
  CharCodes3[CharCodes3["OpeningSquareBracket"] = 91] = "OpeningSquareBracket";
})(CharCodes2 || (CharCodes2 = {}));
var State;
(function(State2) {
  State2[State2["Text"] = 1] = "Text";
  State2[State2["BeforeTagName"] = 2] = "BeforeTagName";
  State2[State2["InTagName"] = 3] = "InTagName";
  State2[State2["InSelfClosingTag"] = 4] = "InSelfClosingTag";
  State2[State2["BeforeClosingTagName"] = 5] = "BeforeClosingTagName";
  State2[State2["InClosingTagName"] = 6] = "InClosingTagName";
  State2[State2["AfterClosingTagName"] = 7] = "AfterClosingTagName";
  State2[State2["BeforeAttributeName"] = 8] = "BeforeAttributeName";
  State2[State2["InAttributeName"] = 9] = "InAttributeName";
  State2[State2["AfterAttributeName"] = 10] = "AfterAttributeName";
  State2[State2["BeforeAttributeValue"] = 11] = "BeforeAttributeValue";
  State2[State2["InAttributeValueDq"] = 12] = "InAttributeValueDq";
  State2[State2["InAttributeValueSq"] = 13] = "InAttributeValueSq";
  State2[State2["InAttributeValueNq"] = 14] = "InAttributeValueNq";
  State2[State2["BeforeDeclaration"] = 15] = "BeforeDeclaration";
  State2[State2["InDeclaration"] = 16] = "InDeclaration";
  State2[State2["InProcessingInstruction"] = 17] = "InProcessingInstruction";
  State2[State2["BeforeComment"] = 18] = "BeforeComment";
  State2[State2["CDATASequence"] = 19] = "CDATASequence";
  State2[State2["DeclarationSequence"] = 20] = "DeclarationSequence";
  State2[State2["InSpecialComment"] = 21] = "InSpecialComment";
  State2[State2["InCommentLike"] = 22] = "InCommentLike";
  State2[State2["SpecialStartSequence"] = 23] = "SpecialStartSequence";
  State2[State2["InSpecialTag"] = 24] = "InSpecialTag";
  State2[State2["InPlainText"] = 25] = "InPlainText";
  State2[State2["InEntity"] = 26] = "InEntity";
})(State || (State = {}));
function isWhitespace(c) {
  return c === CharCodes2.Space || c === CharCodes2.NewLine || c === CharCodes2.Tab || c === CharCodes2.FormFeed || c === CharCodes2.CarriageReturn;
}
function isEndOfTagSection(c) {
  return c === CharCodes2.Slash || c === CharCodes2.Gt || isWhitespace(c);
}
function isASCIIAlpha(c) {
  return c >= CharCodes2.LowerA && c <= CharCodes2.LowerZ || c >= CharCodes2.UpperA && c <= CharCodes2.UpperZ;
}
var QuoteType;
(function(QuoteType2) {
  QuoteType2[QuoteType2["NoValue"] = 0] = "NoValue";
  QuoteType2[QuoteType2["Unquoted"] = 1] = "Unquoted";
  QuoteType2[QuoteType2["Single"] = 2] = "Single";
  QuoteType2[QuoteType2["Double"] = 3] = "Double";
})(QuoteType || (QuoteType = {}));
var Sequences = {
  Empty: new Uint8Array(0),
  Cdata: new Uint8Array([67, 68, 65, 84, 65, 91]),
  // CDATA[
  CdataEnd: new Uint8Array([93, 93, 62]),
  // ]]>
  CommentEnd: new Uint8Array([45, 45, 33, 62]),
  // `--!>`
  Doctype: new Uint8Array([100, 111, 99, 116, 121, 112, 101]),
  // `doctype`
  IframeEnd: new Uint8Array([60, 47, 105, 102, 114, 97, 109, 101]),
  // `</iframe`
  NoembedEnd: new Uint8Array([
    60,
    47,
    110,
    111,
    101,
    109,
    98,
    101,
    100
  ]),
  // `</noembed`
  NoframesEnd: new Uint8Array([
    60,
    47,
    110,
    111,
    102,
    114,
    97,
    109,
    101,
    115
  ]),
  // `</noframes`
  Plaintext: new Uint8Array([
    60,
    47,
    112,
    108,
    97,
    105,
    110,
    116,
    101,
    120,
    116
  ]),
  // `</plaintext`
  ScriptEnd: new Uint8Array([60, 47, 115, 99, 114, 105, 112, 116]),
  // `</script`
  StyleEnd: new Uint8Array([60, 47, 115, 116, 121, 108, 101]),
  // `</style`
  TitleEnd: new Uint8Array([60, 47, 116, 105, 116, 108, 101]),
  // `</title`
  TextareaEnd: new Uint8Array([
    60,
    47,
    116,
    101,
    120,
    116,
    97,
    114,
    101,
    97
  ]),
  // `</textarea`
  XmpEnd: new Uint8Array([60, 47, 120, 109, 112])
  // `</xmp`
};
var specialStartSequences = /* @__PURE__ */ new Map([
  [Sequences.IframeEnd[2], Sequences.IframeEnd],
  [Sequences.NoembedEnd[2], Sequences.NoembedEnd],
  [Sequences.Plaintext[2], Sequences.Plaintext],
  [Sequences.ScriptEnd[2], Sequences.ScriptEnd],
  [Sequences.TitleEnd[2], Sequences.TitleEnd],
  [Sequences.XmpEnd[2], Sequences.XmpEnd]
]);
var Tokenizer = class {
  cbs;
  /** The current state the tokenizer is in. */
  state = State.Text;
  /** The read buffer. */
  buffer = "";
  /** The beginning of the section that is currently being read. */
  sectionStart = 0;
  /** The index within the buffer that we are currently looking at. */
  index = 0;
  /** The start of the last entity. */
  entityStart = 0;
  /** Some behavior, eg. when decoding entities, is done while we are in another state. This keeps track of the other state type. */
  baseState = State.Text;
  /** For special parsing behavior inside of script and style tags. */
  isSpecial = false;
  /** Indicates whether the tokenizer has been paused. */
  running = true;
  /** The offset of the current buffer. */
  offset = 0;
  xmlMode;
  decodeEntities;
  recognizeSelfClosing;
  entityDecoder;
  constructor({ xmlMode = false, decodeEntities = true, recognizeSelfClosing = xmlMode }, cbs) {
    this.cbs = cbs;
    this.xmlMode = xmlMode;
    this.decodeEntities = decodeEntities;
    this.recognizeSelfClosing = recognizeSelfClosing;
    this.entityDecoder = new EntityDecoder(xmlMode ? xmlDecodeTree : htmlDecodeTree, (cp, consumed) => this.emitCodePoint(cp, consumed));
  }
  reset() {
    this.state = State.Text;
    this.buffer = "";
    this.sectionStart = 0;
    this.index = 0;
    this.baseState = State.Text;
    this.isSpecial = false;
    this.currentSequence = Sequences.Empty;
    this.sequenceIndex = 0;
    this.running = true;
    this.offset = 0;
  }
  write(chunk) {
    this.offset += this.buffer.length;
    this.buffer = chunk;
    this.parse();
  }
  end() {
    if (this.running)
      this.finish();
  }
  pause() {
    this.running = false;
  }
  resume() {
    this.running = true;
    if (this.index < this.buffer.length + this.offset) {
      this.parse();
    }
  }
  stateText(c) {
    if (c === CharCodes2.Lt || !this.decodeEntities && this.fastForwardTo(CharCodes2.Lt)) {
      if (this.index > this.sectionStart) {
        this.cbs.ontext(this.sectionStart, this.index);
      }
      this.state = State.BeforeTagName;
      this.sectionStart = this.index;
    } else if (this.decodeEntities && c === CharCodes2.Amp) {
      this.startEntity();
    }
  }
  currentSequence = Sequences.Empty;
  sequenceIndex = 0;
  enterTagBody() {
    if (this.currentSequence === Sequences.Plaintext) {
      this.currentSequence = Sequences.Empty;
      this.state = State.InPlainText;
    } else if (this.isSpecial) {
      this.state = State.InSpecialTag;
      this.sequenceIndex = 0;
    } else {
      this.state = State.Text;
    }
  }
  /**
   * Match the opening tag name against an HTML text-only tag sequence.
   *
   * Some tags share an initial prefix (`script`/`style`, `title`/`textarea`,
   * `noembed`/`noframes`), so we may switch to an alternate sequence at the
   * first distinguishing byte.  On a successful full match we fall back to
   * the normal tag-name state; a later `>` will enter raw-text, RCDATA, or
   * plaintext mode based on `currentSequence` / `isSpecial`.
   * @param c Current character code point.
   */
  stateSpecialStartSequence(c) {
    const lower = c | 32;
    if (this.sequenceIndex < this.currentSequence.length) {
      if (lower === this.currentSequence[this.sequenceIndex]) {
        this.sequenceIndex++;
        return;
      }
      if (this.sequenceIndex === 3) {
        if (this.currentSequence === Sequences.ScriptEnd && lower === Sequences.StyleEnd[3]) {
          this.currentSequence = Sequences.StyleEnd;
          this.sequenceIndex = 4;
          return;
        }
        if (this.currentSequence === Sequences.TitleEnd && lower === Sequences.TextareaEnd[3]) {
          this.currentSequence = Sequences.TextareaEnd;
          this.sequenceIndex = 4;
          return;
        }
      } else if (this.sequenceIndex === 4 && this.currentSequence === Sequences.NoembedEnd && lower === Sequences.NoframesEnd[4]) {
        this.currentSequence = Sequences.NoframesEnd;
        this.sequenceIndex = 5;
        return;
      }
    } else if (isEndOfTagSection(c)) {
      this.sequenceIndex = 0;
      this.state = State.InTagName;
      this.stateInTagName(c);
      return;
    }
    this.isSpecial = false;
    this.currentSequence = Sequences.Empty;
    this.sequenceIndex = 0;
    this.state = State.InTagName;
    this.stateInTagName(c);
  }
  stateCDATASequence(c) {
    if (c === Sequences.Cdata[this.sequenceIndex]) {
      if (++this.sequenceIndex === Sequences.Cdata.length) {
        this.state = State.InCommentLike;
        this.currentSequence = Sequences.CdataEnd;
        this.sequenceIndex = 0;
        this.sectionStart = this.index + 1;
      }
    } else {
      this.sequenceIndex = 0;
      if (this.xmlMode) {
        this.state = State.InDeclaration;
        this.stateInDeclaration(c);
      } else {
        this.state = State.InSpecialComment;
        this.stateInSpecialComment(c);
      }
    }
  }
  /**
   * When we wait for one specific character, we can speed things up
   * by skipping through the buffer until we find it.
   * @param c Current character code point.
   * @returns Whether the character was found.
   */
  fastForwardTo(c) {
    while (++this.index < this.buffer.length + this.offset) {
      if (this.buffer.charCodeAt(this.index - this.offset) === c) {
        return true;
      }
    }
    this.index = this.buffer.length + this.offset - 1;
    return false;
  }
  /**
   * Emit a comment token and return to the text state.
   * @param offset Number of characters in the end sequence that have already been matched.
   */
  emitComment(offset) {
    this.cbs.oncomment(this.sectionStart, this.index, offset);
    this.sequenceIndex = 0;
    this.sectionStart = this.index + 1;
    this.state = State.Text;
  }
  /**
   * Comments and CDATA end with `-->` and `]]>`.
   *
   * Their common qualities are:
   * - Their end sequences have a distinct character they start with.
   * - That character is then repeated, so we have to check multiple repeats.
   * - All characters but the start character of the sequence can be skipped.
   * @param c Current character code point.
   */
  stateInCommentLike(c) {
    if (!this.xmlMode && this.currentSequence === Sequences.CommentEnd && this.sequenceIndex <= 1 && /*
     * We're still at the very start of the comment: the only
     * characters consumed since `<!--` are the dashes that
     * advanced sequenceIndex (0 for `<!-->`, 1 for `<!--->`).
     */
    this.index === this.sectionStart + this.sequenceIndex && c === CharCodes2.Gt) {
      this.emitComment(this.sequenceIndex);
    } else if (this.currentSequence === Sequences.CommentEnd && this.sequenceIndex === 2 && c === CharCodes2.Gt) {
      this.emitComment(2);
    } else if (this.currentSequence === Sequences.CommentEnd && this.sequenceIndex === this.currentSequence.length - 1 && c !== CharCodes2.Gt) {
      this.sequenceIndex = Number(c === CharCodes2.Dash);
    } else if (c === this.currentSequence[this.sequenceIndex]) {
      if (++this.sequenceIndex === this.currentSequence.length) {
        if (this.currentSequence === Sequences.CdataEnd) {
          this.cbs.oncdata(this.sectionStart, this.index, 2);
        } else {
          this.cbs.oncomment(this.sectionStart, this.index, 3);
        }
        this.sequenceIndex = 0;
        this.sectionStart = this.index + 1;
        this.state = State.Text;
      }
    } else if (this.sequenceIndex === 0) {
      if (this.fastForwardTo(this.currentSequence[0])) {
        this.sequenceIndex = 1;
      }
    } else if (c !== this.currentSequence[this.sequenceIndex - 1]) {
      this.sequenceIndex = 0;
    }
  }
  /**
   * HTML only allows ASCII alpha characters (a-z and A-Z) at the beginning of a tag name.
   *
   * XML allows a lot more characters here (@see https://www.w3.org/TR/REC-xml/#NT-NameStartChar).
   * We allow anything that wouldn't end the tag.
   * @param c Current character code point.
   */
  isTagStartChar(c) {
    return this.xmlMode ? !isEndOfTagSection(c) : isASCIIAlpha(c);
  }
  /**
   * Scan raw-text / RCDATA content for the matching end tag.
   *
   * For RCDATA tags (`<title>`, `<textarea>`) entities are decoded inline.
   * For raw-text tags (`<script>`, `<style>`, etc.) we fast-forward to `<`.
   * @param c Current character code point.
   */
  stateInSpecialTag(c) {
    if (this.sequenceIndex === this.currentSequence.length) {
      if (isEndOfTagSection(c)) {
        const endOfText = this.index - this.currentSequence.length;
        if (this.sectionStart < endOfText) {
          const actualIndex = this.index;
          this.index = endOfText;
          this.cbs.ontext(this.sectionStart, endOfText);
          this.index = actualIndex;
        }
        this.isSpecial = false;
        this.sectionStart = endOfText + 2;
        this.stateInClosingTagName(c);
        return;
      }
      this.sequenceIndex = 0;
    }
    if ((c | 32) === this.currentSequence[this.sequenceIndex]) {
      this.sequenceIndex += 1;
    } else if (this.sequenceIndex === 0) {
      if (this.currentSequence === Sequences.TitleEnd || this.currentSequence === Sequences.TextareaEnd) {
        if (this.decodeEntities && c === CharCodes2.Amp) {
          this.startEntity();
        }
      } else if (this.fastForwardTo(CharCodes2.Lt)) {
        this.sequenceIndex = 1;
      }
    } else {
      this.sequenceIndex = Number(c === CharCodes2.Lt);
    }
  }
  stateBeforeTagName(c) {
    if (c === CharCodes2.ExclamationMark) {
      this.state = State.BeforeDeclaration;
      this.sectionStart = this.index + 1;
    } else if (c === CharCodes2.Questionmark) {
      if (this.xmlMode) {
        this.state = State.InProcessingInstruction;
        this.sequenceIndex = 0;
        this.sectionStart = this.index + 1;
      } else {
        this.state = State.InSpecialComment;
        this.sectionStart = this.index;
      }
    } else if (this.isTagStartChar(c)) {
      this.sectionStart = this.index;
      const special = this.xmlMode || this.cbs.isInForeignContext?.() ? void 0 : specialStartSequences.get(c | 32);
      if (special === void 0) {
        this.state = State.InTagName;
      } else {
        this.isSpecial = true;
        this.currentSequence = special;
        this.sequenceIndex = 3;
        this.state = State.SpecialStartSequence;
      }
    } else if (c === CharCodes2.Slash) {
      this.state = State.BeforeClosingTagName;
    } else {
      this.state = State.Text;
      this.stateText(c);
    }
  }
  stateInTagName(c) {
    if (isEndOfTagSection(c)) {
      this.cbs.onopentagname(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    }
  }
  stateBeforeClosingTagName(c) {
    if (isWhitespace(c)) {
      if (this.xmlMode) {
      } else {
        this.state = State.InSpecialComment;
        this.sectionStart = this.index;
      }
    } else if (c === CharCodes2.Gt) {
      this.state = State.Text;
      if (!this.xmlMode) {
        this.sectionStart = this.index + 1;
      }
    } else {
      this.state = this.isTagStartChar(c) ? State.InClosingTagName : State.InSpecialComment;
      this.sectionStart = this.index;
    }
  }
  stateInClosingTagName(c) {
    if (isEndOfTagSection(c)) {
      this.cbs.onclosetag(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.state = State.AfterClosingTagName;
      this.stateAfterClosingTagName(c);
    }
  }
  stateAfterClosingTagName(c) {
    if (c === CharCodes2.Gt || this.fastForwardTo(CharCodes2.Gt)) {
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    }
  }
  stateBeforeAttributeName(c) {
    if (c === CharCodes2.Gt) {
      this.cbs.onopentagend(this.index);
      this.enterTagBody();
      this.sectionStart = this.index + 1;
    } else if (c === CharCodes2.Slash) {
      this.state = State.InSelfClosingTag;
    } else if (!isWhitespace(c)) {
      this.state = State.InAttributeName;
      this.sectionStart = this.index;
    }
  }
  /**
   * Handle `/` before `>` in an opening tag.
   *
   * In HTML mode, text-only tags ignore the self-closing flag and still enter
   * their raw-text/RCDATA/plaintext state unless self-closing tags are being
   * recognized. In XML mode, or for ordinary tags, the tokenizer returns to
   * regular text parsing after emitting the self-closing callback.
   * @param c Current character code point.
   */
  stateInSelfClosingTag(c) {
    if (c === CharCodes2.Gt) {
      this.cbs.onselfclosingtag(this.index);
      this.sectionStart = this.index + 1;
      if (!this.recognizeSelfClosing) {
        this.enterTagBody();
        return;
      }
      this.state = State.Text;
      this.isSpecial = false;
      this.currentSequence = Sequences.Empty;
    } else if (!isWhitespace(c)) {
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    }
  }
  stateInAttributeName(c) {
    if (c === CharCodes2.Eq || isEndOfTagSection(c)) {
      this.cbs.onattribname(this.sectionStart, this.index);
      this.sectionStart = this.index;
      this.state = State.AfterAttributeName;
      this.stateAfterAttributeName(c);
    }
  }
  stateAfterAttributeName(c) {
    if (c === CharCodes2.Eq) {
      this.state = State.BeforeAttributeValue;
    } else if (c === CharCodes2.Slash || c === CharCodes2.Gt) {
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
      this.sectionStart = -1;
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    } else if (!isWhitespace(c)) {
      this.cbs.onattribend(QuoteType.NoValue, this.sectionStart);
      this.state = State.InAttributeName;
      this.sectionStart = this.index;
    }
  }
  stateBeforeAttributeValue(c) {
    if (c === CharCodes2.DoubleQuote) {
      this.state = State.InAttributeValueDq;
      this.sectionStart = this.index + 1;
    } else if (c === CharCodes2.SingleQuote) {
      this.state = State.InAttributeValueSq;
      this.sectionStart = this.index + 1;
    } else if (!isWhitespace(c)) {
      this.sectionStart = this.index;
      this.state = State.InAttributeValueNq;
      this.stateInAttributeValueNoQuotes(c);
    }
  }
  handleInAttributeValue(c, quote) {
    if (c === quote || !this.decodeEntities && this.fastForwardTo(quote)) {
      this.cbs.onattribdata(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.cbs.onattribend(quote === CharCodes2.DoubleQuote ? QuoteType.Double : QuoteType.Single, this.index + 1);
      this.state = State.BeforeAttributeName;
    } else if (this.decodeEntities && c === CharCodes2.Amp) {
      this.startEntity();
    }
  }
  stateInAttributeValueDoubleQuotes(c) {
    this.handleInAttributeValue(c, CharCodes2.DoubleQuote);
  }
  stateInAttributeValueSingleQuotes(c) {
    this.handleInAttributeValue(c, CharCodes2.SingleQuote);
  }
  stateInAttributeValueNoQuotes(c) {
    if (isWhitespace(c) || c === CharCodes2.Gt) {
      this.cbs.onattribdata(this.sectionStart, this.index);
      this.sectionStart = -1;
      this.cbs.onattribend(QuoteType.Unquoted, this.index);
      this.state = State.BeforeAttributeName;
      this.stateBeforeAttributeName(c);
    } else if (this.decodeEntities && c === CharCodes2.Amp) {
      this.startEntity();
    }
  }
  /**
   * Distinguish between CDATA, declarations, HTML comments, and HTML bogus
   * comments after `<!`.
   *
   * In HTML mode, only real comments and doctypes stay on declaration paths;
   * everything else becomes a bogus comment terminated by the next `>`.
   * @param c Current character code point.
   */
  stateBeforeDeclaration(c) {
    if (c === CharCodes2.OpeningSquareBracket) {
      this.state = State.CDATASequence;
      this.sequenceIndex = 0;
    } else if (this.xmlMode) {
      this.state = c === CharCodes2.Dash ? State.BeforeComment : State.InDeclaration;
    } else if ((c | 32) === Sequences.Doctype[0]) {
      this.state = State.DeclarationSequence;
      this.currentSequence = Sequences.Doctype;
      this.sequenceIndex = 1;
    } else if (c === CharCodes2.Gt) {
      this.cbs.oncomment(this.sectionStart, this.index, 0);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    } else if (c === CharCodes2.Dash) {
      this.state = State.BeforeComment;
    } else {
      this.state = State.InSpecialComment;
    }
  }
  /**
   * Continue matching `doctype` after `<!d`.
   *
   * A full `doctype` match stays on the declaration path; any other name falls
   * back to an HTML bogus comment, which matches browser behavior for
   * non-doctype `<!...>` constructs.
   * @param c Current character code point.
   */
  stateDeclarationSequence(c) {
    if (this.sequenceIndex === this.currentSequence.length) {
      this.state = State.InDeclaration;
      this.stateInDeclaration(c);
    } else if ((c | 32) === this.currentSequence[this.sequenceIndex]) {
      this.sequenceIndex += 1;
    } else if (c === CharCodes2.Gt) {
      this.cbs.oncomment(this.sectionStart, this.index, 0);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    } else {
      this.state = State.InSpecialComment;
    }
  }
  stateInDeclaration(c) {
    if (c === CharCodes2.Gt || this.fastForwardTo(CharCodes2.Gt)) {
      this.cbs.ondeclaration(this.sectionStart, this.index);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    }
  }
  /**
   * XML processing instructions (`<?...?>`).
   *
   * In HTML mode `<?` is routed to `InSpecialComment` instead, so this
   * state is only reachable in XML mode.
   * @param c Current character code point.
   */
  stateInProcessingInstruction(c) {
    if (c === CharCodes2.Questionmark) {
      this.sequenceIndex = 1;
    } else if (c === CharCodes2.Gt && this.sequenceIndex === 1) {
      this.cbs.onprocessinginstruction(this.sectionStart, this.index - 1);
      this.sequenceIndex = 0;
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    } else {
      this.sequenceIndex = Number(this.fastForwardTo(CharCodes2.Questionmark));
    }
  }
  stateBeforeComment(c) {
    if (c === CharCodes2.Dash) {
      this.state = State.InCommentLike;
      this.currentSequence = Sequences.CommentEnd;
      this.sequenceIndex = 0;
      this.sectionStart = this.index + 1;
    } else if (this.xmlMode) {
      this.state = State.InDeclaration;
    } else if (c === CharCodes2.Gt) {
      this.cbs.oncomment(this.sectionStart, this.index, 0);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    } else {
      this.state = State.InSpecialComment;
    }
  }
  stateInSpecialComment(c) {
    if (c === CharCodes2.Gt || this.fastForwardTo(CharCodes2.Gt)) {
      this.cbs.oncomment(this.sectionStart, this.index, 0);
      this.state = State.Text;
      this.sectionStart = this.index + 1;
    }
  }
  startEntity() {
    this.baseState = this.state;
    this.state = State.InEntity;
    this.entityStart = this.index;
    this.entityDecoder.startEntity(this.xmlMode ? DecodingMode.Strict : this.baseState === State.Text || this.baseState === State.InSpecialTag ? DecodingMode.Legacy : DecodingMode.Attribute);
  }
  stateInEntity() {
    const indexInBuffer = this.index - this.offset;
    const length = this.entityDecoder.write(this.buffer, indexInBuffer);
    if (length >= 0) {
      this.state = this.baseState;
      if (length === 0) {
        this.index -= 1;
      }
    } else {
      if (indexInBuffer < this.buffer.length && this.buffer.charCodeAt(indexInBuffer) === CharCodes2.Amp) {
        this.state = this.baseState;
        this.index -= 1;
        return;
      }
      this.index = this.offset + this.buffer.length - 1;
    }
  }
  /**
   * Remove data that has already been consumed from the buffer.
   */
  cleanup() {
    if (this.running && this.sectionStart !== this.index) {
      if (this.state === State.Text || this.state === State.InPlainText || this.state === State.InSpecialTag && this.sequenceIndex === 0) {
        this.cbs.ontext(this.sectionStart, this.index);
        this.sectionStart = this.index;
      } else if (this.state === State.InAttributeValueDq || this.state === State.InAttributeValueSq || this.state === State.InAttributeValueNq) {
        this.cbs.onattribdata(this.sectionStart, this.index);
        this.sectionStart = this.index;
      }
    }
  }
  shouldContinue() {
    return this.index < this.buffer.length + this.offset && this.running;
  }
  /**
   * Iterates through the buffer, calling the function corresponding to the current state.
   *
   * States that are more likely to be hit are higher up, as a performance improvement.
   */
  parse() {
    while (this.shouldContinue()) {
      const c = this.buffer.charCodeAt(this.index - this.offset);
      switch (this.state) {
        case State.Text: {
          this.stateText(c);
          break;
        }
        case State.InPlainText: {
          this.index = this.buffer.length + this.offset - 1;
          break;
        }
        case State.SpecialStartSequence: {
          this.stateSpecialStartSequence(c);
          break;
        }
        case State.InSpecialTag: {
          this.stateInSpecialTag(c);
          break;
        }
        case State.CDATASequence: {
          this.stateCDATASequence(c);
          break;
        }
        case State.DeclarationSequence: {
          this.stateDeclarationSequence(c);
          break;
        }
        case State.InAttributeValueDq: {
          this.stateInAttributeValueDoubleQuotes(c);
          break;
        }
        case State.InAttributeName: {
          this.stateInAttributeName(c);
          break;
        }
        case State.InCommentLike: {
          this.stateInCommentLike(c);
          break;
        }
        case State.InSpecialComment: {
          this.stateInSpecialComment(c);
          break;
        }
        case State.BeforeAttributeName: {
          this.stateBeforeAttributeName(c);
          break;
        }
        case State.InTagName: {
          this.stateInTagName(c);
          break;
        }
        case State.InClosingTagName: {
          this.stateInClosingTagName(c);
          break;
        }
        case State.BeforeTagName: {
          this.stateBeforeTagName(c);
          break;
        }
        case State.AfterAttributeName: {
          this.stateAfterAttributeName(c);
          break;
        }
        case State.InAttributeValueSq: {
          this.stateInAttributeValueSingleQuotes(c);
          break;
        }
        case State.BeforeAttributeValue: {
          this.stateBeforeAttributeValue(c);
          break;
        }
        case State.BeforeClosingTagName: {
          this.stateBeforeClosingTagName(c);
          break;
        }
        case State.AfterClosingTagName: {
          this.stateAfterClosingTagName(c);
          break;
        }
        case State.InAttributeValueNq: {
          this.stateInAttributeValueNoQuotes(c);
          break;
        }
        case State.InSelfClosingTag: {
          this.stateInSelfClosingTag(c);
          break;
        }
        case State.InDeclaration: {
          this.stateInDeclaration(c);
          break;
        }
        case State.BeforeDeclaration: {
          this.stateBeforeDeclaration(c);
          break;
        }
        case State.BeforeComment: {
          this.stateBeforeComment(c);
          break;
        }
        case State.InProcessingInstruction: {
          this.stateInProcessingInstruction(c);
          break;
        }
        case State.InEntity: {
          this.stateInEntity();
          break;
        }
      }
      this.index++;
    }
    this.cleanup();
  }
  finish() {
    if (this.state === State.InEntity) {
      this.entityDecoder.end();
      this.state = this.baseState;
    }
    this.handleTrailingData();
    this.cbs.onend();
  }
  handleTrailingCommentLikeData(endIndex) {
    if (this.state !== State.InCommentLike) {
      return false;
    }
    if (this.currentSequence === Sequences.CdataEnd) {
      if (this.xmlMode) {
        if (this.sectionStart < endIndex) {
          this.cbs.oncdata(this.sectionStart, endIndex, 0);
        }
      } else {
        const cdataStart = this.sectionStart - Sequences.Cdata.length - 1;
        this.cbs.oncomment(cdataStart, endIndex, 0);
      }
    } else {
      const offset = this.xmlMode ? 0 : Math.min(this.sequenceIndex, Sequences.CommentEnd.length - 1);
      this.cbs.oncomment(this.sectionStart, endIndex, offset);
    }
    return true;
  }
  handleTrailingMarkupDeclaration(endIndex) {
    if (this.xmlMode) {
      switch (this.state) {
        case State.InSpecialComment:
        case State.BeforeComment:
        case State.CDATASequence:
        case State.DeclarationSequence:
        case State.InDeclaration: {
          this.cbs.ontext(this.sectionStart, endIndex);
          return true;
        }
        default: {
          return false;
        }
      }
    }
    switch (this.state) {
      case State.BeforeDeclaration:
      case State.InSpecialComment:
      case State.BeforeComment:
      case State.CDATASequence: {
        this.cbs.oncomment(this.sectionStart, endIndex, 0);
        return true;
      }
      case State.DeclarationSequence: {
        if (this.sequenceIndex !== Sequences.Doctype.length) {
          this.cbs.oncomment(this.sectionStart, endIndex, 0);
        }
        return true;
      }
      case State.InDeclaration: {
        return true;
      }
      default: {
        return false;
      }
    }
  }
  /** Handle any trailing data. */
  handleTrailingData() {
    const endIndex = this.buffer.length + this.offset;
    if (this.handleTrailingCommentLikeData(endIndex) || this.handleTrailingMarkupDeclaration(endIndex)) {
      return;
    }
    if (this.sectionStart >= endIndex) {
      return;
    }
    switch (this.state) {
      case State.InTagName:
      case State.BeforeAttributeName:
      case State.BeforeAttributeValue:
      case State.AfterAttributeName:
      case State.InAttributeName:
      case State.InAttributeValueSq:
      case State.InAttributeValueDq:
      case State.InAttributeValueNq:
      case State.InClosingTagName: {
        break;
      }
      default: {
        this.cbs.ontext(this.sectionStart, endIndex);
      }
    }
  }
  emitCodePoint(cp, consumed) {
    if (this.baseState !== State.Text && this.baseState !== State.InSpecialTag) {
      if (this.sectionStart < this.entityStart) {
        this.cbs.onattribdata(this.sectionStart, this.entityStart);
      }
      this.sectionStart = this.entityStart + consumed;
      this.index = this.sectionStart - 1;
      this.cbs.onattribentity(cp);
    } else {
      if (this.sectionStart < this.entityStart) {
        this.cbs.ontext(this.sectionStart, this.entityStart);
      }
      this.sectionStart = this.entityStart + consumed;
      this.index = this.sectionStart - 1;
      this.cbs.ontextentity(cp, this.sectionStart);
    }
  }
};

// node_modules/htmlparser2/dist/Parser.js
var { fromCodePoint } = String;
var formTags = /* @__PURE__ */ new Set([
  "input",
  "option",
  "optgroup",
  "select",
  "button",
  "datalist",
  "textarea"
]);
var pTag = /* @__PURE__ */ new Set(["p"]);
var headingTags = /* @__PURE__ */ new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p"]);
var tableSectionTags = /* @__PURE__ */ new Set(["thead", "tbody"]);
var ddtTags = /* @__PURE__ */ new Set(["dd", "dt"]);
var rtpTags = /* @__PURE__ */ new Set(["rt", "rp"]);
var openImpliesClose = /* @__PURE__ */ new Map([
  ["tr", /* @__PURE__ */ new Set(["tr", "th", "td"])],
  ["th", /* @__PURE__ */ new Set(["th"])],
  ["td", /* @__PURE__ */ new Set(["thead", "th", "td"])],
  ["body", /* @__PURE__ */ new Set(["head", "link", "script"])],
  ["a", /* @__PURE__ */ new Set(["a"])],
  ["li", /* @__PURE__ */ new Set(["li"])],
  ["p", pTag],
  ["h1", headingTags],
  ["h2", headingTags],
  ["h3", headingTags],
  ["h4", headingTags],
  ["h5", headingTags],
  ["h6", headingTags],
  ["select", formTags],
  ["input", formTags],
  ["output", formTags],
  ["button", formTags],
  ["datalist", formTags],
  ["textarea", formTags],
  ["option", /* @__PURE__ */ new Set(["option"])],
  ["optgroup", /* @__PURE__ */ new Set(["optgroup", "option"])],
  ["dd", ddtTags],
  ["dt", ddtTags],
  ["address", pTag],
  ["article", pTag],
  ["aside", pTag],
  ["blockquote", pTag],
  ["details", pTag],
  ["div", pTag],
  ["dl", pTag],
  ["fieldset", pTag],
  ["figcaption", pTag],
  ["figure", pTag],
  ["footer", pTag],
  ["form", pTag],
  ["header", pTag],
  ["hr", pTag],
  ["main", pTag],
  ["nav", pTag],
  ["ol", pTag],
  ["pre", pTag],
  ["section", pTag],
  ["table", pTag],
  ["ul", pTag],
  ["rt", rtpTags],
  ["rp", rtpTags],
  ["tbody", tableSectionTags],
  ["tfoot", tableSectionTags]
]);
var DOCUMENT_TYPE = "doctype";
var voidElements = /* @__PURE__ */ new Set([
  "area",
  "base",
  "basefont",
  "br",
  "col",
  "command",
  "embed",
  "frame",
  "hr",
  "img",
  "input",
  "isindex",
  "keygen",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);
var foreignContextElements = /* @__PURE__ */ new Set(["math", "svg"]);
var htmlIntegrationElements = /* @__PURE__ */ new Set([
  "mi",
  "mo",
  "mn",
  "ms",
  "mtext",
  "annotation-xml",
  "foreignObject",
  "desc",
  "title"
]);
var svgTagNameAdjustments = /* @__PURE__ */ new Map([
  ["altglyph", "altGlyph"],
  ["altglyphdef", "altGlyphDef"],
  ["altglyphitem", "altGlyphItem"],
  ["animatecolor", "animateColor"],
  ["animatemotion", "animateMotion"],
  ["animatetransform", "animateTransform"],
  ["clippath", "clipPath"],
  ["feblend", "feBlend"],
  ["fecolormatrix", "feColorMatrix"],
  ["fecomponenttransfer", "feComponentTransfer"],
  ["fecomposite", "feComposite"],
  ["feconvolvematrix", "feConvolveMatrix"],
  ["fediffuselighting", "feDiffuseLighting"],
  ["fedisplacementmap", "feDisplacementMap"],
  ["fedistantlight", "feDistantLight"],
  ["fedropshadow", "feDropShadow"],
  ["feflood", "feFlood"],
  ["fefunca", "feFuncA"],
  ["fefuncb", "feFuncB"],
  ["fefuncg", "feFuncG"],
  ["fefuncr", "feFuncR"],
  ["fegaussianblur", "feGaussianBlur"],
  ["feimage", "feImage"],
  ["femerge", "feMerge"],
  ["femergenode", "feMergeNode"],
  ["femorphology", "feMorphology"],
  ["feoffset", "feOffset"],
  ["fepointlight", "fePointLight"],
  ["fespecularlighting", "feSpecularLighting"],
  ["fespotlight", "feSpotLight"],
  ["fetile", "feTile"],
  ["feturbulence", "feTurbulence"],
  ["foreignobject", "foreignObject"],
  ["glyphref", "glyphRef"],
  ["lineargradient", "linearGradient"],
  ["radialgradient", "radialGradient"],
  ["textpath", "textPath"]
]);
var ForeignContext;
(function(ForeignContext2) {
  ForeignContext2[ForeignContext2["None"] = 0] = "None";
  ForeignContext2[ForeignContext2["Svg"] = 1] = "Svg";
  ForeignContext2[ForeignContext2["MathML"] = 2] = "MathML";
})(ForeignContext || (ForeignContext = {}));
var reNameEnd = /\s|\//;
var Parser = class {
  options;
  /** The start index of the last event. */
  startIndex = 0;
  /** The end index of the last event. */
  endIndex = 0;
  /**
   * Store the start index of the current open tag,
   * so we can update the start index for attributes.
   */
  openTagStart = 0;
  tagname = "";
  attribname = "";
  attribvalue = "";
  attribs = null;
  stack = [];
  foreignContext;
  cbs;
  lowerCaseTagNames;
  lowerCaseAttributeNames;
  recognizeSelfClosing;
  /** We are parsing HTML. Inverse of the `xmlMode` option. */
  htmlMode;
  tokenizer;
  buffers = [];
  bufferOffset = 0;
  /** The index of the last written buffer. Used when resuming after a `pause()`. */
  writeIndex = 0;
  /** Indicates whether the parser has finished running / `.end` has been called. */
  ended = false;
  constructor(cbs, options = {}) {
    this.options = options;
    this.cbs = cbs ?? {};
    this.htmlMode = !this.options.xmlMode;
    this.lowerCaseTagNames = options.lowerCaseTags ?? this.htmlMode;
    this.lowerCaseAttributeNames = options.lowerCaseAttributeNames ?? this.htmlMode;
    this.recognizeSelfClosing = options.recognizeSelfClosing ?? !this.htmlMode;
    this.tokenizer = new (options.Tokenizer ?? Tokenizer)(this.options, this);
    this.foreignContext = [ForeignContext.None];
    this.cbs.onparserinit?.(this);
  }
  // Tokenizer event handlers
  /**
   * @param start Start index for the current parser event.
   * @param endIndex End index for the current parser event.
   * @internal
   */
  ontext(start, endIndex) {
    const data = this.getSlice(start, endIndex);
    this.endIndex = endIndex - 1;
    this.cbs.ontext?.(data);
    this.startIndex = endIndex;
  }
  /**
   * @param cp Current Unicode code point.
   * @param endIndex End index for the current parser event.
   * @internal
   */
  ontextentity(cp, endIndex) {
    this.endIndex = endIndex - 1;
    this.cbs.ontext?.(fromCodePoint(cp));
    this.startIndex = endIndex;
  }
  /** @internal */
  isInForeignContext() {
    return this.foreignContext[0] !== ForeignContext.None;
  }
  /**
   * Checks if the current tag is a void element. Override this if you want
   * to specify your own additional void elements.
   * @param name Name of the pseudo selector.
   */
  isVoidElement(name) {
    return this.htmlMode && voidElements.has(name);
  }
  /**
   * Read a tag name from the buffer.
   *
   * When `lowerCaseTagNames` is enabled (the default in HTML mode), the name
   * is lowercased and may be adjusted for SVG casing or the `image` → `img`
   * alias.
   * @param start Start index of the tag name in the buffer.
   * @param endIndex End index of the tag name in the buffer.
   */
  readTagName(start, endIndex) {
    const name = this.lowerCaseTagNames ? this.getSlice(start, endIndex).toLowerCase() : this.getSlice(start, endIndex);
    if (!(this.lowerCaseTagNames && this.htmlMode)) {
      return name;
    }
    if (this.foreignContext[0] === ForeignContext.Svg) {
      return svgTagNameAdjustments.get(name) ?? name;
    }
    if (this.foreignContext.length > 1) {
      const adjusted = svgTagNameAdjustments.get(name);
      if (adjusted !== void 0 && this.stack.includes(adjusted)) {
        return adjusted;
      }
    }
    if (!this.isInForeignContext()) {
      return name === "image" ? "img" : name;
    }
    return name;
  }
  /**
   * @param start Start index for the current parser event.
   * @param endIndex End index for the current parser event.
   * @internal
   */
  onopentagname(start, endIndex) {
    this.endIndex = endIndex;
    this.emitOpenTag(this.readTagName(start, endIndex));
  }
  emitOpenTag(name) {
    this.openTagStart = this.startIndex;
    this.tagname = name;
    if (this.htmlMode && name === "form" && this.stack.includes("form")) {
      this.tagname = "";
      return;
    }
    const impliesClose = this.htmlMode && openImpliesClose.get(name);
    if (impliesClose) {
      while (this.stack.length > 0 && impliesClose.has(this.stack[0])) {
        this.popElement(true);
      }
    }
    if (!this.isVoidElement(name)) {
      this.stack.unshift(name);
      if (this.htmlMode) {
        if (name === "svg") {
          this.foreignContext.unshift(ForeignContext.Svg);
        } else if (name === "math") {
          this.foreignContext.unshift(ForeignContext.MathML);
        } else if (htmlIntegrationElements.has(name)) {
          this.foreignContext.unshift(ForeignContext.None);
        }
      }
    }
    this.cbs.onopentagname?.(name);
    if (this.cbs.onopentag)
      this.attribs = {};
  }
  endOpenTag(isImplied) {
    this.startIndex = this.openTagStart;
    if (this.attribs) {
      this.cbs.onopentag?.(this.tagname, this.attribs, isImplied);
      this.attribs = null;
    }
    if (this.cbs.onclosetag && this.isVoidElement(this.tagname)) {
      this.cbs.onclosetag(this.tagname, true);
    }
    this.tagname = "";
  }
  /**
   * @param endIndex End index for the current parser event.
   * @internal
   */
  onopentagend(endIndex) {
    this.endIndex = endIndex;
    this.endOpenTag(false);
    this.startIndex = endIndex + 1;
  }
  /**
   * @param start Start index for the current parser event.
   * @param endIndex End index for the current parser event.
   * @internal
   */
  onclosetag(start, endIndex) {
    this.endIndex = endIndex;
    const name = this.readTagName(start, endIndex);
    if (!this.isVoidElement(name)) {
      const pos = this.stack.indexOf(name);
      if (pos !== -1) {
        for (let index2 = 0; index2 < pos; index2++) {
          this.popElement(true);
        }
        this.popElement(false);
      } else if (this.htmlMode && name === "p") {
        this.emitOpenTag("p");
        this.closeCurrentTag(true);
      }
    } else if (this.htmlMode && name === "br") {
      this.cbs.onopentagname?.("br");
      this.cbs.onopentag?.("br", {}, true);
      this.cbs.onclosetag?.("br", false);
    }
    this.startIndex = endIndex + 1;
  }
  /**
   * @param endIndex End index for the current parser event.
   * @internal
   */
  onselfclosingtag(endIndex) {
    this.endIndex = endIndex;
    if (this.recognizeSelfClosing || this.isInForeignContext()) {
      this.closeCurrentTag(false);
      this.startIndex = endIndex + 1;
    } else {
      this.onopentagend(endIndex);
    }
  }
  /**
   * Pop the top element off the stack, emit a close event, and maintain
   * the foreign context stack.
   * @param implied Whether this close is implied (not from an explicit end tag).
   */
  popElement(implied) {
    const element = this.stack.shift();
    if (this.htmlMode && (foreignContextElements.has(element) || htmlIntegrationElements.has(element))) {
      this.foreignContext.shift();
    }
    this.cbs.onclosetag?.(element, implied);
  }
  closeCurrentTag(isOpenImplied) {
    const name = this.tagname;
    this.endOpenTag(isOpenImplied);
    if (this.stack[0] === name) {
      this.popElement(!isOpenImplied);
    }
  }
  /**
   * @param start Start index for the current parser event.
   * @param endIndex End index for the current parser event.
   * @internal
   */
  onattribname(start, endIndex) {
    this.startIndex = start;
    const name = this.getSlice(start, endIndex);
    this.attribname = this.lowerCaseAttributeNames ? name.toLowerCase() : name;
  }
  /**
   * @param start Start index for the current parser event.
   * @param endIndex End index for the current parser event.
   * @internal
   */
  onattribdata(start, endIndex) {
    this.attribvalue += this.getSlice(start, endIndex);
  }
  /**
   * @param cp Current Unicode code point.
   * @internal
   */
  onattribentity(cp) {
    this.attribvalue += fromCodePoint(cp);
  }
  /**
   * @param quote Quote type used for the current attribute.
   * @param endIndex End index for the current parser event.
   * @internal
   */
  onattribend(quote, endIndex) {
    this.endIndex = endIndex;
    this.cbs.onattribute?.(this.attribname, this.attribvalue, quote === QuoteType.Double ? '"' : quote === QuoteType.Single ? "'" : quote === QuoteType.NoValue ? void 0 : null);
    if (this.attribs && !Object.hasOwn(this.attribs, this.attribname)) {
      this.attribs[this.attribname] = this.attribvalue;
    }
    this.attribvalue = "";
  }
  getInstructionName(value) {
    const index2 = value.search(reNameEnd);
    let name = index2 < 0 ? value : value.substr(0, index2);
    if (this.lowerCaseTagNames) {
      name = name.toLowerCase();
    }
    return name;
  }
  /**
   * @param start Start index for the current parser event.
   * @param endIndex End index for the current parser event.
   * @internal
   */
  ondeclaration(start, endIndex) {
    this.endIndex = endIndex;
    const value = this.getSlice(start, endIndex);
    if (this.cbs.onprocessinginstruction) {
      const name = this.htmlMode ? this.lowerCaseTagNames ? DOCUMENT_TYPE : value.slice(0, DOCUMENT_TYPE.length) : this.getInstructionName(value);
      this.cbs.onprocessinginstruction(`!${name}`, `!${value}`);
    }
    this.startIndex = endIndex + 1;
  }
  /**
   * @param start Start index for the current parser event.
   * @param endIndex End index for the current parser event.
   * @internal
   */
  onprocessinginstruction(start, endIndex) {
    this.endIndex = endIndex;
    const value = this.getSlice(start, endIndex);
    if (this.cbs.onprocessinginstruction) {
      const name = this.getInstructionName(value);
      this.cbs.onprocessinginstruction(`?${name}`, `?${value}`);
    }
    this.startIndex = endIndex + 1;
  }
  /**
   * @param start Start index for the current parser event.
   * @param endIndex End index for the current parser event.
   * @param offset Offset applied when computing parser indices.
   * @internal
   */
  oncomment(start, endIndex, offset) {
    this.endIndex = endIndex;
    this.cbs.oncomment?.(this.getSlice(start, endIndex - offset));
    this.cbs.oncommentend?.();
    this.startIndex = endIndex + 1;
  }
  /**
   * @param start Start index for the current parser event.
   * @param endIndex End index for the current parser event.
   * @param offset Offset applied when computing parser indices.
   * @internal
   */
  oncdata(start, endIndex, offset) {
    this.endIndex = endIndex;
    const value = this.getSlice(start, endIndex - offset);
    if (!this.htmlMode || this.options.recognizeCDATA) {
      this.cbs.oncdatastart?.();
      this.cbs.ontext?.(value);
      this.cbs.oncdataend?.();
    } else if (this.isInForeignContext()) {
      this.cbs.ontext?.(value);
    } else {
      this.cbs.oncomment?.(`[CDATA[${value}]]`);
      this.cbs.oncommentend?.();
    }
    this.startIndex = endIndex + 1;
  }
  /** @internal */
  onend() {
    if (this.cbs.onclosetag) {
      this.endIndex = this.startIndex;
      for (let index2 = 0; index2 < this.stack.length; index2++) {
        this.cbs.onclosetag(this.stack[index2], true);
      }
    }
    this.cbs.onend?.();
  }
  /**
   * Resets the parser to a blank state, ready to parse a new HTML document
   */
  reset() {
    this.cbs.onreset?.();
    this.tokenizer.reset();
    this.tagname = "";
    this.attribname = "";
    this.attribvalue = "";
    this.attribs = null;
    this.stack.length = 0;
    this.startIndex = 0;
    this.endIndex = 0;
    this.cbs.onparserinit?.(this);
    this.buffers.length = 0;
    this.foreignContext.length = 0;
    this.foreignContext.unshift(ForeignContext.None);
    this.bufferOffset = 0;
    this.writeIndex = 0;
    this.ended = false;
  }
  /**
   * Resets the parser, then parses a complete document and
   * pushes it to the handler.
   * @param data Document to parse.
   */
  parseComplete(data) {
    this.reset();
    this.end(data);
  }
  getSlice(start, end) {
    if (start === end) {
      return "";
    }
    while (start - this.bufferOffset >= this.buffers[0].length) {
      this.shiftBuffer();
    }
    let slice = this.buffers[0].slice(start - this.bufferOffset, end - this.bufferOffset);
    while (end - this.bufferOffset > this.buffers[0].length) {
      this.shiftBuffer();
      slice += this.buffers[0].slice(0, end - this.bufferOffset);
    }
    return slice;
  }
  shiftBuffer() {
    this.bufferOffset += this.buffers[0].length;
    this.writeIndex--;
    this.buffers.shift();
  }
  /**
   * Parses a chunk of data and calls the corresponding callbacks.
   * @param chunk Chunk to parse.
   */
  write(chunk) {
    if (this.ended) {
      this.cbs.onerror?.(new Error(".write() after done!"));
      return;
    }
    this.buffers.push(chunk);
    if (this.tokenizer.running) {
      this.tokenizer.write(chunk);
      this.writeIndex++;
    }
  }
  /**
   * Parses the end of the buffer and clears the stack, calls onend.
   * @param chunk Optional final chunk to parse.
   */
  end(chunk) {
    if (this.ended) {
      this.cbs.onerror?.(new Error(".end() after done!"));
      return;
    }
    if (chunk)
      this.write(chunk);
    this.ended = true;
    this.tokenizer.end();
  }
  /**
   * Pauses parsing. The parser won't emit events until `resume` is called.
   */
  pause() {
    this.tokenizer.pause();
  }
  /**
   * Resumes parsing after `pause` was called.
   */
  resume() {
    this.tokenizer.resume();
    while (this.tokenizer.running && this.writeIndex < this.buffers.length) {
      this.tokenizer.write(this.buffers[this.writeIndex++]);
    }
    if (this.ended)
      this.tokenizer.end();
  }
};

// node_modules/mdast-util-to-string/lib/index.js
var emptyOptions = {};
function toString(value, options) {
  const settings = options || emptyOptions;
  const includeImageAlt = typeof settings.includeImageAlt === "boolean" ? settings.includeImageAlt : true;
  const includeHtml = typeof settings.includeHtml === "boolean" ? settings.includeHtml : true;
  return one(value, includeImageAlt, includeHtml);
}
function one(value, includeImageAlt, includeHtml) {
  if (node(value)) {
    if ("value" in value) {
      return value.type === "html" && !includeHtml ? "" : value.value;
    }
    if (includeImageAlt && "alt" in value && value.alt) {
      return value.alt;
    }
    if ("children" in value) {
      return all(value.children, includeImageAlt, includeHtml);
    }
  }
  if (Array.isArray(value)) {
    return all(value, includeImageAlt, includeHtml);
  }
  return "";
}
function all(values, includeImageAlt, includeHtml) {
  const result = [];
  let index2 = -1;
  while (++index2 < values.length) {
    result[index2] = one(values[index2], includeImageAlt, includeHtml);
  }
  return result.join("");
}
function node(value) {
  return Boolean(value && typeof value === "object");
}

// node_modules/character-entities/index.js
var characterEntities = {
  AElig: "\xC6",
  AMP: "&",
  Aacute: "\xC1",
  Abreve: "\u0102",
  Acirc: "\xC2",
  Acy: "\u0410",
  Afr: "\u{1D504}",
  Agrave: "\xC0",
  Alpha: "\u0391",
  Amacr: "\u0100",
  And: "\u2A53",
  Aogon: "\u0104",
  Aopf: "\u{1D538}",
  ApplyFunction: "\u2061",
  Aring: "\xC5",
  Ascr: "\u{1D49C}",
  Assign: "\u2254",
  Atilde: "\xC3",
  Auml: "\xC4",
  Backslash: "\u2216",
  Barv: "\u2AE7",
  Barwed: "\u2306",
  Bcy: "\u0411",
  Because: "\u2235",
  Bernoullis: "\u212C",
  Beta: "\u0392",
  Bfr: "\u{1D505}",
  Bopf: "\u{1D539}",
  Breve: "\u02D8",
  Bscr: "\u212C",
  Bumpeq: "\u224E",
  CHcy: "\u0427",
  COPY: "\xA9",
  Cacute: "\u0106",
  Cap: "\u22D2",
  CapitalDifferentialD: "\u2145",
  Cayleys: "\u212D",
  Ccaron: "\u010C",
  Ccedil: "\xC7",
  Ccirc: "\u0108",
  Cconint: "\u2230",
  Cdot: "\u010A",
  Cedilla: "\xB8",
  CenterDot: "\xB7",
  Cfr: "\u212D",
  Chi: "\u03A7",
  CircleDot: "\u2299",
  CircleMinus: "\u2296",
  CirclePlus: "\u2295",
  CircleTimes: "\u2297",
  ClockwiseContourIntegral: "\u2232",
  CloseCurlyDoubleQuote: "\u201D",
  CloseCurlyQuote: "\u2019",
  Colon: "\u2237",
  Colone: "\u2A74",
  Congruent: "\u2261",
  Conint: "\u222F",
  ContourIntegral: "\u222E",
  Copf: "\u2102",
  Coproduct: "\u2210",
  CounterClockwiseContourIntegral: "\u2233",
  Cross: "\u2A2F",
  Cscr: "\u{1D49E}",
  Cup: "\u22D3",
  CupCap: "\u224D",
  DD: "\u2145",
  DDotrahd: "\u2911",
  DJcy: "\u0402",
  DScy: "\u0405",
  DZcy: "\u040F",
  Dagger: "\u2021",
  Darr: "\u21A1",
  Dashv: "\u2AE4",
  Dcaron: "\u010E",
  Dcy: "\u0414",
  Del: "\u2207",
  Delta: "\u0394",
  Dfr: "\u{1D507}",
  DiacriticalAcute: "\xB4",
  DiacriticalDot: "\u02D9",
  DiacriticalDoubleAcute: "\u02DD",
  DiacriticalGrave: "`",
  DiacriticalTilde: "\u02DC",
  Diamond: "\u22C4",
  DifferentialD: "\u2146",
  Dopf: "\u{1D53B}",
  Dot: "\xA8",
  DotDot: "\u20DC",
  DotEqual: "\u2250",
  DoubleContourIntegral: "\u222F",
  DoubleDot: "\xA8",
  DoubleDownArrow: "\u21D3",
  DoubleLeftArrow: "\u21D0",
  DoubleLeftRightArrow: "\u21D4",
  DoubleLeftTee: "\u2AE4",
  DoubleLongLeftArrow: "\u27F8",
  DoubleLongLeftRightArrow: "\u27FA",
  DoubleLongRightArrow: "\u27F9",
  DoubleRightArrow: "\u21D2",
  DoubleRightTee: "\u22A8",
  DoubleUpArrow: "\u21D1",
  DoubleUpDownArrow: "\u21D5",
  DoubleVerticalBar: "\u2225",
  DownArrow: "\u2193",
  DownArrowBar: "\u2913",
  DownArrowUpArrow: "\u21F5",
  DownBreve: "\u0311",
  DownLeftRightVector: "\u2950",
  DownLeftTeeVector: "\u295E",
  DownLeftVector: "\u21BD",
  DownLeftVectorBar: "\u2956",
  DownRightTeeVector: "\u295F",
  DownRightVector: "\u21C1",
  DownRightVectorBar: "\u2957",
  DownTee: "\u22A4",
  DownTeeArrow: "\u21A7",
  Downarrow: "\u21D3",
  Dscr: "\u{1D49F}",
  Dstrok: "\u0110",
  ENG: "\u014A",
  ETH: "\xD0",
  Eacute: "\xC9",
  Ecaron: "\u011A",
  Ecirc: "\xCA",
  Ecy: "\u042D",
  Edot: "\u0116",
  Efr: "\u{1D508}",
  Egrave: "\xC8",
  Element: "\u2208",
  Emacr: "\u0112",
  EmptySmallSquare: "\u25FB",
  EmptyVerySmallSquare: "\u25AB",
  Eogon: "\u0118",
  Eopf: "\u{1D53C}",
  Epsilon: "\u0395",
  Equal: "\u2A75",
  EqualTilde: "\u2242",
  Equilibrium: "\u21CC",
  Escr: "\u2130",
  Esim: "\u2A73",
  Eta: "\u0397",
  Euml: "\xCB",
  Exists: "\u2203",
  ExponentialE: "\u2147",
  Fcy: "\u0424",
  Ffr: "\u{1D509}",
  FilledSmallSquare: "\u25FC",
  FilledVerySmallSquare: "\u25AA",
  Fopf: "\u{1D53D}",
  ForAll: "\u2200",
  Fouriertrf: "\u2131",
  Fscr: "\u2131",
  GJcy: "\u0403",
  GT: ">",
  Gamma: "\u0393",
  Gammad: "\u03DC",
  Gbreve: "\u011E",
  Gcedil: "\u0122",
  Gcirc: "\u011C",
  Gcy: "\u0413",
  Gdot: "\u0120",
  Gfr: "\u{1D50A}",
  Gg: "\u22D9",
  Gopf: "\u{1D53E}",
  GreaterEqual: "\u2265",
  GreaterEqualLess: "\u22DB",
  GreaterFullEqual: "\u2267",
  GreaterGreater: "\u2AA2",
  GreaterLess: "\u2277",
  GreaterSlantEqual: "\u2A7E",
  GreaterTilde: "\u2273",
  Gscr: "\u{1D4A2}",
  Gt: "\u226B",
  HARDcy: "\u042A",
  Hacek: "\u02C7",
  Hat: "^",
  Hcirc: "\u0124",
  Hfr: "\u210C",
  HilbertSpace: "\u210B",
  Hopf: "\u210D",
  HorizontalLine: "\u2500",
  Hscr: "\u210B",
  Hstrok: "\u0126",
  HumpDownHump: "\u224E",
  HumpEqual: "\u224F",
  IEcy: "\u0415",
  IJlig: "\u0132",
  IOcy: "\u0401",
  Iacute: "\xCD",
  Icirc: "\xCE",
  Icy: "\u0418",
  Idot: "\u0130",
  Ifr: "\u2111",
  Igrave: "\xCC",
  Im: "\u2111",
  Imacr: "\u012A",
  ImaginaryI: "\u2148",
  Implies: "\u21D2",
  Int: "\u222C",
  Integral: "\u222B",
  Intersection: "\u22C2",
  InvisibleComma: "\u2063",
  InvisibleTimes: "\u2062",
  Iogon: "\u012E",
  Iopf: "\u{1D540}",
  Iota: "\u0399",
  Iscr: "\u2110",
  Itilde: "\u0128",
  Iukcy: "\u0406",
  Iuml: "\xCF",
  Jcirc: "\u0134",
  Jcy: "\u0419",
  Jfr: "\u{1D50D}",
  Jopf: "\u{1D541}",
  Jscr: "\u{1D4A5}",
  Jsercy: "\u0408",
  Jukcy: "\u0404",
  KHcy: "\u0425",
  KJcy: "\u040C",
  Kappa: "\u039A",
  Kcedil: "\u0136",
  Kcy: "\u041A",
  Kfr: "\u{1D50E}",
  Kopf: "\u{1D542}",
  Kscr: "\u{1D4A6}",
  LJcy: "\u0409",
  LT: "<",
  Lacute: "\u0139",
  Lambda: "\u039B",
  Lang: "\u27EA",
  Laplacetrf: "\u2112",
  Larr: "\u219E",
  Lcaron: "\u013D",
  Lcedil: "\u013B",
  Lcy: "\u041B",
  LeftAngleBracket: "\u27E8",
  LeftArrow: "\u2190",
  LeftArrowBar: "\u21E4",
  LeftArrowRightArrow: "\u21C6",
  LeftCeiling: "\u2308",
  LeftDoubleBracket: "\u27E6",
  LeftDownTeeVector: "\u2961",
  LeftDownVector: "\u21C3",
  LeftDownVectorBar: "\u2959",
  LeftFloor: "\u230A",
  LeftRightArrow: "\u2194",
  LeftRightVector: "\u294E",
  LeftTee: "\u22A3",
  LeftTeeArrow: "\u21A4",
  LeftTeeVector: "\u295A",
  LeftTriangle: "\u22B2",
  LeftTriangleBar: "\u29CF",
  LeftTriangleEqual: "\u22B4",
  LeftUpDownVector: "\u2951",
  LeftUpTeeVector: "\u2960",
  LeftUpVector: "\u21BF",
  LeftUpVectorBar: "\u2958",
  LeftVector: "\u21BC",
  LeftVectorBar: "\u2952",
  Leftarrow: "\u21D0",
  Leftrightarrow: "\u21D4",
  LessEqualGreater: "\u22DA",
  LessFullEqual: "\u2266",
  LessGreater: "\u2276",
  LessLess: "\u2AA1",
  LessSlantEqual: "\u2A7D",
  LessTilde: "\u2272",
  Lfr: "\u{1D50F}",
  Ll: "\u22D8",
  Lleftarrow: "\u21DA",
  Lmidot: "\u013F",
  LongLeftArrow: "\u27F5",
  LongLeftRightArrow: "\u27F7",
  LongRightArrow: "\u27F6",
  Longleftarrow: "\u27F8",
  Longleftrightarrow: "\u27FA",
  Longrightarrow: "\u27F9",
  Lopf: "\u{1D543}",
  LowerLeftArrow: "\u2199",
  LowerRightArrow: "\u2198",
  Lscr: "\u2112",
  Lsh: "\u21B0",
  Lstrok: "\u0141",
  Lt: "\u226A",
  Map: "\u2905",
  Mcy: "\u041C",
  MediumSpace: "\u205F",
  Mellintrf: "\u2133",
  Mfr: "\u{1D510}",
  MinusPlus: "\u2213",
  Mopf: "\u{1D544}",
  Mscr: "\u2133",
  Mu: "\u039C",
  NJcy: "\u040A",
  Nacute: "\u0143",
  Ncaron: "\u0147",
  Ncedil: "\u0145",
  Ncy: "\u041D",
  NegativeMediumSpace: "\u200B",
  NegativeThickSpace: "\u200B",
  NegativeThinSpace: "\u200B",
  NegativeVeryThinSpace: "\u200B",
  NestedGreaterGreater: "\u226B",
  NestedLessLess: "\u226A",
  NewLine: "\n",
  Nfr: "\u{1D511}",
  NoBreak: "\u2060",
  NonBreakingSpace: "\xA0",
  Nopf: "\u2115",
  Not: "\u2AEC",
  NotCongruent: "\u2262",
  NotCupCap: "\u226D",
  NotDoubleVerticalBar: "\u2226",
  NotElement: "\u2209",
  NotEqual: "\u2260",
  NotEqualTilde: "\u2242\u0338",
  NotExists: "\u2204",
  NotGreater: "\u226F",
  NotGreaterEqual: "\u2271",
  NotGreaterFullEqual: "\u2267\u0338",
  NotGreaterGreater: "\u226B\u0338",
  NotGreaterLess: "\u2279",
  NotGreaterSlantEqual: "\u2A7E\u0338",
  NotGreaterTilde: "\u2275",
  NotHumpDownHump: "\u224E\u0338",
  NotHumpEqual: "\u224F\u0338",
  NotLeftTriangle: "\u22EA",
  NotLeftTriangleBar: "\u29CF\u0338",
  NotLeftTriangleEqual: "\u22EC",
  NotLess: "\u226E",
  NotLessEqual: "\u2270",
  NotLessGreater: "\u2278",
  NotLessLess: "\u226A\u0338",
  NotLessSlantEqual: "\u2A7D\u0338",
  NotLessTilde: "\u2274",
  NotNestedGreaterGreater: "\u2AA2\u0338",
  NotNestedLessLess: "\u2AA1\u0338",
  NotPrecedes: "\u2280",
  NotPrecedesEqual: "\u2AAF\u0338",
  NotPrecedesSlantEqual: "\u22E0",
  NotReverseElement: "\u220C",
  NotRightTriangle: "\u22EB",
  NotRightTriangleBar: "\u29D0\u0338",
  NotRightTriangleEqual: "\u22ED",
  NotSquareSubset: "\u228F\u0338",
  NotSquareSubsetEqual: "\u22E2",
  NotSquareSuperset: "\u2290\u0338",
  NotSquareSupersetEqual: "\u22E3",
  NotSubset: "\u2282\u20D2",
  NotSubsetEqual: "\u2288",
  NotSucceeds: "\u2281",
  NotSucceedsEqual: "\u2AB0\u0338",
  NotSucceedsSlantEqual: "\u22E1",
  NotSucceedsTilde: "\u227F\u0338",
  NotSuperset: "\u2283\u20D2",
  NotSupersetEqual: "\u2289",
  NotTilde: "\u2241",
  NotTildeEqual: "\u2244",
  NotTildeFullEqual: "\u2247",
  NotTildeTilde: "\u2249",
  NotVerticalBar: "\u2224",
  Nscr: "\u{1D4A9}",
  Ntilde: "\xD1",
  Nu: "\u039D",
  OElig: "\u0152",
  Oacute: "\xD3",
  Ocirc: "\xD4",
  Ocy: "\u041E",
  Odblac: "\u0150",
  Ofr: "\u{1D512}",
  Ograve: "\xD2",
  Omacr: "\u014C",
  Omega: "\u03A9",
  Omicron: "\u039F",
  Oopf: "\u{1D546}",
  OpenCurlyDoubleQuote: "\u201C",
  OpenCurlyQuote: "\u2018",
  Or: "\u2A54",
  Oscr: "\u{1D4AA}",
  Oslash: "\xD8",
  Otilde: "\xD5",
  Otimes: "\u2A37",
  Ouml: "\xD6",
  OverBar: "\u203E",
  OverBrace: "\u23DE",
  OverBracket: "\u23B4",
  OverParenthesis: "\u23DC",
  PartialD: "\u2202",
  Pcy: "\u041F",
  Pfr: "\u{1D513}",
  Phi: "\u03A6",
  Pi: "\u03A0",
  PlusMinus: "\xB1",
  Poincareplane: "\u210C",
  Popf: "\u2119",
  Pr: "\u2ABB",
  Precedes: "\u227A",
  PrecedesEqual: "\u2AAF",
  PrecedesSlantEqual: "\u227C",
  PrecedesTilde: "\u227E",
  Prime: "\u2033",
  Product: "\u220F",
  Proportion: "\u2237",
  Proportional: "\u221D",
  Pscr: "\u{1D4AB}",
  Psi: "\u03A8",
  QUOT: '"',
  Qfr: "\u{1D514}",
  Qopf: "\u211A",
  Qscr: "\u{1D4AC}",
  RBarr: "\u2910",
  REG: "\xAE",
  Racute: "\u0154",
  Rang: "\u27EB",
  Rarr: "\u21A0",
  Rarrtl: "\u2916",
  Rcaron: "\u0158",
  Rcedil: "\u0156",
  Rcy: "\u0420",
  Re: "\u211C",
  ReverseElement: "\u220B",
  ReverseEquilibrium: "\u21CB",
  ReverseUpEquilibrium: "\u296F",
  Rfr: "\u211C",
  Rho: "\u03A1",
  RightAngleBracket: "\u27E9",
  RightArrow: "\u2192",
  RightArrowBar: "\u21E5",
  RightArrowLeftArrow: "\u21C4",
  RightCeiling: "\u2309",
  RightDoubleBracket: "\u27E7",
  RightDownTeeVector: "\u295D",
  RightDownVector: "\u21C2",
  RightDownVectorBar: "\u2955",
  RightFloor: "\u230B",
  RightTee: "\u22A2",
  RightTeeArrow: "\u21A6",
  RightTeeVector: "\u295B",
  RightTriangle: "\u22B3",
  RightTriangleBar: "\u29D0",
  RightTriangleEqual: "\u22B5",
  RightUpDownVector: "\u294F",
  RightUpTeeVector: "\u295C",
  RightUpVector: "\u21BE",
  RightUpVectorBar: "\u2954",
  RightVector: "\u21C0",
  RightVectorBar: "\u2953",
  Rightarrow: "\u21D2",
  Ropf: "\u211D",
  RoundImplies: "\u2970",
  Rrightarrow: "\u21DB",
  Rscr: "\u211B",
  Rsh: "\u21B1",
  RuleDelayed: "\u29F4",
  SHCHcy: "\u0429",
  SHcy: "\u0428",
  SOFTcy: "\u042C",
  Sacute: "\u015A",
  Sc: "\u2ABC",
  Scaron: "\u0160",
  Scedil: "\u015E",
  Scirc: "\u015C",
  Scy: "\u0421",
  Sfr: "\u{1D516}",
  ShortDownArrow: "\u2193",
  ShortLeftArrow: "\u2190",
  ShortRightArrow: "\u2192",
  ShortUpArrow: "\u2191",
  Sigma: "\u03A3",
  SmallCircle: "\u2218",
  Sopf: "\u{1D54A}",
  Sqrt: "\u221A",
  Square: "\u25A1",
  SquareIntersection: "\u2293",
  SquareSubset: "\u228F",
  SquareSubsetEqual: "\u2291",
  SquareSuperset: "\u2290",
  SquareSupersetEqual: "\u2292",
  SquareUnion: "\u2294",
  Sscr: "\u{1D4AE}",
  Star: "\u22C6",
  Sub: "\u22D0",
  Subset: "\u22D0",
  SubsetEqual: "\u2286",
  Succeeds: "\u227B",
  SucceedsEqual: "\u2AB0",
  SucceedsSlantEqual: "\u227D",
  SucceedsTilde: "\u227F",
  SuchThat: "\u220B",
  Sum: "\u2211",
  Sup: "\u22D1",
  Superset: "\u2283",
  SupersetEqual: "\u2287",
  Supset: "\u22D1",
  THORN: "\xDE",
  TRADE: "\u2122",
  TSHcy: "\u040B",
  TScy: "\u0426",
  Tab: "	",
  Tau: "\u03A4",
  Tcaron: "\u0164",
  Tcedil: "\u0162",
  Tcy: "\u0422",
  Tfr: "\u{1D517}",
  Therefore: "\u2234",
  Theta: "\u0398",
  ThickSpace: "\u205F\u200A",
  ThinSpace: "\u2009",
  Tilde: "\u223C",
  TildeEqual: "\u2243",
  TildeFullEqual: "\u2245",
  TildeTilde: "\u2248",
  Topf: "\u{1D54B}",
  TripleDot: "\u20DB",
  Tscr: "\u{1D4AF}",
  Tstrok: "\u0166",
  Uacute: "\xDA",
  Uarr: "\u219F",
  Uarrocir: "\u2949",
  Ubrcy: "\u040E",
  Ubreve: "\u016C",
  Ucirc: "\xDB",
  Ucy: "\u0423",
  Udblac: "\u0170",
  Ufr: "\u{1D518}",
  Ugrave: "\xD9",
  Umacr: "\u016A",
  UnderBar: "_",
  UnderBrace: "\u23DF",
  UnderBracket: "\u23B5",
  UnderParenthesis: "\u23DD",
  Union: "\u22C3",
  UnionPlus: "\u228E",
  Uogon: "\u0172",
  Uopf: "\u{1D54C}",
  UpArrow: "\u2191",
  UpArrowBar: "\u2912",
  UpArrowDownArrow: "\u21C5",
  UpDownArrow: "\u2195",
  UpEquilibrium: "\u296E",
  UpTee: "\u22A5",
  UpTeeArrow: "\u21A5",
  Uparrow: "\u21D1",
  Updownarrow: "\u21D5",
  UpperLeftArrow: "\u2196",
  UpperRightArrow: "\u2197",
  Upsi: "\u03D2",
  Upsilon: "\u03A5",
  Uring: "\u016E",
  Uscr: "\u{1D4B0}",
  Utilde: "\u0168",
  Uuml: "\xDC",
  VDash: "\u22AB",
  Vbar: "\u2AEB",
  Vcy: "\u0412",
  Vdash: "\u22A9",
  Vdashl: "\u2AE6",
  Vee: "\u22C1",
  Verbar: "\u2016",
  Vert: "\u2016",
  VerticalBar: "\u2223",
  VerticalLine: "|",
  VerticalSeparator: "\u2758",
  VerticalTilde: "\u2240",
  VeryThinSpace: "\u200A",
  Vfr: "\u{1D519}",
  Vopf: "\u{1D54D}",
  Vscr: "\u{1D4B1}",
  Vvdash: "\u22AA",
  Wcirc: "\u0174",
  Wedge: "\u22C0",
  Wfr: "\u{1D51A}",
  Wopf: "\u{1D54E}",
  Wscr: "\u{1D4B2}",
  Xfr: "\u{1D51B}",
  Xi: "\u039E",
  Xopf: "\u{1D54F}",
  Xscr: "\u{1D4B3}",
  YAcy: "\u042F",
  YIcy: "\u0407",
  YUcy: "\u042E",
  Yacute: "\xDD",
  Ycirc: "\u0176",
  Ycy: "\u042B",
  Yfr: "\u{1D51C}",
  Yopf: "\u{1D550}",
  Yscr: "\u{1D4B4}",
  Yuml: "\u0178",
  ZHcy: "\u0416",
  Zacute: "\u0179",
  Zcaron: "\u017D",
  Zcy: "\u0417",
  Zdot: "\u017B",
  ZeroWidthSpace: "\u200B",
  Zeta: "\u0396",
  Zfr: "\u2128",
  Zopf: "\u2124",
  Zscr: "\u{1D4B5}",
  aacute: "\xE1",
  abreve: "\u0103",
  ac: "\u223E",
  acE: "\u223E\u0333",
  acd: "\u223F",
  acirc: "\xE2",
  acute: "\xB4",
  acy: "\u0430",
  aelig: "\xE6",
  af: "\u2061",
  afr: "\u{1D51E}",
  agrave: "\xE0",
  alefsym: "\u2135",
  aleph: "\u2135",
  alpha: "\u03B1",
  amacr: "\u0101",
  amalg: "\u2A3F",
  amp: "&",
  and: "\u2227",
  andand: "\u2A55",
  andd: "\u2A5C",
  andslope: "\u2A58",
  andv: "\u2A5A",
  ang: "\u2220",
  ange: "\u29A4",
  angle: "\u2220",
  angmsd: "\u2221",
  angmsdaa: "\u29A8",
  angmsdab: "\u29A9",
  angmsdac: "\u29AA",
  angmsdad: "\u29AB",
  angmsdae: "\u29AC",
  angmsdaf: "\u29AD",
  angmsdag: "\u29AE",
  angmsdah: "\u29AF",
  angrt: "\u221F",
  angrtvb: "\u22BE",
  angrtvbd: "\u299D",
  angsph: "\u2222",
  angst: "\xC5",
  angzarr: "\u237C",
  aogon: "\u0105",
  aopf: "\u{1D552}",
  ap: "\u2248",
  apE: "\u2A70",
  apacir: "\u2A6F",
  ape: "\u224A",
  apid: "\u224B",
  apos: "'",
  approx: "\u2248",
  approxeq: "\u224A",
  aring: "\xE5",
  ascr: "\u{1D4B6}",
  ast: "*",
  asymp: "\u2248",
  asympeq: "\u224D",
  atilde: "\xE3",
  auml: "\xE4",
  awconint: "\u2233",
  awint: "\u2A11",
  bNot: "\u2AED",
  backcong: "\u224C",
  backepsilon: "\u03F6",
  backprime: "\u2035",
  backsim: "\u223D",
  backsimeq: "\u22CD",
  barvee: "\u22BD",
  barwed: "\u2305",
  barwedge: "\u2305",
  bbrk: "\u23B5",
  bbrktbrk: "\u23B6",
  bcong: "\u224C",
  bcy: "\u0431",
  bdquo: "\u201E",
  becaus: "\u2235",
  because: "\u2235",
  bemptyv: "\u29B0",
  bepsi: "\u03F6",
  bernou: "\u212C",
  beta: "\u03B2",
  beth: "\u2136",
  between: "\u226C",
  bfr: "\u{1D51F}",
  bigcap: "\u22C2",
  bigcirc: "\u25EF",
  bigcup: "\u22C3",
  bigodot: "\u2A00",
  bigoplus: "\u2A01",
  bigotimes: "\u2A02",
  bigsqcup: "\u2A06",
  bigstar: "\u2605",
  bigtriangledown: "\u25BD",
  bigtriangleup: "\u25B3",
  biguplus: "\u2A04",
  bigvee: "\u22C1",
  bigwedge: "\u22C0",
  bkarow: "\u290D",
  blacklozenge: "\u29EB",
  blacksquare: "\u25AA",
  blacktriangle: "\u25B4",
  blacktriangledown: "\u25BE",
  blacktriangleleft: "\u25C2",
  blacktriangleright: "\u25B8",
  blank: "\u2423",
  blk12: "\u2592",
  blk14: "\u2591",
  blk34: "\u2593",
  block: "\u2588",
  bne: "=\u20E5",
  bnequiv: "\u2261\u20E5",
  bnot: "\u2310",
  bopf: "\u{1D553}",
  bot: "\u22A5",
  bottom: "\u22A5",
  bowtie: "\u22C8",
  boxDL: "\u2557",
  boxDR: "\u2554",
  boxDl: "\u2556",
  boxDr: "\u2553",
  boxH: "\u2550",
  boxHD: "\u2566",
  boxHU: "\u2569",
  boxHd: "\u2564",
  boxHu: "\u2567",
  boxUL: "\u255D",
  boxUR: "\u255A",
  boxUl: "\u255C",
  boxUr: "\u2559",
  boxV: "\u2551",
  boxVH: "\u256C",
  boxVL: "\u2563",
  boxVR: "\u2560",
  boxVh: "\u256B",
  boxVl: "\u2562",
  boxVr: "\u255F",
  boxbox: "\u29C9",
  boxdL: "\u2555",
  boxdR: "\u2552",
  boxdl: "\u2510",
  boxdr: "\u250C",
  boxh: "\u2500",
  boxhD: "\u2565",
  boxhU: "\u2568",
  boxhd: "\u252C",
  boxhu: "\u2534",
  boxminus: "\u229F",
  boxplus: "\u229E",
  boxtimes: "\u22A0",
  boxuL: "\u255B",
  boxuR: "\u2558",
  boxul: "\u2518",
  boxur: "\u2514",
  boxv: "\u2502",
  boxvH: "\u256A",
  boxvL: "\u2561",
  boxvR: "\u255E",
  boxvh: "\u253C",
  boxvl: "\u2524",
  boxvr: "\u251C",
  bprime: "\u2035",
  breve: "\u02D8",
  brvbar: "\xA6",
  bscr: "\u{1D4B7}",
  bsemi: "\u204F",
  bsim: "\u223D",
  bsime: "\u22CD",
  bsol: "\\",
  bsolb: "\u29C5",
  bsolhsub: "\u27C8",
  bull: "\u2022",
  bullet: "\u2022",
  bump: "\u224E",
  bumpE: "\u2AAE",
  bumpe: "\u224F",
  bumpeq: "\u224F",
  cacute: "\u0107",
  cap: "\u2229",
  capand: "\u2A44",
  capbrcup: "\u2A49",
  capcap: "\u2A4B",
  capcup: "\u2A47",
  capdot: "\u2A40",
  caps: "\u2229\uFE00",
  caret: "\u2041",
  caron: "\u02C7",
  ccaps: "\u2A4D",
  ccaron: "\u010D",
  ccedil: "\xE7",
  ccirc: "\u0109",
  ccups: "\u2A4C",
  ccupssm: "\u2A50",
  cdot: "\u010B",
  cedil: "\xB8",
  cemptyv: "\u29B2",
  cent: "\xA2",
  centerdot: "\xB7",
  cfr: "\u{1D520}",
  chcy: "\u0447",
  check: "\u2713",
  checkmark: "\u2713",
  chi: "\u03C7",
  cir: "\u25CB",
  cirE: "\u29C3",
  circ: "\u02C6",
  circeq: "\u2257",
  circlearrowleft: "\u21BA",
  circlearrowright: "\u21BB",
  circledR: "\xAE",
  circledS: "\u24C8",
  circledast: "\u229B",
  circledcirc: "\u229A",
  circleddash: "\u229D",
  cire: "\u2257",
  cirfnint: "\u2A10",
  cirmid: "\u2AEF",
  cirscir: "\u29C2",
  clubs: "\u2663",
  clubsuit: "\u2663",
  colon: ":",
  colone: "\u2254",
  coloneq: "\u2254",
  comma: ",",
  commat: "@",
  comp: "\u2201",
  compfn: "\u2218",
  complement: "\u2201",
  complexes: "\u2102",
  cong: "\u2245",
  congdot: "\u2A6D",
  conint: "\u222E",
  copf: "\u{1D554}",
  coprod: "\u2210",
  copy: "\xA9",
  copysr: "\u2117",
  crarr: "\u21B5",
  cross: "\u2717",
  cscr: "\u{1D4B8}",
  csub: "\u2ACF",
  csube: "\u2AD1",
  csup: "\u2AD0",
  csupe: "\u2AD2",
  ctdot: "\u22EF",
  cudarrl: "\u2938",
  cudarrr: "\u2935",
  cuepr: "\u22DE",
  cuesc: "\u22DF",
  cularr: "\u21B6",
  cularrp: "\u293D",
  cup: "\u222A",
  cupbrcap: "\u2A48",
  cupcap: "\u2A46",
  cupcup: "\u2A4A",
  cupdot: "\u228D",
  cupor: "\u2A45",
  cups: "\u222A\uFE00",
  curarr: "\u21B7",
  curarrm: "\u293C",
  curlyeqprec: "\u22DE",
  curlyeqsucc: "\u22DF",
  curlyvee: "\u22CE",
  curlywedge: "\u22CF",
  curren: "\xA4",
  curvearrowleft: "\u21B6",
  curvearrowright: "\u21B7",
  cuvee: "\u22CE",
  cuwed: "\u22CF",
  cwconint: "\u2232",
  cwint: "\u2231",
  cylcty: "\u232D",
  dArr: "\u21D3",
  dHar: "\u2965",
  dagger: "\u2020",
  daleth: "\u2138",
  darr: "\u2193",
  dash: "\u2010",
  dashv: "\u22A3",
  dbkarow: "\u290F",
  dblac: "\u02DD",
  dcaron: "\u010F",
  dcy: "\u0434",
  dd: "\u2146",
  ddagger: "\u2021",
  ddarr: "\u21CA",
  ddotseq: "\u2A77",
  deg: "\xB0",
  delta: "\u03B4",
  demptyv: "\u29B1",
  dfisht: "\u297F",
  dfr: "\u{1D521}",
  dharl: "\u21C3",
  dharr: "\u21C2",
  diam: "\u22C4",
  diamond: "\u22C4",
  diamondsuit: "\u2666",
  diams: "\u2666",
  die: "\xA8",
  digamma: "\u03DD",
  disin: "\u22F2",
  div: "\xF7",
  divide: "\xF7",
  divideontimes: "\u22C7",
  divonx: "\u22C7",
  djcy: "\u0452",
  dlcorn: "\u231E",
  dlcrop: "\u230D",
  dollar: "$",
  dopf: "\u{1D555}",
  dot: "\u02D9",
  doteq: "\u2250",
  doteqdot: "\u2251",
  dotminus: "\u2238",
  dotplus: "\u2214",
  dotsquare: "\u22A1",
  doublebarwedge: "\u2306",
  downarrow: "\u2193",
  downdownarrows: "\u21CA",
  downharpoonleft: "\u21C3",
  downharpoonright: "\u21C2",
  drbkarow: "\u2910",
  drcorn: "\u231F",
  drcrop: "\u230C",
  dscr: "\u{1D4B9}",
  dscy: "\u0455",
  dsol: "\u29F6",
  dstrok: "\u0111",
  dtdot: "\u22F1",
  dtri: "\u25BF",
  dtrif: "\u25BE",
  duarr: "\u21F5",
  duhar: "\u296F",
  dwangle: "\u29A6",
  dzcy: "\u045F",
  dzigrarr: "\u27FF",
  eDDot: "\u2A77",
  eDot: "\u2251",
  eacute: "\xE9",
  easter: "\u2A6E",
  ecaron: "\u011B",
  ecir: "\u2256",
  ecirc: "\xEA",
  ecolon: "\u2255",
  ecy: "\u044D",
  edot: "\u0117",
  ee: "\u2147",
  efDot: "\u2252",
  efr: "\u{1D522}",
  eg: "\u2A9A",
  egrave: "\xE8",
  egs: "\u2A96",
  egsdot: "\u2A98",
  el: "\u2A99",
  elinters: "\u23E7",
  ell: "\u2113",
  els: "\u2A95",
  elsdot: "\u2A97",
  emacr: "\u0113",
  empty: "\u2205",
  emptyset: "\u2205",
  emptyv: "\u2205",
  emsp13: "\u2004",
  emsp14: "\u2005",
  emsp: "\u2003",
  eng: "\u014B",
  ensp: "\u2002",
  eogon: "\u0119",
  eopf: "\u{1D556}",
  epar: "\u22D5",
  eparsl: "\u29E3",
  eplus: "\u2A71",
  epsi: "\u03B5",
  epsilon: "\u03B5",
  epsiv: "\u03F5",
  eqcirc: "\u2256",
  eqcolon: "\u2255",
  eqsim: "\u2242",
  eqslantgtr: "\u2A96",
  eqslantless: "\u2A95",
  equals: "=",
  equest: "\u225F",
  equiv: "\u2261",
  equivDD: "\u2A78",
  eqvparsl: "\u29E5",
  erDot: "\u2253",
  erarr: "\u2971",
  escr: "\u212F",
  esdot: "\u2250",
  esim: "\u2242",
  eta: "\u03B7",
  eth: "\xF0",
  euml: "\xEB",
  euro: "\u20AC",
  excl: "!",
  exist: "\u2203",
  expectation: "\u2130",
  exponentiale: "\u2147",
  fallingdotseq: "\u2252",
  fcy: "\u0444",
  female: "\u2640",
  ffilig: "\uFB03",
  fflig: "\uFB00",
  ffllig: "\uFB04",
  ffr: "\u{1D523}",
  filig: "\uFB01",
  fjlig: "fj",
  flat: "\u266D",
  fllig: "\uFB02",
  fltns: "\u25B1",
  fnof: "\u0192",
  fopf: "\u{1D557}",
  forall: "\u2200",
  fork: "\u22D4",
  forkv: "\u2AD9",
  fpartint: "\u2A0D",
  frac12: "\xBD",
  frac13: "\u2153",
  frac14: "\xBC",
  frac15: "\u2155",
  frac16: "\u2159",
  frac18: "\u215B",
  frac23: "\u2154",
  frac25: "\u2156",
  frac34: "\xBE",
  frac35: "\u2157",
  frac38: "\u215C",
  frac45: "\u2158",
  frac56: "\u215A",
  frac58: "\u215D",
  frac78: "\u215E",
  frasl: "\u2044",
  frown: "\u2322",
  fscr: "\u{1D4BB}",
  gE: "\u2267",
  gEl: "\u2A8C",
  gacute: "\u01F5",
  gamma: "\u03B3",
  gammad: "\u03DD",
  gap: "\u2A86",
  gbreve: "\u011F",
  gcirc: "\u011D",
  gcy: "\u0433",
  gdot: "\u0121",
  ge: "\u2265",
  gel: "\u22DB",
  geq: "\u2265",
  geqq: "\u2267",
  geqslant: "\u2A7E",
  ges: "\u2A7E",
  gescc: "\u2AA9",
  gesdot: "\u2A80",
  gesdoto: "\u2A82",
  gesdotol: "\u2A84",
  gesl: "\u22DB\uFE00",
  gesles: "\u2A94",
  gfr: "\u{1D524}",
  gg: "\u226B",
  ggg: "\u22D9",
  gimel: "\u2137",
  gjcy: "\u0453",
  gl: "\u2277",
  glE: "\u2A92",
  gla: "\u2AA5",
  glj: "\u2AA4",
  gnE: "\u2269",
  gnap: "\u2A8A",
  gnapprox: "\u2A8A",
  gne: "\u2A88",
  gneq: "\u2A88",
  gneqq: "\u2269",
  gnsim: "\u22E7",
  gopf: "\u{1D558}",
  grave: "`",
  gscr: "\u210A",
  gsim: "\u2273",
  gsime: "\u2A8E",
  gsiml: "\u2A90",
  gt: ">",
  gtcc: "\u2AA7",
  gtcir: "\u2A7A",
  gtdot: "\u22D7",
  gtlPar: "\u2995",
  gtquest: "\u2A7C",
  gtrapprox: "\u2A86",
  gtrarr: "\u2978",
  gtrdot: "\u22D7",
  gtreqless: "\u22DB",
  gtreqqless: "\u2A8C",
  gtrless: "\u2277",
  gtrsim: "\u2273",
  gvertneqq: "\u2269\uFE00",
  gvnE: "\u2269\uFE00",
  hArr: "\u21D4",
  hairsp: "\u200A",
  half: "\xBD",
  hamilt: "\u210B",
  hardcy: "\u044A",
  harr: "\u2194",
  harrcir: "\u2948",
  harrw: "\u21AD",
  hbar: "\u210F",
  hcirc: "\u0125",
  hearts: "\u2665",
  heartsuit: "\u2665",
  hellip: "\u2026",
  hercon: "\u22B9",
  hfr: "\u{1D525}",
  hksearow: "\u2925",
  hkswarow: "\u2926",
  hoarr: "\u21FF",
  homtht: "\u223B",
  hookleftarrow: "\u21A9",
  hookrightarrow: "\u21AA",
  hopf: "\u{1D559}",
  horbar: "\u2015",
  hscr: "\u{1D4BD}",
  hslash: "\u210F",
  hstrok: "\u0127",
  hybull: "\u2043",
  hyphen: "\u2010",
  iacute: "\xED",
  ic: "\u2063",
  icirc: "\xEE",
  icy: "\u0438",
  iecy: "\u0435",
  iexcl: "\xA1",
  iff: "\u21D4",
  ifr: "\u{1D526}",
  igrave: "\xEC",
  ii: "\u2148",
  iiiint: "\u2A0C",
  iiint: "\u222D",
  iinfin: "\u29DC",
  iiota: "\u2129",
  ijlig: "\u0133",
  imacr: "\u012B",
  image: "\u2111",
  imagline: "\u2110",
  imagpart: "\u2111",
  imath: "\u0131",
  imof: "\u22B7",
  imped: "\u01B5",
  in: "\u2208",
  incare: "\u2105",
  infin: "\u221E",
  infintie: "\u29DD",
  inodot: "\u0131",
  int: "\u222B",
  intcal: "\u22BA",
  integers: "\u2124",
  intercal: "\u22BA",
  intlarhk: "\u2A17",
  intprod: "\u2A3C",
  iocy: "\u0451",
  iogon: "\u012F",
  iopf: "\u{1D55A}",
  iota: "\u03B9",
  iprod: "\u2A3C",
  iquest: "\xBF",
  iscr: "\u{1D4BE}",
  isin: "\u2208",
  isinE: "\u22F9",
  isindot: "\u22F5",
  isins: "\u22F4",
  isinsv: "\u22F3",
  isinv: "\u2208",
  it: "\u2062",
  itilde: "\u0129",
  iukcy: "\u0456",
  iuml: "\xEF",
  jcirc: "\u0135",
  jcy: "\u0439",
  jfr: "\u{1D527}",
  jmath: "\u0237",
  jopf: "\u{1D55B}",
  jscr: "\u{1D4BF}",
  jsercy: "\u0458",
  jukcy: "\u0454",
  kappa: "\u03BA",
  kappav: "\u03F0",
  kcedil: "\u0137",
  kcy: "\u043A",
  kfr: "\u{1D528}",
  kgreen: "\u0138",
  khcy: "\u0445",
  kjcy: "\u045C",
  kopf: "\u{1D55C}",
  kscr: "\u{1D4C0}",
  lAarr: "\u21DA",
  lArr: "\u21D0",
  lAtail: "\u291B",
  lBarr: "\u290E",
  lE: "\u2266",
  lEg: "\u2A8B",
  lHar: "\u2962",
  lacute: "\u013A",
  laemptyv: "\u29B4",
  lagran: "\u2112",
  lambda: "\u03BB",
  lang: "\u27E8",
  langd: "\u2991",
  langle: "\u27E8",
  lap: "\u2A85",
  laquo: "\xAB",
  larr: "\u2190",
  larrb: "\u21E4",
  larrbfs: "\u291F",
  larrfs: "\u291D",
  larrhk: "\u21A9",
  larrlp: "\u21AB",
  larrpl: "\u2939",
  larrsim: "\u2973",
  larrtl: "\u21A2",
  lat: "\u2AAB",
  latail: "\u2919",
  late: "\u2AAD",
  lates: "\u2AAD\uFE00",
  lbarr: "\u290C",
  lbbrk: "\u2772",
  lbrace: "{",
  lbrack: "[",
  lbrke: "\u298B",
  lbrksld: "\u298F",
  lbrkslu: "\u298D",
  lcaron: "\u013E",
  lcedil: "\u013C",
  lceil: "\u2308",
  lcub: "{",
  lcy: "\u043B",
  ldca: "\u2936",
  ldquo: "\u201C",
  ldquor: "\u201E",
  ldrdhar: "\u2967",
  ldrushar: "\u294B",
  ldsh: "\u21B2",
  le: "\u2264",
  leftarrow: "\u2190",
  leftarrowtail: "\u21A2",
  leftharpoondown: "\u21BD",
  leftharpoonup: "\u21BC",
  leftleftarrows: "\u21C7",
  leftrightarrow: "\u2194",
  leftrightarrows: "\u21C6",
  leftrightharpoons: "\u21CB",
  leftrightsquigarrow: "\u21AD",
  leftthreetimes: "\u22CB",
  leg: "\u22DA",
  leq: "\u2264",
  leqq: "\u2266",
  leqslant: "\u2A7D",
  les: "\u2A7D",
  lescc: "\u2AA8",
  lesdot: "\u2A7F",
  lesdoto: "\u2A81",
  lesdotor: "\u2A83",
  lesg: "\u22DA\uFE00",
  lesges: "\u2A93",
  lessapprox: "\u2A85",
  lessdot: "\u22D6",
  lesseqgtr: "\u22DA",
  lesseqqgtr: "\u2A8B",
  lessgtr: "\u2276",
  lesssim: "\u2272",
  lfisht: "\u297C",
  lfloor: "\u230A",
  lfr: "\u{1D529}",
  lg: "\u2276",
  lgE: "\u2A91",
  lhard: "\u21BD",
  lharu: "\u21BC",
  lharul: "\u296A",
  lhblk: "\u2584",
  ljcy: "\u0459",
  ll: "\u226A",
  llarr: "\u21C7",
  llcorner: "\u231E",
  llhard: "\u296B",
  lltri: "\u25FA",
  lmidot: "\u0140",
  lmoust: "\u23B0",
  lmoustache: "\u23B0",
  lnE: "\u2268",
  lnap: "\u2A89",
  lnapprox: "\u2A89",
  lne: "\u2A87",
  lneq: "\u2A87",
  lneqq: "\u2268",
  lnsim: "\u22E6",
  loang: "\u27EC",
  loarr: "\u21FD",
  lobrk: "\u27E6",
  longleftarrow: "\u27F5",
  longleftrightarrow: "\u27F7",
  longmapsto: "\u27FC",
  longrightarrow: "\u27F6",
  looparrowleft: "\u21AB",
  looparrowright: "\u21AC",
  lopar: "\u2985",
  lopf: "\u{1D55D}",
  loplus: "\u2A2D",
  lotimes: "\u2A34",
  lowast: "\u2217",
  lowbar: "_",
  loz: "\u25CA",
  lozenge: "\u25CA",
  lozf: "\u29EB",
  lpar: "(",
  lparlt: "\u2993",
  lrarr: "\u21C6",
  lrcorner: "\u231F",
  lrhar: "\u21CB",
  lrhard: "\u296D",
  lrm: "\u200E",
  lrtri: "\u22BF",
  lsaquo: "\u2039",
  lscr: "\u{1D4C1}",
  lsh: "\u21B0",
  lsim: "\u2272",
  lsime: "\u2A8D",
  lsimg: "\u2A8F",
  lsqb: "[",
  lsquo: "\u2018",
  lsquor: "\u201A",
  lstrok: "\u0142",
  lt: "<",
  ltcc: "\u2AA6",
  ltcir: "\u2A79",
  ltdot: "\u22D6",
  lthree: "\u22CB",
  ltimes: "\u22C9",
  ltlarr: "\u2976",
  ltquest: "\u2A7B",
  ltrPar: "\u2996",
  ltri: "\u25C3",
  ltrie: "\u22B4",
  ltrif: "\u25C2",
  lurdshar: "\u294A",
  luruhar: "\u2966",
  lvertneqq: "\u2268\uFE00",
  lvnE: "\u2268\uFE00",
  mDDot: "\u223A",
  macr: "\xAF",
  male: "\u2642",
  malt: "\u2720",
  maltese: "\u2720",
  map: "\u21A6",
  mapsto: "\u21A6",
  mapstodown: "\u21A7",
  mapstoleft: "\u21A4",
  mapstoup: "\u21A5",
  marker: "\u25AE",
  mcomma: "\u2A29",
  mcy: "\u043C",
  mdash: "\u2014",
  measuredangle: "\u2221",
  mfr: "\u{1D52A}",
  mho: "\u2127",
  micro: "\xB5",
  mid: "\u2223",
  midast: "*",
  midcir: "\u2AF0",
  middot: "\xB7",
  minus: "\u2212",
  minusb: "\u229F",
  minusd: "\u2238",
  minusdu: "\u2A2A",
  mlcp: "\u2ADB",
  mldr: "\u2026",
  mnplus: "\u2213",
  models: "\u22A7",
  mopf: "\u{1D55E}",
  mp: "\u2213",
  mscr: "\u{1D4C2}",
  mstpos: "\u223E",
  mu: "\u03BC",
  multimap: "\u22B8",
  mumap: "\u22B8",
  nGg: "\u22D9\u0338",
  nGt: "\u226B\u20D2",
  nGtv: "\u226B\u0338",
  nLeftarrow: "\u21CD",
  nLeftrightarrow: "\u21CE",
  nLl: "\u22D8\u0338",
  nLt: "\u226A\u20D2",
  nLtv: "\u226A\u0338",
  nRightarrow: "\u21CF",
  nVDash: "\u22AF",
  nVdash: "\u22AE",
  nabla: "\u2207",
  nacute: "\u0144",
  nang: "\u2220\u20D2",
  nap: "\u2249",
  napE: "\u2A70\u0338",
  napid: "\u224B\u0338",
  napos: "\u0149",
  napprox: "\u2249",
  natur: "\u266E",
  natural: "\u266E",
  naturals: "\u2115",
  nbsp: "\xA0",
  nbump: "\u224E\u0338",
  nbumpe: "\u224F\u0338",
  ncap: "\u2A43",
  ncaron: "\u0148",
  ncedil: "\u0146",
  ncong: "\u2247",
  ncongdot: "\u2A6D\u0338",
  ncup: "\u2A42",
  ncy: "\u043D",
  ndash: "\u2013",
  ne: "\u2260",
  neArr: "\u21D7",
  nearhk: "\u2924",
  nearr: "\u2197",
  nearrow: "\u2197",
  nedot: "\u2250\u0338",
  nequiv: "\u2262",
  nesear: "\u2928",
  nesim: "\u2242\u0338",
  nexist: "\u2204",
  nexists: "\u2204",
  nfr: "\u{1D52B}",
  ngE: "\u2267\u0338",
  nge: "\u2271",
  ngeq: "\u2271",
  ngeqq: "\u2267\u0338",
  ngeqslant: "\u2A7E\u0338",
  nges: "\u2A7E\u0338",
  ngsim: "\u2275",
  ngt: "\u226F",
  ngtr: "\u226F",
  nhArr: "\u21CE",
  nharr: "\u21AE",
  nhpar: "\u2AF2",
  ni: "\u220B",
  nis: "\u22FC",
  nisd: "\u22FA",
  niv: "\u220B",
  njcy: "\u045A",
  nlArr: "\u21CD",
  nlE: "\u2266\u0338",
  nlarr: "\u219A",
  nldr: "\u2025",
  nle: "\u2270",
  nleftarrow: "\u219A",
  nleftrightarrow: "\u21AE",
  nleq: "\u2270",
  nleqq: "\u2266\u0338",
  nleqslant: "\u2A7D\u0338",
  nles: "\u2A7D\u0338",
  nless: "\u226E",
  nlsim: "\u2274",
  nlt: "\u226E",
  nltri: "\u22EA",
  nltrie: "\u22EC",
  nmid: "\u2224",
  nopf: "\u{1D55F}",
  not: "\xAC",
  notin: "\u2209",
  notinE: "\u22F9\u0338",
  notindot: "\u22F5\u0338",
  notinva: "\u2209",
  notinvb: "\u22F7",
  notinvc: "\u22F6",
  notni: "\u220C",
  notniva: "\u220C",
  notnivb: "\u22FE",
  notnivc: "\u22FD",
  npar: "\u2226",
  nparallel: "\u2226",
  nparsl: "\u2AFD\u20E5",
  npart: "\u2202\u0338",
  npolint: "\u2A14",
  npr: "\u2280",
  nprcue: "\u22E0",
  npre: "\u2AAF\u0338",
  nprec: "\u2280",
  npreceq: "\u2AAF\u0338",
  nrArr: "\u21CF",
  nrarr: "\u219B",
  nrarrc: "\u2933\u0338",
  nrarrw: "\u219D\u0338",
  nrightarrow: "\u219B",
  nrtri: "\u22EB",
  nrtrie: "\u22ED",
  nsc: "\u2281",
  nsccue: "\u22E1",
  nsce: "\u2AB0\u0338",
  nscr: "\u{1D4C3}",
  nshortmid: "\u2224",
  nshortparallel: "\u2226",
  nsim: "\u2241",
  nsime: "\u2244",
  nsimeq: "\u2244",
  nsmid: "\u2224",
  nspar: "\u2226",
  nsqsube: "\u22E2",
  nsqsupe: "\u22E3",
  nsub: "\u2284",
  nsubE: "\u2AC5\u0338",
  nsube: "\u2288",
  nsubset: "\u2282\u20D2",
  nsubseteq: "\u2288",
  nsubseteqq: "\u2AC5\u0338",
  nsucc: "\u2281",
  nsucceq: "\u2AB0\u0338",
  nsup: "\u2285",
  nsupE: "\u2AC6\u0338",
  nsupe: "\u2289",
  nsupset: "\u2283\u20D2",
  nsupseteq: "\u2289",
  nsupseteqq: "\u2AC6\u0338",
  ntgl: "\u2279",
  ntilde: "\xF1",
  ntlg: "\u2278",
  ntriangleleft: "\u22EA",
  ntrianglelefteq: "\u22EC",
  ntriangleright: "\u22EB",
  ntrianglerighteq: "\u22ED",
  nu: "\u03BD",
  num: "#",
  numero: "\u2116",
  numsp: "\u2007",
  nvDash: "\u22AD",
  nvHarr: "\u2904",
  nvap: "\u224D\u20D2",
  nvdash: "\u22AC",
  nvge: "\u2265\u20D2",
  nvgt: ">\u20D2",
  nvinfin: "\u29DE",
  nvlArr: "\u2902",
  nvle: "\u2264\u20D2",
  nvlt: "<\u20D2",
  nvltrie: "\u22B4\u20D2",
  nvrArr: "\u2903",
  nvrtrie: "\u22B5\u20D2",
  nvsim: "\u223C\u20D2",
  nwArr: "\u21D6",
  nwarhk: "\u2923",
  nwarr: "\u2196",
  nwarrow: "\u2196",
  nwnear: "\u2927",
  oS: "\u24C8",
  oacute: "\xF3",
  oast: "\u229B",
  ocir: "\u229A",
  ocirc: "\xF4",
  ocy: "\u043E",
  odash: "\u229D",
  odblac: "\u0151",
  odiv: "\u2A38",
  odot: "\u2299",
  odsold: "\u29BC",
  oelig: "\u0153",
  ofcir: "\u29BF",
  ofr: "\u{1D52C}",
  ogon: "\u02DB",
  ograve: "\xF2",
  ogt: "\u29C1",
  ohbar: "\u29B5",
  ohm: "\u03A9",
  oint: "\u222E",
  olarr: "\u21BA",
  olcir: "\u29BE",
  olcross: "\u29BB",
  oline: "\u203E",
  olt: "\u29C0",
  omacr: "\u014D",
  omega: "\u03C9",
  omicron: "\u03BF",
  omid: "\u29B6",
  ominus: "\u2296",
  oopf: "\u{1D560}",
  opar: "\u29B7",
  operp: "\u29B9",
  oplus: "\u2295",
  or: "\u2228",
  orarr: "\u21BB",
  ord: "\u2A5D",
  order: "\u2134",
  orderof: "\u2134",
  ordf: "\xAA",
  ordm: "\xBA",
  origof: "\u22B6",
  oror: "\u2A56",
  orslope: "\u2A57",
  orv: "\u2A5B",
  oscr: "\u2134",
  oslash: "\xF8",
  osol: "\u2298",
  otilde: "\xF5",
  otimes: "\u2297",
  otimesas: "\u2A36",
  ouml: "\xF6",
  ovbar: "\u233D",
  par: "\u2225",
  para: "\xB6",
  parallel: "\u2225",
  parsim: "\u2AF3",
  parsl: "\u2AFD",
  part: "\u2202",
  pcy: "\u043F",
  percnt: "%",
  period: ".",
  permil: "\u2030",
  perp: "\u22A5",
  pertenk: "\u2031",
  pfr: "\u{1D52D}",
  phi: "\u03C6",
  phiv: "\u03D5",
  phmmat: "\u2133",
  phone: "\u260E",
  pi: "\u03C0",
  pitchfork: "\u22D4",
  piv: "\u03D6",
  planck: "\u210F",
  planckh: "\u210E",
  plankv: "\u210F",
  plus: "+",
  plusacir: "\u2A23",
  plusb: "\u229E",
  pluscir: "\u2A22",
  plusdo: "\u2214",
  plusdu: "\u2A25",
  pluse: "\u2A72",
  plusmn: "\xB1",
  plussim: "\u2A26",
  plustwo: "\u2A27",
  pm: "\xB1",
  pointint: "\u2A15",
  popf: "\u{1D561}",
  pound: "\xA3",
  pr: "\u227A",
  prE: "\u2AB3",
  prap: "\u2AB7",
  prcue: "\u227C",
  pre: "\u2AAF",
  prec: "\u227A",
  precapprox: "\u2AB7",
  preccurlyeq: "\u227C",
  preceq: "\u2AAF",
  precnapprox: "\u2AB9",
  precneqq: "\u2AB5",
  precnsim: "\u22E8",
  precsim: "\u227E",
  prime: "\u2032",
  primes: "\u2119",
  prnE: "\u2AB5",
  prnap: "\u2AB9",
  prnsim: "\u22E8",
  prod: "\u220F",
  profalar: "\u232E",
  profline: "\u2312",
  profsurf: "\u2313",
  prop: "\u221D",
  propto: "\u221D",
  prsim: "\u227E",
  prurel: "\u22B0",
  pscr: "\u{1D4C5}",
  psi: "\u03C8",
  puncsp: "\u2008",
  qfr: "\u{1D52E}",
  qint: "\u2A0C",
  qopf: "\u{1D562}",
  qprime: "\u2057",
  qscr: "\u{1D4C6}",
  quaternions: "\u210D",
  quatint: "\u2A16",
  quest: "?",
  questeq: "\u225F",
  quot: '"',
  rAarr: "\u21DB",
  rArr: "\u21D2",
  rAtail: "\u291C",
  rBarr: "\u290F",
  rHar: "\u2964",
  race: "\u223D\u0331",
  racute: "\u0155",
  radic: "\u221A",
  raemptyv: "\u29B3",
  rang: "\u27E9",
  rangd: "\u2992",
  range: "\u29A5",
  rangle: "\u27E9",
  raquo: "\xBB",
  rarr: "\u2192",
  rarrap: "\u2975",
  rarrb: "\u21E5",
  rarrbfs: "\u2920",
  rarrc: "\u2933",
  rarrfs: "\u291E",
  rarrhk: "\u21AA",
  rarrlp: "\u21AC",
  rarrpl: "\u2945",
  rarrsim: "\u2974",
  rarrtl: "\u21A3",
  rarrw: "\u219D",
  ratail: "\u291A",
  ratio: "\u2236",
  rationals: "\u211A",
  rbarr: "\u290D",
  rbbrk: "\u2773",
  rbrace: "}",
  rbrack: "]",
  rbrke: "\u298C",
  rbrksld: "\u298E",
  rbrkslu: "\u2990",
  rcaron: "\u0159",
  rcedil: "\u0157",
  rceil: "\u2309",
  rcub: "}",
  rcy: "\u0440",
  rdca: "\u2937",
  rdldhar: "\u2969",
  rdquo: "\u201D",
  rdquor: "\u201D",
  rdsh: "\u21B3",
  real: "\u211C",
  realine: "\u211B",
  realpart: "\u211C",
  reals: "\u211D",
  rect: "\u25AD",
  reg: "\xAE",
  rfisht: "\u297D",
  rfloor: "\u230B",
  rfr: "\u{1D52F}",
  rhard: "\u21C1",
  rharu: "\u21C0",
  rharul: "\u296C",
  rho: "\u03C1",
  rhov: "\u03F1",
  rightarrow: "\u2192",
  rightarrowtail: "\u21A3",
  rightharpoondown: "\u21C1",
  rightharpoonup: "\u21C0",
  rightleftarrows: "\u21C4",
  rightleftharpoons: "\u21CC",
  rightrightarrows: "\u21C9",
  rightsquigarrow: "\u219D",
  rightthreetimes: "\u22CC",
  ring: "\u02DA",
  risingdotseq: "\u2253",
  rlarr: "\u21C4",
  rlhar: "\u21CC",
  rlm: "\u200F",
  rmoust: "\u23B1",
  rmoustache: "\u23B1",
  rnmid: "\u2AEE",
  roang: "\u27ED",
  roarr: "\u21FE",
  robrk: "\u27E7",
  ropar: "\u2986",
  ropf: "\u{1D563}",
  roplus: "\u2A2E",
  rotimes: "\u2A35",
  rpar: ")",
  rpargt: "\u2994",
  rppolint: "\u2A12",
  rrarr: "\u21C9",
  rsaquo: "\u203A",
  rscr: "\u{1D4C7}",
  rsh: "\u21B1",
  rsqb: "]",
  rsquo: "\u2019",
  rsquor: "\u2019",
  rthree: "\u22CC",
  rtimes: "\u22CA",
  rtri: "\u25B9",
  rtrie: "\u22B5",
  rtrif: "\u25B8",
  rtriltri: "\u29CE",
  ruluhar: "\u2968",
  rx: "\u211E",
  sacute: "\u015B",
  sbquo: "\u201A",
  sc: "\u227B",
  scE: "\u2AB4",
  scap: "\u2AB8",
  scaron: "\u0161",
  sccue: "\u227D",
  sce: "\u2AB0",
  scedil: "\u015F",
  scirc: "\u015D",
  scnE: "\u2AB6",
  scnap: "\u2ABA",
  scnsim: "\u22E9",
  scpolint: "\u2A13",
  scsim: "\u227F",
  scy: "\u0441",
  sdot: "\u22C5",
  sdotb: "\u22A1",
  sdote: "\u2A66",
  seArr: "\u21D8",
  searhk: "\u2925",
  searr: "\u2198",
  searrow: "\u2198",
  sect: "\xA7",
  semi: ";",
  seswar: "\u2929",
  setminus: "\u2216",
  setmn: "\u2216",
  sext: "\u2736",
  sfr: "\u{1D530}",
  sfrown: "\u2322",
  sharp: "\u266F",
  shchcy: "\u0449",
  shcy: "\u0448",
  shortmid: "\u2223",
  shortparallel: "\u2225",
  shy: "\xAD",
  sigma: "\u03C3",
  sigmaf: "\u03C2",
  sigmav: "\u03C2",
  sim: "\u223C",
  simdot: "\u2A6A",
  sime: "\u2243",
  simeq: "\u2243",
  simg: "\u2A9E",
  simgE: "\u2AA0",
  siml: "\u2A9D",
  simlE: "\u2A9F",
  simne: "\u2246",
  simplus: "\u2A24",
  simrarr: "\u2972",
  slarr: "\u2190",
  smallsetminus: "\u2216",
  smashp: "\u2A33",
  smeparsl: "\u29E4",
  smid: "\u2223",
  smile: "\u2323",
  smt: "\u2AAA",
  smte: "\u2AAC",
  smtes: "\u2AAC\uFE00",
  softcy: "\u044C",
  sol: "/",
  solb: "\u29C4",
  solbar: "\u233F",
  sopf: "\u{1D564}",
  spades: "\u2660",
  spadesuit: "\u2660",
  spar: "\u2225",
  sqcap: "\u2293",
  sqcaps: "\u2293\uFE00",
  sqcup: "\u2294",
  sqcups: "\u2294\uFE00",
  sqsub: "\u228F",
  sqsube: "\u2291",
  sqsubset: "\u228F",
  sqsubseteq: "\u2291",
  sqsup: "\u2290",
  sqsupe: "\u2292",
  sqsupset: "\u2290",
  sqsupseteq: "\u2292",
  squ: "\u25A1",
  square: "\u25A1",
  squarf: "\u25AA",
  squf: "\u25AA",
  srarr: "\u2192",
  sscr: "\u{1D4C8}",
  ssetmn: "\u2216",
  ssmile: "\u2323",
  sstarf: "\u22C6",
  star: "\u2606",
  starf: "\u2605",
  straightepsilon: "\u03F5",
  straightphi: "\u03D5",
  strns: "\xAF",
  sub: "\u2282",
  subE: "\u2AC5",
  subdot: "\u2ABD",
  sube: "\u2286",
  subedot: "\u2AC3",
  submult: "\u2AC1",
  subnE: "\u2ACB",
  subne: "\u228A",
  subplus: "\u2ABF",
  subrarr: "\u2979",
  subset: "\u2282",
  subseteq: "\u2286",
  subseteqq: "\u2AC5",
  subsetneq: "\u228A",
  subsetneqq: "\u2ACB",
  subsim: "\u2AC7",
  subsub: "\u2AD5",
  subsup: "\u2AD3",
  succ: "\u227B",
  succapprox: "\u2AB8",
  succcurlyeq: "\u227D",
  succeq: "\u2AB0",
  succnapprox: "\u2ABA",
  succneqq: "\u2AB6",
  succnsim: "\u22E9",
  succsim: "\u227F",
  sum: "\u2211",
  sung: "\u266A",
  sup1: "\xB9",
  sup2: "\xB2",
  sup3: "\xB3",
  sup: "\u2283",
  supE: "\u2AC6",
  supdot: "\u2ABE",
  supdsub: "\u2AD8",
  supe: "\u2287",
  supedot: "\u2AC4",
  suphsol: "\u27C9",
  suphsub: "\u2AD7",
  suplarr: "\u297B",
  supmult: "\u2AC2",
  supnE: "\u2ACC",
  supne: "\u228B",
  supplus: "\u2AC0",
  supset: "\u2283",
  supseteq: "\u2287",
  supseteqq: "\u2AC6",
  supsetneq: "\u228B",
  supsetneqq: "\u2ACC",
  supsim: "\u2AC8",
  supsub: "\u2AD4",
  supsup: "\u2AD6",
  swArr: "\u21D9",
  swarhk: "\u2926",
  swarr: "\u2199",
  swarrow: "\u2199",
  swnwar: "\u292A",
  szlig: "\xDF",
  target: "\u2316",
  tau: "\u03C4",
  tbrk: "\u23B4",
  tcaron: "\u0165",
  tcedil: "\u0163",
  tcy: "\u0442",
  tdot: "\u20DB",
  telrec: "\u2315",
  tfr: "\u{1D531}",
  there4: "\u2234",
  therefore: "\u2234",
  theta: "\u03B8",
  thetasym: "\u03D1",
  thetav: "\u03D1",
  thickapprox: "\u2248",
  thicksim: "\u223C",
  thinsp: "\u2009",
  thkap: "\u2248",
  thksim: "\u223C",
  thorn: "\xFE",
  tilde: "\u02DC",
  times: "\xD7",
  timesb: "\u22A0",
  timesbar: "\u2A31",
  timesd: "\u2A30",
  tint: "\u222D",
  toea: "\u2928",
  top: "\u22A4",
  topbot: "\u2336",
  topcir: "\u2AF1",
  topf: "\u{1D565}",
  topfork: "\u2ADA",
  tosa: "\u2929",
  tprime: "\u2034",
  trade: "\u2122",
  triangle: "\u25B5",
  triangledown: "\u25BF",
  triangleleft: "\u25C3",
  trianglelefteq: "\u22B4",
  triangleq: "\u225C",
  triangleright: "\u25B9",
  trianglerighteq: "\u22B5",
  tridot: "\u25EC",
  trie: "\u225C",
  triminus: "\u2A3A",
  triplus: "\u2A39",
  trisb: "\u29CD",
  tritime: "\u2A3B",
  trpezium: "\u23E2",
  tscr: "\u{1D4C9}",
  tscy: "\u0446",
  tshcy: "\u045B",
  tstrok: "\u0167",
  twixt: "\u226C",
  twoheadleftarrow: "\u219E",
  twoheadrightarrow: "\u21A0",
  uArr: "\u21D1",
  uHar: "\u2963",
  uacute: "\xFA",
  uarr: "\u2191",
  ubrcy: "\u045E",
  ubreve: "\u016D",
  ucirc: "\xFB",
  ucy: "\u0443",
  udarr: "\u21C5",
  udblac: "\u0171",
  udhar: "\u296E",
  ufisht: "\u297E",
  ufr: "\u{1D532}",
  ugrave: "\xF9",
  uharl: "\u21BF",
  uharr: "\u21BE",
  uhblk: "\u2580",
  ulcorn: "\u231C",
  ulcorner: "\u231C",
  ulcrop: "\u230F",
  ultri: "\u25F8",
  umacr: "\u016B",
  uml: "\xA8",
  uogon: "\u0173",
  uopf: "\u{1D566}",
  uparrow: "\u2191",
  updownarrow: "\u2195",
  upharpoonleft: "\u21BF",
  upharpoonright: "\u21BE",
  uplus: "\u228E",
  upsi: "\u03C5",
  upsih: "\u03D2",
  upsilon: "\u03C5",
  upuparrows: "\u21C8",
  urcorn: "\u231D",
  urcorner: "\u231D",
  urcrop: "\u230E",
  uring: "\u016F",
  urtri: "\u25F9",
  uscr: "\u{1D4CA}",
  utdot: "\u22F0",
  utilde: "\u0169",
  utri: "\u25B5",
  utrif: "\u25B4",
  uuarr: "\u21C8",
  uuml: "\xFC",
  uwangle: "\u29A7",
  vArr: "\u21D5",
  vBar: "\u2AE8",
  vBarv: "\u2AE9",
  vDash: "\u22A8",
  vangrt: "\u299C",
  varepsilon: "\u03F5",
  varkappa: "\u03F0",
  varnothing: "\u2205",
  varphi: "\u03D5",
  varpi: "\u03D6",
  varpropto: "\u221D",
  varr: "\u2195",
  varrho: "\u03F1",
  varsigma: "\u03C2",
  varsubsetneq: "\u228A\uFE00",
  varsubsetneqq: "\u2ACB\uFE00",
  varsupsetneq: "\u228B\uFE00",
  varsupsetneqq: "\u2ACC\uFE00",
  vartheta: "\u03D1",
  vartriangleleft: "\u22B2",
  vartriangleright: "\u22B3",
  vcy: "\u0432",
  vdash: "\u22A2",
  vee: "\u2228",
  veebar: "\u22BB",
  veeeq: "\u225A",
  vellip: "\u22EE",
  verbar: "|",
  vert: "|",
  vfr: "\u{1D533}",
  vltri: "\u22B2",
  vnsub: "\u2282\u20D2",
  vnsup: "\u2283\u20D2",
  vopf: "\u{1D567}",
  vprop: "\u221D",
  vrtri: "\u22B3",
  vscr: "\u{1D4CB}",
  vsubnE: "\u2ACB\uFE00",
  vsubne: "\u228A\uFE00",
  vsupnE: "\u2ACC\uFE00",
  vsupne: "\u228B\uFE00",
  vzigzag: "\u299A",
  wcirc: "\u0175",
  wedbar: "\u2A5F",
  wedge: "\u2227",
  wedgeq: "\u2259",
  weierp: "\u2118",
  wfr: "\u{1D534}",
  wopf: "\u{1D568}",
  wp: "\u2118",
  wr: "\u2240",
  wreath: "\u2240",
  wscr: "\u{1D4CC}",
  xcap: "\u22C2",
  xcirc: "\u25EF",
  xcup: "\u22C3",
  xdtri: "\u25BD",
  xfr: "\u{1D535}",
  xhArr: "\u27FA",
  xharr: "\u27F7",
  xi: "\u03BE",
  xlArr: "\u27F8",
  xlarr: "\u27F5",
  xmap: "\u27FC",
  xnis: "\u22FB",
  xodot: "\u2A00",
  xopf: "\u{1D569}",
  xoplus: "\u2A01",
  xotime: "\u2A02",
  xrArr: "\u27F9",
  xrarr: "\u27F6",
  xscr: "\u{1D4CD}",
  xsqcup: "\u2A06",
  xuplus: "\u2A04",
  xutri: "\u25B3",
  xvee: "\u22C1",
  xwedge: "\u22C0",
  yacute: "\xFD",
  yacy: "\u044F",
  ycirc: "\u0177",
  ycy: "\u044B",
  yen: "\xA5",
  yfr: "\u{1D536}",
  yicy: "\u0457",
  yopf: "\u{1D56A}",
  yscr: "\u{1D4CE}",
  yucy: "\u044E",
  yuml: "\xFF",
  zacute: "\u017A",
  zcaron: "\u017E",
  zcy: "\u0437",
  zdot: "\u017C",
  zeetrf: "\u2128",
  zeta: "\u03B6",
  zfr: "\u{1D537}",
  zhcy: "\u0436",
  zigrarr: "\u21DD",
  zopf: "\u{1D56B}",
  zscr: "\u{1D4CF}",
  zwj: "\u200D",
  zwnj: "\u200C"
};

// node_modules/decode-named-character-reference/index.js
var own = {}.hasOwnProperty;
function decodeNamedCharacterReference(value) {
  return own.call(characterEntities, value) ? characterEntities[value] : false;
}

// node_modules/micromark-util-chunked/index.js
function splice(list2, start, remove, items) {
  const end = list2.length;
  let chunkStart = 0;
  let parameters;
  if (start < 0) {
    start = -start > end ? 0 : end + start;
  } else {
    start = start > end ? end : start;
  }
  remove = remove > 0 ? remove : 0;
  if (items.length < 1e4) {
    parameters = Array.from(items);
    parameters.unshift(start, remove);
    list2.splice(...parameters);
  } else {
    if (remove) list2.splice(start, remove);
    while (chunkStart < items.length) {
      parameters = items.slice(chunkStart, chunkStart + 1e4);
      parameters.unshift(start, 0);
      list2.splice(...parameters);
      chunkStart += 1e4;
      start += 1e4;
    }
  }
}
function push(list2, items) {
  if (list2.length > 0) {
    splice(list2, list2.length, 0, items);
    return list2;
  }
  return items;
}

// node_modules/micromark-util-combine-extensions/index.js
var hasOwnProperty = {}.hasOwnProperty;
function combineExtensions(extensions) {
  const all2 = {};
  let index2 = -1;
  while (++index2 < extensions.length) {
    syntaxExtension(all2, extensions[index2]);
  }
  return all2;
}
function syntaxExtension(all2, extension2) {
  let hook;
  for (hook in extension2) {
    const maybe = hasOwnProperty.call(all2, hook) ? all2[hook] : void 0;
    const left = maybe || (all2[hook] = {});
    const right = extension2[hook];
    let code;
    if (right) {
      for (code in right) {
        if (!hasOwnProperty.call(left, code)) left[code] = [];
        const value = right[code];
        constructs(
          // @ts-expect-error Looks like a list.
          left[code],
          Array.isArray(value) ? value : value ? [value] : []
        );
      }
    }
  }
}
function constructs(existing, list2) {
  let index2 = -1;
  const before = [];
  while (++index2 < list2.length) {
    ;
    (list2[index2].add === "after" ? existing : before).push(list2[index2]);
  }
  splice(existing, 0, 0, before);
}

// node_modules/micromark-util-decode-numeric-character-reference/index.js
function decodeNumericCharacterReference(value, base) {
  const code = Number.parseInt(value, base);
  if (
    // C0 except for HT, LF, FF, CR, space.
    code < 9 || code === 11 || code > 13 && code < 32 || // Control character (DEL) of C0, and C1 controls.
    code > 126 && code < 160 || // Lone high surrogates and low surrogates.
    code > 55295 && code < 57344 || // Noncharacters.
    code > 64975 && code < 65008 || /* eslint-disable no-bitwise */
    (code & 65535) === 65535 || (code & 65535) === 65534 || /* eslint-enable no-bitwise */
    // Out of range
    code > 1114111
  ) {
    return "\uFFFD";
  }
  return String.fromCodePoint(code);
}

// node_modules/micromark-util-normalize-identifier/index.js
function normalizeIdentifier(value) {
  return value.replace(/[\t\n\r ]+/g, " ").replace(/^ | $/g, "").toLowerCase().toUpperCase();
}

// node_modules/micromark-util-character/index.js
var asciiAlpha = regexCheck(/[A-Za-z]/);
var asciiAlphanumeric = regexCheck(/[\dA-Za-z]/);
var asciiAtext = regexCheck(/[#-'*+\--9=?A-Z^-~]/);
function asciiControl(code) {
  return (
    // Special whitespace codes (which have negative values), C0 and Control
    // character DEL
    code !== null && (code < 32 || code === 127)
  );
}
var asciiDigit = regexCheck(/\d/);
var asciiHexDigit = regexCheck(/[\dA-Fa-f]/);
var asciiPunctuation = regexCheck(/[!-/:-@[-`{-~]/);
function markdownLineEnding(code) {
  return code !== null && code < -2;
}
function markdownLineEndingOrSpace(code) {
  return code !== null && (code < 0 || code === 32);
}
function markdownSpace(code) {
  return code === -2 || code === -1 || code === 32;
}
var unicodePunctuation = regexCheck(/\p{P}|\p{S}/u);
var unicodeWhitespace = regexCheck(/\s/);
function regexCheck(regex) {
  return check;
  function check(code) {
    return code !== null && code > -1 && regex.test(String.fromCharCode(code));
  }
}

// node_modules/micromark-factory-space/index.js
function factorySpace(effects, ok, type, max) {
  const limit = max ? max - 1 : Infinity;
  let size = 0;
  return start;
  function start(code) {
    if (markdownSpace(code)) {
      effects.enter(type);
      return prefix(code);
    }
    return ok(code);
  }
  function prefix(code) {
    if (markdownSpace(code) && size++ < limit) {
      effects.consume(code);
      return prefix;
    }
    effects.exit(type);
    return ok(code);
  }
}
function factorySpaceMinMax(effects, ok, nok, type, min, max) {
  let size = 0;
  return start;
  function start(code) {
    if (max > 0 && markdownSpace(code)) {
      effects.enter(type);
      return prefix(code);
    }
    return after(code);
  }
  function prefix(code) {
    if (markdownSpace(code) && size < max) {
      effects.consume(code);
      size++;
      return prefix;
    }
    effects.exit(type);
    return after(code);
  }
  function after(code) {
    return size >= min ? ok(code) : nok(code);
  }
}

// node_modules/micromark/lib/initialize/content.js
var content = {
  tokenize: initializeContent
};
function initializeContent(effects) {
  const contentStart = effects.attempt(this.parser.constructs.contentInitial, afterContentStartConstruct, paragraphInitial);
  let previous3;
  return contentStart;
  function afterContentStartConstruct(code) {
    if (code === null) {
      effects.consume(code);
      return;
    }
    effects.enter("lineEnding");
    effects.consume(code);
    effects.exit("lineEnding");
    return factorySpace(effects, contentStart, "linePrefix");
  }
  function paragraphInitial(code) {
    effects.enter("paragraph");
    return lineStart(code);
  }
  function lineStart(code) {
    const token = effects.enter("chunkText", {
      contentType: "text",
      previous: previous3
    });
    if (previous3) {
      previous3.next = token;
    }
    previous3 = token;
    return data(code);
  }
  function data(code) {
    if (code === null) {
      effects.exit("chunkText");
      effects.exit("paragraph");
      effects.consume(code);
      return;
    }
    if (markdownLineEnding(code)) {
      effects.consume(code);
      effects.exit("chunkText");
      return lineStart;
    }
    effects.consume(code);
    return data;
  }
}

// node_modules/micromark-util-edit-map/index.js
var EditMap = class {
  /**
   * Create a new edit map.
   *
   * @returns
   *   New instance.
   */
  constructor() {
    this.index = /* @__PURE__ */ new Map();
    this.map = [];
  }
  /**
   * Create an edit: a remove and/or add at a certain place.
   *
   * @param {number} index
   *   Index at which to apply the edit.
   * @param {number} remove
   *   Count of items to remove at the index.
   * @param {Array<Event>} add
   *   Items to add at the index.
   * @returns {undefined}
   *   Nothing.
   */
  add(index2, remove, add) {
    addImplementation(this, index2, remove, add, false);
  }
  /**
   * Create an edit: but insert `add` before existing additions, instead of
   * after them.
   *
   * @param {number} index
   *   Index at which to apply the edit.
   * @param {number} remove
   *   Count of items to remove at the index.
   * @param {Array<Event>} add
   *   Items to add at the index.
   * @returns {undefined}
   *   Nothing.
   */
  addBefore(index2, remove, add) {
    addImplementation(this, index2, remove, add, true);
  }
  /**
   * Done, change the events.
   *
   * @param {Array<Event>} events
   *   List of events to apply the edits to.
   * @returns {undefined}
   *   Nothing.
   */
  consume(events) {
    this.map.sort(function(a, b) {
      return a[0] - b[0];
    });
    if (this.map.length === 0) {
      return;
    }
    let index2 = this.map.length;
    const vecs = [];
    while (index2 > 0) {
      index2 -= 1;
      vecs.push(events.slice(this.map[index2][0] + this.map[index2][1]), this.map[index2][2]);
      events.length = this.map[index2][0];
    }
    vecs.push(events.slice());
    events.length = 0;
    let slice = vecs.pop();
    while (slice) {
      for (const element of slice) {
        events.push(element);
      }
      slice = vecs.pop();
    }
    this.map.length = 0;
    this.index.clear();
  }
};
function addImplementation(editMap, at, remove, add, before) {
  if (remove === 0 && add.length === 0) {
    return;
  }
  const existing = editMap.index.get(at);
  if (existing) {
    existing[1] += remove;
    if (before) {
      add.push(...existing[2]);
      existing[2] = add;
    } else {
      existing[2].push(...add);
    }
    return;
  }
  const change = [at, remove, add];
  editMap.map.push(change);
  editMap.index.set(at, change);
}

// node_modules/micromark/lib/initialize/document.js
var document = {
  tokenize: initializeDocument
};
var containerConstruct = {
  tokenize: tokenizeContainer
};
function initializeDocument(effects) {
  const self = this;
  const stack = [];
  let continued = 0;
  let childFlow;
  let childToken;
  let lineStartOffset;
  return start;
  function start(code) {
    if (continued < stack.length) {
      const item = stack[continued];
      self.containerState = item[1];
      return effects.attempt(item[0].continuation, documentContinue, checkNewContainers)(code);
    }
    return checkNewContainers(code);
  }
  function documentContinue(code) {
    continued++;
    if (self.containerState._closeFlow) {
      self.containerState._closeFlow = void 0;
      if (childFlow) {
        closeFlow();
      }
      const indexBeforeExits = self.events.length;
      let indexBeforeFlow = indexBeforeExits;
      let point3;
      while (indexBeforeFlow--) {
        if (self.events[indexBeforeFlow][0] === "exit" && self.events[indexBeforeFlow][1].type === "chunkFlow") {
          point3 = self.events[indexBeforeFlow][1].end;
          break;
        }
      }
      exitContainers(continued);
      let index2 = indexBeforeExits;
      while (index2 < self.events.length) {
        self.events[index2][1].end = {
          ...point3
        };
        index2++;
      }
      const editMap = new EditMap();
      editMap.add(indexBeforeFlow + 1, 0, self.events.slice(indexBeforeExits));
      editMap.add(indexBeforeExits, index2 - indexBeforeExits, []);
      editMap.consume(self.events);
      return checkNewContainers(code);
    }
    return start(code);
  }
  function checkNewContainers(code) {
    if (continued === stack.length) {
      if (!childFlow) {
        return documentContinued(code);
      }
      if (childFlow.currentConstruct && childFlow.currentConstruct.concrete) {
        return flowStart(code);
      }
      self.interrupt = Boolean(childFlow.currentConstruct && !childFlow._gfmTableDynamicInterruptHack);
    }
    self.containerState = {};
    return effects.check(containerConstruct, thereIsANewContainer, thereIsNoNewContainer)(code);
  }
  function thereIsANewContainer(code) {
    if (childFlow) {
      closeFlow();
    }
    exitContainers(continued);
    return documentContinued(code);
  }
  function thereIsNoNewContainer(code) {
    self.parser.lazy[self.now().line] = continued !== stack.length;
    lineStartOffset = self.now().offset;
    return flowStart(code);
  }
  function documentContinued(code) {
    self.containerState = {};
    return effects.attempt(containerConstruct, containerContinue, flowStart)(code);
  }
  function containerContinue(code) {
    continued++;
    stack.push([self.currentConstruct, self.containerState]);
    return documentContinued(code);
  }
  function flowStart(code) {
    if (code === null) {
      if (childFlow) {
        closeFlow();
      }
      exitContainers(0);
      effects.consume(code);
      return;
    }
    childFlow = childFlow || self.parser.flow(self.now());
    effects.enter("chunkFlow", {
      _tokenizer: childFlow,
      contentType: "flow",
      previous: childToken
    });
    return flowContinue(code);
  }
  function flowContinue(code) {
    if (code === null) {
      writeToChild(effects.exit("chunkFlow"), true);
      exitContainers(0);
      effects.consume(code);
      return;
    }
    if (markdownLineEnding(code)) {
      effects.consume(code);
      writeToChild(effects.exit("chunkFlow"));
      continued = 0;
      self.interrupt = void 0;
      return start;
    }
    effects.consume(code);
    return flowContinue;
  }
  function writeToChild(token, endOfFile) {
    const stream = self.sliceStream(token);
    if (endOfFile) {
      stream.push(null);
    }
    token.previous = childToken;
    if (childToken) {
      childToken.next = token;
    }
    childToken = token;
    childFlow.defineSkip(token.start);
    childFlow.write(stream);
    if (self.parser.lazy[token.start.line]) {
      let index2 = childFlow.events.length;
      while (index2--) {
        if (
          // The token starts before the line ending…
          childFlow.events[index2][1].start.offset < lineStartOffset && // …and either is not ended yet…
          (!childFlow.events[index2][1].end || // …or ends after it.
          childFlow.events[index2][1].end.offset > lineStartOffset)
        ) {
          return;
        }
      }
      const indexBeforeExits = self.events.length;
      let indexBeforeFlow = indexBeforeExits;
      let seen;
      let point3;
      while (indexBeforeFlow--) {
        if (self.events[indexBeforeFlow][0] === "exit" && self.events[indexBeforeFlow][1].type === "chunkFlow") {
          if (seen) {
            point3 = self.events[indexBeforeFlow][1].end;
            break;
          }
          seen = true;
        }
      }
      exitContainers(continued);
      index2 = indexBeforeExits;
      while (index2 < self.events.length) {
        self.events[index2][1].end = {
          ...point3
        };
        index2++;
      }
      const editMap = new EditMap();
      editMap.add(indexBeforeFlow + 1, 0, self.events.slice(indexBeforeExits));
      editMap.add(indexBeforeExits, index2 - indexBeforeExits, []);
      editMap.consume(self.events);
    }
  }
  function exitContainers(size) {
    let index2 = stack.length;
    while (index2-- > size) {
      const entry = stack[index2];
      self.containerState = entry[1];
      entry[0].exit.call(self, effects);
    }
    stack.length = size;
  }
  function closeFlow() {
    childFlow.write([null]);
    childToken = void 0;
    childFlow = void 0;
    self.containerState._closeFlow = void 0;
  }
}
function tokenizeContainer(effects, ok, nok) {
  return factorySpace(effects, effects.attempt(this.parser.constructs.document, ok, nok), "linePrefix", this.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4);
}

// node_modules/micromark-util-classify-character/index.js
function classifyCharacter(code) {
  if (code === null || markdownLineEndingOrSpace(code) || unicodeWhitespace(code)) {
    return 1;
  }
  if (unicodePunctuation(code)) {
    return 2;
  }
}

// node_modules/micromark-util-resolve-all/index.js
function resolveAll(constructs2, events, context) {
  const called = [];
  let index2 = -1;
  while (++index2 < constructs2.length) {
    const resolve = constructs2[index2].resolveAll;
    if (resolve && !called.includes(resolve)) {
      events = resolve(events, context);
      called.push(resolve);
    }
  }
  return events;
}

// node_modules/micromark-core-commonmark/lib/attention.js
var attention = {
  name: "attention",
  resolveAll: resolveAllAttention,
  tokenize: tokenizeAttention
};
function resolveAllAttention(events, context) {
  let index2 = -1;
  let nextEvents;
  while (++index2 < events.length) {
    if (events[index2][0] === "enter" && events[index2][1].type === "attentionSequence" && events[index2][1]._close) {
      let open = index2;
      while (open--) {
        if (events[open][0] === "exit" && events[open][1].type === "attentionSequence" && events[open][1]._open && // If the markers are the same:
        context.sliceSerialize(events[open][1]).charCodeAt(0) === context.sliceSerialize(events[index2][1]).charCodeAt(0)) {
          if ((events[open][1]._close || events[index2][1]._open) && (events[index2][1].end.offset - events[index2][1].start.offset) % 3 && !((events[open][1].end.offset - events[open][1].start.offset + events[index2][1].end.offset - events[index2][1].start.offset) % 3)) {
            continue;
          }
          const use = events[open][1].end.offset - events[open][1].start.offset > 1 && events[index2][1].end.offset - events[index2][1].start.offset > 1 ? 2 : 1;
          const start = {
            ...events[open][1].end
          };
          const end = {
            ...events[index2][1].start
          };
          movePoint(start, -use);
          movePoint(end, use);
          const openingSequence = {
            type: use > 1 ? "strongSequence" : "emphasisSequence",
            start,
            end: {
              ...events[open][1].end
            }
          };
          const closingSequence = {
            type: use > 1 ? "strongSequence" : "emphasisSequence",
            start: {
              ...events[index2][1].start
            },
            end
          };
          const text3 = {
            type: use > 1 ? "strongText" : "emphasisText",
            start: {
              ...events[open][1].end
            },
            end: {
              ...events[index2][1].start
            }
          };
          const group = {
            type: use > 1 ? "strong" : "emphasis",
            start: {
              ...openingSequence.start
            },
            end: {
              ...closingSequence.end
            }
          };
          events[open][1].end = {
            ...openingSequence.start
          };
          events[index2][1].start = {
            ...closingSequence.end
          };
          nextEvents = [];
          if (events[open][1].end.offset - events[open][1].start.offset) {
            nextEvents = push(nextEvents, [["enter", events[open][1], context], ["exit", events[open][1], context]]);
          }
          nextEvents = push(nextEvents, [["enter", group, context], ["enter", openingSequence, context], ["exit", openingSequence, context], ["enter", text3, context]]);
          nextEvents = push(nextEvents, resolveAll(context.parser.constructs.insideSpan.null, events.slice(open + 1, index2), context));
          nextEvents = push(nextEvents, [["exit", text3, context], ["enter", closingSequence, context], ["exit", closingSequence, context], ["exit", group, context]]);
          let offset = 0;
          if (events[index2][1].end.offset - events[index2][1].start.offset) {
            offset = 2;
            nextEvents = push(nextEvents, [["enter", events[index2][1], context], ["exit", events[index2][1], context]]);
          }
          splice(events, open - 1, index2 - open + 3, nextEvents);
          index2 = open + nextEvents.length - offset - 2;
          break;
        }
      }
    }
  }
  index2 = -1;
  while (++index2 < events.length) {
    if (events[index2][1].type === "attentionSequence") {
      events[index2][1].type = "data";
    }
  }
  return events;
}
function tokenizeAttention(effects, ok) {
  const attentionMarkers2 = this.parser.constructs.attentionMarkers.null;
  const previous3 = this.previous;
  const before = classifyCharacter(previous3);
  let marker;
  return start;
  function start(code) {
    marker = code;
    effects.enter("attentionSequence");
    return inside(code);
  }
  function inside(code) {
    if (code === marker) {
      effects.consume(code);
      return inside;
    }
    const token = effects.exit("attentionSequence");
    const after = classifyCharacter(code);
    const open = !after || after === 2 && before || attentionMarkers2.includes(code) && code !== 42 && code !== 95;
    const close = !before || before === 2 && after || attentionMarkers2.includes(previous3) && previous3 !== 42 && previous3 !== 95;
    token._open = Boolean(marker === 42 ? open : open && (before || !close));
    token._close = Boolean(marker === 42 ? close : close && (after || !open));
    return ok(code);
  }
}
function movePoint(point3, offset) {
  point3.column += offset;
  point3.offset += offset;
  point3._bufferIndex += offset;
}

// node_modules/micromark-core-commonmark/lib/autolink.js
var autolink = {
  name: "autolink",
  tokenize: tokenizeAutolink
};
function tokenizeAutolink(effects, ok, nok) {
  let size = 0;
  return start;
  function start(code) {
    effects.enter("autolink");
    effects.enter("autolinkMarker");
    effects.consume(code);
    effects.exit("autolinkMarker");
    effects.enter("autolinkProtocol");
    return open;
  }
  function open(code) {
    if (asciiAlpha(code)) {
      effects.consume(code);
      return schemeOrEmailAtext;
    }
    if (code === 64) {
      return nok(code);
    }
    return emailAtext(code);
  }
  function schemeOrEmailAtext(code) {
    if (code === 43 || code === 45 || code === 46 || asciiAlphanumeric(code)) {
      size = 1;
      return schemeInsideOrEmailAtext(code);
    }
    return emailAtext(code);
  }
  function schemeInsideOrEmailAtext(code) {
    if (code === 58) {
      effects.consume(code);
      size = 0;
      return urlInside;
    }
    if ((code === 43 || code === 45 || code === 46 || asciiAlphanumeric(code)) && size++ < 32) {
      effects.consume(code);
      return schemeInsideOrEmailAtext;
    }
    size = 0;
    return emailAtext(code);
  }
  function urlInside(code) {
    if (code === 62) {
      effects.exit("autolinkProtocol");
      effects.enter("autolinkMarker");
      effects.consume(code);
      effects.exit("autolinkMarker");
      effects.exit("autolink");
      return ok;
    }
    if (code === null || code === 32 || code === 60 || asciiControl(code)) {
      return nok(code);
    }
    effects.consume(code);
    return urlInside;
  }
  function emailAtext(code) {
    if (code === 64) {
      effects.consume(code);
      return emailAtSignOrDot;
    }
    if (asciiAtext(code)) {
      effects.consume(code);
      return emailAtext;
    }
    return nok(code);
  }
  function emailAtSignOrDot(code) {
    return asciiAlphanumeric(code) ? emailLabel(code) : nok(code);
  }
  function emailLabel(code) {
    if (code === 46) {
      effects.consume(code);
      size = 0;
      return emailAtSignOrDot;
    }
    if (code === 62) {
      effects.exit("autolinkProtocol").type = "autolinkEmail";
      effects.enter("autolinkMarker");
      effects.consume(code);
      effects.exit("autolinkMarker");
      effects.exit("autolink");
      return ok;
    }
    return emailValue(code);
  }
  function emailValue(code) {
    if ((code === 45 || asciiAlphanumeric(code)) && size++ < 63) {
      const next = code === 45 ? emailValue : emailLabel;
      effects.consume(code);
      return next;
    }
    return nok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/blank-line.js
var blankLine = {
  partial: true,
  tokenize: tokenizeBlankLine
};
function tokenizeBlankLine(effects, ok, nok) {
  return start;
  function start(code) {
    return markdownSpace(code) ? factorySpace(effects, after, "linePrefix")(code) : after(code);
  }
  function after(code) {
    return code === null || markdownLineEnding(code) ? ok(code) : nok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/block-quote.js
var blockQuote = {
  continuation: {
    tokenize: tokenizeBlockQuoteContinuation
  },
  exit,
  name: "blockQuote",
  tokenize: tokenizeBlockQuoteStart
};
function tokenizeBlockQuoteStart(effects, ok, nok) {
  const self = this;
  return start;
  function start(code) {
    if (code === 62) {
      const state = self.containerState;
      if (!state.open) {
        effects.enter("blockQuote", {
          _container: true
        });
        state.open = true;
      }
      effects.enter("blockQuotePrefix");
      effects.enter("blockQuoteMarker");
      effects.consume(code);
      effects.exit("blockQuoteMarker");
      return after;
    }
    return nok(code);
  }
  function after(code) {
    if (markdownSpace(code)) {
      effects.enter("blockQuotePrefixWhitespace");
      effects.consume(code);
      effects.exit("blockQuotePrefixWhitespace");
      effects.exit("blockQuotePrefix");
      return ok;
    }
    effects.exit("blockQuotePrefix");
    return ok(code);
  }
}
function tokenizeBlockQuoteContinuation(effects, ok, nok) {
  const self = this;
  return contStart;
  function contStart(code) {
    if (markdownSpace(code)) {
      return factorySpace(effects, contBefore, "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code);
    }
    return contBefore(code);
  }
  function contBefore(code) {
    return effects.attempt(blockQuote, ok, nok)(code);
  }
}
function exit(effects) {
  effects.exit("blockQuote");
}

// node_modules/micromark-core-commonmark/lib/character-escape.js
var characterEscape = {
  name: "characterEscape",
  tokenize: tokenizeCharacterEscape
};
function tokenizeCharacterEscape(effects, ok, nok) {
  return start;
  function start(code) {
    effects.enter("characterEscape");
    effects.enter("escapeMarker");
    effects.consume(code);
    effects.exit("escapeMarker");
    return inside;
  }
  function inside(code) {
    if (asciiPunctuation(code)) {
      effects.enter("characterEscapeValue");
      effects.consume(code);
      effects.exit("characterEscapeValue");
      effects.exit("characterEscape");
      return ok;
    }
    return nok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/character-reference.js
var characterReference = {
  name: "characterReference",
  tokenize: tokenizeCharacterReference
};
function tokenizeCharacterReference(effects, ok, nok) {
  const self = this;
  let size = 0;
  let max;
  let test;
  return start;
  function start(code) {
    effects.enter("characterReference");
    effects.enter("characterReferenceMarker");
    effects.consume(code);
    effects.exit("characterReferenceMarker");
    return open;
  }
  function open(code) {
    if (code === 35) {
      effects.enter("characterReferenceMarkerNumeric");
      effects.consume(code);
      effects.exit("characterReferenceMarkerNumeric");
      return numeric;
    }
    effects.enter("characterReferenceValue");
    max = 31;
    test = asciiAlphanumeric;
    return value(code);
  }
  function numeric(code) {
    if (code === 88 || code === 120) {
      effects.enter("characterReferenceMarkerHexadecimal");
      effects.consume(code);
      effects.exit("characterReferenceMarkerHexadecimal");
      effects.enter("characterReferenceValue");
      max = 6;
      test = asciiHexDigit;
      return value;
    }
    effects.enter("characterReferenceValue");
    max = 7;
    test = asciiDigit;
    return value(code);
  }
  function value(code) {
    if (code === 59 && size) {
      const token = effects.exit("characterReferenceValue");
      if (test === asciiAlphanumeric && !decodeNamedCharacterReference(self.sliceSerialize(token))) {
        return nok(code);
      }
      effects.enter("characterReferenceMarker");
      effects.consume(code);
      effects.exit("characterReferenceMarker");
      effects.exit("characterReference");
      return ok;
    }
    if (test(code) && size++ < max) {
      effects.consume(code);
      return value;
    }
    return nok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/partial-non-lazy-continuation.js
var nonLazyContinuation = {
  partial: true,
  tokenize: tokenizeNonLazyContinuation
};
function tokenizeNonLazyContinuation(effects, ok, nok) {
  const self = this;
  return start;
  function start(code) {
    if (code === null) {
      return nok(code);
    }
    effects.enter("lineEnding");
    effects.consume(code);
    effects.exit("lineEnding");
    return after;
  }
  function after(code) {
    return self.parser.lazy[self.now().line] ? nok(code) : ok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/code-fenced.js
var codeFenced = {
  concrete: true,
  name: "codeFenced",
  tokenize: tokenizeCodeFenced
};
function tokenizeCodeFenced(effects, ok, nok) {
  const self = this;
  const closeStart = {
    partial: true,
    tokenize: tokenizeCloseStart
  };
  let initialPrefix = 0;
  let sizeOpen = 0;
  let marker;
  return start;
  function start(code) {
    return beforeSequenceOpen(code);
  }
  function beforeSequenceOpen(code) {
    const tail = self.events[self.events.length - 1];
    initialPrefix = tail && tail[1].type === "linePrefix" ? tail[2].sliceSerialize(tail[1], true).length : 0;
    marker = code;
    effects.enter("codeFenced");
    effects.enter("codeFencedFence");
    effects.enter("codeFencedFenceSequence");
    return sequenceOpen(code);
  }
  function sequenceOpen(code) {
    if (code === marker) {
      sizeOpen++;
      effects.consume(code);
      return sequenceOpen;
    }
    if (sizeOpen < 3) {
      return nok(code);
    }
    effects.exit("codeFencedFenceSequence");
    return markdownSpace(code) ? factorySpace(effects, infoBefore, "whitespace")(code) : infoBefore(code);
  }
  function infoBefore(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit("codeFencedFence");
      return self.interrupt ? ok(code) : effects.check(nonLazyContinuation, atNonLazyBreak, after)(code);
    }
    effects.enter("codeFencedFenceInfo");
    effects.enter("chunkString", {
      contentType: "string"
    });
    return info(code);
  }
  function info(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit("chunkString");
      effects.exit("codeFencedFenceInfo");
      return infoBefore(code);
    }
    if (markdownSpace(code)) {
      effects.exit("chunkString");
      effects.exit("codeFencedFenceInfo");
      return factorySpace(effects, metaBefore, "whitespace")(code);
    }
    if (code === 96 && code === marker) {
      return nok(code);
    }
    effects.consume(code);
    return info;
  }
  function metaBefore(code) {
    if (code === null || markdownLineEnding(code)) {
      return infoBefore(code);
    }
    effects.enter("codeFencedFenceMeta");
    effects.enter("chunkString", {
      contentType: "string"
    });
    return meta(code);
  }
  function meta(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit("chunkString");
      effects.exit("codeFencedFenceMeta");
      return infoBefore(code);
    }
    if (code === 96 && code === marker) {
      return nok(code);
    }
    effects.consume(code);
    return meta;
  }
  function atNonLazyBreak(code) {
    return effects.attempt(closeStart, after, contentBefore)(code);
  }
  function contentBefore(code) {
    effects.enter("lineEnding");
    effects.consume(code);
    effects.exit("lineEnding");
    return contentStart;
  }
  function contentStart(code) {
    return initialPrefix > 0 && markdownSpace(code) ? factorySpace(effects, beforeContentChunk, "linePrefix", initialPrefix + 1)(code) : beforeContentChunk(code);
  }
  function beforeContentChunk(code) {
    if (code === null || markdownLineEnding(code)) {
      return effects.check(nonLazyContinuation, atNonLazyBreak, after)(code);
    }
    effects.enter("codeFlowValue");
    return contentChunk(code);
  }
  function contentChunk(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit("codeFlowValue");
      return beforeContentChunk(code);
    }
    effects.consume(code);
    return contentChunk;
  }
  function after(code) {
    effects.exit("codeFenced");
    return ok(code);
  }
  function tokenizeCloseStart(effects2, ok2, nok2) {
    let size = 0;
    return startBefore;
    function startBefore(code) {
      effects2.enter("lineEnding");
      effects2.consume(code);
      effects2.exit("lineEnding");
      return start2;
    }
    function start2(code) {
      effects2.enter("codeFencedFence");
      return markdownSpace(code) ? factorySpace(effects2, beforeSequenceClose, "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code) : beforeSequenceClose(code);
    }
    function beforeSequenceClose(code) {
      if (code === marker) {
        effects2.enter("codeFencedFenceSequence");
        return sequenceClose(code);
      }
      return nok2(code);
    }
    function sequenceClose(code) {
      if (code === marker) {
        size++;
        effects2.consume(code);
        return sequenceClose;
      }
      if (size >= sizeOpen) {
        effects2.exit("codeFencedFenceSequence");
        return markdownSpace(code) ? factorySpace(effects2, sequenceCloseAfter, "whitespace")(code) : sequenceCloseAfter(code);
      }
      return nok2(code);
    }
    function sequenceCloseAfter(code) {
      if (code === null || markdownLineEnding(code)) {
        effects2.exit("codeFencedFence");
        return ok2(code);
      }
      return nok2(code);
    }
  }
}

// node_modules/micromark-core-commonmark/lib/code-indented.js
var codeIndented = {
  name: "codeIndented",
  tokenize: tokenizeCodeIndented
};
var furtherStart = {
  partial: true,
  tokenize: tokenizeFurtherStart
};
function tokenizeCodeIndented(effects, ok, nok) {
  return start;
  function start(code) {
    effects.enter("codeIndented");
    return factorySpaceMinMax(effects, atBreak, nok, "linePrefix", 4, 4)(code);
  }
  function atBreak(code) {
    if (code === null) {
      return after(code);
    }
    if (markdownLineEnding(code)) {
      return effects.attempt(furtherStart, atBreak, after)(code);
    }
    effects.enter("codeFlowValue");
    return inside(code);
  }
  function inside(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit("codeFlowValue");
      return atBreak(code);
    }
    effects.consume(code);
    return inside;
  }
  function after(code) {
    effects.exit("codeIndented");
    return ok(code);
  }
}
function tokenizeFurtherStart(effects, ok, nok) {
  const self = this;
  return furtherStart2;
  function furtherStart2(code) {
    if (self.parser.lazy[self.now().line]) {
      return nok(code);
    }
    if (markdownLineEnding(code)) {
      effects.enter("lineEnding");
      effects.consume(code);
      effects.exit("lineEnding");
      return furtherStart2;
    }
    return factorySpaceMinMax(effects, ok, onNotEnoughPrefix, "linePrefix", 4, 4)(code);
  }
  function onNotEnoughPrefix(code) {
    return markdownLineEnding(code) ? furtherStart2(code) : nok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/code-text.js
var codeText = {
  name: "codeText",
  previous: previous2,
  resolve: resolveCodeText,
  tokenize: tokenizeCodeText
};
function resolveCodeText(events) {
  let tailExitIndex = events.length - 4;
  let headEnterIndex = 3;
  let index2;
  let enter;
  if ((events[headEnterIndex][1].type === "lineEnding" || events[headEnterIndex][1].type === "space") && (events[tailExitIndex][1].type === "lineEnding" || events[tailExitIndex][1].type === "space")) {
    index2 = headEnterIndex;
    while (++index2 < tailExitIndex) {
      if (events[index2][1].type === "codeTextData") {
        events[headEnterIndex][1].type = "codeTextPadding";
        events[tailExitIndex][1].type = "codeTextPadding";
        headEnterIndex += 2;
        tailExitIndex -= 2;
        break;
      }
    }
  }
  index2 = headEnterIndex - 1;
  tailExitIndex++;
  while (++index2 <= tailExitIndex) {
    if (enter === void 0) {
      if (index2 !== tailExitIndex && events[index2][1].type !== "lineEnding") {
        enter = index2;
      }
    } else if (index2 === tailExitIndex || events[index2][1].type === "lineEnding") {
      events[enter][1].type = "codeTextData";
      if (index2 !== enter + 2) {
        events[enter][1].end = events[index2 - 1][1].end;
        events.splice(enter + 2, index2 - enter - 2);
        tailExitIndex -= index2 - enter - 2;
        index2 = enter + 2;
      }
      enter = void 0;
    }
  }
  return events;
}
function previous2(code) {
  return code !== 96 || this.events[this.events.length - 1][1].type === "characterEscape";
}
function tokenizeCodeText(effects, ok, nok) {
  const self = this;
  let sizeOpen = 0;
  let size;
  let token;
  return start;
  function start(code) {
    effects.enter("codeText");
    effects.enter("codeTextSequence");
    return sequenceOpen(code);
  }
  function sequenceOpen(code) {
    if (code === 96) {
      effects.consume(code);
      sizeOpen++;
      return sequenceOpen;
    }
    effects.exit("codeTextSequence");
    return between(code);
  }
  function between(code) {
    if (code === null) {
      return nok(code);
    }
    if (code === 32) {
      effects.enter("space");
      effects.consume(code);
      effects.exit("space");
      return between;
    }
    if (code === 96) {
      token = effects.enter("codeTextSequence");
      size = 0;
      return sequenceClose(code);
    }
    if (markdownLineEnding(code)) {
      effects.enter("lineEnding");
      effects.consume(code);
      effects.exit("lineEnding");
      return between;
    }
    effects.enter("codeTextData");
    return data(code);
  }
  function data(code) {
    if (code === null || code === 32 || code === 96 || markdownLineEnding(code)) {
      effects.exit("codeTextData");
      return between(code);
    }
    effects.consume(code);
    return data;
  }
  function sequenceClose(code) {
    if (code === 96) {
      effects.consume(code);
      size++;
      return sequenceClose;
    }
    if (size === sizeOpen) {
      effects.exit("codeTextSequence");
      effects.exit("codeText");
      return ok(code);
    }
    token.type = "codeTextData";
    return data(code);
  }
}

// node_modules/micromark-util-subtokenize/lib/splice-buffer.js
var SpliceBuffer = class {
  /**
   * @param {ReadonlyArray<T> | null | undefined} [initial]
   *   Initial items (optional).
   * @returns
   *   Splice buffer.
   */
  constructor(initial) {
    this.left = initial ? [...initial] : [];
    this.right = [];
  }
  /**
   * Array access;
   * does not move the cursor.
   *
   * @param {number} index
   *   Index.
   * @return {T}
   *   Item.
   */
  get(index2) {
    if (index2 < 0 || index2 >= this.left.length + this.right.length) {
      throw new RangeError("Cannot access index `" + index2 + "` in a splice buffer of size `" + (this.left.length + this.right.length) + "`");
    }
    if (index2 < this.left.length) return this.left[index2];
    return this.right[this.right.length - index2 + this.left.length - 1];
  }
  /**
   * The length of the splice buffer, one greater than the largest index in the
   * array.
   */
  get length() {
    return this.left.length + this.right.length;
  }
  /**
   * Remove and return `list[0]`;
   * moves the cursor to `0`.
   *
   * @returns {T | undefined}
   *   Item, optional.
   */
  shift() {
    this.setCursor(0);
    return this.right.pop();
  }
  /**
   * Slice the buffer to get an array;
   * does not move the cursor.
   *
   * @param {number} start
   *   Start.
   * @param {number | null | undefined} [end]
   *   End (optional).
   * @returns {Array<T>}
   *   Array of items.
   */
  slice(start, end) {
    const stop2 = end === null || end === void 0 ? Number.POSITIVE_INFINITY : end;
    if (stop2 < this.left.length) {
      return this.left.slice(start, stop2);
    }
    if (start > this.left.length) {
      return this.right.slice(this.right.length - stop2 + this.left.length, this.right.length - start + this.left.length).reverse();
    }
    return this.left.slice(start).concat(this.right.slice(this.right.length - stop2 + this.left.length).reverse());
  }
  /**
   * Mimics the behavior of Array.prototype.splice() except for the change of
   * interface necessary to avoid segfaults when patching in very large arrays.
   *
   * This operation moves cursor is moved to `start` and results in the cursor
   * placed after any inserted items.
   *
   * @param {number} start
   *   Start;
   *   zero-based index at which to start changing the array;
   *   negative numbers count backwards from the end of the array and values
   *   that are out-of bounds are clamped to the appropriate end of the array.
   * @param {number | null | undefined} [deleteCount=0]
   *   Delete count (default: `0`);
   *   maximum number of elements to delete, starting from start.
   * @param {Array<T> | null | undefined} [items=[]]
   *   Items to include in place of the deleted items (default: `[]`).
   * @return {Array<T>}
   *   Any removed items.
   */
  splice(start, deleteCount, items) {
    const count = deleteCount || 0;
    this.setCursor(Math.trunc(start));
    const removed = this.right.splice(this.right.length - count, Number.POSITIVE_INFINITY);
    if (items) chunkedPush(this.left, items);
    return removed.reverse();
  }
  /**
   * Remove and return the highest-numbered item in the array, so
   * `list[list.length - 1]`;
   * Moves the cursor to `length`.
   *
   * @returns {T | undefined}
   *   Item, optional.
   */
  pop() {
    this.setCursor(Number.POSITIVE_INFINITY);
    return this.left.pop();
  }
  /**
   * Inserts a single item to the high-numbered side of the array;
   * moves the cursor to `length`.
   *
   * @param {T} item
   *   Item.
   * @returns {undefined}
   *   Nothing.
   */
  push(item) {
    this.setCursor(Number.POSITIVE_INFINITY);
    this.left.push(item);
  }
  /**
   * Inserts many items to the high-numbered side of the array.
   * Moves the cursor to `length`.
   *
   * @param {Array<T>} items
   *   Items.
   * @returns {undefined}
   *   Nothing.
   */
  pushMany(items) {
    this.setCursor(Number.POSITIVE_INFINITY);
    chunkedPush(this.left, items);
  }
  /**
   * Inserts a single item to the low-numbered side of the array;
   * Moves the cursor to `0`.
   *
   * @param {T} item
   *   Item.
   * @returns {undefined}
   *   Nothing.
   */
  unshift(item) {
    this.setCursor(0);
    this.right.push(item);
  }
  /**
   * Inserts many items to the low-numbered side of the array;
   * moves the cursor to `0`.
   *
   * @param {Array<T>} items
   *   Items.
   * @returns {undefined}
   *   Nothing.
   */
  unshiftMany(items) {
    this.setCursor(0);
    chunkedPush(this.right, items.reverse());
  }
  /**
   * Move the cursor to a specific position in the array. Requires
   * time proportional to the distance moved.
   *
   * If `n < 0`, the cursor will end up at the beginning.
   * If `n > length`, the cursor will end up at the end.
   *
   * @param {number} n
   *   Position.
   * @return {undefined}
   *   Nothing.
   */
  setCursor(n) {
    if (n === this.left.length || n > this.left.length && this.right.length === 0 || n < 0 && this.left.length === 0) return;
    if (n < this.left.length) {
      const removed = this.left.splice(n, Number.POSITIVE_INFINITY);
      chunkedPush(this.right, removed.reverse());
    } else {
      const removed = this.right.splice(this.left.length + this.right.length - n, Number.POSITIVE_INFINITY);
      chunkedPush(this.left, removed.reverse());
    }
  }
};
function chunkedPush(list2, right) {
  let chunkStart = 0;
  if (right.length < 1e4) {
    list2.push(...right);
  } else {
    while (chunkStart < right.length) {
      list2.push(...right.slice(chunkStart, chunkStart + 1e4));
      chunkStart += 1e4;
    }
  }
}

// node_modules/micromark-util-subtokenize/index.js
function subtokenize(eventsArray) {
  const jumps = {};
  let index2 = -1;
  let event;
  let lineIndex;
  let otherIndex;
  let otherEvent;
  let parameters;
  let subevents;
  let more;
  const events = new SpliceBuffer(eventsArray);
  while (++index2 < events.length) {
    while (index2 in jumps) {
      index2 = jumps[index2];
    }
    event = events.get(index2);
    if (index2 && event[1].type === "chunkFlow" && events.get(index2 - 1)[1].type === "listItemPrefix") {
      subevents = event[1]._tokenizer.events;
      otherIndex = 0;
      if (otherIndex < subevents.length && subevents[otherIndex][1].type === "lineEndingBlank") {
        otherIndex += 2;
      }
      if (otherIndex < subevents.length && subevents[otherIndex][1].type === "content") {
        while (++otherIndex < subevents.length) {
          if (subevents[otherIndex][1].type === "content") {
            break;
          }
          if (subevents[otherIndex][1].type === "chunkText") {
            subevents[otherIndex][1]._isInFirstContentOfListItem = true;
            otherIndex++;
          }
        }
      }
    }
    if (event[0] === "enter") {
      if (event[1].contentType) {
        Object.assign(jumps, subcontent(events, index2));
        index2 = jumps[index2];
        more = true;
      }
    } else if (event[1]._container) {
      otherIndex = index2;
      lineIndex = void 0;
      while (otherIndex--) {
        otherEvent = events.get(otherIndex);
        if (otherEvent[1].type === "lineEnding" || otherEvent[1].type === "lineEndingBlank") {
          if (otherEvent[0] === "enter") {
            if (lineIndex) {
              events.get(lineIndex)[1].type = "lineEndingBlank";
            }
            otherEvent[1].type = "lineEnding";
            lineIndex = otherIndex;
          }
        } else if (otherEvent[1].type === "linePrefix" || otherEvent[1].type === "listItemIndent") {
        } else {
          break;
        }
      }
      if (lineIndex) {
        event[1].end = {
          ...events.get(lineIndex)[1].start
        };
        parameters = events.slice(lineIndex, index2);
        parameters.unshift(event);
        events.splice(lineIndex, index2 - lineIndex + 1, parameters);
      }
    }
  }
  splice(eventsArray, 0, Number.POSITIVE_INFINITY, events.slice(0));
  return !more;
}
function subcontent(events, eventIndex) {
  const token = events.get(eventIndex)[1];
  const context = events.get(eventIndex)[2];
  let startPosition = eventIndex - 1;
  const startPositions = [];
  let tokenizer = token._tokenizer;
  if (!tokenizer) {
    tokenizer = context.parser[token.contentType](token.start);
    if (token._contentTypeTextTrailing) {
      tokenizer._contentTypeTextTrailing = true;
    }
  }
  const childEvents = tokenizer.events;
  const jumps = [];
  const gaps = {};
  let stream;
  let previous3;
  let index2 = -1;
  let current = token;
  let adjust = 0;
  let start = 0;
  const breaks = [start];
  while (current) {
    while (events.get(++startPosition)[1] !== current) {
    }
    startPositions.push(startPosition);
    if (!current._tokenizer) {
      stream = context.sliceStream(current);
      if (!current.next) {
        stream.push(null);
      }
      if (previous3) {
        tokenizer.defineSkip(current.start);
      }
      if (current._isInFirstContentOfListItem) {
        tokenizer._gfmTasklistFirstContentOfListItem = true;
      }
      tokenizer.write(stream);
      if (current._isInFirstContentOfListItem) {
        tokenizer._gfmTasklistFirstContentOfListItem = void 0;
      }
    }
    previous3 = current;
    current = current.next;
  }
  current = token;
  while (++index2 < childEvents.length) {
    if (
      // Find a void token that includes a break.
      childEvents[index2][0] === "exit" && childEvents[index2 - 1][0] === "enter" && childEvents[index2][1].type === childEvents[index2 - 1][1].type && childEvents[index2][1].start.line !== childEvents[index2][1].end.line
    ) {
      start = index2 + 1;
      breaks.push(start);
      current._tokenizer = void 0;
      current.previous = void 0;
      current = current.next;
    }
  }
  tokenizer.events = [];
  if (current) {
    current._tokenizer = void 0;
    current.previous = void 0;
  } else {
    breaks.pop();
  }
  index2 = breaks.length;
  while (index2--) {
    const slice = childEvents.slice(breaks[index2], breaks[index2 + 1]);
    const start2 = startPositions.pop();
    jumps.push([start2, start2 + slice.length - 1]);
    events.splice(start2, 2, slice);
  }
  jumps.reverse();
  index2 = -1;
  while (++index2 < jumps.length) {
    gaps[adjust + jumps[index2][0]] = adjust + jumps[index2][1];
    adjust += jumps[index2][1] - jumps[index2][0] - 1;
  }
  return gaps;
}

// node_modules/micromark-core-commonmark/lib/content.js
var content2 = {
  resolve: resolveContent,
  tokenize: tokenizeContent
};
var continuationConstruct = {
  partial: true,
  tokenize: tokenizeContinuation
};
function resolveContent(events) {
  subtokenize(events);
  return events;
}
function tokenizeContent(effects, ok) {
  let previous3;
  return chunkStart;
  function chunkStart(code) {
    effects.enter("content");
    previous3 = effects.enter("chunkContent", {
      contentType: "content"
    });
    return chunkInside(code);
  }
  function chunkInside(code) {
    if (code === null) {
      return contentEnd(code);
    }
    if (markdownLineEnding(code)) {
      return effects.check(continuationConstruct, contentContinue, contentEnd)(code);
    }
    effects.consume(code);
    return chunkInside;
  }
  function contentEnd(code) {
    effects.exit("chunkContent");
    effects.exit("content");
    return ok(code);
  }
  function contentContinue(code) {
    effects.consume(code);
    effects.exit("chunkContent");
    previous3.next = effects.enter("chunkContent", {
      contentType: "content",
      previous: previous3
    });
    previous3 = previous3.next;
    return chunkInside;
  }
}
function tokenizeContinuation(effects, ok, nok) {
  const self = this;
  return startLookahead;
  function startLookahead(code) {
    effects.exit("chunkContent");
    effects.enter("lineEnding");
    effects.consume(code);
    effects.exit("lineEnding");
    return factorySpace(effects, prefixed, "linePrefix");
  }
  function prefixed(code) {
    if (code === null || markdownLineEnding(code)) {
      return nok(code);
    }
    const tail = self.events[self.events.length - 1];
    if (!self.parser.constructs.disable.null.includes("codeIndented") && tail && tail[1].type === "linePrefix" && tail[2].sliceSerialize(tail[1], true).length >= 4) {
      return ok(code);
    }
    return effects.interrupt(self.parser.constructs.flow, nok, ok)(code);
  }
}

// node_modules/micromark-factory-destination/index.js
function factoryDestination(effects, ok, nok, type, literalType, literalMarkerType, rawType, stringType, max) {
  const limit = max || Number.POSITIVE_INFINITY;
  let balance = 0;
  return start;
  function start(code) {
    if (code === 60) {
      effects.enter(type);
      effects.enter(literalType);
      effects.enter(literalMarkerType);
      effects.consume(code);
      effects.exit(literalMarkerType);
      return enclosedBefore;
    }
    if (code === null || code === 32 || code === 41 || asciiControl(code)) {
      return nok(code);
    }
    effects.enter(type);
    effects.enter(rawType);
    effects.enter(stringType);
    effects.enter("chunkString", {
      contentType: "string"
    });
    return raw(code);
  }
  function enclosedBefore(code) {
    if (code === 62) {
      effects.enter(literalMarkerType);
      effects.consume(code);
      effects.exit(literalMarkerType);
      effects.exit(literalType);
      effects.exit(type);
      return ok;
    }
    effects.enter(stringType);
    effects.enter("chunkString", {
      contentType: "string"
    });
    return enclosed(code);
  }
  function enclosed(code) {
    if (code === 62) {
      effects.exit("chunkString");
      effects.exit(stringType);
      return enclosedBefore(code);
    }
    if (code === null || code === 60 || markdownLineEnding(code)) {
      return nok(code);
    }
    effects.consume(code);
    return code === 92 ? enclosedEscape : enclosed;
  }
  function enclosedEscape(code) {
    if (code === 60 || code === 62 || code === 92) {
      effects.consume(code);
      return enclosed;
    }
    return enclosed(code);
  }
  function raw(code) {
    if (!balance && (code === null || code === 41 || markdownLineEndingOrSpace(code))) {
      effects.exit("chunkString");
      effects.exit(stringType);
      effects.exit(rawType);
      effects.exit(type);
      return ok(code);
    }
    if (balance < limit && code === 40) {
      effects.consume(code);
      balance++;
      return raw;
    }
    if (code === 41) {
      effects.consume(code);
      balance--;
      return raw;
    }
    if (code === null || code === 32 || code === 40 || asciiControl(code)) {
      return nok(code);
    }
    effects.consume(code);
    return code === 92 ? rawEscape : raw;
  }
  function rawEscape(code) {
    if (code === 40 || code === 41 || code === 92) {
      effects.consume(code);
      return raw;
    }
    return raw(code);
  }
}

// node_modules/micromark-factory-label/index.js
function factoryLabel(effects, ok, nok, type, markerType, stringType) {
  const self = this;
  let size = 0;
  let seen;
  return start;
  function start(code) {
    effects.enter(type);
    effects.enter(markerType);
    effects.consume(code);
    effects.exit(markerType);
    effects.enter(stringType);
    return atBreak;
  }
  function atBreak(code) {
    if (size > 999 || code === null || code === 91 || code === 93 && !seen || // To do: remove in the future once we’ve switched from
    // `micromark-extension-footnote` to `micromark-extension-gfm-footnote`,
    // which doesn’t need this.
    // Hidden footnotes hook.
    /* c8 ignore next 3 */
    code === 94 && !size && "_hiddenFootnoteSupport" in self.parser.constructs) {
      return nok(code);
    }
    if (code === 93) {
      effects.exit(stringType);
      effects.enter(markerType);
      effects.consume(code);
      effects.exit(markerType);
      effects.exit(type);
      return ok;
    }
    if (markdownLineEnding(code)) {
      effects.enter("lineEnding");
      effects.consume(code);
      effects.exit("lineEnding");
      return atBreak;
    }
    effects.enter("chunkString", {
      contentType: "string"
    });
    return labelInside(code);
  }
  function labelInside(code) {
    if (code === null || code === 91 || code === 93 || markdownLineEnding(code) || size++ > 999) {
      effects.exit("chunkString");
      return atBreak(code);
    }
    effects.consume(code);
    if (!seen) seen = !markdownSpace(code);
    return code === 92 ? labelEscape : labelInside;
  }
  function labelEscape(code) {
    if (code === 91 || code === 92 || code === 93) {
      effects.consume(code);
      size++;
      return labelInside;
    }
    return labelInside(code);
  }
}

// node_modules/micromark-factory-title/index.js
function factoryTitle(effects, ok, nok, type, markerType, stringType) {
  let marker;
  return start;
  function start(code) {
    if (code === 34 || code === 39 || code === 40) {
      effects.enter(type);
      effects.enter(markerType);
      effects.consume(code);
      effects.exit(markerType);
      marker = code === 40 ? 41 : code;
      return begin;
    }
    return nok(code);
  }
  function begin(code) {
    if (code === marker) {
      effects.enter(markerType);
      effects.consume(code);
      effects.exit(markerType);
      effects.exit(type);
      return ok;
    }
    effects.enter(stringType);
    return atBreak(code);
  }
  function atBreak(code) {
    if (code === marker) {
      effects.exit(stringType);
      return begin(marker);
    }
    if (code === null) {
      return nok(code);
    }
    if (markdownLineEnding(code)) {
      effects.enter("lineEnding");
      effects.consume(code);
      effects.exit("lineEnding");
      return factorySpace(effects, atBreak, "linePrefix");
    }
    effects.enter("chunkString", {
      contentType: "string"
    });
    return inside(code);
  }
  function inside(code) {
    if (code === marker || code === null || markdownLineEnding(code)) {
      effects.exit("chunkString");
      return atBreak(code);
    }
    effects.consume(code);
    return code === 92 ? escape : inside;
  }
  function escape(code) {
    if (code === marker || code === 92) {
      effects.consume(code);
      return inside;
    }
    return inside(code);
  }
}

// node_modules/micromark-factory-whitespace/index.js
function factoryWhitespace(effects, ok) {
  let seen;
  return start;
  function start(code) {
    if (markdownLineEnding(code)) {
      effects.enter("lineEnding");
      effects.consume(code);
      effects.exit("lineEnding");
      seen = true;
      return start;
    }
    if (markdownSpace(code)) {
      return factorySpace(effects, start, seen ? "linePrefix" : "lineSuffix")(code);
    }
    return ok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/definition.js
var definition = {
  name: "definition",
  tokenize: tokenizeDefinition
};
var titleBefore = {
  partial: true,
  tokenize: tokenizeTitleBefore
};
function tokenizeDefinition(effects, ok, nok) {
  const self = this;
  let identifier;
  return start;
  function start(code) {
    effects.enter("definition");
    return before(code);
  }
  function before(code) {
    return factoryLabel.call(
      self,
      effects,
      labelAfter,
      // Note: we don’t need to reset the way `markdown-rs` does.
      nok,
      "definitionLabel",
      "definitionLabelMarker",
      "definitionLabelString"
    )(code);
  }
  function labelAfter(code) {
    identifier = normalizeIdentifier(self.sliceSerialize(self.events[self.events.length - 1][1]).slice(1, -1));
    if (code === 58) {
      effects.enter("definitionMarker");
      effects.consume(code);
      effects.exit("definitionMarker");
      return markerAfter;
    }
    return nok(code);
  }
  function markerAfter(code) {
    return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, destinationBefore)(code) : destinationBefore(code);
  }
  function destinationBefore(code) {
    return factoryDestination(
      effects,
      destinationAfter,
      // Note: we don’t need to reset the way `markdown-rs` does.
      nok,
      "definitionDestination",
      "definitionDestinationLiteral",
      "definitionDestinationLiteralMarker",
      "definitionDestinationRaw",
      "definitionDestinationString"
    )(code);
  }
  function destinationAfter(code) {
    return effects.attempt(titleBefore, after, after)(code);
  }
  function after(code) {
    return markdownSpace(code) ? factorySpace(effects, afterWhitespace, "whitespace")(code) : afterWhitespace(code);
  }
  function afterWhitespace(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit("definition");
      self.parser.defined.push(identifier);
      return ok(code);
    }
    return nok(code);
  }
}
function tokenizeTitleBefore(effects, ok, nok) {
  return titleBefore2;
  function titleBefore2(code) {
    return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, beforeMarker)(code) : nok(code);
  }
  function beforeMarker(code) {
    return factoryTitle(effects, titleAfter, nok, "definitionTitle", "definitionTitleMarker", "definitionTitleString")(code);
  }
  function titleAfter(code) {
    return markdownSpace(code) ? factorySpace(effects, titleAfterOptionalWhitespace, "whitespace")(code) : titleAfterOptionalWhitespace(code);
  }
  function titleAfterOptionalWhitespace(code) {
    return code === null || markdownLineEnding(code) ? ok(code) : nok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/hard-break-escape.js
var hardBreakEscape = {
  name: "hardBreakEscape",
  tokenize: tokenizeHardBreakEscape
};
function tokenizeHardBreakEscape(effects, ok, nok) {
  return start;
  function start(code) {
    effects.enter("hardBreakEscape");
    effects.consume(code);
    return after;
  }
  function after(code) {
    if (markdownLineEnding(code)) {
      effects.exit("hardBreakEscape");
      return ok(code);
    }
    return nok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/heading-atx.js
var headingAtx = {
  name: "headingAtx",
  resolve: resolveHeadingAtx,
  tokenize: tokenizeHeadingAtx
};
function resolveHeadingAtx(events, context) {
  let contentEnd = events.length - 2;
  let contentStart = 3;
  if (events[contentStart][1].type === "whitespace") {
    contentStart += 2;
  }
  if (contentEnd - 2 > contentStart && events[contentEnd][1].type === "whitespace") {
    contentEnd -= 2;
  }
  if (events[contentEnd][1].type === "atxHeadingSequence" && (contentStart === contentEnd - 1 || contentEnd - 4 > contentStart && events[contentEnd - 2][1].type === "whitespace")) {
    contentEnd -= contentStart + 1 === contentEnd ? 2 : 4;
  }
  if (contentEnd > contentStart) {
    const content3 = {
      type: "atxHeadingText",
      start: events[contentStart][1].start,
      end: events[contentEnd][1].end
    };
    const text3 = {
      type: "chunkText",
      start: events[contentStart][1].start,
      end: events[contentEnd][1].end,
      contentType: "text"
    };
    splice(events, contentStart, contentEnd - contentStart + 1, [["enter", content3, context], ["enter", text3, context], ["exit", text3, context], ["exit", content3, context]]);
  }
  return events;
}
function tokenizeHeadingAtx(effects, ok, nok) {
  let size = 0;
  return start;
  function start(code) {
    effects.enter("atxHeading");
    return before(code);
  }
  function before(code) {
    effects.enter("atxHeadingSequence");
    return sequenceOpen(code);
  }
  function sequenceOpen(code) {
    if (code === 35 && size++ < 6) {
      effects.consume(code);
      return sequenceOpen;
    }
    if (code === null || markdownLineEndingOrSpace(code)) {
      effects.exit("atxHeadingSequence");
      return atBreak(code);
    }
    return nok(code);
  }
  function atBreak(code) {
    if (code === 35) {
      effects.enter("atxHeadingSequence");
      return sequenceFurther(code);
    }
    if (code === null || markdownLineEnding(code)) {
      effects.exit("atxHeading");
      return ok(code);
    }
    if (markdownSpace(code)) {
      return factorySpace(effects, atBreak, "whitespace")(code);
    }
    effects.enter("atxHeadingText");
    return data(code);
  }
  function sequenceFurther(code) {
    if (code === 35) {
      effects.consume(code);
      return sequenceFurther;
    }
    effects.exit("atxHeadingSequence");
    return atBreak(code);
  }
  function data(code) {
    if (code === null || code === 35 || markdownLineEndingOrSpace(code)) {
      effects.exit("atxHeadingText");
      return atBreak(code);
    }
    effects.consume(code);
    return data;
  }
}

// node_modules/micromark-util-html-tag-name/index.js
var htmlBlockNames = [
  "address",
  "article",
  "aside",
  "base",
  "basefont",
  "blockquote",
  "body",
  "caption",
  "center",
  "col",
  "colgroup",
  "dd",
  "details",
  "dialog",
  "dir",
  "div",
  "dl",
  "dt",
  "fieldset",
  "figcaption",
  "figure",
  "footer",
  "form",
  "frame",
  "frameset",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "head",
  "header",
  "hr",
  "html",
  "iframe",
  "legend",
  "li",
  "link",
  "main",
  "menu",
  "menuitem",
  "nav",
  "noframes",
  "ol",
  "optgroup",
  "option",
  "p",
  "param",
  "search",
  "section",
  "summary",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "title",
  "tr",
  "track",
  "ul"
];
var htmlRawNames = ["pre", "script", "style", "textarea"];

// node_modules/micromark-core-commonmark/lib/html-flow.js
var htmlFlow = {
  concrete: true,
  name: "htmlFlow",
  resolveTo: resolveToHtmlFlow,
  tokenize: tokenizeHtmlFlow
};
var blankLineBefore = {
  partial: true,
  tokenize: tokenizeBlankLineBefore
};
function resolveToHtmlFlow(events) {
  let index2 = events.length;
  while (index2--) {
    if (events[index2][0] === "enter" && events[index2][1].type === "htmlFlow") {
      break;
    }
  }
  if (index2 > 1 && events[index2 - 2][1].type === "linePrefix") {
    events[index2][1].start = events[index2 - 2][1].start;
    events[index2 + 1][1].start = events[index2 - 2][1].start;
    events.splice(index2 - 2, 2);
  }
  return events;
}
function tokenizeHtmlFlow(effects, ok, nok) {
  const self = this;
  let marker;
  let closingTag;
  let buffer;
  let index2;
  let markerB;
  return start;
  function start(code) {
    return before(code);
  }
  function before(code) {
    effects.enter("htmlFlow");
    effects.enter("htmlFlowData");
    effects.consume(code);
    return open;
  }
  function open(code) {
    if (code === 33) {
      effects.consume(code);
      return declarationOpen;
    }
    if (code === 47) {
      effects.consume(code);
      closingTag = true;
      return tagCloseStart;
    }
    if (code === 63) {
      effects.consume(code);
      marker = 3;
      return self.interrupt ? ok : continuationDeclarationInside;
    }
    if (asciiAlpha(code)) {
      effects.consume(code);
      buffer = String.fromCharCode(code);
      return tagName;
    }
    return nok(code);
  }
  function declarationOpen(code) {
    if (code === 45) {
      effects.consume(code);
      marker = 2;
      return commentOpenInside;
    }
    if (code === 91) {
      effects.consume(code);
      marker = 5;
      index2 = 0;
      return cdataOpenInside;
    }
    if (asciiAlpha(code)) {
      effects.consume(code);
      marker = 4;
      return self.interrupt ? ok : continuationDeclarationInside;
    }
    return nok(code);
  }
  function commentOpenInside(code) {
    if (code === 45) {
      effects.consume(code);
      return self.interrupt ? ok : continuationDeclarationInside;
    }
    return nok(code);
  }
  function cdataOpenInside(code) {
    const value = "CDATA[";
    if (code === value.charCodeAt(index2++)) {
      effects.consume(code);
      if (index2 === value.length) {
        return self.interrupt ? ok : continuation;
      }
      return cdataOpenInside;
    }
    return nok(code);
  }
  function tagCloseStart(code) {
    if (asciiAlpha(code)) {
      effects.consume(code);
      buffer = String.fromCharCode(code);
      return tagName;
    }
    return nok(code);
  }
  function tagName(code) {
    if (code === null || code === 47 || code === 62 || markdownLineEndingOrSpace(code)) {
      const slash = code === 47;
      const name = buffer.toLowerCase();
      if (!slash && !closingTag && htmlRawNames.includes(name)) {
        marker = 1;
        return self.interrupt ? ok(code) : continuation(code);
      }
      if (htmlBlockNames.includes(buffer.toLowerCase())) {
        marker = 6;
        if (slash) {
          effects.consume(code);
          return basicSelfClosing;
        }
        return self.interrupt ? ok(code) : continuation(code);
      }
      marker = 7;
      return self.interrupt && !self.parser.lazy[self.now().line] ? nok(code) : closingTag ? completeClosingTagAfter(code) : completeAttributeNameBefore(code);
    }
    if (code === 45 || asciiAlphanumeric(code)) {
      effects.consume(code);
      buffer += String.fromCharCode(code);
      return tagName;
    }
    return nok(code);
  }
  function basicSelfClosing(code) {
    if (code === 62) {
      effects.consume(code);
      return self.interrupt ? ok : continuation;
    }
    return nok(code);
  }
  function completeClosingTagAfter(code) {
    if (markdownSpace(code)) {
      effects.consume(code);
      return completeClosingTagAfter;
    }
    return completeEnd(code);
  }
  function completeAttributeNameBefore(code) {
    if (code === 47) {
      effects.consume(code);
      return completeEnd;
    }
    if (code === 58 || code === 95 || asciiAlpha(code)) {
      effects.consume(code);
      return completeAttributeName;
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return completeAttributeNameBefore;
    }
    return completeEnd(code);
  }
  function completeAttributeName(code) {
    if (code === 45 || code === 46 || code === 58 || code === 95 || asciiAlphanumeric(code)) {
      effects.consume(code);
      return completeAttributeName;
    }
    return completeAttributeNameAfter(code);
  }
  function completeAttributeNameAfter(code) {
    if (code === 61) {
      effects.consume(code);
      return completeAttributeValueBefore;
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return completeAttributeNameAfter;
    }
    return completeAttributeNameBefore(code);
  }
  function completeAttributeValueBefore(code) {
    if (code === null || code === 60 || code === 61 || code === 62 || code === 96) {
      return nok(code);
    }
    if (code === 34 || code === 39) {
      effects.consume(code);
      markerB = code;
      return completeAttributeValueQuoted;
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return completeAttributeValueBefore;
    }
    return completeAttributeValueUnquoted(code);
  }
  function completeAttributeValueQuoted(code) {
    if (code === markerB) {
      effects.consume(code);
      markerB = null;
      return completeAttributeValueQuotedAfter;
    }
    if (code === null || markdownLineEnding(code)) {
      return nok(code);
    }
    effects.consume(code);
    return completeAttributeValueQuoted;
  }
  function completeAttributeValueUnquoted(code) {
    if (code === null || code === 34 || code === 39 || code === 47 || code === 60 || code === 61 || code === 62 || code === 96 || markdownLineEndingOrSpace(code)) {
      return completeAttributeNameAfter(code);
    }
    effects.consume(code);
    return completeAttributeValueUnquoted;
  }
  function completeAttributeValueQuotedAfter(code) {
    if (code === 47 || code === 62 || markdownSpace(code)) {
      return completeAttributeNameBefore(code);
    }
    return nok(code);
  }
  function completeEnd(code) {
    if (code === 62) {
      effects.consume(code);
      return completeAfter;
    }
    return nok(code);
  }
  function completeAfter(code) {
    if (code === null || markdownLineEnding(code)) {
      return continuation(code);
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return completeAfter;
    }
    return nok(code);
  }
  function continuation(code) {
    if (code === 45 && marker === 2) {
      effects.consume(code);
      return continuationCommentInside;
    }
    if (code === 60 && marker === 1) {
      effects.consume(code);
      return continuationRawTagOpen;
    }
    if (code === 62 && marker === 4) {
      effects.consume(code);
      return continuationClose;
    }
    if (code === 63 && marker === 3) {
      effects.consume(code);
      return continuationDeclarationInside;
    }
    if (code === 93 && marker === 5) {
      effects.consume(code);
      return continuationCdataInside;
    }
    if (markdownLineEnding(code) && (marker === 6 || marker === 7)) {
      effects.exit("htmlFlowData");
      return effects.check(blankLineBefore, continuationAfter, continuationStart)(code);
    }
    if (code === null || markdownLineEnding(code)) {
      effects.exit("htmlFlowData");
      return continuationStart(code);
    }
    effects.consume(code);
    return continuation;
  }
  function continuationStart(code) {
    return effects.check(nonLazyContinuation, continuationStartNonLazy, continuationAfter)(code);
  }
  function continuationStartNonLazy(code) {
    effects.enter("lineEnding");
    effects.consume(code);
    effects.exit("lineEnding");
    return continuationBefore;
  }
  function continuationBefore(code) {
    if (code === null || markdownLineEnding(code)) {
      return continuationStart(code);
    }
    effects.enter("htmlFlowData");
    return continuation(code);
  }
  function continuationCommentInside(code) {
    if (code === 45) {
      effects.consume(code);
      return continuationDeclarationInside;
    }
    return continuation(code);
  }
  function continuationRawTagOpen(code) {
    if (code === 47) {
      effects.consume(code);
      buffer = "";
      return continuationRawEndTag;
    }
    return continuation(code);
  }
  function continuationRawEndTag(code) {
    if (code === 62) {
      const name = buffer.toLowerCase();
      if (htmlRawNames.includes(name)) {
        effects.consume(code);
        return continuationClose;
      }
      return continuation(code);
    }
    if (asciiAlpha(code) && buffer.length < 8) {
      effects.consume(code);
      buffer += String.fromCharCode(code);
      return continuationRawEndTag;
    }
    return continuation(code);
  }
  function continuationCdataInside(code) {
    if (code === 93) {
      effects.consume(code);
      return continuationDeclarationInside;
    }
    return continuation(code);
  }
  function continuationDeclarationInside(code) {
    if (code === 62) {
      effects.consume(code);
      return continuationClose;
    }
    if (code === 45 && marker === 2) {
      effects.consume(code);
      return continuationDeclarationInside;
    }
    return continuation(code);
  }
  function continuationClose(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit("htmlFlowData");
      return continuationAfter(code);
    }
    effects.consume(code);
    return continuationClose;
  }
  function continuationAfter(code) {
    effects.exit("htmlFlow");
    return ok(code);
  }
}
function tokenizeBlankLineBefore(effects, ok, nok) {
  return start;
  function start(code) {
    effects.enter("lineEnding");
    effects.consume(code);
    effects.exit("lineEnding");
    return effects.attempt(blankLine, ok, nok);
  }
}

// node_modules/micromark-core-commonmark/lib/html-text.js
var htmlText = {
  name: "htmlText",
  tokenize: tokenizeHtmlText
};
function tokenizeHtmlText(effects, ok, nok) {
  const self = this;
  let marker;
  let index2;
  let returnState;
  return start;
  function start(code) {
    effects.enter("htmlText");
    effects.enter("htmlTextData");
    effects.consume(code);
    return open;
  }
  function open(code) {
    if (code === 33) {
      effects.consume(code);
      return declarationOpen;
    }
    if (code === 47) {
      effects.consume(code);
      return tagCloseStart;
    }
    if (code === 63) {
      effects.consume(code);
      return instruction;
    }
    if (asciiAlpha(code)) {
      effects.consume(code);
      return tagOpen;
    }
    return nok(code);
  }
  function declarationOpen(code) {
    if (code === 45) {
      effects.consume(code);
      return commentOpenInside;
    }
    if (code === 91) {
      effects.consume(code);
      index2 = 0;
      return cdataOpenInside;
    }
    if (asciiAlpha(code)) {
      effects.consume(code);
      return declaration;
    }
    return nok(code);
  }
  function commentOpenInside(code) {
    if (code === 45) {
      effects.consume(code);
      return commentEnd;
    }
    return nok(code);
  }
  function comment(code) {
    if (code === null) {
      return nok(code);
    }
    if (code === 45) {
      effects.consume(code);
      return commentClose;
    }
    if (markdownLineEnding(code)) {
      returnState = comment;
      return lineEndingBefore(code);
    }
    effects.consume(code);
    return comment;
  }
  function commentClose(code) {
    if (code === 45) {
      effects.consume(code);
      return commentEnd;
    }
    return comment(code);
  }
  function commentEnd(code) {
    return code === 62 ? end(code) : code === 45 ? commentClose(code) : comment(code);
  }
  function cdataOpenInside(code) {
    const value = "CDATA[";
    if (code === value.charCodeAt(index2++)) {
      effects.consume(code);
      return index2 === value.length ? cdata : cdataOpenInside;
    }
    return nok(code);
  }
  function cdata(code) {
    if (code === null) {
      return nok(code);
    }
    if (code === 93) {
      effects.consume(code);
      return cdataClose;
    }
    if (markdownLineEnding(code)) {
      returnState = cdata;
      return lineEndingBefore(code);
    }
    effects.consume(code);
    return cdata;
  }
  function cdataClose(code) {
    if (code === 93) {
      effects.consume(code);
      return cdataEnd;
    }
    return cdata(code);
  }
  function cdataEnd(code) {
    if (code === 62) {
      return end(code);
    }
    if (code === 93) {
      effects.consume(code);
      return cdataEnd;
    }
    return cdata(code);
  }
  function declaration(code) {
    if (code === null || code === 62) {
      return end(code);
    }
    if (markdownLineEnding(code)) {
      returnState = declaration;
      return lineEndingBefore(code);
    }
    effects.consume(code);
    return declaration;
  }
  function instruction(code) {
    if (code === null) {
      return nok(code);
    }
    if (code === 63) {
      effects.consume(code);
      return instructionClose;
    }
    if (markdownLineEnding(code)) {
      returnState = instruction;
      return lineEndingBefore(code);
    }
    effects.consume(code);
    return instruction;
  }
  function instructionClose(code) {
    return code === 62 ? end(code) : instruction(code);
  }
  function tagCloseStart(code) {
    if (asciiAlpha(code)) {
      effects.consume(code);
      return tagClose;
    }
    return nok(code);
  }
  function tagClose(code) {
    if (code === 45 || asciiAlphanumeric(code)) {
      effects.consume(code);
      return tagClose;
    }
    return tagCloseBetween(code);
  }
  function tagCloseBetween(code) {
    if (markdownLineEnding(code)) {
      returnState = tagCloseBetween;
      return lineEndingBefore(code);
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return tagCloseBetween;
    }
    return end(code);
  }
  function tagOpen(code) {
    if (code === 45 || asciiAlphanumeric(code)) {
      effects.consume(code);
      return tagOpen;
    }
    if (code === 47 || code === 62 || markdownLineEndingOrSpace(code)) {
      return tagOpenBetween(code);
    }
    return nok(code);
  }
  function tagOpenBetween(code) {
    if (code === 47) {
      effects.consume(code);
      return end;
    }
    if (code === 58 || code === 95 || asciiAlpha(code)) {
      effects.consume(code);
      return tagOpenAttributeName;
    }
    if (markdownLineEnding(code)) {
      returnState = tagOpenBetween;
      return lineEndingBefore(code);
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return tagOpenBetween;
    }
    return end(code);
  }
  function tagOpenAttributeName(code) {
    if (code === 45 || code === 46 || code === 58 || code === 95 || asciiAlphanumeric(code)) {
      effects.consume(code);
      return tagOpenAttributeName;
    }
    return tagOpenAttributeNameAfter(code);
  }
  function tagOpenAttributeNameAfter(code) {
    if (code === 61) {
      effects.consume(code);
      return tagOpenAttributeValueBefore;
    }
    if (markdownLineEnding(code)) {
      returnState = tagOpenAttributeNameAfter;
      return lineEndingBefore(code);
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return tagOpenAttributeNameAfter;
    }
    return tagOpenBetween(code);
  }
  function tagOpenAttributeValueBefore(code) {
    if (code === null || code === 60 || code === 61 || code === 62 || code === 96) {
      return nok(code);
    }
    if (code === 34 || code === 39) {
      effects.consume(code);
      marker = code;
      return tagOpenAttributeValueQuoted;
    }
    if (markdownLineEnding(code)) {
      returnState = tagOpenAttributeValueBefore;
      return lineEndingBefore(code);
    }
    if (markdownSpace(code)) {
      effects.consume(code);
      return tagOpenAttributeValueBefore;
    }
    effects.consume(code);
    return tagOpenAttributeValueUnquoted;
  }
  function tagOpenAttributeValueQuoted(code) {
    if (code === marker) {
      effects.consume(code);
      marker = void 0;
      return tagOpenAttributeValueQuotedAfter;
    }
    if (code === null) {
      return nok(code);
    }
    if (markdownLineEnding(code)) {
      returnState = tagOpenAttributeValueQuoted;
      return lineEndingBefore(code);
    }
    effects.consume(code);
    return tagOpenAttributeValueQuoted;
  }
  function tagOpenAttributeValueUnquoted(code) {
    if (code === null || code === 34 || code === 39 || code === 60 || code === 61 || code === 96) {
      return nok(code);
    }
    if (code === 47 || code === 62 || markdownLineEndingOrSpace(code)) {
      return tagOpenBetween(code);
    }
    effects.consume(code);
    return tagOpenAttributeValueUnquoted;
  }
  function tagOpenAttributeValueQuotedAfter(code) {
    if (code === 47 || code === 62 || markdownLineEndingOrSpace(code)) {
      return tagOpenBetween(code);
    }
    return nok(code);
  }
  function end(code) {
    if (code === 62) {
      effects.consume(code);
      effects.exit("htmlTextData");
      effects.exit("htmlText");
      return ok;
    }
    return nok(code);
  }
  function lineEndingBefore(code) {
    effects.exit("htmlTextData");
    effects.enter("lineEnding");
    effects.consume(code);
    effects.exit("lineEnding");
    return lineEndingAfter;
  }
  function lineEndingAfter(code) {
    return markdownSpace(code) ? factorySpace(effects, lineEndingAfterPrefix, "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code) : lineEndingAfterPrefix(code);
  }
  function lineEndingAfterPrefix(code) {
    effects.enter("htmlTextData");
    return returnState(code);
  }
}

// node_modules/micromark-core-commonmark/lib/label-end.js
var labelEnd = {
  name: "labelEnd",
  resolveAll: resolveAllLabelEnd,
  resolveTo: resolveToLabelEnd,
  tokenize: tokenizeLabelEnd
};
var resourceConstruct = {
  tokenize: tokenizeResource
};
var referenceFullConstruct = {
  tokenize: tokenizeReferenceFull
};
var referenceCollapsedConstruct = {
  tokenize: tokenizeReferenceCollapsed
};
function resolveAllLabelEnd(events) {
  let index2 = -1;
  const newEvents = [];
  while (++index2 < events.length) {
    const token = events[index2][1];
    newEvents.push(events[index2]);
    if (token.type === "labelImage" || token.type === "labelLink" || token.type === "labelEnd") {
      const offset = token.type === "labelImage" ? 4 : 2;
      token.type = "data";
      index2 += offset;
    }
  }
  if (events.length !== newEvents.length) {
    splice(events, 0, events.length, newEvents);
  }
  return events;
}
function resolveToLabelEnd(events, context) {
  let index2 = events.length;
  let offset = 0;
  let open;
  let close;
  let media;
  while (index2--) {
    const token = events[index2][1];
    if (open) {
      if (token.type === "link" || token.type === "labelLink" && token._inactive) {
        break;
      }
      if (events[index2][0] === "enter" && token.type === "labelLink") {
        token._inactive = true;
      }
    } else if (close) {
      if (events[index2][0] === "enter" && (token.type === "labelImage" || token.type === "labelLink") && !token._balanced) {
        open = index2;
        if (token.type !== "labelLink") {
          offset = 2;
          break;
        }
      }
    } else if (token.type === "labelEnd") {
      close = index2;
    }
  }
  const group = {
    type: events[open][1].type === "labelLink" ? "link" : "image",
    start: {
      ...events[open][1].start
    },
    end: {
      ...events[events.length - 1][1].end
    }
  };
  const label = {
    type: "label",
    start: {
      ...events[open][1].start
    },
    end: {
      ...events[close][1].end
    }
  };
  const text3 = {
    type: "labelText",
    start: {
      ...events[open + offset + 2][1].end
    },
    end: {
      ...events[close - 2][1].start
    }
  };
  media = [["enter", group, context], ["enter", label, context]];
  media = push(media, events.slice(open + 1, open + offset + 3));
  media = push(media, [["enter", text3, context]]);
  media = push(media, resolveAll(context.parser.constructs.insideSpan.null, events.slice(open + offset + 4, close - 3), context));
  media = push(media, [["exit", text3, context], events[close - 2], events[close - 1], ["exit", label, context]]);
  media = push(media, events.slice(close + 1));
  media = push(media, [["exit", group, context]]);
  splice(events, open, events.length, media);
  return events;
}
function tokenizeLabelEnd(effects, ok, nok) {
  const self = this;
  const labelStarts = self._labelStarts;
  let labelStart;
  let defined;
  if (labelStarts) {
    while (labelStarts.length > 0 && labelStarts[labelStarts.length - 1]._balanced) {
      labelStarts.pop();
    }
    labelStart = labelStarts[labelStarts.length - 1];
  }
  return start;
  function start(code) {
    if (!labelStart) {
      return nok(code);
    }
    if (labelStart._inactive) {
      return labelEndNok(code);
    }
    defined = self.parser.defined.includes(normalizeIdentifier(self.sliceSerialize({
      start: labelStart.end,
      end: self.now()
    })));
    effects.enter("labelEnd");
    effects.enter("labelMarker");
    effects.consume(code);
    effects.exit("labelMarker");
    effects.exit("labelEnd");
    return after;
  }
  function after(code) {
    if (code === 40) {
      return effects.attempt(resourceConstruct, labelEndOk, defined ? labelEndOk : labelEndNok)(code);
    }
    if (code === 91) {
      return effects.attempt(referenceFullConstruct, labelEndOk, defined ? referenceNotFull : labelEndNok)(code);
    }
    return defined ? labelEndOk(code) : labelEndNok(code);
  }
  function referenceNotFull(code) {
    return effects.attempt(referenceCollapsedConstruct, labelEndOk, labelEndNok)(code);
  }
  function labelEndOk(code) {
    labelStarts.pop();
    return ok(code);
  }
  function labelEndNok(code) {
    labelStart._balanced = true;
    return nok(code);
  }
}
function tokenizeResource(effects, ok, nok) {
  return resourceStart;
  function resourceStart(code) {
    effects.enter("resource");
    effects.enter("resourceMarker");
    effects.consume(code);
    effects.exit("resourceMarker");
    return resourceBefore;
  }
  function resourceBefore(code) {
    return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, resourceOpen)(code) : resourceOpen(code);
  }
  function resourceOpen(code) {
    if (code === 41) {
      return resourceEnd(code);
    }
    return factoryDestination(effects, resourceDestinationAfter, resourceDestinationMissing, "resourceDestination", "resourceDestinationLiteral", "resourceDestinationLiteralMarker", "resourceDestinationRaw", "resourceDestinationString", 32)(code);
  }
  function resourceDestinationAfter(code) {
    return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, resourceBetween)(code) : resourceEnd(code);
  }
  function resourceDestinationMissing(code) {
    return nok(code);
  }
  function resourceBetween(code) {
    if (code === 34 || code === 39 || code === 40) {
      return factoryTitle(effects, resourceTitleAfter, nok, "resourceTitle", "resourceTitleMarker", "resourceTitleString")(code);
    }
    return resourceEnd(code);
  }
  function resourceTitleAfter(code) {
    return markdownLineEndingOrSpace(code) ? factoryWhitespace(effects, resourceEnd)(code) : resourceEnd(code);
  }
  function resourceEnd(code) {
    if (code === 41) {
      effects.enter("resourceMarker");
      effects.consume(code);
      effects.exit("resourceMarker");
      effects.exit("resource");
      return ok;
    }
    return nok(code);
  }
}
function tokenizeReferenceFull(effects, ok, nok) {
  const self = this;
  return referenceFull;
  function referenceFull(code) {
    return factoryLabel.call(self, effects, referenceFullAfter, referenceFullMissing, "reference", "referenceMarker", "referenceString")(code);
  }
  function referenceFullAfter(code) {
    return self.parser.defined.includes(normalizeIdentifier(self.sliceSerialize(self.events[self.events.length - 1][1]).slice(1, -1))) ? ok(code) : nok(code);
  }
  function referenceFullMissing(code) {
    return nok(code);
  }
}
function tokenizeReferenceCollapsed(effects, ok, nok) {
  return referenceCollapsedStart;
  function referenceCollapsedStart(code) {
    effects.enter("reference");
    effects.enter("referenceMarker");
    effects.consume(code);
    effects.exit("referenceMarker");
    return referenceCollapsedOpen;
  }
  function referenceCollapsedOpen(code) {
    if (code === 93) {
      effects.enter("referenceMarker");
      effects.consume(code);
      effects.exit("referenceMarker");
      effects.exit("reference");
      return ok;
    }
    return nok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/label-start-image.js
var labelStartImage = {
  name: "labelStartImage",
  resolveAll: labelEnd.resolveAll,
  tokenize: tokenizeLabelStartImage
};
function tokenizeLabelStartImage(effects, ok, nok) {
  const self = this;
  let labelImage;
  return start;
  function start(code) {
    effects.enter("labelImage");
    effects.enter("labelImageMarker");
    effects.consume(code);
    effects.exit("labelImageMarker");
    return open;
  }
  function open(code) {
    if (code === 91) {
      effects.enter("labelMarker");
      effects.consume(code);
      effects.exit("labelMarker");
      labelImage = effects.exit("labelImage");
      return after;
    }
    return nok(code);
  }
  function after(code) {
    if (code === 94 && "_hiddenFootnoteSupport" in self.parser.constructs) {
      return nok(code);
    }
    self._labelStarts = self._labelStarts || [];
    self._labelStarts.push(labelImage);
    return ok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/label-start-link.js
var labelStartLink = {
  name: "labelStartLink",
  resolveAll: labelEnd.resolveAll,
  tokenize: tokenizeLabelStartLink
};
function tokenizeLabelStartLink(effects, ok, nok) {
  const self = this;
  let labelLink;
  return start;
  function start(code) {
    effects.enter("labelLink");
    effects.enter("labelMarker");
    effects.consume(code);
    effects.exit("labelMarker");
    labelLink = effects.exit("labelLink");
    return after;
  }
  function after(code) {
    if (code === 94 && "_hiddenFootnoteSupport" in self.parser.constructs) {
      return nok(code);
    }
    self._labelStarts = self._labelStarts || [];
    self._labelStarts.push(labelLink);
    return ok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/line-ending.js
var lineEnding = {
  name: "lineEnding",
  tokenize: tokenizeLineEnding
};
function tokenizeLineEnding(effects, ok) {
  return start;
  function start(code) {
    effects.enter("lineEnding");
    effects.consume(code);
    effects.exit("lineEnding");
    return factorySpace(effects, ok, "linePrefix");
  }
}

// node_modules/micromark-core-commonmark/lib/thematic-break.js
var thematicBreak = {
  name: "thematicBreak",
  tokenize: tokenizeThematicBreak
};
function tokenizeThematicBreak(effects, ok, nok) {
  let size = 0;
  let marker;
  return start;
  function start(code) {
    effects.enter("thematicBreak");
    return before(code);
  }
  function before(code) {
    marker = code;
    return atBreak(code);
  }
  function atBreak(code) {
    if (code === marker) {
      effects.enter("thematicBreakSequence");
      return sequence(code);
    }
    if (size >= 3 && (code === null || markdownLineEnding(code))) {
      effects.exit("thematicBreak");
      return ok(code);
    }
    return nok(code);
  }
  function sequence(code) {
    if (code === marker) {
      effects.consume(code);
      size++;
      return sequence;
    }
    effects.exit("thematicBreakSequence");
    return markdownSpace(code) ? factorySpace(effects, atBreak, "whitespace")(code) : atBreak(code);
  }
}

// node_modules/micromark-core-commonmark/lib/list.js
var list = {
  continuation: {
    tokenize: tokenizeListContinuation
  },
  exit: tokenizeListEnd,
  name: "list",
  tokenize: tokenizeListStart
};
var listItemPrefixWhitespaceConstruct = {
  partial: true,
  tokenize: tokenizeListItemPrefixWhitespace
};
var indentConstruct = {
  partial: true,
  tokenize: tokenizeIndent
};
function tokenizeListStart(effects, ok, nok) {
  const self = this;
  const tail = self.events[self.events.length - 1];
  let initialSize = tail && tail[1].type === "linePrefix" ? tail[2].sliceSerialize(tail[1], true).length : 0;
  let size = 0;
  return start;
  function start(code) {
    const kind = self.containerState.type || (code === 42 || code === 43 || code === 45 ? "listUnordered" : "listOrdered");
    if (kind === "listUnordered" ? !self.containerState.marker || code === self.containerState.marker : asciiDigit(code)) {
      if (!self.containerState.type) {
        self.containerState.type = kind;
        effects.enter(kind, {
          _container: true
        });
      }
      if (kind === "listUnordered") {
        effects.enter("listItemPrefix");
        return code === 42 || code === 45 ? effects.check(thematicBreak, nok, atMarker)(code) : atMarker(code);
      }
      if (!self.interrupt || code === 49) {
        effects.enter("listItemPrefix");
        effects.enter("listItemValue");
        return inside(code);
      }
    }
    return nok(code);
  }
  function inside(code) {
    if (asciiDigit(code) && ++size < 10) {
      effects.consume(code);
      return inside;
    }
    if ((!self.interrupt || size < 2) && (self.containerState.marker ? code === self.containerState.marker : code === 41 || code === 46)) {
      effects.exit("listItemValue");
      return atMarker(code);
    }
    return nok(code);
  }
  function atMarker(code) {
    effects.enter("listItemMarker");
    effects.consume(code);
    effects.exit("listItemMarker");
    self.containerState.marker = self.containerState.marker || code;
    return effects.check(
      blankLine,
      // Can’t be empty when interrupting.
      self.interrupt ? nok : onBlank,
      effects.attempt(listItemPrefixWhitespaceConstruct, endOfPrefix, otherPrefix)
    );
  }
  function onBlank(code) {
    self.containerState.initialBlankLine = true;
    initialSize++;
    return endOfPrefix(code);
  }
  function otherPrefix(code) {
    if (markdownSpace(code)) {
      effects.enter("listItemPrefixWhitespace");
      effects.consume(code);
      effects.exit("listItemPrefixWhitespace");
      return endOfPrefix;
    }
    return nok(code);
  }
  function endOfPrefix(code) {
    self.containerState.size = initialSize + self.sliceSerialize(effects.exit("listItemPrefix"), true).length;
    return ok(code);
  }
}
function tokenizeListContinuation(effects, ok, nok) {
  const self = this;
  self.containerState._closeFlow = void 0;
  return effects.check(blankLine, onBlank, notBlank);
  function onBlank(code) {
    self.containerState.furtherBlankLines = self.containerState.furtherBlankLines || self.containerState.initialBlankLine;
    return factorySpace(effects, ok, "listItemIndent", self.containerState.size + 1)(code);
  }
  function notBlank(code) {
    if (self.containerState.furtherBlankLines || !markdownSpace(code)) {
      self.containerState.furtherBlankLines = void 0;
      self.containerState.initialBlankLine = void 0;
      return notInCurrentItem(code);
    }
    self.containerState.furtherBlankLines = void 0;
    self.containerState.initialBlankLine = void 0;
    return effects.attempt(indentConstruct, ok, notInCurrentItem)(code);
  }
  function notInCurrentItem(code) {
    self.containerState._closeFlow = true;
    self.interrupt = void 0;
    return factorySpace(effects, effects.attempt(list, ok, nok), "linePrefix", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4)(code);
  }
}
function tokenizeIndent(effects, ok, nok) {
  const self = this;
  return factorySpace(effects, afterPrefix, "listItemIndent", self.containerState.size + 1);
  function afterPrefix(code) {
    const tail = self.events[self.events.length - 1];
    return tail && tail[1].type === "listItemIndent" && tail[2].sliceSerialize(tail[1], true).length === self.containerState.size ? ok(code) : nok(code);
  }
}
function tokenizeListEnd(effects) {
  effects.exit(this.containerState.type);
}
function tokenizeListItemPrefixWhitespace(effects, ok, nok) {
  const self = this;
  return factorySpace(effects, afterPrefix, "listItemPrefixWhitespace", self.parser.constructs.disable.null.includes("codeIndented") ? void 0 : 4 + 1);
  function afterPrefix(code) {
    const tail = self.events[self.events.length - 1];
    return !markdownSpace(code) && tail && tail[1].type === "listItemPrefixWhitespace" ? ok(code) : nok(code);
  }
}

// node_modules/micromark-core-commonmark/lib/setext-underline.js
var setextUnderline = {
  name: "setextUnderline",
  resolveTo: resolveToSetextUnderline,
  tokenize: tokenizeSetextUnderline
};
function resolveToSetextUnderline(events, context) {
  const editMap = new EditMap();
  let index2 = events.length;
  let content3;
  let text3;
  let definition2;
  while (index2--) {
    if (events[index2][0] === "enter") {
      if (events[index2][1].type === "content") {
        content3 = index2;
        break;
      }
      if (events[index2][1].type === "paragraph") {
        text3 = index2;
      }
    } else {
      if (events[index2][1].type === "content") {
        editMap.add(index2, 1, []);
      }
      if (!definition2 && events[index2][1].type === "definition") {
        definition2 = index2;
      }
    }
  }
  const heading = {
    type: "setextHeading",
    start: {
      ...events[content3][1].start
    },
    end: {
      ...events[events.length - 1][1].end
    }
  };
  events[text3][1].type = "setextHeadingText";
  if (definition2) {
    editMap.add(text3, 0, [["enter", heading, context]]);
    editMap.add(definition2 + 1, 0, [["exit", events[content3][1], context]]);
    events[content3][1].end = {
      ...events[definition2][1].end
    };
  } else {
    events[content3][1] = heading;
  }
  editMap.add(events.length, 0, [["exit", heading, context]]);
  editMap.consume(events);
  return events;
}
function tokenizeSetextUnderline(effects, ok, nok) {
  const self = this;
  let marker;
  return start;
  function start(code) {
    let index2 = self.events.length;
    let paragraph;
    while (index2--) {
      if (self.events[index2][1].type !== "lineEnding" && self.events[index2][1].type !== "linePrefix" && self.events[index2][1].type !== "content") {
        paragraph = self.events[index2][1].type === "paragraph";
        break;
      }
    }
    if (!self.parser.lazy[self.now().line] && (self.interrupt || paragraph)) {
      effects.enter("setextHeadingLine");
      marker = code;
      return before(code);
    }
    return nok(code);
  }
  function before(code) {
    effects.enter("setextHeadingLineSequence");
    return inside(code);
  }
  function inside(code) {
    if (code === marker) {
      effects.consume(code);
      return inside;
    }
    effects.exit("setextHeadingLineSequence");
    return markdownSpace(code) ? factorySpace(effects, after, "lineSuffix")(code) : after(code);
  }
  function after(code) {
    if (code === null || markdownLineEnding(code)) {
      effects.exit("setextHeadingLine");
      return ok(code);
    }
    return nok(code);
  }
}

// node_modules/micromark/lib/initialize/flow.js
var flow = {
  tokenize: initializeFlow
};
function initializeFlow(effects) {
  const self = this;
  const initial = effects.attempt(
    // Try to parse a blank line.
    blankLine,
    atBlankEnding,
    // Try to parse initial flow (essentially, only code).
    effects.attempt(this.parser.constructs.flowInitial, afterConstruct, factorySpace(effects, effects.attempt(this.parser.constructs.flow, afterConstruct, effects.attempt(content2, afterConstruct)), "linePrefix"))
  );
  return initial;
  function atBlankEnding(code) {
    if (code === null) {
      effects.consume(code);
      return;
    }
    effects.enter("lineEndingBlank");
    effects.consume(code);
    effects.exit("lineEndingBlank");
    self.currentConstruct = void 0;
    return initial;
  }
  function afterConstruct(code) {
    if (code === null) {
      effects.consume(code);
      return;
    }
    effects.enter("lineEnding");
    effects.consume(code);
    effects.exit("lineEnding");
    self.currentConstruct = void 0;
    return initial;
  }
}

// node_modules/micromark/lib/initialize/text.js
var resolver = {
  resolveAll: createResolver()
};
var string = initializeFactory("string");
var text = initializeFactory("text");
function initializeFactory(field) {
  return {
    resolveAll: createResolver(field === "text" ? resolveAllLineSuffixes : void 0),
    tokenize: initializeText
  };
  function initializeText(effects) {
    const self = this;
    const constructs2 = this.parser.constructs[field];
    const text3 = effects.attempt(constructs2, start, notText);
    return start;
    function start(code) {
      return atBreak(code) ? text3(code) : notText(code);
    }
    function notText(code) {
      if (code === null) {
        effects.consume(code);
        return;
      }
      effects.enter("data");
      effects.consume(code);
      return data;
    }
    function data(code) {
      if (atBreak(code)) {
        effects.exit("data");
        return text3(code);
      }
      effects.consume(code);
      return data;
    }
    function atBreak(code) {
      if (code === null) {
        return true;
      }
      const list2 = constructs2[code];
      let index2 = -1;
      if (list2) {
        while (++index2 < list2.length) {
          const item = list2[index2];
          if (!item.previous || item.previous.call(self, self.previous)) {
            return true;
          }
        }
      }
      return false;
    }
  }
}
function createResolver(extraResolver) {
  return resolveAllText;
  function resolveAllText(events, context) {
    let index2 = -1;
    let enter;
    while (++index2 <= events.length) {
      if (enter === void 0) {
        if (events[index2] && events[index2][1].type === "data") {
          enter = index2;
          index2++;
        }
      } else if (!events[index2] || events[index2][1].type !== "data") {
        if (index2 !== enter + 2) {
          events[enter][1].end = events[index2 - 1][1].end;
          events.splice(enter + 2, index2 - enter - 2);
          index2 = enter + 2;
        }
        enter = void 0;
      }
    }
    return extraResolver ? extraResolver(events, context) : events;
  }
}
function resolveAllLineSuffixes(events, context) {
  const editMap = new EditMap();
  let eventIndex = 0;
  while (++eventIndex <= events.length) {
    if ((eventIndex === events.length || events[eventIndex][1].type === "lineEnding") && events[eventIndex - 1][1].type === "data") {
      const data = events[eventIndex - 1][1];
      const chunks = context.sliceStream(data);
      let index2 = chunks.length;
      let bufferIndex = -1;
      let size = 0;
      let tabs;
      while (index2--) {
        const chunk = chunks[index2];
        if (typeof chunk === "string") {
          bufferIndex = chunk.length;
          while (chunk.charCodeAt(bufferIndex - 1) === 32) {
            size++;
            bufferIndex--;
          }
          if (bufferIndex) {
            break;
          }
          bufferIndex = -1;
        } else if (chunk === -2) {
          tabs = true;
          size++;
        } else if (chunk === -1) {
        } else {
          index2++;
          break;
        }
      }
      if (context._contentTypeTextTrailing && eventIndex === events.length) {
        size = 0;
      }
      if (size) {
        const token = {
          type: eventIndex === events.length || tabs || size < 2 ? "lineSuffix" : "hardBreakTrailing",
          start: {
            _bufferIndex: index2 ? bufferIndex : data.start._bufferIndex + bufferIndex,
            _index: data.start._index + index2,
            line: data.end.line,
            column: data.end.column - size,
            offset: data.end.offset - size
          },
          end: {
            ...data.end
          }
        };
        data.end = {
          ...token.start
        };
        if (data.start.offset === data.end.offset) {
          Object.assign(data, token);
        } else {
          editMap.add(eventIndex, 0, [["enter", token, context], ["exit", token, context]]);
        }
      }
      eventIndex++;
    }
  }
  editMap.consume(events);
  return events;
}

// node_modules/micromark/lib/constructs.js
var constructs_exports = {};
__export(constructs_exports, {
  attentionMarkers: () => attentionMarkers,
  contentInitial: () => contentInitial,
  disable: () => disable,
  document: () => document2,
  flow: () => flow2,
  flowInitial: () => flowInitial,
  insideSpan: () => insideSpan,
  string: () => string2,
  text: () => text2
});
var document2 = {
  [42]: list,
  [43]: list,
  [45]: list,
  [48]: list,
  [49]: list,
  [50]: list,
  [51]: list,
  [52]: list,
  [53]: list,
  [54]: list,
  [55]: list,
  [56]: list,
  [57]: list,
  [62]: blockQuote
};
var contentInitial = {
  [91]: definition
};
var flowInitial = {
  [-2]: codeIndented,
  [-1]: codeIndented,
  [32]: codeIndented
};
var flow2 = {
  [35]: headingAtx,
  [42]: thematicBreak,
  [45]: [setextUnderline, thematicBreak],
  [60]: htmlFlow,
  [61]: setextUnderline,
  [95]: thematicBreak,
  [96]: codeFenced,
  [126]: codeFenced
};
var string2 = {
  [38]: characterReference,
  [92]: characterEscape
};
var text2 = {
  [-5]: lineEnding,
  [-4]: lineEnding,
  [-3]: lineEnding,
  [33]: labelStartImage,
  [38]: characterReference,
  [42]: attention,
  [60]: [autolink, htmlText],
  [91]: labelStartLink,
  [92]: [hardBreakEscape, characterEscape],
  [93]: labelEnd,
  [95]: attention,
  [96]: codeText
};
var insideSpan = {
  null: [attention, resolver]
};
var attentionMarkers = {
  null: [42, 95]
};
var disable = {
  null: []
};

// node_modules/micromark/lib/create-tokenizer.js
function createTokenizer(parser, initialize, from) {
  let point3 = {
    _bufferIndex: -1,
    _index: 0,
    line: from && from.line || 1,
    column: from && from.column || 1,
    offset: from && from.offset || 0
  };
  const columnStart = {};
  const resolveAllConstructs = [];
  let chunks = [];
  let stack = [];
  let consumed = true;
  const effects = {
    attempt: constructFactory(onsuccessfulconstruct),
    check: constructFactory(onsuccessfulcheck),
    consume,
    enter,
    exit: exit2,
    interrupt: constructFactory(onsuccessfulcheck, {
      interrupt: true
    })
  };
  const context = {
    code: null,
    containerState: {},
    defineSkip,
    events: [],
    now,
    parser,
    previous: null,
    sliceSerialize,
    sliceStream,
    write
  };
  let state = initialize.tokenize.call(context, effects);
  let expectedCode;
  if (initialize.resolveAll) {
    resolveAllConstructs.push(initialize);
  }
  return context;
  function write(slice) {
    chunks = push(chunks, slice);
    main();
    if (chunks[chunks.length - 1] !== null) {
      return [];
    }
    addResult(initialize, 0);
    context.events = resolveAll(resolveAllConstructs, context.events, context);
    return context.events;
  }
  function sliceSerialize(token, expandTabs) {
    return serializeChunks(sliceStream(token), expandTabs);
  }
  function sliceStream(token) {
    return sliceChunks(chunks, token);
  }
  function now() {
    const {
      _bufferIndex,
      _index,
      line,
      column,
      offset
    } = point3;
    return {
      _bufferIndex,
      _index,
      line,
      column,
      offset
    };
  }
  function defineSkip(value) {
    columnStart[value.line] = value.column;
    accountForPotentialSkip();
  }
  function main() {
    while (point3._index < chunks.length) {
      const chunk = chunks[point3._index];
      if (typeof chunk === "string") {
        const chunkIndex = point3._index;
        if (point3._bufferIndex < 0) {
          point3._bufferIndex = 0;
        }
        while (point3._index === chunkIndex && point3._bufferIndex < chunk.length) {
          go(chunk.charCodeAt(point3._bufferIndex));
        }
      } else {
        go(chunk);
      }
    }
  }
  function go(code) {
    consumed = void 0;
    expectedCode = code;
    state = state(code);
  }
  function consume(code) {
    if (markdownLineEnding(code)) {
      point3.line++;
      point3.column = 1;
      point3.offset += code === -3 ? 2 : 1;
      accountForPotentialSkip();
    } else if (code !== -1) {
      point3.column++;
      point3.offset++;
    }
    if (point3._bufferIndex < 0) {
      point3._index++;
    } else {
      point3._bufferIndex++;
      if (point3._bufferIndex === // Points w/ non-negative `_bufferIndex` reference
      // strings.
      /** @type {string} */
      chunks[point3._index].length) {
        point3._bufferIndex = -1;
        point3._index++;
      }
    }
    context.previous = code;
    consumed = true;
  }
  function enter(type, fields) {
    const token = fields || {};
    token.type = type;
    token.start = now();
    context.events.push(["enter", token, context]);
    stack.push(token);
    return token;
  }
  function exit2(type) {
    const token = stack.pop();
    token.end = now();
    context.events.push(["exit", token, context]);
    return token;
  }
  function onsuccessfulconstruct(construct, info) {
    addResult(construct, info.from);
  }
  function onsuccessfulcheck(_, info) {
    info.restore();
  }
  function constructFactory(onreturn, fields) {
    return hook;
    function hook(constructs2, returnState, bogusState) {
      let listOfConstructs;
      let constructIndex;
      let currentConstruct;
      let info;
      return Array.isArray(constructs2) ? (
        /* c8 ignore next 1 */
        handleListOfConstructs(constructs2)
      ) : "tokenize" in constructs2 ? (
        // Looks like a construct.
        handleListOfConstructs([
          /** @type {Construct} */
          constructs2
        ])
      ) : handleMapOfConstructs(constructs2);
      function handleMapOfConstructs(map) {
        return start;
        function start(code) {
          const left = code !== null && map[code];
          const all2 = code !== null && map.null;
          const list2 = [
            // To do: add more extension tests.
            /* c8 ignore next 2 */
            ...Array.isArray(left) ? left : left ? [left] : [],
            ...Array.isArray(all2) ? all2 : all2 ? [all2] : []
          ];
          return handleListOfConstructs(list2)(code);
        }
      }
      function handleListOfConstructs(list2) {
        listOfConstructs = list2;
        constructIndex = 0;
        if (list2.length === 0) {
          return bogusState;
        }
        return handleConstruct(list2[constructIndex]);
      }
      function handleConstruct(construct) {
        return start;
        function start(code) {
          info = store();
          currentConstruct = construct;
          if (!construct.partial) {
            context.currentConstruct = construct;
          }
          if (construct.name && context.parser.constructs.disable.null.includes(construct.name)) {
            return nok(code);
          }
          return construct.tokenize.call(
            // If we do have fields, create an object w/ `context` as its
            // prototype.
            // This allows a “live binding”, which is needed for `interrupt`.
            fields ? Object.assign(Object.create(context), fields) : context,
            effects,
            ok,
            nok
          )(code);
        }
      }
      function ok(code) {
        consumed = true;
        onreturn(currentConstruct, info);
        return returnState;
      }
      function nok(code) {
        consumed = true;
        info.restore();
        if (++constructIndex < listOfConstructs.length) {
          return handleConstruct(listOfConstructs[constructIndex]);
        }
        return bogusState;
      }
    }
  }
  function addResult(construct, from2) {
    if (construct.resolveAll && !resolveAllConstructs.includes(construct)) {
      resolveAllConstructs.push(construct);
    }
    if (construct.resolve) {
      splice(context.events, from2, context.events.length - from2, construct.resolve(context.events.slice(from2), context));
    }
    if (construct.resolveTo) {
      context.events = construct.resolveTo(context.events, context);
    }
  }
  function store() {
    const startPoint = now();
    const startPrevious = context.previous;
    const startCurrentConstruct = context.currentConstruct;
    const startEventsIndex = context.events.length;
    const startStack = Array.from(stack);
    return {
      from: startEventsIndex,
      restore
    };
    function restore() {
      point3 = startPoint;
      context.previous = startPrevious;
      context.currentConstruct = startCurrentConstruct;
      context.events.length = startEventsIndex;
      stack = startStack;
      accountForPotentialSkip();
    }
  }
  function accountForPotentialSkip() {
    if (point3.line in columnStart && point3.column < 2) {
      point3.column = columnStart[point3.line];
      point3.offset += columnStart[point3.line] - 1;
    }
  }
}
function sliceChunks(chunks, token) {
  const startIndex = token.start._index;
  const startBufferIndex = token.start._bufferIndex;
  const endIndex = token.end._index;
  const endBufferIndex = token.end._bufferIndex;
  let view;
  if (startIndex === endIndex) {
    view = [chunks[startIndex].slice(startBufferIndex, endBufferIndex)];
  } else {
    view = chunks.slice(startIndex, endIndex);
    if (startBufferIndex > -1) {
      const head = view[0];
      if (typeof head === "string") {
        view[0] = head.slice(startBufferIndex);
      } else {
        view.shift();
      }
    }
    if (endBufferIndex > 0) {
      view.push(chunks[endIndex].slice(0, endBufferIndex));
    }
  }
  return view;
}
function serializeChunks(chunks, expandTabs) {
  let index2 = -1;
  const result = [];
  let atTab;
  while (++index2 < chunks.length) {
    const chunk = chunks[index2];
    let value;
    if (typeof chunk === "string") {
      value = chunk;
    } else {
      switch (chunk) {
        case -5: {
          value = "\r";
          break;
        }
        case -4: {
          value = "\n";
          break;
        }
        case -3: {
          value = "\r\n";
          break;
        }
        case -2: {
          value = expandTabs ? " " : "	";
          break;
        }
        case -1: {
          if (!expandTabs && atTab) {
            continue;
          }
          value = " ";
          break;
        }
        default: {
          value = String.fromCharCode(chunk);
        }
      }
    }
    atTab = chunk === -2;
    result.push(value);
  }
  return result.join("");
}

// node_modules/micromark/lib/parse.js
function parse(options) {
  const settings = options || {};
  const constructs2 = (
    /** @type {FullNormalizedExtension} */
    combineExtensions([constructs_exports, ...settings.extensions || []])
  );
  const parser = {
    constructs: constructs2,
    content: create(content),
    defined: [],
    document: create(document),
    flow: create(flow),
    lazy: {},
    string: create(string),
    text: create(text)
  };
  return parser;
  function create(initial) {
    return creator;
    function creator(from) {
      return createTokenizer(parser, initial, from);
    }
  }
}

// node_modules/micromark/lib/postprocess.js
function postprocess(events) {
  while (!subtokenize(events)) {
  }
  return events;
}

// node_modules/micromark/lib/preprocess.js
var search = /[\0\t\n\r]/g;
function preprocess() {
  let column = 1;
  let buffer = "";
  let start = true;
  let atCarriageReturn;
  return preprocessor;
  function preprocessor(value, encoding, end) {
    value = buffer + (typeof value === "string" ? value.toString() : new TextDecoder(encoding || void 0).decode(value));
    const chunks = [];
    let startPosition = 0;
    buffer = "";
    if (start) {
      if (value.charCodeAt(0) === 65279) {
        startPosition++;
      }
      start = void 0;
    }
    while (startPosition < value.length) {
      search.lastIndex = startPosition;
      const match = search.exec(value);
      const endPosition = match && match.index !== void 0 ? match.index : value.length;
      const code = value.charCodeAt(endPosition);
      if (!match) {
        buffer = value.slice(startPosition);
        break;
      }
      if (code === 10 && startPosition === endPosition && atCarriageReturn) {
        chunks.push(-3);
        atCarriageReturn = void 0;
      } else {
        if (atCarriageReturn) {
          chunks.push(-5);
          atCarriageReturn = void 0;
        }
        if (startPosition < endPosition) {
          chunks.push(value.slice(startPosition, endPosition));
          column += endPosition - startPosition;
        }
        switch (code) {
          case 0: {
            chunks.push(65533);
            column++;
            break;
          }
          case 9: {
            const next = Math.ceil(column / 4) * 4;
            chunks.push(-2);
            while (column++ < next) {
              chunks.push(-1);
            }
            break;
          }
          case 10: {
            chunks.push(-4);
            column = 1;
            break;
          }
          default: {
            atCarriageReturn = true;
            column = 1;
          }
        }
      }
      startPosition = endPosition + 1;
    }
    if (end) {
      if (atCarriageReturn) {
        chunks.push(-5);
      }
      if (buffer) {
        chunks.push(buffer);
      }
      chunks.push(null);
    }
    return chunks;
  }
}

// node_modules/micromark-util-decode-string/index.js
var characterEscapeOrReference = /\\([!-/:-@[-`{-~])|&(#(?:\d{1,7}|x[\da-f]{1,6})|[\da-z]{1,31});/gi;
function decodeString(value) {
  return value.replace(characterEscapeOrReference, decode);
}
function decode($0, $1, $2) {
  if ($1) {
    return $1;
  }
  const head = $2.charCodeAt(0);
  if (head === 35) {
    const head2 = $2.charCodeAt(1);
    const hex = head2 === 120 || head2 === 88;
    return decodeNumericCharacterReference($2.slice(hex ? 2 : 1), hex ? 16 : 10);
  }
  return decodeNamedCharacterReference($2) || $0;
}

// node_modules/unist-util-stringify-position/lib/index.js
function stringifyPosition(value) {
  if (!value || typeof value !== "object") {
    return "";
  }
  if ("position" in value || "type" in value) {
    return position(value.position);
  }
  if ("start" in value || "end" in value) {
    return position(value);
  }
  if ("line" in value || "column" in value) {
    return point(value);
  }
  return "";
}
function point(point3) {
  return index(point3 && point3.line) + ":" + index(point3 && point3.column);
}
function position(pos) {
  return point(pos && pos.start) + "-" + point(pos && pos.end);
}
function index(value) {
  return value && typeof value === "number" ? value : 1;
}

// node_modules/mdast-util-from-markdown/lib/index.js
var own2 = {}.hasOwnProperty;
function fromMarkdown(value, encoding, options) {
  if (encoding && typeof encoding === "object") {
    options = encoding;
    encoding = void 0;
  }
  return compiler(options)(postprocess(parse(options).document().write(preprocess()(value, encoding, true))));
}
function compiler(options) {
  const config = {
    afterExit: [],
    beforeEnter: [],
    transforms: [],
    canContainEols: ["emphasis", "fragment", "heading", "paragraph", "strong"],
    enter: {
      autolink: opener(link3),
      autolinkProtocol: onenterdata,
      autolinkEmail: onenterdata,
      atxHeading: opener(heading),
      blockQuote: opener(blockQuote2),
      characterEscape: onenterdata,
      characterReference: onenterdata,
      codeFenced: opener(codeFlow),
      codeFencedFenceInfo: buffer,
      codeFencedFenceMeta: buffer,
      codeIndented: opener(codeFlow, buffer),
      codeText: opener(codeText2, buffer),
      codeTextData: onenterdata,
      data: onenterdata,
      codeFlowValue: onenterdata,
      definition: opener(definition2),
      definitionDestinationString: buffer,
      definitionLabelString: buffer,
      definitionTitleString: buffer,
      emphasis: opener(emphasis),
      hardBreakEscape: opener(hardBreak),
      hardBreakTrailing: opener(hardBreak),
      htmlFlow: opener(html, buffer),
      htmlFlowData: onenterdata,
      htmlText: opener(html, buffer),
      htmlTextData: onenterdata,
      image: opener(image2),
      label: buffer,
      link: opener(link3),
      listItem: opener(listItem),
      listItemValue: onenterlistitemvalue,
      listOrdered: opener(list2, onenterlistordered),
      listUnordered: opener(list2),
      paragraph: opener(paragraph),
      reference: onenterreference,
      referenceString: buffer,
      resourceDestinationString: buffer,
      resourceTitleString: buffer,
      setextHeading: opener(heading),
      strong: opener(strong),
      thematicBreak: opener(thematicBreak2)
    },
    exit: {
      atxHeading: closer(),
      atxHeadingSequence: onexitatxheadingsequence,
      autolink: closer(),
      autolinkEmail: onexitautolinkemail,
      autolinkProtocol: onexitautolinkprotocol,
      blockQuote: closer(),
      characterEscapeValue: onexitdata,
      characterReferenceMarkerHexadecimal: onexitcharacterreferencemarker,
      characterReferenceMarkerNumeric: onexitcharacterreferencemarker,
      characterReferenceValue: onexitcharacterreferencevalue,
      characterReference: onexitcharacterreference,
      codeFenced: closer(onexitcodefenced),
      codeFencedFence: onexitcodefencedfence,
      codeFencedFenceInfo: onexitcodefencedfenceinfo,
      codeFencedFenceMeta: onexitcodefencedfencemeta,
      codeFlowValue: onexitdata,
      codeIndented: closer(onexitcodeindented),
      codeText: closer(onexitcodetext),
      codeTextData: onexitdata,
      data: onexitdata,
      definition: closer(),
      definitionDestinationString: onexitdefinitiondestinationstring,
      definitionLabelString: onexitdefinitionlabelstring,
      definitionTitleString: onexitdefinitiontitlestring,
      emphasis: closer(),
      hardBreakEscape: closer(onexithardbreak),
      hardBreakTrailing: closer(onexithardbreak),
      htmlFlow: closer(onexithtmlflow),
      htmlFlowData: onexitdata,
      htmlText: closer(onexithtmltext),
      htmlTextData: onexitdata,
      image: closer(onexitimage),
      label: onexitlabel,
      labelText: onexitlabeltext,
      lineEnding: onexitlineending,
      link: closer(onexitlink),
      listItem: closer(),
      listOrdered: closer(),
      listUnordered: closer(),
      paragraph: closer(),
      referenceString: onexitreferencestring,
      resourceDestinationString: onexitresourcedestinationstring,
      resourceTitleString: onexitresourcetitlestring,
      resource: onexitresource,
      setextHeading: closer(onexitsetextheading),
      setextHeadingLineSequence: onexitsetextheadinglinesequence,
      setextHeadingText: onexitsetextheadingtext,
      strong: closer(),
      thematicBreak: closer()
    }
  };
  configure(config, (options || {}).mdastExtensions || []);
  const data = {};
  return compile;
  function compile(events) {
    let tree = {
      type: "root",
      children: [],
      position: void 0
    };
    const context = {
      stack: [tree],
      tokenStack: [],
      config,
      enter,
      exit: exit2,
      buffer,
      resume,
      data
    };
    const listStack = [];
    const prepared = [];
    let index2 = -1;
    while (++index2 < events.length) {
      prepared.push(events[index2]);
      if (events[index2][1].type === "listOrdered" || events[index2][1].type === "listUnordered") {
        if (events[index2][0] === "enter") {
          listStack.push(prepared.length - 1);
        } else {
          const tail = listStack.pop();
          prepareList(prepared, tail);
        }
      }
    }
    events = prepared;
    index2 = -1;
    while (++index2 < events.length) {
      const handler = config[events[index2][0]];
      if (events[index2][0] === "enter" && config.beforeEnter.length > 0) {
        callListeners(config.beforeEnter, {
          ...context,
          sliceSerialize: events[index2][2].sliceSerialize
        }, events[index2][1]);
      }
      if (own2.call(handler, events[index2][1].type)) {
        handler[events[index2][1].type].call({
          ...context,
          sliceSerialize: events[index2][2].sliceSerialize
        }, events[index2][1]);
      }
      if (events[index2][0] === "exit" && config.afterExit.length > 0) {
        callListeners(config.afterExit, {
          ...context,
          sliceSerialize: events[index2][2].sliceSerialize
        }, events[index2][1]);
      }
    }
    if (context.tokenStack.length > 0) {
      const tail = context.tokenStack[context.tokenStack.length - 1];
      const handler = tail[1] || defaultOnError;
      handler.call(context, void 0, tail[0]);
    }
    tree.position = {
      start: point2(events.length > 0 ? events[0][1].start : {
        line: 1,
        column: 1,
        offset: 0
      }),
      end: point2(events.length > 0 ? events[events.length - 2][1].end : {
        line: 1,
        column: 1,
        offset: 0
      })
    };
    index2 = -1;
    while (++index2 < config.transforms.length) {
      tree = config.transforms[index2](tree) || tree;
    }
    return tree;
  }
  function callListeners(listeners, context, token) {
    let index2 = -1;
    while (++index2 < listeners.length) {
      listeners[index2].call(context, token);
    }
  }
  function prepareList(events, start) {
    const end = events.length - 1;
    let index2 = start - 1;
    let containerBalance = -1;
    let listSpread = false;
    let listItem2;
    let lineIndex;
    let firstBlankLineIndex;
    let atMarker;
    const insertions = [];
    while (++index2 <= end) {
      const event = events[index2];
      switch (event[1].type) {
        case "listUnordered":
        case "listOrdered":
        case "blockQuote": {
          if (event[0] === "enter") {
            containerBalance++;
          } else {
            containerBalance--;
          }
          atMarker = void 0;
          break;
        }
        case "lineEndingBlank": {
          if (event[0] === "enter") {
            if (listItem2 && !atMarker && !containerBalance && !firstBlankLineIndex) {
              firstBlankLineIndex = index2;
            }
            atMarker = void 0;
          }
          break;
        }
        case "linePrefix":
        case "listItemValue":
        case "listItemMarker":
        case "listItemPrefix":
        case "listItemPrefixWhitespace": {
          break;
        }
        default: {
          atMarker = void 0;
        }
      }
      if (!containerBalance && event[0] === "enter" && event[1].type === "listItemPrefix" || containerBalance === -1 && event[0] === "exit" && (event[1].type === "listUnordered" || event[1].type === "listOrdered")) {
        if (listItem2) {
          let tailIndex = index2;
          lineIndex = void 0;
          while (tailIndex--) {
            const tailEvent = events[tailIndex];
            if (tailEvent[1].type === "lineEnding" || tailEvent[1].type === "lineEndingBlank") {
              if (tailEvent[0] === "exit") continue;
              if (lineIndex) {
                events[lineIndex][1].type = "lineEndingBlank";
                listSpread = true;
              }
              tailEvent[1].type = "lineEnding";
              lineIndex = tailIndex;
            } else if (tailEvent[1].type === "linePrefix" || tailEvent[1].type === "blockQuotePrefix" || tailEvent[1].type === "blockQuotePrefixWhitespace" || tailEvent[1].type === "blockQuoteMarker" || tailEvent[1].type === "listItemIndent") {
            } else {
              break;
            }
          }
          if (firstBlankLineIndex && (!lineIndex || firstBlankLineIndex < lineIndex)) {
            listItem2._spread = true;
          }
          listItem2.end = Object.assign({}, lineIndex ? events[lineIndex][1].start : event[1].end);
          insertions.push({
            at: lineIndex || index2,
            event: ["exit", listItem2, event[2]]
          });
        }
        if (event[1].type === "listItemPrefix") {
          const item = {
            type: "listItem",
            _spread: false,
            start: Object.assign({}, event[1].start),
            // @ts-expect-error: we’ll add `end` in a second.
            end: void 0
          };
          listItem2 = item;
          insertions.push({
            at: index2,
            event: ["enter", item, event[2]]
          });
          firstBlankLineIndex = void 0;
          atMarker = true;
        }
      }
    }
    const listEvents = events.splice(start);
    let insertion = 0;
    index2 = -1;
    while (++index2 < listEvents.length) {
      while (insertion < insertions.length && insertions[insertion].at === start + index2) {
        events.push(insertions[insertion++].event);
      }
      events.push(listEvents[index2]);
    }
    events[start][1]._spread = listSpread;
  }
  function opener(create, and) {
    return open;
    function open(token) {
      enter.call(this, create(token), token);
      if (and) and.call(this, token);
    }
  }
  function buffer() {
    this.stack.push({
      type: "fragment",
      children: []
    });
  }
  function enter(node2, token, errorHandler) {
    const parent = this.stack[this.stack.length - 1];
    const siblings = parent.children;
    siblings.push(node2);
    this.stack.push(node2);
    this.tokenStack.push([token, errorHandler || void 0]);
    node2.position = {
      start: point2(token.start),
      // @ts-expect-error: `end` will be patched later.
      end: void 0
    };
  }
  function closer(and) {
    return close;
    function close(token) {
      if (and) and.call(this, token);
      exit2.call(this, token);
    }
  }
  function exit2(token, onExitError) {
    const node2 = this.stack.pop();
    const open = this.tokenStack.pop();
    if (!open) {
      throw new Error("Cannot close `" + token.type + "` (" + stringifyPosition({
        start: token.start,
        end: token.end
      }) + "): it\u2019s not open");
    }
    if (open[0].type !== token.type) {
      if (onExitError) {
        onExitError.call(this, token, open[0]);
      } else {
        const handler = open[1] || defaultOnError;
        handler.call(this, token, open[0]);
      }
    }
    node2.position.end = point2(token.end);
  }
  function resume() {
    return toString(this.stack.pop());
  }
  function onenterlistordered() {
    this.data.expectingFirstListItemValue = true;
  }
  function onenterlistitemvalue(token) {
    if (this.data.expectingFirstListItemValue) {
      const ancestor = this.stack[this.stack.length - 2];
      ancestor.start = Number.parseInt(this.sliceSerialize(token), 10);
      this.data.expectingFirstListItemValue = void 0;
    }
  }
  function onexitcodefencedfenceinfo() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.lang = data2;
  }
  function onexitcodefencedfencemeta() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.meta = data2;
  }
  function onexitcodefencedfence() {
    if (this.data.flowCodeInside) return;
    this.buffer();
    this.data.flowCodeInside = true;
  }
  function onexitcodefenced() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2.replace(/^(\r?\n|\r)|(\r?\n|\r)$/g, "");
    this.data.flowCodeInside = void 0;
  }
  function onexitcodeindented() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2.replace(/(\r?\n|\r)$/g, "");
  }
  function onexitdefinitionlabelstring(token) {
    const label = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.label = label;
    node2.identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase();
  }
  function onexitdefinitiontitlestring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.title = data2;
  }
  function onexitdefinitiondestinationstring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.url = data2;
  }
  function onexitatxheadingsequence(token) {
    const node2 = this.stack[this.stack.length - 1];
    if (!node2.depth) {
      const depth = this.sliceSerialize(token).length;
      node2.depth = depth;
    }
  }
  function onexitsetextheadingtext() {
    this.data.setextHeadingSlurpLineEnding = true;
  }
  function onexitsetextheadinglinesequence(token) {
    const node2 = this.stack[this.stack.length - 1];
    node2.depth = this.sliceSerialize(token).codePointAt(0) === 61 ? 1 : 2;
  }
  function onexitsetextheading() {
    this.data.setextHeadingSlurpLineEnding = void 0;
  }
  function onenterdata(token) {
    const node2 = this.stack[this.stack.length - 1];
    const siblings = node2.children;
    let tail = siblings[siblings.length - 1];
    if (!tail || tail.type !== "text") {
      tail = text3();
      tail.position = {
        start: point2(token.start),
        // @ts-expect-error: we’ll add `end` later.
        end: void 0
      };
      siblings.push(tail);
    }
    this.stack.push(tail);
  }
  function onexitdata(token) {
    const tail = this.stack.pop();
    tail.value += this.sliceSerialize(token);
    tail.position.end = point2(token.end);
  }
  function onexitlineending(token) {
    const context = this.stack[this.stack.length - 1];
    if (this.data.atHardBreak) {
      const tail = context.children[context.children.length - 1];
      tail.position.end = point2(token.end);
      this.data.atHardBreak = void 0;
      return;
    }
    if (!this.data.setextHeadingSlurpLineEnding && config.canContainEols.includes(context.type)) {
      onenterdata.call(this, token);
      onexitdata.call(this, token);
    }
  }
  function onexithardbreak() {
    this.data.atHardBreak = true;
  }
  function onexithtmlflow() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2;
  }
  function onexithtmltext() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2;
  }
  function onexitcodetext() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.value = data2;
  }
  function onexitlink() {
    const node2 = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      const referenceType = this.data.referenceType || "shortcut";
      node2.type += "Reference";
      node2.referenceType = referenceType;
      delete node2.url;
      delete node2.title;
    } else {
      delete node2.identifier;
      delete node2.label;
    }
    this.data.referenceType = void 0;
  }
  function onexitimage() {
    const node2 = this.stack[this.stack.length - 1];
    if (this.data.inReference) {
      const referenceType = this.data.referenceType || "shortcut";
      node2.type += "Reference";
      node2.referenceType = referenceType;
      delete node2.url;
      delete node2.title;
    } else {
      delete node2.identifier;
      delete node2.label;
    }
    this.data.referenceType = void 0;
  }
  function onexitlabeltext(token) {
    const string3 = this.sliceSerialize(token);
    const ancestor = this.stack[this.stack.length - 2];
    ancestor.label = decodeString(string3);
    ancestor.identifier = normalizeIdentifier(string3).toLowerCase();
  }
  function onexitlabel() {
    const fragment = this.stack[this.stack.length - 1];
    const value = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    this.data.inReference = true;
    if (node2.type === "link") {
      const children = fragment.children;
      node2.children = children;
    } else {
      node2.alt = value;
    }
  }
  function onexitresourcedestinationstring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.url = data2;
  }
  function onexitresourcetitlestring() {
    const data2 = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.title = data2;
  }
  function onexitresource() {
    this.data.inReference = void 0;
  }
  function onenterreference() {
    this.data.referenceType = "collapsed";
  }
  function onexitreferencestring(token) {
    const label = this.resume();
    const node2 = this.stack[this.stack.length - 1];
    node2.label = label;
    node2.identifier = normalizeIdentifier(this.sliceSerialize(token)).toLowerCase();
    this.data.referenceType = "full";
  }
  function onexitcharacterreferencemarker(token) {
    this.data.characterReferenceType = token.type;
  }
  function onexitcharacterreferencevalue(token) {
    const data2 = this.sliceSerialize(token);
    const type = this.data.characterReferenceType;
    let value;
    if (type) {
      value = decodeNumericCharacterReference(data2, type === "characterReferenceMarkerNumeric" ? 10 : 16);
      this.data.characterReferenceType = void 0;
    } else {
      const result = decodeNamedCharacterReference(data2);
      value = result;
    }
    const tail = this.stack[this.stack.length - 1];
    tail.value += value;
  }
  function onexitcharacterreference(token) {
    const tail = this.stack.pop();
    tail.position.end = point2(token.end);
  }
  function onexitautolinkprotocol(token) {
    onexitdata.call(this, token);
    const node2 = this.stack[this.stack.length - 1];
    node2.url = this.sliceSerialize(token);
  }
  function onexitautolinkemail(token) {
    onexitdata.call(this, token);
    const node2 = this.stack[this.stack.length - 1];
    node2.url = "mailto:" + this.sliceSerialize(token);
  }
  function blockQuote2() {
    return {
      type: "blockquote",
      children: [],
      position: void 0
    };
  }
  function codeFlow() {
    return {
      type: "code",
      lang: null,
      meta: null,
      value: "",
      position: void 0
    };
  }
  function codeText2() {
    return {
      type: "inlineCode",
      value: "",
      position: void 0
    };
  }
  function definition2() {
    return {
      type: "definition",
      identifier: "",
      label: null,
      title: null,
      url: "",
      position: void 0
    };
  }
  function emphasis() {
    return {
      type: "emphasis",
      children: [],
      position: void 0
    };
  }
  function heading() {
    return {
      type: "heading",
      // @ts-expect-error `depth` will be set later.
      depth: 0,
      children: [],
      position: void 0
    };
  }
  function hardBreak() {
    return {
      type: "break",
      position: void 0
    };
  }
  function html() {
    return {
      type: "html",
      value: "",
      position: void 0
    };
  }
  function image2() {
    return {
      type: "image",
      title: null,
      url: "",
      alt: null,
      position: void 0
    };
  }
  function link3() {
    return {
      type: "link",
      title: null,
      url: "",
      children: [],
      position: void 0
    };
  }
  function list2(token) {
    return {
      type: "list",
      ordered: token.type === "listOrdered",
      start: null,
      spread: token._spread,
      children: [],
      position: void 0
    };
  }
  function listItem(token) {
    return {
      type: "listItem",
      spread: token._spread,
      checked: null,
      children: [],
      position: void 0
    };
  }
  function paragraph() {
    return {
      type: "paragraph",
      children: [],
      position: void 0
    };
  }
  function strong() {
    return {
      type: "strong",
      children: [],
      position: void 0
    };
  }
  function text3() {
    return {
      type: "text",
      value: "",
      position: void 0
    };
  }
  function thematicBreak2() {
    return {
      type: "thematicBreak",
      position: void 0
    };
  }
}
function point2(d) {
  return {
    line: d.line,
    column: d.column,
    offset: d.offset
  };
}
function configure(combined, extensions) {
  let index2 = -1;
  while (++index2 < extensions.length) {
    const value = extensions[index2];
    if (Array.isArray(value)) {
      configure(combined, value);
    } else {
      extension(combined, value);
    }
  }
}
function extension(combined, extension2) {
  let key;
  for (key in extension2) {
    if (own2.call(extension2, key)) {
      switch (key) {
        case "canContainEols": {
          const right = extension2[key];
          if (right) {
            combined[key].push(...right);
          }
          break;
        }
        case "transforms": {
          const right = extension2[key];
          if (right) {
            combined[key].push(...right);
          }
          break;
        }
        case "afterExit":
        case "beforeEnter": {
          const right = extension2[key];
          if (right) {
            combined[key].push(right);
          }
          break;
        }
        case "enter":
        case "exit": {
          const right = extension2[key];
          if (right) {
            Object.assign(combined[key], right);
          }
          break;
        }
      }
    }
  }
}
function defaultOnError(left, right) {
  if (left) {
    throw new Error("Cannot close `" + left.type + "` (" + stringifyPosition({
      start: left.start,
      end: left.end
    }) + "): a different token (`" + right.type + "`, " + stringifyPosition({
      start: right.start,
      end: right.end
    }) + ") is open");
  }
  throw new Error("Cannot close document, a token (`" + right.type + "`, " + stringifyPosition({
    start: right.start,
    end: right.end
  }) + ") is still open");
}

// src/github/core/markdown.ts
function browserUrl(href, base) {
  if (!href.trim()) return null;
  let resolved;
  try {
    resolved = new URL(href.trim(), base);
  } catch {
    return null;
  }
  return resolved.protocol === "http:" || resolved.protocol === "https:" ? resolved.href : null;
}
function githubPath(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.hostname !== "github.com" && url.hostname !== "www.github.com") return null;
  return url.pathname.split("/").filter(Boolean);
}
function ownRepository(url) {
  const own3 = githubPath(url);
  return own3 && own3.length >= 2 ? `${own3[0]}/${own3[1]}` : null;
}
function detailLink(href, base) {
  const target = browserUrl(href, base);
  const repo = ownRepository(base);
  const path = target ? githubPath(target) : null;
  if (!repo || !path || path.length !== 4 || path[2] !== "issues" && path[2] !== "pull" || !/^[1-9]\d*$/.test(path[3]))
    return null;
  if (`${path[0]}/${path[1]}`.toLowerCase() !== repo.toLowerCase()) return null;
  const number = Number(path[3]);
  return Number.isSafeInteger(number) ? { kind: path[2] === "pull" ? "pr" : "issue", repo, number } : null;
}
function markdownSummary(markdown) {
  function text3(node2) {
    if (node2.type === "text" || node2.type === "inlineCode" || node2.type === "code") return node2.value;
    if (node2.type === "image" || node2.type === "imageReference") return node2.alt ?? "";
    if (!("children" in node2)) return "";
    const separator = node2.type === "paragraph" || node2.type === "heading" ? "" : " ";
    return node2.children.map(text3).join(separator);
  }
  const plain = text3(fromMarkdown(markdown)).replace(/\s+/g, " ").trim();
  const characters = [...plain];
  return characters.length > 350 ? `${characters.slice(0, 350).join("")}\u2026` : plain;
}
var link2 = (text3, url) => `[${text3}](<${url.replace(/</g, "%3C").replace(/>/g, "%3E")}>)`;
function readerMarkdown(body, url) {
  return links(body || "_No text._", url);
}
var REFERENCE = /#([1-9]\d*)(?![\w-])/g;
var BEFORE_REFERENCE = /[\s([{"',;:!?*_~]/;
var CHARACTER_REFERENCE = /&(?:[a-z][a-z\d]*|#\d+|#x[\da-f]+);$/i;
function links(markdown, url) {
  const repository = ownRepository(url);
  const references = repository !== null && /#[1-9]/.test(markdown);
  if (!references && !markdown.includes("![") && !/<img/i.test(markdown)) return markdown;
  const definitions = /* @__PURE__ */ new Map();
  const images = [];
  const patches = [];
  function visit(node2, inLink) {
    if (references && !inLink && node2.type === "text") {
      const start = node2.position.start.offset, end = node2.position.end.offset;
      for (const match of markdown.slice(start, end).matchAll(REFERENCE)) {
        const at = start + match.index, before = markdown[at - 1];
        if (before !== void 0 && (!BEFORE_REFERENCE.test(before) || CHARACTER_REFERENCE.test(markdown.slice(Math.max(0, at - 12), at))))
          continue;
        patches.push({
          start: at,
          end: at + match[0].length,
          text: match[0],
          url: `https://github.com/${repository}/issues/${match[1]}`
        });
      }
    }
    if (node2.type === "definition" && !definitions.has(node2.identifier)) definitions.set(node2.identifier, node2.url);
    if (node2.type === "image" || node2.type === "imageReference") images.push(node2);
    if (node2.type === "html") {
      const start = node2.position.start.offset, end = node2.position.end.offset;
      const parser = new Parser(
        {
          onopentag(name, attributes) {
            if (name === "img" && attributes.src !== void 0)
              patches.push({
                start: start + parser.startIndex,
                end: start + parser.endIndex + 1,
                text: "\u{1F5BC} \u56FE\u7247",
                url: attributes.src
              });
          }
        },
        { decodeEntities: true }
      );
      parser.end(markdown.slice(start, end));
    }
    const linked = inLink || node2.type === "link" || node2.type === "linkReference";
    if ("children" in node2) for (const child of node2.children) visit(child, linked);
  }
  visit(fromMarkdown(markdown), false);
  for (const image2 of images) {
    const url2 = image2.type === "image" ? image2.url : definitions.get(image2.identifier);
    if (url2 !== void 0)
      patches.push({ start: image2.position.start.offset, end: image2.position.end.offset, text: "\u{1F5BC} \u56FE\u7247", url: url2 });
  }
  patches.sort((a, b) => a.start - b.start);
  let result = "", copied = 0;
  for (const patch of patches) {
    result += markdown.slice(copied, patch.start) + link2(patch.text, patch.url);
    copied = patch.end;
  }
  return result + markdown.slice(copied);
}

// src/github/core/discussion.ts
var EMOJI = [
  ["+1", "\u{1F44D}"],
  ["-1", "\u{1F44E}"],
  ["laugh", "\u{1F604}"],
  ["hooray", "\u{1F389}"],
  ["confused", "\u{1F615}"],
  ["heart", "\u2764\uFE0F"],
  ["rocket", "\u{1F680}"],
  ["eyes", "\u{1F440}"]
];
var login = (user) => user?.login ?? "deleted user";
function parseReactions(reactions = {}) {
  return EMOJI.flatMap(([key, emoji]) => {
    const count = reactions[key];
    return typeof count === "number" && count > 0 ? [{ emoji, count }] : [];
  });
}
function parseComment(comment, url) {
  const c = comment;
  return {
    id: c.id,
    author: login(c.user),
    createdAt: c.created_at,
    body: c.body ?? "",
    markdown: readerMarkdown(c.body ?? "", url),
    reactions: parseReactions(c.reactions)
  };
}
function parseComments(comments, url) {
  return comments.map((c) => parseComment(c, url)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
}

// src/github/core/labels.ts
function parseLabel(label) {
  return typeof label === "string" ? { name: label, color: null } : {
    name: label.name,
    color: label.color && /^[a-f\d]{6}$/i.test(label.color) ? `#${label.color.toLowerCase()}` : null
  };
}

// src/github/core/activity.ts
function issueTimeline(comments, activities) {
  const items = [
    ...comments.map((comment) => ({ type: "comment", comment })),
    ...activities.map((activity) => ({ type: "activity", activity }))
  ];
  const time = (item) => item.type === "comment" ? item.comment.createdAt : item.activity.createdAt;
  items.sort((a, b) => time(a).localeCompare(time(b)));
  const shown = [];
  for (const item of items) {
    const previous3 = shown.at(-1);
    if (item.type === "activity" && "labels" in item.activity && previous3?.type === "activity" && "labels" in previous3.activity && item.activity.kind === previous3.activity.kind && item.activity.actor === previous3.activity.actor && item.activity.createdAt === previous3.activity.createdAt) {
      shown[shown.length - 1] = {
        type: "activity",
        activity: { ...previous3.activity, labels: [...previous3.activity.labels, ...item.activity.labels] }
      };
    } else shown.push(item);
  }
  return shown;
}
function activityText(activity) {
  if ("labels" in activity) return activity.kind === "labeled" ? "added" : "removed";
  if (activity.kind === "assigned")
    return activity.actor === activity.assignee ? "self-assigned this" : `assigned ${activity.assignee}`;
  return activity.actor === activity.assignee ? "removed their assignment" : `unassigned ${activity.assignee}`;
}
function parseActivity(data) {
  return data.flatMap((event) => {
    const base = { id: event.id, actor: login(event.actor), createdAt: event.created_at };
    if ((event.event === "labeled" || event.event === "unlabeled") && event.label) {
      return [{ ...base, kind: event.event, labels: [parseLabel(event.label)] }];
    }
    if ((event.event === "assigned" || event.event === "unassigned") && event.assignee) {
      return [{ ...base, kind: event.event, assignee: event.assignee.login }];
    }
    return [];
  });
}

// src/github/core/issue-detail.ts
function parseIssueDetail(issue, timeline) {
  const i = issue, events = timeline;
  return {
    number: i.number,
    title: i.title,
    state: i.state,
    author: login(i.user),
    createdAt: i.created_at,
    url: i.html_url,
    labels: i.labels.map(parseLabel),
    assignees: i.assignees.map((a) => a.login),
    milestone: i.milestone?.title ?? null,
    body: i.body ?? "",
    markdown: readerMarkdown(i.body ?? "", i.html_url),
    activities: parseActivity(events),
    comments: parseComments(
      events.filter((e) => e.event === "commented"),
      i.html_url
    )
  };
}

// src/github/core/page.ts
var PAGE = 30;
function appendPage(group, page) {
  const shown = new Set(group.rows.map((r) => r.number));
  return { ...page, rows: [...group.rows, ...page.rows.filter((r) => !shown.has(r.number))] };
}

// src/github/core/issues.ts
function parseIssueChange(data, repo) {
  const i = data;
  return {
    repo,
    state: i.state,
    issue: {
      number: i.number,
      title: i.title,
      assignees: i.assignees.map((a) => a.login),
      updatedAt: i.updated_at,
      url: i.html_url
    }
  };
}
function issueGroupQuery(kind, remote2, login2, after) {
  const assigned = kind === "assigned";
  return {
    query: `query($owner: String!, $name: String!, $after: String${assigned ? ", $assignee: String!" : ""}) {
  repository(owner: $owner, name: $name) {
    hasIssuesEnabled
    issues(first: ${PAGE}, after: $after, states: ${kind === "closed" ? "CLOSED" : "OPEN"}${assigned ? ", filterBy: {assignee: $assignee}" : ""}, orderBy: {field: UPDATED_AT, direction: DESC}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { number title updatedAt url assignees(first: 10) { nodes { login } } }
    }
  }
}`,
    variables: { owner: remote2.owner, name: remote2.repo, after, ...assigned ? { assignee: login2 } : {} }
  };
}
function parseIssueGroup(data) {
  const { hasIssuesEnabled, issues } = data.repository;
  return {
    issuesEnabled: hasIssuesEnabled,
    total: issues.totalCount,
    more: issues.pageInfo.hasNextPage,
    cursor: issues.pageInfo.endCursor,
    rows: issues.nodes.map((n) => ({
      number: n.number,
      title: n.title,
      assignees: n.assignees.nodes.map((a) => a.login),
      updatedAt: n.updatedAt,
      url: n.url
    }))
  };
}
function applyChange(kind, group, change, login2) {
  const belongs = change.state === "closed" ? kind === "closed" : kind === "open" || kind === "assigned" && change.issue.assignees.some((a) => a.toLowerCase() === login2.toLowerCase());
  const others = group.rows.filter((i) => i.number !== change.issue.number);
  const shown = others.length < group.rows.length;
  if (belongs) return { ...group, total: group.total + (shown ? 0 : 1), rows: [change.issue, ...others] };
  return shown ? { ...group, total: group.total - 1, rows: others } : group;
}

// src/github/io/issues.ts
var listChanges = (repo, etag, on) => changes(`repos/${repo}/issues?state=all&sort=updated&per_page=1`, etag, on);
var issueChanges = (repo, number, etag, on) => changes(`repos/${repo}/issues/${number}`, etag, on);
async function issuePage(kind, remote2, login2, on, after) {
  return parseIssueGroup(await graphql(issueGroupQuery(kind, remote2, login2, after), on));
}
async function readIssue(repo, number, on) {
  const path = `repos/${repo}/issues/${number}`;
  const [issue, timeline] = await Promise.all([
    api(path, { on }),
    api(`${path}/timeline?per_page=100`, { on, paginate: true })
  ]);
  return parseIssueDetail(issue, timeline);
}
async function addComment(repo, number, body, on) {
  const comment = await api(`repos/${repo}/issues/${number}/comments`, { on, method: "POST", rawFields: { body } });
  return parseComment(comment, `https://github.com/${repo}/issues/${number}`);
}
async function setIssueState(repo, number, state, on) {
  return parseIssueChange(
    await api(`repos/${repo}/issues/${number}`, { on, method: "PATCH", rawFields: { state } }),
    repo
  );
}

// src/github/core/cache.ts
var Cache = class {
  limit;
  entries = /* @__PURE__ */ new Map();
  constructor(limit) {
    this.limit = limit;
  }
  keys() {
    return [...this.entries.keys()];
  }
  has(key) {
    return this.entries.has(key);
  }
  /** The value, fresh or not; marks it recently used. */
  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return void 0;
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }
  /** Whether it was set less than `maxAge` ms before `now`. */
  fresh(key, maxAge, now) {
    const entry = this.entries.get(key);
    return entry !== void 0 && now - entry.at < maxAge;
  }
  delete(key) {
    this.entries.delete(key);
  }
  clear() {
    this.entries.clear();
  }
  set(key, value, now) {
    this.entries.delete(key);
    this.entries.set(key, { value, at: now });
    while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value);
  }
};

// src/github/core/pulls.ts
function pullState(state, draft) {
  return state === "open" && draft ? "draft" : state;
}
var ROW = "number title url updatedAt isDraft state author { login }";
var ALL_OPEN_QUERY = `query($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequests(first: ${PAGE}, after: $after, states: OPEN, orderBy: {field: UPDATED_AT, direction: DESC}) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes { ${ROW} }
    }
  }
}`;
var SEARCH_QUERY = `query($q: String!, $after: String) {
  search(query: $q, type: ISSUE, first: ${PAGE}, after: $after) {
    issueCount
    pageInfo { hasNextPage endCursor }
    nodes { ... on PullRequest { ${ROW} } }
  }
}`;
function pullSearch(kind, remote2, login2) {
  const who = kind === "review" ? `review-requested:${login2}` : `author:${login2}`;
  return `repo:${remote2.owner}/${remote2.repo} is:pr is:open ${who} sort:updated-desc`;
}
function pullGroupQuery(kind, remote2, login2, after) {
  if (kind === "all") return { query: ALL_OPEN_QUERY, variables: { owner: remote2.owner, name: remote2.repo, after } };
  return { query: SEARCH_QUERY, variables: { q: pullSearch(kind, remote2, login2), after } };
}
function localPullsQuery(remote2, branches) {
  const declarations = branches.map((_, i) => `$branch${i}: String!`).join(", ");
  const fields = branches.map(
    (_, i) => `    branch${i}: pullRequests(first: 100, headRefName: $branch${i}, states: [OPEN, CLOSED, MERGED], orderBy: {field: UPDATED_AT, direction: DESC}) {
      pageInfo { hasNextPage }
      nodes { ${ROW} headRepository { nameWithOwner } }
    }`
  ).join("\n");
  return {
    query: `query($owner: String!, $name: String!, ${declarations}) {
  repository(owner: $owner, name: $name) {
${fields}
  }
}`,
    variables: {
      owner: remote2.owner,
      name: remote2.repo,
      ...Object.fromEntries(branches.map((b, i) => [`branch${i}`, b]))
    }
  };
}
function pullRow(n) {
  return {
    number: n.number,
    title: n.title,
    author: n.author?.login ?? null,
    state: pullState(n.state.toLowerCase(), n.isDraft),
    updatedAt: n.updatedAt,
    url: n.url
  };
}
function parsePullGroup(data) {
  const d = data;
  const [list2, total] = "search" in d ? [d.search, d.search.issueCount] : [d.repository.pullRequests, d.repository.pullRequests.totalCount];
  return {
    total,
    more: list2.pageInfo.hasNextPage,
    cursor: list2.pageInfo.endCursor,
    rows: list2.nodes.map(pullRow)
  };
}
function parseLocalPulls(data, head) {
  const { repository } = data;
  const name = `${head.owner}/${head.repo}`.toLowerCase();
  const rows = /* @__PURE__ */ new Map();
  for (const list2 of Object.values(repository)) {
    const match = list2.nodes.find((n) => n.headRepository?.nameWithOwner.toLowerCase() === name);
    if (match) rows.set(match.number, match);
    else if (list2.pageInfo.hasNextPage)
      throw new Error("Too many pull requests for a local branch to identify its head repository.");
  }
  return [...rows.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(pullRow);
}
function localPage(all2, count) {
  const more = count < all2.length;
  return { total: all2.length, more, cursor: more ? String(count) : null, rows: all2.slice(0, count) };
}

// src/github/io/git.ts
import { exec as exec3 } from "herdr";

// src/github/core/remote.ts
function parseRemoteUrl(url) {
  const m = /^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?([^/:]+)(?::\d+)?[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(url.trim());
  if (!m) return null;
  const [, host, owner, repo] = m;
  return host && owner && repo ? { host: host.toLowerCase(), owner, repo } : null;
}
function pickRemote(remoteV, hosts = ["github.com"]) {
  const found = [];
  for (const line of remoteV.split("\n")) {
    const [remote2, url, kind] = line.trim().split(/\s+/);
    if (!remote2 || !url || kind !== "(fetch)") continue;
    const parsed = parseRemoteUrl(url);
    if (parsed && hosts.includes(parsed.host)) found.push({ remote: remote2, ...parsed });
  }
  for (const name of ["upstream", "github", "origin"]) {
    const hit = found.find((r) => r.remote === name);
    if (hit) return hit;
  }
  return found[0] ?? null;
}

// src/github/io/git.ts
async function githubRemote({ cwd, on }) {
  if (!cwd) return null;
  const r = await exec3("git", ["remote", "-v"], { cwd, on });
  return r.code === 0 ? pickRemote(r.stdout) : null;
}
async function localBranches(remote2, { cwd, on }) {
  if (!cwd) throw new Error("No focused folder for local pull request branches.");
  const result = await exec3("git", ["for-each-ref", "--format=%(refname:short)", "refs/heads"], { cwd, on });
  if (result.code !== 0) throw new Error(result.stderr.trim() || "Could not read local branches.");
  const branches = result.stdout.split("\n").map((b) => b.trim()).filter(Boolean);
  if (branches.length === 0) return { branches, head: remote2 };
  const remotes2 = await exec3("git", ["remote", "-v"], { cwd, on });
  if (remotes2.code !== 0) throw new Error(remotes2.stderr.trim() || "Could not read git remotes.");
  const origin = remotes2.stdout.split("\n").filter((line) => /^origin\s/.test(line)).join("\n");
  const other = remotes2.stdout.split("\n").filter((line) => {
    const url = line.trim().split(/\s+/)[1];
    const repo = url ? parseRemoteUrl(url) : null;
    return repo && `${repo.owner}/${repo.repo}`.toLowerCase() !== `${remote2.owner}/${remote2.repo}`.toLowerCase();
  }).join("\n");
  return { branches, head: pickRemote(origin) ?? pickRemote(other) ?? remote2 };
}

// src/github/core/files.ts
var byPath = (a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
function flatFiles(files, hideViewed = false) {
  return files.filter((f) => !hideViewed || !f.viewed).map((file) => ({ kind: "file", name: file.path, path: file.path, file })).sort(byPath);
}
function fileTree(files, hideViewed = false) {
  const root = [];
  for (const file of files) {
    if (hideViewed && file.viewed) continue;
    const parts = file.path.split("/");
    let children = root;
    let path = "";
    for (const name of parts.slice(0, -1)) {
      path = path ? `${path}/${name}` : name;
      let folder2 = children.find((n) => n.kind === "directory" && n.path === path);
      if (!folder2) {
        folder2 = { kind: "directory", name, path, children: [] };
        children.push(folder2);
      }
      children = folder2.children;
    }
    children.push({ kind: "file", name: parts.at(-1) ?? file.path, path: file.path, file });
  }
  return compact(root);
}
function compact(nodes) {
  return nodes.map((node2) => {
    if (node2.kind === "file") return node2;
    let name = node2.name;
    let folder2 = node2;
    while (folder2.children.length === 1 && folder2.children[0]?.kind === "directory") {
      folder2 = folder2.children[0];
      name += `/${folder2.name}`;
    }
    return { ...folder2, name, children: compact(folder2.children) };
  }).sort((a, b) => a.kind === b.kind ? byPath(a, b) : a.kind === "directory" ? -1 : 1);
}
function parseFiles(data) {
  if (!Array.isArray(data)) throw new Error("GitHub returned an unreadable changed-files list.");
  return data.map((f) => ({
    path: f.filename,
    previousPath: f.previous_filename ?? null,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch ?? null,
    url: f.blob_url,
    viewed: false
  }));
}

// src/github/core/pull-detail.ts
function reviewers(pull, reviews) {
  const byName = /* @__PURE__ */ new Map();
  for (const review of [...reviews].sort(
    (a, b) => (b.submitted_at ?? "").localeCompare(a.submitted_at ?? "") || b.id - a.id
  )) {
    if (review.state === "PENDING" || !review.submitted_at) continue;
    const name = login(review.user);
    const key = name.toLowerCase();
    if (key === pull.user?.login.toLowerCase() || byName.has(key)) continue;
    byName.set(key, { name, state: review.state.toLowerCase(), team: false });
  }
  for (const user of pull.requested_reviewers)
    byName.set(user.login.toLowerCase(), { name: user.login, state: "requested", team: false });
  for (const team of pull.requested_teams)
    byName.set(`team:${team.slug}`, { name: team.slug, state: "requested", team: true });
  return [...byName.values()];
}
function parsePullDetail(pull, issue, comments, reviews) {
  const p = pull;
  const crossOwner = p.head.label.split(":")[0]?.toLowerCase() !== p.base.label.split(":")[0]?.toLowerCase();
  const reactions = issue.reactions;
  return {
    number: p.number,
    title: p.title,
    state: pullState(p.merged ? "merged" : p.state, p.draft),
    author: login(p.user),
    createdAt: p.created_at,
    url: p.html_url,
    head: crossOwner ? p.head.label || p.head.ref : p.head.ref,
    headSha: p.head.sha,
    base: crossOwner ? p.base.label || p.base.ref : p.base.ref,
    labels: p.labels.map(parseLabel),
    assignees: p.assignees.map((a) => a.login),
    milestone: p.milestone?.title ?? null,
    body: p.body ?? "",
    markdown: readerMarkdown(p.body ?? "", p.html_url),
    reactions: parseReactions(reactions),
    reviewers: reviewers(p, reviews),
    comments: parseComments(comments, p.html_url)
  };
}

// src/github/core/pull-timeline.ts
function pullTimeline(comments, events, reviews, inline, url) {
  const result = comments.map((c) => ({
    ...c,
    kind: "comment",
    verb: "commented",
    discussion: []
  }));
  for (const r of reviews) {
    if (!r.submitted_at || r.state === "PENDING") continue;
    const all2 = inline;
    const roots = all2.filter((c) => !c.in_reply_to_id && c.pull_request_review_id === r.id).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
    if (r.state === "COMMENTED" && !r.body?.trim() && roots.length === 0 && all2.some((c) => c.pull_request_review_id === r.id && c.in_reply_to_id))
      continue;
    const discussion = roots.flatMap((root) => [
      root,
      ...all2.filter((c) => c.in_reply_to_id === root.id).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)
    ]).map((c) => ({
      root: c.in_reply_to_id ?? c.id,
      comment: parseComment(c, url),
      path: c.path,
      snippet: c.in_reply_to_id ? "" : c.diff_hunk
    }));
    const verbs = {
      APPROVED: "approved these changes",
      CHANGES_REQUESTED: "requested changes",
      COMMENTED: "reviewed",
      DISMISSED: "review dismissed"
    };
    result.push({
      ...parseComment({ id: r.id, user: r.user, body: r.body, created_at: r.submitted_at }, url),
      kind: "review",
      verb: verbs[r.state] ?? "reviewed",
      discussion
    });
  }
  for (const e of events) {
    let verb = "";
    let body = "";
    let details;
    const activity = parseActivity([e])[0];
    if (activity) {
      verb = activityText(activity);
      body = "labels" in activity ? activity.labels.map((l) => l.name).join(", ") : "";
    } else if (e.event === "committed") {
      verb = "committed";
      const [subject = "", ...lines] = (e.message ?? "").trim().split(/\r?\n/);
      body = `${e.sha?.slice(0, 7) ?? ""} ${subject}`.trim();
      const rest = lines.join("\n").trim();
      if (rest) details = { body: rest, markdown: readerMarkdown(rest, url) };
    } else if (e.event === "head_ref_force_pushed") {
      verb = "force-pushed the branch";
      body = e.commit_id?.slice(0, 7) ?? "";
    } else if (e.event === "merged") {
      verb = "merged this";
      body = e.commit_id?.slice(0, 7) ?? "";
    } else if (e.event === "closed") verb = "closed this";
    else if (e.event === "reopened") verb = "reopened this";
    else continue;
    result.push({
      id: e.id ?? result.length,
      author: e.actor ? login(e.actor) : e.author?.name ?? "deleted user",
      createdAt: e.created_at ?? e.author?.date ?? "",
      body,
      markdown: readerMarkdown(body, url),
      reactions: [],
      kind: "event",
      verb,
      ...details ? { details } : {},
      discussion: []
    });
  }
  return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
}
function parseChecks(pages, statuses) {
  const checks = pages.flatMap((p) => p.check_runs).map((c) => {
    const seconds = c.started_at && c.completed_at ? Math.max(0, Math.floor((Date.parse(c.completed_at) - Date.parse(c.started_at)) / 1e3)) : null;
    return {
      id: `check-${c.id}`,
      name: c.name,
      status: c.conclusion ?? c.status,
      duration: seconds === null ? "\u2014" : `${Math.floor(seconds / 60)}m ${seconds % 60}s`,
      url: c.html_url
    };
  });
  const seen = /* @__PURE__ */ new Set();
  for (const s of statuses) {
    if (seen.has(s.context)) continue;
    seen.add(s.context);
    checks.push({ id: `status-${s.id}`, name: s.context, status: s.state, duration: "\u2014", url: s.target_url ?? "" });
  }
  return checks;
}

// src/github/core/review-threads.ts
function parseThreads(nodes, comments, url, drafts = []) {
  const pending = drafts;
  const draftIds = new Set(pending.map((c) => c.id));
  const all2 = [
    ...comments.filter((c) => !draftIds.has(c.id)),
    ...pending
  ];
  return nodes.map((n) => {
    const root = n.comments.nodes[0]?.databaseId;
    if (!root) throw new Error("GitHub did not return the discussion's first comment.");
    return {
      id: n.id,
      root,
      path: n.path,
      side: n.diffSide,
      line: n.line,
      outdated: n.isOutdated,
      resolved: n.isResolved,
      canResolve: n.viewerCanResolve,
      canUnresolve: n.viewerCanUnresolve,
      comments: parseComments(
        all2.filter((c) => c.id === root || c.in_reply_to_id === root),
        url
      ).map((c) => draftIds.has(c.id) ? { ...c, draft: true } : c)
    };
  });
}
function mergeDraftThreads(remote2, drafts) {
  const result = [...remote2];
  for (const draft of drafts) {
    const index2 = result.findIndex((t) => t.root === draft.root);
    const thread = result[index2];
    if (!thread) result.push(draft);
    else
      result[index2] = {
        ...thread,
        comments: [...thread.comments, ...draft.comments.filter((c) => !thread.comments.some((r) => r.id === c.id))]
      };
  }
  return result;
}
function threadRow(rows, thread) {
  if (thread.outdated || thread.line === null) return null;
  const index2 = rows.findIndex((r) => (thread.side === "LEFT" ? r.oldLine : r.newLine) === thread.line);
  return index2 < 0 ? null : index2;
}

// src/github/io/pulls.ts
async function pullPage(kind, remote2, login2, on, after) {
  return parsePullGroup(await graphql(pullGroupQuery(kind, remote2, login2, after), on));
}
async function readPull(repo, number, on) {
  const [pull, issue, comments, reviews] = await Promise.all([
    api(`repos/${repo}/pulls/${number}`, { on }),
    // Description reactions live on the issue resource, not the REST pull request resource.
    api(`repos/${repo}/issues/${number}`, { on }),
    api(`repos/${repo}/issues/${number}/comments?per_page=100`, { on, paginate: true }),
    api(`repos/${repo}/pulls/${number}/reviews?per_page=100`, { on, paginate: true })
  ]);
  const detail = parsePullDetail(pull, issue, comments, reviews);
  const sha = pull.head.sha;
  const [events, inline, checks, statuses] = await Promise.all([
    api(`repos/${repo}/issues/${number}/timeline?per_page=100`, { on, paginate: true }),
    api(`repos/${repo}/pulls/${number}/comments?per_page=100`, { on, paginate: true }),
    api(`repos/${repo}/commits/${sha}/check-runs?per_page=100`, { on, paginate: true }),
    api(`repos/${repo}/commits/${sha}/statuses?per_page=100`, { on, paginate: true })
  ]);
  detail.timeline = pullTimeline(
    detail.comments,
    events,
    reviews,
    inline,
    detail.url
  );
  detail.checks = parseChecks(Array.isArray(checks) ? checks : [checks], statuses);
  return detail;
}
async function readPullFiles(repo, number, on) {
  const files = parseFiles(await api(`repos/${repo}/pulls/${number}/files?per_page=100`, { on, paginate: true }));
  const { viewed } = await readPullViewed(repo, number, on);
  const paths = new Set(viewed);
  return files.map((file) => ({ ...file, viewed: paths.has(file.path) }));
}
async function readPullViewed(repo, number, on) {
  const [owner, name] = repo.split("/");
  const viewed = [];
  let after = null;
  let id = "";
  for (; ; ) {
    const data = await graphql(
      {
        query: "query($owner:String!,$repo:String!,$number:Int!,$after:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){id files(first:100,after:$after){nodes{path viewerViewedState} pageInfo{hasNextPage endCursor}}}}}",
        variables: { owner: owner ?? "", repo: name ?? "", number, after }
      },
      on
    );
    const pull = data?.repository?.pullRequest;
    if (!pull) throw new Error("GitHub did not return the pull request's viewed-file states.");
    id = pull.id;
    viewed.push(...pull.files.nodes.filter((f) => f.viewerViewedState === "VIEWED").map((f) => f.path));
    if (!pull.files.pageInfo.hasNextPage) return { id, viewed };
    const next = pull.files.pageInfo.endCursor;
    if (!next || next === after) throw new Error("GitHub did not return the next viewed-files page.");
    after = next;
  }
}
async function setPullFileViewed(repo, number, path, viewed, on) {
  const [owner, name] = repo.split("/");
  const data = await graphql(
    {
      query: "query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){id}}}",
      variables: { owner, repo: name, number }
    },
    on
  );
  const id = data?.repository?.pullRequest?.id;
  if (!id) throw new Error("GitHub did not return the pull request's ID.");
  const operation = viewed ? "markFileAsViewed" : "unmarkFileAsViewed";
  try {
    await graphql(
      {
        query: `mutation($id:ID!,$path:String!){${operation}(input:{pullRequestId:$id,path:$path}){pullRequest{id}}}`,
        variables: { id, path }
      },
      on
    );
  } catch (e) {
    if (e instanceof GhError && e.transient) announce({ repo, number, files: { on } });
    throw e;
  }
  announce({ repo, number, files: { on } });
}
async function addPullComment(repo, number, target, body, on) {
  let raw;
  try {
    raw = await api(`repos/${repo}/pulls/${number}/comments`, {
      on,
      method: "POST",
      fields: { line: target.line },
      rawFields: { body, commit_id: target.commit, path: target.path, side: target.side }
    });
  } catch (e) {
    if (e instanceof GhError && e.transient) announce({ repo, number, threads: { on } });
    throw e;
  }
  const comment = parseComment(raw, `https://github.com/${repo}/pull/${number}`);
  announce({ repo, number, threads: { on } });
  return comment;
}
async function replyPullThread(repo, number, root, body, on) {
  const raw = await api(`repos/${repo}/pulls/${number}/comments/${root}/replies`, {
    on,
    method: "POST",
    rawFields: { body }
  });
  const comment = parseComment(raw, `https://github.com/${repo}/pull/${number}`);
  announce({ repo, number, threads: { on } });
  return comment;
}
async function resolvePullThread(repo, number, id, resolved, on) {
  const op = resolved ? "resolveReviewThread" : "unresolveReviewThread";
  const data = await graphql(
    {
      query: `mutation($id:ID!){${op}(input:{threadId:$id}){thread{id isResolved viewerCanResolve viewerCanUnresolve}}}`,
      variables: { id }
    },
    on
  );
  const thread = data?.[op]?.thread;
  if (!thread || thread.id !== id) throw new Error("GitHub did not return the updated discussion.");
  announce({ repo, number, threads: { on } });
  return { resolved: thread.isResolved, canResolve: thread.viewerCanResolve, canUnresolve: thread.viewerCanUnresolve };
}
async function readPullThreads(repo, number, on, pending = null) {
  const drafts = pending === null ? [] : await api(`repos/${repo}/pulls/${number}/reviews/${pending}/comments?per_page=100`, { on, paginate: true });
  const comments = await api(`repos/${repo}/pulls/${number}/comments?per_page=100`, { on, paginate: true });
  const [owner, name] = repo.split("/");
  const nodes = [];
  let after = null;
  for (; ; ) {
    const data = await graphql(
      {
        query: "query($owner:String!,$repo:String!,$number:Int!,$after:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100,after:$after){nodes{id path diffSide line isOutdated isResolved viewerCanResolve viewerCanUnresolve comments(first:1){nodes{databaseId}}} pageInfo{hasNextPage endCursor}}}}}",
        variables: { owner: owner ?? "", repo: name ?? "", number, after }
      },
      on
    );
    const page = data?.repository?.pullRequest?.reviewThreads;
    if (!page) throw new Error("GitHub did not return the pull request's discussions.");
    nodes.push(...page.nodes);
    if (!page.pageInfo.hasNextPage)
      return parseThreads(
        nodes,
        comments,
        `https://github.com/${repo}/pull/${number}`,
        drafts
      );
    const next = page.pageInfo.endCursor;
    if (!next || next === after) throw new Error("GitHub did not return the next discussions page.");
    after = next;
  }
}
async function localPulls(remote2, { branches, head }, on) {
  if (branches.length === 0) return [];
  return parseLocalPulls(await graphql(localPullsQuery(remote2, branches), on), head);
}

// src/github/io/known.ts
function facts(limit, fresh, keep) {
  const cache = new Cache(limit), asking = /* @__PURE__ */ new Map();
  return {
    peek: (key) => cache.get(key),
    /** The kept answer when fresh (unless forced), else the ask already out (unless forced), else a new ask. */
    look(key, force, ask) {
      if (!force && cache.fresh(key, fresh, Date.now())) return Promise.resolve(cache.get(key));
      const pending = asking.get(key);
      if (pending && !force) return pending;
      const p = ask().then((value) => {
        if (asking.get(key) === p && keep(value)) cache.set(key, value, Date.now());
        return value;
      }).finally(() => {
        if (asking.get(key) === p) asking.delete(key);
      });
      asking.set(key, p);
      return p;
    },
    /** Keeps `value` as the answer now (a page loaded by other means: Load more). */
    put(key, value) {
      cache.set(key, value, Date.now());
    },
    /** Shows what `change` returns for a kept key until asked again (undefined: untouched); an answer still out is dropped. */
    patch(change) {
      for (const key of cache.keys()) {
        const changed = change(key, cache.get(key));
        if (changed === void 0) continue;
        cache.set(key, changed, -Infinity);
        asking.delete(key);
      }
    },
    clear() {
      cache.clear();
      asking.clear();
    }
  };
}
var accounts = facts(16, 60 * 6e4, (a) => a.status.ok);
var remotes = facts(64, 5 * 6e4, (r) => r !== null);
var folderKey = ({ on, cwd }) => JSON.stringify([on, cwd]);
var account2 = (on, force = false) => accounts.look(JSON.stringify(on), force && !accounts.peek(JSON.stringify(on)), () => account(on));
var peekAccount = (on) => accounts.peek(JSON.stringify(on));
var remote = (folder2, force = false) => remotes.look(folderKey(folder2), force, () => githubRemote(folder2));
var peekRemote = (folder2) => remotes.peek(folderKey(folder2));
var groupKey = (kind, r) => JSON.stringify([kind, r.on, r.remote.host, r.remote.owner, r.remote.repo, r.login]);
var groupOf = (key) => {
  const [kind, , host, owner, repo, login2] = JSON.parse(key);
  return { kind: kind ?? "", repo: `${host}/${owner}/${repo}`.toLowerCase(), login: login2 ?? "" };
};
function pagedGroups(ask) {
  const kept = facts(64, 6e4, () => true);
  return {
    kept,
    look: (kind, r, force = false) => kept.look(groupKey(kind, r), force, () => ask(kind, r, null)),
    peek: (kind, r) => kept.peek(groupKey(kind, r)),
    async more(kind, r, loaded) {
      const key = groupKey(kind, r);
      const both = appendPage(loaded, await ask(kind, r, loaded.cursor));
      if (kept.peek(key) === loaded) kept.put(key, both);
      return both;
    }
  };
}
var issueGroups = pagedGroups(
  (kind, r, after) => issuePage(kind, r.remote, r.login, r.on, after)
);
var pullGroups = pagedGroups(
  (kind, r, after) => pullPage(kind, r.remote, r.login, r.on, after)
);
var issueGroup = issueGroups.look;
var peekIssueGroup = issueGroups.peek;
var moreIssues = issueGroups.more;
function issueChanged(change) {
  const repo = `github.com/${change.repo}`.toLowerCase();
  issueGroups.kept.patch((key, group) => {
    const g = groupOf(key);
    return g.repo === repo ? applyChange(g.kind, group, change, g.login) : void 0;
  });
}
var localMatches = facts(64, 0, () => true);
var localShown = /* @__PURE__ */ new WeakMap();
var localKey = (r) => JSON.stringify([groupKey("local", r), r.cwd]);
function showLocal(rows, count) {
  const page = localPage(rows, count);
  localShown.set(rows, page);
  return page;
}
async function localGroup(r, force) {
  const key = localKey(r);
  const { rows } = await localMatches.look(key, force, async () => {
    const snapshot = await localBranches(r.remote, r);
    const signature = JSON.stringify(snapshot);
    const kept = localMatches.peek(key);
    if (!force && kept?.signature === signature) return kept;
    return { signature, rows: await localPulls(r.remote, snapshot, r.on) };
  });
  return localShown.get(rows) ?? showLocal(rows, PAGE);
}
function pullReviewed(repo, on) {
  const matches = (key) => {
    const parts = JSON.parse(key);
    return parts[1] === on && groupOf(key).repo === `github.com/${repo}`.toLowerCase();
  };
  pullGroups.kept.patch((key, group) => matches(key) ? group : void 0);
  localMatches.patch(
    (key, value) => matches(JSON.parse(key)[0] ?? "") ? { ...value, signature: "" } : void 0
  );
}
var pullGroup = (kind, r, force = false) => kind === "local" ? localGroup(r, force) : pullGroups.look(kind, r, force);
function peekPullGroup(kind, r) {
  if (kind !== "local") return pullGroups.peek(kind, r);
  const rows = localMatches.peek(localKey(r))?.rows;
  return rows && localShown.get(rows);
}
async function morePulls(kind, r, loaded) {
  if (kind !== "local") return pullGroups.more(kind, r, loaded);
  const rows = localMatches.peek(localKey(r))?.rows;
  return rows && localShown.get(rows) === loaded ? showLocal(rows, loaded.rows.length + PAGE) : loaded;
}

// src/github/views/issues.ts
import { div as div6 } from "gpui-kit";

// src/github/core/time.ts
var MINUTE = 6e4;
var HOUR = 60 * MINUTE;
var DAY = 24 * HOUR;
function relativeTime(iso, now) {
  const ago2 = now - Date.parse(iso);
  if (ago2 < MINUTE) return "now";
  if (ago2 < HOUR) return `${Math.floor(ago2 / MINUTE)}m`;
  if (ago2 < DAY) return `${Math.floor(ago2 / HOUR)}h`;
  if (ago2 < 30 * DAY) return `${Math.floor(ago2 / DAY)}d`;
  if (ago2 < 365 * DAY) return `${Math.floor(ago2 / (30 * DAY))}mo`;
  return `${Math.floor(ago2 / (365 * DAY))}y`;
}

// src/github/views/groups.ts
import { h_flex as h_flex4, v_flex as v_flex3 } from "gpui-base";
import { div as div5 } from "gpui-kit";

// src/github/core/preview.ts
var PREVIEW_DWELL_MS = 200;
var PREVIEW_OPEN_MS = 500;
var PREVIEW_CLOSE_MS = 200;
function previewKey(ref, on, login2) {
  return JSON.stringify([on, login2, detailKey(ref)]);
}
var PreviewIntent = class {
  active = null;
  enter(row) {
    this.active = { row };
    return this.active;
  }
  leave(row) {
    if (this.active?.row !== row) return false;
    this.active = null;
    return true;
  }
  current(ticket) {
    return this.active === ticket;
  }
};
function parsePreview(data, kind) {
  const item = data;
  const state = kind === "pr" ? pullState(item.merged_at ? "merged" : item.state, item.draft ?? false) : item.state;
  return {
    title: item.title,
    author: item.user?.login ?? null,
    createdAt: item.created_at,
    state,
    summary: markdownSummary(item.body ?? ""),
    labels: item.labels.map(parseLabel)
  };
}

// src/github/views/preview.ts
import { HoverCard, h_flex as h_flex3, v_flex as v_flex2 } from "gpui-base";
import { div as div4, svg as svg4 } from "gpui-kit";

// src/github/io/preview.ts
var Previews = class {
  cache = new Cache(100);
  pending = /* @__PURE__ */ new Map();
  peek(ref, on, login2) {
    return this.cache.get(previewKey(ref, on, login2));
  }
  load(ref, on, login2) {
    const key = previewKey(ref, on, login2);
    if (this.cache.fresh(key, 6e4, Date.now())) return Promise.resolve(this.cache.get(key));
    const pending = this.pending.get(key);
    if (pending) return pending;
    const path = `repos/${ref.repo}/${ref.kind === "pr" ? "pulls" : "issues"}/${ref.number}`;
    const request = api(path, { on }).then((data) => {
      const preview = parsePreview(data, ref.kind);
      this.cache.set(key, preview, Date.now());
      return preview;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }
};

// src/github/views/detail.ts
import { h_flex as h_flex2, TextView, v_flex } from "gpui-base";
import { div as div3, svg as svg3 } from "gpui-kit";
var NOUN = { issue: "issue", pr: "pull request" };
var Noun = (kind) => NOUN[kind].charAt(0).toUpperCase() + NOUN[kind].slice(1);
function openLink(cx, host, url, page) {
  const ref = detailLink(url, page);
  if (ref) host.follow(cx, ref);
  else {
    const external = browserUrl(url, page);
    if (external) cx.open_url(external);
  }
}
function detailEmpty(_kind) {
  return div3().flex_1();
}
function detailHeader(host, ref, shown, refresh) {
  const t = colors();
  const url = shown.url ?? detailUrl(ref);
  const previous3 = host.previous();
  const number = link(`${ref.kind}-browser`, url, `#${ref.number}`).px(2).rounded(4).text_color(t.accent).hover((s) => s.bg(t.hover)).tooltip(`Open ${ref.repo} #${ref.number} in browser`).accessibility_label(`Open #${ref.number} in browser`);
  const copy = button(
    `${ref.kind}-copy`,
    svg3("mods/github/assets/copy.svg").size(16),
    `Copy ${NOUN[ref.kind]} link`,
    (_e, cx) => cx.write_to_clipboard(url)
  );
  return h_flex2().flex_none().px(24).pt(18).pb(12).gap(12).items_start().when(
    previous3 !== null,
    (el) => el.child(
      square(button(`${ref.kind}-back`, "\u2190", `Back to #${previous3?.number}`, (_e, cx) => host.back(cx))).text_size(
        22
      )
    )
  ).child(
    h_flex2().flex_1().min_w(0).gap(8).items_center().flex_wrap().text_size(22).child(
      div3().min_w(0).font_semibold().child(shown.title ?? `${Noun(ref.kind)} details`)
    ).child(h_flex2().gap(2).items_center().flex_none().child(number).child(copy))
  ).child(
    shown.loading ? square(div3()).child(spinner(18)) : square(
      button(`${ref.kind}-refresh`, "\u21BB", `Refresh ${NOUN[ref.kind]}`, (_e, cx) => {
        refresh(cx);
        cx.notify();
      })
    ).text_size(22)
  );
}
function detailBody(ref, loading, failure, document3) {
  const t = colors();
  return v_flex().id(`${ref.kind}-scroll-${detailKey(ref)}`).flex_1().min_h(0).overflow_y_scroll().px(24).pb(18).gap(12).when(loading, (el) => el.child(div3().text_size(12).text_color(t.dim).child(`Loading ${NOUN[ref.kind]}\u2026`))).when(
    failure !== void 0,
    (el) => el.child(
      div3().text_color(t.blocked).child(failure ?? "")
    )
  ).when(document3 !== null, (el) => el.child(document3 ?? div3()));
}
var DetailMetadata = class {
  expanded = false;
  render(layout2, sections) {
    const t = colors();
    const wide = layout2 === "wide";
    const fields = () => sections.map(
      ([title, value]) => v_flex().min_w(0).gap(10).py(16).border_b(1).border_color(t.border).when(layout2 === "narrow", (el) => el.w(180).min_w(140).flex_grow(1)).when(layout2 === "compact", (el) => el.w_full().flex_none()).child(div3().text_size(13).font_semibold().child(title)).child(value)
    );
    if (wide) return v_flex().w(220).flex_none().children(fields());
    const labels2 = sections.find(([title]) => title === "Labels");
    const summary = () => h_flex2().min_w(0).gap(10).py(16).items_center().flex_wrap().child(div3().text_size(13).font_semibold().child("Labels")).child(layout2 === "compact" ? quiet(String(labels2?.[2] ?? 0)) : labels2?.[1] ?? quiet("None yet"));
    let content3;
    if (!this.expanded) content3 = summary();
    else if (layout2 === "compact") content3 = v_flex().children(fields());
    else content3 = h_flex2().gap(20).items_start().flex_wrap().children(fields());
    const label = this.expanded ? "See less" : "See more";
    return v_flex().min_w(0).gap(12).pb(16).border_b(1).border_color(t.border).child(content3).child(
      h_flex2().child(
        button("detail-metadata-toggle", label, label, (_e, cx) => {
          this.expanded = !this.expanded;
          cx.notify();
        }).text_color(t.accent)
      )
    );
  }
};
function detailDocument(layout2, heading, timeline, sections, metadata) {
  const wide = layout2 === "wide";
  const posts = v_flex().min_w(0).gap(20).when(wide, (el) => el.flex_1()).when(!wide, (el) => el.w_full().flex_none()).children(timeline);
  const side = metadata.render(layout2, sections);
  return v_flex().gap(18).child(h_flex2().gap(10).pb(4).items_center().flex_wrap().children(heading)).child(wide ? h_flex2().gap(24).items_start().child(posts).child(side) : v_flex().gap(20).child(side).child(posts));
}
function stateBadge(label, color, icon2) {
  return h_flex2().gap(6).items_center().px(10).py(4).rounded(14).bg(`${color}26`).text_size(13).font_semibold().text_color(color).when(icon2 !== void 0, (el) => el.child(svg3(icon2 ?? "").size(14))).child(label);
}
function postCard(id, post, verb, onLink, options = {}) {
  const t = colors();
  const reactions = post.reactions ?? [];
  const heading = h_flex2().px(16).pt(10).pb(options.embedded ? 4 : 10).gap(8).items_center().flex_wrap().when(!options.embedded, (el) => el.bg(t.raised).border_b(1).border_color(t.border)).text_size(12).child(div3().font_semibold().child(post.author)).child(div3().text_color(t.dim).child(verb)).child(div3().flex_1()).child(div3().text_color(t.dim).tooltip(post.createdAt).child(relativeTime(post.createdAt, Date.now())));
  const text3 = TextView.markdown(id, post.markdown).selectable(true).scrollable(false).on_link_click(onLink);
  return v_flex().id(`${id}-card`).min_w(0).w_full().overflow_hidden().when(!options.embedded, (el) => el.rounded(8).border_1().border_color(t.border).bg(t.background)).child(heading).when(
    !options.headingOnly,
    (el) => el.child(
      v_flex().min_w(0).px(16).pt(options.embedded ? 4 : 16).pb(options.embedded ? 12 : 16).gap(12).child(text3).when(
        reactions.length > 0,
        (el2) => el2.child(
          h_flex2().gap(6).flex_wrap().children(reactions.map((r) => chip(`${r.emoji} ${r.count}`, t.border, t.raised)))
        )
      )
    )
  );
}
var quiet = (text3) => div3().text_size(12).text_color(colors().dim).child(text3);
function people(logins, none) {
  if (logins.length === 0) return quiet(none);
  return v_flex().gap(8).children(logins.map((login2) => div3().text_size(13).font_medium().child(login2)));
}
function labelChip(label) {
  const t = colors();
  return chip(label.name, label.color ?? t.input, label.color ? `${label.color}26` : t.raised).text_color(t.foreground);
}
function labels(list2) {
  if (list2.length === 0) return quiet("None yet");
  return h_flex2().gap(6).flex_wrap().children(list2.map(labelChip));
}
var milestone = (title) => title ? div3().text_size(13).child(title) : quiet("No milestone");
function projects(list2, loading) {
  const t = colors();
  if (!list2) return quiet(loading ? "Loading Projects\u2026" : "Projects not loaded.");
  if (!list2.ok) return quiet("None yet").tooltip(list2.message);
  if (list2.projects.length === 0) return quiet("None yet");
  return v_flex().gap(8).children(
    list2.projects.map(
      (project) => link(`project-${project.url}`, project.url, project.title).text_size(13).text_color(t.accent).tooltip(project.url)
    )
  );
}

// src/github/views/preview.ts
function previewCard(ref, preview, failure) {
  const t = colors();
  const state = preview ? PULL_STATES[preview.state] : null;
  const icon2 = state && (ref.kind === "pr" ? svg4(state.icon).size(14).text_color(state.color(t)) : div4().text_color(state.color(t)).child(preview?.state === "closed" ? "\u2299" : "\u25CB"));
  return v_flex2().w(480).p(14).gap(10).rounded(8).border_1().border_color(t.border).bg(t.surface).text_color(t.foreground).text_size(13).on_mouse_down("left", stop).child(
    h_flex3().gap(8).items_center().child(div4().min_w(0).flex_1().truncate().text_color(t.accent).child(ref.repo)).when(
      Boolean(preview),
      (el) => el.child(
        div4().flex_none().text_color(t.dim).child(preview?.createdAt.slice(0, 10) ?? "")
      )
    )
  ).when(
    Boolean(preview),
    (el) => el.child(
      h_flex3().gap(8).items_start().child(
        div4().flex_none().accessibility_label(state?.label ?? "").children(icon2 ? [icon2] : [])
      ).child(
        div4().flex_1().min_w(0).max_h(64).overflow_hidden().font_semibold().child(`${preview?.title} #${ref.number}`)
      )
    ).child(
      div4().text_size(12).text_color(t.dim).child(`${state?.label} \xB7 ${preview?.author ? `@${preview.author}` : "ghost"}`)
    ).child(
      div4().max_h(120).overflow_hidden().child(preview?.summary || "No description provided.")
    ).when(
      Boolean(preview?.labels.length),
      (el2) => el2.child(div4().max_h(64).overflow_hidden().child(labels(preview.labels)))
    )
  ).when(
    !preview,
    (el) => el.child(
      failure ? div4().text_color(t.blocked).child(`Preview unavailable: ${failure}`) : h_flex3().gap(8).items_center().child(spinner()).child("Loading preview\u2026")
    )
  );
}
var RowPreviews = class {
  previews = new Previews();
  timer = null;
  failures = new Cache(100);
  intent = new PreviewIntent();
  hover(cx, row, ref, r, current) {
    if (!ref && !this.intent.leave(row)) return;
    this.timer?.cancel();
    this.timer = null;
    if (!ref || !r) return;
    const ticket = this.intent.enter(row);
    const key = previewKey(ref, r.on, r.login);
    this.failures.delete(key);
    this.timer = cx.timer.after(PREVIEW_DWELL_MS, (cx2) => {
      if (!this.intent.current(ticket) || !current()) return;
      cx2.spawn(async (cx3) => {
        try {
          await this.previews.load(ref, r.on, r.login);
        } catch (e) {
          this.failures.set(key, failureOf(e).message, Date.now());
        }
        cx3.notify();
      });
    });
  }
  wrap(id, trigger, ref, r) {
    const preview = this.previews.peek(ref, r.on, r.login);
    const key = previewKey(ref, r.on, r.login);
    const failure = this.failures.get(key);
    return HoverCard.new(`preview-${id}-${key}`).w_full().open_delay(PREVIEW_OPEN_MS).close_delay(PREVIEW_CLOSE_MS).trigger(trigger).content(previewCard(ref, preview, failure));
  }
};

// src/github/views/groups.ts
var GroupList = class {
  /** The row under the pointer ("<kind>#<number>"): it shows its actions. */
  hovered = null;
  groups;
  host;
  source;
  previews = new RowPreviews();
  constructor(host, source) {
    this.host = host;
    this.source = source;
    this.groups = Object.fromEntries(
      source.groups.map(({ kind }) => [
        kind,
        {
          expanded: source.expanded.includes(kind),
          page: void 0,
          loading: false,
          loadingMore: false,
          failure: void 0
        }
      ])
    );
  }
  all() {
    return this.source.groups.map(({ kind }) => this.groups[kind]);
  }
  get busy() {
    return this.all().some((g) => g.loading || g.loadingMore);
  }
  /** A failure every group shares (the repository isn't there or can't be seen): the tab says it once. */
  get notFound() {
    return this.all().map((g) => g.failure).find((f) => f?.notFound);
  }
  /** A loaded page of any group (what the tab's notice may depend on). */
  get anyPage() {
    return this.all().map((g) => g.page).find((p) => p !== void 0);
  }
  /** Shows what is kept for this place at once (another place: nothing yet). */
  show() {
    for (const { kind } of this.source.groups) this.reset(kind);
  }
  reset(kind) {
    const g = this.groups[kind], r = this.host.ready();
    g.page = r ? this.source.peek(kind, r) : void 0;
    g.failure = void 0;
    g.loading = g.loadingMore = false;
  }
  /** Asks for every expanded group's first page (fresh kept pages are reused unless `force`). */
  load(cx, force = false, kinds) {
    for (const { kind } of this.source.groups) {
      if (!kinds || kinds.includes(kind)) this.loadGroup(cx, kind, force);
    }
  }
  loadGroup(cx, kind, force) {
    const g = this.groups[kind], r = this.host.ready(), run3 = this.host.run();
    if (!r || !g.expanded || !this.host.asking()) return;
    g.loading = true;
    g.failure = void 0;
    cx.spawn(async (cx2) => {
      try {
        const page = await this.source.ask(kind, r, force);
        if (run3 === this.host.run()) g.page = this.source.peek(kind, r) ?? page;
      } catch (e) {
        if (run3 === this.host.run()) {
          g.failure = failureOf(e);
          this.source.failed?.();
        }
      } finally {
        if (run3 === this.host.run()) {
          g.loading = false;
          cx2.notify();
        }
      }
    });
  }
  /** Unfolding shows what is kept and asks for what is stale. */
  toggle(cx, kind) {
    const g = this.groups[kind];
    g.expanded = !g.expanded;
    if (g.expanded) {
      this.reset(kind);
      this.loadGroup(cx, kind, false);
    }
    cx.notify();
  }
  more(cx, kind) {
    const g = this.groups[kind], r = this.host.ready(), run3 = this.host.run(), loaded = g.page;
    if (!r || !loaded?.more || g.loadingMore) return;
    g.loadingMore = true;
    cx.notify();
    cx.spawn(async (cx2) => {
      try {
        const page = await this.source.more(kind, r, loaded);
        if (run3 === this.host.run()) g.page = page;
      } catch (e) {
        if (run3 === this.host.run()) g.failure = failureOf(e);
      } finally {
        if (run3 === this.host.run()) {
          g.loadingMore = false;
          cx2.notify();
        }
      }
    });
  }
  render(cx) {
    return this.source.groups.map((spec) => this.group(spec, cx));
  }
  /** A foldable group: its title and count, then (unfolded) why it failed, its rows and Load more. */
  group({ kind, title, empty }, cx) {
    const t = colors();
    const id = this.source.kind;
    const g = this.groups[kind];
    const page = g.page;
    const rows = page?.rows ?? [];
    const heading = h_flex4().id(`${id}-group-${kind}`).h(26).px(8).gap(6).items_center().rounded(6).text_size(12).text_color(t.dim).cursor_pointer().hover((s) => s.bg(t.hover)).on_mouse_down("left", stop).on_click((_e, cx2) => this.toggle(cx2, kind)).accessibility_label(`${g.expanded ? "Fold" : "Unfold"} ${title}`).child(
      div5().w(10).flex_none().child(g.expanded ? "\u25BE" : "\u25B8")
    ).child(div5().font_medium().child(title)).child(div5().child(page ? String(page.total) : "")).when(g.expanded && g.loading, (el) => el.child(spinner()));
    const failure = h_flex4().px(8).pl(22).py(2).gap(6).items_center().text_size(12).child(div5().flex_none().size(6).rounded(3).bg(t.blocked)).child(
      div5().flex_1().min_w(0).text_color(t.dim).child(g.failure?.message ?? "")
    ).when(
      !g.loading,
      (el) => el.child(
        button(`${id}-retry-${kind}`, "Retry", `Load ${title} again`, (_e, cx2) => {
          this.loadGroup(cx2, kind, true);
          cx2.notify();
        })
      )
    );
    const more = h_flex4().id(`${id}-more-${kind}`).h(26).px(8).pl(22).gap(6).items_center().rounded(6).text_size(12).text_color(t.dim).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground)).on_mouse_down("left", stop).on_click((_e, cx2) => this.more(cx2, kind)).child(g.loadingMore ? "Loading\u2026" : `Load more (${(page?.total ?? 0) - rows.length} left)`).when(g.loadingMore, (el) => el.child(spinner()));
    return v_flex3().gap(1).child(heading).when(
      g.expanded,
      (el) => el.when(g.failure !== void 0 && !g.failure.notFound, (el2) => el2.child(failure)).when(
        page !== void 0 && rows.length === 0,
        (el2) => el2.child(div5().px(8).pl(22).py(4).text_size(12).text_color(t.dim).child(empty))
      ).children(rows.map((row) => this.row(kind, row, cx))).when(Boolean(page?.more), (el2) => el2.child(more))
    );
  }
  /** A row's frame: click opens it; the pointer over it swaps its end for Copy and Open in browser. */
  row(kind, row, cx) {
    const t = colors();
    const id = this.source.kind;
    const key = `${kind}#${row.number}`;
    const ready = this.host.ready();
    const ref = ready ? { kind: id, repo: `${ready.remote.owner}/${ready.remote.repo}`, number: row.number } : null;
    const contextKey = ready && ref ? previewKey(ref, ready.on, ready.login) : null;
    const actions = [
      button(
        `${id}-copy-${kind}-${row.number}`,
        "#",
        `Copy #${row.number}`,
        (_e, cx2) => cx2.write_to_clipboard(`#${row.number}`)
      ),
      button(`${id}-open-${kind}-${row.number}`, "\u2197", "Open in browser", (_e, cx2) => cx2.open_url(row.url))
    ];
    const disclosure = this.source.disclosure?.(row, key);
    const frame = h_flex4().id(`${id}-${kind}-${row.number}`).h(28).px(8).pl(disclosure ? 14 : 22).gap(disclosure ? 6 : 8).items_center().rounded(6).cursor_pointer().hover((s) => s.bg(t.hover)).on_mouse_down("left", stop).on_click((_e, cx2) => {
      const r = this.host.ready();
      if (r) this.host.open(cx2, { kind: id, repo: `${r.remote.owner}/${r.remote.repo}`, number: row.number });
    }).on_hover((h, cx2) => {
      if (h) this.hovered = key;
      else if (this.hovered === key) this.hovered = null;
      this.previews.hover(cx2, `${key}-${contextKey}`, h ? ref : null, ready, () => {
        const live = this.host.ready();
        if (!live || !ref || this.hovered !== key || !this.host.asking()) return false;
        const target = { ...ref, repo: `${live.remote.owner}/${live.remote.repo}` };
        return previewKey(target, live.on, live.login) === contextKey;
      });
      cx2.notify();
    }).children(disclosure ? [disclosure] : []).children([...this.source.cells(row), ...this.hovered === key ? actions : this.source.idle(row)]);
    const card = ready && ref ? this.previews.wrap(`${id}-${key}`, frame, ref, ready) : frame;
    const expanded = this.source.expandedRow?.(row, key, cx);
    return expanded ? v_flex3().child(card).child(expanded) : card;
  }
};

// src/github/views/issues.ts
function issueList(host, failed) {
  return new GroupList(host, {
    kind: "issue",
    groups: [
      // One word like the others; the empty text says whose.
      { kind: "assigned", title: "Assigned", empty: "No open issues assigned to you." },
      { kind: "open", title: "Open", empty: "No open issues." },
      { kind: "closed", title: "Closed", empty: "No closed issues." }
    ],
    expanded: ["assigned"],
    peek: peekIssueGroup,
    ask: issueGroup,
    more: moreIssues,
    failed,
    cells: (issue) => [
      div6().flex_none().text_color(colors().dim).child(`#${issue.number}`),
      div6().flex_1().min_w(0).truncate().child(issue.title)
    ],
    idle: (issue) => {
      const t = colors();
      return [
        div6().flex_none().max_w(90).truncate().text_size(12).text_color(t.dim).child(issue.assignees.join(", ")),
        div6().flex_none().w(28).text_right().text_size(12).text_color(t.dim).child(relativeTime(issue.updatedAt, Date.now()))
      ];
    }
  });
}

// src/github/views/pulls.ts
import { div as div8, svg as svg5 } from "gpui-kit";

// src/github/views/files.ts
import { h_flex as h_flex5, v_flex as v_flex4 } from "gpui-base";
import { div as div7 } from "gpui-kit";
var STATUS = {
  added: { mark: "A", label: "Added", color: "done" },
  removed: { mark: "D", label: "Deleted", color: "blocked" },
  modified: { mark: "M", label: "Modified", color: "working" },
  renamed: { mark: "R", label: "Renamed", color: "accent" },
  copied: { mark: "C", label: "Copied", color: "accent" },
  changed: { mark: "M", label: "Changed", color: "working" },
  unchanged: { mark: "U", label: "Unchanged", color: "dim" }
};
var ChangedFiles = class {
  files = null;
  loading = false;
  failure = null;
  flat = false;
  hideViewed = false;
  filtered = false;
  notices = new Notices();
  writing = /* @__PURE__ */ new Set();
  folded = /* @__PURE__ */ new Set();
  latest = 0;
  source = null;
  tree = [];
  list = [];
  id;
  ref;
  on;
  open;
  constructor(id, ref, on, open) {
    this.id = id;
    this.ref = ref;
    this.on = on;
    this.open = open;
  }
  load(cx, force = false) {
    if (!force && (this.files !== null || this.loading)) return;
    const request = ++this.latest;
    this.loading = true;
    this.failure = null;
    cx.spawn(async (cx2) => {
      try {
        const files = await readPullFiles(this.ref.repo, this.ref.number, this.on);
        if (request === this.latest) this.files = files;
      } catch (e) {
        if (request === this.latest) this.failure = failureOf(e).message;
      } finally {
        if (request === this.latest) {
          this.loading = false;
          cx2.notify();
        }
      }
    });
  }
  /** Shared write notices carry no account-specific data: each view reads using its own gh. */
  sync(cx) {
    if (this.notices.take().some((n) => n.repo === this.ref.repo && n.number === this.ref.number && n.files?.on === this.on)) {
      this.load(cx, true);
    }
  }
  viewedButton(file) {
    const pending = this.writing.has(file.path);
    const label = file.viewed ? "Mark File As Not Viewed" : "Mark File As Viewed";
    return button(`${this.id}-viewed-${file.path}`, pending ? "Saving\u2026" : file.viewed ? "\u2713" : "\u25CB", label, (_e, cx) => {
      if (this.writing.has(file.path) || this.loading) return;
      this.writing.add(file.path);
      this.failure = null;
      cx.notify();
      cx.spawn(async (cx2) => {
        try {
          await setPullFileViewed(this.ref.repo, this.ref.number, file.path, !file.viewed, this.on);
          this.sync(cx2);
        } catch (e) {
          this.sync(cx2);
          this.failure = failureOf(e).message;
        } finally {
          this.writing.delete(file.path);
          cx2.notify();
        }
      });
    }).text_color(file.viewed ? colors().done : colors().dim);
  }
  render(cx, selected = null) {
    this.sync(cx);
    const t = colors();
    if (this.source !== this.files || this.filtered !== this.hideViewed) {
      this.source = this.files;
      this.filtered = this.hideViewed;
      this.tree = fileTree(this.files ?? [], this.hideViewed);
      this.list = flatFiles(this.files ?? [], this.hideViewed);
    }
    return v_flex4().min_w(0).gap(2).child(
      h_flex5().gap(6).items_center().child(
        div7().flex_1().text_size(12).text_color(t.dim).child(`Files changed${this.files ? ` (${this.files.length})` : ""}`)
      ).child(
        button(
          `${this.id}-mode`,
          this.flat ? "Tree" : "List",
          this.flat ? "View as Tree" : "View as List",
          (_e, cx2) => {
            this.flat = !this.flat;
            cx2.notify();
          }
        )
      ).child(
        button(
          `${this.id}-hide-viewed`,
          this.hideViewed ? "Show" : "Hide",
          "Toggle Hide Viewed Files",
          (_e, cx2) => {
            this.hideViewed = !this.hideViewed;
            cx2.notify();
          }
        )
      ).child(
        button(`${this.id}-refresh`, "\u21BB", "Refresh changed files", (_e, cx2) => {
          this.load(cx2, true);
          cx2.notify();
        })
      )
    ).when(this.loading, (el) => el.child(h_flex5().gap(6).child(spinner()).child("Loading changed files\u2026"))).when(
      this.failure !== null,
      (el) => el.child(
        v_flex4().gap(4).child(
          div7().text_size(12).text_color(t.blocked).child(this.failure ?? "")
        ).child(
          button(`${this.id}-retry`, "Retry", "Load changed files again", (_e, cx2) => {
            this.load(cx2, true);
            cx2.notify();
          })
        )
      )
    ).when(this.files?.length === 0, (el) => el.child(div7().text_color(t.dim).child("No changed files"))).when(
      Boolean(this.files?.length) && this.hideViewed && this.list.length === 0,
      (el) => el.child(div7().text_color(t.dim).child("All files viewed"))
    ).children(this.nodes(this.flat ? this.list : this.tree, selected, 0));
  }
  nodes(nodes, selected, depth) {
    const t = colors();
    return nodes.map((node2) => {
      const folder2 = node2.kind === "directory";
      const folded = this.folded.has(node2.path);
      const status2 = node2.kind === "file" ? STATUS[node2.file.status] ?? STATUS.changed : null;
      const tip = node2.kind === "file" ? `${node2.path}${node2.file.previousPath ? ` \u2190 ${node2.file.previousPath}` : ""} \xB7 ${status2?.label} \xB7 +${node2.file.additions} \u2212${node2.file.deletions}` : node2.path;
      const row = h_flex5().id(`${this.id}-${node2.kind}-${node2.path}`).h(26).min_w(0).pl(4 + depth * 8).pr(6).gap(4).items_center().cursor_pointer().hover((s) => s.bg(t.hover)).when(!folder2 && selected === node2.path, (el) => el.bg(t.selected)).tooltip(tip).accessibility_label(tip).on_mouse_down("left", stop).on_click((_e, cx) => {
        cx.stop_propagation();
        if (folder2) {
          if (folded) this.folded.delete(node2.path);
          else this.folded.add(node2.path);
          cx.notify();
        } else this.open(cx, node2.path);
      }).child(
        div7().w(12).flex_none().text_color(t.dim).child(folder2 ? folded ? "\u25B8" : "\u25BE" : "")
      ).child(div7().flex_1().min_w(0).truncate().text_size(12).child(node2.name)).children(node2.kind === "file" ? [this.viewedButton(node2.file)] : []).when(
        status2 !== null,
        (el) => el.child(
          div7().flex_none().text_size(12).text_color(t[status2?.color ?? "dim"]).child(status2?.mark ?? "")
        )
      );
      return node2.kind === "directory" && !folded ? v_flex4().child(row).children(this.nodes(node2.children, selected, depth + 1)) : row;
    });
  }
};

// src/github/views/pulls.ts
var EMPTY = "0 pull requests in this category";
function pullList(host) {
  const disclosures = /* @__PURE__ */ new Map();
  const disclosure = (pull, row) => {
    const r = host.ready();
    if (!r) return null;
    const repo = `${r.remote.owner}/${r.remote.repo}`;
    const key = JSON.stringify([r.on, repo, r.login, row]);
    let state = disclosures.get(key);
    if (!state) {
      const ref = { kind: "pr", repo, number: pull.number };
      state = {
        expanded: false,
        files: new ChangedFiles(`sidebar-${row}`, ref, r.on, (cx, path) => host.open(cx, ref, path))
      };
      disclosures.set(key, state);
    }
    return state;
  };
  return new GroupList(host, {
    kind: "pr",
    groups: [
      { kind: "local", title: "Local Pull Request Branches", empty: EMPTY },
      { kind: "review", title: "Waiting For My Review", empty: EMPTY },
      { kind: "mine", title: "Created By Me", empty: EMPTY },
      { kind: "all", title: "All Open", empty: EMPTY }
    ],
    // As the extension starts: only All Open; the searches wait until their group is unfolded.
    expanded: ["all"],
    peek: peekPullGroup,
    ask: pullGroup,
    more: morePulls,
    disclosure: (pull, key) => {
      const state = disclosure(pull, key);
      return button(
        `pr-files-${key}`,
        state?.expanded ? "\u25BE" : "\u25B8",
        `${state?.expanded ? "Collapse" : "Expand"} changed files`,
        (_e, cx) => {
          if (!state) return;
          state.expanded = !state.expanded;
          if (state.expanded) state.files.load(cx);
          cx.notify();
        }
      ).px(2).flex_none();
    },
    expandedRow: (pull, key, cx) => {
      const state = disclosure(pull, key);
      return state?.expanded ? div8().pl(16).child(state.files.render(cx)) : null;
    },
    cells: (pull) => {
      const state = PULL_STATES[pull.state];
      return [
        svg5(state.icon).size(14).flex_none().text_color(state.color(colors())).accessibility_label(state.label),
        div8().flex_1().min_w(0).truncate().child(`#${pull.number} ${pull.title}`).when(pull.state === "draft", (el) => el.italic())
      ];
    },
    idle: (pull) => [
      div8().flex_none().max_w(110).truncate().text_size(12).text_color(colors().dim).child(pull.author ? `by @${pull.author}` : "by ghost")
    ]
  });
}

// src/github/views/panel.ts
var TABS = [
  { id: "issues", label: "Issues" },
  { id: "prs", label: "Pull Requests" }
];
var Panel = class {
  /** The place shown (the focused folder and its machine), and which refresh is the latest: older ones drop their results. */
  context = null;
  latest = 0;
  // undefined: not known yet for this place.
  account;
  remote;
  failure;
  loading = false;
  /** The tab shown; each keeps its own state (folded groups and pages) while the other is shown. */
  tab = "issues";
  details = new DetailTabs();
  openFailure = null;
  notices = new Notices();
  /** The repository's issue list, checked for changes while the sidebar is shown. */
  poll = new ConditionalPoll();
  /** When this place's lists were last confirmed fresh, for the footer. */
  checkedAt = null;
  host = {
    ready: () => this.ready(),
    run: () => this.latest,
    asking: () => this.isVisible(),
    open: (cx, ref, file) => this.open(cx, ref, file)
  };
  /** Folded groups ask for nothing; which are expanded stays as the place changes. */
  issues = issueList(this.host, () => this.poll.invalidate());
  /** They load only while their tab is shown. */
  pulls = pullList(this.host);
  init(cx) {
    cx.timer.every(POLL_SECONDS * 1e3, (cx2) => {
      if (!this.isVisible()) {
        this.poll.sync(this.context, false);
        return;
      }
      if (!this.loading) {
        this.check(cx2);
        if (this.tab === "prs" && !this.pulls.busy) this.pulls.load(cx2, false, ["local"]);
      }
    });
  }
  isVisible() {
    return Boolean(props2()?.overlay) || sidebarVisible();
  }
  /** Only a changed list re-asks expanded groups; a refresh asks them even on 304. */
  check(cx, refresh) {
    const r = this.ready(), run3 = this.latest;
    const request = r && this.poll.begin(refresh !== void 0);
    if (!r || !request) return;
    cx.spawn(async (cx2) => {
      const current = () => run3 === this.latest && this.poll.current(request);
      let change;
      try {
        change = await listChanges(`${r.remote.owner}/${r.remote.repo}`, request.etag, r.on);
        if (!current()) return;
        this.checkedAt = Date.now();
        this.failure = void 0;
      } catch (e) {
        if (current()) this.failure = failureOf(e);
      } finally {
        if (current()) {
          if (change?.changed || refresh) this.issues.load(cx2, true);
          if (refresh && this.tab === "prs") this.pulls.load(cx2, refresh === "asked");
          cx2.notify();
        }
        this.poll.finish(request, change);
      }
    });
  }
  /** The gh account's login on the folder's machine and the remote, once both are known and usable. */
  ready() {
    const status2 = this.account?.status;
    return this.remote && status2?.ok && this.account ? { remote: this.remote, login: status2.user, on: this.account.on, cwd: location().cwd } : null;
  }
  /** Shows what is known about the focused place at once, then asks for what is stale (all of it unless it only moved). */
  refresh(cx, why) {
    const where = location(), run3 = ++this.latest, current = () => run3 === this.latest, context = JSON.stringify(where), force = why !== "moved";
    if (context !== this.context) {
      this.issues.hovered = this.pulls.hovered = null;
      this.checkedAt = null;
    }
    this.context = context;
    this.poll.sync(context, true);
    this.account = peekAccount(where.on);
    this.remote = peekRemote(where);
    this.failure = void 0;
    this.issues.show();
    this.pulls.show();
    this.loading = true;
    cx.spawn(async (cx2) => {
      try {
        const [, remote2] = await Promise.all([
          account2(where.on, force).then((a) => {
            if (current()) this.account = a;
          }),
          remote(where, force)
        ]);
        if (!current()) return;
        this.remote = remote2;
        this.check(cx2, why);
      } catch (e) {
        if (current()) this.failure = failureOf(e);
      } finally {
        if (current()) {
          this.loading = false;
          cx2.notify();
        }
      }
    });
  }
  /**
   * An issue closed or reopened in a reader: every kept group of its repository shows it at once,
   * then the shown expanded groups ask GitHub again (the change made them stale).
   */
  receive(cx) {
    const notices = this.notices.take();
    const reviews = notices.filter((n) => n.review);
    for (const notice of reviews) pullReviewed(notice.repo, notice.review.on);
    const ready = this.ready();
    if (ready && this.isVisible() && this.tab === "prs" && reviews.some(
      (n) => n.review?.on === ready.on && n.repo.toLowerCase() === `${ready.remote.owner}/${ready.remote.repo}`.toLowerCase()
    )) {
      this.pulls.load(cx, true);
    }
    const changes2 = notices.flatMap((n) => n.state ? [n.state] : []);
    if (changes2.length === 0) return;
    changes2.forEach(issueChanged);
    this.issues.show();
    this.issues.load(cx);
  }
  /** A click on a row opens (or selects) its reader tab. */
  open(cx, ref, file) {
    this.openFailure = null;
    cx.spawn(async (cx2) => {
      try {
        await this.details.open(ref, file);
      } catch (e) {
        this.openFailure = e instanceof Error ? e.message : String(e);
      }
      cx2.notify();
    });
  }
  render(cx) {
    this.details.deliver();
    this.receive(cx);
    const where = location();
    const visible = this.isVisible();
    if (!visible) this.poll.sync(this.context, false);
    else if (!this.poll.shown) this.refresh(cx, "shown");
    else if (JSON.stringify(where) !== this.context) this.refresh(cx, "moved");
    const t = colors();
    const overlay = props2()?.overlay;
    const noRemote = this.remote === null && !(this.account && !this.account.status.ok);
    return v_flex5().id("github").size_full().min_h(0).overflow_hidden().bg(t.background).text_color(t.foreground).text_size(13).when(!overlay, (el) => el.rounded(10).border_1().border_color(t.border)).child(this.header(overlay, where.cwd ?? "no folder")).when(noRemote, (el) => el.child(this.noRemote(where.cwd))).when(!noRemote, (el) => el.child(this.tabs()).child(this.list(cx))).child(this.statusCard(where.on, where.cwd));
  }
  /** The repository, then ↻ (Herdr's own spinner while anything loads, as its tab bar shows a working agent). */
  header(overlay, context) {
    const t = colors();
    const busy = this.loading || this.issues.busy || this.pulls.busy;
    const refresh = button("gh-refresh", "\u21BB", "Refresh", (_e, cx) => {
      this.refresh(cx, "asked");
      cx.notify();
    });
    const repo = this.remote ? `${this.remote.owner}/${this.remote.repo}` : "";
    return h_flex6().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border).child(div9().font_semibold().tooltip(context).child("GitHub")).child(div9().flex_1().min_w(0).truncate().text_right().text_size(12).text_color(t.dim).child(repo)).child(busy ? div9().size(24).flex_none().flex().items_center().justify_center().child(spinner()) : refresh).when(overlay !== void 0, (el) => el.child(button("gh-close", "\xD7", "Close", () => closeOverlay(overlay))));
  }
  /** The gh account on the folder's machine, then how fresh the lists are. What to do about a problem is said in the list. */
  statusCard(on, cwd) {
    const t = colors();
    const s = footerStatus(
      {
        account: this.account,
        on,
        checkedAt: this.checkedAt,
        failed: this.failure !== void 0 && this.ready() !== null,
        polling: this.ready() !== null
      },
      Date.now()
    );
    const tip = `${this.account ? describeAccount(this.account).text : "checking gh\u2026"} \xB7 ${cwd ?? "no folder"}`;
    const dot = s.tone === "pending" ? spinner(10) : div9().size(8).rounded(4).bg(s.tone === "ok" ? t.done : t.blocked);
    return v_flex5().id("gh-status").flex_none().px(14).py(8).gap(2).border_t(1).border_color(t.border).bg(t.surface).text_size(12).tooltip(tip).accessibility_label(`${s.account} on ${s.machine}${s.sync ? `. ${s.sync}` : ""}`).child(
      h_flex6().gap(8).items_center().child(div9().w(10).flex_none().flex().items_center().justify_center().child(dot)).child(div9().flex_none().max_w(160).truncate().font_medium().child(s.account)).child(div9().flex_none().text_color(t.dim).child("\xB7")).child(div9().flex_1().min_w(0).truncate().text_color(t.dim).child(s.machine))
    ).when(
      s.sync !== null,
      (el) => el.child(
        div9().pl(18).truncate().text_color(s.tone === "problem" ? t.blocked : t.dim).child(s.sync ?? "")
      )
    );
  }
  /** No GitHub remote here: nothing is wrong, there is just no repository. Said calmly, in place of the tabs and lists. */
  noRemote(cwd) {
    const t = colors();
    const empty = noRepository(cwd);
    return v_flex5().flex_1().min_h(0).px(28).gap(8).items_center().justify_center().child(svg6("mods/github/assets/github.svg").size(28).text_color(t.dim)).child(div9().pt(4).font_medium().text_color(t.muted).child(empty.title)).child(div9().text_size(12).text_center().text_color(t.dim).child(empty.detail));
  }
  /** Issues and Pull Requests; Actions and notifications join them later. */
  tabs() {
    const t = colors();
    return h_flex6().h(34).flex_none().px(10).gap(4).items_center().border_b(1).border_color(t.border).children(
      TABS.map(
        ({ id, label }) => div9().id(`gh-tab-${id}`).px(8).py(3).rounded(6).text_size(12).font_medium().cursor_pointer().text_color(this.tab === id ? t.foreground : t.muted).when(this.tab === id, (el) => el.bg(t.hover)).when(this.tab !== id, (el) => el.hover((s) => s.bg(t.hover))).accessibility_label(label).on_mouse_down("left", stop).on_click((_e, cx) => {
          this.tab = id;
          this.openFailure = null;
          if (id === "prs") this.pulls.load(cx);
          cx.notify();
        }).child(label)
      )
    );
  }
  /**
   * The shown tab's groups, or what stands in their place. A missing repository (404), gh or Issues turned off is
   * the same for every group: said once, in the list's place. Any other failure stays in its own group.
   */
  list(cx) {
    const t = colors();
    const list2 = this.tab === "issues" ? this.issues : this.pulls;
    const notice = listNotice({
      account: this.account,
      remote: this.remote,
      issuesEnabled: this.tab === "issues" ? this.issues.anyPage?.issuesEnabled : void 0,
      failure: this.failure ?? list2.notFound
    });
    const problem = (text3) => div9().p(8).text_size(12).text_color(t.blocked).child(text3);
    return v_flex5().id(`gh-list-${this.tab}`).flex_1().min_h(0).overflow_y_scroll().p(6).gap(4).when(this.openFailure !== null, (el) => el.child(problem(this.openFailure ?? ""))).when(notice !== null, (el) => el.child(problem(notice ?? ""))).when(!notice && this.ready() !== null, (el) => el.children(list2.render(cx))).when(!notice && !this.ready() && this.loading, (el) => el.child(div9().p(8).text_color(t.dim).child("\u2026")));
  }
};

// src/github/views/reader.ts
import { v_flex as v_flex12 } from "gpui-base";
import { nextCommand, props as props3 } from "herdr";

// src/github/views/issue.ts
import { h_flex as h_flex7, Textarea, TextareaState, v_flex as v_flex6 } from "gpui-base";
import { div as div10 } from "gpui-kit";

// src/github/core/projects.ts
var FIELD = { issue: "issue", pr: "pullRequest" };
function projectsQuery(ref, after) {
  const [owner = "", name = ""] = ref.repo.split("/");
  return {
    query: `query($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    ${FIELD[ref.kind]}(number: $number) {
      projectItems(first: 100, after: $after, includeArchived: true) {
        pageInfo { hasNextPage endCursor }
        nodes { project { title url } }
      }
    }
  }
}`,
    variables: { owner, name, number: ref.number, after }
  };
}
function projectPage(data, kind) {
  const repository = data?.repository;
  const items = repository?.[FIELD[kind]]?.projectItems;
  if (!items) throw new Error(`GitHub did not return this ${kind === "pr" ? "pull request" : "issue"}'s Projects.`);
  return {
    projects: items.nodes.map((n) => ({ title: n.project.title, url: n.project.url })),
    more: items.pageInfo.hasNextPage,
    cursor: items.pageInfo.endCursor
  };
}
function projectsFailure(message, on) {
  const machine = on ?? "this computer";
  return {
    ok: false,
    message: /read:project/.test(message) ? `Projects require read:project. Run gh auth refresh -h github.com -s read:project on ${machine}.` : `Projects unavailable on ${machine}. ${explain(message)}`
  };
}

// src/github/io/projects.ts
async function readProjects(ref, on) {
  const projects2 = [];
  let after = null;
  try {
    for (; ; ) {
      const page = projectPage(await graphql(projectsQuery(ref, after), on), ref.kind);
      projects2.push(...page.projects);
      if (!page.more) return { ok: true, projects: projects2 };
      if (!page.cursor || page.cursor === after) throw new Error("GitHub did not return the next Projects page.");
      after = page.cursor;
    }
  } catch (e) {
    return projectsFailure(e instanceof Error ? e.message : String(e), on);
  }
}

// src/github/views/issue.ts
var POLL_MS = 1e4;
var Issue = class {
  ref = null;
  entry = null;
  /** The new comment being written; kept when posting fails, and through refreshes. */
  draft = "";
  host;
  metadata = new DetailMetadata();
  notices = new Notices();
  box = null;
  /** Unsent comments of the issues Back can return to. */
  drafts = /* @__PURE__ */ new Map();
  writing = null;
  writeFailure = null;
  polling = new ConditionalPoll();
  constructor(host) {
    this.host = host;
  }
  init(cx) {
    const box = TextareaState.new({ placeholder: "Leave a comment (Markdown)" });
    box.set_auto_grow(3, 12);
    box.on("change", (_e, cx2) => {
      this.draft = box.value();
      cx2.notify();
    });
    box.on("submit", (e, cx2) => {
      if (e.secondary) this.comment(cx2);
    });
    this.box = box;
    cx.timer.every(POLL_MS, (cx2) => {
      const shown = this.syncPolling();
      if (!this.writing) this.load(cx2, shown);
    });
  }
  show(cx, ref) {
    if (this.ref) this.drafts.set(detailKey(this.ref), this.draft);
    this.draft = this.drafts.get(detailKey(ref)) ?? "";
    this.drafts.delete(detailKey(ref));
    this.box?.set_value(this.draft);
    this.metadata.expanded = false;
    this.ref = ref;
    this.writeFailure = null;
    this.load(cx);
  }
  /** Visibility is the reader's own native tab, not keyboard focus or the sidebar's repository. */
  syncPolling() {
    const place = detailLocation(this.host.reader);
    const key = this.ref && place ? `${place.on ?? ""}
${place.pane}
${detailKey(this.ref)}` : null;
    return this.polling.sync(key, Boolean(place?.visible) && this.host.active("issue"));
  }
  /** A forced refresh reloads even on 304; normal ticks leave unchanged discussions alone. Never touches the draft. */
  load(cx, force = true) {
    const ref = this.ref;
    const place = detailLocation(this.host.reader);
    this.syncPolling();
    const request = this.polling.begin(force);
    if (!ref || !place || !request) return;
    const key = detailKey(ref);
    const previous3 = this.entry?.key === key ? this.entry : null;
    let entry = !force && previous3 && previous3.on === place.on ? previous3 : {
      key,
      issue: previous3?.issue,
      on: previous3?.on === place.on ? previous3.on : void 0,
      failure: previous3?.failure,
      projects: previous3?.projects,
      loading: force,
      projectsLoading: false
    };
    this.entry = entry;
    cx.spawn(async (cx2) => {
      const current = () => this.entry === entry && this.polling.current(request) && detailLocation(this.host.reader)?.visible && this.host.active("issue");
      let completed;
      try {
        if (entry.on === void 0) await signedIn(place.on);
        const on = place.on;
        if (!current()) return;
        const change = await issueChanges(ref.repo, ref.number, request.etag, on);
        if (!current()) return;
        if (this.polling.reload(request, change)) {
          if (!force) {
            entry = { ...entry, projectsLoading: false };
            this.entry = entry;
          }
          const issue = await readIssue(ref.repo, ref.number, on);
          if (!current()) return;
          entry.issue = issue;
          entry.on = on;
          entry.projectsLoading = true;
          cx2.spawn(async (cx3) => {
            const projects2 = await readProjects(ref, on);
            if (this.entry !== entry) return;
            entry.projects = projects2;
            entry.projectsLoading = false;
            cx3.notify();
          });
        }
        completed = change;
        entry.failure = void 0;
      } catch (e) {
        if (!current()) return;
        const failure = failureOf(e);
        entry.failure = failure.notFound ? notVisible(ref) : failure.message;
      } finally {
        if (!detailLocation(this.host.reader)?.visible) this.syncPolling();
        const result = this.polling.finish(request, completed);
        if (this.entry === entry) entry.loading = false;
        if (result.accepted && result.notify) cx2.notify();
      }
    });
  }
  /** Posts the comment box's text; the box is emptied once GitHub has it. */
  comment(cx) {
    const body = this.draft;
    this.write(cx, "comment", body.trim() !== "", async (repo, number, on) => {
      const comment = await addComment(repo, number, body, on);
      this.publish({ repo, number, comment });
      const sentKey = detailKey({ kind: "issue", repo, number });
      if (this.ref && detailKey(this.ref) === sentKey && this.draft === body) {
        this.draft = "";
        this.box?.set_value("");
      } else if (this.drafts.get(sentKey) === body) this.drafts.delete(sentKey);
    });
  }
  setState(cx, state) {
    this.write(cx, "state", true, async (repo, number, on) => {
      this.publish({ repo, number, state: await setIssueState(repo, number, state, on) });
    });
  }
  /** Shows this view's own write at once, then tells the other views. */
  publish(notice) {
    this.apply(notice);
    announce(notice);
  }
  /** One write at a time, through the gh that read the issue; a failure is said with gh's words. */
  write(cx, kind, ready, act) {
    const ref = this.ref;
    const entry = this.entry;
    if (!ref || !entry?.issue || entry.on === void 0 || this.writing || !ready) return;
    const on = entry.on;
    this.writing = kind;
    this.writeFailure = null;
    cx.notify();
    cx.spawn(async (cx2) => {
      try {
        await act(ref.repo, ref.number, on);
      } catch (e) {
        this.writeFailure = failureOf(e).message;
        if (e instanceof GhError && e.transient && this.entry === entry) this.load(cx2);
      } finally {
        this.writing = null;
        cx2.notify();
      }
    });
  }
  /** A write to the shown issue: a new comment joins the timeline (once), a new state shows. */
  apply(notice) {
    const issue = this.entry?.issue;
    const comment = notice.comment;
    if (!issue || !this.ref || detailKey({ kind: "issue", ...notice }) !== detailKey(this.ref)) return;
    this.polling.invalidate();
    if (this.entry) this.entry.loading = false;
    if (comment && !issue.comments.some((c) => c.id === comment.id)) issue.comments = [...issue.comments, comment];
    if (notice.state) issue.state = notice.state.state;
  }
  render(cx, layout2) {
    for (const notice of this.notices.take()) this.apply(notice);
    if (this.syncPolling()) this.load(cx);
    const ref = this.ref;
    const entry = this.entry;
    if (!ref) return [detailEmpty("issue")];
    const issue = entry?.issue;
    return [
      detailHeader(
        this.host,
        ref,
        { title: issue?.title, url: issue?.url, loading: Boolean(entry?.loading) },
        (cx2) => this.load(cx2)
      ),
      detailBody(ref, Boolean(entry?.loading), entry?.failure, issue ? this.document(issue, layout2) : null)
    ];
  }
  document(issue, layout2) {
    const t = colors();
    const open = issue.state === "open";
    const onLink = (url, cx) => openLink(cx, this.host, url, issue.url);
    return detailDocument(
      layout2,
      [
        stateBadge(open ? "\u25CB Open" : "\u25CF Closed", open ? t.done : t.accent),
        div10().text_size(13).font_medium().child(issue.author)
      ],
      [
        postCard("issue-body", issue, "opened this issue", onLink),
        ...issueTimeline(issue.comments, issue.activities).map(
          (row) => row.type === "comment" ? postCard(`comment-${row.comment.id}`, row.comment, "commented", onLink) : this.activity(row.activity)
        ),
        this.composer(issue)
      ],
      [
        ["Assignees", people(issue.assignees, "No assignees")],
        ["Labels", labels(issue.labels), issue.labels.length],
        ["Project", projects(this.entry?.projects, Boolean(this.entry?.projectsLoading))],
        ["Milestone", milestone(issue.milestone)]
      ],
      this.metadata
    );
  }
  /** A label or assignment change between the comments. */
  activity(activity) {
    const t = colors();
    const avatar = div10().size(22).flex_none().rounded(11).bg(t.raised).text_color(t.muted).font_semibold().flex().items_center().justify_center().child(activity.actor.slice(0, 1).toUpperCase());
    const changed = "labels" in activity ? activity.labels : null;
    return h_flex7().id(`activity-${activity.id}`).px(16).py(4).gap(8).items_center().flex_wrap().text_size(12).child(avatar).child(div10().font_semibold().child(activity.actor)).child(div10().text_color(t.dim).child(activityText(activity))).when(
      changed !== null,
      (el) => el.children((changed ?? []).map(labelChip)).child(
        div10().text_color(t.dim).child(changed?.length === 1 ? "label" : "labels")
      )
    ).child(div10().flex_1()).child(div10().text_color(t.dim).tooltip(activity.createdAt).child(relativeTime(activity.createdAt, Date.now())));
  }
  /** A new comment, and close / reopen: GitHub's own order of the two buttons. */
  composer(issue) {
    const t = colors();
    const box = this.box;
    const open = issue.state === "open";
    const busy = this.writing !== null;
    const close = {
      id: "issue-state",
      label: open ? "Close issue" : "Reopen issue",
      tip: open ? `Close #${issue.number}` : `Reopen #${issue.number}`,
      enabled: !busy,
      primary: false
    };
    const send = {
      id: "issue-comment",
      label: "Comment",
      tip: "Comment (\u2318/Ctrl+Enter)",
      enabled: !busy && this.draft.trim() !== "",
      primary: true
    };
    return v_flex6().id("issue-composer").min_w(0).w_full().gap(10).pt(4).when(
      box !== null,
      (el) => el.child(
        div10().min_w(0).rounded(8).border_1().border_color(t.border).bg(t.background).p(8).on_mouse_down("left", stop).child(Textarea.new(box).w_full().text_size(13).text_color(t.foreground))
      )
    ).when(
      this.writeFailure !== null,
      (el) => el.child(
        div10().text_size(12).text_color(t.blocked).child(this.writeFailure ?? "")
      )
    ).child(
      h_flex7().gap(8).items_center().justify_end().when(busy, (el) => el.child(spinner(14))).child(this.action(close, (cx) => this.setState(cx, open ? "closed" : "open"))).child(this.action(send, (cx) => this.comment(cx)))
    );
  }
  action({ id, label, tip, enabled, primary }, act) {
    const t = colors();
    return h_flex7().id(id).h(32).px(14).gap(6).items_center().rounded(6).border_1().text_size(13).font_medium().border_color(primary ? t.accent : t.border).bg(primary ? t.accent : t.raised).text_color(primary ? t.background : t.foreground).when(
      enabled,
      (el) => el.cursor_pointer().hover((s) => s.opacity(0.85)).on_click((_e, cx) => {
        cx.stop_propagation();
        act(cx);
      })
    ).when(!enabled, (el) => el.opacity(0.5)).tooltip(tip).accessibility_label(tip).on_mouse_down("left", stop).child(label);
  }
};

// src/github/views/pull.ts
import { h_flex as h_flex12, v_flex as v_flex11 } from "gpui-base";
import { div as div15 } from "gpui-kit";

// src/github/views/diff.ts
import { h_flex as h_flex10, v_flex as v_flex9 } from "gpui-base";
import { div as div13 } from "gpui-kit";

// src/github/core/diff.ts
function commentTarget(row, side) {
  if (!row.comment) return null;
  const line = side === "LEFT" ? row.oldLine : row.newLine;
  return line === null ? null : { side, line };
}
function parsePatch(patch) {
  const rows = [];
  let oldLine = 0, newLine = 0, oldLeft = 0, newLeft = 0;
  for (const raw of patch.split("\n")) {
    const text3 = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(text3);
    if (hunk) {
      oldLine = Number(hunk[1]);
      oldLeft = Number(hunk[2] ?? 1);
      newLine = Number(hunk[3]);
      newLeft = Number(hunk[4] ?? 1);
      rows.push({ kind: "hunk", text: text3, oldLine: null, newLine: null, comment: null });
      continue;
    }
    if (text3 === "\\ No newline at end of file") {
      rows.push({ kind: "notice", text: text3, oldLine: null, newLine: null, comment: null });
      continue;
    }
    const prefix = text3[0];
    if (prefix === "+" && newLeft > 0) {
      rows.push({
        kind: "add",
        text: text3.slice(1),
        oldLine: null,
        newLine,
        comment: { side: "RIGHT", line: newLine }
      });
      newLine++;
      newLeft--;
    } else if (prefix === "-" && oldLeft > 0) {
      rows.push({
        kind: "delete",
        text: text3.slice(1),
        oldLine,
        newLine: null,
        comment: { side: "LEFT", line: oldLine }
      });
      oldLine++;
      oldLeft--;
    } else if (prefix === " " && oldLeft > 0 && newLeft > 0) {
      rows.push({ kind: "context", text: text3.slice(1), oldLine, newLine, comment: { side: "RIGHT", line: newLine } });
      oldLine++;
      newLine++;
      oldLeft--;
      newLeft--;
    }
  }
  return rows;
}

// src/github/core/viewport.ts
function itemWindow(sizes, requested, height) {
  const total = sizes.reduce((sum, size) => sum + size, 0);
  const offset = Math.max(0, Math.min(requested, Math.max(0, total - height)));
  const from = Math.max(0, offset - 44);
  const to = offset + height + 44;
  let start = 0, top = 0;
  while (start < sizes.length && top + sizes[start] <= from) top += sizes[start++];
  let end = start, bottom = top;
  while (end < sizes.length && bottom < to) bottom += sizes[end++];
  return { start, end, top, offset, total };
}

// src/github/views/diff-lines.ts
import { h_flex as h_flex8, v_flex as v_flex7 } from "gpui-base";
import { div as div11 } from "gpui-kit";
var ROW_HEIGHT = 22;
function diffSnippet(id, patch) {
  return v_flex7().id(id).min_w(0).w_full().overflow_x_scrollbar().children(parsePatch(patch).map((row) => diffRow(row)));
}
function diffRow(row, gutters) {
  const t = colors();
  const added = row.kind === "add", deleted = row.kind === "delete";
  return h_flex8().h(ROW_HEIGHT).w_full().flex_none().items_center().font_family("monospace").text_size(13).when(added, (el) => el.bg(`${t.done}20`)).when(deleted, (el) => el.bg(`${t.blocked}20`)).when(row.kind === "hunk", (el) => el.bg(`${t.accent}18`).text_color(t.accent)).when(row.kind === "notice", (el) => el.text_color(t.dim)).child(
    div11().w(54).flex_none().pr(8).text_right().text_color(t.dim).child(gutters?.left ?? row.oldLine ?? "")
  ).child(
    div11().w(54).flex_none().pr(8).text_right().text_color(t.dim).child(gutters?.right ?? row.newLine ?? "")
  ).child(
    div11().w(20).flex_none().text_color(added ? t.done : deleted ? t.blocked : t.dim).child(added ? "+" : deleted ? "\u2212" : "")
  ).child(div11().flex_none().whitespace_nowrap().child(row.text));
}

// src/github/views/review-threads.ts
import { h_flex as h_flex9, Textarea as Textarea2, TextareaState as TextareaState2, v_flex as v_flex8 } from "gpui-base";
import { div as div12 } from "gpui-kit";

// src/github/core/published-comments.ts
var PublishedComments = class {
  pendingThreads = /* @__PURE__ */ new Map();
  pendingTimeline = /* @__PURE__ */ new Map();
  activities = /* @__PURE__ */ new Map();
  /** Promote only this review's drafts; replies stay with their original timeline conversation. */
  submitted(item, threads) {
    const pending = threads.filter((t) => t.comments.some((c) => c.draft));
    const newRoots = new Set(
      pending.filter((t) => t.comments.some((c) => c.id === t.root && c.draft)).map((t) => t.root)
    );
    const promoted = pending.map((t) => ({
      ...t,
      comments: t.comments.map((c) => {
        const { draft: _draft, ...published } = c;
        return published;
      })
    }));
    const discussion = promoted.filter((t) => newRoots.has(t.root)).flatMap((t) => t.comments.map((comment) => ({ root: t.root, comment, path: t.path, snippet: "" })));
    const replyOnly = item.kind === "review" && item.verb === "reviewed" && !item.body.trim() && !discussion.length && pending.length > 0;
    this.activity(replyOnly ? null : { ...item, discussion }, promoted);
    return threads.map((t) => promoted.find((p) => p.id === t.id) ?? t);
  }
  /** Keep an acknowledged submission visible while the review and diff endpoints catch up separately. */
  activity(item, threads = []) {
    if (item) this.activities.set(`${item.kind}-${item.id}`, item);
    for (const thread of threads) {
      this.pendingThreads.set(thread.root, thread);
      for (const comment of thread.comments) this.pendingTimeline.delete(comment.id);
    }
  }
  add(comment, target) {
    const thread = {
      ...target,
      id: `comment-${comment.id}`,
      root: comment.id,
      resolved: false,
      canResolve: false,
      canUnresolve: false,
      comments: [comment]
    };
    this.pendingThreads.set(comment.id, thread);
    this.pendingTimeline.set(comment.id, {
      ...comment,
      // Negative IDs keep local review placeholders distinct from GitHub's positive review IDs.
      id: -comment.id,
      body: "",
      markdown: "",
      kind: "review",
      verb: "reviewed",
      discussion: [{ root: comment.id, comment, path: target.path, snippet: "" }]
    });
    return thread;
  }
  /** Each endpoint releases only the writes it has actually observed. */
  timeline(remote2) {
    for (const item of remote2) for (const d of item.discussion) this.pendingTimeline.delete(d.comment.id);
    const merged = remote2.map((item) => {
      const key = `${item.kind}-${item.id}`;
      const local = this.activities.get(key);
      if (!local) return item;
      const missing = local.discussion.filter((d) => !item.discussion.some((r) => r.comment.id === d.comment.id));
      if (!missing.length) this.activities.delete(key);
      return missing.length ? { ...item, discussion: [...item.discussion, ...missing] } : item;
    });
    const unseen = [...this.activities.values()].filter(
      (item) => !remote2.some((r) => r.kind === item.kind && r.id === item.id)
    );
    return [...merged, ...this.pendingTimeline.values(), ...unseen].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id
    );
  }
  threads(remote2) {
    const seen = new Set(remote2.flatMap((t) => t.comments.filter((c) => !c.draft).map((c) => c.id)));
    for (const [root, thread] of this.pendingThreads) {
      if (thread.comments.every((c) => seen.has(c.id))) this.pendingThreads.delete(root);
    }
    const result = remote2.map((thread) => {
      const local = this.pendingThreads.get(thread.root);
      return local ? {
        ...thread,
        comments: [...local.comments, ...thread.comments.filter((c) => !local.comments.some((l) => l.id === c.id))]
      } : thread;
    });
    for (const local of this.pendingThreads.values())
      if (!remote2.some((t) => t.root === local.root)) result.push(local);
    return result;
  }
};

// src/github/io/pull-reviews.ts
async function addPullReviewComment(repo, number, target, body, on) {
  const pending = await startPullReview(repo, number, target.commit, on);
  try {
    const data = await graphql(
      {
        query: "mutation($review:ID!,$path:String!,$side:DiffSide!,$line:Int!,$body:String!){addPullRequestReviewThread(input:{pullRequestReviewId:$review,path:$path,side:$side,line:$line,body:$body}){thread{id path diffSide line isOutdated isResolved viewerCanResolve viewerCanUnresolve comments(first:1){nodes{databaseId body createdAt author{login}}}}}}",
        variables: { review: pending.id, path: target.path, side: target.side, line: target.line, body }
      },
      on
    );
    const node2 = data?.addPullRequestReviewThread?.thread;
    const first = node2?.comments.nodes[0];
    if (!node2?.id || !first) throw new Error("GitHub did not return the draft discussion.");
    const thread = {
      id: node2.id,
      root: first.databaseId,
      path: node2.path,
      side: node2.diffSide,
      line: node2.line,
      outdated: node2.isOutdated,
      resolved: node2.isResolved,
      canResolve: node2.viewerCanResolve,
      canUnresolve: node2.viewerCanUnresolve,
      comments: node2.comments.nodes.map((c) => ({
        ...parseComment(
          { id: c.databaseId, body: c.body, created_at: c.createdAt, user: c.author },
          `https://github.com/${repo}/pull/${number}`
        ),
        draft: true
      }))
    };
    announce({ repo, number, threads: { on } });
    return { pending, thread };
  } catch (e) {
    if (e instanceof GhError && e.transient) announce({ repo, number, threads: { on } });
    throw e;
  }
}
async function replyPullReviewThread(repo, number, thread, root, body, on) {
  const state = await readPullReview(repo, number, on);
  if (!state.pending) return replyPullThread(repo, number, root, body, on);
  try {
    const data = await graphql(
      {
        query: "mutation($review:ID!,$thread:ID!,$body:String!){addPullRequestReviewThreadReply(input:{pullRequestReviewId:$review,pullRequestReviewThreadId:$thread,body:$body}){comment{databaseId body createdAt author{login}}}}",
        variables: { review: state.pending.id, thread, body }
      },
      on
    );
    const c = data?.addPullRequestReviewThreadReply?.comment;
    if (!c?.databaseId) throw new Error("GitHub did not return the draft reply.");
    announce({ repo, number, threads: { on } });
    return {
      ...parseComment(
        { id: c.databaseId, body: c.body, created_at: c.createdAt, user: c.author },
        `https://github.com/${repo}/pull/${number}`
      ),
      draft: true
    };
  } catch (e) {
    if (e instanceof GhError && e.transient) announce({ repo, number, threads: { on } });
    throw e;
  }
}
async function submitPullReview(repo, number, commit, event, body, on) {
  if (event === "REQUEST_CHANGES" && !body.trim()) throw new Error("Request Changes requires a summary.");
  const state = await readPullReview(repo, number, on);
  const url = `https://github.com/${repo}/pull/${number}`;
  try {
    let item;
    if (!state.pending && event === "COMMENT") {
      if (!body.trim()) throw new Error("Write a comment first.");
      const raw = await api(`repos/${repo}/issues/${number}/comments`, { on, method: "POST", rawFields: { body } });
      item = { ...parseComment(raw, url), kind: "comment", verb: "commented", discussion: [] };
    } else {
      let raw;
      if (state.pending) {
        const data = await graphql(
          {
            query: "mutation($id:ID!,$event:PullRequestReviewEvent!,$body:String!){submitPullRequestReview(input:{pullRequestReviewId:$id,event:$event,body:$body}){pullRequestReview{id databaseId state body submittedAt author{login}}}}",
            variables: { id: state.pending.id, event, body }
          },
          on
        );
        const review = data?.submitPullRequestReview?.pullRequestReview;
        if (!review?.submittedAt) throw new Error("GitHub did not return the submitted review.");
        raw = {
          id: review.databaseId,
          body: review.body,
          state: review.state,
          submitted_at: review.submittedAt,
          user: review.author
        };
      } else {
        raw = await api(`repos/${repo}/pulls/${number}/reviews`, {
          on,
          method: "POST",
          rawFields: { body, event, commit_id: commit }
        });
      }
      const parsed = pullTimeline([], [], [raw], [], url)[0];
      if (!parsed) throw new Error("GitHub did not return the submitted review.");
      item = parsed;
    }
    announce({ repo, number, threads: { on }, review: { on } });
    return item;
  } catch (e) {
    if (e instanceof GhError && e.transient) announce({ repo, number, threads: { on }, review: { on } });
    throw e;
  }
}
async function readPullReview(repo, number, on) {
  const [owner, name] = repo.split("/");
  let after = null;
  for (; ; ) {
    const data = await graphql(
      {
        query: "query($owner:String!,$repo:String!,$number:Int!,$after:String){repository(owner:$owner,name:$repo){pullRequest(number:$number){id reviews(first:100,states:PENDING,after:$after){nodes{id databaseId viewerDidAuthor body} pageInfo{hasNextPage endCursor}}}}}",
        variables: { owner, repo: name, number, after }
      },
      on
    );
    const pull = data?.repository?.pullRequest;
    if (!pull) throw new Error("GitHub did not return the pull request's pending review.");
    const pending = pull.reviews.nodes.find((r) => r.viewerDidAuthor);
    if (pending)
      return {
        id: pull.id,
        pending: {
          id: pending.id,
          databaseId: pending.databaseId,
          ...pending.body === void 0 ? {} : { body: pending.body }
        }
      };
    if (!pull.reviews.pageInfo.hasNextPage) return { id: pull.id, pending: null };
    const next = pull.reviews.pageInfo.endCursor;
    if (!next || next === after) throw new Error("GitHub did not return the next reviews page.");
    after = next;
  }
}
async function startPullReview(repo, number, commit, on) {
  const state = await readPullReview(repo, number, on);
  if (state.pending) return state.pending;
  try {
    const data = await graphql(
      {
        query: "mutation($id:ID!,$commit:GitObjectID!){addPullRequestReview(input:{pullRequestId:$id,commitOID:$commit}){pullRequestReview{id databaseId state}}}",
        variables: { id: state.id, commit }
      },
      on
    );
    const review = data?.addPullRequestReview?.pullRequestReview;
    if (!review?.id || review.state !== "PENDING") throw new Error("GitHub did not return the pending review.");
    announce({ repo, number, threads: { on } });
    return { id: review.id, databaseId: review.databaseId };
  } catch (e) {
    if (e instanceof GhError && e.transient) announce({ repo, number, threads: { on } });
    throw e;
  }
}

// src/github/views/review-threads.ts
var THREAD_ESTIMATE = 160;
var COMPOSER_HEIGHT = 220;
function commentEditor(state, height) {
  const t = colors();
  return div12().h(height).flex_none().min_w(0).rounded(6).border_1().border_color(t.input).bg(t.background).p(8).on_mouse_down("left", stop).child(Textarea2.new(state).size_full().text_size(13).text_color(t.foreground));
}
var ReviewThreads = class {
  threads = [];
  published = new PublishedComments();
  loading = false;
  failure = null;
  latest = 0;
  pending = null;
  // Keyed by acknowledged comment ID (roots and replies), so each expires only when observed.
  localDrafts = /* @__PURE__ */ new Map();
  summaryBox = null;
  summaryTouched = false;
  notices = new Notices();
  writing = /* @__PURE__ */ new Set();
  failures = /* @__PURE__ */ new Map();
  boxes = /* @__PURE__ */ new Map();
  dirty = false;
  hiddenSnippets = /* @__PURE__ */ new Set();
  drafts = /* @__PURE__ */ new Map();
  constructor(ref, on, host) {
    this.ref = ref;
    this.on = on;
    this.host = host;
  }
  ref;
  on;
  host;
  /** Native input state must be created in init or an event/async callback, never during render. */
  init() {
    if (this.summaryBox) return;
    const box = TextareaState2.new({ placeholder: "Leave a comment" });
    box.set_value(this.pending?.body ?? "");
    box.on("change", (_e, cx) => {
      this.summaryTouched = true;
      cx.notify();
    });
    this.summaryBox = box;
  }
  load(cx) {
    if (this.writing.size) {
      this.dirty = true;
      return;
    }
    const request = ++this.latest;
    this.loading = true;
    this.failure = null;
    cx.spawn(async (cx2) => {
      try {
        this.init();
        const state = await readPullReview(this.ref.repo, this.ref.number, this.on);
        const threads = await readPullThreads(
          this.ref.repo,
          this.ref.number,
          this.on,
          state.pending?.databaseId ?? null
        );
        if (request === this.latest) {
          this.pending = state.pending;
          if (this.summaryBox && !this.summaryTouched) this.summaryBox.set_value(state.pending?.body ?? "");
          if (!state.pending) this.localDrafts.clear();
          const seen = new Set(threads.flatMap((t) => t.comments.map((c) => c.id)));
          for (const id of seen) this.localDrafts.delete(id);
          this.threads = this.published.threads(mergeDraftThreads(threads, [...this.localDrafts.values()]));
        }
      } catch (e) {
        if (request === this.latest) this.failure = failureOf(e).message;
      } finally {
        if (request === this.latest) {
          this.loading = false;
          cx2.notify();
        }
      }
    });
  }
  sync(cx) {
    if (this.notices.take().some((n) => n.repo === this.ref.repo && n.number === this.ref.number && n.threads?.on === this.on))
      this.dirty = true;
    if (this.dirty && !this.writing.size) {
      this.dirty = false;
      this.load(cx);
    }
  }
  status() {
    return div12().text_size(12).text_color(this.failure ? colors().blocked : colors().dim).child(this.failure ?? (this.loading ? "Loading discussions\u2026" : ""));
  }
  /** Count drafts without creating native elements; the viewport measures before describing visible rows. */
  inlineDraftCount(path, row) {
    let count = 0;
    for (const side of ["LEFT", "RIGHT"]) {
      const anchor = commentTarget(row, side);
      if (anchor && this.drafts.has(JSON.stringify([path, side, anchor.line]))) count++;
    }
    return count;
  }
  /** Called only for visible rows, in the ordinary render snapshot (not a native list callback). */
  inlineComposer(path, commit, row, width) {
    const gutters = {};
    const editors = [];
    for (const side of ["LEFT", "RIGHT"]) {
      const anchor = commentTarget(row, side);
      if (!anchor) continue;
      const key = JSON.stringify([path, side, anchor.line]);
      const draft = this.drafts.get(key);
      const busy = this.writing.size > 0;
      gutters[side === "LEFT" ? "left" : "right"] = button(
        `add-inline-${key}`,
        `${anchor.line} +`,
        `Add Comment on ${side} line ${anchor.line}`,
        (_e, cx) => {
          if (!this.drafts.has(key)) {
            const box = TextareaState2.new({ placeholder: "Leave a comment" });
            box.on("change", (_e2, cx2) => cx2.notify());
            this.drafts.set(key, { target: { path, commit, ...anchor }, box });
          }
          cx.notify();
        }
      ).p(0).text_size(12);
      if (!draft) continue;
      const t = colors();
      editors.push(
        v_flex8().w(width).h(COMPOSER_HEIGHT).p(12).gap(8).bg(t.surface).border_1().border_color(t.border).child(div12().text_size(12).text_color(t.dim).child(`${side} ${anchor.line}`)).child(commentEditor(draft.box, 90)).child(
          div12().text_size(12).text_color(t.blocked).child(this.failures.get(key) ?? "")
        ).child(
          h_flex9().gap(8).child(
            button(`post-inline-${key}`, busy ? "Saving\u2026" : "Add Comment", "Add Comment", (_e, cx) => {
              this.postInline(cx, key, false, commit);
            })
          ).when(
            !this.pending,
            (el) => el.child(
              button(
                `start-review-${key}`,
                busy ? "Saving\u2026" : "Start Review",
                "Start Review",
                (_e, cx) => this.postInline(cx, key, true, commit)
              )
            )
          ).child(
            button(`cancel-inline-${key}`, "Cancel", "Cancel", (_e, cx) => {
              if (this.writing.has(key)) return;
              this.drafts.delete(key);
              this.failures.delete(key);
              cx.notify();
            })
          )
        )
      );
    }
    return { gutters, editors };
  }
  postInline(cx, key, start, commit) {
    const draft = this.drafts.get(key);
    if (!draft?.box.value().trim()) return;
    const body = draft.box.value();
    this.write(cx, key, async () => {
      const state = await readPullReview(this.ref.repo, this.ref.number, this.on);
      this.pending = state.pending;
      if (start || state.pending) {
        const result = await addPullReviewComment(this.ref.repo, this.ref.number, draft.target, body, this.on);
        this.pending = result.pending;
        this.localDrafts.set(result.thread.root, result.thread);
        this.threads.push(result.thread);
      } else {
        const comment = await addPullComment(this.ref.repo, this.ref.number, draft.target, body, this.on);
        this.threads.push(
          this.published.add(comment, {
            path: draft.target.path,
            side: draft.target.side,
            line: draft.target.line,
            outdated: draft.target.commit !== commit
          })
        );
      }
      if (draft.box.value() === body) this.drafts.delete(key);
    });
  }
  /** The PR summary and inline drafts share one write lock and one GitHub pending review. */
  summary(commit) {
    const box = this.summaryBox;
    if (!box) return div12().text_size(12).text_color(colors().dim).child("Loading review\u2026");
    const busy = this.writing.size > 0;
    return v_flex8().gap(8).child(
      div12().font_semibold().child(this.pending ? "Pending review" : "Review")
    ).child(commentEditor(box, 120)).child(
      div12().text_size(12).text_color(colors().blocked).child(this.failures.get("summary") ?? "")
    ).child(
      h_flex9().gap(8).children(
        [
          ["COMMENT", "Comment"],
          ["APPROVE", "Approve"],
          ["REQUEST_CHANGES", "Request Changes"]
        ].map(
          ([event, label]) => button(`submit-review-${event}`, busy ? "Saving\u2026" : label, label, (_e, cx) => {
            if (busy || event === "REQUEST_CHANGES" && !box.value().trim() || event === "COMMENT" && !this.pending && !box.value().trim())
              return;
            this.submit(cx, commit, event, box);
          }).opacity(busy ? 0.5 : 1)
        )
      )
    );
  }
  submit(cx, commit, event, box) {
    const body = box.value();
    this.write(cx, "summary", async () => {
      const item = await submitPullReview(this.ref.repo, this.ref.number, commit, event, body, this.on);
      this.threads = this.published.submitted(item, this.threads);
      this.pending = null;
      this.localDrafts.clear();
      if (box.value() === body) {
        box.set_value("");
        this.summaryTouched = false;
      }
    });
  }
  /** Natural height is measured after layout, so short discussions do not reserve a large empty card. */
  card(thread, unavailable, width, onHeight) {
    return this.conversation(thread, unavailable, true).id(`diff-thread-${thread.id}`).w(width).when(Boolean(onHeight), (el) => el.on_size_change((size, cx) => onHeight?.(size.height, cx)));
  }
  /** Code and its conversation stay together in the review, without navigating away. */
  timeline(thread, snippet, open) {
    const hidden = this.hiddenSnippets.has(thread.id);
    const t = colors();
    return v_flex8().min_w(0).w_full().border_1().border_color(t.border).rounded(6).overflow_hidden().child(
      h_flex9().gap(8).items_center().px(12).py(6).border_b(1).border_color(t.border).child(
        button(`timeline-file-${thread.id}`, thread.path, "Open File Diff", (_e, cx) => open(cx)).text_color(
          t.accent
        )
      ).child(div12().flex_1()).when(
        Boolean(snippet),
        (el) => el.child(
          button(
            `snippet-toggle-${thread.id}`,
            hidden ? "Show" : "Hide",
            hidden ? "Show Diff" : "Hide Diff",
            (_e, cx) => {
              if (this.hiddenSnippets.has(thread.id)) this.hiddenSnippets.delete(thread.id);
              else this.hiddenSnippets.add(thread.id);
              cx.notify();
            }
          ).border_1().border_color(t.border).px(10).py(4)
        )
      )
    ).when(!hidden && Boolean(snippet), (el) => el.child(diffSnippet(`timeline-snippet-${thread.id}`, snippet))).child(this.conversation(thread, thread.outdated, false));
  }
  conversation(thread, unavailable, virtual) {
    const t = colors();
    const scope = virtual ? "diff" : "timeline";
    const box = this.boxes.get(thread.id);
    const busy = this.writing.size > 0;
    const url = `https://github.com/${this.ref.repo}/pull/${this.ref.number}#discussion_r${thread.root}`;
    return v_flex8().flex_none().min_w(0).p(12).gap(8).when(virtual, (el) => el.border_1().border_color(t.border).bg(t.surface)).when(
      virtual,
      (el) => el.child(
        h_flex9().gap(10).items_center().child(
          div12().font_medium().child(thread.resolved ? "Resolved" : "Discussion")
        ).child(
          div12().text_size(12).text_color(t.dim).child(`${thread.side} ${thread.line ?? ""}`)
        ).child(link(`thread-browser-${thread.id}`, url, "Open on GitHub").text_size(12).text_color(t.accent))
      )
    ).when(!virtual && thread.resolved, (el) => el.child(div12().text_size(12).text_color(t.done).child("Resolved"))).when(
      unavailable,
      (el) => el.child(
        div12().text_size(12).text_color(t.dim).child(
          thread.outdated ? "Outdated \u2014 this discussion is no longer in the current diff." : "This discussion is not attached to a line in the available diff."
        )
      )
    ).child(
      v_flex8().id(`${scope}-thread-comments-${thread.id}`).when(virtual, (el) => el.flex_none().max_h(240).overflow_y_scrollbar()).children(
        thread.comments.map(
          (c, index2) => postCard(
            `${scope}-comment-${c.id}`,
            c,
            c.draft ? "Pending" : "commented",
            (url2, cx) => openLink(cx, this.host, url2, `https://github.com/${this.ref.repo}/pull/${this.ref.number}`),
            { embedded: true }
          ).when(index2 > 0, (el) => el.border_t(1).border_color(t.border))
        )
      )
    ).when(
      Boolean(box),
      (el) => el.child(
        v_flex8().flex_none().min_w(0).border_t(1).border_color(t.border).pt(12).child(commentEditor(box, 80))
      )
    ).when(
      this.failures.has(thread.id),
      (el) => el.child(
        div12().text_size(12).text_color(t.blocked).child(this.failures.get(thread.id) ?? "")
      )
    ).child(
      h_flex9().gap(8).child(
        button(
          `${scope}-reply-${thread.id}`,
          busy ? "Saving\u2026" : box ? "Comment" : "Reply",
          "Reply to discussion",
          (_e, cx) => {
            if (busy) return;
            if (!box) {
              const input = TextareaState2.new({ placeholder: "Reply\u2026" });
              input.on("change", (_e2, cx2) => cx2.notify());
              this.boxes.set(thread.id, input);
              cx.notify();
              return;
            }
            const body = box.value();
            if (!body.trim()) return;
            this.write(cx, thread.id, async () => {
              const comment = await replyPullReviewThread(
                this.ref.repo,
                this.ref.number,
                thread.id,
                thread.root,
                body,
                this.on
              );
              if (comment.draft) this.localDrafts.set(comment.id, { ...thread, comments: [comment] });
              if (!thread.comments.some((c) => c.id === comment.id)) thread.comments.push(comment);
              if (box.value() === body) box.set_value("");
            });
          }
        )
      ).when(
        Boolean(box),
        (el) => el.child(
          button(`${scope}-cancel-reply-${thread.id}`, "Cancel", "Cancel reply", (_e, cx) => {
            if (this.writing.size) return;
            this.boxes.delete(thread.id);
            this.failures.delete(thread.id);
            cx.notify();
          }).opacity(busy ? 0.5 : 1)
        )
      ).when(
        thread.resolved ? thread.canUnresolve : thread.canResolve,
        (el) => el.child(
          button(
            `${scope}-resolve-${thread.id}`,
            busy ? "Saving\u2026" : thread.resolved ? "Unresolve Conversation" : "Resolve Conversation",
            "Change discussion resolution",
            (_e, cx) => {
              this.write(
                cx,
                thread.id,
                async () => Object.assign(
                  thread,
                  await resolvePullThread(this.ref.repo, this.ref.number, thread.id, !thread.resolved, this.on)
                )
              );
            }
          )
        )
      )
    );
  }
  write(cx, key, act) {
    if (this.writing.size) {
      this.failures.set(key, "Another update is in progress.");
      cx.notify();
      return;
    }
    this.latest++;
    this.loading = false;
    this.writing.add(key);
    this.failures.delete(key);
    cx.notify();
    cx.spawn(async (cx2) => {
      try {
        await act();
      } catch (e) {
        this.failures.set(key, failureOf(e).message);
      } finally {
        this.writing.delete(key);
        this.dirty = true;
        cx2.notify();
      }
    });
  }
};

// src/github/views/diff.ts
var FileDiff = class {
  file = null;
  rows = [];
  width = 0;
  offset = 0;
  target = null;
  viewportWidth = 320;
  viewportHeight = 400;
  totalHeight = 0;
  threadHeights = /* @__PURE__ */ new Map();
  drag = null;
  init() {
    this.offset = 0;
  }
  jump(comment) {
    this.target = comment;
    this.offset = 0;
  }
  scrollTo(next, cx) {
    const offset = Math.max(0, Math.min(next, this.totalHeight - this.viewportHeight));
    if (offset === this.offset) return;
    this.offset = offset;
    cx.notify();
  }
  render(file, discussions, commit) {
    const t = colors();
    if (this.file !== file) {
      this.file = file;
      this.rows = parsePatch(file.patch ?? "");
      this.width = this.rows.reduce((width, row) => Math.max(width, row.text.length * 16 + 152), 240);
    }
    const rows = this.rows;
    const cardWidth = Math.max(240, this.viewportWidth - 12);
    const items = [];
    const threads = (discussions?.threads ?? []).filter((thread) => thread.path === file.path);
    const anchors = /* @__PURE__ */ new Map();
    for (const thread of threads) {
      const row = threadRow(rows, thread);
      const group = anchors.get(row) ?? [];
      group.push(thread);
      anchors.set(row, group);
    }
    const appendThreads = (row) => {
      for (const thread of anchors.get(row) ?? []) {
        items.push({
          key: thread.id,
          height: this.threadHeights.get(thread.id) ?? THREAD_ESTIMATE,
          render: () => discussions.card(thread, row === null, cardWidth, (height, cx) => {
            const measured = Math.ceil(height);
            if (measured <= 0 || this.threadHeights.get(thread.id) === measured) return;
            this.threadHeights.set(thread.id, measured);
            cx.notify();
          }),
          commentIds: thread.comments.map((c) => c.id)
        });
      }
    };
    rows.forEach((row, index2) => {
      const count = commit ? discussions?.inlineDraftCount(file.path, row) ?? 0 : 0;
      const height = ROW_HEIGHT + count * COMPOSER_HEIGHT;
      items.push({
        key: `line-${index2}`,
        height,
        render: () => {
          const comment = commit ? discussions?.inlineComposer(file.path, commit, row, cardWidth) : void 0;
          return v_flex9().h(height).flex_none().child(diffRow(row, comment?.gutters)).children(comment?.editors ?? []);
        }
      });
      appendThreads(index2);
    });
    appendThreads(null);
    const sizes = items.map((item) => item.height);
    if (this.target !== null) {
      const index2 = items.findIndex((item) => item.commentIds?.includes(this.target));
      if (index2 >= 0) {
        const top = sizes.slice(0, index2).reduce((sum, height) => sum + height, 0);
        this.offset = top - Math.max(0, (this.viewportHeight - sizes[index2]) / 2);
        this.target = null;
      }
    }
    const visible = itemWindow(sizes, this.offset, this.viewportHeight);
    this.offset = visible.offset;
    this.totalHeight = visible.total;
    const maxOffset = Math.max(0, visible.total - this.viewportHeight);
    const thumbHeight = Math.min(
      this.viewportHeight,
      Math.max(28, this.viewportHeight ** 2 / Math.max(1, visible.total))
    );
    const travel = this.viewportHeight - thumbHeight;
    const thumbTop = maxOffset > 0 ? this.offset / maxOffset * travel : 0;
    const id = `pull-diff-${file.path}`;
    const header = v_flex9().flex_none().px(16).py(8).gap(6).border_b(1).border_color(t.border).child(
      h_flex10().gap(10).items_center().flex_wrap().child(div13().min_w(0).font_medium().child(file.path)).child(div13().text_color(t.done).child(`+${file.additions}`)).child(div13().text_color(t.blocked).child(`\u2212${file.deletions}`)).child(link(`${id}-browser`, file.url, "Open File on GitHub").text_size(12).text_color(t.accent))
    ).when(
      file.previousPath !== null,
      (el) => el.child(div13().text_size(12).text_color(t.dim).child(`Renamed from ${file.previousPath}`))
    );
    const body = items.length > 0 ? div13().id(`${id}-body`).flex_1().min_h(0).min_w(0).relative().overflow_hidden().on_size_change((size, cx) => {
      if (size.width > 0 && size.height > 0 && (size.width !== this.viewportWidth || size.height !== this.viewportHeight)) {
        this.viewportWidth = size.width;
        this.viewportHeight = size.height;
        cx.notify();
      }
    }).on_scroll_wheel((event, cx) => {
      if (event.delta.y && Math.abs(event.delta.y) >= Math.abs(event.delta.x)) {
        this.scrollTo(this.offset - event.delta.y, cx);
        cx.stop_propagation();
      }
    }).on_mouse_move((event, cx) => {
      if (this.drag && travel > 0)
        this.scrollTo(this.drag.offset + (event.position.y - this.drag.y) * maxOffset / travel, cx);
    }).on_mouse_up("left", () => {
      this.drag = null;
    }).on_hover((hovered) => {
      if (!hovered) this.drag = null;
    }).child(
      div13().id(`${id}-horizontal`).absolute().top_0().bottom_0().left_0().right(12).overflow_x_scrollbar().child(
        div13().relative().h_full().w(Math.max(this.width, cardWidth)).overflow_hidden().child(
          v_flex9().absolute().top(visible.top - visible.offset).left_0().w_full().children(
            items.slice(visible.start, visible.end).map(
              (item) => div13().id(`${id}-${item.key}`).h(item.height).flex_none().child(item.render())
            )
          )
        )
      )
    ).when(
      maxOffset > 0,
      (el) => el.child(
        div13().id(`${id}-scrollbar`).absolute().top_0().bottom_0().right_0().w(12).cursor_pointer().accessibility_label("Diff vertical scrollbar").on_mouse_down("left", (event, cx) => {
          cx.stop_propagation();
          const y = event.local_position?.y;
          if (y === void 0 || travel <= 0) return;
          if (y < thumbTop || y > thumbTop + thumbHeight)
            this.scrollTo((y - thumbHeight / 2) / travel * maxOffset, cx);
          this.drag = { y: event.position.y, offset: this.offset };
        }).child(div13().absolute().top(thumbTop).right(2).w(8).h(thumbHeight).rounded(4).bg(t.dim))
      )
    ) : div13().p(20).text_color(t.dim).child(
      file.additions === 0 && file.deletions === 0 ? "No textual changes in this file. Open it on GitHub to view the full file." : "GitHub did not provide a patch for this file (it may be binary or too large). Open it on GitHub to view the changes."
    );
    return v_flex9().id(`${id}-viewport`).flex_1().min_h(0).min_w(0).overflow_hidden().child(header).when(Boolean(discussions), (el) => el.child(discussions.status())).when(
      Boolean(discussions) && !commit,
      (el) => el.child(
        div13().px(16).text_size(12).text_color(t.dim).child("Inline comments are unavailable until pull request details finish loading.")
      )
    ).when(
      !file.patch && file.status !== "unchanged" && items.length > 0,
      (el) => el.child(
        div13().p(12).text_color(t.dim).child("GitHub did not provide a patch for this file. Discussions are shown below.")
      )
    ).child(body);
  }
};

// src/github/views/pull-timeline.ts
import { h_flex as h_flex11, TextView as TextView2, v_flex as v_flex10 } from "gpui-base";
import { div as div14 } from "gpui-kit";
function timelineItem(item, discussions, onLink, open, activity) {
  const t = colors();
  if (item.kind === "event") {
    return v_flex10().id(`pull-activity-${item.id}`).min_w(0).gap(6).px(16).py(8).text_size(12).child(
      h_flex11().min_w(0).gap(8).items_center().child(div14().flex_none().text_color(t.dim).child("\u25C7")).child(div14().min_w(0).truncate().font_semibold().tooltip(item.author).child(item.author)).child(div14().flex_none().text_color(t.dim).child(item.verb)).child(div14().flex_1()).child(
        div14().flex_none().text_color(t.dim).tooltip(item.createdAt).child(relativeTime(item.createdAt, Date.now()))
      )
    ).when(
      Boolean(item.body.trim()) || Boolean(item.details),
      (el) => el.child(
        v_flex10().min_w(0).pl(20).gap(6).when(
          Boolean(item.body.trim()),
          (el2) => el2.child(
            TextView2.markdown(`pull-activity-body-${item.id}`, item.markdown).selectable(true).scrollable(false).on_link_click(onLink)
          )
        ).when(
          Boolean(item.details && activity),
          (el2) => el2.child(
            button(
              `pull-activity-toggle-${item.id}`,
              activity?.expanded ? "Hide" : "Show",
              activity?.expanded ? "Hide Commit Details" : "Show Commit Details",
              (_e, cx) => activity?.toggle(cx)
            ).self_start().text_color(t.accent)
          )
        ).when(
          Boolean(item.details && activity?.expanded),
          (el2) => el2.child(
            TextView2.markdown(`pull-activity-details-${item.id}`, item.details.markdown).selectable(true).scrollable(false).on_link_click(onLink)
          )
        )
      )
    );
  }
  if (item.kind === "comment") return postCard(`pull-comment-${item.id}`, item, item.verb, onLink);
  const roots = item.discussion.filter((d) => d.root === d.comment.id);
  return v_flex10().id(`pull-review-${item.id}`).min_w(0).w_full().border_1().border_color(t.border).rounded(8).overflow_hidden().child(
    postCard(`pull-review-header-${item.id}`, item, item.verb, onLink, {
      embedded: true,
      headingOnly: !item.body.trim()
    })
  ).when(
    roots.length > 0,
    (el) => el.child(
      v_flex10().min_w(0).p(12).gap(12).children(
        roots.map((d) => {
          const thread = discussions?.threads.find((thread2) => thread2.root === d.root);
          if (thread && discussions)
            return discussions.timeline(thread, d.snippet, (cx) => open(cx, d.path, d.root));
          return v_flex10().min_w(0).border_1().border_color(t.border).rounded(6).overflow_hidden().child(
            button(
              `inline-jump-${d.root}`,
              d.path,
              "Open File Diff",
              (_e, cx) => open(cx, d.path, d.root)
            ).text_color(t.accent)
          ).when(Boolean(d.snippet), (el2) => el2.child(diffSnippet(`inline-snippet-${d.root}`, d.snippet))).children(
            item.discussion.filter((reply) => reply.root === d.root).map(
              (reply, index2) => postCard(`inline-${reply.comment.id}`, reply.comment, "commented", onLink, {
                embedded: true
              }).when(index2 > 0, (el2) => el2.border_t(1).border_color(t.border))
            )
          );
        })
      )
    )
  );
}

// src/github/views/pull.ts
var REVIEWS = {
  requested: { label: "Awaiting requested review", icon: "\u25CB", color: "dim" },
  approved: { label: "Approved these changes", icon: "\u2713", color: "done" },
  changes_requested: { label: "Requested changes", icon: "\xD7", color: "blocked" },
  commented: { label: "Left review comments", icon: "\u25C7", color: "dim" },
  dismissed: { label: "Review dismissed", icon: "\u2212", color: "dim" }
};
var Pull = class {
  ref = null;
  entry = null;
  files = null;
  selected = null;
  diff = new FileDiff();
  discussions = null;
  notices = new Notices();
  missingFile = null;
  expandedActivity = /* @__PURE__ */ new Set();
  init() {
    this.diff.init();
  }
  host;
  metadata = new DetailMetadata();
  constructor(host) {
    this.host = host;
  }
  show(cx, ref) {
    this.metadata.expanded = false;
    this.ref = ref;
    this.entry = null;
    this.files = null;
    this.discussions = null;
    this.missingFile = null;
    this.expandedActivity.clear();
    this.diff.jump(null);
    this.selected = null;
    this.load(cx);
  }
  /** A sidebar file command changes this view even when the PR identity did not change. */
  select(cx, path, comment = null) {
    this.selected = path;
    this.diff.jump(comment);
    if (path !== null) this.files?.load(cx);
    cx.notify();
  }
  load(cx, refreshRelated = true) {
    const ref = this.ref;
    const place = detailLocation(this.host.reader);
    if (!ref || !place || !this.host.active("pr")) return;
    this.discussions ??= new ReviewThreads(ref, place.on, this.host);
    if (refreshRelated) this.discussions.load(cx);
    this.files ??= new ChangedFiles(`reader-${this.host.reader}`, ref, place.on, (cx2, path) => this.select(cx2, path));
    if (refreshRelated && this.selected !== null) this.files.load(cx, true);
    const entry = { pull: this.entry?.pull, loading: true, projectsLoading: false };
    this.entry = entry;
    cx.spawn(async (cx2) => {
      const current = () => this.entry === entry && this.host.active("pr");
      try {
        await signedIn(place.on);
        if (!current()) return;
        const pull = await readPull(ref.repo, ref.number, place.on);
        if (!current()) return;
        entry.pull = pull;
        entry.projectsLoading = true;
        cx2.spawn(async (cx3) => {
          const projects2 = await readProjects(ref, place.on);
          if (!current()) return;
          entry.projects = projects2;
          entry.projectsLoading = false;
          cx3.notify();
        });
      } catch (e) {
        if (current()) {
          const failure = failureOf(e);
          entry.failure = failure.notFound ? notVisible(ref) : failure.message;
        }
      } finally {
        if (current()) {
          entry.loading = false;
          cx2.notify();
        }
      }
    });
  }
  render(cx, layout2) {
    const on = detailLocation(this.host.reader)?.on;
    if (this.notices.take().some((n) => n.repo === this.ref?.repo && n.number === this.ref.number && n.threads?.on === on && n.threads))
      this.load(cx, false);
    this.files?.sync(cx);
    this.discussions?.sync(cx);
    const ref = this.ref;
    const entry = this.entry;
    if (!ref) return [detailEmpty("pr")];
    const pull = entry?.pull;
    return [
      detailHeader(
        this.host,
        ref,
        { title: pull?.title, url: pull?.url, loading: Boolean(entry?.loading) },
        (cx2) => this.load(cx2)
      ),
      ...this.selected !== null ? [
        h_flex12().flex_none().px(24).pb(8).child(
          button(
            "pull-description",
            "Description",
            "Show pull request description",
            (_e, cx2) => this.select(cx2, null)
          ).text_color(colors().accent)
        )
      ] : [],
      this.selected !== null ? this.fileView() : detailBody(ref, Boolean(entry?.loading), entry?.failure, pull ? this.document(pull, layout2) : null)
    ];
  }
  fileView() {
    const file = this.files?.files?.find((f) => f.path === this.selected);
    if (file)
      return v_flex11().flex_1().min_h(0).child(
        h_flex12().px(16).gap(8).items_center().child(this.files.viewedButton(file)).child(
          div15().text_size(12).child(file.viewed ? "Viewed" : "Not viewed")
        ).when(
          Boolean(this.files?.failure),
          (el) => el.child(
            div15().text_color(colors().blocked).child(this.files?.failure ?? "")
          )
        )
      ).child(this.diff.render(file, this.discussions ?? void 0, this.entry?.pull?.headSha));
    if (this.selected && this.files?.files && this.discussions?.threads.some((thread) => thread.path === this.selected)) {
      if (this.missingFile?.path !== this.selected)
        this.missingFile = {
          path: this.selected,
          previousPath: null,
          status: "unchanged",
          additions: 0,
          deletions: 0,
          patch: null,
          viewed: false,
          url: this.entry?.pull?.url ?? `https://github.com/${this.ref?.repo}/pull/${this.ref?.number}`
        };
      return v_flex11().flex_1().min_h(0).child(quiet("This file is no longer in the changed-files list. Its discussions are shown below.")).child(this.diff.render(this.missingFile, this.discussions));
    }
    const failure = this.files?.failure ?? this.discussions?.failure;
    const message = failure ?? (this.files?.loading ? "Loading changed files\u2026" : "This file is not in the changed-files list. Choose another file in the GitHub sidebar or refresh.");
    return v_flex11().flex_1().min_h(0).p(24).gap(8).child(
      div15().text_color(failure ? colors().blocked : colors().dim).child(message)
    ).when(
      !this.files?.loading,
      (el) => el.child(
        button("pull-files-retry", failure ? "Retry" : "Refresh", "Load changed files again", (_e, cx) => {
          this.files?.load(cx, true);
          cx.notify();
        })
      )
    );
  }
  document(pull, layout2) {
    const t = colors();
    const state = PULL_STATES[pull.state];
    const onLink = (url, cx) => openLink(cx, this.host, url, pull.url);
    const merged = pull.state === "merged" ? "merged changes" : "wants to merge changes";
    return detailDocument(
      layout2,
      [
        stateBadge(state.label, state.color(t), state.icon),
        div15().text_size(13).child(`${pull.author} ${merged} into ${pull.base} from ${pull.head}`)
      ],
      [
        postCard("pull-body", pull, "opened this pull request", onLink),
        // Discussion metadata is fetched once per PR; report its progress/failure once, not per thread.
        ...this.discussions?.loading || this.discussions?.failure ? [this.discussions.status()] : [],
        ...(this.discussions?.published.timeline(pull.timeline ?? []) ?? pull.timeline ?? []).map((item) => {
          const key = JSON.stringify([item.author, item.createdAt, item.body]);
          return timelineItem(item, this.discussions, onLink, (cx, path, comment) => this.select(cx, path, comment), {
            expanded: this.expandedActivity.has(key),
            toggle: (cx) => {
              if (this.expandedActivity.has(key)) this.expandedActivity.delete(key);
              else this.expandedActivity.add(key);
              cx.notify();
            }
          });
        }),
        v_flex11().gap(10).child(div15().font_semibold().child("Checks")).when(!pull.checks?.length, (el) => el.child(quiet("No checks reported"))).children(
          (pull.checks ?? []).map(
            (c) => c.url ? link(c.id, c.url, `${c.name} \xB7 ${c.status} \xB7 ${c.duration}`).text_color(t.accent) : quiet(`${c.name} \xB7 ${c.status} \xB7 ${c.duration}`)
          )
        ),
        ...this.discussions ? [this.discussions.summary(pull.headSha)] : []
      ],
      [
        ["Reviewers", this.reviewers(pull)],
        ["Assignees", people(pull.assignees, "None yet")],
        ["Labels", labels(pull.labels), pull.labels.length],
        ["Project", projects(this.entry?.projects, Boolean(this.entry?.projectsLoading))],
        ["Milestone", milestone(pull.milestone)]
      ],
      this.metadata
    );
  }
  reviewers(pull) {
    const t = colors();
    if (pull.reviewers.length === 0) return quiet("None yet");
    return v_flex11().gap(8).children(
      pull.reviewers.map((r) => {
        const state = REVIEWS[r.state];
        return h_flex12().gap(8).items_center().tooltip(state.label).accessibility_label(`${r.name}: ${state.label}`).child(
          div15().flex_1().min_w(0).text_size(13).child(`${r.name}${r.team ? " (team)" : ""}`)
        ).child(div15().text_color(t[state.color]).child(state.icon));
      })
    );
  }
};

// src/github/views/reader.ts
var WIDE = 820;
var COMPACT = 480;
var Reader = class {
  navigation = new DetailNavigation();
  issue;
  pull;
  layout = "compact";
  reader;
  checkingEmpty = false;
  constructor() {
    this.reader = typeof props3()?.reader === "string" ? props3().reader : "";
    const navigation = this.navigation;
    const host = {
      reader: this.reader,
      active: (kind) => navigation.ref?.kind === kind,
      previous: () => navigation.previous,
      follow: (cx, ref) => {
        if (navigation.follow(ref)) this.show(cx, ref);
      },
      back: (cx) => {
        const ref = navigation.back();
        if (ref) this.show(cx, ref);
      }
    };
    this.issue = new Issue(host);
    this.pull = new Pull(host);
  }
  /** The role the tab was opened with, until it shows something. */
  initial() {
    return props3()?.role === "pr" ? "pr" : "issue";
  }
  init(cx) {
    this.issue.init(cx);
    this.pull.init();
    cx.spawn(async (cx2) => {
      for (; ; ) {
        const ref = detailCommand(await nextCommand(), this.reader);
        if (ref) {
          if (this.navigation.open(ref)) this.show(cx2, ref);
          if (ref.kind === "pr") this.pull.select(cx2, ref.file ?? null);
        }
      }
    });
  }
  /** Show `ref` here: the tab is now named after it, and the sidebar finds it here. */
  show(cx, ref) {
    navigatedDetail(this.reader, ref);
    if (ref.kind === "issue") this.issue.show(cx, ref);
    else this.pull.show(cx, ref);
    cx.notify();
  }
  render(cx) {
    if (this.reader) readyDetail(this.reader);
    if (!this.navigation.ref && !this.checkingEmpty && detailLocation(this.reader)?.visible) {
      this.checkingEmpty = true;
      cx.timer.after(1e3, () => {
        this.checkingEmpty = false;
        if (!this.navigation.ref) closeEmptyDetail(this.reader);
      });
    }
    const t = colors();
    const kind = this.navigation.ref?.kind ?? this.initial();
    return v_flex12().id("reader").size_full().min_h(0).overflow_hidden().bg(t.background).text_color(t.foreground).text_size(14).on_size_change((size, cx2) => {
      const layout2 = size.width >= WIDE ? "wide" : size.width >= COMPACT ? "narrow" : "compact";
      if (layout2 !== this.layout) {
        this.layout = layout2;
        cx2.notify();
      }
    }).children(kind === "pr" ? this.pull.render(cx, this.layout) : this.issue.render(cx, this.layout));
  }
};

// src/github/main.ts
var ROLES = { panel: Panel, issue: Reader, pr: Reader, pane: Pane };
var GitHub = class extends View {
  role = null;
  init(p, cx) {
    const Role = ROLES[(props4() ?? p)?.role ?? "panel"];
    this.role = Role ? new Role() : null;
    this.role?.init(cx);
  }
  render(cx) {
    return this.role ? this.role.render(cx) : `github: unknown role ${JSON.stringify(props4()?.role)}`;
  }
};
export {
  GitHub as default
};
