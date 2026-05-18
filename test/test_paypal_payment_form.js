/**
 * PayPal 支付信息页专项测试
 *
 * 用法:
 *   node test/test_paypal_payment_form.js "<PayPal signup URL>" [--submit]
 *
 * 说明:
 * - 从「已提交邮箱，进入支付信息填写页」之后开始验证支付表单填写。
 * - 如果页面仍停在 Create an Account / 邮箱页，会自动补齐到支付信息页。
 * - 默认只填表并校验，不点击最终的 Agree & Create Account。
 * - 需要真实提交表单时显式加 --submit。
 */

// 设置环境变量并启动 index.js
const env = {
    ...process.env,
    CHATGPT_TOKEN: token,
    HEADFUL: process.env.HEADFUL || '1',  // 默认显示浏览器

    // 真实的加州洛杉矶地址信息
    BILLING_COUNTRY: process.env.BILLING_COUNTRY || 'US',
    BILLING_ADDRESS: process.env.BILLING_ADDRESS || '15810 Gale Ave',
    BILLING_CITY: process.env.BILLING_CITY || 'Hacienda Heights',
    BILLING_STATE: process.env.BILLING_STATE || 'CA',
    BILLING_ZIP: process.env.BILLING_ZIP || '91745',
    BILLING_NAME: process.env.BILLING_NAME || 'DOMINIQUE CAMPBELL',
    BILLING_EMAIL: process.env.BILLING_EMAIL || '', // 会自动生成随机邮箱

    // 测试银行卡信息（Stripe 测试卡号）
    CARD_NUMBER: process.env.CARD_NUMBER || '4859540166445568',
    CARD_EXPIRY: process.env.CARD_EXPIRY || '02/30',
    CARD_CVC: process.env.CARD_CVC || '532',

    // PayPal 和短信
    PAYPAL_PASSWORD: process.env.PAYPAL_PASSWORD || "",
    SMS_API_KEY: process.env.SMS_API_KEY || 'http://a.62-us.com/api/get_sms?key=f8f47a39ee7d6bcccae09b6350a754ff',
    BILLING_PHONE: process.env.BILLING_PHONE || '8352755872'
};

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const CaliforniaFingerprint = require('../lib/california-fingerprint');
const debug = require('./debug_helper');

chromium.use(StealthPlugin());

const DEBUG_SCREENSHOT_DIR = path.join(__dirname, '..', 'debug_screenshots', 'paypal_payment_form');

function parseArgs(argv) {
    const args = {
        url: process.env.PAYPAL_SIGNUP_URL || '',
        submit: false,
        headless: process.env.HEADLESS === '1',
        keepOpen: false
    };

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--submit') {
            args.submit = true;
        } else if (arg === '--headless') {
            args.headless = true;
        } else if (arg === '--keep-open') {
            args.keepOpen = true;
        } else if (arg === '--url') {
            args.url = argv[i + 1] || '';
            i += 1;
        } else if (/^https?:\/\//i.test(arg)) {
            args.url = arg;
        }
    }

    return args;
}

function usageAndExit() {
    console.log(`
用法:
  node test/test_paypal_payment_form.js "<PayPal signup URL>" [--submit]

也可以通过环境变量传入:
  $env:PAYPAL_SIGNUP_URL="https://www.paypal.com/checkoutweb/signup?..."
  node test/test_paypal_payment_form.js

常用参数:
  --submit     填写并点击 Agree & Create Account
  --headless   无头模式运行
  --keep-open  测试结束后保持浏览器打开，便于观察

需要 .env 中已配置:
  BILLING_NAME, BILLING_EMAIL, BILLING_ADDRESS, BILLING_CITY,
  BILLING_STATE, BILLING_ZIP, CARD_NUMBER, CARD_EXPIRY, CARD_CVC,
  PAYPAL_PASSWORD
可选:
  BILLING_PHONE, PROXY, CHROMIUM_CHANNEL
`);
    process.exit(1);
}

function buildBilling() {
    return {
        name: process.env.BILLING_NAME || '',
        email: process.env.BILLING_EMAIL || '',
        address: process.env.BILLING_ADDRESS || '',
        city: process.env.BILLING_CITY || '',
        state: process.env.BILLING_STATE || '',
        zip: process.env.BILLING_ZIP || '',
        card: process.env.CARD_NUMBER || '',
        expiry: process.env.CARD_EXPIRY || '',
        cvc: process.env.CARD_CVC || '',
        phone: process.env.BILLING_PHONE || '',
        paypalPassword: process.env.PAYPAL_PASSWORD || ''
    };
}

