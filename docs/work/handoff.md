# Handoff

状态：active

## 本次任务补充：手机号池状态改为管理员手动控制

目标：手机号不会因为一次激活/短信异常被自动作废；手机号是否可用由管理员在后台手机号池指定。

已完成：

- `server.js`
  - 自助激活分析结果中，手机号拒绝/短信异常不再设置 `deletePhone=true`。
  - `/api/run-process` 尝试阶段不再自动调用 `store.deletePhoneAsset()`。
- `product_activator.js`
  - 成品号激活分析结果中，手机号拒绝/短信异常不再设置 `deletePhone=true`。
  - 成品号流程不再自动调用 `store.deletePhoneAsset()`。
- `public/admin.html`
  - 手机号池“状态”改为管理员可编辑下拉：`正常` / `已报废`。
- `mysql-store.js`
  - 手机号池保存时保留管理员状态。
  - `正常` 对应 `is_active=1`，`已报废` 对应 `is_active=0`。
- `test/test_phone_assets_no_auto_disable.js`
  - 覆盖自助流程和成品号流程不会自动作废手机号。
- `test/test_phone_assets_admin_status.js`
  - 覆盖手机号池状态归一化。

验证：

- 新增测试先失败：
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

注意：

- 自动流程仍会释放手机号锁、更新成功次数。
- 只有后台手机号池状态为 `正常` 的号码会被自动任务选用。

## 本次任务补充：get_card_message 有效期格式归一化

目标：修正卡密缓存中 `expiry_date` 为 `2030/4` 时，入库 `CARD_EXPIRY` 应为 `0430`。

已完成：

- `get_card_message.js`
  - 新增 `normalizeCardExpiryForDatabase()`。
  - `formatCardForDatabase()` 现在会把有效期归一化为 `MMYY`。
  - 已覆盖格式：
    - `2030/4` -> `0430`
    - `4/2030` -> `0430`
    - `03/30` -> `0330`
- `test/test_get_card_message_format.js`
  - 新增有效期格式回归测试。
- `docs/project/get_card_message.md`
  - 记录 `CARD_EXPIRY` 入库格式。

验证：

- 新增测试先失败：`normalizeCardExpiryForDatabase is not a function`。
- `node .\test\test_get_card_message_format.js`：通过。
- `node .\test\test_card_asset_registrar.js`：通过。
- `node --check .\get_card_message.js`：通过。
- 当前缓存 `card_records\4859-6E97-MXGT94ZS-A575.json` 已验证输出 `CARD_EXPIRY=0430`。

## 本次任务补充：POST /api/run-process 卡资产结算顺序修正

目标：检查 `POST /api/run-process` 在“卡密兑换结构”下是否还需要改，并修正前台自助激活流程的卡资产并发窗口。

已完成：

- `server.js`
  - 自助流程已经通过 `cardAssetRegistrar.ensureRuntimeAssets()` 获取运行时资产；无已注册可用卡但有手机号时，会兑换未注册 `card_key` 并让当前任务直接使用。
  - 新增 `settleRunProcessAssets()`。
  - 激活成功时顺序调整为：`markCardAssetActivated()` -> `incrementAssetSuccessCount()` -> `releaseRuntimeAssets()`。
  - 银行卡被拒时顺序调整为：`deleteCardAsset({ cardAssetId, cardKey, cardNumber })` -> `releaseRuntimeAssets()`。
  - 正常成功路径不再等到最终收尾后才标记卡已激活；最终收尾只保留兜底。
- `docs/project/run-process-api-flow.md`
  - 更新 `POST /api/run-process` 调用链为卡密兑换结构。
  - 补充 `get_card_message.js` 兑换、BILLING 环境变量、`remark` 失败记录和先回写后释放锁的结算规则。
- `public/admin.html`
  - 银行卡池新增“卡状态”下拉，管理员可在 `正常` / `已报废` / `兑换异常` 间切换。
- `mysql-store.js`
  - 保存银行卡池时保留管理员选择的 `status`。
  - `正常` 对应 `is_active=1`，其他状态对应 `is_active=0`。
- `test/test_run_process_asset_settlement.js`
  - 覆盖自助流程成功和银行卡禁用时的资产结算顺序。

验证方式：

- 已先运行新增测试并确认失败：`server should expose test helpers`。
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

- `POST /api/run-process` 请求体和响应体没有变化。
- 自助流程没有邮箱上下文，`activation_account` 仍为空字符串。
- `product_activator.js` 没有直接使用 `is_activate` / `is_activated` 变量；可用卡筛选在 `mysql-store.js` 的 `buildCardPickWhereClause()` 中完成。
- 真实链路仍建议用一条未注册卡密跑通：兑换 -> 写回 CARD/BILLING -> 支付成功 -> `is_activated=1`。

## 本次任务补充：POST /api/run-process 调用链文档

目标：梳理 `POST /api/run-process` 自助激活接口的功能链调用流程，并沉淀到项目技术文档。

已完成：

- 新增 `docs/project/run-process-api-flow.md`。
- 覆盖链路：
  - `public/index.html` 发起请求并订阅 WebSocket。
  - `server.js` 路由同步校验 token、CDK、维护模式、并发和冷却。
  - `mysql-store.js` 锁定 CDK、创建任务、抢占手机号/银行卡/代理。
  - `server.js` 通过 `runCheckoutScript()` fork `index.js`。
  - `index.js` 调用 `chatgpt.js` 创建订单并执行 Stripe/PayPal 自动化。
  - 父进程解析输出、重试、禁用资产、更新任务状态、广播进度。
- 关键调用点已写明源码路径和行号。

验证方式：

