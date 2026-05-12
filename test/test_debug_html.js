/**
 * HTML 调试工具
 *
 * 功能：
 * 1. 打开保存的 HTML 文件进行调试
 * 2. 注入调试工具（高亮、查找选择器等）
 *
 * 用法：
 *   node test_debug_html.js <html文件路径>
 *   node test_debug_html.js              # 自动打开最新的 debug_*.html
 *
 * 示例：
 *   node test_debug_html.js ../debug_html/paypal_email_error_20260512_143022.html
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function main() {
    let htmlPath = process.argv[2];

    // 如果没指定文件，找最新的 debug html
    if (!htmlPath) {
        const debugDir = path.join(__dirname, '..', 'debug_html');
        if (fs.existsSync(debugDir)) {
            const files = fs.readdirSync(debugDir)
                .filter(f => f.endsWith('.html'))
                .map(f => ({ name: f, time: fs.statSync(path.join(debugDir, f)).mtime }))
                .sort((a, b) => b.time - a.time);

            if (files.length > 0) {
                htmlPath = path.join(debugDir, files[0].name);
                console.log(`📂 自动选择最新文件: ${files[0].name}`);
            }
        }
    }

    if (!htmlPath || !fs.existsSync(htmlPath)) {
        console.log(`
用法: node test_debug_html.js [html文件路径]

如果不指定文件，会自动打开 debug_html/ 目录下最新的 HTML 文件

示例:
  node test_debug_html.js ../debug_html/paypal_email_error_20260512.html
  node test_debug_html.js   # 打开最新的

当前 debug_html 目录内容:
`);
        const debugDir = path.join(__dirname, '..', 'debug_html');
        if (fs.existsSync(debugDir)) {
            const files = fs.readdirSync(debugDir).filter(f => f.endsWith('.html'));
            files.forEach(f => console.log(`  - ${f}`));
            if (files.length === 0) console.log('  (空)');
        } else {
            console.log('  debug_html 目录不存在，运行 index.js 出错后会自动创建');
        }
        process.exit(1);
    }

    const absolutePath = path.resolve(htmlPath);
    console.log(`🚀 启动浏览器...`);
    console.log(`📄 打开: ${absolutePath}\n`);

    const browser = await chromium.launch({
        headless: false,
        args: ['--disable-blink-features=AutomationControlled']
    });

    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });

    const page = await context.newPage();

    // 用 file:// 协议打开本地 HTML
    await page.goto(`file:///${absolutePath.replace(/\\/g, '/')}`);
    await page.waitForTimeout(1000);

    // 注入调试工具
    await page.evaluate(() => {
        // 高亮所有 input
        window.highlightInputs = () => {
            const inputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
            inputs.forEach((el, i) => {
                el.style.outline = '3px solid red';
                el.style.outlineOffset = '2px';
                el.dataset.debugIndex = i;
                const rect = el.getBoundingClientRect();
                console.log(`[${i}] id="${el.id}" name="${el.name}" type="${el.type}" placeholder="${el.placeholder || ''}" visible=${rect.width > 0}`);
            });
            console.log(`\n共 ${inputs.length} 个输入框`);
        };

        // 高亮所有按钮
        window.highlightButtons = () => {
            const buttons = document.querySelectorAll('button, [role="button"], a.btn, [type="submit"], .button');
            buttons.forEach((el, i) => {
                el.style.outline = '3px solid blue';
                el.style.outlineOffset = '2px';
                console.log(`[${i}] "${el.textContent?.trim().slice(0, 40)}" id="${el.id}" class="${el.className?.slice(0, 50)}"`);
            });
            console.log(`\n共 ${buttons.length} 个按钮`);
        };

        // 查找元素
        window.find = (selector) => {
            const el = document.querySelector(selector);
            if (el) {
                el.style.outline = '5px solid lime';
                el.scrollIntoView({ block: 'center' });
                console.log('✅ 找到:', selector);
                console.log('   tagName:', el.tagName);
                console.log('   id:', el.id);
                console.log('   name:', el.name);
                console.log('   class:', el.className);
                console.log('   type:', el.type);
                console.log('   placeholder:', el.placeholder);
                return el;
            }
            console.log('❌ 未找到:', selector);
            return null;
        };

        // 查找所有匹配的元素
        window.findAll = (selector) => {
            const els = document.querySelectorAll(selector);
            els.forEach((el, i) => {
                el.style.outline = '3px solid orange';
                console.log(`[${i}] id="${el.id}" class="${el.className?.slice(0, 40)}"`);
            });
            console.log(`\n共 ${els.length} 个匹配`);
            return els;
        };

        // 列出所有可交互元素
        window.listAll = () => {
            const results = [];
            document.querySelectorAll('input, button, [role="button"], select, textarea, a[href]').forEach(el => {
                const rect = el.getBoundingClientRect();
                if (rect.width === 0 && rect.height === 0) return;

                const info = {
                    tag: el.tagName,
                    id: el.id,
                    name: el.name,
                    type: el.type,
                    text: el.textContent?.trim().slice(0, 25),
                    placeholder: el.placeholder,
                    selector: el.id ? `#${el.id}` : (el.name ? `[name="${el.name}"]` : el.tagName.toLowerCase())
                };
                results.push(info);
                console.log(`${info.selector.padEnd(35)} | ${info.tag.padEnd(8)} | "${info.text || info.placeholder || ''}"`);
            });
            return results;
        };

        // 专门查找邮箱输入框
        window.findEmail = () => {
            const selectors = [
                '#login_email', '#email', 'input[type="email"]',
                'input[name="email"]', 'input[name="login_email"]',
                'input[placeholder*="email" i]', 'input[aria-label*="email" i]',
                '[data-testid*="email" i]', '#txtEmail', '[autocomplete="email"]'
            ];
            console.log('🔍 查找邮箱输入框...\n');
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) {
                    el.style.outline = '5px solid lime';
                    el.scrollIntoView({ block: 'center' });
                    console.log(`✅ 找到: ${sel}`);
                    console.log(`   id: ${el.id}, name: ${el.name}, type: ${el.type}`);
                    return el;
                }
            }
            console.log('❌ 未找到邮箱框，用 listAll() 查看所有元素');
            return null;
        };

        // 生成元素的最佳选择器
        window.getSelector = (el) => {
            if (!el) return null;
            if (el.id) return `#${el.id}`;
            if (el.name) return `[name="${el.name}"]`;
            if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
            if (el.placeholder) return `[placeholder="${el.placeholder}"]`;
            if (el.className) return `${el.tagName.toLowerCase()}.${el.className.split(' ')[0]}`;
            return el.tagName.toLowerCase();
        };

        // 点击元素查看其选择器
        document.addEventListener('click', (e) => {
            const el = e.target;
            el.style.outline = '5px solid yellow';
            console.log('\n🖱️ 点击的元素:');
            console.log('   tagName:', el.tagName);
            console.log('   id:', el.id);
            console.log('   name:', el.name);
            console.log('   class:', el.className);
            console.log('   推荐选择器:', getSelector(el));
        }, true);

        // 自动执行
        highlightInputs();

        console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 调试工具已加载！可用命令:

  highlightInputs()   - 高亮所有输入框（红色）
  highlightButtons()  - 高亮所有按钮（蓝色）
  findEmail()         - 查找邮箱输入框
  find('#selector')   - 查找并高亮元素（绿色）
  findAll('.class')   - 查找所有匹配元素（橙色）
  listAll()           - 列出所有可交互元素
  getSelector(el)     - 获取元素的推荐选择器

💡 直接点击页面元素会显示其选择器信息

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
    });

    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ HTML 已加载，调试工具已注入

🛠️  在浏览器 Console (F12) 中使用调试命令
💡 直接点击页面元素可以查看其选择器

按 Ctrl+C 退出
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

    // 保持运行
    await new Promise(() => {});
}

main().catch(e => {
    console.error('❌', e.message);
    process.exit(1);
});
