class ChatGPTService {
    constructor(request, token) {
        this.request = request;
        this.token = token;
        this.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        };
        // 外部订单 API 配置
        this.orderApiUrl = "https://payurl.779.chat/api/request";
        this.maxRetries = 3;  // 最大重试次数
    }

    /**
     * 获取支付链接（通过外部 API）
     */
    async getPayPalApprovalUrl(config) {
        try {
            const payUrl = await this._createOrder();
            if (!payUrl) return null;

            console.log(`✅ 支付链接已生成`);
            return payUrl;
        } catch (e) {
            console.error("[-] 获取支付链接异常:", e.message);
            return null;
        }
    }

    /**
     * 创建订单 - 调用外部 API 获取支付链接
     * 自动重试最多 3 次
     */
    async _createOrder() {
        let lastError = null;

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                console.log(`[订单] 正在创建订单 (第 ${attempt}/${this.maxRetries} 次尝试)...`);

                const response = await this.request.post(this.orderApiUrl, {
                    headers: this.headers,
                    data: {
                        token: this.token,
                        plus: true
                    }
                });

                const statusCode = response.status();

                if (statusCode !== 200) {
                    const body = await response.text().catch(() => "");
                    console.error(`[-] 订单创建失败 (Status: ${statusCode})`);
                    console.error(`    响应: ${body}`);
                    lastError = new Error(`HTTP ${statusCode}`);

                    // 等待后重试
                    if (attempt < this.maxRetries) {
                        const waitMs = attempt * 2000;  // 递增等待: 2s, 4s
                        console.log(`[订单] 等待 ${waitMs / 1000} 秒后重试...`);
                        await this._sleep(waitMs);
                    }
                    continue;
                }

                const data = await response.json();

                // 检查响应状态
                if (data.status !== 'success') {
                    console.error(`[-] 订单创建失败 (status: ${data.status})`);
                    console.error(`    响应: ${JSON.stringify(data)}`);
                    lastError = new Error(data.message || data.status || '未知错误');

                    // 如果是明确的权限错误，不再重试
                    if (data.status === 'not_eligible' || data.status === 'permission_denied') {
                        console.error("❌ [提示] 该账号无激活权限，请丢弃！(无激活权限)");
                        return null;
                    }

                    // 等待后重试
                    if (attempt < this.maxRetries) {
                        const waitMs = attempt * 2000;
                        console.log(`[订单] 等待 ${waitMs / 1000} 秒后重试...`);
                        await this._sleep(waitMs);
                    }
                    continue;
                }

                // 提取支付链接
                const payUrl = data.openai_payurl;
                if (!payUrl) {
                    console.error(`[-] 订单创建失败: 响应中缺少 openai_payurl`);
                    console.error(`    响应: ${JSON.stringify(data)}`);
                    lastError = new Error('响应中缺少 openai_payurl');

                    if (attempt < this.maxRetries) {
                        const waitMs = attempt * 2000;
                        console.log(`[订单] 等待 ${waitMs / 1000} 秒后重试...`);
                        await this._sleep(waitMs);
                    }
                    continue;
                }

                console.log(`✅ 订单创建成功`);
                return payUrl;

            } catch (e) {
                console.error(`[-] 订单创建异常 (第 ${attempt} 次): ${e.message}`);
                lastError = e;

                if (attempt < this.maxRetries) {
                    const waitMs = attempt * 2000;
                    console.log(`[订单] 等待 ${waitMs / 1000} 秒后重试...`);
                    await this._sleep(waitMs);
                }
            }
        }

        // 3 次都失败
        console.error(`❌ [提示] 订单创建失败，已重试 ${this.maxRetries} 次: ${lastError?.message || '未知错误'}`);
        return null;
    }

    /**
     * 延时工具函数
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = ChatGPTService;
