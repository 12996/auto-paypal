/**
 * PayPal 支付流程调试脚本
 *
 * 用法：
 *   node test/test_paypal_page.js <Stripe_Checkout_URL> [--debug]
 *
 * 示例：
 *   node test/test_paypal_page.js "https://checkout.stripe.com/c/pay/..." --debug
 *
 * 功能：
 * - 传入 Stripe Checkout URL，走完整支付流程
 * - 带加州指纹伪装
 * - --debug 模式：在 PayPal 触发后暂停，方便手动调试
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// 直接调用 index.js 的 run 函数
const { run } = require('../index');

async function main() {
    const args = process.argv.slice(2);
    const debugMode = args.includes('--debug');
    const checkoutUrl = args.find(arg => arg.startsWith('http'));

    if (!checkoutUrl) {
        console.log(`
用法: node test/test_paypal_page.js <Stripe_Checkout_URL> [--debug]

示例:
  node test/test_paypal_page.js "https://checkout.stripe.com/c/pay/..." --debug

参数:
  <Stripe_Checkout_URL>  - Stripe Checkout 页面 URL (必填)
  --debug                - 调试模式，PayPal 触发后暂停 (可选)

环境变量 (从 .env 读取):
  PROXY           - 代理地址 (如 socks5://127.0.0.1:7897)
  BILLING_NAME    - 账单姓名
  BILLING_ADDRESS - 账单地址
  BILLING_CITY    - 城市
  BILLING_STATE   - 州
  BILLING_ZIP     - 邮编
  BILLING_EMAIL   - PayPal 邮箱
  PAYPAL_PASSWORD - PayPal 密码
`);
        process.exit(1);
    }

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 PayPal 支付流程测试脚本');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📦 Checkout URL: ${checkoutUrl.substring(0, 60)}...`);
    console.log(`🔧 调试模式: ${debugMode ? '开启 (PayPal 触发后暂停)' : '关闭'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    // 调用 index.js 的 run 函数，传入外部 checkout URL
    await run({ checkoutUrl, debugMode });
}

main().catch(e => {
    console.error('❌ 测试失败:', e.message);
    process.exit(1);
});
