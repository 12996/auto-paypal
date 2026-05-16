# Work Log

## 2026-05-15 - PayPal 强制英文链路回退与风控诊断收敛

目标：根据本地浏览器同 URL 不触发风控、自动化触发风控的现象，回退自动化侧额外强制英文与挑战处理干预，保留只读诊断日志。

已完成：

- 移除 `index.js` 中 PayPal 主页面 URL 自动追加 `locale.x=en_US` / `country.x=US`。
- 移除 `index.js` 中 PayPal document 请求 `accept-language` 覆盖。
- 移除 `index.js` 中 PayPal `LANG=en_US%3BUS` / `cookie_check` cookie 预设。
- 移除 Chrome 启动参数 `--lang=en-US`。
- 移除 `chatgpt.js` 订单接口请求头与 payload 中的英文/美国地区强制字段。
- 移除 `lib/california-fingerprint.js` 注入脚本中对 `navigator.language` / `navigator.languages` 的硬编码覆盖。
- 保留 `[PayPal Locale] page=...` 页面语言诊断日志。
- 移除 `auth/validatecaptcha` 空白响应拦截。
- 将 PayPal 验证/挑战处理改为仅记录 iframe 诊断，不再自动点击或拖动。

验证：

- `node --check .\index.js`：通过。
- `node --check .\chatgpt.js`：通过。
- `node --check .\lib\california-fingerprint.js`：通过。
- `node .\test\test_fingerprint_guard.js`：仍失败；失败点为现有测试要求至少两个完整指纹 profile，但当前 `FINGERPRINT_PROFILES` 只有一个 profile，和本次强制英文回退无直接关系。

风险与注意：

- 默认生成的加州 baseline 数据仍包含 `en-US/en`，但不再通过 PayPal URL/header/cookie 或页面 JS 注入强制覆盖语言。
- 如果自动化仍触发风控，下一步应优先对比本地浏览器与 Playwright 的运行环境差异：持久化用户数据目录、headless/headful、Chrome channel、扩展/缓存/cookie、TLS/代理出口、鼠标键盘事件节奏、Playwright 默认特征。

## 2026-05-15 - 恢复 PayPal 安全挑战处理逻辑

目标：按用户要求恢复此前移除的两块挑战处理逻辑，同时继续保持强制英文 URL/header/cookie 回退状态。

已完成：

- 恢复 `index.js` 中 `**/auth/validatecaptcha` 空白页拦截。
- 恢复 `solveSlider()` 验证按钮点击、滑块拖动、reCAPTCHA 图片验证检测逻辑。
- 恢复支付表单等待阶段对 `solveSlider()` 的轮询调用。
- 更新 `test/test_fingerprint_guard.js` 中对应断言，明确当前项目期望保留上述挑战处理逻辑。

验证：

- `node --check .\index.js`：通过。
- `node --check .\chatgpt.js`：通过。
- `node --check .\lib\california-fingerprint.js`：通过。
- `node .\test\test_fingerprint_guard.js`：仍失败；失败点仍为 `limited random generation should select from at least two complete profiles`，与本次恢复挑战处理逻辑无直接关系。

## 2026-05-15 - PayPal country.x=CN 来源追踪

目标：区分 `country.x=CN` 是订单接口初始 PayPal URL 已携带，还是 PayPal 服务端后续重定向时追加。

已完成：

- 新增 `getPayPalLocaleTrace()` / `logPayPalLocaleTrace()` 只读诊断。
- 在订单 URL 生成后输出 `[PayPal Locale Trace] initial-paypal-url=...`。
- 在 PayPal 主 frame 导航时输出 `[PayPal Locale Trace] navigation=...`。
- 诊断字段包含主 URL 与 `state` 内部的 `country.x` / `locale.x` / `token` / `ba_token`。

注意：

- 该变更只记录，不改写 URL、header、cookie 或页面 JS。

## 2026-05-15 - 临时强制 PayPal URL 为 CN/en_CN

目标：按用户要求验证 PayPal URL 参数 `country.x=CN&locale.x=en_CN` 对当前链路的影响。

已完成：

- 新增 `forcePayPalChinaLocaleUrl()`。
- 初始 PayPal URL 进入 `page.goto()` 前强制设置：
  - `country.x=CN`
  - `locale.x=en_CN`
- PayPal 主页面 document 导航通过 `context.route()` 强制设置同样参数。
- 未改动 header、cookie、navigator 语言。

验证：

