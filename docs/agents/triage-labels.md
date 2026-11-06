# Triage Labels

| Canonical role | Tracker label | Meaning |
| --- | --- | --- |
| needs-triage | needs-triage | Maintainer evaluation needed |
| needs-info | needs-info | Waiting on reporter |
| ready-for-agent | ready-for-agent | Fully specified; ready for an AFK agent |
| ready-for-human | ready-for-human | Requires human implementation |
| wontfix | wontfix | Will not be actioned |

Use this mapping whenever a skill refers to a triage role.

GitHub label provisioning is pending repository selection.
Once the repository is confirmed, list its labels and create only
missing labels with `gh label create <label> --repo owner/repo`.
