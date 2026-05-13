/**
 * 完整的指纹伪装测试 - 使用新的指纹伪装库
 */
const { chromium } = require('playwright');
const FingerprintSpoofer = require('./lib/fingerprint-spoofer');

async function testFingerprint() {
    console.log('=== 完整指纹伪装测试 ===\n');

    // 创建指纹伪装器
    const spoofer = new FingerprintSpoofer({
        // 可以覆盖默认配置
        hardwareConcurrency: 8,
        deviceMemory: 16
    });

    const browser = await chromium.launch({
        headless: false,
        ...spoofer.getPlaywrightConfig()
    });

    const context = await browser.newContext(spoofer.getPlaywrightConfig());

    // 应用指纹伪装
    await spoofer.applyToContext(context);

    const page = await context.newPage();

    // 测试多个检测网站
    const testSites = [
        {
            name: 'Bot Detection',
            url: 'https://bot.sannysoft.com/',
            screenshot: 'debug_html/fingerprint-complete-bot.png'
        },
        {
            name: 'Fingerprint Test',
            url: 'https://fingerprintjs.github.io/fingerprintjs/',
            screenshot: 'debug_html/fingerprint-complete-fpjs.png'
        }
    ];

    for (const site of testSites) {
        console.log(`\n正在测试: ${site.name}`);
        console.log(`访问: ${site.url}`);

        try {
            await page.goto(site.url, { waitUntil: 'networkidle', timeout: 60000 });
            await page.waitForTimeout(5000);

            // 截图
            await page.screenshot({ path: site.screenshot, fullPage: true });
            console.log(`截图已保存: ${site.screenshot}`);

            if (site.url.includes('bot.sannysoft.com')) {
                await testBotDetection(page);
            } else if (site.url.includes('fingerprintjs')) {
                await testFingerprintJS(page);
            }

        } catch (error) {
            console.error(`测试 ${site.name} 时出错:`, error.message);
        }
    }

    // 详细指纹验证
    await detailedFingerprintCheck(page);

    await browser.close();
    console.log('\n=== 测试完成 ===');
}

async function testBotDetection(page) {
    console.log('\n--- Bot 检测结果 ---');

    const results = await page.evaluate(() => {
        const rows = document.querySelectorAll('table tr');
        const data = [];
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                const test = cells[0]?.textContent?.trim();
                const result = cells[1]?.textContent?.trim();
                const failed = cells[1]?.className?.includes('failed');
                if (test && test !== 'Test') {
                    data.push({ test, result, failed });
                }
            }
        });
        return data;
    });

    let failCount = 0;
    results.slice(0, 15).forEach(r => {
        const icon = r.failed ? '❌' : '✅';
        console.log(`${icon} ${r.test}: ${r.result}`);
        if (r.failed) failCount++;
    });

    console.log(`\n失败项数: ${failCount}/${results.length}`);

    if (failCount === 0) {
        console.log('🎉 完美通过所有 Bot 检测！');
    } else if (failCount <= 2) {
        console.log('✨ 表现良好，仅少量失败项');
    } else {
        console.log('⚠️  需要进一步优化指纹伪装');
    }
}

async function testFingerprintJS(page) {
    console.log('\n--- FingerprintJS 测试 ---');

    try {
        // 等待 FingerprintJS 加载完成
        await page.waitForSelector('#fingerprint', { timeout: 10000 });

        const fpResult = await page.evaluate(() => {
            const fpElement = document.querySelector('#fingerprint');
            return fpElement ? fpElement.textContent : 'Not found';
        });

        console.log('指纹ID:', fpResult);

        // 检查是否检测到自动化工具
        const automationDetected = await page.evaluate(() => {
            const bodyText = document.body.textContent.toLowerCase();
            return bodyText.includes('automation') ||
                   bodyText.includes('webdriver') ||
                   bodyText.includes('playwright') ||
                   bodyText.includes('puppeteer');
        });

        if (automationDetected) {
            console.log('⚠️  检测到自动化工具痕迹');
        } else {
            console.log('✅ 未检测到自动化工具');
        }

    } catch (error) {
        console.log('FingerprintJS 测试失败:', error.message);
    }
}

