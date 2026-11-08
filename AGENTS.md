# herdr-plugin-github

Read `README.md` for the project's purpose and current features. For ticketed work, GitHub issue #1
and its sub-issues define the plan and order; use the tracker guide below before accessing them.

## Change rules

- Edit `src/github/`; `mods/github/` is generated, installable output. Rebuild and commit it with code changes.
- Folders go feature first, then layer (ADR 0008): each feature folder keeps pure logic in `core/`, external
  operations in `io/`, and UI in `views/`; `roles/` assembles them and `main.ts` selects the role.
  `test/layers.test.ts` defines permitted imports: the layers, the feature order, and their exceptions.
- Route all GitHub access through `shared/io/gh.ts`. Run git with `{ cwd, on }` from `shared/io/context.ts`, and gh
  with `on` from `gh.account()`. Remote folders use the remote machine's tools and credentials; never fall back locally.
  Pass gh explicit `owner/repo` from `githubRemote()`, not a cwd or `{owner}/{repo}` placeholders.
- Use the context each callback receives; do not retain `cx`. Schedule work with `cx.timer` and `cx.spawn`, not `setTimeout`.
- Use theme colors through `shared/views/ui.ts`. Stop mouse-down propagation on controls inside window overlays.
- Keep `init()` read-only: `herdr-app check` executes it.
- Never open a Herdr window with a changed `HOME` or `HERDR_APP_HOME`: it can overwrite real machines' spaces.
  With a temporary app home, use subcommands only.

## Read before the relevant task

| Task | Required guide |
| --- | --- |
| Change dependencies, imports, assets or the build pipeline | [Build and dependencies](docs/agents/build.md) |
| Call Herdr APIs, change UI/layouts, diagnose runtime behavior or upgrade Herdr | [Herdr integration](docs/agents/herdr.md) |
| Add/change tests, implement behavior or fix a bug | [Testing](docs/agents/testing.md) |
| Read or write GitHub tracker issues | [Issue tracker](docs/agents/issue-tracker.md) |
| Triage or change tracker labels | [Issue tracker](docs/agents/issue-tracker.md) and [triage labels](docs/agents/triage-labels.md) |
| Explore or change domain terms and decisions | [Domain docs](docs/agents/domain.md) |

## Completion

For code changes, run `bun run verify` and include rebuilt output. Use `package.json` for individual commands.
Report checks actually performed and any remaining app validation. Herdr loading checks do not prove that
layouts work or that the UI looks correct; those require the person's Mac.

For documentation-only changes, check the diff, referenced paths and consistency with the implementation.

For reviews, write the change with `scripts/review-patch.sh <base>` and give reviewers that file.
A reviewer that cannot read it has not reviewed the change: report that review as blocked.
