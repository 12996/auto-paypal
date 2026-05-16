# 兑换接口调用说明

本文档说明 `index.html` 中已经提取出的兑换请求函数需要传入什么参数、返回什么结果，以及前端如何接收。

## 1. 固定接口地址

源码位置：`index.html:371`

```js
const API_BASE = 'https://cards.779.chat/api/exchange';
```

实际兑换验证接口：

```text
POST https://cards.779.chat/api/exchange/verify
```

## 2. 底层请求函数：verifyExchangeKey

源码位置：`index.html:606`

```js
async function verifyExchangeKey(key) {
  return fetch(`${API_BASE}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: key })
  });
}
```

### 传入参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `key` | `string` | 是 | 用户输入的卡密，一个函数调用只处理一个卡密。 |

### 请求体

函数会把 `key` 组装成 JSON 请求体：

```json
{
  "key": "用户输入的卡密"
}
```

### 返回结果

`verifyExchangeKey(key)` 返回的是原始 `fetch Response` 对象，不会自动解析 JSON。

调用方需要自己判断 HTTP 状态码，并用 `await resp.json()` 接收接口返回的 JSON。

示例：

```js
const resp = await verifyExchangeKey('KEY-001');

if (!resp.ok) {
  console.log('请求失败，HTTP 状态码：', resp.status);
  return;
}

const data = await resp.json();
console.log('接口返回数据：', data);
```

## 3. 推荐使用的封装函数：processSingleKey

源码位置：`index.html:618`

```js
async function processSingleKey(key) {
  const verifyResp = await verifyExchangeKey(key);
  // 后续负责处理 HTTP 状态码、解析 JSON、转换成统一结果
}
```

### 传入参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `key` | `string` | 是 | 单个卡密。 |

### 返回结果格式

`processSingleKey(key)` 返回的是前端代码统一处理后的对象。这个结构可以从当前源码确认，因为它是页面自己组装出来的，不依赖后端 schema。

成功时：

```js
{
  status: 'success',
  message: '激活成功',
  cardData: verifyData
}
```

失败时：

```js
{
  status: 'error',
  message: '错误原因'
}
```

### 如何接收

```js
try {
  const result = await processSingleKey('KEY-001');

  if (result.status === 'success') {
    console.log('兑换成功');
    console.log('卡片数据：', result.cardData);
  } else {
    console.log('兑换失败：', result.message);
  }
} catch (e) {
  console.log('网络请求失败：', e.message);
}
```

## 4. 后端成功返回数据结构（基于前端使用方式推断，未实测）

注意：下面不是已实测确认的后端接口文档，而是根据当前页面代码推断出的“前端期望结构”。要确认真实返回，需要拿有效卡密实际请求接口，或查看后端接口文档/后端源码。

根据当前页面代码，成功返回的 `cardData` 会被当成类似下面的结构使用：

```js
{
  card: {
    category: '类别',
    status: 'used',
    activated_at: '激活时间',
    expires_at: '到期时间'
  },
  content: {
    card_number: '卡号',
    expiry_date: '有效期',
    cvv: 'CVV',
    phone: '电话',
    name: '姓名',
    address: '地址',
    sms_api: '接码 API 地址'
  }
}
```

说明：

- `card.status` 当前页面识别：`used`、`new`、`expired`。
- `content.sms_api` 如果存在，会用于后续获取短信验证码。
- 如果接口返回里有 `error` 字段，前端会认为兑换失败。这个判断来自 `index.html:647`：

```js
{
  error: '错误原因'
}
```

但后端是否一定按这个格式返回错误，需要实测或后端文档确认。

## 5. HTTP 错误码处理

当前页面对以下状态码做了中文提示。这个映射是前端逻辑，能从源码确认；但后端实际会返回哪些状态码，需要实测确认：

| HTTP 状态码 | 前端提示 |
| --- | --- |
| `400` | 请求参数错误或业务条件不满足 |
| `401` | 开放接口 Key 无效或未提供授权 |
| `404` | 请求路径不存在或查询不到对应记录 |
| `429` | 请求过于频繁，请稍后重试 |
| `500` | 服务内部异常，请稍后重试 |
| 其他 | `请求失败 (状态码)` |

## 6. 短信验证码请求函数：fetchSms

源码位置：`index.html:584`

```js
async function fetchSms(apiUrl, elementId) {
  const resp = await fetch(apiUrl, { mode: 'no-cors' });
  const text = await resp.text();
}
```

### 传入参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `apiUrl` | `string` | 是 | 后端兑换成功后返回的 `content.sms_api`。 |
| `elementId` | `string` | 是 | 页面上用于显示验证码的 DOM 元素 ID。 |

### 返回结果

`fetchSms(apiUrl, elementId)` 没有返回业务数据，它直接修改页面元素内容：

- 请求中：显示 `获取中...`
- 成功解析：显示验证码或提示信息
- 异常：显示 `获取失败`

当前代码期望短信接口返回文本格式：

```text
yes|123456
```

其中：

- `yes` 表示获取成功。
- `123456` 是验证码内容。

## 7. 批量兑换如何接收结果

当前页面批量处理逻辑是逐个调用 `processSingleKey(key)`：

```js
for (let i = 0; i < keys.length; i++) {
  try {
    const result = await processSingleKey(keys[i]);
    addResult(keys[i], result.status, result.message, result.cardData);
  } catch (e) {
    addResult(keys[i], 'error', '网络请求失败: ' + e.message);
  }
}
```

也就是说：

1. 用户输入多行卡密。
2. `getKeys()` 把每一行整理成数组。
3. `batchExchange()` 逐个取出卡密。
4. 每个卡密调用一次 `processSingleKey(key)`。
5. 返回结果交给 `addResult(...)` 渲染到页面。

## 8. 数据库字段格式化函数：formatCardForDatabase

`get_card_message.js` 里提供了 `formatCardForDatabase(recordOrJson)`，用于把缓存记录或接口 JSON 整理成入库字段。

### 使用方式

```js
const { formatCardForDatabase, readCardRecord, DEFAULT_RECORDS_DIR } = require('./get_card_message');

