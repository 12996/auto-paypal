# product_activator.js 功能拆解

## 导航

- **当前对象**：product_activator.js（任务调度核心）
- **当前文档类型**：功能拆解文档
- **上级文档**：[00-project-map.md](./00-project-map.md)
- **进入原因**：这是整个业务流程的"总指挥"，理解它才能建立全局视角
- **下一步阅读目标**：
  1. `startProductCreation()` — 成品生产主流程
  2. `analyzeProcessOutput()` — 错误分类引擎
  3. `runActivationChild()` — 子进程管理器

---

## 文件概览

| 属性 | 值 |
|------|-----|
| 路径 | `product_activator.js` |
| 行数 | 1181 行 |
| 职责 | 成品生产的调度中心：fork 子进程、错误分类、资产锁定/释放、重试策略 |
| 导出 | `{ startProductCreation }` |

---

## 并列子功能

### 1. 配置常量 (L9-16)

**做什么**：定义全局重试策略参数。

```javascript
const CONFIG = {
    MAX_ACCOUNT_RETRIES: 15,        // 最多尝试 15 个不同账号
    MAX_ACT_RETRIES_PER_ACCOUNT: 10, // 每个账号最多激活重试 10 次
    MAX_PROTOCOL_RETRIES: 2,         // 协议提取最多重试 2 次
    MAX_TOPUP_FAILURES_BEFORE_STOP: 10, // 累计失败 10 次后终止整批
    RETRY_DELAY_MS: 5000,            // 重试间隔 5 秒
    CHILD_IDLE_TIMEOUT_MS: 60 * 1000 // 子进程 60 秒无输出则超时
};
```

**为什么重要**：这些参数决定了系统的容错能力和资源消耗上限。

---

### 2. 进度标记表 (L25-109)

**做什么**：定义三个阶段的日志关键词 → 进度百分比映射。

| 常量 | 阶段 | 进度范围 |
|------|------|----------|
| `REGISTRATION_PROGRESS_MARKERS` | 注册 | 3% - 20% |
| `ACTIVATION_PROGRESS_MARKERS` | 激活/支付 | 24% - 85% |
| `PROTOCOL_PROGRESS_MARKERS` | 协议提取 | 86% - 100% |

**工作原理**：
```javascript
// 示例：当子进程输出包含 "代理连接成功" 时，进度更新为 28%
['代理连接成功! 代理公网 IP', 28, '代理连通成功，准备创建订单...']
```

**为什么重要**：这是前端进度条的数据来源，也是运维排查问题的关键线索。

---

### 3. 错误分类引擎 `analyzeProcessOutput()` (L199-449)

**做什么**：分析子进程的全部输出，返回结构化的错误分类结果。

**输入**：`(output: string, timedOut: boolean)`

**输出**：
```typescript
{
    status: 'success' | 'failed' | 'retry' | 'maintenance',
    message: string,           // 人类可读的错误描述
    reachedPaypal: boolean,    // 是否已进入 PayPal 流程
    shouldRetry: boolean,      // 是否应该重试
    deletePhone: boolean,      // 是否应该禁用当前手机号
    deleteCard: boolean        // 是否应该禁用当前银行卡
}
```

**错误分类规则**（按优先级）：

| 关键词 | 分类 | 处理策略 |
|--------|------|----------|
| `PAYMENT_SUCCESS` | success | 进入协议提取 |
| `无法获取 PayPal 审批链接` | failed | 换账号，不重试 |
| `代理认证失败` / `账号余额` | failed | 系统维护，终止 |
| `代理或网络持续超时` | retry | 换代理 + 换账号 |
| `OpenAI 鉴权服务异常` | retry | 换代理 IP |
| `邮箱已被注册` | retry | 换邮箱 |
| `手机号被拒绝` | retry | **永久禁用手机号** |
| `短信验证码超时` | retry | **永久禁用手机号** |
| `银行卡被拒绝` | retry | 禁用银行卡（仅当已到 PayPal） |
| `stripe_redirect_failed` | retry | 换号重试 |
| `PayPal 未渲染创建账户表单` | retry | 同号重试 |

**为什么重要**：这是整个系统的"大脑"，决定了失败后是重试、换号、还是终止。

---

### 4. 子进程管理器 `runActivationChild()` (L484-680)

**做什么**：封装 `child_process.fork()`，提供统一的子进程生命周期管理。

**核心能力**：

1. **stdout/stderr 捕获**：实时收集子进程输出，推送到 `runtimeLog`
2. **IPC 消息处理**：接收子进程的 `{ type: 'result' }` 或 `{ type: 'error' }`
3. **空闲超时**：60 秒无输出自动 SIGKILL
4. **优雅退出**：子进程报告成功后等 3 秒再强杀（防止僵尸）

**调用链**：
```
startProductCreation()
  → runRegistrationProcess()  → runActivationChild('register_openai.js')
  → runActivationChild('index.js')
  → runProtocolProcess()      → runActivationChild('oauth_login.js')
```

**为什么重要**：所有子进程都通过它启动，理解它才能理解日志是怎么收集的、超时是怎么触发的。

---

### 5. 注册流程包装 `runRegistrationProcess()` (L682-789)

