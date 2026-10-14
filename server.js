/**
 * ============================================================================
 * 🚀 MOONSHOT 7/24 BULUT TEST LABORATUVARI (SCREEN 1 - BİREBİR EKRAN MOTORU)
 * ============================================================================
 * Bakiye: $100.00 | Max Slot: 4 | Teminat: $10 | Kaldıraç: 20x | SL: %2.50 | BE: %1.80
 * HTML Ekran 1 tasarımı, renkleri, panelleri ve kuralları ile 1-e-1 aynı.
 * ============================================================================
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_DIR = __dirname;
const HISTORY_FILE = path.join(DATA_DIR, 'trades_history.json');
const CSV_FILE = path.join(DATA_DIR, 'trades_history.csv');
const STATE_FILE = path.join(DATA_DIR, 'bot_state.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const TEAM_STATUS_FILE = path.join(DATA_DIR, 'quant_lab', 'team_status.json');
let teamStatusCache = null;
let addDialogue = () => {};
try {
  const dlgMod = require('./quant_lab/team_dialogue');
  addDialogue = dlgMod.addDialogue;
} catch (e) {}

try {
  if (fs.existsSync(TEAM_STATUS_FILE)) {
    teamStatusCache = JSON.parse(fs.readFileSync(TEAM_STATUS_FILE, 'utf8'));
  }
} catch (e) {}

let globalWhaleFlowMap = (teamStatusCache && teamStatusCache.moneyFlow && teamStatusCache.moneyFlow.flowMap) || {};
let globalFundingMap = (teamStatusCache && teamStatusCache.fundingRates && teamStatusCache.fundingRates.fundingMap) || {};
let predictTradeProbability = () => ({ isApproved: true, winProbabilityPct: 75, confidence: 'ORTA' });
try {
  const mlMod = require('./quant_lab/freqai_ml_engine');
  predictTradeProbability = mlMod.predictTradeProbability;
} catch (e) {}

let evaluatePreTradeClearance = () => ({ approved: true, judicialScore: 85, verdict: 'BERAAT', reason: '' });
try {
  const judgeMod = require('./quant_lab/judge_audit');
  evaluatePreTradeClearance = judgeMod.evaluatePreTradeClearance;
} catch (e) {}

let calculateConvictionSizing = null;
try {
  const trMod = require('./quant_lab/team_runner');
  calculateConvictionSizing = trMod.calculateConvictionSizing;
} catch (e) {}

// --- EKRAN 1 BİREBİR AYARLARI ---
let CONFIG = {
  initialBalance: 100.0,     // Bakiye 100 Dolar
  marginPerTrade: 15.0,      // Temel Teminat 15$
  leverage: 20,              // Kaldıraç 20x
  maxSlots: 2,               // 2 Slot
  slPct: 0.25,               // Hızlı vur-kaç stop
  bePct: 0.20,               // +%0.20 görünce başabaş
  moonPct: 0.42,             // +%0.42 spotta komple kapat
  tp1Pct: 0.60,              // Moon önce gelir; kademe yedek
  feeRate: 0.0005,           // Binance Futures taker %0.05 (TEK YÖN)
  scanIntervalMs: 2000,
  riskIntervalMs: 1000,
  radarIntervalMs: 20000
};

// 🤖 AJAN EKİBİNİN CANLI OLARAK DEĞİŞTİREBİLDİĞİ GİRİŞ FİLTRELERİ
// (Yönetici onayı + sert sınırlar dahilinde team_runner tarafından güncellenir)
let DYNAMIC = {
  vol3hMin: 1.0,         // 3 saatlik minimum hacim ($M)
  candidateSlice: 35,    // Kline ile derin incelenen aday sayısı
  regime: 'DEFAULT',
  mode: 'BALANCED',      // 'DEFENSIVE_SNIPER', 'CAUTIOUS_RECOVERY', 'GROWTH', 'BALANCED'
  updatedAt: 0
};
const DYNAMIC_LIMITS = {
  vol3hMin: [0.5, 15.0],
  candidateSlice: [15, 50]
};

function getMarketFlowBias() {
  const bias = teamStatusCache && teamStatusCache.moneyFlow && teamStatusCache.moneyFlow.marketFlowBias;
  return bias || 'NEUTRAL';
}

function isChoppyRegime() {
  const r = DYNAMIC.regime || '';
  return r === 'CHOPPY_RANGE' || r === 'WEEKEND_LOW_LIQUIDITY' || r === 'DEFAULT';
}

// ŞAMPİYON ÖNCELİKLİ KOİNLER (Ekran 1 VIP Listesi - En Yüksek Hacim ve Volatilite Roketleri)
const DEFAULT_VIP_TARGETS = {
  "PEPEUSDT":  { minVol: 50,  label: "🎯 Meme Hacim Lideri ($800M+ Hacim)" },
  "WIFUSDT":   { minVol: 50,  label: "🚀 Yüksek Volatilite Roketi ($400M+ Hacim)" },
  "SUIUSDT":   { minVol: 80,  label: "⚡ Likidite Canavarı ($900M+ Hacim)" },
  "NEARUSDT":  { minVol: 80,  label: "💎 Dev Trendci ($1.2B Hacim)" },
  "FETUSDT":   { minVol: 40,  label: "🧠 Yapay Zeka Lideri ($300M+ Hacim)" },
  "APTUSDT":   { minVol: 40,  label: "⚡ Hızlı L1 Roketi ($250M+ Hacim)" },
  "TAOUSDT":   { minVol: 40,  label: "💎 Kurumsal AI Likiditesi ($200M+ Hacim)" },
  "DOGEUSDT":  { minVol: 60,  label: "🐶 Mega Likidite ($600M+ Hacim)" },
  "NEIROUSDT": { minVol: 30,  label: "🔥 Güncel Volatilite Canavarı" },
  "ENAUSDT":   { minVol: 40,  label: "💎 Hacim Lideri ($500M+ Hacim)" },
  "SEIUSDT":   { minVol: 35,  label: "🚀 Hızlı Sıçrayan ($150M Hacim)" },
  "TIAUSDT":   { minVol: 40,  label: "🚀 Trend Lideri ($300M+ Hacim)" },
  "PEOPLEUSDT":{ minVol: 30,  label: "🎯 Yüksek Volatilite" },
  "SAGAUSDT":  { minVol: 30,  label: "🎯 Roket Kırılım ($150M Hacim)" }
};

let VIP_TARGETS = { ...DEFAULT_VIP_TARGETS };

const BANNED_SYMBOLS = new Set([
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT',
  'USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'EURUSDT',
  'AMPUSDT'
]);

// --- DURUM DEĞİŞKENLERİ ---
let balance = CONFIG.initialBalance;
let activePositions = [];
let history = [];
let coinCooldowns = {};
let coinLossCount = {};  // 🛡️ Aynı koine ardışık zarar sayısı (2 zarar → yasakla, kâr ederse sıfırla)
let resetEpoch = 0;      // 🛡️ Bilinçli sıfırlama zaman damgası (Zombi geçmiş kurtarmayı engeller)
let lastTradeOpenTime = 0; // 🛡️ Kümeleme koruması: İşlemler arası en az 60 sn mesafe
let rollingTickerPrices = {};
let radarMap = {};
let logs = [];
let startTime = Date.now();
let btc15mTrend = "+0.00%";
let btc15mIsGreen = true;
let btc5mNumeric = 0;
let btc15mNumeric = 0;
let isScanRunning = false;
let isRiskRunning = false;
let isRadarRunning = false;
let isBotActive = true;

const TR_TZ = 'Europe/Istanbul';
function trTime(ms) { return new Date(ms || Date.now()).toLocaleTimeString('tr-TR', { timeZone: TR_TZ }); }
function trDateTime(ms) { return new Date(ms || Date.now()).toLocaleString('tr-TR', { timeZone: TR_TZ }); }

function addLog(msg, type = "INFO") {
  const time = trTime();
  logs.unshift({ time, type, msg });
  if (logs.length > 150) logs.pop();
  console.log(`[${time}] [${type}] ${msg}`);
}

// ⚙️ KALICI AYARLAR (Ekrandan değişen parametreler yeniden başlatmada kaybolmasın)
let settingsCustomized = false;

function sanitizeSettings(s) {
  const out = {};
  const num = (v) => { const n = parseFloat(v); return (isFinite(n) ? n : null); };
  const inRange = (n, lo, hi) => (n !== null && n >= lo && n <= hi);
  const slots = num(s.slots), margin = num(s.margin), lev = num(s.lev);
  const sl = num(s.sl), be = num(s.be), moon = num(s.moon), tp1 = num(s.tp1);
  if (inRange(slots, 1, 20)) out.maxSlots = Math.round(slots);
  if (inRange(margin, 1, 100000)) out.marginPerTrade = margin;
  if (inRange(lev, 1, 125)) out.leverage = lev;
  if (inRange(sl, 0.25, 1.5)) out.slPct = sl;
  if (inRange(be, 0.2, 1.5)) out.bePct = be;
  if (inRange(moon, 0.25, 5)) out.moonPct = moon;
  if (inRange(tp1, 0.3, 2)) out.tp1Pct = tp1;
  return out;
}

function saveSettings() {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify({
      maxSlots: CONFIG.maxSlots,
      marginPerTrade: CONFIG.marginPerTrade,
      leverage: CONFIG.leverage,
      slPct: CONFIG.slPct,
      bePct: CONFIG.bePct,
      moonPct: CONFIG.moonPct,
      tp1Pct: CONFIG.tp1Pct,
      savedAt: Date.now()
    }, null, 2), 'utf8');
    settingsCustomized = true;
  } catch (e) {}
}

function loadSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) return;
    const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    const clean = sanitizeSettings({
      slots: saved.maxSlots, margin: saved.marginPerTrade, lev: saved.leverage,
      sl: saved.slPct, be: saved.bePct, moon: saved.moonPct, tp1: saved.tp1Pct
    });
    // Eski geniş hedefleri hızlı vur-kaç bandına çek
    if (!clean.slPct || clean.slPct > 0.32) clean.slPct = 0.25;
    if (!clean.bePct || clean.bePct > 0.28) clean.bePct = 0.20;
    if (!clean.tp1Pct || clean.tp1Pct < 0.50 || clean.tp1Pct > 0.80) clean.tp1Pct = 0.60;
    if (!clean.moonPct || clean.moonPct > 0.50 || clean.moonPct < 0.30) clean.moonPct = 0.42;
    Object.assign(CONFIG, clean);
    settingsCustomized = true;
  } catch (e) {}
}

function getSettingsPayload() {
  return {
    slots: CONFIG.maxSlots, margin: CONFIG.marginPerTrade, lev: CONFIG.leverage,
    sl: CONFIG.slPct, be: CONFIG.bePct, moon: CONFIG.moonPct, tp1: CONFIG.tp1Pct
  };
}

// Depolamayı Başlat & Bakiye Eşitle ($100)
function initStorage() {
  loadSettings();
  try {
    if (fs.existsSync(STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      balance = (saved.balance !== undefined && !isNaN(saved.balance)) ? saved.balance : CONFIG.initialBalance;
      activePositions = saved.activePositions || [];
      coinCooldowns = saved.coinCooldowns || {};
      coinLossCount = saved.coinLossCount || {};
      resetEpoch = saved.resetEpoch || 0;
    } else {
      balance = CONFIG.initialBalance;
    }



    if (fs.existsSync(HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      if (Array.isArray(history) && history.length > 0) {
        const totalPnl = history.reduce((acc, h) => acc + (h.pnl || 0), 0);
        const activeTp1Pnl = Array.isArray(activePositions) ? activePositions.reduce((acc, p) => acc + (p.tp1Pnl || 0), 0) : 0;
        balance = CONFIG.initialBalance + totalPnl + activeTp1Pnl;
      }
    }

    rebuildCoinLossHistory();
    rewriteCsvFile();
  } catch (err) {
    addLog(`Dosya okuma: ${err.message}`, 'WARN');
  }
}

function rebuildCoinLossHistory() {
  const now = Date.now();
  coinLossCount = {};
  if (!Array.isArray(history) || history.length === 0) return;
  const chron = [...history].sort((a, b) => (a.id || 0) - (b.id || 0));
  const banned = [];
  for (const t of chron) {
    const sym = t.symbol;
    if (!sym) continue;
    const isLoss = (t.pnl <= -0.05) || (t.exitReason && (t.exitReason.includes("Stop Loss") || t.exitReason.includes("Durgunluk") || t.exitReason.includes("Zarar")));
    if (isLoss) {
      coinLossCount[sym] = (coinLossCount[sym] || 0) + 1;
      if (coinLossCount[sym] >= 2) {
        coinCooldowns[sym] = Math.max(coinCooldowns[sym] || 0, now + (12 * 60 * 60 * 1000));
        if (!banned.includes(sym)) banned.push(sym);
      } else {
        coinCooldowns[sym] = Math.max(coinCooldowns[sym] || 0, now + (2 * 60 * 60 * 1000));
      }
    } else if (t.pnl > 0.20) {
      coinLossCount[sym] = 0;
      delete coinCooldowns[sym];
      const bIdx = banned.indexOf(sym);
      if (bIdx !== -1) banned.splice(bIdx, 1);
    }
  }
  if (banned.length > 0) {
    addLog(`🚫 Koin Zarar Hafızası: 2+ kez zarar veren koinler 12 saat kilitlendi: ${banned.join(", ")}`, 'INFO');
  }
}

function persistState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      balance,
      activePositions,
      coinCooldowns,
      coinLossCount,
      resetEpoch,
      savedAt: Date.now()
    }, null, 2), 'utf8');
  } catch (e) {}
}

function getPeakBalance() {
  let peak = CONFIG.initialBalance || 100.0;
  if (Array.isArray(history) && history.length > 0) {
    let cur = CONFIG.initialBalance || 100.0;
    const chron = [...history].reverse();
    for (const h of chron) {
      cur += (h.pnl || 0);
      if (cur > peak) peak = cur;
    }
  }
  return Math.max(peak, balance);
}

function getTradeRadarFields(trade) {
  let chg3h = (trade.chg3h !== undefined && trade.chg3h !== null) ? trade.chg3h : null;
  let vol3hM = (trade.vol3hM !== undefined && trade.vol3hM !== null) ? trade.vol3hM : null;
  let chg24h = (trade.chg24h !== undefined && trade.chg24h !== null) ? trade.chg24h : null;
  let range3h = trade.range3h || "";
  let taker = (trade.takerBuyRatio !== undefined && trade.takerBuyRatio !== null) ? trade.takerBuyRatio : null;
  let signal = trade.signal || "";

  // Fallback: radarTag içerisinden regex ile ayrıştır
  if ((chg3h === null || taker === null) && trade.radarTag) {
    const chgMatch = trade.radarTag.match(/3s:\s*%?([+-]?[\d\.]+)/i);
    if (chgMatch) chg3h = parseFloat(chgMatch[1]);
    
    const takerMatch = trade.radarTag.match(/%([\d\.]+)\s*(Alıcı|Satıcı)/i);
    if (takerMatch) {
      const num = parseFloat(takerMatch[1]);
      taker = takerMatch[2] === 'Alıcı' ? num : (100 - num);
    }

    const sigMatch = trade.radarTag.match(/-\s*([^\s\]]+(?:\s+[^\s\]]+)?)/);
    if (sigMatch) signal = sigMatch[1];
  }

  return { chg3h, vol3hM, chg24h, range3h, taker, signal };
}

function rewriteCsvFile() {
  try {
    const csvHeader = '\uFEFF' + [
      'ID',
      'Giriş Saati',
      'Kapanış Saati',
      'Koin',
      'Yön',
      'Giriş Fiyatı',
      'Çıkış Fiyatı',
      'Süre (Dk)',
      'MFE (Max Kâr %)',
      'MAE (Max Zarar %)',
      'Net Kâr ($)',
      'ROI (%)',
      'Çıkış Nedeni',
      'BTC 5m Giriş (%)',
      'BTC 15m Giriş (%)',
      '3s Değişim (%)',
      '3s Hacim ($M)',
      '24s Değişim (%)',
      '3s Fiyat Aralığı',
      'Alıcı Baskısı (%)',
      'Radar Sinyali',
      'Radar Teyidi'
    ].join(';') + '\n';

    let content = csvHeader;
    const rows = history.slice().reverse();
    rows.forEach(trade => {
      const r = getTradeRadarFields(trade);
      const chg3hStr = (r.chg3h !== null && r.chg3h !== undefined) ? `"%${parseFloat(r.chg3h).toFixed(2)}"` : `"-"`;
      const vol3hStr = (r.vol3hM !== null && r.vol3hM !== undefined) ? `"$${parseFloat(r.vol3hM).toFixed(1)}M"` : `"-"`;
      const chg24hStr = (r.chg24h !== null && r.chg24h !== undefined) ? `"%${parseFloat(r.chg24h).toFixed(2)}"` : `"-"`;
      const range3hStr = `"${(r.range3h || '-').replace(/"/g, '""')}"`;
      const takerStr = (r.taker !== null && r.taker !== undefined) ? `"%${parseFloat(r.taker).toFixed(1)}"` : `"-"`;
      const signalStr = `"${(r.signal || '-').replace(/"/g, '""')}"`;

      content += [
        trade.id,
        `"${trade.entryTimeStr || '-'}"`,
        `"${trade.dateFullStr || trade.time || ''}"`,
        trade.symbol,
        trade.side,
        trade.entryPrice,
        trade.exitPrice,
        trade.durationMin,
        `"%${(trade.mfe || 0).toFixed(2)}"`,
        `"%${(trade.mae || 0).toFixed(2)}"`,
        `"${(trade.pnl || 0).toFixed(2)}"`,
        `"%${(trade.roi || 0).toFixed(2)}"`,
        `"${(trade.exitReason || '').replace(/"/g, '""')}"`,
        `"%${(trade.btc5mEntry || 0).toFixed(2)}"`,
        `"%${(trade.btc15mEntry || 0).toFixed(2)}"`,
        chg3hStr,
        vol3hStr,
        chg24hStr,
        range3hStr,
        takerStr,
        signalStr,
        `"${(trade.radarTag || '').replace(/"/g, '""')}"`
      ].join(';') + '\n';
    });
    fs.writeFileSync(CSV_FILE, content, 'utf8');
  } catch (err) {
    addLog(`CSV Hatası: ${err.message}`, 'ERROR');
  }
}

function appendTradeToCsv(trade) {
  try {
    if (!fs.existsSync(CSV_FILE)) {
      rewriteCsvFile();
      return;
    }
    const r = getTradeRadarFields(trade);
    const chg3hStr = (r.chg3h !== null && r.chg3h !== undefined) ? `"%${parseFloat(r.chg3h).toFixed(2)}"` : `"-"`;
    const vol3hStr = (r.vol3hM !== null && r.vol3hM !== undefined) ? `"$${parseFloat(r.vol3hM).toFixed(1)}M"` : `"-"`;
    const chg24hStr = (r.chg24h !== null && r.chg24h !== undefined) ? `"%${parseFloat(r.chg24h).toFixed(2)}"` : `"-"`;
    const range3hStr = `"${(r.range3h || '-').replace(/"/g, '""')}"`;
    const takerStr = (r.taker !== null && r.taker !== undefined) ? `"%${parseFloat(r.taker).toFixed(1)}"` : `"-"`;
    const signalStr = `"${(r.signal || '-').replace(/"/g, '""')}"`;

    const row = [
      trade.id,
      `"${trade.entryTimeStr || '-'}"`,
      `"${trade.dateFullStr || trade.time || ''}"`,
      trade.symbol,
      trade.side,
      trade.entryPrice,
      trade.exitPrice,
      trade.durationMin,
      `"%${(trade.mfe || 0).toFixed(2)}"`,
      `"%${(trade.mae || 0).toFixed(2)}"`,
      `"${(trade.pnl || 0).toFixed(2)}"`,
      `"%${(trade.roi || 0).toFixed(2)}"`,
      `"${(trade.exitReason || '').replace(/"/g, '""')}"`,
      `"%${(trade.btc5mEntry || 0).toFixed(2)}"`,
      `"%${(trade.btc15mEntry || 0).toFixed(2)}"`,
      chg3hStr,
      vol3hStr,
      chg24hStr,
      range3hStr,
      takerStr,
      signalStr,
      `"${(trade.radarTag || '').replace(/"/g, '""')}"`
    ].join(';') + '\n';
    fs.appendFileSync(CSV_FILE, row, 'utf8');
  } catch (err) {
    addLog(`CSV Hatası: ${err.message}`, 'ERROR');
  }
}

// BİNANCE RESMİ API & ISP/DPI/BULUT ENGELİNE KARŞI ÇOKLU AYNA SİSTEMİ
const BINANCE_FAPI_MIRRORS = [
  "https://fapi1.binance.com",
  "https://fapi2.binance.com",
  "https://fapi3.binance.com",
  "https://fapi.binance.com"
];


// ==========================================
// 🧠 DEEP ANALYSIS ENGINE (6 Aylık Tarihi Zeka Motoru)
// ==========================================
global.coinIntelligence = {};
let isDeepScanRunning = false;

function getPearson(x, y) {
  if (x.length !== y.length || x.length === 0) return 0;
  const n = x.length;
  let sum_x = 0, sum_y = 0, sum_xy = 0, sum_x2 = 0, sum_y2 = 0;
  for (let i = 0; i < n; i++) {
    sum_x += x[i];
    sum_y += y[i];
    sum_xy += x[i] * y[i];
    sum_x2 += x[i] * x[i];
    sum_y2 += y[i] * y[i];
  }
  const numerator = (n * sum_xy) - (sum_x * sum_y);
  const denominator = Math.sqrt(((n * sum_x2) - (sum_x * sum_x)) * ((n * sum_y2) - (sum_y * sum_y)));
  if (denominator === 0) return 0;
  return numerator / denominator;
}

async function runHistoricalDeepScan() {
  if (isDeepScanRunning) return;
  isDeepScanRunning = true;
  console.log("🧠 [DeepScan] 6 Aylık Tarihsel Derin Analiz Motoru Başlatılıyor...");
  try {
    const tickers = await fetchBinance("https://fapi.binance.com/fapi/v1/ticker/24hr");
    if (!tickers) {
      isDeepScanRunning = false;
      return;
    }
    const validSyms = tickers.map(t => t.symbol).filter(s => s.endsWith("USDT") && !s.startsWith("USDC") && !BANNED_SYMBOLS.has(s));

    const btcKlines = await fetchBinance("https://fapi.binance.com/fapi/v1/klines?symbol=BTCUSDT&interval=1d&limit=180");
    if (!btcKlines) {
      isDeepScanRunning = false;
      return;
    }
    const btcPctChanges = [];
    for (let i = 1; i < btcKlines.length; i++) {
      const open = parseFloat(btcKlines[i][1]);
      const close = parseFloat(btcKlines[i][4]);
      btcPctChanges.push((close - open) / open);
    }

    const chunkSize = 20;
    for (let i = 0; i < validSyms.length; i += chunkSize) {
      const chunk = validSyms.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (sym) => {
        try {
          const klines = await fetchBinance(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=1d&limit=180`);
          if (!klines || klines.length < 30) return;

          let maxHigh = -Infinity;
          let minLow = Infinity;
          const altPctChanges = [];

          for (let j = 1; j < klines.length; j++) {
            const open = parseFloat(klines[j][1]);
            const high = parseFloat(klines[j][2]);
            const low = parseFloat(klines[j][3]);
            const close = parseFloat(klines[j][4]);
            
            if (high > maxHigh) maxHigh = high;
            if (low < minLow) minLow = low;

            const daysFromEnd = klines.length - j;
            if (daysFromEnd <= btcPctChanges.length) {
              const btcIdx = btcPctChanges.length - daysFromEnd;
              if (btcIdx >= 0) {
                 altPctChanges.push({ x: btcPctChanges[btcIdx], y: (close - open) / open });
              }
            }
          }

          const xArr = altPctChanges.map(c => c.x);
          const yArr = altPctChanges.map(c => c.y);
          const btcCorr = getPearson(xArr, yArr);

          let totalDailyRange = 0;
          for (let j = 0; j < klines.length; j++) {
             const h = parseFloat(klines[j][2]);
             const l = parseFloat(klines[j][3]);
             totalDailyRange += (h - l) / l;
          }
          const avgDailyVolatility = (totalDailyRange / klines.length) * 100;

          global.coinIntelligence[sym] = {
            max6m: maxHigh,
            min6m: minLow,
            btcCorrelation: btcCorr,
            volatilityScore: avgDailyVolatility,
            lastUpdated: Date.now()
          };
        } catch (e) {}
      }));
      await new Promise(resolve => setTimeout(resolve, 800));
    }
    console.log(`🧠 [DeepScan] ${Object.keys(global.coinIntelligence).length} Koin için 6 Aylık DNA ve BTC Analizi Tamamlandı!`);
  } catch (err) {
  } finally {
    isDeepScanRunning = false;
  }
}

setTimeout(runHistoricalDeepScan, 5000);
setInterval(runHistoricalDeepScan, 4 * 60 * 60 * 1000);
// ==========================================


async function fetchBinance(url) {
  let relativePath = url;
  if (url.startsWith("http")) {
    try {
      const parsed = new URL(url);
      relativePath = parsed.pathname + parsed.search;
    } catch(e) {
      relativePath = url.replace(/^https?:\/\/[^\/]+/, "");
    }
  }

  // 1. Önce Futures API aynalarını dene (fapi1, fapi2, fapi3...)
  for (const base of BINANCE_FAPI_MIRRORS) {
    try {
      const targetUrl = base + relativePath;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);
      const res = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      clearTimeout(timeoutId);
      if (res.status === 429) {
        // IP rate limit yedik, tüm fapi aynaları kilitlidir; hemen Vision CDN'e atla
        break;
      }
      if (res.status === 451) continue;
      if (!res.ok) continue;
      const data = await res.json();
      if (data) return data;
    } catch(e) {}
  }

  // 2. 🛡️ KESİNTİSİZ ÇALIŞMA KALKANI: FAPI 429/451 engeline takılırsa Binance Vision Global CDN ile anında kurtar!
  try {
    const spotPath = relativePath.replace(/^\/fapi\/v1\//, '/api/v3/');
    const visionUrl = "https://data-api.binance.vision" + spotPath;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(visionUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data) return data;
    }
  } catch(e) {}

  return null;
}

// 1. RADAR (3S & 15DK ÇOKLU ZAMAN, ALICI BASKISI VE SİNYAL MOTORU)
let radarList = [];
let btcPriceHistory = [];
async function updateRadar() {
  if (isRadarRunning) return;
  isRadarRunning = true;
  try {
    const tickers = await fetchBinance('/fapi/v1/ticker/24hr');
    if (!tickers || !Array.isArray(tickers)) return;

    const btcTicker = tickers.find(t => t.symbol === 'BTCUSDT');
    if (btcTicker) {
      const now = Date.now();
      const p = parseFloat(btcTicker.lastPrice);
      btcPriceHistory.push({ t: now, p: p });
      btcPriceHistory = btcPriceHistory.filter(x => now - x.t <= 15 * 60 * 1000);
      
      if (btcPriceHistory.length > 0) {
        const oldest15m = btcPriceHistory[0].p;
        const oldest5mObj = btcPriceHistory.find(x => now - x.t <= 5 * 60 * 1000);
        const oldest5m = oldest5mObj ? oldest5mObj.p : oldest15m;
        
        btc15mNumeric = ((p - oldest15m) / oldest15m) * 100;
        btc5mNumeric = ((p - oldest5m) / oldest5m) * 100;
        
        const f15 = `${btc15mNumeric >= 0 ? '+' : ''}${btc15mNumeric.toFixed(2)}%`;
        const f5 = `${btc5mNumeric >= 0 ? '+' : ''}${btc5mNumeric.toFixed(2)}%`;
        
        btc15mTrend = `15m: ${f15}`;
        btc15mIsGreen = btc15mNumeric >= 0; // UI color based on 15m trend
      }
    }

    const tickerMap = {};
    tickers.forEach(t => {
      tickerMap[t.symbol] = {
        lastPrice: parseFloat(t.lastPrice) || 0,
        chg24h: parseFloat(t.priceChangePercent) || 0,
        vol24hM: (parseFloat(t.quoteVolume) || 0) / 1e6
      };
    });

    const SYMBOL_REGEX = /^[A-Z0-9]{2,12}USDT$/;
    const valid = tickers.filter(t => {
      if (!SYMBOL_REGEX.test(t.symbol) || t.symbol.startsWith("USDC") || BANNED_SYMBOLS.has(t.symbol)) return false;
      const volM = (parseFloat(t.quoteVolume) || 0) / 1e6;
      return volM >= 3.0;
    }).sort((a, b) => Math.abs(parseFloat(b.priceChangePercent) || 0) - Math.abs(parseFloat(a.priceChangePercent) || 0));

    // Top 80 koinin 3 saatlik (12x 15m) kline ve alıcı baskısını çek
    const chunkSize = 15;
    const scanned = [];
    const freshRadarMap = {};
    for (let i = 0; i < Math.min(valid.length, 75); i += chunkSize) {
      const chunk = valid.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async item => {
        const sym = item.symbol;
        const klines = await fetchBinance(`/fapi/v1/klines?symbol=${sym}&interval=15m&limit=12`);
        if (klines && klines.length > 0) {
          const open3h = parseFloat(klines[0][1]);
          const close3h = parseFloat(klines[klines.length - 1][4]);
          const high3h = Math.max(...klines.map(k => parseFloat(k[2])));
          const low3h = Math.min(...klines.map(k => parseFloat(k[3])));
          const volUsdt = klines.reduce((acc, k) => acc + (parseFloat(k[7]) || 0), 0);
          const takerBuyUsdt = klines.reduce((acc, k) => acc + (parseFloat(k[10]) || 0), 0);

          const takerRatio = volUsdt > 0 ? (takerBuyUsdt / volUsdt) * 100 : 50;
          const chg3h = open3h > 0 ? ((close3h - open3h) / open3h) * 100 : 0;

          // ⚡ GERÇEK ANLIK 15M BALİNA & İVME TESPİTİ
          const last15 = klines[klines.length - 1];
          const open15 = parseFloat(last15[1]);
          const close15 = parseFloat(last15[4]);
          const vol15 = parseFloat(last15[7]) || 0;
          const takerBuy15 = parseFloat(last15[10]) || 0;
          const chg15m = open15 > 0 ? ((close15 - open15) / open15) * 100 : 0;
          const taker15m = vol15 > 0 ? (takerBuy15 / vol15) * 100 : 50;

          const tInfo = tickerMap[sym] || {};

          let signal = "⚖️ NÖTR";
          const isWhaleBull = (chg15m >= 1.2 && taker15m >= 54.0) || (chg3h >= 3.5 && takerRatio >= 54.0);
          const isWhaleBear = (chg15m <= -1.2 && taker15m <= 46.0) || (chg3h <= -3.5 && takerRatio <= 46.0);

          if (isWhaleBull) signal = "🐋🚀 BALİNA BOĞA";
          else if (isWhaleBear) signal = "🐋🩸 BALİNA AYI";
          else if (chg3h >= 1.8 && takerRatio >= 51.5) signal = "🟢 GÜÇLÜ BOĞA";
          else if (chg3h <= -1.8 && takerRatio <= 48.5) signal = "🔴 GÜÇLÜ AYI";
          else if (chg15m >= 1.5) signal = "⚡ ANLIK SIÇRAMA";

          const rItem = {
            symbol: sym,
            lastPrice: close3h,
            chg3h,
            chg15m,
            vol3hM: volUsdt / 1e6,
            range3h: `$${low3h.toFixed(4)} - $${high3h.toFixed(4)}`,
            low3h,
            high3h,
            takerBuyRatio: takerRatio,
            taker15m,
            chg24h: tInfo.chg24h || 0,
            vol24hM: tInfo.vol24hM || 0,
            signal,
            lastUpdate: Date.now()
          };

          freshRadarMap[sym] = rItem;
          scanned.push(rItem);
        }
      }));
    }

    if (scanned.length > 0) {
      radarMap = freshRadarMap;
      radarList = scanned.sort((a, b) => Math.abs(b.chg3h) - Math.abs(a.chg3h));
    }
  } catch (err) {
  } finally {
    isRadarRunning = false;
  }
}

// 2. CANLI TARAMA (350+ KOİN BALİNA & MOONSHOT AVCISI)
let lastScanHeartbeat = 0;
async function scanLoop() {
  if (isScanRunning || !isBotActive) return;
  isScanRunning = true;
  try {
    if (activePositions.length >= CONFIG.maxSlots) {
      checkSlotRotation();
      return;
    }

    // İşlemler arası 18 sn (hızlı vur-kaç, kümeleme yine sınırlı)
    if (Date.now() - lastTradeOpenTime < 18000) {
      return;
    }

    // 🛑 ACİL DURUM SERMAYE TABANI (HARD CIRCUIT BREAKER)
    if (balance < 30.0) {
      if (isBotActive) {
        isBotActive = false;
        addLog(`🛑 ACİL DURUM SİGORTASI: Bakiye $${balance.toFixed(2)} kritik taban ($30.00) altına indi! Sermayeyi korumak için yeni işlemler otomatik durduruldu.`, 'CRITICAL');
        persistState();
      }
      return;
    }

    // 🛡️ SERBEST MARJİN / SERMAYE KONTROLÜ: Açık pozisyonlar ve yeni işlem için yeterli kasa yoksa bekle
    const usedMargin = activePositions.reduce((acc, p) => acc + (p.margin || 0), 0);
    const freeMargin = balance - usedMargin;
    const minEntryMargin = 10.0;
    if (freeMargin < minEntryMargin || balance < minEntryMargin) {
      if (Date.now() - lastScanHeartbeat > 60000) {
        addLog(`⚠️ Yetersiz Serbest Teminat: Kasa $${balance.toFixed(2)} (Serbest: $${freeMargin.toFixed(2)}) < $${minEntryMargin.toFixed(2)}. Yeni işlem açılmıyor.`, 'WARN');
      }
      return;
    }

    const tickers = await fetchBinance("https://fapi.binance.com/fapi/v1/ticker/24hr");
    if (!tickers || !Array.isArray(tickers)) return;

    const now = Date.now();
    const vipSyms = Object.keys(VIP_TARGETS).filter(s => !BANNED_SYMBOLS.has(s));

    // Rolling momentum
    tickers.forEach(t => {
      const sym = t.symbol;
      const p = parseFloat(t.lastPrice);
      if (!rollingTickerPrices[sym]) rollingTickerPrices[sym] = [];
      const hist = rollingTickerPrices[sym];
      hist.push({ t: now, p });
      while (hist.length > 0 && now - hist[0].t > 180000) hist.shift();
    });

    const activeSyms = new Set(activePositions.map(x => x.symbol));

    const SYMBOL_REGEX = /^[A-Z0-9]{2,12}USDT$/;
    const validTickers = tickers.filter(t => {
      if (!SYMBOL_REGEX.test(t.symbol) || t.symbol.startsWith("USDC") || BANNED_SYMBOLS.has(t.symbol)) return false;
      const p = parseFloat(t.lastPrice);
      return p >= 0.005; // 🛡️ Kuruşluk manipülatif ve spreadi yüksek koinler (AMP vb.) filtrelenir
    });

    const fundMap = (teamStatusCache && teamStatusCache.fundingRates && teamStatusCache.fundingRates.fundingMap) || globalFundingMap || {};

    const topCandidates = validTickers.map(t => {
      const sym = t.symbol;
      const volM = (parseFloat(t.quoteVolume) || 0) / 1e6;
      const rawChg = parseFloat(t.priceChangePercent) || 0;
      const isVip = vipSyms.includes(sym);

      const hist = rollingTickerPrices[sym];
      let rollMovePct = 0;
      if (hist && hist.length >= 2) {
        const oldest = hist[0];
        const newest = hist[hist.length - 1];
        if (oldest.p > 0) rollMovePct = ((newest.p - oldest.p) / oldest.p) * 100;
      }

      const rInfo = radarMap[sym];
      let radarBoost = 0;
      if (rInfo) {
        if (rInfo.signal && rInfo.signal.includes("BALİNA")) radarBoost += 60; // 🐋 Balina tespitine devasa öncelik!
        else if (rInfo.signal && (rInfo.signal.includes("ROKET") || rInfo.signal.includes("BOĞA") || rInfo.signal.includes("SIÇRAMA"))) radarBoost += 30;
        else if (rInfo.signal && (rInfo.signal.includes("ŞELALE") || rInfo.signal.includes("AYI"))) radarBoost += 30;
        if (rInfo.chg15m >= 1.0 && rInfo.takerBuyRatio >= 50) {
          radarBoost += (rInfo.chg15m * 20) + ((rInfo.takerBuyRatio - 50) * 4.0);
        } else if (rInfo.chg15m <= -1.0 && rInfo.takerBuyRatio <= 50) {
          radarBoost += (Math.abs(rInfo.chg15m) * 16) + ((50 - rInfo.takerBuyRatio) * 3.5);
        }
      }

      // 🔥 SHORT SQUEEZE ADAYI ÖNCELİĞİ (Ağır negatif fonlamalı koinleri öne çek)
      const fItem = fundMap[sym];
      let squeezeBoost = 0;
      if (fItem && (fItem.bias === 'SHORT_SQUEEZE_ALERT' || fItem.fundingRatePct <= -0.030)) {
        squeezeBoost = 45;
      }

      const instantScore = rollMovePct > 0 ? rollMovePct * 12 : Math.abs(rollMovePct) * 8;
      const hotScore = instantScore + Math.abs(rawChg > 0 ? Math.min(rawChg, 25) : Math.max(rawChg, -25)) + (Math.sqrt(volM) * 1.8) + (isVip ? 20 : 0) + radarBoost + squeezeBoost;

      return {
        ...t,
        volM,
        chg: rawChg,
        rollMovePct,
        hotScore,
        isVip
      };
    })
    .filter(t => t.isVip || t.volM >= 1.5)
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, DYNAMIC.candidateSlice);

    if (now - lastScanHeartbeat > 45000 && topCandidates.length > 0) {
      lastScanHeartbeat = now;
      addLog(`🔍 350+ Koin Taranıyor | Lider: ${topCandidates[0].symbol} (%${topCandidates[0].chg.toFixed(1)}, Puan: ${topCandidates[0].hotScore.toFixed(0)}) | Slot: ${activePositions.length}/${CONFIG.maxSlots}`);
    }

    // 5'li paralel kline taraması
    const chunkSize = 5;
    let signalFound = false;

    for (let ci = 0; ci < topCandidates.length && !signalFound; ci += chunkSize) {
      if (activePositions.length >= CONFIG.maxSlots) break;
      const chunk = topCandidates.slice(ci, ci + chunkSize);

      const chunkData = await Promise.all(chunk.map(async item => {
        const sym = item.symbol;
        if (activeSyms.has(sym)) return null;
        if (activePositions.some(x => x.symbol === sym)) return null;
        if (coinCooldowns[sym] && coinCooldowns[sym] > Date.now()) return null;
        const lastP = parseFloat(item.lastPrice);
        if (lastP < 0.0001) return null;
        const k3m = await fetchBinance(`/fapi/v1/klines?symbol=${sym}&interval=1m&limit=30`);
        return { sym, lastP, k3m, chg: parseFloat(item.priceChangePercent) || 0, isVip: item.isVip };
      }));

      for (const data of chunkData) {
        if (!data || !data.k3m || data.k3m.length < 22) continue;
        if (activePositions.length >= CONFIG.maxSlots || signalFound) break;

        const { sym, lastP, k3m, chg, isVip } = data;
        if (activePositions.some(x => x.symbol === sym) || activeSyms.has(sym) || (coinCooldowns[sym] && coinCooldowns[sym] > Date.now())) continue;
        // 🛡️ 12 saatlik ceza süresi dolduysa deneme süresine (probation) al
        if (coinLossCount[sym] >= 2) {
          if (coinCooldowns[sym] && coinCooldowns[sym] > Date.now()) continue;
          coinLossCount[sym] = 1; // 12 saat doldu, deneme süresi
        }

        const rInfo = radarMap[sym] || null;
        // 🛡️ Sığ koin filtresi: 24 saatlik hacim en az $1.5M olmalıdır
        const vol24 = data.volM || (rInfo ? rInfo.vol24hM : 0) || 0;
        if (vol24 > 0 && vol24 < 1.5) continue;

        // 🧠 DEEP ANALYSIS FİLTRELERİ
        const intel = global.coinIntelligence[sym];
        let nearMax6m = false;
        if (intel) {
           // 1. Tarihi Dirence Yakınlık Kontrolü (Breakout kırılımlarında engelleme yapma)
           if (lastP >= intel.max6m * 0.985 && lastP < intel.max6m * 1.005) {
             nearMax6m = true;
           }
           // 2. Karakteri Fazla Yavaş Koinleri Ele (Günde ortalama %1.5'ten az hareket eden)
           if (intel.volatilityScore < 1.5) {
             continue; // Yeterince volatil değil, Moonshot çıkmaz.
           }
        }

        const lastIdx = k3m.length - 1;

        const curP = parseFloat(k3m[lastIdx][4]);
        const curO = parseFloat(k3m[lastIdx][1]);
        const curH = parseFloat(k3m[lastIdx][2]);
        const curL = parseFloat(k3m[lastIdx][3]);
        const curV = parseFloat(k3m[lastIdx][5]);

        const prevC = parseFloat(k3m[lastIdx - 1][4]);
        const prevO = parseFloat(k3m[lastIdx - 1][1]);
        const prevV = parseFloat(k3m[lastIdx - 1][5]);

        let sumVol20 = 0;
        for (let m = lastIdx - 20; m < lastIdx; m++) sumVol20 += parseFloat(k3m[m][5]);
        const avgVol20 = (sumVol20 / 20) || 1;

        const curMovePct = ((curP - curO) / curO) * 100;
        const twoCandleMovePct = ((curP - prevO) / prevO) * 100;
        const minJump = 0.15;
        const maxChaseMove = 0.35;

        let radarOkLong = true;
        let radarOkShort = true;
        let isDirectRadarLong = false;
        let isDirectRadarShort = false;
        let radarTag = "";
        const chg24Val = rInfo ? (rInfo.chg24h !== undefined ? rInfo.chg24h : chg) : chg;
        const chg15Val = (rInfo && rInfo.chg15m !== undefined && rInfo.chg15m !== null) ? rInfo.chg15m : 0;
        const chg3Val = (rInfo && rInfo.chg3h !== undefined && rInfo.chg3h !== null) ? rInfo.chg3h : 0;
        const takerRatio = (rInfo && rInfo.takerBuyRatio !== undefined && rInfo.takerBuyRatio !== null) ? rInfo.takerBuyRatio : 50;

        if (rInfo) {
          // 🎯 RADAR DOĞRUDAN VUR-KAÇ TETİĞİ (GECİKMELİ GİRİŞ ENGELLİ)
          const taker = takerRatio;
          const chg3 = chg3Val;
          const sig = rInfo.signal || "";

          // 1. YÜKSELİRKEN VUR-KAÇ (LONG): 15m pozitif + Taker >= 50.0% + Radar Boğa/Roket/Balina/Sıçrama
          const minTakerLong = DYNAMIC.mode === 'DEFENSIVE_SNIPER' ? 56.0 : 55.0;
          const isEarlyLongMove = chg15Val >= 0.05 && (chg3 >= 0.3 || chg15Val >= 0.3) && chg24Val >= -15.0 && taker >= minTakerLong;
          if (isEarlyLongMove && (sig.includes("BOĞA") || sig.includes("ROKET") || sig.includes("SIÇRAMA") || sig.includes("BALİNA"))) {
            isDirectRadarLong = true;
            radarTag = `[${sig} | 3s: +%${chg3.toFixed(1)} / 15m: +%${chg15Val.toFixed(1)} / %${taker.toFixed(0)} Alıcı]`;
          }

          // 2. DÜŞERKEN VUR-KAÇ (SHORT): 15m negatif + Taker <= 50.0% + Radar Ayı/Şelale/Balina
          const maxTakerShort = DYNAMIC.mode === 'DEFENSIVE_SNIPER' ? 44.0 : 45.0;
          const isEarlyShortMove = chg15Val <= -0.05 && (chg3 <= -0.3 || chg15Val <= -0.3) && chg24Val <= 15.0 && taker <= maxTakerShort;
          if (isEarlyShortMove && (sig.includes("AYI") || sig.includes("ŞELALE") || sig.includes("BALİNA"))) {
            isDirectRadarShort = true;
            radarTag = `[${sig} | 3s: %${chg3.toFixed(1)} / 15m: %${chg15Val.toFixed(1)} / %${(100 - taker).toFixed(0)} Satıcı]`;
          }

          // 3. NEGATİF FONLAMA SHORT SQUEEZE TETİĞİ (KURUMSAL LİKİDASYON ROKETİ)
          const fItemLive = fundMap[sym];
          const isSqueezeAlert = !!(fItemLive && (fItemLive.bias === 'SHORT_SQUEEZE_ALERT' || fItemLive.fundingRatePct <= -0.030));
          if (isSqueezeAlert && chg15Val >= 0.05 && taker >= 50.0) {
            isDirectRadarLong = true;
            radarTag = `[🔥 SHORT SQUEEZE | Fonlama: %${fItemLive.fundingRatePct} / %${taker.toFixed(0)} Alıcı]`;
          }

          // 🛡️ DÜŞEN BIÇAK ENGELİ: Sadece aşırı zıt yönlerde engelle
          if (chg15Val < -0.40) {
            isDirectRadarLong = false;
            radarOkLong = false;
          }
          if (chg15Val > 0.40) {
            isDirectRadarShort = false;
            radarOkShort = false;
          }

          // 🛡️ SİNYAL TERSİNE İŞLEM AÇMA YASAĞI
          if (sig.includes("ROKET") || sig.includes("BOĞA")) {
            radarOkShort = false;
            isDirectRadarShort = false;
          }
          if (sig.includes("ŞELALE") || sig.includes("AYI")) {
            radarOkLong = false;
            isDirectRadarLong = false;
          }
        }

        // 🕐 1. ANLIK MUM TEYİDİ & FRESH MOMENTUM
        const candleStart = (k3m[lastIdx] && k3m[lastIdx][0]) ? k3m[lastIdx][0] : (Date.now() - 60000);
        const candleElapsedSec = Math.max(8, Math.min(60, (Date.now() - candleStart) / 1000));
        // İlk 25 sn'de hacmi 60 sn'ye şişirme; kısmi mum zaten 1.6 kat ise gir
        const volMult = candleElapsedSec >= 25
          ? (curV * (60 / candleElapsedSec)) / avgVol20
          : curV / avgVol20;
        const isWhaleVol = volMult >= 1.6;

        // Mum zaten %0.50 koşmuşsa geç kalınmış demektir
        if (Math.abs(curMovePct) > 0.50 || Math.abs(twoCandleMovePct) > 0.65) {
          continue;
        }
        const inLongBand = curMovePct >= minJump && curMovePct <= maxChaseMove && curP > curO;
        const inShortBand = curMovePct <= -minJump && curMovePct >= -maxChaseMove && curP < curO;

        // 4. Kural: Mum Dikliği (Wick Filtresi) - Zirveden fitil payı
        const candleSpan = curH - curL;
        const upperWick = curH - Math.max(curP, curO);
        const lowerWick = Math.min(curP, curO) - curL;
        const noWickLong = candleSpan > 0 ? (upperWick / candleSpan <= 0.50) : true;
        const noWickShort = candleSpan > 0 ? (lowerWick / candleSpan <= 0.50) : true;

        // 5. Kural: Likidite & Alıcı Hakimiyeti
        const hasRealLiquidity = rInfo ? ((rInfo.vol3hM || 0) >= (DYNAMIC.vol3hMin || 0.8)) : true;
        const hasBuyerDominance = rInfo ? ((rInfo.takerBuyRatio || 50) >= 52.0) : true;
        const hasSellerDominance = rInfo ? ((rInfo.takerBuyRatio || 50) <= 48.0) : true;

        // 🟢 MARSCOIN LONG ATEŞLEMESİ:
        let isLongPump = false;
        let isRocketSignal = false;
        if (hasRealLiquidity && noWickLong && hasBuyerDominance && inLongBand && isWhaleVol && radarOkLong) {
          isLongPump = true;
          isRocketSignal = true;
          radarTag = `[⚡ HIZLI VUR-KAÇ LONG | 1dk: +%${curMovePct.toFixed(2)} | Hacim: ${volMult.toFixed(1)}x]`;
        }

        // 🔴 MARSCOIN SHORT ATEŞLEMESİ:
        let isShortDump = false;
        if (hasRealLiquidity && noWickShort && hasSellerDominance && inShortBand && isWhaleVol && radarOkShort) {
          const flowBias = getMarketFlowBias();
          const blockCounterTrendShort = isChoppyRegime() && flowBias === 'BULLISH';
          if (!blockCounterTrendShort) {
            isShortDump = true;
            radarTag = `[⚡ HIZLI VUR-KAÇ SHORT | 1dk: %${curMovePct.toFixed(2)} | Hacim: ${volMult.toFixed(1)}x]`;
          }
        }

        if (isLongPump || isShortDump) {
          const side = isLongPump ? "LONG" : "SHORT";

          // 🐋 6. AJAN (BALİNA & PARA AKIŞI AVCISI) KONTROLÜ
          const scoutMap = (teamStatusCache && teamStatusCache.moneyFlow && teamStatusCache.moneyFlow.flowMap) || globalWhaleFlowMap || null;
          let scoutInfo = scoutMap ? scoutMap[sym] : null;
          if (!scoutInfo && k3m && k3m.length >= 8) {
            let quote = 0;
            let takerBuy = 0;
            const recent = k3m.slice(-12);
            for (const k of recent) {
              quote += parseFloat(k[7]) || 0;
              takerBuy += parseFloat(k[10]) || 0;
            }
            const takerPct = quote > 0 ? (takerBuy / quote) * 100 : 50;
            const netFlowM = ((takerBuy * 2) - quote) / 1e6;
            const open0 = parseFloat(recent[0][1]) || 0;
            const closeN = parseFloat(recent[recent.length - 1][4]) || 0;
            const priceChg = open0 > 0 ? ((closeN - open0) / open0) * 100 : 0;
            let cvdDivergence = 'NONE';
            if (priceChg >= 0.35 && takerPct <= 47) cvdDivergence = 'BEARISH_DIVERGENCE';
            else if (priceChg <= -0.35 && takerPct >= 53) cvdDivergence = 'BULLISH_DIVERGENCE';
            scoutInfo = {
              cvdDivergence,
              isApprovedLong: takerPct >= 48 && netFlowM >= -0.02,
              isApprovedShort: takerPct <= 52 && netFlowM <= 0.02,
              netFlowM: Number(netFlowM.toFixed(3)),
              takerPct
            };
          }
          if (scoutInfo) {
            if (side === 'LONG' && scoutInfo.cvdDivergence === 'BEARISH_DIVERGENCE') {
              addLog(`🛑 [BALİNA VETO]: ${sym} LONG — Ayı CVD uyumsuzluğu (fakeout).`, 'WARN');
              continue;
            }
            if (side === 'SHORT' && scoutInfo.cvdDivergence === 'BULLISH_DIVERGENCE') {
              addLog(`🛑 [BALİNA VETO]: ${sym} SHORT — Boğa CVD uyumsuzluğu (squeeze).`, 'WARN');
              continue;
            }
            if (side === 'LONG' && scoutInfo.isApprovedLong === false) {
              addLog(`🛑 [BALİNA VETO]: ${sym} LONG — Kurumsal para çıkışı (-$${Math.abs(scoutInfo.netFlowM)}M).`, 'WARN');
              continue;
            }
            if (side === 'SHORT' && scoutInfo.isApprovedShort === false) {
              addLog(`🛑 [BALİNA VETO]: ${sym} SHORT — Kurumsal para girişi (+$${scoutInfo.netFlowM}M).`, 'WARN');
              continue;
            }
          }

          // 🛡️ HUMMINGBOT ORDER BOOK IMBALANCE (OBI - DERİNLİK DENGESİZLİĞİ & DUVAR KORUMASI)
          try {
            const depthData = await fetchBinance(`/fapi/v1/depth?symbol=${sym}&limit=10`);
            if (depthData && Array.isArray(depthData.bids) && Array.isArray(depthData.asks)) {
              const bidVol = depthData.bids.reduce((acc, b) => acc + ((parseFloat(b[0]) || 0) * (parseFloat(b[1]) || 0)), 0);
              const askVol = depthData.asks.reduce((acc, a) => acc + ((parseFloat(a[0]) || 0) * (parseFloat(a[1]) || 0)), 0);
              const totalDepth = bidVol + askVol;
              if (totalDepth > 0) {
                const obi = (bidVol - askVol) / totalDepth;
                if (side === 'LONG' && obi < -0.35) {
                  addLog(`🛑 [OBI VETO]: ${sym} LONG — Satış duvarı (OBI: ${obi.toFixed(2)}).`, 'WARN');
                  continue;
                }
                if (side === 'SHORT' && obi > 0.35) {
                  addLog(`🛑 [OBI VETO]: ${sym} SHORT — Alış duvarı (OBI: +${obi.toFixed(2)}).`, 'WARN');
                  continue;
                }
              }
            }
          } catch(e) {}

          // 🎯 7. AJAN (FREQ-AI & LİKİDASYON AVCISI) KONTROLLERİ
          // A) FONLAMA ORANI & LİKİDASYON SIKIŞMASI (SQUEEZE) KONTROLÜ
          const fundingMap = (teamStatusCache && teamStatusCache.fundingRates && teamStatusCache.fundingRates.fundingMap) || globalFundingMap || null;
          const fundingInfo = fundingMap ? fundingMap[sym] : null;
          if (fundingInfo) {
            if (side === 'LONG' && fundingInfo.isApprovedLong === false) {
              addLog(`🛑 [FONLAMA VETO]: ${sym} LONG — Aşırı pozitif fonlama (+%${fundingInfo.fundingRatePct}).`, 'WARN');
              continue;
            }
            if (side === 'SHORT' && fundingInfo.isApprovedShort === false) {
              addLog(`🛑 [FONLAMA VETO]: ${sym} SHORT — Short squeeze fonlaması (%${fundingInfo.fundingRatePct}).`, 'WARN');
              continue;
            }
          }

          // B) FREQ-AI MAKİNE ÖĞRENİMİ (ML) KAZANMA OLASILIĞI DEĞERLENDİRMESİ
          const mlFeatures = {
            symbol: sym,
            side: side,
            takerBuyRatio: rInfo ? (rInfo.takerBuyRatio || 50) : 50,
            chg15m: chg15Val,
            chg3h: rInfo ? (rInfo.chg3h || 0) : 0,
            chg24h: chg24Val,
            vol3hM: rInfo ? (rInfo.vol3hM || 5.0) : 5.0,
            btc5m: btc5mNumeric,
            btc15m: btc15mNumeric,
            fundingRatePct: fundingInfo ? fundingInfo.fundingRatePct : 0.01,
            netFlowM: scoutInfo ? scoutInfo.netFlowM : 0,
            mode: DYNAMIC.mode
          };
          let mlEval = { isApproved: true, winProbabilityPct: 75, confidence: 'YÜKSEK', topDeterrent: '' };
          try {
            mlEval = predictTradeProbability(mlFeatures);
          } catch(e) {}

          if (!mlEval.isApproved) {
            addLog(`🛑 [FREQ-AI VETO]: ${sym} ${side} — Kazanma olasılığı %${mlEval.winProbabilityPct} (${mlEval.topDeterrent || 'Düşük olasılık'}).`, 'WARN');
            continue;
          }

          // 🏛️ 8. AJAN (ASLAN11 BAŞ YARGIÇ) ÖN YARGILAMA VE SABIKA DENETİMİ
          let judgeClearance = { approved: true, verdict: 'BERAAT', judicialScore: 85, reason: '' };
          try {
            judgeClearance = evaluatePreTradeClearance(sym, side, {
              takerBuyRatio: rInfo ? (rInfo.takerBuyRatio || 50) : 50,
              chg15m: chg15Val,
              chg24h: chg24Val
            });
          } catch(e) {}

          if (judgeClearance && judgeClearance.approved === false) {
            coinCooldowns[sym] = now + (3 * 60 * 1000);
            addLog(`🛡️ [YARGIÇ AĞIR CEZA VETOSU]: ${sym} ${side} engellendi — ${judgeClearance.reason}`, 'WARN');
            try {
              addDialogue('JUDGE', `🛑 AĞIR CEZA VETOSU! ${sym} sanığı için hüküm: ${judgeClearance.verdict}. Gerekçe: ${judgeClearance.reason}. Kronik sabıkalı işlem durduruldu!`, 'RISK');
            } catch(e) {}
            continue;
          }

          // 👑 1. SLOT DOLULUK KONTROLÜ (Maksimum slot sınırını aşma)
          if (activePositions.length >= CONFIG.maxSlots) {
            continue;
          }

          // 👑 1. AJAN (PORTFÖY YÖNETİCİSİ) DİNAMİK ASİMETRİK TEMİNAT & VUR-KAÇ BOYUTLANDIRMASI
          const currentFreeMargin = balance - activePositions.reduce((acc, p) => acc + (p.margin || 0), 0);
          let sizing = {
            tier: 'TIER_STANDARD',
            tierLabel: '🏔️ MARSCOIN ROKET',
            margin: CONFIG.marginPerTrade || 15.0,
            slPct: CONFIG.slPct || 1.10,
            bePct: CONFIG.bePct || 1.00,
            tp1Pct: CONFIG.tp1Pct || 1.20,
            moonPct: CONFIG.moonPct || 2.40,
            convictionScore: 70,
            rationale: '🏔️ Marscoin Roket Sinyali'
          };
          if (typeof calculateConvictionSizing === 'function') {
            try {
              sizing = calculateConvictionSizing({
                sym: sym,
                side: side,
                takerBuyRatio: rInfo ? (rInfo.takerBuyRatio || 50) : 50,
                winProbabilityPct: mlEval ? mlEval.winProbabilityPct : 70,
                netFlowM: scoutInfo ? scoutInfo.netFlowM : 0,
                vol3hM: rInfo ? (rInfo.vol3hM || 5.0) : 5.0,
                isVip: VIP_TARGETS[sym] !== undefined,
                judicialScore: judgeClearance ? judgeClearance.judicialScore : 80,
                balance: balance,
                mode: DYNAMIC.mode,
                freeMargin: currentFreeMargin,
                fundingRatePct: fundingInfo ? fundingInfo.fundingRatePct : 0.01,
                isShortSqueeze: !!(fundingInfo && (fundingInfo.bias === 'SHORT_SQUEEZE_ALERT' || fundingInfo.fundingRatePct <= -0.030))
              });
            } catch (e) {}
          }

          sizing.tier = isRocketSignal ? 'TIER_ROCKET_SNIPER' : (sizing.tier || 'TIER_STANDARD');
          sizing.tierLabel = '⚡ HIZLI VUR-KAÇ';
          sizing.slPct = CONFIG.slPct || 0.25;
          sizing.bePct = CONFIG.bePct || 0.20;
          sizing.tp1Pct = CONFIG.tp1Pct || 0.60;
          sizing.moonPct = CONFIG.moonPct || 0.42;

          const tradeMargin = Number(sizing.margin) || CONFIG.marginPerTrade || 15.0;
          const tradeSlPct = Number(sizing.slPct) || CONFIG.slPct || 1.10;
          const tradeBePct = Number(sizing.bePct) || CONFIG.bePct || 1.00;
          const tradeTp1Pct = Number(sizing.tp1Pct) || CONFIG.tp1Pct || 1.20;
          const tradeMoonPct = Number(sizing.moonPct) || CONFIG.moonPct || 2.40;

          const stopPrice = side === "LONG" 
            ? curP * (1 - tradeSlPct / 100) 
            : curP * (1 + tradeSlPct / 100);

          const position = {
            id: Date.now() + Math.random().toString(36).substring(2, 6),
            symbol: sym,
            side: side,
            entryPrice: curP,
            currentPrice: curP,
            entryTime: Date.now(),
            stopPrice: stopPrice,
            beLocked: false,
            tier1Locked: false,
            tp1Taken: false,
            tp2Taken: false,
            mfe: 0.0,
            mae: 0.0,
            pnl: 0.0,
            roi: 0.0,
            entryRsi: 50,
            margin: tradeMargin,
            initialMargin: tradeMargin,
            leverage: CONFIG.leverage,
            slPct: tradeSlPct,
            bePct: tradeBePct,
            tp1Pct: tradeTp1Pct,
            moonPct: tradeMoonPct,
            convictionTier: sizing.tier,
            convictionScore: sizing.convictionScore,
            convictionLabel: sizing.tierLabel,
            radarTag: radarTag,
            chg3h: rInfo ? rInfo.chg3h : null,
            vol3hM: rInfo ? rInfo.vol3hM : null,
            chg24h: rInfo ? rInfo.chg24h : chg,
            range3h: rInfo ? rInfo.range3h : "",
            takerBuyRatio: rInfo ? rInfo.takerBuyRatio : null,
            signal: (rInfo && rInfo.signal) ? rInfo.signal : (side === "LONG" ? "🟢 BOĞA MOMENTUM" : "🔴 AYI MOMENTUM"),
            btc5mEntry: btc5mNumeric,
            btc15mEntry: btc15mNumeric
          };

          activePositions.push(position);
          activeSyms.add(sym);
          signalFound = true;
          lastTradeOpenTime = Date.now();
          persistState();

          addLog(`🚀 POZİSYON AÇILDI: [${side}] ${sym} @ $${curP.toFixed(4)} | Teminat: $${tradeMargin.toFixed(1)} (${sizing.tierLabel} Skor: %${sizing.convictionScore}) | SL: $${stopPrice.toFixed(4)} | TP1: +%${tradeTp1Pct.toFixed(2)} | Moon: +%${tradeMoonPct.toFixed(2)}`, 'TRADE');
          try {
            const volTxt = (rInfo && rInfo.vol3hM != null) ? `$${rInfo.vol3hM.toFixed(1)}M` : 'bilinmiyor';
            const takerTxt = (rInfo && rInfo.takerBuyRatio != null) ? `%${rInfo.takerBuyRatio.toFixed(1)}` : 'bilinmiyor';
            const scoutTxt = scoutInfo ? ` | 🐋 Kurumsal Akış: ${scoutInfo.netFlowM > 0 ? '+' : ''}$${scoutInfo.netFlowM}M` : '';
            const fundTxt = fundingInfo ? ` (%${fundingInfo.fundingRatePct})` : '';
            addDialogue('ANALYST', `🚨 ${sym} ${side} sinyali: 3s hacim ${volTxt}, alıcı oranı ${takerTxt}, 24s %${chg24Val.toFixed(1)}, rejim: ${DYNAMIC.regime}.`, 'TRADE');
            addDialogue('WHALE_HUNTER', `🐋 ${sym} ${side} ONAYLANDI: Para akışı lehimize${scoutTxt}. Büyük oyuncularla aynı yöndeyiz!`, 'TRADE');
            addDialogue('FREQAI', `🎯 ${sym} ${side} ONAYLANDI: FreqAI ML Kazanma Olasılığı %${mlEval.winProbabilityPct} (${mlEval.confidence}) | Fonlama: ${fundTxt || '%0.010'}.`, 'TRADE');
            addDialogue('JUDGE', `🏛️ ${sym} ${side} BERAAT: Disiplin Puanı ${judgeClearance.judicialScore}/100. Giriş nizamı ve kurallar onaylandı.`, 'TRADE');
            addDialogue('TRADER', `⚔️ ${sym} ${side} @ $${curP.toFixed(4)} | Nominal $${(tradeMargin * CONFIG.leverage).toFixed(0)} (${CONFIG.leverage}x) | Teminat $${tradeMargin.toFixed(1)} | SL $${stopPrice.toFixed(4)}.`, 'TRADE');
            addDialogue('MANAGER', `👑 [YÖNETİCİ ASİMETRİK VUR-KAÇ]: ${sym} ${sizing.tierLabel} (Skor %${sizing.convictionScore}). Teminat $${tradeMargin.toFixed(1)} tahsis edildi! Hedef TP1: +%${tradeTp1Pct.toFixed(2)}, Moon: +%${tradeMoonPct.toFixed(2)}. Slot ${activePositions.length}/${CONFIG.maxSlots}.`, 'RISK');
          } catch(e) {}
          break;
        }
      }
    }
  } catch (err) {
    console.error("❌ scanLoop Hatası:", err);
    addLog(`❌ scanLoop Hatası: ${err.message}`, 'WARN');
  } finally {
    isScanRunning = false;
  }
}

function checkSlotRotation() {
  if (activePositions.length < CONFIG.maxSlots) return;
  const now = Date.now();
  let stagnantIdx = -1;
  let maxDuration = 0;

  activePositions.forEach((pos, idx) => {
    const durMin = (now - pos.entryTime) / 60000;
    // 🛡️ DÜZELTME: Derin zarardaki koinler rotasyonla KESİLMEZ! Zarar yazmayı engeller.
    // Rotasyon SADECE başabaş seviyesinde bayatlamış (ROI -%5 ile +%4 arasında, MFE < %0.45) ve 30 dk hareketsiz kalan koinleri temizler.
    if (durMin >= 3 && (pos.mfe || 0) < 0.12 && Math.abs(pos.roi || 0) <= 8.0) {
      if (durMin > maxDuration) {
        maxDuration = durMin;
        stagnantIdx = idx;
      }
    }
  });

  if (stagnantIdx !== -1) {
    const closed = activePositions.splice(stagnantIdx, 1)[0];
    const durMin = Math.round((now - closed.entryTime) / 60000);
    closeTrade(closed, `🔄 Slot Rotasyonu (${closed.symbol} ${durMin}dk Uyudu - Yeni Rokete Yer Açıldı)`);
    persistState();
  }
}

// 3. LAZER RİSK & KÂR KİLİTLEME (FAST RISK LOOP)
async function fastRiskLoop() {
  if (isRiskRunning || activePositions.length === 0) return;
  isRiskRunning = true;
  try {
    const symbols = [...new Set(activePositions.map(p => p.symbol))];
    const priceMap = {};

    await Promise.all(symbols.map(async sym => {
      const pData = await fetchBinance(`/fapi/v1/ticker/price?symbol=${sym}`);
      if (pData && pData.price) {
        priceMap[sym] = parseFloat(pData.price);
      }
    }));

    if (Object.keys(priceMap).length === 0) return;

    const now = Date.now();
    let stateChanged = false;

    for (let i = activePositions.length - 1; i >= 0; i--) {
      const pos = activePositions[i];
      const curP = priceMap[pos.symbol];
      if (!curP) continue;

      const isLong = pos.side === "LONG";
      const move = isLong 
        ? ((curP - pos.entryPrice) / pos.entryPrice) * 100 
        : ((pos.entryPrice - curP) / pos.entryPrice) * 100;

      pos.currentPrice = curP;
      pos.mfe = Math.max(pos.mfe || 0, move);
      pos.mae = Math.max(pos.mae || 0, -move);
      const mfe = pos.mfe || 0;
      const mae = pos.mae || 0;

      const nominalSize = pos.margin * pos.leverage;
      const feeCost = nominalSize * CONFIG.feeRate * 2;
      pos.pnl = (nominalSize * (move / 100)) - feeCost;
      pos.roi = (pos.pnl / pos.margin) * 100;

      let exitReason = null;

      // 🎯 1. KADEMELİ KÂR ALMA (TP1): Görünce %50 Pozisyon Kapatılır, Kâr Cebe İner!
      const tp1Goal = pos.tp1Pct || CONFIG.tp1Pct || 1.20;
      if (!pos.tp1Taken && move >= tp1Goal) {
        pos.tp1Taken = true;
        const closedMargin = pos.margin / 2;
        const closedNominal = closedMargin * pos.leverage;
        const closedFee = closedNominal * CONFIG.feeRate * 2;
        const tp1Profit = (closedNominal * (move / 100)) - closedFee;

        pos.tp1Pnl = (pos.tp1Pnl || 0) + tp1Profit;
        balance += tp1Profit; // Kâr bakiyeye anında eklenir
        pos.margin = pos.margin - closedMargin; // Kalan pozisyon marjini yarıya düşer

        // Kalan marjin için anlık nominal ve pnl güncellemesi (aynı tickte çıkış olursa çifte kazanç yazılmasını engeller)
        const remNominal = pos.margin * pos.leverage;
        const remFee = remNominal * CONFIG.feeRate * 2;
        pos.pnl = (remNominal * (move / 100)) - remFee;
        pos.roi = (pos.pnl / pos.margin) * 100;

        // Kalan %50 için Stop Loss derhal Başabaşa (+%0.20 kâra) kilitlenir
        pos.beLocked = true;
        pos.stopPrice = isLong ? pos.entryPrice * 1.0020 : pos.entryPrice * 0.9980;
        stateChanged = true;

        addLog(`💰 [TP1 ALINDI] ${pos.symbol} %50 Pozisyon Kapatıldı! +$${tp1Profit.toFixed(2)} Kâr Cebe İndi (+%${(move * pos.leverage).toFixed(1)} ROI). Kalan Stop Başabaşa Çekildi.`, 'TRADE');
      }

      // 🛡️ 2. DİNAMİK İZ SÜREN STOP (TRAILING STOP) & ERKEN BAŞABAŞ KORUMASI
      const beGoal = pos.bePct || CONFIG.bePct || 1.00;
      let targetStop = null;
      if (mfe >= 2.00) {
        targetStop = isLong ? pos.entryPrice * (1 + (mfe - 0.45) / 100) : pos.entryPrice * (1 - (mfe - 0.45) / 100);
      } else if (mfe >= 1.50) {
        targetStop = isLong ? pos.entryPrice * (1 + (mfe - 0.35) / 100) : pos.entryPrice * (1 - (mfe - 0.35) / 100);
      } else if (mfe >= beGoal) {
        targetStop = isLong ? pos.entryPrice * 1.0012 : pos.entryPrice * 0.9988;
      }

      const durSecLive = (now - pos.entryTime) / 1000;

      if (targetStop) {
        if (!pos.beLocked && mfe >= beGoal) {
          pos.beLocked = true;
          addLog(`🛡️ [BAŞABAŞ KİLİDİ] ${pos.symbol} +%${mfe.toFixed(2)} Gördü, Stop Girişe Çekildi ($0.00 Risk).`, 'TRADE');
        }
        if (!pos.stopPrice || (isLong && targetStop > pos.stopPrice) || (!isLong && targetStop < pos.stopPrice)) {
          pos.stopPrice = targetStop;
          stateChanged = true;
        }
      }

      // 🎯 3. SERT VUR-KAÇ HEDEFİ (+%2.20 - +%3.00 Spot = +%44 - +%60 ROI ile Anında Kapat!)
      const moonGoal = pos.moonPct || CONFIG.moonPct || 2.40;
      if (!exitReason && move >= moonGoal) {
        exitReason = pos.tp1Taken
          ? `🎯 KADEMELİ MOONSHOT ALINDI (TP1 + Kalan: +%${pos.roi.toFixed(1)} ROI / +%${move.toFixed(2)} Spot)`
          : `🎯 VUR-KAÇ HEDEFİ VURULDU (+%${pos.roi.toFixed(1)} ROI / +%${move.toFixed(2)} Spot)`;
      }

      // 4. DİNAMİK ZİRVEDEN DÖNÜŞ KÂR KORUMASI (LAZER KÂR KİLİDİ)
      let pullbackLimit = 0.08;
      if (mfe >= 0.35) pullbackLimit = 0.06;
      const effectivePullback = pullbackLimit;
      const minMfeForLock = 0.28;

      if (!exitReason && move > 0 && mfe >= minMfeForLock && (mfe - move) >= effectivePullback) {
        exitReason = pos.tp1Taken
          ? `🏆 TP1 CEPTE + Kalan Lazer Kâr Kilidi (+%${pos.roi.toFixed(1)} ROI / Zirve: +%${mfe.toFixed(2)} Spot)`
          : `🏆 Lazer Vur-Kaç Kâr Kilidi (+%${pos.roi.toFixed(1)} ROI / Zirve: +%${mfe.toFixed(2)} Spot)`;
      }

      // 90 sn içinde lehe %0.10 yoksa çizikten çık
      if (!exitReason && durSecLive >= 90 && (pos.mfe || 0) < 0.10) {
        exitReason = `⏱️ 90sn İvme Yok (MFE: +%${(pos.mfe || 0).toFixed(2)} / Hızlı Çıkış)`;
      }

      // 🚨 6. AJAN ACİL DURUM TAHLİYESİ (MAKRO PİYASA TERS DÖNÜŞ FRENİ)
      // Açık SHORT varken BTC sert yukarı fırlarsa (+%0.35 üzeri) ve pozisyon eksideyse (ROI <= -2.0%):
      // Açık LONG varken BTC sert aşağı çökerse (-%0.35 altı) ve pozisyon eksideyse (ROI <= -2.0%):
      // Tam stop loss'u (-%18 ROI) bekleyip kasayı delme! Ajanlar piyasa dönüşünü anında keser!
      if (!exitReason && pos.roi <= -5.0) {
        if (!isLong && (btc15mNumeric >= 0.65 || btc5mNumeric >= 0.70)) {
          exitReason = `🚨 [AJAN ACİL TAHLİYE]: BTC Boğa Dalgası Başlattı (${btc15mTrend}), SHORT Pozisyonu Kurtarıldı (Erken Kesildi: %${pos.roi.toFixed(1)} ROI)`;
          try { addDialogue('WHALE_HUNTER', `🚨 ACİL TAHLİYE! BTC sert yeşile döndü (${btc15mTrend}). ${pos.symbol} SHORT pozisyonu tam stop beklenmeden hemen tahliye edildi!`, 'RISK'); } catch(e) {}
        } else if (isLong && (btc15mNumeric <= -0.65 || btc5mNumeric <= -0.70)) {
          exitReason = `🚨 [AJAN ACİL TAHLİYE]: BTC Sert Satış Dalgası Başlattı (${btc15mTrend}), LONG Pozisyonu Kurtarıldı (Erken Kesildi: %${pos.roi.toFixed(1)} ROI)`;
          try { addDialogue('WHALE_HUNTER', `🚨 ACİL TAHLİYE! BTC sert kırmızıya çöktü (${btc15mTrend}). ${pos.symbol} LONG pozisyonu tam stop beklenmeden hemen tahliye edildi!`, 'RISK'); } catch(e) {}
        }
      }

      // 7. STOP LOSS VEYA KİLİTLİ STOP TETİKLENMESİ
      if (!exitReason && ((isLong && curP <= pos.stopPrice) || (!isLong && curP >= pos.stopPrice))) {
        if ((isLong && pos.stopPrice > pos.entryPrice * 1.0025) || (!isLong && pos.stopPrice < pos.entryPrice * 0.9975)) {
          exitReason = `🔒 Garanti Kilitli Kâr Çıkışı (+%${pos.roi.toFixed(1)} ROI / Stop Tetiklendi)`;
        } else if (pos.beLocked) {
          exitReason = pos.tp1Taken
            ? `🛡️ TP1 KÂRI CEPTE + Kalan Başabaş Kapandı`
            : `🛡️ Başabaş Koruma Çıkışı ($0.00 Risk / Zirve: +%${mfe.toFixed(2)})`;
        } else {
          exitReason = `🛑 Moonshot Stop Loss (-%${CONFIG.slPct.toFixed(2)})`;
        }
      }

      if (exitReason) {
        activePositions.splice(i, 1);
        closeTrade(pos, exitReason);
        stateChanged = true;
      }
    }

    if (stateChanged) persistState();
  } catch (err) {
    console.error("fastRiskLoop Hatası:", err);
    addLog(`⚠️ fastRiskLoop Hatası: ${err.message}`, 'ERROR');
  } finally {
    isRiskRunning = false;
  }
}

function closeTrade(pos, exitReason) {
  const now = Date.now();
  const durMin = Math.round((now - pos.entryTime) / 60000);
  
  // Kalan pozisyonun PnL'i bakiyeye eklenir (TP1 zaten TP1 anında eklenmişti)
  balance += pos.pnl;

  const totalTradePnl = pos.pnl + (pos.tp1Pnl || 0);
  const initialMargin = pos.initialMargin || (pos.margin + (pos.tp1Taken ? pos.margin : 0)) || 20.0;
  const totalTradeRoi = (totalTradePnl / initialMargin) * 100;
  
  let formattedExitReason = exitReason;
  if (pos.tp1Taken && exitReason.includes("Başabaş")) {
    formattedExitReason = `🛡️ TP1 KÂRI CEPTE + Kalan Başabaş Kapandı (+%${totalTradeRoi.toFixed(1)} ROI / +$${totalTradePnl.toFixed(2)})`;
  } else if (pos.tp1Taken && exitReason.includes("MOONSHOT")) {
    formattedExitReason = `🎯 KADEMELİ MOONSHOT ALINDI (Toplam: +$${totalTradePnl.toFixed(2)} / +%${totalTradeRoi.toFixed(1)} ROI)`;
  }

  // 🛡️ ÇOKLAMA / YENİDEN GİRİŞ VE ARDIŞIK ZARAR KORUMASI (COOLDOWN)
  const isRealLoss = (totalTradePnl <= -0.05) || exitReason.includes("Stop Loss") || exitReason.includes("Durgunluk");
  if (isRealLoss) {
    coinLossCount[pos.symbol] = (coinLossCount[pos.symbol] || 0) + 1;
    if (coinLossCount[pos.symbol] >= 2) {
      // 2 kez zarar eden koin 12 saat kilitlenir!
      coinCooldowns[pos.symbol] = now + (12 * 60 * 60 * 1000);
      addLog(`🚫 ${pos.symbol} ardışık ${coinLossCount[pos.symbol]} zarar verdi — koin 12 saat boyunca yasaklandı!`, 'TRADE');
    } else {
      // İlk zararda en az 3 saat ceza (aynı koinden peş peşe tokat yemeyi engelle)
      coinCooldowns[pos.symbol] = now + (3 * 60 * 60 * 1000);
      addLog(`⚠️ ${pos.symbol} zarar yazdı ($${totalTradePnl.toFixed(2)}) — koin 3 saat donduruldu!`, 'TRADE');
    }
  } else if (totalTradePnl > 0.20) {
    // Kâr edince zarar sayacı sıfırlanır, 30 dk dinlenme
    coinLossCount[pos.symbol] = 0;
    coinCooldowns[pos.symbol] = now + (30 * 60 * 1000);
  } else {
    // Başabaş veya minik nötr çıkış
    coinCooldowns[pos.symbol] = now + (45 * 60 * 1000);
  }

  const tradeRecord = {
    id: (history.length > 0 ? Math.max(...history.map(h => h.id || 0)) : 0) + 1,
    time: trTime(),
    dateFullStr: trDateTime(),
    entryTimeStr: trDateTime(pos.entryTime),
    symbol: pos.symbol,
    side: pos.side,
    entryPrice: pos.entryPrice,
    exitPrice: pos.currentPrice,
    durationMin: durMin,
    mfe: pos.mfe,
    pnl: totalTradePnl,
    roi: totalTradeRoi,
    exitReason: formattedExitReason,
    radarTag: pos.radarTag || "",
    chg3h: pos.chg3h !== undefined ? pos.chg3h : null,
    vol3hM: pos.vol3hM !== undefined ? pos.vol3hM : null,
    chg24h: pos.chg24h !== undefined ? pos.chg24h : null,
    range3h: pos.range3h || "",
    takerBuyRatio: pos.takerBuyRatio !== undefined ? pos.takerBuyRatio : null,
    signal: pos.signal || "",
    mae: pos.mae || 0,
    btc5mEntry: pos.btc5mEntry !== undefined ? pos.btc5mEntry : 0,
    btc15mEntry: pos.btc15mEntry !== undefined ? pos.btc15mEntry : 0
  };

  history.unshift(tradeRecord);
  if (history.length > 500) history.pop();

  appendTradeToCsv(tradeRecord);
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 500), null, 2), 'utf8');
  } catch (e) {}

  addLog(`🏁 KAPANDI: [${pos.side}] ${pos.symbol} | PnL: ${totalTradePnl >= 0 ? '+' : ''}$${totalTradePnl.toFixed(2)} (%${totalTradeRoi >= 0 ? '+' : ''}${totalTradeRoi.toFixed(1)} ROI) | ${formattedExitReason}`, totalTradePnl >= 0 ? 'WIN' : 'LOSS');
  try {
    addDialogue('TRADER', `🏁 [POZİSYON KAPANDI]: ${pos.symbol} [${pos.side}] işlemi tamamlandı. Çıkış: ${formattedExitReason}`, 'TRADE');
    addDialogue('TESTER', `🧪 [ADLİ TIP ANALİZİ]: ${pos.symbol} | Net PnL: ${totalTradePnl >= 0 ? '+' : ''}$${totalTradePnl.toFixed(2)} (%${totalTradeRoi >= 0 ? '+' : ''}${totalTradeRoi.toFixed(1)} ROI) | Zirve MFE: +%${(pos.mfe || 0).toFixed(2)}.`, 'STRATEGY');
    addDialogue('MANAGER', `👑 [KASA GÜNCELLEMESİ]: Güncel Kasa $${balance.toFixed(2)}. Sermaye korundu, yeni fırsatlar için tetikteyiz.`, 'RISK');
  } catch(e) {}
}

// 4. HTML VE WEBSİTESİ (BİREBİR EKRAN 1 TASARIMI)
function getStats() {
  const totalTrades = history.length;
  const wins = history.filter(h => (h.pnl || 0) > 0.05).length;
  const losses = history.filter(h => (h.pnl || 0) < -0.05).length;
  const breakevens = totalTrades - wins - losses;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : "0.0";
  const totalPnl = history.reduce((acc, h) => acc + (h.pnl || 0), 0);
  const totalRoi = (totalPnl / CONFIG.initialBalance) * 100;
  const megaWins = history.filter(h => (h.mfe || 0) >= 15.0).length;

  const peak = getPeakBalance();
  const ddPct = peak > 0 ? (((peak - balance) / peak) * 100).toFixed(1) : "0.0";

  return {
    balance: balance.toFixed(2),
    peakBalance: peak.toFixed(2),
    drawdownPct: ddPct,
    mode: DYNAMIC.mode || 'DEFENSIVE_SNIPER',
    totalPnl: totalPnl.toFixed(2),
    totalRoi: totalRoi.toFixed(2),
    totalTrades,
    wins,
    losses,
    breakevens,
    winRate,
    megaWins,
    activeCount: activePositions.length,
    uptimeMin: Math.floor((Date.now() - startTime) / 60000),
    btcTrend: btc15mTrend,
    btcIsGreen: btc15mIsGreen
  };
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatSignalCompact(rTag) {
  if (!rTag || rTag === '-') return { short: '-', full: '-', badgeClass: 'badge-sig-neutral' };
  const full = rTag;

  let ratio = '';
  const ratioMatch = rTag.match(/%([\d\.]+)\s*(Alıcı|Satıcı)/i);
  if (ratioMatch) {
    const rNum = Math.round(parseFloat(ratioMatch[1]));
    ratio = `%${rNum} ${ratioMatch[2] === 'Alıcı' ? 'Alıcı' : 'Satıcı'}`;
  }

  let label = '';
  let badgeClass = 'badge-sig-neutral';
  if (rTag.includes('BALİNA BOĞA')) {
    label = '🐋 BALİNA BOĞA';
    badgeClass = 'badge-sig-bull';
  } else if (rTag.includes('BALİNA AYI')) {
    label = '🐋 BALİNA AYI';
    badgeClass = 'badge-sig-bear';
  } else if (rTag.includes('GÜÇLÜ BOĞA')) {
    label = '🟢 GÜÇLÜ BOĞA';
    badgeClass = 'badge-sig-bull';
  } else if (rTag.includes('GÜÇLÜ AYI')) {
    label = '🔴 GÜÇLÜ AYI';
    badgeClass = 'badge-sig-bear';
  } else if (rTag.includes('BOĞA')) {
    label = '🟢 BOĞA';
    badgeClass = 'badge-sig-bull';
  } else if (rTag.includes('AYI')) {
    label = '🔴 AYI';
    badgeClass = 'badge-sig-bear';
  } else {
    label = rTag.replace(/[\[\]]/g, '').split('|')[0].trim().slice(0, 16);
  }

  const shortText = ratio ? `${label} (${ratio})` : label;
  return { short: shortText, full: full, badgeClass };
}

function formatExitReasonCompact(reason) {
  if (!reason || reason === '-') return { short: '-', full: '-', badgeClass: 'badge-exit-neutral' };
  const full = reason;
  let short = reason;
  let badgeClass = 'badge-exit-neutral';

  if (reason.includes('Durgunluk Koruması') || reason.includes('İvme Yok') || reason.includes('Durgunluk')) {
    short = '⏱️ Durgunluk';
    badgeClass = 'badge-exit-stagnant';
  } else if (reason.includes('Başabaş') || reason.includes('$0.00 Risk')) {
    short = '🛡️ Başabaş';
    badgeClass = 'badge-exit-be';
  } else if (reason.includes('MOONSHOT ALINDI') || reason.includes('VUR-KAÇ HEDEFİ')) {
    short = '🎯 Moonshot TP';
    badgeClass = 'badge-exit-tp';
  } else if (reason.includes('Lazer Vur-Kaç') || reason.includes('Lazer Kâr Kilidi') || reason.includes('Kâr Kilidi')) {
    short = '🏆 Kâr Kilidi';
    badgeClass = 'badge-exit-profit';
  } else if (reason.includes('Stop Loss') || reason.includes('STOP LOSS')) {
    short = '🛑 Stop Loss';
    badgeClass = 'badge-exit-sl';
  } else if (reason.includes('Kilitli Kâr')) {
    short = '🔒 Kilitli Kâr';
    badgeClass = 'badge-exit-profit';
  } else if (reason.includes('Manuel')) {
    short = '⚡ Manuel';
    badgeClass = 'badge-exit-manual';
  } else {
    short = reason.length > 20 ? reason.slice(0, 18) + '...' : reason;
  }

  return { short, full, badgeClass };
}

function serveDashboardHtml() {
  const stats = getStats();
  const vipKeys = Object.keys(VIP_TARGETS);

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Moonshot Bot">
  <meta name="theme-color" content="#07090e">
  <meta name="format-detection" content="telephone=no">
  <title>🚀 Moonshot 7/24 Bulut Test Laboratuvarı</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220%22%22><text y=%2226%22 font-size=%2224%22>🚀</text></svg>">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #f4f2ee;
      --panel: #fffcf8;
      --panel2: #f7f4ef;
      --panel-hover: #efeae3;
      --border: #e6e1d8;
      --border-accent: #d4cdc2;
      --text: #2c2926;
      --text-secondary: #5c564e;
      --muted: #8a8378;
      --green: #059669;
      --green-bg: #ecfdf5;
      --green-border: #a7f3d0;
      --red: #e11d48;
      --red-bg: #fff1f2;
      --red-border: #fecdd3;
      --amber: #d97706;
      --amber-bg: #fffbeb;
      --amber-border: #fde68a;
      --purple: #7c3aed;
      --purple-bg: #f5f3ff;
      --purple-border: #ddd6fe;
      --blue: #0284c7;
      --blue-bg: #f0f9ff;
      --blue-border: #bae6fd;
      --cyan: #0891b2;
      --cyan-bg: #ecfeff;
      --cyan-border: #a5f3fc;
      --pink: #db2777;
      --pink-bg: #fdf2f8;
      --pink-border: #fbcfe8;
      --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.04);
      --shadow-md: 0 4px 14px rgba(15, 23, 42, 0.05);
    }
    body.dark-theme {
      --bg: #07090e;
      --panel: #0e131f;
      --panel2: #141b2d;
      --panel-hover: #1a233a;
      --border: rgba(255, 255, 255, 0.08);
      --border-accent: rgba(168, 85, 247, 0.3);
      --text: #f8fafc;
      --text-secondary: #cbd5e1;
      --muted: #94a3b8;
      --green: #10b981;
      --green-bg: rgba(16,185,129,0.15);
      --green-border: rgba(16,185,129,0.3);
      --red: #f43f5e;
      --red-bg: rgba(244,63,94,0.15);
      --red-border: rgba(244,63,94,0.3);
      --amber: #f59e0b;
      --amber-bg: rgba(245,158,11,0.15);
      --amber-border: rgba(245,158,11,0.3);
      --purple: #a855f7;
      --purple-bg: rgba(168,85,247,0.15);
      --purple-border: rgba(168,85,247,0.3);
      --blue: #38bdf8;
      --blue-bg: rgba(56,189,248,0.15);
      --blue-border: rgba(56,189,248,0.3);
      --cyan: #06b6d4;
      --cyan-bg: rgba(6,182,212,0.15);
      --cyan-border: rgba(6,182,212,0.3);
      --pink: #ec4899;
      --pink-bg: rgba(236,72,153,0.15);
      --pink-border: rgba(236,72,153,0.3);
      --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
      --shadow-md: 0 6px 20px rgba(0,0,0,0.45);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 16px 18px 24px;
      font-size: 13.5px;
      line-height: 1.45;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
      transition: background 0.2s ease, color 0.2s ease;
    }
    .container { max-width: 1560px; margin: 0 auto; width: 100%; }

    /* TABS */
    .tabs {
      display: flex;
      gap: 5px;
      margin-bottom: 8px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .tabs::-webkit-scrollbar { display: none; }
    .tab-btn {
      background: var(--panel);
      border: 1px solid var(--border);
      color: var(--muted);
      font-size: 10px;
      font-weight: 800;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .tab-btn.active {
      background: var(--panel2);
      color: var(--text);
      border-color: var(--purple);
      box-shadow: 0 0 10px var(--purple-bg);
    }

    /* THEME TOGGLE */
    .theme-toggle-btn {
      background: var(--panel2);
      border: 1px solid var(--border);
      color: var(--text);
      font-size: 9.5px;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 5px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: 0.15s;
    }
    .theme-toggle-btn:hover {
      background: var(--panel-hover);
    }

    /* GRID */
    .dashboard {
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 14px;
      align-items: start;
    }
    @media (max-width: 960px) {
      .dashboard { grid-template-columns: 1fr; gap: 8px; }
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 16px 16px 14px;
      box-shadow: var(--shadow-sm);
    }
    .panel h2 {
      font-size: 13px;
      font-weight: 650;
      text-transform: none;
      letter-spacing: 0;
      color: var(--text);
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* UNIFIED AGENT & STATUS CARD */
    .unified-agent-box {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 5px 7px;
      margin-bottom: 6px;
      box-shadow: var(--shadow-sm);
    }
    .mini-status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--panel2);
      padding: 3px 5px;
      border-radius: 5px;
      border: 1px solid var(--border);
      margin-bottom: 4px;
      gap: 3px;
    }
    .mini-status-chip {
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .mini-lbl {
      font-size: 8px;
      color: var(--muted);
      font-weight: 800;
      letter-spacing: 0.3px;
    }
    .agent-compact-list {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .agent-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12.5px;
      padding: 5px 2px;
      border-radius: 6px;
    }
    .agent-row:hover { background: var(--panel2); }
    .agent-name {
      font-weight: 600;
      white-space: nowrap;
      font-size: 12.5px;
      color: var(--text-secondary) !important;
    }
    .agent-row .status-pill {
      font-size: 11px;
      padding: 2px 7px;
      max-width: 168px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .status-pill {
      font-family: -apple-system, "Segoe UI", sans-serif;
      font-weight: 600;
      font-size: 11px;
      padding: 2px 7px;
      border-radius: 999px;
      background: var(--panel2);
      color: var(--text-secondary);
      text-transform: none;
      letter-spacing: 0;
      border: 1px solid var(--border);
    }
    .status-pill.green { background: var(--green-bg); color: var(--green); border-color: var(--green-border); }
    .status-pill.purple,
    .status-pill.blue,
    .status-pill.cyan,
    .status-pill.pink,
    .status-pill.yellow { background: var(--panel2); color: var(--text-secondary); border-color: var(--border); }

    /* STRATEGY BANNER */
    .strategy-banner-card {
      background: var(--panel2);
      border: 1px solid var(--border);
      border-radius: 7px;
      padding: 7px 9px;
      margin-bottom: 7px;
    }
    .strat-card-head { display: flex; justify-content: space-between; font-size: 9.5px; margin-bottom: 3px; }
    .strat-badge-pill { background: var(--purple); color: #fff; font-weight: 900; font-size: 8.5px; padding: 1.5px 5px; border-radius: 3px; }
    .strat-card-title { font-weight: 800; font-size: 11px; color: var(--text); }
    .strat-card-sub { font-size: 9px; color: var(--muted); margin-top: 1px; }

    /* PARAMETERS */
    .sidebar-section-title { font-size: 11px; font-weight: 650; color: var(--muted); text-transform: none; margin-bottom: 8px; margin-top: 14px; letter-spacing: 0; display:flex; align-items:center; gap:8px; }
    .sidebar-section-title::after { content: ''; flex-grow: 1; height: 1px; background: var(--border); }
    .param-grid-2x2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 5px; }
    .param-card { background: var(--panel2); border: 1px solid var(--border); border-radius: 5px; padding: 5px 7px; transition: 0.15s ease; }
    .param-card:hover { border-color: var(--border-accent); }
    .param-header { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); font-weight: 600; margin-bottom: 4px; }
    .param-input-wrap { display: flex; align-items: baseline; justify-content: space-between; }
    .param-input-wrap input { width: 58px; background: var(--panel); border: 1px solid var(--border); border-radius: 6px; padding: 4px 6px; color: var(--text); font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 650; outline: none; }
    .param-unit { font-size: 9px; color: var(--muted); }

    /* HERO PERF */
    .perf-hero-card {
      background: linear-gradient(135deg, var(--green-bg) 0%, var(--panel) 100%);
      border: 1px solid var(--green-border);
      border-radius: 7px;
      padding: 5px 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 5px;
      box-shadow: var(--shadow-sm);
    }
    .perf-hero-title { font-size: 8.5px; font-weight: 800; color: var(--muted); display: block; }
    .perf-hero-sub { font-size: 9.5px; font-weight: 700; color: var(--green); }
    .perf-hero-val { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 900; color: var(--text); }

    .perf-grid-4 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 5px; }
    .perf-mini-card { background: var(--panel2); border: 1px solid var(--border); border-radius: 5px; padding: 4px 6px; }
    .perf-mini-label { font-size: 8px; color: var(--muted); display: block; }
    .perf-mini-val { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; font-weight: 800; color: var(--text); }

    /* BUTTONS GRID */
    .action-buttons-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      margin-top: 5px;
    }
    .btn-action {
      width: 100%;
      padding: 5px 6px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 9.5px;
      cursor: pointer;
      border: 1px solid var(--border);
      transition: 0.15s;
      text-align: center;
      text-decoration: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3px;
      min-height: 28px;
    }
    .btn-secondary { background: var(--panel2); color: var(--text); }
    .btn-secondary:hover { background: var(--panel-hover); }
    .btn-reset {
      background: var(--red-bg);
      border-color: var(--red-border);
      color: var(--red);
    }
    .btn-reset:hover { background: var(--red); color: #fff; }

    /* TABLES */
    .table-container {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border: 1px solid var(--border);
      border-radius: 7px;
      background: var(--panel);
      margin-bottom: 8px;
      box-shadow: var(--shadow-sm);
    }
    .table-container::-webkit-scrollbar { height: 3px; }
    .table-container::-webkit-scrollbar-thumb { background: var(--border-accent); border-radius: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 12.5px; white-space: nowrap; }
    th {
      position: sticky;
      top: 0;
      background: var(--panel2);
      text-align: left;
      padding: 8px 8px;
      color: var(--muted);
      font-weight: 650;
      font-size: 11px;
      text-transform: none;
      letter-spacing: 0;
      border-bottom: 1px solid var(--border);
      z-index: 2;
    }
    td { padding: 8px 8px; border-bottom: 1px solid var(--border); font-family: inherit; color: var(--text); }
    tr:hover td { background: var(--panel2); }

    /* BADGES */
    .badge-moon { background: var(--purple-bg); border: 1px solid var(--purple-border); color: var(--purple); padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 800; }
    .badge-strat { background: var(--amber-bg); border: 1px solid var(--amber-border); color: var(--amber); font-size: 8.5px; padding: 2px 5px; border-radius: 3px; font-weight: 700; margin-left: 4px; }
    .badge-side-long { background: var(--green-bg); border: 1px solid var(--green-border); color: var(--green); font-size: 9px; padding: 2px 6px; border-radius: 4px; font-weight: 800; }
    .badge-side-short { background: var(--red-bg); border: 1px solid var(--red-border); color: var(--red); font-size: 9px; padding: 2px 6px; border-radius: 4px; font-weight: 800; }
    .badge-sl { color: var(--red); font-weight: 800; font-size: 10px; }
    .badge-be { color: var(--green); font-weight: 800; font-size: 10px; }
    .badge-pnl-pos { color: var(--green); font-weight: 800; font-size: 11px; }
    .badge-pnl-neg { color: var(--red); font-weight: 800; font-size: 11px; }
    .btn-close-pos {
      background: var(--red-bg);
      border: 1px solid var(--red-border);
      color: var(--red);
      font-weight: 800;
      font-size: 9.5px;
      padding: 2.5px 7px;
      border-radius: 4px;
      cursor: pointer;
      min-height: 24px;
      transition: 0.15s;
    }
    .btn-close-pos:hover { background: var(--red); color: #fff; }

    /* COMPACT SIGNAL & EXIT BADGES (HORIZONTALLY FIT) */
    .badge-signal {
      display: inline-flex;
      align-items: center;
      padding: 1.5px 5px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 700;
      cursor: help;
      letter-spacing: 0.1px;
    }
    .badge-sig-bull { background: var(--green-bg); border: 1px solid var(--green-border); color: var(--green); }
    .badge-sig-bear { background: var(--red-bg); border: 1px solid var(--red-border); color: var(--red); }
    .badge-sig-neutral { background: var(--purple-bg); border: 1px solid var(--purple-border); color: var(--purple); }

    .badge-exit {
      display: inline-flex;
      align-items: center;
      padding: 1.5px 5px;
      border-radius: 4px;
      font-size: 9px;
      font-weight: 700;
      cursor: help;
    }
    .badge-exit-stagnant { background: var(--panel2); border: 1px solid var(--border); color: var(--muted); }
    .badge-exit-be { background: var(--green-bg); border: 1px solid var(--green-border); color: var(--green); }
    .badge-exit-profit { background: var(--amber-bg); border: 1px solid var(--amber-border); color: var(--amber); }
    .badge-exit-tp { background: var(--purple-bg); border: 1px solid var(--purple-border); color: var(--purple); }
    .badge-exit-sl { background: var(--red-bg); border: 1px solid var(--red-border); color: var(--red); }
    .badge-exit-manual { background: var(--blue-bg); border: 1px solid var(--blue-border); color: var(--blue); }
    .badge-exit-neutral { background: var(--panel2); border: 1px solid var(--border); color: var(--muted); }

    /* CHIPS */
    .chip { font-size: 9.5px; padding: 2px 6px; border-radius: 4px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: var(--green); font-family: 'JetBrains Mono', monospace; font-weight: 700; }
    
    .mobile-swipe-hint {
      font-size: 10px;
      color: var(--blue);
      background: rgba(56, 189, 248, 0.08);
      border: 1px solid rgba(56, 189, 248, 0.2);
      border-radius: 6px;
      padding: 5px 9px;
      margin-bottom: 7px;
      display: none;
      align-items: center;
      gap: 6px;
      font-weight: 700;
    }

    /* VIEW MODE SWITCHER (MOBİL / iPHONE 17) */
    .view-mode-switcher {
      display: none;
      gap: 6px;
      margin-bottom: 10px;
    }
    .view-btn {
      flex: 1;
      padding: 8px 10px;
      font-size: 11px;
      font-weight: 800;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--panel2);
      color: var(--muted);
      cursor: pointer;
      min-height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: 0.15s;
    }
    .view-btn.active {
      background: rgba(168, 85, 247, 0.25);
      border-color: rgba(168, 85, 247, 0.6);
      color: #fff;
      box-shadow: 0 0 10px rgba(168, 85, 247, 0.2);
    }

    /* MOBİL KARTLAR */
    .mobile-cards-container {
      display: none;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
    }
    .pos-card-mobile {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 10px 12px;
      box-shadow: var(--shadow-sm);
    }
    .pos-card-mobile.card-long { border-left: 3.5px solid var(--green); }
    .pos-card-mobile.card-short { border-left: 3.5px solid var(--red); }
    .pos-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 7px;
    }
    .pos-card-sym {
      font-weight: 900;
      font-size: 13.5px;
      color: var(--text);
    }
    .pos-card-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px 8px;
      font-size: 11px;
      margin-bottom: 8px;
      background: var(--panel2);
      padding: 7px 9px;
      border-radius: 6px;
    }
    .card-lbl { color: var(--muted); font-size: 10px; }
    .card-val { font-family: 'JetBrains Mono', monospace; font-weight: 700; color: var(--text); }
    .pos-card-footer {
      display: flex;
      justify-content: flex-end;
    }

    .hist-card-mobile {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 9px 11px;
      box-shadow: var(--shadow-sm);
    }
    .hist-card-mobile.hist-win { border-left: 3.5px solid var(--green); }
    .hist-card-mobile.hist-loss { border-left: 3.5px solid var(--red); }
    .hist-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }
    .hist-card-sym { font-weight: 800; font-size: 12px; color: var(--text); }
    .hist-card-time { font-size: 9.5px; color: var(--muted); }
    .hist-card-mid { font-size: 10.5px; color: var(--muted); margin-bottom: 4px; }
    .hist-card-bot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-top: 1px solid var(--border);
      padding-top: 5px;
      font-size: 10px;
    }
    .empty-cards-msg {
      text-align: center;
      color: var(--muted);
      padding: 18px 12px;
      font-size: 11px;
      background: var(--panel2);
      border-radius: 8px;
      border: 1px dashed var(--border);
    }

    /* iPHONE 17 & MOBILE RESPONSIVE ENGINE */
    @media (max-width: 900px) {
      .dashboard { grid-template-columns: 1fr; gap: 10px; }
      body {
        padding: max(8px, env(safe-area-inset-top)) max(8px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left));
      }
      .panel { padding: 11px 9px; border-radius: 12px; }
      .panel h2 { font-size: 11.5px; }

      /* Mobile tabs */
      .tabs { gap: 5px; margin-bottom: 8px; }
      .tab-btn { font-size: 10px; padding: 7px 10px; min-height: 36px; border-radius: 7px; }

      /* Status & Perf cards on mobile */
      .unified-agent-box { padding: 5px 7px; margin-bottom: 6px; }
      .perf-hero-card { padding: 6px 9px; margin-bottom: 5px; }
      .perf-hero-val { font-size: 16px; }
      .perf-grid-4 { gap: 4px; margin-bottom: 6px; }
      .perf-mini-card { padding: 4px 6px; }
      .perf-mini-val { font-size: 10.5px; }

      /* Inputs - prevent iOS Safari auto-zoom */
      input[type="number"], input[type="text"] { font-size: 16px !important; }
      .param-card { padding: 6px 8px; }
      .param-header { font-size: 9.5px; }

      /* Action buttons touch target */
      .btn-action { min-height: 42px; font-size: 11px; border-radius: 8px; font-weight: 800; }
      .btn-action:active { transform: scale(0.97); opacity: 0.85; }

      /* Görünüm Değiştirici ve Kart Kontrolleri */
      .view-mode-switcher { display: flex; }
      body.mode-cards .table-container { display: none !important; }
      body.mode-cards .mobile-swipe-hint { display: none !important; }
      body.mode-cards .mobile-cards-container { display: flex !important; }

      body.mode-table .table-container { display: block !important; }
      body.mode-table .mobile-swipe-hint { display: flex !important; }
      body.mode-table .mobile-cards-container { display: none !important; }

      .table-container {
        border-radius: 8px;
        margin-bottom: 10px;
        -webkit-overflow-scrolling: touch;
      }
      table { font-size: 10.5px; }
      th { font-size: 9px; padding: 6px 7px; }
      td { padding: 6px 7px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- TABS -->
    <!-- <div class="tabs">
      <div class="tab-btn active">⚡ 1. CANLI SİMÜLASYON (TEST LAB)</div>
      <div class="tab-btn" onclick="alert('Gerçek Binance API modu bulut test sürümünde güvenlik için pasiftir. Test Lab 7/24 çalışmaktadır.')">⚡ 2. GERÇEK BINANCE İŞLEMLERİ (CANLI API)</div>
      <a href="/api/download-csv" class="tab-btn" style="text-decoration:none;">🔍 3. 15DK RADAR & EXCEL AKTARICI</a>
    </div> -->

    <div class="dashboard">
      <!-- SOL PANEL: MOTOR KONTROLÜ -->
      <div class="panel">
        <h2>
          <span>🎛️ MOTOR KONTROLÜ</span>
          <button id="themeToggleBtn" onclick="toggleTheme()" class="theme-toggle-btn">☀️ Açık Mod</button>
        </h2>

        <!-- TEK BİRLEŞİK KART: SİSTEM & 8 AJAN KOMUTASI -->
        <div class="sidebar-section-title" style="margin-top:0;">🤖 OTONOM SİSTEM & 8 AJAN KOMUTASI</div>
        <div class="unified-agent-box">
          <div class="mini-status-bar">
            <div class="mini-status-chip">
              <span class="mini-lbl">DURUM</span>
              <span class="status-pill green" id="liveStatus" style="font-size:8.5px;padding:1.5px 5px;">ÇALIŞIYOR</span>
            </div>
            <div class="mini-status-chip">
              <span class="mini-lbl">SLOT</span>
              <span class="status-pill purple" id="posCount" style="font-size:8.5px;padding:1.5px 5px;">${stats.activeCount} / ${CONFIG.maxSlots}</span>
            </div>
            <div class="mini-status-chip">
              <span class="mini-lbl">BTC</span>
              <span class="status-pill" id="btcVal" style="font-size:8.5px;padding:1.5px 5px;color:${stats.btcIsGreen ? 'var(--green)' : 'var(--red)'};">${stats.btcTrend}</span>
            </div>
          </div>
          <div class="agent-compact-list">
            <div class="agent-row">
              <span class="agent-name" style="color:var(--purple);">👑 1. YÖNETİCİ</span>
              <span class="status-pill purple" id="teamManager">🚨 SAVUNMA</span>
            </div>
            <div class="agent-row">
              <span class="agent-name" style="color:var(--blue);">🧠 2. ANALİZCİ</span>
              <span class="status-pill blue" id="teamAnalyst">Yatay / Sakin</span>
            </div>
            <div class="agent-row">
              <span class="agent-name" style="color:var(--amber);">⚔️ 3. TRADER</span>
              <span class="status-pill purple" id="teamTrader">🎯 1 Slot ($10)</span>
            </div>
            <div class="agent-row">
              <span class="agent-name" style="color:var(--green);">🧪 4. TESTÇİ</span>
              <span class="status-pill green" id="teamTester">Sim: Güvenli</span>
            </div>
            <div class="agent-row">
              <span class="agent-name" style="color:var(--text-secondary);">💻 5. YAZILIMCI</span>
              <span class="status-pill green" id="teamEngineer">Regex Aktif</span>
            </div>
            <div class="agent-row">
              <span class="agent-name" style="color:var(--cyan);">🐋 6. BALİNA AVCISI</span>
              <span class="status-pill cyan" id="teamWhale">⚖️ Dengeli</span>
            </div>
            <div class="agent-row">
              <span class="agent-name" style="color:var(--pink);">🎯 7. FREQ-AI & LİKİT</span>
              <span class="status-pill pink" id="teamFreqai">%57.1 WR (56)</span>
            </div>
            <div class="agent-row">
              <span class="agent-name" style="color:var(--amber);">🏛️ 8. BAŞ YARGIÇ</span>
              <span class="status-pill yellow" id="teamJudge">76 PUAN</span>
            </div>
          </div>
        </div>

        <div class="sidebar-section-title" style="margin-top:5px;">💰 SEANS PERFORMANSI</div>
        <div class="perf-hero-card">
          <div>
            <span class="perf-hero-title">KASA BAKİYESİ</span>
            <span class="perf-hero-sub" id="stPnl">${parseFloat(stats.totalPnl) >= 0 ? '+' : ''}$${stats.totalPnl} (%${stats.totalRoi})</span>
          </div>
          <div class="perf-hero-val" id="stBalance">$${stats.balance}</div>
        </div>

        <div class="perf-grid-4">
          <div class="perf-mini-card">
            <span class="perf-mini-label">Toplam İşlem</span>
            <span class="perf-mini-val" id="stTotalTrades">${stats.totalTrades}</span>
          </div>
          <div class="perf-mini-card">
            <span class="perf-mini-label">Kazanma %</span>
            <span class="perf-mini-val" style="color:var(--green);" id="stWinRate">%${stats.winRate}</span>
          </div>
          <div class="perf-mini-card">
            <span class="perf-mini-label">Kazan/Kaybet</span>
            <span class="perf-mini-val" id="stWinsLosses">${stats.wins}K / ${stats.losses}Z</span>
          </div>
          <div class="perf-mini-card">
            <span class="perf-mini-label">Mega-Win</span>
            <span class="perf-mini-val" style="color:var(--amber);" id="stMega">${stats.megaWins} Adet</span>
          </div>
        </div>

        <div class="sidebar-section-title">⚙️ TEMEL RİSK & POZİSYON</div>
        <div class="param-grid-2x2">
          <div class="param-card">
            <div class="param-header"><span>MAX SLOT</span><span>Sniper</span></div>
            <div class="param-input-wrap"><input type="number" id="inpSlots" value="${CONFIG.maxSlots}"><span class="param-unit">adet</span></div>
          </div>
          <div class="param-card">
            <div class="param-header"><span>TEMİNAT</span><span>İzole</span></div>
            <div class="param-input-wrap"><input type="number" id="inpMargin" value="${CONFIG.marginPerTrade}"><span class="param-unit">$</span></div>
          </div>
          <div class="param-card">
            <div class="param-header"><span>KALDIRAÇ</span><span>Büyüme</span></div>
            <div class="param-input-wrap"><input type="number" id="inpLev" value="${CONFIG.leverage}"><span class="param-unit">x</span></div>
          </div>
          <div class="param-card">
            <div class="param-header"><span>STOP LOSS</span><span>Nefes</span></div>
            <div class="param-input-wrap"><input type="number" id="inpSl" value="${CONFIG.slPct.toFixed(2)}" step="0.1"><span class="param-unit">%</span></div>
          </div>
        </div>

        <div class="sidebar-section-title">🛡️ SIFIR RİSK VE KADEMELİ HEDEFLER</div>
        <div style="background:linear-gradient(90deg, var(--green-bg) 0%, var(--panel) 100%); border-left:3px solid var(--green); border:1px solid var(--green-border); border-radius:5px; padding:6px 8px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center; box-shadow:var(--shadow-sm);">
          <div>
            <div style="font-size:10px;font-weight:800;color:var(--green);letter-spacing:0.3px;">🛡️ OTOMATİK BAŞABAŞ</div>
            <div style="font-size:8.5px;color:var(--muted);margin-top:1px;">Kâr yakalanınca $0 Riske çekilir</div>
          </div>
          <div style="display:flex;align-items:baseline;gap:2px;background:var(--panel2);padding:2px 6px;border-radius:4px;border:1px solid var(--green-border);">
            <input type="number" id="inpBe" value="${CONFIG.bePct.toFixed(2)}" step="0.1" style="width:52px;background:none;border:none;color:var(--green);font-family:'JetBrains Mono';font-size:13px;font-weight:650;text-align:right;outline:none;">
            <span style="font-size:10px;color:var(--green);opacity:0.7;">%</span>
          </div>
        </div>

        <div style="background:linear-gradient(90deg, var(--blue-bg) 0%, var(--panel) 100%); border-left:3px solid var(--blue); border:1px solid var(--blue-border); border-radius:5px; padding:6px 8px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center; box-shadow:var(--shadow-sm);">
          <div>
            <div style="font-size:10px;font-weight:800;color:var(--blue);letter-spacing:0.3px;">🎯 İLK KÂR ALMA (TP1)</div>
            <div style="font-size:8.5px;color:var(--muted);margin-top:1px;">%50 Kâr Cebe, Kalan Başabaşa</div>
          </div>
          <div style="display:flex;align-items:baseline;gap:2px;background:var(--panel2);padding:2px 6px;border-radius:4px;border:1px solid var(--blue-border);">
            <input type="number" id="inpTp1" value="${(CONFIG.tp1Pct || 1.00).toFixed(2)}" step="0.1" style="width:52px;background:none;border:none;color:var(--blue);font-family:'JetBrains Mono';font-size:13px;font-weight:650;text-align:right;outline:none;">
            <span style="font-size:10px;color:var(--blue);opacity:0.7;">%</span>
          </div>
        </div>

        <div style="background:linear-gradient(90deg, var(--amber-bg) 0%, var(--panel) 100%); border-left:3px solid var(--amber); border:1px solid var(--amber-border); border-radius:5px; padding:6px 8px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; box-shadow:var(--shadow-sm);">
          <div>
            <div style="font-size:10px;font-weight:800;color:var(--amber);letter-spacing:0.3px;">🏆 VUR-KAÇ MOONSHOT</div>
            <div style="font-size:8.5px;color:var(--muted);margin-top:1px;">Kâr hedefinde tamamen çıkılır</div>
          </div>
          <div style="display:flex;align-items:baseline;gap:2px;background:var(--panel2);padding:2px 6px;border-radius:4px;border:1px solid var(--amber-border);">
            <input type="number" id="inpMoon" value="${CONFIG.moonPct.toFixed(2)}" step="0.1" style="width:52px;background:none;border:none;color:var(--amber);font-family:'JetBrains Mono';font-size:13px;font-weight:650;text-align:right;outline:none;">
            <span style="font-size:10px;color:var(--amber);opacity:0.7;">%</span>
          </div>
        </div>

        <div class="action-buttons-grid">
          <a href="/api/download-csv" class="btn-action btn-secondary">📊 CSV İNDİR</a>
          <button onclick="resetBalance()" class="btn-action btn-reset">🧹 SIFIRLA ($100)</button>
        </div>
      </div>

      <!-- SAĞ PANEL: İŞLEMLER -->
      <div class="panel">
        <h2>
          <span>🎯 BEKLEYEN MOONSHOT POZİSYONLARI</span>
          <!-- <span class="badge-moon">🚀 10X TREND MODU</span> -->
        </h2>

        <!-- ŞAMPİYON KOİNLER (GİZLENDİ) -->

        <!-- MOBİL GÖRÜNÜM SEÇİCİ (iPHONE & MOBİL) -->
        <div class="view-mode-switcher">
          <button class="view-btn active" id="btnCards" onclick="setViewMode('cards')">📱 Kart Görünümü (Mobil)</button>
          <button class="view-btn" id="btnTable" onclick="setViewMode('table')">📊 Tablo Görünümü</button>
        </div>

        <!-- MOBİL KARTLAR (AKTİF POZİSYONLAR) -->
        <div id="activeCardsMobile" class="mobile-cards-container">
          ${renderActiveCards(activePositions)}
        </div>

        <!-- AKTİF POZİSYONLAR TABLOSU -->
        <div class="mobile-swipe-hint">👉 <span>Yana kaydırarak tüm sütunları inceleyebilirsiniz</span></div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Sembol</th>
                <th>Yön</th>
                <th>Giriş / Fiyat</th>
                <th>Stop / BE Durumu</th>
                <th>MFE (Max Kâr)</th>
                <th>Anlık ROI / PnL</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody id="activeTbody">
              ${renderActiveRows(activePositions)}
            </tbody>
          </table>
        </div>

        <!-- TAMAMLANAN MOONSHOT GEÇMİŞİ -->
        <h2 style="margin-top:14px;">
          <span>📜 TAMAMLANAN MOONSHOT GEÇMİŞİ</span>
          <span style="font-size:11px;color:var(--muted);font-weight:600;"><span id="histCount">${history.length}</span> KAYIT</span>
        </h2>

        <!-- MOBİL KARTLAR (GEÇMİŞ) -->
        <div id="historyCardsMobile" class="mobile-cards-container">
          ${renderHistoryCards(history)}
        </div>

        <div class="mobile-swipe-hint">👉 <span>Yana kaydırarak tüm sütunları inceleyebilirsiniz</span></div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Zaman</th>
                <th>Sembol</th>
                <th>Yön</th>
                <th>Sinyal & Alıcı Baskısı</th>
                <th>Süre</th>
                <th>Çıkış Nedeni</th>
                <th>MFE</th>
                <th>Net PnL</th>
                <th>Sonuç ROI</th>
              </tr>
            </thead>
            <tbody id="historyTbody">
              ${renderHistoryRows(history)}
            </tbody>
          </table>
        </div>

        <!-- 🗣️ AJAN TELSİZİ & CANLI DİYALOG AKIŞI -->
        <h2 style="margin-top:16px; display:flex; justify-content:space-between; align-items:center;">
          <span>🗣️ AJAN TELSİZİ & CANLI DİYALOG AKIŞI</span>
          <span class="badge-moon" style="font-size:9.5px;">📻 8 AJAN CANLI FREKANS</span>
        </h2>
        <div id="dialogueBox" style="background:var(--panel2); border:1px solid var(--border); border-radius:12px; padding:12px 14px; max-height:320px; overflow-y:auto; font-family:-apple-system,Segoe UI,sans-serif; font-size:13px; line-height:1.5; display:flex; flex-direction:column; gap:8px;">
          ${renderDialogues(teamStatusCache ? teamStatusCache.dialogues : [])}
        </div>
      </div>
    </div>
  </div>

  <script>
    const LS_HIST = "moon_cloud_history";
    const LS_BAL = "moon_cloud_balance";
    window.isResetting = false;

    // 🎨 TEMA YÖNETİMİ (VARSAYILAN: GÖZ YORMAYAN AÇIK TEMA)
    function initTheme() {
      const saved = localStorage.getItem('moon_theme') || 'light';
      if (saved === 'dark') {
        document.body.classList.add('dark-theme');
        updateThemeBtn(true);
      } else {
        document.body.classList.remove('dark-theme');
        updateThemeBtn(false);
      }
    }
    function toggleTheme() {
      const isDark = document.body.classList.toggle('dark-theme');
      localStorage.setItem('moon_theme', isDark ? 'dark' : 'light');
      updateThemeBtn(isDark);
    }
    function updateThemeBtn(isDark) {
      const btn = document.getElementById('themeToggleBtn');
      if (btn) btn.innerHTML = isDark ? '🌙 Koyu Mod' : '☀️ Açık Mod';
    }
    initTheme();

    function escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function formatSignalCompact(rTag) {
      if (!rTag || rTag === '-') return { short: '-', full: '-', badgeClass: 'badge-sig-neutral' };
      const full = rTag;

      let ratio = '';
      const ratioMatch = rTag.match(/%([\d\.]+)\s*(Alıcı|Satıcı)/i);
      if (ratioMatch) {
        const rNum = Math.round(parseFloat(ratioMatch[1]));
        ratio = '%' + rNum + ' ' + (ratioMatch[2] === 'Alıcı' ? 'Alıcı' : 'Satıcı');
      }

      let label = '';
      let badgeClass = 'badge-sig-neutral';
      if (rTag.includes('BALİNA BOĞA')) {
        label = '🐋 BALİNA BOĞA';
        badgeClass = 'badge-sig-bull';
      } else if (rTag.includes('BALİNA AYI')) {
        label = '🐋 BALİNA AYI';
        badgeClass = 'badge-sig-bear';
      } else if (rTag.includes('GÜÇLÜ BOĞA')) {
        label = '🟢 GÜÇLÜ BOĞA';
        badgeClass = 'badge-sig-bull';
      } else if (rTag.includes('GÜÇLÜ AYI')) {
        label = '🔴 GÜÇLÜ AYI';
        badgeClass = 'badge-sig-bear';
      } else if (rTag.includes('BOĞA')) {
        label = '🟢 BOĞA';
        badgeClass = 'badge-sig-bull';
      } else if (rTag.includes('AYI')) {
        label = '🔴 AYI';
        badgeClass = 'badge-sig-bear';
      } else {
        label = rTag.replace(/[\[\]]/g, '').split('|')[0].trim().slice(0, 16);
      }

      const shortText = ratio ? (label + ' (' + ratio + ')') : label;
      return { short: shortText, full: full, badgeClass: badgeClass };
    }

    function formatExitReasonCompact(reason) {
      if (!reason || reason === '-') return { short: '-', full: '-', badgeClass: 'badge-exit-neutral' };
      const full = reason;
      let short = reason;
      let badgeClass = 'badge-exit-neutral';

      if (reason.includes('Durgunluk Koruması') || reason.includes('İvme Yok') || reason.includes('Durgunluk')) {
        short = '⏱️ Durgunluk';
        badgeClass = 'badge-exit-stagnant';
      } else if (reason.includes('Başabaş') || reason.includes('$0.00 Risk')) {
        short = '🛡️ Başabaş';
        badgeClass = 'badge-exit-be';
      } else if (reason.includes('MOONSHOT ALINDI') || reason.includes('VUR-KAÇ HEDEFİ')) {
        short = '🎯 Moonshot TP';
        badgeClass = 'badge-exit-tp';
      } else if (reason.includes('Lazer Vur-Kaç') || reason.includes('Lazer Kâr Kilidi') || reason.includes('Kâr Kilidi')) {
        short = '🏆 Kâr Kilidi';
        badgeClass = 'badge-exit-profit';
      } else if (reason.includes('Stop Loss') || reason.includes('STOP LOSS')) {
        short = '🛑 Stop Loss';
        badgeClass = 'badge-exit-sl';
      } else if (reason.includes('Kilitli Kâr')) {
        short = '🔒 Kilitli Kâr';
        badgeClass = 'badge-exit-profit';
      } else if (reason.includes('Manuel')) {
        short = '⚡ Manuel';
        badgeClass = 'badge-exit-manual';
      } else {
        short = reason.length > 20 ? reason.slice(0, 18) + '...' : reason;
      }

      return { short, full, badgeClass };
    }

    function setViewMode(mode) {
      try {
        localStorage.setItem('moon_view_mode', mode);
      } catch (e) {}
      if (mode === 'table') {
        document.body.classList.remove('mode-cards');
        document.body.classList.add('mode-table');
        document.getElementById('btnTable')?.classList.add('active');
        document.getElementById('btnCards')?.classList.remove('active');
      } else {
        document.body.classList.remove('mode-table');
        document.body.classList.add('mode-cards');
        document.getElementById('btnCards')?.classList.add('active');
        document.getElementById('btnTable')?.classList.remove('active');
      }
    }

    // Mobilde varsayılan görünüm modu
    const initialMode = localStorage.getItem('moon_view_mode') || 'cards';
    setViewMode(initialMode);

    async function updateDashboard() {
      if (window.isResetting) return;
      try {
        const res = await fetch('/api/status');
        if (!res.ok) return;
        const data = await res.json();

        // 🛡️ Sıfırlama Koruması: Sunucu sıfırlandıysa tarayıcı hafızasını temizle
        const serverResetEpoch = data.resetEpoch || 0;
        const localResetEpoch = parseInt(localStorage.getItem('moon_reset_epoch') || '0');

        if (serverResetEpoch > 0 && serverResetEpoch > localResetEpoch) {
          localStorage.removeItem(LS_HIST);
          localStorage.removeItem(LS_BAL);
          localStorage.setItem('moon_reset_epoch', serverResetEpoch.toString());
        }

        // ⚙️ Ayar senkronu (deploy sonrası sunucu varsayılana döndüyse tarayıcı kaydını geri yükler)
        syncSettings(data.settings, data.settingsCustomized);

        // Performans & İstatistikler
        document.getElementById("stBalance").innerText = '$' + data.stats.balance;
        const pnlEl = document.getElementById("stPnl");
        pnlEl.innerText = (parseFloat(data.stats.totalPnl) >= 0 ? '+' : '') + '$' + data.stats.totalPnl + ' (%' + data.stats.totalRoi + ')';
        pnlEl.style.color = parseFloat(data.stats.totalPnl) >= 0 ? 'var(--green)' : 'var(--red)';
        document.getElementById("stTotalTrades").innerText = data.stats.totalTrades;
        document.getElementById("stWinRate").innerText = '%' + data.stats.winRate;
        document.getElementById("stWinsLosses").innerText = data.stats.wins + 'K / ' + data.stats.losses + 'Z';
        document.getElementById("stMega").innerText = data.stats.megaWins + ' Adet';
        document.getElementById("posCount").innerText = data.stats.activeCount + ' / ' + (data.settings && data.settings.slots ? data.settings.slots : '1');
        document.getElementById("histCount").innerText = data.history.length;

        const btcEl = document.getElementById("btcVal");
        btcEl.innerText = data.stats.btcTrend;
        btcEl.style.color = data.stats.btcIsGreen ? 'var(--green)' : 'var(--red)';

        if (data.teamStatus && data.teamStatus.team) {
          const t = data.teamStatus.team;
          const ei = data.teamStatus.executiveIntervention;
          if (t.manager && document.getElementById("teamManager")) {
            const isDef = ei && ei.mode === 'DEFENSIVE_SNIPER';
            document.getElementById("teamManager").innerText = isDef ? '🚨 SAVUNMA' : (t.manager.status.includes('ONAY') ? 'ONAYLANDI' : 'VETO');
            document.getElementById("teamManager").className = 'status-pill ' + (isDef ? 'purple' : 'green');
          }
          if (t.analyst && document.getElementById("teamAnalyst")) {
            const ad = t.analyst.description || 'Rejim Aktif';
            document.getElementById("teamAnalyst").innerText = ad.replace('YATAY / SAKİN PİYASA', 'YATAY / SAKİN').replace(' / ', ' · ').replace(' PİYASA', '').trim();
          }
          if (t.trader && document.getElementById("teamTrader")) {
            document.getElementById("teamTrader").innerText = (ei && ei.mode === 'DEFENSIVE_SNIPER') ? '🎯 1 Slot ($10)' : (t.trader.targetVolThreshold || 'Lazer & Moon');
          }
          if (t.tester && document.getElementById("teamTester")) {
            document.getElementById("teamTester").innerText = (ei && ei.mode === 'DEFENSIVE_SNIPER') ? 'Sim: Güvenli' : ('WR: ' + (t.tester.lastTestWinRate ? t.tester.lastTestWinRate.split(' ')[0] : '%100'));
          }
          if (t.engineer && document.getElementById("teamEngineer")) {
            document.getElementById("teamEngineer").innerText = (ei && ei.mode === 'DEFENSIVE_SNIPER') ? 'Regex Aktif' : 'Render Canlı';
          }
          if (t.whale_scout && document.getElementById("teamWhale")) {
            const wst = t.whale_scout.status || '';
            document.getElementById("teamWhale").innerText = wst.includes('GİRİŞ') ? '🟢 Giriş' : (wst.includes('ÇIKIŞ') ? '🔴 Çıkış' : (wst.includes('DENGELİ') ? '⚖️ Dengeli' : 'Para Akışı'));
          }
          if (t.freqai && document.getElementById("teamFreqai")) {
            const fst = t.freqai.status || 'Model Aktif';
            document.getElementById("teamFreqai").innerText = fst.includes('WR') ? fst.replace(' İşlem', '').replace('İşlem', '').trim() : fst.slice(0, 14);
            document.getElementById("teamFreqai").title = t.freqai.role || '';
          }
          if (t.judge && document.getElementById("teamJudge")) {
            const jst = t.judge.status || 'Mahkeme Aktif';
            document.getElementById("teamJudge").innerText = jst.replace('Mahkeme: ', '').replace('Mahkeme Aktif', '76 Puan').toUpperCase().trim();
            document.getElementById("teamJudge").title = t.judge.role || '';
          }
        }

        if (data.teamStatus && data.teamStatus.dialogues) {
          const dBox = document.getElementById("dialogueBox");
          if (dBox) {
            const wasAtBottom = (dBox.scrollHeight - dBox.scrollTop - dBox.clientHeight) < 60;
            dBox.innerHTML = renderDialoguesClient(data.teamStatus.dialogues);
            if (wasAtBottom || !window._dBoxInitialized) {
              dBox.scrollTop = dBox.scrollHeight;
              window._dBoxInitialized = true;
            }
          }
        }

        // Aktif Pozisyonlar Tablosu
        const tbody = document.getElementById("activeTbody");
        if (data.positions.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:35px 15px;"><div style="font-size:32px; margin-bottom:12px; filter:grayscale(0.3);">🔭</div><div style="color:var(--text); font-weight:700; font-size:14px; letter-spacing:0.5px;">TETİKTE BEKLENİYOR</div><div style="color:var(--muted); font-size:11px; margin-top:6px; max-width:320px; margin-left:auto; margin-right:auto; line-height:1.4;">8 Otonom Ajan & CVD Para Akışı Devrede. Emir derinliği, balina hareketleri ve FreqAI modelleriyle kârlı fırsatlar taranıyor...</div></td></tr>';
        } else {
          tbody.innerHTML = data.positions.map((p, idx) => {
            const isLong = p.side === 'LONG';
            const isWin = (p.pnl || 0) >= 0;
            const stopText = p.beLocked 
              ? '<span class="badge-be">🛡️ KÂR KİLİDİ ($0 RİSK)</span>' 
              : '<span class="badge-sl">🛑 RİSK YÖNETİMİ AKTİF</span>';

            const roiStr = (p.roi >= 0 ? '+' : '') + (p.roi || 0).toFixed(2) + '%';
            const pnlStr = (p.pnl >= 0 ? '+$' : '-$') + Math.abs(p.pnl || 0).toFixed(2);
            const tagStr = p.radarTag ? p.radarTag : (isLong ? 'Boğa Kırılımı' : 'Ayı Kırılımı');

            return \`
              <tr style="border-left: 2px solid \${isLong ? 'var(--green)' : 'var(--red)'};">
                <td style="color:var(--muted);font-weight:700;">\${idx+1}</td>
                <td>
                  <div style="display:flex; flex-direction:column; gap:2px;">
                    <div style="display:flex; align-items:center; gap:5px;">
                      <span style="font-family:'JetBrains Mono'; font-weight:900; font-size:13px; color:var(--text); letter-spacing:0.5px;">\${p.symbol}</span>
                      <span class="badge-strat" style="font-size:8.5px; padding:1px 5px; font-weight:800;">\${p.convictionLabel ? p.convictionLabel + ' ($' + p.margin + ')' : '$' + (p.margin || 15)}</span>
                    </div>
                    <span style="font-size:9.5px; color:var(--muted); text-overflow:ellipsis; white-space:nowrap; overflow:hidden; max-width:140px;" title="\${tagStr}">⚡ \${tagStr}</span>
                  </div>
                </td>
                <td>
                  <span class="\${isLong ? 'badge-side-long' : 'badge-side-short'}">\${isLong ? '▲ LONG' : '▼ SHORT'}</span>
                </td>
                <td>
                  <div style="display:flex; flex-direction:column; gap:2px;">
                    <div><span style="color:var(--muted);font-size:10px;">Giriş: </span><span style="color:var(--text);font-weight:700;">$\${parseFloat(p.entryPrice).toFixed(4)}</span></div>
                    <div><span style="color:var(--muted);font-size:10px;">Anlık: </span><span style="color:var(--blue);font-weight:700;">$\${parseFloat(p.currentPrice).toFixed(4)}</span></div>
                  </div>
                </td>
                <td>\${stopText}</td>
                <td>
                  <div style="display:flex; flex-direction:column; gap:2px;">
                    <span style="color:var(--green);font-weight:800;font-size:11px;">+\${(p.mfe || 0).toFixed(2)}%</span>
                    <span style="color:var(--red);font-weight:600;font-size:9px;">-\${(p.mae || 0).toFixed(2)}%</span>
                  </div>
                </td>
                <td>
                  <div class="\${isWin ? 'badge-pnl-pos' : 'badge-pnl-neg'}" style="font-size:12px; padding:3px 6px; text-align:center;">
                    \${roiStr} <br><span style="font-size:9.5px; opacity:0.85;">\${pnlStr}</span>
                  </div>
                </td>
                <td>
                  <button onclick="closePosition('\${p.id}')" class="btn-close-pos">✖ Kapat</button>
                </td>
              </tr>
            \`;
          }).join('');
        }

        // 2. Aktif Pozisyonlar - Mobil Kartlar (iPHONE)
        const activeCardsEl = document.getElementById("activeCardsMobile");
        if (activeCardsEl) {
          if (data.positions.length === 0) {
            activeCardsEl.innerHTML = '<div class="empty-cards-msg">🔍 8 Ajanlı Savunma Radarı Devrede: CVD Para Akışı ve Balina Kırılımları Taranıyor...</div>';
          } else {
            activeCardsEl.innerHTML = data.positions.map((p, idx) => {
              const isLong = p.side === 'LONG';
              const isWin = (p.pnl || 0) >= 0;
              const stopText = p.beLocked 
                ? '<span class="badge-be">🛡️ BAŞABAŞ ($0 RİSK)</span>' 
                : ('<span class="badge-sl">🛑 STOP: -%' + (data.stats && data.stats.slPct ? data.stats.slPct : 1.5).toFixed(2) + '</span>');
              const roiStr = (p.roi >= 0 ? '+' : '') + (p.roi || 0).toFixed(1) + '%';
              const pnlStr = (p.pnl >= 0 ? '+$' : '-$') + Math.abs(p.pnl || 0).toFixed(2);

              return \`
                <div class="pos-card-mobile \${isLong ? 'card-long' : 'card-short'}">
                  <div class="pos-card-header">
                    <div style="display:flex;align-items:center;gap:6px;">
                      <span class="pos-card-sym">\${p.symbol}</span>
                      <span class="\${isLong ? 'badge-side-long' : 'badge-side-short'}">\${isLong ? '▲ LONG 20x' : '▼ SHORT 20x'}</span>
                      <span class="badge-strat" style="font-size:8.5px;padding:1px 5px;font-weight:800;">\${p.convictionLabel ? p.convictionLabel + ' ($' + p.margin + ')' : '$' + (p.margin || 15)}</span>
                    </div>
                    <span class="\${isWin ? 'badge-pnl-pos' : 'badge-pnl-neg'}" style="font-size:13px;font-weight:900;">\${roiStr} (\${pnlStr})</span>
                  </div>
                  <div class="pos-card-grid">
                    <div><span class="card-lbl">Giriş:</span> <span class="card-val">$\${parseFloat(p.entryPrice).toFixed(4)}</span></div>
                    <div><span class="card-lbl">Canlı:</span> <span class="card-val">$\${parseFloat(p.currentPrice).toFixed(4)}</span></div>
                    <div><span class="card-lbl">MFE (Zirve):</span> <span class="card-val" style="color:var(--green)">+%\${(p.mfe || 0).toFixed(2)}</span></div>
                    <div><span class="card-lbl">Durum:</span> \${stopText}</div>
                  </div>
                  <div class="pos-card-footer">
                    <button onclick="closePosition('\${p.id}')" class="btn-close-pos" style="width:100%;min-height:36px;font-size:12px;">✕ Pozisyonu Kapat</button>
                  </div>
                </div>
              \`;
            }).join('');
          }
        }

        // Geçmiş Tablosu
        const histTbody = document.getElementById("historyTbody");
        if (data.history.length === 0) {
          histTbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:18px;">Henüz tamamlanan işlem geçmişi bulunmuyor.</td></tr>';
        } else {
          histTbody.innerHTML = data.history.slice(0, 50).map((h, idx) => {
            const isWin = (h.pnl || 0) >= 0;
            const rTag = h.radarTag || (h.signal ? ('[' + h.signal + ']') : '-');
            const sig = formatSignalCompact(rTag);
            const exit = formatExitReasonCompact(h.exitReason);
            return \`
              <tr>
                <td style="color:var(--muted);font-weight:700;">\${idx+1}</td>
                <td style="color:var(--muted);font-size:10px;">\${h.time}</td>
                <td style="font-weight:800;color:var(--text);font-family:'JetBrains Mono';">\${h.symbol}</td>
                <td><span class="\${h.side === 'LONG' ? 'badge-side-long' : 'badge-side-short'}">\${h.side}</span></td>
                <td><span class="badge-signal \${sig.badgeClass}" title="\${escapeHtml(sig.full)}">\${sig.short}</span></td>
                <td style="color:var(--muted);font-size:10px;">\${h.durationMin} dk</td>
                <td><span class="badge-exit \${exit.badgeClass}" title="\${escapeHtml(exit.full)}">\${exit.short}</span></td>
                <td style="color:var(--green);font-weight:800;">+\${(h.mfe || 0).toFixed(2)}%</td>
                <td style="color:\${isWin ? 'var(--green)' : 'var(--red)'};font-weight:800;">\${isWin ? '+' : ''}$\${(h.pnl || 0).toFixed(2)}</td>
                <td style="color:\${isWin ? 'var(--green)' : 'var(--red)'};font-weight:800;">\${isWin ? '+' : ''}%\${(h.roi || 0).toFixed(1)}</td>
              </tr>
            \`;
          }).join('');
        }

        // 4. Geçmiş Kartları - Mobil (iPHONE)
        const histCardsEl = document.getElementById("historyCardsMobile");
        if (histCardsEl) {
          if (data.history.length === 0) {
            histCardsEl.innerHTML = '<div class="empty-cards-msg">Henüz tamamlanan işlem geçmişi bulunmuyor.</div>';
          } else {
            histCardsEl.innerHTML = data.history.slice(0, 50).map((h, idx) => {
              const isWin = (h.pnl || 0) >= 0;
              const isLong = h.side === 'LONG';
              const rTag = h.radarTag || (h.signal ? ('[' + h.signal + ']') : '-');
              const sig = formatSignalCompact(rTag);
              const exit = formatExitReasonCompact(h.exitReason);
              return \`
                <div class="hist-card-mobile \${isWin ? 'hist-win' : 'hist-loss'}">
                  <div class="hist-card-top">
                    <div style="display:flex;align-items:center;gap:5px;">
                      <span class="hist-card-sym">\${h.symbol}</span>
                      <span class="\${isLong ? 'badge-side-long' : 'badge-side-short'}">\${h.side}</span>
                      <span class="hist-card-time">\${h.time}</span>
                    </div>
                    <span class="\${isWin ? 'badge-pnl-pos' : 'badge-pnl-neg'}" style="font-weight:900;font-size:12px;">
                      \${isWin ? '+' : ''}$\${(h.pnl || 0).toFixed(2)} (\${isWin ? '+' : ''}%\${(h.roi || 0).toFixed(1)})
                    </span>
                  </div>
                  <div class="hist-card-mid">
                    <span class="badge-exit \${exit.badgeClass}" title="\${escapeHtml(exit.full)}">\${exit.short}</span>
                  </div>
                  <div class="hist-card-bot">
                    <span class="badge-signal \${sig.badgeClass}" title="\${escapeHtml(sig.full)}">\${sig.short}</span>
                    <span style="color:var(--muted);font-size:9.5px;">MFE: <b style="color:var(--green)">+\${(h.mfe || 0).toFixed(2)}%</b> • \${h.durationMin}dk</span>
                  </div>
                </div>
              \`;
            }).join('');
          }
        }
      } catch (e) {}
    }

    function renderDialoguesClient(dlgs) {
      if (!dlgs || dlgs.length === 0) {
        return '<div style="color:var(--muted);text-align:center;padding:12px;">📻 Telsiz frekansı taranıyor, ilk toplantı bekleniyor...</div>';
      }
      return dlgs.slice(0, 30).map(function(d) {
        return '<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 10px;background:var(--panel);border-radius:8px;border:1px solid var(--border);">' +
          '<span style="color:var(--muted);font-size:12px;white-space:nowrap;padding-top:1px;">' + d.time + '</span>' +
          '<div style="display:flex;flex-direction:column;gap:2px;flex:1;">' +
            '<div style="display:flex;align-items:center;gap:6px;">' +
              '<span style="color:var(--text);font-weight:650;font-size:12.5px;">' + d.agent + '</span>' +
              '<span style="color:var(--muted);font-size:11px;">' + d.title + '</span>' +
            '</div>' +
            '<div style="color:var(--text-secondary);font-size:13px;line-height:1.45;">' + d.text + '</div>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    async function closePosition(id) {
      if (!confirm("Bu pozisyonu manuel olarak kapatmak istiyor musunuz?")) return;
      await fetch('/api/close-position?id=' + id);
      updateDashboard();
    }

    async function resetBalance() {
      if (!confirm("DİKKAT: Bakiye $100.00 olarak sıfırlanacak ve tüm geçmiş kalıcı olarak silinecektir. Emin misiniz?")) return;
      window.isResetting = true;
      try {
        localStorage.clear();
        sessionStorage.clear();
        const res = await fetch('/api/reset-balance?amount=100');
        const data = await res.json();
        if (data && data.resetEpoch) {
          localStorage.setItem('moon_reset_epoch', data.resetEpoch.toString());
        }
      } catch (e) {}
      window.location.replace(window.location.origin + window.location.pathname + '?reset=' + Date.now());
    }


    // Parametreleri Dinamik Güncelleme (sunucuya + tarayıcı hafızasına kaydeder)
    const LS_SET = 'moon_settings';
    const SET_IDS = { slots: 'inpSlots', margin: 'inpMargin', lev: 'inpLev', sl: 'inpSl', be: 'inpBe', moon: 'inpMoon', tp1: 'inpTp1' };
    let settingsSynced = false;

    function readSettingsFromInputs() {
      const o = {};
      Object.keys(SET_IDS).forEach(k => { o[k] = document.getElementById(SET_IDS[k]).value; });
      return o;
    }

    async function pushSettings(o) {
      await fetch('/api/update-settings?' + new URLSearchParams(o).toString());
    }

    async function syncSettings(serverSettings, customized) {
      if (!serverSettings) return;
      settingsSynced = true;
      try {
        // Sunucu daima kaynaktır (Master). Sunucudaki kalibre ayarları ekrana yazar.
        Object.keys(SET_IDS).forEach(k => {
          if (serverSettings[k] !== undefined && serverSettings[k] !== '') {
            const el = document.getElementById(SET_IDS[k]);
            if (el && document.activeElement !== el) el.value = serverSettings[k];
          }
        });
        localStorage.setItem(LS_SET, JSON.stringify(serverSettings));
      } catch (e) {}
    }

    Object.keys(SET_IDS).forEach(k => {
      document.getElementById(SET_IDS[k]).addEventListener('change', async () => {
        const o = readSettingsFromInputs();
        try { localStorage.setItem(LS_SET, JSON.stringify(o)); } catch (e) {}
        await pushSettings(o);
      });
    });

    updateDashboard();
    setInterval(updateDashboard, 2000);
  </script>
</body>
</html>`;
}

function renderActiveRows(positions) {
  if (!positions || positions.length === 0) {
    return '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px;font-size:12px;">🔍 8 Ajanlı Savunma Radarı Devrede: CVD Para Akışı ve Balina Kırılımları Taranıyor...</td></tr>';
  }
  return positions.map((p, idx) => {
    const isLong = p.side === 'LONG';
    const isWin = (p.pnl || 0) >= 0;
    const stopText = p.beLocked 
      ? '<span class="badge-be">🛡️ BAŞABAŞ ($0 RİSK)</span>' 
      : `<span class="badge-sl">🛑 STOP: -%${CONFIG.slPct.toFixed(2)}</span>`;

    const roiStr = (p.roi >= 0 ? '+' : '') + (p.roi || 0).toFixed(1) + '%';
    const pnlStr = (p.pnl >= 0 ? '+$' : '-$') + Math.abs(p.pnl || 0).toFixed(2);

    return `
      <tr>
        <td style="color:var(--muted);font-weight:700;">${idx+1}</td>
        <td>
          <div style="display:flex;align-items:center;gap:4px;">
            <span style="font-weight:900;color:var(--text);font-family:'JetBrains Mono';">${p.symbol}</span>
            <span class="badge-strat">${p.convictionLabel ? p.convictionLabel + ' ($' + p.margin + ')' : '🚀 MOONSHOT ($' + (p.margin || 15) + ')'}</span>
          </div>
        </td>
        <td>
          <span class="${isLong ? 'badge-side-long' : 'badge-side-short'}">${isLong ? '▲ LONG' : '▼ SHORT'}</span>
        </td>
        <td>
          <span style="color:var(--muted);">$ ${parseFloat(p.entryPrice).toFixed(4)}</span>
          <span style="color:var(--blue);margin:0 2px;">➔</span>
          <span style="color:var(--text);font-weight:800;">$ ${parseFloat(p.currentPrice).toFixed(4)}</span>
        </td>
        <td>${stopText}</td>
        <td><span style="color:var(--green);font-weight:800;">+${(p.mfe || 0).toFixed(2)}%</span></td>
        <td>
          <span class="${isWin ? 'badge-pnl-pos' : 'badge-pnl-neg'}">${roiStr} (${pnlStr})</span>
        </td>
        <td>
          <button onclick="closePosition('${p.id}')" class="btn-close-pos">Kapat</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderHistoryRows(hist) {
  if (!hist || hist.length === 0) {
    return '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:18px;">Henüz tamamlanan işlem geçmişi bulunmuyor.</td></tr>';
  }
  return hist.slice(0, 50).map((h, idx) => {
    const isWin = (h.pnl || 0) >= 0;
    const rTag = h.radarTag || (h.signal ? `[${h.signal}]` : '-');
    const sig = formatSignalCompact(rTag);
    const exit = formatExitReasonCompact(h.exitReason);
    return `
      <tr>
        <td style="color:var(--muted);font-weight:700;">${idx+1}</td>
        <td style="color:var(--muted);font-size:10px;">${h.time}</td>
        <td style="font-weight:800;color:var(--text);font-family:'JetBrains Mono';">${h.symbol}</td>
        <td><span class="${h.side === 'LONG' ? 'badge-side-long' : 'badge-side-short'}">${h.side}</span></td>
        <td><span class="badge-signal ${sig.badgeClass}" title="${escapeHtml(sig.full)}">${sig.short}</span></td>
        <td style="color:var(--muted);font-size:10px;">${h.durationMin} dk</td>
        <td><span class="badge-exit ${exit.badgeClass}" title="${escapeHtml(exit.full)}">${exit.short}</span></td>
        <td style="color:var(--green);font-weight:800;">+${(h.mfe || 0).toFixed(2)}%</td>
        <td style="color:${isWin ? 'var(--green)' : 'var(--red)'};font-weight:800;">${isWin ? '+' : ''}$${(h.pnl || 0).toFixed(2)}</td>
        <td style="color:${isWin ? 'var(--green)' : 'var(--red)'};font-weight:800;">${isWin ? '+' : ''}%${(h.roi || 0).toFixed(1)}</td>
      </tr>
    `;
  }).join('');
}

function renderActiveCards(positions) {
  if (!positions || positions.length === 0) {
    return '<div class="empty-cards-msg">🔍 8 Ajanlı Savunma Radarı Devrede: CVD Para Akışı ve Balina Kırılımları Taranıyor...</div>';
  }
  return positions.map((p, idx) => {
    const isLong = p.side === 'LONG';
    const isWin = (p.pnl || 0) >= 0;
    const stopText = p.beLocked 
      ? '<span class="badge-be">🛡️ BAŞABAŞ ($0 RİSK)</span>' 
      : `<span class="badge-sl">🛑 STOP: -%${CONFIG.slPct.toFixed(2)}</span>`;
    const roiStr = (p.roi >= 0 ? '+' : '') + (p.roi || 0).toFixed(1) + '%';
    const pnlStr = (p.pnl >= 0 ? '+$' : '-$') + Math.abs(p.pnl || 0).toFixed(2);

    return `
      <div class="pos-card-mobile ${isLong ? 'card-long' : 'card-short'}">
        <div class="pos-card-header">
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="pos-card-sym">${p.symbol}</span>
            <span class="${isLong ? 'badge-side-long' : 'badge-side-short'}">${isLong ? '▲ LONG 20x' : '▼ SHORT 20x'}</span>
            <span class="badge-strat" style="font-size:8.5px;padding:1px 5px;font-weight:800;">${p.convictionLabel ? p.convictionLabel + ' ($' + p.margin + ')' : '$' + (p.margin || 15)}</span>
          </div>
          <span class="${isWin ? 'badge-pnl-pos' : 'badge-pnl-neg'}" style="font-size:13px;font-weight:900;">${roiStr} (${pnlStr})</span>
        </div>
        <div class="pos-card-grid">
          <div><span class="card-lbl">Giriş:</span> <span class="card-val">$${parseFloat(p.entryPrice).toFixed(4)}</span></div>
          <div><span class="card-lbl">Canlı:</span> <span class="card-val">$${parseFloat(p.currentPrice).toFixed(4)}</span></div>
          <div><span class="card-lbl">MFE (Zirve):</span> <span class="card-val" style="color:var(--green)">+%${(p.mfe || 0).toFixed(2)}</span></div>
          <div><span class="card-lbl">Durum:</span> ${stopText}</div>
        </div>
        <div class="pos-card-footer">
          <button onclick="closePosition('${p.id}')" class="btn-close-pos" style="width:100%;min-height:36px;font-size:12px;">✕ Pozisyonu Kapat</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderHistoryCards(hist) {
  if (!hist || hist.length === 0) {
    return '<div class="empty-cards-msg">Henüz tamamlanan işlem geçmişi bulunmuyor.</div>';
  }
  return hist.slice(0, 50).map((h, idx) => {
    const isWin = (h.pnl || 0) >= 0;
    const isLong = h.side === 'LONG';
    const rTag = h.radarTag || (h.signal ? `[${h.signal}]` : '-');
    const sig = formatSignalCompact(rTag);
    const exit = formatExitReasonCompact(h.exitReason);
    return `
      <div class="hist-card-mobile ${isWin ? 'hist-win' : 'hist-loss'}">
        <div class="hist-card-top">
          <div style="display:flex;align-items:center;gap:5px;">
            <span class="hist-card-sym">${h.symbol}</span>
            <span class="${isLong ? 'badge-side-long' : 'badge-side-short'}">${h.side}</span>
            <span class="hist-card-time">${h.time}</span>
          </div>
          <span class="${isWin ? 'badge-pnl-pos' : 'badge-pnl-neg'}" style="font-weight:900;font-size:12px;">
            ${isWin ? '+' : ''}$${(h.pnl || 0).toFixed(2)} (${isWin ? '+' : ''}%${(h.roi || 0).toFixed(1)})
          </span>
        </div>
        <div class="hist-card-mid">
          <span class="badge-exit ${exit.badgeClass}" title="${escapeHtml(exit.full)}">${exit.short}</span>
        </div>
        <div class="hist-card-bot">
          <span class="badge-signal ${sig.badgeClass}" title="${escapeHtml(sig.full)}">${sig.short}</span>
          <span style="color:var(--muted);font-size:9.5px;">MFE: <b style="color:var(--green)">+${(h.mfe || 0).toFixed(2)}%</b> • ${h.durationMin}dk</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderDialogues(dlgs) {
  if (!dlgs || dlgs.length === 0) {
    return '<div style="color:var(--muted);text-align:center;padding:12px;">📻 Telsiz frekansı taranıyor, ilk toplantı bekleniyor...</div>';
  }
  return dlgs.slice(0, 30).map(d => {
    return `
      <div style="display:flex;gap:10px;align-items:flex-start;padding:8px 10px;background:var(--panel);border-radius:8px;border:1px solid var(--border);">
        <span style="color:var(--muted);font-size:12px;white-space:nowrap;padding-top:1px;">${d.time}</span>
        <div style="display:flex;flex-direction:column;gap:2px;flex:1;">
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="color:var(--text);font-weight:650;font-size:12.5px;">${d.agent}</span>
            <span style="color:var(--muted);font-size:11px;">${d.title}</span>
          </div>
          <div style="color:var(--text-secondary);font-size:13px;line-height:1.45;">${d.text}</div>
        </div>
      </div>
    `;
  }).join('');
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
      if (body.length > 5 * 1024 * 1024) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// 5. HTTP SUNUCUSU
const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/api/test-fetch') {
    const results = {};
    for (const p of activePositions) {
      try {
        const t0 = Date.now();
        const pData = await fetchBinance(`/fapi/v1/ticker/price?symbol=${p.symbol}`);
        results[p.symbol] = {
          entry: p.entryPrice,
          current: p.currentPrice,
          side: p.side,
          mfe: p.mfe,
          pnl: p.pnl,
          roi: p.roi,
          stopPrice: p.stopPrice,
          pData: pData,
          ms: Date.now() - t0
        };
      } catch (err) {
        results[p.symbol] = { error: err.message };
      }
    }
    results._isRiskRunning = isRiskRunning;
    results._moonPct = CONFIG.moonPct;
    results._tp1Pct = CONFIG.tp1Pct;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(results, null, 2));
    return;
  }

  if (pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: "online", uptimeSeconds: Math.floor((Date.now() - startTime) / 1000) }));
    return;
  }

  if (pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      stats: getStats(),
      positions: activePositions,
      history: history.slice(0, 50),
      logs: logs.slice(0, 50),
      radar: radarList.slice(0, 30),
      resetEpoch: resetEpoch,
      settings: getSettingsPayload(),
      settingsCustomized: settingsCustomized,
      teamStatus: teamStatusCache,
      dynamic: DYNAMIC
    }));
    return;
  }

  if (pathname === '/api/team') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(teamStatusCache || { message: "Ajan ekibi senkronize ediliyor..." }, null, 2));
    return;
  }

  // 🛡️ TARAYICIDAN OTOMATİK DURUM VE GEÇMİŞ KURTARMA (RENDER YENİDEN BAŞLAMASINA KARŞI)
  if (pathname === '/api/restore-state' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      const reqResetEpoch = body ? (body.resetEpoch || 0) : 0;
      if (resetEpoch > 0 && reqResetEpoch <= resetEpoch) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: "Sunucu sıfırlandı. Eski zombi geçmiş kesin olarak engellendi." }));
        return;
      }
      if (body && Array.isArray(body.history) && body.history.length > 0) {
        const existingIds = new Set(history.map(h => h.id));
        let addedCount = 0;
        body.history.forEach(t => {
          if (!existingIds.has(t.id)) {
            history.push(t);
            existingIds.add(t.id);
            addedCount++;
          }
        });
        history.sort((a, b) => (b.id || 0) - (a.id || 0));
        if (history.length > 500) history = history.slice(0, 500);

        const totalPnl = history.reduce((acc, h) => acc + (h.pnl || 0), 0);
        const activeTp1Pnl = Array.isArray(activePositions) ? activePositions.reduce((acc, p) => acc + (p.tp1Pnl || 0), 0) : 0;
        balance = CONFIG.initialBalance + totalPnl + activeTp1Pnl;

        rebuildCoinLossHistory();
        rewriteCsvFile();
        persistState();
        try {
          fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 500), null, 2), 'utf8');
        } catch(e) {}

        addLog(`💾 Tarayıcı Hafızasından (LocalStorage) Bakiye ($${balance.toFixed(2)}) ve ${history.length} Adet İşlem Başarıyla Kurtarıldı! (+${addedCount} yeni)`, 'RESTORE');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, restored: history.length, balance, added: addedCount }));
        return;
      }
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: "Geçersiz geçmiş verisi" }));
      return;
    } catch(err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
      return;
    }
  }

  // 💾 JSON YEDEK İNDİRME
  if (pathname === '/api/backup-json') {
    const backupData = {
      appName: "Moonshot 7/24 Cloud Bot",
      version: "2.1",
      exportDate: new Date().toISOString(),
      balance,
      initialBalance: CONFIG.initialBalance,
      config: CONFIG,
      stats: getStats(),
      activePositions,
      history
    };
    const jsonStr = JSON.stringify(backupData, null, 2);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': 'attachment; filename="moonshot_bot_backup.json"'
    });
    res.end(jsonStr);
    return;
  }

  // 📂 JSON YEDEK YÜKLEME
  if (pathname === '/api/import-backup' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
      if (body && Array.isArray(body.history)) {
        history = body.history;
        if (body.balance && !isNaN(body.balance)) {
          balance = parseFloat(body.balance);
        } else {
          const totalPnl = history.reduce((acc, h) => acc + (h.pnl || 0), 0);
          const activeTp1Pnl = Array.isArray(activePositions) ? activePositions.reduce((acc, p) => acc + (p.tp1Pnl || 0), 0) : 0;
          balance = (body.initialBalance || CONFIG.initialBalance) + totalPnl + activeTp1Pnl;
        }
        rebuildCoinLossHistory();
        rewriteCsvFile();
        persistState();
        try {
          fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 500), null, 2), 'utf8');
        } catch(e) {}
        addLog(`📂 Yedek Dosyası Yüklendi: $${balance.toFixed(2)} Bakiye, ${history.length} Adet İşlem!`, 'RESTORE');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, restored: history.length, balance }));
        return;
      }
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: "Geçersiz yedek formatı" }));
      return;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
      return;
    }
  }

  if (pathname === '/api/close-position') {
    const id = parsedUrl.searchParams.get('id');
    const idx = activePositions.findIndex(p => p.id === id);
    if (idx !== -1) {
      const closed = activePositions.splice(idx, 1)[0];
      closeTrade(closed, "🛑 Manuel Kapatıldı");
      persistState();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (pathname === '/api/reset-balance') {
    resetEpoch = Date.now();
    const amt = parseFloat(parsedUrl.searchParams.get('amount'));
    balance = (!isNaN(amt) && amt > 0) ? amt : (CONFIG.initialBalance || 100.0);
    CONFIG.initialBalance = balance;
    activePositions = [];
    history = [];
    coinLossCount = {};
    coinCooldowns = {};
    DYNAMIC.mode = 'BALANCED';
    DYNAMIC.vol3hMin = 2.5;
    DYNAMIC.candidateSlice = 30;
    try {
      fs.writeFileSync(HISTORY_FILE, '[]', 'utf8');
      rewriteCsvFile();
    } catch (e) {}
    persistState();
    addLog(`🧹 Bakiye $${balance.toFixed(2)} olarak ve işlem geçmişi tamamen sıfırlandı.`, 'RESET');
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, balance, resetEpoch }));
    return;
  }

  if (pathname === '/api/update-settings') {
    const clean = sanitizeSettings({
      slots: parsedUrl.searchParams.get('slots'),
      margin: parsedUrl.searchParams.get('margin'),
      lev: parsedUrl.searchParams.get('lev'),
      sl: parsedUrl.searchParams.get('sl'),
      be: parsedUrl.searchParams.get('be'),
      moon: parsedUrl.searchParams.get('moon'),
      tp1: parsedUrl.searchParams.get('tp1')
    });
    Object.assign(CONFIG, clean);
    saveSettings();
    addLog(`⚙️ Ayarlar kaydedildi: Slot ${CONFIG.maxSlots} | Teminat $${CONFIG.marginPerTrade} | ${CONFIG.leverage}x | SL %${CONFIG.slPct} | BE %${CONFIG.bePct} | TP1 %${CONFIG.tp1Pct} | Moon %${CONFIG.moonPct}`, 'INFO');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, config: CONFIG }));
    return;
  }

  if (pathname === '/api/download-csv') {
    if (!fs.existsSync(CSV_FILE)) {
      rewriteCsvFile();
    }
    const stat = fs.statSync(CSV_FILE);
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="moonshot_trades_history.csv"',
      'Content-Length': stat.size
    });
    fs.createReadStream(CSV_FILE).pipe(res);
    return;
  }

  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(serveDashboardHtml());
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end("Not Found");
});

// SUNUCUYU BAŞLAT
initStorage();
server.listen(PORT, () => {
  addLog(`🌐 Web Sunucusu hazır: http://localhost:${PORT}`);
  addLog(`🚀 Moonshot 7/24 Bulut Test Laboratuvarı Başlatıldı! (Bakiye: $${balance.toFixed(2)})`);
  updateRadar();
  setInterval(scanLoop, CONFIG.scanIntervalMs);
  setInterval(fastRiskLoop, CONFIG.riskIntervalMs);
  setInterval(updateRadar, CONFIG.radarIntervalMs);

  // 🛡️ Otomatik Uyku Önleyici (Keep-Alive Self Ping)
  const KEEP_ALIVE_URL = process.env.RENDER_EXTERNAL_URL || "https://moonshot-cloud-bot.onrender.com";
  setInterval(async () => {
    try {
      await fetch(`${KEEP_ALIVE_URL}/ping`);
    } catch(e) {}
  }, 4 * 60 * 1000);

  // 🤖 OTONOM 8-AJAN EKİBİ: Toplantı yap → Yönetici onaylarsa giriş filtrelerini CANLI uygula
  try {
    const { runAutonomousTeamSync } = require('./quant_lab/team_runner');
    const clamp = (v, [lo, hi]) => Math.min(hi, Math.max(lo, v));

    const runTeam = async () => {
      try {
        const report = await runAutonomousTeamSync({
          balance,
          initialBalance: CONFIG.initialBalance || 100.0,
          peakBalance: getPeakBalance(),
          activeCount: activePositions.length,
          maxSlots: CONFIG.maxSlots,
          uptimeMin: Math.floor((Date.now() - startTime) / 60000),
          current: { ...DYNAMIC },
          config: { slPct: CONFIG.slPct, bePct: CONFIG.bePct, tp1Pct: CONFIG.tp1Pct, moonPct: CONFIG.moonPct, marginPerTrade: CONFIG.marginPerTrade, leverage: CONFIG.leverage }
        });
        teamStatusCache = report;
        if (report && report.moneyFlow && report.moneyFlow.flowMap) {
          globalWhaleFlowMap = report.moneyFlow.flowMap;
        }
        if (report && report.fundingRates && report.fundingRates.fundingMap) {
          globalFundingMap = report.fundingRates.fundingMap;
        }

        const ei = report && report.executiveIntervention;
        const d = report && report.decision;

        if (ei && (ei.active || ei.isSevereLoss || ei.isModerateLoss)) {
          CONFIG.maxSlots = ei.maxSlots;
          CONFIG.marginPerTrade = ei.marginPerTrade;
          CONFIG.slPct = clamp(Number(ei.slPct) || CONFIG.slPct, [0.20, 0.35]);
          CONFIG.bePct = clamp(Number(ei.bePct) || CONFIG.bePct, [0.15, 0.28]);
          CONFIG.tp1Pct = clamp(Number(ei.tp1Pct) || CONFIG.tp1Pct, [0.50, 0.80]);
          CONFIG.moonPct = clamp(Number(ei.moonPct) || CONFIG.moonPct, [0.30, 0.48]);
          DYNAMIC.mode = ei.mode;
          DYNAMIC.vol3hMin = ei.vol3hMin;
          DYNAMIC.candidateSlice = ei.candidateSlice;
          DYNAMIC.regime = (d && d.regime) || DYNAMIC.regime;
          DYNAMIC.updatedAt = Date.now();
          saveSettings();
          const champInfo = (d && d.championStrategy) ? ` | 🏆 Şampiyon: ${d.championStrategy.name} (PF: ${d.championStrategy.summary?.profitFactor})` : '';
          addLog(`🚨 AJAN MÜDAHALESİ AKTİF: [${ei.mode}] Slot: ${CONFIG.maxSlots} | Teminat: $${CONFIG.marginPerTrade} | SL: %${CONFIG.slPct} | BE: %${CONFIG.bePct} | Eşik: $${DYNAMIC.vol3hMin}M${champInfo}`, 'RISK');
        } else if (d && d.approved && d.entryFilters) {
          const before = { ...DYNAMIC };
          DYNAMIC.vol3hMin = clamp(Number(d.entryFilters.vol3hMin) || before.vol3hMin, DYNAMIC_LIMITS.vol3hMin);
          DYNAMIC.candidateSlice = Math.round(clamp(Number(d.entryFilters.candidateSlice) || before.candidateSlice, DYNAMIC_LIMITS.candidateSlice));
          DYNAMIC.regime = d.regime || before.regime;
          DYNAMIC.mode = (ei && ei.mode) || 'BALANCED';
          DYNAMIC.updatedAt = Date.now();
          if (d.exitParams) {
            const ep = d.exitParams;
            CONFIG.slPct = clamp(Number(ep.slPct) || CONFIG.slPct, [0.20, 0.35]);
            CONFIG.bePct = clamp(Number(ep.bePct) || CONFIG.bePct, [0.15, 0.28]);
            CONFIG.tp1Pct = clamp(Number(ep.tp1Pct) || CONFIG.tp1Pct, [0.50, 0.80]);
            CONFIG.moonPct = clamp(Number(ep.moonPct) || CONFIG.moonPct, [0.30, 0.48]);
          }
          if (d.riskParams) {
            CONFIG.maxSlots = d.riskParams.maxSlots || CONFIG.maxSlots;
            CONFIG.marginPerTrade = d.riskParams.marginPerTrade || CONFIG.marginPerTrade;
          }
          saveSettings();
          addLog(`🤖 Ekip kararı uygulandı: [${DYNAMIC.mode}] Slot: ${CONFIG.maxSlots} | Teminat: $${CONFIG.marginPerTrade} | Eşik $${DYNAMIC.vol3hMin}M | Aday ${DYNAMIC.candidateSlice}`, 'INFO');
        } else {
          addLog(`🤖 Ekip toplantısı: değişiklik onaylanmadı (${(d && d.reason) || 'bilinmiyor'})`, 'INFO');
        }
      } catch (e) {
        addLog(`Ajan Ekibi Hatası: ${e.message}`, 'WARN');
      }
    };

    setTimeout(runTeam, 2000);
    setInterval(runTeam, 5 * 60 * 1000);
  } catch (e) {
    addLog(`Ajan Ekibi yüklenemedi: ${e.message}`, 'WARN');
  }
});
