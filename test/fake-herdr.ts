// A stand-in for Herdr's `herdr` module under Bun (loaded by test/preload.ts).
// Only the system boundary is faked: `exec`, as machines that answer commands, and Herdr's
// live data (`spaces`, `panes`, `focused`), as a screen set up per test.
import type { ExecResult, PaneInfo, SpaceInfo, focused as Focused } from "herdr";

/**
 * What a command prints (code defaults to 0), or an Error: exec rejects (program missing, machine
 * unreachable). A Promise of either answers when it settles: a slow machine, for ordering tests.
 */
export type Reply = Partial<ExecResult> | Error | Promise<Partial<ExecResult> | Error>;

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

/** What Herdr shows: spaces, panes and focus, shaped like Herdr's (only the fields io/ reads need be set). */
export interface Screen {
  spaces?: Partial<SpaceInfo>[];
  panes?: Partial<PaneInfo>[];
  focused?: Partial<NonNullable<ReturnType<typeof Focused>>> | null;
}

let shown: Screen = {};

/** Sets what Herdr shows; later calls replace it, as focus moves. */
export function screen(s: Screen): void {
  shown = s;
}

export const spaces = (): Partial<SpaceInfo>[] => shown.spaces ?? [];
export const panes = (): Partial<PaneInfo>[] => shown.panes ?? [];
export const focused = () => (shown.focused === undefined ? null : shown.focused);

export function reset(): void {
  machines.clear();
  shown = {};
}

export async function exec(command: string, args: string[] = [], options: { cwd?: string; on?: string | null } = {}): Promise<ExecResult> {
  const on = options.on ?? null;
  const replies = machines.get(on);
  if (!replies) throw new Error(`cannot reach machine ${on}`);
  const reply = await replies[`${options.cwd ?? "~"}$ ${[command, ...args].join(" ")}`];
  // Herdr's own wording when the program isn't there (src/mods.rs run_blocking; hc exec on another machine).
  if (reply === undefined) throw new Error(`cannot ${on ? "start" : "run"} ${command}: No such file or directory (os error 2)`);
  if (reply instanceof Error) throw reply;
  return { code: 0, stdout: "", stderr: "", ...reply };
}
