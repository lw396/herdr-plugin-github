// Herdr 0.1.13's shipped pane header, adapted as a role for the github layout.
// Keep terminal headers/controls unchanged; GitHub mod panes get the GitHub logo and name.

import { h_flex } from "gpui-base";
import { type Context, div, type Element, image, svg } from "gpui-kit";
import { home, type Program, panes, props, run } from "herdr";
import { colors, type Role } from "./ui.ts";

function icon(program: Program | undefined, color: ReturnType<typeof colors>[string]): Element | null {
	if (!program?.icon) return null;
	return program.tint
		? svg(program.icon).size(14).flex_none().text_color(color)
		: image(program.icon).w(14).h(14).flex_none();
}

function folder(cwd: string | null): string {
	if (!cwd) return "";
	const h = home();
	return cwd === h ? "~" : cwd.startsWith(`${h}/`) ? `~${cwd.slice(h.length)}` : cwd;
}

export class Pane implements Role {
	hovered = false;
	init(): void {}

	private button(id: string, picture: string, command: string, args: Record<string, unknown>): Element {
		const t = colors();
		return div()
			.id(id)
			.p(3)
			.rounded(4)
			.text_color(t.dim)
			.hover((s) => s.bg(t.hover).text_color(t.foreground))
			.on_click((_e, cx) => {
				cx.stop_propagation();
				run(command, args);
			})
			.child(svg(`mods/pane/${picture}.svg`).size(14));
	}

	render(_cx: Context): Element {
		const t = colors(),
			p = panes().find((p) => p.pane === props()?.pane);
		if (!p) return div();
		const github = p.mod === "github";
		const name = github
			? "GitHub"
			: ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
		const pic = github
			? svg("mods/github/assets/github.svg").size(14).flex_none().text_color(t.dim)
			: icon(p.program, t.dim);
		const st = p.status,
			pane = p.pane;
		return h_flex()
			.id(`pane-head-${pane}`)
			.size_full()
			.px(10)
			.gap(8)
			.items_center()
			.bg(t.background)
			.border_b(1)
			.border_color(t.border)
			.text_size(12)
			.on_hover((hovered, cx) => {
				this.hovered = hovered;
				cx.notify();
			})
			.on_click(() => run("pane.focus", { pane }))
			.when(Boolean(pic), (el) => el.child(pic ?? div()))
			.child(div().flex_none().truncate().max_w(260).font_medium().text_color(t.foreground).child(name))
			.child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
			.when(st === "working", (el) =>
				el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)),
			)
			.when(st === "blocked", (el) =>
				el.child(
					div()
						.flex_none()
						.px(6)
						.h(18)
						.flex()
						.items_center()
						.rounded(5)
						.bg(`${t.blocked}26`)
						.text_size(10.5)
						.font_semibold()
						.text_color(t.blocked)
						.child("Needs you"),
				),
			)
			.when(st === "done", (el) => el.child(div().size(7).flex_none().rounded(4).bg(t.done)))
			.when(this.hovered, (el) =>
				el
					.child(this.button(`ph-r-${pane}`, "split-right", "pane.split", { direction: "right", pane }))
					.child(this.button(`ph-d-${pane}`, "split-down", "pane.split", { direction: "down", pane }))
					.child(this.button(`ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", "pane.zoom", { pane }))
					.child(this.button(`ph-x-${pane}`, "close", "pane.close", { pane })),
			);
	}
}
