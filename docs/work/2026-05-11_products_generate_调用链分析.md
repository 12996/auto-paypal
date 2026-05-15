# POST /api/admin/products/generate 调用链分析

## 问题描述

调用 `POST /api/admin/products/generate` 接口时出现错误：
```
[Product] Account hsehrsxvx07613@outlook.com - Analysis: 该账号无激活权限,请更换账号重试
```

## 完整调用链

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         API 入口层 (server.js)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│ POST /api/admin/products/generate                    [server.js:1947]       │
│   ├── 参数校验: count = Math.max(1, Math.min(count, 100))                   │
│   ├── 维护模式检查: store.getMaintenanceModeState()                         │
│   └── 调用 startAdminProductGenerationTask(count)    [server.js:1956]       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    任务调度层 (server.js:380-500+)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ startAdminProductGenerationTask(count, options)      [server.js:380]        │
│   ├── 获取最大并发数: store.getMaxBackgroundConcurrent()                    │
│   ├── 创建任务日志: store.createTaskLog()                                   │
│   ├── 注册停止回调: registerAdminGenerationStop()                           │
│   └── 启动 worker 循环:                                                     │
│       └── 对每个成品号调用 startProductCreation()    [server.js:484]        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   成品创建层 (product_activator.js)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│ startProductCreation(cdk, progressCallback, options) [product_activator.js:863]
│   │
│   ├── 【阶段1: 注册账号】                                                    │
│   │   └── runRegistrationProcess(onProgress, jobKey) [product_activator.js:689]
│   │       └── fork 子进程: register_openai.js                               │
│   │           ├── 邮箱来源: pool/random/inbox                               │
│   │           ├── 访问 OpenAI 注册页                                        │
│   │           ├── 填写邮箱、密码                                            │
│   │           ├── 获取验证码 (IMAP)                                         │
│   │           └── 返回 { email, accessToken }                               │
│   │
│   ├── 【阶段2: 激活 Plus】                                                   │
│   │   └── runActivationChild(index.js, ...)          [product_activator.js:946]
│   │       │
│   │       ├── 预留运行时资产: store.reserveRuntimeAssets()                  │
│   │       │   ├── phone (手机号 + SMS API Key)                              │
│   │       │   ├── card (银行卡号 + 有效期 + CVC)                            │
│   │       │   └── proxy (代理地址)                                          │
│   │       │
│   │       └── fork 子进程: index.js (激活主流程)                            │
│   │           ├── 初始化浏览器 (Playwright + Stealth)                       │
│   │           ├── 检查代理连通性                                            │
│   │           ├── 创建订单 ──────────────────────────────────────┐          │
│   │           │                                                  │          │
│   │           │   ┌──────────────────────────────────────────────┼──────┐   │
│   │           │   │ ChatGPTService._createOrder() [chatgpt.js:32]│      │   │
│   │           │   │   POST https://chatgpt.com/backend-api/      │      │   │
│   │           │   │        payments/checkout                     │      │   │
│   │           │   │   ├── 成功: 返回 checkout_session_id         │      │   │
│   │           │   │   └── 失败: ◀──────────────────────────────────┘      │   │
│   │           │   │       ├── not_eligible                              │   │
│   │           │   │       ├── permission                                │   │
│   │           │   │       └── Offer not found                           │   │
│   │           │   │       → 输出 "该账号无激活权限"                       │   │
│   │           │   └─────────────────────────────────────────────────────┘   │
│   │           │                                                             │
│   │           ├── 打开 Stripe Checkout 页面                                 │
│   │           ├── 金额校验 (必须是 $0)  ─────────────────────────┐          │
│   │           │   └── 失败: "金额校验失败" ◀─────────────────────┘          │
│   │           │                                                             │
│   │           ├── 触发 PayPal 重定向 ────────────────────────────┐          │
│   │           │   └── 失败: "无法获取 PayPal 审批链接" ◀─────────┘          │
│   │           │                                                             │
│   │           ├── PayPal 账户创建流程                                       │
│   │           │   ├── 填写登录邮箱                                          │
│   │           │   ├── 填写银行卡信息                                        │
│   │           │   ├── 填写账单地址                                          │
│   │           │   ├── 短信验证 (如触发)                                     │
│   │           │   └── 提交支付                                              │
│   │           │                                                             │
│   │           └── 返回结果: PAYMENT_SUCCESS / 错误信息                      │
│   │
│   ├── 【阶段3: 结果分析】                                                    │
│   │   └── analyzeProcessOutput(output, timedOut)     [product_activator.js:206]
│   │       ├── 成功: status='success'                                        │
│   │       ├── 无权限: status='failed', message='该账号无激活权限...'        │
│   │       ├── 可重试: status='retry', shouldRetry=true                      │
│   │       └── 维护中: status='maintenance'                                  │
│   │
│   └── 【阶段4: 协议提取】(仅支付成功后)                                      │
│       └── runProtocolProcess(email, onProgress, jobKey)                     │
│           └── fork 子进程: oauth_login.js                                   │
│               ├── OAuth 授权登录                                            │
│               ├── 获取验证码                                                │
│               └── 换取 Token Bundle                                         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 错误来源分析

