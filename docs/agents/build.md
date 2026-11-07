# Build and dependencies

## Source and output

`src/github/` contains the TypeScript, manifest and assets. `scripts/build.sh` and `scripts/bundle.mjs`
bundle the entry point as unminified ESM and copy assets. `tsc` checks types only.
The watch build copies assets at startup; restart it after an asset change.

Import source siblings as `./x.ts`. Reference UI assets as `mods/github/assets/<file>`.
Keep TypeScript erasable: no enums, namespaces or constructor parameter properties.

## Formatting and lint

Biome (`biome.json`) formats and lints TypeScript, JavaScript and JSON; `bun run lint` (part of `verify`)
checks, and `bun run format` rewrites. Do not hand-format. Markdown, generated output (`mods/`, `types/`),
Herdr's own files (`layouts/`, `docs/`) and the real gh replies in `test/fixtures/` are excluded:
keep them as written.

## Dependency constraints

Herdr loads plain JavaScript and resolves only `herdr`, `gpui-kit`, `gpui-base` and relative files.
Bundle npm dependencies; externalize only those host modules. Runtime code has no DOM, Node or Bun globals
(and no `Intl`). Herdr does provide some web globals such as WHATWG `URL`: declare each one the mod uses in
`src/github/runtime.d.ts` and cover it in the smoke test, which runs in Herdr's QuickJS.

Use neutral module conditions. A library's browser entry may require a DOM even when its default entry does not
—for example, the browser-conditioned entity decoder uses `document.createElement()`.
Check actual library calls in Herdr, not just in Bun.

`core/markdown.ts` is the only core module allowed to import the approved pure parsers;
`test/layers.test.ts` holds the allowlist. Keep other core imports inside `core/`.

Keep build-only tools in dev dependencies. When changing the build or dependencies, verify both the normal
build and watch startup, and check committed output with `bun run check:built` after committing it.
