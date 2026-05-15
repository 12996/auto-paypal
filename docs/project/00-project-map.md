# plus-papay 项目地图

## 项目简介

**plus-papay** 是一个 ChatGPT Plus 自动化开通工具（PayPal 通道），使用 Node.js + Playwright 实现全流程自动化：

```
注册 OpenAI 账号 → 创建 0 元 Stripe Checkout 订单 → PayPal 支付占位 → 提取 OAuth 协议 Token → 入库出货
```

核心价值：把手动操作变成可批量、可重试、可观测的生产系统。

## 技术栈

| 类别 | 技术 |
|------|------|
| 运行时 | Node.js ≥ 20 |
| 浏览器自动化 | Playwright 1.59 + playwright-extra + puppeteer-extra-plugin-stealth |
| 数据库 | MySQL 8.0+ (mysql2) |
| Web 框架 | Express 4.x |
| 邮箱协议 | IMAP (imapflow) + OAuth2 |
| 进程模型 | 父进程调度 + fork 子进程执行 |

## 功能分组

### 1. Web 服务层 (server.js)
**做什么**：Express 入口，提供所有 REST API、静态文件服务、WebSocket 实时日志推送。  
**为什么值得作为入口**：这是整个系统的 HTTP 入口，所有后台管理、CDK 兑换、任务触发都从这里进入。

**入口证据**：
- `package.json:7` — `"main": "server.js"`
- `package.json:9` — `"start": "node server.js"`

### 2. 任务调度核心 (product_activator.js)
**做什么**：成品生产的调度中心，负责 fork 子进程、错误分类、资产锁定/释放、重试策略。  
**为什么值得作为入口**：理解整个"注册→激活→协议"三段式流程的编排逻辑，是理解业务核心的关键。

**入口证据**：
- `product_activator.js:856` — `startProductCreation()` 是成品生产的主入口
- `server.js` 中通过 `require('./product_activator')` 调用

### 3. OpenAI 注册流程 (register_openai.js)
**做什么**：Playwright 子进程，自动完成 OpenAI 账号注册，返回 email + accessToken。  
**为什么值得作为入口**：这是三段式流程的第一段，理解它才能理解后续激活流程的输入。

**入口证据**：
- `product_activator.js:754` — `fork('register_openai.js')`

### 4. Stripe + PayPal 支付流程 (index.js)
**做什么**：Playwright 子进程，用 accessToken 创建 0 元订单，走 Stripe Hosted Checkout，跳转 PayPal 完成支付占位。  
**为什么值得作为入口**：这是三段式流程的第二段，也是最复杂的部分（反指纹、风控对抗、表单填充）。

**入口证据**：
- `product_activator.js:939-953` — `fork('index.js')` 并传入 CHATGPT_TOKEN 等环境变量
- `index.js:1863` — `run()` 是主函数

### 5. OAuth 协议提取 (oauth_login.js)
**做什么**：支付成功后，用注册邮箱重新登录 OpenAI，提取 refresh_token，写入成品库。  
**为什么值得作为入口**：这是三段式流程的第三段，产出最终交付物。

**入口证据**：
- `product_activator.js:822` — `fork('oauth_login.js', [email])`
- `product_activator.js:1` — `const { runFullProtocolFlow } = require('./oauth_login')`

### 6. 数据持久层 (mysql-store.js)
**做什么**：封装所有 MySQL CRUD：资产池管理、配置读写、成品入库、CDK 绑定。  
**为什么值得作为入口**：理解数据模型和状态流转的关键。

**入口证据**：
- `product_activator.js:5` — `const store = require('./mysql-store')`
- `server.js` 中大量调用 `store.*` 方法

### 7. 邮箱服务层
**做什么**：支持三种邮箱来源——随机域名、Outlook IMAP 池、Cloudflare 临时邮箱 API。  
**为什么值得作为入口**：注册和 OAuth 阶段都需要收验证码，邮箱是关键依赖。

| 文件 | 职责 |
|------|------|
| `inbox-email.js` | Cloudflare temp_email API 适配 |
| `pool-email-imap.js` | Outlook IMAP / XOAUTH2 邮箱池 |
| `imap-auth.js` | 自有 IMAP 服务的鉴权 token 缓存 |

### 8. OpenAI API 客户端 (chatgpt.js)
**做什么**：封装 OpenAI checkout/order API，创建订单并返回 Stripe 支付链接。  
**为什么值得作为入口**：理解"0 元订单"是如何创建的。

**入口证据**：
- `index.js:3` — `const ChatGPTService = require('./chatgpt')`
- `index.js:522` — `new ChatGPTService(context.request, CONFIG.chatgptToken, CONFIG.stripeKey)`

### 9. 前端管理界面 (public/)
**做什么**：后台 SPA（任务管理、CDK、资产池、配置、日志）+ 用户侧 CDK 兑换页。  
**为什么值得作为入口**：理解用户如何与系统交互。

| 文件 | 职责 |
|------|------|
| `public/admin.html` | 后台单页面 SPA |
| `public/admin-login.html` | 后台登录页 |
| `public/index.html` | 用户侧 CDK 兑换页 |

## 推荐阅读顺序

```
1. product_activator.js  ← 先理解整体编排逻辑
   ↓
2. register_openai.js    ← 第一段：注册
   ↓
3. index.js              ← 第二段：支付（最复杂）
   ↓
4. oauth_login.js        ← 第三段：协议提取
   ↓
5. mysql-store.js        ← 数据模型
   ↓
6. server.js             ← API 层（按需）
```

**推荐从 `product_activator.js` 开始**，因为它是整个业务流程的"总指挥"，能让你快速建立全局视角。

## 关键数据流

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        startProductCreation(cdk)                        │
│                         product_activator.js:856                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Stage 1: runRegistrationProcess()                                      │
│  fork → register_openai.js                                              │
│  输出: { email, accessToken, emailSource, inboxJwt }                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Stage 2: runActivationChild('index.js')                                │
│  输入: CHATGPT_TOKEN, CARD_*, BILLING_PHONE, PROXY                      │
│  输出: PAYMENT_SUCCESS 或错误分类                                        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Stage 3: runProtocolProcess(email)                                     │
│  fork → oauth_login.js                                                  │
│  输出: { fileName, filePath, refresh_token }                            │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  入库: store.markProductReadyByEmail(email, filePath, imapKey)          │
│  mysql-store.js                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## 未确认点

| 项目 | 置信度 | 说明 |
|------|--------|------|
| `run_oauth.js` vs `oauth_login.js` | 70% | 两个文件名相似，需确认是否有调用关系或是历史遗留 |
| `run_register_debug.js` | 60% | 可能是调试用脚本，需确认是否在生产流程中使用 |
| `reset-db.js` / `update-mysql-schema.js` | 80% | 应该是数据库迁移/重置工具，非核心流程 |

## 建议继续阅读

1. **product_activator.js** — 理解三段式流程编排、错误分类、重试策略
2. **index.js** — 理解 Stripe + PayPal 支付流程、反指纹方案
3. **mysql-store.js** — 理解数据模型和资产池状态机
