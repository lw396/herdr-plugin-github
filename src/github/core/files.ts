// Changed-file facts and navigation, independent of the GitHub transport and native UI.
export type FileStatus = "added" | "removed" | "modified" | "renamed" | "copied" | "changed" | "unchanged";
export interface ChangedFile {
	path: string;
	previousPath: string | null;
	status: FileStatus;
	additions: number;
	deletions: number;
	patch: string | null;
	url: string;
	viewed: boolean;
}

export interface FileEntry {
	kind: "file";
	name: string;
	path: string;
	file: ChangedFile;
}
export interface DirectoryEntry {
	kind: "directory";
	name: string;
	path: string;
	children: FileNode[];
}
export type FileNode = FileEntry | DirectoryEntry;

const byPath = (a: { path: string }, b: { path: string }): number => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

/** A flat list keeps the full path visible; the source array remains in GitHub's order. */
export function flatFiles(files: ChangedFile[], hideViewed = false): FileEntry[] {
	return files
		.filter((f) => !hideViewed || !f.viewed)
		.map((file): FileEntry => ({ kind: "file", name: file.path, path: file.path, file }))
		.sort(byPath);
}

/** Compact directory chains only: a file is always its own selectable row. */
export function fileTree(files: ChangedFile[], hideViewed = false): FileNode[] {
	const root: FileNode[] = [];
	for (const file of files) {
		if (hideViewed && file.viewed) continue;
		const parts = file.path.split("/");
		let children = root;
		let path = "";
		for (const name of parts.slice(0, -1)) {
			path = path ? `${path}/${name}` : name;
			let folder = children.find((n): n is DirectoryEntry => n.kind === "directory" && n.path === path);
			if (!folder) {
				folder = { kind: "directory", name, path, children: [] };
				children.push(folder);
			}
			children = folder.children;
		}
		children.push({ kind: "file", name: parts.at(-1) ?? file.path, path: file.path, file });
	}
	return compact(root);
}

function compact(nodes: FileNode[]): FileNode[] {
	return nodes
		.map((node): FileNode => {
			if (node.kind === "file") return node;
			let name = node.name;
			let folder = node;
			while (folder.children.length === 1 && folder.children[0]?.kind === "directory") {
				folder = folder.children[0];
				name += `/${folder.name}`;
			}
			return { ...folder, name, children: compact(folder.children) };
		})
		.sort((a, b) => (a.kind === b.kind ? byPath(a, b) : a.kind === "directory" ? -1 : 1));
}

interface RestFile {
	filename: string;
	previous_filename?: string;
	status: FileStatus;
	additions: number;
	deletions: number;
	patch?: string;
	blob_url: string;
}

export function parseFiles(data: unknown): ChangedFile[] {
	if (!Array.isArray(data)) throw new Error("GitHub returned an unreadable changed-files list.");
	return (data as RestFile[]).map((f) => ({
		path: f.filename,
		previousPath: f.previous_filename ?? null,
		status: f.status,
		additions: f.additions,
		deletions: f.deletions,
		patch: f.patch ?? null,
		url: f.blob_url,
		viewed: false,
	}));
}