function validateBilling(billing) {
    const required = [
        ['BILLING_NAME', billing.name],
        ['BILLING_EMAIL', billing.email],
        ['BILLING_ADDRESS', billing.address],
        ['BILLING_CITY', billing.city],
        ['BILLING_STATE', billing.state],
        ['BILLING_ZIP', billing.zip],
        ['CARD_NUMBER', billing.card],
        ['CARD_EXPIRY', billing.expiry],
        ['CARD_CVC', billing.cvc],
        ['PAYPAL_PASSWORD', billing.paypalPassword]
    ];

    const missing = required.filter(([, value]) => !String(value || '').trim()).map(([key]) => key);
    if (missing.length) {
        const error = new Error(`缺少必要环境变量: ${missing.join(', ')}`);
        error.code = 'MISSING_BILLING_ENV';
        error.missing = missing;
        throw error;
    }

    if (!billing.phone) {
        console.warn('⚠️ BILLING_PHONE 未配置；如果 PayPal 渲染手机号字段，将跳过填写。');
    }
}

function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function buildPlaywrightProxy(proxyValue) {
    if (!proxyValue) return null;

    try {
        const parsed = new URL(proxyValue);
        if (/^(127\.0\.0\.1|localhost)$/i.test(parsed.hostname) && parsed.port === '7897') {
            return { server: 'http://127.0.0.1:7897' };
        }

        const server = `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
        const proxy = { server };
        if (parsed.username) proxy.username = decodeURIComponent(parsed.username);
        if (parsed.password) proxy.password = decodeURIComponent(parsed.password);
        return proxy;
    } catch (_) {
        return { server: proxyValue };
    }
}

function forceEnglishPayPalLocaleUrl(rawUrl) {
    try {
        const url = new URL(rawUrl);
        const host = url.hostname.toLowerCase();
        if (host !== 'paypal.com' && host !== 'www.paypal.com') return rawUrl;

        url.searchParams.set('locale.x', 'en_US');
        url.searchParams.set('country.x', 'US');
        return url.toString();
    } catch (_) {
        return rawUrl;
    }
}

async function forcePayPalEnglishCookies(context) {
    await context.addCookies([
        {
            name: 'LANG',
            value: 'en_US%3BUS',
            domain: '.paypal.com',
            path: '/',
            secure: true,
            httpOnly: false,
            sameSite: 'Lax'
        },
        {
            name: 'cookie_check',
            value: 'yes',
            domain: '.paypal.com',
            path: '/',
            secure: true,
            httpOnly: false,
            sameSite: 'Lax'
        }
    ]).catch((error) => {
        console.warn(`⚠️ PayPal 英文 cookie 预设失败: ${error.message}`);
    });
}

async function createPage({ headless }) {
    const launchOptions = {
        headless,
        args: [
            '--disable-blink-features=AutomationControlled',
            '--lang=en-US'
        ]
    };

    if (headless) {
        launchOptions.args.push('--no-sandbox', '--disable-setuid-sandbox');
    }

    const channel = (process.env.CHROMIUM_CHANNEL || '').trim();
    if (channel) {
        launchOptions.channel = channel;
    }

    const proxy = buildPlaywrightProxy(process.env.PROXY || '');
    if (proxy) {
        launchOptions.proxy = proxy;
        console.log(`🌐 使用代理: ${proxy.server}`);
    }

    const browser = await chromium.launch(launchOptions);
    const fingerprintConfig = process.env.FINGERPRINT_CONFIG
        ? JSON.parse(process.env.FINGERPRINT_CONFIG)
        : CaliforniaFingerprint.generateRandomCaliforniaFingerprint();

    const { context, config } = await CaliforniaFingerprint.createCaliforniaContext(browser, fingerprintConfig);
    console.log(`🌴 使用 ${config.region} 指纹 (${config.hardwareConcurrency}核/${config.deviceMemory}GB)`);

    await forcePayPalEnglishCookies(context);
    await context.route('**/*', async (route) => {
        const request = route.request();
        if (request.resourceType() !== 'document') {
            return route.continue();
        }

        const forcedUrl = forceEnglishPayPalLocaleUrl(request.url());
        const headers = {
            ...request.headers(),
            'accept-language': 'en-US,en;q=0.9'
        };
        if (forcedUrl !== request.url()) {
            console.log(`[PayPal Locale] force en_US: ${request.url()} -> ${forcedUrl}`);
            return route.continue({ url: forcedUrl, headers });
        }
        return route.continue({ headers });
    });

    const page = await context.newPage();
    page.on('framenavigated', async (frame) => {
        if (frame !== page.mainFrame()) return;
        if (!/paypal\.com/i.test(frame.url())) return;

        const localeProbe = await page.evaluate(() => ({
            url: location.href,
            htmlLang: document.documentElement.lang,
            navLanguage: navigator.language,
            navLanguages: navigator.languages
        })).catch(() => null);
        if (localeProbe) {
            console.log(`[PayPal Locale] page=${JSON.stringify(localeProbe)}`);
        }
    });

    return { browser, context, page };
}

async function saveFailureArtifacts(page, name) {
    await debug.saveOnError(page, name).catch(() => null);
    fs.mkdirSync(DEBUG_SCREENSHOT_DIR, { recursive: true });
    const screenshotPath = path.join(DEBUG_SCREENSHOT_DIR, `${name}_${Date.now()}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => null);
    console.log(`📸 调试截图已保存: ${screenshotPath}`);
}

