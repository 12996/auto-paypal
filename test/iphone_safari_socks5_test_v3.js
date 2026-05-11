#!/usr/bin/env node

/**
 * iPhone Safari 指纹伪装 + SOCKS5 代理测试 (V3)
 * 链路: 本机 -> VPN(7897) -> 远程SOCKS5(77.111.110.100:30011) -> 目标网站
 */

const { chromium } = require('playwright');
const { SocksClient } = require('socks');
const net = require('net');

// 本地 VPN 代理
const LOCAL_VPN = {
    host: '127.0.0.1',
    port: 7897,
    type: 5
};

// 远程 SOCKS5 代理
const REMOTE_SOCKS5 = {
    host: '77.111.110.100',
    port: 30011,
    userId: 'frontier',
    password: 'oiH8raGAtfclvQReTX'
};

// 本地代理转发端口
const LOCAL_PROXY_PORT = 10808;

/**
 * iPhone Safari 指纹伪装脚本
 */
const iphoneSafariFingerprint = `
(() => {
    const iphoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
    Object.defineProperty(navigator, 'userAgent', { get: () => iphoneUA, configurable: true });
    Object.defineProperty(navigator, 'platform', { get: () => 'iPhone', configurable: true });
    Object.defineProperty(navigator, 'vendor', { get: () => 'Apple Computer, Inc.', configurable: true });
    Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 6, configurable: true });
    Object.defineProperty(navigator, 'deviceMemory', { get: () => 6, configurable: true });
    Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5, configurable: true });

    try {
        delete window.chrome;
        Object.defineProperty(window, 'chrome', { get: () => undefined, enumerable: false, configurable: true });
    } catch (_) {}

    Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true });
    Object.defineProperty(screen, 'width', { get: () => 393, configurable: true });
    Object.defineProperty(screen, 'height', { get: () => 852, configurable: true });
    Object.defineProperty(screen, 'availWidth', { get: () => 393, configurable: true });
    Object.defineProperty(screen, 'availHeight', { get: () => 852, configurable: true });
    Object.defineProperty(window, 'devicePixelRatio', { get: () => 3.0, configurable: true });
    Object.defineProperty(navigator, 'language', { get: () => 'en-US', configurable: true });
    Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'], configurable: true });

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
        const context = originalGetContext.call(this, type, ...args);
        if ((type === 'webgl' || type === 'webgl2') && context) {
            const originalGetParameter = context.getParameter.bind(context);
            context.getParameter = function(param) {
                if (param === 37445) return 'Apple Inc.';
                if (param === 37446) return 'Apple A16 GPU';
                return originalGetParameter(param);
            };
        }
        return context;
    };

    Object.defineProperty(navigator, 'plugins', {
        get: () => {
            const p = [{ name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'PDF', length: 1 }];
            p.length = 1;
            return p;
        },
        configurable: true
    });
})();
`;

/**
 * 创建本地代理服务器 (转发到 VPN -> 远程SOCKS5)
 */
function createLocalProxyServer() {
    return new Promise((resolve, reject) => {
        const server = net.createServer(async (clientSocket) => {
            let step = 0;
            let targetHost, targetPort;

            clientSocket.once('data', (data) => {
                // SOCKS5 握手响应：无认证
                clientSocket.write(Buffer.from([0x05, 0x00]));

                clientSocket.once('data', async (request) => {
                    const atyp = request[3];

                    if (atyp === 0x01) {
                        targetHost = `${request[4]}.${request[5]}.${request[6]}.${request[7]}`;
                        targetPort = request.readUInt16BE(8);
                    } else if (atyp === 0x03) {
                        const len = request[4];
                        targetHost = request.slice(5, 5 + len).toString();
                        targetPort = request.readUInt16BE(5 + len);
                    } else if (atyp === 0x04) {
                        targetHost = request.slice(4, 20).toString('hex').match(/.{4}/g).join(':');
                        targetPort = request.readUInt16BE(20);
                    }

                    try {
                        // 第一步：通过 VPN 连接到远程 SOCKS5
                        const { socket: vpnSocket } = await SocksClient.createConnection({
                            proxy: LOCAL_VPN,
                            command: 'connect',
                            destination: { host: REMOTE_SOCKS5.host, port: REMOTE_SOCKS5.port },
                            timeout: 30000
                        });

                        // 第二步：在 vpnSocket 上进行 SOCKS5 认证
                        const remoteSocket = await authenticateRemoteSocks5(vpnSocket, targetHost, targetPort);

                        // 响应客户端连接成功
                        clientSocket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));

                        // 双向转发
                        clientSocket.pipe(remoteSocket);
                        remoteSocket.pipe(clientSocket);

                        clientSocket.on('error', () => remoteSocket.destroy());
                        remoteSocket.on('error', () => clientSocket.destroy());
                        clientSocket.on('close', () => remoteSocket.destroy());
                        remoteSocket.on('close', () => clientSocket.destroy());

                    } catch (err) {
                        console.error('代理连接失败:', err.message);
                        clientSocket.write(Buffer.from([0x05, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
                        clientSocket.destroy();
                    }
                });
            });

            clientSocket.on('error', () => {});
        });

        server.listen(LOCAL_PROXY_PORT, '127.0.0.1', () => {
            console.log(`🔌 [代理] 本地代理服务器启动: 127.0.0.1:${LOCAL_PROXY_PORT}`);
            resolve(server);
        });

        server.on('error', reject);
    });
}

/**
 * 在已建立的连接上进行远程 SOCKS5 认证
 */
function authenticateRemoteSocks5(socket, targetHost, targetPort) {
    return new Promise((resolve, reject) => {
        let step = 0;
        let buffer = Buffer.alloc(0);

        const timeout = setTimeout(() => {
            reject(new Error('远程 SOCKS5 认证超时'));
        }, 30000);

        socket.on('data', (data) => {
            buffer = Buffer.concat([buffer, data]);

            if (step === 0 && buffer.length >= 2) {
                if (buffer[0] === 0x05 && buffer[1] === 0x02) {
                    // 发送认证
                    const userBuf = Buffer.from(REMOTE_SOCKS5.userId);
                    const passBuf = Buffer.from(REMOTE_SOCKS5.password);
                    socket.write(Buffer.concat([
                        Buffer.from([0x01, userBuf.length]),
                        userBuf,
                        Buffer.from([passBuf.length]),
                        passBuf
                    ]));
                    buffer = Buffer.alloc(0);
                    step = 1;
                } else if (buffer[1] === 0x00) {
                    // 无需认证
                    sendConnectRequest();
                    buffer = Buffer.alloc(0);
                    step = 2;
                }
            } else if (step === 1 && buffer.length >= 2) {
                if (buffer[0] === 0x01 && buffer[1] === 0x00) {
                    sendConnectRequest();
                    buffer = Buffer.alloc(0);
                    step = 2;
                } else {
                    clearTimeout(timeout);
                    reject(new Error('SOCKS5 认证失败'));
                }
            } else if (step === 2 && buffer.length >= 10) {
                if (buffer[0] === 0x05 && buffer[1] === 0x00) {
                    clearTimeout(timeout);
                    socket.removeAllListeners('data');
                    resolve(socket);
                } else {
                    clearTimeout(timeout);
                    reject(new Error('SOCKS5 连接请求失败'));
                }
            }
        });

        socket.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });

        // 发送握手
        socket.write(Buffer.from([0x05, 0x02, 0x00, 0x02]));

        function sendConnectRequest() {
            const domainBuf = Buffer.from(targetHost);
            const portBuf = Buffer.alloc(2);
            portBuf.writeUInt16BE(targetPort);
            socket.write(Buffer.concat([
                Buffer.from([0x05, 0x01, 0x00, 0x03, domainBuf.length]),
                domainBuf,
                portBuf
            ]));
        }
    });
}

