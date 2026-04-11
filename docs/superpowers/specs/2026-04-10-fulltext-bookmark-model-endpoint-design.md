# fulltext-bookmark-main 模型端点编排设计

- 日期：2026-04-10
- 主题：将 Ask GPT / Embedding 的单一 GPT 配置升级为端点编排系统
- 设计状态：已确认，待实现规划

## 1. 背景与目标

当前项目的 GPT 配置仅支持单一 `Base URL + API Key`，并分别配置一个常规模型和一个 Embedding 模型。这种结构无法表达以下需求：

- Chat / Embedding 分别绑定不同端点
- 一个能力绑定多个端点作为主备链
- 请求失败后自动切换备用端点
- 默认模型与端点级模型覆盖共存
- 单端点测试与绑定链测试并存
- 单端点拉取模型与绑定链聚合模型并存

本次设计目标是把现有 GPT 配置升级为一个产品级的端点编排系统，同时保持项目当前体量下的可实现性，不引入过度抽象。

## 2. 约束与明确决策

本设计基于以下已确认约束：

1. 采用产品级方案，而不是最小补丁式改造。
2. 不考虑旧配置兼容；可直接切换到新配置结构。
3. 端点是单节点粒度，每个端点独立持有 `Base URL + API Key`。
4. Chat / Embedding 可以分别绑定多个端点。
5. 绑定顺序表达主备优先级，运行时按顺序故障切换。
6. 默认采用全局模型名，必要时允许端点级模型覆盖。
7. 模型列表既支持单端点拉取，也支持按绑定链聚合拉取。
8. 所有涉及顺序的绑定列表都支持拖动排序。
9. API Key 不做回退策略；不同端点通常使用不同密钥。缺失 Key 的端点直接视为不可用。

## 3. 方案选择

### 3.1 备选方案

#### 方案 A：最小增强版
在现有 `GPTURL/GPTKey/GPTChatModel/GPTEmbeddingModel` 基础上扩展为多 URL、多模型。

**优点**
- 实现快
- 改动范围相对小

**缺点**
- 配置、路由、测试、模型获取耦合在一起
- 后续继续加功能会持续恶化结构
- 不适合产品级能力演进

#### 方案 B：资源编排版（推荐）
把系统拆成“端点资源 + 能力绑定 + 模型策略 + 诊断能力”四层。

**优点**
- 结构清晰
- 能自然支持多端点、主备切换、模型覆盖、聚合拉模
- 与当前项目规模匹配

**缺点**
- 改动中等偏大
- 设置页需要重组

#### 方案 C：统一路由器版
引入更重的统一请求路由器，把所有请求统一抽象为通用调度框架。

**优点**
- 扩展性最好
- 架构最整齐

**缺点**
- 对当前项目偏重
- 容易为了抽象而增加不必要复杂度

### 3.2 结论

采用 **方案 B：资源编排版**。

系统按以下职责分层：

- **端点**：描述真实可调用节点
- **绑定**：描述 Chat / Embedding 分别使用哪些端点以及优先级
- **模型策略**：描述全局默认模型与端点级覆盖
- **测试与模型获取**：作为诊断层，而不是混入基础配置

## 4. 信息架构设计

设置页建议拆为 4 个区域。

### 4.1 默认模型策略区

包含：
- 默认常规模型
- 默认 Embedding 模型
- Prompt Template

该区域只负责全局默认值，不直接承载端点细节。

### 4.2 端点管理区

每个端点是一个独立资源，字段包括：
- 名称
- Base URL
- API Key（掩码显示）
- 是否启用
- 支持能力：Chat / Embedding
- 端点级模型覆盖（可选）
- 备注

操作包括：
- 新增端点
- 编辑端点
- 测试端点
- 获取该端点模型
- 删除端点（删除时需额外确认）

### 4.3 绑定管理区

拆成两个列表：
- Chat 绑定列表
- Embedding 绑定列表

每个列表支持：
- 从端点池中添加端点
- 移除已绑定端点
- 拖动排序
- 显示优先级

绑定顺序具有运行语义：
- 第一个是主端点
- 后续按顺序作为备用端点
- 请求失败后依次切换

### 4.4 状态与诊断区

