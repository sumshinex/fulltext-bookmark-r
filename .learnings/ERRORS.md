# Errors

Command failures and integration errors.

---

## [ERR-20260410-001] git-status

**Logged**: 2026-04-10T00:00:00Z
**Priority**: low
**Status**: pending
**Area**: config

### Summary
Attempted to inspect repository status, but `fulltext-bookmark-main` is not a Git repository.

### Error
```text
fatal: not a git repository (or any of the parent directories): .git
```

### Context
- Command attempted: `git -C D:/ClaudeWork/fulltext-bookmark-main status --short`
- Reason: planning skill session recovery suggests checking git state when available
- Outcome: cannot use git-based recovery in this workspace

### Suggested Fix
Use file reads and planning files for state recovery in this workspace unless the project is moved into an actual Git repository.

### Metadata
- Reproducible: yes
- Related Files: task_plan.md, progress.md

---

## [ERR-20260410-002] vitest-missing

**Logged**: 2026-04-10T00:00:00Z
**Priority**: medium
**Status**: pending
**Area**: tests

### Summary
Attempted to run the new stat slice test, but workspace dependencies are not installed so `vitest` is unavailable.

### Error
```text
'vitest' is not recognized as an internal or external command
WARN Local package.json exists, but node_modules missing
```

### Context
- Command attempted: `pnpm test store/stat-slice.test.ts`
- Goal: verify the new failing GPT orchestration state test before implementing production code
- Outcome: test runner could not start because `node_modules` is missing

### Suggested Fix
Run `pnpm install` in `fulltext-bookmark-main`, then rerun the targeted test to confirm the RED phase.

### Metadata
- Reproducible: yes
- Related Files: package.json, store/stat-slice.test.ts

---

## [ERR-20260411-001] missing-planning-skill

**Logged**: 2026-04-11T00:00:00Z
**Priority**: medium
**Status**: pending
**Area**: config

### Summary
The session advertised a Superpowers planning skill, but invoking both `superpowers:writing-plans` and `superpowers:write-plan` failed with unknown-skill errors.

### Error
```text
Unknown skill: superpowers:writing-plans
Unknown skill: superpowers:write-plan
```

### Context
- Goal: transition from approved design spec to implementation planning
- Workspace: `D:/ClaudeWork/fulltext-bookmark-main`
- Outcome: planning flow could not continue via the expected skill, so manual implementation planning is required

### Suggested Fix
Verify the registered Superpowers skill names exposed to the session and align the documented handoff step with an actually invokable planning skill.

### Metadata
- Reproducible: unknown
- Related Files: docs/superpowers/specs/2026-04-11-fulltext-bookmark-webdav-backup-and-larger-popup-design.md

---
