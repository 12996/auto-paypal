/**
 * 本地代理桥接模块
 * 解决两个问题：
 * 1. Playwright 不支持 SOCKS5 认证
 * 2. 本机需要先走 VPN 才能连接远程代理
 *
 * 链路: 浏览器 → 本地代理(:10808) → VPN(:7897) → 远程SOCKS5 → 目标网站
 */

const net = require('net');
const { SocksClient } = require('socks');
const http = require('http');

// 默认配置
const DEFAULT_LOCAL_PORT = 10808;
const DEFAULT_VPN_PORT = 7897;

let proxyServer = null;
let currentConfig = null;

/**
 * 解析代理 URL
 * @param {string} proxyUrl - 格式: socks5://user:pass@host:port
 */
function parseProxyUrl(proxyUrl) {
    try {
        const url = new URL(proxyUrl);
        if (!url.hostname) {
            throw new Error('缺少代理主机名');
        }
        if (!url.port) {
            throw new Error('缺少代理端口');
        }
        return {
            host: url.hostname,
            port: parseInt(url.port, 10),
            userId: decodeURIComponent(url.username || ''),
            password: decodeURIComponent(url.password || ''),
            protocol: url.protocol.replace(':', '')
        };
    } catch (e) {
        console.error('[ProxyBridge] 代理 URL 解析失败:', e.message);
        return null;
    }
}

/**
 * 在已建立的连接上进行远程 SOCKS5 认证
 */
function authenticateRemoteSocks5(socket, remoteProxy, targetHost, targetPort) {
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
                    // 需要用户名密码认证
                    const userBuf = Buffer.from(remoteProxy.userId);
                    const passBuf = Buffer.from(remoteProxy.password);
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
                } else {
                    clearTimeout(timeout);
                    reject(new Error('SOCKS5 不支持的认证方式'));
                }
            } else if (step === 1 && buffer.length >= 2) {
                if (buffer[0] === 0x01 && buffer[1] === 0x00) {
                    sendConnectRequest();
                    buffer = Buffer.alloc(0);
                    step = 2;
                } else {
                    clearTimeout(timeout);
                    reject(new Error('SOCKS5 认证失败 - 用户名或密码错误'));
                }
            } else if (step === 2 && buffer.length >= 10) {
                if (buffer[0] === 0x05 && buffer[1] === 0x00) {
                    clearTimeout(timeout);
                    socket.removeAllListeners('data');
                    resolve(socket);
                } else {
                    clearTimeout(timeout);
                    const errorCodes = {
                        0x01: '一般性失败',
                        0x02: '规则不允许',
                        0x03: '网络不可达',
                        0x04: '主机不可达',
                        0x05: '连接被拒绝',
                        0x06: 'TTL 过期',
                        0x07: '不支持的命令',
                        0x08: '不支持的地址类型'
                    };
                    reject(new Error(`SOCKS5 连接失败: ${errorCodes[buffer[1]] || '未知错误'}`));
                }
            }
        });

        socket.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });

        // 发送握手 (支持无认证和用户名密码认证)
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
 * 通过 HTTP 代理建立 CONNECT 隧道
 * @param {string} httpProxyHost - HTTP 代理主机
 * @param {number} httpProxyPort - HTTP 代理端口
 * @param {string} targetHost - 目标主机
 * @param {number} targetPort - 目标端口
 */
