/**
 * 加州地区随机指纹生成器
 * 生成符合加州地区特征的浏览器指纹
 */

class CaliforniaFingerprint {
    static getCaliforniaConfigs() {
        // 加州常见的硬件配置
        const californiaConfigs = [
            // 硅谷科技公司常见配置
            {
                hardwareConcurrency: 8,
                deviceMemory: 16,
                platform: 'Win32',
                screen: { width: 1920, height: 1080 },
                webgl: {
                    vendor: 'Google Inc. (NVIDIA)',
                    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Direct3D11 vs_5_0 ps_5_0, D3D11)'
                },
                region: 'Silicon Valley'
            },
            // 苹果用户配置
            {
                hardwareConcurrency: 10,
                deviceMemory: 16,
                platform: 'MacIntel',
                screen: { width: 2560, height: 1600 },
                webgl: {
                    vendor: 'Google Inc. (Apple)',
                    renderer: 'ANGLE (Apple, Apple M2 Pro, OpenGL 4.1)'
                },
                region: 'Bay Area'
            },
            // 游戏玩家配置
            {
                hardwareConcurrency: 12,
                deviceMemory: 32,
                platform: 'Win32',
                screen: { width: 2560, height: 1440 },
                webgl: {
                    vendor: 'Google Inc. (NVIDIA)',
                    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4080 Direct3D11 vs_5_0 ps_5_0, D3D11)'
                },
                region: 'Los Angeles'
            },
            // 普通办公配置
            {
                hardwareConcurrency: 6,
                deviceMemory: 8,
                platform: 'Win32',
                screen: { width: 1920, height: 1080 },
                webgl: {
                    vendor: 'Google Inc. (Intel)',
                    renderer: 'ANGLE (Intel, Intel Iris Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)'
                },
                region: 'San Diego'
            },
            // MacBook Pro 配置
            {
                hardwareConcurrency: 8,
                deviceMemory: 16,
                platform: 'MacIntel',
                screen: { width: 1728, height: 1117 },
                webgl: {
                    vendor: 'Google Inc. (Apple)',
                    renderer: 'ANGLE (Apple, Apple M1 Max, OpenGL 4.1)'
                },
                region: 'San Francisco'
            }
        ];

        return californiaConfigs;
    }

    static getCaliforniaTimezones() {
        return [
            'America/Los_Angeles',  // 太平洋标准时间
            'America/Los_Angeles',  // 重复增加权重
            'America/Los_Angeles'
        ];
    }

    static getCaliforniaUserAgents() {
        const chromeVersions = ['125.0.0.0', '124.0.0.0', '123.0.0.0'];
        const version = chromeVersions[Math.floor(Math.random() * chromeVersions.length)];

        return [
            // Windows 用户
            `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`,
            // macOS 用户 (加州苹果用户多)
            `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`,
            `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15`
        ];
    }

    static getCaliforniaLanguages() {
        // 加州常见语言配置
        return [
            ['en-US', 'en'],           // 英语为主
            ['en-US', 'en', 'es'],     // 英语+西班牙语
            ['en-US', 'en', 'zh-CN'],  // 英语+中文 (硅谷华人)
            ['en-US', 'en', 'ko'],     // 英语+韩语
            ['en-US', 'en', 'ja']      // 英语+日语
        ];
    }

    static generateRandomCaliforniaFingerprint() {
        const configs = this.getCaliforniaConfigs();
        const timezones = this.getCaliforniaTimezones();
        const userAgents = this.getCaliforniaUserAgents();
        const languages = this.getCaliforniaLanguages();

        const baseConfig = configs[Math.floor(Math.random() * configs.length)];
        const timezone = timezones[Math.floor(Math.random() * timezones.length)];
        const userAgent = userAgents[Math.floor(Math.random() * userAgents.length)];
        const language = languages[Math.floor(Math.random() * languages.length)];

        return {
            ...baseConfig,
            timezone,
            userAgent,
            languages: language,
            // 加州特有属性
            locale: 'en-US',
            currency: 'USD',
            // 随机化一些值
            hardwareConcurrency: baseConfig.hardwareConcurrency + Math.floor(Math.random() * 3) - 1, // ±1
            deviceMemory: baseConfig.deviceMemory,
            // 网络相关 (加州ISP)
            connectionType: this.getRandomConnectionType(),
            // 时间相关
            timezoneOffset: -480, // PST UTC-8
        };
    }

    static getRandomConnectionType() {
        const connections = [
            'wifi',      // 最常见
            'ethernet',  // 办公室
            '4g',        // 移动
            'wifi'       // 增加wifi权重
        ];
        return connections[Math.floor(Math.random() * connections.length)];
    }

    static getSpoofingScript(config = null) {
        if (!config) config = this.generateRandomCaliforniaFingerprint();

        return `
            // 加州地区指纹伪装脚本
            (function() {
                const config = ${JSON.stringify(config)};
                console.log('[California Fingerprint] 应用加州地区指纹:', config.region);

                // 1. 清理自动化痕迹
                const propsToDelete = [
                    'webdriver', 'cdc_adoQpoasnfa76pfcZLmcfl_Array',
                    'cdc_adoQpoasnfa76pfcZLmcfl_Promise', 'cdc_adoQpoasnfa76pfcZLmcfl_Symbol',
                    '__playwright', '__pw_manual', '__PW_inspect', '__puppeteer'
                ];

                propsToDelete.forEach(prop => {
                    try {
                        delete Object.getPrototypeOf(navigator)[prop];
                        delete window[prop];
                    } catch(e) {}
                });

                // 2. 安全属性定义
                const safeDefine = (obj, prop, descriptor) => {
                    try {
                        Object.defineProperty(obj, prop, {
                            configurable: true,
                            enumerable: true,
                            ...descriptor
                        });
                    } catch (e) {}
                };

                // 3. Navigator 伪装
                safeDefine(Navigator.prototype, 'webdriver', { get: () => undefined });
                safeDefine(Navigator.prototype, 'hardwareConcurrency', { get: () => config.hardwareConcurrency });
                safeDefine(Navigator.prototype, 'deviceMemory', { get: () => config.deviceMemory });
                safeDefine(Navigator.prototype, 'platform', { get: () => config.platform });
                safeDefine(Navigator.prototype, 'languages', { get: () => config.languages });
                safeDefine(Navigator.prototype, 'language', { get: () => config.languages[0] });
                safeDefine(Navigator.prototype, 'maxTouchPoints', { get: () => 0 });

                // 4. 地理位置相关
                if (navigator.geolocation) {
                    const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition;
                    navigator.geolocation.getCurrentPosition = function(success, error, options) {
                        // 模拟加州坐标 (随机化)
                        const californiaCoords = [
                            { lat: 37.7749, lng: -122.4194 }, // San Francisco
                            { lat: 34.0522, lng: -118.2437 }, // Los Angeles
                            { lat: 37.3382, lng: -121.8863 }, // San Jose
                            { lat: 32.7157, lng: -117.1611 }  // San Diego
                        ];
                        const coord = californiaCoords[Math.floor(Math.random() * californiaCoords.length)];

                        setTimeout(() => {
                            success({
                                coords: {
                                    latitude: coord.lat + (Math.random() - 0.5) * 0.1,
                                    longitude: coord.lng + (Math.random() - 0.5) * 0.1,
                                    accuracy: 10 + Math.random() * 90,
                                    altitude: null,
                                    altitudeAccuracy: null,
                                    heading: null,
                                    speed: null
                                },
                                timestamp: Date.now()
                            });
                        }, 100 + Math.random() * 500);
                    };
                }

                // 5. WebGL 伪装
                const webglHandler = {
                    apply: function(target, thisArg, args) {
                        if (args[0] === 37445) return config.webgl.vendor;
                        if (args[0] === 37446) return config.webgl.renderer;
                        return Reflect.apply(target, thisArg, args);
                    }
                };

                if (typeof WebGLRenderingContext !== 'undefined') {
                    WebGLRenderingContext.prototype.getParameter = new Proxy(
                        WebGLRenderingContext.prototype.getParameter, webglHandler
                    );
                }

                // 6. 屏幕信息伪装
                safeDefine(Screen.prototype, 'width', { get: () => config.screen.width });
                safeDefine(Screen.prototype, 'height', { get: () => config.screen.height });
                safeDefine(Screen.prototype, 'availWidth', { get: () => config.screen.width });
                safeDefine(Screen.prototype, 'availHeight', { get: () => config.screen.height - 40 });

                // 7. 时区伪装
                const OriginalDate = Date;
                window.Date = class extends OriginalDate {
                    getTimezoneOffset() {
                        return config.timezoneOffset || -480; // PST
                    }
                };

                // 8. Canvas 指纹 (加州特色噪声)
                const addCaliforniaCanvasNoise = (originalMethod) => {
                    return new Proxy(originalMethod, {
                        apply: function(target, thisArg, args) {
                            const result = Reflect.apply(target, thisArg, args);
                            if (typeof result === 'string' && result.startsWith('data:image')) {
                                // 添加加州特色的噪声模式
                                const noise = 'ca' + Math.random().toString(36).substring(2, 8);
                                return result + noise;
                            }
                            return result;
                        }
                    });
                };

                HTMLCanvasElement.prototype.toDataURL = addCaliforniaCanvasNoise(HTMLCanvasElement.prototype.toDataURL);

                // 9. Chrome 对象
                if (!window.chrome) {
                    window.chrome = {
                        runtime: {},
                        loadTimes: () => ({
                            requestTime: Date.now() / 1000,
                            startLoadTime: Date.now() / 1000,
                            commitLoadTime: Date.now() / 1000,
                            finishDocumentLoadTime: Date.now() / 1000,
                            finishLoadTime: Date.now() / 1000
                        }),
                        csi: () => ({ pageT: Math.random() * 1000 }),
                        app: { isInstalled: false }
                    };
                }

                console.log('[California Fingerprint] 加州指纹伪装已应用 -', config.region);
            })();
        `;
    }

    static getPlaywrightOptions(config = null) {
        if (!config) config = this.generateRandomCaliforniaFingerprint();

        return {
            userAgent: config.userAgent,
            viewport: { width: config.screen.width, height: config.screen.height },
            locale: config.locale,
            timezoneId: config.timezone,
            geolocation: this.getRandomCaliforniaLocation(),
            permissions: ['geolocation'],
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-features=VizDisplayCompositor',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-dev-shm-usage'
            ]
        };
    }

    static getRandomCaliforniaLocation() {
        const locations = [
            { latitude: 37.7749, longitude: -122.4194 }, // San Francisco
            { latitude: 34.0522, longitude: -118.2437 }, // Los Angeles
            { latitude: 37.3382, longitude: -121.8863 }, // San Jose
            { latitude: 32.7157, longitude: -117.1611 }, // San Diego
            { latitude: 36.7783, longitude: -119.4179 }  // Fresno
        ];

        const location = locations[Math.floor(Math.random() * locations.length)];

        // 添加随机偏移
        return {
            latitude: location.latitude + (Math.random() - 0.5) * 0.1,
            longitude: location.longitude + (Math.random() - 0.5) * 0.1
        };
    }

    // 快速应用到 Playwright 页面
    static async applyToPage(page, config = null) {
        await page.addInitScript(this.getSpoofingScript(config));
    }

    // 快速应用到 Playwright 上下文
    static async applyToContext(context, config = null) {
        await context.addInitScript(this.getSpoofingScript(config));
    }

    // 创建带加州指纹伪装的浏览器上下文
    static async createCaliforniaContext(browser, customConfig = {}) {
        const config = { ...this.generateRandomCaliforniaFingerprint(), ...customConfig };
        const options = this.getPlaywrightOptions(config);

        console.log(`🌴 生成加州指纹: ${config.region}, CPU: ${config.hardwareConcurrency}核, 内存: ${config.deviceMemory}GB`);

        const context = await browser.newContext(options);
        await this.applyToContext(context, config);

        return { context, config };
    }

    // 生成多个不同的加州指纹
    static generateMultipleCaliforniaFingerprints(count = 5) {
        const fingerprints = [];
        for (let i = 0; i < count; i++) {
            fingerprints.push(this.generateRandomCaliforniaFingerprint());
        }
        return fingerprints;
    }
}

module.exports = CaliforniaFingerprint;