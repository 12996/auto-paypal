/**
 * 项目集成用的指纹伪装模块
 * 可以直接在现有代码中使用
 */

class BrowserFingerprint {
    static getRandomConfig() {
        const configs = [
            {
                hardwareConcurrency: 4,
                deviceMemory: 8,
                platform: 'Win32',
                webgl: {
                    vendor: 'Google Inc. (Intel)',
                    renderer: 'ANGLE (Intel, Intel UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)'
                }
            },
            {
                hardwareConcurrency: 8,
                deviceMemory: 16,
                platform: 'Win32',
                webgl: {
                    vendor: 'Google Inc. (NVIDIA)',
                    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0, D3D11)'
                }
            },
            {
                hardwareConcurrency: 6,
                deviceMemory: 8,
                platform: 'MacIntel',
                webgl: {
                    vendor: 'Google Inc. (Apple)',
                    renderer: 'ANGLE (Apple, Apple M1, OpenGL 4.1)'
                }
            }
        ];
        return configs[Math.floor(Math.random() * configs.length)];
    }

    static getSpoofingScript(config = null) {
        if (!config) config = this.getRandomConfig();

        return `
            // 指纹伪装脚本 - 完整版
            (function() {
                const config = ${JSON.stringify(config)};

                // 1. 清理自动化痕迹
                const propsToDelete = [
                    'webdriver',
                    'cdc_adoQpoasnfa76pfcZLmcfl_Array',
                    'cdc_adoQpoasnfa76pfcZLmcfl_Promise',
                    'cdc_adoQpoasnfa76pfcZLmcfl_Symbol',
                    '__playwright',
                    '__pw_manual',
                    '__PW_inspect',
                    '__puppeteer'
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
                safeDefine(Navigator.prototype, 'maxTouchPoints', { get: () => 0 });

                // 4. WebGL 伪装
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

                // 5. Canvas 噪声
                const addCanvasNoise = (originalMethod) => {
                    return new Proxy(originalMethod, {
                        apply: function(target, thisArg, args) {
                            const result = Reflect.apply(target, thisArg, args);
                            if (typeof result === 'string' && result.startsWith('data:image')) {
                                // 添加微小噪声
                                const canvas = document.createElement('canvas');
                                canvas.width = 1; canvas.height = 1;
                                const ctx = canvas.getContext('2d');
                                ctx.fillStyle = 'rgba(' + Math.floor(Math.random()*255) + ',0,0,0.01)';
                                ctx.fillRect(0, 0, 1, 1);
                                return result + canvas.toDataURL().slice(-10);
                            }
                            return result;
                        }
                    });
                };

                HTMLCanvasElement.prototype.toDataURL = addCanvasNoise(HTMLCanvasElement.prototype.toDataURL);

                // 6. Chrome 对象
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

                // 7. 权限查询
                if (navigator.permissions?.query) {
                    const originalQuery = navigator.permissions.query;
                    navigator.permissions.query = function(params) {
                        if (params.name === 'notifications') {
                            return Promise.resolve({ state: 'default' });
                        }
                        return originalQuery.call(this, params);
                    };
                }

                console.log('[Fingerprint] 伪装已应用');
            })();
        `;
    }

    static getPlaywrightOptions(config = null) {
        if (!config) config = this.getRandomConfig();

        const userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
        ];

        return {
            userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
            viewport: { width: 1920, height: 1080 },
            locale: 'en-US',
            timezoneId: 'America/Los_Angeles',
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-features=VizDisplayCompositor',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-dev-shm-usage'
            ]
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

    // 创建带指纹伪装的浏览器上下文
    static async createStealthContext(browser, customConfig = {}) {
        const config = { ...this.getRandomConfig(), ...customConfig };
        const options = this.getPlaywrightOptions(config);

        const context = await browser.newContext(options);
        await this.applyToContext(context, config);

        return context;
    }
}

module.exports = BrowserFingerprint;