const assert = require('assert');

async function main() {
    const playwrightPath = require.resolve('playwright');
    const chatgptPath = require.resolve('../chatgpt');
    const calls = [];
    const expectedUrl = 'https://pay.openai.com/c/pay/cs_live_test_1234567890abcdef#stripe-long-link';

    delete require.cache[chatgptPath];
    require.cache[playwrightPath] = {
        id: playwrightPath,
        filename: playwrightPath,
        loaded: true,
        exports: {
            request: {
                newContext: async (options) => {
                    calls.push({ method: 'NEW_CONTEXT', options });
                    return {
                        get: async (url, options) => {
                            calls.push({ method: 'GET', url, options });
                            return {
                                status: () => 200,
                                text: async () => '',
                            };
                        },
                        post: async (url, options) => {
                            calls.push({ method: 'POST', url, options });
                            return {
                                status: () => 200,
                                text: async () => JSON.stringify({ url: expectedUrl }),
                            };
                        },
                        dispose: async () => {
                            calls.push({ method: 'DISPOSE' });
                        },
                    };
                },
            },
        },
    };

    const ChatGPTService = require('../chatgpt');
    const service = new ChatGPTService(null, 'test-token');
    service.maxRetries = 1;

    const result = await service._createOrder();

    assert.strictEqual(result, expectedUrl);
    assert.deepStrictEqual(calls[0], {
        method: 'NEW_CONTEXT',
        options: { proxy: { server: 'http://127.0.0.1:7891' } },
    });
    assert.strictEqual(calls[1].method, 'GET');
    assert.strictEqual(calls[1].url, 'https://chatgpt.com');
    assert.strictEqual(calls[2].method, 'POST');
    assert.strictEqual(calls[2].url, 'https://chatgpt.com/backend-api/payments/checkout');
    assert.strictEqual(calls[2].options.headers.authorization, 'Bearer test-token');
    assert.strictEqual(calls[2].options.data.payment_method_types[0], 'paypal');
    assert.strictEqual(calls.at(-1).method, 'DISPOSE');

    console.log('test_chatgpt_create_order passed');
}

main().catch(error => {
    console.error(error.stack || error.message);
    process.exit(1);
});