async function findVisible(page, selectors, timeoutMs = 500) {
    for (const selector of selectors) {
        const loc = page.locator(selector).first();
        if (await loc.isVisible({ timeout: timeoutMs }).catch(() => false)) {
            return loc;
        }
    }
    return null;
}

async function clickIfVisible(page, loc, label) {
    if (!loc || !(await loc.isVisible().catch(() => false))) return false;
    console.log(`🖱️ 点击: ${label}`);
    await loc.click({ force: true });
    await page.waitForTimeout(randomDelay(800, 1500));
    return true;
}

async function solveSlider(page) {
    const buttonSelectors = [
        "button:has-text('Confirm')",
        "button:has-text(\"I'm not a robot\")",
        "button:has-text('Verify')",
        "div.ctp-checkbox-container",
        "#challenge-stage",
        "iframe[title*='hCaptcha' i]",
        "iframe[title*='Turnstile' i]",
        "iframe[src*='hcaptcha']",
        "iframe[src*='turnstile']",
        "iframe[src*='recaptcha']"
    ];
    const sliderSelectors = [
        "#captcha__frame__bottom .slider",
        "#captcha__frame__bottom .sliderIcon",
        ".sliderContainer .slider",
        ".sliderContainer .sliderIcon",
        ".slider",
        ".sliderIcon",
        "[class*='slider']",
        "[class*='Slider']",
        "[data-testid*='slider']",
        "[aria-label*='slider' i]",
        "[role='slider']",
        "p:has-text('Move the slider all the way to the right')"
    ];
    const frames = () => [page, ...page.frames()];

    for (const frame of frames()) {
        for (const selector of buttonSelectors) {
            const loc = frame.locator(selector).first();
            if (!(await loc.isVisible({ timeout: 150 }).catch(() => false))) continue;

            console.log(`🧩 检测到验证按钮: ${selector}`);
            const box = await loc.boundingBox().catch(() => null);
            if (box) {
                await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
            } else {
                await loc.click({ timeout: 2000 }).catch(() => {});
            }
            await page.waitForTimeout(3000);
            return true;
        }
    }

    for (const frame of frames()) {
        for (const selector of sliderSelectors) {
            const slider = frame.locator(selector).first();
            if (!(await slider.isVisible({ timeout: 150 }).catch(() => false))) continue;

            const box = await slider.boundingBox().catch(() => null);
            if (!box) continue;

            console.log(`🧩 检测到滑块: ${selector}`);
            const container = frame
                .locator("#captcha__frame__bottom .sliderContainer, .sliderContainer, [class*='slider-container'], [class*='SliderContainer']")
                .first();
            const cBox = (await container.isVisible({ timeout: 200 }).catch(() => false))
                ? await container.boundingBox().catch(() => null)
                : null;
            const distance = cBox ? Math.max(0, cBox.width - box.width + 6) : 310;
            const startX = box.x + box.width / 2;
            const startY = box.y + box.height / 2;

            await page.mouse.move(startX, startY);
            await page.mouse.down();
            await page.waitForTimeout(400);
            for (let i = 1; i <= 25; i += 1) {
                const t = i / 25;
                const ease = 1 - Math.pow(1 - t, 3);
                await page.mouse.move(startX + distance * ease, startY + (Math.random() * 6 - 3));
                await page.waitForTimeout(Math.random() * 15 + 10);
            }
            await page.mouse.move(startX + distance + 5, startY + (Math.random() * 4 - 2));
            await page.waitForTimeout(800);
            await page.mouse.up();
            await page.waitForTimeout(2500);
            console.log('✅ 滑块处理完成。');
            return true;
        }
    }

    return false;
}

