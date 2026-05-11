const { fetchLatestOpenAiOtpOnce } = require('../pool-email-imap');

// 临时修改函数来输出调试信息
async function debugFetchLatestOpenAiOtpOnce(config) {
    const axios = require('axios');

    console.log('🔍 开始调试API调用...');

    try {
        const resp = await axios.post('https://mail.chatai.codes/api/fetch-imap', {
            email: config.email,
            clientId: config.clientId,
            refreshToken: config.refreshToken,
            keyword: 'openai',
            limit: 20
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000,
            validateStatus: () => true
        });

        console.log('📡 API响应状态:', resp.status);
        console.log('📡 API响应数据结构:', Object.keys(resp.data || {}));

        if (resp.status !== 200) {
            console.log('❌ API返回错误:', JSON.stringify(resp.data));
            return '';
        }

        const emails = Array.isArray(resp.data?.emails) ? resp.data.emails : (Array.isArray(resp.data) ? resp.data : []);
        console.log('📧 获取到邮件数量:', emails.length);

        if (emails.length > 0) {
            console.log('\n📧 邮件详情:');
            emails.forEach((email, index) => {
                console.log(`\n--- 邮件 ${index + 1} ---`);
                console.log('主题:', email.subject || '(无主题)');
                console.log('发件人:', email.from || '(无发件人)');
                console.log('日期:', email.date || '(无日期)');
                console.log('可用字段:', Object.keys(email));

                // 检查各种可能的正文字段
                const bodyText = email.bodyText || email.body || email.text || email.content || '';
                console.log('正文长度:', bodyText.length);
                console.log('正文预览:', bodyText.substring(0, 200) + (bodyText.length > 200 ? '...' : ''));

                // 检查是否符合OpenAI验证条件
                const haystack = `${email.subject || ''}\n${bodyText}`.toLowerCase();
                const isOpenAI = /openai|chatgpt|verification|verify|验证码/.test(haystack);
                console.log('是否符合OpenAI验证条件:', isOpenAI);

                // 提取6位数字
                const codes = bodyText.match(/\b(\d{6})\b/g) || [];
                console.log('找到的6位数字:', codes);
            });
        }

        // 调用原始函数进行对比
        console.log('\n🔄 调用原始函数...');
        const originalResult = await fetchLatestOpenAiOtpOnce(config);
        console.log('原始函数返回:', originalResult || '(空)');

        return originalResult;

    } catch (error) {
        console.error('❌ API调用失败:', error.message);
        return '';
    }
}

async function testEmailCodeFetch() {
    try {
        console.log('开始测试邮箱验证码获取...');

        // 从数据库或配置中获取邮箱凭证
        // 你需要替换为实际的邮箱配置
        const testConfig = {
            email: 'kwqdedgsd226688@outlook.com',  // 替换为实际邮箱
            password: 'M.C505_SN1.0.U.-CiuxwxULqVxdBOF9treoL!bMhhvgQFYIoQ1gnwcj2U0QwpCTLXlSLonfbcKs7lbJN85tucT5cAgVsJ9zV72a8WdIZKrqp8jh2zX9uX!GrjmXIMV2oV4uqCD*!SUO8tid9Dy6AJiyKQG2hVhHvNFvPrNGpIpJ0!I4rCEJ05e1gUMknmd2EJPvT*k2ZGMWAxRle6L4cxfAYUP198xWvuqBPTLYo2QY4AlPsqWpIO0zcuDfkXq!w2vqS0PiqHzpbOO48qfjq0tkqTeWJBqyEYI2dFxUHIrNuSQHP*28CPDkLDEwO3xsJUqo*cTu07qiU68vf4!bzsV43g1DuIXjtFkjf0I0*Fe1dHpUUu0XfCI3ct4n!Qc4iqY0UulvFB2spi10TOALqT*XbnwsyvKhHLpkAyjQz6sp4A88X16Soobno8qaMnU1xa42F2obBkOc10Hn0CoUlLr7vz0vHB5hvqSSJ1g$',  // 如果使用密码认证
            clientId: '9e5f94bc-e8a4-4e73-b8be-63364c29d753',  // 如果使用OAuth2
            refreshToken: 'M.C505_SN1.0.U.-CiuxwxULqVxdBOF9treoL!bMhhvgQFYIoQ1gnwcj2U0QwpCTLXlSLonfbcKs7lbJN85tucT5cAgVsJ9zV72a8WdIZKrqp8jh2zX9uX!GrjmXIMV2oV4uqCD*!SUO8tid9Dy6AJiyKQG2hVhHvNFvPrNGpIpJ0!I4rCEJ05e1gUMknmd2EJPvT*k2ZGMWAxRle6L4cxfAYUP198xWvuqBPTLYo2QY4AlPsqWpIO0zcuDfkXq!w2vqS0PiqHzpbOO48qfjq0tkqTeWJBqyEYI2dFxUHIrNuSQHP*28CPDkLDEwO3xsJUqo*cTu07qiU68vf4!bzsV43g1DuIXjtFkjf0I0*Fe1dHpUUu0XfCI3ct4n!Qc4iqY0UulvFB2spi10TOALqT*XbnwsyvKhHLpkAyjQz6sp4A88X16Soobno8qaMnU1xa42F2obBkOc10Hn0CoUlLr7vz0vHB5hvqSSJ1g$',  // 如果使用OAuth2
            host: 'mail.chatai.codes',  // 或 'outlook.office365.com'
            includeJunk: true,
            excludeCode: ''  // 排除的旧验证码
        };

        console.log(`测试邮箱: ${testConfig.email}`);
        console.log(`IMAP主机: ${testConfig.host}`);

        const code = await debugFetchLatestOpenAiOtpOnce(testConfig);

        if (code) {
            console.log(`✅ 成功获取验证码: ${code}`);
        } else {
            console.log('❌ 未找到验证码');
            console.log('可能的原因:');
            console.log('1. 邮箱中没有OpenAI验证邮件');
            console.log('2. 邮件不符合识别条件');
            console.log('3. API返回的邮件格式有问题');
            console.log('\n建议先测试API连通性: node test/test-chatai-api.js');
        }

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error('详细错误:', error);
    }
}

// 运行测试
testEmailCodeFetch();