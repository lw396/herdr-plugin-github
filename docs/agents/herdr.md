# Herdr integration

## API sources

Use `types/herdr.d.ts` and `types/gpui-kit.d.ts` for the version in `types/VERSION`.
They are generated: refresh with `bun run types` from the intended app home rather than editing them.
Read `docs/herdr/AGENTS.md` for mod, layout, command and key conventions.

Working examples may be available in git-ignored `docs/reference/`: `changes` for git/focused folders,
`files` for lazy trees, `t4-threads` for gh calls, and `tmux-prefix` for keys/overlays.
Treat them as read-only references, not type-checked project code. If absent, obtain them from
`defaults/mods/` in `herdrdev/herdr-app` and `herdrdev/herdr-layout-examples`.

## Runtime constraints (Herdr 0.1.13)

- `exec` has no shell or stdin, a 30-second limit and an 8 MiB output limit.
  Put long work such as `gh run watch` in a terminal via `run("terminal.open", { argv })`; poll short reads instead.
- Remote exec runs through `hc exec --on <machine>`, with the remote core's PATH, not `.bashrc`.
  Missing programs reject with `cannot start <cmd>` or `cannot run <cmd>`.
- `fetch` exposes no response headers, decodes bodies as text, and refuses Authorization across cross-origin redirects.
  GitHub calls belong in the gh adapter, including Actions logs/artifacts.
- `image()` and `svg()` require app-home paths; download remote images before rendering them.
- Hidden copies keep running timers, so poll gently. Herdr live data such as `spaces()` and `focused()` already
  re-renders the mod; do not poll it.

## GitHub CLI output

`gh api --jq` prints plain text, including unquoted strings: use `apiText()`, not `api()`.
JSON pagination uses `--slurp`; `io/gh.ts` flattens REST array pages once and retains object pages.
The target machine needs gh with this flag. Preserve its error rather than falling back to another machine.

## Layout and upgrades

`mods/tabs-github/` and `layouts/github.json` adapt Herdr 0.1.13's shipped `tabs` and `main` layout.
Keep changes small and mark tab-mod changes `herdr-plugin-github`. The layout renames the tab bar,
adds GitHub to `panel-body`, and selects the GitHub pane-header role.
`src/github/views/pane.ts` only adds GitHub branding; preserve terminal headers and controls.

On upgrade, refresh types, recopy the shipped tab mod/layout, compare the new pane header,
and reapply these adaptations. Theme picks and panel sizes are per-layout; `github` does not inherit `main`'s.

## App validation

The app runs on the person's Mac; this dev server has no display. Mutagen mirrors `mods/github/`,
`mods/tabs-github/` and `layouts/github.json` into the Mac's app home, where Herdr hot-reloads them.
Ask for `herdr-app status` or a screenshot: a failed save can leave the previous build running.
A layout error appears in `layouts/github.error` in the app home.

Checks need `herdr-app` on PATH. If unavailable, obtain the release tarball listed by
`releases.herdr.dev/app/latest.json` in a temporary directory and use only its subcommands.
