# Work Log

## 2026-05-16 - 手机号池状态改为管理员手动控制

目标：手机号不会因为一次激活/短信异常被自动作废；手机号是否作废由管理员在后台手机号池手动指定。

已完成：

- `server.js`
  - 自助激活流程中，手机号被拒绝或短信异常时仍重试，但 `deletePhone=false`。
  - 移除 `/api/run-process` 尝试阶段自动调用 `store.deletePhoneAsset()` 的逻辑。
- `product_activator.js`
  - 成品号激活流程中，手机号被拒绝或短信异常时仍重试，但 `deletePhone=false`。
  - 移除成品号流程自动禁用手机号的逻辑。
- `public/admin.html`
  - 手机号池“状态”从只读徽标改为管理员可编辑下拉：`正常` / `已报废`。
- `mysql-store.js`
  - 保存手机号池时保留管理员选择的 `status`。
  - `status='正常'` 归一化为 `is_active=1`，`status='已报废'` 归一化为 `is_active=0`。
- `test/test_phone_assets_no_auto_disable.js`
  - 覆盖自助流程和成品号流程遇到手机号拒绝/短信超时时不会自动作废手机号。
- `test/test_phone_assets_admin_status.js`
  - 覆盖手机号池管理员状态保存归一化。

验证：

- 已先运行新增测试并确认失败：
  - `normalizePhonePool` 未暴露。
  - 后台页面没有 `handlePhoneStatusChange`。
- `node .\test\test_phone_assets_admin_status.js`：通过。
- `node .\test\test_phone_assets_no_auto_disable.js`：通过。
- `node .\test\test_card_admin_html_static.js`：通过。
- `node .\test\test_card_assets_model.js`：通过。
- `node .\test\test_product_activator_asset_settlement.js`：通过。
- `node .\test\test_run_process_asset_settlement.js`：通过。
- `node --check .\server.js`：通过。
- `node --check .\product_activator.js`：通过。
- `node --check .\mysql-store.js`：通过。
- `public/admin.html` 内联脚本语法检查：通过。

## 2026-05-16 - get_card_message 有效期格式归一化

目标：修正卡密缓存中 `expiry_date` 为 `2030/4` 这类格式时，入库 `CARD_EXPIRY` 不应原样保存，而应转换成 PayPal 表单需要的 `MMYY`。

已完成：

- `get_card_message.js`
  - 新增 `normalizeCardExpiryForDatabase()`。
  - `formatCardForDatabase()` 写入 `CARD_EXPIRY` 前统一归一化。
  - 支持 `2030/4`、`4/2030`、`03/30` 等格式转成 `0430` / `0330`。
- `test/test_get_card_message_format.js`
  - 覆盖 `2030/4 -> 0430`。
  - 覆盖 `03/30 -> 0330`。
  - 覆盖 `4/2030 -> 0430`。
- `docs/project/get_card_message.md`
  - 记录 `CARD_EXPIRY` 入库格式为 `MMYY`。

验证：

- 已先运行新增测试并确认失败：`normalizeCardExpiryForDatabase is not a function`。
- `node .\test\test_get_card_message_format.js`：通过。
- `node .\test\test_card_asset_registrar.js`：通过。
- `node --check .\get_card_message.js`：通过。
- 使用当前缓存 `card_records\4859-6E97-MXGT94ZS-A575.json` 验证，`CARD_EXPIRY` 输出为 `0430`。

## 2026-05-16 - POST /api/run-process 卡资产结算顺序修正

目标：核对 `POST /api/run-process` 在卡密兑换结构下是否仍有需要修改的点，并修正前台自助激活流程中“成功卡先释放锁、后标记已激活”的并发窗口。

已完成：

- `server.js`
  - 新增 `settleRunProcessAssets()`，统一处理前台自助激活流程的卡资产结算。
  - 激活成功时先调用 `markCardAssetActivated(cardAssetId, '')`，再更新手机号/银行卡成功次数，最后释放运行时资产锁。
  - 银行卡被拒时先按 `cardAssetId/cardKey/cardNumber` 禁用卡，再释放运行时资产锁。
  - 保留最终成功阶段的兜底回写，但正常成功路径不再等到最终收尾后才标记卡已激活。
