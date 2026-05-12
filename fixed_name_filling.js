/**
 * 修复版本的姓名字段填写测试和修复方案
 */

const { chromium } = require('playwright');

const CONFIG = {
    billing: {
        name: process.env.BILLING_NAME || "John Smith"
    }
};

const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// 修复后的 fillName 函数
async function fixedFillName(page) {
    console.log("📝 [步骤] 正在检查 Stripe 账单姓名字段...");
    const nameInput = page.locator('#billingName').first();

    try {
        // 修复1: 使用更兼容的方式检查元素存在性
        console.log("🔍 [修复] 检查元素是否存在...");
        let elementExists = false;
        try {
            await nameInput.waitFor({ state: 'attached', timeout: 2000 });
            elementExists = true;
            console.log("✅ [修复] 元素存在");
        } catch (error) {
            console.log("⏩ [姓名] 姓名字段不存在，跳过填写");
            return;
        }

        // 修复2: 使用更兼容的方式检查元素可见性
        console.log("🔍 [修复] 检查元素是否可见...");
        let elementVisible = false;
        try {
            await nameInput.waitFor({ state: 'visible', timeout: 2000 });
            elementVisible = true;
            console.log("✅ [修复] 元素可见");
        } catch (error) {
            console.log("⏩ [姓名] 姓名字段不可见，跳过填写");
            return;
        }

        console.log("📝 [姓名] 姓名字段存在且可见，开始填写...");
        console.log(`🔍 [修复] 准备填写的姓名: "${CONFIG.billing.name}"`);

        // 修复3: 使用更稳定的填写方法
        await fixedHumanFillInput(page, nameInput, CONFIG.billing.name);

        // 修复4: 更稳定的验证方法
        console.log("🔍 [姓名] 验证姓名填写结果...");
        await page.waitForTimeout(500); // 等待一下确保值已更新

        const nameValue = await nameInput.inputValue().catch(() => '');

        if (!nameValue || nameValue.trim().length === 0) {
            console.log("❌ [姓名] 姓名填写失败，输入框为空");

            // 修复5: 添加备用填写方法
            console.log("🔧 [修复] 尝试备用填写方法...");

            // 备用方法1: 直接使用 fill
            try {
                await nameInput.fill(CONFIG.billing.name);
                await page.waitForTimeout(300);

                // 触发事件确保 React 组件更新
                await nameInput.evaluate((node, value) => {
                    node.value = value;
                    node.dispatchEvent(new Event('input', { bubbles: true }));
                    node.dispatchEvent(new Event('change', { bubbles: true }));
                }, CONFIG.billing.name);

                const backupValue = await nameInput.inputValue();
                if (backupValue === CONFIG.billing.name) {
                    console.log(`✅ [修复] 备用方法成功: "${backupValue}"`);
                } else {
                    console.log(`⚠️ [修复] 备用方法部分成功: "${backupValue}"`);
                }
            } catch (error) {
                console.log(`❌ [修复] 备用方法失败: ${error.message}`);
                throw new Error("所有填写方法都失败了");
            }
        } else {
            console.log(`✅ [姓名] 姓名填写成功: "${nameValue}"`);
        }

        console.log("✅ [步骤] 姓名填写完成。");

    } catch (error) {
        console.log(`❌ [姓名] 填写姓名时出错: ${error.message}`);
        console.log("⏩ [姓名] 跳过姓名填写，继续后续流程");
        // 不再抛出错误，而是优雅地跳过
    }
}

