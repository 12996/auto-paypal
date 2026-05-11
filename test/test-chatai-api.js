const axios = require('axios');

async function testChataiCodesApi() {
    try {
        const resp = await axios.post('https://mail.chatai.codes/api/fetch-imap', {
            email: 'your-email@outlook.com',  // 替换为实际邮箱
            clientId: 'your-client-id',       // 替换为实际clientId
            refreshToken: 'your-refresh-token', // 替换为实际refreshToken
            keyword: 'openai',
            limit: 5
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000
        });

        console.log('API响应状态:', resp.status);
        console.log('邮件数量:', resp.data?.emails?.length || 0);

        if (resp.data?.emails?.length > 0) {
            const email = resp.data.emails[0];
            console.log('最新邮件:');
            console.log('- 主题:', email.subject);
            console.log('- 发件人:', email.from);
            console.log('- 正文预览:', email.bodyText?.substring(0, 100) + '...');

            // 测试验证码提取
            const codes = email.bodyText?.match(/\b(\d{6})\b/g) || [];
            console.log('找到的6位数字:', codes);
        }

    } catch (error) {
        console.error('API测试失败:', error.message);
    }
}

testChataiCodesApi();