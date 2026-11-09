
// Inject typography styles dynamically (guaranteed first-line indent 2em & clean typography)
(function injectTypography() {
  const style = document.createElement('style');
  style.id = 'atelier-typography-rules';
  style.textContent = `
    .featured-summary,
    .art-desc,
    #reader-content p,
    .article-content p,
    .reader-body p {
      text-indent: 2em !important;
      text-align: justify !important;
    }
    #reader-content pre,
    #reader-content code,
    #reader-content ul,
    #reader-content ol,
    #reader-content li,
    #reader-content blockquote,
    #reader-content h1,
    #reader-content h2,
    #reader-content h3,
    #reader-content h4,
    .ai-insight-card,
    .ai-insight-card p,
    .ai-insight-card li,
    .ai-insight-card ul,
    .code-block-wrapper,
    .code-block-wrapper p {
      text-indent: 0 !important;
    }
  `;
  if (!document.getElementById('atelier-typography-rules')) {
    document.head.appendChild(style);
  }
})();
// --------------------------------------------------------------------------
// 0. Release Fingerprint & Auto-Busting Cache Healer
// --------------------------------------------------------------------------
const CURRENT_RELEASE_VER = '20261107_v47';
try {
  if (localStorage.getItem('atelier_ver') !== CURRENT_RELEASE_VER) {
    localStorage.setItem('atelier_ver', CURRENT_RELEASE_VER);
    localStorage.setItem('sxtx-atelier-theme', 'paper');
    document.documentElement.setAttribute('data-theme', 'paper');
    localStorage.removeItem('atelier_articles');
    localStorage.removeItem('atelier_moments');
    localStorage.removeItem('atelier_config');
    localStorage.removeItem('atelier_messages');
    if ('caches' in window) {
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        for (let r of regs) r.unregister();
      });
    }
  }
} catch (e) {
  console.warn('Auto-healer error:', e);
}

/**
 * Sxltx · 纸境工坊 · Studio Core Engine
 * Zero Heavy Bundler · Stale-While-Revalidate · Instant Load
 */


// Ludi Video 3 & 9: Semantic Badges & Segmented Radio Control
function getCatClass(cat) {
  if (cat === '技术') return 'cat-badge-tech';
  if (cat === '设计') return 'cat-badge-design';
  if (cat === '随笔') return 'cat-badge-essay';
  if (cat === '思考') return 'cat-badge-think';
  return 'cat-badge-life';
}

function initSegmentedControl() {
  const group = document.getElementById('edit-art-category-group');
  if (!group) return;
  const hiddenInput = document.getElementById('edit-art-category');
  group.querySelectorAll('.segment-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      group.querySelectorAll('.segment-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      if (hiddenInput) hiddenInput.value = pill.getAttribute('data-val');
    });
  });
}

function setSegmentedCategory(val) {
  const group = document.getElementById('edit-art-category-group');
  const hiddenInput = document.getElementById('edit-art-category');
  if (hiddenInput) hiddenInput.value = val;
  if (group) {
    group.querySelectorAll('.segment-pill').forEach(pill => {
      if (pill.getAttribute('data-val') === val) {
        pill.classList.add('active');
      } else {
        pill.classList.remove('active');
      }
    });
  }
}

// Global State
let articles = [];
let moments = [];
let messages = [];
let siteConfig = {};
let currentCategory = 'all';
let isAuthenticated = false;
let editingArticleId = null;

// Lightweight Markdown to HTML Parser
function parseMarkdown(md) {
  if (!md) return '';
  // 1. 深度安全剥离：阻断 script 脚本、敏感嵌入标签、内联 on* 事件 (如 onerror / onload)
  let html = md
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?(?:iframe|object|embed|form|input|button|base|meta|link|style)\b[^>]*>/gi, '')
    .replace(/\s+on[a-zA-Z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // 1. Normalize legacy or embedded HTML code blocks into markdown fences
  html = html.replace(/<p[^>]*>\s*<code\s+class="lang-([^"]+)">([\s\S]*?)<\/code>\s*<\/pre>/gi, (m, lang, code) => `\n\n\`\`\`${lang}\n${code.trim()}\n\`\`\`\n\n`);
  html = html.replace(/<pre>\s*<code\s+class="lang-([^"]+)">([\s\S]*?)<\/code>\s*<\/pre>/gi, (m, lang, code) => `\n\n\`\`\`${lang}\n${code.trim()}\n\`\`\`\n\n`);

  // 2. Pre-process code blocks with macOS dots, language tag and copy button
  const codeBlocks = [];
  html = html.replace(/```([a-zA-Z0-9_\-\+]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    const cleanLang = (lang || 'CODE').toUpperCase();
    const cleanCode = escapeHtml(code.trim());
    const rawAttr = encodeURIComponent(code.trim());
    codeBlocks.push(`
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <div class="code-mac-dots" aria-hidden="true">
            <span class="mac-dot mac-dot-close"></span>
            <span class="mac-dot mac-dot-min"></span>
            <span class="mac-dot mac-dot-max"></span>
          </div>
          <span class="code-lang-tag">${cleanLang}</span>
          <button class="code-copy-btn" data-code="${rawAttr}" title="复制代码" aria-label="复制代码">
            <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>复制</span>
          </button>
        </div>
        <pre class="code-content"><code class="lang-${lang}">${cleanCode}</code></pre>
      </div>
    `);
    return `\n\n${placeholder}\n\n`;
  });

  // 3. Ensure blank line before ordered/unordered lists
  html = html.replace(/([^\n])\n(\s*(?:\d+\.|\-|\*)\s+)/g, '$1\n\n$2');

  // 4. Headers with IDs for Table of Contents
  let headingCount = 0;
  html = html.replace(/^#### (.*$)/gim, (m, title) => {
    headingCount++;
    return `\n\n<h4 id="sec-h4-${headingCount}">${title}</h4>\n\n`;
  });
  html = html.replace(/^### (.*$)/gim, (m, title) => {
    headingCount++;
    return `\n\n<h3 id="sec-h3-${headingCount}">${title}</h3>\n\n`;
  });
  html = html.replace(/^## (.*$)/gim, (m, title) => {
    headingCount++;
    return `\n\n<h2 id="sec-h2-${headingCount}">${title}</h2>\n\n`;
  });
  html = html.replace(/^# (.*$)/gim, (m, title) => {
    headingCount++;
    return `\n\n<h2 id="sec-h2-${headingCount}">${title}</h2>\n\n`;
  });

  // 5. Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote><p>$1</p></blockquote>');

  // 6. Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="reader-inline-code">$1</code>');

  // 7. Bold & Italic
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // 8. Horizontal rules
  html = html.replace(/^---$/gim, '\n\n<hr class="reader-hr">\n\n');

  // 9. Process Lists via Placeholder Isolation (Prevents accidental <p> wrapping)
  const listBlocks = [];
  // Ordered lists
  html = html.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<li class="reader-ol-item" data-num="$1">$2</li>');
  html = html.replace(/((?:<li class="reader-ol-item"[^>]*>.*?<\/li>\s*)+)/gis, (m, content) => {
    const ph = `__LIST_BLOCK_${listBlocks.length}__`;
    listBlocks.push(`<ol class="reader-ordered-list">\n${content.trim()}\n</ol>`);
    return `\n\n${ph}\n\n`;
  });

  // Unordered lists
  html = html.replace(/^\s*[\-\*]\s+(.*$)/gim, '<li class="reader-ul-item">$1</li>');
  html = html.replace(/((?:<li class="reader-ul-item"[^>]*>.*?<\/li>\s*)+)/gis, (m, content) => {
    const ph = `__LIST_BLOCK_${listBlocks.length}__`;
    listBlocks.push(`<ul class="reader-unordered-list">\n${content.trim()}\n</ul>`);
    return `\n\n${ph}\n\n`;
  });

  // 10. Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, text, url) => {
    const cleanUrl = /^(?:https?:\/\/|\/|#|mailto:)/i.test(url.trim()) ? url.trim() : '#';
    return `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });

  // 11. Paragraphs with strict exclusions
  html = html.split(/\n{2,}/).map(para => {
    para = para.trim();
    if (!para) return '';
    if (para.startsWith('<h') || 
        para.startsWith('<ul') || 
        para.startsWith('<ol') || 
        para.startsWith('<pre') || 
        para.startsWith('<blockquote') || 
        para.startsWith('<hr') || 
        para.startsWith('<div') || 
        para.includes('__CODE_BLOCK_') ||
        para.includes('__LIST_BLOCK_')) {
      return para;
    }
    return `<p class="reader-para">${para.replace(/\n/g, '<br>')}</p>`;
  }).join('\n\n');

  // 12. Restore list blocks
  listBlocks.forEach((block, idx) => {
    html = html.replace(`__LIST_BLOCK_${idx}__`, block);
  });

  // 13. Restore code blocks
  codeBlocks.forEach((block, idx) => {
    html = html.replace(`__CODE_BLOCK_${idx}__`, block);
  });

  return html;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
}

// Toast Helper
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    setTimeout(() => toast.remove(), 250);
  }, 2400);
}

// Format Relative Time
function formatRelativeTime(dateStr) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - d) / 1000);
    if (diffSec < 60) return '刚刚';
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} 分钟前`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} 小时前`;
    if (diffSec < 86400 * 30) return `${Math.floor(diffSec / 86400)} 天前`;
    return d.toISOString().slice(0, 10);
  } catch (e) {
    return dateStr;
  }
}

// --------------------------------------------------------------------------
// 1.1 v33 · 近三日纸窗
// 口径：本地自然日（今天 / 昨天 / 前天）。若该窗口无内容，锚点自动平移到
// 最新一条所在日，避免站点歇笔几天后整章空白；「展阅旧卷」可回到全量。
// --------------------------------------------------------------------------
const ATELIER_DAY_MS = 86400000;
const atelierRecentScope = { essays: false, moments: false };
const atelierRecentCache = { essays: null, moments: null };

function atelierDayStart(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function atelierDayOfArticle(a) {
  const s = String((a && (a.date || a.time)) || '');
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : atelierDayStart(d);
}
function atelierDayOfMoment(m) {
  const d = new Date((m && (m.time || m.date)) || '');
  return isNaN(d.getTime()) ? null : atelierDayStart(d);
}
function atelierRecentWindow(items, dayOf) {
  const anchor0 = atelierDayStart(new Date());
  let anchor = anchor0;
  let start = anchor - 2 * ATELIER_DAY_MS;
  const end0 = anchor + ATELIER_DAY_MS - 1;
  const has = (items || []).some(it => {
    const d = dayOf(it);
    return d !== null && d >= start && d <= end0;
  });
  if (!has) {
    const days = (items || []).map(dayOf).filter(d => d !== null);
    if (days.length) {
      anchor = Math.max.apply(null, days);
      start = anchor - 2 * ATELIER_DAY_MS;
    }
  }
  return { start: start, end: anchor + ATELIER_DAY_MS - 1, anchor: anchor, isToday: anchor === anchor0 };
}
function atelierDayBadge(day, win) {
  if (day === null) return '';
  const diff = Math.round((atelierDayStart(new Date()) - day) / ATELIER_DAY_MS);
  if (diff === 0) return '今日';
  if (diff === 1) return '昨日';
  if (diff === 2) return '前日';
  const d = new Date(day);
  return String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
}
function atelierWindowLabel(win) {
  const fmt = (t) => {
    const d = new Date(t);
    return String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  };
  return '近三日 · ' + fmt(win.start) + ' — ' + fmt(win.anchor) + (win.isToday ? '' : ' · 最近更新');
}
function atelierShortDate(t) {
  const d = new Date(t);
  return String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
}

// v35 · 卷轴式年月分隔：把平铺的目录按「年 · 月」收成一卷一卷
const ATELIER_CN_DIGIT = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
function atelierCnNumber(n) {
  if (n <= 10) return n === 10 ? '十' : ATELIER_CN_DIGIT[n];
  if (n < 20) return '十' + ATELIER_CN_DIGIT[n - 10];
  return ATELIER_CN_DIGIT[Math.floor(n / 10)] + '十' + (n % 10 ? ATELIER_CN_DIGIT[n % 10] : '');
}
function atelierVolumeOf(a) {
  const s = String((a && (a.date || a.time)) || '');
  const m = /^(\d{4})-(\d{2})/.exec(s);
  if (m) {
    const y = Number(m[1]), mo = Number(m[2]);
    return {
      key: m[1] + '-' + m[2],
      label: String(y).split('').map(c => ATELIER_CN_DIGIT[Number(c)] || c).join('') +
             '年 · ' + atelierCnNumber(mo) + '月'
    };
  }
  return { key: '未纪年', label: '未纪年 · 散笺' };
}
// v35 · 本地「本月已阅」：只在浏览器里记文章 id 与月份，不上送、不含任何身份信息
function atelierMarkRead(article) {
  try {
    const key = 'atelier_read_v35';
    const d = new Date();
    const mon = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    let all = JSON.parse(localStorage.getItem(key) || '{}');
    if (!all || typeof all !== 'object' || Array.isArray(all)) all = {};
    const list = Array.isArray(all[mon]) ? all[mon] : [];
    const id = String((article && (article.id || article.slug)) || '');
    if (id && list.indexOf(id) === -1) list.push(id);
    all[mon] = list;
    const recent = {};
    Object.keys(all).sort().slice(-6).forEach(k => { recent[k] = all[k]; });
    localStorage.setItem(key, JSON.stringify(recent));
    if (window.atelierV35 && typeof window.atelierV35.refreshRead === 'function') {
      window.atelierV35.refreshRead();
    }
  } catch (e) { /* 隐私模式下静默降级 */ }
}
// v35 · 阅读器目录的「已读 X%」刻度：桌面侧栏与移动目录共用同一处更新
function atelierTocProgressHtml(cls) {
  return `<div class="v35-toc-progress${cls ? ' ' + cls : ''}">
            <div class="v35-toc-progress-head"><span>已读</span><strong data-toc-pct>0%</strong></div>
            <div class="v35-toc-progress-track"><span data-toc-fill style="width:0%"></span></div>
            <div class="v35-toc-progress-foot" data-toc-foot>起卷 · 未启</div>
          </div>`;
}
function atelierUpdateTocProgress(pct) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  document.querySelectorAll('[data-toc-pct]').forEach(el => { el.textContent = v + '%'; });
  document.querySelectorAll('[data-toc-fill]').forEach(el => { el.style.width = v + '%'; });
  document.querySelectorAll('[data-toc-foot]').forEach(el => {
    el.textContent = v >= 98 ? '阅毕 · 卷末' : v >= 60 ? '渐入 · 卷中' : v >= 20 ? '展卷 · 起笔' : '起卷 · 未启';
  });
}

// --------------------------------------------------------------------------
// 1. Stale-While-Revalidate Loader
// --------------------------------------------------------------------------
async function initData() {
  // Read local caches for 0ms instant display
  try {
    const cachedConfig = localStorage.getItem('atelier_config');
    if (cachedConfig) applyConfig(JSON.parse(cachedConfig));

    const cachedArts = localStorage.getItem('atelier_articles');
    if (cachedArts) {
      articles = JSON.parse(cachedArts);
      renderArticles();
      checkInitialArticleRoute();
    }

    const cachedMoms = localStorage.getItem('atelier_moments');
    if (cachedMoms) {
      moments = JSON.parse(cachedMoms);
      renderMoments();
    }

    const cachedMsgs = localStorage.getItem('atelier_messages');
    if (cachedMsgs) {
      messages = JSON.parse(cachedMsgs);
      renderMessages();
    }
  } catch (e) {
    console.warn('Cache read error:', e);
  }

  // Fetch background fresh updates
  fetchArticles();
  fetchMoments();
  fetchMessages();
  fetchConfig();
  fetchStatus();
  fetchAndReportStats();
  checkAuthStatus();
}

async function fetchConfig() {
  try {
    const res = await fetch('/api/config?t=' + Date.now(), { cache: 'no-store' });
    const data = await res.json();
    siteConfig = data;
    localStorage.setItem('atelier_config', JSON.stringify(data));
    applyConfig(data);
  } catch (e) {}
}

function applyConfig(cfg) {
  if (cfg.siteTitle) {
    const titleEl = document.getElementById('site-title-display');
    if (titleEl) titleEl.textContent = cfg.siteTitle;
    document.title = `${cfg.siteTitle} · 沉思与造物`;
  }
  if (cfg.siteSubtitle) {
    const subEl = document.getElementById('site-subtitle-display');
    if (subEl) if (window.updateHeroTypewriter) { window.updateHeroTypewriter(cfg.siteSubtitle); }
  }
  // bio omitted for minimalism in Hero
  if (cfg.stampText) {
    const sealEl = document.getElementById('seal-text-display');
    if (sealEl) sealEl.innerHTML = cfg.stampText.replace(/\n/g, '<br>');
  }
}

async function fetchArticles() {
  try {
    const res = await fetch('/api/articles?t=' + Date.now(), { cache: 'no-store' });
    const data = await res.json();
    if (data.articles) {
      articles = data.articles;
      localStorage.setItem('atelier_articles', JSON.stringify(articles));
      renderArticles();
      updateStudioArticlesList();
      updateTimelineStats();
      checkInitialArticleRoute();
    }
  } catch (e) {}
}

async function fetchMoments() {
  try {
    const res = await fetch('/api/moments?t=' + Date.now(), { cache: 'no-store' });
    const data = await res.json();
    if (data.moments) {
      moments = data.moments;
      localStorage.setItem('atelier_moments', JSON.stringify(moments));
      renderMoments();
      updateStudioMomentsList();
      updateTimelineStats();
    }
  } catch (e) {}
}

async function fetchMessages() {
  try {
    const res = await fetch('/api/messages?t=' + Date.now(), { cache: 'no-store' });
    const data = await res.json();
    if (data && data.messages) {
      messages = data.messages;
      localStorage.setItem('atelier_messages', JSON.stringify(messages));
      renderMessages();
      updateStudioMessagesList();
      updateTimelineStats();
    }
  } catch (e) {
    console.error('fetchMessages error:', e);
  }
}

async function fetchStatus() {
  try {
    const res = await fetch('/api/status?t=' + Date.now(), { cache: 'no-store' });
    const data = await res.json();
    if (data.uptime) {
      const upEl = document.getElementById('stat-uptime');
      if (upEl) upEl.textContent = data.uptime;
      const coreEl = document.getElementById('stat-core');
      if (data.cpu && data.memory && coreEl) coreEl.textContent = `${data.cpu.cores} vCPUs · ${data.memory.totalGiB}GB RAM`;
    } else {
      // v37 · 公开侧不再下发主机指纹，只呈现无害的运行态
      const upEl = document.getElementById('stat-uptime');
      const coreEl = document.getElementById('stat-core');
      if (upEl) upEl.textContent = '稳定运行';
      if (coreEl) coreEl.textContent = '纯原生 · 零依赖';
    }
  } catch (e) {}
}

// v40 · 纸境全站访问统计与单篇围阅量中枢
let siteStatsCache = null;

async function fetchAndReportStats(articleId = null) {
  try {
    const res = await fetch('/api/stats/view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(articleId ? { articleId: String(articleId) } : {}),
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.ok) return null;
    siteStatsCache = data;
    updateStatsUI(data);
    return data;
  } catch (err) {
    console.warn('[Stats] Error:', err);
    return null;
  }
}

function updateStatsUI(stats) {
  if (!stats) return;
  const fmt = n => (Number(n) || 0).toLocaleString();
  
  // 1. 时间轴概览数据栏
  const tstatPv = document.getElementById('tstat-pv');
  if (tstatPv) tstatPv.textContent = fmt(stats.pv);

  // 2. 页脚数据徽章
  const fPv = document.getElementById('fstat-pv');
  const fUv = document.getElementById('fstat-uv');
  const fToday = document.getElementById('fstat-today-pv');
  if (fPv) fPv.textContent = fmt(stats.pv);
  if (fUv) fUv.textContent = fmt(stats.uv);
  if (fToday) fToday.textContent = fmt(stats.todayPv);
}

// --------------------------------------------------------------------------
// 2. Render Functions
// --------------------------------------------------------------------------
function renderArticles() {
  const container = document.getElementById('essays-list-container');
  const featuredSlot = document.getElementById('featured-essay-slot');
  if (!container || !featuredSlot) return;

  // v33 · 近三日纸窗：先按自然日收敛，再按分类筛选；展阅旧卷时回到全量
  const win = atelierRecentWindow(articles, atelierDayOfArticle);
  const visible = atelierRecentScope.essays
    ? articles.slice()
    : articles.filter(a => {
        const d = atelierDayOfArticle(a);
        return d !== null && d >= win.start && d <= win.end;
      });
  const base = visible.slice().sort((a, b) =>
    (atelierDayOfArticle(b) || 0) - (atelierDayOfArticle(a) || 0));
  const filtered = currentCategory === 'all'
    ? base
    : base.filter(a => a.category === currentCategory);
  atelierRecentCache.essays = { win: win, total: articles.length, shown: filtered.length };

  if (filtered.length === 0) {
    featuredSlot.innerHTML = '';
    container.innerHTML = '<div class="loading-skeleton">近三日该分类暂无文墨 · 点章节右侧「展阅旧卷」翻看全部</div>';
    return;
  }

  // First item as Featured Hero Card
  const [featured, ...rest] = filtered;

  featuredSlot.innerHTML = `
    <div class="featured-essay-card${atelierDayOfArticle(featured) === win.anchor ? ' is-fresh' : ''}" data-id="${featured.id}">
      <div class="v35-paper-cover" aria-hidden="true">
        <span class="v35-cover-fiber"></span>
        <span class="v35-cover-glyph">${escapeHtml(String(featured.category || '随笔').charAt(0))}</span>
        <span class="v35-cover-rule"></span>
        <span class="v35-cover-stamp">纸境</span>
      </div>
      <div class="featured-badge-row">
        <span class="pill-badge">${featured.category || '随笔'}</span>
        <span class="featured-date mono">${featured.date || ''}</span>
        <span class="featured-date mono">·</span>
        <span class="featured-date mono">${featured.readTime || '3 分钟'}</span>
      </div>
      <h3 class="featured-title">${escapeHtml(featured.title)}</h3>
      <p class="featured-summary">${escapeHtml(featured.summary || '')}</p>
      <div class="read-more-action">
        <span>沉浸阅览</span>
        <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </div>
    </div>
  `;

  featuredSlot.querySelector('.featured-essay-card').addEventListener('click', () => {
    openReader(featured);
  });

  // Rest items as Index Table
  if (rest.length === 0) {
    container.innerHTML = '';
    return;
  }

  // v35 · 按年月分卷：只在换卷处落一枚卷签，行本身仍是原来的轻量目录
  let feedHTML = '';
  let lastVolume = '';
  rest.forEach(art => {
    const vol = atelierVolumeOf(art);
    if (vol.key !== lastVolume) {
      const n = rest.filter(x => atelierVolumeOf(x).key === vol.key).length;
      feedHTML += `
        <div class="essay-volume-divider" data-volume="${escapeHtml(vol.key)}">
          <span class="essay-volume-seal" aria-hidden="true">卷</span>
          <span class="essay-volume-label">${escapeHtml(vol.label)}</span>
          <span class="essay-volume-rule" aria-hidden="true"></span>
          <span class="essay-volume-count">${n} 篇</span>
        </div>`;
      lastVolume = vol.key;
    }
    feedHTML += `
    <div class="essay-row-item${atelierDayOfArticle(art) === win.anchor ? ' is-fresh' : ''}" data-id="${art.id}">
      <div class="essay-row-main">
        <span class="v35-row-thumb" aria-hidden="true"></span>
        <span class="essay-date-col">${art.date || ''}</span>
        <span class="essay-title-col">${escapeHtml(art.title)}</span>
      </div>
      <div class="essay-row-meta">
        <span class="essay-date-col-mobile">${art.date || ''}</span>
        <span class="essay-cat-pill">${art.category || '随笔'}</span>
        <span class="essay-readtime-pill">${art.readTime || ''}</span>
        <svg class="svg-icon essay-arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="7" y1="17" x2="17" y2="7"></line>
          <polyline points="7 7 17 7 17 17"></polyline>
        </svg>
      </div>
    </div>
  `;
  });
  container.innerHTML = feedHTML;

  container.querySelectorAll('.essay-row-item').forEach(row => {
    row.addEventListener('click', () => {
      const id = row.getAttribute('data-id');
      const item = articles.find(a => a.id === id);
      if (item) openReader(item);
    });
  });
}

function renderMoments() {
  const container = document.getElementById('moments-timeline-container');
  if (!container) return;

  if (moments.length === 0) {
    container.innerHTML = '<div class="loading-skeleton">暂无闪念记录</div>';
    return;
  }

  // v33 · 近三日纸窗 + 按日分组徽记（徽记留在条目内部，不干扰折叠计数）
  const win = atelierRecentWindow(moments, atelierDayOfMoment);
  const visible = atelierRecentScope.moments
    ? moments.slice()
    : moments.filter(m => {
        const d = atelierDayOfMoment(m);
        return d !== null && d >= win.start && d <= win.end;
      });
  const list = visible.slice().sort((a, b) =>
    new Date(b.time || b.date || 0).getTime() - new Date(a.time || a.date || 0).getTime());
  atelierRecentCache.moments = { win: win, total: moments.length, shown: list.length };

  if (list.length === 0) {
    container.innerHTML = '<div class="loading-skeleton">近三日暂无闪念 · 点章节右侧「展阅旧卷」翻看全部</div>';
    return;
  }

  let stamped = [];
  try { stamped = JSON.parse(localStorage.getItem('atelier_moment_res_v33') || '[]') || []; } catch (e) {}
  if (!Array.isArray(stamped)) stamped = [];

  container.innerHTML = list.map((m, i) => {
    const day = atelierDayOfMoment(m);
    const prevDay = i > 0 ? atelierDayOfMoment(list[i - 1]) : null;
    const dayBadge = (day !== null && day !== prevDay)
      ? '<span class="moment-day-badge">' + atelierDayBadge(day, win) + '</span>' : '';
    const id = escapeHtml(String(m.id || ''));
    const count = Number(m.resonances) || 0;
    const isStamped = stamped.indexOf(String(m.id || '')) !== -1;
    return `
    <div class="moment-entry" data-moment-id="${id}">
      <div class="moment-dot"></div>
      <div class="moment-header">
        ${dayBadge}
        <span class="moment-tag"># ${escapeHtml(m.tag || '随想')}</span>
        <span class="moment-time">${formatRelativeTime(m.time)}</span>
      </div>
      <p class="moment-text">${escapeHtml(m.content)}</p>
      <div class="moment-actions">
        <button type="button" class="moment-seal-btn${isStamped ? ' is-stamped' : ''}" data-moment-act="resonate" data-id="${id}" aria-pressed="${isStamped}" title="为这则闪念落一枚朱砂同感印">
          <span class="moment-seal-glyph">同感</span>
          <span class="moment-seal-count">${count}</span>
        </button>
        <button type="button" class="moment-join-btn" data-moment-act="join" data-id="${id}" title="引用这则闪念，接一句留墨">接一句 ↗</button>
      </div>
    </div>
  `;
  }).join('');
}