const record = await readCardRecord(DEFAULT_RECORDS_DIR, '卡密');
const dbData = formatCardForDatabase(record);

console.log(dbData);
```

### 输出字段

```js
{
  CARD_NUMBER: '',
  CARD_EXPIRY: '',
  CARD_CVC: '',
  BILLING_COUNTRY: '',
  BILLING_ADDRESS: '',
  BILLING_CITY: '',
  BILLING_STATE: '',
  BILLING_ZIP: '',
  BILLING_NAME: '',
  card_sms: ''
}
```

### 字段来源

| 输出字段 | 来源 |
| --- | --- |
| `CARD_NUMBER` | `content.card_number` |
| `CARD_EXPIRY` | `content.expiry_date`，归一化为 `MMYY`，例如 `2030/4` -> `0430` |
| `CARD_CVC` | `content.cvv` |
| `BILLING_COUNTRY` | 从 `content.address` 最后一段解析 |
| `BILLING_ADDRESS` | 从 `content.address` 第一段解析 |
| `BILLING_CITY` | 从 `content.address` 中间段解析 |
| `BILLING_STATE` | 优先根据归一化后的 ZIP 前 3 位范围映射；查不到时才使用地址里显式出现的州缩写 |
| `BILLING_ZIP` | 从 `content.address` 中间段最后一个 token 解析；超过 5 位取前 5 位，不足 5 位前面补 `0` |
| `BILLING_NAME` | `content.name` |
| `card_sms` | `content.sms_api` |

### ZIP 和州字段规则

`formatCardForDatabase()` 会先把 ZIP 归一化：

```js
989022974 -> 98902
123 -> 00123
12-345 -> 12345
```

然后根据 ZIP 前 3 位范围映射 `BILLING_STATE`。这个范围表覆盖美国 50 州、DC、常见属地和军邮前缀，避免地址里没有州字段时程序崩溃。

例如：

```text
1501 SUMMITVIEW AVE APT 3,YAKIMA 989022974,US
```

会解析为：

```js
{
  BILLING_ADDRESS: '1501 SUMMITVIEW AVE APT 3',
  BILLING_CITY: 'YAKIMA',
  BILLING_STATE: 'WA',
  BILLING_ZIP: '98902',
  BILLING_COUNTRY: 'US'
}
```

如果 ZIP 无法识别，函数不会抛错，会返回空字符串字段，方便后续入库流程继续处理并做异常记录。

## 9. 当前项目运行时接入方式

当前项目已通过 `card_asset_registrar.js` 接入该兑换函数。

### 接入位置

运行时资产获取阶段会先尝试使用已有已注册未激活卡：

```js
store.reserveRuntimeAssets(ownerKey)
```

如果没有可用卡，但已经抢到手机号，则从 `card_assets` 里预留一条未注册卡密：

```text
is_active = 1
is_registered = 0
is_activated = 0
card_key <> ''
```

然后调用：

```js
getCardMessage(cardKey, { live: true })
formatCardForDatabase(record)
```

兑换成功后写回 `card_assets`：

```text
is_registered = 1
card_number / card_expiry / card_cvc
billing_country / billing_address / billing_city / billing_state / billing_zip / billing_name
card_sms
redeemed_at = CURRENT_TIMESTAMP
remark = ''
status = '正常'
```

当前任务会直接使用刚兑换出来的这张卡，不会先释放回池子再重新抢。

### 失败处理

如果兑换接口失败、返回结构异常，或缺少 `CARD_NUMBER` / `CARD_EXPIRY` / `CARD_CVC`，系统会：

```text
is_active = 0
status = '兑换异常'
remark = '兑换异常：具体错误摘要'
```

然后释放该卡密锁，避免后续任务反复重试同一张坏卡。

### 下游传递

`product_activator.js` 和 `server.js` 都通过 `card_asset_registrar.js` 获取运行时资产，并向 `index.js` 子进程传递：

```text
CARD_NUMBER
CARD_EXPIRY
CARD_CVC
BILLING_COUNTRY
BILLING_ADDRESS
BILLING_CITY
BILLING_STATE
BILLING_ZIP
BILLING_NAME
```

### 测试说明

自动测试使用 mock `getCardMessage()`，不会请求真实兑换接口，也不会消耗真实卡密。
