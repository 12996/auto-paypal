#!/usr/bin/env node

/**
 * PayPal 调试工具启动脚本
 * 提供便捷的命令行接口来运行各种 PayPal 调试和测试工具
 */

const { program } = require('commander');
const { testPayPalForm } = require('./test_paypal_form');
const { debugPayPalPage } = require('./debug_paypal_selector');
const { optimizedPayPalFormFill } = require('./optimized_paypal_handler');

// 配置命令行参数
program
    .name('paypal-debug')
    .description('PayPal 页面自动化调试工具')
    .version('1.0.0');

// 表单填写测试命令
program
    .command('test-form')
    .description('运行 PayPal 表单填写测试')
    .option('-u, --url <url>', 'PayPal URL', 'https://www.paypal.com/signin')
    .option('-h, --headless', '无头模式运行', false)
    .action(async (options) => {
        console.log('🚀 启动 PayPal 表单填写测试...');
        try {
            await testPayPalForm();
        } catch (error) {
            console.error('❌ 测试失败:', error.message);
            process.exit(1);
        }
    });

// DOM 结构调试命令
program
    .command('debug-dom')
    .description('分析 PayPal 页面 DOM 结构')
    .option('-u, --url <url>', 'PayPal URL', 'https://www.paypal.com/signin')
    .action(async (options) => {
        console.log('🔍 启动 PayPal DOM 结构调试...');
        try {
            await debugPayPalPage(options.url);
        } catch (error) {
            console.error('❌ 调试失败:', error.message);
            process.exit(1);
        }
    });

// 选择器测试命令
program
    .command('test-selectors')
    .description('测试 PayPal 页面选择器准确性')
    .option('-u, --url <url>', 'PayPal URL', 'https://www.paypal.com/signin')
    .action(async (options) => {
        console.log('🎯 启动选择器准确性测试...');

        const { chromium } = require('playwright');
        const { testSelectors } = require('./debug_paypal_selector');

        const browser = await chromium.launch({ headless: false, devtools: true });
        const context = await browser.newContext({
            viewport: { width: 1366, height: 768 }
        });
        const page = await context.newPage();

        try {
            await page.goto(options.url, { waitUntil: 'domcontentloaded' });
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

            const results = await testSelectors(page);

            // 输出测试结果摘要
            console.log('\n📊 选择器测试结果摘要:');
            for (const [fieldName, tests] of Object.entries(results)) {
                const successCount = tests.filter(t => t.success).length;
                const totalCount = tests.length;
                console.log(`  ${fieldName}: ${successCount}/${totalCount} 个选择器有效`);
            }

            console.log('\n✅ 选择器测试完成，详细结果已保存到 debug_reports/ 目录');

        } catch (error) {
            console.error('❌ 选择器测试失败:', error.message);
        } finally {
            await browser.close();
        }
    });

// 完整调试命令
program
    .command('full-debug')
    .description('运行完整的 PayPal 调试流程')
    .option('-u, --url <url>', 'PayPal URL', 'https://www.paypal.com/signin')
    .action(async (options) => {
        console.log('🔬 启动完整 PayPal 调试流程...');

        try {
            console.log('\n1️⃣ 第一步: DOM 结构分析');
            await debugPayPalPage(options.url);

            console.log('\n2️⃣ 第二步: 表单填写测试');
            await testPayPalForm();

            console.log('\n✅ 完整调试流程完成');
            console.log('📁 所有调试结果已保存到相应目录');

        } catch (error) {
            console.error('❌ 完整调试失败:', error.message);
            process.exit(1);
        }
    });

// 帮助信息
program
    .command('info')
    .description('显示工具使用信息')
    .action(() => {
        console.log(`
🛠️  PayPal 调试工具使用指南

📁 文件说明:
  - test_paypal_form.js      : 表单填写测试脚本
  - debug_paypal_selector.js : DOM 结构调试脚本
  - optimized_paypal_handler.js : 优化后的处理逻辑
  - run_paypal_debug.js      : 本启动脚本

🚀 快速开始:
  node run_paypal_debug.js test-form     # 测试表单填写
  node run_paypal_debug.js debug-dom     # 分析 DOM 结构
  node run_paypal_debug.js test-selectors # 测试选择器
  node run_paypal_debug.js full-debug    # 完整调试流程

📊 输出目录:
  - debug_screenshots/paypal_test/ : 测试截图
  - debug_reports/                 : DOM 分析报告
  - debug_screenshots/             : 调试截图

💡 使用建议:
  1. 首先运行 debug-dom 了解页面结构
  2. 然后运行 test-selectors 验证选择器
  3. 最后运行 test-form 测试完整流程
  4. 使用 full-debug 进行全面调试

🔧 自定义配置:
  - 修改 test_paypal_form.js 中的 TEST_CONFIG
  - 调整 debug_paypal_selector.js 中的 DEBUG_CONFIG
  - 在 optimized_paypal_handler.js 中优化处理逻辑
        `);
    });

// 解析命令行参数
program.parse();

// 如果没有提供命令，显示帮助信息
if (!process.argv.slice(2).length) {
    program.outputHelp();
}