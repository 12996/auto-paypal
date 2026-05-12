const { chromium } = require('playwright');

/**
 * Stripe 提交按钮调试脚本
 * 专门诊断点击后不跳转到 PayPal 的问题
 */

class StripeSubmitDebugger {
    constructor() {
        this.page = null;
        this.browser = null;
        this.debugLog = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
        console.log(logEntry);
        this.debugLog.push(logEntry);
    }

    async init() {
        this.browser = await chromium.launch({
            headless: false,
            devtools: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor'
            ]
        });

        const context = await this.browser.newContext({
            viewport: { width: 1366, height: 768 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        this.page = await context.newPage();

        // 监听所有网络请求
        this.page.on('request', request => {
            this.log(`REQUEST: ${request.method()} ${request.url()}`, 'network');
        });

        this.page.on('response', response => {
            this.log(`RESPONSE: ${response.status()} ${response.url()}`, 'network');
        });

        // 监听控制台输出
        this.page.on('console', msg => {
            this.log(`CONSOLE: ${msg.type()} - ${msg.text()}`, 'console');
        });

        // 监听页面错误
        this.page.on('pageerror', error => {
            this.log(`PAGE ERROR: ${error.message}`, 'error');
        });

        // 监听导航事件
        this.page.on('framenavigated', frame => {
            if (frame === this.page.mainFrame()) {
                this.log(`NAVIGATION: ${frame.url()}`, 'navigation');
            }
        });
    }

    async analyzeSubmitButton() {
        this.log("=== 开始分析提交按钮 ===");

        // 1. 检查按钮是否存在和可见
        const buttonSelector = '.SubmitButton-IconContainer';
        const button = this.page.locator(buttonSelector);

        const isVisible = await button.isVisible().catch(() => false);
        this.log(`按钮可见性: ${isVisible}`);

        if (!isVisible) {
            // 尝试其他可能的选择器
            const alternativeSelectors = [
                'button[type="submit"]',
                '.SubmitButton',
                '[data-testid="hosted-payment-submit-button"]',
                'button:has-text("Complete order")',
                'button:has-text("Pay")'
            ];

            for (const selector of alternativeSelectors) {
                const altButton = this.page.locator(selector);
                const altVisible = await altButton.isVisible().catch(() => false);
                this.log(`备选按钮 ${selector}: ${altVisible}`);
                if (altVisible) {
                    return selector;
                }
            }
            return null;
        }

        // 2. 检查按钮属性
        const buttonElement = await button.elementHandle();
        if (buttonElement) {
            const attributes = await buttonElement.evaluate(el => {
                return {
                    disabled: el.disabled,
                    type: el.type,
                    className: el.className,
                    id: el.id,
                    innerHTML: el.innerHTML,
                    offsetWidth: el.offsetWidth,
                    offsetHeight: el.offsetHeight,
                    style: el.style.cssText
                };
            });

            this.log(`按钮属性: ${JSON.stringify(attributes, null, 2)}`);
        }

        // 3. 检查按钮的父元素和表单状态
        const formInfo = await this.page.evaluate(() => {
            const button = document.querySelector('.SubmitButton-IconContainer');
            if (!button) return null;

            const form = button.closest('form');
            return {
                hasForm: !!form,
                formAction: form?.action || 'none',
                formMethod: form?.method || 'none',
                formValid: form?.checkValidity() || false,
                buttonInForm: form?.contains(button) || false
            };
        });

        this.log(`表单信息: ${JSON.stringify(formInfo, null, 2)}`);

        return buttonSelector;
    }

    async checkFormValidation() {
        this.log("=== 检查表单验证状态 ===");

        const validationInfo = await this.page.evaluate(() => {
            const inputs = document.querySelectorAll('input[required], input[data-required="true"]');
            const results = [];

            inputs.forEach((input, index) => {
                results.push({
                    index,
                    id: input.id,
                    name: input.name,
                    type: input.type,
                    value: input.value,
                    required: input.required,
                    valid: input.checkValidity(),
                    validationMessage: input.validationMessage
                });
            });

            return results;
        });

        validationInfo.forEach(info => {
            this.log(`输入框 ${info.id || info.name}: 值="${info.value}" 有效=${info.valid} 消息="${info.validationMessage}"`);
        });

        return validationInfo;
    }

    async testClickStrategies(buttonSelector) {
        this.log("=== 测试不同的点击策略 ===");

        const button = this.page.locator(buttonSelector);
        const strategies = [
            {
                name: '标准点击',
                action: async () => await button.click()
            },
            {
                name: '强制点击',
                action: async () => await button.click({ force: true })
            },
            {
                name: 'JavaScript点击',
                action: async () => await this.page.evaluate((sel) => {
                    const btn = document.querySelector(sel);
                    if (btn) btn.click();
                }, buttonSelector)
            },
            {
                name: '鼠标按压点击（当前实现）',
                action: async () => {
                    const box = await button.boundingBox();
                    if (box) {
                        const x = box.x + box.width / 2;
                        const y = box.y + box.height / 2;
                        await this.page.mouse.move(x, y);
                        await this.page.mouse.down();
                        await this.page.waitForTimeout(150);
                        await this.page.mouse.up();
                    }
                }
            },
            {
                name: '键盘回车',
                action: async () => {
                    await button.focus();
                    await this.page.keyboard.press('Enter');
                }
            }
        ];

        for (const strategy of strategies) {
            this.log(`测试策略: ${strategy.name}`);

            try {
                // 记录点击前的URL
                const beforeUrl = this.page.url();
                this.log(`点击前URL: ${beforeUrl}`);

                // 执行点击
                await strategy.action();
                this.log(`${strategy.name} 执行完成`);

                // 等待可能的导航或网络请求
                await this.page.waitForTimeout(3000);

                // 检查URL是否改变
                const afterUrl = this.page.url();
                this.log(`点击后URL: ${afterUrl}`);

                if (beforeUrl !== afterUrl) {
                    this.log(`✅ ${strategy.name} 成功触发导航!`, 'success');
                    return strategy.name;
                } else {
                    this.log(`❌ ${strategy.name} 未触发导航`, 'warning');
                }

            } catch (error) {
                this.log(`❌ ${strategy.name} 执行失败: ${error.message}`, 'error');
            }

            // 策略间等待
            await this.page.waitForTimeout(1000);
        }

        return null;
    }

    async checkNetworkActivity() {
        this.log("=== 检查网络活动 ===");

        // 监听特定的网络请求
        const networkPromises = [];

        this.page.on('request', request => {
            const url = request.url();
            if (url.includes('stripe') || url.includes('paypal') || url.includes('checkout')) {
                networkPromises.push({
                    type: 'request',
                    url: url,
                    method: request.method()
                });
            }
        });

        this.page.on('response', response => {
            const url = response.url();
            if (url.includes('stripe') || url.includes('paypal') || url.includes('checkout')) {
                networkPromises.push({
                    type: 'response',
                    url: url,
                    status: response.status()
                });
            }
        });

        return networkPromises;
    }

    async checkElementObstructions(buttonSelector) {
        this.log("=== 检查元素遮挡 ===");

        const obstructionInfo = await this.page.evaluate((sel) => {
            const button = document.querySelector(sel);
            if (!button) return null;

            const rect = button.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;

            const elementAtPoint = document.elementFromPoint(centerX, centerY);

            return {
                buttonRect: {
                    x: rect.left,
                    y: rect.top,
                    width: rect.width,
                    height: rect.height
                },
                elementAtCenter: {
                    tagName: elementAtPoint?.tagName,
                    className: elementAtPoint?.className,
                    id: elementAtPoint?.id,
                    isButton: elementAtPoint === button
                },
                zIndex: window.getComputedStyle(button).zIndex,
                visibility: window.getComputedStyle(button).visibility,
                display: window.getComputedStyle(button).display,
                pointerEvents: window.getComputedStyle(button).pointerEvents
            };
        }, buttonSelector);

        this.log(`遮挡检查结果: ${JSON.stringify(obstructionInfo, null, 2)}`);
        return obstructionInfo;
    }

    async runFullDiagnosis(stripeUrl) {
        try {
            await this.init();
            this.log(`导航到 Stripe 页面: ${stripeUrl}`);
            await this.page.goto(stripeUrl, { waitUntil: 'domcontentloaded' });

            // 等待页面完全加载
            await this.page.waitForTimeout(3000);

            // 1. 分析提交按钮
            const buttonSelector = await this.analyzeSubmitButton();
            if (!buttonSelector) {
                this.log("❌ 未找到提交按钮!", 'error');
                return;
            }

            // 2. 检查表单验证
            await this.checkFormValidation();

            // 3. 检查元素遮挡
            await this.checkElementObstructions(buttonSelector);

            // 4. 设置网络监听
            await this.checkNetworkActivity();

            // 5. 测试不同点击策略
            const successfulStrategy = await this.testClickStrategies(buttonSelector);

            if (successfulStrategy) {
                this.log(`✅ 成功策略: ${successfulStrategy}`, 'success');
            } else {
                this.log("❌ 所有点击策略都失败了", 'error');
            }

            // 6. 生成诊断报告
            await this.generateReport();

        } catch (error) {
            this.log(`诊断过程出错: ${error.message}`, 'error');
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }

    async generateReport() {
        this.log("=== 生成诊断报告 ===");

        const reportPath = 'F:\\work\\email\\plus_gopay_gptp-plus-main\\stripe_debug_report.txt';
        const fs = require('fs');

        const report = [
            '='.repeat(60),
            'STRIPE 提交按钮诊断报告',
            '='.repeat(60),
            '',
            ...this.debugLog,
            '',
            '='.repeat(60),
            '报告结束',
            '='.repeat(60)
        ].join('\n');

        fs.writeFileSync(reportPath, report, 'utf8');
        this.log(`诊断报告已保存到: ${reportPath}`);
    }
}

// 使用示例
async function main() {
    const stripeDebugger = new StripeSubmitDebugger();

    // 这里需要一个实际的 Stripe Checkout URL
    // 你需要替换为实际的测试URL
    const stripeUrl = 'YOUR_STRIPE_CHECKOUT_URL_HERE';

    console.log('开始 Stripe 提交按钮诊断...');
    await stripeDebugger.runFullDiagnosis(stripeUrl);
}

// 如果直接运行此脚本
if (require.main === module) {
    main().catch(console.error);
}

module.exports = StripeSubmitDebugger;