const axios = require('axios');

// 支持两种 IMAP 服务：第三方服务和微软官方 IMAP
const IMAP_BASE_URL = 'https://imap.chiyiyi.cloud';

let cachedToken = null;
let tokenExpiry = null;

/**
 * 检查是否使用微软官方 IMAP
 */
function isUsingMicrosoftImap() {
    return !!(process.env.MICROSOFT_IMAP_EMAIL &&
              process.env.MICROSOFT_IMAP_PASSWORD &&
              process.env.MICROSOFT_IMAP_CLIENT_ID &&
              process.env.MICROSOFT_IMAP_REFRESH_TOKEN);
}

/**
 * 获取微软 IMAP 的 OAuth2 访问令牌
 */
async function getMicrosoftImapToken() {
    try {
        const params = new URLSearchParams();
        params.append('client_id', process.env.MICROSOFT_IMAP_CLIENT_ID);
        params.append('refresh_token', process.env.MICROSOFT_IMAP_REFRESH_TOKEN);
        params.append('grant_type', 'refresh_token');
        params.append('scope', 'https://outlook.office.com/IMAP.AccessAsUser.All offline_access');

        const response = await axios.post('https://login.microsoftonline.com/common/oauth2/v2.0/token', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        if (response.data && response.data.access_token) {
            cachedToken = response.data.access_token;
            // 设置 token 过期时间（通常为 1 小时）
            tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000; // 提前 1 分钟刷新
            console.log('✅ Microsoft IMAP token obtained successfully');
            return cachedToken;
        } else {
            throw new Error('Invalid response from Microsoft OAuth2 service');
        }
    } catch (error) {
        console.error('❌ Failed to get Microsoft IMAP token:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
        throw error;
    }
}

/**
 * 获取第三方 IMAP 服务的认证 token
 */
async function getThirdPartyImapToken() {
    try {
        const response = await axios.post(`${IMAP_BASE_URL}/api/admin/login`, {
            password: process.env.IMAP_ADMIN_PASSWORD
        });

        if (response.data && response.data.token) {
            cachedToken = response.data.token;
            // 设置 token 过期时间（假设 token 有效期为 1 小时）
            tokenExpiry = Date.now() + 60 * 60 * 1000;
            console.log('✅ Third-party IMAP token obtained successfully');
            return cachedToken;
        } else {
            throw new Error('Invalid response from IMAP auth service');
        }
    } catch (error) {
        console.error('❌ Failed to get third-party IMAP token:', error.message);
        throw error;
    }
}

/**
 * 获取 IMAP 服务的认证 token
 */
async function getImapAuthToken() {
    // 检查缓存的 token 是否还有效
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken;
    }

    // 根据配置选择认证方式
    if (isUsingMicrosoftImap()) {
        console.log('🔄 Using Microsoft IMAP authentication...');
        return await getMicrosoftImapToken();
    } else {
        console.log('🔄 Using third-party IMAP authentication...');
        return await getThirdPartyImapToken();
    }
}

/**
 * 获取带认证头的请求配置
 */
async function getImapAuthHeaders() {
    const token = await getImapAuthToken();

    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

/**
 * 获取微软 IMAP 连接配置
 */
function getMicrosoftImapConfig() {
    if (!isUsingMicrosoftImap()) {
        return null;
    }

    return {
        host: 'outlook.office365.com',
        port: 993,
        secure: true,
        auth: {
            user: process.env.MICROSOFT_IMAP_EMAIL,
            pass: process.env.MICROSOFT_IMAP_PASSWORD,
            // OAuth2 配置
            type: 'oauth2',
            clientId: process.env.MICROSOFT_IMAP_CLIENT_ID,
            refreshToken: process.env.MICROSOFT_IMAP_REFRESH_TOKEN
        }
    };
}

/**
 * 初始化 IMAP 连接（如果需要）
 */
async function initializeImap() {
    try {
        if (isUsingMicrosoftImap()) {
            console.log('📧 Initializing Microsoft IMAP connection...');
            const config = getMicrosoftImapConfig();
            console.log(`📧 Microsoft IMAP config: ${config.auth.user}@${config.host}:${config.port}`);

            // 测试获取 token
            await getImapAuthToken();
            console.log('✅ Microsoft IMAP initialization successful');
        } else if (process.env.IMAP_ADMIN_PASSWORD) {
            console.log('📧 Initializing third-party IMAP connection...');
            await getImapAuthToken();
            console.log('✅ Third-party IMAP initialization successful');
        } else {
            console.log('⚠️  No IMAP credentials configured. IMAP features will be disabled.');
        }
    } catch (error) {
        console.error('❌ IMAP initialization failed:', error.message);
        throw error;
    }
}

module.exports = {
    getImapAuthToken,
    getImapAuthHeaders,
    getMicrosoftImapConfig,
    isUsingMicrosoftImap,
    initializeImap
};