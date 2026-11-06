// The panel role (the sidebar): the current repository's lists, starting with Issues.
import { div, type AsyncContext, type Context, type Element } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay } from "herdr";
import { location, locationKey } from "../io/context.ts";
import * as gh from "../io/gh.ts";
import * as known from "../io/known.ts";
import type { RemoteRepo } from "../core/remote.ts";
import { describeAccount } from "../core/account.ts";
import { issuesNotice, type Issue, type IssueGroup } from "../core/issues.ts";
import { relativeTime } from "../core/time.ts";
import { colors, stop, type Role } from "./ui.ts";

export class Panel implements Role {
  /** The place shown (locationKey()), and which refresh is the latest: older ones drop their results. */
  context: string | null = null;
  latest = 0;
  // undefined: not known yet for this place.
  account: gh.Account | undefined;
  remote: RemoteRepo | null | undefined;
  assigned: IssueGroup | undefined;
  failure: { notFound: boolean; message: string } | undefined;
  loading = false;
  /** The row under the pointer (its issue number): it shows its actions. */
  hovered: number | null = null;

  init(cx: AsyncContext): void {
    this.refresh(cx);
  }

  /** Shows what is known about the focused place at once, then asks for what is stale (all of it when `force`, ↻). */
  refresh(cx: Context, force = false): void {
    const where = location(), run = ++this.latest, current = () => run === this.latest;
    this.context = JSON.stringify(where);
    // Never the previous place's facts: this place's known ones, or "…" until they arrive.
    this.account = known.peekAccount(where.on);
    this.remote = known.peekRemote(where);
    const status = this.account?.status;
    this.assigned = this.remote && status?.ok ? known.peekAssigned(this.remote, status.user, where.on) : undefined;
    this.failure = undefined;
    this.loading = true;
    cx.spawn(async (cx) => {
      try {
        // git and gh both where the folder is (ADR 0003). account() never rejects: show its
        // status even when git fails there.
        const [account, remote] = await Promise.all([
          known.account(where.on, force).then((a) => {
            if (current()) this.account = a;
            return a;
          }),
          known.remote(where, force),
        ]);
        if (!current()) return;
        this.remote = remote;
        if (!account.status.ok || !remote) return;
        const assigned = await known.assigned(remote, account.status.user, account.on, force);
        if (current()) this.assigned = assigned;
      } catch (e) {
        if (!current()) return;
        this.failure = { notFound: e instanceof gh.GhError && e.notFound, message: e instanceof Error ? e.message : String(e) };
      } finally {
        if (current()) {
          this.loading = false;
          cx.notify();
        }
      }
    });
  }

  render(cx: Context): Element {
    // Follow the focused folder: live data re-renders us, so compare here.
    if (locationKey() !== this.context) this.refresh(cx);
    const t = colors(), where = location(), overlay: string | undefined = props()?.overlay;
    const button = (id: string, label: string, tip: string, onClick: (e: unknown, cx: Context) => void) =>
      div().id(id).px(6).py(2).rounded(6).text_size(12).text_color(t.dim).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
        .tooltip(tip).on_mouse_down("left", stop).on_click(onClick).child(label);
    const repo = this.remote ? `${this.remote.owner}/${this.remote.repo}` : "";
    const notice = issuesNotice({ account: this.account, remote: this.remote, group: this.assigned, failure: this.failure });

    const row = (issue: Issue) => {
      const hovered = this.hovered === issue.number;
      return h_flex().id(`issue-${issue.number}`).h(28).px(8).gap(8).items_center().rounded(6).hover((s) => s.bg(t.hover))
        .on_hover((h, cx) => {
          if (h) this.hovered = issue.number;
          else if (this.hovered === issue.number) this.hovered = null;
          cx.notify();
        })
        .child(div().flex_none().text_color(t.dim).child(`#${issue.number}`))
        .child(div().flex_1().min_w(0).truncate().child(issue.title))
        .when(!hovered, (el) => el
          .child(div().flex_none().max_w(90).truncate().text_size(12).text_color(t.dim).child(issue.assignees.join(", ")))
          .child(div().flex_none().w(28).text_right().text_size(12).text_color(t.dim).child(relativeTime(issue.updatedAt, Date.now()))))
        .when(hovered, (el) => el
          .child(button(`copy-${issue.number}`, "#", `Copy #${issue.number}`, (_e, cx) => cx.write_to_clipboard(`#${issue.number}`)))
          .child(button(`open-${issue.number}`, "↗", "Open in browser", (_e, cx) => cx.open_url(issue.url))));
    };

    const group = (title: string, g: IssueGroup | undefined) =>
      v_flex().gap(1)
        .child(h_flex().h(26).px(8).gap(6).items_center().text_size(12).text_color(t.dim)
          .child("▾").child(div().font_medium().child(title))
          .child(div().child(g ? String(g.total) : this.loading ? "…" : "")))
        .when(Boolean(g && g.issues.length === 0), (el) => el.child(div().px(8).py(4).text_size(12).text_color(t.dim).child("No open issues assigned to you.")))
        .children((g?.issues ?? []).map(row));

    const account = this.account ? describeAccount(this.account) : null;

    // A card like Herdr's Files and Changes panels; a window overlay gets Herdr's own frame instead.
    return v_flex().id("github").size_full().min_h(0).overflow_hidden().bg(t.background).text_color(t.foreground).text_size(13)
      .when(!overlay, (el) => el.rounded(10).border_1().border_color(t.border))
      .child(h_flex().h(42).flex_none().px(14).gap(8).items_center().border_b(1).border_color(t.border)
        .child(div().font_semibold().child("GitHub"))
        .child(div().flex_1().min_w(0).truncate().text_right().text_size(12).text_color(t.dim).child(repo))
        .child(button("gh-refresh", this.loading ? "…" : "↻", "Refresh", (_e, cx) => this.refresh(cx, true)))
        .when(Boolean(overlay), (el) => el.child(button("gh-close", "×", "Close", () => closeOverlay(overlay!)))))
      // Tabs: only Issues in this version; PRs, Actions and notifications join it later.
      .child(h_flex().h(34).flex_none().px(10).gap(4).items_center().border_b(1).border_color(t.border)
        .child(div().px(8).py(3).rounded(6).bg(t.hover).text_size(12).font_medium().child("Issues")))
      .child(v_flex().id("gh-list").flex_1().min_h(0).overflow_y_scroll().p(6)
        .when(Boolean(notice), (el) => el.child(div().p(8).text_size(12).text_color(t.blocked).child(notice ?? "")))
        .when(!notice && Boolean(this.remote) && Boolean(account?.ok), (el) => el.child(group("Assigned to me", this.assigned)))
        .when(!notice && !(this.remote && account?.ok) && this.loading, (el) => el.child(div().p(8).text_color(t.dim).child("…"))))
      // Which gh and folder this is (ADR 0003), until the branch card (#18) takes the bottom.
      .child(div().flex_none().px(14).py(8).border_t(1).border_color(t.border).text_size(11).text_color(t.dim).truncate()
        .child(`${account?.ok ? account.text : "checking gh…"} · ${where.cwd ?? "no folder"}`));
  }
}
