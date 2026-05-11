const crypto = require('crypto');

// 从server.js复制的token生成逻辑
const ADMIN_TOKEN_SECRET = process.env.ADMIN_TOKEN_SECRET || crypto
    .createHash('sha256')
    .update(`web_redeem:${process.cwd()}:admin-token-secret`)
    .digest('hex');

function encodeBase64Url(input) {
    return Buffer.from(input)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function signTokenPayload(encodedPayload) {
    return crypto
        .createHmac('sha256', ADMIN_TOKEN_SECRET)
        .update(encodedPayload)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function generateTestToken() {
    const now = Date.now();
    // 使用与项目相同的payload结构
    const payload = {
        sub: 'admin',
        permissions: ['admin'],
        pv: 1, // 假设passwordVersion为1，可能需要从数据库获取
        iat: now,
        exp: now + (365 * 24 * 60 * 60 * 1000) // 1年后过期
    };

    // 使用项目相同的编码方式
    const encodedPayload = encodeBase64Url(JSON.stringify(payload));
    const signature = signTokenPayload(encodedPayload);

    return `${encodedPayload}.${signature}`;
}

const testToken = generateTestToken();
console.log('🔑 测试Token (使用项目相同的生成逻辑):');
console.log(testToken);
console.log('\n📝 使用方法:');
console.log('在请求头中添加: Authorization: Bearer ' + testToken);
console.log('\n⚠️  注意: 这个token假设passwordVersion=1，如果验证失败可能需要调整pv值');
console.log('⚠️  正式上线前请删除此文件');

module.exports = { testToken };