"该账号无激活权限,请更换账号重试" 错误有以下几个来源：

### 1. 订单创建失败 (chatgpt.js:46-52)

```javascript
// chatgpt.js:46-52
if (response.status() !== 200) {
    const body = await response.text().catch(() => "");
    if (body.includes('not_eligible') || body.includes('permission') || body.includes('Offer not found')) {
        console.error("❌ [提示] 该账号无激活权限，请丢弃！(无激活权限)");
    }
    return null;
}
```

**触发条件**: OpenAI 后端返回非 200 状态码，且响应包含 `not_eligible`、`permission` 或 `Offer not found`

**可能原因**:
- 账号已经是 Plus 会员
- 账号被风控标记
- 促销活动 `plus-1-month-free` 不适用于该账号
- 账号地区限制

### 2. 金额校验失败 (index.js:1092)

```javascript
// index.js:1092
if (!hasZeroAmount) {
    throw new Error(`金额校验失败，当前金额不是 0 元: ${displayAmount}`);
}
```

**触发条件**: Stripe Checkout 页面显示的金额不是 $0

**可能原因**:
- 促销码未生效
- 账号不符合免费试用条件

### 3. PayPal 链接获取失败 (index.js:1127-1128)

```javascript
// index.js:1127-1128
if (!await triggerPayPal()) {
    throw new Error("无法获取 PayPal 审批链接");
}
```

**触发条件**: 无法在 Stripe Checkout 页面触发 PayPal 支付选项

### 4. 输出分析兜底 (product_activator.js:226-245, 427-434)

```javascript
// product_activator.js:226-234
const noPermissionKeywords = [
    'Missing PayPal approval URL',
    'Missing PayPal approval URL / ba_token',
    '多次尝试后仍未获取到 PayPal 重定向 URL',
    '获取 PayPal 链接异常',
    '无法获取 PayPal 审批链接',
    '该账号无激活权限',
    '金额校验失败'
];

// product_activator.js:427-434 (兜底逻辑)
if (!reachedPaypal) {
    return {
        status: 'failed',
        message: '该账号无激活权限,请更换账号重试',
        ...
    };
}
```

**触发条件**: 子进程输出包含上述关键词，或流程未到达 PayPal 阶段就失败

## 关键文件清单

| 文件 | 职责 | 关键行号 |
|------|------|----------|
| `server.js` | API 入口 + 任务调度 | 1947 (入口), 380 (调度) |
| `product_activator.js` | 成品创建主流程 | 863 (入口), 206 (结果分析), 689 (注册), 946 (激活) |
| `index.js` | Plus 激活子进程 | 1092 (金额校验), 1127 (PayPal 触发) |
| `chatgpt.js` | OpenAI API 封装 | 32 (创建订单), 46-52 (错误处理) |
| `register_openai.js` | 账号注册子进程 | - |
| `oauth_login.js` | 协议提取子进程 | - |

## 排查建议

### 1. 查看运行时日志

```bash
# 查看最近的运行时日志
GET /api/admin/runtime-logs?after=<timestamp>
```

日志中会包含子进程的详细输出，可以定位具体是哪个阶段失败。

