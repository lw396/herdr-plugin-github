// Which GitHub repository a folder's git remotes point to. Pure: no `herdr` import.

export interface RemoteRepo {
  remote: string;
  host: string;
  owner: string;
  repo: string;
}

/** `https://host/o/r(.git)`, `ssh://git@host/o/r`, `git@host:o/r` -> host, owner, repo. */
export function parseRemoteUrl(url: string): Omit<RemoteRepo, "remote"> | null {
  const m = /^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?([^/:]+)(?::\d+)?[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i.exec(url.trim());
  if (!m) return null;
  const [, host, owner, repo] = m;
  return host && owner && repo ? { host: host.toLowerCase(), owner, repo } : null;
}

/**
 * The repository from `git remote -v` output, chosen as gh does:
 * upstream, then github, then origin, then the first. Only github.com hosts
 * and GitHub Enterprise hosts listed in `hosts` count.
 */
export function pickRemote(remoteV: string, hosts: string[] = ["github.com"]): RemoteRepo | null {
  const found: RemoteRepo[] = [];
  for (const line of remoteV.split("\n")) {
    const [remote, url, kind] = line.trim().split(/\s+/);
    if (!remote || !url || kind !== "(fetch)") continue;
    const parsed = parseRemoteUrl(url);
    if (parsed && hosts.includes(parsed.host)) found.push({ remote, ...parsed });
  }
  for (const name of ["upstream", "github", "origin"]) {
    const hit = found.find((r) => r.remote === name);
    if (hit) return hit;
  }
  return found[0] ?? null;
}
