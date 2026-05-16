const store = require('./mysql-store');
const {
    getCardMessage,
    formatCardForDatabase
} = require('./get_card_message');

const DEFAULT_MAX_EXCHANGE_ATTEMPTS = 3;

function hasUsablePhone(assets) {
    return Boolean(assets?.phone?.phone && assets.phone.phone !== '未配置');
}

function hasReadyCard(assets) {
    return Boolean(assets?.card?.number && assets?.card?.expiry && assets?.card?.cvc);
}

function buildRuntimeCard(cardKey, dbData) {
    return {
        key: cardKey,
        number: String(dbData.CARD_NUMBER || ''),
        expiry: String(dbData.CARD_EXPIRY || ''),
        cvc: String(dbData.CARD_CVC || ''),
        billing_country: String(dbData.BILLING_COUNTRY || ''),
        billing_address: String(dbData.BILLING_ADDRESS || ''),
        billing_city: String(dbData.BILLING_CITY || ''),
        billing_state: String(dbData.BILLING_STATE || ''),
        billing_zip: String(dbData.BILLING_ZIP || ''),
        billing_name: String(dbData.BILLING_NAME || ''),
        card_sms: String(dbData.card_sms || ''),
        usage_count: 0
    };
}

function validateCardDatabaseData(dbData) {
    const missing = [];
    if (!dbData.CARD_NUMBER) missing.push('CARD_NUMBER');
    if (!dbData.CARD_EXPIRY) missing.push('CARD_EXPIRY');
    if (!dbData.CARD_CVC) missing.push('CARD_CVC');
    return missing;
}

function formatExchangeError(error) {
    const message = error && error.message ? error.message : String(error || '未知错误');
    return `兑换异常：${message}`.slice(0, 2000);
}

async function exchangeOneCard({
    ownerKey,
    storeApi,
    requestCard,
    formatCard,
    recordsDir
}) {
    const reserved = await storeApi.reserveUnregisteredCardAsset(ownerKey);
    if (!reserved?.cardAssetId || !reserved?.card?.key) {
        return null;
    }

    try {
        const result = await requestCard(reserved.card.key, {
            live: true,
            recordsDir
        });
        const record = result?.record || result;
        const dbData = formatCard(record);
        const missing = validateCardDatabaseData(dbData);
        if (missing.length) {
            throw new Error(`兑换结果缺少字段: ${missing.join(', ')}`);
        }

        await storeApi.markCardAssetRegistered(reserved.cardAssetId, {
            ...dbData,
            remark: ''
        });

        return {
            cardAssetId: reserved.cardAssetId,
            card: buildRuntimeCard(reserved.card.key, dbData)
        };
    } catch (error) {
        await storeApi.markCardAssetExchangeFailed(reserved.cardAssetId, formatExchangeError(error));
        await storeApi.releaseRuntimeAssets({ cardAssetId: reserved.cardAssetId }).catch(() => { });
        return { failed: true };
    }
}

async function ensureRuntimeAssets(options = {}) {
    const ownerKey = String(options.ownerKey || '');
    const storeApi = options.store || store;
    const requestCard = options.getCardMessage || getCardMessage;
    const formatCard = options.formatCardForDatabase || formatCardForDatabase;
    const maxExchangeAttempts = Math.max(1, Number(options.maxExchangeAttempts || DEFAULT_MAX_EXCHANGE_ATTEMPTS));

    const assets = await storeApi.reserveRuntimeAssets(ownerKey);
    if (!hasUsablePhone(assets) || hasReadyCard(assets)) {
        return assets;
    }

    for (let attempt = 1; attempt <= maxExchangeAttempts; attempt += 1) {
        const exchanged = await exchangeOneCard({
            ownerKey: `${ownerKey}:card:${attempt}`,
            storeApi,
            requestCard,
            formatCard,
            recordsDir: options.recordsDir
        });

        if (!exchanged) {
            return assets;
        }
        if (exchanged.cardAssetId && exchanged.card) {
            return {
                ...assets,
                cardAssetId: exchanged.cardAssetId,
                card: exchanged.card
            };
        }
    }

    return assets;
}

module.exports = {
    ensureRuntimeAssets,
    __test: {
        hasUsablePhone,
        hasReadyCard,
        validateCardDatabaseData,
        formatExchangeError
    }
};
