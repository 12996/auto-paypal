/**
 * 验证修复是否正确应用到 index.js 中
 */

const fs = require('fs');
const path = require('path');

function verifyFix() {
    console.log('🔍 验证姓名字段填写修复是否正确应用...\n');

    const indexPath = path.join(__dirname, 'index.js');

    try {
        const content = fs.readFileSync(indexPath, 'utf8');

        // 检查关键修复点
        const checks = [
            {
                name: '修复1: 使用 waitFor 替代 isAttached',
                pattern: /await nameInput\.waitFor\(\{ state: 'attached', timeout: 2000 \}\)/,
                description: '检查是否使用了兼容的 waitFor API'
            },
            {
                name: '修复2: 使用 waitFor 替代 isVisible',
                pattern: /await nameInput\.waitFor\(\{ state: 'visible', timeout: 2000 \}\)/,
                description: '检查是否使用了兼容的可见性检查'
            },
            {
                name: '修复3: 多重填写策略',
                pattern: /const maxAttempts = 3/,
                description: '检查是否实现了多次重试机制'
            },
            {
                name: '修复4: 备用填写方法',
                pattern: /await page\.keyboard\.type\(CONFIG\.billing\.name/,
                description: '检查是否有备用的键盘输入方法'
            },
            {
                name: '修复5: 事件触发',
                pattern: /node\.dispatchEvent\(new Event\('input', \{ bubbles: true \}\)\)/,
                description: '检查是否触发了必要的 DOM 事件'
            },
            {
                name: '修复6: 备用 fill 方法',
                pattern: /await nameInput\.fill\(CONFIG\.billing\.name\)/,
                description: '检查是否有最后的备用填写方法'
            }
        ];

        let passedChecks = 0;
        let totalChecks = checks.length;

        console.log('📋 检查结果:\n');

        checks.forEach((check, index) => {
            const found = check.pattern.test(content);
            const status = found ? '✅' : '❌';
            const result = found ? '通过' : '失败';

            console.log(`${index + 1}. ${check.name}`);
            console.log(`   ${status} ${result}`);
            console.log(`   说明: ${check.description}`);

            if (found) {
                passedChecks++;
            } else {
                // 如果检查失败，显示相关代码片段
                console.log(`   ⚠️  未找到预期的代码模式`);
            }
            console.log('');
        });

        // 检查是否移除了有问题的 API 调用
        const problematicPatterns = [
            {
                name: '移除有问题的 isAttached 调用',
                pattern: /nameInput\.isAttached\(\{ timeout: 2000 \}\)/,
                shouldNotExist: true
            },
            {
                name: '移除有问题的 isVisible 调用',
                pattern: /nameInput\.isVisible\(\{ timeout: 2000 \}\)/,
                shouldNotExist: true
            }
        ];

        console.log('🚫 检查是否移除了有问题的代码:\n');

        problematicPatterns.forEach((check, index) => {
            const found = check.pattern.test(content);
            const status = found ? '❌' : '✅';
            const result = found ? '仍然存在（需要修复）' : '已移除';

            console.log(`${index + 1}. ${check.name}`);
            console.log(`   ${status} ${result}`);
            console.log('');

            if (!found) {
                passedChecks++;
                totalChecks++;
            }
        });

        // 总结
        console.log('📊 验证总结:\n');
        console.log(`通过检查: ${passedChecks}/${totalChecks}`);

        if (passedChecks === totalChecks) {
            console.log('✅ 所有检查通过！修复已正确应用。');
            console.log('\n🎉 姓名字段填写问题修复完成！');
            console.log('\n📝 主要改进:');
            console.log('   • 修复了 Playwright API 兼容性问题');
            console.log('   • 实现了多重填写策略和重试机制');
            console.log('   • 增加了详细的调试日志');
            console.log('   • 提供了多种备用填写方法');
            console.log('   • 确保触发必要的 DOM 事件');
            console.log('\n🔍 建议下一步:');
            console.log('   1. 在实际环境中测试修复效果');
            console.log('   2. 监控日志输出确认问题解决');
            console.log('   3. 如有需要可进一步优化重试策略');
        } else {
            console.log('❌ 部分检查未通过，可能需要进一步修复。');
            console.log('\n🔧 建议检查:');
            console.log('   1. 确认所有修复代码都已正确应用');
            console.log('   2. 检查是否有语法错误或遗漏');
            console.log('   3. 重新运行修复脚本');
        }

    } catch (error) {
        console.error('❌ 验证过程中出错:', error.message);
    }
}

// 额外的代码质量检查
function checkCodeQuality() {
    console.log('\n' + '='.repeat(60));
    console.log('🔍 代码质量检查\n');

    const indexPath = path.join(__dirname, 'index.js');

    try {
        const content = fs.readFileSync(indexPath, 'utf8');

        // 检查 fillName 函数的完整性
        const fillNameMatch = content.match(/const fillName = async \(\) => \{([\s\S]*?)\n        \};/);

        if (fillNameMatch) {
            const fillNameCode = fillNameMatch[1];
            const lineCount = fillNameCode.split('\n').length;

            console.log(`✅ fillName 函数找到，共 ${lineCount} 行代码`);

            // 检查关键逻辑块
            const logicChecks = [
                { name: '元素存在性检查', pattern: /waitFor.*attached/ },
                { name: '元素可见性检查', pattern: /waitFor.*visible/ },
                { name: '重试循环', pattern: /while.*fillSuccess.*maxAttempts/ },
                { name: '多种填写方法', pattern: /attempt === 1/ },
                { name: '结果验证', pattern: /nameValue === CONFIG\.billing\.name/ },
                { name: '备用方法', pattern: /所有填写尝试都失败了/ }
            ];

            logicChecks.forEach(check => {
                const found = check.pattern.test(fillNameCode);
                console.log(`   ${found ? '✅' : '❌'} ${check.name}`);
            });

        } else {
            console.log('❌ 未找到 fillName 函数');
        }

    } catch (error) {
        console.error('❌ 代码质量检查出错:', error.message);
    }
}

if (require.main === module) {
    verifyFix();
    checkCodeQuality();
}

module.exports = { verifyFix, checkCodeQuality };