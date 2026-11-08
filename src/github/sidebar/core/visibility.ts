// Layout nodes are live Herdr data. Hidden ancestors and unselected stack children hide descendants.
interface Node {
	id?: string;
	type?: string;
	hidden?: boolean;
	active?: string;
	children?: Node[];
}

export function layoutShows(tree: unknown, id: string): boolean {
	if (!tree || typeof tree !== "object") return false;
	const node = tree as Node;
	if (node.hidden) return false;
	if (node.id === id) return true;
	const children = node.children ?? [];
	return children.some(
		(child, index) =>
			(node.type !== "stack" || (node.active ? child.id === node.active : index === 0)) && layoutShows(child, id),
	);
}