- 使用 `rg` 和带行号读取核对：
  - `server.js`
  - `mysql-store.js`
  - `index.js`
  - `chatgpt.js`
  - `public/index.html`

注意：

- 本次只改文档，未改业务代码。
- 现有工作区在接手前已有多处未提交修改，本次未回滚或覆盖无关变更。

## 当前任务目标

银行卡池已从“卡号/有效期/CVC”改为“卡密兑换结构”：

- 批量导入只导入卡密。
- 未兑换/未注册时，CARD/BILLING 字段为空。
- 已注册且未激活的卡才会被自动任务选中。
- 激活成功后标记该卡已激活，避免重复使用。

## 已完成

### 数据结构

- `mysql-schema.sql`
  - `card_assets` 新增：
    - `card_key`
    - `is_registered`
    - `billing_country`
    - `billing_address`
    - `billing_city`
    - `billing_state`
    - `billing_zip`
    - `billing_name`
    - `card_sms`
    - `is_activated`
    - `activation_account`
    - `redeemed_at`
    - `remark`
- `mysql-store.js`
  - 后台返回/保存新字段。
  - 自动取卡条件改为：`is_active=1`、`is_registered=1`、`is_activated=0`、卡号/有效期/CVC 不为空。
  - 启动迁移会把旧卡号数据兼容成已注册卡，避免旧数据直接失效。
  - `remark` 字段用于保留卡密兑换失败、返回结构异常或人工排查备注。
  - 支持预留未注册卡密、兑换成功写回 CARD/BILLING、兑换失败写入备注。
- `card_asset_registrar.js`
  - 运行时资产获取封装。
  - 有已注册未激活卡时直接使用。
  - 没有可用卡时，预留未注册 `card_key`，调用 `get_card_message.js` 兑换，写回数据库并让当前任务继续使用该卡。
  - 兑换失败会写入 `remark` 并禁用该卡。

### 后台界面

- `public/admin.html`
  - 银行卡池表格改为：
    - 卡密
    - 是否注册
    - CARD_NUMBER
    - CARD_EXPIRY
    - CARD_CVC
    - BILLING_COUNTRY
    - BILLING_ADDRESS
    - BILLING_CITY
    - BILLING_STATE
    - BILLING_ZIP
    - BILLING_NAME
    - card_sms
    - 是否激活
    - 激活账号
    - 兑换时间
    - 备注
  - CARD/BILLING、激活账号、兑换时间、备注均为只读文本，不再渲染成输入框。
  - 前端会兼容旧 `number` 字段作为卡密兜底，避免后端未重启或旧数据导致卡密列空白。
  - 批量导入每行只接受卡密，例如：

```text
4859-F868-EMFMYMYY-B03E
```

### 激活回写

- `product_activator.js`
  - 成品号流程支付成功后，把本次卡标记为已激活，并写入激活账号邮箱。
  - 卡状态回写现在发生在释放资产锁之前，避免并发任务在短窗口内重复抢到同一卡。
  - 禁用卡和成功次数统计优先按运行时预留的 `cardAssetId` 定位，其次才兼容 `card_key` / `card_number`。
  - 激活前通过 `card_asset_registrar.ensureRuntimeAssets()` 获取资产，并向 `index.js` 传递 CARD 与 BILLING 字段。
- `server.js`
  - 前台 token 激活成功后，把本次卡标记为已激活；因流程没有账号邮箱，激活账号留空。
  - 自助激活流程同样通过 `card_asset_registrar.ensureRuntimeAssets()` 获取资产，并向 `index.js` 传递 CARD 与 BILLING 字段。

### 测试

- 新增 `test/test_card_assets_model.js`
  - 覆盖卡池字段归一化。
  - 覆盖自动取卡条件。
  - 覆盖卡资产定位优先级。
- 新增 `test/test_product_activator_asset_settlement.js`
  - 覆盖成品号流程中“标记/禁用卡状态早于释放资产锁”的顺序。
- 新增 `test/test_card_asset_registrar.js`
  - 覆盖已有可用卡不触发兑换。
  - 覆盖无可用卡时兑换未注册卡密、写回数据库字段并返回当前任务使用。

## 验证结果

- `node .\test\test_card_assets_model.js`：通过。
- `node .\test\test_card_asset_registrar.js`：通过。
- `node .\test\test_product_activator_asset_settlement.js`：通过。
- `node --check mysql-store.js`：通过。
- `node --check server.js`：通过。
- `node --check product_activator.js`：通过。
- `node --check card_asset_registrar.js`：通过。
- `node --check update-mysql-schema.js`：通过。
- `public/admin.html` 内联脚本语法检查：通过。
- `node .\test\test_card_admin_html_static.js`：通过。

## 当前注意点

- `激活账号` 当前只在成品号自动创建流程中能自动写入邮箱。
- 前台用户自带 token 激活流程没有可用邮箱上下文，因此只标记 `是否激活=是`，`激活账号` 为空。
- 卡密兑换已接入运行时资产获取；自动测试使用 mock，不请求真实接口。
- 真实兑换路径会用 `getCardMessage(key, { live: true })`，会请求外部兑换接口。
- 旧库升级可直接启动服务触发 `mysql-store.js` 的兼容迁移，也可运行 `node .\update-mysql-schema.js`。

## 推荐下一步

1. 启动后台，进入银行卡池页面检查新表格横向展示是否符合预期。
2. 用批量导入导入一条卡密，保存后刷新确认仍存在。
3. 用一条未注册卡密跑真实链路，确认兑换成功后写入：
   - `is_registered=1`
   - CARD/BILLING 字段
   - `redeemed_at`
4. 用一条已注册未激活卡跑一次真实流程，确认成功后 `是否激活` 回写；前台自助流程的 `激活账号` 留空属预期。