- `node --check .\index.js`：通过。

## 2026-05-15 - PayPal URL 强制参数改为 US/en_US

目标：按用户要求将 PayPal URL 参数从 `country.x=CN&locale.x=en_CN` 改为英文美国地区。

已完成：

- `forcePayPalChinaLocaleUrl()` 改名为 `forcePayPalUsLocaleUrl()`。
- URL 参数改为：
  - `country.x=US`
  - `locale.x=en_US`
- 日志改为 `[PayPal Locale] force US/en_US...`。

## 2026-05-15 - PayPal 支付信息页专项测试与测试索引

目标：方便从 PayPal 邮箱提交后的支付信息页开始单独调试，不必每次跑完整注册/Stripe 流程。

已完成：

- 新增 `test/test_paypal_payment_form.js`。
  - 支持传入 PayPal signup URL 或 `PAYPAL_SIGNUP_URL`。
  - 支持 `--submit`、`--headless`、`--keep-open`。
  - 默认只填表并校验，不点击最终提交。
  - 自动加载 `.env`，并导入脚本内测试默认 `env`。
  - 修复启动前预检错误被吞掉的问题，缺字段时明确输出缺失环境变量。
- 新增 `test/PROJECT_MAP.md`。
  - 简要说明 `test/` 下每个测试文件的用途、参数和依赖环境。
- 新增 `docs/project/2026-05-15_PayPal支付信息页专项测试.md`。

验证：

- `node --check test\test_paypal_payment_form.js`：通过。

## 2026-05-15 - PayPal 邮箱/手机号输入改为 fill 模式

目标：按用户要求让 PayPal 链路中的卡号、手机号、邮箱都走 `fill()` 路径，减少逐字符输入带来的格式化吞字符或风控抖动。

已完成：

- `index.js`
  - PayPal 登录邮箱：`humanFillInput(..., false, true)`。
  - PayPal 支付表单邮箱：`humanFillInput(..., false, true)`。
  - PayPal 手机号：`humanFillInput(..., true, false)`。
  - 卡号保持原逻辑：`digitsMode=true`，本来已走 `fill()`。
  - PayPal 表单校验失败后的邮箱重填同步支持 `fastMode`。

验证：

- `node --check index.js`：通过。
- 静态断言确认登录邮箱、支付表单邮箱、手机号和校验重填都使用目标模式。

## 2026-05-15 - PayPal 中文页面自动切换英文与日志收敛

目标：在 PayPal 跳转后如果页面是中文，先点击 English 切换到英文，再等待 `Create an Account`；同时压缩 PayPal locale 日志，避免完整 URL/JSON 刷屏。

已完成：

- `index.js`
  - 新增 `ensurePayPalEnglishLanguage()`。
  - 在 `solveSlider()` + `checkCriticalErrors()` 之后、等待 `Create an Account` 之前检测语言。
  - 刷新重试后再次检测语言。
  - 中文判定依据：
    - `html lang` 为 `zh`。
    - 隐藏字段 `input[name="locale.x"]` 为 `zh_CN`。
    - URL 含 `locale.x=zh` 或 `country.x=CN`。
    - 页面可见文案包含 `登录您的PayPal账户`、`创建账户`、`下一步`、`邮箱地址`。
  - English 入口选择器：
    - `a[data-locale="en_US"]`
    - `a[lang="en"][href*="locale.x=en_US"]`
    - `.scTrack\:unifiedlogin-footer-language_en_US`
    - `a:has-text("English")`
  - PayPal locale 日志默认改为简洁摘要，只显示 path、htmlLang、country、locale。
  - 完整 JSON 仅在 `DEBUG_PAYPAL_LOCALE=1` 或 `DEBUG_PAYPAL_LOCALE=true` 时输出。
- 新增 `docs/project/2026-05-15_PayPal中文页面自动切换英文.md`。

验证：

- `node --check index.js`：通过。
- 静态断言确认语言检测函数、调用点、简洁日志和 debug JSON 开关存在。

## 2026-05-15 - Stripe 提交后 HumanSecurity 等待日志

目标：解释 `✅ [安全] 最终检查通过，准备点击按钮` 后看似卡顿的原因。

已完成：

- `index.js`
  - 在 `mouseBreathing(page, randomDelay(6000, 8000))` 前新增日志：
    - `⏳ [风控] Stripe 提交后等待 HumanSecurity 6-8 秒...`
  - 未修改等待时长和行为。

验证：

- `node --check index.js`：通过。
