/**
 * 优化后的 PayPal 页面处理逻辑
 * 基于对原始代码的分析和测试脚本的改进
 */

// 增强的 PayPal 表单填写函数
async function optimizedPayPalFormFill(page, CONFIG) {
    console.log("🚀 开始优化的 PayPal 表单填写流程");

    const billing = CONFIG.billing;
    const [firstName, lastName] = billing.name.split(' ');

    // 工具函数
    const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    // 增强的滑块解决函数
    const enhancedSolveSlider = async () => {
        console.log("🔍 检查 PayPal 滑块验证...");

        const sliderSelectors = [
            '.slider',
            '.sliderContainer .slider',
            '#captcha__frame__bottom .slider',
            '[class*="slider"]',
            '.captcha-slider',
            '.challenge-slider'
        ];

        for (const selector of sliderSelectors) {
            const slider = page.locator(selector).first();
            if (await slider.isVisible().catch(() => false)) {
                console.log(`🎯 发现滑块: ${selector}`);

                try {
                    const box = await slider.boundingBox();
                    if (box) {
                        // 更自然的滑动轨迹
                        const startX = box.x + randomDelay(5, 15);
                        const startY = box.y + box.height / 2 + randomDelay(-3, 3);
                        const endX = box.x + box.width - randomDelay(10, 20);
                        const endY = startY + randomDelay(-2, 2);

                        await page.mouse.move(startX, startY);
                        await page.waitForTimeout(randomDelay(200, 500));
                        await page.mouse.down();

                        // 分段滑动，模拟真人操作
                        const steps = randomDelay(20, 35);
                        for (let i = 0; i <= steps; i++) {
                            const progress = i / steps;
                            // 使用贝塞尔曲线模拟自然滑动
                            const currentX = startX + (endX - startX) * progress;
                            const currentY = startY + Math.sin(progress * Math.PI) * randomDelay(-2, 2);

                            await page.mouse.move(currentX, currentY);
                            await page.waitForTimeout(randomDelay(15, 35));
                        }

                        await page.waitForTimeout(randomDelay(100, 300));
                        await page.mouse.up();
                        await page.waitForTimeout(randomDelay(1500, 3000));

                        console.log("✅ 滑块验证完成");
                        return true;
                    }
                } catch (e) {
                    console.warn(`⚠️ 滑块操作失败: ${e.message}`);
                }
            }
        }
        return false;
    };

    // 智能字段查找函数
    const findField = async (selectors, fieldName) => {
        for (const selector of selectors) {
            const field = page.locator(selector).first();
            if (await field.isVisible().catch(() => false)) {
                const isEnabled = await field.isEnabled().catch(() => false);
                const isEditable = await field.isEditable().catch(() => false);

                if (isEnabled && isEditable) {
                    console.log(`🎯 找到${fieldName}字段: ${selector}`);
                    return field;
                }
            }
        }
        console.warn(`⚠️ 未找到可用的${fieldName}字段`);
        return null;
    };

    // 增强的表单填写函数
    const robustFillField = async (locator, value, fieldName, options = {}) => {
        const { digitsMode = false, fastMode = false, maxRetries = 3 } = options;

        if (!locator) {
            console.warn(`⚠️ ${fieldName}字段不存在，跳过填写`);
            return false;
        }

        console.log(`📝 填写${fieldName}: "${value}"`);

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                // 等待字段可见和可编辑
                await locator.waitFor({ state: 'visible', timeout: 5000 });

                // 移动鼠标到字段
                const box = await locator.boundingBox();
                if (box) {
                    await page.mouse.move(
                        box.x + box.width / 2 + randomDelay(-5, 5),
                        box.y + box.height / 2 + randomDelay(-3, 3),
                        { steps: randomDelay(8, 15) }
                    );
                    await page.waitForTimeout(randomDelay(100, 300));
                }

                // 点击字段
                await locator.click({ clickCount: fastMode ? 3 : 1 });
                await page.waitForTimeout(randomDelay(50, 150));

                if (fastMode || digitsMode) {
                    // 快速填写模式
                    try {
                        await locator.fill(value);
                    } catch (e) {
                        // 备用方案：键盘输入
                        await page.keyboard.press('Control+A');
                        await page.keyboard.press('Delete');
                        await page.keyboard.type(value, { delay: randomDelay(15, 35) });
                    }
                } else {
                    // 人工输入模式
                    await page.keyboard.press('Control+A');
                    await page.keyboard.press('Delete');
                    await page.waitForTimeout(randomDelay(50, 150));

                    for (let i = 0; i < value.length; i++) {
                        await page.keyboard.type(value[i]);
                        await page.waitForTimeout(randomDelay(60, 180));
                    }
                }

                // 触发事件确保 React 更新
                await locator.evaluate((node, val) => {
                    node.value = val;
                    ['input', 'change', 'blur'].forEach(eventType => {
                        node.dispatchEvent(new Event(eventType, { bubbles: true }));
                    });
                }, value);

                await page.waitForTimeout(randomDelay(200, 500));

                // 验证填写结果
                const actualValue = await locator.inputValue().catch(() => '');
                const digitsOnly = (s) => String(s || '').replace(/\D/g, '');
                const compareOk = digitsMode
                    ? (digitsOnly(actualValue) === digitsOnly(value))
                    : (actualValue === value);

                if (compareOk) {
                    console.log(`✅ ${fieldName}填写成功`);
                    return true;
                }

                console.log(`⚠️ ${fieldName}第${attempt}次填写不匹配，期望: "${value}", 实际: "${actualValue}"`);

            } catch (e) {
                console.warn(`⚠️ ${fieldName}第${attempt}次填写异常: ${e.message}`);
            }

            if (attempt < maxRetries) {
                await page.waitForTimeout(randomDelay(500, 1000));
            }
        }

        console.warn(`❌ ${fieldName}填写失败，已重试${maxRetries}次`);
        return false;
    };

    // Phase 1: 等待 PayPal 页面加载
    console.log("⏳ 等待 PayPal 页面加载...");
    await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => {});

    // 初始滑块检查
    await enhancedSolveSlider();

    // Phase 2: 等待并点击 "Create an Account" 按钮
    console.log("⏳ 等待 Create an Account 按钮...");

    const waitForCreateButton = async (timeoutMs = 25000) => {
        const buttonSelectors = [
            'button:has-text("Create an Account")',
            'button[data-testid*="create"]',
            'button:has-text("创建账户")',
            '.create-account-button'
        ];

        for (const selector of buttonSelectors) {
            try {
                const btn = page.locator(selector).first();
                await btn.waitFor({ state: 'visible', timeout: timeoutMs });
                return btn;
            } catch (e) {
                continue;
            }
        }
        return null;
    };

    let createBtn = await waitForCreateButton(25000);
    let refreshAttempts = 0;

    // 如果按钮未出现，尝试刷新页面
    while (!createBtn && refreshAttempts < 3) {
        refreshAttempts++;
        console.log(`🔄 第${refreshAttempts}次刷新 PayPal 页面...`);

        try {
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
            await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
            await enhancedSolveSlider();
            createBtn = await waitForCreateButton(20000);
        } catch (e) {
            console.warn(`⚠️ 刷新失败: ${e.message}`);
        }
    }

    if (!createBtn) {
        const currentUrl = page.url();
        throw new Error(`PayPal Create an Account 按钮未出现 (已刷新${refreshAttempts}次, URL: ${currentUrl})`);
    }

    // 点击创建账户按钮
    await page.waitForTimeout(randomDelay(1500, 3000));
    await createBtn.click();
    console.log("✅ 已点击 Create an Account 按钮");

    // Phase 3: 填写邮箱
    console.log("📧 填写登录邮箱...");
    await page.waitForTimeout(randomDelay(1000, 2000));

    const emailSelectors = [
        '#login_email',
        '#email',
        'input[type="email"]',
        'input[name*="email"]'
    ];

    const emailField = await findField(emailSelectors, '邮箱');
    if (emailField) {
        await robustFillField(emailField, billing.email, '邮箱', { fastMode: true });
    }

    // 点击继续按钮
    const continueSelectors = [
        'button:has-text("Continue to Payment")',
        'button:has-text("Continue")',
        'button:has-text("Next")',
        'button[type="submit"]'
    ];

    const continueBtn = await findField(continueSelectors, '继续按钮');
    if (continueBtn) {
        await page.waitForTimeout(randomDelay(800, 1500));
        await continueBtn.click({ force: true });
        console.log("✅ 已点击继续按钮");
    }

    // Phase 4: 等待支付表单加载
    console.log("⏳ 等待支付表单加载...");
    await page.waitForTimeout(randomDelay(2000, 4000));

    // 持续检查滑块直到卡号字段出现
    const cardSelectors = [
        '#cardNumber',
        '#card-number',
        'input[name*="card"]',
        '[data-testid*="card"]'
    ];

    let cardField = null;
    const cardWaitDeadline = Date.now() + 90000; // 90秒超时

    while (Date.now() < cardWaitDeadline && !cardField) {
        // 检查滑块
        await enhancedSolveSlider();

        // 检查卡号字段
        cardField = await findField(cardSelectors, '卡号');
        if (cardField) break;

        await page.waitForTimeout(1000);
    }

    if (!cardField) {
        throw new Error("PayPal 卡号字段90秒内未出现");
    }

    // Phase 5: 填写支付信息
    console.log("💳 填写支付信息...");

    // 随机决定填写顺序
    const fillOrder = Math.random() > 0.5 ? 'card_first' : 'name_first';

    if (fillOrder === 'card_first') {
        // 先填卡信息
        await robustFillField(cardField, billing.card, '卡号', { digitsMode: true });

        // Tab 到有效期
        await page.keyboard.press('Tab');
        await page.waitForTimeout(randomDelay(150, 300));
        await page.keyboard.type(billing.expiry, { delay: randomDelay(20, 50) });

        // Tab 到 CVC
        await page.keyboard.press('Tab');
        await page.waitForTimeout(randomDelay(150, 300));
        await page.keyboard.type(billing.cvc, { delay: randomDelay(20, 50) });

        await page.waitForTimeout(randomDelay(300, 600));

        // 再填姓名
        const firstNameField = await findField(['#firstName', '#first-name', 'input[name*="first"]'], '名字');
        if (firstNameField) {
            await robustFillField(firstNameField, firstName, '名字', { fastMode: true });
        }

        const lastNameField = await findField(['#lastName', '#last-name', 'input[name*="last"]'], '姓氏');
        if (lastNameField) {
            await robustFillField(lastNameField, lastName, '姓氏', { fastMode: true });
        }
    } else {
        // 先填姓名
        const firstNameField = await findField(['#firstName', '#first-name', 'input[name*="first"]'], '名字');
        if (firstNameField) {
            await robustFillField(firstNameField, firstName, '名字', { fastMode: true });
        }

        const lastNameField = await findField(['#lastName', '#last-name', 'input[name*="last"]'], '姓氏');
        if (lastNameField) {
            await robustFillField(lastNameField, lastName, '姓氏', { fastMode: true });
        }

        await page.waitForTimeout(randomDelay(300, 600));

        // 再填卡信息
        await robustFillField(cardField, billing.card, '卡号', { digitsMode: true });

        await page.keyboard.press('Tab');
        await page.waitForTimeout(randomDelay(150, 300));
        await page.keyboard.type(billing.expiry, { delay: randomDelay(20, 50) });

        await page.keyboard.press('Tab');
        await page.waitForTimeout(randomDelay(150, 300));
        await page.keyboard.type(billing.cvc, { delay: randomDelay(20, 50) });
    }

    // 填写其他字段
    const phoneField = await findField(['#phone', 'input[type="tel"]', 'input[name*="phone"]'], '手机号');
    if (phoneField) {
        await robustFillField(phoneField, billing.smsPhone, '手机号', { digitsMode: true });
    }

    // Phase 6: 填写地址信息
    console.log("🏠 填写地址信息...");

    const addressField = await findField([
        '#billingLine1',
        '#address',
        'input[name*="address"]',
        'input[name*="street"]'
    ], '地址');

    if (addressField) {
        await robustFillField(addressField, billing.address, '地址', { fastMode: true });

        // 等待地址自动完成
        await page.waitForTimeout(randomDelay(1000, 2000));

        // 检查地址建议
        const suggestionSelectors = [
            '[class*="suggestion"]',
            '[class*="autocomplete"] li',
            '.AddressAutocomplete-option',
            '.address-suggestion'
        ];

        let suggestionFound = false;
        for (const selector of suggestionSelectors) {
            const suggestion = page.locator(selector).first();
            if (await suggestion.isVisible().catch(() => false)) {
                console.log("🎯 选择地址建议");
                await page.keyboard.press('ArrowDown');
                await page.waitForTimeout(randomDelay(200, 400));
                await page.keyboard.press('Enter');
                suggestionFound = true;
                break;
            }
        }

        if (!suggestionFound) {
            await page.keyboard.press('Tab');
        }
    }

    // 等待城市/州/邮编字段渲染
    await page.waitForTimeout(randomDelay(2000, 4000));

    // 智能填写城市/州/邮编
    const fillAddressField = async (selectors, value, fieldName, isSelect = false) => {
        const field = await findField(selectors, fieldName);
        if (!field) return;

        const currentValue = await field.inputValue().catch(() => '');
        if (currentValue && currentValue.trim() === value.trim()) {
            console.log(`⏩ ${fieldName}已为目标值: ${currentValue}`);
            return;
        }

        if (isSelect) {
            try {
                await field.selectOption({ value: value });
            } catch (e) {
                await field.selectOption({ label: value });
            }
            console.log(`✅ 已选择${fieldName}: ${value}`);
        } else {
            await robustFillField(field, value, fieldName, { fastMode: true });
        }
    };

    // 城市
    await fillAddressField([
        '#billingCity',
        '#city',
        'input[name*="city"]'
    ], billing.city, '城市');

    // 州
    await fillAddressField([
        '#billingState',
        '#state',
        'select[name*="state"]'
    ], billing.state, '州', true);

    // 邮编
    await fillAddressField([
        '#billingPostalCode',
        '#postalCode',
        '#zipCode',
        'input[name*="zip"]',
        'input[name*="postal"]'
    ], billing.zip, '邮编');

    // Phase 7: 填写密码
    console.log("🔐 填写账户密码...");
    const passwordField = await findField([
        '#password',
        'input[type="password"]',
        'input[name*="password"]'
    ], '密码');

    if (passwordField) {
        await robustFillField(passwordField, billing.paypalPassword, '密码', { fastMode: true });
    }

    // Phase 8: 最终验证
    console.log("🔍 进行最终表单验证...");

    const validationFields = [
        { selector: cardField, expectedValue: billing.card, name: "卡号", digitsMode: true },
        { selector: phoneField, expectedValue: billing.smsPhone, name: "手机号", digitsMode: true }
    ];

    for (const field of validationFields) {
        if (field.selector) {
            const actualValue = await field.selector.inputValue().catch(() => '');
            const digitsOnly = (s) => String(s || '').replace(/\D/g, '');
            const cleanActual = field.digitsMode ? digitsOnly(actualValue) : actualValue;
            const cleanExpected = field.digitsMode ? digitsOnly(field.expectedValue) : field.expectedValue;

            if (cleanActual !== cleanExpected) {
                console.warn(`⚠️ ${field.name}验证失败，重新填写`);
                await robustFillField(field.selector, field.expectedValue, field.name, {
                    digitsMode: field.digitsMode,
                    fastMode: true
                });
            } else {
                console.log(`✅ ${field.name}验证通过`);
            }
        }
    }

    // Phase 9: 提交表单
    console.log("📤 准备提交表单...");

    // 最后检查一次滑块
    await enhancedSolveSlider();

    // 模拟用户最后检查
    if (Math.random() < 0.4) {
        await page.mouse.wheel(0, randomDelay(-100, 100));
        await page.waitForTimeout(randomDelay(1000, 2000));
    }

    const submitSelectors = [
        'button:has-text("Agree & Create Account")',
        'button:has-text("Create Account")',
        'button[type="submit"]',
        '.submit-button'
    ];

    const submitBtn = await findField(submitSelectors, '提交按钮');
    if (submitBtn) {
        await page.waitForTimeout(randomDelay(1000, 2000));
        await submitBtn.click({ force: true });
        console.log("✅ 已提交 PayPal 账户创建表单");
    } else {
        throw new Error("未找到提交按钮");
    }

    console.log("🎉 PayPal 表单填写流程完成");
}

module.exports = {
    optimizedPayPalFormFill
};