- `test/test_run_process_asset_settlement.js`
  - 覆盖自助流程成功时 `mark -> increment -> release` 的顺序。
  - 覆盖自助流程银行卡禁用时 `deleteCard -> release` 的顺序。
- `docs/project/run-process-api-flow.md`
  - 更新为 `cardAssetRegistrar.ensureRuntimeAssets()` 调用链。
  - 补充未注册卡密兑换、`remark` 失败记录、BILLING 环境变量和先回写后释放锁的结算规则。
- `docs/project/2026-05-16_银行卡池改为卡密兑换结构.md`
  - 补充前台自助激活流程的资产结算顺序和新增测试。
- `public/admin.html`
  - 银行卡池新增管理员可编辑的“卡状态”下拉：`正常` / `已报废` / `兑换异常`。
- `mysql-store.js`
  - 保存银行卡池时保留管理员选择的 `status`。
  - `status='正常'` 归一化为 `is_active=1`，其他状态归一化为 `is_active=0`。

验证：

- 已先运行新增测试并确认失败：`server should expose test helpers`，证明测试覆盖到尚未实现的行为。
- `node .\test\test_run_process_asset_settlement.js`：通过。
- `node .\test\test_card_asset_registrar.js`：通过。
- `node .\test\test_product_activator_asset_settlement.js`：通过。
- `node .\test\test_card_assets_model.js`：通过。
- `node .\test\test_card_admin_html_static.js`：通过。
- `node --check .\server.js`：通过。
- `node --check .\card_asset_registrar.js`：通过。
- `node --check .\mysql-store.js`：通过。
- `node --check .\product_activator.js`：通过。
- `public/admin.html` 内联脚本语法检查：通过。

注意：

- 本次不改变 `POST /api/run-process` 的请求/响应契约。
- 前台自助流程没有账号邮箱上下文，因此激活账号仍写空字符串。
- `product_activator.js` 没有直接使用 `is_activate` / `is_activated` 变量；它通过 `card_asset_registrar.ensureRuntimeAssets()` 获取已经由数据库筛选好的可用卡，并在成功后调用 `markCardAssetActivated()` 回写。

## 2026-05-16 - POST /api/run-process 调用链文档

目标：梳理用户侧自助激活接口 `POST /api/run-process` 的功能链调用流程，并写入项目技术文档。

已完成：

- 新增 `docs/project/run-process-api-flow.md`。
- 梳理前端触发、后端同步校验、CDK 锁定、任务日志、运行时资产抢占、`index.js` 子进程执行、输出分析、重试、资产处理、WebSocket 进度广播和最终状态收尾。
- 标明关键调用点的源码路径和行号。

验证：

- 文档基于 `server.js`、`mysql-store.js`、`index.js`、`chatgpt.js`、`public/index.html` 当前源码逐段核对。

注意：

- 本次只新增/更新文档，未修改业务代码。

## 2026-05-15 - PayPal 强制英文链路回退与风控诊断收敛

目标：根据本地浏览器同 URL 不触发风控、自动化触发风控的现象，回退自动化侧额外强制英文与挑战处理干预，保留只读诊断日志。

已完成：

- 移除 `index.js` 中 PayPal 主页面 URL 自动追加 `locale.x=en_US` / `country.x=US`。
- 移除 `index.js` 中 PayPal document 请求 `accept-language` 覆盖。
- 移除 `index.js` 中 PayPal `LANG=en_US%3BUS` / `cookie_check` cookie 预设。
- 移除 Chrome 启动参数 `--lang=en-US`。
- 移除 `chatgpt.js` 订单接口请求头与 payload 中的英文/美国地区强制字段。
- 移除 `lib/california-fingerprint.js` 注入脚本中对 `navigator.language` / `navigator.languages` 的硬编码覆盖。
- 保留 `[PayPal Locale] page=...` 页面语言诊断日志。
- 移除 `auth/validatecaptcha` 空白响应拦截。
- 将 PayPal 验证/挑战处理改为仅记录 iframe 诊断，不再自动点击或拖动。

