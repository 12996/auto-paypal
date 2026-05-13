/**
 * 完整的浏览器指纹伪装库
 */

class FingerprintSpoofer {
    constructor(options = {}) {
        this.config = this.generateRandomConfig(options);
    }

    generateRandomConfig(overrides = {}) {
        const configs = [
            {
                hardwareConcurrency: 4,
                deviceMemory: 8,
                platform: 'Win32',
                vendor: 'Google Inc.',
                webgl: {
                    vendor: 'Google Inc. (Intel)',
                    renderer: 'ANGLE (Intel, Intel UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)'
                }
            },
            {
                hardwareConcurrency: 8,
                deviceMemory: 16,
                platform: 'Win32',
                vendor: 'Google Inc.',
                webgl: {
                    vendor: 'Google Inc. (NVIDIA)',
                    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 Direct3D11 vs_5_0 ps_5_0, D3D11)'
                }
            },
            {
                hardwareConcurrency: 6,
                deviceMemory: 8,
                platform: 'MacIntel',
                vendor: 'Google Inc.',
                webgl: {
                    vendor: 'Google Inc. (Apple)',
                    renderer: 'ANGLE (Apple, Apple M1, OpenGL 4.1)'
                }
            }
        ];

        const baseConfig = configs[Math.floor(Math.random() * configs.length)];
        return { ...baseConfig, ...overrides };
    }

    getInitScript() {
        return `
            (function() {
                'use strict';

                const config = ${JSON.stringify(this.config)};

                // 1. 清理自动化痕迹
                delete Object.getPrototypeOf(navigator).webdriver;
                delete window.cdc_adoQpoasnfa76pfcZLmcfl_Array;
                delete window.cdc_adoQpoasnfa76pfcZLmcfl_Promise;
                delete window.cdc_adoQpoasnfa76pfcZLmcfl_Symbol;
                delete window.__playwright;
                delete window.__pw_manual;
                delete window.__PW_inspect;
                delete window.__puppeteer;

                // 2. 安全的属性定义
                const safeDefine = (obj, prop, descriptor) => {
                    try {
                        Object.defineProperty(obj, prop, {
                            configurable: true,
                            enumerable: true,
                            ...descriptor
                        });
                    } catch (e) {
                        console.warn('Failed to define', prop, e);
                    }
                };

                // 3. Navigator 属性伪装
                const NavProto = Navigator.prototype;
                safeDefine(NavProto, 'webdriver', { get: () => undefined });
                safeDefine(NavProto, 'hardwareConcurrency', { get: () => config.hardwareConcurrency });
                safeDefine(NavProto, 'deviceMemory', { get: () => config.deviceMemory });
                safeDefine(NavProto, 'platform', { get: () => config.platform });
                safeDefine(NavProto, 'vendor', { get: () => config.vendor });
                safeDefine(NavProto, 'maxTouchPoints', { get: () => 0 });

                // 4. WebGL 指纹伪装
                const webglHandler = {
                    apply: function(target, thisArg, args) {
                        const param = args[0];
                        if (param === 37445) return config.webgl.vendor;
                        if (param === 37446) return config.webgl.renderer;
                        return Reflect.apply(target, thisArg, args);
                    }
                };

                if (typeof WebGLRenderingContext !== 'undefined') {
                    WebGLRenderingContext.prototype.getParameter = new Proxy(
                        WebGLRenderingContext.prototype.getParameter, webglHandler
                    );
                }
                if (typeof WebGL2RenderingContext !== 'undefined') {
                    WebGL2RenderingContext.prototype.getParameter = new Proxy(
                        WebGL2RenderingContext.prototype.getParameter, webglHandler
                    );
                }

                // 5. Canvas 指纹伪装
                const canvasHandler = {
                    apply: function(target, thisArg, args) {
                        const result = Reflect.apply(target, thisArg, args);
                        if (typeof result === 'string' && result.length > 100) {
                            // 添加轻微噪声
                            const noise = Math.random().toString(36).substring(7);
                            return result + noise;
                        }
                        return result;
                    }
                };

                HTMLCanvasElement.prototype.toDataURL = new Proxy(
                    HTMLCanvasElement.prototype.toDataURL, canvasHandler
                );
                HTMLCanvasElement.prototype.toBlob = new Proxy(
                    HTMLCanvasElement.prototype.toBlob, canvasHandler
                );

                // 6. AudioContext 指纹伪装
                if (typeof AudioContext !== 'undefined') {
                    const OriginalAudioContext = AudioContext;
                    window.AudioContext = class extends OriginalAudioContext {
                        constructor(...args) {
                            super(...args);
                            // 添加轻微的音频指纹噪声
                            const originalCreateAnalyser = this.createAnalyser;
                            this.createAnalyser = function() {
                                const analyser = originalCreateAnalyser.call(this);
                                const originalGetFloatFrequencyData = analyser.getFloatFrequencyData;
                                analyser.getFloatFrequencyData = function(array) {
                                    originalGetFloatFrequencyData.call(this, array);
                                    // 添加微小噪声
                                    for (let i = 0; i < array.length; i++) {
                                        array[i] += (Math.random() - 0.5) * 0.0001;
                                    }
                                };
                                return analyser;
                            };
                        }
                    };
                }

                // 7. 屏幕指纹伪装
                safeDefine(Screen.prototype, 'width', { get: () => 1920 });
                safeDefine(Screen.prototype, 'height', { get: () => 1080 });
                safeDefine(Screen.prototype, 'availWidth', { get: () => 1920 });
                safeDefine(Screen.prototype, 'availHeight', { get: () => 1040 });
                safeDefine(Screen.prototype, 'colorDepth', { get: () => 24 });
                safeDefine(Screen.prototype, 'pixelDepth', { get: () => 24 });

                // 8. 时区伪装（如果需要）
                if (config.timezone) {
                    const OriginalDate = Date;
                    window.Date = class extends OriginalDate {
                        getTimezoneOffset() {
                            return config.timezoneOffset || super.getTimezoneOffset();
                        }
                    };
                }

                // 9. Chrome 对象伪装
                if (!window.chrome) {
                    window.chrome = {
                        runtime: {
                            onConnect: undefined,
                            onMessage: undefined
                        },
                        loadTimes: function() {
                            return {
                                requestTime: Date.now() / 1000,
                                startLoadTime: Date.now() / 1000,
                                commitLoadTime: Date.now() / 1000,
                                finishDocumentLoadTime: Date.now() / 1000,
                                finishLoadTime: Date.now() / 1000,
                                firstPaintTime: Date.now() / 1000,
                                firstPaintAfterLoadTime: 0,
                                navigationType: "Other"
                            };
                        },
                        csi: function() {
                            return {
                                startE: Date.now(),
                                onloadT: Date.now(),
                                pageT: Math.random() * 1000,
                                tran: 15
                            };
                        },
                        app: {
                            isInstalled: false
                        }
                    };
                }

                // 10. 权限查询伪装
                if (navigator.permissions && navigator.permissions.query) {
                    const originalQuery = navigator.permissions.query;
                    navigator.permissions.query = function(parameters) {
                        if (parameters.name === 'notifications') {
                            return Promise.resolve({ state: 'default' });
                        }
                        return originalQuery.call(this, parameters);
                    };
                }

                console.log('[FingerprintSpoofer] 指纹伪装已应用');
            })();
        `;
    }

    async applyToPage(page) {
        await page.addInitScript(this.getInitScript());
    }

    async applyToContext(context) {
        await context.addInitScript(this.getInitScript());
    }

    getPlaywrightConfig() {
        return {
            userAgent: this.generateUserAgent(),
            viewport: { width: 1920, height: 1080 },
            locale: 'en-US',
            timezoneId: 'America/Los_Angeles',
            permissions: ['geolocation'],
            args: [
                '--disable-blink-features=AutomationControlled',
                '--disable-features=VizDisplayCompositor',
                '--disable-ipc-flooding-protection',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-features=TranslateUI',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-dev-shm-usage',
                '--disable-extensions-except=',
                '--disable-extensions',
            ]
        };
    }

    generateUserAgent() {
        const versions = ['125.0.0.0', '124.0.0.0', '123.0.0.0'];
        const version = versions[Math.floor(Math.random() * versions.length)];

        if (this.config.platform === 'MacIntel') {
            return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
        }
        return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`;
    }
}

module.exports = FingerprintSpoofer;