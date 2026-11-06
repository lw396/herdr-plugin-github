// Small UI helpers shared by the views.
import type { AsyncContext, Color, Context, Element } from "gpui-kit";
import { theme } from "herdr";

/** One way the mod shows (props().role): created in init, rendered by the mod's View. */
export interface Role {
  init(cx: AsyncContext): void;
  render(cx: Context): Element;
}

/** theme() typed as gpui-kit colors (herdr.d.ts says string; the values are always hex). */
export const colors = (): Record<string, Color> => theme() as Record<string, Color>;

/** Controls inside a window overlay stop the press, or it drags the window. */
export const stop = (_e: unknown, cx: Context): void => cx.stop_propagation();
