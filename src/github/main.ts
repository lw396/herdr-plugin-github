// GitHub for Herdr: one mod, a role per props().role (see ROLES). Default: panel.
import { type AsyncContext, type Context, type Element, View } from "gpui-kit";
import { props } from "herdr";
import { Issue } from "./views/issue.ts";
import { Pane } from "./views/pane.ts";
import { Panel } from "./views/panel.ts";
import type { Role } from "./views/ui.ts";

const ROLES: Record<string, new () => Role> = { panel: Panel, issue: Issue, pane: Pane };

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
