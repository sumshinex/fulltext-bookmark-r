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

## [ERR-20260411-002] webdav-history-domparser

**Logged**: 2026-04-11T00:00:00Z
**Priority**: high
**Status**: pending
**Area**: backend

### Summary
WebDAV 历史版本列表在扩展后台刷新时报 `DOMParser is not defined`，导致历史版本始终为空。

### Error
```text
DOMParser is not defined
```

### Context
- Operation attempted: 点击设置页“刷新列表”读取 WebDAV 历史备份版本
- Workspace: `D:/ClaudeWork/fulltext-bookmark-main`
- Cause: 浏览器扩展后台当前运行环境没有 DOMParser，`PROPFIND` XML 解析不能依赖 DOM API

### Suggested Fix
将 WebDAV `PROPFIND` 返回解析改为纯字符串 / 正则提取 `href`，避免依赖 `DOMParser`。

### Metadata
- Reproducible: yes
- Related Files: background.ts, options/components/WebDAVBackupSettings.tsx

---

## [ERR-20260411-003] webdav-delete-loading-type

**Logged**: 2026-04-11T00:00:00Z
**Priority**: medium
**Status**: pending
**Area**: frontend

### Summary
给 WebDAV 历史版本新增删除动作后，`actionLoading` 联合类型未同步补上 `delete`，导致 typecheck 失败。

### Error
```text
TS2345: Argument of type '"delete" | "test" | "backup" | "restore"' is not assignable to parameter of type '"test" | "backup" | "restore" | "history"'.
```

### Context
- Operation attempted: 为历史备份列表增加删除按钮并复用现有 loading 文案函数
- Workspace: `D:/ClaudeWork/fulltext-bookmark-main`
- Cause: 新增 loading 状态时漏改了 `getRunningLabel` 参数联合类型

### Suggested Fix
扩展所有相关联合类型定义，新增动作时同步检查 loading state、按钮文案和状态判断分支。

### Metadata
- Reproducible: yes
- Related Files: options/components/WebDAVBackupSettings.tsx

---
