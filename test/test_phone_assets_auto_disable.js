const assert = require('assert');

process.env.IS_PRODUCT_FLOW = 'true';
process.env.EMAIL_SOURCE = 'pool';

const server = require('../server');
const productActivator = require('../product_activator');

for (const [name, helper] of [
    ['server', server.__test.analyzeProcessOutput],
    ['product_activator', productActivator.__test.analyzeProcessOutput]
]) {
    assert.strictEqual(typeof helper, 'function', `${name} should expose analyzeProcessOutput`);

    const rejected = helper('手机号被拒绝或系统拦截', false);
    assert.strictEqual(rejected.shouldRetry, true);
    assert.strictEqual(rejected.deletePhone, true, `${name} should auto-disable rejected phone`);

    const smsTimeout = helper('短信验证码超时', false);
    assert.strictEqual(smsTimeout.shouldRetry, true);
    assert.strictEqual(smsTimeout.deletePhone, true, `${name} should auto-disable phone on SMS timeout`);
}

console.log('test_phone_assets_auto_disable passed');
