const assert = require('assert');

process.env.EMAIL_SOURCE = 'pool';

const { __test } = require('../product_activator');

assert.ok(__test, 'product_activator should expose test helpers');
assert.strictEqual(
    typeof __test.analyzeProcessOutput,
    'function',
    'product_activator should expose analyzeProcessOutput test helper'
);

const success = __test.analyzeProcessOutput('日志...\nPAYMENT_SUCCESS\n', false);
assert.deepStrictEqual(
    success,
    {
        status: 'success',
        message: '激活成功',
        reachedPaypal: true,
        shouldRetry: false,
        deletePhone: false,
        deleteCard: false
    },
    'PAYMENT_SUCCESS should be treated as final success'
);

const noPermission = __test.analyzeProcessOutput('Missing PayPal approval URL / ba_token', false);
assert.strictEqual(noPermission.status, 'failed');
assert.strictEqual(noPermission.shouldRetry, false);
assert.strictEqual(noPermission.message, '该账号无激活权限,请更换账号重试');

const proxyFailure = __test.analyzeProcessOutput('代理连接失败: ECONNREFUSED', false);
assert.strictEqual(proxyFailure.status, 'maintenance');
assert.strictEqual(proxyFailure.shouldRetry, false);
assert.strictEqual(proxyFailure.message, '系统维护中,请联系管理员修复');

const cardDeclinedAfterPaypal = __test.analyzeProcessOutput(
    '正在填写 PayPal 登录邮箱\n银行卡被拒绝 (Card declined)',
    false
);
assert.strictEqual(cardDeclinedAfterPaypal.status, 'retry');
assert.strictEqual(cardDeclinedAfterPaypal.shouldRetry, true);
assert.strictEqual(cardDeclinedAfterPaypal.deleteCard, true);
assert.strictEqual(cardDeclinedAfterPaypal.reachedPaypal, true);

const cardDeclinedBeforePaypal = __test.analyzeProcessOutput('银行卡被拒绝 (Card declined)', false);
assert.strictEqual(cardDeclinedBeforePaypal.status, 'retry');
assert.strictEqual(cardDeclinedBeforePaypal.shouldRetry, true);
assert.strictEqual(cardDeclinedBeforePaypal.deleteCard, false);
assert.strictEqual(cardDeclinedBeforePaypal.reachedPaypal, false);

console.log('test_product_activator_analysis passed');
