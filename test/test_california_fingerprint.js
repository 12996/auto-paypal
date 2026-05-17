/**
 * 手动打开加州指纹检测浏览器。
 *
 * 这个脚本只用于本地手动测试：
 * - 不读取项目 CONFIG.proxy。
 * - 远程代理、桥接端口、VPN 端口都由命令行或环境变量指定。
 * - 默认打开 https://ippure.com/fingerprint.html。
 */

const readline = require('readline');
const { chromium } = require('playwright');
const CaliforniaFingerprint = require('../lib/california-fingerprint');
const { createProxyBridge, closeProxyBridge } = require('../local-proxy-bridge');

// 像 chatgpt.js 一样，想固定用哪个代理就直接改这里。
// 支持：
// - 本地 HTTP 代理：'http://127.0.0.1:7897' 或 '127.0.0.1:7897'
// - 远程 SOCKS5 代理：'socks5://user:pass@host:port'（会按参数启动桥接）
const DEFAULT_PROXY_URL = 'http://127.0.0.1:7897';

function normalizeProxyUrl(proxyUrl) {
    const value = String(proxyUrl || '').trim();
    if (!value) return '';
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value;
    if (/^[\w.-]+:\d+$/.test(value)) return `http://${value}`;
    return value;
}

function getProxyProtocol(proxyUrl) {
    try {
        return new URL(normalizeProxyUrl(proxyUrl)).protocol.replace(':', '').toLowerCase();
    } catch (_) {
        return '';
    }
}

function parseArgs(argv) {
    const options = {
        url: process.env.URL || 'https://ippure.com/fingerprint.html',
        proxyUrl: normalizeProxyUrl(process.env.PROXY_URL || process.env.REMOTE_PROXY || DEFAULT_PROXY_URL),
        localPort: Number(process.env.LOCAL_PORT || 10900),
        vpnPort: process.env.VPN_PORT || '7897',
        vpnType: process.env.VPN_TYPE || 'http',
        channel: process.env.CHROMIUM_CHANNEL || '',
        noVpn: ['none', 'false', '0', 'no'].includes(String(process.env.VPN_PORT || '').toLowerCase()),
        headless: false
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        const next = argv[i + 1];
        if (arg === '--url' && next) {
            options.url = next;
            i += 1;
        } else if ((arg === '--proxy' || arg === '--proxy-url') && next) {
            options.proxyUrl = normalizeProxyUrl(next);
            i += 1;
        } else if (arg === '--remote-proxy' && next) {
            options.proxyUrl = normalizeProxyUrl(next);
            i += 1;
        } else if (arg === '--local-port' && next) {
            options.localPort = Number(next);
            i += 1;
        } else if (arg === '--vpn-port' && next) {
            options.vpnPort = next;
            options.noVpn = ['none', 'false', '0', 'no'].includes(String(next).toLowerCase());
            i += 1;
        } else if (arg === '--vpn-type' && next) {
            options.vpnType = next;
            i += 1;
        } else if (arg === '--channel' && next) {
            options.channel = next;
            i += 1;
        } else if (arg === '--no-vpn') {
            options.noVpn = true;
        } else if (arg === '--headless') {
            options.headless = true;
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        }
    }

    return options;
}

function printHelp() {
    console.log(`
用法：
  node test/test_california_fingerprint.js [--proxy <proxyUrl>] [选项]

默认：
  文件顶部 DEFAULT_PROXY_URL = '${DEFAULT_PROXY_URL}'

选项：
  --proxy <url>            代理 URL，例如 127.0.0.1:7897、http://127.0.0.1:7897、socks5://user:pass@host:port
  --remote-proxy <url>     兼容旧参数，等同于 --proxy
  --local-port <port>      本地桥接端口，默认 10900
  --vpn-port <port|none>   远程 SOCKS5 桥接时使用的本机上游 VPN 端口，默认 7897；none 表示不走 VPN
  --vpn-type <http|socks5> 上游 VPN 类型，默认 http
  --url <url>              检测网址，默认 https://ippure.com/fingerprint.html
  --channel <chrome>       使用真实 Chrome，例如 chrome 或 msedge
  --headless               无头运行

也可用环境变量：
  PROXY_URL, REMOTE_PROXY, LOCAL_PORT, VPN_PORT, VPN_TYPE, URL, CHROMIUM_CHANNEL

示例：
  node test/test_california_fingerprint.js
  node test/test_california_fingerprint.js --proxy 127.0.0.1:7897
  node test/test_california_fingerprint.js --proxy "socks5://user:pass@host:3010" --local-port 10900 --vpn-port 7897 --vpn-type http
  node test/test_california_fingerprint.js --proxy "socks5://user:pass@host:3010" --vpn-port none
`);
}

