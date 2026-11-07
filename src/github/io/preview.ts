import { Cache } from "../core/cache.ts";
import type { DetailRef } from "../core/detail.ts";
import { type Preview, parsePreview, previewKey } from "../core/preview.ts";
import * as gh from "./gh.ts";

/** Hover-only reads: bounded, one minute fresh, and never shared across machines or accounts. */
export class Previews {
	private cache = new Cache<Preview>(100);
	private pending = new Map<string, Promise<Preview>>();

	peek(ref: DetailRef, on: string | null, login: string): Preview | undefined {
		return this.cache.get(previewKey(ref, on, login));
	}

	load(ref: DetailRef, on: string | null, login: string): Promise<Preview> {
		const key = previewKey(ref, on, login);
		if (this.cache.fresh(key, 60_000, Date.now())) return Promise.resolve(this.cache.get(key)!);
		const pending = this.pending.get(key);
		if (pending) return pending;
		const path = `repos/${ref.repo}/${ref.kind === "pr" ? "pulls" : "issues"}/${ref.number}`;
		const request = gh
			.api(path, { on })
			.then((data) => {
				const preview = parsePreview(data, ref.kind);
				this.cache.set(key, preview, Date.now());
				return preview;
			})
			.finally(() => this.pending.delete(key));
		this.pending.set(key, request);
		return request;
	}
}
