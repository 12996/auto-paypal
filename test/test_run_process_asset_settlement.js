const assert = require('assert');

process.env.IS_PRODUCT_FLOW = 'true';

const { __test } = require('../server');

async function run() {
    assert.ok(__test, 'server should expose test helpers');
    assert.strictEqual(
        typeof __test.settleRunProcessAssets,
        'function',
        'server should expose settleRunProcessAssets test helper'
    );

    const calls = [];
    const fakeStore = {
        async markCardAssetActivated(cardAssetId, activationAccount) {
            calls.push(['mark', cardAssetId, activationAccount]);
        },
        async incrementAssetSuccessCount(payload) {
            calls.push(['increment', payload]);
        },
        async releaseRuntimeAssets(payload) {
            calls.push(['release', payload]);
        }
    };

    await __test.settleRunProcessAssets(fakeStore, {
        cardAssetId: 42,
        phoneAssetId: 7,
        phone: { phone: '15550001111' },
        card: {
            key: 'CARD-KEY-001',
            number: '4859540146849186'
        }
    }, {
        success: true
    });

    assert.deepStrictEqual(calls, [
        ['mark', 42, ''],
        ['increment', {
            phone: '15550001111',
            cardAssetId: 42,
            cardKey: 'CARD-KEY-001',
            cardNumber: '4859540146849186'
        }],
        ['release', { phoneAssetId: 7, cardAssetId: 42 }]
    ]);

    calls.length = 0;
    fakeStore.deleteCardAsset = async (payload) => {
        calls.push(['deleteCard', payload]);
    };

    await __test.settleRunProcessAssets(fakeStore, {
        cardAssetId: 43,
        phoneAssetId: 8,
        card: {
            key: 'CARD-KEY-002',
            number: '4111111111111111'
        }
    }, {
        success: false,
        deleteCard: true
    });

    assert.deepStrictEqual(calls, [
        ['deleteCard', {
            cardAssetId: 43,
            cardKey: 'CARD-KEY-002',
            cardNumber: '4111111111111111'
        }],
        ['release', { phoneAssetId: 8, cardAssetId: 43 }]
    ]);

    console.log('test_run_process_asset_settlement passed');
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
