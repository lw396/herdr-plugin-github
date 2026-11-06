// Small UI helpers shared by the views.
import { div } from "gpui-kit";
import { theme } from "herdr";
/** theme() typed as gpui-kit colors (herdr.d.ts says string; the values are always hex). */
export const colors = () => theme();
/** Controls inside a window overlay stop the press, or it drags the window. */
export const stop = (_e, cx) => cx.stop_propagation();
/** A compact action. Neither its press nor its click activates a containing row/window. */
export function button(id, label, tip, act) {
    const t = colors();
    return div().id(id).px(6).py(2).rounded(6).text_size(12).text_color(t.dim).cursor_pointer()
        .hover(s => s.bg(t.hover).text_color(t.foreground)).tooltip(tip).accessibility_label(tip)
        .on_mouse_down("left", stop).on_click((e, cx) => { cx.stop_propagation(); act(e, cx); }).child(label);
}
