// Local git facts for a folder, on its machine.
import { exec } from "herdr";
import { pickRemote, type RemoteRepo } from "../core/remote.ts";
import type { Where } from "./gh.ts";

/** The folder's GitHub remote (gh's choice of remote), or null outside a repo or without one. */
export async function githubRemote(where: Where): Promise<RemoteRepo | null> {
  if (!where.cwd) return null;
  const r = await exec("git", ["remote", "-v"], { cwd: where.cwd, on: where.on ?? null });
  return r.code === 0 ? pickRemote(r.stdout) : null;
}
