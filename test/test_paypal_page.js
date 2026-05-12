/**
 * PayPal 页面调试脚本
 *
 * 用法：
 *   node test_paypal_page.js <URL>
 *
 * 示例：
 *   set PROXY=socks5://user:pass@host:port
 *   node test_paypal_page.js "https://www.paypal.com/agreements/approve?..."
 *
 * 功能：
 * - 打开 PayPal 页面
 * - 自动高亮所有 input 元素
 * - 在 Console 注入调试工具
 */

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { createProxyBridge, closeProxyBridge } = require('./local-proxy-bridge');

chromium.use(StealthPlugin());

async function main() {
    const url = process.argv[2];
    const proxy = process.env.PROXY || '';

    if (!url) {
        console.log(`
用法: node test_paypal_page.js <URL>

示例:
  set PROXY=socks5://user:pass@host:port
  node test_paypal_page.js "https://www.paypal.com/agreements/approve?..."

也可以传入 Stripe checkout URL，脚本会等你手动点击 PayPal 按钮后继续调试
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
                localPort: 10810,
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

    // 模拟真实浏览器环境
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9'
        }
    });

    const page = await context.newPage();

    // 注入调试工具函数
    const injectDebugTools = async () => {
        await page.evaluate(() => {
            // 高亮所有 input（包括 iframe 内的）
            window.highlightInputs = () => {
                const inputs = document.querySelectorAll('input, [contenteditable="true"], textarea');
                inputs.forEach((el, i) => {
                    el.style.outline = '3px solid red';
                    el.style.outlineOffset = '2px';
                    el.dataset.debugIndex = i;
                    const rect = el.getBoundingClientRect();
                    console.log(`[${i}] id="${el.id}" name="${el.name}" type="${el.type}" placeholder="${el.placeholder || ''}" visible=${rect.width > 0 && rect.height > 0}`);
                });
                console.log(`\n共找到 ${inputs.length} 个输入框`);
            };

            // 高亮所有按钮
            window.highlightButtons = () => {
                const buttons = document.querySelectorAll('button, [role="button"], a.btn, .button, [type="submit"]');
                buttons.forEach((el, i) => {
                    el.style.outline = '3px solid blue';
                    el.style.outlineOffset = '2px';
                    const text = el.textContent?.trim().slice(0, 40) || '';
                    console.log(`[${i}] "${text}" id="${el.id}" class="${el.className?.slice(0, 60)}"`);
                });
                console.log(`\n共找到 ${buttons.length} 个按钮`);
            };

            // 查找元素
            window.find = (selector) => {
                const el = document.querySelector(selector);
                if (el) {
                    el.style.outline = '5px solid lime';
                    el.scrollIntoView({ block: 'center' });
                    console.log('✅ 找到:', el);
                    console.log('   id:', el.id);
                    console.log('   name:', el.name);
                    console.log('   class:', el.className);
                } else {
                    console.log('❌ 未找到:', selector);
                }
                return el;
            };

            // 列出所有可交互元素
            window.listAll = () => {
                const selectors = [];
                document.querySelectorAll('input, button, [role="button"], select, textarea, a[href]').forEach(el => {
                    const rect = el.getBoundingClientRect();
                    const visible = rect.width > 0 && rect.height > 0;
                    if (!visible) return;

                    const info = {
                        tag: el.tagName,
                        id: el.id,
                        name: el.name,
                        type: el.type || el.getAttribute('role'),
                        text: el.textContent?.trim().slice(0, 30),
                        placeholder: el.placeholder,
                        selector: el.id ? `#${el.id}` : (el.name ? `[name="${el.name}"]` : `${el.tagName.toLowerCase()}.${el.className?.split(' ')[0] || 'no-class'}`)
                    };
                    selectors.push(info);
                    console.log(`✅ ${info.selector.padEnd(30)} | ${info.tag.padEnd(8)} | "${info.text || info.placeholder || ''}"`);
                });
                return selectors;
            };

            // 专门查找邮箱输入框
            window.findEmail = () => {
                const emailSelectors = [
                    '#login_email',
                    '#email',
                    'input[type="email"]',
                    'input[name="email"]',
                    'input[name="login_email"]',
                    'input[placeholder*="email" i]',
                    'input[placeholder*="邮箱"]',
                    'input[aria-label*="email" i]',
                    'input[data-testid*="email" i]',
                    '#txtEmail',
                    '.email-input',
                    '[autocomplete="email"]'
                ];

                console.log('🔍 正在查找邮箱输入框...\n');
                for (const sel of emailSelectors) {
                    const el = document.querySelector(sel);
                    if (el) {
                        const rect = el.getBoundingClientRect();
                        el.style.outline = '5px solid lime';
                        el.scrollIntoView({ block: 'center' });
                        console.log(`✅ 找到邮箱框: ${sel}`);
                        console.log(`   id: ${el.id}`);
                        console.log(`   name: ${el.name}`);
                        console.log(`   type: ${el.type}`);
                        console.log(`   visible: ${rect.width > 0 && rect.height > 0}`);
                        console.log(`   placeholder: ${el.placeholder}`);
                        return el;
                    }
                }
                console.log('❌ 未找到邮箱输入框，请用 listAll() 查看所有元素');
                return null;
            };

            // 检查 iframe
            window.checkIframes = () => {
                const iframes = document.querySelectorAll('iframe');
                console.log(`\n🖼️ 页面中有 ${iframes.length} 个 iframe:\n`);
                iframes.forEach((iframe, i) => {
                    console.log(`[${i}] src: ${iframe.src?.slice(0, 80) || '(empty)'}`);
                    console.log(`    id: ${iframe.id}`);
                    console.log(`    name: ${iframe.name}`);
                    console.log(`    title: ${iframe.title}`);
                    console.log('');
                });
                return iframes;
            };

            console.log('\n📋 PayPal 调试工具已注入！可用命令:');
            console.log('  highlightInputs()  - 高亮所有输入框（红色）');
            console.log('  highlightButtons() - 高亮所有按钮（蓝色）');
            console.log('  findEmail()        - 专门查找邮箱输入框（绿色）');
            console.log('  find("#selector")  - 查找并高亮元素（绿色）');
            console.log('  listAll()          - 列出所有可交互元素');
            console.log('  checkIframes()     - 检查页面中的 iframe');
            console.log('');
        });
    };

    console.log(`🌐 打开: ${url.slice(0, 80)}...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(3000);
    await injectDebugTools();

    // 监听页面导航，重新注入调试工具
    page.on('load', async () => {
        console.log(`\n📄 页面已加载: ${page.url().slice(0, 80)}...`);
        await page.waitForTimeout(2000);
        await injectDebugTools();
        // 自动执行一次查找
        await page.evaluate(() => {
            highlightInputs();
            findEmail();
        }).catch(() => {});
    });

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ 页面已打开

🛠️  在浏览器 Console (F12) 里可以用这些命令:

  findEmail()         - 🔥 专门查找邮箱输入框
  highlightInputs()   - 高亮所有输入框（红色）
  highlightButtons()  - 高亮所有按钮（蓝色）
  find('#login_email') - 查找特定元素
  listAll()           - 列出所有可交互元素
  checkIframes()      - 检查 iframe（PayPal 可能用 iframe）

💡 如果是 Stripe 页面，请手动点击 PayPal 按钮跳转到 PayPal 页面
   页面跳转后会自动重新注入调试工具

📝 找到正确的选择器后告诉我，我来更新 index.js

按 Ctrl+C 退出
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

    // 保持运行
    await new Promise(() => {});
}

main().catch(e => {
    console.error('❌', e.message);
    process.exit(1);
});
