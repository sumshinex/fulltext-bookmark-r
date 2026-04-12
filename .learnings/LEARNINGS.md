# Learnings

Corrections, insights, and knowledge gaps captured during development.

**Categories**: correction | insight | knowledge_gap | best_practice

---

## [LRN-20260412-001] best_practice

**Logged**: 2026-04-12T04:02:47Z
**Priority**: high
**Status**: pending
**Area**: config

### Summary
扩展后台在 redux-persist rehydrate 完成前触发带 `persistor.flush()` 的初始化逻辑，会把默认空设置提前写回 storage，导致 GPT 端点等配置“添加后丢失”。

### Details
本项目后台启动时会调用 `scheduleWebdavAutoBackup()`；该函数在缺少 WebDAV 配置时仍会走 `updateWebdavStatus()`，而后者会立即 `persistor.flush()`。由于 `background.ts` 早于持久化状态 rehydrate 完成就注册并执行这段逻辑，flush 会把默认初始 state 持久化，从而覆盖掉原本已保存的 `gptEndpoints` 等配置。

### Suggested Action
所有后台启动阶段会触发 `persistor.flush()` 或写 store 的初始化逻辑，都必须先等待 `persistor.getState().bootstrapped === true`。优先封装等待函数并在 `onInstalled` / `onStartup` 等入口统一使用。

### Metadata
- Source: error
- Related Files: background.ts, store/store.ts
- Tags: redux-persist, background-startup, settings-loss, gpt-endpoints

---
