# AGENT_RULES

## Required Task Header
Every future task execution must explicitly declare:
- `PROJECT`
- `REPO`
- `THREAD`
- `GOAL`

## Mandatory Pre-Flight Check
Before any edits or commands that change state:
1. Confirm the current project is Nivran.
2. Confirm repository context is `mmaani/nivran-website`.
3. Confirm targeted files and code paths belong to this project.
4. Confirm no instructions reference another project (especially Zomorod Medical Supplies or QuickAIBuy).

## Stop-On-Mismatch Policy
If project mismatch is detected at any stage, stop immediately and report:

`PROJECT MISMATCH DETECTED`

No file edits, no migrations, no packaging, and no deployment actions are allowed after mismatch detection.

## Repo Inspection Requirement
Inspect relevant existing repo files before making changes. At minimum, inspect structure and any directly affected docs/config/code to avoid speculative edits.

## Secrets Handling
- Use environment-based secret handling only.
- Do not commit secrets into tracked files.
- Do not print secret values in logs, terminal output, commit messages, or docs.

## Generated Artifact Policy
- Do not commit generated runtime artifacts.
- Keep build output, caches, logs, and local runtime files ignored.

## Scope-Lock Requirement
All modifications must remain inside Nivran scope defined in `docs/PROJECT_SCOPE.md` and isolation rules in `docs/PROJECT_ISOLATION.md`.