### 2. 检查订单创建响应

在 `chatgpt.js:48-49` 已经打印了失败响应，查找日志中的：
```
[-] 订单创建失败 (Status: xxx)
    响应: {...}
```

### 3. 检查账号状态

- 确认注册的邮箱是新账号
- 确认账号未被 OpenAI 风控
- 确认促销活动 `plus-1-month-free` 仍然有效

### 4. 检查代理质量

代理 IP 被 OpenAI 风控也会导致订单创建失败，查找日志中的：
```
代理连接成功! 代理公网 IP: xxx
```

## 配置项参考

| 配置项 | 说明 | 位置 |
|--------|------|------|
| `MAX_ACCOUNT_RETRIES` | 最大账号重试次数 | product_activator.js:10 (默认 15) |
| `MAX_ACT_RETRIES_PER_ACCOUNT` | 单账号最大激活重试 | product_activator.js:11 (默认 10) |
| `email_source` | 邮箱来源 (pool/random/inbox) | 数据库 app_config |
| `max_background_concurrent` | 后台最大并发数 | 数据库 app_config |

---

# 修改记录：订单创建逻辑重构 (2026-05-11)

## 修改背景

原有的订单创建逻辑通过 OpenAI 官方 API (`chatgpt.com/backend-api/payments/checkout`) 创建订单，但该接口频繁返回 `not_eligible` / `permission` 错误，导致大量账号无法激活。

## 修改方案

### 流程对比

```
原流程:
POST chatgpt.com/backend-api/payments/checkout
  → 返回 checkout_session_id (cs_live_xxx)
  → 拼接 URL: https://pay.openai.com/c/pay/{session_id}{fragment}

新流程:
POST payurl.779.chat/api/request
  → 直接返回完整的 openai_payurl
  → 无需拼接，直接使用
```

### 新 API 规范

**请求**:
```
POST https://payurl.779.chat/api/request
Content-Type: application/json

{
    "token": "<OpenAI accessToken>",
    "plus": true
}
```

**响应** (成功):
```json
{
    "status": "success",
    "Stripe_payurl": "https://checkout.stripe.com/c/pay/cs_live_xxx#...",
    "url": "https://chatgpt.com/checkout/openai_llc/cs_live_xxx",
    "openai_payurl": "https://pay.openai.com/c/pay/cs_live_xxx#..."  // ← 使用这个
}
```

### 代码改动 (chatgpt.js)

```javascript
class ChatGPTService {
    constructor(request, token) {
        this.request = request;
        this.token = token;
        this.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
        // 外部订单 API 配置
        this.orderApiUrl = "https://payurl.779.chat/api/request";
        this.maxRetries = 3;  // 最大重试次数
    }

    async getPayPalApprovalUrl(config) {
        // 简化：直接调用 _createOrder 获取完整 URL
        const payUrl = await this._createOrder();
        return payUrl || null;
    }

    async _createOrder() {
        // 自动重试 3 次，递增等待 (2s, 4s)
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            const response = await this.request.post(this.orderApiUrl, {
                headers: this.headers,
                data: { token: this.token, plus: true }
            });

            if (response.status() === 200) {
                const data = await response.json();
                if (data.status === 'success' && data.openai_payurl) {
                    return data.openai_payurl;  // ← 直接返回完整 URL
                }
            }
            // 失败则等待后重试...
        }
        return null;
    }
}
```

### 改动要点

| 项目 | 原来 | 现在 |
|------|------|------|
| API 地址 | `chatgpt.com/backend-api/payments/checkout` | `payurl.779.chat/api/request` |
| 请求负载 | `{plan_name, promo_campaign, ...}` | `{token, plus: true}` |
| 返回处理 | 提取 `session_id` 再拼接 URL | 直接使用 `openai_payurl` |
| 重试机制 | 无 | 3 次重试，递增等待 (2s, 4s) |
| Headers | 带 `Authorization: Bearer` | 仅 `Content-Type` |

### 接口兼容性 ✅

调用方代码无需修改：

