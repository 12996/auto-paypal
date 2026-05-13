# reCAPTCHA 检测误判问题

## 问题描述
在支付流程中，`checkUnsolvableCaptcha()` 函数误将正常的 reCAPTCHA 加载框架判定为图片验证，导致支付流程中断。

## 错误日志
```
21:32:29  qgb2y8d5  结账  ❌ [风控] 检测到 reCAPTCHA 图片验证，无法自动解决: https://www.recaptcha.net/recaptcha/enterprise/bframe?hl=en&v=U5VsmTDhJM1iOJUyw4DEUTYv&k=6LdZXVcsAAAAAJKTQe5_Qe4pEYCfVFkVSVaNXM1M&bft=0dAFcWeA7lj99aGcmuqJaSkH6190bQTs9hq7_E-3QyaHbxlwzQCznXogViwd9eikQJ0om-NmNeemO2NBu7ss28uPPuacbaF4tdzg
```

## 问题根因
`checkUnsolvableCaptcha()` 函数中的 URL 检测逻辑过于宽泛：
```javascript
// 额外检查：reCAPTCHA bframe iframe 的存在
const url = frame.url() || '';
if (/recaptcha.*bframe/i.test(url)) {
    return { selector: url, found: true };
}
```

这段代码把所有包含 `recaptcha.*bframe` 的 iframe 都当作图片验证，但实际上 bframe 可能只是 reCAPTCHA 的加载框架。

## 临时解决方案
已注释掉有问题的 URL 检测代码。

## 待解决的设计问题
1. **检测时机**：不应该立即检测人机验证，应该在适当的时机进行
2. **检测精度**：需要更精确的检测逻辑，区分正常加载框架和真正的图片验证
3. **检测条件**：应该检测页面是否出现了：
   - 认证框（图片选择界面）
   - 具体的人机验证挑战内容
   - 而不是仅仅检测 reCAPTCHA 框架的存在

## 相关代码位置
- 文件：`index.js`
- 函数：`checkUnsolvableCaptcha()`
- 行号：约 713-730 行

## 状态
🔴 **未解决** - 需要重新设计人机验证检测逻辑