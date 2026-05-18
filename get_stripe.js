'use strict';

const CHECKOUT_URL = 'https://chatgpt.com/backend-api/payments/checkout';
const HOME_URL = 'https://chatgpt.com';
const PROXY_URL = 'http://127.0.0.1:7897';

const COOKIE_STRING = '__Host-next-auth.csrf-token=576edee1512678dc261872fbd60239f65c5f4dcc3ba2d9f8ae41c0c8619196dd%7C02c117fb21e8c0437da8186941c6f2043dcf5c613936581055687037395d5e85; __Secure-next-auth.callback-url=https%3A%2F%2Fchatgpt.com; oai-did=068455e1-4498-42fb-ad71-159b55e1a17c; oai-chat-web-route="ChExMC4xMjkuMjM3LjQ6MzAwMBCpyqUB"; __cflb=0H28vzvP5FJafnkHxih9yVdfomkZWy8bjCQawKou5Ky; _cfuvid=5IvHQoEMr1rSMWqlCFgse2ZM9.pVaBDe3ajyDebPJJg-1778807241.2676063-1.0.1.1-WbwVdYa0JuQwJGi.QWlk7BYokGwlbTv1vyQlwjsQrxg; cf_clearance=o0wYNz1kPEaPKkeOhSlda_tw6T_L7cF2QzUyzzDBtlo-1778807300-1.2.1.1-gNbHLFfS.0M99DTCpGnyUNdUnQ_EoKb1ondrkTSqfGL58WQBe7LFh5CtpiWNmpmUPmScglRQk5FHjZS2lNLYWPcx4.EsI6UTOTstbyaa3X4f3N0ilAGC0_XcAXxYZRFtOUrbTz3V82MHmY1_B_292R9LwyUxsNEVDKMeT_eHa82_WQzuyUHSY2Ebji8O5Cr41KeH3e1A7H9P1f285y79DRoW3_bEq4dfo7zF3bT_iDyBklK8sylno06AdWM.d35cabJDgNydHZkkKYAZ.FWR5pZXItBdZ81B_hLD5nzr48e5eONuXqwpIYtrlNh2cPbNbwosIfpj48nD3iS6SLckCA; __cf_bm=946OiSA5gYQH0e5ueuVA1Lo__j0v5AcgnlTg0IYx2f0-1778807298.499703-1.0.1.1-Cse4M9C4Kio01yfLAL.RATy3V0ytozErsZVhQ1f9pP_zP7h6HvSE2w1Lm6d2ZtzfMJ2g_4BIqNB5cJxNAlUlBObck2e5vM.95D4x_Y_wokHrCWAtNa14OUSpIgKM2iXW; _dd_s=aid=daac6713-cc40-4c50-b16f-a2e9da35ef2d&rum=0&expire=1778808205993&logs=1&id=eb01ecd2-1f3e-4108-b8a5-7517dc8d2de6&created=1778807305993';

function buildError(message, upstreamStatus, extra = {}) {
  const payload = {
    status: 'error',
    message,
  };

  if (upstreamStatus !== undefined && upstreamStatus !== null) {
    payload.upstream_status = upstreamStatus;
  }

  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== null) {
      payload[key] = value;
    }
  }

  return payload;
}

function buildCheckoutPayload(plus) {
  if (plus) {
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

  return {
    mode: 'subscription',
    subscription_plan: 'chatgptteam_team_monthly',
    success_url: 'https://chatgpt.com/gpts',
    cancel_url: 'https://chatgpt.com/gpts',
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
  const trimmed = content.trim().toLowerCase();
  return trimmed.startsWith('<!doctype html>') || trimmed.startsWith('<html');
}

function parseJsonOrRaw(content) {
  try {
    return JSON.parse(content);
  } catch {
    return { raw: content };
  }
}

function createProcessRequest({ fetchImpl, dispatcher } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchImpl must be a function');
  }

  return async function processRequest(token, plus = true) {
    const normalizedToken = String(token || '').trim();

    if (!normalizedToken) {
      return buildError('缺少 token 参数');
    }

    const planIsPlus = Boolean(plus);
    const requestOptions = dispatcher ? { dispatcher } : {};

    try {
      await fetchImpl(HOME_URL, {
        ...requestOptions,
        method: 'GET',
        headers: {
          cookie: COOKIE_STRING,
          'user-agent': buildHeaders(normalizedToken)['user-agent'],
        },
      });

      const response = await fetchImpl(CHECKOUT_URL, {
        ...requestOptions,
        method: 'POST',
        headers: buildHeaders(normalizedToken),
        body: JSON.stringify(buildCheckoutPayload(planIsPlus)),
        redirect: 'follow',
      });

      const statusCode = response.status;
      const content = await response.text();

      if (isHtmlResponse(content)) {
        return buildError('遇到 Cloudflare 防护或其他 HTML 响应', statusCode, {
          html_preview: content.slice(0, 500),
        });
      }

      if (statusCode >= 400) {
        const responseData = parseJsonOrRaw(content);
        const message = responseData.message
          || responseData.error
          || `API 请求失败 (${statusCode})`;

        return buildError(message, statusCode, {
          response_data: responseData,
        });
      }

      let responseData;
      try {
        responseData = JSON.parse(content);
      } catch (error) {
        return buildError(`JSON 解析失败: ${error.message}`, undefined, {
          raw_response: content.slice(0, 1000),
        });
      }

      const paymentUrl = responseData.url
        || responseData.stripe_hosted_url
        || responseData.checkout_url;

      if (!paymentUrl) {
        return buildError('响应中未找到支付链接', statusCode, {
          response_data: responseData,
        });
      }

      return {
        status: 'success',
        message: `${planIsPlus ? 'Plus' : 'Team'} 套餐支付链接获取成功`,
        data: {
          payment_url: paymentUrl,
          plan_type: planIsPlus ? 'Plus' : 'Team',
        },
      };
    } catch (error) {
      return buildError(`请求失败: ${error.message}`);
    }
  };
}

function createDefaultProcessRequest() {
  let undici;
  try {
    undici = require('undici');
  } catch (error) {
    throw new Error('缺少依赖 undici，请先运行: npm install undici');
  }

  return createProcessRequest({
    fetchImpl: undici.fetch,
    dispatcher: new undici.ProxyAgent(PROXY_URL),
  });
}

async function processRequest(token, plus = true) {
  return createDefaultProcessRequest()(token, plus);
}

module.exports = {
  processRequest,
  createProcessRequest,
};
