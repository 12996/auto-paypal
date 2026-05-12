const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// 测试配置
const TEST_CONFIG = {
    billing: {
        address: "123 Main Street",
        city: "New York",
        state: "NY",
        zip: "10001"
    }
};

// 随机延迟函数
function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 人性化输入函数
async function humanFillInput(page, locator, text, clearFirst = true, pressEnter = false) {
    if (!text) return;

    try {
        await locator.waitFor({ state: 'visible', timeout: 5000 });
        await locator.click();
        await page.waitForTimeout(randomDelay(100, 300));

        if (clearFirst) {
            await locator.selectText();
            await page.waitForTimeout(randomDelay(50, 150));
        }

        // 逐字符输入，模拟真实用户
        for (const char of text) {
            await page.keyboard.type(char);
            await page.waitForTimeout(randomDelay(50, 150));
        }

        if (pressEnter) {
            await page.keyboard.press('Enter');
        }

        await page.waitForTimeout(randomDelay(200, 500));
    } catch (error) {
        console.log(`输入失败: ${error.message}`);
    }
}

// 地址自动补全检测和选择函数（优化版）
async function detectAndSelectAddressAutocomplete(page, addressInput, testAddress) {
    console.log("🔍 开始地址自动补全测试...");

    // 输入地址
    await humanFillInput(page, addressInput, testAddress);
    console.log(`📝 已输入地址: ${testAddress}`);

    // 等待自动补全下拉出现
    console.log("⏳ 等待地址自动补全下拉出现...");
    await page.waitForTimeout(randomDelay(1500, 2500));

    // 扩展的下拉框选择器列表
    const dropdownSelectors = [
        // Google Places API 标准选择器
        '.pac-container .pac-item',
        '.pac-container .pac-item:first-child',

        // ARIA 和语义选择器
        '[role="option"]',
        '[role="listbox"] [role="option"]',

        // 常见的自动补全选择器
        '.AddressAutocomplete-option',
        '[data-testid="address-autocomplete-option"]',
        '.AddressAutocomplete li',
        '[class*="autocomplete"] li',
        '[class*="suggestion"]',
        '[class*="pac-item"]',

        // 通用下拉选择器
        '.dropdown-item',
        '.suggestion-item',
        '.autocomplete-suggestion',
        'ul[role="listbox"] li',

        // PayPal 特定选择器
        '[data-testid*="address"] [role="option"]',
        '[class*="address"] [class*="option"]',
        '[class*="typeahead"] li'
    ];

    let dropdownFound = false;
    let selectedAddress = null;
    let usedSelector = null;

    // 检测下拉框的详细信息
    console.log("🔍 开始检测下拉框...");

    // 尝试多次检测下拉框（最多等待 10 秒）
    for (let attempt = 0; attempt < 10 && !dropdownFound; attempt++) {
        console.log(`🔄 第 ${attempt + 1} 次检测...`);

        // 首先检查页面上是否有任何可见的下拉元素
        try {
            const allDropdowns = await page.locator('[class*="pac"], [class*="autocomplete"], [class*="suggestion"], [role="option"], [role="listbox"]').all();
            if (allDropdowns.length > 0) {
                console.log(`📋 检测到 ${allDropdowns.length} 个潜在的下拉元素`);

                for (let i = 0; i < allDropdowns.length; i++) {
                    const element = allDropdowns[i];
                    const isVisible = await element.isVisible().catch(() => false);
                    const className = await element.getAttribute('class').catch(() => '');
                    const role = await element.getAttribute('role').catch(() => '');
                    const text = await element.textContent().catch(() => '');

                    console.log(`  元素 ${i + 1}: visible=${isVisible}, class="${className}", role="${role}", text="${text.slice(0, 50)}..."`);
                }
            }
        } catch (error) {
            console.log(`检测下拉元素时出错: ${error.message}`);
        }

        // 尝试每个选择器
        for (const selector of dropdownSelectors) {
            try {
                const options = page.locator(selector);
                const count = await options.count();

                if (count > 0) {
                    console.log(`🎯 选择器 "${selector}" 找到 ${count} 个选项`);

                    const firstOption = options.first();
                    const visible = await firstOption.isVisible().catch(() => false);

                    if (visible) {
                        // 获取选项详细信息
                        selectedAddress = await firstOption.textContent().catch(() => '');
                        const boundingBox = await firstOption.boundingBox().catch(() => null);

                        console.log(`✅ 找到可见的地址补全选项:`);
                        console.log(`   选择器: ${selector}`);
                        console.log(`   文本: "${selectedAddress}"`);
                        console.log(`   位置: ${boundingBox ? `x=${boundingBox.x}, y=${boundingBox.y}, w=${boundingBox.width}, h=${boundingBox.height}` : '无法获取'}`);

                        // 尝试点击选项
                        try {
                            await firstOption.click();
                            dropdownFound = true;
                            usedSelector = selector;
                            console.log("✅ 成功点击地址补全选项");
                            break;
                        } catch (clickError) {
                            console.log(`❌ 点击失败: ${clickError.message}`);

                            // 尝试使用坐标点击
                            if (boundingBox) {
                                try {
                                    const centerX = boundingBox.x + boundingBox.width / 2;
                                    const centerY = boundingBox.y + boundingBox.height / 2;
                                    await page.mouse.click(centerX, centerY);
                                    dropdownFound = true;
                                    usedSelector = selector;
                                    console.log("✅ 使用坐标点击成功");
                                    break;
                                } catch (coordClickError) {
                                    console.log(`❌ 坐标点击也失败: ${coordClickError.message}`);
                                }
                            }
                        }
                    } else {
                        console.log(`⚠️ 选择器 "${selector}" 找到选项但不可见`);
                    }
                }
            } catch (error) {
                // 静默处理选择器错误，继续尝试下一个
            }
        }

        if (!dropdownFound) {
            await page.waitForTimeout(1000);
        }
    }

    if (dropdownFound) {
        console.log("✅ 地址自动补全成功");
        console.log(`📋 使用的选择器: ${usedSelector}`);
        console.log(`📋 选择的地址: ${selectedAddress}`);

        // 等待字段自动填充
        console.log("⏳ 等待其他字段自动填充...");
        await page.waitForTimeout(randomDelay(2000, 3000));

        return {
            success: true,
            selector: usedSelector,
            selectedText: selectedAddress
        };
    } else {
        console.log("❌ 未找到地址自动补全下拉框");
        return {
            success: false,
            selector: null,
            selectedText: null
        };
    }
}

