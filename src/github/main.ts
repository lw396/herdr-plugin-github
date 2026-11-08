// GitHub for Herdr: one mod, a role per props().role (see ROLES). Default: panel.
import { type AsyncContext, type Context, type Element, View } from "gpui-kit";
import { props } from "herdr";
import { Pane } from "./roles/pane.ts";
import { Panel } from "./roles/panel.ts";
import { Reader } from "./roles/reader.ts";
import type { Role } from "./shared/views/ui.ts";

const ROLES: Record<string, new () => Role> = { panel: Panel, issue: Reader, pr: Reader, pane: Pane };

export default class GitHub extends View {
	role: Role | null = null;

	override init(p: { role?: string } | undefined, cx: AsyncContext): void {
		const Role = ROLES[(props() ?? p)?.role ?? "panel"];
		this.role = Role ? new Role() : null;
		this.role?.init(cx);
	}

	override render(cx: Context): Element | string {
		return this.role ? this.role.render(cx) : `github: unknown role ${JSON.stringify(props()?.role)}`;
	}
}