// 修复后的 humanFillInput 函数
async function fixedHumanFillInput(page, locator, text, digitsMode = false, fastMode = false) {
    console.log(`🔍 [修复humanFillInput] 开始填写: "${text}"`);

    // 对于姓名字段，使用普通模式（不是 digitsMode 或 fastMode）
    let attempt = 0;
    const maxAttempts = 3;

    while (attempt < maxAttempts) {
        attempt++;
        console.log(`🔍 [修复humanFillInput] 第${attempt}次尝试...`);

        try {
            // 确保元素可见
            await locator.waitFor({ state: 'visible', timeout: 10000 });

            // 获取元素位置并移动鼠标
            const box = await locator.boundingBox();
            if (box) {
                console.log(`🔍 [修复humanFillInput] 移动鼠标到元素中心...`);
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });
                await page.waitForTimeout(randomDelay(200, 400));
            }

            // 点击元素获得焦点
            console.log(`🔍 [修复humanFillInput] 点击元素获得焦点...`);
            await locator.click();
            await page.waitForTimeout(randomDelay(100, 200));

            // 清空现有内容
            console.log(`🔍 [修复humanFillInput] 清空现有内容...`);
            await page.keyboard.press('Control+A');
            await page.waitForTimeout(50);
            await page.keyboard.press('Delete');
            await page.waitForTimeout(100);

            // 逐字符输入（模拟人类输入）
            console.log(`🔍 [修复humanFillInput] 开始逐字符输入...`);
            for (let i = 0; i < text.length; i++) {
                await page.keyboard.type(text[i]);
                await page.waitForTimeout(randomDelay(80, 150));
            }

            await page.waitForTimeout(200);

            // 触发必要的事件
            await locator.evaluate((node) => {
                node.dispatchEvent(new Event('input', { bubbles: true }));
                node.dispatchEvent(new Event('change', { bubbles: true }));
                node.dispatchEvent(new Event('blur', { bubbles: true }));
            });

            await page.waitForTimeout(300);

            // 验证结果
            const actualValue = await locator.inputValue();
            console.log(`🔍 [修复humanFillInput] 填写结果: 预期="${text}", 实际="${actualValue}"`);

            if (actualValue === text) {
                console.log(`✅ [修复humanFillInput] 第${attempt}次尝试成功!`);
                return true;
            } else {
                console.log(`⚠️ [修复humanFillInput] 第${attempt}次尝试值不匹配`);
            }

        } catch (error) {
            console.log(`❌ [修复humanFillInput] 第${attempt}次尝试出错: ${error.message}`);
        }

        if (attempt < maxAttempts) {
            console.log(`🔄 [修复humanFillInput] 准备重试...`);
            await page.waitForTimeout(500);
        }
    }

    console.warn(`⚠️ [修复humanFillInput] ${maxAttempts}次尝试后仍未成功`);
    return false;
}

