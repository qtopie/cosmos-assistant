这份技术方案文档旨在为 **TARS** 项目提供一套基于“树形技能架构”、“隔离 WebView 渲染”以及“反馈进化机制”的深度集成方案。

---

# TARS 项目技术方案：基于技能树与自进化 UI 的智能 Agent 平台

## 1. 核心架构概述 (Core Architecture)

TARS 的核心设计理念是将大模型的推理能力（IQ）与确定性的工程化技能（Skill）解耦。系统通过 **MCP (Model Context Protocol)** 实现底层能力的标准化，通过 **WebView 沙箱** 实现 UI 插件化，并利用 **树形结构** 组织成千上万的技能。

### 1.1 架构分层

* **模型层 (Brain)**：集成 Gemini 1.5 Pro / GPT-4o 等顶级模型，负责意图理解与技能调度。
* **技能路由层 (Tree Router)**：基于向量检索与树形路径的技能定位系统。
* **执行与渲染层 (Execution & View)**：MCP Server 执行逻辑，WebView 渲染交互界面。
* **经验进化层 (Evolution)**：将用户反馈持久化为 Skill 的执行策略。

---

## 2. 树形技能管理系统 (Hierarchical Skill Tree)

为了应对成千上万的技能，TARS 采用命名空间隔离的树形结构：`Domain.Category.Skill`。

### 2.1 技能定义规范 (Manifest)

每个技能节点包含元数据、逻辑定义与 UI 指引：

```json
{
  "skill_id": "DevOps.K8s.PodManager",
  "description": "管理 K8s 集群中的 Pod，支持重启、日志查看及资源扩缩。",
  "mcp_tools": ["k8s_get_pods", "k8s_restart_pod"],
  "ui_plugin": "tars-k8s-dashboard-v1",
  "knowledge_base": "vector_index_path",
  "experience": {
    "preferences": [], // 存储用户反馈的执行偏好
    "usage_count": 128
  }
}

```

### 2.2 动态检索与路由

* **初筛**：通过 Semantic RAG 从向量库中检索 top-K 候选技能。
* **剪枝**：根据当前会话上下文（如：当前在分析代码）自动过滤不相关的树分支。
* **预热**：在 LLM 确定技能前，根据概率提前加载 WebView 资源。

---

## 3. WebView 隔离与插件化渲染 (Plugin Sandbox)

TARS 参考 VS Code WebView 机制，解决复杂 JS 逻辑的渲染与安全问题。

### 3.1 隔离沙箱设计

* **容器**：使用 `<iframe>` 并配置严格的 `sandbox` 属性（禁止同源访问，允许脚本执行）。
* **样式隔离**：内部采用 Shadow DOM，防止插件 CSS 污染 TARS 主界面。

### 3.2 消息总线 (TarsBridge)

双向异步消息传递机制：

* **Host -> Plugin**: 传递 MCP 调用结果数据。
* **Plugin -> Host**: 触发新的 MCP 调用请求、上报用户交互反馈。

---

## 4. 进化机制：关联反馈的 Copilot 模式 (Feedback Evolution)

这是 TARS 区别于通用工具的核心：**教一遍，记一生。**

### 4.1 反馈捕获逻辑

在 WebView 插件中集成显式与隐式反馈点：

* **参数微调**：用户修改了卡片中的建议值  记录为该 Skill 的默认偏好。
* **逻辑纠正**：用户点击“不应执行此步骤”  在 Skill 的前置 Prompt 中增加负向约束。

### 4.2 技能固化流程 (Skill Hardening)

1. **收集记录**：将 `Context + Action + Correction` 存入技能节点的 Experience 库。
2. **Prompt 注入**：下次激活该 Skill 时，将最优反馈作为“少样本学习 (Few-shot)”注入底层模型。
3. **自主进化**：当某一分支的负面反馈过多时，TARS 自动触发“技能重构”，建议用户更新 MCP 工具或更换 UI 插件。

### 4.3 Copilot 模式与放权机制 (Human-in-the-Loop)

为了兼顾复杂/敏感任务的人机协同与繁杂/简单任务的自动化执行，UI 需要显式提供“协同优先”的交互框架：

* **双模式入口**：`协同模式` / `自动化模式`，默认协同模式。
* **风险等级标签**：对每个任务展示 `低/中/高` 风险级别，并决定默认交互路径。
* **授权滑杆**：从“仅建议”到“自动执行”，支持按任务或技能粒度设置。
* **强制确认点**：高风险动作必须经过用户确认与审阅。
* **可回滚机制**：关键步骤支持“一键撤销”。

### 4.4 技能驱动 UI 与生成式渲染 (Composable & Generative UI)

为确保 UI 模块可扩展且与技能体系深度绑定，建议采用“技能驱动 UI + 受限生成式 UI”的组合方案：

* **UI Registry**：`skill_id -> ui_plugin` 映射，支持版本化与缓存。
* **UI Manifest**：每个技能提供 `layout / components / actions / data_bindings / permissions` 描述。
* **Host 渲染器**：仅渲染白名单组件，统一处理主题、权限与审计。
* **WebView 插件**：复杂交互通过沙箱插件完成，隔离样式与脚本。
* **生成式 UI (LLM)**：模型仅输出受限 UI DSL，宿主校验后渲染，避免直接执行任意前端代码。
* **协同审阅流**：生成 UI 需提供预览与确认，自动化模式仅适用于低风险场景。

---

## 5. 技术栈建议 (Technology Stack)

* **前端框架**：React + Tailwind CSS (用于主程序)
* **模型驱动**：Vercel AI SDK (支持 Gemini/GPT 多模型切换)
* **底层通讯**：MCP (Model Context Protocol) + JSON-RPC
* **本地代理**：sing-box (通过 CGO 或命令行集成)
* **向量库**：LanceDB (轻量、本地化，适合技能检索)

---

### 下一步行动建议

1. **定义 Skill Schema**：确立树形结构的 JSON 规范。
2. **原型构建**：实现一个简单的“查天气”Skill，要求包含 MCP 获取数据、WebView 展示卡片、以及记忆用户“偏好摄氏度”的反馈逻辑。

**需要我为你编写第一个测试 Skill 的完整代码 Demo 吗？**