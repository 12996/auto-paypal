/**
 * iPhone Safari 指纹伪装测试
 * 基于原项目的 Playwright 环境，完全模拟 iPhone 14 Pro + iOS 17 + Safari 17
 */

const { chromium } = require('playwright');

/**
 * 创建 iPhone Safari 指纹伪装脚本
 * @param {string} safariVersion Safari 版本号
 * @returns {string} 注入脚本
 */
function createiPhoneSafariFingerprint(safariVersion = '17') {
    return `
        // 🍎 iPhone Safari 指纹伪装 - iOS 17 + Safari 17
        const NavProto = Object.getPrototypeOf(navigator);
        const ScrProto = Object.getPrototypeOf(screen);
        const safeDefine = (obj, key, getter) => {
            try { Object.defineProperty(obj, key, { get: getter, configurable: true }); } catch (_) { }
        };

        console.log('🍎 [指纹伪装] 开始注入 iPhone Safari 环境...');

        // 1. 移除 webdriver 痕迹
        try { delete Object.getPrototypeOf(navigator).webdriver; } catch (_) { }
        safeDefine(NavProto, 'webdriver', () => undefined);
        try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true }); } catch (_) { }

        // 2. iPhone Safari User-Agent Data (iOS 实际不支持，但保留兼容性)
        try {
            const uaData = {
                brands: [
                    { brand: 'Not)A;Brand', version: '8' },
                    { brand: 'Safari', version: String(${safariVersion}) },
                    { brand: 'Mobile Safari', version: String(${safariVersion}) }
                ],
                mobile: true,  // ← iPhone 是移动设备
                platform: 'iOS',  // ← iOS 平台
                getHighEntropyValues: () => Promise.resolve({
                    architecture: 'arm64',  // ← iPhone 使用 ARM64 架构
                    bitness: '64',
                    brands: uaData.brands,
                    fullVersionList: uaData.brands.map(b => ({ brand: b.brand, version: \`\${b.version}.0.0\` })),
                    mobile: true,
                    model: 'iPhone',
                    platform: 'iOS',
                    platformVersion: '17.0.0',  // ← iOS 17
                    uaFullVersion: \`${safariVersion}.0.0\`,
                    wow64: false
                }),
                toJSON: () => ({ brands: uaData.brands, mobile: uaData.mobile, platform: uaData.platform })
            };
            safeDefine(NavProto, 'userAgentData', () => uaData);
        } catch (_) { }

        // 3. iPhone Safari 插件配置 (Safari 移动版插件很少)
        try {
            const pdfMime = Object.create(MimeType.prototype);
            Object.defineProperties(pdfMime, {
                type: { get: () => 'application/pdf' },
                suffixes: { get: () => 'pdf' },
                description: { get: () => 'Portable Document Format' }
            });

            const pdfPlugin = Object.create(Plugin.prototype);
            Object.defineProperties(pdfPlugin, {
                name: { get: () => 'WebKit built-in PDF' },  // ← Safari 特有
                filename: { get: () => 'internal-pdf-viewer' },
                description: { get: () => 'Portable Document Format' },
                length: { get: () => 1 },
                0: { get: () => pdfMime }
            });

            pdfPlugin.item = () => pdfMime;
            pdfPlugin.namedItem = () => pdfMime;

            const fakePlugins = Object.create(PluginArray.prototype);
            Object.defineProperties(fakePlugins, { length: { get: () => 1 }, 0: { get: () => pdfPlugin } });
            fakePlugins.item = () => pdfPlugin;
            fakePlugins.namedItem = (n) => n === pdfPlugin.name ? pdfPlugin : null;
            fakePlugins.refresh = () => { };

            const fakeMimeTypes = Object.create(MimeTypeArray.prototype);
            Object.defineProperties(fakeMimeTypes, { length: { get: () => 1 }, 0: { get: () => pdfMime } });
            fakeMimeTypes.item = () => pdfMime;
            fakeMimeTypes.namedItem = (n) => n === pdfMime.type ? pdfMime : null;

            safeDefine(NavProto, 'plugins', () => fakePlugins);
            safeDefine(NavProto, 'mimeTypes', () => fakeMimeTypes);
        } catch (_) { }

        // 4. iPhone Safari Navigator 属性
        safeDefine(NavProto, 'languages', () => ['en-US', 'en']);
        safeDefine(NavProto, 'language', () => 'en-US');
        safeDefine(NavProto, 'platform', () => 'iPhone');  // ← iPhone 平台标识
        safeDefine(NavProto, 'hardwareConcurrency', () => 6);  // ← iPhone 14 Pro 6核心
        safeDefine(NavProto, 'deviceMemory', () => 6);  // ← iPhone 通常 6GB RAM
        safeDefine(NavProto, 'maxTouchPoints', () => 5);  // ← iPhone 支持多点触控
        safeDefine(NavProto, 'vendor', () => 'Apple Computer, Inc.');  // ← Safari 厂商

        // iPhone 网络连接信息
        try {
            safeDefine(NavProto, 'connection', () => ({
                effectiveType: '4g',
                rtt: 50,  // ← iPhone 网络延迟通常更低
                downlink: 25,  // ← iPhone 5G/4G 速度更快
                saveData: false
            }));
        } catch (_) { }

        // iPhone 屏幕像素比精确控制
        try {
            Object.defineProperty(window, 'devicePixelRatio', {
                get: () => 3.0,  // ← iPhone 14 Pro 精确像素比
                configurable: true
            });
        } catch (_) { }

        // 5. 移除 Chrome 对象 (Safari 没有 window.chrome)
        try {
            // 多重移除策略
            delete window.chrome;
            window.chrome = undefined;

            // 强制定义为 undefined
            Object.defineProperty(window, 'chrome', {
                get: () => undefined,
                set: () => {},
                enumerable: false,
                configurable: true
            });

            // 确保在所有检测中都返回 undefined
            if ('chrome' in window) {
                try {
                    Object.defineProperty(window, 'chrome', {
                        value: undefined,
                        writable: false,
                        enumerable: false,
                        configurable: false
                    });
                } catch (_) {}
            }
        } catch (_) { }

        // 6. Safari 权限 API 行为
        try {
            const origQuery = navigator.permissions.query.bind(navigator.permissions);
            navigator.permissions.query = (params) => {
                if (params && params.name === 'notifications') {
                    return Promise.resolve({
                        state: typeof Notification !== 'undefined' ? Notification.permission : 'default',
                        onchange: null
                    });
                }
                return origQuery(params).catch(() => ({ state: 'prompt', onchange: null }));
            };
        } catch (_) { }

        // 7. WebGL 指纹伪装 (iPhone GPU 信息)
        try {
            const fakeWebGL = (gl) => {
                const origGetParameter = gl.getParameter.bind(gl);
                gl.getParameter = function (param) {
                    // iPhone 14 Pro GPU 信息
                    if (param === gl.VENDOR || param === 0x1F00) return 'Apple Inc.';  // ← Apple GPU 厂商
                    if (param === gl.RENDERER || param === 0x1F01) return 'Apple A16 GPU';  // ← iPhone 14 Pro 芯片
                    if (param === gl.VERSION || param === 0x1F02) return 'WebGL 2.0 (OpenGL ES 3.0 Apple A16-7.6.0)';
                    if (param === gl.SHADING_LANGUAGE_VERSION || param === 0x8B8C) return 'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Apple A16-7.6.0)';
                    return origGetParameter(param);
                };
            };

            // 拦截所有可能的 WebGL 上下文获取
            const origGetCtx = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (type, ...args) {
                const ctx = origGetCtx.call(this, type, ...args);
                if (ctx && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl')) {
                    try { fakeWebGL(ctx); } catch (_) { }
                }
                return ctx;
            };

            // 同时拦截 OffscreenCanvas
            if (typeof OffscreenCanvas !== 'undefined') {
                const origOffscreenGetCtx = OffscreenCanvas.prototype.getContext;
                OffscreenCanvas.prototype.getContext = function (type, ...args) {
                    const ctx = origOffscreenGetCtx.call(this, type, ...args);
                    if (ctx && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl')) {
                        try { fakeWebGL(ctx); } catch (_) { }
                    }
                    return ctx;
                };
            }
        } catch (_) { }

        // 8. Canvas 指纹伪装 (iPhone 特有的渲染差异)
        try {
            const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
            HTMLCanvasElement.prototype.toDataURL = function (...args) {
                const ctx = this.getContext('2d');
                if (ctx) {
                    try {
                        const w = this.width, h = this.height;
                        if (w > 0 && h > 0) {
                            // iPhone Safari 特有的像素差异
                            const data = ctx.getImageData(0, 0, 1, 1);
                            data.data[0] = Math.max(0, Math.min(255, data.data[0] + 1));  // R
                            data.data[1] = Math.max(0, Math.min(255, data.data[1] - 1));  // G
                            data.data[2] = Math.max(0, Math.min(255, data.data[2] + 1));  // B
                            ctx.putImageData(data, 0, 0);
                        }
                    } catch (_) { }
                }
                return origToDataURL.apply(this, args);
            };
        } catch (_) { }

        // 9. 移除自动化检测痕迹
        try {
            for (const key of Object.keys(window)) {
                if (/^(cdc_|\\$cdc_|_phantom|callPhantom|webdriver-|driver-|selenium|playwright)/.test(key)) {
                    try { delete window[key]; } catch (_) { }
                }
            }
        } catch (_) { }

        // 10. iPhone Safari 特有的 API 和行为
        try {
            // 添加 iPhone Safari 特有的 webkit 前缀 API
            if (!window.DeviceMotionEvent) {
                window.DeviceMotionEvent = class DeviceMotionEvent extends Event {};
            }
            if (!window.DeviceOrientationEvent) {
                window.DeviceOrientationEvent = class DeviceOrientationEvent extends Event {};
            }

            // Safari 特有的 webkit 前缀
            safeDefine(NavProto, 'standalone', () => false);  // PWA 模式

            // Touch 事件支持
            if (!window.TouchEvent) {
                window.TouchEvent = class TouchEvent extends Event {};
            }
        } catch (_) { }

        console.log('🍎 [指纹伪装] iPhone Safari 环境注入完成');
    `;
}

