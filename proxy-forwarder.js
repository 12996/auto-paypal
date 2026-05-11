#!/usr/bin/env node

/**
 * SOCKS5 代理转发服务
 * 链路: 本机 -> VPN(7897) -> 远程SOCKS5(77.111.110.100:30011) -> 目标网站
 */

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
 * 创建本地代理服务器 (转发到 VPN -> 远程SOCKS5)
 */
function createLocalProxyServer() {
    return new Promise((resolve, reject) => {
        const server = net.createServer(async (clientSocket) => {
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
            console.log(`🔌 [代理转发] 服务启动: 127.0.0.1:${LOCAL_PROXY_PORT}`);
            console.log(`📡 [链路] 本机 -> VPN(:${LOCAL_VPN.port}) -> SOCKS5(${REMOTE_SOCKS5.host}:${REMOTE_SOCKS5.port}) -> 目标`);
            resolve(server);
        });

        server.on('error', reject);
    });
}

// 启动服务
async function start() {
    try {
        const server = await createLocalProxyServer();

        process.on('SIGINT', () => {
            console.log('\n🛑 [代理转发] 服务关闭');
            server.close();
            process.exit(0);
        });

        console.log('✅ [代理转发] 服务运行中，按 Ctrl+C 停止');

    } catch (err) {
        console.error('❌ [代理转发] 启动失败:', err.message);
        process.exit(1);
    }
}

if (require.main === module) {
    start();
}

module.exports = { createLocalProxyServer };