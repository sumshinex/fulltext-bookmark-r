# Findings

## 2026-04-10 设计文档初读
- 目标：把单一 GPT 配置升级为端点编排系统。
- 核心能力：端点池、Chat/Embedding 双绑定链、按顺序故障切换、默认模型 + 端点级覆盖、单端点/绑定链测试、单端点/聚合拉模。
- 关键约束：不考虑旧配置兼容；端点各自持有 Base URL + API Key；缺失 Key 的端点直接视为不可用；顺序列表支持拖动排序。

## 2026-04-10 错误文案收尾结论
- 真正影响用户感知的一部分并不只是设置页按钮文案，还包括缺配置/失败时的错误语义；在端点编排改造后，这些提示必须同步从“单 URL/单模型”语义切到“绑定链/端点池”语义。
- 当前前台与后台的 GPT 兜底提示已基本跟新架构对齐，剩余若继续深挖，重点会转向更细粒度的错误本地化而不是结构改造。

## 2026-04-11 WebDAV 备份与 Popup 放大实施规划要点
- WebDAV 与现有 `remoteStore` 语义不同：`background.ts` 现有远程能力只是页面元数据 POST，不应复用为备份链路。
- 现有数据管理仅提供 CSV 导入导出；`options/utils/csvUtils.ts` 会把 Dexie 导出拍平成 `URL/Title/Date/Bookmarked/Content`，适合人工迁移，不适合高保真备份。
- 本地状态入口集中在 `store/stat-slice.ts` 与 `options/hooks/useSettingsState.ts`；适合新增 `webdavConfig + webdavStatus` 以及设置页表单状态。
- 后台现有消息总线已承载 `export/import/clearAllData/gpt_*` 等命令，适合继续扩展 `webdav_test_connection`、`webdav_backup_export`、`webdav_backup_restore`。
- Popup 尺寸当前主要由 `popup/search.tsx` 与 `popup/GPTSearch.tsx` 的 `w-96 h-[32rem]` 决定，放大优先落在这两个容器与 `popup/popupIndex.tsx` 标签容器，不需要改成独立窗口。

## 2026-04-11 WebDAV 自动备份与历史版本恢复补充结论
- 自动备份采用 `chrome.alarms` 驱动，按配置计算 `nextBackupAt`；固定时间模式按次日同一时间重建，固定间隔模式按最近一次成功备份时间顺延。
- 备份写入同时维护两类文件：带时间戳的版本文件用于保留历史，固定文件名用于“最新版本恢复”兼容当前主流程。
- 历史版本列表可通过 WebDAV `PROPFIND` 读取目录条目，再按文件名模式筛出版本文件并做逆序展示。
- 指定版本恢复不需要改变数据库导入链路，只需把恢复入口从固定文件名改成可选文件名即可复用现有 Dexie import 流程。

