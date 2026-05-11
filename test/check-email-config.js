const { testToken } = require('./generate-test-token');
const axios = require('axios');

async function checkEmailConfig() {
    console.log('🔍 检查邮箱详细配置...');

    try {
        // 获取邮箱详细信息
        const response = await axios.get('http://localhost:3000/api/admin/pool-emails/1', {
            headers: {
                'Authorization': `Bearer ${testToken}`
            }
        });

        const emailConfig = response.data;
        console.log('📧 邮箱详细配置:');
        console.log('  ID:', emailConfig.id);
        console.log('  邮箱:', emailConfig.email);
        console.log('  Host:', emailConfig.host || '未设置');
        console.log('  密码:', emailConfig.password ? '已设置' : '未设置');
        console.log('  ClientId:', emailConfig.clientId || '未设置');
        console.log('  RefreshToken:', emailConfig.refreshToken ? '已设置' : '未设置');

        console.log('\n🔍 分析:');
        if (!emailConfig.host || emailConfig.host === 'outlook.office365.com') {
            console.log('❌ Host配置为IMAP直连模式，但缺少认证信息');
            console.log('💡 解决方案: 将host改为 mail.chatai.codes');
        } else if (emailConfig.host.includes('mail.chatai.codes')) {
            console.log('✅ Host配置为API代理模式');
            if (!emailConfig.clientId || !emailConfig.refreshToken) {
                console.log('❌ 但缺少API认证信息 (clientId/refreshToken)');
            }
        }

        return emailConfig;
    } catch (error) {
        console.error('❌ 获取邮箱配置失败:', error.message);
        return null;
    }
}

checkEmailConfig();