用于展示：
- 当前默认模型
- 当前 Chat / Embedding 绑定链
- 单端点测试结果
- 绑定链测试结果
- 模型获取结果与失败摘要

## 5. 运行时路由与故障切换设计

### 5.1 请求类型

所有模型请求按能力分成两类：
- `chat`
- `embedding`

### 5.2 候选端点解析

- `chat` 请求读取 `chat` 绑定链
- `embedding` 请求读取 `embedding` 绑定链
- 候选端点按绑定列表顺序排列

### 5.3 单端点最终请求参数解析

对于每个候选端点：

- `baseUrl`：端点自身的 `baseUrl`
- `apiKey`：端点自身的 `apiKey`
- `model`：优先端点级覆盖，否则使用全局默认模型

### 5.4 故障切换策略

默认采用 **顺序故障切换**：

1. 从绑定链第一个端点开始尝试
2. 成功则立即返回
3. 失败则记录失败原因并切换到下一个端点
4. 所有端点失败后返回聚合错误

### 5.5 配置错误与请求错误的边界

以下情况属于配置错误，不进入故障切换：
- 当前能力没有绑定任何端点
- 绑定端点不存在
- 端点被禁用
- 端点缺少 `baseUrl`
- 端点缺少 `apiKey`
- 解析不出最终模型
- capability 不匹配

以下情况属于请求错误，允许继续尝试下一个端点：
- 网络失败
- 超时
- 429 / 5xx
- 401 / 403 / 404
- 模型不存在
- 返回格式不兼容
- 其他远端错误

### 5.6 失败输出

当所有端点都失败时，错误输出需包含：
- 人类可读摘要
- 已尝试端点数量
- 每个端点的失败原因摘要

示例：

```text
Embedding 请求失败：已尝试 3 个端点
1. endpoint-a - 401 Unauthorized
2. endpoint-b - timeout
3. endpoint-c - model not found
```

## 6. 数据结构设计

建议直接切换到新状态模型：

```ts
type EndpointCapability = "chat" | "embedding"

interface EndpointModelOverrides {
  chat?: string
  embedding?: string
}

interface ApiEndpoint {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  enabled: boolean
  capabilities: EndpointCapability[]
  modelOverrides?: EndpointModelOverrides
  notes?: string
}

interface ModelDefaults {
  chat: string
  embedding: string
}

interface EndpointBindings {
  chat: string[]
  embedding: string[]
}

interface GPTSettingsState {
  endpoints: ApiEndpoint[]
  bindings: EndpointBindings
  defaultModels: ModelDefaults
  promptTemplate: string
  availableModelsByEndpoint: Record<string, string[]>
}
```

### 6.1 字段职责

- `endpoints`：保存所有端点资源
- `bindings`：保存 Chat / Embedding 两条绑定链
- `defaultModels`：保存全局默认模型
- `promptTemplate`：保存 Ask GPT 使用的提示模板
- `availableModelsByEndpoint`：缓存按端点拉取到的模型列表，供 UI 建议与聚合视图使用

### 6.2 非核心持久状态

以下内容不建议进入核心持久状态：
- 临时表单草稿
- 最近测试结果
- 最近失败链路
- 一次性 loading 状态

它们更适合保留在组件本地状态或临时状态层。

## 7. 测试与模型获取策略

### 7.1 单端点测试

每个端点支持：
- 测试连接
- 获取模型

目标：
- 验证单端点可用性
- 缓存该端点支持的模型列表

### 7.2 绑定链测试

系统支持：
- 测试 Chat 绑定
- 测试 Embedding 绑定

目标：
- 验证绑定顺序是否正确
- 验证主备切换是否生效
- 验证最终模型解析是否符合预期

### 7.3 模型获取模式

#### 单端点获取
- 仅请求当前端点
- 保存返回模型列表到 `availableModelsByEndpoint`

#### 绑定链聚合获取
- 依次请求当前绑定链中的端点
- 合并、去重模型列表
- 为每个模型保留来源端点信息
- 允许部分成功；失败端点信息单独展示

### 7.4 选择器行为

- 默认模型选择器优先展示绑定链聚合模型列表
- 如果没有可用模型列表，也允许手输
- 端点模型覆盖优先展示该端点自身模型列表，同时允许手输
- 清空端点模型覆盖即回退到全局默认模型