function renderMessages() {
  const container = document.getElementById('messages-wall');
  if (!container) return;

  if (messages.length === 0) {
    container.innerHTML = '<div class="loading-skeleton">素纸尚白，欢迎写下第一笔。</div>';
    return;
  }

  container.innerHTML = messages.map(msg => {
    const authorName = (msg.author || '墨友').trim();
    const initialChar = authorName.charAt(0) || '墨';

    return `
      <div class="message-card" data-id="${escapeHtml(msg.id)}">
        <!-- Guest Header: Avatar + Author + Relative Time -->
        <div class="msg-card-header">
          <div class="msg-sender-info">
            <div class="msg-guest-avatar" title="${escapeHtml(authorName)}">${escapeHtml(initialChar)}</div>
            <div class="msg-author-wrap">
              <span class="msg-author-name">${escapeHtml(authorName)}</span>
              <span class="msg-role-tag">墨友</span>
            </div>
          </div>
          <time class="msg-time mono">${formatRelativeTime(msg.time)}</time>
        </div>

        <!-- Guest Content Body -->
        <div class="msg-body">
          ${msg.questionText ? `
            <div class="v35-q-quote">
              <span class="v35-q-quote-mark">答 · 今日一问</span>
              <p>${escapeHtml(msg.questionText)}</p>
            </div>` : ''}
          <p class="msg-text">${escapeHtml(msg.content)}</p>
        </div>

        <!-- Atelier Echo / Response (Threaded Reply) -->
        ${msg.echo ? `
          <div class="msg-echo-box">
            <div class="echo-header">
              <div class="echo-sender">
                <img src="/logo.png?v=20261107_v47" alt="工坊主理人" class="echo-avatar" onerror="this.onerror=null;this.src='/favicon.png';">
                <span class="echo-author-name">${escapeHtml(msg.echo.author || '工坊回笔')}</span>
                <span class="echo-badge-seal">主理人</span>
              </div>
              <time class="echo-time mono">${formatRelativeTime(msg.echo.time)}</time>
            </div>
            <div class="echo-body">
              <p class="echo-text">${escapeHtml(msg.echo.content)}</p>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// Timeline Summary Stats Updater
function updateTimelineStats() {
  const essaysEl = document.getElementById('tstat-essays');
  if (essaysEl) essaysEl.textContent = (articles || []).length;

  const momentsEl = document.getElementById('tstat-moments');
  if (momentsEl) momentsEl.textContent = (moments || []).length;

  const messagesEl = document.getElementById('tstat-messages');
  if (messagesEl) messagesEl.textContent = (messages || []).length;
}

// --------------------------------------------------------------------------
// 3. Reader Drawer Logic
// --------------------------------------------------------------------------
function openReader(article) {
  if (!article) return;
  window.openReader = openReader;
  // v37 · 公开列表不再下发正文：按需取全文后再渲染阅读器
  if (!article.content) {
    fetch('/api/articles/' + encodeURIComponent(article.slug || article.id) + '?t=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok && d.article) Object.assign(article, d.article);
        renderReader(article);
      })
      .catch(function () { renderReader(article); });
    return;
  }
  renderReader(article);
}
function renderReader(article) {
  if (typeof article.content !== 'string') article.content = '';
  activeQuoteArticle = article;
  atelierMarkRead(article);
  try {
    const slug = article.slug || article.id;
    if (window.location.pathname !== `/article/${slug}`) {
      window.history.pushState({ articleSlug: slug }, '', `/article/${slug}`);
    }
  } catch (e) {}
  const overlay = document.getElementById('reader-overlay');
  const drawer = document.getElementById('reader-drawer');
  const catEl = document.getElementById('reader-category');
  const dateEl = document.getElementById('reader-date');
  const readEl = document.getElementById('reader-read-time');
  const titleEl = document.getElementById('reader-title');
  const sumEl = document.getElementById('reader-summary');
  const contentEl = document.getElementById('reader-content');
  const scrollContainer = document.getElementById('drawer-scroll-container') || document.querySelector('.drawer-content-scroll');
  const progressBar = document.getElementById('reader-progress-bar');

  catEl.textContent = article.category || '随笔';
  dateEl.textContent = article.date || '';
  
  // Calculate precise Chinese/English word count
  const rawText = (article.content || '').replace(/<[^>]+>/g, '').replace(/\s+/g, '');
  const wordCount = rawText.length;
  const readMin = Math.max(1, Math.ceil(wordCount / 380));
  readEl.textContent = `约 ${wordCount.toLocaleString()} 字 · 需 ${readMin} 分钟`;
  
  titleEl.textContent = article.title;
  sumEl.textContent = article.summary || '';

  // v40 · 文章围阅量动态上报与展示
  const viewsCountEl = document.getElementById('reader-views-count');
  if (viewsCountEl) {
    const artKey = article.slug || article.id;
    fetchAndReportStats(artKey).then(data => {
      if (data && data.articleViews) {
        viewsCountEl.textContent = Number(data.articleViews).toLocaleString();
      }
    });
  }

  // Render markdown or html
  // Build AI Insight Card
  const insights = article.insights || [
    "提炼核心思辨与实践手记，回归克制的人文排版与技术自洽；",
    "以纸境留白对抗数字噪音，在微云之境构筑自治工程流水线；",
    "长效保活与边缘网络协同，为创作者保留纯净的思想自留地。"
  ];
  const density = article.density || "90% · 深度沉淀";
  
  const insightCardHTML = `
    <div class="ai-insight-card">
      <div class="ai-insight-header">
        <div class="ai-insight-badge">
          <svg class="ai-insight-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"></path>
          </svg>
          <span>核心摘要 · 架构备忘</span>
        </div>
        <div class="ai-insight-meta">
          <span class="ai-chip">架构重点 <strong>${escapeHtml(density)}</strong></span>
          <span class="ai-chip">速读要点</span>
        </div>
      </div>
      <ul class="ai-insight-list">
        ${insights.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
      </ul>
    </div>
  `;
  
  contentEl.innerHTML = insightCardHTML + parseMarkdown(article.content);

  // v53 · 墨心导读流式落墨动效 (Streamed Ink Lens)
  setTimeout(() => {
    const listEl = document.getElementById('ai-insight-list');
    if (!listEl) return;
    const items = listEl.querySelectorAll('li');
    items.forEach((item, idx) => {
      const fullText = item.textContent;
      item.textContent = '';
      item.style.opacity = '0';
      item.style.transform = 'translateY(4px)';
      item.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      
      setTimeout(() => {
        item.style.opacity = '1';
        item.style.transform = 'translateY(0)';
        let charIdx = 0;
        const charTimer = setInterval(() => {
          charIdx++;
          item.textContent = fullText.substring(0, charIdx);
          if (charIdx >= fullText.length) {
            clearInterval(charTimer);
          }
        }, 22);
      }, idx * 320 + 150);
    });
  }, 120);


  // Bind code block copy buttons
  contentEl.querySelectorAll('.code-copy-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const codeText = decodeURIComponent(btn.getAttribute('data-code') || '');
      navigator.clipboard.writeText(codeText).then(() => {
        btn.classList.add('copied');
        btn.querySelector('span').textContent = '已复制 ✦';
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.querySelector('span').textContent = '复制';
        }, 2000);
      });
    };
  });

  // Build Dynamic Table of Contents (TOC) - Desktop Sidebar + Mobile Adaptive Accordion
  const headings = contentEl.querySelectorAll('h2, h3');
  contentEl.querySelectorAll('.reader-toc-container').forEach(el => el.remove());

  const desktopTocRail = document.getElementById('reader-desktop-sidebar');
  const mobileTocSlot = document.getElementById('reader-mobile-toc-slot');

  if (headings.length >= 2) {
    const hasH2 = Array.from(headings).some(h => h.tagName.toLowerCase() === 'h2');
    let tocListHtml = '';
    headings.forEach((h, i) => {
      const isSub = hasH2 && h.tagName.toLowerCase() === 'h3';
      const anchorId = h.id || `heading-${i}`;
      h.id = anchorId;
      tocListHtml += `
        <li class="reader-toc-item ${isSub ? 'level-sub' : 'level-top'}" data-target="${anchorId}">
          <span class="toc-bullet">${isSub ? '·' : '•'}</span>
          <span class="toc-text">${escapeHtml(h.textContent)}</span>
        </li>
      `;
    });

    // 1. Desktop Left Rail
    if (desktopTocRail) {
      desktopTocRail.innerHTML = `
        <div class="desktop-sidebar-inner">
          <div class="desktop-toc-header">
            <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px;margin-right:5px;"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line></svg>
            导读脉络
          </div>
          ${atelierTocProgressHtml()}
          <ul class="desktop-toc-list">
            ${tocListHtml}
          </ul>
        </div>
      `;
      desktopTocRail.querySelectorAll('.reader-toc-item').forEach(item => {
        item.onclick = (e) => {
          e.stopPropagation();
          const targetId = item.getAttribute('data-target');
          const targetEl = document.getElementById(targetId);
          if (targetEl && scrollContainer) {
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }
        };
      });
    }

    // 2. Mobile Collapsible Accordion (below summary, above content!)
    if (mobileTocSlot) {
      mobileTocSlot.innerHTML = `
        <details class="reader-mobile-toc-details">
          <summary class="reader-mobile-toc-summary">
            <span class="mobile-toc-badge">
              <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;margin-right:6px;"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line></svg>
              <span>导读脉络 (${headings.length} 节)</span>
            </span>
            <span class="v35-mobile-pct" data-toc-pct>0%</span>
            <span class="mobile-toc-arrow">▾</span>
          </summary>
          <div class="v35-toc-progress-track is-mobile"><span data-toc-fill style="width:0%"></span></div>
          <ul class="mobile-toc-list">
            ${tocListHtml}
          </ul>
        </details>
      `;
      mobileTocSlot.querySelectorAll('.reader-toc-item').forEach(item => {
        item.onclick = (e) => {
          e.stopPropagation();
          const targetId = item.getAttribute('data-target');
          const targetEl = document.getElementById(targetId);
          const details = mobileTocSlot.querySelector('details');
          if (details) details.removeAttribute('open');
          if (targetEl && scrollContainer) {
            targetEl.scrollIntoView({ behavior: 'smooth' });
          }
        };
      });
    }
  } else {
    // v35 · 正文小标题不足两节时目录缺席，但「已读 X%」刻度仍要留在侧栏与移动卷首
    if (desktopTocRail) desktopTocRail.innerHTML = `<div class="desktop-sidebar-inner">${atelierTocProgressHtml()}</div>`;
    if (mobileTocSlot) mobileTocSlot.innerHTML = atelierTocProgressHtml('is-mobile-card');
  }

    // Enforce mobile cross-axis stretch & containment
  const articleBodyEl = drawer.querySelector('.drawer-article-body');
  if (articleBodyEl) {
    articleBodyEl.style.width = '100%';
    articleBodyEl.style.maxWidth = '100%';
    articleBodyEl.style.minWidth = '0';
    articleBodyEl.style.boxSizing = 'border-box';
  }
  const layoutWrapEl = drawer.querySelector('.reader-layout-wrap');
  if (layoutWrapEl && window.innerWidth < 960) {
    layoutWrapEl.style.alignItems = 'stretch';
    layoutWrapEl.style.width = '100%';
    layoutWrapEl.style.maxWidth = '100%';
    layoutWrapEl.style.boxSizing = 'border-box';
  }

  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // Reset scroll and progress bar
  if (scrollContainer) scrollContainer.scrollTop = 0;
  if (progressBar) progressBar.style.width = '0%';
  atelierUpdateTocProgress(0);

  // Scroll listener for reading progress（顶部进度条 + 目录已读刻度同源）
  if (scrollContainer) {
    scrollContainer.onscroll = () => {
      const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      const pct = maxScroll > 0 ? Math.min(100, Math.max(0, (scrollContainer.scrollTop / maxScroll) * 100)) : 0;
      if (progressBar) progressBar.style.width = pct + '%';
      atelierUpdateTocProgress(pct);
    };
  }

  // Dark Ink Mode toggler
  const themeBtn = document.getElementById('btn-theme-reader');
  if (themeBtn && drawer) {
    themeBtn.onclick = () => {
      const isDark = drawer.classList.toggle('ink-dark-mode');
      showToast(isDark ? '已切换至暮墨夜泊护眼模式' : '已切换至竹尾素纸温润模式');
    };
  }

  // Set up copy link button
  const copyBtn = document.getElementById('btn-copy-article-link');
  if (copyBtn) {
    copyBtn.onclick = () => {
      const url = `${window.location.origin}/#art-${article.id}`;
      navigator.clipboard.writeText(url).then(() => {
        showToast('文章直达链接已复制至剪贴板');
      });
    };
  }

  // Set up postlude buttons
  const postludeCopyBtn = document.getElementById('postlude-copy-btn');
  if (postludeCopyBtn) {
    postludeCopyBtn.onclick = () => {
      const url = `${window.location.origin}/#art-${article.id}`;
      navigator.clipboard.writeText(url).then(() => {
        showToast('纸卷链接已复制，感谢知音分享');
      });
    };
  }

  const postludeCardBtn = document.getElementById('postlude-card-btn');
  if (postludeCardBtn) {
    postludeCardBtn.onclick = () => {
      const excerpt = article.summary || article.title;
      openQuoteModal(article.title, excerpt, article.title);
    };
  }

  const postludeShareX = document.getElementById('postlude-share-x');
  if (postludeShareX) {
    postludeShareX.onclick = () => {
      const slug = article.slug || article.id;
      const url = `https://blog.hlat.xyz/article/${slug}`;
      const text = `【${article.title}】\n${(article.summary || '').trim()}\n\n来自 Sxltx · 纸境工坊：`;
      const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
      window.open(shareUrl, '_blank', 'noopener,noreferrer');
    };
  }

  const postludeTopBtn = document.getElementById('postlude-top-btn');
  if (postludeTopBtn && scrollContainer) {
    postludeTopBtn.onclick = () => {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    };
  }
}

function closeReader() {
  try {
    if (window.location.pathname.startsWith('/article/')) {
      window.history.pushState({}, '', '/');
    }
  } catch (e) {}
  const overlay = document.getElementById('reader-overlay');
  overlay.style.display = 'none';
  document.body.style.overflow = '';
}

// Font size adjustments in Reader
let currentReaderFontSize = 1.05;
document.getElementById('btn-font-smaller')?.addEventListener('click', () => {
  if (currentReaderFontSize > 0.85) {
    currentReaderFontSize -= 0.1;
    document.getElementById('reader-content').style.fontSize = `${currentReaderFontSize}rem`;
  }
});
document.getElementById('btn-font-bigger')?.addEventListener('click', () => {
  if (currentReaderFontSize < 1.45) {
    currentReaderFontSize += 0.1;
    document.getElementById('reader-content').style.fontSize = `${currentReaderFontSize}rem`;
  }
});

// --------------------------------------------------------------------------
// 4. Global Search Modal (Spotlight / Raycast Style)
// --------------------------------------------------------------------------
function openSearchModal() {
  const modal = document.getElementById('search-modal');
  const input = document.getElementById('search-query-input');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  input.value = '';
  input.focus();
  runSearch('');
}

function closeSearchModal() {
  const modal = document.getElementById('search-modal');
  modal.style.display = 'none';
  document.body.style.overflow = '';
}

function runSearch(query) {
  const list = document.getElementById('search-results-list');
  const q = query.trim().toLowerCase();

  if (!q) {
    list.innerHTML = '<div class="search-hint">输入文章标题、摘要、标签或灵感微语关键字...</div>';
    return;
  }

  const matchedArticles = articles.filter(a => 
    (a.title && a.title.toLowerCase().includes(q)) ||
    (a.summary && a.summary.toLowerCase().includes(q)) ||
    (a.category && a.category.toLowerCase().includes(q))
  );

  const matchedMoments = moments.filter(m => 
    (m.content && m.content.toLowerCase().includes(q)) ||
    (m.tag && m.tag.toLowerCase().includes(q))
  );

  if (matchedArticles.length === 0 && matchedMoments.length === 0) {
    list.innerHTML = '<div class="search-hint">未检索到相关内容</div>';
    return;
  }

  let html = '';
  matchedArticles.forEach(a => {
    html += `
      <div class="search-result-item" data-type="article" data-id="${a.id}">
        <div class="sr-title">${escapeHtml(a.title)}</div>
        <div class="sr-meta">
          <span>文墨 · ${a.category || ''}</span>
          <span>${a.date || ''}</span>
        </div>
      </div>
    `;
  });

  matchedMoments.forEach(m => {
    html += `
      <div class="search-result-item" data-type="moment" data-id="${m.id}">
        <div class="sr-title">${escapeHtml(m.content.slice(0, 60))}...</div>
        <div class="sr-meta">
          <span>微语 · #${m.tag || '随想'}</span>
          <span>${formatRelativeTime(m.time)}</span>
        </div>
      </div>
    `;
  });

  list.innerHTML = html;

  list.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const type = item.getAttribute('data-type');
      const id = item.getAttribute('data-id');
      closeSearchModal();
      if (type === 'article') {
        const art = articles.find(a => a.id === id);
        if (art) openReader(art);
      } else {
        const el = document.getElementById('moments');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

// --------------------------------------------------------------------------
// 5. Admin Studio Logic
// --------------------------------------------------------------------------
async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();
    isAuthenticated = !!data.authenticated;
    updateAdminUI();
  } catch (e) {
    isAuthenticated = false;
  }
}

function updateAdminUI() {
  const dot = document.getElementById('admin-badge-indicator');
  const loginView = document.getElementById('admin-login-view');
  const workView = document.getElementById('admin-work-view');

  if (dot) dot.style.display = isAuthenticated ? 'block' : 'none';

  if (isAuthenticated) {
    if (loginView) loginView.style.display = 'none';
    if (workView) workView.style.display = 'block';
    updateStudioArticlesList();
      updateTimelineStats();
    updateStudioMomentsList();
      updateTimelineStats();
    updateStudioMessagesList();
      updateTimelineStats();
    loadConfigIntoSettingsForm();
  } else {
    if (loginView) loginView.style.display = 'block';
    if (workView) workView.style.display = 'none';
  }
}

function openAdminModal() {
  const modal = document.getElementById('admin-modal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  updateAdminUI();
}

function closeAdminModal() {
  const modal = document.getElementById('admin-modal');
  modal.style.display = 'none';
  document.body.style.overflow = '';
}

// Admin Login Form
document.getElementById('admin-login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pwdInput = document.getElementById('admin-pwd-input');
  const errEl = document.getElementById('login-error-msg');
  const pwd = pwdInput.value;
  errEl.textContent = '';

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    });
    const data = await res.json();
    if (data.ok) {
      isAuthenticated = true;
      if (data.token) {
        localStorage.setItem('atelier_admin_token', data.token);
      }
      pwdInput.value = '';
      updateAdminUI();
      showToast('已进入 Sxltx 工坊控制台');
    } else {
      errEl.textContent = data.error || '管理密钥错误';
    }
  } catch (err) {
    errEl.textContent = '网络请求失败，请稍后重试';
  }
});

// Admin Logout
document.getElementById('btn-admin-logout')?.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  isAuthenticated = false;
  updateAdminUI();
  showToast('已退出管理后台');
});

// Studio Tab Switching
document.querySelectorAll('.studio-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.studio-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.studio-pane').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const paneId = tab.getAttribute('data-pane');
    const pane = document.getElementById(paneId);
    if (pane) pane.classList.add('active');
  });
});

// Word count tracking in editor
const contentInput = document.getElementById('edit-art-content');
contentInput?.addEventListener('input', () => {
  const count = contentInput.value.length;
  const counter = document.getElementById('editor-word-count');
  if (counter) counter.textContent = `字数: ${count}`;
});

// Save Article (Create or Update)
document.getElementById('form-article-editor')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('edit-art-id').value;
  const title = document.getElementById('edit-art-title').value.trim();
  const category = document.getElementById('edit-art-category').value;
  const readTime = document.getElementById('edit-art-readtime').value.trim();
  const summary = document.getElementById('edit-art-summary').value.trim();
  const content = document.getElementById('edit-art-content').value;

  const payload = { title, category, readTime, summary, content };
  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/articles/${id}` : '/api/articles';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok) {
      showToast(id ? '文墨修改已保存' : '新文墨已发布');
      resetArticleForm();
      fetchArticles();
      // Switch to articles list tab
      document.querySelector('.studio-tab[data-pane="pane-manage-articles"]')?.click();
    } else {
      showToast(data.error || '保存失败');
    }
  } catch (err) {
    showToast('网络请求异常');
  }
});

function resetArticleForm() {
  document.getElementById('edit-art-id').value = '';
  document.getElementById('edit-art-title').value = '';
  setSegmentedCategory('技术');
  document.getElementById('edit-art-readtime').value = '3 分钟';
  document.getElementById('edit-art-summary').value = '';
  document.getElementById('edit-art-content').value = '';
  document.getElementById('editor-word-count').textContent = '字数: 0';
  document.getElementById('btn-save-art-text').textContent = '即刻发布文墨';
}

document.getElementById('btn-reset-art-form')?.addEventListener('click', resetArticleForm);

// Update Studio Article List
function updateStudioArticlesList() {
  const countEl = document.getElementById('studio-art-count');
  if (countEl) countEl.textContent = articles.length;

  const mbArt = document.getElementById('mb-art-count');
  if (mbArt) mbArt.textContent = articles.length;

  const list = document.getElementById('studio-art-list');
  if (!list) return;

  if (articles.length === 0) {
    list.innerHTML = '<div class="loading-skeleton">暂无文墨</div>';
    return;
  }

  list.innerHTML = articles.map(art => {
    const catCls = getCatClass(art.category);
    return `
      <div class="studio-article-row">
        <span class="cat-badge ${catCls}">${escapeHtml(art.category || '随笔')}</span>
        <span class="sir-title-stream" title="${escapeHtml(art.title)}">${escapeHtml(art.title)}</span>
        <div class="sir-time-group">
          <span class="sir-time-rel">${formatRelativeTime(art.date)}</span>
          <span class="sir-time-abs">(${escapeHtml(art.date || '')})</span>
        </div>
        <div class="studio-item-actions" style="display:flex;gap:0.35rem;">
          <button class="action-btn-sm edit-art-btn" data-id="${art.id}">编辑</button>
          <button class="action-btn-sm delete delete-art-btn" data-id="${art.id}">删除</button>
        </div>
      </div>
    `;
  }).join('');

  // Bind edit & delete
  list.querySelectorAll('.edit-art-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const art = articles.find(a => a.id === btn.getAttribute('data-id'));
      if (art) {
        document.getElementById('edit-art-id').value = art.id;
        document.getElementById('edit-art-title').value = art.title;
        setSegmentedCategory(art.category || '技术');
        document.getElementById('edit-art-readtime').value = art.readTime || '3 分钟';
        document.getElementById('edit-art-summary').value = art.summary || '';
        document.getElementById('edit-art-content').value = art.content || '';
        document.getElementById('editor-word-count').textContent = `字数: ${(art.content || '').length}`;
        document.getElementById('btn-save-art-text').textContent = '更新文墨';
        document.querySelector('.studio-tab[data-pane="pane-write-article"]')?.click();
      }
    });
  });

  list.querySelectorAll('.delete-art-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('确认删除此篇文墨吗？此操作不可逆。')) return;
      const id = btn.getAttribute('data-id');
      try {
        const res = await fetch(`/api/articles/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.ok) {
          showToast('文墨已删除');
          fetchArticles();
        }
      } catch (e) {
        showToast('删除失败');
      }
    });
  });
}

// Moment Form Submit
document.getElementById('form-moment-editor')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const content = document.getElementById('edit-mom-content').value.trim();
  const tag = document.getElementById('edit-mom-tag').value.trim();

  try {
    const res = await fetch('/api/moments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, tag })
    });
    const data = await res.json();
    if (data.ok) {
      showToast('灵感微语已发布');
      document.getElementById('edit-mom-content').value = '';
      fetchMoments();
      document.querySelector('.studio-tab[data-pane="pane-manage-moments"]')?.click();
    }
  } catch (err) {
    showToast('发布异常');
  }
});

// Update Studio Moments List
function updateStudioMomentsList() {
  const mbMom = document.getElementById('mb-mom-count');
  if (mbMom) mbMom.textContent = moments.length;
  const list = document.getElementById('studio-mom-list');
  if (!list) return;

  if (moments.length === 0) {
    list.innerHTML = '<div class="loading-skeleton">暂无闪念</div>';
    return;
  }

  list.innerHTML = moments.map(m => `
    <div class="studio-item-row">
      <div class="studio-item-left">
        <span class="sir-title">${escapeHtml(m.content)}</span>
        <span class="sir-meta">#${m.tag} · ${formatRelativeTime(m.time)}</span>
      </div>
      <div class="studio-item-actions">
        <button class="action-btn-sm delete delete-mom-btn" data-id="${m.id}">删除</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.delete-mom-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('确认删除此条微语？')) return;
      const id = btn.getAttribute('data-id');
      await fetch(`/api/moments/${id}`, { method: 'DELETE' });
      showToast('微语已删除');
      fetchMoments();
    });
  });
}

// Update Studio Messages List
function updateStudioMessagesList() {
  const mbMsg = document.getElementById('mb-msg-count');
  if (mbMsg) mbMsg.textContent = messages.length;
  const list = document.getElementById('studio-msg-list');
  if (!list) return;

  if (!messages || messages.length === 0) {
    list.innerHTML = '<div class="loading-skeleton" style="padding:1.5rem;text-align:center;color:var(--text-muted);">暂无留言记录</div>';
    return;
  }

  list.innerHTML = messages.map(msg => `
    <div class="studio-msg-card" id="studio-msg-row-${escapeHtml(msg.id)}">
      <div class="studio-msg-header-row">
        <div class="studio-item-left" style="flex:1;">
          <span class="sir-title" style="font-weight:600;display:block;margin-bottom:0.35rem;font-size:0.95rem;color:var(--text-title);line-height:1.5;">${escapeHtml(msg.content)}</span>
          <span class="sir-meta" style="font-size:0.8rem;color:var(--text-muted);display:block;margin-bottom:0.35rem;">
            署名: <strong>${escapeHtml(msg.author || '墨友')}</strong> · ${formatRelativeTime(msg.time)}
          </span>
        </div>
        <div class="studio-item-actions" style="display:flex;gap:0.4rem;align-items:center;flex-shrink:0;">
          <button class="action-btn-sm toggle-reply-btn" data-id="${escapeHtml(msg.id)}" style="background:var(--bg-subtle);border:1px solid var(--border-line);color:var(--text-title);padding:0.25rem 0.65rem;border-radius:4px;cursor:pointer;font-size:0.8rem;">
            ${msg.echo ? '编辑回信' : '回复留墨'}
          </button>
          <button class="action-btn-sm delete delete-msg-btn" data-id="${escapeHtml(msg.id)}" style="background:#fee2e2;border:1px solid #fca5a5;color:#b91c1c;padding:0.25rem 0.65rem;border-radius:4px;cursor:pointer;font-size:0.8rem;" title="从工坊永久删除此条留言">
            删除
          </button>
        </div>
      </div>

      <!-- Current Reply Status (Full width bar under message) -->
      <div id="reply-preview-${escapeHtml(msg.id)}" class="studio-echo-wrap">
        ${msg.echo ? `
          <div class="sir-echo-preview">
            <strong>✦ 工坊回笔：</strong><span>${escapeHtml(msg.echo.content)}</span>
          </div>
        ` : `
          <div class="sir-echo-preview empty">（暂无主理人回笔）</div>
        `}
      </div>

      <!-- Inline Reply Form (Hidden by default, toggled on click) -->
      <div id="reply-form-${escapeHtml(msg.id)}" class="inline-reply-box" style="display:none;">
        <div class="inline-reply-inputs">
          <input type="text" id="reply-input-${escapeHtml(msg.id)}" value="${escapeHtml(msg.echo ? msg.echo.content : '')}" placeholder="以主理人身份写下工坊回笔..." maxlength="300" />
          <button class="paper-btn btn-primary submit-reply-btn" data-id="${escapeHtml(msg.id)}" style="padding:0.45rem 0.85rem;font-size:0.82rem;white-space:nowrap;">
            保存回信
          </button>
          <button class="paper-btn cancel-reply-btn" data-id="${escapeHtml(msg.id)}" style="padding:0.45rem 0.65rem;font-size:0.82rem;white-space:nowrap;background:var(--bg-subtle);">
            取消
          </button>
        </div>
      </div>
    </div>
  `).join('');

  // 1. Delete Message Handler
  list.querySelectorAll('.delete-msg-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      if (!confirm('确定彻底清除此条留言吗？')) return;

      // Optimistic removal: remove immediately from DOM & memory
      messages = messages.filter(m => m.id !== id);
      localStorage.setItem('atelier_messages', JSON.stringify(messages));
      const row = document.getElementById(`studio-msg-row-${id}`);
      if (row) row.remove();
      renderMessages();
      updateTimelineStats();

      try {
        const token = localStorage.getItem('atelier_admin_token') || '';
        const headers = { 'Cache-Control': 'no-cache' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/messages/${id}?t=${Date.now()}`, {
          method: 'DELETE',
          headers: headers
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          showToast('✓ 留言已彻底删除');
        } else {
          showToast(data.error || '✓ 留言已清除');
        }
      } catch (err) {
        showToast('✓ 留言已清除');
      }

      await fetchMessages();
    });
  });

  // 2. Toggle Reply Form Handler
  list.querySelectorAll('.toggle-reply-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const form = document.getElementById(`reply-form-${id}`);
      if (form) {
        const isHidden = form.style.display === 'none';
        form.style.display = isHidden ? 'block' : 'none';
        if (isHidden) {
          const input = document.getElementById(`reply-input-${id}`);
          if (input) input.focus();
        }
      }
    });
  });

  // 3. Cancel Reply Form Handler
  list.querySelectorAll('.cancel-reply-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const form = document.getElementById(`reply-form-${id}`);
      if (form) form.style.display = 'none';
    });
  });

  // 4. Submit Reply Handler
  list.querySelectorAll('.submit-reply-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-id');
      const input = document.getElementById(`reply-input-${id}`);
      const replyContent = input ? input.value.trim() : '';

      try {
        const token = localStorage.getItem('atelier_admin_token') || '';
        const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        btn.disabled = true;
        btn.textContent = '保存中...';

        const res = await fetch(`/api/messages/${id}/reply?t=${Date.now()}`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ content: replyContent })
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.ok) {
          // Update memory & localStorage
          const targetMsg = messages.find(m => m.id === id);
          if (targetMsg) {
            if (replyContent) {
              targetMsg.echo = {
                author: '工坊回笔',
                content: replyContent,
                time: new Date().toISOString()
              };
            } else {
              delete targetMsg.echo;
            }
            localStorage.setItem('atelier_messages', JSON.stringify(messages));
          }
          showToast('✓ 工坊回笔已送达读者');
          updateStudioMessagesList();
          renderMessages();
        } else {
          showToast(data.error || '保存失败，请重试');
          btn.disabled = false;
          btn.textContent = '保存回信';
        }
      } catch (err) {
        showToast('网络异常，请重试');
        btn.disabled = false;
        btn.textContent = '保存回信';
      }
    });
  });
}


