const assert = require('assert');

async function run() {
    const registrar = require('../card_asset_registrar');
    assert.strictEqual(typeof registrar.ensureRuntimeAssets, 'function');

    const readyCalls = [];
    const readyAssets = {
        phoneAssetId: 1,
        cardAssetId: 2,
        phone: { phone: '15550001111', key: 'sms-key' },
        card: { key: 'READY-KEY', number: '4859540146849186', expiry: '03/30', cvc: '378' },
        proxy: 'proxy'
    };
    const readyResult = await registrar.ensureRuntimeAssets({
        ownerKey: 'owner-ready',
        store: {
            async reserveRuntimeAssets(ownerKey) {
                readyCalls.push(['reserveRuntimeAssets', ownerKey]);
                return readyAssets;
            }
        },
        getCardMessage: async () => {
            throw new Error('should not exchange when a ready card exists');
        }
    });

    assert.strictEqual(readyResult, readyAssets);
    assert.deepStrictEqual(readyCalls, [['reserveRuntimeAssets', 'owner-ready']]);

    const calls = [];
    const exchangedResult = await registrar.ensureRuntimeAssets({
        ownerKey: 'owner-exchange',
        store: {
            async reserveRuntimeAssets(ownerKey) {
                calls.push(['reserveRuntimeAssets', ownerKey]);
                return {
                    phoneAssetId: 7,
                    cardAssetId: null,
                    phone: { phone: '15550002222', key: 'sms-key-2' },
                    card: { number: '', expiry: '', cvc: '' },
                    proxy: 'proxy-2'
                };
            },
            async reserveUnregisteredCardAsset(ownerKey) {
                calls.push(['reserveUnregisteredCardAsset', ownerKey]);
                return {
                    cardAssetId: 8,
                    card: { key: 'CARD-KEY-001' }
                };
            },
            async markCardAssetRegistered(cardAssetId, payload) {
                calls.push(['markCardAssetRegistered', cardAssetId, payload]);
            }
        },
        async getCardMessage(key, options) {
            calls.push(['getCardMessage', key, options.live]);
            return {
                record: {
                    json: {
                        content: {
                            card_number: '4859540146849186',
                            expiry_date: '03/30',
                            cvv: '378',
                            name: 'Test User',
                            address: '1 Main St,Los Angeles CA 90001,US',
                            sms_api: 'https://sms.example.test'
                        }
                    }
                }
            };
        },
        formatCardForDatabase(record) {
            return {
                CARD_NUMBER: record.json.content.card_number,
                CARD_EXPIRY: record.json.content.expiry_date,
                CARD_CVC: record.json.content.cvv,
                BILLING_COUNTRY: 'US',
                BILLING_ADDRESS: '1 Main St',
                BILLING_CITY: 'Los Angeles',
                BILLING_STATE: 'CA',
                BILLING_ZIP: '90001',
                BILLING_NAME: 'Test User',
                card_sms: 'https://sms.example.test'
            };
        }
    });

    assert.deepStrictEqual(exchangedResult.card, {
        key: 'CARD-KEY-001',
        number: '4859540146849186',
        expiry: '03/30',
        cvc: '378',
        billing_country: 'US',
        billing_address: '1 Main St',
        billing_city: 'Los Angeles',
        billing_state: 'CA',
        billing_zip: '90001',
        billing_name: 'Test User',
        card_sms: 'https://sms.example.test',
        usage_count: 0
    });
    assert.strictEqual(exchangedResult.cardAssetId, 8);
    assert.deepStrictEqual(calls.map((item) => item[0]), [
        'reserveRuntimeAssets',
        'reserveUnregisteredCardAsset',
        'getCardMessage',
        'markCardAssetRegistered'
    ]);
    assert.strictEqual(calls[2][2], true);
    assert.strictEqual(calls[3][2].remark, '');

    console.log('test_card_asset_registrar passed');
}

run().catch((error) => {
    console.error(error);
    process.exit(1);
});
