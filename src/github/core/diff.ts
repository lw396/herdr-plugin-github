// Unified patches returned by GitHub's pull-request files API; never whole working-tree files.
export interface DiffLine {
	kind: "hunk" | "context" | "add" | "delete" | "notice";
	text: string;
	oldLine: number | null;
	newLine: number | null;
	/** GitHub's single-line review target. Hunk headers and notices cannot receive comments. */
	comment: { side: "LEFT" | "RIGHT"; line: number } | null;
}

/** A context line can be commented on either side using that side's line number. */
export function commentTarget(row: DiffLine, side: "LEFT" | "RIGHT"): DiffLine["comment"] {
	if (!row.comment) return null;
	const line = side === "LEFT" ? row.oldLine : row.newLine;
	return line === null ? null : { side, line };
}

/** Only lines inside a declared hunk have line numbers or review targets. */
export function parsePatch(patch: string): DiffLine[] {
	const rows: DiffLine[] = [];
	let oldLine = 0,
		newLine = 0,
		oldLeft = 0,
		newLeft = 0;
	for (const raw of patch.split("\n")) {
		const text = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
		const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(text);
		if (hunk) {
			oldLine = Number(hunk[1]);
			oldLeft = Number(hunk[2] ?? 1);
			newLine = Number(hunk[3]);
			newLeft = Number(hunk[4] ?? 1);
			rows.push({ kind: "hunk", text, oldLine: null, newLine: null, comment: null });
			continue;
		}
		if (text === "\\ No newline at end of file") {
			rows.push({ kind: "notice", text, oldLine: null, newLine: null, comment: null });
			continue;
		}
		const prefix = text[0];
		if (prefix === "+" && newLeft > 0) {
			rows.push({
				kind: "add",
				text: text.slice(1),
				oldLine: null,
				newLine,
				comment: { side: "RIGHT", line: newLine },
			});
			newLine++;
			newLeft--;
		} else if (prefix === "-" && oldLeft > 0) {
			rows.push({
				kind: "delete",
				text: text.slice(1),
				oldLine,
				newLine: null,
				comment: { side: "LEFT", line: oldLine },
			});
			oldLine++;
			oldLeft--;
		} else if (prefix === " " && oldLeft > 0 && newLeft > 0) {
			rows.push({ kind: "context", text: text.slice(1), oldLine, newLine, comment: { side: "RIGHT", line: newLine } });
			oldLine++;
			newLine++;
			oldLeft--;
			newLeft--;
		}
	}
	return rows;
}