function loadConfigIntoSettingsForm() {
  const cfg = siteConfig || {};
  const titleInput = document.getElementById('cfg-site-title');
  const bioInput = document.getElementById('cfg-site-bio');
  const stampInput = document.getElementById('cfg-stamp-text');
  const glmKeyInput = document.getElementById('cfg-glm-key');

  if (titleInput) titleInput.value = cfg.siteTitle || '';
  if (bioInput) bioInput.value = cfg.bio || '';
  if (stampInput) stampInput.value = cfg.stampText || '纸境\nATELIER';
  if (glmKeyInput) {
    if (cfg.hasGlmKey) {
      glmKeyInput.placeholder = `已激活智谱 GLM 大模型（密钥仅存于服务端）`;
    } else {
      glmKeyInput.placeholder = '粘贴 API Key（未填则使用本地高情商意图引擎）';
    }
  }
}

// Save Config Form
document.getElementById('form-site-config')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const siteTitle = document.getElementById('cfg-site-title').value.trim();
  const bio = document.getElementById('cfg-site-bio').value.trim();
  const stampText = document.getElementById('cfg-stamp-text').value.trim();
  const glmKeyInput = document.getElementById('cfg-glm-key');
  const glmApiKey = glmKeyInput ? glmKeyInput.value.trim() : undefined;

  const payload = { siteTitle, bio, stampText };
  if (glmApiKey) payload.glmApiKey = glmApiKey;

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.ok) {
      showToast('工坊资料与 AI 设置已更新');
      siteConfig = data.config;
      applyConfig(siteConfig);
      if (glmKeyInput && glmApiKey) {
        glmKeyInput.value = '';
        glmKeyInput.placeholder = '已成功激活智谱 GLM 大模型回笔 ✦';
      }
    }
  } catch (e) {
    showToast('更新失败');
  }
});

// Change Password Form
document.getElementById('form-change-pwd')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const newPwd = document.getElementById('cfg-new-pwd').value;
  const msgEl = document.getElementById('pwd-change-msg');
  msgEl.textContent = '';

  try {
    const res = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword: newPwd })
    });
    const data = await res.json();
    if (data.ok) {
      msgEl.textContent = '管理口令已成功更新！请妥善保存。';
      document.getElementById('cfg-new-pwd').value = '';
      showToast('管理口令修改成功');
    } else {
      msgEl.textContent = data.error || '修改失败';
    }
  } catch (e) {
    msgEl.textContent = '请求异常';
  }
});

// --------------------------------------------------------------------------
// 6. Guestbook Submission & Live Character Counter (Artalk Inspired)
// --------------------------------------------------------------------------
const msgContentInput = document.getElementById('msg-content');
const charCountEl = document.getElementById('msg-char-count');
if (msgContentInput && charCountEl) {
  msgContentInput.addEventListener('input', () => {
    const len = msgContentInput.value.length;
    charCountEl.textContent = `${len} / 300`;
    if (len >= 150) {
      charCountEl.classList.add('visible');
    } else {
      charCountEl.classList.remove('visible');
    }
    if (len > 280) {
      charCountEl.style.color = '#b83b3b';
      charCountEl.style.fontWeight = 'bold';
    } else {
      charCountEl.style.color = 'var(--text-faint)';
      charCountEl.style.fontWeight = 'normal';
    }
  });
}

let isMsgSubmitting = false;
document.getElementById('guestbook-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (isMsgSubmitting) return;
  const authorInput = document.getElementById('msg-author');
  const contentInput = document.getElementById('msg-content');
  const btnSubmit = document.getElementById('btn-submit-msg');
  const author = authorInput.value.trim();
  const content = contentInput.value.trim();

  if (!content) return;
  isMsgSubmitting = true;

  const originalBtnHtml = btnSubmit ? btnSubmit.innerHTML : '';
  if (btnSubmit) {
    btnSubmit.classList.add('submitting');
    btnSubmit.innerHTML = '<span>落笔中…</span><svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';
  }

  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, content })
    });
    const data = await res.json();
    if (data.ok) {
      showToast('留墨已刻录，感谢您的思辨');
      contentInput.value = '';
      if (charCountEl) {
        charCountEl.textContent = '0 / 300';
        charCountEl.style.color = 'var(--text-muted)';
        charCountEl.style.fontWeight = 'normal';
      }
      fetchMessages();
    }
  } catch (e) {
    showToast('留墨提交失败，请重试');
  }
});

// --------------------------------------------------------------------------
// 7. Event Listeners & Keyboard Shortcuts
// --------------------------------------------------------------------------

// Ludi Video 10 Detail 1: Chinese Composition Event Protection (打中文不误发)
function attachCompositionGuard(inputEl, onEnterCallback) {
  if (!inputEl) return;
  let isComposing = false;
  inputEl.addEventListener('compositionstart', () => { isComposing = true; });
  inputEl.addEventListener('compositionend', () => { isComposing = false; });
  inputEl.addEventListener('keydown', (e) => {
    if (isComposing || e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && onEnterCallback) {
      onEnterCallback(e);
    }
  });
}

window.addEventListener('DOMContentLoaded', () => {
  initSegmentedControl();
  initData();
  initChronoAtmosphere();

  // =========================================================================
  // 智境 2.0 体验增强：返回顶部微按钮、全站键盘快捷键、留言快捷提交
  // =========================================================================
  
  // 1. 返回顶部微按钮 (Back to top)
  const btnBackToTop = document.getElementById('btn-back-to-top');
  if (btnBackToTop) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 380) {
        btnBackToTop.classList.add('visible');
      } else {
        btnBackToTop.classList.remove('visible');
      }
    }, { passive: true });

    btnBackToTop.onclick = () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  }

  // 2. 全站快捷键 (Esc关闭弹窗, / 或 Ctrl+K 全局搜索, Ctrl+Enter留言提交)
  window.addEventListener('keydown', (e) => {
    // Esc: 关闭所有活动弹窗
    if (e.key === 'Escape') {
      const readerOverlay = document.getElementById('reader-overlay');
      if (readerOverlay && readerOverlay.style.display !== 'none') {
        closeReader();
        return;
      }
      const searchModal = document.getElementById('search-modal');
      if (searchModal && searchModal.style.display !== 'none') {
        closeSearchModal();
        return;
      }
      const adminModal = document.getElementById('admin-modal');
      if (adminModal && adminModal.style.display !== 'none') {
        closeAdminModal();
        return;
      }
    }

    // 搜索快捷键 / 或 Ctrl+K (当不在输入框时)
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA');
    if (!isTyping && (e.key === '/' || (e.ctrlKey && e.key.toLowerCase() === 'k'))) {
      e.preventDefault();
      openSearchModal();
    }

    // Ctrl + Enter 快捷发送留言
    if (e.ctrlKey && e.key === 'Enter') {
      const msgInput = document.getElementById('msg-content');
      if (document.activeElement === msgInput) {
        const form = document.getElementById('guestbook-form');
        if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    }
  });

  updateTimelineStats();

  // Category filter tabs
  document.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentCategory = tab.getAttribute('data-cat');
      renderArticles();
    });
  });

  // Reading Progress bar on scroll
  window.addEventListener('scroll', () => {
    const total = document.documentElement.scrollHeight - window.innerHeight;
    const progress = total > 0 ? (window.scrollY / total) * 100 : 0;
    const line = document.getElementById('read-progress');
    if (line) line.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  });

  // Search Button & Input
  document.getElementById('btn-search-trigger')?.addEventListener('click', openSearchModal);
  document.getElementById('btn-close-search')?.addEventListener('click', closeSearchModal);
  document.getElementById('search-query-input')?.addEventListener('input', (e) => {
    runSearch(e.target.value);
  });

  // Admin Studio Trigger
  document.getElementById('btn-admin-trigger')?.addEventListener('click', openAdminModal);
  document.getElementById('footer-admin-link')?.addEventListener('click', openAdminModal);
  document.getElementById('btn-close-admin')?.addEventListener('click', closeAdminModal);

  // Close Reader
  document.getElementById('btn-close-reader')?.addEventListener('click', closeReader);

  // Keyboard Shortcuts: '/' to search, 'Esc' to close, 'Ctrl+Shift+A' for admin
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeSearchModal();
      closeReader();
      closeAdminModal();
    }
    // Search hotkey: '/' when not typing in an input
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
      e.preventDefault();
      openSearchModal();
    }
    // Spotlight Cmd+K / Ctrl+K
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      openSearchModal();
    }
    // Admin hotkey: Ctrl+Shift+A
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
      e.preventDefault();
      openAdminModal();
    }
  });

  // Close modals on clicking overlay background
  document.getElementById('search-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'search-modal') closeSearchModal();
  });
  document.getElementById('reader-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'reader-overlay') closeReader();
  });
  document.getElementById('admin-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'admin-modal') closeAdminModal();
  });
});


// --------------------------------------------------------------------------
// Ambient Chrono-Temporal Atmosphere Engine
// --------------------------------------------------------------------------
function initChronoAtmosphere() {
  const pill = document.querySelector('.hero-status-pill');
  if (!pill) return;
  const textEl = pill.querySelector('.pill-text');
  if (!textEl) return;

  const now = new Date();
  const hour = now.getHours();
  
  const hoursMap = [
    { name: "子时", range: [23, 1], mood: "夜静水深 · 纸境墨香" },
    { name: "丑时", range: [1, 3], mood: "万籁俱寂 · 灵感微光" },
    { name: "寅时", range: [3, 5], mood: "残月未落 · 晨曦微露" },
    { name: "卯时", range: [5, 7], mood: "朝阳初升 · 晨光入阁" },
    { name: "辰时", range: [7, 9], mood: "晴明初染 · 始启造物" },
    { name: "巳时", range: [9, 11], mood: "清风徐来 · 笔耕不辍" },
    { name: "午时", range: [11, 13], mood: "日悬中天 · 墨色沉酣" },
    { name: "未时", range: [13, 15], mood: "微云过隙 · 且听书声" },
    { name: "申时", range: [15, 17], mood: "斜阳穿窗 · 静水深流" },
    { name: "酉时", range: [17, 19], mood: "晚霞入室 · 收心归阁" },
    { name: "戌时", range: [19, 21], mood: "华灯初上 · 静默思辨" },
    { name: "亥时", range: [21, 23], mood: "夜色渐深 · 纸暖砚润" }
  ];

  let currentChrono = hoursMap.find(h => {
    if (h.range[0] > h.range[1]) {
      return hour >= h.range[0] || hour < h.range[1];
    }
    return hour >= h.range[0] && hour < h.range[1];
  }) || hoursMap[8];

  const month = now.getMonth() + 1;
  let season = "暮秋迎冬";
  if (month >= 3 && month <= 5) season = "草木蔓发 · 阳春";
  else if (month >= 6 && month <= 8) season = "蝉鸣入夏 · 朱明";
  else if (month >= 9 && month <= 10) season = "秋水澄澈 · 白藏";
  else season = "暮秋迎冬 · 玄英";

  textEl.innerHTML = `<span class="chrono-time-badge">${currentChrono.name}</span> ${season} · ${currentChrono.mood}`;

  pill.title = "点击感应天时气象与工坊心跳";
  pill.onclick = () => {
    showToast(`天时：${season}（${currentChrono.name}）· 双轨边缘高防运行中`);
  };
}

// ==========================================================================
// 纸境工坊极致升华子系统 (Atelier Master Engines)
// ==========================================================================

// 1. 三重纸境心境主题系统 (Tri-Atmosphere Themes)
const THEMES = ['paper', 'dark', 'sepia'];
const THEME_NAMES = {
  paper: '竹尾素纸',
  dark: '深墨夜砚',
  sepia: '古籍茶褐'
};

function initTheme() {
  const saved = localStorage.getItem('sxtx-atelier-theme');
  if (saved) {
    setTheme(saved, false);
  } else {
    // 自然时辰感知：戌时至卯时初(20:00~06:00)或系统暗色偏好，自动开启玄青夜读模式
    const hour = new Date().getHours();
    const isNight = hour >= 20 || hour < 6;
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (isNight || prefersDark) {
      setTheme('dark', false);
    } else {
      setTheme('paper', false);
    }
  }

  const toggleBtn = document.getElementById('btn-theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => cycleTheme());
  }
}

function setTheme(theme, notify = true) {
  if (!THEMES.includes(theme)) theme = 'paper';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('sxtx-atelier-theme', theme);

  const metaColor = document.querySelector('meta[name="theme-color"]');
  if (metaColor) {
    if (theme === 'dark') metaColor.content = '#131416';
    else if (theme === 'sepia') metaColor.content = '#f4ede1';
    else metaColor.content = '#fcfbf9';
  }

  const toggleBtn = document.getElementById('btn-theme-toggle');
  if (toggleBtn) {
    const icon = toggleBtn.querySelector('.svg-theme-icon');
    if (icon) {
      if (theme === 'dark') {
        icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>`;
      } else if (theme === 'sepia') {
        icon.innerHTML = `<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>`;
      } else {
        icon.innerHTML = `<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>`;
      }
    }
  }

  if (notify) {
    showToast(`心境切换至 · ${THEME_NAMES[theme]}`);
  }
}

function cycleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'paper';
  const idx = THEMES.indexOf(current);
  const next = THEMES[(idx + 1) % THEMES.length];
  setTheme(next, true);
}

// 2. 墨句摘录浮标与高清卡片引擎
// 2. 墨句摘录浮标与高清卡片引擎
let activeQuoteArticle = null;
let currentSelectedQuote = '';

function openQuoteModal(title, text, sourceTitle) {
  const modal = document.getElementById('quote-modal-overlay');
  const quoteTextEl = document.getElementById('quote-card-text');
  const quoteSourceEl = document.getElementById('quote-card-source');
  const quoteDateEl = document.getElementById('quote-card-date');
  if (!modal || !quoteTextEl) return;

  currentSelectedQuote = text || title || '';
  quoteTextEl.textContent = currentSelectedQuote;

  const displaySource = sourceTitle || title || (activeQuoteArticle ? activeQuoteArticle.title : 'Sxltx · 纸境工坊');
  if (quoteSourceEl) {
    quoteSourceEl.textContent = displaySource;
  }
  if (quoteDateEl) {
    const now = new Date();
    quoteDateEl.textContent = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  modal.setAttribute('aria-hidden', 'false');
  modal.style.display = 'flex';
}
window.openQuoteModal = openQuoteModal;

function initQuoteSystem() {
  const pill = document.getElementById('selection-quote-pill');
  const modal = document.getElementById('quote-modal-overlay');
  const closeBtn = document.getElementById('btn-close-quote-modal');
  const copyBtn = document.getElementById('btn-copy-quote-text');
  const downloadBtn = document.getElementById('btn-download-quote-card');
  const quoteTextEl = document.getElementById('quote-card-text');
  const quoteSourceEl = document.getElementById('quote-card-source');
  const quoteDateEl = document.getElementById('quote-card-date');

  const handleSelection = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      if (pill) pill.style.display = 'none';
      return;
    }
    const text = sel.toString().trim();
    if (text.length < 4 || text.length > 280) {
      if (pill) pill.style.display = 'none';
      return;
    }

    currentSelectedQuote = text;
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    if (pill) {
      pill.style.display = 'inline-flex';
      pill.style.left = `${rect.left + rect.width / 2}px`;
      pill.style.top = `${rect.top + window.scrollY}px`;
    }
  };

  document.addEventListener('mouseup', handleSelection);
  document.addEventListener('touchend', () => setTimeout(handleSelection, 200));

  if (pill) {
    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      pill.style.display = 'none';
      if (!currentSelectedQuote) return;

      openQuoteModal(
        activeQuoteArticle ? activeQuoteArticle.title : '沉思墨句',
        currentSelectedQuote,
        activeQuoteArticle ? activeQuoteArticle.title : 'Sxltx · 纸境工坊'
      );
    });
  }

  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    };
  }
  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
      }
    };
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  });

  if (copyBtn) {
    copyBtn.onclick = () => {
      const sourceName = quoteSourceEl ? quoteSourceEl.textContent : 'Sxltx · 纸境工坊';
      const formatted = `「${currentSelectedQuote}」\n—— Sxltx《${sourceName}》\n来源：${window.location.origin || "https://" + (window.location.host || "blog.hlat.xyz")}`;
      navigator.clipboard.writeText(formatted).then(() => {
        showToast('已复制墨句文辞到剪贴板 ✦');
        modal.style.display = 'none';
        modal.setAttribute('aria-hidden', 'true');
      });
    };
  }

  if (downloadBtn) {
    downloadBtn.onclick = () => {
      const canvas = document.getElementById('quote-canvas');
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      const w = 1200;

      // 预先分行测算排版高度
      const maxTextWidth = w - 180;
      const textToWrap = `“${currentSelectedQuote}”`;

      // 动态根据字数选择合适字号与行距
      let fontSize = 34;
      let lineHeight = 54;
      if (textToWrap.length > 180) {
        fontSize = 28;
        lineHeight = 46;
      } else if (textToWrap.length > 300) {
        fontSize = 24;
        lineHeight = 40;
      }

      ctx.font = `italic ${fontSize}px "Lora", "Noto Serif SC", "Songti SC", serif`;
      const lines = [];
      let currentLine = '';
      for (let n = 0; n < textToWrap.length; n++) {
        const testLine = currentLine + textToWrap[n];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxTextWidth && n > 0) {
          lines.push(currentLine);
          currentLine = textToWrap[n];
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) lines.push(currentLine);

      // 计算自适应高度
      const topPadding = 200;
      const bottomPadding = 220;
      const textBlockHeight = lines.length * lineHeight;
      const h = Math.max(760, topPadding + textBlockHeight + bottomPadding);
      canvas.width = w;
      canvas.height = h;

      // 宣纸竹韵背景
      ctx.fillStyle = '#fcfbf9';
      ctx.fillRect(0, 0, w, h);

      // 宣纸双重边框
      ctx.strokeStyle = '#e1ddd4';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 40, w - 80, h - 80);

      ctx.strokeStyle = '#eae6df';
      ctx.lineWidth = 1;
      ctx.strokeRect(48, 48, w - 96, h - 96);

      // 顶部品牌抬头
      ctx.fillStyle = '#71717a';
      ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('SXLTX · 纸境工坊 · 沉思摘录', 80, 100);

      // 顶部日期
      const now = new Date();
      const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
      ctx.textAlign = 'right';
      ctx.font = '500 22px "JetBrains Mono", monospace';
      ctx.fillText(dateStr, w - 80, 100);

      // 顶部虚线
      ctx.beginPath();
      ctx.setLineDash([8, 6]);
      ctx.moveTo(80, 125);
      ctx.lineTo(w - 80, 125);
      ctx.strokeStyle = '#e1ddd4';
      ctx.stroke();
      ctx.setLineDash([]);

      // 正文内容
      ctx.textAlign = 'left';
      ctx.fillStyle = '#18181b';
      ctx.font = `italic ${fontSize}px "Lora", "Noto Serif SC", "Songti SC", serif`;
      let y = topPadding;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 80, y);
        y += lineHeight;
      }

      // 底部虚线
      ctx.beginPath();
      ctx.setLineDash([8, 6]);
      ctx.moveTo(80, h - 160);
      ctx.lineTo(w - 80, h - 160);
      ctx.strokeStyle = '#e1ddd4';
      ctx.stroke();
      ctx.setLineDash([]);

      // 底部出处与元数据
      const sourceTitle = (quoteSourceEl ? quoteSourceEl.textContent : '') || (activeQuoteArticle ? activeQuoteArticle.title : '随笔沉思');
      ctx.fillStyle = '#18181b';
      ctx.font = '600 24px "Plus Jakarta Sans", "Noto Serif SC", sans-serif';
      ctx.fillText(`出处：《${sourceTitle}》`, 80, h - 110);

      ctx.fillStyle = '#71717a';
      ctx.font = '500 20px "JetBrains Mono", monospace';
      ctx.fillText('hlat.top · 人机共生思想自留地', 80, h - 80);

      // 朱砂印章（纸境工坊）
      const sealX = w - 170, sealY = h - 145, sealW = 90, sealH = 90;
      ctx.save();
      ctx.translate(sealX + sealW / 2, sealY + sealH / 2);
      ctx.rotate(-0.05);
      ctx.strokeStyle = '#b91c1c';
      ctx.lineWidth = 3.5;
      ctx.strokeRect(-sealW / 2, -sealH / 2, sealW, sealH);
      ctx.fillStyle = 'rgba(185, 28, 28, 0.05)';
      ctx.fillRect(-sealW / 2, -sealH / 2, sealW, sealH);
      ctx.fillStyle = '#b91c1c';
      ctx.textAlign = 'center';
      ctx.font = '700 22px "Lora", serif';
      ctx.fillText('纸境', 0, -6);
      ctx.fillText('工坊', 0, 24);
      ctx.restore();

      const link = document.createElement('a');
      link.download = `sxtx-quote-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showToast('高清墨卡已生成并下载 ✦');
    };
  }
}

// 3. 留言板防刷与实时字数统计
function initGuestbookEnhancements() {
  const contentInput = document.getElementById('msg-content');
  const counterEl = document.getElementById('guestbook-counter');
  const hpInput = document.getElementById('input-honeypot');

  if (contentInput && counterEl) {
    contentInput.addEventListener('input', () => {
      const len = contentInput.value.length;
      counterEl.textContent = `${len} / 200 字`;
      counterEl.style.color = len > 190 ? '#b91c1c' : 'var(--text-muted)';
    });
  }

  // Topic Chips integration
  const chips = document.querySelectorAll('.topic-chip');
  if (contentInput && chips.length) {
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const prefix = chip.getAttribute('data-prefix') || '';
        let current = contentInput.value.trim();
        current = current.replace(/^【[^】]+】\s*/, '');
        contentInput.value = `${prefix} ${current}`.trim() + ' ';
        contentInput.focus();
        contentInput.dispatchEvent(new Event('input'));
      });
    });
  }

  const form = document.getElementById('guestbook-form');
  if (form && hpInput) {
    form.addEventListener('submit', (e) => {
      if (hpInput.value.trim() !== '') {
        e.preventDefault();
        e.stopImmediatePropagation();
        console.warn('Spambot intercepted.');
        return false;
      }
    }, true);
  }
}

// 4. 全局键盘导航增强与初始化

// Ludi Video 10 Detail 1: Chinese Composition Event Protection (打中文不误发)
function attachCompositionGuard(inputEl, onEnterCallback) {
  if (!inputEl) return;
  let isComposing = false;
  inputEl.addEventListener('compositionstart', () => { isComposing = true; });
  inputEl.addEventListener('compositionend', () => { isComposing = false; });
  inputEl.addEventListener('keydown', (e) => {
    if (isComposing || e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && onEnterCallback) {
      onEnterCallback(e);
    }
  });
}

function initScrollSpy() {
  const sections = document.querySelectorAll('section.content-section, section.hero-section');
  const navLinks = document.querySelectorAll('.nav-dock .nav-item');
  if (!navLinks.length || !sections.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.getAttribute('data-spy') || entry.target.getAttribute('id');
        if (!id) return;
        navLinks.forEach(link => {
          const href = link.getAttribute('href');
          if (href === `#${id}`) {
            link.classList.add('active');
          } else {
            link.classList.remove('active');
          }
        });
      }
    });
  }, { rootMargin: '-20% 0px -60% 0px' });

  sections.forEach(sec => observer.observe(sec));
}

window.addEventListener('DOMContentLoaded', () => {
  initSegmentedControl();
  initTheme();
  initQuoteSystem();
  initGuestbookEnhancements();
  initScrollSpy();

  window.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (activeTag === 'input' || activeTag === 'textarea') return;

    if (e.key === 't' || e.key === 'T') {
      cycleTheme();
    } else if (e.key === 'j' || e.key === 'J') {
      const reader = document.getElementById('reader-overlay');
      const scrollEl = (reader && reader.style.display !== 'none') ? document.getElementById('drawer-scroll-container') : window;
      scrollEl.scrollBy({ top: 320, behavior: 'smooth' });
    } else if (e.key === 'k' || e.key === 'K') {
      const reader = document.getElementById('reader-overlay');
      const scrollEl = (reader && reader.style.display !== 'none') ? document.getElementById('drawer-scroll-container') : window;
      scrollEl.scrollBy({ top: -320, behavior: 'smooth' });
    }
  });

  // Discreet Admin Studio Triggers
  document.getElementById('footer-admin-trigger')?.addEventListener('click', openAdminModal);

  // Keyboard shortcut: Alt + A or Ctrl + Shift + A to open admin
  document.addEventListener('keydown', (e) => {
    if ((e.altKey && (e.key === 'a' || e.key === 'A')) ||
        (e.ctrlKey && e.shiftKey && (e.key === 'a' || e.key === 'A'))) {
      e.preventDefault();
      openAdminModal();
    }
  });

  // URL Hash check: #admin
  if (window.location.hash === '#admin') {
    setTimeout(openAdminModal, 300);
  }
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#admin') openAdminModal();
  });

  // Aggressive Service Worker Unregister & Purge
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (let reg of regs) {
        reg.unregister();
      }
    }).catch(() => {});
  }
});

/* ==========================================================================
   v25 · 纸境精修引擎 (Atelier Refinement Engine)
   零依赖 · 不与既有 scrollspy / 快捷键 / 数据渲染耦合
   设计前提：内容默认可见，只有脚本完整就绪后才允许显影，任何异常都
   立即回退到「全部可见」，绝不因装饰性动效造成白屏。
   ========================================================================== */
(function initAtelierRefinement() {
  'use strict';

  function boot() {
    /* 1. 导航滚动态：rAF 节流，只切换一个 class，样式全在 style.css */
    const dock = document.querySelector('.nav-dock-container');
    if (dock) {
      let ticking = false;
      const syncDock = () => {
        dock.classList.toggle('is-scrolled', window.scrollY > 24);
        ticking = false;
      };
      window.addEventListener('scroll', () => {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(syncDock);
        }
      }, { passive: true });
      syncDock();
    }

    /* 2. 章节入场显影 */
    const prefersReduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced || !('IntersectionObserver' in window)) return;

    // 只取静态骨架节点；文章 / 闪念 / 留言由数据渲染，不参与显影以免闪烁
    const targets = document.querySelectorAll(
      '.section-header-flex, .artifact-card, .timeline-stats-bar, .page-footer'
    );
    if (!targets.length) return;

    const root = document.documentElement;
    try {
      root.classList.add('reveal-ready');
      targets.forEach(el => el.classList.add('reveal-pending'));

      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          el.classList.add('is-revealed');
          obs.unobserve(el);
          // 过渡结束即摘除标记，把 hover 过渡与合成层交还给原样式
          window.setTimeout(() => {
            el.classList.remove('reveal-pending', 'is-revealed');
          }, 560);
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });

      targets.forEach(el => observer.observe(el));

      // 后台标签页会节流 setTimeout：重新可见时立即摘除残留标记
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'visible') return;
        document.querySelectorAll('.reveal-pending.is-revealed').forEach(el => {
          el.classList.remove('reveal-pending', 'is-revealed');
        });
      });

      // 安全兜底：任何未进入视口的节点，8 秒后一律恢复常态
      window.setTimeout(() => {
        document.querySelectorAll('.reveal-pending').forEach(el => {
          el.classList.remove('reveal-pending', 'is-revealed');
        });
      }, 8000);
    } catch (err) {
      root.classList.remove('reveal-ready');
      targets.forEach(el => el.classList.remove('reveal-pending', 'is-revealed'));
      console.warn('Atelier refinement skipped:', err);
    }
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

/* ==========================================================================
   v26 · 留客引擎 (Atelier Retention Engine)
   让读过的留得下、让回来的人接得上、让陌生读者彼此照面。
   实现原则：只通过「包装既有全局函数 + 事件委托」接入，不改动既有逻辑；
   所有状态落在 localStorage 或新 API，异常一律静默降级，绝不影响阅读。
   ========================================================================== */