// 验证自动填充结果
async function validateAutoFillResults(page, expectedConfig) {
    console.log("🔍 验证自动填充结果...");

    const results = {
        city: { expected: expectedConfig.city, actual: '', match: false },
        state: { expected: expectedConfig.state, actual: '', match: false },
        zip: { expected: expectedConfig.zip, actual: '', match: false }
    };

    try {
        // 检查城市字段
        const citySelectors = ['#billingLocality', '[name="city"]', '[data-testid="city"]'];
        for (const selector of citySelectors) {
            try {
                const cityField = page.locator(selector).first();
                const cityValue = await cityField.inputValue().catch(() => '');
                if (cityValue) {
                    results.city.actual = cityValue;
                    results.city.match = cityValue === expectedConfig.city;
                    console.log(`📍 城市字段 (${selector}): "${cityValue}" ${results.city.match ? '✅' : '❌'}`);
                    break;
                }
            } catch (error) {
                // 继续尝试下一个选择器
            }
        }

        // 检查州/省字段
        const stateSelectors = ['#billingAdministrativeArea', '[name="state"]', '[data-testid="state"]'];
        for (const selector of stateSelectors) {
            try {
                const stateField = page.locator(selector).first();
                const stateValue = await stateField.inputValue().catch(() => '');
                if (stateValue) {
                    results.state.actual = stateValue;
                    results.state.match = stateValue === expectedConfig.state;
                    console.log(`📍 州/省字段 (${selector}): "${stateValue}" ${results.state.match ? '✅' : '❌'}`);
                    break;
                }
            } catch (error) {
                // 继续尝试下一个选择器
            }
        }

        // 检查邮编字段
        const zipSelectors = ['#billingPostalCode', '[name="zip"]', '[name="postal_code"]', '[data-testid="zip"]'];
        for (const selector of zipSelectors) {
            try {
                const zipField = page.locator(selector).first();
                const zipValue = await zipField.inputValue().catch(() => '');
                if (zipValue) {
                    results.zip.actual = zipValue;
                    results.zip.match = zipValue === expectedConfig.zip;
                    console.log(`📍 邮编字段 (${selector}): "${zipValue}" ${results.zip.match ? '✅' : '❌'}`);
                    break;
                }
            } catch (error) {
                // 继续尝试下一个选择器
            }
        }

    } catch (error) {
        console.log(`❌ 验证自动填充时出错: ${error.message}`);
    }

    return results;
}

