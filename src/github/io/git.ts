// Local git facts for a folder, on its machine.
import { exec } from "herdr";
import { parseRemoteUrl, pickRemote, type RemoteRepo } from "../core/remote.ts";
import type { Where } from "./gh.ts";

/** The folder's GitHub remote (gh's choice of remote), or null outside a repo or without one. */
export async function githubRemote(where: Where): Promise<RemoteRepo | null> {
	if (!where.cwd) return null;
	const r = await exec("git", ["remote", "-v"], { cwd: where.cwd, on: where.on ?? null });
	return r.code === 0 ? pickRemote(r.stdout) : null;
}

export interface LocalBranches {
	branches: string[];
	head: RemoteRepo;
}

/** A read-only snapshot; changes here invalidate the local group's matched PRs. */
export async function localBranches(remote: RemoteRepo, where: Where): Promise<LocalBranches> {
	if (!where.cwd) throw new Error("No focused folder for local pull request branches.");
	const options = { cwd: where.cwd, on: where.on ?? null };
	const result = await exec("git", ["for-each-ref", "--format=%(refname:short)", "refs/heads"], options);
	if (result.code !== 0) throw new Error(result.stderr.trim() || "Could not read local branches.");
	const branches = result.stdout
		.split("\n")
		.map((b) => b.trim())
		.filter(Boolean);
	if (branches.length === 0) return { branches, head: remote };
	const remotes = await exec("git", ["remote", "-v"], options);
	if (remotes.code !== 0) throw new Error(remotes.stderr.trim() || "Could not read git remotes.");
	// In a fork the sidebar follows upstream, but the local branches belong to origin.
	const origin = remotes.stdout
		.split("\n")
		.filter((line) => /^origin\s/.test(line))
		.join("\n");
	const other = remotes.stdout
		.split("\n")
		.filter((line) => {
			const url = line.trim().split(/\s+/)[1];
			const repo = url ? parseRemoteUrl(url) : null;
			return repo && `${repo.owner}/${repo.repo}`.toLowerCase() !== `${remote.owner}/${remote.repo}`.toLowerCase();
		})
		.join("\n");
	return { branches, head: pickRemote(origin) ?? pickRemote(other) ?? remote };
}
