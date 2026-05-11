# AccessDeactivated 功能重构方案

## 背景

原有的 `syncAccessDeactivatedProductStatuses` 功能依赖远程 API `https://imap.chiyiyi.cloud/api/admin/access-deactivated-messages`，由于认证问题（缺少 `IMAP_ADMIN_PASSWORD`）导致 401 错误。

## 重构目标

将自动扫描+自动封禁改为：**用户主动查看+手动封禁**

## 实现方案

### 1. 删除的代码

在 `server.js` 中删除：

- [x] 常量 `ACCESS_DEACTIVATED_MESSAGES_URL` (第 23 行)
- [x] 常量 `ACCESS_DEACTIVATED_SYNC_KEY` (第 24 行)
- [x] 常量 `ACCESS_DEACTIVATED_SYNC_COOLDOWN_MS` (第 25 行)
- [x] 变量 `accessDeactivatedSyncPromise` (第 78 行)
- [x] 变量 `accessDeactivatedLastSyncAt` (第 79 行)
- [x] 变量 `accessDeactivatedSyncTimer` (第 80 行)
- [x] 函数 `collectMessageEmails` (第 173-192 行)
- [x] 函数 `syncAccessDeactivatedProductStatuses` (第 194-302 行)
- [x] 函数 `scheduleAccessDeactivatedSync` (第 304-319 行)
- [x] 所有调用 `syncAccessDeactivatedProductStatuses()` 的地方
- [x] 所有调用 `scheduleAccessDeactivatedSync()` 的地方

### 2. 新增的代码

#### 2.1 在 `pool-email-imap.js` 中新增函数

```javascript
/**
 * 获取最新的 OpenAI 账户封禁邮件
 * @param {Object} options
 * @param {number} options.limit - 返回邮件数量，默认 5
 * @returns {Promise<Array>} 邮件列表
 */
async function fetchAccessDeactivatedEmails({ limit = 5 } = {}) {
    // 1. 获取 IMAP 认证 token
    // 2. 连接 IMAP
    // 3. 扫描 INBOX 最新邮件
    // 4. 筛选条件：
    //    - 发件人包含 openai.com
    //    - 正文包含 "deactivate"（不区分大小写）
    // 5. 返回邮件列表：{ subject, from, to, date, bodyPreview }
}
```

#### 2.2 在 `server.js` 中新增 API

```javascript
/**
 * GET /api/admin/access-deactivated-emails
 * 获取最新的 OpenAI 账户封禁邮件列表
 * 
 * 响应格式：
 * {
 *   "success": true,
 *   "emails": [
 *     {
 *       "subject": "Your access has been deactivated",
 *       "from": "noreply@tm.openai.com",
 *       "to": "user@example.com",
 *       "date": "2026-05-11T08:27:54.000Z",
 *       "bodyPreview": "Your access to ChatGPT has been deactivated..."
 *     }
 *   ]
 * }
 */
app.get('/api/admin/access-deactivated-emails', async (req, res) => {
    // 调用 fetchAccessDeactivatedEmails
    // 返回邮件列表
});
```

### 3. 邮件识别规则

| 条件 | 规则 |
|------|------|
| 发件人 | 包含 `openai.com` |
| 正文 | 包含 `deactivate`（不区分大小写） |
| 数量 | 最新 5 封 |

### 4. 用户使用流程

1. 用户访问管理后台
2. 点击"检查封禁邮件"按钮
3. 系统调用 `GET /api/admin/access-deactivated-emails`
4. 显示邮件列表
5. 用户查看邮件内容，确认是封禁通知
6. 用户手动点击"封禁"按钮，调用现有的 `PUT /api/admin/products/:id/status` 接口

### 5. 执行步骤

- [x] **Step 1**: 在 `pool-email-imap.js` 中实现 `fetchAccessDeactivatedEmails` 函数
- [x] **Step 2**: 在 `server.js` 中删除旧的自动扫描相关代码
- [x] **Step 3**: 在 `server.js` 中新增 `/api/admin/access-deactivated-emails` 接口
- [x] **Step 4**: 语法检查通过

## 风险评估

- **低风险**：删除自动扫描不会影响核心业务
- **用户体验**：需要用户手动检查，但更可控、更准确
- **回滚方案**：如需恢复自动扫描，可从 git 历史恢复代码
