/**
 * PayPal 注册指纹风控测试
 * 测试 CaliforniaFingerprint 在 PayPal 注册流程中是否触发风控
 *
 * 使用方法:
 *   node docs/test/test_fingerprint_paypal_signup.js
 *
 * 环境变量:
 *   PROXY - 代理地址 (可选，格式: http://user:pass@host:port)
 *   HEADFUL - 设为 1 显示浏览器窗口
 */

const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');

// 引入项目模块
const CaliforniaFingerprint = require('../../lib/california-fingerprint');
const { createProxyBridge, closeProxyBridge } = require('../../local-proxy-bridge');

chromium.use(StealthPlugin());

// 测试配置
const CONFIG = {
    proxy: process.env.PROXY || '',
    headful: process.env.HEADFUL === '1',
    // PayPal 注册页面
    signupUrl: 'https://www.paypal.com/us/webapps/mpp/account-selection',
    // 测试超时
    timeout: 60000
};

// 风控检测选择器
const RISK_SELECTORS = {
    // 安全挑战
    securityChallenge: [
        'text=Security Challenge',
        'text=security challenge',
        '[class*="security-challenge"]',
        '[data-testid*="security"]'
    ],
    // reCAPTCHA
    recaptcha: [
        'iframe[src*="recaptcha"]',
        'iframe[title*="reCAPTCHA"]',
        '.g-recaptcha',
        '[class*="recaptcha"]'
    ],
    // hCaptcha
    hcaptcha: [
        'iframe[src*="hcaptcha"]',
        'iframe[title*="hCaptcha"]',
        '[class*="hcaptcha"]'
    ],
    // 滑块验证
    slider: [
        '.slider',
        '[class*="slider"]',
        '[aria-label*="slider"]'
    ],
    // 手机验证
    phoneVerification: [
        'text=verify your phone',
        'text=phone number',
        'input[type="tel"]',
        '[data-testid*="phone"]'
    ],
    // 被拦截
    blocked: [
        'text=blocked',
        'text=suspicious activity',
        'text=unusual activity',
        'text=try again later'
    ],
    // 正常注册表单
    normalSignup: [
        'input[name="email"]',
        'input[type="email"]',
        '[data-testid="email-input"]'
    ]
};

// 结果记录
const results = {
    timestamp: new Date().toISOString(),
    fingerprint: null,
    proxyUsed: false,
    proxyIP: null,
    pageLoaded: false,
    riskDetected: {
        securityChallenge: false,
        recaptcha: false,
        hcaptcha: false,
        slider: false,
        phoneVerification: false,
        blocked: false
    },
    normalFormVisible: false,
    screenshots: [],
    errors: []
};

/**
 * 构建 Playwright 代理配置
 */
function buildPlaywrightProxy(proxyValue) {
    if (!proxyValue) return null;
    try {
        const parsed = new URL(proxyValue);
        const server = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
        const proxy = { server };
        if (parsed.username) proxy.username = decodeURIComponent(parsed.username);
        if (parsed.password) proxy.password = decodeURIComponent(parsed.password);
        return proxy;
    } catch (error) {
        console.warn(`[!] 代理 URL 解析失败: ${error.message}`);
        return { server: proxyValue };
    }
}

/**
 * 保存截图
 */
