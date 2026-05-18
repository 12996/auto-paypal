const { request: playwrightRequest } = require('playwright');

const CHECKOUT_URL = 'https://chatgpt.com/backend-api/payments/checkout';
const HOME_URL = 'https://chatgpt.com';
const DEFAULT_PROXY_URL = 'http://127.0.0.1:7891';
const COOKIE_STRING = '__Host-next-auth.csrf-token=576edee1512678dc261872fbd60239f65c5f4dcc3ba2d9f8ae41c0c8619196dd%7C02c117fb21e8c0437da8186941c6f2043dcf5c613936581055687037395d5e85; __Secure-next-auth.callback-url=https%3A%2F%2Fchatgpt.com; oai-did=068455e1-4498-42fb-ad71-159b55e1a17c; oai-chat-web-route="ChExMC4xMjkuMjM3LjQ6MzAwMBCpyqUB"; __cflb=0H28vzvP5FJafnkHxih9yVdfomkZWy8bjCQawKou5Ky; _cfuvid=5IvHQoEMr1rSMWqlCFgse2ZM9.pVaBDe3ajyDebPJJg-1778807241.2676063-1.0.1.1-WbwVdYa0JuQwJGi.QWlk7BYokGwlbTv1vyQlwjsQrxg; cf_clearance=o0wYNz1kPEaPKkeOhSlda_tw6T_L7cF2QzUyzzDBtlo-1778807300-1.2.1.1-gNbHLFfS.0M99DTCpGnyUNdUnQ_EoKb1ondrkTSqfGL58WQBe7LFh5CtpiWNmpmUPmScglRQk5FHjZS2lNLYWPcx4.EsI6UTOTstbyaa3X4f3N0ilAGC0_XcAXxYZRFtOUrbTz3V82MHmY1_B_292R9LwyUxsNEVDKMeT_eHa82_WQzuyUHSY2Ebji8O5Cr41KeH3e1A7H9P1f285y79DRoW3_bEq4dfo7zF3bT_iDyBklK8sylno06AdWM.d35cabJDgNydHZkkKYAZ.FWR5pZXItBdZ81B_hLD5nzr48e5eONuXqwpIYtrlNh2cPbNbwosIfpj48nD3iS6SLckCA; __cf_bm=946OiSA5gYQH0e5ueuVA1Lo__j0v5AcgnlTg0IYx2f0-1778807298.499703-1.0.1.1-Cse4M9C4Kio01yfLAL.RATy3V0ytozErsZVhQ1f9pP_zP7h6HvSE2w1Lm6d2ZtzfMJ2g_4BIqNB5cJxNAlUlBObck2e5vM.95D4x_Y_wokHrCWAtNa14OUSpIgKM2iXW; _dd_s=aid=daac6713-cc40-4c50-b16f-a2e9da35ef2d&rum=0&expire=1778808205993&logs=1&id=eb01ecd2-1f3e-4108-b8a5-7517dc8d2de6&created=1778807305993';

function buildCheckoutPayload() {
    return {
        plan_name: 'chatgptplusplan',
        billing_details: {
            country: 'US',
            currency: 'USD',
        },
        cancel_url: 'https://chatgpt.com/#pricing',
        promo_campaign: {
            promo_campaign_id: 'plus-1-month-free',
            is_coupon_from_query_param: false,
        },
        checkout_ui_mode: 'hosted',
        payment_method_types: ['paypal'],
    };
}

function buildHeaders(token) {
    return {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        accept: 'application/json, text/plain, */*',
        origin: 'https://chatgpt.com',
        referer: 'https://chatgpt.com/gpts',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        cookie: COOKIE_STRING,
    };
}

function isHtmlResponse(content) {
    const trimmed = String(content || '').trim().toLowerCase();
    return trimmed.startsWith('<!doctype html>') || trimmed.startsWith('<html');
}

function parseJsonOrRaw(content) {
    try {
        return JSON.parse(content);
    } catch {
        return { raw: content };
    }
}

class ChatGPTService {
    constructor(request, token) {
        this.request = request;
        this.token = token;
        this.proxyUrl = DEFAULT_PROXY_URL;
        this.maxRetries = 3;  // 最大重试次数
    }

    /**
     * 获取支付链接（通过外部 API）
     */
    async getPayPalApprovalUrl() {
        try {
            const payUrl = await this._createOrder();
            if (!payUrl) return null;

            console.log(`✅ 支付链接已生成`);
            return payUrl;
        } catch (e) {
            console.error("[-] 获取支付链接异常:", e.message);
            return null;
        }
    }