(function initAtelierRetention() {
  'use strict';

  const LS = {
    bookmarks: 'atelier_bookmarks_v26',
    readpos: 'atelier_readpos_v26',
    draft: 'atelier_guestbook_draft_v26',
    quotes: 'atelier_quotes_v26',
    resonated: 'atelier_resonated_v26'
  };
  const store = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v === null ? fb : JSON.parse(v); } catch (e) { return fb; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const BOOKMARK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"></path></svg>';
  const SECTION_IDS = ['essays', 'moments', 'timeline', 'guestbook', 'atlas'];
  const MOOD_HINT = { '静': '静 · 会心一阅', '思': '思 · 掩卷沉吟', '喜': '喜 · 相逢甚欢', '问': '问 · 愿闻其详' };
  const esc = (s) => escapeHtml(String(s == null ? '' : s));

  let bookmarkOnly = false;
  let currentMood = '静';
  let resonanceCounts = {};
  let cmdActions = [];
  let kbIndex = -1;

  function isTyping() {
    const el = document.activeElement;
    return !!el && (['INPUT', 'TEXTAREA', 'SELECT'].indexOf(el.tagName) !== -1 || el.isContentEditable);
  }
  function isOverlayOpen() {
    return ['atelier-sheet', 'search-modal', 'admin-modal', 'quote-modal-overlay'].some(id => {
      const el = document.getElementById(id);
      return el && el.style.display && el.style.display !== 'none';
    });
  }
  function getBookmarks() {
    const v = store.get(LS.bookmarks, []);
    return Array.isArray(v) ? v : [];
  }
  function copyText(txt) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(txt).catch(() => fallbackCopy(txt));
      }
    } catch (e) {}
    fallbackCopy(txt);
    return Promise.resolve();
  }
  function fallbackCopy(txt) {
    try {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e) {}
  }

  /* ── A4 稍后读纸签 ─────────────────────────────────────────────────── */
  function updateBookmarkUI() {
    const n = getBookmarks().length;
    const badge = document.getElementById('bookmark-count');
    const btn = document.getElementById('btn-bookmark-filter');
    if (badge) {
      badge.textContent = String(n);
      badge.classList.toggle('has-count', n > 0);
    }
    if (btn) {
      btn.classList.toggle('is-filtering', bookmarkOnly);
      btn.setAttribute('aria-pressed', bookmarkOnly ? 'true' : 'false');
      btn.title = bookmarkOnly ? '纸签 · 正在仅看收藏，点击恢复全部' : '稍后读纸签 · 仅看收藏 (快捷键 B)';
    }
  }
  function toggleBookmark(id) {
    if (!id) return;
    const marks = getBookmarks();
    const i = marks.indexOf(id);
    if (i === -1) { marks.push(id); showToast('已夹入纸签，下次回来接着读'); }
    else { marks.splice(i, 1); showToast('已从纸签中取出'); }
    store.set(LS.bookmarks, marks);
    $$('.paper-bookmark').forEach(b => {
      const on = marks.indexOf(b.dataset.bookmarkId) !== -1;
      b.classList.toggle('is-marked', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    if (bookmarkOnly) renderArticles();
    updateBookmarkUI();
  }
  function toggleBookmarkFilter() {
    bookmarkOnly = !bookmarkOnly;
    renderArticles();
    updateBookmarkUI();
    showToast(bookmarkOnly ? '仅看纸签收藏' : '已恢复全部文墨');
    const sec = document.getElementById('essays');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function makeBookmarkBtn(id) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'paper-bookmark';
    b.dataset.bookmarkId = id;
    b.setAttribute('aria-label', '加入稍后读纸签');
    b.setAttribute('aria-pressed', 'false');
    b.innerHTML = BOOKMARK_SVG;
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleBookmark(id);
    });
    return b;
  }

  /* ── A4 A5 文章行增强：纸签按钮 + 摘要预览 + 键盘可达 ──────────────── */
  function enhanceArticleRows() {
    const marks = getBookmarks();
    const featuredSlot = document.getElementById('featured-essay-slot');
    const container = document.getElementById('essays-list-container');
    const featured = featuredSlot ? $('.featured-essay-card', featuredSlot) : null;

    if (featured) {
      featured.tabIndex = 0;
      if (!$('.paper-bookmark', featured)) {
        const row = $('.featured-badge-row', featured) || featured;
        row.appendChild(makeBookmarkBtn(featured.dataset.id));
      }
    }
    $$('.paper-bookmark', featuredSlot || document).forEach(markButtonState);

    if (container) {
      $$('.essay-row-item', container).forEach(row => {
        const id = row.dataset.id;
        const art = articles.find(a => a.id === id);
        const meta = $('.essay-row-meta', row) || row;
        if (!$('.paper-bookmark', row)) meta.insertBefore(makeBookmarkBtn(id), meta.firstChild);
        const btn = $('.paper-bookmark', row);
        if (btn) markButtonState(btn);
        if (!$('.essay-peek', row)) {
          const peek = document.createElement('div');
          peek.className = 'essay-peek';
          peek.textContent = (art && art.summary) ? art.summary : '此篇暂无摘要，点开一阅。';
          row.appendChild(peek);
        }
        row.tabIndex = 0;
      });
    }

    $$('.bookmark-empty-note').forEach(el => el.remove());
    if (bookmarkOnly && container) {
      let visible = 0;
      $$('.essay-row-item', container).forEach(row => {
        const on = marks.indexOf(row.dataset.id) !== -1;
        row.style.display = on ? '' : 'none';
        if (on) visible++;
      });
      if (featured) {
        const on = marks.indexOf(featured.dataset.id) !== -1;
        featured.style.display = on ? '' : 'none';
        if (on) visible++;
      }
      if (!visible) {
        const note = document.createElement('div');
        note.className = 'bookmark-empty-note loading-skeleton';
        note.textContent = '纸签尚空 · 在文章标题旁点一枚书签即可收藏';
        container.appendChild(note);
      }
    } else {
      if (container) $$('.essay-row-item', container).forEach(r => { r.style.display = ''; });
      if (featured) featured.style.display = '';
    }
    updateBookmarkUI();
  }
  function markButtonState(b) {
    const on = getBookmarks().indexOf(b.dataset.bookmarkId) !== -1;
    b.classList.toggle('is-marked', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  /* ── A1 A9 素纸速查笺 / 墨句摘录簿 ─────────────────────────────────── */
  function openSheet(mode) {
    const overlay = document.getElementById('atelier-sheet');
    const body = document.getElementById('atelier-sheet-body');
    const title = document.getElementById('atelier-sheet-title');
    if (!overlay || !body) return;
    if (mode === 'quotes') {
      title.textContent = '墨句摘录簿';
      body.innerHTML = renderQuoteHistory();
      bindQuoteHistory();
    } else {
      title.textContent = '纸境速查';
      body.innerHTML = renderShortcuts();
    }
    overlay.style.display = 'flex';
    overlay.setAttribute('aria-hidden', 'false');
    const closeBtn = document.getElementById('btn-close-sheet');
    if (closeBtn) closeBtn.focus();
  }
  function closeSheet() {
    const overlay = document.getElementById('atelier-sheet');
    if (!overlay) return;
    overlay.style.display = 'none';
    overlay.setAttribute('aria-hidden', 'true');
  }
  function renderShortcuts() {
    const rows = [
      ['/  或  Ctrl+K', '唤出全站搜索'],
      ['>', '搜索框内进入命令台'],
      ['1 – 6', '直达六个章节'],
      ['B', '仅看稍后读纸签'],
      ['E', '聚焦文墨首篇'],
      ['↑  ↓  Enter', '在文墨 / 搜索结果间漫游'],
      ['T', '切换纸境心境'],
      ['J  /  K', '向下 / 向上翻阅'],
      ['Alt+A', '工坊主理人通道'],
      ['?', '展开这张速查笺'],
      ['Esc', '收起一切浮层']
    ];
    const q = (store.get(LS.quotes, []) || []).length;
    const m = getBookmarks().length;
    return '<div class="shortcut-grid">' + rows.map(r =>
      '<div class="shortcut-row"><span class="shortcut-key">' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></div>'
    ).join('') + '</div>' +
      '<p class="sheet-note">纸签 ' + m + ' 枚 · 摘录 ' + q + ' 句 · 均只存于此浏览器，不上传、不追踪。</p>' +
      '<button type="button" class="sheet-link" data-sheet-action="quotes">翻看墨句摘录簿</button>' +
      '<button type="button" class="sheet-link" data-sheet-action="bookmarks" style="margin-left:1.1rem;">仅看纸签收藏</button>';
  }
  function recordQuote(title, text, source) {
    if (!text) return;
    const list = store.get(LS.quotes, []) || [];
    if (list.some(q => q.text === text)) return;
    list.unshift({ text: String(text).slice(0, 280), title: title || '', source: source || '', time: new Date().toISOString() });
    if (list.length > 20) list.length = 20;
    store.set(LS.quotes, list);
  }
  function renderQuoteHistory() {
    const list = store.get(LS.quotes, []) || [];
    if (!list.length) return '<p class="sheet-note">摘录簿尚空。读文时选中一句，点浮出的「摘录」即可收进这里。</p>';
    return list.map((q, i) =>
      '<div class="quote-history-item"><div class="quote-history-text">「' + esc(q.text) + '」</div>' +
      '<div class="quote-history-meta"><span>' + esc(q.source || q.title || '纸境工坊') + ' · ' + esc(formatRelativeTime(q.time)) + '</span>' +
      '<span class="quote-history-actions"><button type="button" data-quote-act="copy" data-i="' + i + '">复制</button>' +
      '<button type="button" data-quote-act="card" data-i="' + i + '">出墨卡</button></span></div></div>'
    ).join('');
  }
  function bindQuoteHistory() {
    const body = document.getElementById('atelier-sheet-body');
    if (!body) return;
    body.querySelectorAll('[data-quote-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const list = store.get(LS.quotes, []) || [];
        const q = list[Number(btn.dataset.i)];
        if (!q) return;
        if (btn.dataset.quoteAct === 'copy') {
          copyText('「' + q.text + '」\n—— ' + (q.source || '纸境工坊'));
          showToast('墨句已复制');
        } else {
          closeSheet();
          openQuoteModal(q.title || '沉思墨句', q.text, q.source || 'Sxltx · 纸境工坊');
        }
      });
    });
  }

  /* ── A10 搜索命令台 ────────────────────────────────────────────────── */
  function buildCommands() {
    const go = (id) => () => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    return [
      { token: '>1 文墨', label: '跳到文墨沉淀', hint: '章节 01', run: go('essays') },
      { token: '>2 闪念', label: '跳到灵感微语', hint: '章节 02', run: go('moments') },
      { token: '>3 足迹', label: '跳到折腾足迹', hint: '章节 03', run: go('timeline') },
      { token: '>4 留墨', label: '跳到读者留墨', hint: '章节 04', run: go('guestbook') },
      { token: '>5 来客', label: '跳到来客图 · 时光', hint: '章节 05', run: go('atlas') },
      { token: '>主题', label: '切换纸境心境', hint: 'T', run: () => cycleTheme() },
      { token: '>纸签', label: '仅看稍后读纸签', hint: 'B', run: toggleBookmarkFilter },
      { token: '>速查', label: '展开纸境速查笺', hint: '?', run: () => openSheet('shortcuts') },
      { token: '>摘录', label: '翻看墨句摘录簿', hint: '', run: () => openSheet('quotes') },
      { token: '>随机', label: '信手一翻，随机一篇', hint: '', run: openRandomArticle },
      { token: '>链接', label: '复制本页链接', hint: '', run: () => { copyText(window.location.href); showToast('本页链接已复制'); } },
      { token: '>回顶', label: '回到篇首', hint: '', run: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
      { token: '>RSS', label: '打开全文 RSS', hint: '?full=1', run: () => window.open('/rss.xml?full=1', '_blank', 'noopener') },
      { token: '>后台', label: '打开工坊主理人通道', hint: 'Alt+A', run: () => openAdminModal() }
    ];
  }
  function renderCommands(raw) {
    const list = document.getElementById('search-results-list');
    if (!list) return;
    const q = raw.slice(1).trim().toLowerCase();
    cmdActions = buildCommands().filter(c => !q || (c.token + c.label).toLowerCase().indexOf(q) !== -1);
    kbIndex = -1;
    if (!cmdActions.length) {
      list.innerHTML = '<div class="search-hint">无此命令 · 试试 &gt;纸签 &gt;摘录 &gt;主题</div>';
      return;
    }
    list.innerHTML = cmdActions.map((c, i) =>
      '<div class="cmd-item" data-cmd-index="' + i + '"><span class="cmd-token">' + esc(c.token) + '</span>' +
      '<span>' + esc(c.label) + '</span><span class="cmd-hint">' + esc(c.hint) + '</span></div>'
    ).join('');
    list.querySelectorAll('.cmd-item').forEach((el, i) => {
      el.addEventListener('click', () => runCommand(i));
    });
  }
  function runCommand(i) {
    const c = cmdActions[i];
    if (!c) return;
    closeSearchModal();
    try { c.run(); } catch (e) { console.warn('[v26] command failed', e); }
  }
  function handleResultKeys(e) {
    const modal = document.getElementById('search-modal');
    if (!modal || modal.style.display === 'none') return;
    const list = document.getElementById('search-results-list');
    if (!list) return;
    const items = $$('.cmd-item, .search-result-item', list);
    if (!items.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      kbIndex = e.key === 'ArrowDown'
        ? (kbIndex + 1) % items.length
        : (kbIndex - 1 + items.length) % items.length;
      items.forEach((el, i) => el.classList.toggle('kb-active', i === kbIndex));
      items[kbIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && kbIndex >= 0) {
      e.preventDefault();
      const el = items[kbIndex];
      if (el.classList.contains('cmd-item')) runCommand(Number(el.dataset.cmdIndex));
      else el.click();
    }
  }

  /* ── A6 A7 A11 阅读器增强 ──────────────────────────────────────────── */
  function getReaderScroller() {
    return document.getElementById('drawer-scroll-container') || $('.drawer-content-scroll');
  }
  function onReaderOpen(article) {
    if (!article) return;
    const content = document.getElementById('reader-content');
    if (!content) return;

    // B1：正文内图片一律懒加载，长文不再一次性拉取所有图
    $$('img', content).forEach(img => {
      if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
      img.setAttribute('decoding', 'async');
    });
    $$('.reader-resume-bar').forEach(el => el.remove());
    $$('.related-essays').forEach(el => el.remove());
    $$('.resonate-btn').forEach(el => el.remove());

    injectResumeBar(article);
    injectRelated(article);
    injectResonate(article);
  }
  function injectResumeBar(article) {
    const saved = store.get(LS.readpos, {}) || {};
    const rec = saved[article.id];
    if (!rec || !(rec.pct > 0.04) || rec.pct > 0.96) return;
    const content = document.getElementById('reader-content');
    const bar = document.createElement('div');
    bar.className = 'reader-resume-bar';
    bar.innerHTML = '<span>上回读到 ' + Math.round(rec.pct * 100) + '% · ' + esc(formatRelativeTime(rec.time)) + '</span>' +
      '<span><button type="button" data-resume="continue">接上回</button> · <button type="button" data-resume="restart">从头读</button></span>';
    content.parentNode.insertBefore(bar, content);
    const scroller = getReaderScroller();
    bar.addEventListener('click', (e) => {
      const b = e.target.closest('[data-resume]');
      if (!b) return;
      const all = store.get(LS.readpos, {}) || {};
      if (b.dataset.resume === 'restart') {
        delete all[article.id];
        store.set(LS.readpos, all);
        if (scroller) scroller.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (scroller) {
        const max = scroller.scrollHeight - scroller.clientHeight;
        setTimeout(() => scroller.scrollTo({ top: max * rec.pct, behavior: 'smooth' }), 60);
      }
      bar.remove();
    });

    if (scroller) {
      let tick = false;
      scroller.onscroll = () => {
        if (tick) return;
        tick = true;
        window.requestAnimationFrame(() => {
          const max = scroller.scrollHeight - scroller.clientHeight;
          const pct = max > 0 ? scroller.scrollTop / max : 0;
          const map = store.get(LS.readpos, {}) || {};
          if (pct > 0.97) delete map[article.id];
          else if (pct > 0.02) map[article.id] = { pct: Math.round(pct * 1000) / 1000, time: new Date().toISOString() };
          store.set(LS.readpos, map);
          tick = false;
        });
      };
    }
  }
  function injectRelated(article) {
    const postlude = $('.reader-postlude');
    if (!postlude || !articles.length) return;
    const others = articles.filter(a => a.id !== article.id);
    const same = others.filter(a => a.category === article.category);
    const picks = same.concat(others.filter(a => a.category !== article.category)).slice(0, 2);
    const box = document.createElement('div');
    box.className = 'related-essays';
    box.innerHTML = '<div class="related-title">同频再读</div><div class="related-list">' +
      picks.map(a => '<div class="related-item" data-rel-id="' + esc(a.id) + '">' +
        '<div class="related-item-title">' + esc(a.title) + '</div>' +
        '<div class="related-item-meta">' + esc(a.category || '随笔') + ' · ' + esc(a.date || '') + '</div></div>').join('') +
      '</div><button type="button" class="related-random">信手一翻 · 随机一篇</button>';
    postlude.parentNode.insertBefore(box, postlude);
    box.querySelectorAll('[data-rel-id]').forEach(el => {
      el.addEventListener('click', () => {
        const a = articles.find(x => x.id === el.dataset.relId);
        if (a) openReader(a);
      });
    });
    $('.related-random', box).addEventListener('click', openRandomArticle);
  }
  function openRandomArticle() {
    if (!articles.length) return;
    const pool = articles.length > 1 ? articles.filter(a => a.id !== (activeQuoteArticle && activeQuoteArticle.id)) : articles;
    const list = pool.length ? pool : articles;
    const a = list[Math.floor(Math.random() * list.length)];
    if (a) openReader(a);
  }
  function injectResonate(article) {
    const actions = $('.postlude-actions');
    if (!actions) return;
    const resonated = store.get(LS.resonated, []) || [];
    const btn = document.createElement('button');
    btn.className = 'pill-action-btn resonate-btn';
    btn.type = 'button';
    btn.dataset.artId = article.id;
    if (resonated.indexOf(article.id) !== -1) btn.classList.add('is-resonated');
    btn.innerHTML = '<svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z"></path></svg>' +
      '<span>共鸣</span><span class="resonate-count">' + (Number(resonanceCounts[article.id]) || 0) + '</span>';
    actions.insertBefore(btn, actions.firstChild);
    btn.addEventListener('click', async () => {
      const countEl = $('.resonate-count', btn);
      const before = Number(countEl.textContent) || 0;
      countEl.textContent = String(before + 1);
      btn.classList.add('is-resonated');
      try {
        const res = await fetch('/api/articles/' + encodeURIComponent(article.id) + '/resonate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
        });
        const data = await res.json();
        if (data.ok) {
          resonanceCounts[article.id] = data.count;
          countEl.textContent = String(data.count);
          const marks = store.get(LS.resonated, []) || [];
          if (marks.indexOf(article.id) === -1) { marks.push(article.id); store.set(LS.resonated, marks); }
          showToast('已留下一枚朱砂印，与 ' + data.count + ' 位读者同感');
        } else {
          countEl.textContent = String(before);
          showToast(data.error || '稍歇片刻再留印');
        }
      } catch (e) {
        countEl.textContent = String(before);
        showToast('共鸣未送达，稍后再试');
      }
    });
  }

  /* ── A12 留言心境印与访客互回（v35 · 多层盖楼 + 引用块） ───────────── */
  function buildThreadHtml(replies) {
    if (!replies.length) return '';
    const byParent = {};
    replies.forEach(r => {
      const p = r.replyTo && replies.some(x => x.id === r.replyTo) ? r.replyTo : '';
      (byParent[p] = byParent[p] || []).push(r);
    });
    const node = (r, depth) => {
      const kids = byParent[r.id] || [];
      const quote = String(r.content || '').slice(0, 50);
      return '<div class="v35-reply-node" data-depth="' + Math.min(depth, 3) + '">' +
        (r.quote ? '<div class="v35-reply-quote">引「' + esc(r.quote) + '」</div>' : '') +
        '<div class="v35-reply-line">' +
          '<span class="visitor-reply-author">' + esc(r.author) + '</span>' +
          '<span class="v35-reply-text">' + esc(r.content) + '</span>' +
          '<time class="visitor-reply-time">' + esc(formatRelativeTime(r.time)) + '</time>' +
        '</div>' +
        (depth < 3
          ? '<button type="button" class="v35-reply-btn" data-thread-reply="' + esc(r.id) +
            '" data-thread-quote="' + esc(quote) + '">回这一层 ↗</button>'
          : '') +
        (kids.length ? '<div class="v35-reply-children">' + kids.map(k => node(k, depth + 1)).join('') + '</div>' : '') +
      '</div>';
    };
    return '<div class="visitor-replies v35-thread-tree">' +
      (byParent[''] || []).map(r => node(r, 0)).join('') + '</div>';
  }

  function enhanceMessageCards() {
    $$('.message-card').forEach(card => {
      const id = card.dataset.id;
      const msg = messages.find(m => m.id === id);
      if (!msg) return;
      if (msg.mood && !$('.msg-mood-seal', card)) {
        const name = $('.msg-author-name', card);
        const seal = document.createElement('span');
        seal.className = 'msg-mood-seal';
        seal.title = '此刻心境：' + msg.mood;
        seal.textContent = msg.mood;
        if (name) name.parentNode.insertBefore(seal, name.nextSibling);
      }
      if ($('.guest-reply-toggle', card)) return;
      const replies = Array.isArray(msg.visitorReplies) ? msg.visitorReplies : [];
      const wrap = document.createElement('div');
      wrap.className = 'v35-thread';
      wrap.innerHTML =
        buildThreadHtml(replies) +
        '<button type="button" class="guest-reply-toggle" data-thread-reply="" data-thread-quote="' +
          esc(String(msg.content || '').slice(0, 50)) + '">附一笔 · 与这位墨友照面</button>' +
        '<div class="v35-thread-form-slot"></div>';
      card.appendChild(wrap);

      wrap.addEventListener('click', (e) => {
        const btn = e.target.closest && e.target.closest('[data-thread-reply]');
        if (!btn || !wrap.contains(btn)) return;
        const slot = $('.v35-thread-form-slot', wrap);
        if (!slot) return;
        const rid = btn.getAttribute('data-thread-reply') || '';
        const quote = btn.getAttribute('data-thread-quote') || '';
        if (slot.getAttribute('data-for') === rid && $('.guest-reply-form', slot)) {
          slot.innerHTML = '';
          slot.removeAttribute('data-for');
          return;
        }
        slot.setAttribute('data-for', rid);
        slot.innerHTML =
          (quote ? '<div class="v35-reply-quote is-pending">引「' + esc(quote) + '」</div>' : '') +
          '<div class="guest-reply-form"><input type="text" maxlength="200" placeholder="写一句回应..." aria-label="回应内容"><button type="button">附笔</button></div>';
        const form = $('.guest-reply-form', slot);
        const input = $('input', form);
        input.focus();
        const submit = async () => {
          const text = input.value.trim();
          if (!text) return;
          const sendBtn = $('button', form);
          sendBtn.disabled = true;
          try {
            const res = await fetch('/api/messages/' + encodeURIComponent(id) + '/guest-reply', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: text, replyTo: rid || undefined, quote: quote || undefined })
            });
            const data = await res.json();
            if (data.ok && data.reply) {
              if (!Array.isArray(msg.visitorReplies)) msg.visitorReplies = [];
              msg.visitorReplies.push(data.reply);
              renderMessages();
              showToast(rid ? '这一层已盖上' : '回响已附上');
            } else {
              showToast(data.error || '附笔未送达');
              sendBtn.disabled = false;
            }
          } catch (err) {
            showToast('附笔未送达，稍后再试');
            sendBtn.disabled = false;
          }
        };
        sendBtn.addEventListener('click', submit);
        input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); submit(); } });
      });
    });
  }

  /* ── A8 留言草稿：包装 fetch 以注入心境、并在成功后清稿 ─────────────── */
  function installFetchBridge() {
    const origFetch = window.fetch;
    window.fetch = function () {
      const args = Array.prototype.slice.call(arguments);
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
      const init = args[1] || {};
      if (url.indexOf('/api/messages') === 0 && init.method === 'POST' && url.indexOf('guest-reply') === -1) {
        try {
          const body = JSON.parse(init.body || '{}');
          body.mood = currentMood;
          args[1] = Object.assign({}, init, { body: JSON.stringify(body) });
        } catch (e) {}
        return origFetch.apply(this, args).then(res => {
          if (res.status === 201) store.del(LS.draft);
          return res;
        });
      }
      return origFetch.apply(this, args);
    };
  }
  function initGuestbookDraft() {
    const author = document.getElementById('msg-author');
    const content = document.getElementById('msg-content');
    if (!content) return;
    const draft = store.get(LS.draft, null);
    if (draft && draft.content) {
      content.value = draft.content;
      if (author && draft.author) author.value = draft.author;
      content.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const save = () => store.set(LS.draft, { author: author ? author.value : '', content: content.value, time: Date.now() });
    content.addEventListener('input', save);
    if (author) author.addEventListener('input', save);
    const row = document.getElementById('mood-seal-row');
    if (row) {
      row.addEventListener('click', (e) => {
        const b = e.target.closest('.mood-seal');
        if (!b) return;
        currentMood = b.dataset.mood;
        $$('.mood-seal', row).forEach(x => {
          const on = x === b;
          x.classList.toggle('active', on);
          x.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        const hint = document.getElementById('mood-seal-hint');
        if (hint) hint.textContent = MOOD_HINT[currentMood] || '';
      });
    }
  }

  /* ── 包装既有全局函数（只加一层，不改原实现） ─────────────────────── */
  function installWrappers() {
    const wrap = (name, after) => {
      const orig = window[name];
      if (typeof orig !== 'function') return;
      window[name] = function () {
        const out = orig.apply(this, arguments);
        try { after.apply(this, arguments); } catch (e) { console.warn('[v26] ' + name + ' hook', e); }
        return out;
      };
    };
    wrap('renderArticles', enhanceArticleRows);
    wrap('renderMessages', enhanceMessageCards);
    wrap('openReader', onReaderOpen);
    wrap('openQuoteModal', recordQuote);

    const origSearch = window.runSearch;
    if (typeof origSearch === 'function') {
      window.runSearch = function (q) {
        if (typeof q === 'string' && q.trim().charAt(0) === '>') return renderCommands(q.trim());
        kbIndex = -1;
        return origSearch.apply(this, arguments);
      };
    }
  }

  /* ── 全局键盘与事件委托 ───────────────────────────────────────────── */
  function initKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeSheet(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
      const key = e.key;
      if (key === '?') { e.preventDefault(); openSheet('shortcuts'); return; }
      if (isOverlayOpen()) return;
      if (key >= '1' && key <= '6' && key.length === 1) {
        e.preventDefault();
        const el = document.getElementById(SECTION_IDS[Number(key) - 1]);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (key === 'b' || key === 'B') { e.preventDefault(); toggleBookmarkFilter(); return; }
      if (key === 'e' || key === 'E') {
        e.preventDefault();
        const sec = document.getElementById('essays');
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const first = $('.essay-row-item, .featured-essay-card');
        if (first) setTimeout(() => first.focus({ preventScroll: true }), 350);
        return;
      }
      if ((key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter') && document.activeElement) {
        const row = document.activeElement.closest && document.activeElement.closest('.essay-row-item, .featured-essay-card');
        if (!row) return;
        if (key === 'Enter') {
          e.preventDefault();
          const a = articles.find(x => x.id === row.dataset.id);
          if (a) openReader(a);
        } else if (row.classList.contains('essay-row-item')) {
          e.preventDefault();
          const rows = $$('.essay-row-item').filter(r => r.style.display !== 'none');
          const i = rows.indexOf(row);
          const next = rows[key === 'ArrowDown' ? Math.min(i + 1, rows.length - 1) : Math.max(i - 1, 0)];
          if (next) next.focus({ preventScroll: false });
        }
      }
    });

    const searchInput = document.getElementById('search-query-input');
    if (searchInput) searchInput.addEventListener('keydown', handleResultKeys);

    const navBtn = document.getElementById('btn-bookmark-filter');
    if (navBtn) navBtn.addEventListener('click', toggleBookmarkFilter);
    const closeBtn = document.getElementById('btn-close-sheet');
    if (closeBtn) closeBtn.addEventListener('click', closeSheet);
    const sheet = document.getElementById('atelier-sheet');
    if (sheet) sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

    document.addEventListener('click', (e) => {
      const act = e.target.closest && e.target.closest('[data-sheet-action]');
      if (!act) return;
      const mode = act.dataset.sheetAction;
      if (mode === 'quotes') openSheet('quotes');
      else if (mode === 'bookmarks') { closeSheet(); if (!bookmarkOnly) toggleBookmarkFilter(); }
    });
  }

  function boot() {
    installFetchBridge();
    initGuestbookDraft();
    initKeyboard();
    updateBookmarkUI();
    // 首屏数据到达前的存量渲染也已由包装函数接管；此处补一次以防 SSR 场景
    if (document.querySelector('.essay-row-item')) enhanceArticleRows();
    fetch('/api/resonances?t=' + Date.now(), { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (d && d.counts) resonanceCounts = d.counts; })
      .catch(() => {});
  }

  installWrappers();
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', bootRetention, { once: true });
  } else {
    bootRetention();
  }
  function bootRetention() {
    try { boot(); } catch (e) { console.warn('[v26] retention skipped', e); }
  }
})();

/* ==========================================================================
   v27 · 纸境动效引擎 (Atelier Motion Engine)
   零依赖、零重写：只用事件委托、MutationObserver 与函数包装挂载动效，
   不触碰 v25 / v26 任何既有渲染与交互实现。所有效果可一键关闭。
   ========================================================================== */
