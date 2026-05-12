# 页面自动化调试机制：HTML 快照捕获

## 功能概述

在 Playwright 自动化流程出错时，自动保存当前页面的完整 HTML 快照，便于离线分析 DOM 结构、定位选择器问题。

## 核心思路

**问题**：自动化脚本在 PayPal/Stripe 等支付页面失败时，仅靠截图难以分析 DOM 结构，无法确定正确的选择器。

**方案**：截图保存时同步保存 HTML，注入调试工具函数，本地浏览器打开即可交互式分析。

## 实现细节

### 1. 触发时机

HTML 保存集成在 `captureDebugScreenshot()` 函数中，任何调用截图的地方都会同时保存 HTML：

```javascript
// index.js - captureDebugScreenshot 函数
async function captureDebugScreenshot(context, preferredPage, prefix, label = '异常截图') {
    // ... 保存截图 ...
    
    // 同时保存 HTML（与截图放一起，便于离线分析 DOM）
    try {
        await debug.saveOnError(targetPage, prefix);
    } catch (_) { /* 静默 */ }
    
    return screenshotPath;
}
```

### 2. 保存位置

- 目录：`debug_html/`
- 文件名格式：`{时间戳}_{步骤名}.html`
- 示例：`2024-01-15T10-30-45_paypal_email.html`

### 3. 去重机制

同一个 URL + 步骤名组合只保存一次，避免循环重试时产生大量重复文件：

```javascript
const urlKey = `${stepName}:${url}`;
if (savedUrls.has(urlKey)) {
    return null; // 已保存过，跳过
}
savedUrls.add(urlKey);
```

### 4. 注入的调试工具

保存的 HTML 会自动注入以下调试函数，浏览器打开后可在控制台直接调用：

| 函数 | 用途 |
|------|------|
| `findEmail()` | 高亮所有可能的邮箱输入框 |
| `highlightInputs()` | 高亮所有 input、button 元素 |
| `find(selector)` | 测试选择器，找到则高亮并滚动到可见区域 |
| `listAll()` | 列出页面所有交互元素（input/button/a/select） |

### 5. 使用示例

```javascript
// 浏览器控制台
listAll()           // 查看所有可交互元素
find('#cardNumber') // 测试选择器是否有效
highlightInputs()   // 高亮所有输入框和按钮
```

## 文件结构

```
project/
├── index.js                    # 主流程，captureDebugScreenshot 集成 HTML 保存
├── test/
│   └── debug_helper.js         # HTML 保存核心逻辑
├── debug_html/                 # HTML 快照保存目录（自动创建）
│   ├── 2024-01-15T10-30-45_error.html
│   └── 2024-01-15T10-31-20_paypal_email.html
└── docs/
    └── debug-html-capture.md   # 本文档
```

## 设计决策

1. **无条件保存**：去掉了 `DEBUG_MODE` 环境变量限制，出错时始终保存 HTML。理由：HTML 文件体积小，保存开销可忽略，调试价值高。

2. **与截图绑定**：HTML 保存集成在截图函数中，而非分散在各个 catch 块。理由：统一入口，维护简单，不会遗漏。

3. **注入调试脚本**：HTML 中嵌入调试函数。理由：省去每次手动输入选择器测试代码的麻烦。

## 相关文件

- `test/debug_helper.js` - HTML 保存模块
- `index.js` - `captureDebugScreenshot()` 函数（约第 98 行）
