// The PR role (a PR's detail pane, in its own native tab). This version takes the PR it is sent and names it;
// the description, timeline and files arrive with #25 and the tickets after it.

import { v_flex } from "gpui-base";
import { type AsyncContext, type Context, div, type Element } from "gpui-kit";
import { nextCommand, props } from "herdr";
import type { DetailRef } from "../core/detail.ts";
import { detailCommand, readyDetail } from "../io/detail-tabs.ts";
import { colors, type Role } from "./ui.ts";

export class Pull implements Role {
	reader = "";
	ref: DetailRef | null = null;

	init(cx: AsyncContext): void {
		this.reader = String((props() as { reader?: string } | null)?.reader ?? "");
		// Waiting is a read: init neither opens tabs nor writes shared state.
		cx.spawn(async (cx) => {
			for (;;) {
				const opened = detailCommand(await nextCommand(), this.reader);
				if (opened?.kind !== "pr") continue;
				this.ref = opened;
				cx.notify();
			}
		});
	}

	render(_cx: Context): Element {
		if (this.reader) readyDetail(this.reader);
		const t = colors();
		return v_flex()
			.id("pull-reader")
			.size_full()
			.p(24)
			.gap(8)
			.bg(t.background)
			.text_color(t.foreground)
			.child(
				div()
					.text_size(16)
					.font_semibold()
					.child(this.ref ? `#${this.ref.number} · ${this.ref.repo}` : ""),
			)
			.child(
				div()
					.text_size(13)
					.text_color(t.dim)
					.child(
						this.ref ? "Pull request descriptions are not available yet." : "Select a pull request in the sidebar.",
					),
			);
	}
}
