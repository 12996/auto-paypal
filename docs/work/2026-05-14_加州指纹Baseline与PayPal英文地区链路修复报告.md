# 加州指纹 Baseline 与 PayPal 英文地区链路修复报告

日期：2026-05-14

## 背景

本次问题集中在两类现象：

1. PayPal 页面出现中文界面，甚至默认国家/地址倾向中国。
2. 人机验证再次出现，怀疑上午对 baseline 指纹的修改被回退。

排查后确认：旧版 `lib/california-fingerprint.js` 中多项 baseline 能力被撤回，只保留了部分语言修复；同时 PayPal 页面语言不只由 `navigator.language` 决定，还可能来自 URL、cookie、订单接口和服务端 session。

## 目标

- 将 `california-fingerprint.js` 恢复为真实性优先的加州 baseline。
- 强制英文/美国语言链路，避免 `zh-CN` 混入。
- 将 PayPal 语言来源从浏览器 JS 层扩展到订单请求、URL、cookie、document 请求头。
- 保留必要诊断日志，便于判断 PayPal 最终语言由哪一层决定。

## 修改文件

- `lib/california-fingerprint.js`
- `index.js`
- `chatgpt.js`
- `register_openai.js`
- `oauth_login.js`
- `docs/浏览器指纹伪装库功能文档.md`
- `docs/浏览器指纹伪装库使用教程.md`

## `california-fingerprint.js` 修复内容

### 固定加州 baseline

当前固定为：

- San Diego
- Windows / Win32
- Chrome
- 8 核 CPU
- 8GB 内存
- 1920x1080 屏幕
- America/Los_Angeles
- Intel UHD 620 WebGL
- en-US / en

### 强制英文

新增并使用：

```js
static ENGLISH_LOCALE = 'en-US';
static ENGLISH_LANGUAGES = ['en-US', 'en'];
forceEnglishConfig(config)
```

即使外部传入：

```js
locale: 'zh-CN',
languages: ['zh-CN', 'zh']
```

也会被覆盖为：

```js
locale: 'en-US',
languages: ['en-US', 'en']
```

### 恢复 baseline 指纹项

已恢复或补齐：

- `navigator.webdriver`
- `navigator.userAgentData`
- `navigator.languages`
- `navigator.language`
- `navigator.connection`
- `navigator.hardwareConcurrency`
- `navigator.deviceMemory`
- `navigator.platform`
- `screen.*`
- plugins / mimeTypes
- `window.chrome`
- `permissions.query`
- `Notification.permission`
- iframe `contentWindow.navigator.webdriver`
- `cdc_*` / `$cdc_*` 清理

### WebGL 对齐 baseline

当前使用：

```js
HTMLCanvasElement.prototype.getContext
  -> returned gl.getParameter
```

替代旧版 prototype-level Proxy，减少原型差异。

### Audio 对齐 baseline

当前使用：

```js
AudioContext / OfflineAudioContext prototype.createAnalyser
  -> returned analyser.getFloatFrequencyData
```

噪声使用 `fingerprintSeed` 生成稳定微扰，避免同一页面内随机漂移。

### Canvas 稳定微扰

处理：

- `toDataURL`
- `getImageData`

策略：

- 小幅像素扰动。
- 同配置/同 seed 下稳定。
- 避免每次调用 `Math.random()`。

### 移除 geolocation 预授权

当前 baseline 不再默认设置：

```js
geolocation
permissions: ['geolocation']
```

原因：PayPal 风控 iframe 可能读取权限状态，默认不预授权更接近 baseline。

## PayPal 英文/美国链路修复

### `chatgpt.js`

订单接口请求头新增：

```js
"Accept-Language": "en-US,en;q=0.9"
```

目的：避免外部订单 API 按中文环境生成支付 session。

订单创建 payload 同步补充英文/美国地区字段：

```js
data: {
  token: this.token,
  plus: true,
  locale: 'en_US',
  language: 'en_US',
  country: config?.country || 'US'
}
```

背景：`test_paypal_page.js` 使用外部传入的 Checkout URL，不会重新创建订单；`test_index.js` 会通过 `chatgpt.js` 调外部订单 API 创建新订单。两者默认语言表现不同的主要差异在订单创建阶段，而不是浏览器 JS 指纹层。

### `index.js`

新增 PayPal URL 归一函数：

