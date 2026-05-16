# AGENTS.md

本文件是 AI 接手项目时的文档导航协议。

本文件不作为项目介绍、需求文档、技术文档或工作记录使用。它只说明：

- 文档放在哪里。
- 每类文档负责什么。
- 每个目录的入口文件是什么。
- 信息应该写入哪里。
- 文档冲突时如何判断。
- 任务结束时如何更新交接信息。

AI 应根据当前任务目标主动判断需要阅读哪些文档，而不是机械读取所有文档。

---

## 1. 文档总入口

项目文档统一放在 `docs/` 目录下。

文档总入口：

```text
docs/README.md
```

AI 接手任务时，应先理解任务目标，再按需读取相关入口文档。

如果任务涉及需求、架构、API、测试、问题修复或交接状态，必须读取对应目录的入口文件或相关文档。

---

## 2. 目录职责与入口文件

| 目录 | 职责 | 入口文件 |
|---|---|---|
| `docs/` | 文档总入口，说明文档体系和阅读路径 | `docs/README.md` |
| `docs/prd/` | 需求真相源，记录要做什么、为什么、怎样算完成 | `docs/prd/PRD_REGISTRY.md` |
| `docs/project/` | 技术真相源，记录架构、API、数据模型、部署方式 | `docs/project/architecture.md` |
| `docs/rules/` | 硬约束，AI 和开发者必须遵守 | `docs/rules/README.md` |
| `docs/templates/` | 文档模板，保证格式一致 | `docs/templates/README.md` |
| `docs/memories/` | 长期稳定经验、项目风格、历史坑位 | `docs/memories/README.md` |
| `docs/issues/` | 缺陷、风险、错误、排查过程和修复结果 | `docs/issues/README.md` |
| `docs/work/` | 当前工作记录、阶段进展、任务交接 | `docs/work/handoff.md` |

---

## 3. 推荐目录结构

```text
docs/
  README.md

  prd/
    PRD_REGISTRY.md
    PRD-001.md

  project/
    architecture.md
    api.md
    data-model.md
    deployment.md

  rules/
    README.md
    coding-rules.md
    testing-rules.md
    api-rules.md
    documentation-rules.md

  templates/
    README.md
    prd-template.md
    issue-template.md
    work-log-template.md
    handoff-template.md
    test-plan-template.md
    decision-template.md

  memories/
    README.md
    project-style.md
    known-issues.md
    decisions.md

  issues/
    README.md
    issue-001.md

  work/
    work-log.md
    handoff.md
```

目录可以随项目演进扩展，但新增目录时应明确：

1. 它解决什么问题。
2. 它的入口文件是什么。
3. 它和现有目录的边界是什么。

---

## 4. 信息写入位置

| 信息类型 | 应写入 |
|---|---|
| 产品需求、用户故事、验收标准 | `docs/prd/` |
| PRD 列表、需求状态、优先级 | `docs/prd/PRD_REGISTRY.md` |
| 系统架构、模块关系、关键流程 | `docs/project/architecture.md` |
| API 路由、请求响应、错误码 | `docs/project/api.md` |
| 数据结构、数据库表、状态机 | `docs/project/data-model.md` |
| 部署、环境变量、运维说明 | `docs/project/deployment.md` |
| 编码强制规范 | `docs/rules/coding-rules.md` |
| 测试强制规范 | `docs/rules/testing-rules.md` |
| API 强制规范 | `docs/rules/api-rules.md` |
| 文档写作规范 | `docs/rules/documentation-rules.md` |
| 文档格式模板 | `docs/templates/` |
| 项目风格、稳定偏好 | `docs/memories/project-style.md` |
| 长期坑位、历史经验 | `docs/memories/known-issues.md` |
| 已确认的重要决策 | `docs/memories/decisions.md` |
| 缺陷、错误、排查记录 | `docs/issues/` |
| 当前工作过程 | `docs/work/work-log.md` |
| 当前任务交接 | `docs/work/handoff.md` |

---

## 5. 禁止混放规则

为避免文档长期失控，必须遵守以下规则：

1. PRD 不写技术实现细节。
   - PRD 只回答：做什么、为什么、怎样算完成。
2. 架构文档不代替 PRD。
   - 架构文档只回答：技术上如何组织和实现。
3. 工作记录不代替 PRD 或架构文档。
   - 工作记录只回答：实际做了什么、遇到什么、下一步是什么。
4. memories 不承载硬约束。
   - 强制规则必须写入 `docs/rules/`。
5. templates 不记录具体项目事实。
   - 模板只定义格式，不记录真实需求或真实问题。
6. issues 不记录泛泛的长期经验。
   - 长期经验应沉淀到 `docs/memories/known-issues.md`。
7. rules 不记录临时建议。
   - 只有稳定、明确、必须遵守的约束才能进入 `docs/rules/`。
8. 不要把代码文件放入 `docs/`。
   - 示例代码可以出现在 Markdown 文档中。
   - 可执行代码应放在项目源码、测试或示例目录中。

---

## 6. 文档更新原则

### 6.1 修改代码后

如果代码变更影响了需求、架构、API、数据模型、部署或测试方式，应同步更新对应文档。

### 6.2 修复问题后

如果修复了明确 bug，应更新：

1. 对应 issue 文档。
2. `docs/work/work-log.md`。
3. 如该问题具有复用价值，更新 `docs/memories/known-issues.md`。

### 6.3 完成阶段任务后

应更新：

1. `docs/work/work-log.md`
2. `docs/work/handoff.md`

### 6.4 做出重要决策后

应更新：

1. `docs/memories/decisions.md`
2. 如影响架构，同时更新 `docs/project/architecture.md`

### 6.5 新增 PRD 后

应更新：

1. 新建 `docs/prd/PRD-xxx.md`
2. 更新 `docs/prd/PRD_REGISTRY.md`

---

## 7. 文档状态标记

长期文档应尽量带状态，避免 AI 误读过期内容。

推荐状态：

```text
draft       草案
active      当前有效
deprecated  已废弃
archived    已归档
superseded  已被其他文档取代
```

PRD、issue、决策和工作交接文档应尽量标明状态。

---

## 8. 冲突处理规则

当不同文档之间出现冲突时，按以下优先级判断：

1. 当前用户明确指令
2. `docs/rules/` 中的硬规则
3. 当前有效 PRD
4. `docs/project/` 中的技术事实
5. `docs/work/handoff.md` 中的当前状态
6. `docs/issues/` 中的复现事实
7. `docs/memories/` 中的长期经验
8. 旧工作日志或历史记录

如果冲突无法判断，应先向用户说明冲突点，不要静默选择其中一个。

---

## 9. AI 工作结束前的交接要求

AI 在完成一次任务前，应检查是否需要更新交接信息。

如果任务涉及代码、需求、架构、问题修复或文档结构变化，应至少考虑更新：

```text
docs/work/work-log.md
docs/work/handoff.md
```

交接内容应包括：

- 本次任务目标
- 已完成内容
- 修改过的关键文件
- 验证方式和结果
- 未完成事项
- 风险或注意点
- 推荐下一步

---

## 10. 最小文档维护原则

文档系统的目标是帮助项目长期演进，而不是制造额外负担。

因此：

1. 能合并的文档不要拆太碎。
2. 临时信息不要写入长期记忆。
3. 未确认的信息不要写成事实。
4. 已过期的信息要标记或归档。
5. 重要上下文应写到稳定入口，而不是只留在聊天记录里。
6. 文档应服务 AI 接手和人类追溯，而不是追求形式完整。
