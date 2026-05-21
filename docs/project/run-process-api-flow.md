# POST /api/run-process 功能链调用流程

状态：active

## 1. 接口定位

`POST /api/run-process` 是用户侧“自助激活”入口。前端提交用户输入的 OpenAI AccessToken 和已验证的自助 CDK，后端立即创建任务并返回 `jobKey`，实际激活流程在后台异步执行。

入口证据：

- 前端调用：`public/index.html:903-907`
- 后端路由：`server.js:2233-2614`
- API 文档旧记录：`API_DOCUMENTATION.md:99`

请求体：

```json
{
  "token": "OpenAI AccessToken",
  "cdk": "自助类型 CDK"
}
```

成功响应：

```json
{
  "success": true,
  "jobKey": "任务 jobKey",
  "message": "任务已启动，正在为您开通中..."
}
```

## 2. 总体调用链

```text
public/index.html
  -> fetch('/api/run-process')
server.js app.post('/api/run-process')
  -> validateAccessToken()
  -> ensureStoreReady()
  -> store.getMaintenanceModeState()
  -> store.getMaxConcurrentActivations()
  -> store.verifyCdkDetails()
  -> store.getRunningTaskByCdk()
  -> store.getActivationAttemptLimit()
  -> store.markCdkUsed()
  -> store.createTaskLog()
  -> reserveForegroundSlot()
  -> 后台异步任务
       -> cardAssetRegistrar.ensureRuntimeAssets()
            -> store.reserveRuntimePhoneAssets()
            -> get_card_message.js 直接请求新银行卡接口
       -> runCheckoutScript()
            -> spawn('node', [index.js])
            -> index.js run()
                 -> ChatGPTService.getPayPalApprovalUrl()
                 -> Playwright 执行 Stripe/PayPal 激活
            -> analyzeProcessOutput()
       -> store.updateTaskLog()
       -> broadcastToTask()
       -> 成功/失败后更新 CDK、IP、资产状态
  -> res.json({ success, jobKey })
WebSocket
  -> public/index.html subscribe(jobKey)
  -> server.js sendTaskSnapshot()/broadcastToTask()
```

## 3. 前端触发与状态订阅

用户点击开始按钮后，前端会先做基础校验：

1. `token` 不能为空。
2. 必须先验证过 CDK。
3. 前端本地执行一次 `validateAccessToken(token)`。

校验通过后，前端调用：

- `fetch('/api/run-process', { method: 'POST', body: JSON.stringify({ token, cdk: verifiedCdk }) })`：`public/index.html:903-907`
- 如果返回 `jobKey`，前端调用 `initWebSocket(data.jobKey)` 订阅任务进度：`public/index.html:910-913`

后端 WebSocket 在收到 `{ type: 'subscribe', jobKey }` 后，把连接加入 `taskClients`，并先发送一次数据库里的任务快照：

- WebSocket 订阅：`server.js:2798-2814`
- 快照读取：`server.js:599-615`

## 4. 路由同步校验阶段

后端路由先同步完成所有“能否启动任务”的检查，失败时直接返回 HTTP 错误，不创建后台子进程。

### 4.1 请求参数与 Token 结构校验

- 读取 `token`、`cdk`、`clientIp`：`server.js:2234-2236`
- 缺少 token 返回 `400 缺少 AccessToken`：`server.js:2237-2239`
- 缺少 CDK 返回 `400 缺少 CDK`：`server.js:2240-2242`
- `validateAccessToken()` 校验 JWT 结构、`typ`、`alg`、`iss`、`aud`、OpenAI 账户字段、`model.request` scope 和 `exp`：`server.js:677-730`

注意：这里不做远程验签，只按 JWT 内容做结构和字段校验。

### 4.2 系统状态与并发限制

- `ensureStoreReady()` 复用 `store.ensureReady()` promise，保证 MySQL 表结构准备完成：`server.js:661-669`
- 维护模式开启时返回 `503`：`server.js:2249-2252`
- 读取前台最大并发 `store.getMaxConcurrentActivations()`，若 `activeForegroundJobs.size` 达到上限，返回 `429`：`server.js:2254-2257`

前台任务占位由内存 Set 管理：

- `activeForegroundJobs` 定义：`server.js:43`
- `reserveForegroundSlot()`：`server.js:75-77`
- `releaseForegroundSlot()`：`server.js:79-81`

### 4.3 CDK 状态、恢复与冷却

CDK 检查链：

