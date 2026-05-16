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
    assert.strictEqual(rejected.deletePhone, false, `${name} should not auto-disable rejected phone`);
    assert(!String(rejected.message || '').includes('禁用'), `${name} message should not claim phone is disabled`);

    const smsTimeout = helper('短信验证码超时', false);
    assert.strictEqual(smsTimeout.shouldRetry, true);
    assert.strictEqual(smsTimeout.deletePhone, false, `${name} should not auto-disable phone on SMS timeout`);
    assert(!String(smsTimeout.message || '').includes('禁用'), `${name} SMS message should not claim phone is disabled`);
}

console.log('test_phone_assets_no_auto_disable passed');
