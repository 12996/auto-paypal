const assert = require('assert');

const store = require('../mysql-store');

function run() {
    assert.ok(store.__test, 'mysql-store should expose test helpers');

    const [row] = store.__test.normalizeCardPool([
        {
            card_key: '4859-F868-EMFMYMYY-B03E',
            is_registered: 1,
            number: '4859540146849186',
            expiry: '03/30',
            cvc: '378',
            billing_country: 'US',
            billing_address: '1 Main St',
            billing_city: 'Los Angeles',
            billing_state: 'CA',
            billing_zip: '90001',
            billing_name: 'Test User',
            card_sms: 'sms text',
            is_activated: 0,
            activation_account: '',
            redeemed_at: '2026-05-16 12:00:00',
            remark: '兑换异常：缺少 CARD_CVC',
            status: '兑换异常'
        }
    ]);

    assert.deepStrictEqual(row, [
        '4859-F868-EMFMYMYY-B03E',
        1,
        '4859540146849186',
        '03/30',
        '378',
        'US',
        '1 Main St',
        'Los Angeles',
        'CA',
        '90001',
        'Test User',
        'sms text',
        0,
        '',
        '2026-05-16 12:00:00',
        '兑换异常：缺少 CARD_CVC',
        0,
        0,
        '兑换异常'
    ]);

    const [unredeemed] = store.__test.normalizeCardPool([
        { card_key: '4859-F868-EMFMYMYY-B03F' }
    ]);

    assert.deepStrictEqual(unredeemed.slice(0, 16), [
        '4859-F868-EMFMYMYY-B03F',
        0,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        0,
        '',
        null,
        ''
    ]);

    assert.deepStrictEqual(unredeemed.slice(16), [
        0,
        1,
        '正常'
    ]);

    assert.strictEqual(
        store.__test.buildCardPickWhereClause(),
        "is_active = 1 AND is_registered = 1 AND is_activated = 0 AND card_number <> '' AND card_expiry <> '' AND card_cvc <> ''"
    );

    assert.deepStrictEqual(
        store.__test.buildCardAssetTargetWhere({
            cardAssetId: 42,
            cardKey: '4859-F868-EMFMYMYY-B03E',
            cardNumber: '4859540146849186'
        }),
        {
            clause: 'id = ?',
            params: [42]
        },
        'card asset writes should prefer the reserved row id over card key/card number'
    );

    assert.deepStrictEqual(
        store.__test.buildCardAssetTargetWhere({
            cardKey: '4859-F868-EMFMYMYY-B03E',
            cardNumber: '4859540146849186'
        }),
        {
            clause: 'card_key = ?',
            params: ['4859-F868-EMFMYMYY-B03E']
        },
        'card asset writes should fall back to card_key before card_number'
    );

    console.log('test_card_assets_model passed');
}

run();
