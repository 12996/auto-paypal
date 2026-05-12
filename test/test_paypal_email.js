/**
 * PayPal 邮箱输入页面 DOM 调试测试
 * 专门测试 PayPal 邮箱输入框的选择器问题
 */

const { chromium } = require('playwright');
const path = require('path');

// 测试配置
const CONFIG = {
    billing: {
        email: 'test@example.com'
    }
};

/**
 * 人性化填写输入框（从 index.js 复制）
 */
async function humanFillInput(page, element, value, clearFirst = true, useType = false) {
    if (clearFirst) {
        await element.selectText();
        await page.keyboard.press('Delete');
    }

    if (useType) {
        // 逐字符输入，模拟真实用户
        for (const char of value) {
            await element.type(char, { delay: Math.random() * 100 + 50 });
        }
    } else {
        await element.fill(value);
    }
}

/**
 * 测试 PayPal 邮箱输入功能
 */
async function testPayPalEmailInput() {
    console.log('🚀 启动 PayPal 邮箱输入测试...');

    const browser = await chromium.launch({
        headless: false,
        slowMo: 1000  // 慢速执行便于观察
    });

    const page = await browser.newPage();

    try {
        // 打开本地保存的错误页面
        const htmlPath = path.resolve(__dirname, '../debug_html/2026-05-12T04-59-07_error.html');
        console.log(`📂 打开本地页面: ${htmlPath}`);

        await page.goto(`file://${htmlPath}`);
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
        console.log('⏸️  Inspector 打开后，请测试邮箱输入框的选择器，完成后关闭 Inspector 窗口继续...');

        await page.pause(); // 这会打开 Playwright Inspector

        // 测试当前使用的选择器
        console.log('🔍 测试当前选择器: #login_email');

        try {
            const emailInput = page.locator('#login_email');
            await emailInput.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 找到邮箱输入框: #login_email');

            // 高亮显示找到的元素
            await page.evaluate(() => {
                const element = document.querySelector('#login_email');
                if (element) {
                    element.style.border = '3px solid green';
                    element.style.backgroundColor = 'lightgreen';
                }
            });

            // 测试填写
            await humanFillInput(page, emailInput, CONFIG.billing.email, false, true);
            console.log('✅ 成功填写邮箱');

        } catch (error) {
            console.log('❌ 当前选择器失败:', error.message);

            // 开始调试 - 查找所有可能的邮箱输入框
            console.log('🔍 开始查找所有可能的邮箱输入框...');

            const possibleSelectors = [
                '#login_email',
                '#email',
                'input[type="email"]',
                'input[name="email"]',
                'input[name="login_email"]',
                'input[placeholder*="email"]',
                'input[placeholder*="Email"]',
                'input[id*="email"]',
                'input[class*="email"]',
                '[data-testid*="email"]',
                '.email-input',
                '#emailAddress',
                '#userEmail'
            ];

            console.log('📋 测试以下选择器:');
            possibleSelectors.forEach((sel, i) => console.log(`  ${i + 1}. ${sel}`));

            for (let i = 0; i < possibleSelectors.length; i++) {
                const selector = possibleSelectors[i];
                try {
                    const elements = await page.locator(selector).all();
                    if (elements.length > 0) {
                        console.log(`✅ 找到 ${elements.length} 个元素: ${selector}`);

                        // 高亮显示所有找到的元素
                        await page.evaluate((sel) => {
                            const elements = document.querySelectorAll(sel);
                            elements.forEach((el, idx) => {
                                el.style.border = '3px solid blue';
                                el.style.backgroundColor = 'lightblue';
                                // 添加标签显示是第几个元素
                                const label = document.createElement('div');
                                label.textContent = `${sel} [${idx}]`;
                                label.style.position = 'absolute';
                                label.style.backgroundColor = 'blue';
                                label.style.color = 'white';
                                label.style.padding = '2px 5px';
                                label.style.fontSize = '12px';
                                label.style.zIndex = '9999';
                                el.parentNode.insertBefore(label, el);
                            });
                        }, selector);
                    }
                } catch (e) {
                    // 忽略无效选择器
                }
            }

            console.log('🎯 所有可能的邮箱输入框已高亮显示');
            console.log('📝 请查看页面并告诉我正确的选择器');
        }

        // 等待用户输入正确的选择器
        console.log('\n⏸️  请输入正确的选择器（或按 Enter 跳过）:');
        const correctSelector = await new Promise(resolve => {
            process.stdin.once('data', (data) => {
                resolve(data.toString().trim());
            });
        });

        if (correctSelector) {
            console.log(`🧪 测试新选择器: ${correctSelector}`);
            try {
                const newEmailInput = page.locator(correctSelector);
                await newEmailInput.waitFor({ state: 'visible', timeout: 5000 });

                // 高亮新选择器
                await page.evaluate((sel) => {
                    const element = document.querySelector(sel);
                    if (element) {
                        element.style.border = '5px solid red';
                        element.style.backgroundColor = 'yellow';
                    }
                }, correctSelector);

                await humanFillInput(page, newEmailInput, CONFIG.billing.email, false, true);
                console.log('✅ 新选择器测试成功！');
                console.log(`📝 建议更新 index.js 第 2114 行为: const emailInput = page.locator('${correctSelector}');`);

            } catch (error) {
                console.log('❌ 新选择器测试失败:', error.message);
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
    testPayPalEmailInput().catch(console.error);
}

module.exports = { testPayPalEmailInput };