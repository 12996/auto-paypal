const { fetchLatestOpenAiOtpOnce } = require('../pool-email-imap');
const { testToken } = require('./generate-test-token');
const axios = require('axios');

async function testDirectOtpExtraction() {
    console.log('🔍 直接测试验证码提取功能...');

    try {
        // 1. 获取邮箱配置
        console.log('\n📋 步骤1: 获取邮箱配置...');
        const poolResponse = await axios.get('http://localhost:3000/api/admin/pool-emails', {
            headers: {
                'Authorization': `Bearer ${testToken}`
            }
        });

        const emails = poolResponse.data?.items || [];
        const targetEmail = emails.find(item => item.email === 'kwqdedgsd226688@outlook.com');

        if (!targetEmail) {
            console.log('❌ 未找到目标邮箱');
            return;
        }

        console.log('✅ 邮箱配置:');
        console.log('  ID:', targetEmail.id);
        console.log('  邮箱:', targetEmail.email);
        console.log('  Host:', targetEmail.host || '未设置');
        console.log('  有密码:', !!targetEmail.password);
        console.log('  有RefreshToken:', !!targetEmail.refreshToken);
        console.log('  ClientId:', targetEmail.clientId || '未配置');

        // 2. 分析配置模式
        console.log('\n🔍 配置模式分析:');
        const host = targetEmail.host || 'outlook.office365.com';
        const isApiMode = host.includes('mail.chatai.codes');

        console.log('Host:', host);
        console.log('模式:', isApiMode ? 'API代理模式' : 'IMAP直连模式');

        if (isApiMode) {
            console.log('✅ API模式 - 需要 clientId 和 refreshToken');
            if (!targetEmail.clientId || !targetEmail.refreshToken) {
                console.log('❌ 缺少API认证信息');
                return;
            }
        } else {
            console.log('✅ IMAP模式 - 需要 password 或 OAuth2');
            if (!targetEmail.password && !targetEmail.refreshToken) {
                console.log('❌ 缺少IMAP认证信息');
                return;
            }
        }

        // 3. 直接调用验证码提取函数
        console.log('\n🔢 步骤2: 直接调用验证码提取函数...');
        console.log('⏳ 正在调用 fetchLatestOpenAiOtpOnce...');

        const emailConfig = {
            email: targetEmail.email,
            password: targetEmail.password,
            clientId: targetEmail.clientId,
            refreshToken: targetEmail.refreshToken,
            host: host,
            includeJunk: true,
            excludeCode: null
        };

        console.log('📋 调用参数:', {
            email: emailConfig.email,
            hasPassword: !!emailConfig.password,
            hasClientId: !!emailConfig.clientId,
            hasRefreshToken: !!emailConfig.refreshToken,
            host: emailConfig.host,
            includeJunk: emailConfig.includeJunk
        });

        const startTime = Date.now();
        const code = await fetchLatestOpenAiOtpOnce(emailConfig);
        const endTime = Date.now();

        console.log(`\n⏱️  耗时: ${endTime - startTime}ms`);

        if (code) {
            console.log('✅ 成功提取到验证码!');
            console.log('🔢 验证码:', code);
            console.log('📏 验证码长度:', code.length);
            console.log('🔍 验证码格式:', /^\d{6}$/.test(code) ? '6位数字 ✅' : '格式异常 ❌');
        } else {
            console.log('❌ 未找到验证码');
            console.log('💡 可能原因:');
            console.log('  1. 邮箱中没有新的OpenAI验证邮件');
            console.log('  2. 邮件正文字段名不匹配');
            console.log('  3. 验证码提取正则表达式有问题');
            console.log('  4. 邮箱认证失败');
        }

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        if (error.response) {
            console.error('📡 HTTP状态:', error.response.status);
            console.error('📡 响应数据:', error.response.data);
        }
        console.error('📋 错误堆栈:', error.stack);
    }
}

// 运行测试
testDirectOtpExtraction();