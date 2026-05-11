# Apple Pay 云端测试方案

## 背景与目标

**目标**：测试网站是否能正确弹出 Apple Pay 支付选项

**限制**：Apple Pay 绑卡和实际支付需要真机（Secure Enclave 硬件验证），云端环境只能测试「弹出 Apple Pay 界面」这一步。

---

## 方案对比

| 方案 | 月成本 | 能做什么 | 不能做什么 | 推荐场景 |
|------|--------|----------|------------|----------|
| **云端 Mac + iOS 模拟器** | ¥200-800/月 | 弹出 Apple Pay 选项、UI 流程测试 | 绑卡、实际支付 | 验证网站集成是否正确 |
| **云手机（iOS）** | ¥100-300/月 | 弹出 Apple Pay、部分 UI 测试 | 绑卡、实际支付 | 轻量级测试 |
| **真机（二手 iPhone）** | 一次性 ¥500-1500 | 完整流程：弹出、绑卡、支付 | 无 | 完整支付流程测试 |

---

## 方案一：云端 Mac + iOS 模拟器（推荐）

### 服务商选择

| 服务商 | 价格 | 特点 | 链接 |
|--------|------|------|------|
| **MacStadium** | $79/月起 | 稳定、专业、支持 M1/M2 | https://www.macstadium.com |
| **AWS EC2 Mac** | ~$1.08/小时 | 按需付费、适合短期测试 | https://aws.amazon.com/ec2/instance-types/mac |
| **MacinCloud** | $20/月起 | 便宜、适合轻度使用 | https://www.macincloud.com |
| **Scaleway** | €0.10/小时 | 欧洲服务商、按小时计费 | https://www.scaleway.com/en/hello-m1 |

### 环境搭建步骤

```bash
# 1. 连接到云端 Mac 后，安装 Xcode Command Line Tools
xcode-select --install

# 2. 安装 Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 3. 安装 Node.js
brew install node

# 4. 安装 Appium（用于自动化控制 iOS 模拟器）
npm install -g appium
appium driver install xcuitest

# 5. 启动 iOS 模拟器
open -a Simulator

# 6. 或通过命令行指定设备
xcrun simctl boot "iPhone 15 Pro"
```

### 自动化测试框架

```javascript
// 使用 WebDriverIO + Appium 控制 iOS 模拟器中的 Safari
const { remote } = require('webdriverio');

const capabilities = {
    platformName: 'iOS',
    'appium:deviceName': 'iPhone 15 Pro',
    'appium:platformVersion': '17.0',
    'appium:browserName': 'Safari',
    'appium:automationName': 'XCUITest'
};

async function testApplePayPopup() {
    const driver = await remote({
        hostname: 'localhost',
        port: 4723,
        capabilities
    });

    // 访问支持 Apple Pay 的测试页面
    await driver.url('https://your-test-site.com/checkout');
    
    // 点击 Apple Pay 按钮
    const applePayButton = await driver.$('#apple-pay-button');
    await applePayButton.click();
    
    // 验证 Apple Pay 弹窗是否出现
    // 注意：模拟器中会弹出但无法完成支付
    
    await driver.deleteSession();
}
```

### 优缺点

**优点**：
- 真实的 iOS Safari 环境
- 可以验证 Apple Pay API 调用是否正确
- 支持自动化测试

**缺点**：
- 无法完成绑卡和支付
- 需要 macOS 环境
- 成本较高

---

## 方案二：云手机服务

### 服务商选择

| 服务商 | 类型 | 价格 | Apple Pay 支持 | 链接 |
|--------|------|------|----------------|------|
| **AWS Device Farm** | 真机云测试 | $0.17/分钟 | ⚠️ 有限 | https://aws.amazon.com/device-farm |
| **BrowserStack** | 真机云测试 | $29/月起 | ⚠️ 仅 UI | https://www.browserstack.com |
| **Sauce Labs** | 真机/模拟器 | 联系销售 | ⚠️ 仅 UI | https://saucelabs.com |
| **LambdaTest** | 真机云测试 | $15/月起 | ⚠️ 仅 UI | https://www.lambdatest.com |

> ⚠️ 注意：所有云手机服务都**无法完成 Apple Pay 绑卡和支付**，只能测试 UI 弹出。

### 使用示例（BrowserStack）