/**
 * 运行测试
 */
async function runTest() {
    console.log('🧪 [测试] iPhone Safari + SOCKS5 代理测试 (V3)');
    console.log(`📡 链路: 本机 -> VPN(:${LOCAL_VPN.port}) -> SOCKS5(${REMOTE_SOCKS5.host}:${REMOTE_SOCKS5.port}) -> 目标\n`);

    let proxyServer, browser;

    try {
        // 启动本地代理
        proxyServer = await createLocalProxyServer();

        // 启动浏览器
        console.log('🚀 [浏览器] 启动 Chromium...');
        browser = await chromium.launch({
            headless: false,
            args: ['--no-first-run', '--disable-blink-features=AutomationControlled']
        });

        const context = await browser.newContext({
            viewport: { width: 393, height: 852 },
            deviceScaleFactor: 3.0,
            isMobile: true,
            hasTouch: true,
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
            proxy: { server: `socks5://127.0.0.1:${LOCAL_PROXY_PORT}` }
        });

        const page = await context.newPage();
        await page.addInitScript(iphoneSafariFingerprint);

        // 测试 IP
        console.log('🌍 [代理] 检查出口 IP...');
        await page.goto('https://httpbin.org/ip', { waitUntil: 'networkidle', timeout: 60000 });

        const ipInfo = await page.evaluate(() => {
            try { return JSON.parse(document.body.textContent); }
            catch { return { origin: '获取失败' }; }
        });
        console.log('📍 [IP] 出口 IP:', ipInfo.origin);

        // 指纹测试
        console.log('\n📱 [测试] 访问指纹检测网站...');
        await page.goto('https://www.whatismybrowser.com/detect/what-is-my-user-agent', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);

        const fp = await page.evaluate(() => ({
            platform: navigator.platform,
            vendor: navigator.vendor,
            isMobile: /Mobi/i.test(navigator.userAgent),
            webdriver: navigator.webdriver,
            chrome: typeof window.chrome !== 'undefined'
        }));

        console.log('\n📊 [结果]');
        console.log('════════════════════════════════════════');
        const checks = [
            ['iPhone Platform', fp.platform === 'iPhone'],
            ['Apple Vendor', fp.vendor === 'Apple Computer, Inc.'],
            ['Mobile Device', fp.isMobile],
            ['No WebDriver', fp.webdriver === undefined],
            ['No Chrome', !fp.chrome],
            ['Proxy IP', ipInfo.origin !== '获取失败']
        ];

        let pass = 0;
        checks.forEach(([name, ok]) => {
            if (ok) pass++;
            console.log(`${ok ? '✅' : '❌'} ${name}`);
        });

        console.log('════════════════════════════════════════');
        console.log(`🎯 通过率: ${pass}/${checks.length} (${Math.round(pass/checks.length*100)}%)`);
        console.log('\n🔍 浏览器保持打开，按 Ctrl+C 退出');

        await new Promise(() => {});

    } catch (err) {
        console.error('❌ 错误:', err.message);
    } finally {
        process.on('SIGINT', async () => {
            console.log('\n🛑 关闭中...');
            if (browser) await browser.close();
            if (proxyServer) proxyServer.close();
            process.exit(0);
        });
    }
}

runTest();