- `store.verifyCdkDetails(cdk)` 只查 `is_active = 1` 的 CDK：`mysql-store.js:820-827`
- 如果该 CDK 已有 `running` 任务，直接返回原 `jobKey`，前端恢复等待进度：`server.js:2259-2267`
- 如果 CDK 不存在、已使用或不是 `自助` 类型，返回 `403`：`server.js:2268-2270`
- 如果 CDK 在冷却期，返回 `403`，提示剩余分钟：`server.js:2272-2278`

IP 冷却检查：

- `getClientIp()` 从 `x-forwarded-for` / `req.ip` / socket 中取客户端 IP：`server.js:99-105`
- `store.getActivationAttemptLimit('ip', clientIp)` 读取 IP 失败限制记录：`mysql-store.js:864-874`
- 冷却中返回 `403`：`server.js:2280-2289`

## 5. 任务创建与立即响应

启动前先把 CDK 标记为占用：

- `store.markCdkUsed(cdk)` 把 `cdk_codes.used_at` 设置为当前时间，并要求 `used_at IS NULL`：`mysql-store.js:908-918`
- 如果更新失败，说明 CDK 已被占用或不可用，返回 `403`：`server.js:2291-2294`

然后创建任务日志：

- `store.createTaskLog()` 写入 `task_logs`，生成 `jobKey`，初始状态 `running`、进度 `3`：`server.js:2296-2303`、`mysql-store.js:1643-1666`
- `logTask()` 写入运行时日志并打印控制台：`server.js:618-627`
- `reserveForegroundSlot(task.jobKey)` 占用前台并发槽位：`server.js:2305-2306`

关键设计：`server.js:2308-2603` 用立即执行的异步函数跑后台任务，HTTP 请求不等待激活结束。路由在 `server.js:2606-2611` 立即返回 `jobKey`。

## 6. 后台激活主循环

后台循环最多执行 `MAX_PROCESS_ATTEMPTS = 10` 次：`server.js:21`、`server.js:2319`。

每次尝试的主流程：

1. 广播“第 N 次尝试”和当前进度：`server.js:2261-2270`
2. 在 5 分钟内循环通过 `cardAssetRegistrar.ensureRuntimeAssets()` 抢占运行时资产；流程只从数据库抢手机号和代理，每次都直接请求银行卡接口获取新卡并写入 `card_assets`：`server.js:2332-2356`、`card_asset_registrar.js`
3. 组装子进程环境变量，包含 CARD 与 BILLING 字段：`server.js:2368-2383`
4. 调用 `runCheckoutScript()` 启动 `index.js`：`server.js:2391-2413`
5. 分析输出、更新任务日志、广播进度：`server.js:2414-2443`
6. 根据分析结果处理银行卡禁用/成功回写；手机号状态不由自动流程作废，只由管理员在后台维护：`server.js:2457-2477`
7. `finally` 中先落库银行卡状态或禁用结果，再释放本次抢占的资产：`server.js:2449-2471`
8. 如果 `shouldRetry=false` 或已到最大次数，结束循环：`server.js:2472-2476`

## 7. 运行时资产选择与释放

资产由 `cardAssetRegistrar.ensureRuntimeAssets(ownerKey)` 返回：

- 手机号：`phone_assets`
- 银行卡：不从数据库挑选旧卡；每次有可用手机号后直接请求银行卡接口生成新卡，再写入 `card_assets`
- 代理：`app_config.proxy`

关键证据：

- 单行资产抢占使用事务和 `FOR UPDATE SKIP LOCKED`，并写入 `in_use=1`、`locked_at`、`locked_by`：`mysql-store.js:1044-1076`
- `reserveRuntimePhoneAssets()` 只抢手机号并读取代理，不查询 `card_assets` 旧卡。
- `card_asset_registrar.js` 在有手机号时最多尝试 3 次直接请求新银行卡接口。
- 直接获取成功后通过 `insertRegisteredCardAsset()` 新增一条已注册卡，写入卡号、有效期、CVC、账单地址、短信信息和 `redeemed_at`，并保持 `in_use=1` 锁给当前任务。
- 释放资产时清空 `in_use/locked_at/locked_by`：`mysql-store.js:1157-1178`

如果 5 分钟内没有抢到可用手机号，或连续请求新银行卡接口仍没有拿到可用 CARD 字段，任务会被归类为维护状态：

- `ASSET_POOL_EXHAUSTED`：`server.js:2358-2365`

## 8. 子进程 index.js 的职责

`runCheckoutScript()` 用 `spawn('node', [scriptPath])` 启动 `index.js`，并持续读取 stdout/stderr：

