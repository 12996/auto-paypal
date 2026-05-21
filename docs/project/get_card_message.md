# 兑换接口调用说明

本文档说明 `get_card_message.js` 的真实请求、缓存记录、字段兼容和入库格式化规则。

## 1. 固定接口地址

源码位置：`get_card_message.js`

```js
const API_BASE = 'https://www.meiguodizhi.com/api/v1/dz';
```

实际请求接口：

```text
POST https://www.meiguodizhi.com/api/v1/dz
```

## 2. 底层请求函数：verifyExchangeKey

源码位置：`get_card_message.js`

```js
async function verifyExchangeKey(key) {
  void key;
  return fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      city: '',
      path: '/usa-address/california',
      method: 'refresh'
    })
  });
}
```

### 传入参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `key` | `string` | 否 | 本地记录名/资产标识。新接口不接收该字段；CLI 不传时会自动生成 `meiguodizhi-时间戳` 作为缓存文件名。 |

### 请求体

函数会发送固定 JSON 请求体：

```json
{
  "city": "",
  "path": "/usa-address/california",
  "method": "refresh"
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

## 3. 历史前端封装函数：processSingleKey

> 当前运行时主要使用 `get_card_message.js` 的 `getCardMessage()`；本节只保留旧前端批量兑换页面的接收方式说明。

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

## 4. 后端成功返回数据结构

新接口成功返回的数据主体在 `address` 字段。`get_card_message.js` 会保留原始 `address`，并额外补一份兼容旧调用链的 `content` 字段，避免下游 `formatCardForDatabase()`、缓存读取和资产写回接口变化。

```js
{
  status: 'ok',
  address: {
    Address: '2979  Marietta Street',
    Telephone: '510-520-2238',
    City: 'Oakland',
    Zip_Code: '94612',
    State: 'CA',
    Expires: '12/2028',
    Credit_Card_Number: '4916248669944514',
    CVV2: '223',
    Full_Name: 'Suntech Mailer'
  },
  content: {
    card_number: '4916248669944514',
    expiry_date: '12/2028',
    cvv: '223',
    phone: '510-520-2238',
    name: 'Suntech Mailer',
    address: '2979  Marietta Street,Oakland CA 94612,US',
    sms_api: ''
  }
}
```

说明：

- `address` 为新接口原始数据。
- `content` 为本项目兼容层生成的数据，不改变现有下游读取方式。
- 新接口没有 `sms_api`，所以兼容字段里固定为空字符串。

## 5. 兼容转换代码位置

兼容转换都在 `get_card_message.js` 内完成，运行时不需要下游直接适配新接口的 `address.*`。

### 5.1 转换入口

源码位置：

```text
get_card_message.js:257 buildCardRecordFromResponse()
```

关键逻辑：

```js
const json = normalizeCardResponseJson(parseJsonMaybe(rawText));
```

含义：

1. 先把接口原始响应文本解析为 JSON。
2. 如果响应是新接口结构 `{ address: {...}, status: 'ok' }`，调用兼容转换。
3. 保存缓存时同时保留：
   - `json.address`：新接口原始字段。
   - `json.content`：兼容旧接口的字段。

### 5.2 新接口转旧字段

源码位置：

```text
get_card_message.js:163 mapMeiguodizhiAddressToLegacyContent()
get_card_message.js:175 normalizeCardResponseJson()
```

字段映射：

| 新接口字段 | 兼容后的旧字段 | 用途 |
| --- | --- | --- |
| `address.Credit_Card_Number` | `content.card_number` | 卡号 |
| `address.Expires` | `content.expiry_date` | 有效期，后续归一化为 `MMYY` |
| `address.CVV2` | `content.cvv` | CVC |
| `address.Full_Name` | `content.name` | 账单姓名 |
| `address.Telephone` | `content.phone` | 电话 |
| `address.Address` + `City` + `State` + `Zip_Code` | `content.address` | 账单地址字符串 |
| 无 | `content.sms_api = ''` | 新接口没有短信接口，固定为空 |

兼容后的地址格式示例：

```text
2979  Marietta Street,Oakland CA 94612,US
```

这个格式继续交给原有的 `splitBillingAddress()` 拆成：

```js
{
  street: '2979  Marietta Street',
  city: 'Oakland',
  state: 'CA',
  zip: '94612',
  country: 'US'
}
```

### 5.3 下游读取兼容

源码位置：

```text
get_card_message.js:186 getRecordContent()
get_card_message.js:239 formatCardForDatabase()
```

`getRecordContent()` 同时支持四种输入：

```text
content
address
json.content
json.address
```

因此以下数据都能被 `formatCardForDatabase()` 正常转换：

```js
formatCardForDatabase({ content: {...旧接口字段} })
formatCardForDatabase({ address: {...新接口字段} })
formatCardForDatabase({ json: { content: {...旧接口字段} } })
formatCardForDatabase({ json: { address: {...新接口字段} } })
```

### 5.4 返回信息是否相同

外部接口原始返回不相同：

- 旧接口主要提供 `content.*`。
- 新接口主要提供 `address.*`。

项目内部缓存和下游消费保持兼容：

- 新接口原始数据保存在 `json.address`。
- 兼容旧调用链的数据保存在 `json.content`。
- `formatCardForDatabase()` 输出的数据库字段名不变。

因此，正常新接口返回包含 `Credit_Card_Number`、`Expires`、`CVV2` 时，运行时资产注册不会因为返回结构变化而报错。

仍可能失败的情况：

- 新接口没返回 `address`。
- 新接口缺少 `Credit_Card_Number`、`Expires` 或 `CVV2`。
- HTTP 请求失败或返回非 JSON。

这些情况会在 `card_asset_registrar.js` 中被判定为兑换异常，写入 `remark`，并禁用该条卡资产，避免后续反复使用坏数据。

## 6. HTTP 错误码处理

当前页面对以下状态码做了中文提示。这个映射是前端逻辑，能从源码确认；但后端实际会返回哪些状态码，需要实测确认：

| HTTP 状态码 | 前端提示 |
| --- | --- |
| `400` | 请求参数错误或业务条件不满足 |
| `401` | 开放接口 Key 无效或未提供授权 |
| `404` | 请求路径不存在或查询不到对应记录 |
| `429` | 请求过于频繁，请稍后重试 |
| `500` | 服务内部异常，请稍后重试 |
| 其他 | `请求失败 (状态码)` |

## 7. 短信验证码请求函数：fetchSms

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

## 8. 批量兑换如何接收结果

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

## 9. 数据库字段格式化函数：formatCardForDatabase

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
| `CARD_NUMBER` | 优先 `content.card_number`；新接口兼容 `address.Credit_Card_Number` |
| `CARD_EXPIRY` | 优先 `content.expiry_date`；新接口兼容 `address.Expires`，归一化为 `MMYY`，例如 `12/2028` -> `1228` |
| `CARD_CVC` | 优先 `content.cvv`；新接口兼容 `address.CVV2` |
| `BILLING_COUNTRY` | 从兼容地址最后一段解析，新接口固定生成 `US` |
| `BILLING_ADDRESS` | 从兼容地址第一段解析，新接口来自 `address.Address` |
| `BILLING_CITY` | 从兼容地址中间段解析，新接口来自 `address.City` |
| `BILLING_STATE` | 优先根据归一化后的 ZIP 前 3 位范围映射；查不到时才使用地址里显式出现的州缩写 |
| `BILLING_ZIP` | 从兼容地址中间段最后一个 token 解析；新接口来自 `address.Zip_Code` |
| `BILLING_NAME` | 优先 `content.name`；新接口兼容 `address.Full_Name` |
| `card_sms` | `content.sms_api`；新接口没有该字段时为空字符串 |

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

## 10. 当前项目运行时接入方式

当前项目已通过 `card_asset_registrar.js` 接入该兑换函数。

### 接入位置

运行时资产获取阶段只从数据库抢占手机号和代理：

```js
store.reserveRuntimePhoneAssets(ownerKey)
```

只要已经抢到手机号，就直接调用新接口获取银行卡，不再查询或复用 `card_assets` 里的旧银行卡：

```js
getCardMessage('', { live: true })
formatCardForDatabase(record)
```

`getCardMessage()` 会自动生成 `meiguodizhi-时间戳` 作为本地缓存记录名。兑换成功后，系统会新增一条已注册银行卡记录到 `card_assets`，并立即锁给当前任务使用：

```text
card_key = meiguodizhi-时间戳 或接口记录名
is_registered = 1
card_number / card_expiry / card_cvc
billing_country / billing_address / billing_city / billing_state / billing_zip / billing_name
card_sms
redeemed_at = CURRENT_TIMESTAMP
remark = ''
status = '正常'
in_use = 1
```

当前任务会直接使用刚获取出来的这张卡，不会先释放回池子再重新抢。新流程不需要管理员导入卡密，也不会为了拿卡而查询数据库旧卡。

### 失败处理

如果直接请求接口失败、返回结构异常，或缺少 `CARD_NUMBER` / `CARD_EXPIRY` / `CARD_CVC`，本次尝试不会插入可用卡记录；系统会继续按最大尝试次数重试，最终仍无可用卡时按资产不足处理。

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

自动测试使用 mock `getCardMessage()`，不会请求真实银行卡接口。