```javascript
// index.js:522-528 - 保持不变
const gpt = new ChatGPTService(context.request, CONFIG.chatgptToken, CONFIG.stripeKey);
const paypalUrl = await gpt.getPayPalApprovalUrl(CONFIG.billing);

if (!paypalUrl) {
    throw new Error("无法获取 PayPal 审批链接");
}
```

### 日志输出 (保持兼容)

- 成功: `✅ 订单创建成功` + `✅ 支付链接已生成`
- 失败: `❌ [提示] 该账号无激活权限，请丢弃！(无激活权限)` 或 `❌ [提示] 订单创建失败，已重试 3 次`

---

# 接口规范参考 (原始文档)

## ChatGPTService 类

### 构造函数

```javascript
constructor(request, token)
```

| 参数 | 类型 | 来源 | 说明 |
|------|------|------|------|
| `request` | `PlaywrightRequest` | `context.request` (Playwright BrowserContext) | 用于发起 HTTP 请求 |
| `token` | `string` | `CONFIG.chatgptToken` (环境变量 `CHATGPT_TOKEN`) | OpenAI accessToken，注册时获取 |

### getPayPalApprovalUrl 方法

```javascript
async getPayPalApprovalUrl(config) → string | null
```

| 返回值 | 类型 | 说明 |
|--------|------|------|
| 成功 | `string` | 支付链接，格式: `https://pay.openai.com/c/pay/cs_live_xxx#...` |
| 失败 | `null` | 订单创建失败或异常 |

### CONFIG.billing 结构 (index.js:39-53)

```javascript
billing: {
    country: "US",           // BILLING_COUNTRY
    address: "",             // BILLING_ADDRESS - 街道地址
    city: "",                // BILLING_CITY - 城市
    state: "",               // BILLING_STATE - 州/省
    zip: "",                 // BILLING_ZIP - 邮编
    name: "",                // BILLING_NAME - 姓名
    email: "",               // BILLING_EMAIL - PayPal 登录邮箱
    card: "",                // CARD_NUMBER - 银行卡号
    expiry: "",              // CARD_EXPIRY - 有效期
    cvc: "",                 // CARD_CVC - 安全码
    paypalPassword: "",      // PAYPAL_PASSWORD
    smsKey: "",              // SMS_API_KEY - 短信 API Key
    smsPhone: ""             // BILLING_PHONE - 手机号
}
```

---

# 选择器修复记录 (2026-05-11)

## 问题描述

`register_openai.js` 中使用 `textarea[name="prompt-textarea"]` 选择器等待 ChatGPT 聊天页面加载完成，但该选择器已失效。

## 问题分析

通过浏览器 Console 调试发现：

```javascript
// 旧选择器检查
let el = document.querySelector('textarea[name="prompt-textarea"]');
console.log('存在:', !!el);           // true
console.log('display:', getComputedStyle(el).display);  // none ← 隐藏！
console.log('尺寸:', el?.offsetWidth, 'x', el?.offsetHeight);  // 0 x 0
```

**原因**: OpenAI 将输入框从 `<textarea>` 改为 `<div contenteditable="true">`，但保留了一个隐藏的 `<textarea>` 作为占位符。

## 新的页面结构

```javascript
// 查找可见的 contenteditable 元素
$$('[contenteditable="true"]').forEach((el, i) => {
  console.log(i, el.offsetWidth + 'x' + el.offsetHeight, el);
});

// 结果:
// 0  451x40  <div contenteditable="true" id="prompt-textarea" class="ProseMirror" ...>
```

真正的输入框是：
```html
<div contenteditable="true" id="prompt-textarea" class="ProseMirror" ...>
```

## 修复方案

| 位置 | 旧选择器 | 新选择器 |
|------|----------|----------|
| register_openai.js | `textarea[name="prompt-textarea"]` | `#prompt-textarea` |

新选择器 `#prompt-textarea` 可以匹配到可见的 `<div>` 元素（尺寸 451x40），Playwright 的 `state: 'visible'` 条件可以正常通过。

## 涉及代码行

- `register_openai.js:710` - 登录后等待聊天页面
- `register_openai.js:749` - 注册后等待聊天页面
- `register_openai.js:1807` - 跳过 About You 后等待
- `register_openai.js:1820` - 最终确认进入主站