- 子进程启动：`server.js:1270-1276`
- 1 分钟无输出则杀掉子进程：`server.js:1298-1307`
- stdout/stderr 进入 `output`，同时触发进度推算：`server.js:1310-1322`
- 子进程退出后调用 `analyzeProcessOutput(output, timedOut)`：`server.js:1327-1336`

传给 `index.js` 的核心环境变量：

```text
CHATGPT_TOKEN = 用户提交的 OpenAI AccessToken
SMS_API_KEY   = 被抢占手机号对应短信平台 key
BILLING_PHONE = 被抢占手机号
PROXY         = 当前随机代理
CARD_NUMBER   = 被抢占银行卡号
CARD_EXPIRY   = 被抢占银行卡有效期
CARD_CVC      = 被抢占银行卡 CVC
BILLING_COUNTRY = 账单国家
BILLING_ADDRESS = 账单地址
BILLING_CITY    = 账单城市
BILLING_STATE   = 账单州/省
BILLING_ZIP     = 账单邮编
BILLING_NAME    = 账单姓名
```

`index.js` 启动后从环境变量构造 `CONFIG`：`index.js:92-113`。

### 8.1 订单创建

`index.js` 在 Phase 1 创建订单：

- 创建 `ChatGPTService(context.request, CONFIG.chatgptToken, CONFIG.stripeKey)`：`index.js:532`
- 调用 `getPayPalApprovalUrl()`：`index.js:534`
- 如果没有得到 PayPal URL，抛出 `无法获取 PayPal 审批链接`：`index.js:536-538`

`ChatGPTService` 实际调用 ChatGPT checkout API：

- 固定通过 `http://127.0.0.1:7891` 代理创建 Playwright APIRequestContext：`chatgpt.js:4`、`chatgpt.js:127-129`
- 先请求 `https://chatgpt.com` 建立上下文，再 POST `https://chatgpt.com/backend-api/payments/checkout`：`chatgpt.js:3`、`chatgpt.js:131-145`
- 请求体使用 Plus + PayPal hosted checkout payload：`chatgpt.js:8-25`
- 响应中优先按 `url` / `stripe_hosted_url` / `checkout_url` 提取支付长链接；如果只返回 `checkout_session_id` 等 `cs_live` / `cs_test` session id，则拼接成 `https://pay.openai.com/c/pay/{session_id}`：`chatgpt.js:63-81`、`chatgpt.js:201`
- 最多重试 3 次：`chatgpt.js:102`、`chatgpt.js:121`

### 8.2 Stripe/PayPal 自动化

`index.js` 的主链路包括：

- 启动 Playwright/Chromium，配置代理、UA、加州指纹和 PayPal URL 地区参数处理：`index.js:287-545`
- 打开 Stripe Checkout 后触发 PayPal 支付方式：`index.js:1277-1315`
- Stripe 提交后等待 HumanSecurity 6-8 秒，再等待 PayPal 页面：`index.js:2227-2238`
- 点击 `Create an Account` 并填写 PayPal 邮箱：`index.js:2241-2303`
- 等待支付表单并处理滑块：`index.js:2308-2333`
- 填写卡号、有效期、CVC、姓名、邮箱、手机号、地址和 PayPal 密码：`index.js:2335-2503`
- 提交前校验字段一致性：`index.js:2506-2541`
- 点击 `Agree & Create Account`：`index.js:2549-2553`
- 如触发短信验证，通过短信 API 取码并输入：`index.js:2557-2573`
- 点击最终确认并监测支付结果：`index.js:2577-2649`

成功标志：

- `index.js` 输出 `PAYMENT_SUCCESS`：`index.js:2638-2640`
- 父进程 `analyzeProcessOutput()` 识别 `PAYMENT_SUCCESS` / `最终校验：支付成功` / `支付成功` 为成功：`server.js:952-967`

## 9. 输出分析、重试与资产处理

父进程不依赖子进程退出码判断业务结果，而是解析完整输出文本：

- 成功：`PAYMENT_SUCCESS` 等标记 -> `status='success'`，不重试：`server.js:956-967`
- 无激活资格 / 无 PayPal 审批链接 / 金额校验失败 -> `failed`，不重试：`server.js:969-980`
- 代理认证/余额问题 -> `failed` 或 `maintenance`：`server.js:983-1002`
- 致命拦截、短信异常、支付检测失败、PayPal/Stripe 驳回等 -> `retry`：`server.js:1005-1109`
- 手机号异常时只重试，不自动禁用手机号；手机号是否作废由管理员在后台手机号池手动设置。
- 银行卡被拒且已经到达 PayPal 阶段时 `deleteCard=true`，会在释放锁前禁用银行卡：`server.js:1042-1050`、`server.js:2449-2463`、`mysql-store.js:950-965`