/**
 * 测试 iPhone Safari 指纹伪装效果
 */
async function testiPhoneSafariFingerprint() {
    console.log('🧪 [测试] 启动 iPhone Safari 指纹伪装测试...\n');

    let browser;
    try {
        // 启动浏览器
        browser = await chromium.launch({
            headless: false,  // 显示浏览器便于观察
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        });

        // 创建 iPhone Safari 上下文
        const context = await browser.newContext({
            // iPhone 14 Pro Safari User-Agent
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',

            // iPhone 14 Pro 屏幕尺寸
            viewport: { width: 393, height: 852 },
            deviceScaleFactor: 3.0,  // 精确的像素比

            // 移动设备配置
            locale: 'en-US',
            timezoneId: 'America/New_York',
            isMobile: true,
            hasTouch: true,

            // iPhone Safari Client Hints
            extraHTTPHeaders: {
                'sec-ch-ua': '"Not)A;Brand";v="8", "Safari";v="17", "Mobile Safari";v="17"',
                'sec-ch-ua-mobile': '?1',
                'sec-ch-ua-platform': '"iOS"'
            }
        });

        // 注入指纹伪装脚本
        await context.addInitScript(createiPhoneSafariFingerprint('17'));

        const page = await context.newPage();

        console.log('📱 [测试] 访问指纹检测网站...');

        // 访问指纹检测网站
        await page.goto('https://browserleaks.com/javascript', { waitUntil: 'networkidle' });

        // 等待页面加载
        await page.waitForTimeout(3000);

        console.log('🔍 [测试] 获取浏览器指纹信息...\n');

        // 获取关键指纹信息
        const fingerprint = await page.evaluate(() => {
            return {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                vendor: navigator.vendor,
                languages: navigator.languages,
                hardwareConcurrency: navigator.hardwareConcurrency,
                deviceMemory: navigator.deviceMemory,
                maxTouchPoints: navigator.maxTouchPoints,
                isMobile: /Mobi|Android/i.test(navigator.userAgent),
                hasTouch: 'ontouchstart' in window,
                screenWidth: screen.width,
                screenHeight: screen.height,
                colorDepth: screen.colorDepth,
                pixelRatio: window.devicePixelRatio,
                plugins: Array.from(navigator.plugins).map(p => p.name),
                webdriver: navigator.webdriver,
                chrome: typeof window.chrome !== 'undefined',
                webgl: (() => {
                    try {
                        const canvas = document.createElement('canvas');
                        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                        if (!gl) return null;
                        return {
                            vendor: gl.getParameter(gl.VENDOR),
                            renderer: gl.getParameter(gl.RENDERER)
                        };
                    } catch (e) {
                        return null;
                    }
                })()
            };
        });

        // 输出测试结果
        console.log('📊 [测试结果] iPhone Safari 指纹信息:');
        console.log('═'.repeat(60));
        console.log(`🔤 User-Agent: ${fingerprint.userAgent}`);
        console.log(`🖥️  Platform: ${fingerprint.platform}`);
        console.log(`🏢 Vendor: ${fingerprint.vendor}`);
        console.log(`🌍 Languages: ${fingerprint.languages.join(', ')}`);
        console.log(`⚙️  CPU Cores: ${fingerprint.hardwareConcurrency}`);
        console.log(`💾 Device Memory: ${fingerprint.deviceMemory}GB`);
        console.log(`👆 Max Touch Points: ${fingerprint.maxTouchPoints}`);
        console.log(`📱 Is Mobile: ${fingerprint.isMobile}`);
        console.log(`✋ Has Touch: ${fingerprint.hasTouch}`);
        console.log(`📺 Screen: ${fingerprint.screenWidth}x${fingerprint.screenHeight}`);
        console.log(`🎨 Color Depth: ${fingerprint.colorDepth}`);
        console.log(`🔍 Pixel Ratio: ${fingerprint.pixelRatio}`);
        console.log(`🔌 Plugins: ${fingerprint.plugins.join(', ')}`);
        console.log(`🤖 WebDriver: ${fingerprint.webdriver}`);
        console.log(`🌐 Chrome Object: ${fingerprint.chrome}`);
        if (fingerprint.webgl) {
            console.log(`🎮 WebGL Vendor: ${fingerprint.webgl.vendor}`);
            console.log(`🎮 WebGL Renderer: ${fingerprint.webgl.renderer}`);
        }
        console.log('═'.repeat(60));

        // 验证关键指标
        const checks = [
            { name: 'iPhone Platform', pass: fingerprint.platform === 'iPhone', value: fingerprint.platform },
            { name: 'Apple Vendor', pass: fingerprint.vendor === 'Apple Computer, Inc.', value: fingerprint.vendor },
            { name: 'Mobile Device', pass: fingerprint.isMobile === true, value: fingerprint.isMobile },
            { name: 'Touch Support', pass: fingerprint.hasTouch === true, value: fingerprint.hasTouch },
            { name: 'Touch Points', pass: fingerprint.maxTouchPoints === 5, value: fingerprint.maxTouchPoints },
            { name: 'No WebDriver', pass: fingerprint.webdriver === undefined, value: fingerprint.webdriver },
            { name: 'No Chrome Object', pass: fingerprint.chrome === false, value: fingerprint.chrome },
            { name: 'iPhone Screen Width', pass: fingerprint.screenWidth === 393, value: fingerprint.screenWidth },
            { name: 'High DPI', pass: fingerprint.pixelRatio === 3, value: fingerprint.pixelRatio }
        ];

        console.log('\n✅ [验证结果] 指纹伪装检查:');
        console.log('─'.repeat(60));
        let passCount = 0;
        checks.forEach(check => {
            const status = check.pass ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} ${check.name}: ${check.value}`);
            if (check.pass) passCount++;
        });

        console.log('─'.repeat(60));
        console.log(`🎯 [总结] 通过率: ${passCount}/${checks.length} (${Math.round(passCount/checks.length*100)}%)`);

        if (passCount === checks.length) {
            console.log('🎉 [成功] iPhone Safari 指纹伪装完美！');
        } else if (passCount >= checks.length * 0.8) {
            console.log('⚠️  [警告] iPhone Safari 指纹伪装基本成功，但有部分项目需要调整');
        } else {
            console.log('❌ [失败] iPhone Safari 指纹伪装效果不佳，需要重新调整');
        }

        // 保持浏览器打开以便手动检查
        console.log('\n🔍 [提示] 浏览器将保持打开状态，你可以手动检查更多指纹信息');
        console.log('📝 [提示] 按 Ctrl+C 退出测试');

        // 等待用户手动关闭
        await new Promise(() => {});

    } catch (error) {
        console.error('❌ [错误] 测试过程中出现异常:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// 运行测试
if (require.main === module) {
    testiPhoneSafariFingerprint().catch(console.error);
}

module.exports = {
    createiPhoneSafariFingerprint,
    testiPhoneSafariFingerprint
};