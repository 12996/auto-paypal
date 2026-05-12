// 优化后的地址自动补全处理函数
// 用于替换 index.js 中第1208-1309行的地址处理逻辑

/**
 * 优化的地址自动补全检测和选择函数
 * @param {Page} page - Playwright 页面对象
 * @param {string} address - 要输入的地址
 * @param {Object} CONFIG - 配置对象
 * @returns {Promise<Object>} 返回处理结果
 */
async function optimizedAddressAutocomplete(page, address, CONFIG) {
    console.log("🔍 [地址] 开始优化的地址自动补全处理...");

    // 输入地址
    await humanFillInput(page, page.locator('#billingAddressLine1'), address);
    console.log(`📝 [地址] 已输入地址: ${address}`);

    // 动态等待策略：先短等待，再逐步增加
    const waitSteps = [500, 1000, 1500, 2000]; // 渐进式等待
    let dropdownFound = false;
    let selectedAddress = null;
    let usedSelector = null;

    // 优化的选择器列表（按优先级排序）
    const dropdownSelectors = [
        // Google Places API 高优先级选择器
        '.pac-container .pac-item:first-child',
        '.pac-container .pac-item',

        // ARIA 标准选择器
        '[role="listbox"] [role="option"]:first-child',
        '[role="option"]:first-child',
        '[role="option"]',

        // PayPal 特定选择器
        '[data-testid*="address"] [role="option"]:first-child',
        '[class*="address"] [class*="option"]:first-child',

        // 通用自动补全选择器
        '.AddressAutocomplete-option:first-child',
        '.AddressAutocomplete-option',
        '[data-testid="address-autocomplete-option"]:first-child',
        '[data-testid="address-autocomplete-option"]',

        // 备用选择器
        '.AddressAutocomplete li:first-child',
        '[class*="autocomplete"] li:first-child',
        '[class*="suggestion"]:first-child',
        '[class*="pac-item"]:first-child',
        '.dropdown-item:first-child',
        '.suggestion-item:first-child'
    ];

    // 渐进式检测策略
    for (let stepIndex = 0; stepIndex < waitSteps.length && !dropdownFound; stepIndex++) {
        await page.waitForTimeout(waitSteps[stepIndex]);
        console.log(`⏳ [地址] 第 ${stepIndex + 1} 阶段检测 (等待 ${waitSteps[stepIndex]}ms)...`);

        // 首先检查是否有任何下拉相关元素出现
        const hasDropdownElements = await page.locator('[class*="pac"], [class*="autocomplete"], [class*="suggestion"], [role="option"], [role="listbox"]').count() > 0;

        if (hasDropdownElements) {
            console.log("🎯 [地址] 检测到下拉相关元素，开始精确匹配...");

            // 尝试每个选择器
            for (const selector of dropdownSelectors) {
                try {
                    const options = page.locator(selector);
                    const count = await options.count();

                    if (count > 0) {
                        const firstOption = options.first();

                        // 检查可见性和可交互性
                        const isVisible = await firstOption.isVisible().catch(() => false);
                        const isEnabled = await firstOption.isEnabled().catch(() => false);

                        if (isVisible && isEnabled) {
                            // 获取选项文本和位置信息
                            selectedAddress = await firstOption.textContent().catch(() => '');
                            const boundingBox = await firstOption.boundingBox().catch(() => null);

                            // 验证选项内容是否相关
                            if (selectedAddress && selectedAddress.trim().length > 0) {
                                console.log(`✅ [地址] 找到有效选项: "${selectedAddress.slice(0, 60)}..."`);
                                console.log(`🎯 [地址] 使用选择器: ${selector}`);

                                // 尝试点击选项
                                try {
                                    // 先尝试滚动到元素可见区域
                                    await firstOption.scrollIntoViewIfNeeded();
                                    await page.waitForTimeout(200);

                                    // 使用 Playwright 的智能点击
                                    await firstOption.click({ timeout: 3000 });
                                    dropdownFound = true;
                                    usedSelector = selector;
                                    console.log("✅ [地址] 成功点击地址补全选项");
                                    break;

                                } catch (clickError) {
                                    console.log(`⚠️ [地址] 标准点击失败，尝试备用方法: ${clickError.message}`);

                                    // 备用点击方法：使用坐标
                                    if (boundingBox) {
                                        try {
                                            const centerX = boundingBox.x + boundingBox.width / 2;
                                            const centerY = boundingBox.y + boundingBox.height / 2;
                                            await page.mouse.click(centerX, centerY);
                                            dropdownFound = true;
                                            usedSelector = selector;
                                            console.log("✅ [地址] 坐标点击成功");
                                            break;
                                        } catch (coordError) {
                                            console.log(`⚠️ [地址] 坐标点击也失败: ${coordError.message}`);
                                        }
                                    }

                                    // 最后尝试：键盘选择
                                    try {
                                        await page.keyboard.press('ArrowDown');
                                        await page.waitForTimeout(200);
                                        await page.keyboard.press('Enter');
                                        dropdownFound = true;
                                        usedSelector = selector + ' (键盘选择)';
                                        console.log("✅ [地址] 键盘选择成功");
                                        break;
                                    } catch (keyError) {
                                        console.log(`⚠️ [地址] 键盘选择失败: ${keyError.message}`);
                                    }
                                }
                            }
                        }
                    }
                } catch (selectorError) {
                    // 静默处理选择器错误，继续尝试下一个
                }
            }
        } else {
            console.log(`⏳ [地址] 第 ${stepIndex + 1} 阶段未检测到下拉元素，继续等待...`);
        }
    }

    // 处理结果
    if (dropdownFound) {
        console.log("✅ [地址] 地址自动补全成功");
        console.log(`📋 [地址] 使用的选择器: ${usedSelector}`);
        console.log(`📋 [地址] 选择的地址: ${selectedAddress}`);

        // 等待字段自动填充完成
        console.log("⏳ [地址] 等待其他字段自动填充...");
        await page.waitForTimeout(randomDelay(2000, 3000));

        // 验证和同步自动填充的数据
        const syncResult = await syncAutoFilledData(page, CONFIG);

        return {
            success: true,
            selector: usedSelector,
            selectedText: selectedAddress,
            syncResult: syncResult
        };

    } else {
        console.log("⚠️ [地址] 未找到地址自动补全下拉框");

        // 失焦处理：点击安全区域
        await handleAddressInputBlur(page);

        return {
            success: false,
            selector: null,
            selectedText: null,
            syncResult: null
        };
    }
}

