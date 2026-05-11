const { fetchLatestOpenAiOtpOnce } = require('../pool-email-imap');

async function testOpenAiCodeExtraction() {
    console.log('🔍 测试OpenAI验证码提取功能...');
    console.log('📧 目标邮箱: kwqdedgsd226688@outlook.com');

    // 这里需要邮箱的完整配置信息
    // 我们需要从数据库或配置中获取这些信息
    const emailConfig = {
        email: 'kwqdedgsd226688@outlook.com',
        password: null, // 需要从数据库获取
        clientId: null, // 需要从数据库获取
        refreshToken: null, // 需要从数据库获取
        host: 'outlook.office365.com', // 默认值
        includeJunk: true, // 包含垃圾邮件文件夹
        excludeCode: null // 不排除任何验证码
    };

    console.log('\n⚠️  需要从数据库获取邮箱配置信息...');
    console.log('💡 让我先获取邮箱配置');

    // 使用我们之前的token来获取邮箱配置
    const axios = require('axios');
    const { testToken } = require('./generate-test-token');

    try {
        // 1. 获取邮箱池列表，找到目标邮箱
        console.log('\n📋 步骤1: 获取邮箱配置...');
        const poolResponse = await axios.get('http://localhost:3000/api/admin/pool-emails', {
            headers: {
                'Authorization': `Bearer ${testToken}`
            }
        });

        const emails = poolResponse.data?.items || [];
        const targetEmail = emails.find(item => item.email === emailConfig.email);

        if (!targetEmail) {
            console.log('❌ 未找到目标邮箱配置');
            return;
        }

        console.log('✅ 找到邮箱配置:');
        console.log('  ID:', targetEmail.id);
        console.log('  邮箱:', targetEmail.email);
        console.log('  Host:', targetEmail.host || '未设置');
        console.log('  有密码:', !!targetEmail.password);
        console.log('  有RefreshToken:', !!targetEmail.refreshToken);
        console.log('  ClientId:', targetEmail.clientId || '未配置');

        // 分析配置
        console.log('\n🔍 配置分析:');
        if (!targetEmail.host || targetEmail.host === 'outlook.office365.com') {
            console.log('❌ Host配置为IMAP直连模式，但缺少认证信息');
            console.log('💡 需要将host改为 mail.chatai.codes 或添加密码');
        } else if (targetEmail.host.includes('mail.chatai.codes')) {
            console.log('✅ Host配置为API代理模式');
            if (!targetEmail.clientId || !targetEmail.refreshToken) {
                console.log('❌ 但缺少API认证信息 (clientId/refreshToken)');
            } else {
                console.log('✅ API认证信息完整');
            }
        }

        // 2. 更新配置信息
        emailConfig.password = targetEmail.password;
        emailConfig.clientId = targetEmail.clientId;
        emailConfig.refreshToken = targetEmail.refreshToken;
        emailConfig.host = targetEmail.host || 'outlook.office365.com';

        // 3. 调用验证码提取函数
        console.log('\n🔢 步骤2: 调用验证码提取函数...');
        console.log('⏳ 正在获取最新的OpenAI验证码...');

        const startTime = Date.now();
        const code = await fetchLatestOpenAiOtpOnce(emailConfig);
        const endTime = Date.now();

        console.log(`⏱️  耗时: ${endTime - startTime}ms`);

        if (code) {
            console.log('✅ 成功提取到验证码!');
            console.log('🔢 验证码:', code);
            console.log('📏 验证码长度:', code.length);
            console.log('🔍 验证码格式:', /^\d{6}$/.test(code) ? '6位数字 ✅' : '格式异常 ❌');
        } else {
            console.log('❌ 未找到验证码');
            console.log('💡 可能原因:');
            console.log('  1. 邮箱中没有新的OpenAI验证邮件');
            console.log('  2. 验证码提取逻辑有问题');
            console.log('  3. 邮件正文字段名不匹配');
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
testOpenAiCodeExtraction();