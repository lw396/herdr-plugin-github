import type { DetailRef } from "../../detail/core/detail.ts";
import { Facts } from "../../shared/io/facts.ts";
import * as gh from "../../shared/io/gh.ts";
import { type Preview, parsePreview, previewKey } from "../core/preview.ts";

/** Hover-only reads: bounded, one minute fresh, and never shared across machines or accounts. */
export class Previews {
	private kept = new Facts<Preview>(100, 60_000);

	peek(ref: DetailRef, on: string | null, login: string): Preview | undefined {
		return this.kept.peek(previewKey(ref, on, login));
	}

	load(ref: DetailRef, on: string | null, login: string): Promise<Preview> {
		const path = `repos/${ref.repo}/${ref.kind === "pr" ? "pulls" : "issues"}/${ref.number}`;
		return this.kept.look(previewKey(ref, on, login), false, async () =>
			parsePreview(await gh.api(path, { on }), ref.kind),
		);
	}
}
