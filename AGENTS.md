# Development Workflow Agents

This document provides guidance for planning and managing code changes across development environments, particularly when synchronizing `main` branches with `ws-rarebox`.

## Commit Grouping Discipline

Commits are tracked one-per-feature:

- Each feature added or removed gets exactly one commit — no more, no less.
- Incremental changes (follow-up fixes, tweaks, touch-ups belonging to a feature already committed) must be **clobbered together** with that feature's existing commit: `git commit --fixup <sha>` + `git rebase -i --autosquash --root` (or `--amend` when the feature is HEAD), never a separate micro-commit.
- Mixed-concern work must be split before committing: scaffold, pure engine, runtime, CLI, lint, docs and tests are separate features and land as separate commits.
- When a refactor rewrites a feature, the rewrite clobbers into the same feature commit so history stays one-commit-per-feature.
- Never let stray files ride along in a feature commit: check `git status --short` before committing, and commit only the paths that belong to the feature.

## Before Synchronizing with ws-rarebox

### 1. Stage and Review All Changes

Review all uncommitted changes and organize them before synchronization:

- Identify all modified, added, and untracked files
- Group related changes by feature or bug fix
- Ensure all changes are staged or committed in logical commits
- Verify no sensitive information is included

### 2. Create a Work Summary

Create a comprehensive summary before synchronization:

- List all staged changes with brief descriptions
- Highlight unfinished work that requires attention
- Note any experimental features still in development
- Tag dependencies or TODOs that need resolution
- Document any breaking changes introduced

### 3. Document Decision Context

Prepare the context for the next developer:

- Explain why specific changes were made
- Document trade-offs made during development
- Note alternative approaches that were considered
- Provide reasons for temporary workarounds

### 4. Prepare Sync Instructions

Document exactly what needs to be synchronized:

- List specific branches that will be updated
- Note any conflicts that may occur during synchronization
- Identify files that require merge adjustments
- Tag files requiring platform-specific changes

## After Synchronization

### 1. Verify Integration

Ensure all changes integrated cleanly and work correctly:

- Run all tests to verify no regressions
- Check that builds succeed across different environments
- Validate that feature branches still integrate smoothly

### 2. Remove Outdated State

Clean up work that was completed or abandoned:

- Remove completed tasks from sprint tracking
- Delete temporary branches no longer needed
- Document decisions made during integration

### 3. Update Development Notes

Reflect the current state after synchronization:

- Update this document with new relevant information
- Document any issues encountered during sync
- Note any adjustments made to development workflow
- Capture learnings from the integration process
