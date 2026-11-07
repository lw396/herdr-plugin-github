import type { Change } from "./conditional.ts";

interface Request {
	etag: string | null;
	force: boolean;
}

/** One reader's polling state: visibility, single-flight reads, validators and stale-answer rejection. */
export class IssuePolling {
	private key: string | null = null;
	private visible = false;
	private etag: string | null = null;
	private failed = false;
	private pending: Request | null = null;

	/** Returns whether the newly shown issue needs an immediate refresh. */
	sync(key: string | null, visible: boolean): boolean {
		const changed = key !== this.key;
		const refresh = visible && key !== null && (changed || !this.visible);
		if (changed) {
			this.etag = null;
			this.failed = false;
		}
		if (changed || !visible) this.pending = null;
		this.key = key;
		this.visible = visible;
		return refresh;
	}

	/** A local/shared write wins over an older read, and the next tick checks again without a validator. */
	invalidate(): void {
		this.pending = null;
		this.etag = null;
	}

	begin(force = false): Request | null {
		if (!this.key || !this.visible || this.pending) return null;
		const request = { etag: this.etag, force };
		this.pending = request;
		return request;
	}

	current(request: Request): boolean {
		return this.visible && this.pending === request;
	}

	reload(request: Request, change: Change): boolean {
		return this.current(request) && (request.force || change.changed);
	}

	/** Finish only after any required discussion reload succeeds; failed reloads must be retried. */
	finish(request: Request, change?: Change): { accepted: boolean; notify: boolean } {
		if (!this.current(request)) return { accepted: false, notify: false };
		const notify = !change || change.changed || request.force || this.failed;
		this.pending = null;
		this.failed = !change;
		if (!change) this.etag = null;
		else if (change.changed) this.etag = change.etag;
		return { accepted: true, notify };
	}
}
