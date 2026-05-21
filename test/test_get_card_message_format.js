const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
    getCardMessage,
    formatCardForDatabase,
    normalizeCardExpiryForDatabase,
    parseArgs
} = require('../get_card_message');

assert.strictEqual(
    normalizeCardExpiryForDatabase('2030/4'),
    '0430',
    'YYYY/M expiry should normalize to MMYY'
);

assert.strictEqual(
    normalizeCardExpiryForDatabase('03/30'),
    '0330',
    'MM/YY expiry should normalize to MMYY'
);

assert.strictEqual(
    normalizeCardExpiryForDatabase('4/2030'),
    '0430',
    'M/YYYY expiry should normalize to MMYY'
);

const db = formatCardForDatabase({
    content: {
        card_number: '4859540134562064',
        expiry_date: '2030/4',
        cvv: '376',
        name: 'JUSTIN CALDWELL',
        address: '1501 SUMMITVIEW AVE APT 3,YAKIMA 989022974,US'
    }
});

assert.strictEqual(db.CARD_EXPIRY, '0430');

const parsedWithoutKey = parseArgs(['node', 'get_card_message.js', '--live']);
assert.strictEqual(parsedWithoutKey.live, true);
assert.ok(
    parsedWithoutKey.key.startsWith('meiguodizhi-'),
    'CLI should not require an API key for the new interface'
);

const meiguodizhiAddress = {
    Address: '2979  Marietta Street',
    Telephone: '510-520-2238',
    City: 'Oakland',
    Zip_Code: '94612',
    State: 'CA',
    Expires: '12/2028',
    Credit_Card_Number: '4916248669944514',
    CVV2: '223',
    Full_Name: 'Suntech Mailer'
};

const mappedDb = formatCardForDatabase({ address: meiguodizhiAddress });

assert.deepStrictEqual(
    mappedDb,
    {
        CARD_NUMBER: '4916248669944514',
        CARD_EXPIRY: '1228',
        CARD_CVC: '223',
        BILLING_COUNTRY: 'US',
        BILLING_ADDRESS: '2979  Marietta Street',
        BILLING_CITY: 'Oakland',
        BILLING_STATE: 'CA',
        BILLING_ZIP: '94612',
        BILLING_NAME: 'Suntech Mailer',
        card_sms: ''
    },
    'meiguodizhi address response should map to existing database fields'
);

(async () => {
    const recordsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'get-card-message-'));

    try {
        const result = await getCardMessage('TEST-KEY', {
            live: true,
            recordsDir,
            requestCard: async () => new Response(JSON.stringify({
                address: meiguodizhiAddress,
                status: 'ok'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            })
        });

        assert.strictEqual(result.source, 'live');
        assert.strictEqual(result.record.json.address.Credit_Card_Number, '4916248669944514');
        assert.strictEqual(result.record.json.content.card_number, '4916248669944514');
        assert.strictEqual(result.record.json.content.address, '2979  Marietta Street,Oakland CA 94612,US');
    } finally {
        fs.rmSync(recordsDir, { recursive: true, force: true });
    }

    console.log('test_get_card_message_format passed');
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