验证：

- `node --check .\index.js`：通过。
- `node --check .\chatgpt.js`：通过。
- `node --check .\lib\california-fingerprint.js`：通过。
- `node .\test\test_fingerprint_guard.js`：仍失败；失败点为现有测试要求至少两个完整指纹 profile，但当前 `FINGERPRINT_PROFILES` 只有一个 profile，和本次强制英文回退无直接关系。

风险与注意：

- 默认生成的加州 baseline 数据仍包含 `en-US/en`，但不再通过 PayPal URL/header/cookie 或页面 JS 注入强制覆盖语言。
- 如果自动化仍触发风控，下一步应优先对比本地浏览器与 Playwright 的运行环境差异：持久化用户数据目录、headless/headful、Chrome channel、扩展/缓存/cookie、TLS/代理出口、鼠标键盘事件节奏、Playwright 默认特征。

## 2026-05-15 - 恢复 PayPal 安全挑战处理逻辑

目标：按用户要求恢复此前移除的两块挑战处理逻辑，同时继续保持强制英文 URL/header/cookie 回退状态。

已完成：

- 恢复 `index.js` 中 `**/auth/validatecaptcha` 空白页拦截。
- 恢复 `solveSlider()` 验证按钮点击、滑块拖动、reCAPTCHA 图片验证检测逻辑。
- 恢复支付表单等待阶段对 `solveSlider()` 的轮询调用。
- 更新 `test/test_fingerprint_guard.js` 中对应断言，明确当前项目期望保留上述挑战处理逻辑。

验证：

- `node --check .\index.js`：通过。
- `node --check .\chatgpt.js`：通过。
- `node --check .\lib\california-fingerprint.js`：通过。
- `node .\test\test_fingerprint_guard.js`：仍失败；失败点仍为 `limited random generation should select from at least two complete profiles`，与本次恢复挑战处理逻辑无直接关系。

## 2026-05-15 - PayPal country.x=CN 来源追踪

目标：区分 `country.x=CN` 是订单接口初始 PayPal URL 已携带，还是 PayPal 服务端后续重定向时追加。

已完成：

- 新增 `getPayPalLocaleTrace()` / `logPayPalLocaleTrace()` 只读诊断。
- 在订单 URL 生成后输出 `[PayPal Locale Trace] initial-paypal-url=...`。
- 在 PayPal 主 frame 导航时输出 `[PayPal Locale Trace] navigation=...`。
- 诊断字段包含主 URL 与 `state` 内部的 `country.x` / `locale.x` / `token` / `ba_token`。

注意：

- 该变更只记录，不改写 URL、header、cookie 或页面 JS。

## 2026-05-15 - 临时强制 PayPal URL 为 CN/en_CN

目标：按用户要求验证 PayPal URL 参数 `country.x=CN&locale.x=en_CN` 对当前链路的影响。

已完成：

- 新增 `forcePayPalChinaLocaleUrl()`。
- 初始 PayPal URL 进入 `page.goto()` 前强制设置：
  - `country.x=CN`
  - `locale.x=en_CN`
- PayPal 主页面 document 导航通过 `context.route()` 强制设置同样参数。
- 未改动 header、cookie、navigator 语言。

验证：

- `node --check .\index.js`：通过。

## 2026-05-15 - PayPal URL 强制参数改为 US/en_US

目标：按用户要求将 PayPal URL 参数从 `country.x=CN&locale.x=en_CN` 改为英文美国地区。

已完成：

- `forcePayPalChinaLocaleUrl()` 改名为 `forcePayPalUsLocaleUrl()`。
- URL 参数改为：
  - `country.x=US`
  - `locale.x=en_US`
- 日志改为 `[PayPal Locale] force US/en_US...`。

