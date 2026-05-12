/**
 * PayPal 页面 DOM 结构调试脚本
 * 用于分析实际的 PayPal 页面结构，验证选择器的准确性
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// 调试配置
const DEBUG_CONFIG = {
    headless: false,
    devtools: true,
    slowMo: 500, // 减慢操作速度便于观察
    timeout: 60000
};

// 创建调试报告目录
function ensureDebugDir() {
    const debugDir = path.join(__dirname, 'debug_reports');
    if (!fs.existsSync(debugDir)) {
        fs.mkdirSync(debugDir, { recursive: true });
    }
    return debugDir;
}

// 生成详细的 DOM 分析报告
async function generateDOMReport(page, reportName) {
    console.log(`📊 生成 DOM 分析报告: ${reportName}`);

    const analysis = await page.evaluate(() => {
        const report = {
            url: window.location.href,
            title: document.title,
            timestamp: new Date().toISOString(),
            forms: [],
            inputs: [],
            buttons: [],
            selects: [],
            errors: [],
            captchas: []
        };

        // 分析表单
        document.querySelectorAll('form').forEach((form, index) => {
            report.forms.push({
                index,
                id: form.id || '',
                className: form.className || '',
                action: form.action || '',
                method: form.method || 'GET',
                fieldCount: form.querySelectorAll('input, select, textarea').length
            });
        });

        // 分析输入框
        document.querySelectorAll('input').forEach((input, index) => {
            const rect = input.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0 &&
                             window.getComputedStyle(input).visibility !== 'hidden' &&
                             window.getComputedStyle(input).display !== 'none';

            report.inputs.push({
                index,
                type: input.type || 'text',
                id: input.id || '',
                name: input.name || '',
                className: input.className || '',
                placeholder: input.placeholder || '',
                value: input.value || '',
                required: input.required,
                disabled: input.disabled,
                readonly: input.readOnly,
                visible: isVisible,
                position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                autocomplete: input.autocomplete || '',
                maxLength: input.maxLength || -1
            });
        });

        // 分析按钮
        document.querySelectorAll('button, input[type="button"], input[type="submit"]').forEach((btn, index) => {
            const rect = btn.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0 &&
                             window.getComputedStyle(btn).visibility !== 'hidden' &&
                             window.getComputedStyle(btn).display !== 'none';

            report.buttons.push({
                index,
                tagName: btn.tagName.toLowerCase(),
                type: btn.type || 'button',
                id: btn.id || '',
                className: btn.className || '',
                textContent: btn.textContent?.trim() || '',
                value: btn.value || '',
                disabled: btn.disabled,
                visible: isVisible,
                position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
            });
        });

        // 分析下拉框
        document.querySelectorAll('select').forEach((select, index) => {
            const rect = select.getBoundingClientRect();
            const isVisible = rect.width > 0 && rect.height > 0 &&
                             window.getComputedStyle(select).visibility !== 'hidden' &&
                             window.getComputedStyle(select).display !== 'none';

            const options = Array.from(select.options).map(option => ({
                value: option.value,
                text: option.text,
                selected: option.selected
            }));

            report.selects.push({
                index,
                id: select.id || '',
                name: select.name || '',
                className: select.className || '',
                disabled: select.disabled,
                visible: isVisible,
                position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                options
            });
        });

        // 分析错误信息
        const errorSelectors = [
            '.error', '.alert-error', '[class*="error"]', '[class*="invalid"]',
            '.field-error', '.validation-error', '.form-error', '.input-error'
        ];

        errorSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach((error, index) => {
                const rect = error.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0 &&
                                 window.getComputedStyle(error).visibility !== 'hidden' &&
                                 window.getComputedStyle(error).display !== 'none';

                if (isVisible && error.textContent?.trim()) {
                    report.errors.push({
                        selector,
                        index,
                        id: error.id || '',
                        className: error.className || '',
                        textContent: error.textContent.trim(),
                        position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
                    });
                }
            });
        });

        // 分析验证码/滑块
        const captchaSelectors = [
            '.slider', '.captcha', '[class*="slider"]', '[class*="captcha"]',
            '.challenge', '.verification', '.recaptcha'
        ];

        captchaSelectors.forEach(selector => {
            document.querySelectorAll(selector).forEach((captcha, index) => {
                const rect = captcha.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0 &&
                                 window.getComputedStyle(captcha).visibility !== 'hidden' &&
                                 window.getComputedStyle(captcha).display !== 'none';

                if (isVisible) {
                    report.captchas.push({
                        selector,
                        index,
                        id: captcha.id || '',
                        className: captcha.className || '',
                        tagName: captcha.tagName.toLowerCase(),
                        position: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
                    });
                }
            });
        });

        return report;
    });

    // 保存报告
    const debugDir = ensureDebugDir();
    const reportPath = path.join(debugDir, `${reportName}_${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(analysis, null, 2));

    console.log(`📄 DOM 报告已保存: ${reportPath}`);
    return analysis;
}

// 测试选择器的准确性
async function testSelectors(page) {
    console.log("🎯 测试 PayPal 页面选择器准确性");

    const selectorTests = {
        // 邮箱字段
        email: [
            '#login_email',
            '#email',
            'input[type="email"]',
            'input[name*="email"]',
            'input[placeholder*="email"]'
        ],
        // 卡号字段
        cardNumber: [
            '#cardNumber',
            '#card-number',
            'input[name*="card"]',
            '[data-testid*="card"]',
            'input[placeholder*="card"]'
        ],
        // 有效期字段
        expiry: [
            '#expiryDate',
            '#expiry',
            'input[name*="expiry"]',
            'input[placeholder*="expiry"]',
            'input[placeholder*="MM/YY"]'
        ],
        // CVC字段
        cvc: [
            '#cvv',
            '#cvc',
            'input[name*="cvv"]',
            'input[name*="cvc"]',
            'input[placeholder*="CVV"]'
        ],
        // 姓名字段
        firstName: [
            '#firstName',
            '#first-name',
            'input[name*="first"]',
            'input[placeholder*="First"]'
        ],
        lastName: [
            '#lastName',
            '#last-name',
            'input[name*="last"]',
            'input[placeholder*="Last"]'
        ],
        // 地址字段
        address: [
            '#billingLine1',
            '#address',
            'input[name*="address"]',
            'input[name*="street"]'
        ],
        city: [
            '#billingCity',
            '#city',
            'input[name*="city"]'
        ],
        state: [
            '#billingState',
            '#state',
            'select[name*="state"]'
        ],
        zip: [
            '#billingPostalCode',
            '#postalCode',
            '#zipCode',
            'input[name*="zip"]',
            'input[name*="postal"]'
        ],
        // 密码字段
        password: [
            '#password',
            'input[type="password"]',
            'input[name*="password"]'
        ],
        // 手机号字段
        phone: [
            '#phone',
            'input[type="tel"]',
            'input[name*="phone"]'
        ],
        // 按钮
        createAccount: [
            'button:has-text("Create an Account")',
            'button[data-testid*="create"]',
            '.create-account-button'
        ],
        continue: [
            'button:has-text("Continue to Payment")',
            'button:has-text("Continue")',
            'button:has-text("Next")'
        ],
        submit: [
            'button:has-text("Agree & Create Account")',
            'button:has-text("Create Account")',
            'button[type="submit"]'
        ]
    };

    const results = {};

    for (const [fieldName, selectors] of Object.entries(selectorTests)) {
        console.log(`🔍 测试 ${fieldName} 字段选择器...`);
        results[fieldName] = [];

        for (const selector of selectors) {
            try {
                const elements = page.locator(selector);
                const count = await elements.count();
                const isVisible = count > 0 ? await elements.first().isVisible().catch(() => false) : false;
                const isEnabled = count > 0 && isVisible ? await elements.first().isEnabled().catch(() => false) : false;

                results[fieldName].push({
                    selector,
                    count,
                    visible: isVisible,
                    enabled: isEnabled,
                    success: count > 0 && isVisible && isEnabled
                });

                if (count > 0 && isVisible && isEnabled) {
                    console.log(`  ✅ ${selector} - 找到 ${count} 个元素，可见且可用`);
                } else if (count > 0 && isVisible) {
                    console.log(`  ⚠️ ${selector} - 找到 ${count} 个元素，可见但不可用`);
                } else if (count > 0) {
                    console.log(`  ⚠️ ${selector} - 找到 ${count} 个元素，但不可见`);
                } else {
                    console.log(`  ❌ ${selector} - 未找到元素`);
                }
            } catch (error) {
                results[fieldName].push({
                    selector,
                    count: 0,
                    visible: false,
                    enabled: false,
                    success: false,
                    error: error.message
                });
                console.log(`  ❌ ${selector} - 错误: ${error.message}`);
            }
        }
    }

    // 保存选择器测试结果
    const debugDir = ensureDebugDir();
    const resultPath = path.join(debugDir, `selector_test_${Date.now()}.json`);
    fs.writeFileSync(resultPath, JSON.stringify(results, null, 2));

    console.log(`📄 选择器测试结果已保存: ${resultPath}`);
    return results;
}

// 监控页面变化
async function monitorPageChanges(page, duration = 30000) {
    console.log(`👀 监控页面变化 ${duration/1000} 秒...`);

    const changes = [];
    let changeCount = 0;

    // 监听 DOM 变化
    await page.addInitScript(() => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            window.domChanges = window.domChanges || [];
                            window.domChanges.push({
                                type: 'added',
                                tagName: node.tagName,
                                id: node.id || '',
                                className: node.className || '',
                                timestamp: Date.now()
                            });
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });

    // 等待指定时间
    await page.waitForTimeout(duration);

    // 获取变化记录
    const domChanges = await page.evaluate(() => window.domChanges || []);

    console.log(`📊 监控期间发现 ${domChanges.length} 次 DOM 变化`);

    // 保存变化记录
    const debugDir = ensureDebugDir();
    const changesPath = path.join(debugDir, `page_changes_${Date.now()}.json`);
    fs.writeFileSync(changesPath, JSON.stringify(domChanges, null, 2));

    return domChanges;
}

// 主调试函数
async function debugPayPalPage(paypalUrl = 'https://www.paypal.com/signin') {
    console.log("🚀 开始 PayPal 页面调试");

    const browser = await chromium.launch({
        headless: DEBUG_CONFIG.headless,
        devtools: DEBUG_CONFIG.devtools,
        slowMo: DEBUG_CONFIG.slowMo,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ]
    });

    const context = await browser.newContext({
        viewport: { width: 1366, height: 768 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();

    try {
        console.log(`📍 导航到: ${paypalUrl}`);
        await page.goto(paypalUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // 等待页面稳定
        await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

        // 生成初始 DOM 报告
        await generateDOMReport(page, 'initial_page');

        // 测试选择器
        await testSelectors(page);

        // 截图
        const debugDir = ensureDebugDir();
        await page.screenshot({
            path: path.join(debugDir, `initial_screenshot_${Date.now()}.png`),
            fullPage: true
        });

        // 如果在登录页面，尝试进入注册流程
        const createAccountBtn = page.locator('button:has-text("Create an Account"), a:has-text("Sign Up")').first();
        if (await createAccountBtn.isVisible().catch(() => false)) {
            console.log("🔄 点击创建账户按钮");
            await createAccountBtn.click();
            await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});

            // 生成注册页面报告
            await generateDOMReport(page, 'signup_page');
            await testSelectors(page);
            await page.screenshot({
                path: path.join(debugDir, `signup_screenshot_${Date.now()}.png`),
                fullPage: true
            });
        }

        // 监控页面变化
        console.log("👀 开始监控页面动态变化...");
        await monitorPageChanges(page, 30000);

        // 最终报告
        await generateDOMReport(page, 'final_page');

        console.log("✅ PayPal 页面调试完成");
        console.log(`📁 调试报告保存在: ${debugDir}`);

        // 保持浏览器打开以便手动检查
        console.log("🔍 浏览器将保持打开状态，请手动检查...");
        await page.waitForTimeout(300000); // 5分钟

    } catch (error) {
        console.error("❌ 调试过程中发生错误:", error);

        // 错误截图
        const debugDir = ensureDebugDir();
        await page.screenshot({
            path: path.join(debugDir, `error_screenshot_${Date.now()}.png`),
            fullPage: true
        });

        // 生成错误报告
        await generateDOMReport(page, 'error_page');
    } finally {
        await browser.close();
    }
}

// 运行调试
if (require.main === module) {
    const paypalUrl = process.argv[2] || 'https://www.paypal.com/signin';
    debugPayPalPage(paypalUrl).catch(console.error);
}

module.exports = {
    debugPayPalPage,
    generateDOMReport,
    testSelectors,
    monitorPageChanges
};