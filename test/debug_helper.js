/**
 * 调试助手 - 出错时保存页面 HTML
 *
 * 使用方法：
 *   const debug = require('./test/debug_helper');
 *   await debug.saveOnError(page, 'paypal_email');
 *
 * 启用调试模式：
 *   $env:DEBUG_MODE = "1"
 */

const fs = require('fs');
const path = require('path');

// 已保存的 URL 集合（去重）
const savedUrls = new Set();

// 调试 HTML 保存目录
const DEBUG_DIR = path.join(__dirname, '..', 'debug_html');

/**
 * 检查是否启用调试模式
 */
function isDebugMode() {
    return process.env.DEBUG_MODE === '1' || process.env.DEBUG_MODE === 'true';
}

/**
 * 确保调试目录存在
 */
function ensureDebugDir() {
    if (!fs.existsSync(DEBUG_DIR)) {
        fs.mkdirSync(DEBUG_DIR, { recursive: true });
    }
}

/**
 * 出错时保存页面 HTML
 * @param {import('playwright').Page} page - Playwright 页面对象
 * @param {string} stepName - 步骤名称，如 'paypal_email'
 * @returns {Promise<string|null>} 保存的文件路径，未保存返回 null
 */
async function saveOnError(page, stepName) {
    // 只有 DEBUG_MODE=1 时才保存 HTML
    if (!isDebugMode()) {
        return null;
    }

    try {
        const url = page.url();

        // URL 去重
        const urlKey = `${stepName}:${url}`;
        if (savedUrls.has(urlKey)) {
            console.log(`[debug] 已保存过: ${stepName}`);
            return null;
        }
        savedUrls.add(urlKey);

        ensureDebugDir();

        // 获取页面 HTML
        const html = await page.content();

        // 生成文件名：时间戳_步骤名.html
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `${timestamp}_${stepName}.html`;
        const filepath = path.join(DEBUG_DIR, filename);

        // 注入调试脚本
        const debugScript = `
<script>
// 调试工具函数
window.findEmail = function() {
    const selectors = ['#email', '#login_email', 'input[type="email"]', 'input[name="email"]', 'input[name="login_email"]'];
    selectors.forEach(s => {
        const el = document.querySelector(s);
        if (el) {
            el.style.border = '3px solid red';
            console.log('找到:', s, el);
        }
    });
};

window.highlightInputs = function() {
    document.querySelectorAll('input, button, [role="button"]').forEach((el, i) => {
        el.style.outline = '2px solid ' + ['red','blue','green','orange','purple'][i % 5];
        console.log(i, el.tagName, el.id, el.name, el.type, el.className);
    });
};

window.find = function(selector) {
    const el = document.querySelector(selector);
    if (el) {
        el.style.border = '3px solid red';
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        console.log('找到:', el);
    } else {
        console.log('未找到:', selector);
    }
    return el;
};

window.listAll = function() {
    const items = [];
    document.querySelectorAll('input, button, a, [role="button"], select, textarea').forEach(el => {
        items.push({
            tag: el.tagName,
            id: el.id || '',
            name: el.name || '',
            type: el.type || '',
            text: (el.textContent || '').slice(0, 50).trim(),
            class: el.className
        });
    });
    console.table(items);
    return items;
};

console.log('调试工具已加载: findEmail(), highlightInputs(), find(selector), listAll()');
</script>
`;

        // 在 </body> 前注入脚本
        const htmlWithDebug = html.replace('</body>', debugScript + '</body>');

        fs.writeFileSync(filepath, htmlWithDebug, 'utf-8');
        console.log(`[debug] HTML 已保存: ${filepath}`);

        return filepath;
    } catch (e) {
        console.error('[debug] 保存 HTML 失败:', e.message);
        return null;
    }
}

/**
 * 清空已保存 URL 记录（用于新一轮测试）
 */
function resetSavedUrls() {
    savedUrls.clear();
}

module.exports = {
    saveOnError,
    resetSavedUrls,
    isDebugMode,
    DEBUG_DIR
};
