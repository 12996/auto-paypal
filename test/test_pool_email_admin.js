const assert = require('assert');

process.env.IS_PRODUCT_FLOW = 'true';

const store = require('../mysql-store');
const server = require('../server');

assert.ok(store.__test, 'mysql-store should expose test helpers');
assert.strictEqual(
    typeof store.__test.buildPoolEmailRegisteredUpdate,
    'function',
    'mysql-store should expose pool email registered update builder'
);

const registeredPlan = store.__test.buildPoolEmailRegisteredUpdate(12, true);
assert.ok(
    /registered = 1/.test(registeredPlan.sql),
    'registered=true should set registered=1'
);
assert.ok(
    /registered_at = COALESCE\(registered_at, CURRENT_TIMESTAMP\)/.test(registeredPlan.sql),
    'registered=true should preserve existing registered_at or set current timestamp'
);
assert.deepStrictEqual(registeredPlan.params, [12]);

const unregisteredPlan = store.__test.buildPoolEmailRegisteredUpdate(12, false);
assert.ok(
    /registered = 0/.test(unregisteredPlan.sql),
    'registered=false should set registered=0'
);
assert.ok(
    /registered_at = NULL/.test(unregisteredPlan.sql),
    'registered=false should clear registered_at'
);
assert.deepStrictEqual(unregisteredPlan.params, [12]);

assert.ok(server.__test, 'server should expose test helpers');
assert.strictEqual(
    typeof server.__test.getPoolEmailMessageLimit,
    'function',
    'server should expose pool email message limit helper'
);
assert.strictEqual(server.__test.getPoolEmailMessageLimit(), 5);
assert.strictEqual(server.__test.getPoolEmailMessageLimit('50'), 5);
assert.strictEqual(server.__test.getPoolEmailMessageLimit('1'), 5);

console.log('test_pool_email_admin passed');
