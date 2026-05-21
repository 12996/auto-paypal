const assert = require('assert');

const { ensureRuntimeAssets } = require('../card_asset_registrar');

(async () => {
    const calls = [];
    let inserted = null;

    const store = {
        reserveRuntimePhoneAssets: async () => ({
            phoneAssetId: 7,
            phone: { phone: '15551234567', key: 'sms-key', usage_count: 0 },
            card: { number: '', expiry: '', cvc: '', usage_count: 0 },
            proxy: ''
        }),
        reserveRuntimeAssets: async () => {
            throw new Error('should not query card_assets before requesting a new card');
        },
        reserveUnregisteredCardAsset: async () => null,
        insertRegisteredCardAsset: async (cardData, options) => {
            inserted = { cardData, options };
            return 42;
        }
    };

    const assets = await ensureRuntimeAssets({
        ownerKey: 'job-direct-card',
        store,
        getCardMessage: async (key, options) => {
            calls.push({ key, options });
            return { record: { key: 'meiguodizhi-test-record' } };
        },
        formatCardForDatabase: () => ({
            CARD_NUMBER: '4916248669944514',
            CARD_EXPIRY: '1228',
            CARD_CVC: '223',
            BILLING_COUNTRY: 'US',
            BILLING_ADDRESS: '2979 Marietta Street',
            BILLING_CITY: 'Oakland',
            BILLING_STATE: 'CA',
            BILLING_ZIP: '94612',
            BILLING_NAME: 'Suntech Mailer',
            card_sms: ''
        })
    });

    assert.strictEqual(calls.length, 1, 'should request a card directly when no ready card exists');
    assert.strictEqual(calls[0].key, '', 'direct card request should not require a card key');
    assert.strictEqual(inserted.cardData.card_key, 'meiguodizhi-test-record');
    assert.strictEqual(inserted.cardData.CARD_NUMBER, '4916248669944514');
    assert.strictEqual(inserted.options.ownerKey, 'job-direct-card:card:1');
    assert.strictEqual(assets.cardAssetId, 42);
    assert.strictEqual(assets.card.number, '4916248669944514');
    assert.strictEqual(assets.card.key, 'meiguodizhi-test-record');

    console.log('test_card_asset_direct_exchange passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
