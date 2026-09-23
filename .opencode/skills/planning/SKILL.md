---
name: planning
description: "Creates implementation plans from approved designs. Generates structured plan files in ai_agents/plans/YYYY-MM-DD_<topic>.md format with consistent sections and cross-references."
---

# Planning Skill

Creates detailed implementation plans from approved design documents. Plans are saved to `ai_agents/plans/YYYY-MM-DD_<topic>.md` following the project's established format.

## When to Use

- After a design document has been approved (typically invoked from the brainstorming skill)
- When you need to break down a design into actionable implementation steps
- When creating a plan for a new feature, bug fix, or refactoring

## Plan File Format

All plans follow this structure:

```markdown
# Plan: <Title>

Date: YYYY-MM-DD · Status: **Planned** | **In Progress** | **Implemented** (YYYY-MM-DD) · Implementer: <name>

## Problem

Clear description of what problem this plan solves.

## Decisions

| Decision | Choice |
|----------|--------|
| Key architectural choice | Selected option with rationale |
| ... | ... |

## Existing Building Blocks

Reference to existing code/components that will be used or modified.

## Design Overview

High-level architecture diagram or description.

## Changes by File

### 1. `path/to/file.py`
```python
# Code changes with context
```

### 2. `path/to/other_file.py`
```python
# More changes
```

## Auth Flows / API Contracts / Data Models

Tables or descriptions of new/modified interfaces.

## Tests

Numbered list of test cases to write/verify.

## Verification

Commands to run to verify the implementation works.

## Security Notes

Any security considerations.

## Open Questions / Follow-ups

Items that need future decisions.

## Backlog

Future enhancements not in current scope.

## Status Update (YYYY-MM-DD)

Brief summary when implementation is complete.
```

## Process

1. **Read the approved design document** - understand the scope and decisions
2. **Create the plan file** - use today's date and a descriptive topic slug
3. **Fill in all sections** - be specific about file paths, code changes, and test cases
4. **Cross-reference** - link to the design doc, related plans, and AGENTS_CONTEXT.md
5. **Present to user** - ask for approval before implementation begins

## Location

Plans are always saved to: `ai_agents/plans/YYYY-MM-DD_<topic>.md`

Where `<topic>` is a short kebab-case description (e.g., `user_auth_refactor`, `celery_task_routing`).

## Example

```bash
# Create plan for "Add rate limiting to GraphQL API"
# File: ai_agents/plans/2026-09-10_graphql_rate_limiting.md
```