## 2026-05-15 - PayPal 支付信息页专项测试与测试索引

目标：方便从 PayPal 邮箱提交后的支付信息页开始单独调试，不必每次跑完整注册/Stripe 流程。

已完成：

- 新增 `test/test_paypal_payment_form.js`。
  - 支持传入 PayPal signup URL 或 `PAYPAL_SIGNUP_URL`。
  - 支持 `--submit`、`--headless`、`--keep-open`。
  - 默认只填表并校验，不点击最终提交。
  - 自动加载 `.env`，并导入脚本内测试默认 `env`。
  - 修复启动前预检错误被吞掉的问题，缺字段时明确输出缺失环境变量。
- 新增 `test/PROJECT_MAP.md`。
  - 简要说明 `test/` 下每个测试文件的用途、参数和依赖环境。
- 新增 `docs/project/2026-05-15_PayPal支付信息页专项测试.md`。

验证：

- `node --check test\test_paypal_payment_form.js`：通过。

## 2026-05-15 - PayPal 邮箱/手机号输入改为 fill 模式

目标：按用户要求让 PayPal 链路中的卡号、手机号、邮箱都走 `fill()` 路径，减少逐字符输入带来的格式化吞字符或风控抖动。

已完成：

- `index.js`
  - PayPal 登录邮箱：`humanFillInput(..., false, true)`。
  - PayPal 支付表单邮箱：`humanFillInput(..., false, true)`。
  - PayPal 手机号：`humanFillInput(..., true, false)`。
  - 卡号保持原逻辑：`digitsMode=true`，本来已走 `fill()`。
  - PayPal 表单校验失败后的邮箱重填同步支持 `fastMode`。

验证：

- `node --check index.js`：通过。
- 静态断言确认登录邮箱、支付表单邮箱、手机号和校验重填都使用目标模式。

## 2026-05-16 - 银行卡池改为卡密兑换结构

目标：把后台“银行卡池”改成以卡密为入口的数据结构；批量导入只导入卡密，未兑换时 CARD/BILLING 字段为空，已激活卡不再被自动任务复用。

已完成：

- `public/admin.html`
  - 银行卡池表格改为：卡密、是否注册、CARD/BILLING 字段、card_sms、是否激活、激活账号、兑换时间。
  - 批量导入改为每行一个卡密，例如 `4859-F868-EMFMYMYY-B03E`。
  - `是否注册` / `是否激活` 可手动切换；`激活账号` 只读。
  - 修正 CARD/BILLING 字段不应显示为输入框的问题，改成只读文本。
  - 增加前端旧数据兼容：后端仍返回旧 `number` 结构时，前端会用它兜底显示卡密，避免空白行。
- `mysql-schema.sql` / `mysql-store.js`
  - `card_assets` 新增卡密、注册状态、账单信息、激活状态、激活账号、兑换时间字段。
  - 自动取卡条件改为：已注册、未激活、卡号/有效期/CVC 不为空、未禁用。
  - 旧卡数据启动迁移为已注册卡，`card_key` 兼容填原卡号，避免已有可用卡直接失效。
- `server.js` / `product_activator.js`
  - 激活成功后把本次使用的卡标记为已激活。
  - 成品号流程会写入激活账号邮箱；前台 token 激活流程无邮箱时只标记已激活。
- `update-mysql-schema.js`
  - 补充旧库升级字段。
- `test/test_card_assets_model.js`
  - 新增卡池归一化和取卡条件单元测试。

验证：

- `node .\test\test_card_assets_model.js`：通过。
- `node --check mysql-store.js`：通过。
- `node --check server.js`：通过。
- `node --check product_activator.js`：通过。
- `node --check update-mysql-schema.js`：通过。
- `public/admin.html` 内联脚本语法检查：通过。
- `node .\test\test_card_admin_html_static.js`：通过。

## 2026-05-16 - 银行卡池前端修正与测试卡数据写入

