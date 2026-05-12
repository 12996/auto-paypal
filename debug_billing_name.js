/**
 * 专门的姓名字段填写调试脚本
 * 用于诊断 #billingName 字段填写失败的问题
 */

const { chromium } = require('playwright');

// 模拟配置
const CONFIG = {
    billing: {
        name: process.env.BILLING_NAME || "John Smith",
        email: process.env.BILLING_EMAIL || "test@example.com",
        address: process.env.BILLING_ADDRESS || "123 Main St",
        city: process.env.BILLING_CITY || "New York",
        state: process.env.BILLING_STATE || "NY",
        zip: process.env.BILLING_ZIP || "10001"
    }
};

// 随机延迟函数
const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// 复制原始的 humanFillInput 函数进行调试
async function debugHumanFillInput(page, locator, text, digitsMode = false, fastMode = false) {
    console.log(`🔍 [调试] 开始填写字段，文本: "${text}", digitsMode: ${digitsMode}, fastMode: ${fastMode}`);

    const digitsOnly = (s) => String(s || '').replace(/\D/g, '');

    // 检查元素状态
    console.log(`🔍 [调试] 检查元素状态...`);
    const isAttached = await locator.isAttached({ timeout: 2000 }).catch(() => false);
    const isVisible = await locator.isVisible({ timeout: 2000 }).catch(() => false);
    const isEnabled = await locator.isEnabled({ timeout: 2000 }).catch(() => false);
    const isEditable = await locator.isEditable({ timeout: 2000 }).catch(() => false);

    console.log(`   - isAttached: ${isAttached}`);
    console.log(`   - isVisible: ${isVisible}`);
    console.log(`   - isEnabled: ${isEnabled}`);
    console.log(`   - isEditable: ${isEditable}`);

    if (!isAttached || !isVisible) {
        console.log(`❌ [调试] 元素不可用，跳过填写`);
        return false;
    }

    // 获取元素属性
    try {
        const elementInfo = await locator.evaluate((el) => {
            return {
                tagName: el.tagName,
                type: el.type,
                id: el.id,
                className: el.className,
                placeholder: el.placeholder,
                value: el.value,
                readOnly: el.readOnly,
                disabled: el.disabled,
                required: el.required,
                maxLength: el.maxLength,
                style: {
                    display: window.getComputedStyle(el).display,
                    visibility: window.getComputedStyle(el).visibility,
                    opacity: window.getComputedStyle(el).opacity
                }
            };
        });
        console.log(`🔍 [调试] 元素信息:`, JSON.stringify(elementInfo, null, 2));
    } catch (error) {
        console.log(`⚠️ [调试] 获取元素信息失败: ${error.message}`);
    }

    // 检查是否有遮挡元素
    try {
        const boundingBox = await locator.boundingBox();
        if (boundingBox) {
            console.log(`🔍 [调试] 元素位置: x=${boundingBox.x}, y=${boundingBox.y}, width=${boundingBox.width}, height=${boundingBox.height}`);

            // 检查中心点是否被遮挡
            const centerX = boundingBox.x + boundingBox.width / 2;
            const centerY = boundingBox.y + boundingBox.height / 2;

            const elementAtPoint = await page.evaluate((x, y) => {
                const el = document.elementFromPoint(x, y);
                return el ? {
                    tagName: el.tagName,
                    id: el.id,
                    className: el.className
                } : null;
            }, centerX, centerY);

            console.log(`🔍 [调试] 中心点元素:`, elementAtPoint);
        }
    } catch (error) {
        console.log(`⚠️ [调试] 检查元素位置失败: ${error.message}`);
    }

    // 尝试填写 - 使用普通模式（姓名字段不是 digitsMode 或 fastMode）
    console.log(`🔍 [调试] 开始填写过程...`);

    let attempt = 0;
    while (attempt < 3) {
        attempt++;
        console.log(`🔍 [调试] 第 ${attempt} 次尝试填写...`);

        try {
            // 等待元素可见
            await locator.waitFor({ state: 'visible', timeout: 10000 });

            // 移动鼠标到元素
            const box = await locator.boundingBox().catch(() => null);
            if (box) {
                console.log(`🔍 [调试] 移动鼠标到元素中心...`);
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
                await page.waitForTimeout(randomDelay(200, 500));
            }

            // 点击元素
            console.log(`🔍 [调试] 点击元素...`);
            await locator.click();
            await page.waitForTimeout(randomDelay(100, 300));

            // 清空现有内容
            console.log(`🔍 [调试] 清空现有内容...`);
            await page.keyboard.press('Control+A');
            await page.waitForTimeout(100);
            await page.keyboard.press('Delete');
            await page.waitForTimeout(200);

            // 逐字符输入
            console.log(`🔍 [调试] 开始逐字符输入: "${text}"`);
            for (let i = 0; i < text.length; i++) {
                await page.keyboard.type(text[i]);
                await page.waitForTimeout(randomDelay(80, 200));

                // 每输入几个字符检查一次
                if (i % 3 === 0) {
                    const currentValue = await locator.inputValue().catch(() => '');
                    console.log(`   输入进度 ${i + 1}/${text.length}: "${currentValue}"`);
                }
            }

            await page.waitForTimeout(randomDelay(200, 400));

            // 触发事件
            console.log(`🔍 [调试] 触发 input/change/blur 事件...`);
            await locator.evaluate((node) => {
                try {
                    node.dispatchEvent(new Event('input', { bubbles: true }));
                    node.dispatchEvent(new Event('change', { bubbles: true }));
                    node.dispatchEvent(new Event('blur', { bubbles: true }));
                } catch (e) {
                    console.log('触发事件失败:', e);
                }
            }).catch(() => {});

            await page.waitForTimeout(300);

            // 验证结果
            const actualValue = await locator.inputValue().catch(() => '');
            console.log(`🔍 [调试] 填写结果验证: 预期="${text}", 实际="${actualValue}"`);

            if (actualValue === text) {
                console.log(`✅ [调试] 第 ${attempt} 次填写成功!`);
                return true;
            } else {
                console.log(`❌ [调试] 第 ${attempt} 次填写失败，值不匹配`);
            }

        } catch (error) {
            console.log(`❌ [调试] 第 ${attempt} 次填写出错: ${error.message}`);
        }
    }

    console.log(`❌ [调试] 所有尝试都失败了`);
    return false;
}

