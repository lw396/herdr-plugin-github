// GitHub issue labels as the reader shows them.
export interface Label {
	name: string;
	color: `#${string}` | null;
}

/** GitHub supplies six-digit hex colors, without '#'; older replies can contain names only. */
export function parseLabel(label: string | { name: string; color?: string }): Label {
	return typeof label === "string"
		? { name: label, color: null }
		: {
				name: label.name,
				color: label.color && /^[a-f\d]{6}$/i.test(label.color) ? `#${label.color.toLowerCase()}` : null,
			};
}