目标：修正银行卡池前端展示问题，并向当前 MySQL 数据库写入一条已注册、未激活的测试卡数据，便于后续真实流程验证。

已完成：

- `public/admin.html`
  - CARD_NUMBER、CARD_EXPIRY、CARD_CVC、BILLING_*、card_sms、激活账号、兑换时间改为只读文本，不再显示为输入框。
  - 仅保留可编辑项：
    - 卡密
    - 是否注册
    - 是否激活
  - 表格增加最小宽度，避免大量列被压缩到看不清。
  - 前端增加 `normalizeCardForUi()`，兼容旧后端/旧数据返回的 `number` 字段，避免卡密列空白。
  - 批量导入卡密校验改为每行一个非空字符串，降低误判。
- `mysql-store.js`
  - 保存卡池时兼容 `card_key`、`key`、`cardKey`、`number`、`card_number`，避免旧数据结构无法保存。
- `test/test_card_admin_html_static.js`
  - 新增静态回归测试，防止 CARD/BILLING 字段再次被渲染成可编辑输入框。
- 数据库 `plus_papay.card_assets`
  - 插入/更新测试卡：

```text
card_key: TEST-4859540166445568-0230-532
is_registered: 1
is_activated: 0
is_active: 1
status: 正常
CARD_NUMBER: 4859540166445568
CARD_EXPIRY: 02/30
CARD_CVC: 532
BILLING_COUNTRY: US
BILLING_ADDRESS: 15810 Gale Ave
BILLING_CITY: Hacienda Heights
BILLING_STATE: CA
BILLING_ZIP: 91745
BILLING_NAME: DOMINIQUE CAMPBELL
card_sms: 空
```

验证：

- `node .\test\test_card_admin_html_static.js`：通过。
- `node .\test\test_card_assets_model.js`：通过。
- `node --check mysql-store.js`：通过。
- `node --check server.js`：通过。
- `node --check product_activator.js`：通过。
- `node --check update-mysql-schema.js`：通过。
- `public/admin.html` 内联脚本语法检查：通过。
- 数据库查询确认测试卡已写入，`status` 为 UTF-8 正常显示的 `正常`。

注意：

- `BILLING_EMAIL` 当前不在 `card_assets` 表结构中，本次没有写入数据库。
- 插入测试数据时发现 Windows PowerShell + Node 内联脚本容易破坏反引号和中文字面量，已记录到 `C:\Users\zp\.learnings\ERRORS.md`。

## 2026-05-15 - PayPal 中文页面自动切换英文与日志收敛

目标：在 PayPal 跳转后如果页面是中文，先点击 English 切换到英文，再等待 `Create an Account`；同时压缩 PayPal locale 日志，避免完整 URL/JSON 刷屏。

已完成：

- `index.js`
  - 新增 `ensurePayPalEnglishLanguage()`。
  - 在 `solveSlider()` + `checkCriticalErrors()` 之后、等待 `Create an Account` 之前检测语言。
  - 刷新重试后再次检测语言。
  - 中文判定依据：
    - `html lang` 为 `zh`。
    - 隐藏字段 `input[name="locale.x"]` 为 `zh_CN`。
    - URL 含 `locale.x=zh` 或 `country.x=CN`。
    - 页面可见文案包含 `登录您的PayPal账户`、`创建账户`、`下一步`、`邮箱地址`。
  - English 入口选择器：
    - `a[data-locale="en_US"]`
    - `a[lang="en"][href*="locale.x=en_US"]`
    - `.scTrack\:unifiedlogin-footer-language_en_US`
    - `a:has-text("English")`
  - PayPal locale 日志默认改为简洁摘要，只显示 path、htmlLang、country、locale。
  - 完整 JSON 仅在 `DEBUG_PAYPAL_LOCALE=1` 或 `DEBUG_PAYPAL_LOCALE=true` 时输出。
- 新增 `docs/project/2026-05-15_PayPal中文页面自动切换英文.md`。

验证：

- `node --check index.js`：通过。
- 静态断言确认语言检测函数、调用点、简洁日志和 debug JSON 开关存在。

