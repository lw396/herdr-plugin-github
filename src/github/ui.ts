// Small UI helpers shared by the roles.
import type { Color, Context } from "gpui-kit";
import { theme } from "herdr";

/** theme() typed as gpui-kit colors (herdr.d.ts says string; the values are always hex). */
export const colors = (): Record<string, Color> => theme() as Record<string, Color>;

/** Controls inside a window overlay stop the press, or it drags the window. */
export const stop = (_e: unknown, cx: Context): void => cx.stop_propagation();
