# Handoff

状态：active

## 当前任务目标

回退 PayPal 自动化链路中的强制英文和主动挑战处理，保留只读诊断，用于排除“自动化额外干预”导致 PayPal 风控的变量。

## 已完成

- `index.js`
  - 不再改写 PayPal URL。
  - 不再覆盖 document `accept-language`。
  - 不再预设 PayPal 英文 cookie。
  - 不再使用 `--lang=en-US`。
  - 不再拦截 `/auth/validatecaptcha` 返回空白页。
  - 验证/挑战 iframe 只记录诊断，不再自动点击或拖动。
- `chatgpt.js`
  - 订单创建请求恢复为只发送 `token` 和 `plus`。
  - 移除英文/美国地区请求头和 payload 字段。
- `lib/california-fingerprint.js`
  - 移除 `navigator.language` / `navigator.languages` 的硬编码注入。
  - Playwright options 不再显式设置 `Accept-Language` 或 `locale`。
- `test/test_fingerprint_guard.js`
  - 更新断言：不再期望显式 `Accept-Language` header。

## 2026-05-15 追加变更

- 已按用户要求恢复：
  - `**/auth/validatecaptcha` 空白页拦截。
  - PayPal 验证按钮/滑块自动处理 `solveSlider()`。
- 未恢复：
  - PayPal URL 强制追加 `locale.x` / `country.x`。
  - document `accept-language` 覆盖。
  - PayPal 英文 cookie 预设。
  - Chrome `--lang=en-US`。

## 验证结果

- 语法检查通过：
  - `node --check .\index.js`
  - `node --check .\chatgpt.js`
  - `node --check .\lib\california-fingerprint.js`
- `node .\test\test_fingerprint_guard.js` 未通过：
  - 当前失败：`limited random generation should select from at least two complete profiles`
  - 原因：当前 `lib/california-fingerprint.js` 只保留一个 `FINGERPRINT_PROFILES` profile。
  - 该失败不是本次回退引入的强制英文问题。

## 下一步建议

1. 用同一个 `ba_token/token` 分别跑：
   - 本地手动 Chrome。
   - Playwright headful + real Chrome channel。
   - Playwright 持久化用户目录。
2. 对比 `[PayPal Locale] page=...`、challenge iframe、cookie、UA/UA-CH、headless/headful、代理出口。
3. 如果仍只在自动化触发风控，优先减少自动化特征，而不是继续改语言或 URL 参数。
