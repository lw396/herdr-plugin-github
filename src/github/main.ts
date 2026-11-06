// GitHub for Herdr: one mod, a role per props().role (see ROLES). Default: panel.
import { View, type AsyncContext, type Context, type Element } from "gpui-kit";
import { props } from "herdr";
import type { Role } from "./views/ui.ts";
import { Panel } from "./views/panel.ts";

const ROLES: Record<string, new () => Role> = { panel: Panel };

export default class GitHub extends View {
  role: Role | null = null;

  override init(p: { role?: string } | undefined, cx: AsyncContext): void {
    const Role = ROLES[(props() ?? p ?? {}).role ?? "panel"];
    this.role = Role ? new Role() : null;
    this.role?.init(cx);
  }

  override render(cx: Context): Element | string {
    return this.role ? this.role.render(cx) : `github: unknown role ${JSON.stringify(props()?.role)}`;
  }
}
