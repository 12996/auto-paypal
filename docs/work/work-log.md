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
