const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const os = require("os");
const zlib = require("zlib");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");

const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const ARTICLES_FILE = path.join(DATA_DIR, "articles.json");
const MOMENTS_FILE = path.join(DATA_DIR, "moments.json");
const MESSAGES_FILE = path.join(DATA_DIR, "messages.json");
const RESONANCES_FILE = path.join(DATA_DIR, "resonances.json");
const VISITS_FILE = path.join(DATA_DIR, "visits.json"); // v29 · 来客图：仅城市级聚合，不存 IP
const TOMBSTONES_FILE = path.join(DATA_DIR, "tombstones.json"); // v38 · 分布式墓碑：防止双活多节点同步时被删数据僵尸复活
const STATS_FILE = path.join(DATA_DIR, "stats.json"); // v40 · 全站访问统计与单篇围阅量中枢

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SALT = process.env.ATELIER_AUTH_SALT || "sxtx_atelier_salt_2026";
// v37 · 令牌签名与旧口令哈希解耦：生产可注入独立强密钥，不影响 legacy 口令校验
const TOKEN_SECRET = process.env.ATELIER_AUTH_TOKEN_SECRET || SALT;

/* ==========================================================================
   v37 · 口令存储：scrypt(随机盐) 为主，兼容旧版 sha256 并在首次成功登录时透明升级。
   零依赖，仅用 Node 内置 crypto；单次校验约 40~80ms，配合登录限流阻断穷举。
   ========================================================================== */
const SCRYPT_OPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
function hashPassword(pwd) { // 旧格式兼容 / 首次配置的临时占位
  return crypto.createHash("sha256").update(pwd + SALT).digest("hex");
}
function scryptHash(pwd) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16);
    crypto.scrypt(String(pwd), salt, 64, SCRYPT_OPT, (err, key) => {
      if (err) reject(err);
      else resolve("scrypt$" + salt.toString("hex") + "$" + key.toString("hex"));
    });
  });
}
function verifyPassword(pwd, stored) {
  const s = String(stored || "");
  if (s.startsWith("scrypt$")) {
    const parts = s.split("$");
    if (parts.length !== 3) return Promise.resolve(false);
    return new Promise((resolve) => {
      crypto.scrypt(String(pwd), Buffer.from(parts[1], "hex"), 64, SCRYPT_OPT, (err, key) => {
        if (err) return resolve(false);
        const ref = Buffer.from(parts[2], "hex");
        resolve(ref.length === key.length && crypto.timingSafeEqual(ref, key));
      });
    });
  }
  // legacy: 定长比较，避免时序侧信道
  const a = Buffer.from(hashPassword(pwd), "utf8");
  const b = Buffer.from(s, "utf8");
  return Promise.resolve(a.length === b.length && crypto.timingSafeEqual(a, b));
}
// v37 · 强口令策略：长度 ≥ 12，至少两类字符，且不在常见弱口令表内
const WEAK_PASSWORDS = new Set([
  "123456789012", "password123", "admin123456", "sxtx2026", "sxtx20262026",
  "qwertyuiop12", "111111111111", "000000000000", "abcdefghijkl", "p@ssw0rd1234"
]);
function passwordPolicy(pwd) {
  const s = String(pwd || "");
  if (s.length < 12) return "管理密钥至少需要 12 位";
  if (s.length > 128) return "管理密钥不得超过 128 位";
  if (/\s/.test(s)) return "管理密钥不可包含空白字符";
  let kinds = 0;
  if (/[a-z]/.test(s)) kinds++;
  if (/[A-Z]/.test(s)) kinds++;
  if (/[0-9]/.test(s)) kinds++;
  if (/[^a-zA-Z0-9]/.test(s)) kinds++;
  if (kinds < 2) return "管理密钥需包含字母、数字或符号中的至少两类";
  if (WEAK_PASSWORDS.has(s.toLowerCase())) return "该密钥过于常见，请换一个";
  if (/^(.)\1+$/.test(s)) return "管理密钥不可为单一重复字符";
  return null;
}

// Stateless HMAC Auth Token (Survives Server Restarts)
function generateAuthToken() {
  const expiresAt = Date.now() + 30 * 24 * 3600 * 1000; // 30 days
  const payload = `admin:${expiresAt}`;
  const sig = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64");
}

function verifyAuthToken(token) {
  try {
    if (!token) return false;
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return false;
    const [user, expStr, sig] = parts;
    const exp = parseInt(expStr, 10);
    if (isNaN(exp) || Date.now() > exp) return false;
    const expectedSig = crypto.createHmac("sha256", TOKEN_SECRET).update(`${user}:${expStr}`).digest("hex");
    return sig === expectedSig;
  } catch (e) {
    return false;
  }
}

// Default config
function getOrInitConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    // 首次启动：优先使用环境变量口令，否则生成随机高强口令并在终端仅打印一次
    const initialPwd = process.env.ATELIER_INITIAL_PASSWORD || crypto.randomBytes(15).toString("base64url");
    const pwdSalt = crypto.randomBytes(16);
    const pwdKey = crypto.scryptSync(initialPwd, pwdSalt, 64, SCRYPT_OPT);
    
    // 优先从 config.example.json 模板继承完整规范
    const EXAMPLE_CONFIG_FILE = path.join(DATA_DIR, "config.example.json");
    let baseConfig = {};
    if (fs.existsSync(EXAMPLE_CONFIG_FILE)) {
      try {
        baseConfig = JSON.parse(fs.readFileSync(EXAMPLE_CONFIG_FILE, "utf-8"));
        delete baseConfig._comment;
      } catch (e) {
        baseConfig = {};
      }
    }

    const defaultConfig = Object.assign({
      siteTitle: "纸境工坊",
      siteSubtitle: "在微云之境，构筑自治的工程工作流与思想自留地。",
      author: "纸境墨客",
      bio: "这里是纸境工坊。记录关于云原生架构、现代极简交互与自动化系统的深度沉淀；没有浮躁的算法推荐与杂乱信息，仅保留文字、代码与运行中的造物。",
      stampText: "纸境\nATELIER",
      ai: {
        provider: "openai-compatible",
        baseUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
        apiKey: "",
        model: "glm-4-flash",
        authorName: "工坊回笔 · 墨客"
      }
    }, baseConfig, {
      adminPasswordHash: "scrypt$" + pwdSalt.toString("hex") + "$" + pwdKey.toString("hex")
    });

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), "utf-8");
    if (!process.env.ATELIER_INITIAL_PASSWORD) {
      console.warn("\n[安全] 首次启动，已生成初始管理密钥：" + initialPwd);
      console.warn("[安全] 仅显示这一次，请登录后台立即保存或修改。\n");
    }
    return defaultConfig;
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
  } catch (e) {
    return {};
  }
}

