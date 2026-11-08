// Polling with conditional requests (ADR 0006): only while shown, one check at a time, the ETag of
// the last answer that was taken in, and answers to an older check or another place dropped.
import type { Change } from "./gh.ts";

export const DETAIL_POLL_MS = 10_000;

interface Request {
	etag: string | null;
	force: boolean;
}

export class ConditionalPoll {
	private key: string | null = null;
	private visible = false;
	private etag: string | null = null;
	private failed = false;
	private pending: Request | null = null;

	get shown(): boolean {
		return this.visible;
	}

	/** What is polled (null: nothing) and whether it is shown; returns whether it needs a refresh now. */
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

	/** A local write or failed reload wins over an older read, and the next check asks without a validator. */
	invalidate(): void {
		this.pending = null;
		this.etag = null;
	}

	/** A check to make, or null while hidden or another is out; a forced one replaces the one out. */
	begin(force = false): Request | null {
		if (!this.key || !this.visible || (this.pending && !force)) return null;
		const request = { etag: this.etag, force };
		this.pending = request;
		return request;
	}

	current(request: Request): boolean {
		return this.visible && this.pending === request;
	}

	/** Whether the check's answer calls for reading the contents again. */
	reload(request: Request, change: Change): boolean {
		return this.current(request) && (request.force || change.changed);
	}

	/**
	 * Finish only after any required reload succeeds (no `change`: it failed, so the next check asks
	 * again without a validator). `notify`: what is shown changed or recovered.
	 */
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
