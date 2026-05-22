const assert = require('assert');

process.env.EMAIL_SOURCE = 'pool';

const { __test } = require('../product_activator');

async function run() {
    assert.ok(__test, 'product_activator should expose test helpers');
    assert.strictEqual(
        typeof __test.settleActivationAssets,
        'function',
        'product_activator should expose settleActivationAssets test helper'
    );

    const calls = [];
    const fakeStore = {
        async markCardAssetActivated(cardAssetId, activationAccount) {
            calls.push(['mark', cardAssetId, activationAccount]);
        },
        async releaseRuntimeAssets(payload) {
            calls.push(['release', payload]);
        }
    };

    await __test.settleActivationAssets(fakeStore, {
        cardAssetId: 42,
        phoneAssetId: 7
    }, {
        success: true,
        email: 'created@example.com'
    });

    assert.deepStrictEqual(calls, [
        ['mark', 42, 'created@example.com'],
        ['release', { phoneAssetId: 7, cardAssetId: 42 }]
    ]);

    calls.length = 0;
    fakeStore.deleteCardAsset = async (payload) => {
        calls.push(['deleteCard', payload]);
    };
    fakeStore.deletePhoneAsset = async (phone) => {
        calls.push(['deletePhone', phone]);
    };

    await __test.settleActivationAssets(fakeStore, {
        cardAssetId: 43,
        phoneAssetId: 8,
        phone: { phone: '15550002222' },
        card: {
            key: '4859-F868-EMFMYMYY-B03E',
            number: '4859540146849186'
        }
    }, {
        success: false,
        deleteCard: true,
        deletePhone: true
    });

    assert.deepStrictEqual(calls, [
        ['deleteCard', {
            cardAssetId: 43,
            cardKey: '4859-F868-EMFMYMYY-B03E',
            cardNumber: '4859540146849186'
        }],
        ['deletePhone', '15550002222'],
        ['release', { phoneAssetId: 8, cardAssetId: 43 }]
    ]);

    console.log('test_product_activator_asset_settlement passed');
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
