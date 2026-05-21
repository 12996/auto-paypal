const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin.html'), 'utf8');

assert.ok(
    html.includes('handlePoolEmailRegisteredChange'),
    'admin UI should expose a handler for changing pool email registered status'
);

assert.ok(
    /<select[^>]+onchange="handlePoolEmailRegisteredChange\(\$\{id\}, this\.value\)"/.test(html),
    'pool email registered status should be editable through a select'
);

assert.ok(
    html.includes('/messages?limit=5'),
    'pool email preview should request only the latest 5 messages'
);

assert.ok(
    html.includes('最近 5 封'),
    'pool email preview copy should tell admins only 5 messages are shown'
);

console.log('test_pool_email_admin_html_static passed');
