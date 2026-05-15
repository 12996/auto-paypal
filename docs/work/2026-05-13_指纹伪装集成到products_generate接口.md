# 浏览器指纹伪装集成到 products/generate 接口

## 项目信息
- **完成日期**: 2026-05-13
- **功能名称**: CaliforniaFingerprint 集成到完整支付流程
- **开发状态**: ✅ 集成完成

## 需求背景

`POST /api/admin/products/generate` 接口涉及三个关键阶段，每个阶段都需要浏览器指纹伪装来绕过 bot 检测：

| 阶段 | 子进程文件 | 功能 |
|------|-----------|------|
| 注册阶段 | `register_openai.js` | 创建 OpenAI 账号 |
| 激活Plus阶段 | `index.js` | 支付激活 Plus 会员 |
| 协议提取阶段 | `oauth_login.js` | 提取 OAuth 协议 |

**目标**: 在所有阶段使用加州地区指纹伪装，确保指纹配置在各子进程间一致传递。

## 技术方案

### 指纹传递架构

```
product_activator.js (主调度层)
    │
    ├─► 生成指纹配置: CaliforniaFingerprint.generateRandomCaliforniaFingerprint()
    │
    ├─► 环境变量传递: FINGERPRINT_CONFIG=JSON.stringify(fingerprintConfig)
    │
    ├─► fork register_openai.js ──► 解析 FINGERPRINT_CONFIG ──► createCaliforniaContext()
    │
    ├─► fork index.js ──► 解析 FINGERPRINT_CONFIG ──► createCaliforniaContext()
    │
    └─► fork oauth_login.js ──► 解析 FINGERPRINT_CONFIG ──► createCaliforniaContext()
```

### 环境变量传递机制

主调度层在 fork 子进程时通过环境变量传递指纹配置：

```javascript
// product_activator.js 中的传递方式
const fingerprintConfig = CaliforniaFingerprint.generateRandomCaliforniaFingerprint();
const childProcess = fork('register_openai.js', args, {
    env: {
        ...process.env,
        FINGERPRINT_CONFIG: JSON.stringify(fingerprintConfig)
    }
});
```

子进程接收并解析：

```javascript
// 子进程中的接收方式
let fingerprintConfig;
if (process.env.FINGERPRINT_CONFIG) {
    fingerprintConfig = JSON.parse(process.env.FINGERPRINT_CONFIG);
    console.log('🌴 [指纹] 使用传递的指纹配置');
} else {
    fingerprintConfig = CaliforniaFingerprint.generateRandomCaliforniaFingerprint();
    console.log('🌴 [指纹] 生成新的加州指纹配置');
}
```

## 修改的文件

### 1. product_activator.js (主调度层)

**修改位置**: 三个关键函数

| 函数 | 行号 | 修改内容 |
|------|------|----------|
| `runRegisterOpenAI()` | ~473 | 生成指纹并通过 env 传递给 register_openai.js |
| `runActivatePlus()` | ~722 | 生成指纹并通过 env 传递给 index.js |
| `runOAuthLogin()` | ~819 | 生成指纹并通过 env 传递给 oauth_login.js |

**新增导入**:
```javascript
const CaliforniaFingerprint = require('./lib/california-fingerprint');
```

### 2. register_openai.js (注册阶段)

**修改内容**:
- 第11行: 添加 `CaliforniaFingerprint` 导入
- ~1175-1189行: 添加指纹配置解析和上下文创建逻辑

**关键代码**:
```javascript
const { context } = await CaliforniaFingerprint.createCaliforniaContext(browser, fingerprintConfig);
page = await context.newPage();
```

### 3. index.js (激活Plus阶段)

**修改内容**:
- 第9行: 添加 `CaliforniaFingerprint` 导入
- ~240-262行: 添加指纹配置解析和上下文创建逻辑

**关键代码**:
```javascript
const { context } = await CaliforniaFingerprint.createCaliforniaContext(browser, fingerprintConfig);
// 保留原有的额外指纹伪装脚本
await context.addInitScript((injectedChromeMajor) => { ... });
```

### 4. oauth_login.js (协议提取阶段)

**修改内容**:
- 第9行: 添加 `CaliforniaFingerprint` 导入
- ~875-893行: 添加指纹配置解析和上下文创建逻辑

