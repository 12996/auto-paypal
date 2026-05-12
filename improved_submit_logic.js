/**
 * Stripe 提交按钮修复方案
 * 解决提交按钮点击后不跳转的问题
 */

// 在 index.js 中替换现有的提交逻辑

/**
 * 改进的提交按钮点击逻辑
 * 解决点击后不跳转的问题
 */
async function improvedSubmitClick(page) {
    console.log("🔍 [步骤] 开始改进的提交流程...");

    // === Step 1: 智能定位提交按钮 ===
    const submitSelectors = [
        'button[type="submit"]',
        '.SubmitButton',
        '[data-testid="hosted-payment-submit-button"]',
        'button:has-text("Complete order")',
        'button:has-text("Pay")',
        'button:has-text("Submit")',
        'button:has-text("Place order")'
    ];

    let submitButton = null;
    let usedSelector = '';

    for (const selector of submitSelectors) {
        try {
            const btn = page.locator(selector).first();
            if (await btn.isVisible({ timeout: 2000 }) && await btn.isEnabled({ timeout: 1000 })) {
                submitButton = btn;
                usedSelector = selector;
                console.log(`✅ [步骤] 找到可用提交按钮: ${selector}`);
                break;
            }
        } catch (e) {
            // 继续尝试下一个选择器
        }
    }

    if (!submitButton) {
        throw new Error("未找到可用的提交按钮");
    }

    // === Step 2: 预提交验证 ===
    console.log("🔍 [步骤] 执行预提交验证...");

    // 检查按钮状态
    const isEnabled = await submitButton.isEnabled();
    const isVisible = await submitButton.isVisible();
    const buttonText = await submitButton.textContent();

    console.log(`按钮状态: 可见=${isVisible}, 启用=${isEnabled}, 文本="${buttonText}"`);

    if (!isEnabled) {
        // 检查是否有表单验证错误
        const errorElements = await page.locator('.Error, .FieldError, [role="alert"], .error-message').all();
        for (const errorEl of errorElements) {
            const errorText = await errorEl.textContent().catch(() => '');
            if (errorText && errorText.trim()) {
                console.warn(`⚠️ [验证] 发现表单错误: ${errorText.trim()}`);
            }
        }
        throw new Error(`提交按钮被禁用，可能存在表单验证错误`);
    }

    // === Step 3: 多重点击策略 ===
    console.log("🖱️ [步骤] 执行多重点击策略...");

    const originalUrl = page.url();
    let clickSuccess = false;

    // 策略1: 标准 Playwright 点击
    try {
        console.log("🖱️ [策略1] 尝试标准点击...");
        await submitButton.click({ timeout: 5000 });

        // 等待页面响应
        await page.waitForTimeout(1000);

        // 检查是否有加载指示器出现
        const loadingIndicators = [
            '.loading',
            '.spinner',
            '[data-testid="loading"]',
            '.SubmitButton--loading'
        ];

        let hasLoading = false;
        for (const selector of loadingIndicators) {
            if (await page.locator(selector).isVisible({ timeout: 500 }).catch(() => false)) {
                hasLoading = true;
                console.log(`✅ [策略1] 检测到加载状态: ${selector}`);
                break;
            }
        }

        if (hasLoading) {
            clickSuccess = true;
            console.log("✅ [策略1] 标准点击成功，检测到加载状态");
        }
    } catch (e) {
        console.warn(`⚠️ [策略1] 标准点击失败: ${e.message}`);
    }

    // 策略2: 如果标准点击没有效果，尝试强制点击
    if (!clickSuccess) {
        try {
            console.log("🖱️ [策略2] 尝试强制点击...");
            await submitButton.click({ force: true, timeout: 5000 });
            await page.waitForTimeout(1000);
            clickSuccess = true;
            console.log("✅ [策略2] 强制点击完成");
        } catch (e) {
            console.warn(`⚠️ [策略2] 强制点击失败: ${e.message}`);
        }
    }

    // 策略3: JavaScript 直接点击
    if (!clickSuccess) {
        try {
            console.log("🖱️ [策略3] 尝试 JavaScript 点击...");
            await submitButton.evaluate(el => {
                // 触发多个事件确保完整的点击行为
                el.focus();
                el.click();

                // 如果是表单，也尝试提交表单
                const form = el.closest('form');
                if (form) {
                    form.submit();
                }
            });
            await page.waitForTimeout(1000);
            clickSuccess = true;
            console.log("✅ [策略3] JavaScript 点击完成");
        } catch (e) {
            console.warn(`⚠️ [策略3] JavaScript 点击失败: ${e.message}`);
        }
    }

    // 策略4: 模拟键盘 Enter
    if (!clickSuccess) {
        try {
            console.log("🖱️ [策略4] 尝试键盘 Enter...");
            await submitButton.focus();
            await page.keyboard.press('Enter');
            await page.waitForTimeout(1000);
            clickSuccess = true;
            console.log("✅ [策略4] 键盘 Enter 完成");
        } catch (e) {
            console.warn(`⚠️ [策略4] 键盘 Enter 失败: ${e.message}`);
        }
    }

    if (!clickSuccess) {
        throw new Error("所有点击策略都失败了");
    }

    // === Step 4: 等待页面变化 ===
    console.log("⏳ [步骤] 等待页面响应...");

    // 等待以下任一条件满足：
    // 1. URL 改变
    // 2. 出现加载状态
    // 3. 页面导航开始
    // 4. 出现新的内容

    const waitPromises = [
        // 等待 URL 改变
        page.waitForURL(url => url !== originalUrl, { timeout: 10000 }).then(() => 'url_changed').catch(() => null),

        // 等待导航开始
        page.waitForLoadState('domcontentloaded', { timeout: 10000 }).then(() => 'navigation').catch(() => null),

        // 等待特定元素出现（PayPal 相关）
        page.waitForSelector('text=PayPal', { timeout: 10000 }).then(() => 'paypal_detected').catch(() => null),

        // 等待加载指示器
        page.waitForSelector('.loading, .spinner, [data-testid="loading"]', { timeout: 5000 }).then(() => 'loading_detected').catch(() => null)
    ];

    const result = await Promise.race([
        Promise.all(waitPromises.map(p => p.catch(() => null))),
        new Promise(resolve => setTimeout(() => resolve('timeout'), 15000))
    ]);

    if (result === 'timeout') {
        console.warn("⚠️ [步骤] 等待页面响应超时");

        // 检查当前页面状态
        const currentUrl = page.url();
        if (currentUrl !== originalUrl) {
            console.log(`✅ [步骤] URL 已改变: ${originalUrl} → ${currentUrl}`);
            return true;
        } else {
            console.warn("❌ [步骤] URL 未改变，可能提交失败");
            return false;
        }
    } else {
        const validResults = result.filter(r => r !== null);
        if (validResults.length > 0) {
            console.log(`✅ [步骤] 页面响应成功: ${validResults.join(', ')}`);
            return true;
        } else {
            console.warn("❌ [步骤] 未检测到页面响应");
            return false;
        }
    }
}

// 导出函数供 index.js 使用
module.exports = { improvedSubmitClick };