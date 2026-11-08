export class Cache<T> {
	private readonly limit: number;
	private entries = new Map<string, { value: T; at: number }>();

	constructor(limit: number) {
		this.limit = limit;
	}

	keys(): string[] {
		return [...this.entries.keys()];
	}

	get(key: string): T | undefined {
		const entry = this.entries.get(key);
		if (!entry) return undefined;
		this.entries.delete(key);
		this.entries.set(key, entry);
		return entry.value;
	}

	fresh(key: string, maxAge: number, now: number): boolean {
		const entry = this.entries.get(key);
		return entry !== undefined && now - entry.at < maxAge;
	}

	delete(key: string): void {
		this.entries.delete(key);
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