    /**
     * 创建订单 - 调用 ChatGPT checkout API 获取支付链接
     * 自动重试最多 3 次
     */
    async _createOrder() {
        let lastError = null;
        const normalizedToken = String(this.token || '').trim();

        if (!normalizedToken) {
            console.error(`[-] 订单创建失败: 缺少 token 参数`);
            return null;
        }

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            let apiContext = null;

            try {
                console.log(`[订单] 正在创建订单 (第 ${attempt}/${this.maxRetries} 次尝试)...`);

                apiContext = await playwrightRequest.newContext({
                    proxy: { server: this.proxyUrl }
                });

                const headers = buildHeaders(normalizedToken);
                await apiContext.get(HOME_URL, {
                    headers: {
                        cookie: COOKIE_STRING,
                        'user-agent': headers['user-agent'],
                    },
                    timeout: 60000,
                });

                const response = await apiContext.post(CHECKOUT_URL, {
                    headers,
                    data: buildCheckoutPayload(),
                    timeout: 60000,
                });

                const statusCode = response.status();
                const content = await response.text();

                if (isHtmlResponse(content)) {
                    console.error(`[-] 订单创建失败: 遇到 Cloudflare 防护或其他 HTML 响应 (Status: ${statusCode})`);
                    console.error(`    响应预览: ${content.slice(0, 500)}`);
                    lastError = new Error('遇到 Cloudflare 防护或其他 HTML 响应');

                    if (attempt < this.maxRetries) {
                        const waitMs = attempt * 2000;
                        console.log(`[订单] 等待 ${waitMs / 1000} 秒后重试...`);
                        await this._sleep(waitMs);
                    }
                    continue;
                }

                if (statusCode >= 400) {
                    const responseData = parseJsonOrRaw(content);
                    const message = responseData.message
                        || responseData.error
                        || `API 请求失败 (${statusCode})`;
                    console.error(`[-] 订单创建失败 (Status: ${statusCode})`);
                    console.error(`    响应: ${JSON.stringify(responseData)}`);
                    lastError = new Error(message);

                    if (/not_eligible|permission/i.test(String(message))) {
                        console.error("❌ [提示] 该账号无激活权限，请丢弃！(无激活权限)");
                        return null;
                    }

                    if (attempt < this.maxRetries) {
                        const waitMs = attempt * 2000;
                        console.log(`[订单] 等待 ${waitMs / 1000} 秒后重试...`);
                        await this._sleep(waitMs);
                    }
                    continue;
                }

                let data;
                try {
                    data = JSON.parse(content);
                } catch (error) {
                    console.error(`[-] 订单创建失败: JSON 解析失败: ${error.message}`);
                    console.error(`    响应: ${content.slice(0, 1000)}`);
                    lastError = error;

                    if (attempt < this.maxRetries) {
                        const waitMs = attempt * 2000;
                        console.log(`[订单] 等待 ${waitMs / 1000} 秒后重试...`);
                        await this._sleep(waitMs);
                    }
                    continue;
                }

                // 提取支付链接
                const payUrl = data.url || data.stripe_hosted_url || data.checkout_url;
                if (!payUrl) {
                    console.error(`[-] 订单创建失败: 响应中未找到支付链接`);
                    console.error(`    响应: ${JSON.stringify(data)}`);
                    lastError = new Error('响应中未找到支付链接');

                    if (attempt < this.maxRetries) {
                        const waitMs = attempt * 2000;
                        console.log(`[订单] 等待 ${waitMs / 1000} 秒后重试...`);
                        await this._sleep(waitMs);
                    }
                    continue;
                }

                console.log(`✅ 订单创建成功`);
                return payUrl;

            } catch (e) {
                console.error(`[-] 订单创建异常 (第 ${attempt} 次): ${e.message}`);
                lastError = e;

                if (attempt < this.maxRetries) {
                    const waitMs = attempt * 2000;
                    console.log(`[订单] 等待 ${waitMs / 1000} 秒后重试...`);
                    await this._sleep(waitMs);
                }
            } finally {
                if (apiContext) {
                    await apiContext.dispose().catch(() => {});
                }
            }
        }

        // 3 次都失败
        console.error(`❌ [提示] 订单创建失败，已重试 ${this.maxRetries} 次: ${lastError?.message || '未知错误'}`);
        return null;
    }

    /**
     * 延时工具函数
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = ChatGPTService;