function connectViaHttpProxy(httpProxyHost, httpProxyPort, targetHost, targetPort) {
    return new Promise((resolve, reject) => {
        const socket = net.connect(httpProxyPort, httpProxyHost, () => {
            // 发送 HTTP CONNECT 请求
            socket.write(`CONNECT ${targetHost}:${targetPort} HTTP/1.1\r\nHost: ${targetHost}:${targetPort}\r\n\r\n`);
        });

        let responseData = '';
        const timeout = setTimeout(() => {
            socket.destroy();
            reject(new Error('HTTP CONNECT 超时'));
        }, 30000);

        socket.on('data', function onData(data) {
            responseData += data.toString();

            // 检查是否收到完整的 HTTP 响应头
            if (responseData.includes('\r\n\r\n')) {
                clearTimeout(timeout);
                socket.removeListener('data', onData);

                if (responseData.includes('200')) {
                    // 隧道建立成功
                    resolve(socket);
                } else {
                    socket.destroy();
                    reject(new Error(`HTTP CONNECT 失败: ${responseData.split('\r\n')[0]}`));
                }
            }
        });

        socket.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

/**
 * 创建本地代理服务器
 * @param {Object} options
 * @param {string} options.remoteProxy - 远程代理 URL (socks5://user:pass@host:port)
 * @param {number} options.localPort - 本地监听端口 (默认 10808)
 * @param {number} options.vpnPort - 本地 VPN 端口 (默认 7897)
 * @param {boolean} options.useVpn - 是否通过 VPN 连接 (默认 true)
 * @param {string} options.vpnType - VPN 代理类型: 'http' 或 'socks5' (默认 'http')
 */
function createProxyBridge(options = {}) {
    return new Promise((resolve, reject) => {
        const {
            remoteProxy,
            localPort = DEFAULT_LOCAL_PORT,
            vpnPort = DEFAULT_VPN_PORT,
            useVpn = true,
            vpnType = 'http'  // Clash 默认是 HTTP 代理
        } = options;

        const remoteParsed = parseProxyUrl(remoteProxy);
        if (!remoteParsed) {
            return reject(new Error('无效的远程代理 URL'));
        }

        // 如果已有服务器在运行，先关闭
        if (proxyServer) {
            proxyServer.close();
            proxyServer = null;
        }

        const server = net.createServer(async (clientSocket) => {
            let targetHost, targetPort;

            clientSocket.once('data', (data) => {
                // SOCKS5 握手响应：无认证
                clientSocket.write(Buffer.from([0x05, 0x00]));

                clientSocket.once('data', async (request) => {
                    const atyp = request[3];

                    if (atyp === 0x01) {
                        // IPv4
                        targetHost = `${request[4]}.${request[5]}.${request[6]}.${request[7]}`;
                        targetPort = request.readUInt16BE(8);
                    } else if (atyp === 0x03) {
                        // 域名
                        const len = request[4];
                        targetHost = request.slice(5, 5 + len).toString();
                        targetPort = request.readUInt16BE(5 + len);
                    } else if (atyp === 0x04) {
                        // IPv6
                        targetHost = request.slice(4, 20).toString('hex').match(/.{4}/g).join(':');
                        targetPort = request.readUInt16BE(20);
                    }

                    try {
                        let remoteSocket;

                        if (useVpn) {
                            if (vpnType === 'http') {
                                // 链路: 本机 → HTTP代理(VPN) → 远程SOCKS5 → 目标
                                // 先通过 HTTP CONNECT 连接到远程 SOCKS5 代理
                                const vpnSocket = await connectViaHttpProxy('127.0.0.1', vpnPort, remoteParsed.host, remoteParsed.port);
                                // 在隧道上进行 SOCKS5 认证
                                remoteSocket = await authenticateRemoteSocks5(vpnSocket, remoteParsed, targetHost, targetPort);
                            } else {
                                // 链路: 本机 → SOCKS5代理(VPN) → 远程SOCKS5 → 目标
                                const { socket: vpnSocket } = await SocksClient.createConnection({
                                    proxy: {
                                        host: '127.0.0.1',
                                        port: vpnPort,
                                        type: 5
                                    },
                                    command: 'connect',
                                    destination: { host: remoteParsed.host, port: remoteParsed.port },
                                    timeout: 30000
                                });
                                remoteSocket = await authenticateRemoteSocks5(vpnSocket, remoteParsed, targetHost, targetPort);
                            }
                        } else {
                            // 直连远程 SOCKS5 (需要网络能直接访问)
                            const { socket } = await SocksClient.createConnection({
                                proxy: {
                                    host: remoteParsed.host,
                                    port: remoteParsed.port,
                                    type: 5,
                                    userId: remoteParsed.userId,
                                    password: remoteParsed.password
                                },
                                command: 'connect',
                                destination: { host: targetHost, port: targetPort },
                                timeout: 30000
                            });
                            remoteSocket = socket;
                        }

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
                        console.error(`[ProxyBridge] 连接失败 (${targetHost}:${targetPort}):`, err.message);
                        clientSocket.write(Buffer.from([0x05, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
                        clientSocket.destroy();
                    }
                });
            });

            clientSocket.on('error', () => {});
        });

        server.listen(localPort, '127.0.0.1', () => {
            console.log(`🔌 [ProxyBridge] 本地代理桥接启动: 127.0.0.1:${localPort}`);
            if (useVpn) {
                console.log(`   链路: 浏览器 → :${localPort} → VPN(${vpnType}://:${vpnPort}) → ${remoteParsed.host}:${remoteParsed.port} → 目标`);
            } else {
                console.log(`   链路: 浏览器 → :${localPort} → ${remoteParsed.host}:${remoteParsed.port} → 目标`);
            }

            proxyServer = server;
            currentConfig = { localPort, vpnPort, useVpn, vpnType, remoteProxy };

            resolve({
                server,
                localProxy: `socks5://127.0.0.1:${localPort}`,
                localPort
            });
        });

        server.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                reject(new Error(`端口 ${localPort} 已被占用`));
            } else {
                reject(err);
            }
        });
    });
}

/**
 * 关闭代理桥接服务器
 */
function closeProxyBridge() {
    return new Promise((resolve) => {
        if (proxyServer) {
            proxyServer.close(() => {
                console.log('[ProxyBridge] 代理桥接已关闭');
                proxyServer = null;
                currentConfig = null;
                resolve();
            });
        } else {
            resolve();
        }
    });
}

/**
 * 获取当前代理桥接状态
 */
function getProxyBridgeStatus() {
    if (!proxyServer || !currentConfig) {
        return { running: false };
    }
    return {
        running: true,
        localProxy: `socks5://127.0.0.1:${currentConfig.localPort}`,
        ...currentConfig
    };
}

module.exports = {
    createProxyBridge,
    closeProxyBridge,
    getProxyBridgeStatus,
    parseProxyUrl,
    DEFAULT_LOCAL_PORT,
    DEFAULT_VPN_PORT
};
