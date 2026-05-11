const axios = require('axios');

async function simpleDebugTest() {
    const config = {
        email: 'kwqdedgsd226688@outlook.com',
        clientId: '9e5f94bc-e8a4-4e73-b8be-63364c29d753',
        refreshToken: 'M.C505_SN1.0.U.-CiuxwxULqVxdBOF9treoL!bMhhvgQFYIoQ1gnwcj2U0QwpCTLXlSLonfbcKs7lbJN85tucT5cAgVsJ9zV72a8WdIZKrqp8jh2zX9uX!GrjmXIMV2oV4uqCD*!SUO8tid9Dy6AJiyKQG2hVhHvNFvPrNGpIpJ0!I4rCEJ05e1gUMknmd2EJPvT*k2ZGMWAxRle6L4cxfAYUP198xWvuqBPTLYo2QY4AlPsqWpIO0zcuDfkXq!w2vqS0PiqHzpbOO48qfjq0tkqTeWJBqyEYI2dFxUHIrNuSQHP*28CPDkLDEwO3xsJUqo*cTu07qiU68vf4!bzsV43g1DuIXjtFkjf0I0*Fe1dHpUUu0XfCI3ct4n!Qc4iqY0UulvFB2spi10TOALqT*XbnwsyvKhHLpkAyjQz6sp4A88X16Soobno8qaMnU1xa42F2obBkOc10Hn0CoUlLr7vz0vHB5hvqSSJ1g$'
    };

    try {
        console.log('🔍 测试API调用...');

        const resp = await axios.post('https://mail.chatai.codes/api/fetch-imap', {
            email: config.email,
            clientId: config.clientId,
            refreshToken: config.refreshToken,
            keyword: 'openai',
            limit: 5
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 60000
        });

        console.log('✅ API状态:', resp.status);
        console.log('📧 邮件数量:', resp.data?.emails?.length || 0);

        if (resp.data?.emails?.length > 0) {
            const email = resp.data.emails[0];
            console.log('\n📧 第一封邮件:');
            console.log('- 主题:', email.subject);
            console.log('- 发件人:', email.from);
            console.log('- 字段:', Object.keys(email));

            // 检查各种正文字段
            console.log('\n📝 正文字段检查:');
            console.log('- bodyText存在:', !!email.bodyText, '长度:', email.bodyText?.length || 0);
            console.log('- body存在:', !!email.body, '长度:', email.body?.length || 0);
            console.log('- text存在:', !!email.text, '长度:', email.text?.length || 0);
            console.log('- content存在:', !!email.content, '长度:', email.content?.length || 0);

            // 获取正文内容
            const bodyText = email.bodyText || email.body || email.text || email.content || '';
            console.log('\n📄 正文内容预览:');
            console.log(bodyText.substring(0, 300));

            // 查找验证码
            const codes = bodyText.match(/\b(\d{6})\b/g) || [];
            console.log('\n🔢 找到的6位数字:', codes);
        }

    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

simpleDebugTest();