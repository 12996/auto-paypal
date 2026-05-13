/**
 * 产品生成接口测试 (POST /api/admin/products/generate)
 *
 * 直接调用 product_activator.startProductCreation 方法
 * 无需启动服务器，但需要数据库连接和资产池配置
 *
 * 使用方法:
 *   node test/test_products_generate.js
 *
 * 前置条件:
 *   - .env 配置数据库连接
 *   - 资产池中有可用的手机号、银行卡、邮箱
 *   - 配置了代理
 */

require('dotenv').config();

const { startProductCreation } = require('../product_activator');
const store = require('../mysql-store');

async function testProductGeneration() {
    console.log('='.repeat(60));
    console.log('产品生成流程测试 (startProductCreation)');
    console.log('='.repeat(60));

    try {
        // 初始化数据库
        console.log('\n📦 初始化数据库连接...');
        await store.init();
        console.log('✅ 数据库连接成功');

        // 检查资产池状态
        console.log('\n📦 检查资产池状态...');

        const phones = await store.getActivePhones?.() || [];
        console.log(`   手机号: ${phones.length} 个可用`);

        const cards = await store.getActiveCards?.() || [];
        console.log(`   银行卡: ${cards.length} 个可用`);

        const emails = await store.getActivePoolEmails?.() || [];
        console.log(`   邮箱池: ${emails.length} 个可用`);

        // 检查配置
        console.log('\n📦 检查系统配置...');
        const config = await store.getConfig?.() || {};
        console.log(`   代理: ${config.proxy ? '已配置' : '❌ 未配置'}`);
        console.log(`   SMS API: ${config.smsApiKey ? '已配置' : '❌ 未配置'}`);

        // 资产检查
        if (phones.length === 0) {
            console.log('\n⚠️ 警告: 没有可用的手机号，流程可能失败');
        }
        if (cards.length === 0) {
            console.log('\n⚠️ 警告: 没有可用的银行卡，流程可能失败');
        }

        // 询问是否继续
        console.log('\n' + '='.repeat(60));
        console.log('⚠️  即将启动完整产品生成流程');
        console.log('    这会执行: 注册 OpenAI → Stripe 支付 → OAuth 登录');
        console.log('    预计耗时: 2-5 分钟');
        console.log('='.repeat(60));

        // 启动产品生成
        console.log('\n🚀 启动产品生成流程...\n');

        const testJobKey = `TEST_${Date.now()}`;

        const result = await startProductCreation(
            null,  // cdk = null 表示后台批量模式
            (progress) => {
                // 进度回调
                const msg = progress.message || '';
                const pct = progress.progress || 0;
                console.log(`   [${pct.toString().padStart(3)}%] ${msg}`);
            },
            {
                jobKey: testJobKey
            }
        );

        console.log('\n' + '='.repeat(60));
        console.log('✅ 产品生成完成');
        console.log('='.repeat(60));
        console.log('结果:', JSON.stringify(result, null, 2));

    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        console.error('错误详情:', error.stack);
    }

    process.exit(0);
}

// 仅检查资产池状态，不执行生成
async function checkAssetsOnly() {
    console.log('='.repeat(60));
    console.log('资产池状态检查');
    console.log('='.repeat(60));

    try {
        await store.init();
        console.log('✅ 数据库连接成功\n');

        // 手机号
        const phones = await store.query?.('SELECT * FROM phone_pool WHERE is_active = 1 LIMIT 5') || [];
        console.log(`📱 手机号 (可用 ${phones.length} 个):`);
        phones.slice(0, 3).forEach(p => console.log(`   ${p.phone_number} - ${p.status || '可用'}`));

        // 银行卡
        const cards = await store.query?.('SELECT * FROM card_pool WHERE is_active = 1 LIMIT 5') || [];
        console.log(`\n💳 银行卡 (可用 ${cards.length} 个):`);
        cards.slice(0, 3).forEach(c => console.log(`   ${c.card_number?.slice(-4) || '****'} - ${c.status || '可用'}`));

        // 邮箱池
        const emails = await store.query?.('SELECT * FROM pool_emails WHERE is_active = 1 LIMIT 5') || [];
        console.log(`\n📧 邮箱池 (可用 ${emails.length} 个):`);
        emails.slice(0, 3).forEach(e => console.log(`   ${e.email} - ${e.status || '可用'}`));

        // 代理配置
        const proxyConfig = await store.query?.("SELECT * FROM config WHERE `key` = 'proxy' LIMIT 1") || [];
        console.log(`\n🌐 代理: ${proxyConfig[0]?.value ? '已配置' : '未配置'}`);

        // SMS 配置
        const smsConfig = await store.query?.("SELECT * FROM config WHERE `key` = 'smsApiKey' LIMIT 1") || [];
        console.log(`📲 SMS API: ${smsConfig[0]?.value ? '已配置' : '未配置'}`);

    } catch (error) {
        console.error('❌ 检查失败:', error.message);
    }

    process.exit(0);
}

// 命令行参数处理
const args = process.argv.slice(2);

if (args.includes('--check') || args.includes('-c')) {
    // 仅检查资产池
    checkAssetsOnly();
} else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
产品生成接口测试

用法:
  node test/test_products_generate.js [选项]

选项:
  --check, -c    仅检查资产池状态，不执行生成
  --help, -h     显示帮助信息

示例:
  node test/test_products_generate.js --check   # 检查资产池
  node test/test_products_generate.js           # 执行完整生成流程
`);
    process.exit(0);
} else {
    // 执行完整测试
    testProductGeneration();
}
