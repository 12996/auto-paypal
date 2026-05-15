const assert = require('assert');
const fs = require('fs');
const path = require('path');

const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
const CaliforniaFingerprint = require('../lib/california-fingerprint');

assert(
    Number.isInteger(CaliforniaFingerprint.DEFAULT_SCREEN?.width) &&
    Number.isInteger(CaliforniaFingerprint.DEFAULT_SCREEN?.height),
    'CaliforniaFingerprint should expose one default screen variable'
);

assert(
    indexSource.includes("process.env.STRICT_FINGERPRINT === '1'"),
    'index.js should guard the extra strict fingerprint injection behind STRICT_FINGERPRINT=1'
);

assert(
    indexSource.includes('context.request.get("http://api.ipify.org/?format=text"') ||
    indexSource.includes("context.request.get('http://api.ipify.org/?format=text'"),
    'index.js should keep the proxy connectivity check'
);

assert(
    /if\s*\(\s*launchOptions\.proxy\s*\)\s*\{[\s\S]*api\.ipify\.org\/\?format=text[\s\S]*代理连接成功/.test(indexSource),
    'proxy connectivity check should remain inside the launchOptions.proxy branch'
);

assert(
    !/auth\/validatecaptcha[\s\S]{0,500}route\.fulfill[\s\S]{0,500}<html><body><\/body><\/html>/.test(indexSource),
    'index.js should not blank out security challenge endpoints'
);

assert(
    !/const solveSlider[\s\S]*page\.mouse\.down\(/.test(indexSource),
    'index.js should not automatically drag security challenge sliders'
);

const seenProfiles = new Set();

for (let i = 0; i < 100; i += 1) {
    const config = CaliforniaFingerprint.generateRandomCaliforniaFingerprint();
    const options = CaliforniaFingerprint.getPlaywrightOptions(config);

    seenProfiles.add(config.profileId);

    if (config.platform === 'Win32') {
        assert(config.userAgent.includes('Windows NT 10.0'), 'Win32 profile should use a Windows UA');
        assert.strictEqual(config.platformName, 'Windows', 'Win32 profile should expose Windows Client Hints platform');
        assert.strictEqual(options.extraHTTPHeaders['sec-ch-ua-platform'], '"Windows"', 'Win32 profile should send Windows sec-ch-ua-platform');
    }

    if (config.platform === 'MacIntel') {
        assert(config.userAgent.includes('Macintosh'), 'MacIntel profile should use a macOS UA');
        assert.strictEqual(config.platformName, 'macOS', 'MacIntel profile should expose macOS Client Hints platform');
        assert.strictEqual(options.extraHTTPHeaders['sec-ch-ua-platform'], '"macOS"', 'MacIntel profile should send macOS sec-ch-ua-platform');
    }

    assert(config.profileId, 'generated fingerprint should identify the selected profile');
    assert(!config.userAgent.includes('Version/16.6 Safari'), 'Chromium automation profile should not emit Safari UA');
    assert(config.userAgent.includes(`Chrome/${config.chromeMajor}.`), 'Chrome major should match userAgent');
    assert(options.extraHTTPHeaders['sec-ch-ua'].includes(`"Chromium";v="${config.chromeMajor}"`), 'sec-ch-ua should match Chrome major');
    assert(config.timezoneOffset > 0, 'timezoneOffset should follow JS getTimezoneOffset sign convention');
    assert.deepStrictEqual(config.screen, CaliforniaFingerprint.DEFAULT_SCREEN, 'generated fingerprints should use DEFAULT_SCREEN');
    assert.strictEqual(options.viewport.width, config.screen.width, 'viewport width should match screen config');
    assert.strictEqual(options.viewport.height, config.screen.height, 'viewport height should match screen config');
    assert(config.webgl.vendor.includes('Google Inc.'), 'WebGL vendor should use a Chrome-compatible Google Inc. value');
    assert(Number.isInteger(config.hardwareConcurrency), 'hardwareConcurrency should be an integer');
    assert(Number.isInteger(config.deviceMemory), 'deviceMemory should be an integer');
    assert.deepStrictEqual(
        CaliforniaFingerprint.validateFingerprintConsistency(config, options),
        [],
        'generated fingerprint and Playwright options should be internally consistent'
    );
}

assert(seenProfiles.size >= 2, 'limited random generation should select from at least two complete profiles');

const languageConfig = {
    ...CaliforniaFingerprint.generateRandomCaliforniaFingerprint({ chromeVersion: '133.0.6943.16' }),
    languages: ['en-US', 'en', 'es']
};
const languageOptions = CaliforniaFingerprint.getPlaywrightOptions(languageConfig);
assert.strictEqual(
    languageOptions.extraHTTPHeaders['Accept-Language'],
    'en-US,en;q=0.9,es;q=0.8',
    'Accept-Language should be derived from config.languages'
);

const inconsistentConfig = CaliforniaFingerprint.generateRandomCaliforniaFingerprint({ chromeVersion: '133.0.6943.16' });
const inconsistentOptions = CaliforniaFingerprint.getPlaywrightOptions(inconsistentConfig);
inconsistentOptions.extraHTTPHeaders['sec-ch-ua'] = '"Not)A;Brand";v="8", "Chromium";v="148", "Google Chrome";v="148"';
inconsistentOptions.extraHTTPHeaders['Accept-Language'] = 'en-US,en;q=0.9,es;q=0.8';
const consistencyIssues = CaliforniaFingerprint.validateFingerprintConsistency(inconsistentConfig, inconsistentOptions);
assert(
    consistencyIssues.includes('sec-ch-ua chrome major does not match config.chromeMajor'),
    'consistency validator should catch Client Hints Chrome major mismatches'
);
assert(
    consistencyIssues.includes('Accept-Language does not match config.languages'),
    'consistency validator should catch language header mismatches'
);

(async () => {
    let capturedOptions = null;
    const fakeBrowser = {
        version: () => '133.0.6943.16',
        newContext: async (options) => {
            capturedOptions = options;
            return { addInitScript: async () => {} };
        }
    };

    const { config } = await CaliforniaFingerprint.createCaliforniaContext(fakeBrowser);

    assert.strictEqual(config.chromeMajor, 133, 'createCaliforniaContext should align Chrome major with browser.version()');
    assert(config.userAgent.includes('Chrome/133.'), 'context UA should use browser.version() Chrome major');
    assert(capturedOptions.extraHTTPHeaders['sec-ch-ua'].includes('"Chromium";v="133"'), 'context sec-ch-ua should use browser.version() Chrome major');
    assert.deepStrictEqual(config.fingerprintConsistencyIssues, [], 'created context should expose no fingerprint consistency issues');

    capturedOptions = null;
    const staleConfig = CaliforniaFingerprint.generateRandomCaliforniaFingerprint({ chromeVersion: '148.0.0.0' });
    const { config: alignedConfig } = await CaliforniaFingerprint.createCaliforniaContext(fakeBrowser, staleConfig);

    assert.strictEqual(alignedConfig.chromeMajor, 133, 'createCaliforniaContext should override stale FINGERPRINT_CONFIG Chrome major');
    assert(alignedConfig.userAgent.includes('Chrome/133.0.6943.16'), 'context UA should override stale FINGERPRINT_CONFIG Chrome version');
    assert(capturedOptions.extraHTTPHeaders['sec-ch-ua'].includes('"Chromium";v="133"'), 'context sec-ch-ua should override stale FINGERPRINT_CONFIG Chrome major');
    assert.deepStrictEqual(alignedConfig.fingerprintConsistencyIssues, [], 'aligned stale config should expose no fingerprint consistency issues');

    console.log('fingerprint guard checks passed');
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
