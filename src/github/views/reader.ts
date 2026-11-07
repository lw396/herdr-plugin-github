// A native reader tab: one issue or PR page at a time, a command listener and one session-only Back
// history across both kinds. Only commands from the sidebar fill it: saved props never restore one.
import { v_flex } from "gpui-base";
import type { AsyncContext, Context, Element } from "gpui-kit";
import { nextCommand, props } from "herdr";
import { DetailNavigation, type DetailRef } from "../core/detail.ts";
import { closeEmptyDetail, detailCommand, detailLocation, navigatedDetail, readyDetail } from "../io/detail-tabs.ts";
import type { DetailHost, DetailLayout } from "./detail.ts";
import { Issue } from "./issue.ts";
import { Pull } from "./pull.ts";
import { colors, type Role } from "./ui.ts";

/** At this width the metadata moves beside the timeline. */
const WIDE = 820;
/** Below this width, show a label count and stack expanded metadata vertically. */
const COMPACT = 480;

export class Reader implements Role {
	navigation = new DetailNavigation();
	issue: Issue;
	pull: Pull;
	layout: DetailLayout = "compact";
	private readonly reader: string;
	private checkingEmpty = false;

	constructor() {
		this.reader = typeof props()?.reader === "string" ? props().reader : "";
		const navigation = this.navigation;
		const host: DetailHost = {
			reader: this.reader,
			active: (kind) => navigation.ref?.kind === kind,
			previous: () => navigation.previous,
			follow: (cx, ref) => {
				if (navigation.follow(ref)) this.show(cx, ref);
			},
			back: (cx) => {
				const ref = navigation.back();
				if (ref) this.show(cx, ref);
			},
		};
		this.issue = new Issue(host);
		this.pull = new Pull(host);
	}

	/** The role the tab was opened with, until it shows something. */
	private initial(): DetailRef["kind"] {
		return props()?.role === "pr" ? "pr" : "issue";
	}

	init(cx: AsyncContext): void {
		this.issue.init(cx);
		cx.spawn(async (cx) => {
			for (;;) {
				const ref = detailCommand(await nextCommand(), this.reader);
				if (ref) {
					if (this.navigation.open(ref)) this.show(cx, ref);
					if (ref.kind === "pr") this.pull.select(cx, ref.file ?? null);
				}
			}
		});
	}

	/** Show `ref` here: the tab is now named after it, and the sidebar finds it here. */
	private show(cx: Context, ref: DetailRef): void {
		navigatedDetail(this.reader, ref);
		if (ref.kind === "issue") this.issue.show(cx, ref);
		else this.pull.show(cx, ref);
		cx.notify();
	}

	render(cx: Context): Element {
		if (this.reader) readyDetail(this.reader);
		// A newly created tab needs its readiness handshake before the sidebar can deliver the item.
		// Restored readers have no session-only item to deliver; discard their empty pane instead.
		if (!this.navigation.ref && !this.checkingEmpty && detailLocation(this.reader)?.visible) {
			this.checkingEmpty = true;
			cx.timer.after(1000, () => {
				this.checkingEmpty = false;
				if (!this.navigation.ref) closeEmptyDetail(this.reader);
			});
		}
		const t = colors();
		const kind = this.navigation.ref?.kind ?? this.initial();
		return v_flex()
			.id("reader")
			.size_full()
			.min_h(0)
			.overflow_hidden()
			.bg(t.background)
			.text_color(t.foreground)
			.text_size(14)
			.on_size_change((size, cx) => {
				const layout = size.width >= WIDE ? "wide" : size.width >= COMPACT ? "narrow" : "compact";
				if (layout !== this.layout) {
					this.layout = layout;
					cx.notify();
				}
			})
			.children(kind === "pr" ? this.pull.render(this.layout) : this.issue.render(cx, this.layout));
	}
}
