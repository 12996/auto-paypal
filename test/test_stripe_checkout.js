/**
 * Stripe 页面调试脚本 - 简化版
 *
 * 用法：
 *   node test_stripe_checkout.js "https://pay.openai.com/c/pay/cs_live_xxx..."
 *
 * 功能：
 * - 直接打开你传入的 URL
 * - 自动高亮所有 input 元素（红色边框）
 * - 在 Console 注入调试工具函数
 */

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createProxyBridge, closeProxyBridge } = require('../local-proxy-bridge');

chromium.use(StealthPlugin());

async function main() {
    const url = process.argv[2];
    const proxy = process.env.PROXY || '';

    if (!url) {
        console.log(`
用法: node test_stripe_checkout.js <URL>

示例:
  set PROXY=socks5://user:pass@host:port
  node test_stripe_checkout.js "https://pay.openai.com/c/pay/cs_live_xxx..."
`);
        process.exit(1);
    }

    console.log('🚀 启动浏览器...');

    const launchOptions = {
        headless: false,
        args: ['--disable-blink-features=AutomationControlled']
    };

    let proxyBridgeStarted = false;
    if (proxy) {
        try {
            const bridge = await createProxyBridge({
                remoteProxy: proxy,
                localPort: 10809,
                vpnPort: 7897,
                useVpn: true,
                vpnType: 'http'
            });
            proxyBridgeStarted = true;
            launchOptions.proxy = { server: bridge.localProxy };
            console.log(`🌐 代理: ${bridge.localProxy}`);
        } catch (e) {
            console.warn(`⚠️ 代理失败: ${e.message}`);
        }
    }

    const browser = await chromium.launch(launchOptions);
    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        locale: 'en-US'
    });
    const page = await context.newPage();

    console.log(`🌐 打开: ${url.slice(0, 60)}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(2000);

    // 注入调试工具到页面
    await page.evaluate(() => {
        // 高亮所有 input
        window.highlightInputs = () => {
            document.querySelectorAll('input, [contenteditable="true"]').forEach((el, i) => {
                el.style.outline = '3px solid red';
                el.style.outlineOffset = '2px';
                el.dataset.debugIndex = i;
                console.log(`[${i}] id="${el.id}" name="${el.name}" type="${el.type}" visible=${el.offsetWidth > 0}`);
            });
        };

        // 高亮所有按钮
        window.highlightButtons = () => {
            document.querySelectorAll('button, [role="button"], [role="radio"]').forEach((el, i) => {
                el.style.outline = '3px solid blue';
                el.style.outlineOffset = '2px';
                console.log(`[${i}] "${el.textContent?.slice(0, 30)}" class="${el.className?.slice(0, 50)}"`);
            });
        };

        // 查找元素
        window.find = (selector) => {
            const el = document.querySelector(selector);
            if (el) {
                el.style.outline = '5px solid lime';
                el.scrollIntoView({ block: 'center' });
                console.log('找到:', el);
            } else {
                console.log('未找到:', selector);
            }
            return el;
        };

        // 列出所有元素的选择器
        window.listAll = () => {
            const results = [];
            document.querySelectorAll('input, button, [role="button"], [role="radio"], select').forEach(el => {
                const info = {
                    tag: el.tagName,
                    id: el.id,
                    name: el.name,
                    type: el.type,
                    role: el.getAttribute('role'),
                    text: el.textContent?.slice(0, 20),
                    visible: el.offsetWidth > 0 && el.offsetHeight > 0,
                    selector: el.id ? `#${el.id}` : (el.name ? `[name="${el.name}"]` : el.className?.split(' ')[0] ? `.${el.className.split(' ')[0]}` : el.tagName)
                };
                results.push(info);
                if (info.visible) {
                    console.log(`✅ ${info.selector} | ${info.tag} | "${info.text || ''}"`);
                }
            });
            return results;
        };

        // 自动执行高亮
        highlightInputs();
        console.log('\\n📋 调试工具已注入！可用命令:');
        console.log('  highlightInputs()  - 高亮所有输入框（红色）');
        console.log('  highlightButtons() - 高亮所有按钮（蓝色）');
        console.log('  find("#selector")  - 查找并高亮元素（绿色）');
        console.log('  listAll()          - 列出所有可交互元素');
    });

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 页面已打开，所有 input 已用红色边框高亮

🛠️  在浏览器 Console (F12) 里可以用这些命令:

  highlightInputs()   - 重新高亮所有输入框
  highlightButtons()  - 高亮所有按钮（蓝色）
  find('#billingPostalCode')  - 查找特定元素（绿色高亮）
  listAll()           - 列出所有可交互元素及其选择器

💡 Playwright 常用选择器（和 JS 一样）:
  #id              - 按 ID 选择
  .class           - 按 class 选择
  [name="xxx"]     - 按 name 属性选择
  button:has-text("Pay")  - 按文字选择按钮

按 Ctrl+C 退出
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

    await new Promise(() => {});
}

main().catch(e => {
    console.error('❌', e.message);
    process.exit(1);
});
