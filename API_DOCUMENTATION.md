# Email Plus GoPay API 文档

## 概述

这是一个基于 Node.js + Express 的邮件验证和支付激活系统的完整API文档。系统支持自助激活、成品号管理、邮箱池管理等功能。

## 服务器信息

- **端口**: 3000 (可通过环境变量 `PORT` 配置)
- **数据库**: MySQL
- **WebSocket**: 支持实时任务状态推送

## 认证方式

### 管理员认证
- **方式**: Bearer Token 或 Query Parameter
- **获取**: POST `/api/admin/login`
- **使用**: 
  - Header: `Authorization: Bearer <token>`
  - Query: `?token=<token>`

### AccessToken 验证
- **用途**: 自助激活流程
- **格式**: JWT (RS256, OpenAI 签发)

---

## API 端点

### 1. 公共端点

#### 1.1 运行时状态
```http
GET /api/public/runtime
```
**响应**:
```json
{
  "success": true,
  "runtime": {
    "active_foreground_jobs": 2,
    "max_foreground_jobs": 5
  }
}
```

#### 1.2 CDK 验证
```http
POST /api/verify-cdk
```
**请求体**:
```json
{
  "cdk": "ABCD1234EFGH"
}
```
**响应**:
```json
{
  "success": true,
  "data": {
    "type": "自助",
    "status": "processing",
    "jobKey": "job_123456",
    "message": "当前 CDK 正在开通中"
  }
}
```

#### 1.3 CDK 查询
```http
GET /api/cdk/query?cdk=ABCD1234EFGH
```
**响应**:
```json
{
  "success": true,
  "data": {
    "status": "已使用",
    "type": "成品",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "usedAt": "2024-01-01 12:00:00",
    "downloadAvailable": true,
    "downloadFileName": "example@gmail.com.json",
    "sub2apiAvailable": true,
    "cpaAvailable": true
  }
}
```

#### 1.4 文件下载
```http
GET /api/cdk/download?cdk=ABCD1234EFGH&kind=sub2api
GET /api/cdk/download?cdk=ABCD1234EFGH&kind=cpa
```

#### 1.5 自助激活
```http
POST /api/run-process
```
**请求体**:
```json
{
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...",
  "cdk": "ABCD1234EFGH"
}
```
**响应**:
```json
{
  "success": true,
  "jobKey": "job_123456",
  "message": "任务已启动，正在为您开通中..."
}
```

#### 1.6 成品号兑换
```http
POST /api/redeem-product
```
**请求体**:
```json
{
  "cdk": "ABCD1234EFGH"
}
```
**响应**:
```json
{
  "success": true,
  "message": "成品号创建任务已启动",
  "jobKey": "job_123456"
}
```

---

### 2. 管理员端点

所有管理员端点都需要认证，路径前缀为 `/api/admin`。

#### 2.1 认证管理

##### 登录
```http
POST /api/admin/login
```
**请求体**:
```json
{
  "password": "admin_password"
}
```
**响应**:
```json
{
  "success": true,
  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "expiresAt": 1704067200000,
  "issuedAt": 1704063600000,
  "permissions": ["admin"]
}
```

##### 会话状态
```http
GET /api/admin/session
```
**响应**:
```json
{
  "success": true,
  "refreshed": true,
  "token": "new_token_if_refreshed",
  "expiresAt": 1704067200000,
  "issuedAt": 1704063600000,
  "permissions": ["admin"]
}
```