async function debugBillingNameField() {
    console.log('🚀 开始调试姓名字段填写问题...');
    console.log(`📋 配置信息: name="${CONFIG.billing.name}"`);

    const browser = await chromium.launch({
        headless: false,
        devtools: true,
        slowMo: 100
    });

    const context = await browser.newContext({
        viewport: { width: 1280, height: 720 }
    });

    const page = await context.newPage();

    try {
        // 这里需要一个测试页面URL，或者创建一个简单的测试页面
        console.log('📝 创建测试页面...');

        // 创建一个简单的测试页面
        await page.setContent(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>姓名字段测试</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .form-group { margin: 20px 0; }
                    input { padding: 10px; border: 1px solid #ccc; border-radius: 4px; width: 300px; }
                    label { display: block; margin-bottom: 5px; font-weight: bold; }
                    .test-results { margin-top: 20px; padding: 10px; background: #f5f5f5; }
                </style>
            </head>
            <body>
                <h1>姓名字段填写测试</h1>

                <div class="form-group">
                    <label for="billingName">账单姓名 (主要测试字段)</label>
                    <input type="text" id="billingName" name="billingName" placeholder="请输入姓名" />
                </div>

                <div class="form-group">
                    <label for="testName1">测试字段1 (普通input)</label>
                    <input type="text" id="testName1" name="testName1" placeholder="测试字段1" />
                </div>

                <div class="form-group">
                    <label for="testName2">测试字段2 (带maxlength)</label>
                    <input type="text" id="testName2" name="testName2" maxlength="50" placeholder="测试字段2" />
                </div>

                <div class="form-group">
                    <label for="testName3">测试字段3 (带事件监听)</label>
                    <input type="text" id="testName3" name="testName3" placeholder="测试字段3" />
                </div>

                <div class="test-results">
                    <h3>实时值监控:</h3>
                    <div id="results"></div>
                </div>

                <script>
                    // 添加事件监听器来监控输入
                    function updateResults() {
                        const results = document.getElementById('results');
                        const billingName = document.getElementById('billingName').value;
                        const testName1 = document.getElementById('testName1').value;
                        const testName2 = document.getElementById('testName2').value;
                        const testName3 = document.getElementById('testName3').value;

                        results.innerHTML = \`
                            <p><strong>billingName:</strong> "\${billingName}"</p>
                            <p><strong>testName1:</strong> "\${testName1}"</p>
                            <p><strong>testName2:</strong> "\${testName2}"</p>
                            <p><strong>testName3:</strong> "\${testName3}"</p>
                        \`;
                    }

                    // 为所有输入框添加事件监听
                    document.querySelectorAll('input').forEach(input => {
                        input.addEventListener('input', updateResults);
                        input.addEventListener('change', updateResults);
                        input.addEventListener('blur', updateResults);
                        input.addEventListener('focus', () => {
                            console.log('Focus on:', input.id);
                        });
                    });

                    // 为测试字段3添加特殊处理（模拟可能的干扰）
                    document.getElementById('testName3').addEventListener('input', function(e) {
                        console.log('testName3 input event:', e.target.value);
                        // 模拟一些网站可能有的输入处理
                        if (Math.random() < 0.1) {
                            console.log('模拟输入干扰...');
                            setTimeout(() => {
                                if (this.value.length > 0) {
                                    this.value = this.value.substring(0, this.value.length - 1);
                                    updateResults();
                                }
                            }, 50);
                        }
                    });

                    updateResults();
                </script>
            </body>
            </html>
        `);

        console.log('✅ 测试页面已创建');

        // 等待页面加载完成
        await page.waitForTimeout(1000);

        // 测试不同的字段
        const testFields = [
            { id: '#billingName', name: '主要测试字段 (billingName)' },
            { id: '#testName1', name: '普通input字段' },
            { id: '#testName2', name: '带maxlength字段' },
            { id: '#testName3', name: '带事件监听字段' }
        ];

        for (const field of testFields) {
            console.log(`\n🧪 测试字段: ${field.name}`);
            console.log('='.repeat(50));

            const locator = page.locator(field.id);
            const success = await debugHumanFillInput(page, locator, CONFIG.billing.name);

            console.log(`📊 ${field.name} 测试结果: ${success ? '✅ 成功' : '❌ 失败'}`);

            // 等待一下再测试下一个字段
            await page.waitForTimeout(2000);
        }

        console.log('\n📋 最终结果检查:');
        console.log('='.repeat(50));

        // 检查所有字段的最终值
        for (const field of testFields) {
            const locator = page.locator(field.id);
            const finalValue = await locator.inputValue().catch(() => '');
            const isCorrect = finalValue === CONFIG.billing.name;
            console.log(`${field.name}: "${finalValue}" ${isCorrect ? '✅' : '❌'}`);
        }

        // 保持浏览器打开以便手动检查
        console.log('\n🔍 浏览器将保持打开状态，请手动检查结果...');
        console.log('按 Ctrl+C 退出');

        // 等待用户手动关闭
        await new Promise(() => {});

    } catch (error) {
        console.error('❌ 调试过程中出错:', error);
    } finally {
        // 注释掉自动关闭，让用户手动检查
        // await browser.close();
    }
}

// 如果直接运行此脚本
if (require.main === module) {
    debugBillingNameField().catch(console.error);
}

module.exports = { debugHumanFillInput, debugBillingNameField };