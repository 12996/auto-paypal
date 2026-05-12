const { chromium } = require('playwright');
const path = require('path');

// 配置
const CONFIG = {
    billing: {
        email: "test@hotmail.com"
    }
};

// 工具函数
const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function humanFillInput(page, locator, text, digitsMode = false, fastMode = false) {
    // 简化版的 humanFillInput 函数
    if (digitsMode || fastMode) {
        await locator.waitFor({ state: 'visible', timeout: 5000 });
        await locator.click({ clickCount: 3 });
        await page.waitForTimeout(randomDelay(60, 160));
        await locator.fill(text);

        // 触发事件
        await locator.evaluate((node) => {
            try {
                node.dispatchEvent(new Event('input', { bubbles: true }));
                node.dispatchEvent(new Event('change', { bubbles: true }));
                node.dispatchEvent(new Event('blur', { bubbles: true }));
            } catch (e) {}
        });

        await page.waitForTimeout(randomDelay(200, 500));
        return true;
    }
    return false;
}

async function testPayPalEmailFix() {
    console.log('🧪 测试 PayPal 邮箱输入修复...');

    const browser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // 打开保存的错误页面
        const errorHtmlPath = path.resolve(__dirname, '../debug_html/2026-05-12T04-59-07_error.html');
        console.log(`📂 加载错误页面: ${errorHtmlPath}`);
        await page.goto(`file://${errorHtmlPath}`);

        console.log('⏳ 等待页面加载...');
        await page.waitForTimeout(2000);

        console.log('🔍 测试新的邮箱输入选择器...');

        // 测试新的选择器
        try {
            console.log('📝 尝试定位邮箱输入框: getByRole("textbox", { name: "Enter email" })');
            const emailInput = page.getByRole('textbox', { name: 'Enter email' });

            // 检查元素是否存在和可见
            await emailInput.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 邮箱输入框定位成功！');

            // 高亮显示找到的元素
            await emailInput.evaluate(el => {
                el.style.border = '3px solid green';
                el.style.backgroundColor = '#90EE90';
            });

            console.log('📝 测试填写邮箱...');
            await humanFillInput(page, emailInput, CONFIG.billing.email, false, true);
            console.log('✅ 邮箱填写成功！');

            // 等待一下让用户看到结果
            await page.waitForTimeout(2000);

        } catch (e) {
            console.log('❌ 新选择器测试失败:', e.message);

            // 尝试查找页面上所有的文本输入框
            console.log('🔍 查找页面上所有可能的邮箱输入框...');
            const allInputs = await page.locator('input[type="text"], input[type="email"], input:not([type])').all();

            console.log(`📋 找到 ${allInputs.length} 个输入框:`);
            for (let i = 0; i < allInputs.length; i++) {
                try {
                    const input = allInputs[i];
                    const placeholder = await input.getAttribute('placeholder') || '';
                    const name = await input.getAttribute('name') || '';
                    const id = await input.getAttribute('id') || '';
                    const className = await input.getAttribute('class') || '';

                    console.log(`  [${i}] placeholder="${placeholder}" name="${name}" id="${id}" class="${className}"`);

                    // 高亮显示
                    await input.evaluate((el, index) => {
                        el.style.border = '2px solid red';
                        el.style.backgroundColor = '#FFE4E1';
                        el.setAttribute('data-test-index', index);
                    }, i);
                } catch (err) {
                    console.log(`  [${i}] 无法获取属性: ${err.message}`);
                }
            }
        }

        // 测试继续按钮
        console.log('🔍 测试继续按钮选择器...');
        try {
            const continueBtn = page.getByRole('button', { name: 'Continue to Payment' });
            await continueBtn.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✅ 继续按钮定位成功！');

            // 高亮显示按钮
            await continueBtn.evaluate(el => {
                el.style.border = '3px solid blue';
                el.style.backgroundColor = '#ADD8E6';
            });

        } catch (e) {
            console.log('❌ 继续按钮测试失败:', e.message);

            // 查找所有按钮
            console.log('🔍 查找页面上所有按钮...');
            const allButtons = await page.locator('button, input[type="submit"], input[type="button"]').all();

            console.log(`📋 找到 ${allButtons.length} 个按钮:`);
            for (let i = 0; i < allButtons.length; i++) {
                try {
                    const button = allButtons[i];
                    const text = await button.textContent() || '';
                    const value = await button.getAttribute('value') || '';
                    const type = await button.getAttribute('type') || '';

                    console.log(`  [${i}] text="${text.trim()}" value="${value}" type="${type}"`);

                    // 高亮显示
                    await button.evaluate((el, index) => {
                        el.style.border = '2px solid orange';
                        el.style.backgroundColor = '#FFEFD5';
                        el.setAttribute('data-test-index', index);
                    }, i);
                } catch (err) {
                    console.log(`  [${i}] 无法获取按钮信息: ${err.message}`);
                }
            }
        }

        console.log('⏸️  测试完成！请检查页面上高亮的元素，按 Enter 继续...');
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
testPayPalEmailFix().catch(console.error);