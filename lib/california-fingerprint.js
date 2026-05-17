/**
 * 加州地区指纹生成器
 * 真实性优先：默认固定为 Windows + Chrome + San Diego + en-US baseline。
 */

class CaliforniaFingerprint {
    static ENGLISH_LOCALE = 'en-US';

    static ENGLISH_LANGUAGES = ['en-US'];

    static DEFAULT_SCREEN = {
        width: 1920,
        height: 1080,
        availWidth: 1920,
        availHeight: 1032,
        colorDepth: 24,
        pixelDepth: 24
    };

    static FINGERPRINT_PROFILES = [
        {
            profileId: 'win_intel_8gb',
            region: 'San Diego',
            hardwareConcurrency: 8,
            deviceMemory: 8,
            platform: 'Win32',
            platformName: 'Windows',
            platformVersion: '15.0.0',
            architecture: 'x86',
            bitness: '64',
            vendor: 'Google Inc.',
            languages: ['en-US', 'en'],
            connection: { effectiveType: '4g', rtt: 100, downlink: 10, saveData: false },
            geolocation: { latitude: 32.7157, longitude: -117.1611 },
            webgl: {
                vendor: 'Google Inc. (Intel)',
                renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)'
            }
        }
    ];

    static getCaliforniaConfigs() {
        return this.FINGERPRINT_PROFILES.map(profile => ({
            ...profile,
            languages: [...this.ENGLISH_LANGUAGES],
            connection: { ...profile.connection },
            geolocation: { ...profile.geolocation },
            webgl: { ...profile.webgl }
        }));
    }

    static getCaliforniaTimezones() {
        return ['America/Los_Angeles'];
    }

    static getCaliforniaUserAgents(platform = 'Win32', chromeVersion = null) {
        const version = chromeVersion ? this.normalizeChromeVersion(chromeVersion) : '148.0.0.0';
        return [
            `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`
        ];
    }

    static getCaliforniaLanguages() {
        return [[...this.ENGLISH_LANGUAGES]];
    }

    static normalizeLocaleConfig(config = {}) {
        return {
            ...config,
            locale: this.ENGLISH_LOCALE,
            languages: [...this.ENGLISH_LANGUAGES]
        };
    }

    static createFingerprintSeed() {
        return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    }

    static normalizeChromeVersion(version = '') {
        const matched = String(version).match(/(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:\.(\d+))?/);
        if (!matched) return '148.0.0.0';
        return matched.slice(1, 5).map(part => part ?? '0').join('.');
    }

    static getChromeMajorVersion(userAgent = '') {
        const matched = String(userAgent).match(/Chrome\/(\d+)/);
        return matched ? Number(matched[1]) : 148;
    }

    static getBrowserChromeVersion(browser) {
        try {
            const version = typeof browser?.version === 'function' ? browser.version() : '';
            if (!String(version).match(/\d+/)) return null;
            return this.normalizeChromeVersion(version);
        } catch (_) {
            return null;
        }
    }

    static getAcceptLanguageHeader(languages = this.ENGLISH_LANGUAGES) {
        const values = Array.isArray(languages) && languages.length > 0
            ? languages
            : this.ENGLISH_LANGUAGES;

        return values.map((language, index) => {
            if (index === 0) return language;
            const q = Math.max(0.1, 1 - index * 0.1).toFixed(1);
            return `${language};q=${q}`;
        }).join(',');
    }

    static getSecChUaHeader(chromeMajor = 148) {
        const major = String(chromeMajor);
        return `"Not)A;Brand";v="8", "Chromium";v="${major}", "Google Chrome";v="${major}"`;
    }

    static generateRandomCaliforniaFingerprint(options = {}) {
        const baseConfig = this.getCaliforniaConfigs()[0];
        const chromeVersion = this.normalizeChromeVersion(options.chromeVersion || options.chromeMajor || '148.0.0.0');
        const chromeMajor = Number(chromeVersion.split('.')[0]) || 148;
        const userAgent = this.getCaliforniaUserAgents(baseConfig.platform, chromeVersion)[0];

        return this.normalizeLocaleConfig({
            ...baseConfig,
            connection: { ...baseConfig.connection },
            screen: { ...this.DEFAULT_SCREEN },
            timezone: 'America/Los_Angeles',
            userAgent,
            geolocation: { ...baseConfig.geolocation },
            fingerprintSeed: this.createFingerprintSeed(),
            chromeMajor,
            chromeVersion,
            locale: this.ENGLISH_LOCALE,
            currency: 'USD',
            connectionType: baseConfig.connection.effectiveType,
            timezoneOffset: this.getPacificTimezoneOffsetMinutes()
        });
    }

    static getPacificTimezoneOffsetMinutes(date = new Date()) {
        const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: 'America/Los_Angeles',
            timeZoneName: 'shortOffset'
        }).formatToParts(date);
        const value = parts.find(part => part.type === 'timeZoneName')?.value || 'GMT-8';
        const match = value.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
        if (!match) return 480;

        const [, sign, hours, minutes = '0'] = match;
        const offsetMinutes = Number(hours) * 60 + Number(minutes);
        return sign === '-' ? offsetMinutes : -offsetMinutes;
    }

    static validateFingerprintConsistency(config = {}, options = this.getPlaywrightOptions(config)) {
        config = this.normalizeLocaleConfig(config);
        const issues = [];
        const headers = options.extraHTTPHeaders || {};
        const uaMajor = this.getChromeMajorVersion(config.userAgent);

        if (Number(config.chromeMajor) !== uaMajor) {
            issues.push('userAgent Chrome major does not match config.chromeMajor');
        }
        const secChUaMajor = String(headers['sec-ch-ua'] || '').match(/"Chromium";v="(\d+)"/)?.[1];
        if (secChUaMajor && Number(secChUaMajor) !== Number(config.chromeMajor)) {
            issues.push('sec-ch-ua chrome major does not match config.chromeMajor');
        }
        if (headers['Accept-Language'] && headers['Accept-Language'] !== this.getAcceptLanguageHeader(config.languages)) {
            issues.push('Accept-Language does not match config.languages');
        }
        if (options.locale && options.locale !== config.locale) {
            issues.push('locale does not match config.locale');
        }
        if (options.timezoneId !== config.timezone) {
            issues.push('timezoneId does not match config.timezone');
        }
        if (options.geolocation || options.permissions?.includes('geolocation')) {
            issues.push('geolocation should not be pre-granted in the baseline profile');
        }

        return issues;
    }

    static getSpoofingScript(config = null) {
        if (!config) config = this.generateRandomCaliforniaFingerprint();
        config = this.normalizeLocaleConfig(config);
        if (!config.fingerprintSeed) {
            config = { ...config, fingerprintSeed: this.createFingerprintSeed() };
        }

        return `
            (function() {
                const config = ${JSON.stringify(config)};
                console.log('[California Fingerprint] 应用加州地区指纹:', config.region);

                const NavProto = Object.getPrototypeOf(navigator);
                const ScrProto = Object.getPrototypeOf(screen);
                const safeDefine = (obj, key, getter) => {
                    try {
                        Object.defineProperty(obj, key, { get: getter, configurable: true });
                    } catch (_) {}
                };

                const hashString = (value) => {
                    let hash = 2166136261;
                    const text = String(value);
                    for (let i = 0; i < text.length; i += 1) {
                        hash ^= text.charCodeAt(i);
                        hash = Math.imul(hash, 16777619);
                    }
                    return hash >>> 0;
                };
                const seedBase = hashString(config.fingerprintSeed || config.profileId || config.userAgent || 'california');
                const seededUnit = (salt) => {
                    let value = (seedBase ^ hashString(salt)) >>> 0;
                    value ^= value << 13;
                    value ^= value >>> 17;
                    value ^= value << 5;
                    return (value >>> 0) / 4294967295;
                };
                const stableNoise = (salt, amplitude) => (seededUnit(salt) * 2 - 1) * amplitude;

                try { delete Object.getPrototypeOf(navigator).webdriver; } catch (_) {}
                safeDefine(NavProto, 'webdriver', () => undefined);
                try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true }); } catch (_) {}

                safeDefine(NavProto, 'hardwareConcurrency', () => config.hardwareConcurrency);
                safeDefine(NavProto, 'deviceMemory', () => config.deviceMemory);
                safeDefine(NavProto, 'platform', () => config.platform);
                safeDefine(NavProto, 'vendor', () => config.vendor || 'Google Inc.');
                safeDefine(NavProto, 'maxTouchPoints', () => 0);

                try {
                    const conn = config.connection || { effectiveType: '4g', rtt: 100, downlink: 10, saveData: false };
                    safeDefine(NavProto, 'connection', () => conn);
                } catch (_) {}

                try {
                    const chromeMajor = String(config.chromeMajor || 148);
                    const chromeVersion = String(config.chromeVersion || (chromeMajor + '.0.0.0'));
                    const uaData = {
                        brands: [
                            { brand: 'Not)A;Brand', version: '8' },
                            { brand: 'Chromium', version: chromeMajor },
                            { brand: 'Google Chrome', version: chromeMajor }
                        ],
                        mobile: false,
                        platform: 'Windows',
                        getHighEntropyValues: () => Promise.resolve({
                            architecture: config.architecture || 'x86',
                            bitness: config.bitness || '64',
                            brands: uaData.brands,
                            fullVersionList: uaData.brands.map(b => ({
                                brand: b.brand,
                                version: b.brand === 'Not)A;Brand' ? '8.0.0.0' : chromeVersion
                            })),
                            mobile: false,
                            model: '',
                            platform: 'Windows',
                            platformVersion: config.platformVersion || '15.0.0',
                            uaFullVersion: chromeVersion,
                            wow64: false
                        }),
                        toJSON: () => ({ brands: uaData.brands, mobile: uaData.mobile, platform: uaData.platform })
                    };
                    safeDefine(NavProto, 'userAgentData', () => uaData);
                } catch (_) {}

                try {
                    const pdfMime = Object.create(MimeType.prototype);
                    Object.defineProperties(pdfMime, {
                        type: { get: () => 'application/pdf' },
                        suffixes: { get: () => 'pdf' },
                        description: { get: () => 'Portable Document Format' }
                    });
                    const pdfPlugin = Object.create(Plugin.prototype);
                    Object.defineProperties(pdfPlugin, {
                        name: { get: () => 'Chrome PDF Plugin' },
                        filename: { get: () => 'internal-pdf-viewer' },
                        description: { get: () => 'Portable Document Format' },
                        length: { get: () => 1 },
                        0: { get: () => pdfMime }
                    });
                    pdfPlugin.item = () => pdfMime;
                    pdfPlugin.namedItem = () => pdfMime;

                    const fakePlugins = Object.create(PluginArray.prototype);
                    Object.defineProperties(fakePlugins, {
                        length: { get: () => 1 },
                        0: { get: () => pdfPlugin }
                    });
                    fakePlugins.item = () => pdfPlugin;
                    fakePlugins.namedItem = (name) => name === pdfPlugin.name ? pdfPlugin : null;
                    fakePlugins.refresh = () => {};

                    const fakeMimeTypes = Object.create(MimeTypeArray.prototype);
                    Object.defineProperties(fakeMimeTypes, {
                        length: { get: () => 1 },
                        0: { get: () => pdfMime }
                    });
                    fakeMimeTypes.item = () => pdfMime;
                    fakeMimeTypes.namedItem = (type) => type === pdfMime.type ? pdfMime : null;

                    safeDefine(NavProto, 'plugins', () => fakePlugins);
                    safeDefine(NavProto, 'mimeTypes', () => fakeMimeTypes);
                } catch (_) {}

                safeDefine(ScrProto, 'availHeight', () => config.screen.availHeight || 1032);
                safeDefine(ScrProto, 'availWidth', () => config.screen.availWidth || 1920);
                safeDefine(ScrProto, 'colorDepth', () => config.screen.colorDepth || 24);
                safeDefine(ScrProto, 'pixelDepth', () => config.screen.pixelDepth || 24);
                safeDefine(ScrProto, 'width', () => config.screen.width || 1920);
                safeDefine(ScrProto, 'height', () => config.screen.height || 1080);

                try {
                    const originalGetContext = HTMLCanvasElement.prototype.getContext;
                    const fakeWebGL = (gl) => {
                        if (!gl || gl.__californiaWebGLPatched) return;
                        const originalGetParameter = gl.getParameter.bind(gl);
                        Object.defineProperty(gl, '__californiaWebGLPatched', { value: true, configurable: true });
                        gl.getParameter = function(param) {
                            if (param === 0x9245) return config.webgl.vendor;
                            if (param === 0x9246) return config.webgl.renderer;
                            return originalGetParameter(param);
                        };
                    };
                    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
                        const ctx = originalGetContext.call(this, type, ...args);
                        if (ctx && (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl')) {
                            try { fakeWebGL(ctx); } catch (_) {}
                        }
                        return ctx;
                    };
                } catch (_) {}

                try {
                    const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
                    HTMLCanvasElement.prototype.toDataURL = function(...args) {
                        const ctx = this.getContext('2d');
                        if (ctx && this.width > 0 && this.height > 0) {
                            try {
                                const data = ctx.getImageData(0, 0, 1, 1);
                                data.data[3] = Math.max(1, data.data[3] - 1);
                                ctx.putImageData(data, 0, 0);
                            } catch (_) {}
                        }
                        return originalToDataURL.apply(this, args);
                    };

                    const originalGetImageData = CanvasRenderingContext2D.prototype.getImageData;
                    CanvasRenderingContext2D.prototype.getImageData = function(...args) {
                        const imageData = originalGetImageData.apply(this, args);
                        try {
                            if (imageData && imageData.data && imageData.data.length > 16) {
                                for (let i = 0; i < 16; i += 4) {
                                    const delta = seededUnit('canvas:' + i) > 0.5 ? 1 : -1;
                                    imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + delta));
                                }
                            }
                        } catch (_) {}
                        return imageData;
                    };
                } catch (_) {}

                try {
                    const AudioProto = (window.OfflineAudioContext || window.webkitOfflineAudioContext || window.AudioContext)?.prototype;
                    const originalCreateAnalyser = AudioProto && AudioProto.createAnalyser;
                    if (typeof originalCreateAnalyser === 'function') {
                        AudioProto.createAnalyser = function() {
                            const analyser = originalCreateAnalyser.call(this);
                            if (!analyser || analyser.__californiaAudioPatched) return analyser;
                            const originalGetFloat = analyser.getFloatFrequencyData.bind(analyser);
                            Object.defineProperty(analyser, '__californiaAudioPatched', { value: true, configurable: true });
                            analyser.getFloatFrequencyData = function(array) {
                                originalGetFloat(array);
                                for (let i = 0; i < array.length; i += 1) {
                                    array[i] += stableNoise('audio-float:' + i, 0.0001);
                                }
                            };
                            return analyser;
                        };
                    }
                } catch (_) {}

                try {
                    const originalCreateElement = Document.prototype.createElement;
                    Document.prototype.createElement = function(tag, ...rest) {
                        const el = originalCreateElement.call(this, tag, ...rest);
                        if (typeof tag === 'string' && tag.toLowerCase() === 'iframe') {
                            try {
                                Object.defineProperty(el, 'contentWindow', {
                                    get() {
                                        const win = HTMLIFrameElement.prototype.__lookupGetter__('contentWindow').call(el);
                                        try {
                                            if (win && win.navigator) {
                                                Object.defineProperty(win.navigator, 'webdriver', { get: () => undefined, configurable: true });
                                            }
                                        } catch (_) {}
                                        return win;
                                    }
                                });
                            } catch (_) {}
                        }
                        return el;
                    };
                } catch (_) {}

                try {
                    for (const key of Object.keys(window)) {
                        if (/^(cdc_|\\$cdc_|_phantom|callPhantom|webdriver-|driver-)/.test(key)) {
                            try { delete window[key]; } catch (_) {}
                        }
                    }
                } catch (_) {}

                try {
                    const fakeChrome = {
                        app: {
                            isInstalled: false,
                            InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
                            RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
                            getDetails: () => null,
                            getIsInstalled: () => false
                        },
                        runtime: {
                            OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
                            OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
                            PlatformArch: { ARM: 'arm', ARM64: 'arm64', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
                            PlatformNaclArch: { ARM: 'arm', MIPS: 'mips', MIPS64: 'mips64', X86_32: 'x86-32', X86_64: 'x86-64' },
                            PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
                            RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
                            connect: () => {},
                            sendMessage: () => {}
                        },
                        csi: () => ({ onloadT: Date.now(), pageT: Date.now() - 1000, startE: Date.now() - 2000, tran: 15 }),
                        loadTimes: () => ({
                            requestTime: Date.now() / 1000 - 2,
                            startLoadTime: Date.now() / 1000 - 1.5,
                            commitLoadTime: Date.now() / 1000 - 1,
                            finishDocumentLoadTime: Date.now() / 1000 - 0.5,
                            finishLoadTime: Date.now() / 1000,
                            firstPaintTime: Date.now() / 1000 - 0.3,
                            firstPaintAfterLoadTime: 0,
                            navigationType: 'Other',
                            wasFetchedViaSpdy: true,
                            wasNpnNegotiated: true,
                            npnNegotiatedProtocol: 'h2',
                            wasAlternateProtocolAvailable: false,
                            connectionInfo: 'h2'
                        })
                    };
                    Object.defineProperty(window, 'chrome', { value: fakeChrome, writable: true, configurable: true });
                } catch (_) {}

                try {
                    if (navigator.permissions && navigator.permissions.query) {
                        const originalQuery = navigator.permissions.query.bind(navigator.permissions);
                        navigator.permissions.query = function(params) {
                            if (params && params.name === 'notifications') {
                                return Promise.resolve({ state: typeof Notification !== 'undefined' ? Notification.permission : 'default', onchange: null });
                            }
                            return originalQuery(params).catch(() => ({ state: 'prompt', onchange: null }));
                        };
                    }
                } catch (_) {}

                try {
                    if (typeof Notification !== 'undefined') {
                        const originalPermission = Object.getOwnPropertyDescriptor(Notification, 'permission');
                        if (!originalPermission || originalPermission.get) {
                            Object.defineProperty(Notification, 'permission', { get: () => 'default', configurable: true });
                        }
                    }
                } catch (_) {}

                console.log('[California Fingerprint] 加州指纹伪装已应用 -', config.region);
            })();
        `;
    }

    static getPlaywrightOptions(config = null) {
        if (!config) config = this.generateRandomCaliforniaFingerprint();
        config = this.normalizeLocaleConfig(config);

        return {
            userAgent: config.userAgent,
            viewport: { width: config.screen.width, height: config.screen.height },
            screen: { width: config.screen.width, height: config.screen.height },
            locale: config.locale,
            deviceScaleFactor: 1,
            isMobile: false,
            hasTouch: false,
            timezoneId: config.timezone,
            extraHTTPHeaders: {
                'Accept-Language': this.getAcceptLanguageHeader(config.languages),
                'sec-ch-ua': this.getSecChUaHeader(config.chromeMajor),
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"'
            }
        };
    }

    static async applyToPage(page, config = null) {
        await page.addInitScript(this.getSpoofingScript(config));
    }

    static async applyToContext(context, config = null) {
        await context.addInitScript(this.getSpoofingScript(config));
    }

    static async createCaliforniaContext(browser, customConfig = {}) {
        const detectedChromeVersion = this.getBrowserChromeVersion(browser);
        const browserChromeVersion = detectedChromeVersion || customConfig.chromeVersion;
        const config = this.normalizeLocaleConfig({
            ...this.generateRandomCaliforniaFingerprint({ chromeVersion: browserChromeVersion }),
            ...customConfig
        });

        const effectiveChromeVersion = this.normalizeChromeVersion(browserChromeVersion || config.chromeVersion || `${config.chromeMajor || 148}.0.0.0`);
        if (detectedChromeVersion || !customConfig.userAgent) {
            config.userAgent = this.getCaliforniaUserAgents(config.platform, effectiveChromeVersion)[0];
        }
        config.chromeVersion = effectiveChromeVersion;
        config.chromeMajor = Number(effectiveChromeVersion.split('.')[0]) || this.getChromeMajorVersion(config.userAgent);
        config.screen = {
            ...this.DEFAULT_SCREEN,
            ...(config.screen || {})
        };
        config.connection = config.connection || { effectiveType: '4g', rtt: 100, downlink: 10, saveData: false };
        config.fingerprintSeed = config.fingerprintSeed || this.createFingerprintSeed();

        const options = this.getPlaywrightOptions(config);
        config.fingerprintConsistencyIssues = this.validateFingerprintConsistency(config, options);

        console.log(`🌴 生成加州指纹: ${config.region}, CPU: ${config.hardwareConcurrency}核, 内存: ${config.deviceMemory}GB`);
        if (config.fingerprintConsistencyIssues.length > 0) {
            console.warn('[California Fingerprint] 指纹配置存在内部不一致:', config.fingerprintConsistencyIssues.join('; '));
        }

        const context = await browser.newContext(options);
        await this.applyToContext(context, config);

        return { context, config };
    }

    static generateMultipleCaliforniaFingerprints(count = 5) {
        const fingerprints = [];
        for (let i = 0; i < count; i += 1) {
            fingerprints.push(this.generateRandomCaliforniaFingerprint());
        }
        return fingerprints;
    }
}

module.exports = CaliforniaFingerprint;
