// The gh that talks to GitHub: the one on the folder's machine (ADR 0003), and what the sidebar says about it.
import { explain } from "./gh-args.ts";

/** Whether gh is installed and signed in on a machine. */
export type Status =
  | { ok: true; user: string }
  | { ok: false; reason: "missing" | "auth" | "error"; message: string };

/** Which gh to talk to GitHub with: `on` is the folder's machine (null: this computer). */
export interface Account {
  on: string | null;
  status: Status;
}

/** The sidebar's gh line: who is signed in where, or what to do on which machine. */
export function describeAccount(account: Account): { ok: boolean; text: string } {
  const { on, status } = account;
  if (status.ok) return { ok: true, text: `signed in as ${status.user}` + (on ? ` on ${on}` : "") };
  const machine = on ?? "this computer", there = on ? ` on ${on}` : "";
  if (status.reason === "missing") {
    return { ok: false, text: `gh is not installed on ${machine}: install it${on ? " there" : ""}, then run gh auth login${there}` };
  }
  if (status.reason === "auth") return { ok: false, text: `not signed in on ${machine}: run gh auth login${there}` };
  return { ok: false, text: `gh on ${machine}: ${explain(status.message)}` };
}
