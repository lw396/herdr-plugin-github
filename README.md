# herdr-plugin-github

GitHub for the [Herdr](https://herdr.dev) desktop app: a mod that talks to GitHub
through the `gh` CLI on this computer (or, when it has none, on the repository's machine).
Remote machines need only git: it reads which repository a folder is.

## Layout

```
src/github/         the source (TypeScript); Herdr wants main.js and mod.json at the top
  main.ts           entry: a View that hands off to a role (props().role)
  mod.json          the manifest, copied as it is
  core/             pure logic, imports nothing else (gh-args: gh's arguments and output;
                    remote: which repository a git remote is)
  io/               Herdr and programs: gh.ts (the only way to GitHub; account() picks the gh),
                    git.ts (git on the folder's machine), context.ts (the focused folder)
  views/            one file per role (panel.ts) and ui.ts (shared UI helpers)
  assets/           copied as they are (github.svg -> mods/github/assets/github.svg)
mods/github/        build output, committed: the mod as Herdr loads it
mods/tabs-github/   Herdr's tab bar with a GitHub panel button (a marked copy of the shipped `tabs`)
layouts/github.json Herdr's `main` layout with `tabs-github` and a `github` child in the side panel
keys.json           snippet to merge into ~/.config/herdr-app/keys.json
types/              herdr.d.ts + gpui-kit.d.ts from Herdr (see types/VERSION)
docs/herdr/         Herdr's own guide (AGENTS.md) and docs, for reference
docs/reference/     (git-ignored) shipped Herdr mods and herdr-layout-examples mods, read-only examples
test/               bun test, core/ and io/ like src/; `herdr` is test/fake-herdr.ts (its exec
                    answers like machines); layers.test.ts checks what each folder imports
```

## Why a build step

Herdr runs mods in QuickJS: it loads plain ES modules only (no `.ts`, no npm packages,
no Node/Bun APIs). `scripts/build.sh` empties `mods/github/`, has `tsc` turn each `src/github/*.ts` into a `.js`
with the types erased and comments kept (so the shipped folder stays readable), and copies
the rest of `src/github/` as it is.

Other runtime limits: `fetch` returns no headers and refuses Authorization across
cross-origin redirects (Actions logs/artifacts), so GitHub goes through `gh`;
Herdr 0.1.13 `exec` has a 30 s limit and 8 MiB output.

## Commands

```sh
bun install
bun run dev         # copy assets, then tsc --watch: rebuilds on save (Herdr hot-reloads it); rerun after editing an asset
bun run build       # build once
bun run typecheck   # mod sources against types/, tests against Bun
bun test
bun run check       # herdr-app check mods/github mods/tabs-github (needs herdr-app on PATH)
bun run verify      # build + typecheck + test + check
bun run check:built # fails if committed mods/github/ is not what src/ builds
bun run types       # refresh types/ and docs/herdr/AGENTS.md from an installed Herdr
```

## Try it in Herdr

Copy (or sync) `mods/github/`, `mods/tabs-github/` and `layouts/github.json` into
`~/.config/herdr-app/`, then switch to the layout (or `ctrl-shift-l` cycles layouts):

```sh
herdr-app do layout.switch '{"name":"github"}'   # Files · Changes · GitHub in the tab bar
```

Herdr's shipped layouts and its `tabs` mod are read-only and draw only Files and Changes,
so the GitHub button needs this layout. Without it, the panel still opens elsewhere:

```sh
herdr-app do mod.open '{"name":"github"}'                      # as a window
herdr-app do pane.split '{"direction":"right","mod":"github"}'  # as a pane
```

or merge `keys.json` (Cmd+Shift+G; on Linux/Windows use `ctrl-shift-g`).
`herdr-app status` shows load errors: a broken save keeps the old version running.
