// One issue in one native Herdr tab. The issue itself is not restored after restart.
import { div, svg } from "gpui-kit";
import { h_flex, v_flex, TextView } from "gpui-base";
import { nextCommand, props } from "herdr";
import { issueKey } from "../core/issue-detail.js";
import { browserUrl, imageLinks } from "../core/markdown.js";
import { relativeTime } from "../core/time.js";
import { describeAccount } from "../core/account.js";
import { explain } from "../core/gh-args.js";
import { detailMachine, issueCommand, readyDetail } from "../io/detail-tabs.js";
import { readIssue } from "../io/issues.js";
import * as gh from "../io/gh.js";
import { button, colors, stop } from "./ui.js";
export class Issue {
    reader = "";
    ref = null;
    entry = null;
    init(cx) {
        this.reader = typeof props()?.reader === "string" ? props().reader : "";
        // Waiting is a read: init neither opens tabs nor writes shared state.
        cx.spawn(async (cx) => {
            for (;;) {
                const ref = issueCommand(await nextCommand(), this.reader);
                if (!ref)
                    continue;
                if (!this.ref || issueKey(this.ref) !== issueKey(ref)) {
                    this.ref = ref;
                    this.load(cx);
                }
                cx.notify();
            }
        });
    }
    load(cx) {
        const ref = this.ref;
        if (!ref)
            return;
        const entry = { issue: this.entry?.issue, loading: true };
        this.entry = entry;
        const machine = detailMachine(this.reader);
        if (!machine) {
            entry.loading = false;
            entry.failure = "This issue tab is unavailable. Open the issue from its sidebar again.";
            return;
        }
        cx.spawn(async (cx) => {
            try {
                const account = await gh.account(machine.on);
                if (!account.status.ok)
                    throw new Error(describeAccount(account).text);
                const issue = await readIssue(ref.repo, ref.number, account.on);
                if (this.entry === entry)
                    entry.issue = issue;
            }
            catch (e) {
                if (this.entry === entry)
                    entry.failure = e instanceof gh.GhError
                        ? e.notFound ? `${ref.repo} #${ref.number} isn't on GitHub, or this account can't see it.` : explain(e.message)
                        : e instanceof Error ? e.message : String(e);
            }
            finally {
                if (this.entry === entry) {
                    entry.loading = false;
                    cx.notify();
                }
            }
        });
    }
    render(_cx) {
        if (this.reader)
            readyDetail(this.reader);
        const t = colors(), ref = this.ref, entry = this.entry, issue = entry?.issue;
        const url = issue?.url ?? (ref ? `https://github.com/${ref.repo}/issues/${ref.number}` : "");
        return v_flex().id("issue-reader").size_full().min_h(0).overflow_hidden().bg(t.background).text_color(t.foreground).text_size(14)
            .when(!ref, el => el.child(v_flex().flex_1().gap(8).items_center().justify_center().p(24)
            .child(div().font_semibold().child("Issue details"))
            .child(div().text_size(13).text_color(t.dim).text_center().child("Choose an issue in the GitHub sidebar. Issue details are not restored after restarting Herdr."))))
            .when(Boolean(ref), el => el.child(h_flex().flex_none().px(24).pt(18).pb(12).gap(12).items_start()
            .child(h_flex().flex_1().min_w(0).gap(8).items_center().flex_wrap().text_size(22)
            .child(div().min_w(0).font_semibold().child(issue?.title ?? "Issue details"))
            .child(h_flex().gap(2).items_center().flex_none()
            .child(div().id("issue-browser").px(2).rounded(4).text_color(t.accent).cursor_pointer()
            .hover(s => s.bg(t.hover)).tooltip(`Open ${ref?.repo} #${ref?.number} in browser`)
            .accessibility_label(`Open #${ref?.number} in browser`).on_mouse_down("left", stop)
            .on_click((_e, cx) => { cx.stop_propagation(); cx.open_url(url); })
            .child(ref ? `#${ref.number}` : ""))
            .child(button("issue-copy", svg("mods/github/assets/copy.svg").size(16), "Copy issue link", (_e, cx) => cx.write_to_clipboard(url)))))
            .child(button("issue-refresh", "↻", "Refresh issue", (_e, cx) => { this.load(cx); cx.notify(); }))))
            .when(Boolean(ref), el => el.child(v_flex().id("issue-scroll").flex_1().min_h(0).overflow_y_scroll().px(24).pb(18).gap(12)
            .when(Boolean(entry?.loading), el => el.child(div().text_size(12).text_color(t.dim).child("Loading issue…")))
            .when(Boolean(entry?.failure), el => el.child(div().text_color(t.blocked).child(entry?.failure ?? "")))
            .child(issue ? this.document(issue) : div())));
    }
    document(issue) {
        const t = colors();
        const post = (id, p) => v_flex().gap(10).py(16).pl(18).border_l(2).border_color(t.border)
            .child(h_flex().gap(8).items_center()
            .child(div().font_semibold().child(p.author))
            .child(div().text_size(12).text_color(t.dim).tooltip(p.createdAt).child(relativeTime(p.createdAt, Date.now()))))
            .child(TextView.markdown(id, imageLinks(p.body || "_No description._")).selectable(true).scrollable(false)
            .on_link_click((url, cx) => {
            // Same-repository issue navigation is #14; do not execute document-supplied schemes.
            const external = browserUrl(url, issue.url);
            if (external)
                cx.open_url(external);
        }))
            .when(Boolean(p.reactions?.length), el => el.child(h_flex().gap(6).flex_wrap().children((p.reactions ?? []).map(r => div().px(7).py(2).rounded(10).bg(t.raised).text_size(12).child(`${r.emoji} ${r.count}`)))));
        return v_flex().gap(12)
            .child(h_flex().gap(8).items_center().flex_wrap()
            .child(div().px(9).py(3).rounded(12).bg(t.raised).text_size(12).font_medium()
            .text_color(issue.state === "open" ? t.done : t.accent).child(issue.state === "open" ? "● Open" : "● Closed"))
            .child(div().text_size(12).text_color(t.dim).child(`opened by ${issue.author}`)))
            .child(v_flex().gap(6).text_size(12).text_color(t.dim)
            .child(div().child(`Assignees · ${issue.assignees.join(", ") || "None"}`))
            .child(div().child(`Milestone · ${issue.milestone ?? "None"}`))
            .child(h_flex().gap(6).items_center().flex_wrap()
            .child(div().child("Labels ·"))
            .when(!issue.labels.length, el => el.child(div().child("None")))
            .children(issue.labels.map(label => div().px(7).py(2).rounded(8).bg(t.raised).text_color(t.muted).child(label)))))
            .child(post("issue-body", issue))
            .children(issue.comments.map(c => post(`comment-${c.id}`, c)));
    }
}
