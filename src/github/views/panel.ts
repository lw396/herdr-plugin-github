// The panel role: where the focused folder is, which gh talks to GitHub, and its repository.
import { div, type AsyncContext, type Context, type Color, type Element } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay } from "herdr";
import { location, locationKey } from "../io/context.ts";
import * as gh from "../io/gh.ts";
import { githubRemote } from "../io/git.ts";
import type { RemoteRepo } from "../core/remote.ts";
import { describeAccount } from "../core/account.ts";
import { colors, stop, type Role } from "./ui.ts";

export class Panel implements Role {
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
        // git and gh both where the folder is (ADR 0003).
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

  render(cx: Context): Element {
    // Follow the focused folder: live data re-renders us, so compare here.
    if (locationKey() !== this.context && !this.loading) this.refresh(cx);
    const t = colors(), where = location(), overlay: string | undefined = props()?.overlay;
    const line = (label: string, value: string, color: Color = t.foreground, wrap = false) =>
      h_flex().gap(8).items_start()
        .child(div().w(64).flex_none().text_color(t.dim).child(label))
        .child(div().flex_1().min_w(0).when(!wrap, (el) => el.truncate()).text_color(color).child(value));
    // A problem with gh says what to do on which machine: wrap it rather than cut it off.
    const account = this.account ? describeAccount(this.account) : { ok: true, text: "checking…" };
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
        .child(line("gh", account.text, account.ok ? t.foreground : t.blocked, !account.ok))
        .child(line("remote", this.remote ? `${this.remote.owner}/${this.remote.repo} (${this.remote.remote})` : this.loading ? "…" : "no GitHub remote"))
        .child(line("repo", this.repo ?? (this.loading ? "…" : "—")))
        .when(Boolean(this.error), (el) => el.child(div().pt(6).text_size(12).text_color(t.blocked).child(this.error ?? ""))));
  }
}
