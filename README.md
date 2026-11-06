# herdr-plugin-github

GitHub for the [Herdr](https://herdr.dev) desktop app: a mod that talks to GitHub
through the `gh` CLI on the machine the folder is on: this computer's for a local folder,
that machine's for a remote one, never the other (ADR 0003). So a remote machine needs git
and gh, signed in there (`gh auth login`); the sidebar says which machine when it isn't.

## Layout

```
src/github/         the source (TypeScript); Herdr wants main.js and mod.json at the top
  main.ts           entry: a View that hands off to a role (props().role)
  mod.json          the manifest, copied as it is
  core/             pure logic, imports nothing else (gh-args: gh's arguments and output;
                    remote: which repository a git remote is; account: what the sidebar says about gh;
                    location: the focused folder, kept while focus is on a pane without one;
                    cache: kept values, fresh for a while, least recently used dropped;
                    issues: issue groups' GraphQL query and pages, rows and notices; issue-detail: metadata and discussion;
                    markdown: image links without network requests; time: "2h"-style times)
  io/               Herdr and programs: gh.ts (the only way to GitHub; account(): the folder's machine's gh),
                    git.ts (git on the folder's machine), context.ts (feeds core/location Herdr's live data, remembers its last answer),
                    issues.ts (issue groups and complete issue discussions through gh), detail-tabs.ts (native Herdr issue tabs),
                    known.ts (cached: gh account per machine,
                    remote per machine + folder, issue groups per kind + machine + host/owner/repo + login)
  views/            one file per role (panel.ts sidebar, issue.ts detail reader) and ui.ts (shared UI helpers)
  assets/           copied as they are (github.svg -> mods/github/assets/github.svg)
mods/github/        build output, committed: the mod as Herdr loads it
mods/tabs-github/   Herdr's tab bar with a GitHub panel button (a marked copy of the shipped `tabs`)
layouts/github.json Herdr's `main` layout with `tabs-github` and a `github` child in the side panel
keys.json           snippet to merge into ~/.config/herdr-app/keys.json
types/              herdr.d.ts + gpui-kit.d.ts from Herdr (see types/VERSION)
GLOSSARY.md         the words we use (GitHub mod, 侧边栏, 详情窗格, ...)
docs/adr/           scope and design decisions, one per file
docs/herdr/         Herdr's own guide (AGENTS.md) and docs, for reference
docs/reference/     (git-ignored) shipped Herdr mods and herdr-layout-examples mods, read-only examples
test/               bun test, core/ and io/ like src/; `herdr` is test/fake-herdr.ts (its exec
                    answers like machines, spaces/panes/focused like a screen); fixtures/ real gh replies;
                    layers.test.ts checks what each folder imports
```

## Reading issues

Click a sidebar issue to open its details in Herdr's **top-level tab bar**, beside terminal tabs.
Click it again to select its existing issue tab in the same space. No terminal is split and there
is no second tab bar inside the reader. The reader shows metadata, Markdown body and all comments,
including reaction counts; images become “🖼 图片” browser links. Copy the issue link or open it in
the browser from the reader toolbar. Its gh runs on the issue tab's machine, independent of focus.

Open issue contents are session-only: restarting Herdr (or hot-reloading the mod) does not reload
them. Herdr may keep the native tab frame; it shows an empty reader until an issue is opened again.

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
