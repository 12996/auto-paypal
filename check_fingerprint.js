/**
 * 指纹检测测试脚本
 */
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/Los_Angeles',
    });

    const page = await context.newPage();

    // 访问 bot 检测页面
    console.log('正在访问 bot.sannysoft.com...');
    await page.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle', timeout: 60000 });

    // 等待检测完成
    await page.waitForTimeout(3000);

    // 截图保存结果
    await page.screenshot({ path: 'debug_html/fingerprint-bot-test.png', fullPage: true });
    console.log('截图已保存: debug_html/fingerprint-bot-test.png');

    // 获取检测结果
    const results = await page.evaluate(() => {
        const rows = document.querySelectorAll('table tr');
        const data = [];
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                const test = cells[0]?.textContent?.trim();
                const result = cells[1]?.textContent?.trim();
                const status = cells[1]?.className || '';
                data.push({ test, result, passed: status.includes('passed') || !status.includes('failed') });
            }
        });
        return data;
    });

    console.log('\n=== Bot 检测结果 ===');
    results.forEach(r => {
        const icon = r.passed ? '[PASS]' : '[FAIL]';
        console.log(`${icon} ${r.test}: ${r.result}`);
    });

    // 获取关键指纹信息
    const jsInfo = await page.evaluate(() => {
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemory: navigator.deviceMemory,
            languages: navigator.languages?.join(', '),
            webdriver: navigator.webdriver,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
    });

    console.log('\n=== JavaScript 指纹信息 ===');
    console.log('User-Agent:', jsInfo.userAgent);
    console.log('Platform:', jsInfo.platform);
    console.log('CPU 核心:', jsInfo.hardwareConcurrency);
    console.log('设备内存:', jsInfo.deviceMemory, 'GB');
    console.log('语言:', jsInfo.languages);
    console.log('Webdriver:', jsInfo.webdriver);
    console.log('时区:', jsInfo.timezone);

    await browser.close();
    console.log('\n测试完成！');
})();
