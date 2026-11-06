# herdr-plugin-github

GitHub for the [Herdr](https://herdr.dev) desktop app: a mod that talks to GitHub
through the `gh` CLI on this computer (or, when it has none, on the repository's machine).
Remote machines need only git: it reads which repository a folder is.

## Layout

```
src/github/         the source (TypeScript)
  main.ts           entry: a View; roles picked by props().role
  gh.ts             the only file that reaches GitHub (exec "gh api ...")
  gh-args.ts        pure helpers (no "herdr" import): unit-tested with Bun
  context.ts        the focused folder and machine
  ui.ts             shared UI helpers
mods/github/        the mod as Herdr loads it: built *.js (committed) + mod.json, assets
keys.json           snippet to merge into ~/.config/herdr-app/keys.json
types/              herdr.d.ts + gpui-kit.d.ts from Herdr (see types/VERSION)
docs/herdr/         Herdr's own guide (AGENTS.md) and docs, for reference
docs/reference/     (git-ignored) shipped Herdr mods and herdr-layout-examples mods, read-only examples
test/               bun test, pure modules only
```

## Why a build step

Herdr runs mods in QuickJS: it loads plain ES modules only (no `.ts`, no npm packages,
no Node/Bun APIs). `tsc` turns each `src/github/*.ts` into `mods/github/*.js` with the
types erased and comments kept, so the shipped folder stays readable.

Other runtime limits: `fetch` returns no headers and refuses Authorization across
cross-origin redirects (Actions logs/artifacts), so GitHub goes through `gh`;
Herdr 0.1.13 `exec` has a 30 s limit and 8 MiB output.

## Commands

```sh
bun install
bun run dev         # tsc --watch: rebuilds mods/github/ on save (Herdr hot-reloads it)
bun run build       # build once
bun run typecheck   # mod sources against types/, tests against Bun
bun test
bun run check       # herdr-app check mods/github (needs herdr-app on PATH)
bun run verify      # build + typecheck + test + check
bun run check:built # fails if committed mods/github/*.js is not what src/ builds
bun run types       # refresh types/ and docs/herdr/AGENTS.md from an installed Herdr
```

## Try it in Herdr

Copy (or sync) `mods/github/` to `~/.config/herdr-app/mods/github/`, then:

```sh
herdr-app do mod.open '{"name":"github"}'                      # as a window
herdr-app do pane.split '{"direction":"right","mod":"github"}'  # as a pane
```

or merge `keys.json` (Cmd+Shift+G; on Linux/Windows use `ctrl-shift-g`).
`herdr-app status` shows load errors: a broken save keeps the old version running.
