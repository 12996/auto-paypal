# 修复 mail.chatai.codes API 邮件内容字段问题

## 问题描述

用户反馈邮箱取件逻辑有问题，MS-IMAP 一直显示"暂未读取到符合条件的新验证码，继续轮询..."，但实际上邮件已经收到，验证码在邮件内容中。

通过分析用户提供的邮件数据发现：
- 验证码 `844886` 确实存在于邮件正文中
- `mail.chatai.codes` API 返回的邮件对象中，正文内容字段名为 `bodyText`
- 但代码中获取正文内容时使用的是 `item.body || item.text || item.content`，缺少了 `bodyText` 字段

## 解决方案

修改 `pool-email-imap.js` 中 `fetchLatestOpenAiOtpOnce` 函数的邮件内容获取逻辑：

**修改前：**
```javascript
const bodyText = item.body || item.text || item.content || '';
```

**修改后：**
```javascript
const bodyText = item.bodyText || item.body || item.text || item.content || '';
```

## 修改的文件

- `pool-email-imap.js` (第228行)

## 测试方法

1. 使用配置了 `mail.chatai.codes` 作为 IMAP 主机的邮箱
2. 触发 OpenAI 验证码发送
3. 验证系统能够正确提取邮件正文中的6位验证码

## 影响范围

- 仅影响使用 `mail.chatai.codes` API 的邮箱取件功能
- 直接 IMAP 连接的邮箱不受影响
- 临时邮箱系统不受影响

## 相关邮件数据格式

`mail.chatai.codes` API 返回的邮件对象包含以下字段：
- `subject`: 邮件主题
- `bodyText`: 邮件纯文本内容（关键字段）
- `bodyHtml`: 邮件HTML内容
- `from`: 发件人
- `date`: 接收时间
- `id`: 邮件ID