function readJSON(file, fallback = []) {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (e) {
    return fallback;
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf-8");
}

/* ==========================================================================
   v38 · 分布式墓碑机制 (Tombstones)
   记录被删除实体的 ID，防止双活节点（VPS + InstaBox）双向同步时被删数据复活。
   ========================================================================== */
function readTombstones() {
  const d = readJSON(TOMBSTONES_FILE, {});
  return {
    messages: Array.isArray(d.messages) ? d.messages : [],
    moments: Array.isArray(d.moments) ? d.moments : [],
    articles: Array.isArray(d.articles) ? d.articles : []
  };
}
function addTombstone(category, id) {
  if (!id) return;
  const t = readTombstones();
  if (!t[category].includes(id)) {
    t[category].push(id);
    if (t[category].length > 500) t[category] = t[category].slice(-500);
    writeJSON(TOMBSTONES_FILE, t);
  }
}

/* ==========================================================================
   v37 · 可信来源判定 + 统一滑动窗口限流 + GLM 预算闸门 + 回笔质量门禁
   原则：转发头只在「来自可信反代」时采信；公网直连源站无法用伪造头绕过限流。
   ========================================================================== */
function normalizeIP(raw) {
  let s = String((Array.isArray(raw) ? raw[0] : raw) || "").trim().split(",")[0].trim();
  if (s.startsWith("::ffff:")) s = s.slice(7);
  return s;
}
function isPrivateIP(ip) {
  const s = normalizeIP(ip);
  return !s || s === "::1" || s === "localhost" || /^127\./.test(s) || /^10\./.test(s) ||
    /^192\.168\./.test(s) || /^172\.(1[6-9]|2\d|3[01])\./.test(s) || /^(fc|fd|fe80)/i.test(s);
}
function ipv4ToInt(ip) {
  const p = String(ip).split(".");
  if (p.length !== 4) return null;
  let n = 0;
  for (const x of p) {
    const v = Number(x);
    if (!Number.isInteger(v) || v < 0 || v > 255 || x === "") return null;
    n = (n << 8) | v;
  }
  return n >>> 0;
}
function cidrContains(cidr, ip) {
  const seg = String(cidr).split("/");
  const bits = seg.length === 1 ? 32 : Number(seg[1]);
  const a = ipv4ToInt(seg[0]), b = ipv4ToInt(ip);
  if (a === null || b === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (a & mask) === (b & mask);
}
let _trustedCidrs = null;
function trustedCidrs() {
  if (_trustedCidrs) return _trustedCidrs;
  let fromConfig = [];
  try { const c = getOrInitConfig().trustedProxyCidrs; if (Array.isArray(c)) fromConfig = c; } catch (e) {}
  const fromEnv = String(process.env.ATELIER_TRUSTED_PROXY_CIDRS || "").split(",");
  _trustedCidrs = fromConfig.concat(fromEnv).map(x => String(x).trim()).filter(Boolean);
  return _trustedCidrs;
}
function isTrustedPeer(peer) {
  const ip = normalizeIP(peer);
  if (isPrivateIP(ip)) return true;          // 本机 nginx / Caddy / 容器网关
  return trustedCidrs().some(c => cidrContains(c, ip)); // 显式白名单（如 CF 回源段）
}

// Extract Real Client IP (never trust forwarding headers from untrusted peers)

// v54 · 后端全字段深度 XSS 净化与输入防御
function sanitizeInput(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/`/g, '&#x60;')
    .replace(/\x00/g, '')
    .trim();
}

// v54 · 恶意漏洞扫描器快速阻断 (Vulnerability Scanner Defense)
const SCANNER_PROBES = /\/(?:wp-admin|wp-login|phpmyadmin|pma|actuator|telescope|solr|eval-stdin|phpinfo|\.env|\.git|\.aws|\.ssh)/i;
const scannerBlacklist = new Map(); // ip -> expireTimestamp

function isIpBlocked(ip) {
  if (!ip) return false;
  const expire = scannerBlacklist.get(ip);
  if (!expire) return false;
  if (Date.now() > expire) {
    scannerBlacklist.delete(ip);
    return false;
  }
  return true;
}

function recordScannerStrike(ip) {
  if (!ip) return;
  scannerBlacklist.set(ip, Date.now() + 3600000);
  console.warn(`[SecurityStrike] Blocked malicious scanner IP: ${ip} for 1 hour.`);
}

function getClientIP(req) {
  const peer = normalizeIP(req.socket.remoteAddress);
  if (isTrustedPeer(peer)) {
    const heads = [req.headers["cf-connecting-ip"], req.headers["x-forwarded-for"], req.headers["x-real-ip"]];
    for (const raw of heads) {
      const ip = normalizeIP(raw);
      if (ip && ip.length <= 45 && /^[0-9a-fA-F.:]+$/.test(ip)) {
        req.atelierIPSource = "proxy-header";
        return ip;
      }
    }
  }
  req.atelierIPSource = "socket";
  return peer || "127.0.0.1";
}

// 统一滑动窗口：被拒时不写入新时间戳，冷却可预期恢复
const rateState = new Map();
function checkRate(bucket, key, limit, windowMs) {
  const now = Date.now();
  const k = bucket + "|" + key;
  let hits = (rateState.get(k) || []).filter(t => now - t < windowMs);
  if (hits.length >= limit) {
    rateState.set(k, hits);
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) };
  }
  hits.push(now);
  rateState.set(k, hits);
  return { allowed: true, remaining: limit - hits.length };
}
function clearRate(bucket, key) { rateState.delete(bucket + "|" + key); }
function imposeRate(req, res, check, message) {
  if (check.allowed) return false;
  res.setHeader("Retry-After", String(check.retryAfter || 1));
  sendJSON(req, res, 429, {
    ok: false, error: message || "请求过于频繁，请稍候再试", retryAfter: check.retryAfter
  });
  return true;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of rateState) {
    const alive = arr.filter(t => now - t < 3600000);
    if (!alive.length) rateState.delete(k); else rateState.set(k, alive);
  }
}, 300000).unref();

// GLM 调用预算：并发 / 分钟 / 自然日三重上限，超限直接本地回笔，绝不阻塞留言
const glmBudget = { inflight: 0, minute: [], day: "", dayCount: 0 };
function acquireGLMSlot() {
  const now = Date.now(), day = new Date().toISOString().slice(0, 10);
  if (glmBudget.day !== day) { glmBudget.day = day; glmBudget.dayCount = 0; }
  glmBudget.minute = glmBudget.minute.filter(t => now - t < 60000);
  if (glmBudget.inflight >= 2 || glmBudget.minute.length >= 8 || glmBudget.dayCount >= 100) return false;
  glmBudget.inflight++; glmBudget.minute.push(now); glmBudget.dayCount++;
  return true;
}
function releaseGLMSlot() { glmBudget.inflight = Math.max(0, glmBudget.inflight - 1); }

// 输入质量门禁：无实质内容不调用 GLM，避免对 "x"/"a"/"b" 之类的输入强行编造回复
// v40 · 输入质量门禁：无实质内容不调用 GLM，避免对单字、符号或灌水强行编造回复
// v40 · 输入质量门禁：无实质内容不调用 GLM，避免对单字、符号或灌水强行编造回复
// v40 · 输入质量门禁：过滤单字、纯符号、灌水，仅对有实质语义的留墨调用 GLM
function shouldUseGLM(content) {
  const s = String(content || "").trim();
  if (s.length < 3) return false;
  if (!/[\u4e00-\u9fa5]/.test(s) && !/[a-zA-Z]{2,}/.test(s)) return false;
  const letters = s.replace(/[^\u4e00-\u9fa5a-zA-Z]/g, "");
  if (letters.length < 2) return false;
  if (new Set(letters).size < 2 && letters.length <= 4) return false; // 如 "哈哈哈", "aaaa"
  if (/^(test|测试|hello|asdf|qwerty|1234|666|888|aaa|bbb|ccc)\.?$/i.test(letters)) return false;
  return true;
}

// v40 · 输出质量门禁：严厉拦截 AI 假大空、客服套话、占位符与废话小作文
function isTemplateEcho(text) {
  const s = String(text || "").trim();
  if (s.length < 6 || s.length > 220) return true; // 异常过短或超过220字注水小作文直接拦截
  // 拦截模板痕迹
  if (/【\s*…\s*】|\[\s*…\s*\]|【具体|\[具体|具体操作步骤|注意事项[：:]|希望这能(对您|对你|有所)?帮助|希望能帮到|作为(一个)?\s*AI|实际项目中遇到过|结合实际项目|首先[，,].{0,20}其次/.test(s)) {
    return true;
  }
  // 拦截假大空鸡汤与泛滥辞藻
  if (/在这个快节奏的时代|水滴石穿的力量|无论在生活还是工作中|让我们携手|砥砺前行|不忘初心/.test(s)) {
    return true;
  }
  return false;
}

function isDraftArticle(a) {
  return !!(a && (a.draft === true || a.status === "draft" || a.status === "private" || a.visibility === "private"));
}
function notFound(req, res) {
  res.writeHead(404, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "private, no-store",
    "X-Atelier-Origin": "app",
    "X-Content-Type-Options": "nosniff"
  });
  res.end("404 Not Found");
}

/* ==========================================================================
   v29 · 来客图 / 地域欢迎语：访客 IP 归属地
   零依赖、纯 Node 内置 https；优先级 = CDN 地理头 → 国内合规公共接口 → 优雅降级。
   隐私边界：IP 只在内存中做短时缓存与哈希去重，绝不落盘；
             visits.json 只保存「省 / 城市 + 聚合计数 + 时间」，无 IP、无精确坐标、无个人标识。
   ========================================================================== */
const PLACE_UNKNOWN = "远方";
const ipPlaceCache = new Map();  // ip -> { province, city, place, known, at }（内存，1h）
const visitSeenMap = new Map();  // sha256(ip + 当天) -> 时间戳（连明文 IP 都不留）
const COUNTRY_NAMES = {
  CN: "中国", HK: "中国香港", MO: "中国澳门", TW: "中国台湾",
  SG: "新加坡", JP: "日本", KR: "韩国", US: "美国", CA: "加拿大",
  GB: "英国", DE: "德国", FR: "法国", AU: "澳大利亚", MY: "马来西亚"
};

function isLocalIP(ip) {
  const s = String(ip || "").replace(/^::ffff:/, "");
  return !s || s === "127.0.0.1" || s === "::1" || s === "localhost" ||
    /^10\./.test(s) || /^192\.168\./.test(s) || /^172\.(1[6-9]|2\d|3[01])\./.test(s);
}

// Node 将 HTTP 头按 latin1 解码，CDN 若注入 UTF-8 中文地名会变成乱码；此处还原
function decodeHeaderValue(v) {
  let s = String(v == null ? "" : v).trim();
  if (!s) return "";
  if (s.indexOf("%") >= 0) {
    try { s = decodeURIComponent(s); } catch (_) { /* 原样保留 */ }
  }
  if (/[^\x00-\x7F]/.test(s)) {
    try {
      const restored = Buffer.from(s, "latin1").toString("utf8");
      if (!/\uFFFD/.test(restored)) return restored;
    } catch (_) { /* 原样保留 */ }
  }
  return s;
}

function cleanRegion(s) {
  return String(s || "").trim()
    .replace(/(维吾尔自治区|壮族自治区|回族自治区|特别行政区|自治区|自治州|地区|省|市|盟)$/g, "")
    .replace(/\s+/g, "") || "";
}

// CDN 常以英文拼音回传地名；统一折回中文，并明确港澳台称谓
const GEO_ALIASES = {
  "hong kong": "中国香港", hongkong: "中国香港", hk: "中国香港",
  macao: "中国澳门", macau: "中国澳门", mo: "中国澳门",
  taiwan: "中国台湾", taipei: "中国台北", tw: "中国台湾",
  beijing: "北京", shanghai: "上海", tianjin: "天津", chongqing: "重庆",
  weifang: "潍坊", jinan: "济南", qingdao: "青岛",
  shenzhen: "深圳", guangzhou: "广州", hangzhou: "杭州", nanjing: "南京",
  suzhou: "苏州", chengdu: "成都", wuhan: "武汉", xian: "西安",
  zhengzhou: "郑州", xiamen: "厦门", changsha: "长沙",
  shijiazhuang: "石家庄", hefei: "合肥", shenyang: "沈阳",
  kunming: "昆明", nanning: "南宁",
  shandong: "山东", guangdong: "广东", zhejiang: "浙江", jiangsu: "江苏",
  sichuan: "四川", hubei: "湖北", shaanxi: "陕西", henan: "河南",
  fujian: "福建", hunan: "湖南", hebei: "河北", anhui: "安徽",
  liaoning: "辽宁", yunnan: "云南", guangxi: "广西",
  cn: "中国", sg: "新加坡", jp: "日本", us: "美国"
};

function normalizeGeoName(v, fromHeader) {
  // 仅 CDN 请求头需要 latin1 → utf8 还原；内部字符串本身已是正确 UTF-8
  const s = fromHeader ? decodeHeaderValue(v) : String(v == null ? "" : v).trim();
  const alias = GEO_ALIASES[s.toLowerCase()];
  return alias || cleanRegion(s);
}

function makePlace(rawProvince, rawCity, fromHeader) {
  let p = normalizeGeoName(rawProvince, fromHeader);
  let c = normalizeGeoName(rawCity, fromHeader);
  if (/^[A-Z]{2}$/.test(p)) p = COUNTRY_NAMES[p] || "海外";
  if (/^[A-Z]{2}$/.test(c)) c = COUNTRY_NAMES[c] || "海外";
  if (!p && !c) return { province: "", city: "", place: PLACE_UNKNOWN, known: false };
  if (p && c && p !== c && !c.startsWith(p)) {
    return { province: p, city: c, place: `${p}·${c}`, known: true };
  }
  const only = c || p;
  return { province: p, city: c, place: only, known: true };
}

function placeFromHeaders(req) {
  const h = req.headers || {};
  const city = h["cf-ipcity"] || h["eo-geo-city"] || h["x-geo-city"] || h["x-city"];
  const region = h["cf-region"] || h["x-geo-province"] || h["x-region"] ||
                 h["cf-ipcountry"] || h["eo-geo-country"];
  if (!city && !region) return null;
  return makePlace(region, city, true);
}

// 国内公共 IP 归属接口（无需 key），带硬超时；任何异常都静默降级，不阻塞留言
function fetchPlace(ip) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    const url = `https://whois.pconline.com.cn/ipJson.jsp?json=true&ip=${encodeURIComponent(ip)}`;
    const request = https.get(url, {
      timeout: 1800,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Atelier/1.0)", "Accept": "*/*" }
    }, (resp) => {
      if (resp.statusCode !== 200) { resp.resume(); return finish(null); }
      const chunks = [];
      resp.on("data", (c) => chunks.push(c));
      resp.on("end", () => {
        try {
          const raw = Buffer.concat(chunks);
          let text = raw.toString("utf8");
          if (/\uFFFD/.test(text) && typeof TextDecoder === "function") {
            try { text = new TextDecoder("gbk").decode(raw); } catch (_) { /* 保持 utf8 */ }
          }
          const d = JSON.parse(text);
          if (!d || d.err) return finish(null);
          finish(makePlace(d.pro, d.city));
        } catch (_) { finish(null); }
      });
      resp.on("error", () => finish(null));
    });
    request.on("timeout", () => { request.destroy(); finish(null); });
    request.on("error", () => finish(null));
  });
}

