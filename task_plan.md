# 任务计划

## 目标
- 基于 `docs/superpowers/specs/2026-04-10-fulltext-bookmark-model-endpoint-design.md` 继续推进模型端点编排改造，先恢复上下文、梳理现状、明确未完成项，再实施最小充分修改。

## 当前阶段
- [complete] 阶段 1：读取设计文档并恢复上下文
- [complete] 阶段 2：审查现有 GPT 设置、运行时请求链路与相关 UI
- [complete] 阶段 3：确定未完成项与实现方案
- [complete] 阶段 4：实施代码修改
- [complete] 阶段 5：执行最小必要验证并更新记录
- [complete] 阶段 6：补充端点编排相关测试
- [complete] 阶段 7：完成 WebDAV 单向备份与更大 Popup 设计文档
- [complete] 阶段 8：产出 WebDAV 备份与 Popup 放大的实现计划
- [complete] 阶段 9：实施 WebDAV 配置、后台命令与备份恢复链路
- [complete] 阶段 10：实施 Popup 放大、回归验证并更新记录
- [complete] 阶段 11：实施 WebDAV 自动备份、版本保留与设置页扩展
- [complete] 阶段 12：补充 WebDAV 历史版本列表与指定版本恢复
- [complete] 阶段 13：同步规划记录与验证结果

## 决策与约束
- 以设计文档为准，采用端点资源 + 能力绑定 + 默认模型策略 + 诊断层的结构。
- 不做旧配置兼容。
- 本次先恢复并继续未完成工作，优先最小充分修改，不做无关重构。
- 当前项目目录不是 Git 仓库；后续状态恢复与改动审查以文件读取和必要命令输出为准。
- 实施阶段按 TDD 推进：先补测试并验证失败，再写生产代码。

## 当前实现进度
- 已完成 `store/stat-slice.ts` 的 GPT 状态模型重建，并通过 `store/stat-slice.test.ts` 验证。
- 已完成 `lib/chat.ts` 的端点解析、模型解析、失败摘要与故障切换执行器，并通过 `lib/chat.test.ts` 验证。
- 已完成 `background.ts`、`popup/GPTSearch.tsx`、`options/hooks/useSettingsState.ts`、`options/components/GPTSettings.tsx` 的主链路改造，并补齐 GPT 设置页核心 i18n 文案。
- 当前主线已进入收尾阶段；若继续推进，下一步更适合做交互细节打磨或更高层验证，而非核心架构改造。

## 遇到的错误
| 错误 | 尝试次数 | 解决方案 |
|------|---------|---------|
| `.learnings` 目录不存在，导致查看时报错 | 1 | 在项目根目录初始化 `.learnings/` 及基础文件 |
| `git status` 失败：当前目录不是 Git 仓库 | 1 | 不再依赖 git 恢复，改用文件审查与规划文件同步状态 |
| `pnpm test store/stat-slice.test.ts` 失败：`vitest` 不存在且 `node_modules` 缺失 | 1 | 先安装项目依赖，再重新运行定向测试进入 RED 阶段 |
| `pnpm test lib/chat.test.ts` 失败：`executeWithEndpointFallback` 未实现 | 1 | 先在 `lib/chat.ts` 补齐故障切换执行器，再继续 `background.ts` 改造 |
