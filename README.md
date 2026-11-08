# herdr-plugin-github

A GitHub mod for [Herdr](https://herdr.dev) that brings repository Issues and Pull Requests into your development workspace. Browse them alongside your terminals and read discussions in native Herdr tabs without switching to a browser. The interface follows the VS Code GitHub Pull Requests extension.

The mod uses GitHub CLI (`gh`) on the machine hosting the repository, so local and remote folders use their own GitHub accounts and credentials.

## Features

- **Repository detection** — identify the GitHub repository from the focused folder's git remotes.
- **Issue sidebar** — browse issues assigned to you, all open issues, and closed issues, with pagination.
- **Pull Requests tab** — **Local Pull Request Branches**, **Waiting For My Review**, **Created By Me** and **All Open**, as in the VS Code extension, list pull requests with a state icon, `#number title` (drafts in italics) and `by @author`, with pagination; hover a row to copy its number or open it in your browser. The local group batch-matches the focused folder's branches to their latest PRs, including closed and merged PRs, and checks head repositories to avoid fork-name collisions. Open a PR to read its description and comments, or expand its row to browse changed files.
- **Hover previews** — rest the pointer on an issue or PR for half a second to see its repository, creation date, state, title, author, description excerpt, and labels in a native hover card. Summaries load only on hover using that repository machine's gh, are cached for one minute per account, and never fetch comments or reviews. A cold or slow read shows a loading indicator until the summary arrives.
- **Status footer** — a fixed sidebar footer shows which gh account is used on which machine, and says when a check for list changes fails. It adds no requests; the issue list scrolls independently. The branch is left to Herdr's own display.
- **Automatic list refresh** — while the GitHub sidebar is visible, check for changes every 60 seconds using ETags; refresh expanded groups only when changed. Showing it again refreshes immediately. While the PRs tab and local group are visible and expanded, local branches are re-read each minute; only a changed branch snapshot or an explicit refresh reissues their GraphQL batch.
- **Native detail tabs** — open different issues and PRs in separate tabs; selecting an already-open item reuses its tab. Contents remain session-only.
- **Discussion reader** — read Markdown descriptions, comments, and reaction counts in individual cards.
- **Automatic discussion refresh** — check the visible issue tab every 10 seconds using ETags; keep unsent comments through refreshes, stop polling hidden tabs, and refresh immediately when shown again.
- **Issue and PR links** — links to the repository's issues and PRs open the appropriate reader in the same tab, with **←** to go back across both kinds; `#123` references open as issue links. Other links open in your browser.
- **Comment, close and reopen** — post a new comment (⌘/Ctrl+Enter) or close and reopen an issue from its tab; the sidebar's groups update at once.
- **Issue and PR metadata** — view colored labels, assignees, linked Projects, and milestones. PR descriptions also show reviewers with their review states and the source and target branches.
- **Activity timeline** — see label and assignment changes between comments in chronological order. PR descriptions also include reviews with grouped inline discussions, colored code snippets with Show/Hide controls, and reply/resolve actions without leaving the timeline. Commits, force-pushes, merges, and close/reopen events use compact rows rather than empty comment cards. Commit rows show the SHA and subject, with Show/Hide controls for the remaining message; authors and timestamps stay in a separate heading.
- **Changed files and unified diff** — browse a compact directory tree or flat list, with change-type badges. Expand a PR in the GitHub sidebar and select a file to view its diff in the same PR tab; **Description** switches back. The file tree stays in the sidebar, not above the reader. Diffs show old/new line numbers and colored additions/deletions using a virtual list. Files without a GitHub patch show an explanation; every file can be opened on GitHub.
- **Inline comments** — select a LEFT or RIGHT line number in a diff to open a comment box, then **Add Comment** to publish a standalone review comment. Headers and notices cannot receive comments; failed writes keep the draft and show the error. Drafts survive discussion refreshes and switching files within the PR.
- **Diff discussions** — existing review conversations appear beneath their LEFT/RIGHT diff line, with replies, reaction counts, and Resolve conversation / Unresolve conversation actions where permitted. Outdated or unavailable lines are explained rather than hidden. Select a discussion's file path in the timeline to jump to it in the same PR tab. Replies keep unsent text through refreshes; successful writes update immediately and notify other views on the same machine.
- **Viewed files** — mark a file with **Mark File As Viewed** or **Mark File As Not Viewed** from the sidebar or its diff; changes sync to GitHub and other open views. **Toggle Hide Viewed Files** filters both tree and list layouts. GitHub-invalidated marks (files changed since viewing) count as not viewed on refresh.
- **PR checks** — see check runs and commit statuses below the timeline, including recorded duration when available; open each check in your browser. When there are no checks or statuses, the section shows No checks reported.
- **Quick actions** — refresh an issue or PR, copy its URL, or open it in your browser.

## Requirements

- The Herdr desktop app.
- A folder cloned from a GitHub repository.
- `git` and GitHub CLI (`gh`) installed on the machine hosting that folder. The CLI must support `gh api --slurp`.
- A GitHub account signed in on that machine with `gh auth login`.

For a remote folder, install and authenticate these tools on the remote machine. The mod does not fall back to your local account.

## Installation

Copy or sync the following files into your Herdr app home:

| Repository path       | Destination                               |
| --------------------- | ----------------------------------------- |
| `mods/github/`        | `~/.config/herdr-app/mods/github/`        |
| `mods/tabs-github/`   | `~/.config/herdr-app/mods/tabs-github/`   |
| `layouts/github.json` | `~/.config/herdr-app/layouts/github.json` |

Then switch to the included layout:

```sh
herdr-app do layout.switch '{"name":"github"}'
```

Focus a terminal in your repository, select **GitHub** in the sidebar, and click an issue to open its discussion, or switch to **Pull Requests** and select a PR to read its description. The included layout adds the GitHub sidebar tab and GitHub-aware pane headers.

## Current scope

Issues can be read, commented on, closed and reopened. Pull requests can be listed, their descriptions and comments read, and their changed files viewed as unified diffs with standalone inline comments; submitting reviews is in progress. Creating or editing issues and pull requests is left to the browser or to `gh`.

Images are shown as browser links rather than loaded automatically. Open issue and PR contents are session-only: after restarting Herdr or hot-reloading the mod, empty detail panes close automatically after a short wait. Select the item from the sidebar to open it again.

Linked Projects require the appropriate GitHub permissions. If Projects cannot be read, the reader displays `None yet`, with the reason available in its tooltip.

## Development

Source code lives in `src/github/`; `mods/github/` contains the bundled, installable output and is committed to the repository. Installation does not require Node.js or npm packages.

```sh
bun install
bun run dev         # rebuild on source changes; restart after asset changes
bun run verify      # build, typecheck, tests, and Herdr loading checks
```

Verification requires `herdr-app` on your PATH. The app runs on the user's Mac; loading checks do not replace visual and interaction testing there.
