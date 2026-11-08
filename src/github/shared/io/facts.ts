// Answers asked of a machine and kept for a while: a stale one still shows while it is asked again,
// and two looks at once share one ask.
import { Cache } from "../core/cache.ts";

export class Facts<T> {
	private cache: Cache<T>;
	private asking = new Map<string, Promise<T>>();
	private readonly fresh: number;
	/** Only answers `keep` accepts are kept. */
	private readonly keep: (value: T) => boolean;

	constructor(limit: number, fresh: number, keep: (value: T) => boolean = () => true) {
		this.cache = new Cache<T>(limit);
		this.fresh = fresh;
		this.keep = keep;
	}

	peek(key: string): T | undefined {
		return this.cache.get(key);
	}

	/** The kept answer when fresh (unless forced), else the ask already out (unless forced), else a new ask. */
	look(key: string, force: boolean, ask: () => Promise<T>): Promise<T> {
		const kept = this.cache.get(key);
		if (!force && kept !== undefined && this.cache.fresh(key, this.fresh, Date.now())) return Promise.resolve(kept);
		const pending = this.asking.get(key);
		if (pending && !force) return pending;
		const p: Promise<T> = ask()
			.then((value) => {
				// Only the newest ask is kept: a slower, older answer arriving after a ↻ is already out of date.
				if (this.asking.get(key) === p && this.keep(value)) this.cache.set(key, value, Date.now());
				return value;
			})
			.finally(() => {
				if (this.asking.get(key) === p) this.asking.delete(key);
			});
		this.asking.set(key, p);
		return p;
	}

	/** Keeps `value` as the answer now (a page loaded by other means: Load more). */
	put(key: string, value: T): void {
		this.cache.set(key, value, Date.now());
	}

	/** Shows what `change` returns for a kept key until asked again (undefined: untouched); an answer still out is dropped. */
	patch(change: (key: string, value: T) => T | undefined): void {
		for (const key of this.cache.keys()) {
			const value = this.cache.get(key);
			const changed = value === undefined ? undefined : change(key, value);
			if (changed === undefined) continue;
			this.cache.set(key, changed, -Infinity);
			this.asking.delete(key);
		}
	}

	clear(): void {
		this.cache.clear();
		this.asking.clear();
	}
}