async function humanFillInput(page, locator, text, digitsMode = false, fastMode = false) {
    const digitsOnly = (value) => String(value || '').replace(/\D/g, '');
    const normalizeText = (value) => String(value || '').replace(/[\s()\-]/g, '').trim().toLowerCase();

    await locator.waitFor({ state: 'visible', timeout: 50000 });
    const existingValue = await locator.inputValue().catch(() => '');
    const alreadyCorrect = digitsMode
        ? digitsOnly(existingValue) === digitsOnly(text)
        : normalizeText(existingValue) === normalizeText(text);
    if (alreadyCorrect && existingValue) {
        console.log(`✓ 字段已有正确值: "${existingValue}"`);
        return;
    }

    const fillByPaste = digitsMode || fastMode;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
        const box = await locator.boundingBox().catch(() => null);
        if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: fillByPaste ? 12 : 20 });
            await page.waitForTimeout(randomDelay(120, 350));
        }

        await locator.click({ clickCount: 3 }).catch(() => {});
        await page.waitForTimeout(randomDelay(80, 180));

        if (fillByPaste) {
            await locator.fill(String(text)).catch(async () => {
                await page.keyboard.press('Control+A').catch(() => {});
                await page.keyboard.press('Delete').catch(() => {});
                await page.keyboard.type(String(text), { delay: 20 });
            });
        } else {
            await page.keyboard.press('Control+A').catch(() => {});
            await page.keyboard.press('Delete').catch(() => {});
            for (const char of String(text)) {
                await page.keyboard.type(char);
                await page.waitForTimeout(randomDelay(70, 180));
            }
        }

        await locator.evaluate((node) => {
            node.dispatchEvent(new Event('input', { bubbles: true }));
            node.dispatchEvent(new Event('change', { bubbles: true }));
            node.dispatchEvent(new Event('blur', { bubbles: true }));
        }).catch(() => {});
        await page.waitForTimeout(randomDelay(160, 360));

        const actualValue = await locator.inputValue().catch(() => '');
        const ok = digitsMode
            ? digitsOnly(actualValue) === digitsOnly(text)
            : normalizeText(actualValue) === normalizeText(text);
        if (ok) return;

        console.warn(`⚠️ 第 ${attempt} 次填写不一致，预期="${text}" 实际="${actualValue}"，重试。`);
    }
}

async function advanceToPaymentFormIfNeeded(page, billing) {
    if (await page.locator('#cardNumber').isVisible({ timeout: 1500 }).catch(() => false)) {
        return;
    }

    const createBtn = page.getByRole('button', { name: /Create an Account/i });
    await clickIfVisible(page, createBtn, 'Create an Account');

    const emailInput = await findVisible(page, [
        'input#login_email',
        'input[type="email"]',
        'input[name="login_email"]',
        'input[name="email"]'
    ], 1200);

    if (emailInput) {
        console.log('📝 正在填写 PayPal 登录邮箱...');
        await humanFillInput(page, emailInput, billing.email, false, true);
        const continueBtn = page.getByRole('button', { name: /Continue to Payment|Continue/i });
        await continueBtn.waitFor({ state: 'visible', timeout: 15000 });
        await page.waitForTimeout(randomDelay(800, 1500));
        await continueBtn.click({ force: true });
        console.log('✅ [步骤] 已提交邮箱，进入支付信息填写页。');
        await page.waitForTimeout(randomDelay(1800, 3200));
    }
}

async function waitForPaymentForm(page) {
    console.log('⏳ [步骤] 等待支付表单渲染（如有滑块将自动处理）...');
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
        const cardInput = await findVisible(page, ['#cardNumber', 'input[name="cardNumber"]', 'input[autocomplete="cc-number"]'], 800);
        if (cardInput) return cardInput;

        const solved = await solveSlider(page);
        if (solved) {
            await page.waitForTimeout(randomDelay(1500, 2500));
        } else {
            await page.waitForTimeout(800);
        }
    }

    await saveFailureArtifacts(page, 'paypal_card_input_missing');
    throw new Error('PayPal 卡号输入框 90 秒内未出现');
}

