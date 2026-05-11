const { testToken } = require('./generate-test-token');
const axios = require('axios');

async function updateEmailConfig() {
    console.log('🔧 更新邮箱配置...');

    // 请填入你的实际凭证
    const config = {
        email: 'kwqdedgsd226688@outlook.com',  // 邮箱账号（如需修改）
        password: 'jhabk273641',        // 邮箱登录密码
        clientId: '9e5f94bc-e8a4-4e73-b8be-63364c29d753',       // OAuth2应用ID
        refreshToken: 'M.C505_SN1.0.U.-CiuxwxULqVxdBOF9treoL!bMhhvgQFYIoQ1gnwcj2U0QwpCTLXlSLonfbcKs7lbJN85tucT5cAgVsJ9zV72a8WdIZKrqp8jh2zX9uX!GrjmXIMV2oV4uqCD*!SUO8tid9Dy6AJiyKQG2hVhHvNFvPrNGpIpJ0!I4rCEJ05e1gUMknmd2EJPvT*k2ZGMWAxRle6L4cxfAYUP198xWvuqBPTLYo2QY4AlPsqWpIO0zcuDfkXq!w2vqS0PiqHzpbOO48qfjq0tkqTeWJBqyEYI2dFxUHIrNuSQHP*28CPDkLDEwO3xsJUqo*cTu07qiU68vf4!bzsV43g1DuIXjtFkjf0I0*Fe1dHpUUu0XfCI3ct4n!Qc4iqY0UulvFB2spi10TOALqT*XbnwsyvKhHLpkAyjQz6sp4A88X16Soobno8qaMnU1xa42F2obBkOc10Hn0CoUlLr7vz0vHB5hvqSSJ1g$' // OAuth2刷新令牌
    };

    try {
        const response = await axios.put('http://localhost:3000/api/admin/pool-emails/1', config, {
            headers: {
                'Authorization': `Bearer ${testToken}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('✅ 配置更新成功!');
        console.log('📋 响应:', response.data);

        // 验证更新结果
        const checkResponse = await axios.get('http://localhost:3000/api/admin/pool-emails/1', {
            headers: {
                'Authorization': `Bearer ${testToken}`
            }
        });

        const emailConfig = checkResponse.data;
        console.log('\n📧 更新后的配置:');
        console.log('  邮箱:', emailConfig.email);
        console.log('  有密码:', !!emailConfig.password);
        console.log('  有ClientId:', !!emailConfig.clientId);
        console.log('  有RefreshToken:', !!emailConfig.refreshToken);

    } catch (error) {
        console.error('❌ 更新失败:', error.message);
        if (error.response) {
            console.error('📡 响应状态:', error.response.status);
            console.error('📡 响应数据:', error.response.data);
        }
    }
}

updateEmailConfig();