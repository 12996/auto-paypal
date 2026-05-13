/**
 * 使用 stealth 插件的指纹测试
 */
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();

chromium.use(stealth);

const fp = {
    chromeVersion: 125,
    hardwareConcurrency: 8,
    deviceMemory: 16,
    webgl: {
        vendor: 'Google Inc. (Intel)',
        renderer: 'ANGLE (Intel, Intel Iris Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)'
    }
};

const fingerprintScript = `
    const safeDefine = (obj, prop, getter) => {
        try {
            Object.defineProperty(obj, prop, {
                get: getter,
                configurable: true,
                enumerable: true
            });
        } catch (e) {}
    };

    const NavProto = Navigator.prototype;
    safeDefine(NavProto, 'hardwareConcurrency', () => ${fp.hardwareConcurrency});
    safeDefine(NavProto, 'deviceMemory', () => ${fp.deviceMemory});

    // WebGL 伪装
    const getParameterProxyHandler = {
        apply: function(target, thisArg, args) {
            if (args[0] === 37445) return '${fp.webgl.vendor}';
            if (args[0] === 37446) return '${fp.webgl.renderer}';
            return Reflect.apply(target, thisArg, args);
        }
    };
    WebGLRenderingContext.prototype.getParameter = new Proxy(
        WebGLRenderingContext.prototype.getParameter, getParameterProxyHandler
    );
    if (typeof WebGL2RenderingContext !== 'undefined') {
        WebGL2RenderingContext.prototype.getParameter = new Proxy(
            WebGL2RenderingContext.prototype.getParameter, getParameterProxyHandler
        );
    }

    console.log('[Fingerprint] Stealth + custom spoofing applied!');
`;

(async () => {
    console.log('使用 playwright-extra stealth 插件启动...\n');

    const browser = await chromium.launch({
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
        ]
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/Los_Angeles',
    });

    await context.addInitScript(fingerprintScript);

    const page = await context.newPage();

    console.log('正在访问 bot.sannysoft.com (stealth 模式)...');
    await page.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'debug_html/fingerprint-stealth-test.png', fullPage: true });
    console.log('截图已保存: debug_html/fingerprint-stealth-test.png');

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
                if (test) data.push({ test, result, failed });
            }
        });
        return data;
    });

    console.log('\n=== Bot 检测结果 (Stealth 模式) ===');
    let failCount = 0;
    results.slice(0, 20).forEach(r => {
        const icon = r.failed ? '[FAIL]' : '[PASS]';
        console.log(`${icon} ${r.test}: ${r.result}`);
        if (r.failed) failCount++;
    });

    console.log(`\n总失败项: ${failCount}`);

    // 验证指纹值
    const jsInfo = await page.evaluate(() => ({
        webdriver: navigator.webdriver,
        hardwareConcurrency: navigator.hardwareConcurrency,
        deviceMemory: navigator.deviceMemory,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }));

    console.log('\n=== 指纹验证 ===');
    console.log('Webdriver:', jsInfo.webdriver);
    console.log('CPU 核心:', jsInfo.hardwareConcurrency);
    console.log('设备内存:', jsInfo.deviceMemory, 'GB');
    console.log('时区:', jsInfo.timezone);

    await browser.close();
    console.log('\n测试完成！');
})();
