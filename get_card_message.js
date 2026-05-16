const fs = require('node:fs/promises');
const path = require('node:path');

const API_BASE = 'https://card.52bankcard.com/api/exchange';
const DEFAULT_RECORDS_DIR = path.join(__dirname, 'card_records');

function sanitizeRecordName(key) {
  const safe = String(key || '').trim().replace(/[^a-zA-Z0-9_.-]/g, '_');
  return safe || 'empty-key';
}

function getRecordPath(recordsDir, key) {
  return path.join(recordsDir, `${sanitizeRecordName(key)}.json`);
}

function cleanSmsApi(value) {
  return String(value || '').trim().replace(/^`|`$/g, '').trim();
}

async function verifyExchangeKey(key) {
  return fetch(`${API_BASE}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: key })
  });
}

async function fetchSms(apiUrl) {
  const resp = await fetch(apiUrl);
  return await resp.text();
}

async function readCardRecord(recordsDir, key) {
  try {
    const text = await fs.readFile(getRecordPath(recordsDir, key), 'utf8');
    return JSON.parse(text);
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

async function saveCardRecord(recordsDir, key, record) {
  await fs.mkdir(recordsDir, { recursive: true });
  const targetPath = getRecordPath(recordsDir, key);
  const tempPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempPath, JSON.stringify(record, null, 2), 'utf8');
  await fs.rename(tempPath, targetPath);
  return targetPath;
}

function parseJsonMaybe(rawText) {
  try {
    return JSON.parse(rawText);
  } catch (e) {
    return undefined;
  }
}

const ZIP_STATE_RANGES = [
  ['005', '005', 'NY'], ['006', '009', 'PR'], ['010', '027', 'MA'], ['028', '029', 'RI'],
  ['030', '038', 'NH'], ['039', '049', 'ME'], ['050', '054', 'VT'], ['055', '055', 'MA'],
  ['056', '059', 'VT'], ['060', '069', 'CT'], ['070', '089', 'NJ'], ['090', '098', 'AE'],
  ['100', '149', 'NY'], ['150', '196', 'PA'], ['197', '199', 'DE'], ['200', '200', 'DC'],
  ['201', '201', 'VA'], ['202', '205', 'DC'], ['206', '219', 'MD'], ['220', '246', 'VA'],
  ['247', '268', 'WV'], ['270', '289', 'NC'], ['290', '299', 'SC'], ['300', '319', 'GA'],
  ['320', '349', 'FL'], ['350', '369', 'AL'], ['370', '385', 'TN'], ['386', '397', 'MS'],
  ['398', '399', 'GA'], ['400', '427', 'KY'], ['430', '459', 'OH'], ['460', '479', 'IN'],
  ['480', '499', 'MI'], ['500', '528', 'IA'], ['530', '549', 'WI'], ['550', '567', 'MN'],
  ['569', '569', 'DC'], ['570', '577', 'SD'], ['580', '588', 'ND'], ['590', '599', 'MT'],
  ['600', '629', 'IL'], ['630', '658', 'MO'], ['660', '679', 'KS'], ['680', '693', 'NE'],
  ['700', '714', 'LA'], ['716', '729', 'AR'], ['730', '749', 'OK'], ['750', '799', 'TX'],
  ['800', '816', 'CO'], ['820', '831', 'WY'], ['832', '838', 'ID'], ['840', '847', 'UT'],
  ['850', '865', 'AZ'], ['870', '884', 'NM'], ['885', '885', 'TX'], ['889', '898', 'NV'],
  ['900', '961', 'CA'], ['962', '966', 'AP'], ['967', '968', 'HI'], ['969', '969', 'GU'],
  ['970', '979', 'OR'], ['980', '994', 'WA'], ['995', '999', 'AK']
];

function normalizeUsZip(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.slice(0, 5).padStart(5, '0');
}

function stateFromZip(zip) {
  const normalized = normalizeUsZip(zip);
  if (!normalized) return '';

  const prefix = Number(normalized.slice(0, 3));
  const range = ZIP_STATE_RANGES.find(([start, end]) => {
    const from = Number(start);
    const to = Number(end);
    return prefix >= from && prefix <= to;
  });

  if (!range) return '';

  if (range[2] === 'GU') {
    const zipNumber = Number(normalized);
    if (zipNumber === 96940) return 'PW';
    if (zipNumber >= 96941 && zipNumber <= 96944) return 'FM';
    if (zipNumber >= 96950 && zipNumber <= 96952) return 'MP';
    if (zipNumber >= 96960 && zipNumber <= 96970) return 'MH';
  }

  return range[2];
}

function splitBillingAddress(address) {
  const parts = String(address || '').split(',').map((part) => part.trim()).filter(Boolean);
  const country = parts.length > 1 ? parts[parts.length - 1] : '';
  const cityStateZip = parts.length > 1 ? parts[parts.length - 2] : '';
  const street = parts.length > 2 ? parts.slice(0, -2).join(', ') : (parts[0] || '');
  const tokens = cityStateZip.split(/\s+/).filter(Boolean);
  const zip = normalizeUsZip(tokens.length ? tokens[tokens.length - 1] : '');
  const inlineState = tokens.length >= 3 && /^[A-Z]{2}$/.test(tokens[tokens.length - 2]) ? tokens[tokens.length - 2] : '';
  const state = stateFromZip(zip) || inlineState;
  const cityEnd = state ? -2 : -1;
  const city = tokens.slice(0, inlineState ? cityEnd : -1).join(' ');

  return {
    country,
    street,
    city,
    state,
    zip
  };
}

function getRecordContent(recordOrJson) {
  if (!recordOrJson) return {};
  if (recordOrJson.content) return recordOrJson.content;
  if (recordOrJson.json && recordOrJson.json.content) return recordOrJson.json.content;
  return {};
}

function normalizeCardExpiryForDatabase(value) {
  const text = String(value || '').trim();
  if (!text) return '';

  const parts = text.split(/[\/\-\s]+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0];
    const second = parts[1];
    let year = '';
    let month = '';

    if (/^\d{4}$/.test(first)) {
      year = first.slice(-2);
      month = second;
    } else if (/^\d{4}$/.test(second)) {
      year = second.slice(-2);
      month = first;
    } else {
      month = first;
      year = second.slice(-2);
    }

    const monthNumber = Number(month);
    if (Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12 && /^\d{1,2}$/.test(year)) {
      return `${String(monthNumber).padStart(2, '0')}${year.padStart(2, '0')}`;
    }
  }

  const digits = text.replace(/\D/g, '');
  if (/^\d{6}$/.test(digits)) {
    return `${digits.slice(4, 6)}${digits.slice(2, 4)}`;
  }
  if (/^\d{4}$/.test(digits)) {
    const firstTwo = Number(digits.slice(0, 2));
    const lastTwo = Number(digits.slice(2, 4));
    if (firstTwo >= 1 && firstTwo <= 12) return digits;
    if (lastTwo >= 1 && lastTwo <= 12) return `${digits.slice(2, 4)}${digits.slice(0, 2)}`;
  }

  return text;
}

function formatCardForDatabase(recordOrJson) {
  const content = getRecordContent(recordOrJson);
  const billing = splitBillingAddress(content.address);

  return {
    CARD_NUMBER: content.card_number || '',
    CARD_EXPIRY: normalizeCardExpiryForDatabase(content.expiry_date),
    CARD_CVC: content.cvv || '',
    BILLING_COUNTRY: billing.country,
    BILLING_ADDRESS: billing.street,
    BILLING_CITY: billing.city,
    BILLING_STATE: billing.state,
    BILLING_ZIP: billing.zip,
    BILLING_NAME: content.name || '',
    card_sms: cleanSmsApi(content.sms_api)
  };
}

async function buildCardRecordFromResponse(key, resp) {
  const rawText = await resp.text();
  const json = parseJsonMaybe(rawText);
  const smsApi = json && json.content ? cleanSmsApi(json.content.sms_api) : '';

  const record = {
    key,
    requested_at: new Date().toISOString(),
    http_status: resp.status,
    ok: Boolean(resp.ok),
    raw_text: rawText
  };

  if (json !== undefined) record.json = json;
  if (smsApi) record.sms_api = smsApi;

  return record;
}

async function getCardMessage(key, options = {}) {
  if (!key) throw new Error('key is required');

  const recordsDir = options.recordsDir || DEFAULT_RECORDS_DIR;
  const live = Boolean(options.live);
  const force = Boolean(options.force);
  const requestCard = options.requestCard || verifyExchangeKey;
  const recordPath = getRecordPath(recordsDir, key);
  const existing = await readCardRecord(recordsDir, key);

  if (existing && !(live && force)) {
    return { source: 'cache', record: existing, path: recordPath };
  }

  if (!live) {
    return {
      source: 'missing-cache',
      path: recordPath,
      message: '本地没有该卡密记录。为避免扣费，未请求真实接口。确认要请求时请加 --live。'
    };
  }

  const resp = await requestCard(key);
  const record = await buildCardRecordFromResponse(key, resp);
  const savedPath = await saveCardRecord(recordsDir, key, record);

  return { source: 'live', record, path: savedPath };
}

async function requestSmsForSavedCard(key, options = {}) {
  const recordsDir = options.recordsDir || DEFAULT_RECORDS_DIR;
  const requestSms = options.requestSms || fetchSms;
  const record = await readCardRecord(recordsDir, key);

  if (!record) {
    return {
      source: 'missing-cache',
      message: '本地没有该卡密记录，无法读取 sms_api。'
    };
  }

  const smsApi = cleanSmsApi(record.sms_api || (record.json && record.json.content && record.json.content.sms_api));
  if (!smsApi) {
    return {
      source: 'missing-sms-api',
      record,
      message: '缓存记录里没有 sms_api。'
    };
  }

  const rawText = await requestSms(smsApi);
  const updatedRecord = {
    ...record,
    sms: {
      requested_at: new Date().toISOString(),
      api_url: smsApi,
      raw_text: rawText
    }
  };
  await saveCardRecord(recordsDir, key, updatedRecord);

  return { source: 'sms-live', record: updatedRecord };
}

function parseArgs(argv) {
  const parsed = {
    key: '',
    live: false,
    force: false,
    sms: false,
    recordsDir: DEFAULT_RECORDS_DIR
  };

  for (const arg of argv.slice(2)) {
    if (arg === '--live') parsed.live = true;
    else if (arg === '--force') parsed.force = true;
    else if (arg === '--sms') parsed.sms = true;
    else if (arg.startsWith('--records-dir=')) parsed.recordsDir = path.resolve(arg.slice('--records-dir='.length));
    else if (!parsed.key) parsed.key = arg;
  }

  return parsed;
}

function printUsage() {
  console.log('用法: node get_card_message.js <卡密> [--live] [--force] [--sms] [--records-dir=目录]');
  console.log('');
  console.log('默认只读取本地缓存，不请求扣费接口。');
  console.log('--live        缓存不存在时请求真实卡密接口并保存结果');
  console.log('--force       与 --live 同用时允许覆盖已有缓存');
  console.log('--sms         使用缓存里的 sms_api 实时请求短信接口');
}

async function main(argv = process.argv) {
  const args = parseArgs(argv);

  if (!args.key) {
    printUsage();
    return 1;
  }

  const result = await getCardMessage(args.key, args);
  console.log(JSON.stringify(result, null, 2));

  if (args.sms) {
    const smsResult = await requestSmsForSavedCard(args.key, args);
    console.log(JSON.stringify(smsResult, null, 2));
  }

  return 0;
}

if (require.main === module) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((e) => {
    console.error('执行失败:', e.message);
    process.exitCode = 1;
  });
}

module.exports = {
  API_BASE,
  DEFAULT_RECORDS_DIR,
  sanitizeRecordName,
  getRecordPath,
  cleanSmsApi,
  normalizeUsZip,
  stateFromZip,
  splitBillingAddress,
  normalizeCardExpiryForDatabase,
  formatCardForDatabase,
  verifyExchangeKey,
  fetchSms,
  readCardRecord,
  saveCardRecord,
  getCardMessage,
  requestSmsForSavedCard,
  parseArgs
};
