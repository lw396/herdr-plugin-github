# Testing

Prefer the `tdd` skill: agree the core/IO seam, then work one vertical slice at a time, red before green.
Expected results come from real git/gh replies or specifications, not from recomputing the implementation.
Reproduce app bugs as failing core/IO tests before fixing them.

## Seams

- `test/core/`: command arguments, parsing and transformations into what the UI shows. Put pure logic here first.
- `test/io/`: external operations through a fake Herdr runtime. Under Bun, `test/preload.ts` substitutes
  `test/fake-herdr.ts` for `herdr`.
- Keep `views/` and `main.ts` thin; validate them with Herdr loading checks and actual app interaction.
- `test/smoke/main.ts` (`bun run smoke`, part of `verify`): bundled like the mod and loaded by `herdr-app check`,
  so parser and reader code runs in Herdr's QuickJS on real fixtures. Assertions throw from `init()`.
  Add a case here when a library or code path must work in QuickJS, not only in Bun. It does not replace the Mac check.

## Fake runtime

Use `machine(on, { "<cwd>$ <cmd>": reply })` for exec replies, copied from real stdout, stderr and exit codes.
An unknown command rejects like a missing program. A Promise reply represents a slow machine; resolve it
in the test to control ordering.

Use `screen({ spaces, panes, focused })` for the live screen, shaped like `herdr-app status`.
Before IO starts using another Herdr function, add it to the fake runtime.

The fake intentionally models commands and screens, not internal implementation calls. Assert behavior
through the agreed seam rather than private methods or a mock of each collaborator.