function waitForEnter(message) {
    if (process.stdin.isTTY) {
        return new Promise((resolve) => {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            rl.question(message, () => {
                rl.close();
                resolve();
            });
        });
    }

    return new Promise(() => {});
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        printHelp();
        return;
    }

    if (!options.proxyUrl) {
        printHelp();
        throw new Error('缺少 --proxy / PROXY_URL / DEFAULT_PROXY_URL');
    }

    const proxyProtocol = getProxyProtocol(options.proxyUrl);
    let browserProxyServer = options.proxyUrl;
    let bridgeStarted = false;

    if (proxyProtocol === 'socks5' || proxyProtocol === 'socks') {
        if (!Number.isInteger(options.localPort) || options.localPort <= 0) {
            throw new Error(`本地桥接端口无效: ${options.localPort}`);
        }

        const useVpn = !options.noVpn;
        const vpnPort = Number(options.vpnPort);
        if (useVpn && (!Number.isInteger(vpnPort) || vpnPort <= 0)) {
            throw new Error(`VPN 端口无效: ${options.vpnPort}`);
        }

        const bridge = await createProxyBridge({
            remoteProxy: options.proxyUrl,
            localPort: options.localPort,
            vpnPort,
            useVpn,
            vpnType: options.vpnType
        });
        browserProxyServer = bridge.localProxy;
        bridgeStarted = true;
    } else if (proxyProtocol !== 'http' && proxyProtocol !== 'https') {
        throw new Error(`不支持的代理协议: ${options.proxyUrl}`);
    }

    const launchOptions = {
        headless: options.headless,
        proxy: { server: browserProxyServer },
        args: ['--disable-blink-features=AutomationControlled']
    };
    if (options.channel) {
        launchOptions.channel = options.channel;
    }

    let browser;
    try {
        browser = await chromium.launch(launchOptions);
        const { context, config } = await CaliforniaFingerprint.createCaliforniaContext(browser);
        const page = await context.newPage();

        console.log('🌴 [指纹] 当前配置:', JSON.stringify({
            locale: config.locale,
            languages: config.languages,
            timezone: config.timezone,
            platform: config.platform,
            userAgent: config.userAgent
        }, null, 2));
        console.log(`🌐 [代理] Playwright 使用: ${browserProxyServer}${bridgeStarted ? ' (本地桥接)' : ' (直接代理)'}`);
        console.log(`🌐 [浏览器] 打开检测页: ${options.url}`);

        await page.goto(options.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(3000);

        const probe = await page.evaluate(() => ({
            language: navigator.language,
            languages: navigator.languages,
            intlLocale: Intl.DateTimeFormat().resolvedOptions().locale,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            platform: navigator.platform,
            webdriver: navigator.webdriver
        }));
        console.log('🔎 [页面探针]', JSON.stringify(probe, null, 2));

        await waitForEnter('浏览器已打开。测试完后按 Enter 关闭浏览器和代理桥接...');
    } finally {
        if (browser) {
            await browser.close().catch(() => {});
        }
        await closeProxyBridge().catch(() => {});
    }
}

main().catch(async (error) => {
    console.error('❌ 测试启动失败:', error.message);
    await closeProxyBridge().catch(() => {});
    process.exit(1);
});
