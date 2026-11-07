# herdr-plugin-github

A GitHub mod for [Herdr](https://herdr.dev) that brings repository Issues into your development workspace. Browse issues alongside your terminals and read discussions in native Herdr tabs without switching to a browser.

The mod uses GitHub CLI (`gh`) on the machine hosting the repository, so local and remote folders use their own GitHub accounts and credentials.

## Features

- **Repository detection** — identify the GitHub repository from the focused folder's git remotes.
- **Issue sidebar** — browse issues assigned to you, all open issues, and closed issues, with pagination.
- **Current branch** — a fixed sidebar footer shows the focused folder’s branch from Herdr’s live pane metadata, without extra git commands. The issue list scrolls independently.
- **Automatic list refresh** — while the GitHub sidebar is visible, check for changes every 60 seconds using ETags; refresh expanded groups only when changed. Showing it again refreshes immediately.
- **Native issue tabs** — open different issues in separate tabs; selecting an already-open issue reuses its tab.
- **Discussion reader** — read Markdown descriptions, comments, and reaction counts in individual cards.
- **Automatic discussion refresh** — check the visible issue tab every 10 seconds using ETags; keep unsent comments through refreshes, stop polling hidden tabs, and refresh immediately when shown again.
- **Issue links** — `#123` and links to the repository's issues open in the same tab, with **←** to go back; other links open in your browser.
- **Comment, close and reopen** — post a new comment (⌘/Ctrl+Enter) or close and reopen an issue from its tab; the sidebar's groups update at once.
- **Issue metadata** — view colored labels, assignees, linked Projects, and milestones.
- **Activity timeline** — see label and assignment changes between comments in chronological order.
- **Quick actions** — refresh an issue, copy its URL, or open it in your browser.

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

Focus a terminal in your repository, select **GitHub** in the sidebar, and click an issue to open its discussion. The included layout adds the GitHub sidebar tab and GitHub-aware pane headers.

## Current scope

The mod currently provides **read-only Issue browsing**. Creating or editing issues and posting comments are not supported yet.

Images are shown as browser links rather than loaded automatically. Open issue contents are session-only: after restarting Herdr or hot-reloading the mod, select an issue from the sidebar to load it again.

Linked Projects require the appropriate GitHub permissions. If Projects cannot be read, the reader displays `None yet`, with the reason available in its tooltip.

## Development

Source code lives in `src/github/`; `mods/github/` contains the bundled, installable output and is committed to the repository. Installation does not require Node.js or npm packages.

```sh
bun install
bun run dev         # rebuild on source changes; restart after asset changes
bun run verify      # build, typecheck, tests, and Herdr loading checks
```

Verification requires `herdr-app` on your PATH. The app runs on the user's Mac; loading checks do not replace visual and interaction testing there.