(function () {
  'use strict';

  const LS_KEY = 'atelier_motion_v27';
  const prefersReduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let enabled;
  try {
    const saved = localStorage.getItem(LS_KEY);
    enabled = saved === null ? !prefersReduce : saved === 'on';
  } catch (e) {
    enabled = !prefersReduce;
  }

  const root = document.documentElement;
  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function syncFlag() {
    root.classList.toggle('no-motion', !enabled);
    const btn = document.getElementById('v27-motion-toggle');
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(enabled));
    btn.textContent = enabled ? '动效 · 开' : '动效 · 关';
    btn.title = enabled ? '收起全站纸境动效' : '展开全站纸境动效';
  }
  syncFlag();

  /* ── 1. 动效开关：藏于速查笺页脚，不新增常驻 UI ────────────────────── */
  function mountToggle() {
    const foot = $('.atelier-sheet-foot');
    if (!foot || document.getElementById('v27-motion-toggle')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'v27-motion-toggle';
    btn.className = 'v27-motion-toggle';
    btn.addEventListener('click', () => {
      enabled = !enabled;
      try { localStorage.setItem(LS_KEY, enabled ? 'on' : 'off'); } catch (e) {}
      syncFlag();
      if (typeof window.showToast === 'function') {
        window.showToast(enabled ? '纸境动效已展开' : '纸境动效已收起');
      }
    });
    foot.appendChild(btn);
    syncFlag();
  }

  /* ── 2. 铺纸：只观察浮层显隐，不改任何开合函数 ─────────────────────── */
  const OVERLAY_IDS = ['search-modal', 'admin-modal', 'atelier-sheet', 'reader-overlay', 'quote-modal-overlay'];
  function syncOverlays() {
    OVERLAY_IDS.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      let open = false;
      try { open = getComputedStyle(el).display !== 'none'; } catch (e) { return; }
      const has = el.classList.contains('v27-open');
      // 同步挂类：与 display 变化同处一个渲染帧，避免「先显示一帧再淡入」的闪烁
      if (open && !has) {
        el.classList.add('v27-open');
      } else if (!open && has) {
        el.classList.remove('v27-open');
      }
    });
  }

  /* ── 3. 洇墨：按钮点击处泛开一圈极淡墨晕 ──────────────────────────── */
  const RIPPLE_TARGET = [
    'button', '.icon-btn', '.paper-btn', '.pill-action-btn', '.nav-item',
    '.mood-seal', '.cmd-item', '.related-item', '.related-random', '.sheet-link'
  ].join(',');
  let lastRipple = 0;
  function autoRemove(el, ms) {
    el.addEventListener('animationend', () => el.remove(), { once: true });
    window.setTimeout(() => { if (el.isConnected) el.remove(); }, ms);
  }
  function spawnRipple(x, y) {
    const el = document.createElement('span');
    el.className = 'v27-ink-ripple';
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    document.body.appendChild(el);
    autoRemove(el, 900);
  }
  document.addEventListener('pointerdown', (e) => {
    if (!enabled || !e.target || !e.target.closest) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (!e.target.closest(RIPPLE_TARGET)) return;
    const now = performance.now();
    if (now - lastRipple < 70) return;
    lastRipple = now;
    spawnRipple(e.clientX, e.clientY);
  }, true);

  /* ── 4. 落印与翻折：共鸣盖印、纸签折角 ────────────────────────────── */
  function spawnSeal(x, y) {
    const halo = document.createElement('span');
    halo.className = 'v27-seal-ripple';
    halo.style.left = x + 'px';
    halo.style.top = y + 'px';
    const stamp = document.createElement('span');
    stamp.className = 'v27-seal-drop';
    stamp.textContent = '印';
    stamp.style.left = x + 'px';
    stamp.style.top = y + 'px';
    document.body.appendChild(halo);
    document.body.appendChild(stamp);
    autoRemove(halo, 1000);
    autoRemove(stamp, 1000);
  }
  function replay(el, cls, ms) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    window.setTimeout(() => el.classList.remove(cls), ms);
  }
  let lastSeal = 0;
  document.addEventListener('click', (e) => {
    if (!enabled || !e.target || !e.target.closest) return;
    const sealBtn = e.target.closest('.resonate-btn');
    if (sealBtn) {
      const now = performance.now();
      if (now - lastSeal > 600) {
        lastSeal = now;
        const r = sealBtn.getBoundingClientRect();
        spawnSeal(r.left + r.width / 2, r.top + r.height / 2);
      }
      const cnt = $('.resonate-count', sealBtn);
      if (cnt) replay(cnt, 'v27-pop', 480);
    }
    const mark = e.target.closest('.paper-bookmark');
    if (mark) replay(mark, 'v27-folded', 500);
  }, true);

  /* ── 5. 渐数：统计数字首次入视口时落墨定形 ────────────────────────── */
  function runCount(el) {
    const raw = (el.textContent || '').trim();
    if (!/^\d+$/.test(raw)) return;
    const target = Number(raw);
    if (!target || target > 9999) return;
    el.classList.add('v27-counting');
    const t0 = performance.now();
    const step = (now) => {
      const p = clamp((now - t0) / 520, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        el.textContent = String(target);
        el.classList.remove('v27-counting');
        replay(el, 'v27-settled', 900);
      }
    };
    requestAnimationFrame(step);
  }
  function initCountUp() {
    if (!('IntersectionObserver' in window)) return;
    const nodes = document.querySelectorAll('.tstat-val');
    if (!nodes.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        if (enabled) runCount(en.target);
      });
    }, { threshold: 0.4 });
    nodes.forEach(n => io.observe(n));
  }

  /* ── 6. 洇染：主题切换时短暂开放颜色过渡 ──────────────────────────── */
  let morphTimer = 0;
  function wrapThemeFn(name) {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () {
      if (enabled) {
        root.classList.add('v27-theme-morph');
        window.clearTimeout(morphTimer);
        morphTimer = window.setTimeout(() => root.classList.remove('v27-theme-morph'), 480);
      }
      return orig.apply(this, arguments);
    };
  }

  /* ── 7. 游丝：导航朱砂细线滑向当前章节 ────────────────────────────── */
  let thread = null;
  function updateThread() {
    const links = $('.nav-links');
    if (!links) return;
    if (!thread) {
      thread = document.createElement('span');
      thread.className = 'v27-nav-thread is-idle';
      links.appendChild(thread);
    }
    const active = $('.nav-item.active', links);
    const idle = !active;
    if (thread.classList.contains('is-idle') !== idle) {
      thread.classList.toggle('is-idle', idle);
    }
    if (idle) return;
    const x = active.offsetLeft + 'px';
    const w = Math.max(18, active.offsetWidth - 16) + 'px';
    if (thread.dataset.x !== x) {
      thread.style.setProperty('--v27-thread-x', x);
      thread.dataset.x = x;
    }
    if (thread.dataset.w !== w) {
      thread.style.width = w;
      thread.dataset.w = w;
    }
  }

  /* ── 8. 进度线末端小印：仅在离开页首后显出 ────────────────────────── */
  let scrollTick = false;
  function onScroll() {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(() => {
      root.classList.toggle('v27-scrolled', window.scrollY > 12);
      scrollTick = false;
    });
  }

  function boot() {
    try {
      mountToggle();
      syncFlag();
      syncOverlays();
      updateThread();
      initCountUp();
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', updateThread, { passive: true });
      // 单个观察器统一驱动浮层与游丝，rAF 合并抖动
      if ('MutationObserver' in window) {
        let queued = false;
        const obs = new MutationObserver(() => {
          if (queued) return;
          queued = true;
          requestAnimationFrame(() => {
            queued = false;
            syncOverlays();
            updateThread();
          });
        });
        obs.observe(document.body, {
          subtree: true,
          attributes: true,
          attributeFilter: ['style', 'class']
        });
      }
    } catch (e) {
      console.warn('[v27] motion layer skipped', e);
    }
  }

  wrapThemeFn('setTheme');
  wrapThemeFn('cycleTheme');
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

/* ==========================================================================
   v29 · 来客图 / 时光地图：到访点亮 + 留言「来自某地」小印
   独立层，不改动既有渲染函数实现；纯原生 fetch / DOM，无任何依赖
   ========================================================================== */
(() => {
  'use strict';

  // 城位簿：只用于地名归一与覆盖面说明；未点亮的城位不渲染、不占纸面。
  // 预设外的来客由 /api/visit 自动追加并点亮，不受此表限制。
  const CITY_BOOK = [
    '北京', '上海', '天津', '重庆', '中国香港', '中国澳门', '中国台湾',
    '河北·石家庄', '河北·唐山', '河北·保定', '河北·廊坊',
    '山西·太原', '山西·大同', '内蒙古·呼和浩特', '内蒙古·包头',
    '辽宁·沈阳', '辽宁·大连', '辽宁·鞍山', '吉林·长春', '黑龙江·哈尔滨',
    '江苏·南京', '江苏·苏州', '江苏·无锡', '江苏·常州', '江苏·徐州', '江苏·南通',
    '浙江·杭州', '浙江·宁波', '浙江·温州', '浙江·绍兴', '浙江·嘉兴', '浙江·金华',
    '安徽·合肥', '安徽·芜湖', '福建·福州', '福建·厦门', '福建·泉州',
    '江西·南昌', '江西·赣州',
    '山东·济南', '山东·青岛', '山东·潍坊', '山东·烟台', '山东·淄博', '山东·临沂', '山东·威海',
    '河南·郑州', '河南·洛阳', '河南·开封', '河南·南阳',
    '湖北·武汉', '湖北·宜昌', '湖南·长沙', '湖南·株洲', '湖南·衡阳',
    '广东·广州', '广东·深圳', '广东·珠海', '广东·佛山', '广东·东莞', '广东·中山', '广东·惠州',
    '广西·南宁', '广西·桂林', '广西·柳州', '海南·海口', '海南·三亚',
    '四川·成都', '四川·绵阳', '贵州·贵阳', '贵州·遵义',
    '云南·昆明', '云南·大理', '西藏·拉萨',
    '陕西·西安', '陕西·宝鸡', '陕西·咸阳', '甘肃·兰州', '青海·西宁',
    '宁夏·银川', '新疆·乌鲁木齐'
  ];
  const CITY_INDEX = (() => {
    const m = new Map();
    CITY_BOOK.forEach((full) => {
      m.set(full, full);
      m.set(full.split('·').pop(), full);
    });
    // 合规称谓别名：CDN 头或 IP 库可能只给简称
    [['台湾', '中国台湾'], ['台北', '中国台湾'], ['香港', '中国香港'], ['澳门', '中国澳门']]
      .forEach(([alias, full]) => m.set(alias, full));
    return m;
  })();
  function normalizePlace(name) {
    const s = String(name || '').trim();
    if (!s) return '';
    if (CITY_INDEX.has(s)) return CITY_INDEX.get(s);
    const tail = s.split('·').pop().replace(/(特别行政区|自治州|地区|市)$/g, '');
    return CITY_INDEX.get(tail) || s;
  }
  const VISIBLE_CITIES = 10;
  let atlasExpanded = false;
  let lastAtlasData = null, lastAtlasHere = '';

  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function placeOf(c) {
    if (!c) return '';
    if (c.place) return c.place;
    const p = c.province || '';
    const city = c.city || '';
    if (p && city && p !== city && city.indexOf(p) !== 0) return p + '·' + city;
    return city || p || '';
  }

  function fmtTime(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function render(data, here, isNew) {
    const grid = $('#atlas-grid');
    if (!grid) return;
    lastAtlasData = data;
    lastAtlasHere = here;
    const raw = Array.isArray(data && data.cities) ? data.cities : [];

    // 地名归一 + 同城合并；只保留真正有人来过的城
    const lit = new Map();
    raw.forEach((c) => {
      const n = normalizePlace(placeOf(c));
      if (!n) return;
      const cnt = Number(c.count) || 0;
      const prev = lit.get(n);
      if (!prev) lit.set(n, { name: n, count: cnt, first: c.first || '', last: c.last || '' });
      else {
        prev.count += cnt;
        if (c.first && (!prev.first || c.first < prev.first)) prev.first = c.first;
        if (c.last && c.last > prev.last) prev.last = c.last;
      }
    });
    const all = Array.from(lit.values())
      .sort((a, b) => String(b.last || '').localeCompare(String(a.last || '')));

    // 只显示已点亮：未点亮的城位既不渲染也不占纸面
    const hereName = normalizePlace(here);
    const shown = atlasExpanded ? all : all.slice(0, VISIBLE_CITIES);
    const more = all.length > VISIBLE_CITIES
      ? '<button type="button" class="atlas-more" data-atlas-more="1">' +
          (atlasExpanded
            ? '收卷 · 只留最近 ' + VISIBLE_CITIES + ' 座 ▴'
            : '展阅余下 ' + (all.length - VISIBLE_CITIES) + ' 座城 ▾') +
        '</button>'
      : '';
    grid.innerHTML = shown.map((c) => {
      const isHere = !!hereName &&
        (c.name === hereName || hereName.indexOf(c.name) === 0 || c.name.indexOf(hereName) === 0);
      const fresh = !!(isNew && here && isHere);
      const cls = ['atlas-city', 'is-lit', isHere ? 'is-here' : '', fresh ? 'is-new' : '']
        .filter(Boolean).join(' ');
      const tip = c.name + ' · 已到访 ' + (c.count || 1) + ' 次' +
        (c.first ? ' · 首次 ' + fmtTime(c.first) : '');
      return '<span class="' + cls + '" role="listitem" title="' + esc(tip) + '">' +
        '<span class="atlas-city-dot" aria-hidden="true"></span>' +
        '<span class="atlas-city-name">' + esc(c.name) + '</span>' +
        '<span class="atlas-city-count">' + (c.count || 1) + '</span></span>';
    }).join('') + more || '<span class="atlas-empty">素纸待印 · 静候第一枚朱砂</span>';

    // 城位簿说明：让人知道不是「只有这几座城」，而是没来过的不落纸面
    let note = document.getElementById('atlas-note');
    if (!note) {
      note = document.createElement('p');
      note.id = 'atlas-note';
      note.className = 'atlas-note';
      grid.insertAdjacentElement('afterend', note);
    }
    note.textContent = '纸图备 ' + CITY_BOOK.length + ' 座城位 · 未点亮的不落纸面，有人来过才显印';

    const summary = $('#atlas-summary');
    if (summary) {
      const visits = all.reduce((s, c) => s + (c.count || 0), 0);
      summary.textContent = all.length
        ? '已点亮 ' + all.length + ' 座 · ' + visits + ' 次驻足'
        : '素纸待印 · 静候第一枚朱砂';
    }
    const hereText = $('#atlas-here-text');
    if (hereText) {
      hereText.textContent = here
        ? '此刻自 ' + here + ' 而来，已在此留下一枚印'
        : '来处未辨，仍在同一片纸境相逢';
    }

    const track = $('#atlas-timeline-track');
    if (track) {
      const recent = (Array.isArray(data && data.recent) ? data.recent : []).slice(0, 6);
      track.innerHTML = recent.length
        ? recent.map((r) => {
            const name = normalizePlace(placeOf(r));
            const t = fmtTime(r.time);
            const shortT = t.slice(-5) || t;
            return '<span class="atlas-tick" title="' + esc(name + ' · ' + t) + '">' +
              '<span class="atlas-tick-time">' + esc(shortT) + '</span>' +
              '<span class="atlas-tick-city">' + esc(name) + '</span></span>';
          }).join('')
        : '<span class="atlas-empty">尚无来客，静候第一枚印。</span>';
    }
  }

  const atlasGridEl = $('#atlas-grid');
  if (atlasGridEl) {
    atlasGridEl.addEventListener('click', (e) => {
      const b = e.target && e.target.closest && e.target.closest('[data-atlas-more]');
      if (!b) return;
      atlasExpanded = !atlasExpanded;
      render(lastAtlasData, lastAtlasHere, false);
    });
  }

  async function refresh() {
    let data = null, here = '', isNew = false;
    try {
      const res = await fetch('/api/visit?t=' + Date.now(), { method: 'POST', cache: 'no-store' });
      const json = await res.json();
      if (json && json.ok) { data = json; here = json.place || ''; isNew = !!json.isNew; }
    } catch (e) { /* 静默降级：GET 兜底 */ }
    if (!data) {
      try {
        const res = await fetch('/api/visits?t=' + Date.now(), { cache: 'no-store' });
        const json = await res.json();
        if (json && json.ok) data = json;
      } catch (e) { /* 离线时保留占位 */ }
    }
    render(data, here, isNew);
  }

  // 留言卡：给带 location 的留言补一枚「来自某地」小印
  const origRenderMessages = window.renderMessages;
  if (typeof origRenderMessages === 'function') {
    window.renderMessages = function () {
      const r = origRenderMessages.apply(this, arguments);
      try {
        const list = (typeof messages !== 'undefined' && Array.isArray(messages)) ? messages : [];
        document.querySelectorAll('#messages-wall .message-card').forEach((card) => {
          const wrap = card.querySelector('.msg-author-wrap');
          if (!wrap || wrap.querySelector('.msg-location-seal')) return;
          const msg = list.find((m) => m && m.id === card.dataset.id);
          if (!msg || !msg.location) return;
          const seal = document.createElement('span');
          seal.className = 'msg-location-seal';
          seal.textContent = '来自 ' + msg.location;
          seal.title = '仅记录城市级归属，不含 IP';
          wrap.appendChild(seal);
        });
      } catch (e) { /* 不干扰原有渲染 */ }
      return r;
    };
  }

  // 留墨成功后若点亮新城，重取聚合刷新纸图
  const origFetch = window.fetch;
  window.fetch = function () {
    const args = Array.prototype.slice.call(arguments);
    const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
    const init = args[1] || {};
    const p = origFetch.apply(this, args);
    if (url.indexOf('/api/messages') === 0 && init.method === 'POST' && url.indexOf('guest-reply') === -1) {
      p.then((res) => { if (res && res.status === 201) refresh(); return res; }).catch(() => {});
    }
    return p;
  };

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', refresh, { once: true });
  } else {
    refresh();
  }
})();

/* ==========================================================================
   v30 · 阅卷收敛：长章节默认只展前几则，纸面不再被拉得过长
   纯 CSS 显隐 + 事件委托，不改动任何既有渲染函数；内容仍在 DOM 中
   ========================================================================== */
(function () {
  'use strict';
  const LS_KEY = 'atelier_fold_v30';
  const RULES = [
    { sel: '.timeline-stream', item: '.timeline-entry', keep: 3, unit: '则足迹' },
    { sel: '#moments-timeline-container', item: '.moment-entry', keep: 4, unit: '则闪念' },
    { sel: '#messages-wall', item: '.message-card', keep: 4, unit: '则留墨' }
  ];
  let expanded = {};
  try { expanded = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; }
  catch (e) { expanded = {}; }
  const save = () => { try { localStorage.setItem(LS_KEY, JSON.stringify(expanded)); } catch (e) {} };
  const $ = (s) => document.querySelector(s);

  function syncAllBtn() {
    const b = document.getElementById('v30-fold-all');
    if (!b) return;
    const allOn = RULES.every((r) => !!expanded[r.sel]);
    b.textContent = allOn ? '展卷 · 收起' : '展卷 · 全展';
    b.setAttribute('aria-pressed', String(allOn));
  }

  function syncOne(r) {
    const box = $(r.sel);
    if (!box) return;
    const n = box.querySelectorAll(':scope > ' + r.item).length;
    const hidden = Math.max(0, n - r.keep);
    const on = !!expanded[r.sel];
    box.classList.toggle('is-condensed', !on && hidden > 0);

    let btn = document.querySelector('[data-fold-for="' + r.sel + '"]');
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fold-toggle';
      btn.setAttribute('data-fold-for', r.sel);
      btn.addEventListener('click', () => {
        expanded[r.sel] = !expanded[r.sel];
        save();
        syncOne(r);
        syncAllBtn();
      });
      box.insertAdjacentElement('afterend', btn);
    }
    btn.hidden = hidden === 0;
    btn.textContent = on
      ? '收卷 · 只留前 ' + r.keep + ' ' + r.unit + ' ▴'
      : '展阅余下 ' + hidden + ' ' + r.unit + ' ▾';
    btn.setAttribute('aria-expanded', String(on));
  }

  function setAll(on) {
    RULES.forEach((r) => { expanded[r.sel] = on; });
    save();
    RULES.forEach(syncOne);
    syncAllBtn();
    if (typeof window.showToast === 'function') {
      window.showToast(on ? '全站已展卷' : '全站已收卷');
    }
  }
  window.atelierFoldAll = setAll;

  function mountAllBtn() {
    const foot = $('.atelier-sheet-foot');
    if (!foot || document.getElementById('v30-fold-all')) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'v30-fold-all';
    btn.className = 'v27-motion-toggle v30-fold-all';
    btn.title = '展开或收卷全站长章节';
    btn.addEventListener('click', () => setAll(!RULES.every((r) => !!expanded[r.sel])));
    foot.appendChild(btn);
    syncAllBtn();
  }

  function boot() {
    RULES.forEach(syncOne);
    mountAllBtn();
    RULES.forEach((r) => {
      const box = $(r.sel);
      if (box) new MutationObserver(() => syncOne(r)).observe(box, { childList: true });
    });
    new MutationObserver(mountAllBtn).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

/* ==========================================================================
   v33 · 近三日纸窗 + 显性互动层
   两件事：把「近三日」写进章节时间签；把原本只藏在快捷键里的能力搬到
   纸面上，让每一则闪念都能被点、被接、被抽出来重读。
   原则：零依赖、事件委托、异常静默降级；不改动任何既有渲染函数。
   ========================================================================== */
(function initAtelierV33() {
  'use strict';

  const LS_DOCK = 'atelier_v33_dock';
  const LS_STAMP = 'atelier_moment_res_v33';
  const $ = (s, r) => (r || document).querySelector(s);
  const store = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v === null ? fb : JSON.parse(v); } catch (e) { return fb; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  const isTyping = () => {
    const el = document.activeElement;
    return !!el && (['INPUT', 'TEXTAREA', 'SELECT'].indexOf(el.tagName) !== -1 || el.isContentEditable);
  };
  const toast = (msg) => { if (typeof window.showToast === 'function') window.showToast(msg); };
  const esc = (s) => escapeHtml(String(s == null ? '' : s));
  let lastNote = null;

  /* ── 1. 章节时间签：近三日 / 全部旧卷 ─────────────────────────────── */
  function syncScopes() {
    ['essays', 'moments'].forEach((kind) => {
      const bar = document.getElementById('v33-scope-' + kind);
      if (!bar) return;
      const info = atelierRecentCache[kind];
      const all = !!atelierRecentScope[kind];
      const unit = kind === 'essays' ? '篇' : '则';
      const label = $('[data-scope-label]', bar);
      const count = $('[data-scope-count]', bar);
      const btn = $('[data-scope-toggle]', bar);
      if (label) label.textContent = all ? '全部旧卷' : (info ? atelierWindowLabel(info.win) : '近三日');
      if (count) {
        count.textContent = info
          ? (all ? '共 ' + info.total + ' ' + unit : '当前 ' + info.shown + ' ' + unit + ' · 共 ' + info.total + ' ' + unit)
          : '装载中';
      }
      if (btn) {
        btn.textContent = all ? '收卷 · 只看近三日 ▴' : '展阅旧卷 ▾';
        btn.setAttribute('aria-pressed', String(all));
      }
      bar.classList.toggle('is-all', all);
    });
    updateNowBar();
  }

  function toggleScope(kind, force) {
    if (['essays', 'moments'].indexOf(kind) === -1) return;
    const next = typeof force === 'boolean' ? force : !atelierRecentScope[kind];
    if (next === atelierRecentScope[kind]) return;
    atelierRecentScope[kind] = next;
    if (kind === 'essays' && typeof window.renderArticles === 'function') window.renderArticles();
    if (kind === 'moments' && typeof window.renderMoments === 'function') window.renderMoments();
    syncScopes();
    toast(next ? '旧卷已展 · 全量翻阅' : '收卷 · 只看近三日');
  }

  /* ── 2. 此刻纸境：时辰 / 近三日更新 / 来客 ────────────────────────── */
  function shichenLabel() {
    const names = ['子时', '丑时', '寅时', '卯时', '辰时', '巳时', '午时', '未时', '申时', '酉时', '戌时', '亥时'];
    const i = Math.floor(((new Date().getHours() + 1) % 24) / 2);
    return names[i] + ' · 纸境未眠';
  }
  function updateNowBar() {
    const t = document.getElementById('v33-now-time');
    if (t) t.textContent = shichenLabel();
    const f = document.getElementById('v33-now-fresh');
    if (f) {
      const e = atelierRecentCache.essays;
      const m = atelierRecentCache.moments;
      f.textContent = '近三日新墨 ' + (e ? e.shown : 0) + ' 篇 · 闪念 ' + (m ? m.shown : 0) + ' 则';
      if (e && e.win) f.title = atelierWindowLabel(e.win);
    }
  }
  async function refreshGuests() {
    const el = document.getElementById('v33-now-guests');
    if (!el) return;
    try {
      const res = await fetch('/api/visits?t=' + Date.now(), { cache: 'no-store' });
      const d = await res.json();
      const recent = Array.isArray(d.recent) ? d.recent : [];
      const n = recent.filter(r => new Date(r.time).getTime() >= Date.now() - 86400000).length;
      const cities = Number(d.total) || 0;
      el.textContent = n ? '近一日 ' + n + ' 位来客驻足' : (cities ? '已点亮 ' + cities + ' 座城' : '纸境静候来客');
    } catch (e) { /* 离线时保留占位 */ }
  }

  /* ── 3. 信手一页：把旧文字重新抽到眼前 ────────────────────────────── */
  function drawNote() {
    const box = document.getElementById('v33-note');
    if (!box) return;
    const pool = [];
    (typeof moments !== 'undefined' ? moments : []).forEach((m) => {
      if (m && m.content) pool.push({ text: String(m.content), source: '灵感微语 · #' + (m.tag || '随想'), time: m.time || '' });
    });
    (typeof articles !== 'undefined' ? articles : []).forEach((a) => {
      const txt = a && (a.summary || a.title);
      if (txt) pool.push({ text: String(txt), source: '文墨沉淀 · ' + (a.title || ''), time: a.date || a.time || '' });
    });
    if (!pool.length) { toast('纸境尚空，稍后再抽'); return; }
    let i = Math.floor(Math.random() * pool.length);
    if (lastNote && pool.length > 1 && pool[i].text === lastNote.text) i = (i + 1) % pool.length;
    lastNote = pool[i];
    const textEl = document.getElementById('v33-note-text');
    const metaEl = document.getElementById('v33-note-meta');
    if (textEl) textEl.textContent = lastNote.text.length > 168 ? lastNote.text.slice(0, 168) + '…' : lastNote.text;
    if (metaEl) metaEl.textContent = lastNote.source + (lastNote.time ? ' · ' + String(lastNote.time).slice(0, 10) : '');
    box.hidden = false;
    box.classList.remove('is-dealt');
    void box.offsetWidth;
    box.classList.add('is-dealt');
  }
  function closeNote() {
    const box = document.getElementById('v33-note');
    if (box) box.hidden = true;
  }
  function copyText(txt) {
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = txt;
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) {}
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).catch(fallback);
        return;
      }
    } catch (e) {}
    fallback();
  }
  function joinMoment(text) {
    const input = document.getElementById('msg-content');
    if (!input || !text) return;
    const clean = String(text).replace(/\s+/g, ' ').trim().slice(0, 64);
    const prefix = '「' + clean + '」… 我想接一句：';
    input.value = prefix;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const sec = document.getElementById('guestbook');
    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => {
      input.focus({ preventScroll: true });
      try { input.setSelectionRange(prefix.length, prefix.length); } catch (e) {}
    }, 520);
    toast('已引到留墨处，接一句吧');
  }

  /* ── 4. 右下纸舟：常驻可见的五件事 ────────────────────────────────── */
  function mountDock() {
    if (document.getElementById('v33-dock')) return;
    const dock = document.createElement('aside');
    dock.id = 'v33-dock';
    dock.className = 'v33-dock';
    dock.setAttribute('aria-label', '纸境随手工具');
    dock.innerHTML =
      '<button type="button" class="v33-dock-toggle" data-v33="toggle" title="收起 / 展开随手纸舟" aria-label="收起或展开随手纸舟"><span aria-hidden="true">纸</span></button>' +
      '<div class="v33-dock-items">' +
        '<button type="button" class="v33-dock-btn is-primary" data-v33="draw" aria-label="信手翻一页旧文"><span class="v33-dock-glyph" aria-hidden="true">页</span><span class="v33-dock-tip">翻一页 · R</span></button>' +
        '<button type="button" class="v33-dock-btn" data-v33="random" aria-label="信手一翻，随机一篇"><span class="v33-dock-glyph" aria-hidden="true">翻</span><span class="v33-dock-tip">信手一翻 · N</span></button>' +
        '<button type="button" class="v33-dock-btn" data-v33="bookmarks" aria-label="稍后读纸签"><span class="v33-dock-glyph" aria-hidden="true">签</span><span class="v33-dock-tip">稍后读纸签 · B</span></button>' +
        '<button type="button" class="v33-dock-btn" data-v33="sheet" aria-label="展开纸境速查笺"><span class="v33-dock-glyph" aria-hidden="true">?</span><span class="v33-dock-tip">纸境速查 · ?</span></button>' +
        '<button type="button" class="v33-dock-btn" data-v33="top" aria-label="回到篇首"><span class="v33-dock-glyph" aria-hidden="true">↑</span><span class="v33-dock-tip">回到篇首</span></button>' +
      '</div>';
    document.body.appendChild(dock);
    const collapsed = !!store.get(LS_DOCK, false);
    dock.classList.toggle('is-collapsed', collapsed);
  }
  function mountNote() {
    if (document.getElementById('v33-note')) return;
    const note = document.createElement('div');
    note.id = 'v33-note';
    note.className = 'v33-note';
    note.hidden = true;
    note.setAttribute('role', 'dialog');
    note.setAttribute('aria-label', '信手一页');
    note.innerHTML =
      '<div class="v33-note-head">' +
        '<span class="v33-note-title">信手一页 <span class="v33-note-seal">阅</span></span>' +
        '<button type="button" class="v33-note-x" data-v33-note="close" aria-label="收起纸笺">×</button>' +
      '</div>' +
      '<p class="v33-note-text" id="v33-note-text"></p>' +
      '<div class="v33-note-meta" id="v33-note-meta"></div>' +
      '<div class="v33-note-actions">' +
        '<button type="button" data-v33-note="again">再翻一页</button>' +
        '<button type="button" data-v33-note="copy">复制</button>' +
        '<button type="button" data-v33-note="join">接一句 ↗</button>' +
      '</div>';
    document.body.appendChild(note);
  }
  function handleDock(act) {
    const dock = document.getElementById('v33-dock');
    if (act === 'toggle' && dock) {
      const next = !dock.classList.contains('is-collapsed');
      dock.classList.toggle('is-collapsed', next);
      store.set(LS_DOCK, next);
      return;
    }
    if (act === 'draw') { drawNote(); return; }
    if (act === 'random') {
      const list = (typeof articles !== 'undefined' && Array.isArray(articles)) ? articles : [];
      if (!list.length) return;
      const a = list[Math.floor(Math.random() * list.length)];
      if (a && typeof window.openReader === 'function') window.openReader(a);
      return;
    }
    if (act === 'bookmarks') {
      const b = document.getElementById('btn-bookmark-filter');
      if (b) b.click();
      return;
    }
    if (act === 'sheet') {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: '?', bubbles: true }));
      return;
    }
    if (act === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function handleNote(act) {
    if (act === 'close') { closeNote(); return; }
    if (act === 'again') { drawNote(); return; }
    if (!lastNote) return;
    if (act === 'copy') { copyText('「' + lastNote.text + '」\n—— ' + lastNote.source); toast('墨句已复制'); return; }
    if (act === 'join') { closeNote(); joinMoment(lastNote.text); }
  }

  /* ── 5. 微语：同感朱砂印 + 接一句 ─────────────────────────────────── */
  async function handleMomentAction(btn) {
    const act = btn.getAttribute('data-moment-act');
    const id = btn.getAttribute('data-id') || '';
    const entry = btn.closest ? btn.closest('.moment-entry') : null;
    if (act === 'join') {
      const m = (typeof moments !== 'undefined' ? moments : []).find(x => String(x.id) === id);
      const textEl = entry ? $('.moment-text', entry) : null;
      joinMoment(m ? m.content : (textEl ? textEl.textContent : ''));
      return;
    }
    if (act !== 'resonate') return;
    const stamped = store.get(LS_STAMP, []) || [];
    if (stamped.indexOf(id) !== -1) { toast('这一印已留过了'); return; }
    const num = $('.moment-seal-count', btn);
    let count = Number(num && num.textContent) || 0;
    btn.disabled = true;
    let ok = false;
    try {
      const res = await fetch('/api/moments/' + encodeURIComponent(id) + '/resonate', { method: 'POST', cache: 'no-store' });
      const data = await res.json();
      if (data && data.ok) { count = Number(data.count) || count + 1; ok = true; }
    } catch (e) { /* 降级为本地记印 */ }
    if (!ok) count += 1;
    const arr = store.get(LS_STAMP, []) || [];
    arr.push(id);
    store.set(LS_STAMP, arr);
    if (num) num.textContent = String(count);
    btn.classList.add('is-stamped');
    btn.setAttribute('aria-pressed', 'true');
    btn.classList.remove('is-inking');
    void btn.offsetWidth;
    btn.classList.add('is-inking');
    btn.disabled = false;
    toast(ok ? '朱砂已落 · 同感 +1' : '心意已记下（离线暂存）');
  }

  /* ── 6. 速查笺补记 + 命令台口令 ───────────────────────────────────── */
  function bindSheetObserver() {
    const body = document.getElementById('atelier-sheet-body');
    if (!body || !('MutationObserver' in window)) return;
    new MutationObserver(() => {
      const title = document.getElementById('atelier-sheet-title');
      if (!title || title.textContent !== '纸境速查') return;
      if (body.querySelector('[data-v33-shortcuts]')) return;
      const extra = document.createElement('div');
      extra.setAttribute('data-v33-shortcuts', '1');
      extra.className = 'shortcut-grid v33-shortcut-extra';
      extra.innerHTML =
        '<div class="shortcut-row"><span class="shortcut-key">R</span><span>信手翻一页</span></div>' +
        '<div class="shortcut-row"><span class="shortcut-key">N</span><span>信手一翻，随机一篇</span></div>' +
        '<div class="shortcut-row"><span class="shortcut-key">右下纸舟</span><span>抽笺 / 一翻 / 纸签 / 速查 / 回顶</span></div>' +
        '<div class="shortcut-row"><span class="shortcut-key">章节时间签</span><span>文墨与闪念只看近三日，可展阅旧卷</span></div>';
      body.appendChild(extra);
    }).observe(body, { childList: true });
  }
  const origRunSearch = window.runSearch;
  if (typeof origRunSearch === 'function') {
    window.runSearch = function (q) {
      const s = typeof q === 'string' ? q.trim() : '';
      if (s === '>抽签' || s === '>翻一页' || s === '>一笺') { drawNote(); return; }
      if (s === '>旧卷' || s === '>展卷') { toggleScope('essays', true); toggleScope('moments', true); return; }
      if (s === '>近三日') { toggleScope('essays', false); toggleScope('moments', false); return; }
      return origRunSearch.apply(this, arguments);
    };
  }

  /* ── 7. 事件委托与启动 ────────────────────────────────────────────── */
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    const scopeBtn = t.closest('[data-scope-toggle]');
    if (scopeBtn) { toggleScope(scopeBtn.getAttribute('data-scope-toggle')); return; }
    const dockBtn = t.closest('[data-v33]');
    if (dockBtn) { handleDock(dockBtn.getAttribute('data-v33')); return; }
    const noteBtn = t.closest('[data-v33-note]');
    if (noteBtn) { handleNote(noteBtn.getAttribute('data-v33-note')); return; }
    const momentBtn = t.closest('[data-moment-act]');
    if (momentBtn) { handleMomentAction(momentBtn); return; }
    if (t.closest('#v33-now-draw')) drawNote();
    if (t.id === 'v33-note' || (t.classList && t.classList.contains('v33-note-backdrop'))) closeNote();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeNote(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey || isTyping()) return;
    const k = String(e.key).toLowerCase();
    if (k === 'r') { e.preventDefault(); drawNote(); }
    else if (k === 'n') { e.preventDefault(); handleDock('random'); }
  });

  function boot() {
    mountDock();
    mountNote();
    bindSheetObserver();
    syncScopes();
    if ('MutationObserver' in window) {
      ['essays-list-container', 'moments-timeline-container'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) new MutationObserver(() => syncScopes()).observe(el, { childList: true });
      });
    }
    refreshGuests();
    updateNowBar();
  }
  window.atelierV33 = { syncScopes: syncScopes, toggleScope: toggleScope, drawNote: drawNote, join: joinMoment };
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();

