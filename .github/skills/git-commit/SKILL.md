---
name: git-commit
description: "Commit message format and conventions for this repository. USE FOR: writing
  commit messages, making commits, PR descriptions. DO NOT USE FOR: code changes themselves."
---

# Git Commit Conventions

## Commit Message Format

```
<type>(<scope>): <summary>

<body — what and why, wrap at 72 chars>

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

## Types

| Type | When to use |
|------|-------------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `refactor` | Code restructuring (no behavior change) |
| `test` | Adding or updating tests |
| `docs` | Documentation only |
| `chore` | Maintenance, deps, tooling |
| `perf` | Performance improvement |

## Scope

Use the primary module or area being changed:
- `api` — API routes or controllers
- `db` — Database models or migrations
- `auth` — Authentication/authorization
- `ui` — Frontend components
- `config` — Configuration files
- `ci` — CI/CD pipelines

## Rules

1. Summary line: imperative mood, lowercase, no period, ≤72 chars
2. Body: explain *what* and *why*, not *how* (the diff shows how)
3. Always include `Co-authored-by: Copilot` trailer for AI-assisted commits
4. One logical change per commit — don't mix unrelated changes

## Examples

```
feat(api): add health check endpoint

Adds /health returning 200 with uptime and version info.
Required for load balancer probe configuration.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

```
fix(auth): prevent token refresh race condition

Multiple concurrent requests could trigger parallel refresh calls.
Added a mutex lock around the refresh flow.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```