**关键代码**:
```javascript
const { context } = await CaliforniaFingerprint.createCaliforniaContext(browser, fingerprintConfig);
page = await context.newPage();
```

## 修复的问题

### 问题1: 导入路径错误
- **现象**: 部分文件使用了错误的导入路径
- **修复**: 统一使用 `require('./lib/california-fingerprint')`

### 问题2: Context 覆盖问题
- **现象**: `register_openai.js` 中创建的 context 被后续代码重新声明覆盖
- **位置**: 原第1189行创建，第1208行被覆盖
- **修复**: 移除重复的 context 声明，使用 `const { context } = ...` 解构赋值

### 问题3: UA 一致性处理
- **现象**: 需要保留原有的 User-Agent 一致性逻辑
- **修复**: 在 `index.js` 中保留 `context.addInitScript()` 额外伪装脚本

## 验证结果

### 导入路径验证
```
✅ product_activator.js: require('./lib/california-fingerprint')
✅ register_openai.js:   require('./lib/california-fingerprint')
✅ index.js:             require('./lib/california-fingerprint')
✅ oauth_login.js:       require('./lib/california-fingerprint')
```

### 库功能测试
```bash
node -e "const CF = require('./lib/california-fingerprint'); 
         const fp = CF.generateRandomCaliforniaFingerprint();
         console.log('Region:', fp.region, 'CPU:', fp.hardwareConcurrency);"
```
**结果**: ✅ 成功生成 Silicon Valley 指纹，8核配置

### Context 创建验证
所有子进程都正确使用:
```javascript
const { context } = await CaliforniaFingerprint.createCaliforniaContext(browser, fingerprintConfig);
```

## 指纹配置示例

通过环境变量传递的指纹配置结构：

```json
{
  "region": "Silicon Valley",
  "hardwareConcurrency": 8,
  "deviceMemory": 16,
  "platform": "Win32",
  "timezone": "America/Los_Angeles",
  "screen": {
    "width": 1920,
    "height": 1080,
    "availWidth": 1920,
    "availHeight": 1040,
    "colorDepth": 24,
    "pixelDepth": 24
  },
  "languages": ["en-US", "en"],
  "webgl": {
    "vendor": "Intel Inc.",
    "renderer": "Intel Iris Pro Graphics 6200"
  },
  "geolocation": {
    "latitude": 37.3861,
    "longitude": -122.0839
  }
}
```

## 流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                    POST /api/admin/products/generate            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     product_activator.js                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ fingerprintConfig = generateRandomCaliforniaFingerprint()│   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
          │                     │                     │
          ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ register_openai │   │    index.js     │   │  oauth_login    │
│      .js        │   │  (激活Plus)     │   │     .js         │
├─────────────────┤   ├─────────────────┤   ├─────────────────┤
│ 解析 FINGERPRINT│   │ 解析 FINGERPRINT│   │ 解析 FINGERPRINT│
│ _CONFIG 环境变量│   │ _CONFIG 环境变量│   │ _CONFIG 环境变量│
├─────────────────┤   ├─────────────────┤   ├─────────────────┤
│ createCalifornia│   │ createCalifornia│   │ createCalifornia│
│ Context()       │   │ Context()       │   │ Context()       │
├─────────────────┤   ├─────────────────┤   ├─────────────────┤
│ 🌴 加州指纹伪装 │   │ 🌴 加州指纹伪装 │   │ 🌴 加州指纹伪装 │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

## 日志输出示例

集成后，运行时会输出以下日志：

```
🌴 [指纹] 使用传递的指纹配置
🌴 [指纹] 使用 Silicon Valley 指纹 (8核/16GB)
```

或（首次生成时）：

```
🌴 [指纹] 生成新的加州指纹配置
🌴 [指纹] 使用 Los Angeles 指纹 (12核/32GB)
🌴 [指纹] 配置输出: {"region":"Los Angeles",...}
```

## 总结

✅ **集成完成**: CaliforniaFingerprint 已集成到完整支付流程的三个阶段
✅ **路径正确**: 所有文件使用统一的导入路径 `./lib/california-fingerprint`
✅ **传递机制**: 通过 `FINGERPRINT_CONFIG` 环境变量实现跨进程指纹配置传递
✅ **问题修复**: 解决了 context 覆盖、导入路径等问题
✅ **一致性保证**: 同一次请求的三个阶段使用相同的指纹配置
