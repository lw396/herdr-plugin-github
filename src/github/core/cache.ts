// A small cache for what the sidebar shows (gh accounts, remotes, issue groups): one entry per
// key, fresh for a while; a stale entry still shows while it is fetched again.

export class Cache<T> {
	readonly limit: number;
	private entries = new Map<string, { value: T; at: number }>();

	constructor(limit: number) {
		this.limit = limit;
	}

	keys(): string[] {
		return [...this.entries.keys()];
	}

	has(key: string): boolean {
		return this.entries.has(key);
	}

	/** The value, fresh or not; marks it recently used. */
	get(key: string): T | undefined {
		const entry = this.entries.get(key);
		if (!entry) return undefined;
		this.entries.delete(key);
		this.entries.set(key, entry);
		return entry.value;
	}

	/** Whether it was set less than `maxAge` ms before `now`. */
	fresh(key: string, maxAge: number, now: number): boolean {
		const entry = this.entries.get(key);
		return entry !== undefined && now - entry.at < maxAge;
	}

	clear(): void {
		this.entries.clear();
	}

	set(key: string, value: T, now: number): void {
		this.entries.delete(key);
		this.entries.set(key, { value, at: now });
		while (this.entries.size > this.limit) this.entries.delete(this.entries.keys().next().value!);
	}
}