async function resolvePlace(req) {
  const fromHeader = placeFromHeaders(req);
  if (fromHeader && fromHeader.known) return fromHeader;
  const ip = getClientIP(req);
  if (isLocalIP(ip)) {
    const cfg = getOrInitConfig();
    if (cfg.homeCity) return makePlace(cfg.homeProvince || "", cfg.homeCity);
    return { province: "", city: "", place: "案前", known: false };
  }
  const cached = ipPlaceCache.get(ip);
  if (cached && Date.now() - cached.at < 3600000) return cached;
  const result = (await fetchPlace(ip)) || fromHeader ||
    { province: "", city: "", place: PLACE_UNKNOWN, known: false };
  ipPlaceCache.set(ip, Object.assign({}, result, { at: Date.now() }));
  if (ipPlaceCache.size > 1000) ipPlaceCache.clear();
  return result;
}

function readVisits() {
  const d = readJSON(VISITS_FILE, {});
  return {
    cities: Array.isArray(d.cities) ? d.cities : [],
    recent: Array.isArray(d.recent) ? d.recent : []
  };
}

function visitsSummary(data) {
  return {
    total: data.cities.length,
    visits: data.cities.reduce((sum, c) => sum + (Number(c.count) || 0), 0)
  };
}

// 同一访客 6 小时内只点亮一次，避免刷新刷屏；未知地域不入库
function recordVisit(place, req) {
  const data = readVisits();
  if (!place || !place.known) return { data, isNew: false, skipped: true };
  const day = new Date().toISOString().slice(0, 10);
  const seenKey = crypto.createHash("sha256")
    .update(String(getClientIP(req)) + day).digest("hex");
  const nowMs = Date.now();
  if (nowMs - (visitSeenMap.get(seenKey) || 0) < 6 * 3600000) {
    return { data, isNew: false, skipped: true };
  }
  visitSeenMap.set(seenKey, nowMs);
  if (visitSeenMap.size > 3000) visitSeenMap.clear();

  const key = `${place.province}|${place.city}`;
  const now = new Date().toISOString();
  const hit = data.cities.find((c) => c.key === key);
  const isNew = !hit;
  if (hit) {
    hit.count = (Number(hit.count) || 0) + 1;
    hit.last = now;
    hit.province = place.province;
    hit.city = place.city;
  } else {
    data.cities.push({
      key, province: place.province, city: place.city,
      count: 1, first: now, last: now
    });
  }
  data.recent.unshift({ key, province: place.province, city: place.city, time: now });
  if (data.recent.length > 32) data.recent.length = 32;
  writeJSON(VISITS_FILE, data);
  return { data, isNew, skipped: false };
}

// v41 · 纸境全站访问统计（真实口径）
//   PV：仅统计真人页面加载（爬虫 / 探活 / 站长自己不计）；
//   UV：同一访客每自然日仅 1 次，去重表落盘（哈希+密盐，无明文 IP），重启不重复计数；
//   文章阅读：同一访客 30 分钟内重复打开同一篇只计 1 次，统一以 slug 为键。
const STATS_SEEN_FILE = path.join(DATA_DIR, ".stats-seen.json"); // 本机私有，不参与双机同步
const BOT_UA_RE = /bot|spider|crawl|slurp|curl|wget|python|postman|pingdom|uptime|monitor|headless|scrapy|go-http|java\/|okhttp|httpclient|libwww|node-fetch|axios|lighthouse|preview|facebookexternalhit|embedly/i;
let statsSeen = null; // { day, salt, uv: {hash:1}, art: {hash:ts} }

function loadStatsSeen() {
  const day = new Date().toISOString().slice(0, 10);
  if (!statsSeen) {
    const d = readJSON(STATS_SEEN_FILE, {});
    statsSeen = {
      day: d.day || day,
      salt: d.salt || crypto.randomBytes(16).toString("hex"),
      uv: d.uv || {},
      art: d.art || {}
    };
  }
  if (statsSeen.day !== day) { statsSeen.day = day; statsSeen.uv = {}; statsSeen.art = {}; }
  return statsSeen;
}
let statsSeenDirty = false, statsSeenTimer = null;
function flushStatsSeen() {
  if (!statsSeenDirty) return;
  statsSeenDirty = false;
  try { writeJSON(STATS_SEEN_FILE, statsSeen); } catch (e) {}
}
function markStatsSeenDirty() {
  statsSeenDirty = true;
  if (!statsSeenTimer) statsSeenTimer = setTimeout(() => { statsSeenTimer = null; flushStatsSeen(); }, 3000);
}
process.on("SIGTERM", () => { flushStatsSeen(); process.exit(0); });

// 文章键统一为 slug（兼容历史 art-N 形式）
function canonicalArticleKey(raw) {
  const k = String(raw || "").trim().slice(0, 80);
  if (!k) return "";
  try {
    const list = readJSON(ARTICLES_FILE, []);
    const hit = list.find(a => a && (a.slug === k || String(a.id) === k));
    if (hit) return hit.slug || String(hit.id);
  } catch (e) {}
  return k;
}

function readStats() {
  const nowDay = new Date().toISOString().slice(0, 10);
  const d = readJSON(STATS_FILE, { pv: 0, uv: 0, today: { date: nowDay, pv: 0, uv: 0 }, articles: {}, history: {} });
  if (!d.history) d.history = {};
  if (!d.articles) d.articles = {};
  if (!d.today || !d.today.date) d.today = { date: nowDay, pv: 0, uv: 0 };
  if (d.today.date !== nowDay) {
    d.history[d.today.date] = { pv: d.today.pv || 0, uv: d.today.uv || 0 };
    d.today = { date: nowDay, pv: 0, uv: 0 };
  }
  d.pv = Number(d.pv) || 0;
  d.uv = Number(d.uv) || 0;
  // 一次性迁移：去掉 v40 硬编码的占位基数，并把 art-N / slug 双份计数合并为 slug
  if (!d.v41) {
    // 总数 = 各日之和；占位基数（6/4）只存在于最早一天
    const days = Object.keys(d.history).sort();
    const seedDay = days.length ? days[0] : d.today.date;
    const seedRec = seedDay === d.today.date ? d.today : d.history[seedDay];
    if (seedRec) {
      seedRec.pv = Math.max(0, (seedRec.pv || 0) - 6);
      seedRec.uv = Math.max(0, (seedRec.uv || 0) - 4);
    }
    let sp = d.today.pv || 0, su = d.today.uv || 0;
    days.forEach(k => { sp += d.history[k].pv || 0; su += d.history[k].uv || 0; });
    d.pv = sp; d.uv = su;
    const merged = {};
    Object.keys(d.articles).forEach(k => {
      const ck = canonicalArticleKey(k);
      merged[ck] = Math.max(merged[ck] || 0, Number(d.articles[k]) || 0);
    });
    d.articles = merged;
    d.v41 = true;
  }
  return d;
}

function recordSiteVisit(req, articleId = null) {
  const stats = readStats();
  const seen = loadStatsSeen();
  const nowMs = Date.now();
  const ip = getClientIP(req);
  const ua = String(req.headers["user-agent"] || "");
  const isBot = !ua || BOT_UA_RE.test(ua) || isLocalIP(ip);
  const h = (x) => crypto.createHash("sha256").update(seen.salt + "|" + x).digest("hex").slice(0, 24);

  let articleViews = null;
  const artKey = articleId ? canonicalArticleKey(articleId) : "";

  if (!isBot) {
    if (artKey) {
      // 文章阅读：不计入页面 PV（PV 已在进站时计过），同访客 30 分钟内同篇只计 1 次
      const ak = h(ip + "|" + artKey);
      if (nowMs - (seen.art[ak] || 0) > 30 * 60000) {
        seen.art[ak] = nowMs;
        stats.articles[artKey] = (Number(stats.articles[artKey]) || 0) + 1;
        markStatsSeenDirty();
      }
    } else {
      stats.pv += 1;
      stats.today.pv = (Number(stats.today.pv) || 0) + 1;
      const uk = h(ip);
      if (!seen.uv[uk]) {
        seen.uv[uk] = 1;
        stats.uv += 1;
        stats.today.uv = (Number(stats.today.uv) || 0) + 1;
        markStatsSeenDirty();
      }
    }
    writeJSON(STATS_FILE, stats);
  }
  if (artKey) articleViews = stats.articles[artKey] || 0;
  return {
    pv: stats.pv,
    uv: stats.uv,
    todayPv: stats.today.pv,
    todayUv: stats.today.uv,
    articleViews: articleViews
  };
}

// 工坊回笔首句：欢迎来自某地的墨友（GLM 与本地语义引擎统一适用）
// v40 · 地域润色：仅在地域明确已知（非"远方"）且原句未出现时自然融入，彻底杜绝机械套娃
function decorateGreeting(content, place) {
  let s = String(content || "").trim();
  if (!place || place === PLACE_UNKNOWN || place === "局域网" || place === "本地") return s;
  if (s.includes(place)) return s;
  // 短句且不含其他称谓时，可自然点缀
  if (s.length <= 45 && !s.startsWith("欢迎来自") && !s.includes("老乡") && !s.includes("同道")) {
    return `来自${place}的墨友，` + s;
  }
  return s;
}

