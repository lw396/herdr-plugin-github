// GitHub for Herdr: one mod, a role per props().role (see ROLES). Default: panel.
import { View, div, type AsyncContext, type Context, type Color, type Element } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay } from "herdr";
import { location, locationKey } from "./context.ts";
import { colors, stop } from "./ui.ts";
import * as gh from "./gh.ts";
import { githubRemote } from "./git.ts";
import type { RemoteRepo } from "./remote.ts";

interface Role {
  init(cx: AsyncContext): void;
  render(cx: Context): Element;
}

class Panel implements Role {
  context: string | null = null;
  account: gh.Account | null = null;
  remote: RemoteRepo | null = null;
  repo: string | null = null;
  error: string | null = null;
  loading = false;

  init(cx: AsyncContext): void {
    this.refresh(cx);
  }

  refresh(cx: Context): void {
    if (this.loading) return;
    const where = location(), context = locationKey();
    this.context = context;
    this.loading = true;
    this.error = null;
    cx.spawn(async (cx) => {
      try {
        // git where the folder is; GitHub through the gh account() picks (this computer's first).
        const [account, remote] = await Promise.all([gh.account(where.on), githubRemote(where)]);
        if (locationKey() !== context) return;
        this.account = account;
        this.remote = remote;
        this.repo = null;
        if (account.status.ok && remote) {
          this.repo = await gh.apiText(`repos/${remote.owner}/${remote.repo}`, ".full_name", { on: account.on });
        }
      } catch (e) {
        if (locationKey() !== context) return;
        const r = this.remote;
        this.error = e instanceof gh.GhError && e.notFound && r
          ? `${r.owner}/${r.repo} (remote "${r.remote}") doesn't exist on GitHub, or ${this.account?.status.ok ? this.account.status.user : "this account"} can't see it. Check git remote -v.`
          : e instanceof Error ? e.message : String(e);
      } finally {
        this.loading = false;
        cx.notify();
      }
    });
  }

  authText(): string {
    const auth = this.account?.status;
    if (!auth) return "checking…";
    if (auth.ok) return `signed in as ${auth.user}` + (this.account?.on ? ` (gh on ${this.account.on})` : "");
    if (auth.reason === "missing") return "not installed";
    if (auth.reason === "auth") return "not signed in (gh auth login)";
    return auth.message;
  }

  render(cx: Context): Element {
    // Follow the focused folder: live data re-renders us, so compare here.
    if (locationKey() !== this.context && !this.loading) this.refresh(cx);
    const t = colors(), where = location(), overlay: string | undefined = props()?.overlay;
    const line = (label: string, value: string, color: Color = t.foreground) =>
      h_flex().gap(8)
        .child(div().w(64).flex_none().text_color(t.dim).child(label))
        .child(div().flex_1().min_w(0).truncate().text_color(color).child(value));
    const button = (id: string, label: string, onClick: (e: unknown, cx: Context) => void) =>
      div().id(id).px(6).py(2).rounded(6).text_size(12).text_color(t.dim).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
        .on_mouse_down("left", stop).on_click(onClick).child(label);

    // A card like Herdr's Files and Changes panels; a window overlay gets Herdr's own frame instead.
    return v_flex().id("github").size_full().min_h(0).overflow_hidden().bg(t.background).text_color(t.foreground).text_size(13)
      .when(!overlay, (el) => el.rounded(10).border_1().border_color(t.border))
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child("GitHub"))
        .child(div().flex_1().min_w(0).truncate().text_right().text_size(12).text_color(t.dim).child(this.repo ?? ""))
        .child(button("gh-refresh", this.loading ? "…" : "↻", (_e, cx) => this.refresh(cx)))
        .when(Boolean(overlay), (el) => el.child(button("gh-close", "×", () => closeOverlay(overlay!)))))
      .child(v_flex().p(14).gap(6)
        .child(line("folder", where.cwd ?? "none"))
        .child(line("machine", where.on ?? "this computer"))
        .child(line("gh", this.authText(), this.account && !this.account.status.ok ? t.blocked : t.foreground))
        .child(line("remote", this.remote ? `${this.remote.owner}/${this.remote.repo} (${this.remote.remote})` : this.loading ? "…" : "no GitHub remote"))
        .child(line("repo", this.repo ?? (this.loading ? "…" : "—")))
        .when(Boolean(this.error), (el) => el.child(div().pt(6).text_size(12).text_color(t.blocked).child(this.error ?? ""))));
  }
}

const ROLES: Record<string, new () => Role> = { panel: Panel };

export default class GitHub extends View {
  role: Role | null = null;

  override init(p: { role?: string } | undefined, cx: AsyncContext): void {
    const Role = ROLES[(props() ?? p ?? {}).role ?? "panel"];
    this.role = Role ? new Role() : null;
    this.role?.init(cx);
  }

  override render(cx: Context): Element | string {
    return this.role ? this.role.render(cx) : `github: unknown role ${JSON.stringify(props()?.role)}`;
  }
}
