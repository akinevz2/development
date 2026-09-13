# Development Workflow Agents

This document provides guidance for planning and managing code changes across development environments, particularly when synchronizing `main` branches with `ws-rarebox`.

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