## 8. 代码落地映射

### 8.1 `store/stat-slice.ts`

把旧 GPT 配置字段替换为：
- `gptEndpoints`
- `gptBindings`
- `gptDefaultModels`
- `gptPromptTemplate`
- `gptAvailableModelsByEndpoint`

对应 action 建议按资源操作设计：
- `addGptEndpoint`
- `updateGptEndpoint`
- `removeGptEndpoint`
- `toggleGptEndpointEnabled`
- `setGptBindings`
- `setGptDefaultModels`
- `setGptPromptTemplate`
- `setAvailableModelsForEndpoint`

### 8.2 `lib/chat.ts`

从单例 API 封装改造成无全局状态的请求层，建议职责包括：
- Base URL 规范化
- Chat 请求执行
- Embedding 请求执行
- 单端点模型获取
- 绑定链故障切换执行
- 候选端点解析

### 8.3 `background.ts`

建议按能力拆分消息命令：
- `gpt_search`
- `gpt_test_endpoint`
- `gpt_test_binding`
- `gpt_fetch_endpoint_models`
- `gpt_fetch_binding_models`

### 8.4 `options/hooks/useSettingsState.ts`

从单字段表单状态改为配置页面控制器，负责：
- 端点资源操作
- 绑定操作
- 默认模型操作
- 测试和拉模型动作封装

### 8.5 `options/components/GPTSettings.tsx`

建议拆分为多个组件，例如：
- `GPTDefaultsSection`
- `GPTEndpointsSection`
- `GPTEndpointEditor`
- `GPTBindingsSection`
- `GPTDiagnosticsSection`

### 8.6 `popup/GPTSearch.tsx`

将旧校验逻辑从“单 URL / 单 Key 是否存在”改为：
- Chat 是否存在至少一个可用绑定端点
- Embedding 是否存在至少一个可用绑定端点
- 默认模型是否完整
- Prompt Template 是否可用

### 8.7 国际化文案

同步更新：
- `assets/_locales/zh_CN/messages.json`
- `assets/_locales/en/messages.json`

新增覆盖：
- 端点管理
- 绑定管理
- 拖动排序提示
- 绑定链测试
- 端点测试
- 单端点拉模
- 聚合拉模
- 失败链路提示

## 9. 安全与可用性要求

1. API Key 输入框使用密码模式显示。
2. UI、日志、错误消息中不输出完整 API Key。
3. 删除端点前需确认，且如果端点已被绑定，要提示影响范围。
4. 对配置错误尽早校验，避免无意义请求。
5. 错误提示必须尽量可定位，至少包含端点名、能力类型和错误摘要。

## 10. 非目标

以下内容不在本轮设计范围：
- 兼容旧配置并自动迁移
- 通用 Key 回退机制
- 健康检查调度器
- 熔断、冷却、失败统计持久化
- 负载均衡型轮转策略
- 按 provider 抽象额外中间层

这些能力可以在未来继续演进，但不应进入本轮实现范围。

## 11. 推荐实施顺序（供后续写计划使用）

1. 重建 `store/stat-slice.ts` 的 GPT 状态模型
2. 重建 `lib/chat.ts` 的请求执行与故障切换层
3. 重构 `background.ts` 的消息路由
4. 重构 `useSettingsState.ts` 为资源式控制器
5. 重做并拆分 `GPTSettings.tsx` 设置页
6. 更新 `popup/GPTSearch.tsx` 校验与错误提示
7. 补齐中英文 i18n 文案
8. 对设置页与绑定链测试做最小必要验证

## 12. 设计结论

本设计采用“端点资源 + 能力绑定 + 模型策略 + 诊断层”的资源编排方案，在不过度抽象的前提下，为 `fulltext-bookmark-main` 提供产品级的模型端点配置能力。

该设计能够满足：
- Chat / Embedding 分离配置
- 多端点主备绑定
- 顺序故障切换
- 默认模型与端点模型覆盖
- 单端点与绑定链两层测试
- 单端点与绑定链两层模型获取
- 拖动排序的优先级管理

这是当前项目规模下最合理、可控且可持续扩展的落地方案。
