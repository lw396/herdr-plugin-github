// One issue at a time in one native Herdr tab; links to its repository's issues open here, with Back.
// The issue and its Back history are not restored after restart.
import { div, svg, type AsyncContext, type Context, type Element } from "gpui-kit";
import { h_flex, v_flex, TextView } from "gpui-base";
import { nextCommand, props } from "herdr";
import { issueKey, type IssueRef, type IssueDetail, type Comment, type Label } from "../core/issue-detail.ts";
import { browserUrl, issueLink } from "../core/markdown.ts";
import { relativeTime } from "../core/time.ts";
import { describeAccount } from "../core/account.ts";
import { detailMachine, issueCommand, navigatedDetail, readyDetail } from "../io/detail-tabs.ts";
import { readIssue, readIssueProjects } from "../io/issues.ts";
import type { Projects } from "../core/projects.ts";
import { issueTimeline, activityText, type Activity } from "../core/activity.ts";
import * as gh from "../io/gh.ts";
import { button, colors, spinner, stop, type Role } from "./ui.ts";

interface Loaded {
  key: string;
  issue?: IssueDetail;
  failure?: string;
  loading: boolean;
  projects?: Projects;
  projectsLoading: boolean;
}

export class Issue implements Role {
  reader = "";
  ref: IssueRef | null = null;
  /** Issues this tab showed before following links, most recent last. */
  history: IssueRef[] = [];
  entry: Loaded | null = null;
  wide = false;

  init(cx: AsyncContext): void {
    this.reader = typeof props()?.reader === "string" ? props().reader : "";
    // Waiting is a read: init neither opens tabs nor writes shared state.
    cx.spawn(async cx => {
      for (; ;) {
        const ref = issueCommand(await nextCommand(), this.reader);
        if (!ref) continue;
        if (!this.ref || issueKey(this.ref) !== issueKey(ref)) {
          // The sidebar opens an issue afresh: Back belongs to links followed in this tab.
          this.history = [];
          this.ref = ref;
          this.load(cx);
        }
        cx.notify();
      }
    });
  }

  /** Follow a link (or go Back): the tab now shows, and is named after, that issue. */
  show(cx: Context, ref: IssueRef, back: boolean): void {
    if (this.ref && !back) this.history.push(this.ref);
    this.ref = ref;
    navigatedDetail(this.reader, ref);
    this.load(cx);
    cx.notify();
  }

  load(cx: Context): void {
    const ref = this.ref;
    if (!ref) return;
    // A refresh keeps the shown issue until the new one arrives. ↻ is hidden while loading (one refresh at a time);
    // a different issue still replaces a load in progress, whose result is then dropped, and is not shown meanwhile.
    const key = issueKey(ref);
    const entry: Loaded = { key, issue: this.entry?.key === key ? this.entry.issue : undefined, loading: true, projectsLoading: false };
    this.entry = entry;
    const machine = detailMachine(this.reader);
    if (!machine) {
      entry.loading = false;
      entry.failure = "This issue tab is unavailable. Open the issue from its sidebar again.";
      return;
    }
    cx.spawn(async cx => {
      try {
        const account = await gh.account(machine.on);
        if (!account.status.ok) throw new Error(describeAccount(account).text);
        const issue = await readIssue(ref.repo, ref.number, account.on);
        if (this.entry !== entry) return;
        entry.issue = issue;
        entry.projectsLoading = true;
        // Optional Projects load on their own: the discussion shows now.
        cx.spawn(async cx => {
          const projects = await readIssueProjects(ref.repo, ref.number, account.on);
          if (this.entry === entry) { entry.projects = projects; entry.projectsLoading = false; cx.notify(); }
        });
      } catch (e) {
        const failure = gh.failureOf(e);
        if (this.entry === entry) entry.failure = failure.notFound
          ? `${ref.repo} #${ref.number} isn't on GitHub, or this account can't see it.` : failure.message;
      } finally {
        if (this.entry === entry) { entry.loading = false; cx.notify(); }
      }
    });
  }