const messageRateMap = new Map(); // IP -> { lastPostTime, count, windowStart, lastContentHash }

// Lightweight per-target cooldown for resonance & visitor replies (v26)
const lightRateMap = new Map();
function checkLightRate(key, cooldownMs = 30000) {
  const now = Date.now();
  const last = lightRateMap.get(key) || 0;
  if (now - last < cooldownMs) return false;
  lightRateMap.set(key, now);
  if (lightRateMap.size > 2000) {
    for (const [k, t] of lightRateMap) if (now - t > 3600000) lightRateMap.delete(k);
  }
  return true;
}
function checkMessageRateLimit(ip, content) {
  // 标准滑动窗口：拒绝时不续期，恢复时间可预期（替代旧版累积式冷却）
  const perIp = checkRate("msg:ip", ip, 3, 10 * 60 * 1000);
  if (!perIp.allowed) return {
    allowed: false, retryAfter: perIp.retryAfter,
    error: `留墨稍密，请静候 ${perIp.retryAfter} 秒再续一笔`
  };
  const global = checkRate("msg:global", "*", 30, 10 * 60 * 1000);
  if (!global.allowed) return {
    allowed: false, retryAfter: global.retryAfter,
    error: "此刻留墨较多，工坊稍歇，请稍候再试"
  };
  const cool = checkRate("msg:cool", ip, 1, 15000);
  if (!cool.allowed) return {
    allowed: false, retryAfter: cool.retryAfter,
    error: `请静候 ${cool.retryAfter} 秒再落第二笔`
  };
  const digest = crypto.createHash("md5").update(String(content).trim()).digest("hex");
  const dup = checkRate("msg:dup:" + digest, ip, 1, 120000);
  if (!dup.allowed) return {
    allowed: false, retryAfter: dup.retryAfter, error: "请勿重复提交相同内容的墨痕。"
  };
  return { allowed: true };
}

// Parse cookies
function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(";").forEach((cookie) => {
    let [name, ...rest] = cookie.split("=");
    name = name.trim();
    if (!name) return;
    const value = rest.join("=").trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

// Check admin auth
function isAuthenticated(req) {
  const authHeader = req.headers["authorization"] || "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (verifyAuthToken(token)) return true;
  }
  const cookies = parseCookies(req.headers["cookie"]);
  if (cookies["atelier_session"] && verifyAuthToken(cookies["atelier_session"])) {
    return true;
  }
  return false;
}

// Universal Response Sender with Strict Security Headers, Gzip, ETag & Cache Isolation
function sendResponse(req, res, statusCode, contentType, body, isCacheable = false) {
  let buffer = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body), "utf-8");
  const hash = crypto.createHash("md5").update(buffer).digest("hex");
  const etag = `W/"${hash}"`;

  const pathname = new URL(req.url, `http://${req.headers.host || "localhost"}`).pathname;
  const isAPI = pathname.startsWith("/api") || contentType.includes("json");
  const isHTML = contentType.includes("text/html");
  const isDynamicMeta = pathname === "/rss.xml" || pathname === "/sitemap.xml" || pathname === "/robots.txt";
  const isNeverCache = isAPI || isHTML || isDynamicMeta || pathname === "/sw.js" || pathname.startsWith("/article/");

  if (!isNeverCache && req.headers["if-none-match"] === etag) {
    res.writeHead(304, {
      "ETag": etag,
      "Cache-Control": isCacheable ? "public, max-age=31536000, immutable" : "no-cache, must-revalidate",
      "Vary": "Origin, Accept-Encoding"
    });
    res.end();
    return;
  }

  // 1. Full Military-Grade Production Security Headers (v54)
  const headers = {
    "Content-Type": contentType,
    "Vary": "Origin, Accept-Encoding",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "X-XSS-Protection": "1; mode=block",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()"
  };

  // 2. Strict Cache-Busting for HTML, API, RSS & Sitemap
  if (isNeverCache) {
    headers["Cache-Control"] = "private, no-cache, no-store, max-age=0, must-revalidate";
    headers["CDN-Cache-Control"] = "private, no-cache, no-store, max-age=0, must-revalidate";
    headers["Cloudflare-CDN-Cache-Control"] = "private, no-cache, no-store, max-age=0, must-revalidate";
    headers["Pragma"] = "no-cache";
    headers["Expires"] = "0";
    headers["ETag"] = `W/"${Date.now()}-${hash.slice(0, 8)}"`; // Dynamic ETag defeats edge proxy stale caching
  } else if (isCacheable) {
    const hasVersion = req.url && (req.url.includes("?v=") || req.url.includes("&v="));
    if (hasVersion) {
      headers["Cache-Control"] = "public, max-age=86400, stale-while-revalidate=86400";
      headers["CDN-Cache-Control"] = "max-age=86400";
      headers["Cloudflare-CDN-Cache-Control"] = "max-age=86400";
    } else {
      headers["Cache-Control"] = "public, max-age=60, must-revalidate";
      headers["CDN-Cache-Control"] = "max-age=120";
      headers["Cloudflare-CDN-Cache-Control"] = "max-age=120";
    }
    headers["ETag"] = etag;
  } else {
    headers["Cache-Control"] = "public, max-age=60, must-revalidate";
    headers["ETag"] = etag;
  }

  const acceptEncoding = req.headers["accept-encoding"] || "";
  const isCompressible = /^(text\/|application\/(javascript|json|xml|rss\+xml)|image\/svg\+xml)/.test(contentType);
  if (isCompressible && acceptEncoding.includes("gzip") && buffer.length > 384) {
    zlib.gzip(buffer, (err, compressed) => {
      if (!err) {
        headers["Content-Encoding"] = "gzip";
        headers["Content-Length"] = compressed.length;
        res.writeHead(statusCode, headers);
        res.end(compressed);
      } else {
        headers["Content-Length"] = buffer.length;
        res.writeHead(statusCode, headers);
        res.end(buffer);
      }
    });
  } else {
    headers["Content-Length"] = buffer.length;
    res.writeHead(statusCode, headers);
    res.end(buffer);
  }
}

function sendJSON(req, res, statusCode, data, isCacheable = false) {
  sendResponse(req, res, statusCode, "application/json; charset=utf-8", JSON.stringify(data), isCacheable);
}

