// GitHub for Herdr: one mod, a role per props().role (see ROLES). Default: panel.
import { View } from "gpui-kit";
import { props } from "herdr";
import { Panel } from "./views/panel.js";
const ROLES = { panel: Panel };
export default class GitHub extends View {
    role = null;
    init(p, cx) {
        const Role = ROLES[(props() ?? p ?? {}).role ?? "panel"];
        this.role = Role ? new Role() : null;
        this.role?.init(cx);
    }
    render(cx) {
        return this.role ? this.role.render(cx) : `github: unknown role ${JSON.stringify(props()?.role)}`;
    }
}
