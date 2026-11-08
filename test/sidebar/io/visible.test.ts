import { afterEach, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { SIDEBAR_SLOT, sidebarVisible } from "../../../src/github/sidebar/io/visible.ts";
import { reset, screen } from "../../fake-herdr.ts";

afterEach(reset);

const sidebar = (hidden = false, active = "github") => ({
	id: "root",
	type: "row",
	children: [
		{
			id: "panel",
			type: "column",
			hidden,
			children: [
				{
					id: "panel-body",
					type: "stack",
					active,
					children: [
						{ id: "files", type: "block", content: { mod: "files" } },
						{ id: "github", type: "block", content: { mod: "github", props: { role: "panel" } } },
					],
				},
			],
		},
	],
});

test("the GitHub sidebar is visible only when its ancestors and stack selection show it", () => {
	screen({ layout: sidebar() });
	expect(sidebarVisible()).toBe(true);
	screen({ layout: sidebar(true) });
	expect(sidebarVisible()).toBe(false);
	screen({ layout: sidebar(false, "files") });
	expect(sidebarVisible()).toBe(false);
	screen({ layout: sidebar() });
	expect(sidebarVisible()).toBe(true);
});

test("an absent sidebar does not poll", () => {
	screen({ layout: null });
	expect(sidebarVisible()).toBe(false);
});

test("the shipped layout's GitHub block is the slot the sidebar watches", () => {
	const layoutFile = JSON.parse(readFileSync(new URL("../../../github/layouts/github.json", import.meta.url), "utf8"));
	const blocks: { id?: string; content?: { mod?: string; props?: { role?: string } } }[] = [];
	const walk = (node: unknown): void => {
		if (!node || typeof node !== "object") return;
		blocks.push(node as (typeof blocks)[number]);
		for (const value of Object.values(node)) walk(value);
	};
	walk(layoutFile);
	const panel = blocks.find((b) => b.content?.mod === "github" && b.content.props?.role === "panel");
	expect(panel?.id).toBe(SIDEBAR_SLOT);
});