async function fillUntilSet(page, loc, value, label, options = {}) {
    if (!loc) {
        console.warn(`⚠️ PayPal ${label} 没找到可见字段，跳过`);
        return;
    }
    console.log(`📝 填写 ${label}: ${value}`);
    await humanFillInput(page, loc, value, Boolean(options.digitsMode), Boolean(options.fastMode));
}

async function fillPaymentForm(page, billing) {
    console.log('📝 [步骤] 正在填写 PayPal 支付表单...');
    await page.mouse.move(randomDelay(300, 700), randomDelay(200, 400), { steps: 15 });
    await page.waitForTimeout(randomDelay(400, 800));

    const nameParts = String(billing.name).trim().split(/\s+/);
    const firstName = nameParts.shift() || billing.name;
    const lastName = nameParts.join(' ') || firstName;

    const firstNameInput = await findVisible(page, ['#firstName', 'input[name="firstName"]']);
    const lastNameInput = await findVisible(page, ['#lastName', 'input[name="lastName"]']);
    const cardInput = await findVisible(page, ['#cardNumber', 'input[name="cardNumber"]']);
    const expiryInput = await findVisible(page, ['#expiryDate', 'input[name="expiryDate"]', 'input[autocomplete="cc-exp"]']);
    const cvcInput = await findVisible(page, ['#cvv', '#securityCode', 'input[name="cvv"]', 'input[autocomplete="cc-csc"]']);

    await fillUntilSet(page, firstNameInput, firstName, 'First Name');
    await page.waitForTimeout(randomDelay(300, 700));
    await fillUntilSet(page, lastNameInput, lastName, 'Last Name');
    await page.waitForTimeout(randomDelay(300, 700));
    await fillUntilSet(page, cardInput, billing.card, 'Card Number', { digitsMode: true });
    await page.waitForTimeout(randomDelay(300, 700));
    await fillUntilSet(page, expiryInput, billing.expiry, 'Expiry', { digitsMode: true });
    await page.waitForTimeout(randomDelay(300, 700));
    await fillUntilSet(page, cvcInput, billing.cvc, 'CVC', { digitsMode: true });

    const emailInput = await findVisible(page, ['#email', 'input[name="email"]'], 300);
    if (emailInput) {
        await fillUntilSet(page, emailInput, billing.email, 'Email', { fastMode: true });
    }

    const phoneInput = await findVisible(page, ['#phone', 'input[name="phone"]'], 300);
    if (phoneInput && billing.phone) {
        await fillUntilSet(page, phoneInput, billing.phone, 'Phone', { digitsMode: true });
    }

    console.log('✍️ [步骤] 正在输入地址并处理联想...');
    const addressInput = await findVisible(page, ['#billingLine1', 'input[name="billingLine1"]']);
    if (addressInput) {
        await fillUntilSet(page, addressInput, billing.address, 'Address');
        await page.waitForTimeout(randomDelay(700, 1300));
        const suggestion = page.locator('[class*="suggestion"], [class*="autocomplete"] li, .AddressAutocomplete-option').first();
        if (await suggestion.isVisible().catch(() => false)) {
            await page.keyboard.press('ArrowDown');
            await page.waitForTimeout(randomDelay(150, 300));
            await page.keyboard.press('Enter');
            console.log('✅ 地址联想已选择');
        } else {
            await page.keyboard.press('Tab').catch(() => {});
        }
    }

    await page.locator('#billingPostalCode, #billingCity, #billingState').first()
        .waitFor({ state: 'visible', timeout: 8000 })
        .catch(() => console.warn('⚠️ City/State/ZIP 8 秒内未完整渲染，继续兜底填写'));

    const cityInput = await findVisible(page, ['#billingCity', '#city', 'input[name="city"]', 'input[name="billingCity"]'], 500);
    await fillUntilSet(page, cityInput, billing.city, 'City');

    const stateInput = await findVisible(page, ['#billingState', '#state', 'select[name="state"]', 'select[name="billingState"]'], 500);
    if (stateInput) {
        console.log(`📝 选择 State: ${billing.state}`);
        await stateInput.selectOption({ value: billing.state }).catch(async () => {
            await stateInput.selectOption({ label: billing.state }).catch(() => {});
        });
        await stateInput.evaluate((node) => {
            node.dispatchEvent(new Event('change', { bubbles: true }));
            node.dispatchEvent(new Event('blur', { bubbles: true }));
        }).catch(() => {});
    } else {
        console.warn('⚠️ State 字段未找到，跳过');
    }

    const zipInput = await findVisible(page, ['#billingPostalCode', '#postalCode', '#zipCode', 'input[name="postalCode"]', 'input[name="zip"]'], 500);
    await fillUntilSet(page, zipInput, billing.zip, 'ZIP', { digitsMode: true });

    console.log('🔐 [步骤] 正在填写 PayPal 账户密码...');
    const passwordInput = await findVisible(page, ['#password', 'input[name="password"]']);
    await fillUntilSet(page, passwordInput, billing.paypalPassword, 'Password', { fastMode: true });

    console.log('🔍 [效验] 正在进行提交前数据完整性校验...');
    const checkFields = [
        { selector: '#cardNumber', expectedValue: billing.card, name: '银行卡号', digitsMode: true },
        { selector: '#expiryDate', expectedValue: billing.expiry, name: '有效期', digitsMode: true },
        { selector: '#cvv', expectedValue: billing.cvc, name: '安全码', digitsMode: true },
        { selector: '#email', expectedValue: billing.email, name: '邮箱' },
        { selector: '#password', expectedValue: billing.paypalPassword, name: '密码' }
    ];

    for (const field of checkFields) {
        const loc = page.locator(field.selector).first();
        if (!(await loc.isVisible().catch(() => false))) continue;

        const actualValue = await loc.inputValue().catch(() => '');
        const cleanActual = field.digitsMode
            ? actualValue.replace(/\D/g, '')
            : actualValue.replace(/[\s()\-]/g, '').toLowerCase();
        const cleanExpected = field.digitsMode
            ? String(field.expectedValue).replace(/\D/g, '')
            : String(field.expectedValue).replace(/[\s()\-]/g, '').toLowerCase();

        if (cleanActual === cleanExpected) {
            console.log(`✅ [效验通过] ${field.name}`);
        } else {
            console.warn(`⚠️ [效验失败] ${field.name}: 预期="${field.expectedValue}" 实际="${actualValue}"`);
        }
    }

    console.log('✅ [步骤] PayPal 支付表单填写完成。');
}

