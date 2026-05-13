/**
 * 增强版指纹伪装测试
 */
const { chromium } = require('playwright');

const fp = {
    chromeVersion: 125,
    hardwareConcurrency: 8,
    deviceMemory: 16,
    screen: { width: 1920, height: 1080 },
    platform: 'Win32',
    languages: ['en-US', 'en'],
    vendor: 'Google Inc.',
    webgl: {
        vendor: 'Google Inc. (Intel)',
        renderer: 'ANGLE (Intel, Intel Iris Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)'
    }
};

const fingerprintScript = `
    // 更彻底地隐藏 webdriver
    delete Object.getPrototypeOf(navigator).webdriver;

    // 备用方案
    Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
    });

    // 删除 Playwright/Puppeteer 特征
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
    delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
    delete window.__playwright;
    delete window.__pw_manual;
    delete window.__PW_inspect;

    // 移除 Chrome DevTools 协议痕迹
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
    );

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
    safeDefine(NavProto, 'platform', () => '${fp.platform}');
    safeDefine(NavProto, 'languages', () => ${JSON.stringify(fp.languages)});
    safeDefine(NavProto, 'maxTouchPoints', () => 0);
    safeDefine(NavProto, 'vendor', () => '${fp.vendor}');

    safeDefine(NavProto, 'userAgentData', () => ({
        brands: [
            { brand: 'Chromium', version: '${fp.chromeVersion}' },
            { brand: 'Google Chrome', version: '${fp.chromeVersion}' },
            { brand: 'Not-A.Brand', version: '99' }
        ],
        mobile: false,
        platform: 'Windows',
        getHighEntropyValues: async () => ({
            architecture: 'x86',
            bitness: '64',
            platformVersion: '10.0.0',
            uaFullVersion: '${fp.chromeVersion}.0.0.0'
        })
    }));

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

    // 伪装 chrome 对象
    if (!window.chrome) {
        window.chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {}
        };
    }

    console.log('[Fingerprint] Enhanced spoofing applied!');
`;

(async () => {
    const browser = await chromium.launch({
        headless: false,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-site-isolation-trials',
            '--disable-web-security',
            '--no-first-run',
            '--no-default-browser-check',
        ]
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'en-US',
        timezoneId: 'America/Los_Angeles',
        permissions: ['geolocation'],
    });

    await context.addInitScript(fingerprintScript);

    const page = await context.newPage();

    console.log('正在访问 bot.sannysoft.com (增强版指纹伪装)...');
    await page.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(3000);

    await page.screenshot({ path: 'debug_html/fingerprint-enhanced-test.png', fullPage: true });
    console.log('截图已保存: debug_html/fingerprint-enhanced-test.png');

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

    console.log('\n=== Bot 检测结果 (增强版) ===');
    let failCount = 0;
    results.slice(0, 15).forEach(r => {
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
        chrome: typeof window.chrome !== 'undefined',
    }));

    console.log('\n=== 指纹验证 ===');
    console.log('Webdriver:', jsInfo.webdriver);
    console.log('CPU 核心:', jsInfo.hardwareConcurrency);
    console.log('设备内存:', jsInfo.deviceMemory, 'GB');
    console.log('时区:', jsInfo.timezone);
    console.log('Chrome对象:', jsInfo.chrome ? '存在' : '不存在');

    await browser.close();
    console.log('\n测试完成！');
})();
