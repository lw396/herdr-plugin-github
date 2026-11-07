// A native reader tab: one issue or PR page at a time, a command listener and one session-only Back
// history across both kinds. Only commands from the sidebar fill it: saved props never restore one.
import { v_flex } from "gpui-base";
import type { AsyncContext, Context, Element } from "gpui-kit";
import { nextCommand, props } from "herdr";
import { DetailNavigation, type DetailRef } from "../core/detail.ts";
import { detailCommand, navigatedDetail, readyDetail } from "../io/detail-tabs.ts";
import type { DetailHost } from "./detail.ts";
import { Issue } from "./issue.ts";
import { Pull } from "./pull.ts";
import { colors, type Role } from "./ui.ts";

/** At this width the metadata moves beside the timeline. */
const WIDE = 820;

export class Reader implements Role {
	navigation = new DetailNavigation();
	issue: Issue;
	pull: Pull;
	wide = false;
	private readonly reader: string;

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
				if (ref && this.navigation.open(ref)) this.show(cx, ref);
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
				const wide = size.width >= WIDE;
				if (wide !== this.wide) {
					this.wide = wide;
					cx.notify();
				}
			})
			.children(kind === "pr" ? this.pull.render(this.wide) : this.issue.render(cx, this.wide));
	}
}
