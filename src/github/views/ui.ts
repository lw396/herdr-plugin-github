// Small UI helpers shared by the views.
import { div, svg, type AsyncContext, type Color, type Context, type Element } from "gpui-kit";
import { theme } from "herdr";

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

/** A compact action. Neither its press nor its click activates a containing row/window. */
export function button(id: string, label: string | Element, tip: string, act: (e: unknown, cx: Context) => void): Element {
  const t = colors();
  return div().id(id).px(6).py(2).rounded(6).text_size(12).text_color(t.dim).cursor_pointer()
    .hover(s => s.bg(t.hover).text_color(t.foreground)).tooltip(tip).accessibility_label(tip)
    .on_mouse_down("left", stop).on_click((e, cx) => { cx.stop_propagation(); act(e, cx); }).child(label);
}
