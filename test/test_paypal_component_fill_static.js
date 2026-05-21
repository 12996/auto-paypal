const assert = require('assert');
const fs = require('fs');
const path = require('path');

const indexJs = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');

function between(source, start, end) {
    const startIndex = source.indexOf(start);
    assert(startIndex >= 0, `missing start marker: ${start}`);
    const endIndex = source.indexOf(end, startIndex);
    assert(endIndex > startIndex, `missing end marker after ${start}: ${end}`);
    return source.slice(startIndex, endIndex);
}

function testPayPalUsesComponentFill() {
    assert(
        indexJs.includes('async function componentFillPayPalInput'),
        'index.js should expose a PayPal component input fill helper'
    );
    assert(
        indexJs.includes('async function componentSelectPayPalOption'),
        'index.js should expose a PayPal component select helper'
    );
    assert(
        indexJs.includes('function setPayPalComponentValue'),
        'PayPal component fill should set DOM values through a native value setter'
    );
    assert(
        indexJs.includes('HTMLInputElement.prototype'),
        'PayPal component fill should use the native input value setter for React-controlled fields'
    );
    assert(
        indexJs.includes('async function fillPayPalEmailFromVisibleCandidates'),
        'PayPal email fill should try visible email candidates until one verifies'
    );
    assert(
        indexJs.includes('const paypalFieldSelectors'),
        'PayPal payment form should define selector fallbacks for current PayPal DOM variants'
    );
    for (const selector of [
        'input[placeholder="Expiration date"]',
        'input[placeholder="CVV"]',
        'input[placeholder="Street address"]',
        'input[placeholder="ZIP code"]'
    ]) {
        assert(
            indexJs.includes(selector),
            `PayPal payment form selector fallbacks should include ${selector}`
        );
    }
    assert(
        indexJs.includes('LEGACY_PAYPAL_MANUAL_FILL_FLOW'),
        'legacy PayPal manual-fill flow should be preserved as a source comment'
    );

    const payPalFillBlock = between(
        indexJs,
        'console.log("📝 [步骤] 正在组件填充 PayPal 账单信息...");',
        'const agreeAccountBtn = page.getByRole'
    );
    const payPalEmailBlock = between(
        indexJs,
        'console.log("📝 [步骤] 正在填写 PayPal 登录邮箱...");',
        'const continueBtn = page.getByRole'
    );

    assert(
        payPalEmailBlock.includes('fillPayPalEmailFromVisibleCandidates(page, emailSelectors, CONFIG.billing.email)'),
        'PayPal login email should try fillable visible candidates instead of trusting the first visible input'
    );
    assert(
        !payPalEmailBlock.includes('await componentFillPayPalInput(page, emailInput'),
        'PayPal login email should not fill only the first visible email input'
    );

    const bannedPatterns = [
        /paypalFieldOrder/,
        /fillExpiryAndCvc/,
        /keyboard\.type\(billing\.expiry/,
        /keyboard\.type\(billing\.cvc/,
        /humanFillInput\(page,\s*page\.locator\('#cardNumber'\)/,
        /humanFillInput\(page,\s*page\.locator\('#firstName'\)/,
        /humanFillInput\(page,\s*page\.locator\('#lastName'\)/,
        /humanFillInput\(page,\s*page\.locator\('#password'\)/
    ];

    for (const pattern of bannedPatterns) {
        assert(
            !pattern.test(payPalFillBlock),
            `PayPal component-fill block should not contain legacy manual-fill pattern: ${pattern}`
        );
    }

    for (const key of ['cardNumber', 'expiry', 'cvc', 'firstName', 'lastName', 'password']) {
        assert(
            payPalFillBlock.includes(`await fillRequiredPayPalField('${key}'`),
            `PayPal component-fill block should fill ${key} through selector fallbacks`
        );
    }
    assert(
        !payPalFillBlock.includes("componentFillPayPalInput(page, page.locator('#expiryDate')"),
        'PayPal expiry should not depend on only #expiryDate'
    );
}

testPayPalUsesComponentFill();
console.log('test_paypal_component_fill_static passed');