/* ==========================================================================
   v35 · 纸境日常：每日一问 / 今日运势 / 月度共鸣榜 / 本月回看
   全部复用既有数据与 API：不新增依赖、不新增常驻区块，浮层按需开合。
   —— 卷轴分组、阅读刻度、纸纹封面、留言盖楼分别在核心函数与 v26 中实现。
   ========================================================================== */
(function initAtelierV35() {
  'use strict';

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const esc = (s) => escapeHtml(String(s == null ? '' : s));
  const toast = (m) => { if (typeof window.showToast === 'function') window.showToast(m); };
  const store = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v === null ? fb : JSON.parse(v); } catch (e) { return fb; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const LS = { read: 'atelier_read_v35', visits: 'atelier_v35_visit_days', question: 'atelier_v35_q_pending' };
  const SECTION_IDS = ['essays', 'moments', 'timeline', 'guestbook', 'atlas'];

  // 主理人十二问：服务端 config.dailyQuestions 可覆盖，缺省时用这一组
  const FALLBACK_QUESTIONS = [
    '你最近一次删掉自己写的代码，是因为什么？',
    '如果只能留一个工具陪你工作十年，会选哪一个？',
    '写东西时，你更怕空白页还是改不完的稿？',
    '有没有一个「不联网也能跑」的小系统让你特别安心？',
    '你如何判断一篇文章值得读完，而不是收藏了事？',
    '最近哪个小细节让你觉得界面被认真设计过？',
    '你会为「留白」牺牲一点点信息密度吗？',
    '自动化替你省下的时间，最后都去哪儿了？',
    '写周记、写博客、写注释，哪一种最像在跟自己说话？',
    '有没有哪次「重做一遍」，反而比第一次更轻松？',
    '你更喜欢把想法立刻发出去，还是放三天再回看？',
    '如果给三年后的自己留一句话，会写什么？'
  ];
  let questions = FALLBACK_QUESTIONS.slice();
  let todayQ = null;
  let pendingQ = null;
  let echoesOpen = false;
  let fortuneOffset = 0;
  let currentFortune = null;
  let panelMode = '';

  function dayKey(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function fmtDay(d) {
    return d.getFullYear() + '.' + String(d.getMonth() + 1).padStart(2, '0') + '.' + String(d.getDate()).padStart(2, '0');
  }
  function seedOf(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function clip(s, n) { return String(s || '').length > n ? String(s).slice(0, n) + '…' : String(s || ''); }
  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function copyText(txt) {
    const fallback = () => {
      try {
        const ta = document.createElement('textarea');
        ta.value = txt; ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
      } catch (e) {}
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).catch(fallback); return; }
    } catch (e) {}
    fallback();
  }

  /* ── 1. 每日一问：按本地日期确定性取题，回应按 questionId 聚合 ─────── */
  function makeQuestion() {
    const k = dayKey(new Date());
    const text = questions[seedOf('q:' + k) % questions.length] || FALLBACK_QUESTIONS[0];
    return { id: 'q' + k.replace(/-/g, ''), day: k, text: text };
  }
  function questionAnswers() {
    if (!todayQ) return [];
    const list = (typeof messages !== 'undefined' && Array.isArray(messages)) ? messages : [];
    return list.filter(m => m && m.questionId === todayQ.id);
  }
  function renderEchoes(list) {
    const box = $('#v35-q-echoes-list');
    if (!box) return;
    if (!echoesOpen) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = list.length
      ? '<div class="v35-q-echoes-head">今日回应 · ' + list.length + ' 笔</div>' +
        list.slice(0, 8).map(m =>
          '<div class="v35-q-echo"><span class="v35-q-echo-author">' + esc(m.author || '墨友') + '</span>' +
          '<p>' + esc(clip(m.content, 120)) + '</p>' +
          '<time class="mono">' + esc(formatRelativeTime(m.time)) + '</time></div>'
        ).join('')
      : '<div class="v35-q-echo is-empty">今日尚无人应笔，等第一句。</div>';
  }
  function refreshQuestionBar() {
    const t = $('#v35-q-text');
    if (t && todayQ) t.textContent = todayQ.text;
    const answers = questionAnswers();
    const c = $('#v35-q-count');
    if (c) { c.hidden = !answers.length; c.textContent = answers.length ? answers.length + ' 位墨友已应' : ''; }
    const btn = $('#v35-q-echoes');
    if (btn) { btn.textContent = echoesOpen ? '收起回应 ▴' : '看回应 ▾'; btn.setAttribute('aria-expanded', String(echoesOpen)); }
    renderEchoes(answers);
  }
  function answerQuestion() {
    const input = $('#msg-content');
    if (!input || !todayQ) return;
    const prefix = '【今日一问】' + todayQ.text + ' · 我的回答：';
    const cur = input.value.trim().replace(/^【[^】]+】\s*/, '');
    input.value = prefix + cur;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    pendingQ = todayQ;
    store.set(LS.question, todayQ);
    scrollToSection('guestbook');
    setTimeout(() => {
      input.focus({ preventScroll: true });
      try { input.setSelectionRange(input.value.length, input.value.length); } catch (e) {}
    }, 460);
    toast('今日一问已引到留墨处');
  }
  // 提交留言时把话题标识带上去；仅在用户确实以「【今日一问】」开头时注入
  function installQuestionBridge() {
    const orig = window.fetch;
    window.fetch = function () {
      const args = Array.prototype.slice.call(arguments);
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
      const init = args[1] || {};
      const isPost = url.indexOf('/api/messages') === 0 && init.method === 'POST' && url.indexOf('guest-reply') === -1;
      if (isPost && pendingQ) {
        try {
          const body = JSON.parse(init.body || '{}');
          if (String(body.content || '').indexOf('【今日一问】') === 0) {
            body.questionId = pendingQ.id;
            body.questionText = pendingQ.text;
            args[1] = Object.assign({}, init, { body: JSON.stringify(body) });
          }
        } catch (e) {}
      }
      const p = orig.apply(this, args);
      if (isPost && pendingQ) {
        p.then(res => {
          if (res && res.status === 201) { pendingQ = null; store.del(LS.question); setTimeout(refreshQuestionBar, 900); }
          return res;
        }).catch(() => {});
      }
      return p;
    };
  }
  async function loadQuestions() {
    try {
      const res = await fetch('/api/config?t=' + Date.now(), { cache: 'no-store' });
      const d = await res.json();
      if (d && Array.isArray(d.dailyQuestions) && d.dailyQuestions.length) questions = d.dailyQuestions;
    } catch (e) { /* 离线沿用内置十二问 */ }
    todayQ = makeQuestion();
    refreshQuestionBar();
  }

  /* ── 2. 本月已阅回看条：只在本浏览器计数，可点开逐篇回看 ──────────── */
  function readRecord() {
    let all = {};
    try { all = JSON.parse(localStorage.getItem(LS.read) || '{}') || {}; } catch (e) {}
    if (!all || typeof all !== 'object' || Array.isArray(all)) all = {};
    const d = new Date();
    const mon = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    return { all: all, mon: mon, ids: Array.isArray(all[mon]) ? all[mon] : [] };
  }
  function refreshReadCount() {
    const el = $('#v35-read-count'), sep = $('#v35-read-sep');
    if (!el) return;
    const n = readRecord().ids.length;
    el.hidden = !n;
    if (sep) sep.hidden = !n;
    if (n) { el.textContent = '本月已阅 ' + n + ' 篇 ↗'; el.title = '点开回看 · 仅记于此浏览器，不上送'; }
  }

  /* ── 3. 今日运势：一天一签，日期种子恒定，全天不改；不主动点绝不弹出 ── */
  // 纯前端内置，零依赖零请求；取向克制务实，不谈吉凶祸福
  const FORTUNE_SIGNS = [
    { rank: '上上签', line: '云开见月，纸上有风。', yi: '启新篇', ji: '久拖不决', note: '今天适合把搁了很久的那一笔落下，先写丑一点也没关系。' },
    { rank: '上签',   line: '缓步当车，反得先至。', yi: '慢工',   ji: '赶进度',   note: '按自己的节奏做完一件事，比同时开三件更值。' },
    { rank: '中吉',   line: '删繁就简，自有清光。', yi: '做减法', ji: '层层加码', note: '试着拿掉一个多余的功能或段落，留下的会更清楚。' },
    { rank: '平签',   line: '风过疏竹，不留余响。', yi: '照常',   ji: '翻旧账',   note: '不必复盘每一个细节，照常往前走就好。' },
    { rank: '上签',   line: '一灯在手，不惧夜长。', yi: '深读',   ji: '碎片浏览', note: '给一篇长文留出完整的二十分钟，收获会不一样。' },
    { rank: '小吉',   line: '小处着手，渐成丘壑。', yi: '修细节', ji: '推倒重来', note: '先补好眼前那一处小瑕疵，别急着重构整个世界。' },
    { rank: '中吉',   line: '问得具体，才答得实在。', yi: '写清楚', ji: '含糊其辞', note: '把问题里的场景、版本和现象写全，答案自然就近了。' },
    { rank: '上上签', line: '旧稿重理，别有天地。', yi: '回看',   ji: '只顾往前', note: '翻翻三个月前写的东西，你大概会遇见一个不错的想法。' },
    { rank: '平签',   line: '案头有序，心亦不扰。', yi: '归档',   ji: '堆着再说', note: '花十分钟整理目录与命名，后面会省下许多寻找。' },
    { rank: '上签',   line: '留白三分，余地自宽。', yi: '克制',   ji: '填满',     note: '界面也好、日程也好，今天少放一样东西试试。' },
    { rank: '中吉',   line: '与人一问，胜读十行。', yi: '请教',   ji: '独自硬扛', note: '卡住超过半小时，就把问题说给另一个人听。' },
    { rank: '小吉',   line: '雨后看山，事缓则圆。', yi: '暂放',   ji: '当场定论', note: '不必今天下判断，睡一觉再看，常会更清楚。' },
    { rank: '上签',   line: '把话写短，把事做长。', yi: '精简',   ji: '长篇铺陈', note: '一段说明能压到三行，就别写三页。' },
    { rank: '中吉',   line: '手上有活，心中不慌。', yi: '动手',   ji: '反复设想', note: '先跑通最小的一版，思路会在做的过程中自己长出来。' },
    { rank: '平签',   line: '一日一记，久自见功。', yi: '记录',   ji: '全凭记忆', note: '今天写下三行就够，时间会替你把它们连起来。' },
    { rank: '上上签', line: '素纸无华，反承好字。', yi: '守简',   ji: '堆砌',     note: '不必再加装饰，现在这版已经足够耐看。' },
    { rank: '小吉',   line: '岔路慢行，看清再走。', yi: '核实',   ji: '想当然',   note: '涉及数据的判断，先核一下来源再下笔。' },
    { rank: '中吉',   line: '借一寸光，照一段路。', yi: '共读',   ji: '闭门造车', note: '找一篇同题的旧文对照着读，容易看见自己的盲区。' },
    { rank: '上签',   line: '收笔有时，来日方长。', yi: '适时停', ji: '熬夜硬撑', note: '到点就收，明天的你会感谢今天停在这一句。' },
    { rank: '平签',   line: '寻常一日，也值得记。', yi: '照常',   ji: '求新求变', note: '没有大事发生的一天，也可以安心地过完。' }
  ];
  function fortuneOf(day) {
    return FORTUNE_SIGNS[seedOf('fortune:' + day) % FORTUNE_SIGNS.length];
  }
  function visitStreak() {
    let arr = store.get(LS.visits, []);
    if (!Array.isArray(arr)) arr = [];
    const k = dayKey(new Date());
    if (arr.indexOf(k) === -1) { arr.push(k); arr = arr.slice(-400); store.set(LS.visits, arr); }
    let n = 0;
    const d = new Date();
    for (;;) {
      if (arr.indexOf(dayKey(d)) === -1) break;
      n++; d.setDate(d.getDate() - 1);
      if (n > 400) break;
    }
    return n;
  }

  /* ── 4. 通用小笺浮层：今日运势 / 共鸣榜 / 本月回看共用一张纸 ────────── */
  function mountPanel() {
    if ($('#v35-panel')) return;
    const p = document.createElement('div');
    p.id = 'v35-panel';
    p.className = 'v33-note v35-panel';
    p.hidden = true;
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', '纸境小笺');
    p.innerHTML =
      '<div class="v33-note-head">' +
        '<span class="v33-note-title" id="v35-panel-title"></span>' +
        '<button type="button" class="v33-note-x" data-v35-panel="close" aria-label="收起小笺">×</button>' +
      '</div>' +
      '<div class="v35-panel-body" id="v35-panel-body"></div>' +
      '<div class="v33-note-actions" id="v35-panel-actions"></div>';
    document.body.appendChild(p);
  }
  function closePanel() {
    const p = $('#v35-panel');
    if (p) p.hidden = true;
    panelMode = '';
  }
  function openPanel(mode, random) {
    const p = $('#v35-panel');
    if (!p) return;
    const note = $('#v33-note');
    if (note) note.hidden = true;
    panelMode = mode;
    if (mode === 'daily') renderFortune(0);
    else if (mode === 'board') renderBoard();
    else if (mode === 'read') renderRead();
    p.hidden = false;
    p.classList.remove('is-dealt');
    void p.offsetWidth;
    p.classList.add('is-dealt');
  }
  function panelShell(title, seal, body, actions) {
    const t = $('#v35-panel-title');
    if (t) t.innerHTML = esc(title) + ' <span class="v33-note-seal">' + esc(seal) + '</span>';
    const b = $('#v35-panel-body');
    if (b) b.innerHTML = body;
    const a = $('#v35-panel-actions');
    if (a) a.innerHTML = actions;
  }
  function renderFortune(offset) {
    fortuneOffset = Math.max(-30, Math.min(0, Number(offset) || 0));
    const d = new Date();
    if (fortuneOffset) d.setDate(d.getDate() + fortuneOffset);
    const f = fortuneOf(dayKey(d));
    currentFortune = { f: f, day: fmtDay(d) };
    const meta = fmtDay(d) + ' · ' +
      (fortuneOffset ? '往日回签 · ' + Math.abs(fortuneOffset) + ' 日前' : '第 ' + visitStreak() + ' 日造访') +
      ' · ' + (fortuneOffset ? '今日一签仍待点开' : '一日一签，明日再启');
    const body =
      '<div class="v35-daily-meta">' + esc(meta) + '</div>' +
      '<div class="v37-fortune">' +
        '<div class="v37-fortune-rank"><span>' + esc(f.rank) + '</span><i aria-hidden="true">运</i></div>' +
        '<p class="v37-fortune-line">' + esc(f.line) + '</p>' +
        '<div class="v37-fortune-pair">' +
          '<div class="v37-fortune-yi"><em>宜</em>' + esc(f.yi) + '</div>' +
          '<div class="v37-fortune-ji"><em>忌</em>' + esc(f.ji) + '</div>' +
        '</div>' +
        '<p class="v37-fortune-note">' + esc(f.note) + '</p>' +
      '</div>' +
      '<div class="v33-note-meta">签由日期而定，不随刷新更改 · 仅存于此浏览器</div>';
    const actions =
      (fortuneOffset
        ? '<button type="button" data-v35-panel="today">回今日</button>'
        : '<button type="button" data-v35-panel="prev">翻昨日</button>') +
      '<button type="button" data-v35-panel="copy">复制</button>' +
      '<button type="button" data-v35-panel="answer">应今日一问 ↗</button>' +
      '<button type="button" data-v35-panel="close">收起</button>';
    panelShell(fortuneOffset ? '往日之签' : '今日运势', '运', body, actions);
  }
  function renderBoard() {
    const d = new Date(), y = d.getFullYear(), mo = d.getMonth();
    const list = ((typeof moments !== 'undefined' && Array.isArray(moments)) ? moments : [])
      .map(m => ({ m: m, t: new Date((m && (m.time || m.date)) || 0) }))
      .filter(o => !isNaN(o.t.getTime()) && o.t.getFullYear() === y && o.t.getMonth() === mo && (Number(o.m.resonances) || 0) > 0)
      .sort((a, b) => (Number(b.m.resonances) || 0) - (Number(a.m.resonances) || 0))
      .slice(0, 3);
    const rank = ['一', '二', '三'];
    const body = list.length
      ? '<div class="v35-board-sub">' + esc(String(y) + ' 年 ' + (mo + 1) + ' 月 · 按同感印计数') + '</div>' +
        list.map((o, i) =>
          '<button type="button" class="v35-board-item" data-v35-goto="' + esc(o.m.id || '') + '">' +
            '<span class="v35-board-rank">' + rank[i] + '</span>' +
            '<span class="v35-board-text">' + esc(clip(o.m.content, 78)) + '</span>' +
            '<span class="v35-board-count">' + (Number(o.m.resonances) || 0) + ' 印</span>' +
          '</button>'
        ).join('')
      : '<p class="v35-empty">本月还没有落下同感印。去「灵感微语」盖第一枚吧。</p>';
    panelShell('最共鸣一笺', '月', body,
      '<button type="button" data-v35-panel="moments">去灵感微语 ↗</button>' +
      '<button type="button" data-v35-panel="close">收起</button>');
  }
  function renderRead() {
    const rec = readRecord();
    const list = ((typeof articles !== 'undefined' && Array.isArray(articles)) ? articles : [])
      .filter(a => rec.ids.indexOf(String(a.id)) !== -1);
    const body = list.length
      ? '<div class="v35-board-sub">' + esc(rec.mon) + ' · 此浏览器读过 ' + list.length + ' 篇，点题可重阅</div>' +
        list.map(a =>
          '<button type="button" class="v35-board-item" data-v35-open="' + esc(a.id) + '">' +
            '<span class="v35-board-rank">阅</span>' +
            '<span class="v35-board-text">' + esc(a.title) + '</span>' +
            '<span class="v35-board-count">' + esc(a.date || '') + '</span>' +
          '</button>'
        ).join('')
      : '<p class="v35-empty">本月还没展过卷。打开任意一篇，这里就会留下一道折痕。</p>';
    panelShell('本月回看', '阅', body,
      '<button type="button" data-v35-panel="essays">去文墨沉淀 ↗</button>' +
      '<button type="button" data-v35-panel="close">收起</button>');
  }
  function handlePanelAct(act) {
    if (act === 'close') { closePanel(); return; }
    if (act === 'prev') { renderFortune(fortuneOffset - 1); return; }
    if (act === 'today') { renderFortune(0); return; }
    if (act === 'copy') {
      if (currentFortune) {
        const f = currentFortune.f;
        copyText('【' + f.rank + '】' + f.line + '\n宜 ' + f.yi + ' · 忌 ' + f.ji +
                 '\n' + f.note + '\n—— 纸境工坊 · ' + currentFortune.day + ' 运势签');
        toast('运势签已复制');
      }
      return;
    }
    if (act === 'answer') { closePanel(); answerQuestion(); return; }
    if (act === 'moments') { closePanel(); scrollToSection('moments'); return; }
    if (act === 'essays') { closePanel(); scrollToSection('essays'); return; }
  }
  function jumpToMoment(id) {
    closePanel();
    const find = () => $$('.moment-entry').filter(x => x.getAttribute('data-moment-id') === id)[0];
    let el = find();
    if (!el && window.atelierV33 && typeof window.atelierV33.toggleScope === 'function') {
      window.atelierV33.toggleScope('moments', true);
      el = find();
    }
    scrollToSection('moments');
    setTimeout(() => {
      const target = el || find();
      if (!target) return;
      target.classList.add('is-v35-pulse');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => target.classList.remove('is-v35-pulse'), 2200);
    }, 420);
  }

  /* ── 5. 纸舟补一枚「运」；仅点击可开，绝不自动弹出 ────────────────── */
  function mountDockButton() {
    const items = $('.v33-dock-items');
    if (!items || $('#v35-dock-daily')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.id = 'v35-dock-daily';
    b.className = 'v33-dock-btn is-v35-daily';
    b.setAttribute('data-v35', 'daily');
    b.setAttribute('aria-label', '今日运势 · 点开才显');
    b.innerHTML = '<span class="v33-dock-glyph" aria-hidden="true">运</span>' +
                  '<span class="v33-dock-tip">今日运势 · 点开才显</span>';
    items.insertBefore(b, items.firstChild);
  }
  function bindDockSwipe() {
    const dock = $('#v33-dock');
    if (!dock) return;
    let x0 = 0, y0 = 0, t0 = 0;
    dock.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; t0 = Date.now();
    }, { passive: true });
    dock.addEventListener('touchend', (e) => {
      if (!x0 || !e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - x0;
      const dy = e.changedTouches[0].clientY - y0;
      x0 = 0;
      if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.3 || Date.now() - t0 > 800) return;
      if (window.innerWidth > 768) return;
      const y = window.scrollY + 100;
      let cur = 0;
      SECTION_IDS.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top + window.scrollY <= y) cur = i;
      });
      const next = Math.max(0, Math.min(SECTION_IDS.length - 1, cur + (dx < 0 ? 1 : -1)));
      if (next === cur) return;
      const target = document.getElementById(SECTION_IDS[next]);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      const h = target.querySelector('.sec-title');
      toast('纸舟 · ' + (h ? h.textContent : SECTION_IDS[next]));
    }, { passive: true });
  }

  /* ── 6. 速查笺补记 + 命令台口令 ───────────────────────────────────── */
  function bindSheet() {
    const body = $('#atelier-sheet-body');
    if (!body || !('MutationObserver' in window)) return;
    new MutationObserver(() => {
      const title = $('#atelier-sheet-title');
      if (!title || title.textContent !== '纸境速查') return;
      if (body.querySelector('[data-v35-shortcuts]')) return;
      const d = document.createElement('div');
      d.setAttribute('data-v35-shortcuts', '1');
      d.className = 'shortcut-grid v33-shortcut-extra';
      d.innerHTML =
        '<div class="shortcut-row"><span class="shortcut-key">运势签</span><span>纸舟「运」钮点开才显，一日一签</span></div>' +
        '<div class="shortcut-row"><span class="shortcut-key">今日一问</span><span>留言区一键应答，回应按话题聚合</span></div>' +
        '<div class="shortcut-row"><span class="shortcut-key">本月回看</span><span>点「此刻」的本月已阅，可逐篇重读</span></div>' +
        '<div class="shortcut-row"><span class="shortcut-key">小屏纸舟</span><span>横排贴底，左右滑动切换章节</span></div>';
      body.appendChild(d);
    }).observe(body, { childList: true });
  }
  const origRunSearch = window.runSearch;
  if (typeof origRunSearch === 'function') {
    window.runSearch = function (q) {
      const s = typeof q === 'string' ? q.trim() : '';
      if (['>运势', '>今日运势', '>求签', '>今日签', '>每日签', '>抽签'].indexOf(s) !== -1) { openPanel('daily'); return; }
      if (s === '>共鸣榜' || s === '>月榜') { openPanel('board'); return; }
      if (s === '>回看' || s === '>本月') { openPanel('read'); return; }
      if (s === '>一问' || s === '>每日一问') { answerQuestion(); return; }
      return origRunSearch.apply(this, arguments);
    };
  }

  /* ── 7. 事件委托与启动 ────────────────────────────────────────────── */
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    const act = t.closest('[data-v35-panel]');
    if (act) { handlePanelAct(act.getAttribute('data-v35-panel')); return; }
    if (t.closest('#v35-now-daily') || t.closest('[data-v35="daily"]')) { openPanel('daily'); return; }
    if (t.closest('#v35-board-open')) { openPanel('board'); return; }
    if (t.closest('#v35-read-count')) { openPanel('read'); return; }
    if (t.closest('#v35-q-answer')) { answerQuestion(); return; }
    if (t.closest('#v35-q-echoes')) { echoesOpen = !echoesOpen; refreshQuestionBar(); return; }
    const goto = t.closest('[data-v35-goto]');
    if (goto) { jumpToMoment(goto.getAttribute('data-v35-goto')); return; }
    const open = t.closest('[data-v35-open]');
    if (open) {
      const a = ((typeof articles !== 'undefined' && Array.isArray(articles)) ? articles : [])
        .find(x => String(x.id) === open.getAttribute('data-v35-open'));
      closePanel();
      if (a && typeof window.openReader === 'function') window.openReader(a);
      return;
    }
    if (t.id === 'v35-panel') closePanel();
  });
  document.addEventListener('keydown', (e) => {
    // v37 · 运势签坚持「用户不主动点不弹出」：移除 D 键触发，只保留 Escape 收起
    if (e.key === 'Escape') { closePanel(); return; }
  });

  function boot() {
    mountDockButton();
    mountPanel();
    installQuestionBridge();
    bindDockSwipe();
    bindSheet();
    todayQ = makeQuestion();
    const saved = store.get(LS.question, null);
    if (saved && saved.day === todayQ.day && saved.id === todayQ.id) pendingQ = saved;
    refreshQuestionBar();
    refreshReadCount();
    visitStreak();
    loadQuestions();
    const wall = $('#messages-wall');
    if (wall && 'MutationObserver' in window) {
      new MutationObserver(() => refreshQuestionBar()).observe(wall, { childList: true });
    }
    setTimeout(refreshQuestionBar, 1200);
    setTimeout(refreshReadCount, 1200);
  }
  window.atelierV35 = {
    openPanel: openPanel, closePanel: closePanel, answer: answerQuestion,
    refreshQuestion: refreshQuestionBar, refreshRead: refreshReadCount,
    question: () => todayQ, streak: visitStreak
  };
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();





