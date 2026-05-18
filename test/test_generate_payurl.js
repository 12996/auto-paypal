/**
 * 支付长链接生成测试
 *
 * 用法:
 *   node test/test_generate_payurl.js <CHATGPT_TOKEN>
 *
 * 或:
 *   set CHATGPT_TOKEN=eyJ...
 *   node test/test_generate_payurl.js
 *
 * 可选:
 *   set MIN_PAY_URL_LENGTH=120
 *   node test/test_generate_payurl.js --show-url
 */

require('dotenv').config();

const assert = require('assert');
const ChatGPTService = require('../chatgpt');

const DEFAULT_MIN_PAY_URL_LENGTH = 120;
const ALLOWED_PAYMENT_HOSTS = new Set([
    'pay.openai.com',
    'checkout.stripe.com',
    'chatgpt.com'
]);

function printUsageAndExit(exitCode = 0) {
    console.log(`
支付长链接生成测试

用法:
  node test/test_generate_payurl.js <CHATGPT_TOKEN>

也可以通过环境变量传入:
  set CHATGPT_TOKEN=eyJ...
  node test/test_generate_payurl.js

可选环境变量:
  MIN_PAY_URL_LENGTH    最小链接长度，默认 ${DEFAULT_MIN_PAY_URL_LENGTH}

可选参数:
  --show-url            输出完整支付链接
  --help, -h            显示帮助
`);
    process.exit(exitCode);
}

function maskToken(token) {
    if (!token) return '';
    if (token.length <= 24) return `${token.slice(0, 6)}...`;
    return `${token.slice(0, 12)}...${token.slice(-8)}`;
}

function maskUrl(url) {
    if (!url) return '';
    if (url.length <= 96) return url;
    return `${url.slice(0, 72)}...${url.slice(-20)}`;
}

function assertGeneratedPayUrl(payUrl, minLength) {
    assert.strictEqual(typeof payUrl, 'string', '支付链接必须是字符串');
    assert.ok(payUrl.length >= minLength, `支付链接长度过短: ${payUrl.length} < ${minLength}`);
    assert.ok(!payUrl.includes('...'), '支付链接疑似被省略号截断');
    assert.ok(!payUrl.includes('cs_live_xxx'), '支付链接仍是示例占位符');

    let parsed;
    assert.doesNotThrow(() => {
        parsed = new URL(payUrl);
    }, '支付链接不是合法 URL');

    assert.strictEqual(parsed.protocol, 'https:', '支付链接必须使用 https');
    assert.ok(ALLOWED_PAYMENT_HOSTS.has(parsed.hostname), `支付链接域名异常: ${parsed.hostname}`);

    const fullUrl = parsed.toString();
    assert.ok(
        /cs_(live|test)_/i.test(fullUrl) || /\/checkout\//i.test(parsed.pathname),
        '支付链接里未发现 checkout session 标识'
    );

    return parsed;
}

async function main() {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        printUsageAndExit();
    }

    const showUrl = args.includes('--show-url');
    const tokenArg = args.find(arg => !arg.startsWith('--'));
    const token = tokenArg || process.env.CHATGPT_TOKEN;
    const minLength = Number(process.env.MIN_PAY_URL_LENGTH || DEFAULT_MIN_PAY_URL_LENGTH);

    if (!token) {
        printUsageAndExit(1);
    }

    assert.ok(Number.isFinite(minLength) && minLength > 0, 'MIN_PAY_URL_LENGTH 必须是正数');

    console.log('='.repeat(72));
    console.log('支付长链接生成测试');
    console.log('='.repeat(72));
    console.log(`Token: ${maskToken(token)}`);
    console.log('Proxy: http://127.0.0.1:7891');
    console.log(`Min length: ${minLength}`);

    const service = new ChatGPTService(null, token);
    const payUrl = await service.getPayPalApprovalUrl();
    const parsed = assertGeneratedPayUrl(payUrl, minLength);

    console.log('\n✅ 支付长链接生成成功');
    console.log(`Host: ${parsed.hostname}`);
    console.log(`Path: ${parsed.pathname}`);
    console.log(`Length: ${payUrl.length}`);
    console.log(`URL: ${showUrl ? payUrl : maskUrl(payUrl)}`);
}

main().catch(error => {
    console.error('\n❌ 支付长链接生成测试失败');
    console.error(error.stack || error.message);
    process.exit(1);
});
