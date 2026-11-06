// A stand-in for Herdr's `herdr` module under Bun (loaded by test/preload.ts).
// Only the system boundary is faked: `exec`, as machines that answer commands.
import type { ExecResult } from "herdr";

/** What a command prints (code defaults to 0), or an Error: exec rejects (program missing, machine unreachable). */
export type Reply = Partial<ExecResult> | Error;

/**
 * A machine: replies keyed by "<cwd>$ <command> <args...>", cwd "~" when none is given,
 * e.g. "/w/app$ git remote -v" or "~$ gh api user --jq .login". A command it
 * doesn't know isn't installed there.
 */
export type Machine = Record<string, Reply>;

const machines = new Map<string | null, Machine>();

/** Sets up machines for one test: `null` is this computer, other keys are machine names. */
export function machine(on: string | null, replies: Machine): void {
  machines.set(on, replies);
}

export function reset(): void {
  machines.clear();
}

export async function exec(command: string, args: string[] = [], options: { cwd?: string; on?: string | null } = {}): Promise<ExecResult> {
  const on = options.on ?? null;
  const replies = machines.get(on);
  if (!replies) throw new Error(`cannot reach machine ${on}`);
  const reply = replies[`${options.cwd ?? "~"}$ ${[command, ...args].join(" ")}`];
  // Herdr's own wording when the program isn't there (src/mods.rs run_blocking; hc exec on another machine).
  if (reply === undefined) throw new Error(`cannot ${on ? "start" : "run"} ${command}: No such file or directory (os error 2)`);
  if (reply instanceof Error) throw reply;
  return { code: 0, stdout: "", stderr: "", ...reply };
}