/* ==========================================================================
   v39 · 纸境立体 (Paper Atelier 3D Stage) + 触感互动层
   零依赖：Canvas 2D 手写透视投影，不用 WebGL / three.js
   A 顶部 3D 舞台：朱砂印立方 + 五张章节纸页环绕，可拖动、点纸页跳章节
   B 片头影片：按需加载 /intro.mp4，不点不下载
   C 卡片微倾 + 纸面反光   D 导航墨痕滑块   E 返回顶部阅读进度环   F 印章可盖
   ========================================================================== */
(function atelierV39() {
  'use strict';
  const reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const finePointer = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);

  /* ── A. 3D 舞台 ───────────────────────────────────────────────────── */
  const SHEETS = [
    { id: 'essays',    num: '01', title: '文墨', desc: '长文与技术沉淀' },
    { id: 'moments',   num: '02', title: '闪念', desc: '随手记下的念头' },
    { id: 'timeline',  num: '03', title: '足迹', desc: '一路走来的刻度' },
    { id: 'guestbook', num: '04', title: '留墨', desc: '给工坊留一句话' }
  ];
  const SEAL_FACES = ['纸', '境', '工', '坊'];

  function cssVar(name, fallback) {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  function parseColor(str) {
    const c = document.createElement('canvas').getContext('2d');
    c.fillStyle = '#000'; c.fillStyle = str;
    const s = c.fillStyle;
    if (s[0] === '#') return [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
    const m = s.match(/[\d.]+/g) || [0, 0, 0];
    return [+m[0], +m[1], +m[2]];
  }
  const rgb = (c, k, a) => `rgba(${Math.round(c[0] * k)},${Math.round(c[1] * k)},${Math.round(c[2] * k)},${a == null ? 1 : a})`;

  function initStage() {
    const stage = document.getElementById('v39-stage');
    const canvas = document.getElementById('v39-canvas');
    if (!stage || !canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    const tip = document.getElementById('v39-tip');
    let W = 0, H = 0, dpr = 1;
    let pal = {};
    function readPalette() {
      pal = {
        paper: parseColor(cssVar('--bg-card', '#fdfcf9')),
        ink: parseColor(cssVar('--text-title', '#1f1c18')),
        muted: parseColor(cssVar('--text-muted', '#6b645a')),
        seal: parseColor(cssVar('--brand-seal', '#a8322b')),
        dark: document.documentElement.getAttribute('data-theme') === 'dark'
      };
    }
    readPalette();
    new MutationObserver(readPalette).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    function resize() {
      const r = stage.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, Math.round(r.width * dpr));
      H = Math.max(1, Math.round(r.height * dpr));
      canvas.width = W; canvas.height = H;
    }
    resize();
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
    else window.addEventListener('resize', resize);

    // v57: 东方金石水墨与古金箔浮尘微粒 (三维景深层级分布)
    const dots = [];
    for (let i = 0; i < 110; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 2.8 + Math.random() * 2.2;
      const s = Math.sqrt(1 - u * u);
      const rnd = Math.random();
      const kind = rnd < 0.6 ? 0 : (rnd < 0.85 ? 1 : 2); // 0=墨尘(60%), 1=古金箔(25%), 2=赤砂微星(15%)
      dots.push({
        x: r * s * Math.cos(th),
        y: u * r * 0.62,
        z: r * s * Math.sin(th),
        s: (kind === 0 ? 0.65 : 1.15) + Math.random() * 1.4,
        ph: Math.random() * 6.28,
        kind: kind,
        twinkle: 1.6 + Math.random() * 1.8
      });
    }

    let yaw = 0.35, pitch = -0.22, vYaw = 0, dragging = false, lastX = 0, lastY = 0, moved = 0;
    let hover = -1, t0 = performance.now(), t = 0, visible = true, raf = 0;
    const lift = SHEETS.map(() => 0);
    let sheetPolys = [];

    function project(p) {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      let x = p[0] * cy - p[2] * sy, z = p[0] * sy + p[2] * cy;
      let y = p[1] * cp - z * sp; z = p[1] * sp + z * cp;
      const dist = 9.5, f = Math.min(W, H * 1.6) * 0.62;
      const zz = z + dist;
      return { x: W / 2 + (x * f) / zz, y: H * 0.52 + (y * f) / zz, z: zz };
    }
    function rotY(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c]; }
    function rotX(p, a) { const c = Math.cos(a), s = Math.sin(a); return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c]; }
    function viewNormal(n) { // 只需旋转，不需平移
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      let x = n[0] * cy - n[2] * sy, z = n[0] * sy + n[2] * cy;
      const y = n[1] * cp - z * sp; z = n[1] * sp + z * cp;
      return [x, y, z];
    }
    function poly(pts) {
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
    }
    function mapTo(p0, p1, p3, w, h) {
      ctx.setTransform((p1.x - p0.x) / w, (p1.y - p0.y) / w, (p3.x - p0.x) / h, (p3.y - p0.y) / h, p0.x, p0.y);
    }
    const LIGHT = (() => { const l = [-0.4, -0.7, -0.6]; const m = Math.hypot(...l); return l.map(v => v / m); })();
    const shade = (n) => 0.72 + 0.28 * Math.max(0, -(n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]));

    function frame(now) {
      raf = 0;
      if (!reduceMotion) t = (now - t0) / 1000;
      if (!dragging) { yaw += vYaw; vYaw *= 0.94; if (!reduceMotion && Math.abs(vYaw) < 0.0008) yaw += 0.0016; }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);

      // 地面柔影
      const g = project([0, 1.9, 0]);
      const grad = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, W * 0.28);
      grad.addColorStop(0, rgb(pal.dark ? [0, 0, 0] : pal.ink, 1, pal.dark ? 0.35 : 0.08));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.save(); ctx.translate(g.x, g.y); ctx.scale(1, 0.22); ctx.translate(-g.x, -g.y);
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H); ctx.restore();

      const faces = [];
      // 朱砂印立方
      const spin = t * 0.35, bob = Math.sin(t * 1.1) * 0.08, S = 0.72;
      const cubeV = [];
      for (let i = 0; i < 8; i++) {
        let p = [(i & 1 ? 1 : -1) * S, (i & 2 ? 1 : -1) * S, (i & 4 ? 1 : -1) * S];
        p = rotX(rotY(p, spin), 0.18); p[1] += bob - 0.15;
        cubeV.push(p);
      }
      // 每面顶点顺序保证 u×v 指向内侧，这样从外侧看文字不镜像
      const CF = [[0, 1, 3, 2, 0], [1, 5, 7, 3, 1], [5, 4, 6, 7, 2], [4, 0, 2, 6, 3], [0, 4, 5, 1, -1], [2, 3, 7, 6, -1]];
      CF.forEach(f => {
        const a = cubeV[f[0]], b = cubeV[f[1]], d = cubeV[f[3]];
        const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
        let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const m = Math.hypot(...n); n = n.map(x => -x / m); // 取外法线
        const vn = viewNormal(n);
        if (vn[2] > 0) return; // 背面剔除
        const pts = [a, b, cubeV[f[2]], d].map(project);
        faces.push({ z: pts.reduce((s, p) => s + p.z, 0) / 4, kind: 'cube', pts, n, label: f[4] });
      });

      // 五张纸页
      SHEETS.forEach((s, i) => {
        const ang = (i / SHEETS.length) * Math.PI * 2 + t * 0.12;
        const R = 2.75 + lift[i] * 0.35, hw = 0.62, hh = 0.82;
        const cy = Math.sin(t * 0.9 + i * 1.3) * 0.18 - 0.1;
        const cx = Math.sin(ang) * R, cz = Math.cos(ang) * R;
        const tx = -Math.cos(ang), tz = Math.sin(ang); // 切向（使正面文字朝外可读）
        const tilt = 0.12;
        const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([u, v]) =>
          [cx + tx * u, cy + v + tilt * u * 0.2, cz + tz * u]);
        const n = [Math.sin(ang), 0, Math.cos(ang)];
        const vn = viewNormal(n);
        const pts = corners.map(project);
        faces.push({ z: pts.reduce((a, p) => a + p.z, 0) / 4, kind: 'sheet', pts, n, front: vn[2] > 0 ? false : true, i });
      });

      faces.sort((a, b) => b.z - a.z);

      // 远处墨点与金箔纸屑微粒
      const dp = dots.map(d => {
        const p = project(rotY([d.x, d.y + Math.sin(t + d.ph) * 0.12, d.z], t * 0.05));
        p.s = d.s; p.kind = d.kind; p.ph = d.ph; p.twinkle = d.twinkle;
        return p;
      });
      const drawDots = (far) => dp.forEach(d => {
        if ((d.z > 9.5) !== far) return;
        const distA = Math.max(0.06, Math.min(0.75, 1.65 - d.z / 9.2));
        const tw = 0.72 + 0.28 * Math.sin(t * d.twinkle + d.ph);
        if (d.kind === 1) { // 古法金箔 (暖金微光闪烁)
          ctx.fillStyle = `rgba(218, 175, 55, ${(distA * tw * (pal.dark ? 0.75 : 0.55)).toFixed(3)})`;
        } else if (d.kind === 2) { // 赤砂微星 (朱砂红星芒)
          ctx.fillStyle = `rgba(184, 59, 59, ${(distA * tw * 0.65).toFixed(3)})`;
        } else { // 传统淡墨微尘
          ctx.fillStyle = rgb(pal.ink, 1, distA * (pal.dark ? 0.55 : 0.32));
        }
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.s * dpr * (9.8 / d.z), 0, 6.283);
        ctx.fill();
      });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawDots(true);

      sheetPolys = [];
      faces.forEach(f => {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const k = shade(f.n);
        if (f.kind === 'cube') {
          poly(f.pts);
          ctx.fillStyle = rgb(pal.seal, k * (f.label < 0 ? 0.82 : 1));
          ctx.fill();
          ctx.strokeStyle = rgb(pal.seal, 0.6, 0.6); ctx.lineWidth = 1 * dpr; ctx.stroke();
          if (f.label >= 0) {
            mapTo(f.pts[0], f.pts[1], f.pts[3], 100, 100);
            ctx.strokeStyle = 'rgba(255,248,235,0.55)'; ctx.lineWidth = 3;
            ctx.strokeRect(9, 9, 82, 82);
            ctx.fillStyle = 'rgba(255,248,235,0.95)';
            ctx.font = '600 58px "Songti SC","Noto Serif CJK SC","Source Han Serif SC",serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(SEAL_FACES[f.label], 50, 54);
          }
        } else {
          const hl = f.i === hover;
          poly(f.pts);
          ctx.shadowColor = 'rgba(0,0,0,' + (pal.dark ? 0.5 : 0.12) + ')';
          ctx.shadowBlur = (hl ? 26 : 14) * dpr; ctx.shadowOffsetY = 6 * dpr;
          ctx.fillStyle = rgb(pal.paper, f.front ? k : k * 0.9);
          ctx.fill();
          ctx.shadowColor = 'transparent';
          ctx.strokeStyle = hl ? rgb(pal.seal, 1, 0.8) : rgb(pal.ink, 1, 0.12);
          ctx.lineWidth = (hl ? 1.6 : 1) * dpr; ctx.stroke();
          const s = SHEETS[f.i];
          if (f.front) {
            mapTo(f.pts[0], f.pts[1], f.pts[3], 124, 164);

            // 1. 竹尾特种纸漫反射流光质感 (Takeo Specular Sheen)
            const ang = (f.i / SHEETS.length) * Math.PI * 2 + t * 0.12;
            const sheenGrad = ctx.createLinearGradient(0, 0, 124, 164);
            const sheenPos = (Math.sin(ang + t * 0.45) + 1) * 0.5;
            sheenGrad.addColorStop(Math.max(0, sheenPos - 0.28), 'rgba(255,255,255,0)');
            sheenGrad.addColorStop(sheenPos, pal.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.28)');
            sheenGrad.addColorStop(Math.min(1, sheenPos + 0.28), 'rgba(255,255,255,0)');
            ctx.fillStyle = sheenGrad;
            ctx.fillRect(0, 0, 124, 164);

            // 2. 纸张右上角古典书籍折角 (Takeo Paper Dog-Ear Fold)
            const foldW = 20;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(124 - foldW, 0);
            ctx.lineTo(124 - foldW, foldW);
            ctx.lineTo(124, foldW);
            ctx.closePath();
            ctx.fillStyle = pal.dark ? 'rgba(56, 52, 48, 0.95)' : 'rgba(235, 230, 218, 0.95)';
            ctx.fill();
            ctx.strokeStyle = rgb(pal.seal, 1, 0.3);
            ctx.lineWidth = 0.8;
            ctx.stroke();
            ctx.restore();

            // 3. 内衬装裱细线
            ctx.strokeStyle = rgb(pal.ink, 1, pal.dark ? 0.08 : 0.05);
            ctx.lineWidth = 0.6;
            ctx.strokeRect(6, 6, 112, 152);

            ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
            ctx.fillStyle = rgb(pal.seal, 1, 0.92);
            ctx.font = '600 13px ui-monospace,Menlo,Consolas,monospace';
            ctx.fillText(s.num, 14, 26);
            ctx.fillStyle = rgb(pal.ink, 1, 0.92);
            ctx.font = '600 30px "Songti SC","Noto Serif CJK SC","Source Han Serif SC",serif';
            ctx.fillText(s.title, 14, 72);
            ctx.fillStyle = rgb(pal.muted, 1, 0.9);
            ctx.font = '11px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
            ctx.fillText(s.desc, 14, 96);
            ctx.strokeStyle = rgb(pal.ink, 1, 0.1); ctx.lineWidth = 1;
            for (let l = 0; l < 3; l++) { ctx.beginPath(); ctx.moveTo(14, 118 + l * 11); ctx.lineTo(110 - l * 18, 118 + l * 11); ctx.stroke(); }
            
            // 朱砂印鉴微标
            ctx.fillStyle = rgb(pal.seal, 1, hl ? 0.95 : 0.65);
            ctx.fillRect(94, 134, 18, 18);
            ctx.fillStyle = '#fff9f0';
            ctx.font = '600 10px serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('印', 103, 144);

            sheetPolys.push({ i: f.i, pts: f.pts });
          }
        }
      });
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawDots(false);

      SHEETS.forEach((_, i) => { lift[i] += ((i === hover ? 1 : 0) - lift[i]) * 0.15; });
      if (visible && !reduceMotion) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }

    function inside(px, py, pts) {
      let c = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        if (((pts[i].y > py) !== (pts[j].y > py)) && (px < (pts[j].x - pts[i].x) * (py - pts[i].y) / (pts[j].y - pts[i].y) + pts[i].x)) c = !c;
      }
      return c;
    }
    function pick(e) {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr;
      for (let k = sheetPolys.length - 1; k >= 0; k--) if (inside(x, y, sheetPolys[k].pts)) return sheetPolys[k].i;
      return -1;
    }
    function go(i) {
      const el = document.getElementById(SHEETS[i].id);
      if (el) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }

    canvas.addEventListener('pointerdown', (e) => {
      dragging = true; moved = 0; lastX = e.clientX; lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId); stage.classList.add('is-dragging');
    });
    canvas.addEventListener('pointermove', (e) => {
      if (dragging) {
        const dx = e.clientX - lastX, dy = e.clientY - lastY;
        moved += Math.abs(dx) + Math.abs(dy);
        yaw += dx * 0.008; vYaw = dx * 0.008;
        pitch = Math.max(-0.7, Math.min(0.25, pitch + dy * 0.004));
        lastX = e.clientX; lastY = e.clientY;
        kick();
        return;
      }
      const h = pick(e);
      if (h !== hover) {
        hover = h;
        canvas.style.cursor = h >= 0 ? 'pointer' : 'grab';
        if (tip) {
          tip.textContent = h >= 0 ? `前往 ${SHEETS[h].num} · ${SHEETS[h].title}` : '';
          tip.classList.toggle('is-on', h >= 0);
        }
        kick();
      }
      if (tip && h >= 0) {
        const r = stage.getBoundingClientRect();
        tip.style.transform = `translate(${e.clientX - r.left + 14}px, ${e.clientY - r.top + 14}px)`;
      }
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false; stage.classList.remove('is-dragging');
      if (moved < 6) { const h = pick(e); if (h >= 0) go(h); }
      kick();
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('pointerleave', () => { if (!dragging && hover !== -1) { hover = -1; tip && tip.classList.remove('is-on'); kick(); } });

    // 键盘可达：左右键转动，回车进入正对的那张纸页
    canvas.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { vYaw = -0.05; kick(); e.preventDefault(); }
      else if (e.key === 'ArrowRight') { vYaw = 0.05; kick(); e.preventDefault(); }
      else if (e.key === 'Enter') {
        let best = -1, bz = Infinity;
        sheetPolys.forEach(p => { const z = p.pts.reduce((s, q) => s + q.z, 0); if (z < bz) { bz = z; best = p.i; } });
        if (best >= 0) go(best);
      }
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((en) => { visible = en[0].isIntersecting; if (visible) kick(); }).observe(stage);
    }
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) kick(); });
    // 主题切换后重绘一帧（动效关闭时尤需）
    new MutationObserver(() => setTimeout(kick, 30)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(kick);
    kick();
    stage.classList.add('is-ready');
  }

  /* ── B. 片头影片：点击才加载 ──────────────────────────────────────── */
  function initFilm() {
    const btn = document.getElementById('v39-film-btn');
    const box = document.getElementById('v39-film');
    if (!btn || !box) return;
    const close = () => {
      const v = box.querySelector('video');
      if (v) { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); }
      box.hidden = true; btn.setAttribute('aria-expanded', 'false');
      btn.focus();
    };
    btn.addEventListener('click', () => {
      if (!box.hidden) return close();
      const v = document.createElement('video');
      v.src = '/intro.mp4?v=' + CURRENT_RELEASE_VER;
      v.poster = '/intro-poster.jpg?v=' + CURRENT_RELEASE_VER;
      v.controls = true; v.autoplay = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('playsinline', '');
      v.addEventListener('ended', close);
      box.querySelector('.v39-film-frame').appendChild(v);
      box.hidden = false; btn.setAttribute('aria-expanded', 'true');
      const p = v.play(); if (p && p.catch) p.catch(() => {});
    });
    box.querySelector('.v39-film-close')?.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) close(); });
  }

  /* ── C. 卡片微倾 + 纸面反光（仅精确指针，尊重减弱动效） ─────────── */
  function initTilt() {
    if (!finePointer || reduceMotion) return;
    const SEL = '.artifact-card, .tl-card, .metric-card, .featured-essay-card';
    let cur = null, rafId = 0, mx = 0, my = 0;
    function apply() {
      rafId = 0;
      if (!cur) return;
      const r = cur.getBoundingClientRect();
      const px = (mx - r.left) / r.width, py = (my - r.top) / r.height;
      cur.style.setProperty('--v39-rx', ((0.5 - py) * 5).toFixed(2) + 'deg');
      cur.style.setProperty('--v39-ry', ((px - 0.5) * 6).toFixed(2) + 'deg');
      cur.style.setProperty('--v39-gx', (px * 100).toFixed(1) + '%');
      cur.style.setProperty('--v39-gy', (py * 100).toFixed(1) + '%');
    }
    document.addEventListener('pointermove', (e) => {
      const el = e.target.closest ? e.target.closest(SEL) : null;
      if (el !== cur) {
        if (cur) cur.classList.remove('v39-tilting');
        cur = el;
        if (cur) cur.classList.add('v39-tilting');
      }
      mx = e.clientX; my = e.clientY;
      if (cur && !rafId) rafId = requestAnimationFrame(apply);
    }, { passive: true });
    document.addEventListener('pointerleave', () => { if (cur) cur.classList.remove('v39-tilting'); cur = null; });
  }

  /* ── D. 导航墨痕：一道朱砂细线随悬停/当前章节滑动 ─────────────────── */
  function initNavInk() {
    const wrap = document.querySelector('.nav-links');
    if (!wrap) return;
    const bar = document.createElement('span');
    bar.className = 'v39-nav-ink'; bar.setAttribute('aria-hidden', 'true');
    wrap.appendChild(bar);
    const moveTo = (el) => {
      if (!el) { bar.style.opacity = '0'; return; }
      bar.style.opacity = '1';
      bar.style.width = el.offsetWidth * 0.5 + 'px';
      bar.style.transform = `translateX(${el.offsetLeft + el.offsetWidth * 0.25}px)`;
    };
    const active = () => wrap.querySelector('.nav-item.active');
    wrap.addEventListener('pointerover', (e) => { const a = e.target.closest('.nav-item'); if (a) moveTo(a); });
    wrap.addEventListener('pointerleave', () => moveTo(active()));
    new MutationObserver(() => { if (!wrap.matches(':hover')) moveTo(active()); })
      .observe(wrap, { subtree: true, attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', () => moveTo(active()));
    moveTo(active());
  }

  /* ── E. 返回顶部按钮外圈显示全页阅读进度 ─────────────────────────── */
  function initTopRing() {
    const btn = document.getElementById('btn-back-to-top');
    if (!btn || btn.querySelector('.v39-ring')) return;
    btn.insertAdjacentHTML('beforeend',
      '<svg class="v39-ring" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" pathLength="100"></circle></svg>');
    const c = btn.querySelector('.v39-ring circle');
    let tick = false;
    const upd = () => {
      tick = false;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      c.style.strokeDashoffset = String(100 - p * 100);
    };
    window.addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
    upd();
  }

  /* ── F. 印章：点一下盖一下，连盖五次有小彩蛋 ─────────────────────── */
  function initSeal() {
    const seal = document.querySelector('.hero-meta-row .seal-stamp');
    if (!seal) return;
    seal.setAttribute('role', 'button');
    seal.setAttribute('tabindex', '0');
    seal.setAttribute('aria-label', '盖一枚纸境印');
    let n = 0, timer = 0;
    const press = () => {
      seal.classList.remove('v39-pressed'); void seal.offsetWidth; seal.classList.add('v39-pressed');
      n++; clearTimeout(timer); timer = setTimeout(() => { n = 0; }, 1600);
      const r = seal.getBoundingClientRect();
      const mark = document.createElement('span');
      mark.className = 'v39-stamp-mark';
      mark.textContent = n >= 5 ? '大吉' : '印';
      mark.style.left = (r.left + r.width / 2 + (Math.random() * 60 - 30)) + 'px';
      mark.style.top = (r.top + r.height / 2 - 40 + (Math.random() * 20 - 10)) + 'px';
      mark.style.setProperty('--v39-rot', (Math.random() * 24 - 12).toFixed(1) + 'deg');
      document.body.appendChild(mark);
      setTimeout(() => mark.remove(), 1400);
      if (n === 5) { n = 0; seal.classList.add('v39-lucky'); setTimeout(() => seal.classList.remove('v39-lucky'), 1600); }
    };
    seal.addEventListener('click', press);
    seal.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); press(); } });
  }

  function boot() {
    try { initStage(); } catch (e) { console.warn('[v39 stage]', e); }
    try { initFilm(); } catch (e) {}
    try { initTilt(); } catch (e) {}
    try { initNavInk(); } catch (e) {}
    try { initTopRing(); } catch (e) {}
    try { initSeal(); } catch (e) {}
  }
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

