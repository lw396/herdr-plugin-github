// A changed-files navigator, shared by sidebar PR disclosures and the reader's Files control.
import { h_flex, v_flex } from "gpui-base";
import { type Context, div, type Element } from "gpui-kit";
import type { DetailRef } from "../core/detail.ts";
import { type ChangedFile, type FileNode, fileTree, flatFiles } from "../core/files.ts";
import { failureOf } from "../io/gh.ts";
import { readPullFiles } from "../io/pulls.ts";
import { button, colors, spinner, stop } from "./ui.ts";

const STATUS = {
	added: { mark: "A", label: "Added", color: "done" },
	removed: { mark: "D", label: "Deleted", color: "blocked" },
	modified: { mark: "M", label: "Modified", color: "working" },
	renamed: { mark: "R", label: "Renamed", color: "accent" },
	copied: { mark: "C", label: "Copied", color: "accent" },
	changed: { mark: "M", label: "Changed", color: "working" },
	unchanged: { mark: "U", label: "Unchanged", color: "dim" },
};

export class ChangedFiles {
	files: ChangedFile[] | null = null;
	loading = false;
	failure: string | null = null;
	private flat = false;
	private folded = new Set<string>();
	private latest = 0;
	private source: ChangedFile[] | null = null;
	private tree: FileNode[] = [];
	private list: FileNode[] = [];

	private readonly id: string;
	private readonly ref: DetailRef;
	private readonly on: string | null;
	private readonly open: (cx: Context, path: string) => void;

	constructor(id: string, ref: DetailRef, on: string | null, open: (cx: Context, path: string) => void) {
		this.id = id;
		this.ref = ref;
		this.on = on;
		this.open = open;
	}

	load(cx: Context, force = false): void {
		if (!force && (this.files !== null || this.loading)) return;
		const request = ++this.latest;
		this.loading = true;
		this.failure = null;
		cx.spawn(async (cx) => {
			try {
				const files = await readPullFiles(this.ref.repo, this.ref.number, this.on);
				if (request === this.latest) this.files = files;
			} catch (e) {
				if (request === this.latest) this.failure = failureOf(e).message;
			} finally {
				if (request === this.latest) {
					this.loading = false;
					cx.notify();
				}
			}
		});
	}

	render(selected: string | null = null): Element {
		const t = colors();
		if (this.source !== this.files) {
			this.source = this.files;
			this.tree = fileTree(this.files ?? []);
			this.list = flatFiles(this.files ?? []);
		}
		return v_flex()
			.min_w(0)
			.gap(2)
			.child(
				h_flex()
					.gap(6)
					.items_center()
					.child(
						div()
							.flex_1()
							.text_size(12)
							.text_color(t.dim)
							.child(`Files changed${this.files ? ` (${this.files.length})` : ""}`),
					)
					.child(
						button(
							`${this.id}-mode`,
							this.flat ? "Tree" : "List",
							this.flat ? "View as Tree" : "View as List",
							(_e, cx) => {
								this.flat = !this.flat;
								cx.notify();
							},
						),
					)
					.child(
						button(`${this.id}-refresh`, "↻", "Refresh changed files", (_e, cx) => {
							this.load(cx, true);
							cx.notify();
						}),
					),
			)
			.when(this.loading, (el) => el.child(h_flex().gap(6).child(spinner()).child("Loading changed files…")))
			.when(this.failure !== null, (el) =>
				el.child(
					v_flex()
						.gap(4)
						.child(
							div()
								.text_size(12)
								.text_color(t.blocked)
								.child(this.failure ?? ""),
						)
						.child(
							button(`${this.id}-retry`, "Retry", "Load changed files again", (_e, cx) => {
								this.load(cx, true);
								cx.notify();
							}),
						),
				),
			)
			.when(this.files?.length === 0, (el) => el.child(div().text_color(t.dim).child("No changed files")))
			.children(this.nodes(this.flat ? this.list : this.tree, selected, 0));
	}

	private nodes(nodes: FileNode[], selected: string | null, depth: number): Element[] {
		const t = colors();
		return nodes.map((node) => {
			const folder = node.kind === "directory";
			const folded = this.folded.has(node.path);
			const status = node.kind === "file" ? (STATUS[node.file.status] ?? STATUS.changed) : null;
			const tip =
				node.kind === "file"
					? `${node.path}${node.file.previousPath ? ` ← ${node.file.previousPath}` : ""} · ${status?.label} · +${node.file.additions} −${node.file.deletions}`
					: node.path;
			const row = h_flex()
				.id(`${this.id}-${node.kind}-${node.path}`)
				.h(26)
				.min_w(0)
				.pl(8 + depth * 12)
				.pr(6)
				.gap(6)
				.items_center()
				.cursor_pointer()
				.hover((s) => s.bg(t.hover))
				.when(!folder && selected === node.path, (el) => el.bg(t.selected))
				.tooltip(tip)
				.accessibility_label(tip)
				.on_mouse_down("left", stop)
				.on_click((_e, cx) => {
					cx.stop_propagation();
					if (folder) {
						if (folded) this.folded.delete(node.path);
						else this.folded.add(node.path);
						cx.notify();
					} else this.open(cx, node.path);
				})
				.child(
					div()
						.w(12)
						.flex_none()
						.text_color(t.dim)
						.child(folder ? (folded ? "▸" : "▾") : ""),
				)
				.child(div().flex_1().min_w(0).truncate().text_size(12).child(node.name))
				.when(status !== null, (el) =>
					el.child(
						div()
							.flex_none()
							.text_size(12)
							.text_color(t[status?.color ?? "dim"])
							.child(status?.mark ?? ""),
					),
				);
			return node.kind === "directory" && !folded
				? v_flex()
						.child(row)
						.children(this.nodes(node.children, selected, depth + 1))
				: row;
		});
	}
}