**做什么**：准备邮箱配置 → fork `register_openai.js` → 返回 `{ email, accessToken }`

**邮箱来源策略**：
```
emailSource = 'random' | 'pool' | 'inbox'
```

| 来源 | 说明 |
|------|------|
| `random` | 随机生成 `xxx@chiyiyi.cloud` |
| `pool` | 从 Outlook IMAP 邮箱池预留一个 |
| `inbox` | 调用 Cloudflare 临时邮箱 API |

**关键逻辑**：
- L700: 如果是 `pool` 模式，先 `store.reservePoolEmail()` 锁定一个邮箱
- L754: fork 子进程，传入邮箱配置环境变量
- L784-786: 失败时释放邮箱预留

---

### 6. 协议提取包装 `runProtocolProcess()` (L791-854)

**做什么**：fork `oauth_login.js`，最多重试 2 次，返回 `{ fileName, filePath }`

**特殊处理**：
- L840-841: 如果遇到 `当前账号触发手机号验证`，直接抛错要求重新注册

---

### 7. 成品生产主流程 `startProductCreation()` (L856-1173)

**做什么**：编排整个"注册→激活→协议"三段式流程。

**状态机**：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    while (accountAttempt < 15)                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Stage 1: runRegistrationProcess()                                │  │
│  │  → 成功: 拿到 { email, accessToken }                              │  │
│  │  → 失败: accountAttempt++, 换账号重试                             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              ↓                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  while (activationAttempt < 10)                                   │  │
│  │    ┌─────────────────────────────────────────────────────────┐    │  │
│  │    │  reserveRuntimeAssets() — 锁定手机号 + 银行卡           │    │  │
│  │    │  ↓                                                       │    │  │
│  │    │  Stage 2: runActivationChild('index.js')                │    │  │
│  │    │  ↓                                                       │    │  │
│  │    │  releaseRuntimeAssets() — 释放资产                       │    │  │
│  │    │  ↓                                                       │    │  │
│  │    │  analyzeProcessOutput() — 错误分类                       │    │  │
│  │    │  ↓                                                       │    │  │
│  │    │  成功? → Stage 3                                         │    │  │
│  │    │  shouldRetry? → activationAttempt++, 同账号重试          │    │  │
│  │    │  无权限? → break, 换账号                                 │    │  │
│  │    │  致命? → throw, 终止整批                                 │    │  │
│  │    └─────────────────────────────────────────────────────────┘    │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                              ↓                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  Stage 3: runProtocolProcess(email)                               │  │
│  │  → 成功: store.markProductReadyByEmail(), return                  │  │
│  │  → 失败: 支付已占位入库，抛错终止（不再换号避免重复扣费）          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

**关键决策点**：

| 行号 | 决策 | 说明 |
|------|------|------|
| L893-912 | 资产排队 | 最多等 5 分钟抢手机号/银行卡 |
| L982-988 | 支付成功占位 | `PAYMENT_SUCCESS` 后立即写 DB（status='待协议'） |
| L1096-1109 | 禁用坏资产 | `deletePhone=true` 时调用 `store.deletePhoneAsset()` |
| L1140-1148 | 支付成功但协议失败 | 终止任务，不再换号（避免重复扣费） |

---

### 8. IMAP Key 生成 `generateImapKey()` (L115-160)

**做什么**：调用 `https://imap.chiyiyi.cloud/api/admin/emails` 为成品邮箱生成访问 Key。

**为什么需要**：成品交付后，用户需要用这个 Key 通过 IMAP 协议收取该邮箱的邮件。

---

## 子功能之间的衔接

```
startProductCreation(cdk, progressCallback)
        │
        ├──→ runRegistrationProcess(onProgress)
        │           │
        │           └──→ runActivationChild('register_openai.js')
        │                       │
        │                       └──→ analyzeProcessOutput() [失败时]
        │
        ├──→ store.reserveRuntimeAssets() [锁定手机号/银行卡]
        │
        ├──→ runActivationChild('index.js')
        │           │
        │           └──→ analyzeProcessOutput() [分类错误]
        │
        ├──→ store.releaseRuntimeAssets() [释放资产]
        │
        ├──→ store.upsertPendingProduct() [支付成功占位]
        │
        ├──→ runProtocolProcess(email)
        │           │
        │           └──→ runActivationChild('oauth_login.js')
        │
        ├──→ generateImapKey(email)
        │
        └──→ store.markProductReadyByEmail() [最终入库]
```

---

## 建议继续阅读

1. **`analyzeProcessOutput()`** — 深入理解错误分类规则，这是调优重试策略的关键
2. **`runActivationChild()`** — 理解子进程生命周期管理、超时机制、日志收集
3. **`index.js`** — 理解 Stage 2 支付流程的具体实现（最复杂的部分）

---

## 未确认点

| 项目 | 置信度 | 说明 |
|------|--------|------|
| `runFullProtocolFlow` 导入但未使用 | 90% | L1 导入了但代码中没有调用，可能是历史遗留 |
| `runActivationProcess()` 函数 | 80% | L463-481 定义了但似乎没有被调用，可能是废弃代码 |