async function saveScreenshot(page, name) {
    const screenshotDir = path.join(__dirname, '../../debug_screenshots/fingerprint_test');
    fs.mkdirSync(screenshotDir, { recursive: true });
    const filename = `${name}_${Date.now()}.png`;
    const filepath = path.join(screenshotDir, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    results.screenshots.push(filepath);
    console.log(`📸 截图已保存: ${filepath}`);
    return filepath;
}

/**
 * 检测风控元素
 */
async function detectRiskElements(page) {
    console.log('\n🔍 开始检测风控元素...');

    const detected = {};

    for (const [riskType, selectors] of Object.entries(RISK_SELECTORS)) {
        detected[riskType] = false;

        for (const selector of selectors) {
            try {
                const element = page.locator(selector).first();
                const isVisible = await element.isVisible({ timeout: 2000 }).catch(() => false);

                if (isVisible) {
                    detected[riskType] = true;
                    const text = await element.textContent().catch(() => '');
                    console.log(`⚠️  检测到 ${riskType}: ${selector}`);
                    if (text) console.log(`   内容: ${text.slice(0, 100)}`);
                    break;
                }
            } catch (_) {
                // 继续检测下一个选择器
            }
        }

        if (!detected[riskType] && riskType !== 'normalSignup') {
            console.log(`✅ 未检测到 ${riskType}`);
        }
    }

    return detected;
}

/**
 * 检查代理连通性
 */
async function checkProxyConnectivity(context) {
    try {
        const response = await context.request.get('https://api.ipify.org/?format=text', {
            timeout: 15000
        });
        if (response.ok()) {
            const ip = (await response.text()).trim();
            // 隐藏部分 IP
            const maskedIP = ip.replace(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/, '***.***.$3.$4');
            console.log(`✅ 代理连接成功，出口 IP: ${maskedIP}`);
            results.proxyIP = maskedIP;
            return true;
        }
    } catch (error) {
        console.error(`❌ 代理连接失败: ${error.message}`);
        results.errors.push(`代理连接失败: ${error.message}`);
    }
    return false;
}

/**
 * 主测试函数
 */
async function runTest() {
    console.log('═'.repeat(60));
    console.log('🧪 PayPal 注册指纹风控测试');
    console.log('═'.repeat(60));

    let browser = null;
    let context = null;
    let proxyBridgeStarted = false;

    const launchOptions = {
        headless: !CONFIG.headful,
        args: ['--disable-blink-features=AutomationControlled']
    };

    try {
        // 1. 配置代理
        if (CONFIG.proxy) {
            console.log('\n📡 配置代理连接...');
            try {
                const bridge = await createProxyBridge({
                    remoteProxy: CONFIG.proxy,
                    localPort: 10809,  // 使用不同端口避免冲突
                    vpnPort: 7897,
                    useVpn: true,
                    vpnType: 'http'
                });
                proxyBridgeStarted = true;
                launchOptions.proxy = { server: bridge.localProxy };
                results.proxyUsed = true;
                console.log(`✅ 代理桥接已启动: ${bridge.localProxy}`);
            } catch (e) {
                console.warn(`⚠️  代理桥接失败，尝试直连: ${e.message}`);
                const proxyConfig = buildPlaywrightProxy(CONFIG.proxy);
                if (proxyConfig) {
                    launchOptions.proxy = proxyConfig;
                    results.proxyUsed = true;
                }
            }
        } else {
            console.log('\n⚠️  未配置代理，使用本地网络（可能触发风控）');
        }

        // 2. 启动浏览器
        console.log('\n🚀 启动浏览器...');
        browser = await chromium.launch(launchOptions);

        // 3. 生成加州指纹
        console.log('\n🌴 生成加州指纹...');
        const fingerprintConfig = CaliforniaFingerprint.generateRandomCaliforniaFingerprint();
        results.fingerprint = {
            region: fingerprintConfig.region,
            hardwareConcurrency: fingerprintConfig.hardwareConcurrency,
            deviceMemory: fingerprintConfig.deviceMemory,
            platform: fingerprintConfig.platform,
            timezone: fingerprintConfig.timezone,
            userAgent: fingerprintConfig.userAgent.slice(0, 80) + '...'
        };

        console.log(`   地区: ${fingerprintConfig.region}`);
        console.log(`   CPU: ${fingerprintConfig.hardwareConcurrency} 核`);
        console.log(`   内存: ${fingerprintConfig.deviceMemory} GB`);
        console.log(`   时区: ${fingerprintConfig.timezone}`);

        // 4. 创建带指纹的上下文
        console.log('\n🔧 应用指纹配置...');
        const { context: ctx, config } = await CaliforniaFingerprint.createCaliforniaContext(
            browser,
            fingerprintConfig
        );
        context = ctx;

        // 5. 检查代理连通性
        if (results.proxyUsed) {
            console.log('\n🌐 检查代理连通性...');
            await checkProxyConnectivity(context);
        }

        // 6. 创建页面并访问 PayPal
        console.log('\n📄 访问 PayPal 注册页面...');
        const page = await context.newPage();

        try {
            await page.goto(CONFIG.signupUrl, {
                waitUntil: 'domcontentloaded',
                timeout: CONFIG.timeout
            });
            results.pageLoaded = true;
            console.log(`✅ 页面加载成功: ${page.url()}`);
        } catch (error) {
            results.errors.push(`页面加载失败: ${error.message}`);
            console.error(`❌ 页面加载失败: ${error.message}`);
            await saveScreenshot(page, 'load_error');
            throw error;
        }

        // 7. 等待页面稳定
        console.log('\n⏳ 等待页面渲染...');
        await page.waitForTimeout(3000);
        await saveScreenshot(page, 'initial_load');

        // 8. 检测风控元素
        const riskDetected = await detectRiskElements(page);
        results.riskDetected = {
            securityChallenge: riskDetected.securityChallenge || false,
            recaptcha: riskDetected.recaptcha || false,
            hcaptcha: riskDetected.hcaptcha || false,
            slider: riskDetected.slider || false,
            phoneVerification: riskDetected.phoneVerification || false,
            blocked: riskDetected.blocked || false
        };
        results.normalFormVisible = riskDetected.normalSignup || false;

        // 9. 尝试点击注册按钮（如果存在）
        console.log('\n🖱️  尝试进入注册流程...');
        const signupButtons = [
            'text=Sign Up',
            'text=Get Started',
            'text=Personal',
            'a[href*="signup"]',
            'button:has-text("Sign")'
        ];

        for (const selector of signupButtons) {
            try {
                const btn = page.locator(selector).first();
                if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    console.log(`   点击: ${selector}`);
                    await btn.click();
                    await page.waitForTimeout(3000);
                    await saveScreenshot(page, 'after_signup_click');

                    // 再次检测风控
                    console.log('\n🔍 再次检测风控元素...');
                    const riskAfterClick = await detectRiskElements(page);

                    // 更新结果
                    for (const [key, value] of Object.entries(riskAfterClick)) {
                        if (value && key !== 'normalSignup') {
                            results.riskDetected[key] = true;
                        }
                    }
                    if (riskAfterClick.normalSignup) {
                        results.normalFormVisible = true;
                    }
                    break;
                }
            } catch (_) {
                // 继续尝试下一个选择器
            }
        }

        // 10. 最终截图
        await saveScreenshot(page, 'final_state');

        // 11. 如果是有头模式，暂停让用户观察
        if (CONFIG.headful) {
            console.log('\n⏸️  有头模式：按 Enter 关闭浏览器...');
            await new Promise(resolve => {
                process.stdin.once('data', () => resolve());
            });
        }

    } catch (error) {
        results.errors.push(error.message);
        console.error(`\n❌ 测试出错: ${error.message}`);
    } finally {
        // 清理资源
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
        if (proxyBridgeStarted) await closeProxyBridge().catch(() => {});
    }

    // 输出测试结果
    printResults();

    // 保存结果到文件
    await saveResults();

    return results;
}

