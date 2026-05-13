/**
 * CDK 生成功能测试 (直接调用底层方法，无需启动服务器)
 *
 * 使用方法:
 *   node test/test_cdk_generate.js
 */

require('dotenv').config();

const path = require('path');

// 直接复制 server.js 中的 createCdks 函数
function createCdks(count) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const results = new Set();
    const target = Math.max(1, Math.min(Number(count) || 1, 100));

    while (results.size < target) {
        let cdk = '';
        for (let i = 0; i < 12; i += 1) {
            cdk += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        results.add(cdk);
    }

    return [...results];
}

async function testCreateCdks() {
    console.log('='.repeat(50));
    console.log('CDK 生成函数测试 (createCdks)');
    console.log('='.repeat(50));

    const testCases = [
        { count: 5, desc: '正常生成 5 个' },
        { count: 1, desc: '最小值 1 个' },
        { count: 100, desc: '最大值 100 个' },
        { count: 0, desc: '零值 (应转为 1)' },
        { count: -5, desc: '负数 (应转为 1)' },
        { count: 200, desc: '超限 200 (应限制为 100)' },
        { count: 'abc', desc: '非数字 (应转为 1)' },
        { count: null, desc: 'null (应转为 1)' },
        { count: undefined, desc: 'undefined (应转为 1)' },
    ];

    for (const { count, desc } of testCases) {
        console.log(`\n📦 测试: ${desc}`);
        const cdks = createCdks(count);
        console.log(`   输入: ${count}`);
        console.log(`   生成数量: ${cdks.length}`);
        console.log(`   示例: ${cdks.slice(0, 3).join(', ')}${cdks.length > 3 ? '...' : ''}`);

        // 验证 CDK 格式
        const validFormat = cdks.every(cdk => /^[A-Z0-9]{12}$/.test(cdk));
        console.log(`   格式验证: ${validFormat ? '✅ 通过' : '❌ 失败'}`);

        // 验证唯一性
        const unique = new Set(cdks).size === cdks.length;
        console.log(`   唯一性验证: ${unique ? '✅ 通过' : '❌ 失败'}`);
    }
}

async function testDatabaseInsert() {
    console.log('\n' + '='.repeat(50));
    console.log('CDK 数据库写入测试');
    console.log('='.repeat(50));

    try {
        const store = require('../mysql-store');
        await store.init();
        console.log('✅ 数据库连接成功');

        // 生成测试 CDK
        const testCdks = createCdks(3);
        const type = '测试_' + Date.now();

        console.log(`\n📦 写入 ${testCdks.length} 个 CDK (type: ${type})`);
        console.log(`   CDK: ${testCdks.join(', ')}`);

        const result = await store.insertCdks(testCdks, { type });
        console.log(`   写入结果: insertedCount=${result.insertedCount}, duplicateCount=${result.duplicateCount}`);

        if (result.insertedCount === testCdks.length) {
            console.log('✅ 数据库写入成功');
        } else {
            console.log('⚠️ 写入数量不匹配');
        }

        // 测试重复写入
        console.log('\n📦 测试重复写入...');
        const result2 = await store.insertCdks(testCdks, { type });
        console.log(`   重复写入结果: insertedCount=${result2.insertedCount}, duplicateCount=${result2.duplicateCount}`);

        if (result2.duplicateCount === testCdks.length) {
            console.log('✅ 重复检测正常');
        } else {
            console.log('⚠️ 重复检测异常');
        }

        // 清理测试数据
        console.log('\n🧹 清理测试数据...');
        for (const cdk of testCdks) {
            await store.deleteCdk(cdk);
        }
        console.log('✅ 清理完成');

    } catch (error) {
        console.error('❌ 数据库测试失败:', error.message);
    }
}

async function main() {
    // 测试 CDK 生成函数
    await testCreateCdks();

    // 测试数据库写入
    await testDatabaseInsert();

    console.log('\n' + '='.repeat(50));
    console.log('✅ 所有测试完成');
    console.log('='.repeat(50));

    process.exit(0);
}

main();