  render(_cx: Context): Element {
    if (this.reader) readyDetail(this.reader);
    const t = colors(), ref = this.ref, entry = this.entry, issue = entry?.issue;
    const url = issue?.url ?? (ref ? `https://github.com/${ref.repo}/issues/${ref.number}` : "");
    return v_flex().id("issue-reader").size_full().min_h(0).overflow_hidden().bg(t.background).text_color(t.foreground).text_size(14)
      .on_size_change((size, cx) => {
        const wide = size.width >= 820;
        if (wide !== this.wide) { this.wide = wide; cx.notify(); }
      })
      .when(!ref, el => el.child(v_flex().flex_1().gap(8).items_center().justify_center().p(24)
        .child(div().font_semibold().child("Issue details"))
        .child(div().text_size(13).text_color(t.dim).text_center().child("Choose an issue in the GitHub sidebar. Issue details are not restored after restarting Herdr."))))
      .when(Boolean(ref), el => el.child(h_flex().flex_none().px(24).pt(18).pb(12).gap(12).items_start()
        .when(this.history.length > 0, el => el.child(this.back()))
        .child(h_flex().flex_1().min_w(0).gap(8).items_center().flex_wrap().text_size(22)
          .child(div().min_w(0).font_semibold().child(issue?.title ?? "Issue details"))
          .child(h_flex().gap(2).items_center().flex_none()
            .child(div().id("issue-browser").px(2).rounded(4).text_color(t.accent).cursor_pointer()
              .hover(s => s.bg(t.hover)).tooltip(`Open ${ref?.repo} #${ref?.number} in browser`)
              .accessibility_label(`Open #${ref?.number} in browser`).on_mouse_down("left", stop)
              .on_click((_e, cx) => { cx.stop_propagation(); cx.open_url(url); })
              .child(ref ? `#${ref.number}` : ""))
            .child(button("issue-copy", svg("mods/github/assets/copy.svg").size(16), "Copy issue link", (_e, cx) => cx.write_to_clipboard(url)))))
        .child(entry?.loading
          ? div().size(36).flex_none().flex().items_center().justify_center().child(spinner(18))
          : button("issue-refresh", "↻", "Refresh issue", (_e, cx) => { this.load(cx); cx.notify(); })
            .size(36).flex_none().flex().items_center().justify_center().text_size(22))))
      // Keyed by issue: another issue starts at its top, not at the previous one's scroll position.
      .when(Boolean(ref), el => el.child(v_flex().id(`issue-scroll-${ref ? issueKey(ref) : ""}`).flex_1().min_h(0).overflow_y_scroll().px(24).pb(18).gap(12)
        .when(Boolean(entry?.loading), el => el.child(div().text_size(12).text_color(t.dim).child("Loading issue…")))
        .when(Boolean(entry?.failure), el => el.child(div().text_color(t.blocked).child(entry?.failure ?? "")))
        .child(issue ? this.document(issue) : div())));
  }

  private back(): Element {
    const previous = this.history.at(-1)!;
    return button("issue-back", "←", `Back to #${previous.number}`, (_e, cx) => {
      const ref = this.history.pop();
      if (ref) this.show(cx, ref, true);
    }).size(36).flex_none().flex().items_center().justify_center().text_size(22);
  }

