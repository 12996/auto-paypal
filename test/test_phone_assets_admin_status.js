const assert = require('assert');

const store = require('../mysql-store');

assert.ok(store.__test, 'mysql-store should expose test helpers');
assert.strictEqual(typeof store.__test.normalizePhonePool, 'function');

const [invalidPhone] = store.__test.normalizePhonePool([
    {
        phone: '8352755872',
        key: 'sms-key',
        status: '已报废'
    }
]);

assert.deepStrictEqual(invalidPhone, [
    '8352755872',
    'sms-key',
    0,
    0,
    '已报废'
]);

const [normalPhone] = store.__test.normalizePhonePool([
    {
        phone: '8352755873',
        key: 'sms-key-2',
        status: '正常'
    }
]);

assert.deepStrictEqual(normalPhone, [
    '8352755873',
    'sms-key-2',
    0,
    1,
    '正常'
]);

console.log('test_phone_assets_admin_status passed');
