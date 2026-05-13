/**
 * 完美指纹伪装测试脚本
 */
const { chromium } = require('playwright');
const BrowserFingerprint = require('./lib/browser-fingerprint');

(async () => {
    console.log('=== 启动完美指纹伪装测试 ===\n');

    const browser = await chromium.launch({
        headless: false,
        ...BrowserFingerprint.getPlaywrightOptions()
    });

    // 使用指纹伪装创建上下文
    const context = await BrowserFingerprint.createStealthContext(browser, {
        hardwareConcurrency: 8,
        deviceMemory: 16
    });

    const page = await context.newPage();

    // 访问 bot 检测页面
    console.log('正在访问 bot.sannysoft.com...');
    await page.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle', timeout: 60000 });

    // 等待检测完成
    await page.waitForTimeout(5000);

    // 截图保存结果
    await page.screenshot({ path: 'debug_html/fingerprint-perfect-test.png', fullPage: true });
    console.log('截图已保存: debug_html/fingerprint-perfect-test.png');

    // 获取检测结果
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

    console.log('\n=== Bot 检测结果 ===');
    let failCount = 0;
    results.slice(0, 20).forEach(r => {
        const icon = r.failed ? '❌ [FAIL]' : '✅ [PASS]';
        console.log(`${icon} ${r.test}: ${r.result}`);
        if (r.failed) failCount++;
    });

    // 详细指纹验证
    const jsInfo = await page.evaluate(() => {
        const info = {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemory: navigator.deviceMemory,
            languages: navigator.languages?.join(', '),
            webdriver: navigator.webdriver,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            chromeExists: typeof window.chrome !== 'undefined',
            playwrightExists: typeof window.__playwright !== 'undefined',
            puppeteerExists: typeof window.__puppeteer !== 'undefined'
        };

        // WebGL 信息
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');
            if (gl) {
                info.webglVendor = gl.getParameter(gl.VENDOR);
                info.webglRenderer = gl.getParameter(gl.RENDERER);
            }
        } catch (e) {
            info.webglError = e.message;
        }

        // Canvas 指纹测试
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('Fingerprint test', 2, 2);
            info.canvasFingerprint = canvas.toDataURL().slice(-20);
        } catch (e) {
            info.canvasError = e.message;
        }

        return info;
    });

    console.log('\n=== 指纹信息验证 ===');
    console.log('User-Agent:', jsInfo.userAgent);
    console.log('Platform:', jsInfo.platform);
    console.log('CPU 核心:', jsInfo.hardwareConcurrency);
    console.log('设备内存:', jsInfo.deviceMemory, 'GB');
    console.log('语言:', jsInfo.languages);
    console.log('时区:', jsInfo.timezone);
    console.log('WebGL 供应商:', jsInfo.webglVendor);
    console.log('WebGL 渲染器:', jsInfo.webglRenderer);

    console.log('\n=== 自动化检测状态 ===');
    console.log('navigator.webdriver:', jsInfo.webdriver);
    console.log('Chrome 对象存在:', jsInfo.chromeExists);
    console.log('Playwright 痕迹:', jsInfo.playwrightExists);
    console.log('Puppeteer 痕迹:', jsInfo.puppeteerExists);

    // 评估伪装效果
    console.log('\n=== 伪装效果评估 ===');
    console.log(`总检测项: ${results.length}`);
    console.log(`失败项数: ${failCount}`);
    console.log(`成功率: ${((results.length - failCount) / results.length * 100).toFixed(1)}%`);

    let score = 100;
    const issues = [];

    if (jsInfo.webdriver !== undefined) {
        score -= 30;
        issues.push('webdriver 属性未完全隐藏');
    }

    if (jsInfo.playwrightExists) {
        score -= 25;
        issues.push('Playwright 痕迹未清理');
    }

    if (jsInfo.puppeteerExists) {
        score -= 25;
        issues.push('Puppeteer 痕迹未清理');
    }

    if (!jsInfo.chromeExists) {
        score -= 10;
        issues.push('Chrome 对象缺失');
    }

    if (failCount > 0) {
        score -= failCount * 5;
    }

    console.log(`\n🎯 指纹伪装评分: ${Math.max(0, score)}/100`);

    if (issues.length === 0 && failCount === 0) {
        console.log('🎉 完美！指纹伪装效果极佳！');
    } else if (score >= 80) {
        console.log('✨ 优秀！指纹伪装效果良好');
    } else if (score >= 60) {
        console.log('👍 良好，但仍有改进空间');
    } else {
        console.log('⚠️  需要进一步优化');
    }

    if (issues.length > 0) {
        console.log('\n发现的问题:');
        issues.forEach(issue => console.log(`  • ${issue}`));
    }

    await browser.close();
    console.log('\n=== 测试完成 ===');
})();