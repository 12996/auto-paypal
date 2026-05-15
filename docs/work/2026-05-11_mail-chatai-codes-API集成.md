# mail.chatai.codes API 集成

**日期**: 2026-05-11

## 问题描述

用户配置 IMAP 主机为 `https://mail.chatai.codes/` 后，邮件预览功能报错：
```
getaddrinfo ENOTFOUND https://mail.chatai.codes/
```

原因：
1. IMAP 主机配置包含了 `https://` 前缀，但 IMAP 协议只需要纯主机名
2. `mail.chatai.codes` 不是标准 IMAP 服务器，而是提供 HTTP API 的邮件代理服务

## 解决方案

修改 `pool-email-imap.js`，添加对 `mail.chatai.codes` API 的支持：

### 1. 添加主机名清理函数

```javascript
function normalizeImapHost(raw) {
    let h = String(raw || '').trim();
    h = h.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    return h || 'outlook.office365.com';
}
```

### 2. 添加 mail.chatai.codes 检测和 API 调用

```javascript
function isChataiCodesHost(host) {
    const h = normalizeImapHost(host);
    return /mail\.chatai\.codes/i.test(h);
}

async function fetchViaChataiCodesApi({ email, clientId, refreshToken, keyword = '', sender = '', limit = 50 }) {
    const resp = await axios.post('https://mail.chatai.codes/api/fetch-imap', {
        email, clientId, refreshToken, keyword, sender, limit
    }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
        validateStatus: () => true
    });
    // ...
}
```

### 3. 修改 listRecentEmailsForAdmin 和 fetchLatestOpenAiOtpOnce

两个函数都添加了判断逻辑：
- 如果主机是 `mail.chatai.codes`，调用其 HTTP API
- 否则使用原有的直接 IMAP 连接

## 修改的文件

- `pool-email-imap.js`
  - 添加 `normalizeImapHost()` - 清理主机名前缀和尾部斜杠
  - 添加 `isChataiCodesHost()` - 检测是否为 mail.chatai.codes
  - 添加 `fetchViaChataiCodesApi()` - 调用 mail.chatai.codes API
  - 修改 `listRecentEmailsForAdmin()` - 支持 API 路径
  - 修改 `fetchLatestOpenAiOtpOnce()` - 支持 API 路径

## mail.chatai.codes API 格式

**端点**: `POST https://mail.chatai.codes/api/fetch-imap`

**请求体**:
```json
{
  "email": "xxx@outlook.com",
  "clientId": "9e5f94bc-e8a4-4e73-b8be-...",
  "refreshToken": "M.C505_SN1.0.U.-Ciux...",
  "keyword": "",
  "sender": "",
  "limit": 10
}
```

## 使用方法

1. 在管理面板的 **IMAP 主机** 字段填入 `mail.chatai.codes`（可带或不带 https:// 前缀）
2. 导入邮箱时确保包含正确的 `clientId` 和 `refreshToken`
3. 邮箱格式：`email----password----clientId----refreshToken`

## 测试结果

配置完成后，邮件预览功能正常工作，可以成功获取邮箱信息。