// Request body parser helper
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 5 * 1024 * 1024) {
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

// Dynamic RSS 2.0 Generator (Always up to date with 100% articles)
function generateDynamicRSS(full = false) {
  const articles = readJSON(ARTICLES_FILE, []);
  const config = getOrInitConfig();
  const siteUrl = "https://hlat.top";

  const itemsXML = articles.map(art => {
    const postUrl = `${siteUrl}/article/${art.slug || art.id}`;
    const pubDate = new Date(art.date || Date.now()).toUTCString();
    const title = (art.title || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const summary = (art.summary || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const category = (art.category || "随笔").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    return `    <item>
      <title>${title}</title>
      <link>${postUrl}</link>
      <guid isPermaLink="true">${postUrl}</guid>
      <category>${category}</category>
      <pubDate>${pubDate}</pubDate>
      <description><![CDATA[${art.summary || art.title}]]></description>
      ${full ? `<content:encoded><![CDATA[${art.content || art.summary || ""}]]></content:encoded>` : ""}
      <author>sxtx@hlat.top (${config.author || "Sxltx"})</author>
    </item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"${full ? ' xmlns:content="http://purl.org/rss/1.0/modules/content/"' : ''}>
  <channel>
    <title>${config.siteTitle || "Sxltx · 纸境工坊"}</title>
    <link>${siteUrl}</link>
    <description>${config.bio || "在微云之境，构筑自治的工程工作流与思想自留地。"}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${siteUrl}/og/default.png</url>
      <title>${config.siteTitle || "Sxltx · 纸境工坊"}</title>
      <link>${siteUrl}</link>
    </image>
${itemsXML}
  </channel>
</rss>`;
}

// Dynamic Sitemap Generator
function generateDynamicSitemap() {
  const articles = readJSON(ARTICLES_FILE, []);
  const siteUrl = "https://hlat.top";
  const mirrorUrl = "https://blog.hlat.xyz";

  const urlElements = [
    `  <url>
    <loc>${siteUrl}/</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`,
    `  <url>
    <loc>${mirrorUrl}/</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`
  ];

  articles.filter(art => !isDraftArticle(art)).forEach(art => {
    urlElements.push(`  <url>
    <loc>${siteUrl}/article/${art.slug || art.id}</loc>
    <lastmod>${art.date || new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.85</priority>
  </url>`);
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements.join("\n")}
</urlset>`;
}

// Dynamic Article Prerender & SEO Injection
function renderArticlePage(req, res, article) {
  const indexHtmlPath = path.join(PUBLIC_DIR, "index.html");
  let html = fs.readFileSync(indexHtmlPath, "utf-8");

  const siteUrl = "https://hlat.top";
  const postUrl = `${siteUrl}/article/${article.slug || article.id}`;
  const ogSlug = article.slug || article.id;
  const ogFile = [ogSlug + ".png", article.id + ".png", "default.png"]
    .find(n => fs.existsSync(path.join(PUBLIC_DIR, "og", n))) || "default.png";
  const ogImgUrl = `${siteUrl}/og/${ogFile}`;
  const cleanTitle = `${article.title} · Sxltx 纸境工坊`;
  const cleanDesc = article.summary || `${article.title} - Sxltx 的独立个人工坊思考与造物沉淀。`;

  // 1. Dynamic Title
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${cleanTitle}</title>`);

  // 2. Canonical URL (Individually Pointed to This Article)
  html = html.replace(/<link\s+rel="canonical"\s+href="[^"]*"/i, `<link rel="canonical" href="${postUrl}"`);

  // 3. Meta Description
  html = html.replace(/<meta\s+name="description"\s+content="[^"]*"/i, `<meta name="description" content="${cleanDesc}">`);

  // 4. OpenGraph Meta Tags
  html = html.replace(/<meta\s+property="og:url"\s+content="[^"]*"/i, `<meta property="og:url" content="${postUrl}">`);
  html = html.replace(/<meta\s+property="og:title"\s+content="[^"]*"/i, `<meta property="og:title" content="${cleanTitle}">`);
  html = html.replace(/<meta\s+property="og:description"\s+content="[^"]*"/i, `<meta property="og:description" content="${cleanDesc}">`);
  html = html.replace(/<meta\s+property="og:image"\s+content="[^"]*"/i, `<meta property="og:image" content="${ogImgUrl}">`);

  // 5. Twitter Card Meta Tags (1200x630 Large Card)
  html = html.replace(/<meta\s+name="twitter:card"\s+content="[^"]*"/i, `<meta name="twitter:card" content="summary_large_image">`);
  html = html.replace(/<meta\s+name="twitter:title"\s+content="[^"]*"/i, `<meta name="twitter:title" content="${cleanTitle}">`);
  html = html.replace(/<meta\s+name="twitter:description"\s+content="[^"]*"/i, `<meta name="twitter:description" content="${cleanDesc}">`);
  html = html.replace(/<meta\s+name="twitter:image"\s+content="[^"]*"/i, `<meta name="twitter:image" content="${ogImgUrl}">`);

  // 6. Schema.org BlogPosting Structured Data (Rich Snippets for Google & Bing)
  const schemaOrg = `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": ${JSON.stringify(article.title)},
    "description": ${JSON.stringify(cleanDesc)},
    "image": ${JSON.stringify(ogImgUrl)},
    "datePublished": ${JSON.stringify(article.date || "2026-11-04")},
    "dateModified": ${JSON.stringify(article.date || "2026-11-04")},
    "author": {
      "@type": "Person",
      "name": "Sxltx",
      "url": "https://hlat.top"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Sxltx · 纸境工坊",
      "logo": {
        "@type": "ImageObject",
        "url": "https://hlat.top/og/default.png"
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": ${JSON.stringify(postUrl)}
    }
  }
  </script>
  `;
  const breadcrumbSchema = `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {"@type": "ListItem", "position": 1, "name": "纸境工坊", "item": "https://hlat.top/"},
      {"@type": "ListItem", "position": 2, "name": ${JSON.stringify(article.category || "文墨")}, "item": "https://hlat.top/#essays"},
      {"@type": "ListItem", "position": 3, "name": ${JSON.stringify(article.title)}, "item": ${JSON.stringify(postUrl)}}
    ]
  }
  </script>
  `;
  html = html.replace("</head>", `${schemaOrg}\n${breadcrumbSchema}\n</head>`);

  // 7. Prerender Content into #reader-title, #reader-summary and #reader-content
  html = html.replace(/<h1[^>]*id="reader-title"[^>]*><\/h1>/i, `<h1 class="drawer-title" id="reader-title">${article.title}</h1>`);
  html = html.replace(/<p[^>]*id="reader-summary"[^>]*><\/p>/i, `<p class="drawer-summary" id="reader-summary">${article.summary || ''}</p>`);

  const prerenderBody = `
    <article class="ssr-prerender-article" style="display:block;">
      <div class="reader-meta-row" style="margin:0.8rem 0 1.2rem;color:var(--text-muted);font-family:var(--font-mono);font-size:0.85rem;">
        <span class="pill-badge">${article.category || '随笔'}</span> · 
        <span>${article.date || ''}</span> · 
        <span>${article.readTime || '5 分钟'}</span>
      </div>
      <div class="reader-body">
        ${article.content.replace(/\n\n/g, '<br><br>')}
      </div>
    </article>
  `;
  html = html.replace(/<div[^>]*id="reader-content"[^>]*><\/div>/i, `<div class="markdown-rendered-content" id="reader-content">${prerenderBody}</div>`);

  sendResponse(req, res, 200, "text/html; charset=utf-8", html, false);
}

// MIME Types
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm"
};

const CORS_HOSTS = /^(localhost|127\.0\.0\.1|hlat\.top|.*\.hlat\.top|hlat\.xyz|.*\.hlat\.xyz)$/i;
function corsAllowedOrigin(req) {
  const origin = String(req.headers.origin || "");
  if (!origin) return "";
  try {
    const u = new URL(origin);
    if ((u.protocol === "https:" || u.protocol === "http:") && CORS_HOSTS.test(u.hostname)) return origin;
  } catch (e) {}
  return "";
}

const server = http.createServer(async (req, res) => {
  // v37 · 应用来源标记：一眼区分 Cloudflare 层 error 1000 与应用自身响应
  res.setHeader("X-Atelier-Origin", "app");

  // v37 · CORS 白名单回显。当前鉴权含 Cookie 会话，绝不再使用通配 *；
  //        且明确不设置 Allow-Credentials，避免将来改会话方式时漏出。
  const allowOrigin = corsAllowedOrigin(req);
  res.setHeader("Vary", "Origin, Accept-Encoding");
  if (allowOrigin) {
    res.setHeader("Access-Control-Allow-Origin", allowOrigin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Max-Age", "600");
  }

  if (req.method === "OPTIONS") {
    res.writeHead(204, { "X-Atelier-Origin": "app" });
    res.end();
    return;
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = urlObj.pathname;
  const method = req.method;

  // v37 · 链路诊断端点：不含任何主机指纹，只用于确认请求是否到达应用层
  if (pathname === "/api/ping" && method === "GET") {
    getClientIP(req);
    return sendJSON(req, res, 200, { ok: true, app: "atelier", layer: "application", ipSource: req.atelierIPSource });
  }

  // v37 · 所有 API 统一滑动窗口限流；登录与写操作另有更严的独立闸门
  if (pathname.startsWith("/api/")) {
    const gate = checkRate("api:global", getClientIP(req), 180, 60000);
    if (imposeRate(req, res, gate, "请求频率超出上限，请稍候再试")) return;
  }

  // 1. Dynamic RSS Feed (Real-time, Never Cached by Proxy)
  if (pathname === "/rss.xml" && method === "GET") {
    const rssContent = generateDynamicRSS(urlObj.searchParams.get("full") === "1");
    return sendResponse(req, res, 200, "application/xml; charset=utf-8", rssContent, false);
  }

  // 2. Dynamic Sitemap
  if (pathname === "/sitemap.xml" && method === "GET") {
    const sitemapContent = generateDynamicSitemap();
    return sendResponse(req, res, 200, "application/xml; charset=utf-8", sitemapContent, false);
  }

  // 3. Article Direct SSR Route (/article/:slug)
  const articleRouteMatch = pathname.match(/^\/article\/([^/]+)$/);
  if (articleRouteMatch && method === "GET") {
    const slug = decodeURIComponent(articleRouteMatch[1]);
    const articles = readJSON(ARTICLES_FILE, []);
    const art = articles.find(a => (a.slug && a.slug === slug) || a.id === slug);
    if (art && (isAuthenticated(req) || !isDraftArticle(art))) {
      return renderArticlePage(req, res, art);
    }
  }

  // API Routes
  // 1. Auth Status
  if (pathname === "/api/auth/status" && method === "GET") {
    return sendJSON(req, res, 200, { authenticated: isAuthenticated(req) });
  }

  // 2. Auth Login —— v37 三层限流 + scrypt 校验 + 旧哈希透明升级
  if (pathname === "/api/auth/login" && method === "POST") {
    const ip = getClientIP(req);

    // v37 · 账号级失败闸门：完全不依赖 IP，换 IP / 伪造 CF-Connecting-IP 也无法重置。
    //         攻击者借伪造头绕过 per-IP 限流时，这里是最后一道硬闸。
    const FAIL_WINDOW = 5 * 60 * 1000;
    const failedBefore = (rateState.get("login:globalfail|*") || [])
      .filter(t => Date.now() - t < FAIL_WINDOW);
    if (failedBefore.length >= 8) {
      const wait = Math.max(1, Math.ceil((failedBefore[0] + FAIL_WINDOW - Date.now()) / 1000));
      res.setHeader("Retry-After", String(wait));
      return sendJSON(req, res, 429, {
        ok: false, error: "登录失败次数过多，工坊暂时闭门，请稍后再试", retryAfter: wait
      });
    }

    const perIp = checkRate("login:attempt", ip, 8, 15 * 60 * 1000);
    if (imposeRate(req, res, perIp, "登录尝试次数过多，请稍后再试")) return;
    const globalGate = checkRate("login:global", "*", 40, 15 * 60 * 1000);
    if (imposeRate(req, res, globalGate, "登录请求过于频繁，请稍候再试")) return;

    const body = await parseBody(req);
    const config = getOrInitConfig();
    const pwd = String(body.password || "");
    const ok = await verifyPassword(pwd, config.adminPasswordHash);
    if (ok) {
      clearRate("login:attempt", ip);
      clearRate("login:fail", ip);
      clearRate("login:globalfail", "*");
      // 旧版 sha256 存储：首次成功登录后透明升级为 scrypt
      if (!String(config.adminPasswordHash || "").startsWith("scrypt$")) {
        try {
          config.adminPasswordHash = await scryptHash(pwd);
          writeJSON(CONFIG_FILE, config);
          console.log("[安全] 管理口令哈希已升级为 scrypt");
        } catch (e) { console.warn("[安全] 口令哈希升级失败:", e.message); }
      }
      const token = generateAuthToken();
      res.setHeader("Set-Cookie", `atelier_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`);
      return sendJSON(req, res, 200, { ok: true, token });
    }
    const fails = checkRate("login:fail", ip, 5, 15 * 60 * 1000);
    checkRate("login:globalfail", "*", 8, FAIL_WINDOW);
    return sendJSON(req, res, 401, {
      ok: false, error: "口令错误",
      ...(fails.allowed ? {} : { hint: "连续失败较多，请稍后再试" })
    });
  }

  // 3. Auth Logout
  if (pathname === "/api/auth/logout" && method === "POST") {
    res.setHeader("Set-Cookie", "atelier_session=; Path=/; HttpOnly; Max-Age=0");
    return sendJSON(req, res, 200, { ok: true });
  }

  // 4. Change Password
  if (pathname === "/api/auth/password" && method === "POST") {
    if (!isAuthenticated(req)) return sendJSON(req, res, 403, { ok: false, error: "未授权" });
    const body = await parseBody(req);
    const policyError = passwordPolicy(body.newPassword);
    if (policyError) return sendJSON(req, res, 400, { ok: false, error: policyError });
    const config = getOrInitConfig();
    config.adminPasswordHash = await scryptHash(String(body.newPassword));
    writeJSON(CONFIG_FILE, config);
    return sendJSON(req, res, 200, { ok: true, message: "管理口令修改成功，请重新登录" });
  }

  // 5. Config (Public Read, Protected Write)
  if (pathname === "/api/config") {
    if (method === "GET") {
      const config = getOrInitConfig();
      const publicConfig = {
        siteTitle: config.siteTitle || "Sxltx · 纸境工坊",
        siteSubtitle: config.siteSubtitle || "",
        author: config.author || "Sxltx",
        bio: config.bio || "",
        stampText: config.stampText || "纸境\nATELIER",
        hasGlmKey: !!(config.glmApiKey || process.env.ZHIPU_API_KEY || process.env.GLM_API_KEY),
        // v37 · 不再对外吐任何密钥片段：智谱是 id.secret 两段式，首尾四位足以缩小范围
        // v35 · 主理人每日一问题池。缺配置时前端回退到内置十二问，零新增依赖。
        dailyQuestions: Array.isArray(config.dailyQuestions)
          ? config.dailyQuestions.filter(q => typeof q === "string" && q.trim()).map(q => q.trim().slice(0, 60))
          : []
      };
      return sendJSON(req, res, 200, publicConfig, false);
    }
    if (method === "POST") {
      if (!isAuthenticated(req)) return sendJSON(req, res, 403, { ok: false, error: "未授权" });
      const body = await parseBody(req);
      const config = getOrInitConfig();
      if (body.siteTitle) config.siteTitle = String(body.siteTitle).slice(0, 100);
      if (body.siteSubtitle !== undefined) config.siteSubtitle = String(body.siteSubtitle).slice(0, 200);
      if (body.author) config.author = String(body.author).slice(0, 50);
      if (body.bio !== undefined) config.bio = String(body.bio).slice(0, 500);
      if (body.stampText !== undefined) config.stampText = String(body.stampText).slice(0, 30);
      if (body.glmApiKey !== undefined) config.glmApiKey = String(body.glmApiKey).trim();
      writeJSON(CONFIG_FILE, config);
      const safeConfigResponse = Object.assign({}, config);
      delete safeConfigResponse.glmApiKey;
      delete safeConfigResponse.adminPasswordHash;
      if (safeConfigResponse.ai) {
        safeConfigResponse.ai = Object.assign({}, safeConfigResponse.ai);
        delete safeConfigResponse.ai.apiKey;
      }
      return sendJSON(req, res, 200, { ok: true, config: safeConfigResponse });
    }
  }

  // 5.5 Resonance Seals (v26) — 一枚朱砂印，按文章计数
  if (pathname === "/api/resonances" && method === "GET") {
    return sendJSON(req, res, 200, { ok: true, counts: readJSON(RESONANCES_FILE, {}) });
  }
  const resonateMatch = pathname.match(/^\/api\/articles\/([^/]+)\/resonate$/);
  if (resonateMatch && method === "POST") {
    const artId = decodeURIComponent(resonateMatch[1]);
    const allArticles = readJSON(ARTICLES_FILE, []);
    if (!allArticles.some(a => a.id === artId || a.slug === artId)) {
      return sendJSON(req, res, 404, { ok: false, error: "文章不存在" });
    }
    if (!checkLightRate("res:" + getClientIP(req) + ":" + artId, 60000)) {
      return sendJSON(req, res, 429, { ok: false, error: "心意已收到，请稍歇片刻" });
    }
    const counts = readJSON(RESONANCES_FILE, {});
    counts[artId] = (Number(counts[artId]) || 0) + 1;
    writeJSON(RESONANCES_FILE, counts);
    return sendJSON(req, res, 200, { ok: true, count: counts[artId] });
  }

  // 5.6 Visitors Atlas (v29) — 到访即点亮城市，只保存城市级聚合
  // 5.5 Site Statistics & Article Views (v40)
  if (pathname === "/api/stats" && method === "GET") {
    const stats = readStats();
    return sendJSON(req, res, 200, {
      ok: true,
      pv: stats.pv,
      uv: stats.uv,
      todayPv: stats.today.pv,
      todayUv: stats.today.uv,
      articles: stats.articles || {}
    }, false);
  }
  if (pathname === "/api/stats/view" && method === "POST") {
    const body = await parseBody(req);
    const result = recordSiteVisit(req, body.articleId || null);
    return sendJSON(req, res, 200, Object.assign({ ok: true }, result), false);
  }

  if (pathname === "/api/visits" && method === "GET") {
    const data = readVisits();
    return sendJSON(req, res, 200, Object.assign({ ok: true }, data, visitsSummary(data)));
  }
  if (pathname === "/api/visit" && method === "POST") {
    const place = await resolvePlace(req);
    const result = recordVisit(place, req);
    return sendJSON(req, res, 200, Object.assign({
      ok: true,
      place: place.place,
      province: place.province,
      city: place.city,
      known: !!place.known,
      isNew: result.isNew,
      skipped: result.skipped
    }, result.data, visitsSummary(result.data)));
  }

  // 6. Articles API
  if (pathname === "/api/articles") {
    if (method === "GET") {
      const authed = isAuthenticated(req);
      const raw = readJSON(ARTICLES_FILE, []);
      const deadArt = new Set(readTombstones().articles);
      const all = raw.filter(a => !deadArt.has(a.id));
      if (all.length !== raw.length) writeJSON(ARTICLES_FILE, all);
      const visible = all.filter(a => authed || !isDraftArticle(a));
      // v37 · 公开列表只下发元数据；正文由阅读器按需从 /api/articles/:id 获取
      const out = authed ? visible : visible.map(a => {
        const view = Object.assign({}, a);
        delete view.content;
        return view;
      });
      return sendJSON(req, res, 200, { ok: true, articles: out, total: visible.length, full: authed });
    }
    if (method === "POST") {
      if (!isAuthenticated(req)) return sendJSON(req, res, 403, { ok: false, error: "未授权" });
      const body = await parseBody(req);
      if (!body.title) return sendJSON(req, res, 400, { ok: false, error: "标题不能为空" });
      const articles = readJSON(ARTICLES_FILE, []);
      const newArticle = {
        id: "art_" + Date.now().toString(36),
        title: String(body.title).trim(),
        slug: body.slug ? String(body.slug).trim() : "post-" + Date.now().toString(36),
        category: body.category ? String(body.category).trim() : "随笔",
        date: body.date || new Date().toISOString().slice(0, 10),
        readTime: body.readTime || "3 分钟",
        summary: body.summary ? String(body.summary).trim() : "",
        content: body.content ? String(body.content) : ""
      };
      articles.unshift(newArticle);
      writeJSON(ARTICLES_FILE, articles);
      return sendJSON(req, res, 201, { ok: true, article: newArticle });
    }
  }

  // Article single operations (PUT / DELETE)
  const articleMatch = pathname.match(/^\/api\/articles\/([^/]+)$/);
  if (articleMatch) {
    const artId = articleMatch[1];
    const articles = readJSON(ARTICLES_FILE, []);
    const idx = articles.findIndex((a) => a.id === artId || a.slug === artId);

    if (method === "GET") {
      if (idx === -1) return sendJSON(req, res, 404, { ok: false, error: "文章不存在" });
      if (!isAuthenticated(req) && isDraftArticle(articles[idx])) {
        return sendJSON(req, res, 404, { ok: false, error: "文章不存在" });
      }
      return sendJSON(req, res, 200, { ok: true, article: articles[idx] });
    }
    if (method === "PUT") {
      if (!isAuthenticated(req)) return sendJSON(req, res, 403, { ok: false, error: "未授权" });
      if (idx === -1) return sendJSON(req, res, 404, { ok: false, error: "文章不存在" });
      const body = await parseBody(req);
      if (body.title) articles[idx].title = String(body.title).trim();
      if (body.slug) articles[idx].slug = String(body.slug).trim();
      if (body.category) articles[idx].category = String(body.category).trim();
      if (body.date) articles[idx].date = String(body.date).trim();
      if (body.readTime) articles[idx].readTime = String(body.readTime).trim();
      if (body.summary !== undefined) articles[idx].summary = String(body.summary).trim();
      if (body.content !== undefined) articles[idx].content = String(body.content);
      writeJSON(ARTICLES_FILE, articles);
      return sendJSON(req, res, 200, { ok: true, article: articles[idx] });
    }
    if (method === "DELETE") {
      if (!isAuthenticated(req)) return sendJSON(req, res, 403, { ok: false, error: "未授权" });
      if (idx === -1) return sendJSON(req, res, 404, { ok: false, error: "文章不存在" });
      addTombstone("articles", artMatch[1]);
      const removed = articles.splice(idx, 1)[0];
      writeJSON(ARTICLES_FILE, articles);
      return sendJSON(req, res, 200, { ok: true, removed });
    }
  }

  // 7. Moments API
  if (pathname === "/api/moments") {
    if (method === "GET") {
      const raw = readJSON(MOMENTS_FILE, []);
      const deadMom = new Set(readTombstones().moments);
      const moments = raw.filter(m => !deadMom.has(m.id));
      if (moments.length !== raw.length) writeJSON(MOMENTS_FILE, moments);
      return sendJSON(req, res, 200, { ok: true, moments });
    }
    if (method === "POST") {
      if (!isAuthenticated(req)) return sendJSON(req, res, 403, { ok: false, error: "未授权" });
      const body = await parseBody(req);
      if (!body.content) return sendJSON(req, res, 400, { ok: false, error: "微语内容不能为空" });
      const moments = readJSON(MOMENTS_FILE, []);
      const newMoment = {
        id: "mom_" + Date.now().toString(36),
        content: String(body.content).trim(),
        tag: body.tag ? String(body.tag).replace(/^#/, "").trim() : "随想",
        time: new Date().toISOString()
      };
      moments.unshift(newMoment);
      writeJSON(MOMENTS_FILE, moments);
      return sendJSON(req, res, 201, { ok: true, moment: newMoment });
    }
  }

  // 7.1 v33 · 微语同感印：一枚轻印，计数落在 moments.json，不存任何访客身份
  const momentResMatch = pathname.match(/^\/api\/moments\/([^/]+)\/resonate$/);
  if (momentResMatch && method === "POST") {
    const momId = decodeURIComponent(momentResMatch[1]);
    if (!checkLightRate("mres:" + getClientIP(req) + ":" + momId, 6 * 3600000)) {
      return sendJSON(req, res, 429, { ok: false, error: "这一印已留过，稍后再来" });
    }
    const momentList = readJSON(MOMENTS_FILE, []);
    const mIdx = momentList.findIndex((m) => m.id === momId);
    if (mIdx === -1) return sendJSON(req, res, 404, { ok: false, error: "闪念不存在" });
    momentList[mIdx].resonances = (Number(momentList[mIdx].resonances) || 0) + 1;
    writeJSON(MOMENTS_FILE, momentList);
    return sendJSON(req, res, 200, { ok: true, count: momentList[mIdx].resonances });
  }

  const momentMatch = pathname.match(/^\/api\/moments\/([^/]+)$/);
  if (momentMatch && method === "DELETE") {
    if (!isAuthenticated(req)) return sendJSON(req, res, 403, { ok: false, error: "未授权" });
    const momId = momentMatch[1];
    addTombstone("moments", momId);
    const moments = readJSON(MOMENTS_FILE, []);
    const idx = moments.findIndex((m) => m.id === momId);
    if (idx !== -1) {
      moments.splice(idx, 1);
      writeJSON(MOMENTS_FILE, moments);
    }
    return sendJSON(req, res, 200, { ok: true });
  }

  // Smart Echo Generator for Guestbook (OpenAI-Compatible Engine: DeepSeek / GLM / Qwen / Ollama / OpenAI)
  // 智能回笔中枢：精准意图分流 + 严禁注水小作文 + 极简工程师博主人设
  async function generateSmartEcho(content, author, placeStr) {
    const text = (content || "").toLowerCase();
    const config = getOrInitConfig();
    const aiConfig = config.ai || {};
    
    // API 凭据：环境变量优先，其次 config.ai.apiKey，兼容历史 config.glmApiKey
    const aiKey = (
      process.env.AI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ZHIPU_API_KEY ||
      process.env.GLM_API_KEY ||
      aiConfig.apiKey ||
      config.glmApiKey ||
      ""
    ).trim();

    let aiUrl = (
      process.env.AI_BASE_URL ||
      process.env.OPENAI_BASE_URL ||
      aiConfig.baseUrl ||
      config.aiBaseUrl ||
      "https://open.bigmodel.cn/api/paas/v4/chat/completions"
    ).trim();

    // 自动补齐标准 OpenAI 路由
    if (!aiUrl.endsWith("/chat/completions")) {
      aiUrl = aiUrl.replace(/\/+$/, "");
      if (!aiUrl.endsWith("/v1")) {
        aiUrl += "/v1";
      }
      aiUrl += "/chat/completions";
    }

    const aiModel = (
      process.env.AI_MODEL ||
      process.env.OPENAI_MODEL ||
      aiConfig.model ||
      "glm-4-flash"
    ).trim();

    const siteAuthor = config.author || "纸境墨客";
    const authorName = aiConfig.authorName || (aiModel.toLowerCase().includes("glm") ? "工坊回笔 · GLM" : "工坊回笔 · 墨迹");

    // 超短/无实质意图：回一句自然简朴的收讫，不调用大模型
    const brief = () => ({
      author: "工坊回笔",
      content: "见字如面，墨迹已妥存。若有具体想聊的，工坊随时恭候再落几笔。",
      time: new Date().toISOString()
    });

    if (!shouldUseGLM(content)) return brief();

    if (aiKey && acquireGLMSlot()) {
      try {
        // 意图深度洞察，下达严格的字数与语气红线
        let intentInstruction = "这是一条日常交流留言。";
        const isQuestion = /？|\?|怎么|如何|请教|为什么|何解|请问|教教|能否/.test(content);
        const isPraise = /好|喜欢|赞|漂亮|舒服|棒|优雅|牛|佩服|收藏|支持|干净|太棒|顶/.test(content);
        const isShortGreet = content.length <= 10 && /你好|打卡|路过|签到|来看|爪印|嗨|hello|hi/i.test(content);

        if (isShortGreet) {
          intentInstruction = "【意图：打卡问候】访客只是随手打个卡或问候，你必须只回复1句话（20~40字），简朴道谢并欢迎常来即可。绝对禁止长篇大论，绝对禁止谈论人生哲理！";
        } else if (isPraise && !isQuestion) {
          intentInstruction = "【意图：赞美鼓励】访客赞赏了工坊的设计或文章，请用真诚谦逊的口吻致谢（30~60字），可简单提一笔素纸极简与不累眼的初衷，切忌夸大其词。";
        } else if (isQuestion) {
          intentInstruction = "【意图：具体提问】访客提出了疑问。请直奔主题、切中要害作答（40~90字），务实求真。本站是一线纯原生Node零依赖架构，若问及工坊实现如实作答，绝不讲空泛理论。";
        } else {
          intentInstruction = "【意图：交流探讨】请针对访客提到的具体事实真诚交流（30~70字），就事论事，语气平和、有分寸，像真实的博主朋友随手回笔。";
        }

        const systemPrompt = `你是独立自留地「${config.siteTitle || '纸境工坊'}」的主理人 ${siteAuthor}（一名崇尚东方极简与纯原生现代 Web 的全栈工程师）。你正在留言簿给访客写回笔。

【核心准则】
1.【严禁注水小作文】：严格遵守用户提示中的字数限制，宁短勿长。打卡问候绝不超过 40 字。
2.【严禁借题发挥】：只针对访客真正说的文字交流，绝不杜撰话题，严禁上价值、严禁展开成语典故或讲人生大道理！
3.【绝对消灭 AI 腔与模板套话】：
   - 严禁出现「在实际项目中遇到过」、「结合实际项目经验」、「具体操作步骤」、「注意事项」、「首先/其次/最后」等客服式套路；
   - 严禁输出【…】或 [...] 等任何形式的占位符；
   - 严禁自称「作为一个AI」、「智能助手」或使用机器公关口吻。
4.【真实真诚】：语调像一位安静敲代码、注重美学的朋友在便签纸上随手落笔，温和、克制、真实。`;

        const userPrompt = `访客称谓：${author || '墨友'}${placeStr && placeStr !== '远方' ? `（来自：${placeStr}）` : ''}\n留墨内容：${content}\n\n【本条指令】：${intentInstruction}`;

        const resp = await fetch(aiUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${aiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            temperature: 0.35,
            max_tokens: 180
          }),
          signal: AbortSignal.timeout(7000)
        });

        if (resp.ok) {
          const data = await resp.json();
          let aiReply = data?.choices?.[0]?.message?.content?.trim() || "";
          // 清理生硬的开头套路，如 "xxx，您好！"
          aiReply = aiReply.replace(/^.*?[，,]\s*(您好|你好)[！!。]?\s*/, "");
          if (aiReply && !isTemplateEcho(aiReply)) {
            return {
              author: authorName,
              content: aiReply,
              time: new Date().toISOString()
            };
          }
          if (aiReply) console.warn("[AI-Echo] 回复命中模板痕迹，已降级为本地回笔:", aiReply.slice(0, 40));
        } else {
          console.warn("[AI-Echo] API 调用失败，状态码:", resp.status);
        }
      } catch (err) {
        console.warn("[AI-Echo] 调用大模型接口异常:", err.message);
      } finally {
        releaseGLMSlot();
      }
    }

    // 本地真诚语义兜底：说人话、有分寸、不堆砌晦涩文言
    let echoContent = "";
    const isQ = text.includes("？") || text.includes("?") || text.includes("怎么") || text.includes("如何") || text.includes("请教") || text.includes("为什么") || text.includes("何解");

    if (isQ) {
      echoContent = `这一问问得实在。工坊后端依托纯原生 Node.js 处理，前端纯原生无构建。若你对某段实现感兴趣，工坊近期会梳理成实战笔记细聊。`;
    } else if (text.includes("设计") || text.includes("纸") || text.includes("排版") || text.includes("好看") || text.includes("优雅") || text.includes("美") || text.includes("风格") || text.includes("质感") || text.includes("留白")) {
      echoContent = `多谢懂这份心意。工坊刚把底色调成微暖的竹尾素纸，读着不刺眼、排版舒展就好，欢迎常来转转。`;
    } else if (text.includes("技术") || text.includes("架构") || text.includes("云") || text.includes("node") || text.includes("服务器") || text.includes("代码") || text.includes("部署") || text.includes("vps") || text.includes("开源") || text.includes("延迟") || text.includes("网络") || text.includes("cdn") || text.includes("缓存")) {
      echoContent = `同道中人。在喧嚣的技术潮流之外，手写干净、自洽且不依赖重型脚手架的系统是最纯粹的乐趣，愿代码常健，运行无阻。`;
    } else if (text.includes("加油") || text.includes("坚持") || text.includes("共勉")) {
      echoContent = `默默耕耘，自有回响。感谢鼓励，彼此加油，愿我们在各自的造物里都耐得住寂寞、走得踏实。`;
    } else {
      echoContent = `感谢旅人驻足留墨。字迹已妥存入卷，愿这里的一方安静能常伴你的日常，随时欢迎再来。`;
    }

    return {
      author: "工坊回笔",
      content: echoContent,
      time: new Date().toISOString()
    };
  }

if (pathname === "/api/messages") {
    if (method === "GET") {
      // v37 · 分页：默认最新 50 条，上限 50，避免一次吐全量
      const raw = readJSON(MESSAGES_FILE, []);
      const deadMsg = new Set(readTombstones().messages);
      const all = raw.filter(m => !deadMsg.has(m.id));
      if (all.length !== raw.length) writeJSON(MESSAGES_FILE, all);
      const limit = Math.min(50, Math.max(1, parseInt(urlObj.searchParams.get("limit"), 10) || 50));
      const offset = Math.max(0, parseInt(urlObj.searchParams.get("offset"), 10) || 0);
      return sendJSON(req, res, 200, {
        ok: true, messages: all.slice(offset, offset + limit),
        total: all.length, limit: limit, offset: offset
      });
    }
    if (method === "POST") {
      const body = await parseBody(req);
      
      // Honeypot Protection: Bots usually auto-fill hidden input fields
      if (body.website || body.honeypot || body.hp_token) {
        console.warn(`[AntiSpam] Bot detected via honeypot from ${getClientIP(req)}`);
        return sendJSON(req, res, 200, { ok: true, message: { id: "bot_ignored" } }); // Silent discard
      }

      if (!body.content || !body.content.trim()) {
        return sendJSON(req, res, 400, { ok: false, error: "留言内容不能为空" });
      }

      const clientIP = getClientIP(req);
      const rateCheck = checkMessageRateLimit(clientIP, body.content);
      if (!rateCheck.allowed) {
        if (rateCheck.retryAfter) res.setHeader("Retry-After", String(rateCheck.retryAfter));
        return sendJSON(req, res, 429, { ok: false, error: rateCheck.error, retryAfter: rateCheck.retryAfter });
      }

      const place = await resolvePlace(req);
      const messages = readJSON(MESSAGES_FILE, []);
      const echoData = await generateSmartEcho(body.content, body.author, place.place);
      // v40 · 自然点缀地域，杜绝机械硬套
      echoData.content = decorateGreeting(echoData.content, place.place);
      recordVisit(place, req);
      const cleanAuthor = sanitizeInput(body.author ? String(body.author).slice(0, 30) : "墨友");
      const cleanContent = sanitizeInput(String(body.content).slice(0, 500));
      const newMsg = {
        id: "msg_" + Date.now().toString(36),
        author: cleanAuthor || "墨友",
        content: cleanContent,
        time: new Date().toISOString(),
        location: place.known ? place.place : "",
        echo: echoData,
        ...(["静", "思", "喜", "问"].includes(body.mood) ? { mood: body.mood } : {}),
        // v35 · 每日一问：只记问题标识与题目文字，便于前端按话题聚合，不记任何身份信息
        ...(body.questionId ? {
          questionId: String(body.questionId).slice(0, 24),
          questionText: String(body.questionText || "").slice(0, 60)
        } : {}),
        visitorReplies: []
      };
      messages.unshift(newMsg);
      if (messages.length > 200) messages.length = 200;
      writeJSON(MESSAGES_FILE, messages);
      return sendJSON(req, res, 201, { ok: true, message: newMsg, place: place.place });
    }
  }

  // Message Reply API
  const msgReplyMatch = pathname.match(/^\/api\/messages\/([^/]+)\/reply$/);
  if (msgReplyMatch && (method === "POST" || method === "PUT")) {
    if (!isAuthenticated(req)) return sendJSON(req, res, 403, { ok: false, error: "未授权" });
    const msgId = msgReplyMatch[1];
    const body = await parseBody(req);
    const messages = readJSON(MESSAGES_FILE, []);
    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx === -1) return sendJSON(req, res, 404, { ok: false, error: "留言不存在" });

    const replyContent = String(body.content || "").trim();
    if (!replyContent) {
      delete messages[idx].echo;
    } else {
      messages[idx].echo = {
        author: body.author ? String(body.author).trim() : "工坊回笔",
        content: replyContent,
        time: new Date().toISOString()
      };
    }
    writeJSON(MESSAGES_FILE, messages);
    return sendJSON(req, res, 200, { ok: true, message: messages[idx] });
  }

  // Visitor-to-visitor threaded replies (v26) — 让留墨之间也能彼此回响
  const guestReplyMatch = pathname.match(/^\/api\/messages\/([^/]+)\/guest-reply$/);
  if (guestReplyMatch && method === "POST") {
    const body = await parseBody(req);
    if (body.website || body.honeypot || body.hp_token) {
      return sendJSON(req, res, 200, { ok: true, ignored: true });
    }
    const content = String(body.content || "").trim().slice(0, 200);
    if (!content) return sendJSON(req, res, 400, { ok: false, error: "回笔不能为空" });
    if (!checkLightRate("gre:" + getClientIP(req), 15000)) {
      return sendJSON(req, res, 429, { ok: false, error: "请稍歇片刻再附一笔" });
    }
    const messages = readJSON(MESSAGES_FILE, []);
    const idx = messages.findIndex(m => m.id === guestReplyMatch[1]);
    if (idx === -1) return sendJSON(req, res, 404, { ok: false, error: "留言不存在" });
    if (!Array.isArray(messages[idx].visitorReplies)) messages[idx].visitorReplies = [];
    const thread = messages[idx].visitorReplies;
    if (thread.length >= 12) {
      return sendJSON(req, res, 429, { ok: false, error: "这条留墨的回响已满，欢迎另起一笔" });
    }
    // v35 · 盖楼：replyTo 必须指向同一条留墨下已存在的一层；quote 只留被引用文字的短摘
    const parentId = body.replyTo ? String(body.replyTo).slice(0, 40) : "";
    if (parentId && !thread.some(r => r.id === parentId)) {
      return sendJSON(req, res, 400, { ok: false, error: "被引的一层已不在" });
    }
    const reply = {
      id: "vr_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      author: body.author ? String(body.author).trim().slice(0, 20) : "过路墨友",
      content,
      time: new Date().toISOString(),
      ...(parentId ? { replyTo: parentId } : {}),
      ...(body.quote ? { quote: String(body.quote).trim().slice(0, 70) } : {})
    };
    thread.push(reply);
    writeJSON(MESSAGES_FILE, messages);
    return sendJSON(req, res, 201, { ok: true, reply, message: messages[idx] });
  }

  const msgMatch = pathname.match(/^\/api\/messages\/([^/]+)$/);
  if (msgMatch && method === "DELETE") {
    if (!isAuthenticated(req)) return sendJSON(req, res, 403, { ok: false, error: "未授权" });
    const msgId = msgMatch[1];
    addTombstone("messages", msgId);
    const messages = readJSON(MESSAGES_FILE, []);
    const idx = messages.findIndex((m) => m.id === msgId);
    if (idx !== -1) {
      messages.splice(idx, 1);
      writeJSON(MESSAGES_FILE, messages);
    }
    return sendJSON(req, res, 200, { ok: true });
  }

  // 9. Status API
  if (pathname === "/api/status" && method === "GET") {
    // v37 · 主机指纹（hostname / 内核 / CPU / 内存 / uptime / node 版本）只对已登录主理人开放
    if (!isAuthenticated(req)) {
      return sendJSON(req, res, 200, { ok: true, status: "running", limited: true });
    }
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const uptimeSec = os.uptime();
    const hours = Math.floor(uptimeSec / 3600);
    const mins = Math.floor((uptimeSec % 3600) / 60);
    const secs = Math.floor(uptimeSec % 60);

    return sendJSON(req, res, 200, {
      ok: true,
      host: os.hostname(),
      platform: `${os.type()} ${os.release()} (${os.arch()})`,
      uptime: `${hours}小时 ${mins}分 ${secs}秒`,
      uptimeSeconds: uptimeSec,
      cpu: {
        cores: os.cpus().length,
        model: os.cpus()[0] ? os.cpus()[0].model : "AMD EPYC",
        load: os.loadavg()
      },
      memory: {
        totalGiB: (totalMem / 1073741824).toFixed(2),
        usedGiB: (usedMem / 1073741824).toFixed(2),
        freeGiB: (freeMem / 1073741824).toFixed(2),
        usedPercent: Math.round((usedMem / totalMem) * 100)
      },
      nodeVersion: process.version,
      timestamp: new Date().toISOString()
    });
  }

  // v37 · 未命中的 API 路由一律 404，不再被 SPA 兜底成 200 首页
  if (pathname.startsWith("/api/")) {
    return sendJSON(req, res, 404, { ok: false, error: "接口不存在" });
  }

  // v37 · 敏感路径明确 404：/.git/HEAD、/server.js 等不再误判为「有源码泄露」
  const clientIP = getClientIP(req);
  if (isIpBlocked(clientIP)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8", "Connection": "close" });
    return res.end("Access Denied: Malicious activity detected.");
  }

  if (SCANNER_PROBES.test(pathname)) {
    recordScannerStrike(clientIP);
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8", "Connection": "close" });
    return res.end("Forbidden.");
  }

  const SENSITIVE_PATH = /^\/(?:\.git|\.env|\.ssh|data|scripts|systemd|node_modules)(?:\/|$)|^\/(?:server\.js|package(?:-lock)?\.json|curator_daemon\.py|watchdog_v2\.py|README\.md|config\.json)$/i;
  if (SENSITIVE_PATH.test(pathname) || /\/\.[^/]+/.test(pathname)) return notFound(req, res);

  // Static File Serving —— 白名单式 SPA 兜底 + 路径穿越防护
  const spaRoute = pathname === "/" || pathname === "/admin";
  if (pathname === "/admin") res.setHeader("X-Robots-Tag", "noindex, nofollow");

  let decoded = spaRoute ? "index.html" : pathname;
  try { decoded = decodeURIComponent(decoded); } catch (e) { return notFound(req, res); }
  if (decoded.indexOf("\0") !== -1 || decoded.indexOf("..") !== -1) return notFound(req, res);

  let filePath = path.resolve(PUBLIC_DIR, "." + (decoded.startsWith("/") ? decoded : "/" + decoded));
  if (spaRoute) filePath = path.resolve(PUBLIC_DIR, "index.html");
  const inside = filePath === PUBLIC_DIR || filePath.startsWith(PUBLIC_DIR + path.sep);
  if (!inside || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return notFound(req, res);

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  const isDynamicMeta = pathname === "/sitemap.xml" || pathname === "/robots.txt" || pathname === "/rss.xml";
  const isCacheable = ext !== ".html" && pathname !== "/sw.js" && !isDynamicMeta;
  // v39 · 影片走流式 + Range（Safari / iOS 播放 <video> 必须支持 206 分段）
  if (ext === ".mp4" || ext === ".webm") {
    const size = fs.statSync(filePath).size;
    const range = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ""));
    const baseHeaders = { "Content-Type": mime, "Accept-Ranges": "bytes", "Cache-Control": "public, max-age=2592000", "X-Atelier-Origin": "app" };
    if (range) {
      let start = range[1] === "" ? size - Number(range[2]) : Number(range[1]);
      let end = range[1] !== "" && range[2] !== "" ? Number(range[2]) : size - 1;
      if (!(start >= 0) || start >= size || end < start) {
        res.writeHead(416, { "Content-Range": `bytes */${size}` });
        return res.end();
      }
      end = Math.min(end, size - 1);
      res.writeHead(206, Object.assign(baseHeaders, { "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 }));
      if (req.method === "HEAD") return res.end();
      return fs.createReadStream(filePath, { start, end }).pipe(res);
    }
    res.writeHead(200, Object.assign(baseHeaders, { "Content-Length": size }));
    if (req.method === "HEAD") return res.end();
    return fs.createReadStream(filePath).pipe(res);
  }
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500, { "X-Atelier-Origin": "app" });
      res.end("Internal Server Error");
    } else {
      sendResponse(req, res, 200, mime, content, isCacheable);
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Sxltx Atelier Studio Server running on port ${PORT}`);
});
