/**
 * Stripe 提交按钮调试脚本
 * 用于诊断提交按钮点击后不跳转的问题
 */

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
chromium.use(StealthPlugin());

async function debugSubmitButton() {
    console.log('🔍 [调试] 启动 Stripe 提交按钮诊断...');

    const browser = await chromium.launch({
        headless: false,
        args: ['--disable-blink-features=AutomationControlled']
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    // 从命令行参数获取 URL，或使用默认测试 URL
    const targetUrl = process.argv[2] || 'https://checkout.stripe.com/c/pay/cs_test_example';

    try {
        console.log(`📍 [调试] 导航到: ${targetUrl}`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // 等待页面完全加载
        await page.waitForTimeout(3000);

        // 1. 检查提交按钮状态
        console.log('\n=== 提交按钮状态检查 ===');

        const submitSelectors = [
            'button[type="submit"]',
            '.SubmitButton',
            '[data-testid="hosted-payment-submit-button"]',
            'button:has-text("Complete order")',
            'button:has-text("Pay")',
            'button:has-text("Submit")'
        ];

        let submitButton = null;
        let usedSelector = '';

        for (const selector of submitSelectors) {
            try {
                const btn = page.locator(selector).first();
                if (await btn.isVisible({ timeout: 1000 })) {
                    submitButton = btn;
                    usedSelector = selector;
                    console.log(`✅ [调试] 找到提交按钮: ${selector}`);
                    break;
                }
            } catch (e) {
                console.log(`❌ [调试] 按钮不存在: ${selector}`);
            }
        }

        if (!submitButton) {
            console.log('❌ [调试] 未找到提交按钮！');
            return;
        }

        // 2. 检查按钮属性
        console.log('\n=== 按钮属性检查 ===');
        const isEnabled = await submitButton.isEnabled();
        const isVisible = await submitButton.isVisible();
        const buttonText = await submitButton.textContent();
        const buttonClass = await submitButton.getAttribute('class');
        const buttonDisabled = await submitButton.getAttribute('disabled');

        console.log(`按钮文本: "${buttonText}"`);
        console.log(`按钮类名: ${buttonClass}`);
        console.log(`是否可见: ${isVisible}`);
        console.log(`是否启用: ${isEnabled}`);
        console.log(`disabled 属性: ${buttonDisabled}`);

        // 3. 检查表单验证状态
        console.log('\n=== 表单验证状态检查 ===');

        // 检查常见的错误提示元素
        const errorSelectors = [
            '.Error',
            '.FieldError',
            '[role="alert"]',
            '.error-message',
            '.validation-error'
        ];

        for (const selector of errorSelectors) {
            try {
                const errors = await page.locator(selector).all();
                for (let i = 0; i < errors.length; i++) {
                    const errorText = await errors[i].textContent();
                    if (errorText && errorText.trim()) {
                        console.log(`⚠️ [调试] 发现错误信息: "${errorText.trim()}"`);
                    }
                }
            } catch (e) {
                // 忽略不存在的选择器
            }
        }

        // 4. 检查表单字段状态
        console.log('\n=== 表单字段状态检查 ===');

        const fieldSelectors = [
            '#billingName',
            '#billingAddressLine1',
            '#billingAddressCity',
            '#billingAddressState',
            '#billingPostalCode',
            '#cardNumber',
            '#cardExpiry',
            '#cardCvc'
        ];

        for (const selector of fieldSelectors) {
            try {
                const field = page.locator(selector);
                if (await field.isVisible({ timeout: 500 })) {
                    const value = await field.inputValue();
                    const isRequired = await field.getAttribute('required');
                    const hasError = await field.evaluate(el => el.classList.contains('error') || el.classList.contains('invalid'));

                    console.log(`${selector}: "${value}" (必填: ${isRequired !== null}, 错误: ${hasError})`);
                }
            } catch (e) {
                console.log(`${selector}: 不存在或不可访问`);
            }
        }

        // 5. 尝试不同的点击方式
        console.log('\n=== 点击测试 ===');

        if (isEnabled && isVisible) {
            console.log('🖱️ [调试] 尝试 Playwright 标准点击...');

            // 方法1: 标准点击
            try {
                await submitButton.click({ timeout: 5000 });
                console.log('✅ [调试] 标准点击成功');

                // 等待页面变化
                await page.waitForTimeout(2000);

                // 检查 URL 是否改变
                const newUrl = page.url();
                console.log(`当前 URL: ${newUrl}`);

                if (newUrl !== targetUrl) {
                    console.log('✅ [调试] 页面已跳转！');
                } else {
                    console.log('❌ [调试] 页面未跳转');

                    // 方法2: 强制点击
                    console.log('🖱️ [调试] 尝试强制点击...');
                    await submitButton.click({ force: true });
                    await page.waitForTimeout(2000);

                    const finalUrl = page.url();
                    if (finalUrl !== newUrl) {
                        console.log('✅ [调试] 强制点击后页面跳转！');
                    } else {
                        console.log('❌ [调试] 强制点击后仍未跳转');

                        // 方法3: JavaScript 点击
                        console.log('🖱️ [调试] 尝试 JavaScript 点击...');
                        await submitButton.evaluate(el => el.click());
                        await page.waitForTimeout(2000);

                        const jsUrl = page.url();
                        if (jsUrl !== finalUrl) {
                            console.log('✅ [调试] JavaScript 点击后页面跳转！');
                        } else {
                            console.log('❌ [调试] JavaScript 点击后仍未跳转');
                        }
                    }
                }

            } catch (e) {
                console.log(`❌ [调试] 点击失败: ${e.message}`);
            }
        } else {
            console.log('❌ [调试] 按钮不可点击（disabled 或不可见）');
        }

        // 6. 截图保存
        const screenshotPath = `debug_submit_${Date.now()}.png`;
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 [调试] 截图已保存: ${screenshotPath}`);

        // 保持浏览器打开以便手动检查
        console.log('\n🔍 [调试] 浏览器将保持打开状态，请手动检查页面...');
        console.log('按 Ctrl+C 退出');

        // 等待用户手动关闭
        await new Promise(() => {});

    } catch (error) {
        console.error(`❌ [调试] 发生错误: ${error.message}`);
    } finally {
        // 不自动关闭浏览器，让用户手动检查
        // await browser.close();
    }
}

// 运行调试
debugSubmitButton().catch(console.error);