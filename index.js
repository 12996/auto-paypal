const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const ChatGPTService = require('./chatgpt');
const fs = require('fs');
const path = require('path');
const { createProxyBridge, closeProxyBridge } = require('./local-proxy-bridge');
const debug = require('./test/debug_helper');
// 引入指纹伪装库
const CaliforniaFingerprint = require('./lib/california-fingerprint');
const BrowserFingerprint = require('./lib/browser-fingerprint');
chromium.use(StealthPlugin());
// 启用 Stealth 插件（在任何 launch 之前调用）

// 随机选择一个真实的 Chrome UA


function generateRandomOutlookEmail() {
    // PayPal 账户登录邮箱：使用 @hotmail.com（PayPal 对主流邮箱信任度更高，
    // 自定义域名（如 chiyiyi.cloud）容易被 PayPal 标为可疑）
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const length = 10 + Math.floor(Math.random() * 4); // 10-13 字符，避免短前缀重复风险
    let prefix = '';
    for (let i = 0; i < length; i += 1) {
        prefix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}@hotmail.com`;
}

function generateRandomPassword() {
    // 生成符合 PayPal 密码要求的随机密码：
    // - 至少 8 个字符
    // - 包含大小写字母、数字、特殊字符
    // - 不能有 3 个连续相同字符（如 aaa, 111）
    // - 不能有 3 个连续递增/递减字符（如 abc, 321）
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const digits = '0123456789';
    const special = '!@#$%&*';

    // 检查是否有 3 个连续字符（相同或递增/递减）
    function hasConsecutive(str) {
        for (let i = 0; i < str.length - 2; i++) {
            const c1 = str.charCodeAt(i);
            const c2 = str.charCodeAt(i + 1);
            const c3 = str.charCodeAt(i + 2);
            // 三个相同
            if (c1 === c2 && c2 === c3) return true;
            // 三个连续递增 (abc, 123)
            if (c2 === c1 + 1 && c3 === c2 + 1) return true;
            // 三个连续递减 (cba, 321)
            if (c2 === c1 - 1 && c3 === c2 - 1) return true;
        }
        return false;
    }

    const allChars = lower + upper + digits + special;
    const targetLength = 12 + Math.floor(Math.random() * 5); // 12-16 字符

    let password;
    let attempts = 0;
    do {
        // 确保每种字符至少有一个
        password = '';
        password += lower.charAt(Math.floor(Math.random() * lower.length));
        password += upper.charAt(Math.floor(Math.random() * upper.length));
        password += digits.charAt(Math.floor(Math.random() * digits.length));
        password += special.charAt(Math.floor(Math.random() * special.length));

        // 填充到目标长度
        while (password.length < targetLength) {
            password += allChars.charAt(Math.floor(Math.random() * allChars.length));
        }

        // 打乱顺序
        password = password.split('').sort(() => Math.random() - 0.5).join('');
        attempts++;
    } while (hasConsecutive(password) && attempts < 100);

    return password;
}

/**
 * PayPal Checkout Automation - Refactored & Beautified
 * 
 * Features:
 * - Real-time Slider Monitoring
 * - Robust Overlay Cleaning
 * - Human-like Interaction Simulation
 * - Modular Flow Control
 */

// 全部敏感配置请通过环境变量传入；本仓库不附带任何真实密钥/账号/代理，
// 可参考 .env.example 完成本地配置后再启动。
const CONFIG = {
    chatgptToken: process.env.CHATGPT_TOKEN || "",
    stripeKey: process.env.STRIPE_KEY || "",
    billing: {
        country: process.env.BILLING_COUNTRY || "US",
        address: process.env.BILLING_ADDRESS || "",
        city: process.env.BILLING_CITY || "",
        state: process.env.BILLING_STATE || "",
        zip: process.env.BILLING_ZIP || "",
        name: process.env.BILLING_NAME || "",
        email: process.env.BILLING_EMAIL || generateRandomOutlookEmail(),
        card: process.env.CARD_NUMBER || "",
        expiry: process.env.CARD_EXPIRY || "",
        cvc: process.env.CARD_CVC || "",
        paypalPassword: process.env.PAYPAL_PASSWORD || generateRandomPassword(),
        smsKey: process.env.SMS_API_KEY || "",
        smsPhone: process.env.BILLING_PHONE || ""
    },
    proxy: process.env.PROXY || ""
};
const DEBUG_PAYPAL_LOCALE = process.env.DEBUG_PAYPAL_LOCALE === '1' || process.env.DEBUG_PAYPAL_LOCALE === 'true';

function buildPlaywrightProxy(proxyValue) {
    if (!proxyValue) return null;

    try {
        const parsed = new URL(proxyValue);
        const server = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
        const proxy = { server };

        if (parsed.username) {
            proxy.username = decodeURIComponent(parsed.username);
        }
        if (parsed.password) {
            proxy.password = decodeURIComponent(parsed.password);
        }

        return proxy;
    } catch (error) {
        console.warn(`[!] [系统] 代理 URL 解析失败，将按原始值使用: ${error.message}`);
        return { server: proxyValue };
    }
}

function getPayPalLocaleTrace(rawUrl) {
    try {
        const url = new URL(rawUrl);
        const stateRaw = url.searchParams.get('state') || '';
        const stateParams = stateRaw ? new URLSearchParams(stateRaw.startsWith('?') ? stateRaw.slice(1) : stateRaw) : null;
        return {
            host: url.hostname,
            path: url.pathname,
            country: url.searchParams.get('country.x'),
            locale: url.searchParams.get('locale.x'),
            langTgl: url.searchParams.get('langTgl'),
            token: url.searchParams.get('token') || url.searchParams.get('ctxId'),
            baToken: url.searchParams.get('ba_token'),
            stateCountry: stateParams?.get('country.x') || null,
            stateLocale: stateParams?.get('locale.x') || null,
            stateToken: stateParams?.get('token') || null,
            stateBaToken: stateParams?.get('ba_token') || null
        };
    } catch (_) {
        return null;
    }
}

function logPayPalLocaleTrace(label, rawUrl) {
    if (!/paypal\.com/i.test(String(rawUrl))) return;
    const trace = getPayPalLocaleTrace(rawUrl);
    if (trace) {
        console.log(`[PayPal Locale] ${label}: ${formatPayPalLocaleSummary(trace)}`);
        if (DEBUG_PAYPAL_LOCALE) {
            console.log(`[PayPal Locale Debug] ${label}=${JSON.stringify(trace)}`);
        }
    }
}

function formatPayPalLocaleSummary(traceOrUrl) {
    const trace = typeof traceOrUrl === 'string' ? getPayPalLocaleTrace(traceOrUrl) : traceOrUrl;
    if (!trace) return '(unknown)';

    const locale = trace.locale || trace.stateLocale || '-';
    const country = trace.country || trace.stateCountry || '-';
    const langTgl = trace.langTgl ? ` langTgl=${trace.langTgl}` : '';
    return `${trace.path || '/'} country=${country} locale=${locale}${langTgl}`;
}

function formatPayPalPageLocaleSummary(probe) {
    if (!probe) return '(unknown)';
    const trace = getPayPalLocaleTrace(probe.url || '');
    const path = trace?.path || '(unknown)';
    const locale = probe.hiddenLocale || trace?.locale || trace?.stateLocale || '-';
    const country = trace?.country || trace?.stateCountry || '-';
    const htmlLang = probe.htmlLang || '-';
    return `${path} htmlLang=${htmlLang} country=${country} locale=${locale}`;
}

function forcePayPalUsLocaleUrl(rawUrl) {
    try {
        const url = new URL(rawUrl);
        const host = url.hostname.toLowerCase();
        const isPayPalPageHost = host === 'paypal.com' || host === 'www.paypal.com';
        if (!isPayPalPageHost) return rawUrl;

        url.searchParams.set('country.x', 'US');
        url.searchParams.set('locale.x', 'en_US');
        return url.toString();
    } catch (_) {
        return rawUrl;
    }
}

function buildDebugScreenshotPath(prefix) {
    const screenshotDir = path.join(__dirname, 'debug_screenshots', '激活');
    fs.mkdirSync(screenshotDir, { recursive: true });
    return path.join(screenshotDir, `${prefix}_${Date.now()}.png`);
}

function getAvailableDebugPage(context, preferredPage) {
    if (preferredPage && !preferredPage.isClosed()) {
        return preferredPage;
    }
    if (!context || typeof context.pages !== 'function') {
        return null;
    }
    const alivePages = context.pages().filter((item) => item && !item.isClosed());
    return alivePages.length ? alivePages[alivePages.length - 1] : null;
}

//对错误界面进行截图
async function captureDebugScreenshot(context, preferredPage, prefix, label = '异常截图') {
    const targetPage = getAvailableDebugPage(context, preferredPage);
    if (!targetPage) {
        console.warn(`⚠️ [系统] ${label}未保存：当前没有可用页面。`);
        return null;
    }

    const screenshotPath = buildDebugScreenshotPath(prefix);
    await targetPage.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 [系统] ${label}已保存: ${screenshotPath}`);

    // 同时保存 HTML（与截图放一起，便于离线分析 DOM）
    try {
        await debug.saveOnError(targetPage, prefix);
    } catch (_) { /* 静默 */ }

    return screenshotPath;
}

// 断链配置
async function isConnectionClosedPage(page) {
    try {
        const bodyText = String(await page.textContent('body', { timeout: 3000 }).catch(() => '') || '');
        return bodyText.includes('ERR_CONNECTION_CLOSED')
            || bodyText.includes('无法访问此网站')
            || bodyText.includes('意外终止了连接')
            || bodyText.includes('This site can’t be reached')
            || bodyText.includes('This site cannot be reached');
    } catch (_) {
        return false;
    }
}

// 自动重新加载
async function recoverConnectionClosed(page, fallbackUrl = '') {
    if (!(await isConnectionClosedPage(page))) {
        return false;
    }

    console.warn('[Warn] 检测到浏览器连接关闭错误页，正在尝试自动重载...');
    for (let attempt = 1; attempt <= 3; attempt++) {
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(async () => {
            const nextUrl = fallbackUrl || page.url();
            if (nextUrl) {
                return page.goto(nextUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { });
            }
        });
        await page.waitForTimeout(3000);
        if (!(await isConnectionClosedPage(page))) {
            console.log(`[Info] 连接关闭错误页已恢复 (第 ${attempt} 次重载成功)。`);
            return true;
        }
    }

    return false;
}
/**
 * Main Automation logic
 * @param {Object} options - 可选配置
 * @param {string} options.checkoutUrl - 外部传入的 Stripe Checkout URL（跳过 API 创建订单）
 * @param {boolean} options.debugMode - 调试模式（PayPal 触发后暂停，不自动填表）
 */
