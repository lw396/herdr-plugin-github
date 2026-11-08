// Small UI helpers shared by the views.
import { Button } from "gpui-base";
import { type AsyncContext, type Color, type Context, div, type Element, svg } from "gpui-kit";
import { theme } from "herdr";
import type { PullState } from "../core/pulls.ts";

/** One way the mod shows (props().role): created in init, rendered by the mod's View. */
export interface Role {
	init(cx: AsyncContext): void;
	render(cx: Context): Element;
}

/** theme() typed as gpui-kit colors (herdr.d.ts says string; the values are always hex). */
export const colors = (): Record<string, Color> => theme() as Record<string, Color>;

/** The mod's own loading spinner (not another mod's asset, which a Herdr upgrade may move). */
export const spinner = (size = 12): Element =>
	svg("mods/github/assets/spinner.svg").size(size).flex_none().text_color(colors().dim).spin(900);

/** Controls inside a window overlay stop the press, or it drags the window. */
export const stop = (_e: unknown, cx: Context): void => cx.stop_propagation();

/** Opens `url` in the browser; the caller styles it. Neither its press nor its click activates a containing row/window. */
export function link(id: string, url: string, label: string): Element {
	return div()
		.id(id)
		.cursor_pointer()
		.on_mouse_down("left", stop)
		.on_click((_e, cx) => {
			cx.stop_propagation();
			cx.open_url(url);
		})
		.child(label);
}

export function chip(label: string, border: Color, background: Color): Element {
	return div().px(8).py(3).rounded(12).border_1().border_color(border).bg(background).text_size(12).child(label);
}

/** A PR state's Octicon, theme color and name, in the sidebar's rows and the PR page alike. */
export const PULL_STATES: Record<
	PullState,
	{ icon: string; color: (t: Record<string, Color>) => Color; label: string }
> = {
	open: { icon: "mods/github/assets/git-pull-request.svg", color: (t) => t.done, label: "Open" },
	draft: { icon: "mods/github/assets/git-pull-request-draft.svg", color: (t) => t.dim, label: "Draft" },
	merged: { icon: "mods/github/assets/git-merge.svg", color: (t) => t.ansi5, label: "Merged" },
	closed: { icon: "mods/github/assets/git-pull-request-closed.svg", color: (t) => t.blocked, label: "Closed" },
};

export const square = (el: Element): Element => el.size(36).flex_none().flex().items_center().justify_center();

/** Full-sized description-page action, distinct from the compact toolbar controls. */
export function actionButton(
	id: string,
	label: string,
	act: (e: unknown, cx: Context) => void,
	primary = false,
	disabled = false,
): Element {
	const t = colors();
	return Button.new(id)
		.px(12)
		.py(6)
		.rounded(4)
		.border_1()
		.border_color(primary ? t.solid : t.input)
		.bg(primary ? t.solid : t.raised)
		.text_color(primary ? t.solid_foreground : t.foreground)
		.text_size(13)
		.font_medium()
		.cursor_pointer()
		.accessibility_label(label)
		.disabled(disabled)
		.opacity(disabled ? 0.5 : 1)
		.hover((s) => s.bg(primary ? t.solid : t.hover))
		.on_mouse_down("left", stop)
		.on_click((e, cx) => {
			cx.stop_propagation();
			if (!disabled) act(e, cx);
		})
		.child(label);
}

/** A compact action. Neither its press nor its click activates a containing row/window. */
export function button(
	id: string,
	label: string | Element,
	tip: string,
	act: (e: unknown, cx: Context) => void,
): Element {
	const t = colors();
	return div()
		.id(id)
		.px(6)
		.py(2)
		.rounded(6)
		.text_size(12)
		.text_color(t.dim)
		.cursor_pointer()
		.hover((s) => s.bg(t.hover).text_color(t.foreground))
		.tooltip(tip)
		.accessibility_label(tip)
		.on_mouse_down("left", stop)
		.on_click((e, cx) => {
			cx.stop_propagation();
			act(e, cx);
		})
		.child(label);
}
