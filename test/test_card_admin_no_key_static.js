const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');

assert.ok(
    html.includes('系统会在运行时直接请求接口获取银行卡信息'),
    'card admin page should explain that cards are fetched directly at runtime'
);

assert.ok(
    !html.includes("toggleImportBox('card_pool')"),
    'card admin page should not expose card-key batch import'
);

assert.ok(
    !html.includes("addAssetRow('card_pool')"),
    'card admin page should not expose manual card-key row creation'
);

assert.ok(
    !html.includes('card-key-input'),
    'card admin table should not render an editable card-key input'
);

assert.ok(
    !html.includes('id="card_import_text"'),
    'card admin page should not render the card-key import textarea'
);

console.log('test_card_admin_no_key_static passed');
