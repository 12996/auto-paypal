const { testToken } = require('./generate-test-token');
const axios = require('axios');

async function checkGlobalConfig() {
    console.log('🔍 检查全局邮箱配置...');

    try {
        const response = await axios.get('http://localhost:3000/api/admin/config', {
            headers: {
                'Authorization': `Bearer ${testToken}`
            }
        });

        const config = response.data?.config || {};
        console.log('📋 全局配置:');
        console.log('  pool_email_enabled:', config.pool_email_enabled);
        console.log('  pool_email_imap_host:', config.pool_email_imap_host);
        console.log('  pool_email_include_junk:', config.pool_email_include_junk);
        console.log('  email_source:', config.email_source);

        console.log('\n🔍 分析:');
        if (config.pool_email_imap_host && config.pool_email_imap_host.includes('mail.chatai.codes')) {
            console.log('✅ 全局配置使用 mail.chatai.codes API代理模式');
            console.log('💡 这解释了为什么日志显示通过 mail.chatai.codes 获取验证码');
        } else {
            console.log('❌ 全局配置使用 IMAP直连模式:', config.pool_email_imap_host);
        }

        return config;
    } catch (error) {
        console.error('❌ 获取全局配置失败:', error.message);
        if (error.response) {
            console.error('📡 响应状态:', error.response.status);
            console.error('📡 响应数据:', error.response.data);
        }
        return null;
    }
}

checkGlobalConfig();