##### 修改密码
```http
POST /api/admin/change-password
```
**请求体**:
```json
{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

#### 2.2 系统数据

##### 获取管理数据
```http
GET /api/admin/data
```
**响应**:
```json
{
  "success": true,
  "config": {
    "maintenance_mode": false,
    "max_concurrent_activations": 5,
    "max_background_concurrent": 3
  },
  "stats": {
    "total_cdks": 100,
    "used_cdks": 25,
    "total_products": 50,
    "shipped_products": 20
  },
  "runtime": {
    "active_activation_jobs": 2,
    "active_background_jobs": 1,
    "active_foreground_jobs": 1,
    "system": {
      "cpu": { "percent": 15, "text": "15%" },
      "memory": { "percent": 45, "text": "2.1G/4.0G" },
      "disk": { "percent": 60, "usedText": "120.5G", "totalText": "200.0G" },
      "uptime": { "seconds": 3600, "text": "1时 0分 0秒" }
    }
  }
}
```

##### 保存配置
```http
POST /api/admin/config
```
**请求体**:
```json
{
  "maintenance_mode": false,
  "max_concurrent_activations": 5,
  "max_background_concurrent": 3,
  "phone_pool": [
    { "phone": "1234567890", "key": "api_key", "is_active": 1 }
  ],
  "card_pool": [
    { "number": "4111111111111111", "expiry": "12/25", "cvc": "123", "is_active": 1 }
  ],
  "proxy_pool": ["http://proxy1:8080", "socks5://proxy2:1080"]
}
```

#### 2.3 CDK 管理

##### 列出 CDK
```http
GET /api/admin/cdks
```
**响应**:
```json
{
  "success": true,
  "cdks": [
    {
      "cdk": "ABCD1234EFGH",
      "type": "自助",
      "status": "未使用",
      "created_at": "2024-01-01T00:00:00.000Z",
      "used_at": null,
      "shipped_at": null
    }
  ]
}
```

##### 生成 CDK
```http
POST /api/admin/cdks/generate
```
**请求体**:
```json
{
  "count": 10,
  "type": "自助"
}
```
**响应**:
```json
{
  "success": true,
  "message": "成功生成 10 个 自助 CDK (数据库写入: 10)",
  "cdks": ["ABCD1234EFGH", "IJKL5678MNOP"],
  "insertedCount": 10
}
```

##### 导入 CDK
```http
POST /api/admin/cdks/import
```
**请求体**:
```json
{
  "cdks": ["ABCD1234EFGH", "IJKL5678MNOP"]
}
```

##### 标记 CDK 出库
```http
POST /api/admin/cdks/{cdk}/ship
```

##### 删除 CDK
```http
DELETE /api/admin/cdks/{cdk}
```

#### 2.4 成品号管理

##### 列出成品号
```http
GET /api/admin/products
```
**响应**:
```json
{
  "success": true,
  "products": [
    {
      "id": 1,
      "email": "example@gmail.com",
      "status": "正常",
      "file_path": "product_files/sub2api/example@gmail.com.json",
      "created_at": "2024-01-01T00:00:00.000Z",
      "shipped": 0,
      "claimed_cdk": null,
      "imap_key": "imap_key_123"
    }
  ]
}
```

##### 生成成品号
```http
POST /api/admin/products/generate
```
**请求体**:
```json
{
  "count": 5
}
```
**响应**:
```json
{
  "success": true,
  "jobKey": "job_123456",
  "workerCount": 3,
  "message": "后台成品生产任务已启动，并发上限 3"
}
```

##### 继续生产
```http
POST /api/admin/products/resume
```

##### 停止生产
```http
POST /api/admin/products/generate-stop
```
**请求体**:
```json
{
  "jobKey": "job_123456"
}
```

##### 批量导出成品号
```http
POST /api/admin/products/export
```
**请求体**:
```json
{
  "ids": [1, 2, 3]
}
```
**响应**: 文件下载

##### 单个成品号导出
```http
GET /api/admin/products/{id}/export
```
**响应**: 文件下载

##### 删除成品号
```http
DELETE /api/admin/products/{id}
```

##### 更新成品号状态
```http
PUT /api/admin/products/{id}/status
```
**请求体**:
```json
{
  "status": "封禁"
}
```

#### 2.5 邮箱池管理

##### 列出邮箱池
```http
GET /api/admin/pool-emails
```
**响应**:
```json
{
  "success": true,
  "items": [
    {
      "id": 1,
      "email": "pool@example.com",
      "password": "encrypted_password",
      "client_id": "oauth_client_id",
      "refresh_token": "oauth_refresh_token",
      "is_active": 1,
      "in_use": 0,
      "success_count": 5,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

##### 导入邮箱
```http
POST /api/admin/pool-emails/import
```
**请求体**:
```json
{
  "text": "email1@example.com:password1\nemail2@example.com:password2"
}
```

##### 删除邮箱
```http
DELETE /api/admin/pool-emails/{id}
```

##### 查看邮箱消息
```http
GET /api/admin/pool-emails/{id}/messages?limit=40
```
**响应**:
```json
{
  "success": true,
  "messages": [
    {
      "folder": "INBOX",
      "uid": 12345,
      "subject": "Welcome to OpenAI",
      "from": "noreply@openai.com",
      "date": "2024-01-01T12:00:00.000Z"
    }
  ]
}
```

#### 2.6 Access Deactivated 邮件

##### 获取封禁邮件
```http
GET /api/admin/access-deactivated-emails
```
**响应**:
```json
{
  "success": true,
  "emails": [
    {
      "subject": "Your OpenAI account has been deactivated",
      "from": "noreply@openai.com",
      "to": "user@example.com",
      "date": "2024-01-01T12:00:00.000Z",
      "bodyPreview": "We're writing to inform you that your OpenAI account has been deactivated..."
    }
  ]
}
```

#### 2.7 任务管理

##### 删除任务日志
```http
DELETE /api/admin/task-logs/{jobKey}
```

#### 2.8 运行日志

##### 获取运行日志
```http
GET /api/admin/runtime-logs?tail=1&limit=500&after=0
```
**响应**:
```json
{
  "success": true,
  "entries": [
    {
      "id": 1,
      "jobKey": "job_123456",
      "level": "log",
      "source": "task",
      "text": "任务已创建，CDK=ABCD1234EFGH",
      "timestamp": "2024-01-01T12:00:00.000Z"
    }
  ],
  "nextAfter": 1
}
```

##### 清空运行日志
```http
POST /api/admin/runtime-logs/clear
```

#### 2.9 代理测试

##### 批量测试代理
```http
POST /api/admin/proxy/test
```
**请求体**:
```json
{
  "proxies": [
    "http://proxy1:8080",
    "socks5://user:pass@proxy2:1080"
  ]
}
```
**响应**:
```json
{
  "success": true,
  "results": [
    {
      "ok": true,
      "ip": "1.2.3.4",
      "latencyMs": 150,
      "probedVia": "https://api.ipify.org/?format=text"
    },
    {
      "ok": false,
      "error": "ECONNREFUSED",
      "latencyMs": 5000
    }
  ]
}
```

---

### 3. 文件下载端点

#### 3.1 Sub2API 文件下载
```http
GET /api/download-sub2api/{filename}
```

#### 3.2 CPA 文件下载
```http
GET /api/download-cpa/{filename}
```

---

## WebSocket 连接

### 连接地址
```
ws://localhost:3000
```

### 消息格式

#### 订阅任务状态
```json
{
  "type": "subscribe",
  "jobKey": "job_123456"
}
```

#### 心跳检测
```json
{
  "type": "ping",
  "ts": 1704063600000
}
```

#### 服务器推送消息

##### 任务快照
```json
{
  "type": "snapshot",
  "jobKey": "job_123456",
  "status": "running",
  "message": "正在开通中",
  "progress": 45,
  "cdkCode": "ABCD1234EFGH",
  "phone": "1234567890",
  "cardLast4": "1111",
  "isTerminal": false
}
```

##### 进度更新
```json
{
  "type": "progress",
  "jobKey": "job_123456",
  "progress": 60,
  "status": "running",
  "message": "正在填写 PayPal 登录邮箱",
  "phone": "1234567890",
  "cardLast4": "1111"
}
```

##### 状态变更
```json
{
  "type": "status",
  "jobKey": "job_123456",
  "status": "success",
  "message": "激活成功",
  "progress": 100
}
```

---

## 错误处理

### 标准错误响应格式
```json
{
  "success": false,
  "message": "错误描述",
  "code": "ERROR_CODE"
}
```

### 常见错误码

| HTTP状态码 | 错误类型 | 描述 |
|-----------|---------|------|
| 400 | Bad Request | 请求参数错误 |
| 401 | Unauthorized | 未授权或token过期 |
| 403 | Forbidden | 权限不足或资源不可用 |
| 404 | Not Found | 资源不存在 |
| 429 | Too Many Requests | 请求过于频繁 |
| 500 | Internal Server Error | 服务器内部错误 |
| 503 | Service Unavailable | 服务维护中 |

---

## 环境变量配置

### 数据库配置
```bash
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=gpt
DB_USER=root
DB_PASSWORD=your_password
DB_POOL_LIMIT=60
```

### 服务配置
```bash
PORT=3000
ADMIN_PASSWORD=admin
JSON_BODY_LIMIT=15mb
```

### IMAP 配置
```bash
# 第三方 IMAP 服务
IMAP_ADMIN_PASSWORD=your_imap_password

# 微软官方 IMAP (可选)
MICROSOFT_IMAP_EMAIL=your_email@outlook.com
MICROSOFT_IMAP_PASSWORD=your_password
MICROSOFT_IMAP_CLIENT_ID=your_client_id
MICROSOFT_IMAP_REFRESH_TOKEN=your_refresh_token

# 邮箱池 IMAP 配置
IMAP_USER=pool_email@example.com
IMAP_CLIENT_ID=oauth_client_id
IMAP_REFRESH_TOKEN=oauth_refresh_token
IMAP_HOST=outlook.office365.com
```

### 其他配置
```bash
ASSET_LOCK_STALE_MS=900000  # 资产锁定超时时间(15分钟)
IS_PRODUCT_FLOW=false       # 是否为成品子流程
```

---

## 数据库表结构

系统使用 MySQL 数据库，主要表包括：

- `cdks` - CDK 管理
- `products` - 成品号管理  
- `task_logs` - 任务日志
- `phone_assets` - 手机号资产池
- `card_assets` - 银行卡资产池
- `pool_emails` - 邮箱池
- `app_config` - 应用配置
- `admin_auth` - 管理员认证
- `activation_attempt_limits` - 激活尝试限制

详细的表结构定义请参考 `mysql-schema.sql` 文件。

---

## 安全注意事项

1. **认证**: 所有管理员端点都需要有效的Bearer Token
2. **权限控制**: 不同类型的CDK有不同的使用权限
3. **频率限制**: 系统内置冷却机制防止滥用
4. **数据加密**: 敏感信息如密码使用scrypt加密存储
5. **输入验证**: 所有用户输入都经过严格验证
6. **SQL注入防护**: 使用参数化查询防止SQL注入

---

## 开发和调试

### 启动服务
```bash
node server.js
```

### 重置数据库
```bash
node reset-db.js
```

### 更新数据库架构
```bash
node update-mysql-schema.js
```

---

## 版本信息

- **API版本**: v1.0
- **最后更新**: 2024-01-01
- **兼容性**: Node.js 16+, MySQL 5.7+

---

*本文档基于代码分析生成，如有疑问请参考源代码或联系开发团队。*