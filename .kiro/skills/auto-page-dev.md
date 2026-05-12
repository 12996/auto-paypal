# auto-page-dev

编写 Playwright 页面自动化代码的开发规范。

## 开发流程

1. **单页面开发** - 每个页面单独写一个函数，先跑通单页面
2. **出错保存 HTML** - 页面操作失败时调用 `debug.saveOnError(page, '步骤名')`
3. **离线调试** - 用 `test_debug_html.js` 打开保存的 HTML 找选择器
4. **整合流程** - 所有页面跑通后再串联完整流程

## 代码规范

### 每个页面操作函数必须：

```javascript
const debug = require('./test/debug_helper');

async function handlePaypalEmail(page, email) {
    try {
        await page.locator('#login_email').fill(email);
        await page.locator('#btnNext').click();
    } catch (e) {
        await debug.saveOnError(page, 'paypal_email');
        throw e;
    }
}
```

### 函数命名：`handle{平台}{步骤}`

- `handlePaypalEmail` - PayPal 邮箱页
- `handlePaypalPassword` - PayPal 密码页
- `handleStripeCard` - Stripe 卡片页

### 步骤名命名：`{平台}_{步骤}`

- `paypal_email`
- `paypal_password`
- `stripe_card`

## 测试命令

```powershell
# 启用调试模式
$env:DEBUG_MODE = "1"

# 单页面测试
node test/test_paypal_email.js

# 调试保存的 HTML
node test/test_debug_html.js
```

## 文件结构

```
test/
  debug_helper.js      # 调试工具模块
  test_debug_html.js   # HTML 调试器
  test_paypal_email.js # 单页面测试
  test_paypal_pwd.js   # 单页面测试
debug_html/            # 保存的 HTML 文件
```