## 2026-05-16 - 成品号卡密资产回写并发窗口修正

目标：修正成品号流程中“卡状态回写晚于释放资产锁”的并发窗口，并让卡资产禁用/成功计数优先按运行时预留行 `id` 定位。

已完成：

- `product_activator.js`
  - 新增资产结算 helper：激活成功时先 `markCardAssetActivated(cardAssetId, email)`，再释放资产锁。
  - 银行卡被拒需要禁用时，先按 `cardAssetId/cardKey/cardNumber` 禁用卡，再释放资产锁，降低并发复用风险。
  - 成功次数更新传入 `cardAssetId` 与 `cardKey`，不再只依赖 `card_number`。
- `mysql-store.js`
  - 新增卡资产定位逻辑：优先 `id`，其次 `card_key`，最后兼容旧 `card_number`。
  - `deleteCardAsset()` 支持对象参数，同时保留旧字符串参数兼容。
  - `incrementAssetSuccessCount()` 支持按 `cardAssetId/cardKey/cardNumber` 更新卡成功次数。
- `test/test_product_activator_asset_settlement.js`
  - 覆盖“标记/禁用卡状态必须早于释放资产锁”的调用顺序。
- `test/test_card_assets_model.js`
  - 覆盖卡资产定位优先级。

验证：

- `node .\test\test_product_activator_asset_settlement.js`：通过。
- `node .\test\test_card_assets_model.js`：通过。
- `node --check product_activator.js`：通过。
- `node --check mysql-store.js`：通过。

## 2026-05-16 - card_assets 增加 remark 备注字段

目标：为后续卡密兑换失败、接口返回异常或未知错误提供可排查的持久化备注字段。

已完成：

- `mysql-schema.sql`
  - `card_assets` 新增 `remark TEXT NULL`。
- `update-mysql-schema.js`
  - 旧库升级时补充 `remark` 字段。
- `mysql-store.js`
  - 卡池归一化、后台读取、保存逻辑加入 `remark`。
- `public/admin.html`
  - 银行卡池表格新增“备注”只读列。
  - 新增/导入卡密时默认 `remark=''`。
- `test/test_card_assets_model.js`
  - 覆盖 `remark` 归一化和未兑换卡默认空备注。
- `test/test_card_admin_html_static.js`
  - 覆盖后台表格需要展示备注字段。

验证：

- `node .\test\test_card_assets_model.js`：通过。
- `node .\test\test_card_admin_html_static.js`：通过。
- `node --check mysql-store.js`：通过。
- `node --check update-mysql-schema.js`：通过。

## 2026-05-17 - ChatGPT checkout 长链提取接入 chatgpt.js

目标：按 `get_stripe.js` 的长链提取方式重构 `chatgpt.js`，但保持原函数返回值不变。

已完成：

- `chatgpt.js`
  - `_createOrder()` 改为调用 `https://chatgpt.com/backend-api/payments/checkout`。
  - 固定使用 `http://127.0.0.1:7891` 代理，不读取 `process.env.PROXY`。
  - 保持 `getPayPalApprovalUrl()` / `_createOrder()` 成功返回支付长链接字符串、失败返回 `null`。
  - 响应中按 `url` / `stripe_hosted_url` / `checkout_url` 提取长链接。
  - 保留最多 3 次重试。
- `test/test_chatgpt_create_order.js`
  - 新增 mock Playwright request context 的回归测试，验证代理、checkout URL、请求头、payload 和返回值兼容性。
- `test/test_generate_payurl.js`
  - 更新为直接通过 `ChatGPTService` 测试新链路，不再从环境变量读取代理。
- `docs/project/run-process-api-flow.md`
  - 更新订单创建段落，移除旧 `payurl.779.chat` 描述。
- `README.md`
  - 新增“支付链接生成代理”说明，写明 `chatgpt.js` 使用代码内固定代理 `DEFAULT_PROXY_URL`，以及如何修改和单测。

验证：

