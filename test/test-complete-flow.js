const axios = require('axios');
const { testToken } = require('./generate-test-token');

async function testCompleteEmailFlow() {
    const baseUrl = 'http://localhost:3000';
    const email = 'kwqdedgsd226688@outlook.com';

    try {
        console.log('🔍 开始完整的邮箱功能测试...');
        console.log('📧 目标邮箱:', email);

        // 1. 首先获取邮箱池列表，找到对应邮箱的ID
        console.log('\n📋 步骤1: 获取邮箱池列表...');
        const poolResponse = await axios.get(`${baseUrl}/api/admin/pool-emails`, {
            headers: {
                'Authorization': `Bearer ${testToken}`
            }
        });

        console.log('✅ 邮箱池API状态:', poolResponse.status);
        const emails = poolResponse.data?.items || [];
        console.log('📧 邮箱池总数:', emails.length);

        // 查找目标邮箱
        const targetEmail = emails.find(item => item.email === email);
        if (!targetEmail) {
            console.log('❌ 未找到目标邮箱:', email);
            console.log('📋 可用邮箱列表:');
            emails.forEach(item => console.log(`  - ${item.email} (ID: ${item.id})`));
            return;
        }

        console.log('✅ 找到目标邮箱 ID:', targetEmail.id);
        console.log('📋 邮箱信息:', {
            id: targetEmail.id,
            email: targetEmail.email,
            hasRefreshToken: !!targetEmail.refreshToken,
            hasPassword: !!targetEmail.password,
            clientId: targetEmail.clientId ? '已配置' : '未配置'
        });

        // 2. 获取该邮箱的邮件列表
        console.log('\n📬 步骤2: 获取邮件列表...');
        const messagesResponse = await axios.get(`${baseUrl}/api/admin/pool-emails/${targetEmail.id}/messages?limit=10`, {
            headers: {
                'Authorization': `Bearer ${testToken}`
            }
        });

        console.log('✅ 邮件API状态:', messagesResponse.status);
        const messages = messagesResponse.data?.messages || [];
        console.log('📧 获取到邮件数量:', messages.length);

        if (messages.length > 0) {
            console.log('\n📧 邮件列表:');
            messages.forEach((msg, index) => {
                console.log(`\n--- 邮件 ${index + 1} ---`);
                console.log('文件夹:', msg.folder);
                console.log('主题:', msg.subject);
                console.log('发件人:', msg.from);
                console.log('日期:', msg.date);

                // 输出邮件内容的所有可能字段
                console.log('\n📄 邮件内容字段:');
                console.log('body:', msg.body ? `存在 (${msg.body.length}字符)` : '不存在');
                console.log('text:', msg.text ? `存在 (${msg.text.length}字符)` : '不存在');
                console.log('content:', msg.content ? `存在 (${msg.content.length}字符)` : '不存在');
                console.log('bodyText:', msg.bodyText ? `存在 (${msg.bodyText.length}字符)` : '不存在');

                // 输出实际的邮件内容
                const bodyText = msg.bodyText || msg.body || msg.text || msg.content || '';
                if (bodyText) {
                    console.log('\n📝 邮件正文:');
                    console.log('---开始---');
                    console.log(bodyText.substring(0, 1000)); // 只显示前1000字符
                    if (bodyText.length > 1000) {
                        console.log(`\n... (还有${bodyText.length - 1000}字符)`);
                    }
                    console.log('---结束---');

                    // 尝试提取验证码
                    const codeMatch = bodyText.match(/\b\d{6}\b/g);
                    if (codeMatch) {
                        console.log('\n🔢 发现可能的验证码:', codeMatch);
                    } else {
                        console.log('\n❌ 未在邮件正文中找到6位数字验证码');
                    }
                } else {
                    console.log('\n❌ 邮件正文为空');
                }

                // 检查是否是OpenAI验证邮件
                const isOpenAI = /openai|chatgpt|verification|verify/i.test(`${msg.subject} ${msg.from}`);
                console.log('\n疑似OpenAI邮件:', isOpenAI ? '✅' : '❌');
            });

            // 3. 如果找到OpenAI邮件，尝试获取验证码
            const openaiEmails = messages.filter(msg =>
                /openai|chatgpt|verification|verify/i.test(`${msg.subject} ${msg.from}`)
            );

            if (openaiEmails.length > 0) {
                console.log('\n🔢 步骤3: 检测到OpenAI验证邮件，现在可以看到邮件内容了');
                console.log('💡 如果上面显示了验证码，说明邮件内容获取正常');
                console.log('📝 如果没有验证码，可能是邮件内容字段名不匹配');
            } else {
                console.log('\n❌ 未找到OpenAI验证邮件');
                console.log('💡 可能原因: 邮件已过期或在垃圾箱中');
            }
        } else {
            console.log('❌ 该邮箱暂无邮件');
        }

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        if (error.response) {
            console.error('📡 响应状态:', error.response.status);
            console.error('📡 响应数据:', error.response.data);
        }
    }
}

// 运行测试
testCompleteEmailFlow();