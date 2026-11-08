import type { Folder } from "../../shared/core/location.ts";
import type { RemoteRepo } from "../../shared/core/remote.ts";
import { Facts } from "../../shared/io/facts.ts";
import { appendPage, type Page } from "../core/page.ts";

export interface Ready extends Folder {
	remote: RemoteRepo;
	login: string;
}

interface GroupWhere<K> {
	kind: K;
	on: string | null;
	repo: string;
	login: string;
	cwd: string | null;
}

export class GroupCache<K extends string, T> {
	private readonly facts: Facts<T>;
	private readonly checkout: boolean;

	constructor(fresh: number, checkout = false) {
		this.facts = new Facts<T>(64, fresh);
		this.checkout = checkout;
	}

	private key(kind: K, r: Ready): string {
		const where: GroupWhere<K> = {
			kind,
			on: r.on,
			repo: `${r.remote.owner}/${r.remote.repo}`.toLowerCase(),
			login: r.login,
			cwd: this.checkout ? r.cwd : null,
		};
		return JSON.stringify(where);
	}

	peek(kind: K, r: Ready): T | undefined {
		return this.facts.peek(this.key(kind, r));
	}

	look(kind: K, r: Ready, force: boolean, ask: () => Promise<T>): Promise<T> {
		return this.facts.look(this.key(kind, r), force, ask);
	}

	put(kind: K, r: Ready, value: T): void {
		this.facts.put(this.key(kind, r), value);
	}

	patch(change: (where: GroupWhere<K>, value: T) => T | undefined): void {
		this.facts.patch((key, value) => change(JSON.parse(key) as GroupWhere<K>, value));
	}

	clear(): void {
		this.facts.clear();
	}
}

export function pagedGroups<K extends string, P extends Page<{ number: number }>>(
	ask: (kind: K, r: Ready, after: string | null) => Promise<P>,
) {
	const cache = new GroupCache<K, P>(60_000);
	return {
		patch: (change: (where: GroupWhere<K>, page: P) => P | undefined) => cache.patch(change),
		clear: () => cache.clear(),
		look: (kind: K, r: Ready, force = false): Promise<P> => cache.look(kind, r, force, () => ask(kind, r, null)),
		peek: (kind: K, r: Ready): P | undefined => cache.peek(kind, r),
		async more(kind: K, r: Ready, loaded: P): Promise<P> {
			const both = appendPage(loaded, await ask(kind, r, loaded.cursor));
			if (cache.peek(kind, r) === loaded) cache.put(kind, r, both);
			return both;
		},
	};
}
