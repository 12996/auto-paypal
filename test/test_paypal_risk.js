/**
 * PayPal 风控检测页面 DOM 调试测试
 * 专门测试 PayPal 风控拦截页面的选择器
 */

const { chromium } = require('playwright');
const path = require('path');
const { pathToFileURL } = require('url');

/**
 * 测试 PayPal 风控检测页面
 */
async function testPayPalRiskDetection() {
    console.log('🚀 启动 PayPal 风控检测页面调试...');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 1000  // 慢速执行便于观察
    });

    // 启用 JavaScript 但拦截网络请求防止跳转
    const context = await browser.newContext();
    const page = await context.newPage();

    // 拦截所有外部网络请求，只允许本地文件
    await page.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('file://')) {
            route.continue();
        } else {
            // 阻止所有外部请求（包括跳转）
            route.abort();
        }
    });

    try {
        // 打开本地保存的风控页面
        const htmlPath = path.resolve(__dirname, '../debug_html/2026-05-13T12-59-48_runtime_error.html');
        console.log(`📂 打开本地页面: ${htmlPath}`);

        // Windows 路径需要转换为 file:// URL 格式
        const fileUrl = pathToFileURL(htmlPath).href;
        console.log(`🔗 文件 URL: ${fileUrl}`);
        await page.goto(fileUrl);
        await page.waitForLoadState('domcontentloaded');

        console.log('📄 页面加载完成，开始调试...');

        // 等待用户确认页面已加载
        console.log('⏸️  请确认页面已正确加载，然后按 Enter 继续...');
        console.log('💡 提示：你也可以按 Ctrl+Shift+I 打开开发者工具手动检查元素');
        await new Promise(resolve => {
            process.stdin.once('data', () => resolve());
        });

        // 启动 Playwright Inspector 进行交互式调试
        console.log('🔍 启动 Playwright Inspector 进行交互式调试...');
        console.log('💡 在 Inspector 中你可以：');
        console.log('   1. 点击 "Pick locator" 按钮选择页面元素');
        console.log('   2. 在 Locator 输入框中测试不同的选择器');
        console.log('   3. 查看元素的所有属性和选择器选项');
        console.log('⏸️  Inspector 打开后，请找出风控页面的关键元素，完成后关闭 Inspector 窗口继续...');

        await page.pause(); // 这会打开 Playwright Inspector

        // 常见的风控页面选择器
        const possibleRiskSelectors = [
            // 标题/提示文字
            'h1',
            'h2',
            '.title',
            '.header',
            '[class*="title"]',
            '[class*="header"]',
            '[class*="message"]',
            '[class*="error"]',
            '[class*="warning"]',
            '[class*="alert"]',
            '[class*="notice"]',
            '[class*="risk"]',
            '[class*="security"]',
            '[class*="verify"]',
            '[class*="challenge"]',
            '[class*="captcha"]',
            // 按钮
            'button',
            '[type="submit"]',
            '[class*="btn"]',
            '[class*="button"]',
            // 链接
            'a[href*="help"]',
            'a[href*="support"]',
            'a[href*="contact"]',
            // 表单元素
            'input',
            'select',
            'textarea',
            // iframe (可能包含验证码)
            'iframe',
            '[id*="captcha"]',
            '[class*="captcha"]',
            '[id*="recaptcha"]',
            '[class*="recaptcha"]'
        ];

        console.log('\n🔍 开始查找所有可能的风控相关元素...');
        console.log('📋 测试以下选择器:');

        const foundElements = [];

        for (const selector of possibleRiskSelectors) {
            try {
                const elements = await page.locator(selector).all();
                if (elements.length > 0) {
                    // 获取元素的文本内容
                    for (let i = 0; i < elements.length; i++) {
                        const text = await elements[i].textContent().catch(() => '');
                        const trimmedText = text?.trim().substring(0, 100) || '';
                        if (trimmedText) {
                            foundElements.push({
                                selector,
                                index: i,
                                text: trimmedText
                            });
                        }
                    }
                    console.log(`✅ 找到 ${elements.length} 个元素: ${selector}`);
                }
            } catch (e) {
                // 忽略无效选择器
            }
        }

        // 显示找到的元素及其文本
        console.log('\n📝 找到的元素及其文本内容:');
        console.log('='.repeat(80));
        foundElements.forEach((item, idx) => {
            console.log(`${idx + 1}. [${item.selector}] ${item.text}`);
        });
        console.log('='.repeat(80));

        // 高亮所有文本元素
        await page.evaluate(() => {
            const textElements = document.querySelectorAll('h1, h2, h3, p, span, div');
            textElements.forEach((el) => {
                const text = el.textContent?.trim();
                if (text && text.length > 5 && text.length < 200) {
                    el.style.border = '2px solid blue';
                    el.style.margin = '2px';
                }
            });
        });

        console.log('\n🎯 所有文本元素已用蓝色边框高亮');

        // 让用户输入风控页面的关键信息
        console.log('\n📝 请告诉我风控页面显示的关键信息：');
        console.log('   1. 页面标题或主要提示文字是什么？');
        console.log('   2. 有哪些按钮或操作选项？');
        console.log('   3. 是否有验证码或其他验证元素？');

        console.log('\n⏸️  请输入风控页面的关键文字（用于检测是否进入风控）:');
        const riskKeyword = await new Promise(resolve => {
            process.stdin.once('data', (data) => {
                resolve(data.toString().trim());
            });
        });

        if (riskKeyword) {
            console.log(`\n🔍 搜索包含 "${riskKeyword}" 的元素...`);

            // 搜索包含关键字的元素
            const matchingElements = await page.evaluate((keyword) => {
                const results = [];
                const allElements = document.querySelectorAll('*');
                allElements.forEach((el) => {
                    const text = el.textContent?.trim();
                    if (text && text.toLowerCase().includes(keyword.toLowerCase())) {
                        // 获取元素的选择器信息
                        let selector = el.tagName.toLowerCase();
                        if (el.id) selector += `#${el.id}`;
                        if (el.className && typeof el.className === 'string') {
                            selector += '.' + el.className.split(' ').filter(c => c).join('.');
                        }
                        results.push({
                            selector,
                            text: text.substring(0, 150)
                        });
                    }
                });
                return results.slice(0, 20); // 只返回前20个
            }, riskKeyword);

            console.log(`\n找到 ${matchingElements.length} 个包含关键字的元素:`);
            matchingElements.forEach((item, idx) => {
                console.log(`${idx + 1}. [${item.selector}]`);
                console.log(`   文本: ${item.text}`);
            });
        }

        // 让用户输入正确的选择器
        console.log('\n⏸️  请输入用于检测风控页面的选择器（或按 Enter 跳过）:');
        const riskSelector = await new Promise(resolve => {
            process.stdin.once('data', (data) => {
                resolve(data.toString().trim());
            });
        });

        if (riskSelector) {
            console.log(`\n🧪 测试选择器: ${riskSelector}`);
            try {
                const riskElement = page.locator(riskSelector);
                const isVisible = await riskElement.isVisible();
                const text = await riskElement.textContent();

                console.log(`✅ 选择器有效！`);
                console.log(`   可见: ${isVisible}`);
                console.log(`   文本: ${text?.trim().substring(0, 100)}`);

                // 高亮选中的元素
                await page.evaluate((sel) => {
                    const element = document.querySelector(sel);
                    if (element) {
                        element.style.border = '5px solid red';
                        element.style.backgroundColor = 'yellow';
                    }
                }, riskSelector);

                console.log('\n📝 建议在 index.js 中添加风控检测代码:');
                console.log('```javascript');
                console.log(`// 检测是否进入风控页面`);
                console.log(`const riskElement = page.locator('${riskSelector}');`);
                console.log(`if (await riskElement.isVisible({ timeout: 3000 }).catch(() => false)) {`);
                console.log(`    console.log('⚠️ 检测到 PayPal 风控页面');`);
                console.log(`    // 处理风控逻辑...`);
                console.log(`}`);
                console.log('```');

            } catch (error) {
                console.log('❌ 选择器测试失败:', error.message);
            }
        }

        console.log('\n⏸️  测试完成，按 Enter 关闭浏览器...');
        await new Promise(resolve => {
            process.stdin.once('data', () => resolve());
        });

    } catch (error) {
        console.error('❌ 测试过程中出错:', error);
    } finally {
        await browser.close();
    }
}

// 运行测试
if (require.main === module) {
    testPayPalRiskDetection().catch(console.error);
}

module.exports = { testPayPalRiskDetection };