  private document(issue: IssueDetail): Element {
    const t = colors();
    const post = (id: string, p: Pick<Comment, "author" | "createdAt" | "markdown"> & { reactions?: Comment["reactions"] }, verb: string) =>
      v_flex().id(`${id}-card`).min_w(0).w_full().overflow_hidden().rounded(8).border_1().border_color(t.border).bg(t.background)
        .child(h_flex().px(16).py(10).gap(8).items_center().flex_wrap().bg(t.raised).border_b(1).border_color(t.border).text_size(12)
          .child(div().font_semibold().child(p.author))
          .child(div().text_color(t.dim).child(verb))
          .child(div().flex_1())
          .child(div().text_color(t.dim).tooltip(p.createdAt).child(relativeTime(p.createdAt, Date.now()))))
        .child(v_flex().min_w(0).px(16).py(16).gap(12)
          .child(TextView.markdown(id, p.markdown).selectable(true).scrollable(false)
            .on_link_click((url, cx) => {
              const linked = issueLink(url, issue.url);
              // A link to the shown issue itself (e.g. one of its comments) has nothing new to show.
              if (linked) { if (this.ref && issueKey(linked) !== issueKey(this.ref)) this.show(cx, linked, false); return; }
              const external = browserUrl(url, issue.url);
              if (external) cx.open_url(external);
            }))
          .when(Boolean(p.reactions?.length), el => el.child(h_flex().gap(6).flex_wrap().children((p.reactions ?? []).map(r =>
            div().px(8).py(3).rounded(12).border_1().border_color(t.border).bg(t.raised).text_size(12).child(`${r.emoji} ${r.count}`))))));
    const rows = issueTimeline(issue.comments, issue.activities);
    const timeline = v_flex().min_w(0).gap(20)
      .when(this.wide, el => el.flex_1())
      .when(!this.wide, el => el.w_full().flex_none())
      .child(post("issue-body", issue, "opened this issue"))
      .children(rows.map(row => row.type === "comment" ? post(`comment-${row.comment.id}`, row.comment, "commented") : this.activity(row.activity)));
    const metadata = this.metadata(issue);
    const content = this.wide
      ? h_flex().gap(24).items_start().child(timeline).child(metadata)
      : v_flex().gap(20).child(metadata).child(timeline);
    return v_flex().gap(18)
      .child(h_flex().gap(10).pb(4).items_center().flex_wrap()
        .child(div().px(10).py(4).rounded(14).bg(issue.state === "open" ? `${t.done}26` : `${t.accent}26`).text_size(13).font_semibold()
          .text_color(issue.state === "open" ? t.done : t.accent).child(issue.state === "open" ? "○ Open" : "● Closed"))
        .child(div().text_size(13).font_medium().child(issue.author)))
      .child(content);
  }

  private activity(activity: Activity): Element {
    const t = colors();
    const row = h_flex().id(`activity-${activity.id}`).px(16).py(4).gap(8).items_center().flex_wrap().text_size(12)
      .child(div().size(22).flex_none().rounded(11).bg(t.raised).text_color(t.muted).font_semibold().flex().items_center().justify_center()
        .child(activity.actor.slice(0, 1).toUpperCase()))
      .child(div().font_semibold().child(activity.actor))
      .child(div().text_color(t.dim).child(activityText(activity)));
    if ("labels" in activity) row.children(activity.labels.map(label => this.label(label)))
      .child(div().text_color(t.dim).child(activity.labels.length === 1 ? "label" : "labels"));
    return row.child(div().flex_1()).child(div().text_color(t.dim).tooltip(activity.createdAt).child(relativeTime(activity.createdAt, Date.now())));
  }

  private label(label: Label): Element {
    const t = colors();
    return div().px(8).py(3).rounded(12).border_1().border_color(label.color ?? t.input)
      .bg(label.color ? `${label.color}26` : t.raised).text_size(12).text_color(t.foreground).child(label.name);
  }

  private metadata(issue: IssueDetail): Element {
    const t = colors(), projects = this.entry?.projects;
    const section = (title: string, value: Element) => v_flex().gap(10).py(16).border_b(1).border_color(t.border)
      .when(!this.wide, el => el.w(180).min_w(140).flex_1())
      .child(div().text_size(13).font_semibold().child(title)).child(value);
    const quiet = (text: string) => div().text_size(12).text_color(t.dim).child(text);
    let projectContent: Element;
    if (!projects) projectContent = quiet(this.entry?.projectsLoading ? "Loading Projects…" : "Projects not loaded.");
    else if (!projects.ok) projectContent = quiet("None yet").tooltip(projects.message);
    else projectContent = projects.projects.length === 0 ? quiet("None yet") : v_flex().gap(8).children(projects.projects.map(project =>
      div().id(`project-${project.url}`).text_size(13).text_color(t.accent).cursor_pointer().tooltip(project.url)
        .on_mouse_down("left", stop).on_click((_e, cx) => { cx.stop_propagation(); cx.open_url(project.url); }).child(project.title)));
    const sections = [
      section("Assignees", issue.assignees.length === 0 ? quiet("No assignees")
        : v_flex().gap(8).children(issue.assignees.map(login => div().text_size(13).font_medium().child(login)))),
      section("Labels", issue.labels.length === 0 ? quiet("None yet")
        : h_flex().gap(6).flex_wrap().children(issue.labels.map(label => this.label(label)))),
      section("Project", projectContent),
      section("Milestone", issue.milestone ? div().text_size(13).child(issue.milestone) : quiet("No milestone")),
    ];
    return this.wide ? v_flex().w(220).flex_none().children(sections) : h_flex().gap(20).flex_wrap().children(sections);
  }
}
