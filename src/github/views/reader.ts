// A native detail tab can show either kind, with one command listener and one session-only Back history.
import type { AsyncContext, Context, Element } from "gpui-kit";
import { nextCommand, props } from "herdr";
import { type DetailKind, DetailNavigation, type DetailRef } from "../core/detail.ts";
import { detailCommand, navigatedDetail, readyDetail } from "../io/detail-tabs.ts";
import { Issue } from "./issue.ts";
import { Pull } from "./pull.ts";
import type { Role } from "./ui.ts";

export interface DetailHost {
	active(kind: DetailKind): boolean;
	previous(): DetailRef | null;
	follow(cx: Context, ref: DetailRef): void;
	back(cx: Context): void;
}

export class Reader implements Role {
	reader = "";
	navigation = new DetailNavigation();
	issue = new Issue();
	pull: Pull | null = null;
	initial: DetailKind = "issue";

	init(cx: AsyncContext): void {
		this.reader = typeof props()?.reader === "string" ? props().reader : "";
		this.initial = props()?.role === "pr" ? "pr" : "issue";
		const host: DetailHost = {
			active: (kind) => this.navigation.ref?.kind === kind,
			previous: () => this.navigation.previous,
			follow: (cx, ref) => {
				if (this.navigation.follow(ref)) this.show(cx, ref);
			},
			back: (cx) => {
				const ref = this.navigation.back();
				if (ref) this.show(cx, ref);
			},
		};
		this.issue.init(cx, host);
		this.pull = new Pull(this.reader, host);
		// Only explicit commands populate contents: persisted props never restore a PR or issue.
		cx.spawn(async (cx) => {
			for (;;) {
				const ref = detailCommand(await nextCommand(), this.reader);
				if (ref && this.navigation.open(ref)) this.show(cx, ref);
			}
		});
	}

	private show(cx: Context, ref: DetailRef): void {
		navigatedDetail(this.reader, ref);
		if (ref.kind === "issue") this.issue.show(cx, ref);
		else this.pull?.show(cx, ref);
		cx.notify();
	}

	render(cx: Context): Element {
		if (this.reader) readyDetail(this.reader);
		return (this.navigation.ref?.kind ?? this.initial) === "pr" && this.pull
			? this.pull.render(cx)
			: this.issue.render(cx);
	}
}
