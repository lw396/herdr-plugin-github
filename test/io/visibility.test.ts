import { afterEach, expect, test } from "bun:test";
import { sidebarVisible } from "../../src/github/io/visibility.ts";
import { reset, screen } from "../fake-herdr.ts";

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
