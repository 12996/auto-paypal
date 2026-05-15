# AGENTS.md

本文件是项目级 AI 协作入口文档。

任何 AI Agent、自动化编码助手或接手本项目的开发者，在开始理解、修改、规划或总结项目之前，都应先阅读本文件。

本文件不记录具体业务需求、技术实现细节或临时工作过程。它只定义本项目的文档管理体系、阅读顺序、信息归档位置和文档更新规则。

---

## 1. 文档系统目标

本项目采用面向大型 vibe coding 项目的分层文档管理体系，目标是：

1. 让 AI 每次接手项目时能快速恢复上下文。
2. 让人类可以追溯需求、架构、错误、决策和工作过程。
3. 避免把规则、模板、记忆、需求、技术方案、调试记录混在一起。
4. 保持当前状态清晰，减少过期文档对 AI 的误导。
5. 支持项目长期演进，而不是只服务单次任务。

---

## 2. 文档目录总览

项目文档统一放在 `docs/` 目录下。

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

---

## 3. 各目录职责与入口文件

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

## 4. AI 接手项目时的默认阅读顺序

AI 在开始工作前，应按以下顺序恢复上下文：

1. `AGENTS.md`
   - 了解项目文档系统规则。
2. `docs/README.md`
   - 了解文档总览和当前推荐阅读路径。
3. `docs/work/handoff.md`
   - 了解当前任务状态、最近进展、阻塞点和下一步。
4. `docs/prd/PRD_REGISTRY.md`
   - 了解需求列表、需求状态和相关 PRD。
5. `docs/project/architecture.md`
   - 了解项目整体技术结构。
6. `docs/rules/README.md`
   - 了解必须遵守的编码、测试、API、文档规则。
7. `docs/memories/README.md`
   - 按需读取长期经验、项目风格和历史坑位。

如果任务范围很小，可以按需精简阅读，但不能跳过与任务直接相关的规则、PRD 和交接信息。

---

## 5. 不同任务类型的阅读路径

### 5.1 新功能开发

优先阅读：

1. `docs/work/handoff.md`
2. `docs/prd/PRD_REGISTRY.md`
3. 对应的 `docs/prd/PRD-xxx.md`
4. `docs/project/architecture.md`
5. `docs/project/api.md`
6. `docs/project/data-model.md`
7. `docs/rules/coding-rules.md`
8. `docs/rules/testing-rules.md`

新功能开发不得只依据口头描述直接实现。如果没有 PRD，应先补充或确认需求文档。

### 5.2 Bug 修复或问题排查

优先阅读：

1. `docs/work/handoff.md`
2. `docs/issues/README.md`
3. 相关的 `docs/issues/issue-xxx.md`
4. `docs/memories/known-issues.md`
5. `docs/rules/testing-rules.md`
6. 与问题相关的 `docs/project/*`

修复完成后，应更新：

- 对应 issue 文档。
- `docs/work/work-log.md`。
- 如形成长期经验，再更新 `docs/memories/known-issues.md`。

### 5.3 架构调整

优先阅读：

1. `docs/project/architecture.md`
2. `docs/project/api.md`
3. `docs/project/data-model.md`
4. `docs/project/deployment.md`
5. 相关 PRD
6. `docs/memories/decisions.md`
7. `docs/rules/coding-rules.md`

架构调整完成后，应同步更新对应技术文档。不能只改代码，不改架构文档。

### 5.4 API 变更

优先阅读：

1. `docs/project/api.md`
2. `docs/rules/api-rules.md`
3. 相关 PRD
4. 相关测试规则

API 变更后必须更新：

- `docs/project/api.md`
- 相关 PRD 的验收标准
- 相关测试计划或测试说明

### 5.5 测试相关任务

优先阅读：

1. `docs/rules/testing-rules.md`
2. `docs/templates/test-plan-template.md`
3. 相关 PRD 的验收标准
4. `docs/memories/known-issues.md`

测试硬规则只能写入 `docs/rules/testing-rules.md`。
测试经验和历史坑位写入 `docs/memories/known-issues.md`。
测试计划格式写入 `docs/templates/test-plan-template.md`。

### 5.6 文档整理或交接

优先阅读：

1. `docs/README.md`
2. `docs/work/handoff.md`
3. `docs/work/work-log.md`
4. `docs/memories/README.md`
5. `docs/issues/README.md`

交接文档应说明：

- 当前任务目标
- 已完成事项
- 未完成事项
- 阻塞点
- 关键文件
- 下一步建议
- 需要避免的坑

---

## 6. 信息应该写到哪里

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

## 7. 禁止混放规则

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

## 8. 文档更新原则

### 8.1 修改代码后

如果代码变更影响了需求、架构、API、数据模型、部署或测试方式，必须同步更新对应文档。

### 8.2 修复问题后

如果修复了明确 bug，应更新：

1. 对应 issue 文档。
2. `docs/work/work-log.md`。
3. 如该问题具有复用价值，更新 `docs/memories/known-issues.md`。

### 8.3 完成阶段任务后

应更新：

1. `docs/work/work-log.md`
2. `docs/work/handoff.md`

### 8.4 做出重要决策后

应更新：

1. `docs/memories/decisions.md`
2. 如影响架构，同时更新 `docs/project/architecture.md`

### 8.5 新增 PRD 后

应更新：

1. 新建 `docs/prd/PRD-xxx.md`
2. 更新 `docs/prd/PRD_REGISTRY.md`

---

## 9. 文档状态标记

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

## 10. 冲突处理规则

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

## 11. AI 工作结束前的交接要求

AI 在完成一次任务前，应检查是否需要更新交接信息。

如果任务涉及代码、需求、架构、问题修复或文档结构变化，应至少更新：

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

## 12. 最小文档维护原则

文档系统的目标是帮助项目长期演进，而不是制造额外负担。

因此：

1. 能合并的文档不要拆太碎。
2. 临时信息不要写入长期记忆。
3. 未确认的信息不要写成事实。
4. 已过期的信息要标记或归档。
5. 重要上下文应写到稳定入口，而不是只留在聊天记录里。
6. 文档应服务 AI 接手和人类追溯，而不是追求形式完整。
