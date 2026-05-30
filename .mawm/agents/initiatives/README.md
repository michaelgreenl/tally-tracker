# Initiative Docs

This directory is planning context for humans and agents. Keep the active set small, current, and internally consistent.

## Source of Truth

- `.mawm/initiatives/roadmap.md` and initiative specs under `active/` are the current planning source of truth.
- Run specs under `active/<initiative-slug>/runs/active/` become active source-of-truth docs only after an executed workflow generates them.
- Active docs must reflect the project's current direction, current codebase state, and current sequencing.
- When plans shift, update every affected active doc in the same change. Do not leave stale text in one active file while another active file carries the correction.
- Rewrite or delete superseded active guidance instead of appending contradictory follow-up notes.
- Initiative planning does not prewrite run specs. Executed workflows generate them from the template when a run begins.
- Execution-only values such as target repo path, initiative branch, parent OpenCode session, and shared server URL come from the workflow launcher at runtime, not from the initiative docs.

## Historical Records

- Completed or archived run docs are kept for history and logging only.
- Historical docs can explain what used to be true or how something was previously implemented, but they are not the current source of truth for active planning or current code behavior.

## Drafts

- `queued/` docs capture possible future work or partially cleared direction.
- They are planning input, not authoritative over the roadmap, active specs, or the current codebase.

## Why Aligned Documents Matter

- Agents consume these docs as prompt context.
- Conflicting active docs create conflicting tokens, which increases the risk of wrong assumptions and hallucinated execution.
- Keep the active set aligned before asking agents to plan or execute from it.
