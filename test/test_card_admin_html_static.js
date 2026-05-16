const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');

assert(
    html.includes('function renderReadonlyCell'),
    'card table should render non-editable CARD/BILLING fields as readonly cells'
);

assert(
    !html.includes('cardPool[${actualIndex}].number=this.value'),
    'CARD_NUMBER should not be editable in the card pool table'
);

assert(
    !html.includes('cardPool[${actualIndex}].billing_address=this.value'),
    'BILLING fields should not be editable in the card pool table'
);

assert(
    html.includes('normalizeCardForUi'),
    'frontend should normalize old backend card shape so card key is visible'
);

assert(
    html.includes('备注') && html.includes('item.remark'),
    'card table should display card remark for exchange errors'
);

assert(
    html.includes('卡状态') && html.includes('handleCardStatusChange') && html.includes('兑换异常'),
    'card table should let admins view and edit card status'
);

assert(
    html.includes('handlePhoneStatusChange') && html.includes('phonePool[index].status'),
    'phone table should let admins edit phone status instead of relying on automatic invalidation'
);

console.log('test_card_admin_html_static passed');