async function run(options = {}) {
    const { checkoutUrl: externalCheckoutUrl, debugMode = false } = options;
    // 切到有头模式调试：HEADFUL=1 node server.js 或 HEADFUL=1 node index.js
    const DEBUG_HEADFUL = process.env.HEADFUL === '1';
    const ENABLE_STRICT_FINGERPRINT = process.env.STRICT_FINGERPRINT === '1';
    // 选择真实 Google Chrome：CHROMIUM_CHANNEL=chrome（机器需安装 Google Chrome）
    const CHROMIUM_CHANNEL = (process.env.CHROMIUM_CHANNEL || '').trim();

    const launchArgs = [
        '--disable-blink-features=AutomationControlled'
    ];
    if (!DEBUG_HEADFUL) {
        launchArgs.push('--no-sandbox', '--disable-setuid-sandbox');
    }
    const launchOptions = {
        headless: !DEBUG_HEADFUL,
        args: launchArgs
    };
    if (CHROMIUM_CHANNEL) {
        launchOptions.channel = CHROMIUM_CHANNEL; // e.g. 'chrome' / 'msedge'
    }
    if (DEBUG_HEADFUL) {
        console.log(`🧪 [Step 0] 启动 Stealth 浏览器环境... (HEADFUL=1，有头模式${CHROMIUM_CHANNEL ? `, channel=${CHROMIUM_CHANNEL}` : ''})`);
    }
    // 代理配置：默认直连远程代理；只有显式开启时才经本地 VPN 端口中转。
    let proxyBridgeStarted = false;
    if (CONFIG.proxy) {
        // 如果配置的是本地 VPN 端口，直接使用，不需要桥接
        const isLocalVpn = CONFIG.proxy.includes('127.0.0.1:7897') || CONFIG.proxy.includes('localhost:7897');
        if (isLocalVpn) {
            launchOptions.proxy = { server: 'http://127.0.0.1:7897' };
            console.log(`🌐 [系统] 直接使用本地 VPN 代理: http://127.0.0.1:7897`);
        } else {
            const useProxyBridgeVpn = String(process.env.PROXY_BRIDGE_USE_VPN || '').trim() === '1';
            try {
                const bridge = await createProxyBridge({
                    remoteProxy: CONFIG.proxy,
                    localPort: 10808,
                    vpnPort: 7897,
                    useVpn: useProxyBridgeVpn,
                    vpnType: 'http'
                });
                proxyBridgeStarted = true;
                launchOptions.proxy = { server: bridge.localProxy };
                console.log(`🌐 [系统] 代理桥接已启动，Playwright 使用 ${bridge.localProxy}`);
            } catch (e) {
                console.warn(`⚠️  [系统] 代理桥接启动失败: ${e.message}，将尝试直连`);
                const proxyConfig = buildPlaywrightProxy(CONFIG.proxy);
                if (proxyConfig) {
                    launchOptions.proxy = proxyConfig;
                    console.log(`🌐 [系统] 代理已配置（直连模式）`);
                }
            }
        }
    }

    const browser = await chromium.launch(launchOptions);

    // 取浏览器真实 UA，避免与 register_openai.js 不一致 / 与 navigator.userAgentData 不一致
    const realUserAgent = await (async () => {
        try {
            const tmpCtx = await browser.newContext();
            const tmpPage = await tmpCtx.newPage();
            const ua = await tmpPage.evaluate(() => navigator.userAgent);
            await tmpCtx.close().catch(() => { });
            return ua;
        } catch (_) {
            return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36';
        }
    })();

    const viewport = { width: 1920, height: 1080 }; // HAR: screen 1920x1080
    // 解析真实 UA，构造与之对齐的 sec-ch-ua（Client Hints），避免 UA 与 brands 不一致
    const matched = realUserAgent.match(/Chrome\/(\d+)/);
    const chromeMajor = matched ? Number(matched[1]) : 147;

    const contextOptions = {
        userAgent: realUserAgent,
        viewport,
        timezoneId: 'America/New_York',
        // PayPal HAR: 美国账户场景；屏幕尺寸 1920x1080
        screen: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        // 兜底：把 sec-ch-ua* 与 UA 强制对齐（Playwright 默认会按 UA 自动算，但显式更稳）
        extraHTTPHeaders: {
            'sec-ch-ua': `"Not)A;Brand";v="8", "Chromium";v="${chromeMajor}", "Google Chrome";v="${chromeMajor}"`,
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"'
        }
    };

    // 获取或生成加州指纹配置
    let fingerprintConfig;
    if (process.env.FINGERPRINT_CONFIG) {
        try {
            fingerprintConfig = JSON.parse(process.env.FINGERPRINT_CONFIG);
            console.log('🌴 [指纹] 使用传入的加州指纹配置');
        } catch (e) {
            console.log('⚠️ [指纹] 配置解析失败，生成新的加州指纹');
            fingerprintConfig = CaliforniaFingerprint.generateRandomCaliforniaFingerprint();
        }
    } else {
        fingerprintConfig = CaliforniaFingerprint.generateRandomCaliforniaFingerprint();
        console.log('🌴 [指纹] 生成新的加州指纹配置');
    }

    console.log(`🌴 [指纹] 使用 ${fingerprintConfig.region} 指纹 (${fingerprintConfig.hardwareConcurrency}核/${fingerprintConfig.deviceMemory}GB)`);

    // 使用加州指纹创建上下文
    const { context, config: effectiveFingerprintConfig } = await CaliforniaFingerprint.createCaliforniaContext(browser, fingerprintConfig);

    // ============= 额外严格指纹清理（默认关闭，不再覆盖 CaliforniaFingerprint 的随机 profile）=============
    if (ENABLE_STRICT_FINGERPRINT) {
        await context.addInitScript((config) => {
        const NavProto = Object.getPrototypeOf(navigator);
        const ScrProto = Object.getPrototypeOf(screen);
        const safeDefine = (obj, key, getter) => {
            try {
                Object.defineProperty(obj, key, { get: getter, configurable: true });
            } catch (_) { /* ignore */ }
        };

        try { delete Object.getPrototypeOf(navigator).webdriver; } catch (_) { }
        safeDefine(NavProto, 'webdriver', () => undefined);
        try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true }); } catch (_) { }

        try {
            const conn = (config && config.connection) || { effectiveType: '4g', rtt: 100, downlink: 10, saveData: false };
            safeDefine(NavProto, 'connection', () => conn);
        } catch (_) { }

        try {
            const origQuery = navigator.permissions.query.bind(navigator.permissions);
            navigator.permissions.query = (params) => {
                if (params && params.name === 'notifications') {
                    return Promise.resolve({ state: typeof Notification !== 'undefined' ? Notification.permission : 'default', onchange: null });
                }
                return origQuery(params).catch(() => ({ state: 'prompt', onchange: null }));
            };
        } catch (_) { }

        try {
            if (config && config.screen) {
                safeDefine(ScrProto, 'availHeight', () => config.screen.availHeight || config.screen.height - 48);
                safeDefine(ScrProto, 'availWidth', () => config.screen.availWidth || config.screen.width);
                safeDefine(ScrProto, 'colorDepth', () => config.screen.colorDepth || 24);
                safeDefine(ScrProto, 'pixelDepth', () => config.screen.pixelDepth || 24);
                safeDefine(ScrProto, 'width', () => config.screen.width);
                safeDefine(ScrProto, 'height', () => config.screen.height);
            }
        } catch (_) { }

        try {
            const origCreate = Document.prototype.createElement;
            Document.prototype.createElement = function (tag, ...rest) {
                const el = origCreate.call(this, tag, ...rest);
                if (typeof tag === 'string' && tag.toLowerCase() === 'iframe') {
                    try {
                        Object.defineProperty(el, 'contentWindow', {
                            get() {
                                const w = HTMLIFrameElement.prototype.__lookupGetter__('contentWindow').call(el);
                                try {
                                    if (w && w.navigator) {
                                        try { Object.defineProperty(w.navigator, 'webdriver', { get: () => undefined, configurable: true }); } catch (_) { }
                                    }
                                } catch (_) { }
                                return w;
                            }
                        });
                    } catch (_) { }
                }
                return el;
            };
        } catch (_) { }

        try {
            for (const key of Object.keys(window)) {
                if (/^(cdc_|\$cdc_|_phantom|callPhantom|webdriver-|driver-)/.test(key)) {
                    try { delete window[key]; } catch (_) { }
                }
            }
        } catch (_) { }

        try {
            if (typeof Notification !== 'undefined') {
                const origPerm = Object.getOwnPropertyDescriptor(Notification, 'permission');
                if (!origPerm || origPerm.get) {
                    Object.defineProperty(Notification, 'permission', { get: () => 'default', configurable: true });
                }
            }
        } catch (_) { }

        }, effectiveFingerprintConfig);
    }

    await context.route('**/*', async (route) => {
        const request = route.request();
        if (request.resourceType() !== 'document') {
            return route.continue();
        }

        const originalUrl = request.url();
        const forcedUrl = forcePayPalUsLocaleUrl(originalUrl);
        if (forcedUrl !== originalUrl) {
            console.log(`[PayPal Locale] force US/en_US: ${formatPayPalLocaleSummary(originalUrl)} -> ${formatPayPalLocaleSummary(forcedUrl)}`);
            return route.continue({ url: forcedUrl });
        }
        return route.continue();
    });

    let page = null;
    let stopInactivityWatcher = null;

    try {
        // --- Phase 0: Proxy Connectivity Check ---
        if (launchOptions.proxy) {
            // (静默) 检查代理连通性
            try {
                const probeResponse = await context.request.get("http://api.ipify.org/?format=text", {
                    timeout: 15000
                });
                if (probeResponse.ok()) {
                    const ip = (await probeResponse.text()).trim();
                    // 保留进度标记关键字 "代理连接成功! 代理公网 IP" 以便 product_activator/server 识别进度，
                    // 但只露最后两段，避免完整出口 IP 泄露
                    const ipMasked = String(ip).replace(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/, '***.***.$3.$4');
                    console.log(`✅ [系统] 代理连接成功! 代理公网 IP: ${ipMasked}`);
                } else {
                    throw new Error(`代理响应异常: HTTP ${probeResponse.status()}`);
                }
            } catch (proxyError) {
                console.log("    [!] 请检查 PROXY 配置是否正确，或者账号余额是否充足。");
                throw proxyError;
            }
        }

        // --- Phase 1: API Initialization ---
        let paypalUrl;
        if (externalCheckoutUrl) {
            // 外部传入 Checkout URL，跳过 API 创建订单
            console.log("📦 [步骤] 使用外部传入的 Checkout URL，跳过订单创建...");
            paypalUrl = externalCheckoutUrl;
        } else {
            const gpt = new ChatGPTService(context.request, CONFIG.chatgptToken, CONFIG.stripeKey);
            // (静默) 创建订单（成功/失败由 chatgpt.js 内打印）
            paypalUrl = await gpt.getPayPalApprovalUrl();

            if (!paypalUrl) {
                throw new Error("无法获取 PayPal 审批链接");
            }
        }
        const forcedPayPalUrl = forcePayPalUsLocaleUrl(paypalUrl);
        if (forcedPayPalUrl !== paypalUrl) {
            console.log(`[PayPal Locale] force initial US/en_US: ${formatPayPalLocaleSummary(paypalUrl)} -> ${formatPayPalLocaleSummary(forcedPayPalUrl)}`);
            paypalUrl = forcedPayPalUrl;
        }
        logPayPalLocaleTrace('initial-paypal-url', paypalUrl);

        // --- Phase 2: Automation Setup ---
        page = await context.newPage();
        page.on('close', () => {
            console.warn(`⚠️ [系统] 当前页面已关闭，关闭前最后 URL: ${page.url()}`);
        });
        page.on('framenavigated', async (frame) => {
            if (frame !== page.mainFrame()) return;
            const currentUrl = frame.url();
            if (!/paypal\.com/i.test(currentUrl)) return;
            logPayPalLocaleTrace('navigation', currentUrl);
            try {
                const localeProbe = await page.evaluate(() => ({
                    url: location.href,
                    htmlLang: document.documentElement.lang,
                    navLanguage: navigator.language,
                    navLanguages: navigator.languages
                })).catch(() => null);
                if (localeProbe) {
                    console.log(`[PayPal Locale] page: ${formatPayPalPageLocaleSummary(localeProbe)}`);
                    if (DEBUG_PAYPAL_LOCALE) {
                        console.log(`[PayPal Locale Debug] page=${JSON.stringify(localeProbe)}`);
                    }
                }
            } catch (_) { /* ignore */ }
        });
        await page.route('**/auth/validatecaptcha', async route => {
            console.log('拦截到了安全挑战页面，正在屏蔽...');
            await route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: '<html><body></body></html>'
            });
        });
        // 已禁用「无动静自动截图」（用户要求）。失败时仍由各 catch 分支主动截图诊断。
        stopInactivityWatcher = () => { /* noop */ };
        if (false) {
            const inactivityMs = 30000;
            const maxCapturesPerStall = 3;
            let timer = null;
            let isCapturing = false;
            let captureCount = 0;
            let lastObservedUrl = '';

            const isMeaningfulUrlChange = () => {
                if (!page || page.isClosed()) {
                    return false;
                }
                const currentUrl = page.url();
                if (currentUrl && currentUrl !== lastObservedUrl) {
                    lastObservedUrl = currentUrl;
                    captureCount = 0;
                    return true;
                }
                return false;
            };

            const schedule = () => {
                if (timer) {
                    clearTimeout(timer);
                }
                timer = setTimeout(async () => {
                    if (!page || page.isClosed() || isCapturing) {
                        return;
                    }
                    isCapturing = true;
                    try {
                        await captureDebugScreenshot(context, page, 'inactive', '30秒无动静自动截图');
                        captureCount += 1;
                        const stuckUrl = page.url();
                        if (captureCount >= maxCapturesPerStall) {
                            console.error(`❌ [系统] 页面疑似卡死：${captureCount * 30} 秒无有效进展 (URL: ${stuckUrl})`);
                            await page.close().catch(() => { });
                            return;
                        }
                    } catch (e) {
                        console.warn(`⚠️ [系统] 自动截图失败: ${e.message}`);
                    } finally {
                        isCapturing = false;
                        if (page && !page.isClosed()) {
                            schedule();
                        }
                    }
                }, inactivityMs);
            };

            const onActivity = () => {
                if (isMeaningfulUrlChange()) {
                    schedule();
                }
            };

            page.on('load', onActivity);
            page.on('domcontentloaded', onActivity);
            page.on('framenavigated', onActivity);
            page.on('close', () => {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
            });

            schedule();

            return () => {
                if (timer) {
                    clearTimeout(timer);
                    timer = null;
                }
                page.off('load', onActivity);
                page.off('domcontentloaded', onActivity);
                page.off('framenavigated', onActivity);
            };
        }

        const solveSlider = async () => {
            const BUTTON_SELECTORS = [
                "button:has-text('Confirm')",
                "button:has-text('确认您是真人')",
                "button:has-text(\"I'm not a robot\")",
                "button:has-text('Verify')",
                "div.ctp-checkbox-container",
                "#challenge-stage",
                "iframe[title*='hCaptcha' i]",
                "iframe[title*='Turnstile' i]",
                "iframe[src*='hcaptcha']",
                "iframe[src*='turnstile']",
                "iframe[src*='recaptcha']"
            ];
            const SLIDER_SELECTORS = [
                "#captcha__frame__bottom .slider",
                "#captcha__frame__bottom .sliderIcon",
                ".sliderContainer .slider",
                ".sliderContainer .sliderIcon",
                ".slider",
                ".sliderIcon",
                "[class*='slider']",
                "[class*='Slider']",
                "[data-testid*='slider']",
                ".geetest_slider_button",
                ".nc_iconfont.btn_slide",
                ".nc_slider",
                "#nc_1_n1z",
                "#challenge-container",
                "[aria-label*='slider' i]",
                "[aria-label*='滑块']",
                "[role='slider']",
                "div:has-text('拖动滑块')",
                "div:has-text('Drag the slider')",
                "p:has-text('Move the slider all the way to the right')"
            ];
            const UNSOLVABLE_CAPTCHA_SELECTORS = [
                "iframe[src*='recaptcha'][src*='bframe']",
                ".rc-imageselect",
                "[class*='rc-imageselect']",
                "iframe[title*='recaptcha challenge']"
            ];
            const SOFT_WAIT_MS = 8000;

            const collectFrames = () => [page, ...page.frames()];

            const tryFindFirstVisible = async (selectors) => {
                const deadline = Date.now() + SOFT_WAIT_MS;
                while (Date.now() < deadline) {
                    for (const frame of collectFrames()) {
                        for (const sel of selectors) {
                            try {
                                const loc = frame.locator(sel).first();
                                if (await loc.isVisible({ timeout: 250 })) {
                                    return { frame, selector: sel, locator: loc };
                                }
                            } catch (_) { }
                        }
                    }
                    await page.waitForTimeout(400);
                }
                return null;
            };

            const checkUnsolvableCaptcha = async () => {
                for (const frame of collectFrames()) {
                    for (const sel of UNSOLVABLE_CAPTCHA_SELECTORS) {
                        try {
                            const loc = frame.locator(sel).first();
                            if (await loc.isVisible({ timeout: 500 })) {
                                return { selector: sel, found: true };
                            }
                        } catch (_) { }
                    }
                    const url = frame.url() || '';
                    if (/recaptcha.*bframe/i.test(url)) {
                        return { selector: url, found: true };
                    }
                }
                return { found: false };
            };

            try {
                const btnHit = await tryFindFirstVisible(BUTTON_SELECTORS);
                if (btnHit) {
                    console.log(`🧩 [风控] 检测到验证按钮: ${btnHit.selector}`);
                    try {
                        const box = await btnHit.locator.boundingBox();
                        if (box) {
                            await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                        } else {
                            await btnHit.locator.click({ timeout: 2000 }).catch(() => { });
                        }
                        await page.waitForTimeout(3000);

                        const postCheck = await checkUnsolvableCaptcha();
                        if (postCheck.found) {
                            console.error(`❌ [风控] 点击验证后弹出 reCAPTCHA 图片验证，无法自动解决: ${postCheck.selector}`);
                            throw new Error('支付失败 (recaptcha_image)：触发 reCAPTCHA 图片验证，需更换 IP 或稍后重试');
                        }

                        console.log("✅ [风控] 验证按钮点击完成。");
                        return true;
                    } catch (e) {
                        if (e.message.includes('recaptcha_image')) {
                            throw e;
                        }
                        console.warn(`⚠️ [风控] 验证按钮点击失败: ${e.message}`);
                    }
                }

                const sliderHit = await tryFindFirstVisible(SLIDER_SELECTORS);
                if (sliderHit) {
                    const { frame, selector, locator: slider } = sliderHit;
                    console.log(`🧩 [风控] 检测到滑块: ${selector}`);
                    const box = await slider.boundingBox();
                    if (!box) {
                        console.warn(`⚠️ [风控] 滑块命中但拿不到 boundingBox，跳过。`);
                        return false;
                    }

                    const container = frame
                        .locator("#captcha__frame__bottom .sliderContainer, .sliderContainer, [class*='slider-container'], [class*='SliderContainer'], .geetest_slider, .nc_scale")
                        .first();
                    const cBox = (await container.isVisible({ timeout: 200 }).catch(() => false))
                        ? await container.boundingBox().catch(() => null)
                        : null;
                    const distance = cBox ? Math.max(0, cBox.width - box.width + 6) : 310;

                    const startX = box.x + box.width / 2;
                    const startY = box.y + box.height / 2;

                    await page.mouse.move(startX, startY);
                    await page.mouse.down();
                    await page.waitForTimeout(400);

                    const steps = 25;
                    for (let i = 1; i <= steps; i += 1) {
                        const t = i / steps;
                        const ease = 1 - Math.pow(1 - t, 3);
                        await page.mouse.move(startX + distance * ease, startY + (Math.random() * 6 - 3));
                        await page.waitForTimeout(Math.random() * 15 + 10);
                    }

                    await page.mouse.move(startX + distance + 5, startY + (Math.random() * 4 - 2));
                    await page.waitForTimeout(800);
                    await page.mouse.up();
                    console.log("✅ [风控] 滑块验证处理成功。");
                    await page.waitForTimeout(2500);
                    await checkCriticalErrors();
                    return true;
                }

                const knownIframeMatches = [];
                for (const frame of collectFrames()) {
                    const url = frame.url() || '';
                    if (/hcaptcha|turnstile|recaptcha|captcha|challenge/i.test(url)) {
                        knownIframeMatches.push(url);
                    }
                }
                if (knownIframeMatches.length) {
                    console.warn(`🧩 [风控] 检测到挑战 iframe 但未识别可拖动滑块: ${knownIframeMatches.join(' | ')}`);
                } else {
                    console.log("🧩 [风控] 未检测到滑块/验证按钮（PayPal 未下发挑战）。");
                }
            } catch (e) {
                if (e.message.includes('recaptcha_image')) {
                    throw e;
                }
                console.warn(`⚠️ [风控] solveSlider 异常: ${e.message}`);
            }
            return false;
        };

        /**
         * Continuous monitoring for security challenges
         */
        /**
         * Fetches the 6-digit SMS code from the API
         */
        const getSMSCode = async (timeout = 120000) => {
            console.log("📨 [监听] 正在等待短信验证码...");
            const start = Date.now();
            const apiUrl = `http://a.62-us.com/api/get_sms?key=${CONFIG.billing.smsKey}`;
            let consecutiveNoCode = 0;

            while (Date.now() - start < timeout) {
                try {
                    const response = await context.request.get(apiUrl);
                    const text = await response.text();
                    console.log(`   [短信] 接口返回: ${text}`);

                    if (text.includes("yes|")) {
                        const match = text.match(/\b(\d{6})\b/);
                        if (match) {
                            console.log(`✅ [短信] 验证码提取成功: ${match[1]}`);
                            return match[1];
                        }
                    }

                    if (text.includes('no|') || text.includes('暂无验证码')) {
                        consecutiveNoCode += 1;
                        // 连续无验证码：提前判定该号不可用，避免长时间卡死浪费资源
                        if (consecutiveNoCode >= 12) { // 约 1 分钟
                            throw new Error('短信验证码超时/该手机号无验证码');
                        }
                    } else {
                        consecutiveNoCode = 0;
                    }
                } catch (e) {
                    console.error(`[-] [短信] 接口请求异常: ${e.message}`);
                    if (String(e.message || '').includes('短信验证码超时')) throw e;
                }
                await page.waitForTimeout(5000); // Poll every 5s
            }
            throw new Error('短信验证码超时/该手机号无验证码');
        };

        const checkCriticalErrors = async () => {
            // 在开始扫描前，先等待 1.5 秒，给页面动态弹出拦截框留出缓冲时间
            await page.waitForTimeout(1500);

            try {
                const currentUrl = page.url();
                if (currentUrl.includes('/checkoutweb/genericError')) {
                    throw new Error('"监测到致命拦截 (Security Block): You have been blocked"');
                }

                const allFrames = [page, ...page.frames()];

                for (const frame of allFrames) {
                    try {
                        // 优化点1：使用 :visible 伪类，只提取真实渲染在页面上、用户能看见的文本
                        // 优化点2：textContent 比 innerText 获取动态文本更稳定，且不受 CSS 样式干扰
                        const visibleText = await frame.locator(':visible').allTextContents().then(texts => texts.join(' ')).catch(() => "");

                        if (!visibleText) continue;

                        // 1. 致命拦截文字 (全 Frame 扫描可见文本)
                        if (visibleText.includes("We couldn’t load the security challenge") || visibleText.includes("You have been blocked") || visibleText.includes("Return to merchant")) {
                            throw new Error("监测到致命拦截 (Security Block): You have been blocked");
                        }



                        // 2. 手机号/银行卡被拒文字
                        if (visibleText.includes("different phone number")) {
                            throw new Error("手机号被拒绝或系统拦截");
                        }
                        if (visibleText.includes("Things don't seem to be working") || visibleText.includes("Your account is limited")) {
                            throw new Error("银行卡被拒绝 (Card declined)");
                        }

                    } catch (e) {
                        // 将具体的拦截错误继续向上抛出
                        if (e.message.includes("监测到") || e.message.includes("被拒绝") || e.message.includes("拦截")) throw e;
                    }
                }
            } catch (e) {
                if (e.message.includes("监测到") || e.message.includes("被拒绝") || e.message.includes("拦截")) throw e;
            }
        };

        const ensurePayPalEnglishLanguage = async () => {
            if (!/paypal\.com/i.test(String(page.url() || ''))) {
                return false;
            }

            const getLanguageProbe = async () => page.evaluate(() => {
                const text = document.body ? String(document.body.innerText || '') : '';
                return {
                    url: location.href,
                    title: document.title || '',
                    htmlLang: document.documentElement.lang || '',
                    hiddenLocale: document.querySelector('input[name="locale.x"]')?.value || '',
                    hasEnglishLink: Boolean(document.querySelector('a[data-locale="en_US"], a[lang="en"][href*="locale.x=en_US"]')),
                    bodySample: text.slice(0, 500)
                };
            }).catch(() => null);

            const isChinesePayPalPage = (probe) => {
                if (!probe) return false;
                const htmlLang = String(probe.htmlLang || '').toLowerCase();
                const hiddenLocale = String(probe.hiddenLocale || '').toLowerCase();
                const url = String(probe.url || '');
                const text = `${probe.title || ''} ${probe.bodySample || ''}`;
                return htmlLang.startsWith('zh')
                    || hiddenLocale.startsWith('zh')
                    || /locale\.x=zh|country\.x=cn/i.test(url)
                    || text.includes('登录您的PayPal账户')
                    || text.includes('创建账户')
                    || text.includes('下一步')
                    || text.includes('邮箱地址');
            };

            const beforeProbe = await getLanguageProbe();
            if (!isChinesePayPalPage(beforeProbe)) {
                console.log(`[PayPal Locale] ${formatPayPalPageLocaleSummary(beforeProbe)} -> 继续等待 Create an Account`);
                if (DEBUG_PAYPAL_LOCALE) {
                    console.log(`[PayPal Locale Debug] language-before=${JSON.stringify(beforeProbe)}`);
                }
                return false;
            }

            console.log(`[PayPal Locale] ${formatPayPalPageLocaleSummary(beforeProbe)} -> 检测到中文，点击 English`);
            if (DEBUG_PAYPAL_LOCALE) {
                console.log(`[PayPal Locale Debug] language-before=${JSON.stringify(beforeProbe)}`);
            }
            const englishSelectors = [
                'a[data-locale="en_US"]',
                'a[lang="en"][href*="locale.x=en_US"]',
                '.scTrack\\:unifiedlogin-footer-language_en_US',
                'a:has-text("English")'
            ];

            for (const selector of englishSelectors) {
                const englishLink = page.locator(selector).first();
                if (!await englishLink.isVisible({ timeout: 1000 }).catch(() => false)) {
                    continue;
                }

                console.log(`[PayPal Locale] 点击 English 语言入口: ${selector}`);
                await Promise.all([
                    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null),
                    englishLink.click({ force: true })
                ]);
                await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => { });
                await page.waitForTimeout(randomDelay(1000, 1800));

                const afterProbe = await getLanguageProbe();
                console.log(`[PayPal Locale] ${formatPayPalPageLocaleSummary(afterProbe)} -> 已切换英文`);
                if (DEBUG_PAYPAL_LOCALE) {
                    console.log(`[PayPal Locale Debug] language-after=${JSON.stringify(afterProbe)}`);
                }
                return true;
            }

            const fallbackUrl = forcePayPalUsLocaleUrl(page.url());
            if (fallbackUrl && fallbackUrl !== page.url()) {
                console.warn(`[PayPal Locale] 未找到 English DOM，使用 URL 兜底切换: ${formatPayPalLocaleSummary(page.url())} -> ${formatPayPalLocaleSummary(fallbackUrl)}`);
                await page.goto(fallbackUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => { });
                await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => { });
                return true;
            }

            console.warn('[PayPal Locale] 检测到中文页面，但未找到 English DOM，继续按原流程等待。');
            return false;
        };

        async function mouseBreathing(page, duration) {
            const startTime = Date.now();
            while (Date.now() - startTime < duration) {
                // 获取当前大概位置，进行极小范围的随机偏移（±5像素）
                const jitterX = randomDelay(-5, 5);
                const jitterY = randomDelay(-5, 5);
                // 使用 move 的 steps: 1 保证平滑过渡到偏移位置
                await page.mouse.move(page.lastMouseX + jitterX, page.lastMouseY + jitterY, { steps: 5 });
                await page.waitForTimeout(randomDelay(100, 300)); // 颤动的频率
            }
        }

        // 全局连贯漫游（解决鼠标瞬移问题）
        async function continuousHumanRoam(page, duration = 3000) {
            // 获取当前鼠标的实时坐标作为起点（保证轨迹连贯）
            // 注意：Playwright 无法直接读取当前鼠标坐标，我们需要自己在 page 对象上维护一个状态
            // 如果你没有维护，可以使用一个全局变量来记录上一次移动的终点
            const startX = page.lastMouseX || 500;
            const startY = page.lastMouseY || 500;

            // 随机生成终点（避开浏览器极边缘）
            const targetX = randomDelay(100, 1100);
            const targetY = randomDelay(100, 700);

            // 记录本次终点，供下一次调用使用
            page.lastMouseX = targetX;
            page.lastMouseY = targetY;

            // 生成贝塞尔曲线控制点（让轨迹变成平滑的弧线）
            const cp1x = startX + (targetX - startX) * 0.3 + randomDelay(-200, 200);
            const cp1y = startY + (targetY - startY) * 0.3 + randomDelay(-200, 200);
            const cp2x = startX + (targetX - startX) * 0.7 + randomDelay(-200, 200);
            const cp2y = startY + (targetY - startY) * 0.7 + randomDelay(-200, 200);

            const steps = 50; // 增加步数让移动更细腻
            const stepDelay = duration / steps;

            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                // 三次贝塞尔曲线公式
                const x = Math.pow(1 - t, 3) * startX +
                    3 * Math.pow(1 - t, 2) * t * cp1x +
                    3 * (1 - t) * Math.pow(t, 2) * cp2x +
                    Math.pow(t, 3) * targetX;
                const y = Math.pow(1 - t, 3) * startY +
                    3 * Math.pow(1 - t, 2) * t * cp1y +
                    3 * (1 - t) * Math.pow(t, 2) * cp2y +
                    Math.pow(t, 3) * targetY;

                await page.mouse.move(x, y);
                // 每一步加入微小的时间抖动，模拟人手的不匀速
                await page.waitForTimeout(stepDelay + randomDelay(-10, 15));
            }
        }
        // 拟人化随机延迟
        const randomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

        // 核心拟人输入函数：先看、再点、偶尔打错字、再删掉重打
        async function humanTypeWithSoul(page, locator, text) {
            // 1. 眼睛先过去（鼠标悬停在输入框上，假装在看）
            const box = await locator.boundingBox();
            if (box) {
                await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
                await page.waitForTimeout(randomDelay(400, 1200)); // 眼神确认位置
            }

            // 2. 点击获取焦点
            await locator.click();
            await page.waitForTimeout(randomDelay(200, 500));

            // 3. 模拟打字（加入偶尔的打错字和退格纠错逻辑）
            for (let i = 0; i < text.length; i++) {
                // 95% 概率打对字，5% 概率打错然后退格（模拟真实手误）
                if (Math.random() < 0.05 && i > 2) {
                    await page.keyboard.type('x'); // 随便打个错字
                    await page.waitForTimeout(randomDelay(100, 200));
                    await page.keyboard.press('Backspace'); // 删掉错字
                    await page.waitForTimeout(randomDelay(150, 300)); // 纠错后的停顿
                }

                // 正常输入字符
                await page.keyboard.type(text[i]);
                // 打字速度不均匀：偶尔快，偶尔卡顿一下
                let typeDelay = randomDelay(80, 200);
                if (Math.random() < 0.1) typeDelay += randomDelay(300, 800); // 偶尔突然卡壳想一下
                await page.waitForTimeout(typeDelay);
            }
        }


        // 核心拟人化填空函数（含填后校验：不一致则清空重填，直到成功为止）
        // digitsMode=true：卡号/手机号/有效期/CVC 字段。
        //   PayPal 的卡号 / 手机号字段近期开启了 4-4-4-4 自动格式化（onInput 重排带空格），
        //   逐字符 keyboard.type 会被 React 重排吞字符，所以这类字段直接用 page.fill() 一次性写入。
        //   PayPal 不会检测填卡时长，鼠标 / 提交时长由其他人手模拟覆盖。
        async function humanFillInput(page, locator, text, digitsMode = false, fastMode = false) {
            // PayPal 会自动格式化：卡号加空格、手机号加括号和横线
            // 校验时只比较核心字符，忽略格式化符号
            const digitsOnly = (s) => String(s || '').replace(/\D/g, '');
            const normalizeText = (s) => String(s || '').replace(/[\s()\-]/g, '').trim();

            // 先检查是否已有正确的值，避免重复填写导致内容叠加
            try {
                await locator.waitFor({ state: 'visible', timeout: 5000 });
                const existingValue = await locator.inputValue().catch(() => '');
                const alreadyCorrect = digitsMode
                    ? (digitsOnly(existingValue) === digitsOnly(text))
                    : (normalizeText(existingValue) === normalizeText(text));
                if (alreadyCorrect && existingValue.length > 0) {
                    console.log(`✓ [跳过] 字段已有正确值: "${existingValue}"`);
                    return;
                }
                // 如果有值但不正确，先清空
                if (existingValue && existingValue.length > 0) {
                    console.log(`⚠️ [清空] 字段已有值但不匹配，清空后重填: "${existingValue}" → "${text}"`);
                    await locator.click({ clickCount: 3 }).catch(() => { });
                    await page.keyboard.press('Delete').catch(() => { });
                    await page.waitForTimeout(randomDelay(100, 200));
                }
            } catch (_) { /* 忽略检查失败，继续正常填写流程 */ }

            // —— digitsMode 或 fastMode：模拟「密码管理器粘贴」，瞬时填入
            // 真实用户在卡号 / 邮箱 / 密码 字段上 90% 是粘贴而非逐字敲，
            // 慢节奏敲字反而触发 hCaptcha invisible 的"键盘事件过长"风控判分。
            if (digitsMode || fastMode) {
                let attempt = 0;
                while (attempt < 5) {
                    attempt++;
                    await locator.waitFor({ state: 'visible', timeout: 50000 });
                    const box = await locator.boundingBox().catch(() => null);
                    if (box) {
                        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
                        page.lastMouseX = box.x + box.width / 2;
                        page.lastMouseY = box.y + box.height / 2;
                        await page.waitForTimeout(randomDelay(150, 400));
                    }
                    await locator.click({ clickCount: 3 }).catch(() => { });
                    await page.waitForTimeout(randomDelay(60, 160));
                    try {
                        await locator.fill(text);
                    } catch (_) {
                        await page.keyboard.press('Control+A').catch(() => { });
                        await page.keyboard.press('Delete').catch(() => { });
                        await page.keyboard.type(text, { delay: 20 });
                    }
                    // 触发 React onChange / onBlur，确保格式化生效
                    await locator.evaluate((node) => {
                        try {
                            node.dispatchEvent(new Event('input', { bubbles: true }));
                            node.dispatchEvent(new Event('change', { bubbles: true }));
                            node.dispatchEvent(new Event('blur', { bubbles: true }));
                        } catch (_) { }
                    }).catch(() => { });
                    await page.waitForTimeout(randomDelay(150, 350));

                    const actualValue = await locator.inputValue().catch(() => null);
                    // digitsMode: 只比较数字（卡号、CVC）
                    // fastMode: 去掉空格/括号/横线后比较（邮箱、手机号）
                    // 普通模式: 去掉空格/括号/横线后比较
                    const compareOk = digitsMode
                        ? (actualValue !== null && digitsOnly(actualValue) === digitsOnly(text))
                        : (actualValue !== null && normalizeText(actualValue) === normalizeText(text));
                    if (compareOk) {
                        return;
                    }
                    console.log(`⚠️ [校验] (${digitsMode ? 'digits' : 'fast'}) 第${attempt}次填写不一致，预期: "${text}"，实际: "${actualValue}"，重填中...`);
                }
                console.warn(`⚠️ [校验] (${digitsMode ? 'digits' : 'fast'}) 多次尝试仍不一致，使用最后一次结果继续`);
                return;
            }

            // —— 普通字段（姓名 / 邮箱 / 地址 / 密码）：保留人手节奏
            let attempt = 0;
            while (true) {
                attempt++;
                await locator.waitFor({ state: 'visible', timeout: 50000 });
                const box = await locator.boundingBox().catch(() => null);
                if (box) {
                    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
                    page.lastMouseX = box.x + box.width / 2;
                    page.lastMouseY = box.y + box.height / 2;
                    await page.waitForTimeout(randomDelay(200, 500));
                }
                await locator.click();
                await page.waitForTimeout(randomDelay(100, 300));
                for (let i = 0; i < text.length; i++) {
                    if (Math.random() < 0.05 && i > 2) {
                        await page.keyboard.type('x');
                        await page.waitForTimeout(randomDelay(100, 200));
                        await page.keyboard.press('Backspace');
                        await page.waitForTimeout(randomDelay(150, 300));
                    }
                    await page.keyboard.type(text[i]);
                    let typeDelay = randomDelay(80, 200);
                    if (Math.random() < 0.1) typeDelay += randomDelay(300, 800);
                    await page.waitForTimeout(typeDelay);
                }
                await page.waitForTimeout(randomDelay(200, 400));

                const actualValue = await locator.inputValue().catch(() => null);
                // 普通模式也用 normalizeText 比较，忽略 PayPal 自动添加的格式化字符
                if (actualValue !== null && normalizeText(actualValue) === normalizeText(text)) {
                    break;
                }
                if (attempt >= 5) {
                    console.warn(`⚠️ [校验] 普通字段 5 次重填后仍不一致，预期: "${text}"，实际: "${actualValue}"（normalized: "${normalizeText(actualValue)}"），继续后续流程`);
                    break;
                }
                console.log(`⚠️ [校验] 第${attempt}次填写不一致，预期: "${text}", 实际: "${actualValue}"，清空重填...`);
                await locator.click();
                await page.waitForTimeout(randomDelay(100, 200));
                await page.keyboard.press('Control+A');
                await page.waitForTimeout(randomDelay(80, 150));
                await page.keyboard.press('Delete');
                await page.waitForTimeout(randomDelay(200, 400));
            }
        }

        // --- Phase 3: Checkout Execution ---
        console.log("💳 [步骤] 打开 Stripe Hosted Checkout 页面...");
        await page.goto(paypalUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await recoverConnectionClosed(page, paypalUrl);

        const normalizeAmount = (raw) => {
            return String(raw || '')
                .replace(/\s+/g, '')
                .replace(/,/g, '')
                .toUpperCase();
        };
        const isZeroAmountText = (raw) => {
            const text = normalizeAmount(raw);
            // 支持多种货币符号: $ € £ ¥ 等
            // 匹配模式: 可选货币符号/代码 + 0 或 0.00
            const zeroPatterns = [
                /^[\$€£¥]?0(\.00)?$/,           // $0, €0.00, £0, ¥0.00 等
                /^(US\$?|USD|EUR|GBP|JPY|CNY)0(\.00)?$/i,  // US$0, USD0.00, EUR0 等
                /^0(\.00)?[\$€£¥]?$/,           // 0€, 0.00$ (货币符号在后)
                /^0(\.00)?\s*(US\$?|USD|EUR|GBP|JPY|CNY)?$/i  // 0 USD, 0.00 EUR
            ];
            return zeroPatterns.some(pattern => pattern.test(text));
        };
        const collectAmountTexts = async () => {
            return page.locator('.CurrencyAmount').allTextContents()
                .then((arr) => arr.map(v => String(v || '').trim()).filter(Boolean))
                .catch(() => []);
        };

        // 代理慢时 Stripe 会分段渲染，给足窗口并多次采样金额元素。
        const amountWaitTimeoutMs = 120000;
        const amountPollIntervalMs = 1500;
        const amountDeadline = Date.now() + amountWaitTimeoutMs;
        let latestAmountTexts = [];
        let hasZeroAmount = false;
        while (Date.now() < amountDeadline) {
            latestAmountTexts = await collectAmountTexts();
            if (latestAmountTexts.length > 0) {
                hasZeroAmount = latestAmountTexts.some(isZeroAmountText);
                if (hasZeroAmount) break;
            }
            await page.waitForTimeout(amountPollIntervalMs);
        }
        console.log(`💰 [步骤] 当前页面金额元素: ${latestAmountTexts.join(' | ') || '(空)'}`);
        if (!hasZeroAmount) {
            const displayAmount = latestAmountTexts[0] || 'unknown';
            throw new Error(`金额校验失败，当前金额不是 0 元: ${displayAmount}`);
        }
        console.log("✅ [步骤] 金额校验通过，确认是 0 元订单。");
        // Phase 3: 直奔核心 - 触发 PayPal 重定向
        // (静默) 直接触发 PayPal 重定向

        const triggerPayPal = async () => {
            const selectors = [
                '.AccordionItemCover.PaymentMethodFormAccordionItem.paypal-accordion-item-cover',
                '[data-testid="paypal-payment-method"]',
                'button:has-text("PayPal")',
                'div[role="radio"]:has-text("PayPal")'
            ];
            for (const sel of selectors) {
                const el = page.locator(sel).first();
                if (await el.isVisible().catch(() => false)) {
                    // (静默) 命中 PayPal 触发器选择器
                    await el.click({ force: true });
                    return true;
                }
            }
            return false;
        };

        // 尝试直接点击，如果不成功则刷新一次再点
        if (!await triggerPayPal()) {
            console.log("⏳ [步骤] 未能直接触发，正在刷新页面强制加载支付组件...");
            try {
                await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
                await recoverConnectionClosed(page, paypalUrl);
                if (!await triggerPayPal()) {
                    // 兜底：尝试直接寻找所有的 PayPal 文字并点击
                    await page.locator('text=PayPal').first().click({ force: true }).catch(() => { });
                    await page.waitForTimeout(1500);
                }
            } catch (_) {
                throw new Error("无法获取 PayPal 审批链接");
            }
        }

        // (静默) 已触发 PayPal 流程
        await page.waitForTimeout(2000);

        // 调试模式：PayPal 触发后暂停，等待用户手动操作
        if (debugMode) {
            console.log("\n🔧 [调试模式] PayPal 流程已触发，脚本暂停。");
            console.log("   当前 URL:", page.url());
            console.log("   按 Ctrl+C 退出，或在浏览器中手动操作...\n");
            // 无限等待，让用户手动调试
            await new Promise(() => {});
        }


        // 通用：等待元素可见，超时则刷新一次再等（避免 Stripe / PayPal 偶发空白）
        // 注意：reload 会清空已填字段，因此只用在「该阶段最早一个字段」上
        const waitVisibleWithReload = async (selector, {
            firstWaitMs = 30000,
            secondWaitMs = 30000,
            reloadGotoUrl = null,
        } = {}) => {
            const loc = page.locator(selector).first();
            try {
                await loc.waitFor({ state: 'visible', timeout: firstWaitMs });
                return true;
            } catch (_) {
                console.log(`🔄 [步骤] 元素 ${selector} ${firstWaitMs}ms 未渲染，刷新页面后重试...`);
                try {
                    if (reloadGotoUrl) {
                        await page.goto(reloadGotoUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
                    } else {
                        await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
                    }
                    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => { });
                } catch (e) {
                    console.warn(`⚠️ [步骤] 刷新失败: ${e.message}`);
                }
                await loc.waitFor({ state: 'visible', timeout: secondWaitMs });
                return true;
            }
        };

        // Phase 3C: 填写表单
        async function afterFieldTransition(page, fieldName) {
            if (Math.random() < 0.5) {
                const driftX = page.lastMouseX + randomDelay(-80, 80);
                const driftY = page.lastMouseY + randomDelay(30, 80);
                await page.mouse.move(Math.max(50, Math.min(1200, driftX)), Math.max(50, Math.min(750, driftY)), { steps: 12 });
                page.lastMouseX = driftX; page.lastMouseY = driftY;
            }
            await page.waitForTimeout(randomDelay(600, 2000));
            if (Math.random() < 0.2) {
                await page.mouse.wheel(0, randomDelay(-40, 60));
                await page.waitForTimeout(randomDelay(300, 700));
            }
        }
        let addressAutoFilled = false; // 地址下拉选中后跳过 zip/city 填写
        const fillAddress = async () => {
            console.log("📝 [步骤] 正在填写 Stripe 街道地址...");

            // 街道地址是 Stripe 表单的核心字段：30s 没出现则刷新一次再等 30s
            await waitVisibleWithReload('#billingAddressLine1', {
                firstWaitMs: 30000,
                secondWaitMs: 30000,
                reloadGotoUrl: paypalUrl,
            });

            await humanFillInput(page, page.locator('#billingAddressLine1'), CONFIG.billing.address);

            // ===== 优化后的地址自动补全处理逻辑 =====
            console.log("🔍 [地址] 开始智能地址自动补全检测...");

            // 动态等待策略：渐进式等待，避免过长等待
            const waitSteps = [500, 1000, 1500, 2000];
            let dropdownFound = false;
            let selectedAddress = null;

            // 优化的选择器列表（按成功率排序）
            const dropdownSelectors = [
                // Google Places API 高优先级选择器
                '.pac-container .pac-item:first-child',
                '.pac-container .pac-item',

                // ARIA 标准选择器
                '[role="listbox"] [role="option"]:first-child',
                '[role="option"]:first-child',
                '[role="option"]',

                // PayPal 和通用自动补全选择器
                '[data-testid*="address"] [role="option"]:first-child',
                '[class*="address"] [class*="option"]:first-child',
                '.AddressAutocomplete-option:first-child',
                '.AddressAutocomplete-option',
                '[data-testid="address-autocomplete-option"]:first-child',
                '[data-testid="address-autocomplete-option"]',

                // 备用选择器
                '.AddressAutocomplete li:first-child',
                '[class*="autocomplete"] li:first-child',
                '[class*="suggestion"]:first-child',
                '[class*="pac-item"]:first-child',
                '.dropdown-item:first-child',
                '.suggestion-item:first-child'
            ];

            // 渐进式检测策略
            for (let stepIndex = 0; stepIndex < waitSteps.length && !dropdownFound; stepIndex++) {
                await page.waitForTimeout(waitSteps[stepIndex]);
                console.log(`⏳ [地址] 第 ${stepIndex + 1} 阶段检测 (等待 ${waitSteps[stepIndex]}ms)...`);

                // 首先检查是否有下拉相关元素出现
                const hasDropdownElements = await page.locator('[class*="pac"], [class*="autocomplete"], [class*="suggestion"], [role="option"], [role="listbox"]').count() > 0;

                if (hasDropdownElements) {
                    console.log("🎯 [地址] 检测到下拉相关元素，开始精确匹配...");

                    for (const sel of dropdownSelectors) {
                        try {
                            const options = page.locator(sel);
                            const count = await options.count();

                            if (count > 0) {
                                const firstOption = options.first();
                                const visible = await firstOption.isVisible().catch(() => false);
                                const enabled = await firstOption.isEnabled().catch(() => false);

                                if (visible && enabled) {
                                    selectedAddress = await firstOption.textContent().catch(() => '');

                                    if (selectedAddress && selectedAddress.trim().length > 0) {
                                        console.log(`✅ [地址] 找到有效选项: "${selectedAddress.slice(0, 50)}..."`);
                                        console.log(`🎯 [地址] 使用选择器: ${sel}`);

                                        try {
                                            // 智能点击策略：先滚动到可见区域
                                            await firstOption.scrollIntoViewIfNeeded();
                                            await page.waitForTimeout(200);
                                            await firstOption.click({ timeout: 3000 });
                                            dropdownFound = true;
                                            addressAutoFilled = true;
                                            console.log("✅ [地址] 成功点击地址补全选项");
                                            break;
                                        } catch (clickError) {
                                            console.log(`⚠️ [地址] 标准点击失败，尝试备用方法: ${clickError.message}`);

                                            // 备用点击方法：使用坐标
                                            const boundingBox = await firstOption.boundingBox().catch(() => null);
                                            if (boundingBox) {
                                                try {
                                                    const centerX = boundingBox.x + boundingBox.width / 2;
                                                    const centerY = boundingBox.y + boundingBox.height / 2;
                                                    await page.mouse.click(centerX, centerY);
                                                    dropdownFound = true;
                                                    addressAutoFilled = true;
                                                    console.log("✅ [地址] 坐标点击成功");
                                                    break;
                                                } catch (coordError) {
                                                    // 最后尝试：键盘选择
                                                    try {
                                                        await page.keyboard.press('ArrowDown');
                                                        await page.waitForTimeout(200);
                                                        await page.keyboard.press('Enter');
                                                        dropdownFound = true;
                                                        addressAutoFilled = true;
                                                        console.log("✅ [地址] 键盘选择成功");
                                                        break;
                                                    } catch (keyError) {
                                                        console.log(`⚠️ [地址] 所有点击方法都失败: ${keyError.message}`);
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (_) { /* 继续尝试下一个 selector */ }
                    }
                } else {
                    console.log(`⏳ [地址] 第 ${stepIndex + 1} 阶段未检测到下拉元素，继续等待...`);
                }
            }

            // 处理自动补全结果
            if (dropdownFound && addressAutoFilled) {
                console.log("✅ [地址] 地址自动补全成功，等待字段填充...");
                await page.waitForTimeout(randomDelay(2000, 3000));

                // 验证和同步自动填充的数据
                console.log("🔍 [地址] 验证并同步自动填充的数据...");

                try {
                    // 检查城市字段（多选择器策略）
                    const citySelectors = ['#billingLocality', '[name="city"]', '[data-testid="city"]', 'input[placeholder*="city" i]'];
                    for (const citySelector of citySelectors) {
                        try {
                            const cityField = page.locator(citySelector).first();
                            const isVisible = await cityField.isVisible({ timeout: 1000 }).catch(() => false);
                            if (isVisible) {
                                const autoCity = await cityField.inputValue().catch(() => '');
                                if (autoCity && autoCity.trim()) {
                                    console.log(`📋 [地址] 检测到城市: "${autoCity}"`);
                                    if (autoCity !== CONFIG.billing.city) {
                                        console.log(`🔄 [地址] 城市数据同步: "${CONFIG.billing.city}" → "${autoCity}"`);
                                        CONFIG.billing.city = autoCity;
                                    }
                                    break;
                                }
                            }
                        } catch (_) { /* 继续尝试下一个选择器 */ }
                    }

                    // 检查州/省字段
                    const stateSelectors = ['#billingAdministrativeArea', '[name="state"]', '[data-testid="state"]', 'select[name*="state"]'];
                    for (const stateSelector of stateSelectors) {
                        try {
                            const stateField = page.locator(stateSelector).first();
                            const isVisible = await stateField.isVisible({ timeout: 1000 }).catch(() => false);
                            if (isVisible) {
                                const autoState = await stateField.inputValue().catch(() => '');
                                if (autoState && autoState.trim()) {
                                    console.log(`📋 [地址] 检测到州/省: "${autoState}"`);
                                    if (autoState !== CONFIG.billing.state) {
                                        console.log(`🔄 [地址] 州/省数据同步: "${CONFIG.billing.state}" → "${autoState}"`);
                                        CONFIG.billing.state = autoState;
                                    }
                                    break;
                                }
                            }
                        } catch (_) { /* 继续尝试下一个选择器 */ }
                    }

                    // 检查邮编字段
                    const zipSelectors = ['#billingPostalCode', '[name="zip"]', '[name="postal_code"]', '[data-testid="zip"]', 'input[placeholder*="zip" i]'];
                    for (const zipSelector of zipSelectors) {
                        try {
                            const zipField = page.locator(zipSelector).first();
                            const isVisible = await zipField.isVisible({ timeout: 1000 }).catch(() => false);
                            if (isVisible) {
                                const autoZip = await zipField.inputValue().catch(() => '');
                                if (autoZip && autoZip.trim()) {
                                    console.log(`📋 [地址] 检测到邮编: "${autoZip}"`);
                                    if (autoZip !== CONFIG.billing.zip) {
                                        console.log(`🔄 [地址] 邮编数据同步: "${CONFIG.billing.zip}" → "${autoZip}"`);
                                        CONFIG.billing.zip = autoZip;
                                    }
                                    break;
                                }
                            }
                        } catch (_) { /* 继续尝试下一个选择器 */ }
                    }

                    console.log(`📊 [地址] 当前配置: 城市="${CONFIG.billing.city}", 州="${CONFIG.billing.state}", 邮编="${CONFIG.billing.zip}"`);

                } catch (error) {
                    console.log(`⚠️ [地址] 验证自动填充数据时出错: ${error.message}`);
                }
            } else {
                console.log("⚠️ [地址] 未找到地址自动补全下拉框，执行失焦处理");

                // 优化的失焦处理：点击安全区域
                const safeX = randomDelay(800, 1100);
                const safeY = randomDelay(30, 80);
                await page.mouse.move(safeX, safeY, { steps: 20 });
                page.lastMouseX = safeX; page.lastMouseY = safeY;
                await page.waitForTimeout(randomDelay(100, 300));
                await page.mouse.down();
                await page.waitForTimeout(randomDelay(50, 100));
                await page.mouse.up();
                await page.waitForTimeout(randomDelay(300, 600));
            }

            await page.waitForTimeout(2000);
            // ===== 优化后的地址自动补全处理逻辑结束 =====

            // 验证地址是否真正填写成功
            console.log("🔍 [地址] 验证街道地址填写结果...");
            const addressInput = page.locator('#billingAddressLine1').first();
            let addressValue = '';

            try {
                addressValue = await addressInput.inputValue().catch(() => '');

                if (!addressValue || addressValue.trim().length === 0) {
                    console.log("❌ [地址] 街道地址填写失败，输入框为空");
                    throw new Error("街道地址填写失败");
                }

                console.log(`✅ [地址] 街道地址填写成功: "${addressValue}"`);

                // 如果没有选择下拉选项，检查是否需要手动触发地址验证
                if (!dropdownFound) {
                    console.log("⚠️ [地址] 未选择地址下拉选项，可能需要手动验证");
                }

            } catch (error) {
                console.log(`❌ [地址] 验证地址填写时出错: ${error.message}`);
                throw error;
            }

            console.log("✅ [步骤] 街道地址填写完成。");
            await afterFieldTransition(page, 'address');
        };
        const fillName = async () => {
            console.log("📝 [步骤] 正在检查 Stripe 账单姓名字段...");
            const nameInput = page.locator('#billingName').first();

            try {
                // 修复1: 使用更兼容的方式检查元素存在性
                console.log("🔍 [修复] 检查元素是否存在...");
                try {
                    await nameInput.waitFor({ state: 'attached', timeout: 2000 });
                    console.log("✅ [修复] 元素存在");
                } catch (error) {
                    console.log("⏩ [姓名] 姓名字段不存在，跳过填写");
                    return;
                }

                // 修复2: 使用更兼容的方式检查元素可见性
                console.log("🔍 [修复] 检查元素是否可见...");
                try {
                    await nameInput.waitFor({ state: 'visible', timeout: 2000 });
                    console.log("✅ [修复] 元素可见");
                } catch (error) {
                    console.log("⏩ [姓名] 姓名字段不可见，跳过填写");
                    return;
                }

                console.log("📝 [姓名] 姓名字段存在且可见，开始填写...");

                // 修复3: 使用更稳定的填写方法
                let fillSuccess = false;
                let attempt = 0;
                const maxAttempts = 3;

                while (!fillSuccess && attempt < maxAttempts) {
                    attempt++;
                    console.log(`🔍 [修复] 第${attempt}次填写尝试...`);

                    try {
                        // 确保元素可见并获得焦点
                        await nameInput.waitFor({ state: 'visible', timeout: 5000 });

                        // 点击元素
                        await nameInput.click();
                        await page.waitForTimeout(randomDelay(100, 200));

                        // 清空现有内容
                        await page.keyboard.press('Control+A');
                        await page.waitForTimeout(50);
                        await page.keyboard.press('Delete');
                        await page.waitForTimeout(100);

                        // 使用 humanFillInput 或直接输入
                        if (attempt === 1) {
                            // 第一次尝试使用原始方法
                            await humanFillInput(page, nameInput, CONFIG.billing.name);
                        } else {
                            // 后续尝试使用更直接的方法
                            await page.keyboard.type(CONFIG.billing.name, { delay: randomDelay(50, 100) });
                            await page.waitForTimeout(200);

                            // 触发事件
                            await nameInput.evaluate((node, value) => {
                                node.value = value;
                                node.dispatchEvent(new Event('input', { bubbles: true }));
                                node.dispatchEvent(new Event('change', { bubbles: true }));
                                node.dispatchEvent(new Event('blur', { bubbles: true }));
                            }, CONFIG.billing.name);
                        }

                        await page.waitForTimeout(300);

                        // 验证结果
                        const nameValue = await nameInput.inputValue().catch(() => '');

                        if (nameValue === CONFIG.billing.name) {
                            console.log(`✅ [姓名] 第${attempt}次尝试成功: "${nameValue}"`);
                            fillSuccess = true;
                        } else {
                            console.log(`⚠️ [姓名] 第${attempt}次尝试值不匹配: 预期="${CONFIG.billing.name}", 实际="${nameValue}"`);
                        }

                    } catch (error) {
                        console.log(`❌ [姓名] 第${attempt}次尝试出错: ${error.message}`);
                    }
                }

                if (!fillSuccess) {
                    console.log("❌ [姓名] 所有填写尝试都失败了");
                    // 最后一次备用尝试
                    try {
                        await nameInput.fill(CONFIG.billing.name);
                        await nameInput.evaluate((node, value) => {
                            node.value = value;
                            node.dispatchEvent(new Event('input', { bubbles: true }));
                            node.dispatchEvent(new Event('change', { bubbles: true }));
                        }, CONFIG.billing.name);

                        const finalValue = await nameInput.inputValue();
                        if (finalValue === CONFIG.billing.name) {
                            console.log(`✅ [姓名] 备用方法成功: "${finalValue}"`);
                            fillSuccess = true;
                        }
                    } catch (error) {
                        console.log(`❌ [姓名] 备用方法也失败了: ${error.message}`);
                    }
                }

                if (fillSuccess) {
                    console.log("✅ [步骤] 姓名填写完成。");
                    await afterFieldTransition(page, 'name');
                } else {
                    console.log("⚠️ [姓名] 姓名填写未完全成功，但继续后续流程");
                }

            } catch (error) {
                console.log(`❌ [姓名] 填写姓名时出错: ${error.message}`);
                console.log("⏩ [姓名] 跳过姓名填写，继续后续流程");
                // 不再抛出错误，而是优雅地跳过
            }
        };
        const fillZipAndCity = async () => {
            if (addressAutoFilled) {
                console.log("⏩ [步骤] 地址已由下拉自动填充，跳过邮编与城市。");
                return;
            }
            console.log("📝 [步骤] 正在等待邮编与城市字段出现...");

            // 等待地址1填写后，其他字段动态出现
            const zipLoc = page.locator('#billingPostalCode').first();
            const cityLoc = page.locator('#billingLocality').first();

            // 先等待至少一个字段出现（最多等 15 秒）
            let fieldsAppeared = false;
            const deadline = Date.now() + 15000;

            while (Date.now() < deadline && !fieldsAppeared) {
                const zipVisible = await zipLoc.isVisible({ timeout: 1000 }).catch(() => false);
                const cityVisible = await cityLoc.isVisible({ timeout: 1000 }).catch(() => false);

                if (zipVisible || cityVisible) {
                    fieldsAppeared = true;
                    console.log("✅ [步骤] 邮编/城市字段已出现，开始填写...");
                    break;
                }

                console.log("⏳ [步骤] 等待邮编/城市字段出现...");
                await page.waitForTimeout(1000);
            }

            if (!fieldsAppeared) {
                console.log("⏩ [步骤] 等待超时，当前 Stripe 表单可能无邮编/城市字段，跳过。");
                return;
            }

            // 重新检查字段可见性
            const zipVisible = await zipLoc.isVisible({ timeout: 2000 }).catch(() => false);
            const cityVisible = await cityLoc.isVisible({ timeout: 2000 }).catch(() => false);

            if (Math.random() > 0.5) {
                if (zipVisible) {
                    await humanFillInput(page, zipLoc, CONFIG.billing.zip);
                    await afterFieldTransition(page, 'zip');
                }
                if (cityVisible) {
                    await humanFillInput(page, cityLoc, CONFIG.billing.city);
                }
            } else {
                if (cityVisible) {
                    await humanFillInput(page, cityLoc, CONFIG.billing.city);
                    await afterFieldTransition(page, 'city');
                }
                if (zipVisible) {
                    await humanFillInput(page, zipLoc, CONFIG.billing.zip);
                }
            }
            console.log("✅ [步骤] 邮编与城市填写完成。");
            await afterFieldTransition(page, 'zipCity');
        };
        const fillOrders = [
            [fillAddress, fillName, fillZipAndCity],
            [fillName, fillAddress, fillZipAndCity],
            [fillAddress, fillZipAndCity, fillName],
        ];
        const chosenOrder = fillOrders[Math.floor(Math.random() * fillOrders.length)];
        // (静默) 拟人填写顺序
        for (const fillFn of chosenOrder) {
            await fillFn();
            if (Math.random() < 0.3) {
                // (静默) 鼠标漫游
                await continuousHumanRoam(page, randomDelay(1000, 2000));
            }
        }

        // Phase 3D: 勾选协议
        // (静默) 检查已填内容
        await page.waitForTimeout(randomDelay(1000, 2500));
        if (Math.random() < 0.3) {
            await page.mouse.wheel(0, randomDelay(-100, -40));
            await page.waitForTimeout(randomDelay(800, 1500));
            await page.mouse.wheel(0, randomDelay(60, 120));
            await page.waitForTimeout(randomDelay(500, 1000));
        }
        // Stripe 现在多了一个 "Save my payment information" 复选框，原 .Checkbox-Input 会同时匹配两个，触发 strict mode 违规
        let checkbox = page.locator('#termsOfServiceConsentCheckbox').first();
        if (!(await checkbox.isVisible().catch(() => false))) {
            checkbox = page.locator('.Checkbox-Input').last();
            if (!(await checkbox.isVisible().catch(() => false))) {
                checkbox = page.locator('.Checkbox-Input').first();
            }
        }
        const cbBox = await checkbox.boundingBox().catch(() => null);
        if (cbBox) {
            const cbClickX = cbBox.x + randomDelay(3, 15);
            const cbClickY = cbBox.y + randomDelay(3, 15);
            await page.mouse.move(cbClickX, cbClickY, { steps: randomDelay(20, 35) });
            page.lastMouseX = cbClickX; page.lastMouseY = cbClickY;
            await page.waitForTimeout(randomDelay(300, 700));
            await page.mouse.down();
            await page.waitForTimeout(randomDelay(50, 120));
            await page.mouse.up();
            console.log("✅ [步骤] 协议勾选完成。");
        }
        await page.waitForTimeout(randomDelay(600, 1500));

        // Phase 3E: 提交按钮 —— 极致拟人化点击
        // (静默) 提交前漫游
        await continuousHumanRoam(page, randomDelay(1500, 3000));
        await mouseBreathing(page, randomDelay(500, 1000));
        console.log("⏳ [步骤] 正在准备提交 Stripe Checkout...");

        // === 智能提交按钮检测策略 ===
        const submitButtonSelectors = [
            '.SubmitButton-IconContainer',
            '.SubmitButton',
            '[data-testid="hosted-payment-submit-button"]',
            'button[type="submit"]',
            '.PayButton',
            '.submit-button',
            'button:has-text("Pay")',
            'button:has-text("Complete")',
            'button:has-text("Submit")',
            '[class*="submit"][class*="button"]',
            '[class*="pay"][class*="button"]'
        ];

        let button = null;
        let buttonSelector = null;

        // 尝试找到可用的提交按钮
        for (const selector of submitButtonSelectors) {
            try {
                const candidateButton = page.locator(selector).first();
                const isVisible = await candidateButton.isVisible({ timeout: 2000 }).catch(() => false);

                if (isVisible) {
                    // 检查按钮是否可点击（不是禁用状态）
                    const isEnabled = await candidateButton.isEnabled().catch(() => false);
                    const hasDisabledAttr = await candidateButton.getAttribute('disabled').catch(() => null);
                    const hasAriaDisabled = await candidateButton.getAttribute('aria-disabled').catch(() => null);

                    const isClickable = isEnabled && !hasDisabledAttr && hasAriaDisabled !== 'true';

                    if (isClickable) {
                        button = candidateButton;
                        buttonSelector = selector;
                        console.log(`✅ [按钮] 找到可用提交按钮: ${selector}`);
                        break;
                    } else {
                        console.log(`⚠️ [按钮] 按钮不可点击: ${selector} (enabled: ${isEnabled}, disabled: ${hasDisabledAttr}, aria-disabled: ${hasAriaDisabled})`);
                    }
                }
            } catch (e) {
                // 继续尝试下一个选择器
                continue;
            }
        }

        // 如果没找到按钮，尝试刷新页面
        if (!button) {
            console.log('🔄 [步骤] 未找到可用提交按钮，刷新页面后重试...');
            try {
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => { });

                // 刷新后再次尝试
                for (const selector of submitButtonSelectors) {
                    try {
                        const candidateButton = page.locator(selector).first();
                        const isVisible = await candidateButton.isVisible({ timeout: 5000 }).catch(() => false);

                        if (isVisible) {
                            const isEnabled = await candidateButton.isEnabled().catch(() => false);
                            const hasDisabledAttr = await candidateButton.getAttribute('disabled').catch(() => null);
                            const hasAriaDisabled = await candidateButton.getAttribute('aria-disabled').catch(() => null);

                            const isClickable = isEnabled && !hasDisabledAttr && hasAriaDisabled !== 'true';

                            if (isClickable) {
                                button = candidateButton;
                                buttonSelector = selector;
                                console.log(`✅ [按钮] 刷新后找到提交按钮: ${selector}`);
                                break;
                            }
                        }
                    } catch (e) {
                        continue;
                    }
                }
            } catch (e) {
                console.warn(`⚠️ [步骤] 刷新失败: ${e.message}`);
            }
        }

        if (!button) {
            throw new Error('无法找到可用的提交按钮');
        }

        const box = await button.boundingBox();

        if (box) {
            const btnCenterX = box.x + box.width / 2;
            const btnCenterY = box.y + box.height / 2;

            // === Step 1: 视线先移到按钮上方区域（不是精准瞄准，像在看页面下方）
            const glanceX = box.x + randomDelay(-60, box.width + 60);
            const glanceY = box.y - randomDelay(60, 140);
            await page.mouse.move(glanceX, glanceY, { steps: randomDelay(25, 40) });
            page.lastMouseX = glanceX; page.lastMouseY = glanceY;
            await page.waitForTimeout(randomDelay(600, 1400)); // 像在"读"按钮上方的文字

            // === Step 2: 鼠标慢慢滑向按钮（弧形移动，经过按钮左侧）
            const midX = box.x - randomDelay(10, 50); // 从左边弧线进入
            const midY = box.y + randomDelay(5, box.height - 5);
            await page.mouse.move(midX, midY, { steps: randomDelay(15, 25) });
            page.lastMouseX = midX; page.lastMouseY = midY;
            await page.waitForTimeout(randomDelay(200, 500));

            // === Step 3: 最终定位到按钮上（轻微偏离中心，真人不会精准点中心）
            const clickX = btnCenterX + randomDelay(-Math.floor(box.width * 0.3), Math.floor(box.width * 0.3));
            const clickY = btnCenterY + randomDelay(-Math.floor(box.height * 0.3), Math.floor(box.height * 0.3));
            await page.mouse.move(clickX, clickY, { steps: randomDelay(10, 18) });
            page.lastMouseX = clickX; page.lastMouseY = clickY;

            // === Step 4: 悬停在按钮上，停顿（犹豫感，真人会停一下再点）
            await page.waitForTimeout(randomDelay(400, 1000));

            // === Step 5: 25% 概率"反悔一下" —— 鼠标溜走再回来
            if (Math.random() < 0.25) {
                // (静默) 犹豫模拟
                const wanderX = clickX + randomDelay(-80, 80);
                const wanderY = clickY + randomDelay(20, 80);
                await page.mouse.move(wanderX, wanderY, { steps: 12 });
                await page.waitForTimeout(randomDelay(500, 1200));
                // 再移回来
                await page.mouse.move(
                    btnCenterX + randomDelay(-10, 10),
                    btnCenterY + randomDelay(-5, 5),
                    { steps: 15 }
                );
                await page.waitForTimeout(randomDelay(200, 500));
            }

            // === Stripe 提交前完整性效验 (增强版) ===
            const validateStripeCompleteness = async (page) => {
                console.log("🔍 [验证] 开始 Stripe 表单完整性检查...");

                // 扩展的字段验证列表
                const criticalSelectors = [
                    { sel: '#billingName', name: "姓名", configKey: 'name', required: true },
                    { sel: '#billingAddressLine1', name: "街道地址", configKey: 'address', required: true },
                    { sel: '#billingAddressCity', name: "城市", configKey: 'city', required: true },
                    { sel: '#billingAddressState', name: "州/省", configKey: 'state', required: true },
                    { sel: '#billingPostalCode', name: "邮编", configKey: 'zip', required: true },
                    // 可选字段
                    { sel: '#billingAddressLine2', name: "地址2", configKey: 'address2', required: false },
                    { sel: '#billingCountry', name: "国家", configKey: 'country', required: false }
                ];

                // 信用卡字段检查
                const cardSelectors = [
                    { sel: '#cardNumber', name: "卡号", required: true },
                    { sel: '#cardExpiry', name: "有效期", required: true },
                    { sel: '#cardCvc', name: "CVC", required: true }
                ];

                let refilledCount = 0;
                let syncedCount = 0;
                let errorCount = 0;

                // 检查账单地址字段
                for (const item of criticalSelectors) {
                    try {
                        const el = page.locator(item.sel);
                        const isVisible = await el.isVisible().catch(() => false);

                        if (isVisible) {
                            const currentValue = await el.inputValue().catch(() => "");
                            const configValue = CONFIG.billing[item.configKey] || "";

                            // 1. 检查必填字段是否为空
                            if (item.required && (!currentValue || currentValue.trim().length < 1)) {
                                if (configValue) {
                                    console.warn(`⚠️ [验证] ${item.name} 为空，补填配置值...`);
                                    await humanFillInput(page, el, configValue);
                                    await page.waitForTimeout(300);
                                    refilledCount++;
                                } else {
                                    console.error(`❌ [验证] ${item.name} 为空且无配置值`);
                                    errorCount++;
                                }
                            }
                            // 2. 同步自动填充的值到配置
                            else if (currentValue && currentValue !== configValue && currentValue.trim().length > 0) {
                                console.log(`🔄 [验证] ${item.name} 自动填充值同步: "${configValue}" → "${currentValue}"`);
                                CONFIG.billing[item.configKey] = currentValue;
                                syncedCount++;
                            }
                            // 3. 检查字段是否有错误状态
                            const hasError = await el.evaluate(el => {
                                return el.classList.contains('error') ||
                                       el.classList.contains('invalid') ||
                                       el.getAttribute('aria-invalid') === 'true' ||
                                       el.closest('.error') !== null ||
                                       el.closest('.invalid') !== null;
                            }).catch(() => false);

                            if (hasError) {
                                console.warn(`⚠️ [验证] ${item.name} 字段显示错误状态`);
                                errorCount++;
                            }
                        } else if (item.required) {
                            // 对于地址相关字段，检查是否有值（即使不可见）
                            if (['city', 'state', 'zip'].includes(item.configKey)) {
                                try {
                                    const hasValue = await page.evaluate((selector) => {
                                        const el = document.querySelector(selector);
                                        return el && (el.value || el.textContent || '').trim().length > 0;
                                    }, item.sel);

                                    if (hasValue) {
                                        // 获取隐藏字段的实际值并同步到配置
                                        const actualValue = await page.evaluate((selector) => {
                                            const el = document.querySelector(selector);
                                            return el ? (el.value || el.textContent || '').trim() : '';
                                        }, item.sel);

                                        const configValue = CONFIG.billing[item.configKey] || "";

                                        if (actualValue && actualValue !== configValue) {
                                            console.log(`✅ [验证] ${item.name} 字段已自动填充 (隐藏状态): "${actualValue}"`);
                                            console.log(`🔄 [同步] ${item.name} 配置更新: "${configValue}" → "${actualValue}"`);
                                            CONFIG.billing[item.configKey] = actualValue;
                                            syncedCount++;
                                        } else {
                                            console.log(`✅ [验证] ${item.name} 字段已自动填充 (隐藏状态): "${actualValue}"`);
                                        }
                                    } else {
                                        console.warn(`⚠️ [验证] 必填字段 ${item.name} 不可见且无值`);
                                    }
                                } catch (e) {
                                    console.warn(`⚠️ [验证] 必填字段 ${item.name} 不可见`);
                                }
                            } else {
                                console.warn(`⚠️ [验证] 必填字段 ${item.name} 不可见`);
                            }
                        }
                    } catch (e) {
                        console.error(`❌ [验证] 检查 ${item.name} 时出错: ${e.message}`);
                        errorCount++;
                    }
                }

                // 检查信用卡字段
                for (const item of cardSelectors) {
                    try {
                        const el = page.locator(item.sel);
                        const isVisible = await el.isVisible().catch(() => false);

                        if (isVisible) {
                            const currentValue = await el.inputValue().catch(() => "");

                            if (!currentValue || currentValue.trim().length < 1) {
                                console.error(`❌ [验证] ${item.name} 为空`);
                                errorCount++;
                            }

                            // 检查字段错误状态
                            const hasError = await el.evaluate(el => {
                                return el.classList.contains('error') ||
                                       el.classList.contains('invalid') ||
                                       el.getAttribute('aria-invalid') === 'true' ||
                                       el.closest('.error') !== null ||
                                       el.closest('.invalid') !== null;
                            }).catch(() => false);

                            if (hasError) {
                                console.warn(`⚠️ [验证] ${item.name} 字段显示错误状态`);
                                errorCount++;
                            }
                        }
                    } catch (e) {
                        console.error(`❌ [验证] 检查 ${item.name} 时出错: ${e.message}`);
                        errorCount++;
                    }
                }

                // 检查页面是否有全局错误提示
                const globalErrorSelectors = [
                    '.error-message',
                    '.alert-error',
                    '[role="alert"]',
                    '.validation-error',
                    '.field-error',
                    '[class*="error"][class*="message"]'
                ];

                for (const selector of globalErrorSelectors) {
                    try {
                        const errorElements = page.locator(selector);
                        const count = await errorElements.count();

                        if (count > 0) {
                            for (let i = 0; i < count; i++) {
                                const errorText = await errorElements.nth(i).textContent().catch(() => "");
                                if (errorText && errorText.trim()) {
                                    console.warn(`⚠️ [验证] 发现错误提示: "${errorText.trim()}"`);
                                    errorCount++;
                                }
                            }
                        }
                    } catch (e) {
                        // 忽略选择器错误
                    }
                }

                // 输出验证结果
                if (errorCount > 0) {
                    console.error(`❌ [验证] 表单验证失败，发现 ${errorCount} 个问题`);
                    throw new Error(`表单验证失败，发现 ${errorCount} 个问题`);
                } else if (refilledCount === 0 && syncedCount === 0) {
                    console.log(`✅ [验证] Stripe 表单完整性检查通过`);
                } else {
                    console.log(`✅ [验证] Stripe 表单处理完成 (补填: ${refilledCount}, 同步: ${syncedCount})`);
                }

                return { refilledCount, syncedCount, errorCount };
            };

            await validateStripeCompleteness(page);

            // === 提交前最终安全检查 ===
            console.log("🔒 [安全] 执行提交前最终检查...");

            // 1. 再次确认按钮状态
            const isStillVisible = await button.isVisible().catch(() => false);
            const isStillEnabled = await button.isEnabled().catch(() => false);
            const hasDisabledAttr = await button.getAttribute('disabled').catch(() => null);
            const hasAriaDisabled = await button.getAttribute('aria-disabled').catch(() => null);

            const isClickable = isStillVisible && isStillEnabled && !hasDisabledAttr && hasAriaDisabled !== 'true';

            if (!isClickable) {
                console.error(`❌ [安全] 按钮状态异常: visible=${isStillVisible}, enabled=${isStillEnabled}, disabled=${hasDisabledAttr}, aria-disabled=${hasAriaDisabled}`);
                throw new Error('提交按钮不可点击');
            }

            // 2. 检查是否有阻塞性错误弹窗
            const blockingSelectors = [
                '.modal[style*="block"]',
                '.popup[style*="block"]',
                '[role="dialog"][style*="block"]',
                '.overlay:visible',
                '.loading:visible'
            ];

            for (const selector of blockingSelectors) {
                try {
                    const blockingElement = page.locator(selector);
                    const isBlocking = await blockingElement.isVisible().catch(() => false);
                    if (isBlocking) {
                        console.warn(`⚠️ [安全] 发现阻塞元素: ${selector}`);
                        // 等待阻塞元素消失
                        await blockingElement.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
                    }
                } catch (e) {
                    // 忽略选择器错误
                }
            }

            // 3. 确保按钮仍在可见区域
            const finalBox = await button.boundingBox();
            if (!finalBox) {
                throw new Error('无法获取按钮位置信息');
            }

            console.log(`✅ [安全] 最终检查通过，准备点击按钮 (${buttonSelector})`);

            // === Step 6: 真实按压（mousedown -> 停留 80-180ms -> mouseup）
            // 真人点击按钮的按压时长约 80-200ms，不长按不瞬释放
            await page.mouse.down();
            // (静默) 提交按钮按压
            await page.waitForTimeout(randomDelay(80, 180));
            await page.mouse.up();
            console.log("🖱️ [步骤] 提交按钮已点击");

            // 点完之后鼠标轻微抖动（手指离开后的自然余震）
            await page.mouse.move(
                clickX + randomDelay(-3, 3),
                clickY + randomDelay(-3, 3),
                { steps: 3 }
            );
        }

        // (静默) Stripe Checkout 已提交，等待 PayPal 跳转

        // 🔑 HAR 关键发现: human_security_submit_await_time = 6013ms
        // HumanSecurity (PerimeterX) 要求提交后至少等待 6 秒才算人类行为
        // 这段时间内保持鼠标轻微颤动（模拟真人盯着页面等待跳转）
        console.log("⏳ [风控] Stripe 提交后等待 HumanSecurity 6-8 秒...");
        await mouseBreathing(page, randomDelay(6000, 8000));
        // Phase 4: PayPal 账户创建
        // 先等页面加载，刷新一次确保 PayPal 页面干净，再检查滑块
        console.log("⏳ [步骤] 等待跳转到 PayPal 页面...");
        await page.waitForLoadState('domcontentloaded', { timeout: 30000 }).catch(() => { });
        await solveSlider(); // PayPal 页面的滑块检查
        await checkCriticalErrors();
        await ensurePayPalEnglishLanguage();
        console.log("⏳ [步骤] 正在等待 PayPal 创建账户按钮出现...");
        // PayPal 偶发只渲染静态欢迎页（"PayPal is the safer, easier way to pay" + 购物袋盾牌图），
        // 此时按钮永远不出现。多刷新几次给 PayPal 重新拉账户表单的机会。
        const tryWaitCreateBtn = async (timeoutMs = 15000) => {
            try {
                await page.getByRole('button', { name: 'Create an Account' }).waitFor({ state: 'visible', timeout: timeoutMs });
                return true;
            } catch (_) { return false; }
        };
        let createBtnReady = await tryWaitCreateBtn(15000);
        let refreshAttempts = 0;
        while (!createBtnReady && refreshAttempts < 2) {
            refreshAttempts += 1;
            console.log(`🔄 [步骤] 未渲染 Create an Account（第 ${refreshAttempts}/2 次刷新 PayPal 页面...）`);
            try {
                await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
                await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => { });
            } catch (e) {
                console.warn(`⚠️ [步骤] 刷新失败: ${e.message}`);
            }
            await solveSlider(); // 如果是 recaptcha_image 错误会向上抛出
            await ensurePayPalEnglishLanguage();
            createBtnReady = await tryWaitCreateBtn(15000);
        }
        if (!createBtnReady) {
            await debug.saveOnError(page, 'paypal_create_btn_missing');
            const currentUrl = page.url();
            if (currentUrl.includes('paypal.com/agreements/approve')) {
                throw new Error(`PayPal 审批页卡住：长时间停留在 agreements/approve，未出现 Create an Account (URL: ${currentUrl})`);
            }
            throw new Error(`PayPal 未渲染创建账户表单（已刷新 ${refreshAttempts} 次仍只见欢迎页, URL=${currentUrl}）`);
        }


        // 🧠 看到按钮后不急着点，先停顿一下（像真人一样先确认页面内容）
        await page.waitForTimeout(randomDelay(1500, 3000));
        const createBtn = page.getByRole('button', { name: 'Create an Account' });
        await createBtn.click();

        // 等邮箱输入框出现
        console.log("📝 [步骤] 正在填写 PayPal 登录邮箱...");
        await page.waitForTimeout(randomDelay(1000, 2000));
        // PayPal 邮箱使用 fill 模式，避免逐字符输入触发格式化/风控抖动
        try {
            const emailSelectors = [
                'input#email',
                'input[name="login_email"]',
                'input[type="email"]',
                'input[name*="email" i]',
                'input[placeholder*="Email" i]'
            ];
            const deadline = Date.now() + 10000;
            let emailInput = null;
            while (!emailInput && Date.now() < deadline) {
                for (const selector of emailSelectors) {
                    const matches = page.locator(selector);
                    const count = await matches.count().catch(() => 0);
                    for (let i = 0; i < count; i++) {
                        const candidate = matches.nth(i);
                        if (await candidate.isVisible().catch(() => false)) {
                            emailInput = candidate;
                            break;
                        }
                    }
                    if (emailInput) break;
                }
                if (!emailInput) await page.waitForTimeout(250);
            }
            if (!emailInput) {
                throw new Error(`未找到可见邮箱输入框，selectors=${emailSelectors.join(', ')}`);
            }
            await humanFillInput(page, emailInput, CONFIG.billing.email, false, true);
        } catch (e) {
            await debug.saveOnError(page, 'paypal_email_input');
            throw new Error(`PayPal 邮箱输入框定位失败: ${e.message}`);
        }
        await page.waitForTimeout(randomDelay(500, 1200));

        const continueBtn = page.getByRole('button', { name: 'Continue to Payment' });
        try {
            await continueBtn.waitFor({ state: 'visible', timeout: 15000 });
        } catch (e) {
            await debug.saveOnError(page, 'paypal_continue_btn');
            throw new Error(`PayPal Continue 按钮未出现: ${e.message}`);
        }
        await page.waitForTimeout(randomDelay(800, 1500));
        await continueBtn.click({ force: true });
        console.log("✅ [步骤] 已提交邮箱，进入支付信息填写页。");

        // 🧠 等页面渲染完成再开始填表，像真人看到新页面后先扫一眼
        await page.waitForTimeout(randomDelay(2000, 3500));

        // PayPal 在「卡号」之前可能下发滑块挑战（#captcha__frame__bottom > .sliderContainer > .slider）
        // 等 #cardNumber 之前先尝试解一次；如果还看不到，则继续轮询滑块直到解开或超时
        console.log("⏳ [步骤] 等待支付表单渲染（如有滑块将自动处理）...");
        const cardLocator = page.locator('#cardNumber');
        const cardWaitDeadline = Date.now() + 90_000;
        let cardReady = false;
        while (Date.now() < cardWaitDeadline) {
            try {
                if (await cardLocator.isVisible({ timeout: 800 })) { cardReady = true; break; }
            } catch (_) { }
            const solved = await solveSlider();
            if (solved) {
                await page.waitForTimeout(randomDelay(1500, 2500));
                continue;
            }
            await page.waitForTimeout(800);
        }
        if (!cardReady) {
            // 兜底：再尝试一次显式 waitFor，让原始报错也能被父进程捕捉
            try {
                await cardLocator.waitFor({ state: 'visible', timeout: 5000 });
            } catch (e) {
                await debug.saveOnError(page, 'paypal_card_input');
                throw new Error(`PayPal 卡号输入框未出现: ${e.message}`);
            }
        }

        console.log("📝 [步骤] 正在填写账单信息（模拟手动输入）...");
        await page.mouse.move(randomDelay(300, 700), randomDelay(200, 400), { steps: 15 });
        await page.waitForTimeout(randomDelay(400, 800));

        const billing = CONFIG.billing;
        const [first, last] = billing.name.split(' ');

        // PayPal 字段使用手动输入模式，模拟真人逐字符输入
        // 字段间停 500~1000ms，接近真人填表节奏
        const paypalFieldOrder = Math.random() > 0.5 ? 'card_first' : 'name_first';

        const fillExpiryAndCvc = async () => {
            // 有效期 + CVC：逐字符输入
            await page.keyboard.press('Tab');
            await page.waitForTimeout(randomDelay(200, 400));
            await page.keyboard.type(billing.expiry, { delay: randomDelay(80, 150) });
            await page.waitForTimeout(randomDelay(300, 600));
            await page.keyboard.press('Tab');
            await page.waitForTimeout(randomDelay(200, 400));
            await page.keyboard.type(billing.cvc, { delay: randomDelay(80, 150) });
            await page.waitForTimeout(randomDelay(400, 800));
        };

        if (paypalFieldOrder === 'card_first') {
            await humanFillInput(page, page.locator('#cardNumber'), billing.card, true, false);
            await page.waitForTimeout(randomDelay(400, 800));
            await fillExpiryAndCvc();
            await humanFillInput(page, page.locator('#firstName'), first || '', false, false);
            await page.waitForTimeout(randomDelay(400, 800));
            await humanFillInput(page, page.locator('#lastName'), last || '', false, false);
        } else {
            await humanFillInput(page, page.locator('#firstName'), first || '', false, false);
            await page.waitForTimeout(randomDelay(400, 800));
            await humanFillInput(page, page.locator('#lastName'), last || '', false, false);
            await page.waitForTimeout(randomDelay(400, 800));
            await humanFillInput(page, page.locator('#cardNumber'), billing.card, true, false);
            await page.waitForTimeout(randomDelay(400, 800));
            await fillExpiryAndCvc();
        }
        await page.waitForTimeout(randomDelay(500, 1000));

        // Email + Phone
        const emailField = page.locator('#email');
        if (await emailField.isVisible().catch(() => false)) {
            await humanFillInput(page, emailField, billing.email, false, true);
            await page.waitForTimeout(randomDelay(400, 800));
        }
        const phoneField = page.locator('#phone');
        if (await phoneField.isVisible().catch(() => false)) {
            await humanFillInput(page, phoneField, billing.smsPhone, true, false);
            await page.waitForTimeout(randomDelay(400, 800));
        }
        console.log("✅ [步骤] 银行卡与身份信息填写完成。");

        // 地址（带下拉处理）
        console.log("✍️ [步骤] 正在输入地址并处理联想...");
        const billingLine1 = page.locator('#billingLine1');
        if (await billingLine1.isVisible().catch(() => false)) {
            await humanFillInput(page, billingLine1, billing.address, false, false);
            await page.waitForTimeout(randomDelay(700, 1300));
            const addrOption = page.locator('[class*="suggestion"],[class*="autocomplete"] li,.AddressAutocomplete-option').first();
            if (await addrOption.isVisible().catch(() => false)) {
                await page.keyboard.press('ArrowDown');
                await page.waitForTimeout(randomDelay(150, 300));
                await page.keyboard.press('Enter');
                console.log("✅ [步骤] 地址联想已选择（PayPal 会自动填 City/State/ZIP）");
            } else {
                await page.keyboard.press('Tab');
            }
            await page.waitForTimeout(randomDelay(300, 700));
        }

        // 显式等待 PayPal 把 City/State/ZIP 这三个字段渲染出来（最多 8 秒）
        // PayPal 的 AddressAutocompleteContainer 是 React 异步加载，不等就 isVisible 会假性返回 false
        try {
            await page.locator('#billingPostalCode, #billingCity, #billingState').first().waitFor({ state: 'visible', timeout: 8000 });
        } catch (_) {
            console.warn('⚠️ [步骤] PayPal City/State/ZIP 三件套 8s 内未渲染，将按现有 DOM 做兜底尝试');
        }

        // 兜底填 City / State / ZIP —— PayPal 没自动补全或字段保留为空时手动填
        const pickFirstVisible = async (selectors, perTryMs = 5000) => {
            for (const sel of selectors) {
                const loc = page.locator(sel).first();
                if (await loc.isVisible({ timeout: perTryMs }).catch(() => false)) return loc;
            }
            return null;
        };

        const fillUntilSet = async (loc, value, label) => {
            if (!loc) {
                console.warn(`⚠️ [步骤] PayPal ${label} 没找到可见输入框，跳过`);
                return;
            }
            for (let attempt = 1; attempt <= 3; attempt += 1) {
                const cur = await loc.inputValue().catch(() => '');
                if (cur && cur.trim() === String(value).trim()) {
                    console.log(`⏩ [步骤] PayPal ${label} 已为目标值: ${cur.trim()}`);
                    return;
                }
                if (cur && cur.trim() && cur.trim() !== String(value).trim()) {
                    console.log(`📝 [步骤] PayPal ${label} 当前值=${cur.trim()}，覆盖为目标值=${value}（第${attempt}次）`);
                } else {
                    console.log(`📝 [步骤] PayPal 兜底填 ${label}: ${value}（第${attempt}次）`);
                }
                try {
                    await loc.click({ clickCount: 3 }).catch(() => { });
                    await loc.fill('').catch(() => { });
                    await loc.fill(String(value));
                    await loc.evaluate((node) => {
                        try {
                            node.dispatchEvent(new Event('input', { bubbles: true }));
                            node.dispatchEvent(new Event('change', { bubbles: true }));
                            node.dispatchEvent(new Event('blur', { bubbles: true }));
                        } catch (_) { }
                    }).catch(() => { });
                } catch (e) {
                    console.warn(`⚠️ [步骤] PayPal ${label} fill 失败: ${e.message}`);
                }
                await page.waitForTimeout(randomDelay(250, 500));
            }
            const finalVal = await loc.inputValue().catch(() => '');
            if (!finalVal || finalVal.trim() !== String(value).trim()) {
                console.warn(`⚠️ [步骤] PayPal ${label} 重试 3 次后值仍不正确：实际="${finalVal}" 期望="${value}"`);
            }
        };

        // City
        const cityLoc = await pickFirstVisible(['#billingCity', '#city', 'input[name="city"]', 'input[name="billingCity"]']);
        await fillUntilSet(cityLoc, billing.city, '城市');

        // State —— 一般是 <select>
        const stateLoc = await pickFirstVisible(['#billingState', '#state', 'select[name="state"]', 'select[name="billingState"]']);
        if (stateLoc) {
            for (let attempt = 1; attempt <= 3; attempt += 1) {
                const cur = await stateLoc.inputValue().catch(() => '');
                if (cur && cur.trim() === String(billing.state).trim()) {
                    console.log(`⏩ [步骤] PayPal State 已为目标值: ${cur}`);
                    break;
                }
                console.log(`📝 [步骤] PayPal ${attempt === 1 && !cur ? '兜底' : '重试'}选 State: ${billing.state}`);
                try {
                    await stateLoc.selectOption({ value: billing.state }).catch(async () => {
                        await stateLoc.selectOption({ label: billing.state }).catch(() => { });
                    });
                    await stateLoc.evaluate((node) => {
                        try {
                            node.dispatchEvent(new Event('change', { bubbles: true }));
                            node.dispatchEvent(new Event('blur', { bubbles: true }));
                        } catch (_) { }
                    }).catch(() => { });
                } catch (e) {
                    console.warn(`⚠️ [步骤] PayPal State 选择失败: ${e.message}`);
                }
                await page.waitForTimeout(randomDelay(250, 500));
            }
        } else {
            console.warn('⚠️ [步骤] PayPal State 没找到可见 select，跳过');
        }

        // ZIP code
        const zipLoc = await pickFirstVisible(['#billingPostalCode', '#postalCode', '#zipCode', 'input[name="postalCode"]', 'input[name="zip"]', 'input[name="billingPostalCode"]']);
        await fillUntilSet(zipLoc, billing.zip, 'ZIP');

        await page.waitForTimeout(randomDelay(300, 700));

        // 密码
        console.log("🔐 [步骤] 正在填写 PayPal 账户密码...");
        await humanFillInput(page, page.locator('#password'), billing.paypalPassword, false, false);
        await page.waitForTimeout(randomDelay(500, 1000));

        // --- 提交前效验机制 ---
        const validateForm = async (page, fields) => {
            console.log("🔍 [效验] 正在进行提交前数据完整性校验...");
            for (const field of fields) {
                const locator = typeof field.selector === 'string' ? page.locator(field.selector) : field.selector;
                if (await locator.isVisible().catch(() => false)) {
                    const actualValue = await locator.inputValue().catch(() => "");
                    const cleanActual = Boolean(field.digitsMode)
                        ? actualValue.replace(/\D/g, '')
                        : actualValue.replace(/[\s\-\/]/g, '').toLowerCase();
                    const cleanExpected = Boolean(field.digitsMode)
                        ? String(field.expectedValue || '').replace(/\D/g, '')
                        : String(field.expectedValue || '').replace(/[\s\-\/]/g, '').toLowerCase();
                    console.log(cleanActual, cleanExpected);

                    if (cleanActual !== cleanExpected && field.expectedValue !== "") {
                        console.warn(`[!] [效验失败] ${field.name} 数据不一致! 预期: ${field.expectedValue}, 实际: ${actualValue}。正在修正...`);
                        await humanFillInput(page, locator, field.expectedValue, Boolean(field.digitsMode), Boolean(field.fastMode));
                        await page.waitForTimeout(500);
                    } else {
                        console.log(`✅ [效验通过] ${field.name}`);
                    }
                }
            }
        };

        const checkFields = [
            { selector: '#cardNumber', expectedValue: billing.card, name: "银行卡号", digitsMode: true },
            { selector: '#expiryDate', expectedValue: billing.expiry, name: "有效期", digitsMode: true },
            { selector: '#cvv', expectedValue: billing.cvc, name: "安全码", digitsMode: true },
            { selector: '#phone', expectedValue: billing.smsPhone, name: "手机号", digitsMode: true },
            { selector: '#email', expectedValue: billing.email, name: "邮箱", digitsMode: false, fastMode: true },
            { selector: '#password', expectedValue: billing.paypalPassword, name: "密码", digitsMode: false },
        ];

        await validateForm(page, checkFields);

        // 提交前最后扫一眼（滚动查看一下）
        if (Math.random() < 0.4) {
            await page.mouse.wheel(0, randomDelay(-80, 80));
            await page.waitForTimeout(randomDelay(500, 1000));
        }

        const agreeAccountBtn = page.getByRole('button', { name: 'Agree & Create Account' });
        await agreeAccountBtn.waitFor({ state: 'visible', timeout: 10000 });
        await page.waitForTimeout(randomDelay(1000, 2000));
        await agreeAccountBtn.click({ force: true });
        console.log("✅ [步骤] 创建账户协议已提交。");



        // Phase 5: 短信验证
        console.log("⏳ [步骤] 正在检查是否触发短信验证...");
        await page.waitForTimeout(5000);
        await checkCriticalErrors();
        const isSmsPage = await page.locator("input#otc_code, input[name='otc_code'], #password").first().isVisible();
        if (isSmsPage) {
            console.log("📨 [步骤] 已进入短信验证页面。");
            const code = await getSMSCode();
            if (!code) {
                throw new Error('手机号短信验证异常：长时间未收到验证码');
            }
            console.log("✍️ [步骤] 正在输入短信验证码...");
            await page.keyboard.type(code, { delay: 100 });
            console.log("✅ [步骤] 短信验证码已输入。");
        } else {
            console.log("ℹ️ [步骤] 当前未触发短信验证，继续后续流程。");
        }
        await page.waitForLoadState('networkidle');
        await checkCriticalErrors();

        // Phase 6: 最终确认
        const finalSubmitBtn = page.locator("button:has-text('Agree and Continue'), button:has-text('Agree & Continue')").first();
        console.log("⏳ [步骤] 正在等待最终确认按钮...");
        await page.waitForTimeout(5000);
        await page.waitForLoadState('networkidle');
        await solveSlider(); // PayPal 页面的滑块检查
        await checkCriticalErrors();
        try {
            await finalSubmitBtn.waitFor({ state: 'visible', timeout: 90000 });
        } catch (_) {
            throw new Error('手机号短信验证异常：PayPal最终确认超时（短信未完成或页面未就绪）');
        }
        // (静默) 最终确认按钮已找到
        await finalSubmitBtn.click({ force: true });
        console.log("⏳ [结账] 已提交，监测支付结果...");

        // 支付成功 / 失败的多重判定
        // 1) URL 跳到 chatgpt.com（最终目标）→ 成功
        // 2) Stripe 标准回调 redirect_status=succeeded → 成功
        // 3) Stripe 标准回调 redirect_status=failed / canceled → 立即失败，不浪费 50s
        // 4) PayPal hostedchallenge / verifycard → 立即失败，告知风控驳回
        const TIMEOUT = 60000;
        const checkPaymentResult = async () => {
            const currentUrl = String(page.url() || '');
            if (currentUrl.includes('chatgpt.com')) {
                return { ok: true, reason: 'redirected_to_chatgpt', url: currentUrl };
            }
            const params = (() => {
                try { return new URL(currentUrl).searchParams; } catch (_) { return null; }
            })();
            const redirectStatus = params ? params.get('redirect_status') : null;
            if (redirectStatus === 'succeeded') {
                return { ok: true, reason: 'stripe_redirect_succeeded', url: currentUrl };
            }
            if (redirectStatus === 'failed' || redirectStatus === 'canceled') {
                return { ok: false, reason: `stripe_redirect_${redirectStatus}`, url: currentUrl };
            }
            if (currentUrl.includes('paypal.com/checkoutweb/genericError')
                || currentUrl.includes('paypal.com/myaccount/transfer/homepage')
                || currentUrl.includes('paypal.com/restricted')) {
                return { ok: false, reason: 'paypal_blocked', url: currentUrl };
            }
            return null;
        };

        const paymentResult = await new Promise((resolve) => {
            const start = Date.now();
            const tick = async () => {
                if (page.isClosed()) {
                    return resolve({ ok: false, reason: 'page_closed', url: 'about:blank' });
                }
                const r = await checkPaymentResult().catch(() => null);
                if (r) return resolve(r);
                if (Date.now() - start >= TIMEOUT) {
                    return resolve({ ok: false, reason: 'timeout', url: page.url() || '' });
                }
                setTimeout(tick, 500);
            };
            tick();
        });

        if (paymentResult.ok) {
            console.log(`    [+] 最终校验：支付成功! (${paymentResult.reason})`);
            console.log("PAYMENT_SUCCESS");
        } else if (paymentResult.reason === 'stripe_redirect_failed' || paymentResult.reason === 'stripe_redirect_canceled') {
            // 失败明确：PayPal/Stripe 已经回执失败，直接抛错让父进程换号重试
            throw new Error(`支付失败 (${paymentResult.reason})：PayPal/Stripe 端驳回，URL=${paymentResult.url}`);
        } else if (paymentResult.reason === 'paypal_blocked') {
            throw new Error(`支付失败 (paypal_blocked)：PayPal 风控拦截，URL=${paymentResult.url}`);
        } else {
            console.log(`    [!] 最终校验：${paymentResult.reason} URL=${paymentResult.url}`);
            console.log('    [!] 支付结果检测失败: 未命中成功标志');
        }
    } catch (e) {
        console.error("❌ [运行时错误]:", e.message);
        try {
            await captureDebugScreenshot(context, page, 'error');
        } catch (err) {
            console.error(`⚠️ [系统] 异常截图保存失败: ${err.message}`);
        }
        // 调试模式：保存出错页面 HTML
        await debug.saveOnError(page, 'runtime_error').catch(() => {});
        process.exit(1);
    } finally {
        if (stopInactivityWatcher) stopInactivityWatcher();
        console.log("👋 [系统] 流程结束，正在关闭浏览器...");
        await browser.close().catch(() => { });
        if (proxyBridgeStarted) {
            await closeProxyBridge();
            console.log("[ProxyBridge] 代理桥接已关闭");
        }
    }
}

// 导出 run 函数供外部调用
module.exports = { run };

// 仅当直接运行时执行（非 require 导入）
if (require.main === module) {
    // 支持命令行参数：node index.js [checkoutUrl] [--debug]
    const args = process.argv.slice(2);
    const debugMode = args.includes('--debug');
    const checkoutUrl = args.find(arg => arg.startsWith('http'));

    run({ checkoutUrl, debugMode });
}