async function detailedFingerprintCheck(page) {
    console.log('\n--- 详细指纹验证 ---');

    const fingerprint = await page.evaluate(() => {
        const fp = {};

        // 基础信息
        fp.userAgent = navigator.userAgent;
        fp.platform = navigator.platform;
        fp.language = navigator.language;
        fp.languages = navigator.languages;
        fp.cookieEnabled = navigator.cookieEnabled;
        fp.doNotTrack = navigator.doNotTrack;

        // 硬件信息
        fp.hardwareConcurrency = navigator.hardwareConcurrency;
        fp.deviceMemory = navigator.deviceMemory;
        fp.maxTouchPoints = navigator.maxTouchPoints;

        // 屏幕信息
        fp.screenWidth = screen.width;
        fp.screenHeight = screen.height;
        fp.availWidth = screen.availWidth;
        fp.availHeight = screen.availHeight;
        fp.colorDepth = screen.colorDepth;
        fp.pixelDepth = screen.pixelDepth;

        // 时区
        fp.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        fp.timezoneOffset = new Date().getTimezoneOffset();

        // WebGL
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
                fp.webglVendor = gl.getParameter(gl.VENDOR);
                fp.webglRenderer = gl.getParameter(gl.RENDERER);
            }
        } catch (e) {
            fp.webglError = e.message;
        }

        // Canvas 指纹
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('Canvas fingerprint test 🎨', 2, 2);
            fp.canvasFingerprint = canvas.toDataURL().slice(-50); // 只取最后50字符
        } catch (e) {
            fp.canvasError = e.message;
        }

        // 自动化检测
        fp.webdriver = navigator.webdriver;
        fp.chromeExists = typeof window.chrome !== 'undefined';
        fp.playwrightExists = typeof window.__playwright !== 'undefined';
        fp.puppeteerExists = typeof window.__puppeteer !== 'undefined';

        // 权限
        fp.permissions = typeof navigator.permissions !== 'undefined';

        return fp;
    });

    console.log('User-Agent:', fingerprint.userAgent);
    console.log('Platform:', fingerprint.platform);
    console.log('CPU 核心数:', fingerprint.hardwareConcurrency);
    console.log('设备内存:', fingerprint.deviceMemory, 'GB');
    console.log('屏幕分辨率:', `${fingerprint.screenWidth}x${fingerprint.screenHeight}`);
    console.log('时区:', fingerprint.timezone);
    console.log('WebGL 供应商:', fingerprint.webglVendor);
    console.log('WebGL 渲染器:', fingerprint.webglRenderer);
    console.log('Canvas 指纹:', fingerprint.canvasFingerprint);

    console.log('\n--- 自动化检测状态 ---');
    console.log('navigator.webdriver:', fingerprint.webdriver);
    console.log('Chrome 对象存在:', fingerprint.chromeExists);
    console.log('Playwright 痕迹:', fingerprint.playwrightExists);
    console.log('Puppeteer 痕迹:', fingerprint.puppeteerExists);

    // 评估伪装效果
    let score = 100;
    const issues = [];

    if (fingerprint.webdriver !== undefined) {
        score -= 30;
        issues.push('webdriver 属性未完全隐藏');
    }

    if (fingerprint.playwrightExists) {
        score -= 25;
        issues.push('Playwright 痕迹未清理');
    }

    if (fingerprint.puppeteerExists) {
        score -= 25;
        issues.push('Puppeteer 痕迹未清理');
    }

    if (!fingerprint.chromeExists) {
        score -= 10;
        issues.push('Chrome 对象缺失');
    }

    if (fingerprint.hardwareConcurrency === 1) {
        score -= 15;
        issues.push('CPU 核心数异常');
    }

    console.log(`\n--- 伪装效果评分: ${score}/100 ---`);

    if (issues.length === 0) {
        console.log('🎉 指纹伪装完美！');
    } else {
        console.log('发现的问题:');
        issues.forEach(issue => console.log(`  ⚠️  ${issue}`));
    }
}

// 运行测试
testFingerprint().catch(console.error);