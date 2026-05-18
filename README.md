# auto-paypal / plus-papay

ChatGPT Plus 自动化开通工具（PayPal 通道）。主流程是：

```text
注册 OpenAI 账号
  -> 创建 Stripe Checkout 订单
  -> PayPal 授权/支付流程
  -> OAuth 登录提取 refresh_token
  -> 写入 MySQL 成品库
```

项目入口是 `server.js`，后台页面在 `public/admin.html`，核心调度在 `product_activator.js`。

当前仓库地址：

```text
git@github.com:12996/auto-paypal.git
```

如果使用 HTTPS：

```text
https://github.com/12996/auto-paypal.git
```

---

## 环境要求

| 组件 | 要求 |
|---|---|
| Node.js | >= 20 |
| MySQL | 8.0+ |
| Playwright Chromium | 安装依赖后执行 `npx playwright install chromium` |

Linux 服务器如果缺少浏览器系统依赖，可以执行：

```bash
npx playwright install --with-deps chromium
```

Windows / macOS 一般执行：

```bash
npx playwright install chromium
```

---

## 安装

```bash
git clone git@github.com:12996/auto-paypal.git
cd auto-paypal
npm install
npx playwright install chromium
```

如果没有 SSH 权限，用 HTTPS 地址替换 `git clone` 的仓库地址。

---

## 数据库初始化

先创建数据库：

```bash
mysql -uroot -p -e "CREATE DATABASE plus_papay CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

项目启动时会读取 `mysql-schema.sql` 并自动补齐表结构和默认配置。

---

## `.env` 配置

复制模板：

```bash
cp .env.example .env
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

最小必填配置：

```env
PORT=3000
ADMIN_PASSWORD=请改成后台登录密码

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的MySQL密码
DB_NAME=plus_papay
```

说明：

- `DB_NAME` 必须和你创建的数据库一致；代码默认值是 `gpt`，所以建议在 `.env` 里显式设置 `plus_papay`。
- `ADMIN_PASSWORD` 只用于首次初始化后台密码；如果数据库里已经有 `admin_password_hash`，后续以后台配置/数据库为准。
- 手机号、银行卡、代理、邮箱池建议在后台「资产池 / 系统配置」里维护，不建议长期写死在 `.env`。

### 常用环境变量

| 变量 | 用途 | 建议 |
|---|---|---|
| `PORT` | HTTP 服务端口 | 默认 `3000` |
| `JSON_BODY_LIMIT` | Express JSON body 限制 | 默认 `15mb` |
| `ADMIN_TOKEN_SECRET` | 后台 JWT secret | 可留空，代码会按 cwd 派生 |
| `ADMIN_PASSWORD` | 首次初始化后台密码 | 首次启动前设置 |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | MySQL 连接 | `DB_NAME` 建议显式设置 |
| `DB_POOL_LIMIT` | MySQL 连接池大小 | 默认 `60` |
| `HEADFUL` | 有头浏览器调试 | `1` 开启 |
| `CHROMIUM_CHANNEL` | 使用本机浏览器 channel | 可选 `chrome` / `msedge` |
| `CHATGPT_TOKEN` / `STRIPE_KEY` | 调试或单独跑支付流程时使用 | 正常生产流程多由注册阶段动态传入 |
| `PROXY` | 子进程浏览器流程代理 | 生产建议通过后台代理配置维护 |
| `SMS_API_KEY` | 接码平台 key | 生产建议随手机号资产维护 |
| `EMAIL_SOURCE` | 直接运行子进程时指定邮箱模式 | 服务端生产流程优先用后台配置 |
| `INBOX_API_BASE` | 临时邮箱 API base URL | 使用 `EMAIL_SOURCE=inbox` 时需要 |
| `INBOX_EMAIL_DOMAINS` | 临时邮箱可用域名列表 | 可逗号/换行分隔 |
| `RANDOM_EMAIL_DOMAIN` | 随机邮箱域名 | 默认逻辑会使用 `chiyiyi.cloud` |
| `IMAP_ADMIN_PASSWORD` | 远程 IMAP 管理 API 密码 | 使用 `random` 模式时需要 |

### 邮箱模式

项目里有三类邮箱来源：

| 模式 | 说明 | 主要配置位置 |
|---|---|---|
| `random` | 随机域名邮箱，验证码通过远程 IMAP 管理 API 查询 | 后台系统配置 / `RANDOM_EMAIL_DOMAIN` / `IMAP_ADMIN_PASSWORD` |
| `pool` | 邮箱池，直接用 IMAP 连接真实邮箱 | 后台邮箱池 / `pool_email_imap_host` |
| `inbox` | 临时邮箱 API | 后台系统配置 / `INBOX_API_BASE` |

Gmail 也可以作为 `pool` 邮箱使用，但需要：

```text
IMAP Host: imap.gmail.com
端口: 993
加密: SSL/TLS
密码: Google 应用专用密码，不是 Gmail 登录密码
```

当前代码里的 Gmail/普通 IMAP 推荐走「邮箱 + 应用专用密码」。微软 Outlook 邮箱池支持密码或 OAuth2；Google OAuth2 目前没有单独实现。