async function submitPaymentForm(page) {
    const submitBtn = page.getByRole('button', { name: /Agree & Create Account|Agree and Create Account/i });
    await submitBtn.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(randomDelay(1000, 2000));
    await submitBtn.click({ force: true });
    console.log('✅ [步骤] 创建账户协议已提交。');
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.url) usageAndExit();

    const billing = buildBilling();
    validateBilling(billing);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧪 PayPal 支付信息页专项测试');
    console.log(`🔗 URL: ${args.url.slice(0, 80)}${args.url.length > 80 ? '...' : ''}`);
    console.log(`🖱️ 提交模式: ${args.submit ? '开启，会点击 Agree & Create Account' : '关闭，仅填表校验'}`);
    console.log(`👀 浏览器: ${args.headless ? 'headless' : 'headful'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const { browser, page } = await createPage(args);
    try {
        console.log('🌐 打开 PayPal signup 页面...');
        await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});

        await advanceToPaymentFormIfNeeded(page, billing);
        await waitForPaymentForm(page);
        await fillPaymentForm(page, billing);

        if (args.submit) {
            await submitPaymentForm(page);
        } else {
            console.log('⏸️ 默认未提交。需要真实点击时请加 --submit。');
        }

        await saveFailureArtifacts(page, 'paypal_payment_form_done');

        if (args.keepOpen) {
            console.log('⏸️ --keep-open 已启用，按 Enter 关闭浏览器...');
            await new Promise((resolve) => process.stdin.once('data', resolve));
        }
    } catch (error) {
        console.error(`❌ 测试失败: ${error.message}`);
        await saveFailureArtifacts(page, 'paypal_payment_form_error');
        throw error;
    } finally {
        if (!args.keepOpen) {
            await browser.close().catch(() => {});
        }
    }
}

if (require.main === module) {
    main().catch((error) => {
        if (error && error.code === 'MISSING_BILLING_ENV') {
            console.error(`❌ 启动前检查失败: ${error.message}`);
            console.error('请在 .env 中补齐上述字段，或临时在当前 PowerShell 会话中设置。');
        } else if (error) {
            console.error(`❌ 测试异常退出: ${error.message}`);
        }
        process.exit(1);
    });
}

module.exports = {
    fillPaymentForm,
    waitForPaymentForm,
    advanceToPaymentFormIfNeeded
};
