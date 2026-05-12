/**
 * 关键修复点调试脚本
 * 专门验证我们修复的核心问题
 */

const puppeteer = require('puppeteer');

async function debugKeyFixes() {
    console.log('🔍 开始关键修复点调试...');

    let browser;
    try {
        // 启动浏览器
        browser = await puppeteer.launch({
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--proxy-server=socks5://frontier:oiH8raGAtfclvQReTX@77.111.110.100:30011'
            ]
        });

        const page = await browser.newPage();

        console.log('\n=== 测试 1: 金额校验多货币支持 ===');
        await testAmountValidation();

        console.log('\n=== 测试 2: 姓名字段 API 兼容性 ===');
        await testNameFieldCompatibility(page);

        console.log('\n=== 测试 3: 地址自动补全处理 ===');
        await testAddressAutocomplete(page);

        console.log('\n=== 测试 4: 提交按钮检测逻辑 ===');
        await testSubmitButtonDetection(page);

    } catch (error) {
        console.error('❌ 调试过程中出错:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// 测试金额校验函数
function testAmountValidation() {
    console.log('📊 测试多货币金额校验...');

    // 从 index.js 复制的修复后函数
    const normalizeAmount = (raw) => {
        if (!raw) return '';
        return raw.toString().replace(/[\s,]/g, '').trim();
    };

    const isZeroAmountText = (raw) => {
        const text = normalizeAmount(raw);
        const zeroPatterns = [
            /^[\$€£¥]?0(\.00)?$/,
            /^(US\$?|USD|EUR|GBP|JPY|CNY)0(\.00)?$/i,
            /^0(\.00)?[\$€£¥]?$/,
            /^0(\.00)?\s*(US\$?|USD|EUR|GBP|JPY|CNY)?$/i
        ];
        return zeroPatterns.some(pattern => pattern.test(text));
    };

    const testCases = [
        // 修复前失败的案例
        { input: '€0.00', expected: true, desc: '欧元零金额' },
        { input: '£0', expected: true, desc: '英镑零金额' },
        { input: '¥0.00', expected: true, desc: '日元零金额' },

        // 原有支持的案例
        { input: '$0.00', expected: true, desc: '美元零金额' },
        { input: 'US$0.00', expected: true, desc: 'US美元零金额' },

        // 非零金额
        { input: '€20.00', expected: false, desc: '欧元非零金额' },
        { input: '$5.99', expected: false, desc: '美元非零金额' }
    ];

    let passed = 0;
    testCases.forEach(({ input, expected, desc }) => {
        const result = isZeroAmountText(input);
        const status = result === expected ? '✅' : '❌';
        console.log(`  ${status} ${desc}: "${input}" → ${result}`);
        if (result === expected) passed++;
    });

    console.log(`📈 金额校验测试: ${passed}/${testCases.length} 通过`);
}

// 测试姓名字段兼容性
async function testNameFieldCompatibility(page) {
    console.log('👤 测试姓名字段 API 兼容性...');

    // 模拟不同的页面结构
    await page.setContent(`
        <html>
        <body>
            <!-- 新版 API 结构 -->
            <div id="Field-nameInput" class="FormFieldContainer">
                <input name="name" placeholder="姓名" />
            </div>

            <!-- 旧版 API 结构 -->
            <input id="name" name="billing_name" placeholder="Full name" />

            <!-- 其他可能的结构 -->
            <input class="name-field" data-testid="name-input" />
        </body>
        </html>
    `);

    // 从 index.js 复制的修复后选择器
    const nameSelectors = [
        '#Field-nameInput input[name="name"]',
        'input[name="name"]',
        'input[placeholder*="name" i]',
        'input[placeholder*="姓名"]',
        '#name',
        'input[name="billing_name"]',
        'input[data-testid*="name"]',
        '.name-field'
    ];

    console.log('🔍 测试姓名字段选择器优先级...');
    for (const selector of nameSelectors) {
        try {
            const element = await page.$(selector);
            if (element) {
                console.log(`  ✅ 找到字段: ${selector}`);
                break;
            } else {
                console.log(`  ⚪ 未找到: ${selector}`);
            }
        } catch (error) {
            console.log(`  ❌ 选择器错误: ${selector} - ${error.message}`);
        }
    }
}

// 测试地址自动补全
async function testAddressAutocomplete(page) {
    console.log('🏠 测试地址自动补全处理...');

    // 模拟 Google 地址自动补全
    await page.setContent(`
        <html>
        <body>
            <input id="address" placeholder="街道地址" />
            <div class="pac-container" style="display: none;">
                <div class="pac-item">
                    <span class="pac-matched">1600 Amphitheatre Parkway</span>, Mountain View, CA, USA
                </div>
            </div>

            <input id="city" placeholder="城市" style="display: none;" />
            <input id="state" placeholder="州/省" style="display: none;" />
            <input id="zip" placeholder="邮编" style="display: none;" />
        </body>
        </html>
    `);

    console.log('🔍 模拟地址输入和自动补全...');

    // 输入地址
    await page.type('#address', '1600 Amphitheatre');
    console.log('  ✅ 输入地址: 1600 Amphitheatre');

    // 显示自动补全下拉框
    await page.evaluate(() => {
        document.querySelector('.pac-container').style.display = 'block';
    });
    console.log('  ✅ 显示自动补全选项');

    // 检查是否有可选项
    const hasOptions = await page.$('.pac-item');
    console.log(`  ${hasOptions ? '✅' : '❌'} 检测到自动补全选项`);

    if (hasOptions) {
        // 点击第一个选项
        await page.click('.pac-item');
        console.log('  ✅ 选择第一个地址选项');

        // 模拟字段动态显示
        await page.evaluate(() => {
            document.getElementById('city').style.display = 'block';
            document.getElementById('state').style.display = 'block';
            document.getElementById('zip').style.display = 'block';

            // 模拟自动填充
            document.getElementById('city').value = 'Mountain View';
            document.getElementById('state').value = 'CA';
            document.getElementById('zip').value = '94043';
        });

        console.log('  ✅ 其他字段动态显示并自动填充');
    }
}

// 测试提交按钮检测
async function testSubmitButtonDetection(page) {
    console.log('🔘 测试提交按钮检测逻辑...');

    // 模拟不同的按钮结构
    await page.setContent(`
        <html>
        <body>
            <!-- 禁用的按钮 -->
            <button class="SubmitButton-IconContainer" disabled>
                <span>提交订单</span>
            </button>

            <!-- 启用的按钮 -->
            <button class="SubmitButton-IconContainer" style="opacity: 1;">
                <span>提交订单</span>
            </button>

            <!-- 其他可能的按钮 -->
            <button type="submit" class="submit-btn">Submit</button>
            <div role="button" tabindex="0" class="pay-button">Pay now</div>
        </body>
        </html>
    `);

    // 从 index.js 复制的修复后选择器
    const submitSelectors = [
        '.SubmitButton-IconContainer',
        'button[type="submit"]',
        '.submit-btn',
        '.pay-button',
        '[role="button"]'
    ];

    console.log('🔍 测试提交按钮检测逻辑...');

    for (const selector of submitSelectors) {
        try {
            const elements = await page.$$(selector);
            console.log(`  📍 选择器 ${selector}: 找到 ${elements.length} 个元素`);

            for (let i = 0; i < elements.length; i++) {
                const element = elements[i];

                // 检查可见性
                const isVisible = await element.evaluate(el => {
                    const style = window.getComputedStyle(el);
                    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                });

                // 检查是否启用
                const isEnabled = await element.evaluate(el => {
                    return !el.disabled && el.getAttribute('aria-disabled') !== 'true';
                });

                // 检查是否可点击
                const isClickable = isVisible && isEnabled;

                console.log(`    ${i + 1}. visible=${isVisible}, enabled=${isEnabled}, clickable=${isClickable}`);

                if (isClickable) {
                    console.log(`    ✅ 找到可用按钮: ${selector}[${i}]`);
                    return; // 找到第一个可用按钮就返回
                }
            }
        } catch (error) {
            console.log(`    ❌ 选择器错误: ${selector} - ${error.message}`);
        }
    }
}

// 运行调试
debugKeyFixes().then(() => {
    console.log('\n🎉 关键修复点调试完成！');
}).catch(error => {
    console.error('\n❌ 调试失败:', error);
});