```js
forceEnglishPayPalLocaleUrl(rawUrl)
```

当前只对主页面域名进行 URL 地区归一：

```txt
paypal.com
www.paypal.com
```

不会再改写：

```txt
c.paypal.com
paypalobjects.com
*.paypalobjects.com
其他 *.paypal.com 子域名
```

主页面 URL 仅保留 PayPal 常见参数：

```txt
locale.x=en_US
country.x=US
```

已移除冗余参数：

```txt
lang=en_US
language=en_US
hl=en
```

原因：日志确认主页面已经是英文后，继续给风控、统计、recaptcha 等资源 URL 批量追加语言参数会增加脚本化痕迹；真实性优先时应收窄改写范围。

同时对 document 请求头强制：

```txt
accept-language: en-US,en;q=0.9
```

### PayPal cookie 预设

新增：

```txt
LANG=en_US%3BUS
cookie_check=yes
```

domain：

```txt
.paypal.com
```

### 诊断日志

新增 `[PayPal Locale]` 日志：

- URL 是否被强制改写。
- 最终页面 URL。
- `document.documentElement.lang`
- `navigator.language`
- `navigator.languages`

这些日志用于区分问题来源：

- 浏览器 JS 指纹问题。
- PayPal URL 参数问题。
- PayPal cookie 问题。
- 外部订单 API / PayPal 服务端 session 问题。

本轮关键日志：

```json
{
  "url": "https://www.paypal.com/checkoutweb/signup?...&locale.x=en_US&country.x=US...",
  "htmlLang": "en",
  "navLanguage": "en-US",
  "navLanguages": ["en-US", "en"]
}
```

结论：浏览器 JS 语言、页面 HTML 语言和 PayPal 主页面 URL 已经对齐英文/美国。后续应避免继续扩大强制改写范围。

## Chrome 启动语言

以下入口已加入：

```txt
--lang=en-US
```

涉及文件：

- `index.js`
- `register_openai.js`
- `oauth_login.js`

## 验证结果

执行语法检查：

```txt
node --check lib/california-fingerprint.js
node --check index.js
node --check chatgpt.js
node --check register_openai.js
node --check oauth_login.js
```

均通过。

指纹输出验证：

```json
{
  "region": "San Diego",
  "platform": "Win32",
  "languages": ["en-US", "en"],
  "locale": "en-US",
  "timezone": "America/Los_Angeles",
  "Accept-Language": "en-US,en;q=0.9"
}
```

浏览器内验证：

```json
{
  "language": "en-US",
  "languages": ["en-US", "en"],
  "platform": "Win32",
  "cpu": 8,
  "mem": 8,
  "screen": {
    "w": 1920,
    "h": 1080,
    "aw": 1920,
    "ah": 1032
  },
  "intl": "en-US",
  "tz": "America/Los_Angeles",
  "connection": {
    "effectiveType": "4g",
    "rtt": 100,
    "downlink": 10,
    "saveData": false
  }
}
```

## 后续排查建议

如果 PayPal 仍显示中文：

1. 查看 `[PayPal Locale]` 日志中的 URL 是否已含 `locale.x=en_US`。
2. 查看 `htmlLang` 是否仍为中文。
3. 查看 PayPal cookie `LANG` 是否被服务端改写。
4. 对比外部订单 API 返回的 `openai_payurl` 是否已绑定中文地区。
5. 若 JS 层已全英文但服务端仍中文，应优先判断为订单 session / PayPal 服务端地区来源，而不是浏览器指纹生成中国。

如果 PayPal 页面已显示英文但仍触发验证：

1. 不要继续增加 URL 语言参数。
2. 优先检查代理稳定性、出口 IP 历史、账号状态、订单 session 来源。
3. 保持 `locale.x=en_US` + `country.x=US` 的最小 URL 修正。
4. 避免改写 `c.paypal.com`、`paypalobjects.com`、recaptcha 资源链接。

## 结论

本次修复后，浏览器指纹本身已恢复到美国加州英文 baseline，不会生成中国浏览器指纹。`test_index.js` 与 `test_paypal_page.js` 的差异已定位到订单创建链路：前者会新建订单，后者使用现成 Checkout URL。当前策略已经从“强制所有 PayPal 相关资源英文”收敛为“订单创建 + 浏览器环境 + PayPal 主页面最小地区参数”三层对齐，减少风控资源 URL 被异常改写的风险。
