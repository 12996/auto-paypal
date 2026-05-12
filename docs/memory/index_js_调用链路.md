# index.js 功能调用链路分析

## 主要入口函数

### `run()` - 主流程入口 (第155行)
整个支付自动化的核心函数，包含完整的支付流程。

## 支付流程步骤分解

### 1. 初始化阶段
- **浏览器启动**: 配置代理、反检测、Canvas指纹等
- **页面加载**: 打开 Stripe Checkout 页面
- **金额校验**: 验证是否为0元订单

### 2. Stripe Checkout 表单填写
- **地址填写** (第1202行): 填写街道地址，处理地址自动完成
- **姓名填写** (第1447行): 填写账单姓名
- **邮编城市填写** (`fillZipAndCity`函数, 第1570行): 动态等待并填写邮编/城市
- **协议勾选** (第1665行): 勾选服务条款
- **提交表单** (第1673行): 点击提交按钮跳转到PayPal

### 3. PayPal 流程处理
- **等待跳转** (第2067行): 等待跳转到PayPal页面
- **创建账户按钮** (第2071行): 等待并点击"Create an Account"
- **📍 邮箱输入** (第2110行): **当前问题位置** - 填写PayPal登录邮箱
- **支付信息填写** (第2139行): 填写银行卡和身份信息
- **地址处理** (第2220行): 输入地址并处理联想下拉
- **密码设置** (第2332行): 设置PayPal账户密码
- **协议提交** (第2381行): 提交创建账户协议
- **短信验证** (第2386行): 处理可能的短信验证
- **最终确认** (第2407行): 点击最终确认按钮

### 4. 结果检测
- **支付结果监测** (第2419行): 检测支付成功/失败状态
- **流程结束** (第2490行): 关闭浏览器

## 关键函数定位

### 工具函数
- `humanFillInput()` (第972行): 人性化输入模拟
- `humanTypeWithSoul()` (第935行): 带灵魂的打字模拟
- `continuousHumanRoam()` (第890行): 连续人性化漫游
- `mouseBreathing()` (第877行): 鼠标呼吸效果

### 调试函数
- `captureDebugScreenshot()` (第98行): 调试截图
- `isConnectionClosedPage()` (第117行): 检测连接关闭
- `recoverConnectionClosed()` (第130行): 恢复连接

## 当前问题定位

### PayPal 邮箱输入问题 (第2114行) - ✅ 已解决
```javascript
const emailInput = page.getByRole('textbox', { name: 'Enter email' });
```

**解决方案**: 使用 `getByRole('textbox', { name: 'Enter email' })` 替代 `#login_email`
**按钮选择器**: `getByRole('button', { name: 'Continue to Payment' })` (已正确)
**调试工具**: `test/test_paypal_email.js` + Playwright Inspector

### 可能的替代选择器
- `#email`
- `input[type="email"]`
- `input[name="email"]`
- `input[name="login_email"]`
- `input[placeholder*="email"]`
- `input[id*="email"]`
- `input[class*="email"]`

## 调试策略

1. **使用测试文件**: `node test/test_paypal_email.js`
2. **高亮元素**: 自动高亮所有可能的邮箱输入框
3. **交互式调试**: 手动输入正确选择器进行验证
4. **更新代码**: 确认正确选择器后更新第2114行

## 相关文件

- **主文件**: `index.js`
- **调试页面**: `debug_html/2026-05-12T04-59-07_error.html`
- **测试工具**: `test/test_paypal_email.js`
- **调试助手**: `test/debug_helper.js`