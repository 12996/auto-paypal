/**
 * index.js 独立测试脚本
 *
 * 用法：
 * 1. 设置必要的环境变量（见下方）
 * 2. 运行: node test_index.js
 *
 * 必需环境变量：
 * - CHATGPT_TOKEN: 已注册账号的 accessToken
 * - PROXY: 代理地址
 *
 * 可选环境变量（有默认值或自动生成）：
 * - CARD_NUMBER, CARD_EXPIRY, CARD_CVC: 银行卡信息
 * - BILLING_*: 账单地址信息
 * - SMS_API_KEY, BILLING_PHONE: 短信验证
 * - HEADFUL: 设为 1 显示浏览器窗口
 */

// 加载 .env 配置（从项目根目录）
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { spawn } = require('child_process');
const path = require('path');

// 从命令行参数或环境变量获取 token
const token = process.argv[2] || process.env.CHATGPT_TOKEN;

if (!token) {
    console.log(`
用法: node test_index.js <CHATGPT_TOKEN>

或设置环境变量后直接运行:
  set CHATGPT_TOKEN=eyJhbGciOiJSUzI1NiI...
  node test_index.js

获取 token 的方法:
  1. 登录 chatgpt.com
  2. 打开开发者工具 (F12) → Application → Local Storage
  3. 复制 accessToken 的值
`);
    process.exit(1);
}

console.log('🚀 启动 index.js 测试...');
console.log(`📝 Token: ${token.slice(0, 30)}...`);
console.log(`📝 Proxy: ${process.env.PROXY || '(未设置)'}`);
console.log('');

// 设置环境变量并启动 index.js
const env = {
    ...process.env,
    CHATGPT_TOKEN: token,
    HEADFUL: process.env.HEADFUL || '1',  // 默认显示浏览器

    // 真实的加州洛杉矶地址信息
    BILLING_COUNTRY: process.env.BILLING_COUNTRY || 'US',
    BILLING_ADDRESS: process.env.BILLING_ADDRESS || '1600 Amphitheatre Parkway',
    BILLING_CITY: process.env.BILLING_CITY || 'Mountain View',
    BILLING_STATE: process.env.BILLING_STATE || 'CA',
    BILLING_ZIP: process.env.BILLING_ZIP || '94043',
    BILLING_NAME: process.env.BILLING_NAME || 'John Smith',
    BILLING_EMAIL: process.env.BILLING_EMAIL || '', // 会自动生成随机邮箱

    // 测试银行卡信息（Stripe 测试卡号）
    CARD_NUMBER: process.env.CARD_NUMBER || '4242424242424242',
    CARD_EXPIRY: process.env.CARD_EXPIRY || '12/28',
    CARD_CVC: process.env.CARD_CVC || '123',

    // PayPal 和短信
    PAYPAL_PASSWORD: process.env.PAYPAL_PASSWORD || 'testpassword123',
    SMS_API_KEY: process.env.SMS_API_KEY || '',
    BILLING_PHONE: process.env.BILLING_PHONE || '8352755872'
};

const child = spawn('node', [path.join(__dirname, '..', 'index.js')], {
    env,
    stdio: 'inherit'
});

child.on('exit', (code) => {
    console.log(`\n📊 index.js 退出，代码: ${code}`);
});
