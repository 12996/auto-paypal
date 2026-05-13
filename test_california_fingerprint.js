/**
 * 加州随机指纹测试脚本
 */
const { chromium } = require('playwright');
const CaliforniaFingerprint = require('./lib/california-fingerprint');

(async () => {
    console.log('🌴 === 加州随机指纹测试 ===\n');

    // 生成5个不同的加州指纹配置
    const fingerprints = CaliforniaFingerprint.generateMultipleCaliforniaFingerprints(5);

    console.log('📋 生成的加州指纹配置:');
    fingerprints.forEach((fp, index) => {
        console.log(`\n${index + 1}. ${fp.region}`);
        console.log(`   CPU: ${fp.hardwareConcurrency}核, 内存: ${fp.deviceMemory}GB`);
        console.log(`   平台: ${fp.platform}, 屏幕: ${fp.screen.width}x${fp.screen.height}`);
        console.log(`   语言: ${fp.languages.join(', ')}`);
        console.log(`   WebGL: ${fp.webgl.renderer.substring(0, 50)}...`);
    });

    // 随机选择一个配置进行测试
    const selectedConfig = fingerprints[Math.floor(Math.random() * fingerprints.length)];
    console.log(`\n🎯 选择测试配置: ${selectedConfig.region}\n`);

    const browser = await chromium.launch({
        headless: false,
        ...CaliforniaFingerprint.getPlaywrightOptions(selectedConfig)
    });

    // 创建加州指纹上下文
    const { context, config } = await CaliforniaFingerprint.createCaliforniaContext(browser, selectedConfig);
    const page = await context.newPage();

    // 测试指纹效果
    console.log('正在访问 bot.sannysoft.com 测试指纹...');
    await page.goto('https://bot.sannysoft.com/', { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);

    // 截图
    const screenshotPath = `debug_html/fingerprint-california-${config.region.replace(/\s+/g, '-').toLowerCase()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`截图已保存: ${screenshotPath}`);

    // 获取检测结果
    const results = await page.evaluate(() => {
        const rows = document.querySelectorAll('table tr');
        const data = [];
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 2) {
                const test = cells[0]?.textContent?.trim();
                const result = cells[1]?.textContent?.trim();
                const failed = cells[1]?.className?.includes('failed');
                if (test && test !== 'Test') {
                    data.push({ test, result, failed });
                }
            }
        });
        return data;
    });

    // 详细指纹验证
    const detailedInfo = await page.evaluate(() => {
        const info = {
            // 基础信息
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            languages: navigator.languages,
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemory: navigator.deviceMemory,

            // 屏幕信息
            screenWidth: screen.width,
            screenHeight: screen.height,

            // 时区信息
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            timezoneOffset: new Date().getTimezoneOffset(),

            // 自动化检测
            webdriver: navigator.webdriver,
            chromeExists: typeof window.chrome !== 'undefined',
            playwrightExists: typeof window.__playwright !== 'undefined',
        };

        // WebGL 信息
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl');
            if (gl) {
                info.webglVendor = gl.getParameter(gl.VENDOR);
                info.webglRenderer = gl.getParameter(gl.RENDERER);
            }
        } catch (e) {
            info.webglError = e.message;
        }

        // 地理位置测试
        if (navigator.geolocation) {
            info.geolocationSupported = true;
        }

        return info;
    });

    console.log('\n=== Bot 检测结果 ===');
    let failCount = 0;
    results.slice(0, 15).forEach(r => {
        const icon = r.failed ? '❌ [FAIL]' : '✅ [PASS]';
        console.log(`${icon} ${r.test}: ${r.result}`);
        if (r.failed) failCount++;
    });

    console.log('\n🌴 === 加州指纹信息验证 ===');
    console.log(`地区: ${config.region}`);
    console.log(`User-Agent: ${detailedInfo.userAgent}`);
    console.log(`平台: ${detailedInfo.platform}`);
    console.log(`语言: ${detailedInfo.language} (${detailedInfo.languages?.join(', ')})`);
    console.log(`CPU 核心: ${detailedInfo.hardwareConcurrency}`);
    console.log(`设备内存: ${detailedInfo.deviceMemory} GB`);
    console.log(`屏幕分辨率: ${detailedInfo.screenWidth}x${detailedInfo.screenHeight}`);
    console.log(`时区: ${detailedInfo.timezone} (偏移: ${detailedInfo.timezoneOffset}分钟)`);
    console.log(`WebGL 供应商: ${detailedInfo.webglVendor}`);
    console.log(`WebGL 渲染器: ${detailedInfo.webglRenderer}`);

    console.log('\n=== 自动化检测状态 ===');
    console.log(`navigator.webdriver: ${detailedInfo.webdriver}`);
    console.log(`Chrome 对象存在: ${detailedInfo.chromeExists}`);
    console.log(`Playwright 痕迹: ${detailedInfo.playwrightExists}`);
    console.log(`地理位置支持: ${detailedInfo.geolocationSupported}`);

    // 验证是否符合加州特征
    console.log('\n🔍 === 加州特征验证 ===');
    const californiaChecks = [];

    // 时区检查
    if (detailedInfo.timezone === 'America/Los_Angeles') {
        californiaChecks.push('✅ 时区正确 (太平洋时间)');
    } else {
        californiaChecks.push('❌ 时区不正确');
    }

    // 语言检查
    if (detailedInfo.language === 'en-US') {
        californiaChecks.push('✅ 主语言正确 (美式英语)');
    } else {
        californiaChecks.push('❌ 主语言不正确');
    }

    // 硬件配置检查
    if (detailedInfo.hardwareConcurrency >= 4 && detailedInfo.deviceMemory >= 8) {
        californiaChecks.push('✅ 硬件配置合理 (符合加州科技地区)');
    } else {
        californiaChecks.push('❌ 硬件配置偏低');
    }

    // WebGL 检查
    if (detailedInfo.webglRenderer && (
        detailedInfo.webglRenderer.includes('NVIDIA') ||
        detailedInfo.webglRenderer.includes('Apple') ||
        detailedInfo.webglRenderer.includes('Intel')
    )) {
        californiaChecks.push('✅ WebGL 配置真实');
    } else {
        californiaChecks.push('❌ WebGL 配置异常');
    }

    californiaChecks.forEach(check => console.log(check));

    // 评分
    const passedChecks = californiaChecks.filter(c => c.startsWith('✅')).length;
    const totalChecks = californiaChecks.length;
    const californiaScore = Math.round((passedChecks / totalChecks) * 100);

    console.log(`\n🎯 加州指纹评分: ${californiaScore}/100`);
    console.log(`Bot 检测成功率: ${((results.length - failCount) / results.length * 100).toFixed(1)}%`);

    if (californiaScore >= 90 && failCount === 0) {
        console.log('🎉 完美！加州随机指纹生成成功！');
    } else if (californiaScore >= 75) {
        console.log('✨ 良好！加州指纹特征基本符合');
    } else {
        console.log('⚠️  需要优化加州指纹配置');
    }

    // 测试地理位置
    console.log('\n📍 === 地理位置测试 ===');
    try {
        const position = await page.evaluate(() => {
            return new Promise((resolve, reject) => {
                if (!navigator.geolocation) {
                    reject('地理位置不支持');
                    return;
                }

                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                        accuracy: pos.coords.accuracy
                    }),
                    (err) => reject(err.message),
                    { timeout: 5000 }
                );
            });
        });

        console.log(`坐标: ${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`);
        console.log(`精度: ${position.accuracy.toFixed(0)}米`);

        // 验证是否在加州范围内
        const isInCalifornia = (
            position.latitude >= 32.5 && position.latitude <= 42.0 &&
            position.longitude >= -124.5 && position.longitude <= -114.0
        );

        if (isInCalifornia) {
            console.log('✅ 地理位置在加州范围内');
        } else {
            console.log('❌ 地理位置不在加州范围内');
        }

    } catch (error) {
        console.log('❌ 地理位置获取失败:', error);
    }

    await browser.close();
    console.log('\n🌴 === 加州指纹测试完成 ===');
})();