进度由输出关键字映射：

- `getCheckoutProgress()` 维护关键日志 -> 百分比映射：`server.js:1185-1248`
- `normalizeTaskProgress()` 保证进度单调不回退，非成功状态最多 99：`server.js:1250-1255`

## 10. 任务收尾状态机

后台循环结束后，路由后台任务会统一写入最终状态：

- 归一化最终状态与进度：`server.js:2479-2485`
- 更新 `task_logs`：`server.js:2486-2492`、`mysql-store.js:1701-1719`
- WebSocket 广播最终状态：`server.js:2494-2501`

成功时：

- `shouldRollbackCdk = false`，CDK 保持已使用：`server.js:2508-2510`
- 重置 CDK 失败计数：`server.js:2510`、`mysql-store.js:861-868`
- 重置 IP 失败限制：`server.js:2511-2513`、`mysql-store.js:905-912`
- 激活成功的尝试在释放资产锁前先标记本次银行卡已激活，并更新手机号/银行卡成功次数：`server.js:2449-2471`、`mysql-store.js:971-982`、`mysql-store.js:1516-1540`

失败时：

- 回滚 CDK 为未使用：`server.js:2532-2534`、`mysql-store.js:926-934`
- 如果失败原因包含“无激活权限”，记录 CDK 和 IP 失败次数；连续 3 次后冷却 10 分钟：`server.js:2537-2571`、`mysql-store.js:836-903`

异常时：

- 捕获后台异常并写入 `task_logs.status='failed'`：`server.js:2572-2587`
- 若仍允许回滚，则把 CDK 置回未使用：`server.js:2588-2591`
- 最终释放前台并发槽位：`server.js:2593-2602`

## 11. 关键状态表

| 表 | 字段/作用 | 写入点 |
|---|---|---|
| `cdk_codes` | `used_at` 标记 CDK 是否已被占用/消费 | `markCdkUsed()` / `markCdkUnused()` |
| `cdk_codes` | `fail_count`、`cooldown_until` 控制无资格冷却 | `recordCdkFailure()` / `resetCdkFailure()` |
| `activation_attempt_limits` | 按 IP 记录连续失败与冷却 | `getActivationAttemptLimit()` / `recordActivationAttemptFailure()` |
| `task_logs` | `job_key`、`status`、`message`、`progress`、`raw_output` | `createTaskLog()` / `updateTaskLog()` |
| `phone_assets` | `in_use`、`locked_at`、`locked_by` 抢占锁；`is_active/status` 由管理员维护 | `reserveRuntimePhoneAssets()` / `releaseRuntimeAssets()` |
| `card_assets` | 记录每次接口获取的新卡、抢占锁、激活状态、禁用状态、成功次数；不再作为运行时选卡来源 | `insertRegisteredCardAsset()` / `markCardAssetActivated()` / `deleteCardAsset()` |
| `app_config` | `proxy` 运行时代理池 | `reserveRuntimePhoneAssets()` |

## 12. 与成品号流程的边界

`POST /api/run-process` 是“用户自带 OpenAI AccessToken + 自助 CDK”的前台激活流程，只执行支付/激活，不执行注册和 OAuth 协议提取。

对比成品号生产：

- 成品号生产入口在 `product_activator.js:startProductCreation()`，包含注册、激活、OAuth 三段式流程。
- 本接口直接把用户 token 传给 `index.js`，不会调用 `register_openai.js` 或 `oauth_login.js`。
- 本接口成功后只标记 CDK、任务日志、资产状态；不会新增 `product_assets` 成品账号。

## 13. 风险点与注意事项

1. `validateAccessToken()` 只做 JWT 内容结构校验，不做远程签名验证。
2. HTTP 成功响应只代表任务启动成功，不代表激活成功；最终结果必须看 WebSocket 或 `task_logs`。
3. 子进程业务成功由日志文本识别，关键成功标志是 `PAYMENT_SUCCESS`。
4. 资产释放在每次尝试的 `finally` 中执行；如果本次尝试激活成功，会先写入 `is_activated=1` 并更新成功次数，再释放卡锁，避免并发任务抢到同一张刚成功的卡。
5. 自助流程成功时 `markCardAssetActivated(cardAssetId, '')` 的激活账号为空，因为该流程没有账号邮箱上下文。
6. 如果出现“无激活权限”，会同时影响 CDK 和 IP 的冷却计数。
