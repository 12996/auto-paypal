# test 测试文件说明

## 使用前说明

- 大多数脚本会读取项目根目录 `.env`。
- 涉及浏览器的脚本默认有头模式，方便观察页面。
- 涉及真实流程的脚本可能访问外部服务、数据库、代理、短信和支付页，运行前先确认环境配置。

## 文件清单

| 文件 | 测什么 | 参数 / 环境 |
|---|---|---|
| `test_index.js` | 独立跑 `index.js` 主流程：ChatGPT Token → Stripe/PayPal → OAuth。 | 参数：`<CHATGPT_TOKEN>`；或环境：`CHATGPT_TOKEN`。可选：`PROXY`、`HEADFUL`、`BILLING_*`、`CARD_*`、`PAYPAL_PASSWORD`、`SMS_API_KEY`、`BILLING_PHONE`。 |
| `test_paypal_page.js` | 从已有 Stripe Checkout URL 跑完整 PayPal 支付流程。 | 参数：`<Stripe_Checkout_URL>` 必填；可选：`--debug`。环境从 `.env` 读取。 |
| `test_paypal_payment_form.js` | 从 PayPal signup / 支付信息页开始，测试支付表单渲染、填写和校验。 | 参数：`<PayPal signup URL>` 或 `--url <url>`；可选：`--submit`、`--headless`、`--keep-open`；也可用 `PAYPAL_SIGNUP_URL`。 |
| `test_paypal_email.js` | 离线调试 PayPal 邮箱输入框选择器。 | 无命令参数；默认打开固定的 `debug_html/...error.html`，需要该文件存在。 |
| `test_paypal_risk.js` | 离线调试 PayPal 风控/拦截页 DOM 和选择器。 | 无命令参数；默认打开固定的 `debug_html/...runtime_error.html`，需要该文件存在。 |
| `test_stripe_checkout.js` | 打开指定 Stripe/支付 URL，注入调试工具，高亮输入框和按钮。 | 参数：`<URL>` 必填；可选环境：`PROXY`。 |
| `test_debug_html.js` | 打开保存的本地 HTML，注入 DOM 调试工具。 | 参数：`[html文件路径]` 可选；不传则自动打开 `debug_html/` 最新 HTML。 |
| `test_products_generate.js` | 直接测试产品生成流程 `startProductCreation`，或只检查资产池。 | 可选参数：`--check`/`-c` 只检查资产池，`--help`/`-h` 查看帮助；无参数会执行完整生成。需要数据库和资产池配置。 |
| `test_cdk_generate.js` | 测试 CDK 生成规则和数据库写入/重复检测。 | 无参数；需要 `.env` 数据库配置。 |
| `test_fingerprint_guard.js` | 静态/单元检查加州指纹和 `index.js` 风控相关约束。 | 无参数；直接断言，失败会抛错。 |
| `test_california_fingerprint.js` | 手动打开加州指纹检测浏览器，文件顶部可固定默认代理，也可命令行覆盖。 | 默认使用脚本内 `DEFAULT_PROXY_URL`；可选：`--proxy`/`--remote-proxy`、`--local-port`、`--vpn-port`、`--vpn-type`、`--url`、`--channel`、`--headless`。不读取项目 `CONFIG.proxy`。 |
| `iphone_safari_test.js` | 测试 iPhone Safari 指纹伪装效果。 | 无参数；会访问 `browserleaks.com`，浏览器保持打开，按 `Ctrl+C` 退出。 |
| `iphone_safari_socks5_test_v3.js` | 测试 iPhone Safari 指纹 + 本地 VPN + 远程 SOCKS5 链路。 | 无参数；脚本内写死 VPN/远程 SOCKS5/本地端口配置，会访问 `httpbin.org` 和指纹检测站。 |
| `generate-test-token.js` | 生成后台测试用 admin token。 | 无参数；可选环境：`ADMIN_TOKEN_SECRET`。 |
| `debug_helper.js` | 调试辅助模块：失败时保存页面 HTML。 | 不是独立测试入口；被其他脚本 `require`。环境：`DEBUG_MODE=1` 时保存 HTML。 |

## 常用命令

```bash
node test/test_index.js <CHATGPT_TOKEN>
node test/test_paypal_page.js "<Stripe_Checkout_URL>" --debug
node test/test_paypal_payment_form.js "<PayPal signup URL>" --keep-open
node test/test_debug_html.js
node test/test_products_generate.js --check
node test/test_fingerprint_guard.js
node test/test_california_fingerprint.js
node test/test_california_fingerprint.js --proxy 127.0.0.1:7897
node test/test_california_fingerprint.js --proxy "socks5://user:pass@host:3010" --local-port 10900 --vpn-port 7897 --vpn-type http
```
