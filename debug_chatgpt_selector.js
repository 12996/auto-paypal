/**
 * 调试脚本：打开 ChatGPT 主站，用于检查注册成功后的页面元素
 *
 * 使用方法：
 * 1. 设置环境变量 CHATGPT_TOKEN（可选，如果有的话可以直接登录）
 * 2. 运行: node debug_chatgpt_selector.js
 * 3. 浏览器会保持打开状态，你可以：
 *    - 按 F12 打开开发者工具
 *    - 用 Elements 面板检查输入框的选择器
 *    - 在 Console 里测试选择器，比如：
 *      document.querySelector('textarea')
 *      document.querySelector('[contenteditable="true"]')
 *      document.querySelector('#prompt-textarea')
 */

const { chromium } = require('playwright');

async function main() {
    console.log('🚀 启动浏览器...');

    const browser = await chromium.launch({
        headless: false,  // 显示浏览器窗口
        slowMo: 100,      // 放慢操作，便于观察
    });

    // 获取真实的 userAgent（和 register_openai.js 一样的方式）
    let realUserAgent;
    try {
        const tmpCtx = await browser.newContext();
        const tmpPage = await tmpCtx.newPage();
        realUserAgent = await tmpPage.evaluate(() => navigator.userAgent);
        await tmpCtx.close().catch(() => { });
        console.log('🔍 获取到真实 userAgent:', realUserAgent);
    } catch (_) {
        realUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        console.log('⚠️ 使用默认 userAgent');
    }

    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: realUserAgent,
        deviceScaleFactor: 1,
        locale: 'en-US',
    });

    const page = await context.newPage();

    // 如果有 token，尝试注入 cookie 登录
    const token = process.env.CHATGPT_TOKEN;
    if (token) {
        console.log('🔑 检测到 CHATGPT_TOKEN，尝试注入登录状态...');
        // 先访问一次设置 cookie 域
        await page.goto('https://chatgpt.com');
        await page.evaluate((accessToken) => {
            localStorage.setItem('accessToken', accessToken);
        }, token);
        await page.reload();
    }

    console.log('🌐 正在打开 ChatGPT...');
    await page.goto('https://chatgpt.com', { waitUntil: 'networkidle', timeout: 60000 });

    console.log('\n✅ 页面已加载！');
    console.log('📍 当前 URL:', page.url());

    // 尝试各种可能的选择器
    console.log('\n🔍 正在测试各种选择器...\n');

    const selectors = [
        // 原来的选择器
        'textarea[name="prompt-textarea"]',
        // 可能的新选择器
        'textarea#prompt-textarea',
        '#prompt-textarea',
        'textarea[placeholder]',
        'textarea',
        '[contenteditable="true"]',
        'div[contenteditable="true"]',
        '[data-testid="prompt-textarea"]',
        '[aria-label*="Message"]',
        '[aria-label*="message"]',
        '[placeholder*="Message"]',
        '[placeholder*="message"]',
        'form textarea',
        'main textarea',
    ];

    for (const selector of selectors) {
        try {
            const element = await page.$(selector);
            if (element) {
                const tagName = await element.evaluate(el => el.tagName);
                const id = await element.evaluate(el => el.id);
                const name = await element.evaluate(el => el.name);
                const placeholder = await element.evaluate(el => el.placeholder || el.getAttribute('aria-label') || '');
                const className = await element.evaluate(el => el.className);

                console.log(`✅ "${selector}"`);
                console.log(`   标签: ${tagName}, id="${id}", name="${name}"`);
                console.log(`   placeholder/aria-label: "${placeholder}"`);
                console.log(`   class: "${className.slice(0, 80)}${className.length > 80 ? '...' : ''}"`);
                console.log('');
            } else {
                console.log(`❌ "${selector}" - 未找到`);
            }
        } catch (e) {
            console.log(`❌ "${selector}" - 错误: ${e.message}`);
        }
    }

    // 额外：列出页面上所有的 textarea 和 contenteditable 元素
    console.log('\n📋 页面上所有可输入元素：\n');

    const allInputs = await page.evaluate(() => {
        const results = [];

        // 所有 textarea
        document.querySelectorAll('textarea').forEach((el, i) => {
            results.push({
                type: 'textarea',
                index: i,
                id: el.id,
                name: el.name,
                placeholder: el.placeholder,
                ariaLabel: el.getAttribute('aria-label'),
                className: el.className.slice(0, 60),
            });
        });

        // 所有 contenteditable
        document.querySelectorAll('[contenteditable="true"]').forEach((el, i) => {
            results.push({
                type: 'contenteditable',
                index: i,
                tagName: el.tagName,
                id: el.id,
                ariaLabel: el.getAttribute('aria-label'),
                className: el.className.slice(0, 60),
            });
        });

        return results;
    });

    allInputs.forEach(input => {
        console.log(`  ${input.type}[${input.index}]:`);
        console.log(`    id="${input.id}", name="${input.name || ''}", tagName="${input.tagName || 'TEXTAREA'}"`);
        console.log(`    placeholder="${input.placeholder || ''}", aria-label="${input.ariaLabel || ''}"`);
        console.log(`    class="${input.className}..."`);
        console.log('');
    });

    console.log('\n🛠️  浏览器保持打开状态，你可以：');
    console.log('   1. 按 F12 打开开发者工具');
    console.log('   2. 在 Elements 面板检查元素');
    console.log('   3. 在 Console 里测试选择器');
    console.log('\n   按 Ctrl+C 关闭浏览器退出\n');

    // 保持浏览器打开，等待用户手动关闭
    await new Promise(() => {});
}

main().catch(console.error);
