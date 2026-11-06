import { theme } from "herdr";
/** theme() typed as gpui-kit colors (herdr.d.ts says string; the values are always hex). */
export const colors = () => theme();
/** Controls inside a window overlay stop the press, or it drags the window. */
export const stop = (_e, cx) => cx.stop_propagation();