/**
 * 同步自动填充的数据到配置
 * @param {Page} page - Playwright 页面对象
 * @param {Object} CONFIG - 配置对象
 * @returns {Promise<Object>} 同步结果
 */
async function syncAutoFilledData(page, CONFIG) {
    console.log("🔍 [地址] 验证并同步自动填充的数据...");

    const syncResult = {
        city: { synced: false, oldValue: CONFIG.billing.city, newValue: '' },
        state: { synced: false, oldValue: CONFIG.billing.state, newValue: '' },
        zip: { synced: false, oldValue: CONFIG.billing.zip, newValue: '' }
    };

    try {
        // 检查城市字段
        const citySelectors = [
            '#billingLocality',
            '[name="city"]',
            '[data-testid="city"]',
            'input[placeholder*="city" i]'
        ];

        for (const selector of citySelectors) {
            try {
                const cityField = page.locator(selector).first();
                const isVisible = await cityField.isVisible({ timeout: 1000 }).catch(() => false);

                if (isVisible) {
                    const autoCity = await cityField.inputValue().catch(() => '');
                    if (autoCity && autoCity.trim()) {
                        syncResult.city.newValue = autoCity.trim();

                        if (autoCity !== CONFIG.billing.city) {
                            console.log(`🔄 [地址] 城市数据同步: "${CONFIG.billing.city}" → "${autoCity}"`);
                            CONFIG.billing.city = autoCity;
                            syncResult.city.synced = true;
                        }
                        break;
                    }
                }
            } catch (error) {
                // 继续尝试下一个选择器
            }
        }

        // 检查州/省字段
        const stateSelectors = [
            '#billingAdministrativeArea',
            '[name="state"]',
            '[data-testid="state"]',
            'select[name*="state"]',
            'input[placeholder*="state" i]'
        ];

        for (const selector of stateSelectors) {
            try {
                const stateField = page.locator(selector).first();
                const isVisible = await stateField.isVisible({ timeout: 1000 }).catch(() => false);

                if (isVisible) {
                    // 处理 select 和 input 两种情况
                    const tagName = await stateField.evaluate(el => el.tagName.toLowerCase()).catch(() => '');
                    let autoState = '';

                    if (tagName === 'select') {
                        autoState = await stateField.inputValue().catch(() => '');
                    } else {
                        autoState = await stateField.inputValue().catch(() => '');
                    }

                    if (autoState && autoState.trim()) {
                        syncResult.state.newValue = autoState.trim();

                        if (autoState !== CONFIG.billing.state) {
                            console.log(`🔄 [地址] 州/省数据同步: "${CONFIG.billing.state}" → "${autoState}"`);
                            CONFIG.billing.state = autoState;
                            syncResult.state.synced = true;
                        }
                        break;
                    }
                }
            } catch (error) {
                // 继续尝试下一个选择器
            }
        }

        // 检查邮编字段
        const zipSelectors = [
            '#billingPostalCode',
            '[name="zip"]',
            '[name="postal_code"]',
            '[data-testid="zip"]',
            'input[placeholder*="zip" i]',
            'input[placeholder*="postal" i]'
        ];

        for (const selector of zipSelectors) {
            try {
                const zipField = page.locator(selector).first();
                const isVisible = await zipField.isVisible({ timeout: 1000 }).catch(() => false);

                if (isVisible) {
                    const autoZip = await zipField.inputValue().catch(() => '');
                    if (autoZip && autoZip.trim()) {
                        syncResult.zip.newValue = autoZip.trim();

                        if (autoZip !== CONFIG.billing.zip) {
                            console.log(`🔄 [地址] 邮编数据同步: "${CONFIG.billing.zip}" → "${autoZip}"`);
                            CONFIG.billing.zip = autoZip;
                            syncResult.zip.synced = true;
                        }
                        break;
                    }
                }
            } catch (error) {
                // 继续尝试下一个选择器
            }
        }

        // 输出同步结果摘要
        const syncedCount = Object.values(syncResult).filter(item => item.synced).length;
        console.log(`📊 [地址] 数据同步完成: ${syncedCount}/3 个字段已同步`);

    } catch (error) {
        console.log(`⚠️ [地址] 同步自动填充数据时出错: ${error.message}`);
    }

    return syncResult;
}

/**
 * 处理地址输入框失焦
 * @param {Page} page - Playwright 页面对象
 */
async function handleAddressInputBlur(page) {
    console.log("🎯 [地址] 处理地址输入框失焦...");

    try {
        // 点击页面顶部安全区域，避免误触其他元素
        const safeX = randomDelay(800, 1100);
        const safeY = randomDelay(30, 80);

        await page.mouse.move(safeX, safeY, { steps: 20 });
        await page.waitForTimeout(randomDelay(100, 300));
        await page.mouse.click(safeX, safeY);
        await page.waitForTimeout(randomDelay(300, 600));

        console.log("✅ [地址] 地址输入框已失焦");
    } catch (error) {
        console.log(`⚠️ [地址] 失焦处理出错: ${error.message}`);
    }
}

// 导出函数供 index.js 使用
module.exports = {
    optimizedAddressAutocomplete,
    syncAutoFilledData,
    handleAddressInputBlur
};