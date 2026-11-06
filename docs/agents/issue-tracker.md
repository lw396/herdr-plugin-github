# Issue tracker: GitHub

Issues and specs live in GitHub Issues. Use the `gh` CLI.

## Repository

Repository selection is pending; no Git remote is configured.
Before tracker operations, ask for the intended owner/repo.
Once confirmed, record it here and pass `--repo owner/repo` to
`gh issue` commands (use explicit repository paths for `gh api`).
A configured, unambiguous GitHub remote can supply the repository later.

## Operations

- Create/publish: `gh issue create --repo owner/repo --title "..." --body-file <file>`.
- Read/fetch: `gh issue view <number> --repo owner/repo --json number,title,body,labels,comments`.
- List: `gh issue list --repo owner/repo --state open --json number,title,body,labels`.
- Comment: `gh issue comment <number> --repo owner/repo --body "..."`.
- Label: `gh issue edit <number> --repo owner/repo --add-label "..."` or `--remove-label "..."`.
- Close: `gh issue close <number> --repo owner/repo --comment "..."`.

## Pull requests as a triage surface

**PRs as a request surface: no.**

## Wayfinding

- Map: one issue labelled `wayfinder:map`, with Notes, Decisions-so-far, and Fog.
- Children: link tickets as GitHub sub-issues. If unavailable, use a
  task list in the map and `Part of #<map>` in each child.
  Label tickets `wayfinder:<type>`: research, prototype, grilling, or task.
- Blocking: use native GitHub issue dependencies. Add with
  `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`.
  Obtain the database ID with
  `gh api repos/<owner>/<repo>/issues/<blocker> --jq .id`.
  If dependencies are unavailable, record `Blocked by: #<n>` in the child.
- Frontier: open, unassigned map children with no open blockers;
  first in map order wins.
- Claim: assign the ticket to `@me` as the session's first write.
- Resolve: comment with the answer, close the ticket, then append a
  gist and link to the map's Decisions-so-far.