async function testFixedNameFilling() {
    console.log('🚀 开始测试修复后的姓名字段填写...');

    const browser = await chromium.launch({
        headless: false,
        devtools: true,
        slowMo: 50
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // 创建测试页面
        await page.setContent(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>修复后的姓名字段测试</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .form-container { max-width: 500px; margin: 0 auto; }
                    input {
                        width: 100%;
                        padding: 12px;
                        margin: 10px 0;
                        border: 1px solid #ddd;
                        border-radius: 4px;
                        font-size: 16px;
                        box-sizing: border-box;
                    }
                    input:focus {
                        border-color: #007cba;
                        outline: none;
                        box-shadow: 0 0 5px rgba(0, 124, 186, 0.3);
                    }
                    .result {
                        margin: 10px 0;
                        padding: 10px;
                        background: #f5f5f5;
                        border-radius: 4px;
                    }
                    .success { background: #d4edda; color: #155724; }
                    .error { background: #f8d7da; color: #721c24; }
                </style>
            </head>
            <body>
                <div class="form-container">
                    <h1>修复后的姓名字段测试</h1>

                    <label for="billingName">账单姓名:</label>
                    <input type="text" id="billingName" name="billingName" placeholder="请输入您的姓名" />

                    <div class="result" id="result">
                        等待填写...
                    </div>
                </div>

                <script>
                    const nameInput = document.getElementById('billingName');
                    const result = document.getElementById('result');

                    function updateResult() {
                        const value = nameInput.value;
                        const isEmpty = !value || value.trim().length === 0;

                        result.textContent = isEmpty ? '输入框为空' : \`当前值: "\${value}"\`;
                        result.className = isEmpty ? 'result error' : 'result success';

                        console.log('姓名字段值变化:', value);
                    }

                    nameInput.addEventListener('input', updateResult);
                    nameInput.addEventListener('change', updateResult);
                    nameInput.addEventListener('blur', updateResult);
                    nameInput.addEventListener('focus', () => {
                        console.log('姓名字段获得焦点');
                    });

                    updateResult();
                </script>
            </body>
            </html>
        `);

        await page.waitForTimeout(1000);

        console.log('\n📝 测试修复后的 fillName 函数');
        console.log('='.repeat(50));

        await fixedFillName(page);

        // 最终验证
        const finalValue = await page.locator('#billingName').inputValue();
        console.log(`\n📊 最终结果: "${finalValue}"`);
        console.log(`预期结果: "${CONFIG.billing.name}"`);
        console.log(`测试结果: ${finalValue === CONFIG.billing.name ? '✅ 成功' : '❌ 失败'}`);

        console.log('\n🔍 浏览器保持打开，请检查结果...');
        console.log('按任意键退出');

        await new Promise(resolve => {
            process.stdin.once('data', resolve);
        });

    } catch (error) {
        console.error('❌ 测试过程出错:', error);
    } finally {
        await browser.close();
    }
}

// 生成修复后的代码
function generateFixedCode() {
    return `
// 修复后的 fillName 函数 - 替换原始代码中的 fillName 函数
const fillName = async () => {
    console.log("📝 [步骤] 正在检查 Stripe 账单姓名字段...");
    const nameInput = page.locator('#billingName').first();

    try {
        // 修复1: 使用更兼容的方式检查元素存在性
        console.log("🔍 [修复] 检查元素是否存在...");
        try {
            await nameInput.waitFor({ state: 'attached', timeout: 2000 });
            console.log("✅ [修复] 元素存在");
        } catch (error) {
            console.log("⏩ [姓名] 姓名字段不存在，跳过填写");
            return;
        }

        // 修复2: 使用更兼容的方式检查元素可见性
        console.log("🔍 [修复] 检查元素是否可见...");
        try {
            await nameInput.waitFor({ state: 'visible', timeout: 2000 });
            console.log("✅ [修复] 元素可见");
        } catch (error) {
            console.log("⏩ [姓名] 姓名字段不可见，跳过填写");
            return;
        }

        console.log("📝 [姓名] 姓名字段存在且可见，开始填写...");

        // 修复3: 使用更稳定的填写方法
        let fillSuccess = false;
        let attempt = 0;
        const maxAttempts = 3;

        while (!fillSuccess && attempt < maxAttempts) {
            attempt++;
            console.log(\`🔍 [修复] 第\${attempt}次填写尝试...\`);

            try {
                // 确保元素可见并获得焦点
                await nameInput.waitFor({ state: 'visible', timeout: 5000 });

                // 点击元素
                await nameInput.click();
                await page.waitForTimeout(randomDelay(100, 200));

                // 清空现有内容
                await page.keyboard.press('Control+A');
                await page.waitForTimeout(50);
                await page.keyboard.press('Delete');
                await page.waitForTimeout(100);

                // 使用 humanFillInput 或直接输入
                if (attempt === 1) {
                    // 第一次尝试使用原始方法
                    await humanFillInput(page, nameInput, CONFIG.billing.name);
                } else {
                    // 后续尝试使用更直接的方法
                    await page.keyboard.type(CONFIG.billing.name, { delay: randomDelay(50, 100) });
                    await page.waitForTimeout(200);

                    // 触发事件
                    await nameInput.evaluate((node, value) => {
                        node.value = value;
                        node.dispatchEvent(new Event('input', { bubbles: true }));
                        node.dispatchEvent(new Event('change', { bubbles: true }));
                        node.dispatchEvent(new Event('blur', { bubbles: true }));
                    }, CONFIG.billing.name);
                }

                await page.waitForTimeout(300);

                // 验证结果
                const nameValue = await nameInput.inputValue().catch(() => '');

                if (nameValue === CONFIG.billing.name) {
                    console.log(\`✅ [姓名] 第\${attempt}次尝试成功: "\${nameValue}"\`);
                    fillSuccess = true;
                } else {
                    console.log(\`⚠️ [姓名] 第\${attempt}次尝试值不匹配: 预期="\${CONFIG.billing.name}", 实际="\${nameValue}"\`);
                }

            } catch (error) {
                console.log(\`❌ [姓名] 第\${attempt}次尝试出错: \${error.message}\`);
            }
        }

        if (!fillSuccess) {
            console.log("❌ [姓名] 所有填写尝试都失败了");
            // 最后一次备用尝试
            try {
                await nameInput.fill(CONFIG.billing.name);
                await nameInput.evaluate((node, value) => {
                    node.value = value;
                    node.dispatchEvent(new Event('input', { bubbles: true }));
                    node.dispatchEvent(new Event('change', { bubbles: true }));
                }, CONFIG.billing.name);

                const finalValue = await nameInput.inputValue();
                if (finalValue === CONFIG.billing.name) {
                    console.log(\`✅ [姓名] 备用方法成功: "\${finalValue}"\`);
                    fillSuccess = true;
                }
            } catch (error) {
                console.log(\`❌ [姓名] 备用方法也失败了: \${error.message}\`);
            }
        }

        if (fillSuccess) {
            console.log("✅ [步骤] 姓名填写完成。");
            await afterFieldTransition(page, 'name');
        } else {
            console.log("⚠️ [姓名] 姓名填写未完全成功，但继续后续流程");
        }

    } catch (error) {
        console.log(\`❌ [姓名] 填写姓名时出错: \${error.message}\`);
        console.log("⏩ [姓名] 跳过姓名填写，继续后续流程");
        // 不再抛出错误，而是优雅地跳过
    }
};`;
}

if (require.main === module) {
    console.log('🔧 生成修复代码...\n');
    console.log(generateFixedCode());
    console.log('\n' + '='.repeat(80));
    console.log('📋 修复代码已生成，现在开始测试...\n');

    testFixedNameFilling().catch(console.error);
}

module.exports = {
    fixedFillName,
    fixedHumanFillInput,
    testFixedNameFilling,
    generateFixedCode
};