/**
 * 打印测试结果
 */
function printResults() {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 测试结果汇总');
    console.log('═'.repeat(60));

    console.log(`\n⏰ 测试时间: ${results.timestamp}`);
    console.log(`🌐 使用代理: ${results.proxyUsed ? '是' : '否'}`);
    if (results.proxyIP) console.log(`📍 出口 IP: ${results.proxyIP}`);
    console.log(`📄 页面加载: ${results.pageLoaded ? '成功' : '失败'}`);

    if (results.fingerprint) {
        console.log(`\n🌴 指纹配置:`);
        console.log(`   地区: ${results.fingerprint.region}`);
        console.log(`   CPU/内存: ${results.fingerprint.hardwareConcurrency}核/${results.fingerprint.deviceMemory}GB`);
    }

    console.log(`\n🛡️  风控检测结果:`);
    const riskItems = [
        ['安全挑战', results.riskDetected.securityChallenge],
        ['reCAPTCHA', results.riskDetected.recaptcha],
        ['hCaptcha', results.riskDetected.hcaptcha],
        ['滑块验证', results.riskDetected.slider],
        ['手机验证', results.riskDetected.phoneVerification],
        ['被拦截', results.riskDetected.blocked]
    ];

    let hasRisk = false;
    for (const [name, detected] of riskItems) {
        const status = detected ? '⚠️  触发' : '✅ 未触发';
        console.log(`   ${name}: ${status}`);
        if (detected) hasRisk = true;
    }

    console.log(`\n📝 正常表单可见: ${results.normalFormVisible ? '是' : '否'}`);

    // 总结
    console.log('\n' + '─'.repeat(60));
    if (hasRisk) {
        console.log('⚠️  结论: 指纹配置触发了风控，建议检查以下方面:');
        console.log('   1. 代理 IP 是否干净（未被标记）');
        console.log('   2. 指纹参数是否与代理地区一致');
        console.log('   3. 是否需要更换代理或等待一段时间');
    } else if (results.normalFormVisible) {
        console.log('✅ 结论: 指纹配置通过风控检测，可正常进入注册流程');
    } else {
        console.log('❓ 结论: 无法确定，请检查截图进一步分析');
    }

    if (results.errors.length > 0) {
        console.log(`\n❌ 错误信息:`);
        results.errors.forEach(err => console.log(`   - ${err}`));
    }

    console.log('═'.repeat(60));
}

/**
 * 保存结果到文件
 */
async function saveResults() {
    const resultDir = path.join(__dirname, '../../debug_screenshots/fingerprint_test');
    fs.mkdirSync(resultDir, { recursive: true });

    const resultFile = path.join(resultDir, `result_${Date.now()}.json`);
    fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
    console.log(`\n📁 结果已保存: ${resultFile}`);
}

// 运行测试
if (require.main === module) {
    runTest()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error('测试失败:', err);
            process.exit(1);
        });
}

module.exports = { runTest, CONFIG, RISK_SELECTORS };
