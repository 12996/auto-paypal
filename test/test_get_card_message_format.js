const assert = require('assert');

const {
    formatCardForDatabase,
    normalizeCardExpiryForDatabase
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

console.log('test_get_card_message_format passed');
