const assert = require('assert');
const { parseProxyUrl } = require('../local-proxy-bridge');

function main() {
    const parsed = parseProxyUrl('socks5://user:pass@us2.cliproxy.io:3010');
    assert.deepStrictEqual(parsed, {
        host: 'us2.cliproxy.io',
        port: 3010,
        userId: 'user',
        password: 'pass',
        protocol: 'socks5',
    });

    assert.strictEqual(parseProxyUrl('socks5://user:pass@:3010'), null);
    assert.strictEqual(parseProxyUrl('socks5://user:pass@us2.cliproxy.io'), null);

    console.log('test_local_proxy_bridge_parse passed');
}

main();
