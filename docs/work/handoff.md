# Handoff

状态：active

## 当前任务目标

继续调试 PayPal 自动化链路，重点是：

- PayPal 页面语言保持英文。
- PayPal 邮箱/手机号/卡号使用更稳定的 `fill()` 路径。
- 日志足够说明当前阶段，但不输出冗长 URL/JSON。
- 支持从 PayPal 支付信息页单独运行专项测试。

## 已完成

### `index.js`

- PayPal URL 仍会被强制为：
  - `country.x=US`
  - `locale.x=en_US`
- 新增 PayPal 语言检测与切换：
  - 在等待 `Create an Account` 前检测页面是否中文。
  - 如果中文，点击页面底部 English 入口。
  - 刷新重试后也会再次检测。
- PayPal locale 日志已收敛：
  - 默认只输出 path、htmlLang、country、locale。
  - 完整 JSON 只在 `DEBUG_PAYPAL_LOCALE=1` 时输出。
- PayPal 输入策略：
  - 卡号：`fill()`。
  - PayPal 登录邮箱：`fill()`。
  - PayPal 支付表单邮箱：`fill()`。
  - PayPal 手机号：`fill()`。
  - 姓名、地址、密码仍保留原手动输入节奏。
- Stripe 提交后增加 HumanSecurity 等待提示：
  - `⏳ [风控] Stripe 提交后等待 HumanSecurity 6-8 秒...`
  - 等待行为未改。

### 测试与文档

- 新增 `test/test_paypal_payment_form.js`
  - 从 PayPal signup / 支付信息页开始测试。
  - 支持 `--submit`、`--headless`、`--keep-open`。
  - 支持 `PAYPAL_SIGNUP_URL`。
  - 默认只填表校验，不提交。
- 新增 `test/PROJECT_MAP.md`
  - 说明 `test/` 下每个测试文件用途和参数。
- 新增/更新项目记录：
  - `docs/project/2026-05-15_PayPal支付信息页专项测试.md`
  - `docs/project/2026-05-15_PayPal中文页面自动切换英文.md`
  - `docs/work/work-log.md`

## 验证结果

- `node --check index.js`：通过。
- `node --check test\test_paypal_payment_form.js`：通过。
- 静态断言已确认：
  - PayPal 邮箱/手机号 fill 模式存在。
  - PayPal 中文页检测与 English 点击逻辑存在。
  - PayPal locale 默认简洁日志与 `DEBUG_PAYPAL_LOCALE` 详细日志开关存在。

## 当前注意点

- `index.js` 当前工作区已有多次未提交变更，改动集中在 PayPal locale、语言切换、挑战处理、输入策略和日志。
- PayPal URL 和日志里可能包含 `ba_token` / `token` / `ctxId`，默认日志已避免直接打印完整 URL。
- 如果需要完整诊断，运行前设置：

```powershell
$env:DEBUG_PAYPAL_LOCALE="1"
```

## 推荐下一步

1. 用真实流程跑一次，确认中文页会自动切换英文。
2. 观察日志是否只保留简洁摘要。
3. 若仍卡在 `Create an Account`，优先检查：
   - 页面是否已经是英文。
   - `Create an Account` 文案是否变体。
   - 是否进入登录页/风控页而不是账户创建页。
4. 若支付表单填写失败，用：

```powershell
node .\test\test_paypal_payment_form.js "<PayPal signup URL>" --keep-open
```