- 新增测试先失败：旧 `_createOrder()` 仍依赖构造函数传入的 `request.post()`。
- `node .\test\test_chatgpt_create_order.js`：通过。
- `node -c .\chatgpt.js`：通过。
- `node -c .\test\test_chatgpt_create_order.js`：通过。
- `node .\test\test_generate_payurl.js --help`：通过。
- `node .\test\test_generate_payurl.js`：无 token 时按预期退出码 1 并显示用法。
- `README.md` 已补充代理修改说明。

注意：

- 真实长链测试仍需要传入有效 `CHATGPT_TOKEN`，且本机 `http://127.0.0.1:7891` 代理可用。
- `get_stripe.js` 和 `test/test_get_stripe.js` 是接手前已有未跟踪文件，本次未修改。

## 2026-05-17 - 代理桥接链路排查

目标：排查后台代理测试成功，但 `local-proxy-bridge.js` 日志出现 `→ :1080 → 目标` 和 `read ECONNRESET` 的原因。

已完成：

- `chatgpt.js`
  - 经用户确认，支付长链生成的正确本地代理是 `http://127.0.0.1:7891`，已同步 README、测试和项目文档。
- `local-proxy-bridge.js`
  - `parseProxyUrl()` 增加远程代理 host/port 必填校验。
  - 避免代理 URL 缺 host 时被静默解析为 `:1080`，导致日志误导和后续连接失败。
- `test/test_local_proxy_bridge_parse.js`
  - 新增代理 URL 解析测试，覆盖正常 SOCKS5 URL、缺 host、缺 port。

判断：

- 看到日志 `链路: 浏览器 → :10900 → VPN(http://:7897) → :1080 → 目标` 时，说明传入桥接模块的远程代理 URL 不完整；正确链路应显示类似 `→ us2.cliproxy.io:3010 → 目标`。
- 若代理桥接链路里远程 host/port 正确但仍 `read ECONNRESET`，再排查桥接链路上游 HTTP 代理 `127.0.0.1:7897` 的规则、DNS 和是否允许 CONNECT 到远程 SOCKS5；这和 `chatgpt.js` 支付长链的 `7891` 是两条链路。

验证：

- `node .\test\test_local_proxy_bridge_parse.js`：通过。
- `node .\test\test_chatgpt_create_order.js`：通过。
- `node --check .\local-proxy-bridge.js`：通过。
- `node --check .\chatgpt.js`：通过。
- `rg -n -S "127\.0\.0\.1:7891|127\.0\.0\.1:7897|DEFAULT_PROXY_URL" chatgpt.js README.md docs\work docs\project test`：确认支付长链默认代理已统一到 `7891`；`7897` 只保留在其他代理桥接链路说明中。

## 2026-05-16 - 接通 get_card_message 卡密兑换到运行时资产

目标：当卡池没有已注册未激活可用卡时，自动使用未注册卡密调用 `get_card_message.js` 兑换，写回数据库后继续当前激活流程。

已完成：

- `card_asset_registrar.js`
  - 新增运行时资产获取封装。
  - 优先使用已有已注册未激活卡。
  - 没有可用卡但已抢到手机号时，预留未注册卡密并调用 `getCardMessage(key, { live: true })`。
  - 用 `formatCardForDatabase()` 转换 CARD/BILLING 字段。
  - 兑换成功后写回 `card_assets`，并直接返回给当前任务使用。
  - 兑换失败或缺少关键 CARD 字段时，写入 `remark`，标记 `status='兑换异常'` 并禁用该卡。
- `mysql-store.js`
  - 新增 `reserveUnregisteredCardAsset()`。
  - 新增 `markCardAssetRegistered()`。
  - 新增 `markCardAssetExchangeFailed()`。
  - `reserveRuntimeAssets()` / `getRuntimeAssets()` 返回卡资产时包含 BILLING 字段。
