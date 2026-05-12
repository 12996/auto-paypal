const { chromium } = require('playwright');

/**
 * Stripe 提交按钮修复脚本
 * 基于 index.js 代码分析，提供多种修复策略
 */

class StripeSubmitFixer {
    constructor() {
        this.page = null;
        this.browser = null;
    }

    // 复制 index.js 中的 randomDelay 函数
    randomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // 复制 index.js 中的 mouseBreathing 函数
    async mouseBreathing(page, duration) {
        const startTime = Date.now();
        while (Date.now() - startTime < duration) {
            const currentX = page.lastMouseX || 683;
            const currentY = page.lastMouseY || 384;
            const newX = currentX + this.randomDelay(-5, 5);
            const newY = currentY + this.randomDelay(-5, 5);
            await page.mouse.move(newX, newY, { steps: 2 });
            page.lastMouseX = newX;
            page.lastMouseY = newY;
            await page.waitForTimeout(this.randomDelay(80, 200));
        }
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

        // 初始化鼠标位置
        this.page.lastMouseX = 683;
        this.page.lastMouseY = 384;

        // 监听网络和导航事件
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.page.on('request', request => {
            const url = request.url();
            if (url.includes('stripe') || url.includes('paypal') || url.includes('checkout')) {
                console.log(`📡 关键请求: ${request.method()} ${url}`);
            }
        });

        this.page.on('response', response => {
            const url = response.url();
            if (url.includes('stripe') || url.includes('paypal') || url.includes('checkout')) {
                console.log(`📨 关键响应: ${response.status()} ${url}`);
            }
        });

        this.page.on('framenavigated', frame => {
            if (frame === this.page.mainFrame()) {
                console.log(`🔄 页面导航: ${frame.url()}`);
            }
        });

        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log(`❌ 控制台错误: ${msg.text()}`);
            }
        });

        this.page.on('pageerror', error => {
            console.log(`💥 页面错误: ${error.message}`);
        });
    }

    // 复制 index.js 中的表单验证逻辑
    async validateStripeCompleteness() {
        console.log('🔍 开始 Stripe 表单完整性验证...');

        const CONFIG = {
            billing: {
                name: 'John Doe',
                address: '123 Main St',
                city: 'New York',
                state: 'NY',
                zip: '10001'
            }
        };

        const criticalSelectors = [
            { sel: '#billingName', name: "姓名", configKey: 'name' },
            { sel: '#billingAddressLine1', name: "街道地址", configKey: 'address' },
            { sel: '#billingAddressCity', name: "城市", configKey: 'city' },
            { sel: '#billingAddressState', name: "州/省", configKey: 'state' },
            { sel: '#billingPostalCode', name: "邮编", configKey: 'zip' }
        ];

        let refilledCount = 0;
        let syncedCount = 0;

        for (const item of criticalSelectors) {
            const el = this.page.locator(item.sel);
            if (await el.isVisible().catch(() => false)) {
                const currentValue = await el.inputValue().catch(() => "");
                const configValue = CONFIG.billing[item.configKey];

                if (!currentValue || currentValue.trim().length < 1) {
                    console.warn(`⚠️ ${item.name} 为空，需要填写`);
                    refilledCount++;
                } else if (currentValue !== configValue && currentValue.trim().length > 0) {
                    console.log(`ℹ️ ${item.name} 自动填充: "${currentValue}"`);
                    syncedCount++;
                }
            }
        }

        if (refilledCount === 0 && syncedCount === 0) {
            console.log(`✅ Stripe 表单完整性验证通过`);
        } else {
            console.log(`⚠️ 表单需要处理 (空字段: ${refilledCount}, 不匹配: ${syncedCount})`);
        }

        return { refilledCount, syncedCount };
    }

    // 改进的按钮点击策略
    async improvedButtonClick() {
        console.log('🎯 开始改进的按钮点击流程...');

        // 1. 多种选择器尝试找到按钮
        const buttonSelectors = [
            '.SubmitButton-IconContainer',
            'button[type="submit"]',
            '.SubmitButton',
            '[data-testid="hosted-payment-submit-button"]',
            'button:has-text("Complete order")',
            'button:has-text("Pay")'
        ];

        let button = null;
        let usedSelector = null;

        for (const selector of buttonSelectors) {
            const testButton = this.page.locator(selector);
            if (await testButton.isVisible().catch(() => false)) {
                button = testButton;
                usedSelector = selector;
                console.log(`✅ 找到按钮: ${selector}`);
                break;
            }
        }

        if (!button) {
            throw new Error('未找到任何提交按钮');
        }

        // 2. 等待按钮完全可用
        try {
            await button.waitFor({ state: 'visible', timeout: 10000 });
            await button.waitFor({ state: 'attached', timeout: 5000 });
        } catch (error) {
            console.log('🔄 按钮未就绪，尝试刷新页面...');
            await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
            await this.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
            await button.waitFor({ state: 'visible', timeout: 30000 });
        }

        // 3. 检查按钮状态
        const buttonState = await this.page.evaluate((sel) => {
            const btn = document.querySelector(sel);
            if (!btn) return null;

            const rect = btn.getBoundingClientRect();
            const style = window.getComputedStyle(btn);

            return {
                disabled: btn.disabled || btn.hasAttribute('disabled'),
                visible: rect.width > 0 && rect.height > 0,
                clickable: style.pointerEvents !== 'none',
                zIndex: style.zIndex,
                position: {
                    x: rect.left,
                    y: rect.top,
                    width: rect.width,
                    height: rect.height
                }
            };
        }, usedSelector);

        console.log('🔍 按钮状态:', JSON.stringify(buttonState, null, 2));

        if (buttonState.disabled) {
            throw new Error('按钮处于禁用状态');
        }

        if (!buttonState.clickable) {
            throw new Error('按钮不可点击 (pointer-events: none)');
        }

        // 4. 执行多种点击策略
        const strategies = [
            {
                name: '原版鼠标按压点击',
                execute: async () => await this.originalMousePressClick(button)
            },
            {
                name: '标准点击',
                execute: async () => await button.click()
            },
            {
                name: '强制点击',
                execute: async () => await button.click({ force: true })
            },
            {
                name: 'JavaScript点击',
                execute: async () => await this.page.evaluate((sel) => {
                    const btn = document.querySelector(sel);
                    if (btn) {
                        btn.click();
                        return true;
                    }
                    return false;
                }, usedSelector)
            },
            {
                name: '表单提交',
                execute: async () => await this.page.evaluate(() => {
                    const form = document.querySelector('form');
                    if (form) {
                        form.submit();
                        return true;
                    }
                    return false;
                })
            }
        ];

        for (const strategy of strategies) {
            console.log(`🧪 尝试策略: ${strategy.name}`);

            try {
                const beforeUrl = this.page.url();
                const beforeTime = Date.now();

                // 执行点击策略
                await strategy.execute();

                // 等待响应
                const success = await this.waitForNavigation(beforeUrl, 8000);

                if (success) {
                    console.log(`✅ 策略 "${strategy.name}" 成功!`);
                    return strategy.name;
                } else {
                    console.log(`❌ 策略 "${strategy.name}" 未触发导航`);
                }

            } catch (error) {
                console.log(`❌ 策略 "${strategy.name}" 执行失败: ${error.message}`);
            }

            // 策略间等待
            await this.page.waitForTimeout(1000);
        }

        throw new Error('所有点击策略都失败了');
    }

    // 复制原版的鼠标按压点击逻辑
    async originalMousePressClick(button) {
        const box = await button.boundingBox();
        if (!box) {
            throw new Error('无法获取按钮位置');
        }

        // Step 1: 视线移到按钮上方
        const glanceX = box.x + this.randomDelay(-60, box.width + 60);
        const glanceY = box.y - this.randomDelay(60, 140);
        await this.page.mouse.move(glanceX, glanceY, { steps: this.randomDelay(25, 40) });
        this.page.lastMouseX = glanceX;
        this.page.lastMouseY = glanceY;
        await this.page.waitForTimeout(this.randomDelay(600, 1400));

        // Step 2: 弧形移动到按钮左侧
        const midX = box.x - this.randomDelay(10, 50);
        const midY = box.y + this.randomDelay(5, box.height - 5);
        await this.page.mouse.move(midX, midY, { steps: this.randomDelay(15, 25) });
        this.page.lastMouseX = midX;
        this.page.lastMouseY = midY;
        await this.page.waitForTimeout(this.randomDelay(200, 500));

        // Step 3: 最终定位到按钮
        const btnCenterX = box.x + box.width / 2;
        const btnCenterY = box.y + box.height / 2;
        const clickX = btnCenterX + this.randomDelay(-Math.floor(box.width * 0.3), Math.floor(box.width * 0.3));
        const clickY = btnCenterY + this.randomDelay(-Math.floor(box.height * 0.3), Math.floor(box.height * 0.3));

        await this.page.mouse.move(clickX, clickY, { steps: this.randomDelay(10, 18) });
        this.page.lastMouseX = clickX;
        this.page.lastMouseY = clickY;
        await this.page.waitForTimeout(this.randomDelay(400, 1000));

        // Step 4: 25% 概率犹豫
        if (Math.random() < 0.25) {
            const wanderX = clickX + this.randomDelay(-80, 80);
            const wanderY = clickY + this.randomDelay(20, 80);
            await this.page.mouse.move(wanderX, wanderY, { steps: 12 });
            await this.page.waitForTimeout(this.randomDelay(300, 800));
            await this.page.mouse.move(clickX, clickY, { steps: this.randomDelay(8, 15) });
            await this.page.waitForTimeout(this.randomDelay(200, 600));
        }

        // Step 5: 真实按压点击
        await this.page.mouse.down();
        await this.page.waitForTimeout(this.randomDelay(80, 180));
        await this.page.mouse.up();

        // 点击后轻微抖动
        await this.page.mouse.move(
            clickX + this.randomDelay(-3, 3),
            clickY + this.randomDelay(-3, 3),
            { steps: 3 }
        );
    }

    // 等待页面导航
    async waitForNavigation(originalUrl, timeoutMs = 10000) {
        const startTime = Date.now();

        while (Date.now() - startTime < timeoutMs) {
            await this.page.waitForTimeout(500);

            const currentUrl = this.page.url();
            if (currentUrl !== originalUrl) {
                console.log(`🎉 检测到导航: ${originalUrl} → ${currentUrl}`);
                return true;
            }

            // 检查是否有加载指示器
            const loadingIndicators = await this.page.evaluate(() => {
                const indicators = [
                    '.loading', '.spinner', '[data-testid="loading"]',
                    '.SubmitButton--loading', '.processing'
                ];

                return indicators.some(selector => {
                    const el = document.querySelector(selector);
                    return el && el.offsetWidth > 0;
                });
            });

            if (loadingIndicators) {
                console.log('🔄 检测到加载指示器，继续等待...');
            }
        }

        return false;
    }

    // 主修复流程
    async runFix() {
        try {
            await this.init();

            console.log('⏸️ 请手动导航到 Stripe Checkout 页面，然后按回车继续...');
            await new Promise(resolve => {
                process.stdin.once('data', () => resolve());
            });

            console.log('🚀 开始修复流程...');

            // 1. 验证表单完整性
            await this.validateStripeCompleteness();

            // 2. 等待页面稳定
            await this.page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

            // 3. 执行改进的点击
            const successfulStrategy = await this.improvedButtonClick();

            // 4. 等待 PayPal 跳转
            console.log('⏳ 等待跳转到 PayPal...');
            await this.mouseBreathing(this.page, this.randomDelay(6000, 8000));

            // 5. 检查是否成功跳转到 PayPal
            const finalUrl = this.page.url();
            if (finalUrl.includes('paypal')) {
                console.log('🎉 成功跳转到 PayPal!');
                console.log(`最终URL: ${finalUrl}`);
                console.log(`成功策略: ${successfulStrategy}`);
            } else {
                console.log('❌ 未能跳转到 PayPal');
                console.log(`当前URL: ${finalUrl}`);

                // 检查页面上的错误信息
                const errors = await this.page.evaluate(() => {
                    const errorSelectors = ['.error', '.Error', '[role="alert"]', '.field-error'];
                    const errors = [];
                    errorSelectors.forEach(sel => {
                        const els = document.querySelectorAll(sel);
                        els.forEach(el => {
                            if (el.textContent.trim()) {
                                errors.push(el.textContent.trim());
                            }
                        });
                    });
                    return errors;
                });

                if (errors.length > 0) {
                    console.log('🚨 页面错误信息:');
                    errors.forEach(error => console.log(`   - ${error}`));
                }
            }

        } catch (error) {
            console.error('❌ 修复过程出错:', error.message);
        } finally {
            console.log('🏁 修复完成，浏览器保持打开状态供调试...');
        }
    }
}

// 运行修复
if (require.main === module) {
    const fixer = new StripeSubmitFixer();
    fixer.runFix().catch(console.error);
}

module.exports = StripeSubmitFixer;