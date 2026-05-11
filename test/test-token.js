const axios = require('axios');

async function testTokenValidation() {
    // 先生成token
    const { testToken } = require('./generate-test-token');

    console.log('🔑 测试token验证...');
    console.log('Token:', testToken.substring(0, 50) + '...');

    try {
        // 测试一个简单的admin API
        const response = await axios.get('http://localhost:3000/api/admin/runtime-logs?limit=1', {
            headers: {
                'Authorization': `Bearer ${testToken}`
            },
            timeout: 5000
        });

        console.log('✅ Token验证成功!');
        console.log('📡 响应状态:', response.status);
        console.log('📋 响应数据:', response.data?.success ? '成功' : '失败');

        return true;
    } catch (error) {
        console.error('❌ Token验证失败:', error.message);

        if (error.response) {
            console.error('📡 响应状态:', error.response.status);
            console.error('📡 响应数据:', error.response.data);

            if (error.response.status === 401) {
                console.log('\n💡 可能的原因:');
                console.log('1. passwordVersion (pv) 不匹配');
                console.log('2. ADMIN_TOKEN_SECRET 不匹配');
                console.log('3. token格式错误');
            }
        }

        return false;
    }
}

// 如果直接运行此文件
if (require.main === module) {
    testTokenValidation();
}

module.exports = { testTokenValidation };