// 主测试函数
async function testAddressAutocomplete() {
    console.log("🚀 开始地址自动补全测试");

    const browser = await chromium.launch({
        headless: false,
        slowMo: 100
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    try {
        // 导航到 PayPal 测试页面（或其他有地址自动补全的页面）
        console.log("📱 导航到测试页面...");
        await page.goto('https://www.paypal.com/checkoutnow', { waitUntil: 'networkidle' });

        // 等待页面加载
        await page.waitForTimeout(3000);

        // 查找地址输入框
        const addressSelectors = [
            '#billingAddressLine1',
            '[name="address"]',
            '[data-testid="address"]',
            'input[placeholder*="address" i]',
            'input[placeholder*="street" i]'
        ];

        let addressInput = null;
        for (const selector of addressSelectors) {
            try {
                const input = page.locator(selector).first();
                const visible = await input.isVisible({ timeout: 1000 }).catch(() => false);
                if (visible) {
                    addressInput = input;
                    console.log(`📍 找到地址输入框: ${selector}`);
                    break;
                }
            } catch (error) {
                // 继续尝试下一个选择器
            }
        }

        if (!addressInput) {
            console.log("❌ 未找到地址输入框，请手动导航到包含地址表单的页面");
            console.log("⏸️ 测试暂停，请在浏览器中手动导航到地址表单页面，然后按 Enter 继续...");

            // 等待用户输入
            await new Promise(resolve => {
                process.stdin.once('data', () => resolve());
            });

            // 重新查找地址输入框
            for (const selector of addressSelectors) {
                try {
                    const input = page.locator(selector).first();
                    const visible = await input.isVisible({ timeout: 1000 }).catch(() => false);
                    if (visible) {
                        addressInput = input;
                        console.log(`📍 找到地址输入框: ${selector}`);
                        break;
                    }
                } catch (error) {
                    // 继续尝试下一个选择器
                }
            }
        }

        if (addressInput) {
            // 测试地址自动补全
            const result = await detectAndSelectAddressAutocomplete(
                page,
                addressInput,
                TEST_CONFIG.billing.address
            );

            if (result.success) {
                // 验证自动填充结果
                const validation = await validateAutoFillResults(page, TEST_CONFIG.billing);

                console.log("\n📊 测试结果总结:");
                console.log(`✅ 自动补全成功: ${result.success}`);
                console.log(`🎯 使用的选择器: ${result.selector}`);
                console.log(`📝 选择的地址: ${result.selectedText}`);
                console.log(`🏙️ 城市匹配: ${validation.city.match} (期望: ${validation.city.expected}, 实际: ${validation.city.actual})`);
                console.log(`🏛️ 州/省匹配: ${validation.state.match} (期望: ${validation.state.expected}, 实际: ${validation.state.actual})`);
                console.log(`📮 邮编匹配: ${validation.zip.match} (期望: ${validation.zip.expected}, 实际: ${validation.zip.actual})`);

                // 生成优化建议
                console.log("\n💡 优化建议:");
                console.log(`1. 推荐使用选择器: ${result.selector}`);
                console.log(`2. 建议等待时间: 2-3秒`);
                if (!validation.city.match || !validation.state.match || !validation.zip.match) {
                    console.log(`3. 需要更新配置数据以匹配自动填充结果`);
                }
            }

            // 截图保存
            const screenshotPath = path.join(__dirname, 'debug_screenshots', `address_test_${Date.now()}.png`);
            fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`📸 截图已保存: ${screenshotPath}`);

        } else {
            console.log("❌ 无法找到地址输入框进行测试");
        }

        console.log("\n⏸️ 测试完成，浏览器将保持打开状态供进一步调试...");
        console.log("按 Enter 键关闭浏览器");

        // 等待用户输入后关闭
        await new Promise(resolve => {
            process.stdin.once('data', () => resolve());
        });

    } catch (error) {
        console.log(`❌ 测试过程中出错: ${error.message}`);
        console.log(error.stack);
    } finally {
        await browser.close();
    }
}

// 运行测试
if (require.main === module) {
    testAddressAutocomplete().catch(console.error);
}

module.exports = {
    detectAndSelectAddressAutocomplete,
    validateAutoFillResults,
    humanFillInput
};