直接调试 `register_openai.js` 时，也可以通过环境变量传入单个邮箱池账号：

```env
EMAIL_SOURCE=pool
POOL_EMAIL=your@gmail.com
POOL_EMAIL_PASSWORD=Google应用专用密码
POOL_EMAIL_IMAP_HOST=imap.gmail.com
POOL_EMAIL_INCLUDE_JUNK=1
```

生产后台批量任务会从数据库邮箱池读取这些字段，不依赖 `.env` 中的 `POOL_EMAIL`。

### 远程 IMAP 管理 API

`imap-auth.js` 和部分随机邮箱逻辑会调用：

```text
https://imap.chiyiyi.cloud
```

如果使用该模式，需要配置：

```env
IMAP_ADMIN_PASSWORD=你的远程IMAP管理密码
```

如果使用 `EMAIL_SOURCE=pool` 的邮箱池模式，生产流程会跳过远程 IMAP Key 生成。

---

## 支付链接生成代理

`chatgpt.js` 创建支付链接时会请求：

```text
https://chatgpt.com/backend-api/payments/checkout
```

当前代码这一步不读取 `.env` 的 `PROXY`，而是使用 `chatgpt.js` 里的常量：

```js
const DEFAULT_PROXY_URL = 'http://127.0.0.1:7891';
```

因此：

- `.env` / 后台代理主要控制 Playwright 浏览器流程。
- 支付链接生成请求如果要换代理，需要修改 `chatgpt.js` 的 `DEFAULT_PROXY_URL`，或后续改造成环境变量。
- 修改后需要重新启动服务；已经 fork 出去的子进程不会热更新。

单独测试支付链接生成：

```powershell
node .\test\test_generate_payurl.js "<CHATGPT_TOKEN>" --show-url
```

---

## 启动

推荐方式：

```bash
npm start
```

等价于：

```bash
node server.js
```

有头调试：

```bash
npm run start:headful
```

Windows PowerShell 也可以临时覆盖环境变量：

```powershell
$env:HEADFUL='1'
npm start
```

启动成功后会看到类似输出：

```text
数据库表检查完成
http://localhost:3000
MySQL => root@127.0.0.1:3306/plus_papay
```

后台地址：

```text
http://localhost:3000/admin
```

首次登录密码使用 `.env` 里的 `ADMIN_PASSWORD`。

---

## 第一次跑任务

建议按这个顺序配置：

1. 启动服务并登录后台。
2. 后台「系统配置」：
   - 配置代理列表。
   - 选择邮箱来源：`random` / `pool` / `inbox`。
   - 设置并发数，首次建议 `1`。
3. 后台「资产池」：
   - 导入手机号和对应 `sms_api_key`。
   - 导入银行卡/卡密和账单信息。
   - 如果使用邮箱池，导入邮箱、密码或 OAuth2 信息。
4. 后台「任务管理」：
   - 先跑 `count=1`、`workerCount=1`。
   - 观察「运行日志」确认卡点。

---

## 主要文件

| 文件 | 说明 |
|---|---|
| `server.js` | Express 入口、REST API、WebSocket 日志推送 |
| `product_activator.js` | 任务调度、资产锁定/释放、错误分类、子进程编排 |
| `register_openai.js` | OpenAI 注册流程 |
| `index.js` | Stripe Checkout + PayPal 流程 |
| `oauth_login.js` | 支付后二次登录并提取 OAuth token |
| `chatgpt.js` | ChatGPT checkout/order API 客户端 |
| `mysql-store.js` | MySQL 表结构初始化、CRUD、资产池状态机 |
| `pool-email-imap.js` | IMAP 邮箱池客户端，支持 Outlook/Gmail 等标准 IMAP |
| `imap-auth.js` | 远程 IMAP 管理 API 的 token 缓存 |
| `imap-auth-microsoft.js` | Microsoft IMAP / 第三方 IMAP 管理 API 初始化 |
| `inbox-email.js` | 临时邮箱 API 适配 |
| `public/admin.html` | 后台管理 SPA |
| `public/index.html` | 用户侧 CDK 兑换页 |
| `mysql-schema.sql` | MySQL 表结构 |
| `.env.example` | 环境变量模板 |

---

## 常用命令

```bash
npm install
npm start
npm run start:headful
npx playwright install chromium
```

调试脚本：

```bash
npm run paypal:debug
npm run paypal:test-form
npm run paypal:debug-dom
npm run paypal:test-selectors
npm run paypal:full-debug
```

---

## API 文档

项目内有两份接口文档：

- `API_DOC.md`
- `API_DOCUMENTATION.md`

后台接口通常需要 Bearer token；用户侧 CDK 查询/兑换接口不需要后台 token。

---

## 注意事项

- `README.md` 只说明当前仓库的启动和配置方式；更细的工作记录在 `docs/work/`。
- `docs/project/00-project-map.md` 是项目地图，适合快速了解模块关系。
- 当前项目没有内置 IMAP Server；它只是通过 IMAP 客户端连接外部邮箱或调用远程 IMAP 管理 API。
- 当前仓库没有 README 原先引用的截图和赞赏图片，因此本文不再引用这些缺失资源。

---

## 许可证

[MIT License](LICENSE)
