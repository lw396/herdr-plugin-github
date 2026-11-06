// A small cache for what the sidebar shows (gh accounts, remotes, issue groups): one entry per
// key, fresh for a while; a stale entry still shows while it is fetched again.
export class Cache {
    limit;
    entries = new Map();
    constructor(limit) {
        this.limit = limit;
    }
    has(key) {
        return this.entries.has(key);
    }
    /** The value, fresh or not; marks it recently used. */
    get(key) {
        const entry = this.entries.get(key);
        if (!entry)
            return undefined;
        this.entries.delete(key);
        this.entries.set(key, entry);
        return entry.value;
    }
    /** Whether it was set less than `maxAge` ms before `now`. */
    fresh(key, maxAge, now) {
        const entry = this.entries.get(key);
        return entry !== undefined && now - entry.at < maxAge;
    }
    clear() {
        this.entries.clear();
    }
    set(key, value, now) {
        this.entries.delete(key);
        this.entries.set(key, { value, at: now });
        while (this.entries.size > this.limit)
            this.entries.delete(this.entries.keys().next().value);
    }
}