- `product_activator.js`
  - 成品号流程改用 `card_asset_registrar.ensureRuntimeAssets()`。
  - 向 `index.js` 子进程传递 `BILLING_COUNTRY/BILLING_ADDRESS/BILLING_CITY/BILLING_STATE/BILLING_ZIP/BILLING_NAME`。
- `server.js`
  - 自助 token 激活流程改用 `card_asset_registrar.ensureRuntimeAssets()`。
  - 向 `index.js` 子进程传递 BILLING 字段。
  - 禁用卡和成功次数统计补充 `cardAssetId/cardKey` 优先定位。
- `test/test_card_asset_registrar.js`
  - 覆盖已有可用卡不触发兑换。
  - 覆盖无可用卡时兑换未注册卡密、写回数据并返回当前任务使用。
- `docs/project/get_card_message.md`
  - 补充当前项目运行时接入方式、失败处理和下游环境变量传递。

验证：

- `node .\test\test_card_asset_registrar.js`：通过。
- `node .\test\test_card_assets_model.js`：通过。
- `node .\test\test_card_admin_html_static.js`：通过。
- `node .\test\test_product_activator_asset_settlement.js`：通过。
- `node --check card_asset_registrar.js`：通过。
- `node --check mysql-store.js`：通过。
- `node --check product_activator.js`：通过。
- `node --check server.js`：通过。

注意：

- 自动测试使用 mock `getCardMessage()`，不会请求真实兑换接口，也不会消耗真实卡密。
- 真实兑换调用路径会使用 `{ live: true }`。

## 2026-05-17 - PayPal 邮箱输入框定位兼容修复

目标：排查 `PayPal 邮箱输入框定位失败: getByRole('textbox', { name: 'Enter email' })`。

已完成：

- 检查异常截图 `debug_screenshots/激活/error_1779007858776.png`，页面实际已显示 `Email` 输入框和 `Continue to Payment` 按钮。
- 检查保存页面 `debug_html/Log in to your PayPal account.mhtml`，当前 DOM 中邮箱框为：
  - `input#email`
  - `name="login_email"`
  - `type="email"`
  - `placeholder="Email or mobile number"`
- `index.js`
  - 将单一 role/name 定位 `getByRole('textbox', { name: 'Enter email' })` 改为可见 email input 选择器兜底：
    - `input#email`
    - `input[name="login_email"]`
    - `input[type="email"]`
    - `input[name*="email" i]`
    - `input[placeholder*="Email" i]`

验证：

- `node --check index.js`：通过。
- MHTML 证据确认新选择器可命中当前失败页面中的邮箱输入框。

注意：

- 根因是 PayPal 当前页面的邮箱输入框 accessible name/label 不是 `Enter email`，而是 `Email or mobile number`/`Email` 相关文案；旧定位器过窄。

## 2026-05-15 - Stripe 提交后 HumanSecurity 等待日志

目标：解释 `✅ [安全] 最终检查通过，准备点击按钮` 后看似卡顿的原因。

已完成：

- `index.js`
  - 在 `mouseBreathing(page, randomDelay(6000, 8000))` 前新增日志：
    - `⏳ [风控] Stripe 提交后等待 HumanSecurity 6-8 秒...`
  - 未修改等待时长和行为。

验证：

- `node --check index.js`：通过。

## 2026-05-18 - README 启动与配置说明修正

目标：修正 README 中不符合当前仓库事实的仓库地址、启动方式和 `.env` 配置说明。

已完成：

- `README.md`
  - 仓库地址改为当前 `origin`：`git@github.com:12996/auto-paypal.git`。
  - 启动方式改为 `npm start` / `npm run start:headful`，不再推荐把 DB 环境变量全部写在启动命令中。
  - 重写 `.env` 配置说明，明确最小必填项、后台配置优先级、邮箱模式、Gmail IMAP 使用条件。
  - 移除不存在的截图和赞赏图引用。
  - 明确项目没有内置 IMAP Server，只是 IMAP 客户端或远程 IMAP 管理 API 客户端。

验证：

- `rg` 检查旧 GitHub 地址、赞赏图、缺失截图引用已移除。