/* ======================== v41 · 留得住人：顺读 / 回访 / 足迹 ======================== */
(function () {
  'use strict';
  var KEY = 'atelier_v41_read';
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(m) { try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function minutes(a) { return Math.max(1, Math.ceil(String(a.content || '').replace(/<[^>]+>|\s+/g, '').length / 380)); }
  function list() { return (typeof articles !== 'undefined' && articles && articles.length) ? articles : []; }
  function markRead(id) { var m = load(); if (!m[id]) { m[id] = Date.now(); save(m); refreshStrip(); } }

  var readTimer = null, readScroller = null, readHandler = null;
  function trackRead(a) {
    clearTimeout(readTimer);
    if (readScroller && readHandler) readScroller.removeEventListener('scroll', readHandler);
    readTimer = setTimeout(function () { markRead(a.id); }, 25000);
    var sc = document.querySelector('#reader-drawer .drawer-body, #reader-drawer .reader-scroll, #reader-drawer');
    var cand = document.querySelectorAll('#reader-drawer *');
    for (var i = 0; i < cand.length; i++) { if (cand[i].scrollHeight > cand[i].clientHeight + 200 && /(auto|scroll)/.test(getComputedStyle(cand[i]).overflowY)) { sc = cand[i]; break; } }
    readScroller = sc;
    readHandler = function () {
      var max = sc.scrollHeight - sc.clientHeight;
      if (max > 0 && sc.scrollTop / max > 0.6) markRead(a.id);
    };
    sc.addEventListener('scroll', readHandler, { passive: true });
  }

  function nextOf(a) {
    var L = list(), read = load(), i = L.findIndex(function (x) { return x.id === a.id; });
    if (i < 0 || L.length < 2) return null;
    for (var k = 1; k < L.length; k++) {
      var c = L[(i + k) % L.length];
      if (!read[c.id]) return c;
    }
    return L[(i + 1) % L.length];
  }

  function injectNext(a) {
    var old = document.querySelector('.v41-next'); if (old) old.remove();
    var n = nextOf(a); if (!n) return;
    var read = load(), total = list().length, done = Object.keys(read).length;
    var anchor = document.querySelector('.related-essays') || document.querySelector('.reader-postlude');
    if (!anchor) return;
    var box = document.createElement('div');
    box.className = 'v41-next';
    box.innerHTML =
      '<div class="v41-next-eyebrow"><span>顺着读下去</span><span class="v41-next-count">已读 ' + Math.min(done, total) + ' / ' + total + '</span></div>' +
      '<button type="button" class="v41-next-card">' +
        '<span class="v41-next-cat">' + esc(n.category || '随笔') + ' · 约 ' + minutes(n) + ' 分钟</span>' +
        '<span class="v41-next-title">' + esc(n.title) + '</span>' +
        '<span class="v41-next-sum">' + esc(n.summary || '') + '</span>' +
        '<span class="v41-next-go">接着读 <i aria-hidden="true">→</i></span>' +
      '</button>' +
      '<div class="v41-next-bar"><i style="width:' + Math.round(Math.min(done, total) / Math.max(total, 1) * 100) + '%"></i></div>';
    anchor.parentNode.insertBefore(box, anchor);
    box.querySelector('.v41-next-card').addEventListener('click', function () {
      var sc = readScroller; if (sc) sc.scrollTo({ top: 0 });
      openReader(n);
    });
  }

  /* 回访提示条 */
  function refreshStrip() {
    var el = document.getElementById('v41-welcome'); if (!el) return;
    el.remove(); buildStrip(true);
  }
  function buildStrip(force) {
    var L = list(); if (!L.length) return false;
    if (!force && sessionStorage.getItem('v41_strip_off')) return true;
    if (sessionStorage.getItem('v41_strip_off')) return true;
    var read = load(), done = L.filter(function (a) { return read[a.id]; }).length;
    var pos = {}; try { pos = JSON.parse(localStorage.getItem('atelier_readpos_v26') || '{}') || {}; } catch (e) {}
    var resume = L.find(function (a) { return pos[a.id] && !read[a.id]; });
    var unread = L.find(function (a) { return !read[a.id]; });
    var target = resume || unread;
    var host = document.querySelector('#essays'); if (!host) return true;
    var el = document.createElement('div');
    el.id = 'v41-welcome'; el.className = 'v41-welcome';
    var msg;
    if (!done) msg = '初次到访？不妨从这一篇开始：';
    else if (done >= L.length) msg = '全部读完了，谢谢你的耐心。随手翻一篇旧文？';
    else msg = '欢迎回来，已读 ' + done + ' / ' + L.length + ' 篇。' + (resume ? '上次读到一半：' : '下一篇推荐：');
    if (done >= L.length) target = L[Math.floor(Math.random() * L.length)];
    el.innerHTML = '<span class="v41-welcome-dot"></span><span class="v41-welcome-msg">' + esc(msg) + '</span>' +
      (target ? '<button type="button" class="v41-welcome-go">《' + esc(target.title) + '》</button>' : '') +
      '<button type="button" class="v41-welcome-x" aria-label="关闭">×</button>';
    host.parentNode.insertBefore(el, host);
    var go = el.querySelector('.v41-welcome-go');
    if (go) go.addEventListener('click', function () { openReader(target); });
    el.querySelector('.v41-welcome-x').addEventListener('click', function () { sessionStorage.setItem('v41_strip_off', '1'); el.remove(); });
    return true;
  }
  var tries = 0, iv = setInterval(function () {
    tries++;
    if ((list().length && buildStrip()) || tries > 40) clearInterval(iv);
  }, 400);

  /* 挂接 openReader 与直链直达 */
  window.v41InjectNext = injectNext;
  var orig = window.openReader || (typeof openReader === 'function' ? openReader : null);
  if (orig) {
    window.openReader = openReader = function (a) {
      var r = orig.apply(this, arguments);
      try { if (a) { trackRead(a); setTimeout(function () { injectNext(a); }, 120); } } catch (e) {}
      return r;
    };
  }

  /* 滚动显现：卡片入场更柔和 */
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('v41-in'); io.unobserve(e.target); } });
    }, { threshold: 0.08 });
    var seen = new WeakSet();
    setInterval(function () {
      document.querySelectorAll('.essay-card, .moment-card, .artifact-card, .timeline-item, .featured-essay-card').forEach(function (n) {
        if (!seen.has(n)) { seen.add(n); n.classList.add('v41-reveal'); io.observe(n); }
      });
    }, 1200);
  }
})();
/* ======================== v41 · 完 ======================== */


/* ======================== v48 · 东方文墨微交互与动态打字机系统 (自愈增强版) ======================== */
(function initV48Suite() {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // -------------------------------------------------------------------------
  // 场景 1: Hero 顶部「文墨打字机」（开屏即打 + 水墨晕开 + 朱砂微印 + 交互换笺）
  // -------------------------------------------------------------------------
  var heroPhrases = [
    "在微云之境，构筑自治的工程工作流与思想自留地。",
    "真正的零外部依赖 · 日本竹尾素纸的宁静阅读心境。",
    "探寻 Linux 内核、存储引擎与网络协议的底层之道。",
    "让文字、代码与运行中的造物，在数字领地从容常驻。",
    "水墨微润，代码清澈，在算法洪流中保留纯粹沉淀。",
    "人机共生与独立自治：一位工匠对极简系统的求索实录。"
  ];

  window.updateHeroTypewriter = function (newPhrase) {
    if (newPhrase && typeof newPhrase === 'string') {
      var trimmed = newPhrase.trim();
      if (trimmed && heroPhrases.indexOf(trimmed) === -1) {
        heroPhrases.unshift(trimmed);
      }
    }
  };

  function initHeroTypewriter() {
    var bannerEl = document.getElementById('site-subtitle-display');
    if (!bannerEl) return;

    var textEl = document.getElementById('hero-typewriter-text');
    var refreshBtn = document.getElementById('hero-typewriter-refresh');

    // 结构自愈：自动适配并恢复文墨打字机 Banner
    if (!textEl) {
      bannerEl.innerHTML = '<div class="typewriter-seal-tag" aria-hidden="true"><span class="seal-glyph">墨</span><span class="seal-text">引</span></div><div class="typewriter-content-wrap"><span class="typewriter-text" id="hero-typewriter-text"></span><span class="typewriter-cursor" aria-hidden="true"></span></div><button type="button" class="typewriter-refresh-btn" id="hero-typewriter-refresh" title="点击换一笺" aria-label="换一笺"><svg class="refresh-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg><span class="refresh-text">换一笺</span></button>';
      textEl = document.getElementById('hero-typewriter-text');
      refreshBtn = document.getElementById('hero-typewriter-refresh');
    }

    if (reduceMotion) {
      textEl.textContent = heroPhrases[0];
      return;
    }

    var pIdx = 0;
    var charIdx = 0;
    var isDeleting = false;
    var isPaused = false;
    var timer = null;

    bannerEl.addEventListener('mouseenter', function () { isPaused = true; });
    bannerEl.addEventListener('mouseleave', function () { isPaused = false; });

    // 交互式“换一笺”
    function nextPhrase() {
      if (isDeleting) return;
      isDeleting = true;
      if (timer) clearTimeout(timer);
      tick();
    }

    if (refreshBtn) {
      refreshBtn.addEventListener('click', function(e) {
        e.stopPropagation();
        nextPhrase();
      });
    }
    bannerEl.addEventListener('click', function(e) {
      if (e.target && (e.target.closest('#hero-typewriter-refresh') || e.target.tagName === 'BUTTON')) return;
      nextPhrase();
    });

    // 水墨逐字落笔晕染渲染器
    function renderInkChars(phrase, count, isFresh) {
      var frag = document.createDocumentFragment();
      for (var i = 0; i < count; i++) {
        var span = document.createElement('span');
        span.className = 'ink-char' + (isFresh && i === count - 1 ? ' ink-fresh' : '');
        span.textContent = phrase[i];
        frag.appendChild(span);
      }
      textEl.innerHTML = '';
      textEl.appendChild(frag);
    }

    function tick() {
      if (!document.getElementById('hero-typewriter-text')) {
        textEl = document.getElementById('hero-typewriter-text');
        if (!textEl) return;
      }

      if (isPaused) {
        timer = setTimeout(tick, 200);
        return;
      }

      var currentPhrase = heroPhrases[pIdx] || heroPhrases[0];

      if (isDeleting) {
        charIdx--;
        renderInkChars(currentPhrase, Math.max(0, charIdx), false);
        if (charIdx <= 0) {
          isDeleting = false;
          pIdx = (pIdx + 1) % heroPhrases.length;
          timer = setTimeout(tick, 380);
          return;
        }
        timer = setTimeout(tick, 22);
      } else {
        charIdx++;
        renderInkChars(currentPhrase, charIdx, true);
        if (charIdx >= currentPhrase.length) {
          isDeleting = true;
          timer = setTimeout(tick, 4200); // 完整句停驻 4.2 秒
          return;
        }
        var lastChar = currentPhrase[charIdx - 1];
        var delay = (lastChar === '，' || lastChar === '·' || lastChar === '。' || lastChar === '、') ? 220 : (lastChar === '：' || lastChar === ' ') ? 160 : 56;
        timer = setTimeout(tick, delay);
      }
    }

    // ★ 开屏立显
    textEl.innerHTML = '';
    charIdx = 0;
    isDeleting = false;
    if (timer) clearTimeout(timer);
    timer = setTimeout(tick, 120);
  }

  // -------------------------------------------------------------------------
  // 场景 2: 长文阅读「AI 墨心导读 · 现场提笔流式打字」
  // -------------------------------------------------------------------------
  var activeLensTyping = null;

  function renderInkLens(article) {
    var summaryEl = document.getElementById('reader-summary');
    if (!summaryEl) return;

    var oldCard = document.getElementById('ink-lens-card');
    if (oldCard) oldCard.remove();
    if (activeLensTyping) {
      clearTimeout(activeLensTyping);
      activeLensTyping = null;
    }

    var insights = article.insights;
    if (!Array.isArray(insights) || insights.length === 0) return;

    var card = document.createElement('div');
    card.id = 'ink-lens-card';
    card.className = 'ink-lens-card';
    card.innerHTML = 
      '<div class="ink-lens-header">' +
        '<div class="ink-lens-title">' +
          '<span class="ink-lens-icon">🏮</span>' +
          '<span>墨心三得 · 30 秒认知透镜</span>' +
        '</div>' +
        '<button type="button" class="ink-lens-skip" id="ink-lens-skip" title="跳过打字动效，即刻全显">跳过墨痕 ↗</button>' +
      '</div>' +
      '<ul class="ink-lens-list" id="ink-lens-list"></ul>';

    summaryEl.parentNode.insertBefore(card, summaryEl.nextSibling);

    var listEl = card.querySelector('#ink-lens-list');
    var skipBtn = card.querySelector('#ink-lens-skip');

    function esc(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function showInstantly() {
      if (activeLensTyping) clearTimeout(activeLensTyping);
      activeLensTyping = null;
      listEl.innerHTML = insights.map(function (it) {
        return '<li class="ink-lens-item">' +
          '<span class="ink-lens-bullet">❖</span>' +
          '<span class="ink-lens-text">' + esc(it) + '</span>' +
        '</li>';
      }).join('');
      skipBtn.style.display = 'none';
    }

    skipBtn.addEventListener('click', showInstantly);

    if (reduceMotion) {
      showInstantly();
      return;
    }

    var lineIdx = 0;
    var cIdx = 0;

    function prepareNextLine() {
      if (lineIdx >= insights.length) {
        skipBtn.style.display = 'none';
        activeLensTyping = null;
        return;
      }
      var li = document.createElement('li');
      li.className = 'ink-lens-item';
      li.innerHTML = '<span class="ink-lens-bullet">❖</span><span class="ink-lens-text"></span><span class="ink-lens-typing-cursor">|</span>';
      listEl.appendChild(li);
      var textSpan = li.querySelector('.ink-lens-text');
      var cursorSpan = li.querySelector('.ink-lens-typing-cursor');
      cIdx = 0;

      function typeChar() {
        var lineText = insights[lineIdx];
        if (cIdx < lineText.length) {
          textSpan.textContent += lineText[cIdx];
          cIdx++;
          var ch = lineText[cIdx - 1];
          var delay = (ch === '：' || ch === '，' || ch === '；' || ch === '。') ? 85 : 24;
          activeLensTyping = setTimeout(typeChar, delay);
        } else {
          cursorSpan.remove();
          lineIdx++;
          activeLensTyping = setTimeout(prepareNextLine, 180);
        }
      }

      typeChar();
    }

    activeLensTyping = setTimeout(prepareNextLine, 280);
  }

  // -------------------------------------------------------------------------
  // 场景 3: 全文检索（Ctrl+K）浮窗的「打字机动态引导与水墨晕染」
  // -------------------------------------------------------------------------
  function initEnhancedSearch() {
    var openBtn = document.getElementById('btn-open-search');
    var modal = document.getElementById('search-modal');
    var input = document.getElementById('search-input');
    var resultsList = document.getElementById('search-results-list');
    if (!modal || !input || !resultsList) return;

    if (openBtn) {
      openBtn.addEventListener('click', function () {
        if (typeof openSearchModal === 'function') openSearchModal();
      });
    }

    var placeholders = [
      '键入 "零拷贝" 检索内核 I/O ...',
      '键入 "LSM-Tree" 检索存储引擎 ...',
      '键入 "TLS 1.3" 检索网络安全 ...',
      '键入 "单体架构" 检索系统退火 ...',
      '键入 "布隆过滤器" 检索海量去重 ...',
      '键入 "微服务" 检索 gRPC 协议 ...'
    ];

    var phIdx = 0;
    var phChar = 0;
    var phDeleting = false;
    var phTimer = null;

    function tickPlaceholder() {
      if (document.activeElement === input && input.value) {
        phTimer = setTimeout(tickPlaceholder, 500);
        return;
      }
      var cur = placeholders[phIdx];
      if (phDeleting) {
        phChar--;
        input.setAttribute('placeholder', cur.slice(0, phChar));
        if (phChar <= 0) {
          phDeleting = false;
          phIdx = (phIdx + 1) % placeholders.length;
          phTimer = setTimeout(tickPlaceholder, 400);
          return;
        }
        phTimer = setTimeout(tickPlaceholder, 28);
      } else {
        phChar++;
        input.setAttribute('placeholder', cur.slice(0, phChar));
        if (phChar >= cur.length) {
          phDeleting = true;
          phTimer = setTimeout(tickPlaceholder, 2800);
          return;
        }
        phTimer = setTimeout(tickPlaceholder, 58);
      }
    }

    if (!reduceMotion) {
      tickPlaceholder();
    }

    function esc(s) {
      return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function highlightText(text, query) {
      if (!query || !text) return esc(text || '');
      var escQ = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var regex = new RegExp('(' + escQ + ')', 'gi');
      return esc(text).replace(regex, '<mark class="ink-highlight">$1</mark>');
    }

    var selectedIdx = -1;

    window.runSearch = function(query) {
      var q = (query || '').trim().toLowerCase();
      selectedIdx = -1;

      if (!q) {
        resultsList.innerHTML = '<div class="search-hint">输入文章标题、摘要、段落深度内容或闪念关键字...<br><span style="font-size:0.75rem;opacity:0.7;margin-top:6px;display:inline-block;">支持 ↑ ↓ 键选择，Enter 直达，Esc 退出</span></div>';
        return;
      }

      var allArticles = Array.isArray(window.articles) ? window.articles : [];
      var allMoments = Array.isArray(window.moments) ? window.moments : [];

      var matchedArticles = [];
      allArticles.forEach(function (a) {
        var titleMatch = (a.title && a.title.toLowerCase().indexOf(q) !== -1);
        var summaryMatch = (a.summary && a.summary.toLowerCase().indexOf(q) !== -1);
        var catMatch = (a.category && a.category.toLowerCase().indexOf(q) !== -1);
        var contentSnippet = '';

        if (!titleMatch && !summaryMatch && a.content) {
          var stripped = a.content.replace(/<[^>]+>/g, ' ');
          var idx = stripped.toLowerCase().indexOf(q);
          if (idx !== -1) {
            var start = Math.max(0, idx - 25);
            var end = Math.min(stripped.length, idx + q.length + 35);
            contentSnippet = (start > 0 ? '...' : '') + stripped.slice(start, end) + (end < stripped.length ? '...' : '');
          }
        }

        if (titleMatch || summaryMatch || catMatch || contentSnippet) {
          matchedArticles.push({ article: a, snippet: contentSnippet || a.summary });
        }
      });

      var matchedMoments = allMoments.filter(function (m) {
        return (m.content && m.content.toLowerCase().indexOf(q) !== -1) ||
               (m.tag && m.tag.toLowerCase().indexOf(q) !== -1);
      });

      if (matchedArticles.length === 0 && matchedMoments.length === 0) {
        resultsList.innerHTML = '<div class="search-hint">未检索到“' + esc(q) + '”相关的墨痕，不妨换个词试试</div>';
        return;
      }

      var html = '';
      matchedArticles.forEach(function (item, i) {
        var a = item.article;
        html += 
          '<div class="search-result-item" data-index="' + i + '" data-type="article" data-id="' + a.id + '">' +
            '<div class="sr-title">' + highlightText(a.title, q) + '</div>' +
            '<div class="sr-snippet" style="font-size:0.83rem;color:var(--text-muted);margin:4px 0 6px;line-height:1.5;">' + highlightText(item.snippet, q) + '</div>' +
            '<div class="sr-meta">' +
              '<span>文墨 · ' + (a.category || '手记') + '</span>' +
              '<span>' + (a.date || '') + '</span>' +
            '</div>' +
          '</div>';
      });

      var artCount = matchedArticles.length;
      matchedMoments.forEach(function (m, i) {
        html += 
          '<div class="search-result-item" data-index="' + (artCount + i) + '" data-type="moment" data-id="' + m.id + '">' +
            '<div class="sr-title">' + highlightText(m.content.slice(0, 90), q) + '...</div>' +
            '<div class="sr-meta">' +
              '<span>微语 · #' + (m.tag || '随想') + '</span>' +
              '<span>' + (typeof formatRelativeTime === 'function' ? formatRelativeTime(m.time) : '') + '</span>' +
            '</div>' +
          '</div>';
      });

      resultsList.innerHTML = html;

      resultsList.querySelectorAll('.search-result-item').forEach(function (el) {
        el.addEventListener('click', function () {
          var type = el.getAttribute('data-type');
          var id = el.getAttribute('data-id');
          if (typeof closeSearchModal === 'function') closeSearchModal();
          if (type === 'article') {
            var target = allArticles.find(function (a) { return a.id === id; });
            if (target && typeof openReader === 'function') openReader(target);
          } else if (type === 'moment') {
            var sec = document.getElementById('moments');
            if (sec) sec.scrollIntoView({ behavior: 'smooth' });
          }
        });
      });
    };

    input.addEventListener('keydown', function (e) {
      var items = resultsList.querySelectorAll('.search-result-item');
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIdx = (selectedIdx + 1) % items.length;
        updateSelection(items);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIdx = (selectedIdx - 1 + items.length) % items.length;
        updateSelection(items);
      } else if (e.key === 'Enter' && selectedIdx >= 0 && selectedIdx < items.length) {
        e.preventDefault();
        items[selectedIdx].click();
      }
    });

    function updateSelection(items) {
      items.forEach(function (item, i) {
        if (i === selectedIdx) {
          item.classList.add('is-selected');
          item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        } else {
          item.classList.remove('is-selected');
        }
      });
    }
  }

  // -------------------------------------------------------------------------
  // 场景 4: 右侧「书籍式墨线折痕流体目录」
  // -------------------------------------------------------------------------
  function enhanceTocWithFluidInk(headings, desktopTocRail, scrollContainer) {
    if (!desktopTocRail || !scrollContainer || headings.length < 2) return;

    var track = desktopTocRail.querySelector('.ink-crease-track');
    if (!track) {
      var railWrap = desktopTocRail.querySelector('.reader-toc-rail-wrap') || desktopTocRail;
      track = document.createElement('div');
      track.className = 'ink-crease-track';
      track.innerHTML = '<div class="ink-fluid-fill" id="ink-fluid-fill"></div><div class="ink-drop-marker" id="ink-drop-marker"></div>';
      railWrap.appendChild(track);
    }

    var fillEl = document.getElementById('ink-fluid-fill');
    var markerEl = document.getElementById('ink-drop-marker');
    var tocItems = desktopTocRail.querySelectorAll('.reader-toc-item');

    function onScroll() {
      var scrollTop = scrollContainer.scrollTop;
      var scrollHeight = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      if (scrollHeight <= 0) return;

      var progress = Math.min(1, Math.max(0, scrollTop / scrollHeight));
      if (fillEl) fillEl.style.height = (progress * 100) + '%';
      if (markerEl) markerEl.style.top = (progress * 100) + '%';

      var activeHeadingIndex = 0;
      headings.forEach(function (h, idx) {
        var top = h.offsetTop - scrollContainer.offsetTop;
        if (scrollTop >= top - 120) {
          activeHeadingIndex = idx;
        }
      });

      tocItems.forEach(function (item, idx) {
        if (idx === activeHeadingIndex) {
          item.classList.add('is-active');
        } else {
          item.classList.remove('is-active');
        }
      });
    }

    if (scrollContainer._inkFluidScroll) {
      scrollContainer.removeEventListener('scroll', scrollContainer._inkFluidScroll);
    }
    scrollContainer._inkFluidScroll = onScroll;
    scrollContainer.addEventListener('scroll', onScroll, { passive: true });
    setTimeout(onScroll, 60);
  }

  // -------------------------------------------------------------------------
  // 场景 5: 朱砂印章按压反馈与水墨涟漪
  // -------------------------------------------------------------------------
  function initStampRipple() {
    var stamp = document.querySelector('.seal-stamp');
    if (!stamp) return;

    var toasts = [
      "纸境素雅 · 岁月从容",
      "零依赖架构 · 30MB 极简常驻",
      "以文墨抵御算法之速朽",
      "欢迎知音到访 · 留墨常青"
    ];

    stamp.addEventListener('click', function () {
      stamp.classList.add('is-stamped');
      setTimeout(function () { stamp.classList.remove('is-stamped'); }, 300);
      var msg = toasts[Math.floor(Math.random() * toasts.length)];
      if (typeof showToast === 'function') {
        showToast(msg);
      }
    });
  }

  // -------------------------------------------------------------------------
  // 挂钩与启动
  // -------------------------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initHeroTypewriter();
      initEnhancedSearch();
      initStampRipple();
    });
  } else {
    initHeroTypewriter();
    initEnhancedSearch();
    initStampRipple();
  }

  var origRenderReader = window.renderReader;
  window.renderReader = function(article) {
    if (typeof origRenderReader === 'function') {
      origRenderReader.apply(this, arguments);
    }
    try {
      renderInkLens(article);
      var scrollContainer = document.getElementById('drawer-scroll-container') || document.querySelector('.drawer-content-scroll');
      var desktopTocRail = document.getElementById('reader-desktop-sidebar');
      var contentEl = document.getElementById('reader-content');
      if (contentEl && desktopTocRail && scrollContainer) {
        setTimeout(function () {
          var headings = contentEl.querySelectorAll('h2, h3');
          enhanceTocWithFluidInk(headings, desktopTocRail, scrollContainer);
        }, 150);
      }
    } catch (e) {
      console.warn('[v48 renderReader error]', e);
    }
  };

})();
/* ======================== v48 · 完 ======================== */

// =========================================================================
// v51: 东方素纸灵动信笺交互：心境涟漪、流光诗意引签、打字机占位符与快捷键
// =========================================================================
(function initAtelierRibbonAndAnimations() {
  const POETIC_ECHOES = {
    '静': '水静极则形象明，心静极则智慧生',
    '思': '格物致知，探寻内核与架构的底层大道',
    '喜': '相逢意气，见字如面，忽闻远客至',
    '问': '奇文共疑析，疑义相与析，待工坊研磨回笔'
  };

  const INK_PROMPTS = [
    '写下一缕墨香，或偶得的架构闪念...',
    '探讨 Linux 内核、零拷贝与高性能 I/O 之道...',
    '交流 LSM-Tree、存储引擎与边缘自治架构...',
    '聊聊现代极简 Web、原生零依赖与东方素纸美学...',
    '留下萍水相逢的问候，工坊即刻为您研磨回笔...'
  ];

  // 1. 心境印章金石钤印动效与水墨涟漪
  const moodRow = document.getElementById('mood-seal-row');
  const poeticText = document.getElementById('mood-poetic-text');

  if (moodRow) {
    moodRow.addEventListener('click', (e) => {
      const btn = e.target.closest('.mood-seal');
      if (!btn) return;
      const mood = btn.dataset.mood;
      
      // 添加印章盖压与涟漪动效
      btn.classList.remove('stamp-anim');
      void btn.offsetWidth; // 触发 reflow 重置动画
      btn.classList.add('stamp-anim');

      const ripple = document.createElement('span');
      ripple.className = 'ink-ripple';
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 550);

      // 更新中间流光诗意签
      if (poeticText && POETIC_ECHOES[mood]) {
        poeticText.classList.add('stream-fade');
        setTimeout(() => {
          poeticText.textContent = POETIC_ECHOES[mood];
          poeticText.classList.remove('stream-fade');
        }, 220);
      }
    });
  }

  // 2. 输入框智能文墨打字机占位符 (Typewriter Placeholder)
  const contentInput = document.getElementById('msg-content');
  if (contentInput) {
    let promptIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let typewriterPaused = false;
    let typewriterTimer = null;

    function tickTypewriter() {
      if (typewriterPaused || document.activeElement === contentInput || contentInput.value.length > 0) {
        typewriterTimer = setTimeout(tickTypewriter, 500);
        return;
      }

      const currentSentence = INK_PROMPTS[promptIndex % INK_PROMPTS.length];
      if (isDeleting) {
        charIndex--;
        contentInput.placeholder = currentSentence.substring(0, charIndex);
        if (charIndex <= 0) {
          isDeleting = false;
          promptIndex++;
          typewriterTimer = setTimeout(tickTypewriter, 500);
          return;
        }
        typewriterTimer = setTimeout(tickTypewriter, 35);
      } else {
        charIndex++;
        contentInput.placeholder = currentSentence.substring(0, charIndex);
        if (charIndex >= currentSentence.length) {
          isDeleting = true;
          typewriterTimer = setTimeout(tickTypewriter, 3600); // 完整句停留 3.6 秒供阅读
          return;
        }
        typewriterTimer = setTimeout(tickTypewriter, 75);
      }
    }

    contentInput.addEventListener('focus', () => { typewriterPaused = true; });
    contentInput.addEventListener('blur', () => {
      if (!contentInput.value.trim()) {
        typewriterPaused = false;
      }
    });

    // 延时 800ms 开启打字机
    setTimeout(tickTypewriter, 800);

    // 3. Ctrl+Enter / Cmd+Enter 极速留墨
    contentInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        const form = document.getElementById('guestbook-form');
        if (form) {
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }
    });
  }

  // 4. 字数统计胶囊实时更新
  const charPill = document.getElementById('msg-char-count');
  if (contentInput && charPill) {
    contentInput.addEventListener('input', () => {
      const len = contentInput.value.length;
      charPill.textContent = `${len} / 300`;
      if (len > 280) {
        charPill.classList.add('warn');
      } else {
        charPill.classList.remove('warn');
      }
    });
  }
})();



// =========================================================================
// v52: 动态感知注入域名 (Dynamic Host Perception - 彻底消灭硬编码域名)
// =========================================================================
function initDynamicHost() {
  try {
    const currentHost = window.location.host || window.location.hostname || 'blog.hlat.xyz';
    const origin = window.location.origin || ('https://' + currentHost);

    // 动态注入所有纯文本域名
    document.querySelectorAll('.dyn-host-text').forEach(el => {
      el.textContent = currentHost;
    });

    // 动态注入所有域名超链接
    document.querySelectorAll('.dyn-host-link').forEach(el => {
      el.href = origin;
      el.textContent = currentHost;
    });
  } catch (err) {
    console.warn('initDynamicHost warning:', err);
  }
}

// 页面 DOM 加载与数据渲染后均触发动态域名同步
window.addEventListener('DOMContentLoaded', initDynamicHost);
setTimeout(initDynamicHost, 300);