```javascript
const { remote } = require('webdriverio');

const capabilities = {
    'bstack:options': {
        deviceName: 'iPhone 15 Pro',
        osVersion: '17',
        realMobile: true,
        userName: 'YOUR_USERNAME',
        accessKey: 'YOUR_ACCESS_KEY'
    },
    browserName: 'Safari'
};

async function testOnBrowserStack() {
    const driver = await remote({
        hostname: 'hub.browserstack.com',
        capabilities
    });

    await driver.url('https://your-test-site.com/checkout');
    // ... 测试逻辑
    
    await driver.deleteSession();
}
```

---

## 方案三：购买真机（完整测试）

如果需要测试**完整的 Apple Pay 流程**（绑卡 + 支付），必须使用真机。

### 推荐设备

| 设备 | 二手价格 | 支持 Apple Pay | 推荐度 |
|------|----------|----------------|--------|
| iPhone SE 2 (2020) | ¥500-800 | ✅ | ⭐⭐⭐ 性价比最高 |
| iPhone 8 | ¥400-600 | ✅ | ⭐⭐ 够用 |
| iPhone XR | ¥800-1200 | ✅ | ⭐⭐⭐ 屏幕大 |
| iPhone 11 | ¥1200-1800 | ✅ | ⭐⭐⭐⭐ 长期使用 |

### 真机自动化方案

```bash
# 使用 Appium + 真机
# 需要：Mac + iPhone + USB 连接 + Apple Developer 账号

# 1. 获取设备 UDID
xcrun xctrace list devices

# 2. 配置 Appium capabilities
```

```javascript
const capabilities = {
    platformName: 'iOS',
    'appium:deviceName': 'iPhone',
    'appium:udid': 'YOUR_DEVICE_UDID',  // 真机 UDID
    'appium:browserName': 'Safari',
    'appium:automationName': 'XCUITest',
    'appium:xcodeOrgId': 'YOUR_TEAM_ID',  // Apple Developer Team ID
    'appium:xcodeSigningId': 'iPhone Developer'
};
```

---

## 成本对比总结

| 方案 | 初期成本 | 月度成本 | 能测试的范围 |
|------|----------|----------|--------------|
| 云端 Mac (MacinCloud) | $0 | $20-50 | Apple Pay 弹出 |
| 云端 Mac (MacStadium) | $0 | $79-150 | Apple Pay 弹出 |
| AWS EC2 Mac (按需) | $0 | ~$100-200 | Apple Pay 弹出 |
| BrowserStack | $0 | $29起 | Apple Pay 弹出 |
| 二手 iPhone + Mac mini | ¥3500-5000 | ¥0 | **完整流程** |

---

## 建议决策路径

```
                    ┌─────────────────────────────────────┐
                    │  你需要测试什么？                    │
                    └─────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
        ┌─────────────────────┐         ┌─────────────────────┐
        │ 只验证 Apple Pay    │         │ 完整支付流程        │
        │ 能否弹出            │         │ (绑卡+支付)         │
        └─────────────────────┘         └─────────────────────┘
                    │                               │
                    ▼                               ▼
        ┌─────────────────────┐         ┌─────────────────────┐
        │ 方案一或方案二       │         │ 方案三：买真机       │
        │ 云端 Mac / 云手机   │         │ iPhone + Mac        │
        │ 月费 $20-150        │         │ 一次性 ¥3500-5000   │
        └─────────────────────┘         └─────────────────────┘
```

---

## 快速启动建议

**如果只是验证 Apple Pay 弹出**：
1. 注册 [MacinCloud](https://www.macincloud.com) 账号（最便宜）
2. 连接后安装 Xcode、启动 iOS 模拟器
3. 在模拟器 Safari 中访问目标网站测试

**如果需要完整测试**：
1. 购买二手 iPhone SE 2（约 ¥600）
2. 购买二手 Mac mini M1（约 ¥3000）
3. 使用 Appium 进行自动化测试

---

## 附录：Apple Pay 测试卡号

Apple 提供的 Sandbox 测试卡（需要 Apple Developer 账号）：

| 卡组织 | 测试卡号 | 用途 |
|--------|----------|------|
| Visa | 4761 1200 1000 0492 | 成功支付 |
| Mastercard | 5204 2477 5000 1471 | 成功支付 |
| Amex | 3499 569590 41362 | 成功支付 |

> 注意：测试卡只能在 Apple Pay Sandbox 环境使用，需要开发者账号配置。

---

## 联系与资源

- Apple Pay 开发文档：https://developer.apple.com/apple-pay/
- Appium 官方文档：https://appium.io/docs/en/latest/
- WebDriverIO 文档：https://webdriver.io/docs/api
