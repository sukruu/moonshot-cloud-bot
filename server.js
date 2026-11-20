/**
 * ============================================================================
 * 🚀 MOONSHOT 7/24 BULUT TEST LABORATUVARI (SCREEN 1 - BİREBİR EKRAN MOTORU)
 * ============================================================================
 * Bakiye: $100.00 | Max Slot: 2 | Teminat: $15 | Kaldıraç: 40x | VUR KAÇ: TP1 %0.55, max 40dk, Long+Short
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

let evaluatePreTradeClearance = () => ({ approved: true, judicialScore: 85, verdict: 'BERAAT', reason: '' });
try {
  const judgeMod = require('./quant_lab/judge_audit');
  evaluatePreTradeClearance = judgeMod.evaluatePreTradeClearance;
} catch (e) {}

// --- EKRAN 1 BİREBİR AYARLARI (MARSCOIN V3 — 15DK BALİNA MOTORU + 3.5R RUNNER) ---
let CONFIG = {
  initialBalance: 100.0,     // Bakiye 100 Dolar
  marginPerTrade: 20.0,      // Baz teminat (Sabit %2.5 ≈ $2.50 risk ile ATR15m stopa göre otomatik ölçeklenir)
  riskPerTradeUsd: 2.50,     // Sabit dolar riski (%2.5 kasa: SL %1.0-%2.8 arası ne olursa olsun max ~$2.50 kayıp!)
  leverage: 10,              // 10x kaldıraç (Geniş 15dk ATR stoplarında 3 slota tam uyumlu nominal ölçekleme)
  maxSlots: 3,               // Max 3 pozisyon (aynı yönde en fazla 2, çift yön LONG + SHORT aktif)
  slPct: 1.50,               // Baz stop (15dk ATR x 1.50 ile %1.00 - %2.80 arası otomatik esner)
  bePct: 1.50,               // 1.0R kâr görünce (+%1.0*SL) stop +%0.15'e çekilir ($0 risk, erken boğma yok!)
  tp1Pct: 2.10,              // 1.4R kâr görünce geniş iz süren Runner stopu (mfe - 0.85*SL) devreye girer
  tp2Pct: 3.50,              // Referans kademe
  moonPct: 5.25,             // 🚀 3.5R Moonshot hedefi (+%3.5*SL -> ~$8.50+ büyük balina kârı!)
  tp1ClosePct: 0.0,          // %100 tam pozisyonla Runner sürülür (erken kâr bölme yok!)
  tp2ClosePct: 0.0,
  maxTradeMin: 480,          // 15dk trendlerin olgunlaşması için 8 saat (32 x 15dk mum)
  makerRate: 0.0002,         // Limit giriş ve kâr satış. Taker stop ayrı
  minEntryScore: 0,
  maxTradesPerDay: 0,
  aPlusOnly: false,
  feeRate: 0.0005,           // Binance Futures taker %0.05 (TEK YÖN)
  scanIntervalMs: 5000,      // 15dk kapalı mum motoru için 5 sn tarama (hızlı + rate-limit dostu)
  riskIntervalMs: 1000,
  radarIntervalMs: 45000
};

// Giriş genişliği. Ajan toplantısı bunu değiştirmez.
let DYNAMIC = {
  vol3hMin: 0.8,
  candidateSlice: 120,
  regime: 'WHALE_15M',
  mode: 'MARSCOIN_15M_WHALE',
  updatedAt: 0
};

let userRisk = { maxSlots: 3, marginPerTrade: 20 };
let circuitOn = false;

function getDynamicMargin() {
  if (circuitOn) {
    return Math.min(Number(userRisk.marginPerTrade) || 30, 10);
  }
  return Number(userRisk.marginPerTrade) || 30;
}

function rememberUserRisk() {
  userRisk = {
    maxSlots: CONFIG.maxSlots,
    marginPerTrade: CONFIG.marginPerTrade
  };
}

function applyCircuitBreaker() {
  const initial = Number(CONFIG.initialBalance) || 100;
  const peak = Math.max(getPeakBalance(), initial, balance);
  const dd = peak > 0 ? (peak - balance) / peak : 0;
  const severe = balance < 45 || dd >= 0.45;
  const profitGuard = !severe && (balance < 70 || dd >= 0.28);
  if (severe) {
    const nextMargin = Math.min(Number(userRisk.marginPerTrade) || 30, 10);
    const changed = !circuitOn || CONFIG.maxSlots !== 1 || CONFIG.marginPerTrade !== nextMargin;
    circuitOn = true;
    CONFIG.maxSlots = 1;
    CONFIG.marginPerTrade = nextMargin;
    DYNAMIC.mode = 'DEFENSIVE_SNIPER';
    if (changed) {
      addLog(`🛑 Devre kesici: kasa $${balance.toFixed(2)}, zirveden %${(dd * 100).toFixed(1)}. Slot 1, teminat $${nextMargin}.`, 'RISK');
    }
    return;
  }
  const dynamicMargin = getDynamicMargin();
  circuitOn = false;
  if (profitGuard) {
    CONFIG.maxSlots = 2;
    CONFIG.marginPerTrade = dynamicMargin;
    DYNAMIC.mode = 'MARSCOIN_15M_WHALE';
  } else {
    CONFIG.maxSlots = userRisk.maxSlots || 3;
    CONFIG.marginPerTrade = dynamicMargin;
    DYNAMIC.mode = 'MARSCOIN_15M_WHALE';
  }
}

function engineSnapshot() {
  return {
    mode: DYNAMIC.mode,
    circuit: circuitOn,
    liveSlots: CONFIG.maxSlots,
    liveMargin: CONFIG.marginPerTrade,
    userSlots: userRisk.maxSlots,
    userMargin: userRisk.marginPerTrade,
    gates: {
      entry: '15dk Balina (2.5x+) | LONG 3.5R Geniş Trail · SHORT 2.5R Sıkı Trail',
      book: 'defter fiyatı',
      judge: 'açık',
      flow: '15dk & 4s Saf Kripto Futures balina akışı',
      freqai: 'kapalı',
      funding: 'kapalı',
      team: 'kapalı'
    }
  };
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
  'BFUSDUSDT', 'USD1USDT', 'RLUSDUSDT', 'RWUSDUSDT', 'USDEUSDT', 'USDPUSDT',
  'AMPUSDT', 'XAUTUSDT', 'PAXGUSDT', 'XAUUSDT', 'XAGUSDT', 'XPTUSDT', 'XPDUSDT',
  'CLUSDT', 'BZUSDT', 'NATGASUSDT', 'COPPERUSDT', 'DEFIUSDT', 'BTCDOMUSDT', 'ALLUSDT'
]);

const KNOWN_CRYPTO_B = new Set(['ARBUSDT', 'CKBUSDT', 'TRBUSDT', 'PHBUSDT', 'AMBUSDT', 'BBUSDT', 'BELUSDT', 'BLZUSDT', 'BOMEUSDT']);
const SYMBOL_REGEX_GLOBAL = /^[A-Z0-9]{2,14}USDT$/;
const nonCryptoFuturesSymbols = new Set(); // /fapi/v1/exchangeInfo ile otomatik dolan 248+ TradFi hisse/ETF/emtia/delist listesi
let lastExchangeInfoRefresh = 0;

async function refreshExchangeInfoFilter() {
  const now = Date.now();
  if (lastExchangeInfoRefresh > 0 && (now - lastExchangeInfoRefresh) < 6 * 60 * 60 * 1000) return;
  try {
    const info = await fetchBinance('/fapi/v1/exchangeInfo');
    if (info && Array.isArray(info.symbols) && info.symbols.length > 50) {
      const blocked = new Set();
      for (const s of info.symbols) {
        if (!s || !s.symbol || !s.symbol.endsWith('USDT')) continue;
        const isPureCryptoPerp =
          s.status === 'TRADING' &&
          s.contractType === 'PERPETUAL' &&
          s.underlyingType === 'COIN';
        if (!isPureCryptoPerp) blocked.add(s.symbol);
      }
      nonCryptoFuturesSymbols.clear();
      blocked.forEach(sym => nonCryptoFuturesSymbols.add(sym));
      lastExchangeInfoRefresh = now;
      addLog(`🛡️ [KRİPTO FİLTRESİ]: ${blocked.size} adet TradFi hisse/ETF/emtia/delist kontratı taramadan çıkarıldı (Sadece saf Kripto Futures).`, 'INFO');
    }
  } catch (e) {}
}

function isTradableCryptoSymbol(sym) {
  if (!sym || !SYMBOL_REGEX_GLOBAL.test(sym) || sym.startsWith("USDC") || BANNED_SYMBOLS.has(sym)) return false;
  if (nonCryptoFuturesSymbols.has(sym)) return false;
  if (/(UP|DOWN|BULL|BEAR)USDT$/.test(sym)) return false;
  // Spot yedekte gelen ABD hisse senedi / ETF tokenlarını (INTCBUSDT, SOXLBUSDT, AMDBUSDT, CRCLBUSDT, SNDKBUSDT, TQQQBUSDT vb.) engelle
  if (sym.endsWith("BUSDT") && !KNOWN_CRYPTO_B.has(sym)) return false;
  return true;
}

// --- DURUM DEĞİŞKENLERİ ---
let balance = CONFIG.initialBalance;
let activePositions = [];
let history = [];
let coinCooldowns = {};
let coinLossCount = {};  // 🛡️ Aynı koine ardışık zarar sayısı (2 zarar → yasakla, kâr ederse sıfırla)
let resetEpoch = 0;      // 🛡️ Bilinçli sıfırlama zaman damgası (Zombi geçmiş kurtarmayı engeller)
let lastTradeOpenTime = 0;
let tradingCooldownUntil = 0; // Günlük zarar limiti
let randomOpen = [];
let randomClosed = [];
let lossPauseServedKey = ''; // Aynı 4'lü zarar serisi 8 dk'yı bir kez yer, bitince tekrar kilitlenmez
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

function istanbulDayKey(ms = Date.now()) {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: TR_TZ });
}

function coinLostTwiceToday(sym) {
  const today = istanbulDayKey();
  const rows = (history || []).filter((h) => {
    if (!h || h.symbol !== sym) return false;
    if (h.entryTimeMs) return istanbulDayKey(h.entryTimeMs) === today;
    const ds = h.entryTimeStr || h.dateFullStr || '';
    const m = ds.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    return !!m && `${m[3]}-${m[2]}-${m[1]}` === today;
  });
  rows.sort((a, b) => (a.entryTimeMs || a.id || 0) - (b.entryTimeMs || b.id || 0));
  let streak = 0;
  for (const t of rows) {
    const pnl = Number(t.pnl) || 0;
    if (pnl > 0.05) streak = 0;
    else if (pnl <= -0.05) streak += 1;
  }
  return streak >= 2;
}

function todayNetPnl() {
  const today = istanbulDayKey();
  return (history || []).reduce((acc, h) => {
    if (!h || !h.entryTimeMs) return acc;
    if (istanbulDayKey(h.entryTimeMs) !== today) return acc;
    return acc + (Number(h.pnl) || 0);
  }, 0);
}

const dayBanLogged = new Set();

function countTradesToday() {
  const today = istanbulDayKey();
  return (history || []).filter((h) => {
    if (h.entryTimeMs) return istanbulDayKey(h.entryTimeMs) === today;
    const ds = h.entryTimeStr || h.dateFullStr || '';
    const m = ds.match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (!m) return false;
    return `${m[3]}-${m[2]}-${m[1]}` === today;
  }).length;
}

function scannerShield(side, ctx) {
  const rsi = Number(ctx.rsi3m);
  const taker = Number(ctx.taker);
  const vol = Number(ctx.volMult);
  if (side === 'LONG') {
    if (taker < 50) return `alıcı yok (%${taker.toFixed(0)})`;
    if (rsi > 74) return `RSI tepe (${rsi.toFixed(0)})`;
  } else {
    if (taker > 50) return `satıcı yok (%${taker.toFixed(0)})`;
    if (rsi < 26) return `RSI dip (${rsi.toFixed(0)})`;
  }
  if (vol >= 8 && Math.abs(taker - 50) < 3) return `hacim var yön yok`;
  return null;
}

function passesAPlusEntry(side, ctx) {
  if (!CONFIG.aPlusOnly) return true;
  const {
    prevMovePct, prevVolMult, chg1hCalc, chg3hVal, sig
  } = ctx;
  const whaleLong = sig.includes('BALİNA') || sig.includes('GÜÇLÜ BOĞA') || sig.includes('ROKET');
  const whaleShort = sig.includes('BALİNA') || sig.includes('GÜÇLÜ AYI') || sig.includes('AYI');
  if (side === 'LONG') {
    if (chg1hCalc >= 2.2) return false;
    return (
      prevMovePct >= 0.40 &&
      prevVolMult >= 1.20 &&
      (prevVolMult >= 1.50 || whaleLong) &&
      (chg1hCalc >= 0.25 || (chg3hVal >= 2.0 && prevMovePct >= 0.45))
    );
  }
  if (chg3hVal <= -5.0 || (ctx.chg24Val || 0) <= -8.0) return false;
  return (
    prevMovePct <= -0.32 &&
    prevVolMult >= 1.20 &&
    chg1hCalc <= -0.85 &&
    (prevVolMult >= 1.55 || whaleShort)
  );
}

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
  const sl = num(s.sl), be = num(s.be), moon = num(s.moon), tp1 = num(s.tp1), tp2 = num(s.tp2);
  if (inRange(slots, 1, 4)) out.maxSlots = Math.round(slots);
  if (inRange(margin, 6, 40)) out.marginPerTrade = margin;
  if (lev !== null) out.leverage = Math.min(40, Math.max(5, Math.round(lev)));
  if (inRange(sl, 0.20, 3.5)) out.slPct = sl;
  if (inRange(be, 0.15, 3.5)) out.bePct = be;
  if (inRange(moon, 0.80, 12.0)) out.moonPct = moon;
  if (inRange(tp1, 0.40, 6.0)) out.tp1Pct = tp1;
  if (inRange(tp2, 0.60, 8.0)) out.tp2Pct = tp2;
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
      tp2Pct: CONFIG.tp2Pct,
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
      sl: saved.slPct, be: saved.bePct, moon: saved.moonPct, tp1: saved.tp1Pct, tp2: saved.tp2Pct
    });
    // Eski 3dk scalp varsayılanlarından (SL 0.45/0.80/0.90) yeni 15dk Balina Motoruna (3.5R Runner) otomatik geçiş
    const isOldLegacy =
      (clean.slPct === 0.45 && clean.tp1Pct === 0.72) ||
      (clean.slPct === 0.90 && clean.tp1Pct === 0.75 && clean.moonPct === 2.80) ||
      (clean.slPct === 0.80 && (clean.tp1Pct === 0.90 || clean.tp1Pct === 1.20 || clean.tp1Pct === 1.60));
    if (isOldLegacy) {
      clean.leverage = 10;
      clean.marginPerTrade = 20;
      clean.slPct = 1.50;
      clean.bePct = 1.50;
      clean.tp1Pct = 2.10;
      clean.tp2Pct = 3.50;
      clean.moonPct = 5.25;
    }
    Object.assign(CONFIG, clean);
    rememberUserRisk();
    if (isOldLegacy) saveSettings();
    settingsCustomized = true;
  } catch (e) {}
}

function getSettingsPayload() {
  return {
    slots: userRisk.maxSlots, 
    margin: CONFIG.marginPerTrade,
    userMargin: userRisk.marginPerTrade, 
    lev: CONFIG.leverage,
    sl: CONFIG.slPct, 
    be: CONFIG.bePct, 
    moon: CONFIG.moonPct, 
    tp1: CONFIG.tp1Pct,
    tp2: CONFIG.tp2Pct
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
      if (!Array.isArray(history)) history = [];
      const stamp = (h) => {
        const n = Number(h.entryTimeMs) || 0;
        if (n > 0) return n;
        const ds = String(h.entryTimeStr || h.dateFullStr || '');
        const m = ds.match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
        if (!m) return 0;
        return Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4] - 3, +m[5], +m[6]);
      };
      const newestMs = history.reduce((mx, h) => Math.max(mx, stamp(h)), 0);
      const staleBook = history.length > 0 && newestMs > 0 && (Date.now() - newestMs) > 36 * 60 * 60 * 1000;
      if (staleBook) {
        history = [];
        balance = CONFIG.initialBalance;
        activePositions = [];
        addLog('Eski işlem defteri (36 saatten eski) yok sayıldı. Kasa $100.', 'RESET');
      } else if (history.length > 0) {
        const totalPnl = history.reduce((acc, h) => acc + (h.pnl || 0), 0);
        const activeTpPnl = Array.isArray(activePositions) ? activePositions.reduce((acc, p) => acc + (p.tp1Pnl || 0) + (p.tp2Pnl || 0), 0) : 0;
        balance = CONFIG.initialBalance + totalPnl + activeTpPnl;
      }
    }

    if (history.length === 0 && activePositions.length === 0) {
      balance = CONFIG.initialBalance;
    }
    rebuildCoinLossHistory();
    rewriteCsvFile();
  } catch (err) {
    addLog(`Dosya okuma: ${err.message}`, 'WARN');
  }
  rememberUserRisk();
}

function parseTrDateMs(str, fallbackMs) {
  if (!str || typeof str !== 'string') return fallbackMs;
  const m = str.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})/);
  if (!m) return fallbackMs;
  // dateFullStr Türkiye saatiyle (UTC+3) yazıldığı için UTC'ye çevirirken 3 saat çıkarılır (Render UTC sunucusunda 3 saat ileri kaymayı önler)
  const utcMs = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]) - 3, Number(m[5]), Number(m[6]));
  return isNaN(utcMs) ? fallbackMs : utcMs;
}

function rebuildCoinLossHistory() {
  coinLossCount = {};
  if (!Array.isArray(history) || history.length === 0) return;
  const chron = [...history].sort((a, b) => (a.id || 0) - (b.id || 0));
  for (const t of chron) {
    const sym = t.symbol;
    if (!sym) continue;
    const isLoss = (t.pnl <= -0.05) || (t.exitReason && (t.exitReason.includes("Stop Loss") || t.exitReason.includes("İvmesizlik") || t.exitReason.includes("Durgunluk") || t.exitReason.includes("Zarar")));
    if (isLoss) coinLossCount[sym] = (coinLossCount[sym] || 0) + 1;
    else coinLossCount[sym] = 0;
  }
}

const SHADOW_FILE = path.join(DATA_DIR, 'shadow_signals.json');
let shadowSignals = [];
const shadowDedupMap = new Map();
try {
  if (fs.existsSync(SHADOW_FILE)) {
    const rawShadow = JSON.parse(fs.readFileSync(SHADOW_FILE, 'utf8'));
    if (Array.isArray(rawShadow)) shadowSignals = rawShadow.slice(0, 1000);
  }
} catch (e) {}

function saveShadowSignals() {
  try {
    fs.writeFileSync(SHADOW_FILE, JSON.stringify(shadowSignals.slice(0, 1000), null, 2), 'utf8');
  } catch (e) {}
}

function recordShadowSignal(info) {
  try {
    const now = Date.now();
    const dedupKey = `${info.symbol}:${info.stage}`;
    const lastSeen = shadowDedupMap.get(dedupKey) || 0;
    const dedupMs = String(info.stage).startsWith('RADAR_') ? 15 * 60000 : 180000;
    if (info.stage !== 'TAKEN' && (now - lastSeen) < dedupMs) return;
    shadowDedupMap.set(dedupKey, now);

    const rec = {
      id: (shadowSignals.length > 0 ? Math.max(...shadowSignals.map(s => s.id || 0)) : 0) + 1,
      time: trDateTime(now),
      ts: now,
      symbol: info.symbol,
      side: info.side,
      stage: info.stage,
      entryPrice: info.price,
      chg15: info.chg15,
      chg3h: info.chg3h,
      chg24h: info.chg24h,
      rangePos: info.rangePos,
      taker: info.taker,
      cur3m: info.cur3m,
      prev3m: info.prev3m,
      atr3m: info.atr3m,
      cp1m: null,
      cp3m: null,
      cp5m: null,
      cp15m: null
    };
    shadowSignals.unshift(rec);
    if (shadowSignals.length > 1000) shadowSignals.pop();
    saveShadowSignals();

    for (const cp of [{ key: 'cp1m', min: 1 }, { key: 'cp3m', min: 3 }, { key: 'cp5m', min: 5 }, { key: 'cp15m', min: 15 }]) {
      setTimeout(async () => {
        try {
          const pData = await fetchBinance(`/fapi/v1/ticker/price?symbol=${rec.symbol}`);
          if (pData && pData.price && rec.entryPrice > 0) {
            const curP = parseFloat(pData.price);
            const move = rec.side === 'LONG'
              ? ((curP - rec.entryPrice) / rec.entryPrice) * 100
              : ((rec.entryPrice - curP) / rec.entryPrice) * 100;
            rec[cp.key] = Number(move.toFixed(2));
            saveShadowSignals();
          }
        } catch (e) {}
      }, cp.min * 60 * 1000);
    }
  } catch (e) {}
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

function formatCpPct(val) {
  return (val !== null && val !== undefined && isFinite(val)) ? `"%${Number(val).toFixed(2)}"` : `"-"`;
}

function csvNum(v, digits, wrap) {
  if (v === null || v === undefined || !isFinite(Number(v))) return '"-"';
  const body = Number(v).toFixed(digits);
  return wrap ? `"${wrap[0]}${body}${wrap[1] || ''}"` : body;
}

function extraTradeCsvCells(trade) {
  return [
    csvNum(trade.margin, 2, ['', '']),
    csvNum(trade.leverage, 0),
    csvNum(trade.notional, 2, ['', '']),
    csvNum(trade.slPct, 2, ['%', '']),
    csvNum(trade.tpPct, 2, ['%', '']),
    csvNum(trade.exitMovePct, 2, ['%', '']),
    csvNum(trade.givebackPct, 2, ['%', '']),
    csvNum(trade.chg1h, 2, ['%', '']),
    csvNum(trade.vol24M, 1, ['$', 'M']),
    csvNum(trade.pos1h, 1, ['%', '']),
    csvNum(trade.breakVol, 2),
    csvNum(trade.trigger3m, 2, ['%', '']),
    csvNum(trade.spreadBps, 2),
    csvNum(trade.btc5mExit, 2, ['%', '']),
    csvNum(trade.btc15mExit, 2, ['%', '']),
    csvNum(trade.balanceAfter, 2, ['', '']),
    csvNum(trade.oppositePnl, 2, ['', ''])
  ];
}

const EXTRA_CSV_HEADER = [
  'Teminat ($)',
  'Kaldıraç',
  'Nominal ($)',
  'Stop (%)',
  'Hedef (%)',
  'Çıkış Hareketi (%)',
  'Geri Verme (%)',
  '1s (%)',
  '24s Hacim ($M)',
  '1s Kanal (%)',
  'Kırılım Hacmi (x)',
  'Tetik 3dk (%)',
  'Spread (bps)',
  'BTC 5m Çıkış (%)',
  'BTC 15m Çıkış (%)',
  'Kasa Sonrası ($)',
  'Ters PnL ($)'
];

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
      'Radar Teyidi',
      '1dk Sonra (%)',
      '3dk Sonra (%)',
      '5dk Sonra (%)',
      '15dk Sonra (%)',
      'ATR 3m (%)',
      'RSI 3m',
      '15dk (%)',
      'Brüt ($)',
      'Komisyon ($)',
      'Slippage ($)',
      'Strateji',
      ...EXTRA_CSV_HEADER
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
        `"${(trade.radarTag || '').replace(/"/g, '""')}"`,
        formatCpPct(trade.cp1m),
        formatCpPct(trade.cp3m),
        formatCpPct(trade.cp5m),
        formatCpPct(trade.cp15m),
        trade.atr3m != null ? `"%${Number(trade.atr3m).toFixed(2)}"` : '"-"',
        trade.rsi3m != null ? Number(trade.rsi3m).toFixed(1) : '"-"',
        trade.chg15 != null ? `"%${Number(trade.chg15).toFixed(2)}"` : '"-"',
        trade.grossPnl != null ? `"${Number(trade.grossPnl).toFixed(2)}"` : '"-"',
        trade.feeUsd != null ? `"${Number(trade.feeUsd).toFixed(2)}"` : '"-"',
        trade.slipUsd != null ? `"${Number(trade.slipUsd).toFixed(2)}"` : '"-"',
        `"${trade.strategy || '-'}"`,
        ...extraTradeCsvCells(trade)
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
      `"${(trade.radarTag || '').replace(/"/g, '""')}"`,
      formatCpPct(trade.cp1m),
      formatCpPct(trade.cp3m),
      formatCpPct(trade.cp5m),
      formatCpPct(trade.cp15m),
      trade.atr3m != null ? `"%${Number(trade.atr3m).toFixed(2)}"` : '"-"',
      trade.rsi3m != null ? Number(trade.rsi3m).toFixed(1) : '"-"',
      trade.chg15 != null ? `"%${Number(trade.chg15).toFixed(2)}"` : '"-"',
      trade.grossPnl != null ? `"${Number(trade.grossPnl).toFixed(2)}"` : '"-"',
      trade.feeUsd != null ? `"${Number(trade.feeUsd).toFixed(2)}"` : '"-"',
      trade.slipUsd != null ? `"${Number(trade.slipUsd).toFixed(2)}"` : '"-"',
      `"${trade.strategy || '-'}"`,
      ...extraTradeCsvCells(trade)
    ].join(';') + '\n';
    fs.appendFileSync(CSV_FILE, row, 'utf8');
  } catch (err) {
    addLog(`CSV Hatası: ${err.message}`, 'ERROR');
  }
}

// BİNANCE RESMİ API & ISP/DPI/BULUT ENGELİNE KARŞI ÇOKLU AYNA SİSTEMİ
const BINANCE_FAPI_MIRRORS = [
  "https://fapi.binance.com",
  "https://www.binance.info"
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

// setTimeout(runHistoricalDeepScan, 3 * 60 * 1000); // 🛡️ Rate limit koruması: Binance IP banı önlendi
// setInterval(runHistoricalDeepScan, 4 * 60 * 60 * 1000);
// ==========================================


const BINANCE_SPOT_MIRRORS = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
  'https://api-gcp.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
  'https://api4.binance.com'
];

const symbolFeed = new Map();
let bookFeed = 'none';
let lastFetchWarn = 0;
let lastFeedError = '';
let fapiDownUntil = 0;
let isFapiProbing = false;

const COMPACT_BOOK_SYMBOLS = [
  'BTCUSDT','ETHUSDT','BNBUSDT','SOLUSDT','XRPUSDT','DOGEUSDT','ADAUSDT','AVAXUSDT',
  'LINKUSDT','SUIUSDT','NEARUSDT','TAOUSDT','WIFUSDT','PEPEUSDT','APTUSDT','FETUSDT',
  'ENAUSDT','SEIUSDT','TIAUSDT','INJUSDT','ARBUSDT','OPUSDT','FILUSDT','LTCUSDT',
  'BCHUSDT','DOTUSDT','UNIUSDT','AAVEUSDT','RENDERUSDT','JUPUSDT','PENDLEUSDT','WLDUSDT',
  'PYTHUSDT','ETHFIUSDT','QNTUSDT','ZECUSDT','GALAUSDT','STXUSDT','PEOPLEUSDT','TRXUSDT',
  'TONUSDT','ORDIUSDT','HBARUSDT','ICPUSDT','ATOMUSDT','ETCUSDT','IMXUSDT','SANDUSDT'
];
const fapiMirrorDownUntil = new Map();
const spotMirrorDownUntil = new Map();
const binanceCache = new Map();
const binanceInFlight = new Map();

function noteFeed(url, source) {
  const m = String(url).match(/symbol=([A-Z0-9]+)/);
  if (m) symbolFeed.set(m[1], source);
  else if (String(url).includes('ticker')) bookFeed = source;
}
function warnFetch(msg) {
  const now = Date.now();
  if (now - lastFetchWarn < 60000) return;
  lastFetchWarn = now;
  addLog(msg, 'WARN');
}

function getCachePolicy(relativePath) {
  if (relativePath.includes('exchangeInfo')) {
    return { ttlMs: 6 * 60 * 60 * 1000, staleMs: 24 * 60 * 60 * 1000 };
  }
  if (relativePath.includes('limit=1000') || relativePath.includes('limit=500')) {
    return { ttlMs: 10 * 60 * 1000, staleMs: 30 * 60 * 1000 }; // Geçmiş Replay mumları 10 dk önbellekte kalır (429 rate-limit engeli!)
  }
  if (relativePath.includes('ticker/24hr')) {
    return { ttlMs: 8000, staleMs: 300000 }; // 8 sn taze, 5 dakika stale toleransı
  }
  if (relativePath.includes('interval=1d')) {
    return { ttlMs: 30 * 60 * 1000, staleMs: 60 * 60 * 1000 };
  }
  if (relativePath.includes('interval=15m')) {
    return { ttlMs: 35000, staleMs: 120000 }; // 35 sn taze (15m mumlar için)
  }
  if (relativePath.includes('interval=3m')) {
    return { ttlMs: 5000, staleMs: 25000 }; // 5 sn taze (3m mumlar için)
  }
  if (relativePath.includes('klines')) {
    return { ttlMs: 5000, staleMs: 25000 };
  }
  if (relativePath.includes('ticker/price')) {
    return { ttlMs: 1000, staleMs: 10000 };
  }
  return { ttlMs: 2000, staleMs: 15000 };
}

function normalizeTickerList(data) {
  if (!Array.isArray(data)) return data;
  return data.map(t => {
    if (t.priceChangePercent !== undefined && t.priceChangePercent !== null && t.priceChangePercent !== '') return t;
    const open = parseFloat(t.openPrice) || 0;
    const last = parseFloat(t.lastPrice) || 0;
    const pct = open > 0 ? ((last - open) / open) * 100 : 0;
    return { ...t, priceChangePercent: pct.toFixed(4), quoteVolume: t.quoteVolume || '0' };
  });
}

async function fetchJson(targetUrl, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    if (res.status === 429 || res.status === 418) {
      let banMs = 60 * 1000;
      try {
        const txt = await res.text();
        const m = txt.match(/banned until (\d+)/);
        if (m) {
          const until = parseInt(m[1], 10);
          if (until > Date.now()) banMs = Math.min(until - Date.now() + 5000, 15 * 60 * 1000);
        }
      } catch (e) {}
      return { status: res.status, banMs, data: null };
    }
    if (!res.ok) return { status: res.status, data: null };
    const data = await res.json();
    if (data && data.code && data.msg) return { status: data.code, data: null };
    return { status: res.status, data };
  } catch (e) {
    return { status: e.name === 'AbortError' ? 'timeout' : 'fail', data: null };
  } finally {
    clearTimeout(timeoutId);
  }
}

function usableBook(data) {
  return Array.isArray(data) && data.length > 0;
}

async function fetchCompactBook() {
  const bases = BINANCE_SPOT_MIRRORS.slice(0, 2);
  for (const base of bases) {
    if ((spotMirrorDownUntil.get(base) || 0) > Date.now()) continue;
    let chunk = COMPACT_BOOK_SYMBOLS;
    for (let attempt = 0; attempt < 3 && chunk.length >= 8; attempt++) {
      const q = encodeURIComponent(JSON.stringify(chunk));
      const hit = await fetchJson(`${base}/api/v3/ticker/24hr?symbols=${q}`, 8000);
      if (hit.banMs) {
        spotMirrorDownUntil.set(base, Date.now() + hit.banMs);
        break;
      }
      if (usableBook(hit.data)) return normalizeTickerList(hit.data);
      if (hit.status === 400) {
        chunk = chunk.slice(0, Math.ceil(chunk.length / 2));
        continue;
      }
      break;
    }
  }
  return null;
}

async function fetchBinanceRaw(relativePath) {
  const errors = [];
  const isBook = relativePath.includes('ticker/24hr') && !relativePath.includes('symbol=');
  const hostName = (base) => base.replace('https://', '').split('.')[0];

  // 🛡️ DÜZELTME: Her fapi mirror kendi engel durumunu (fapiMirrorDownUntil) tutar!
  // fapi.binance.com ABD sunucusunda 451 verse bile break atılmaz; 2. mirror (www.binance.info) üzerinden tüm Futures koinleri eksiksiz alınır!
  const needProbeLock = fapiDownUntil > 0 && Date.now() >= fapiDownUntil;
  if (Date.now() >= fapiDownUntil && (!needProbeLock || !isFapiProbing)) {
    if (needProbeLock) isFapiProbing = true;
    try {
      let triedFapi = 0;
      let allFapiBlocked = true;
      for (const base of BINANCE_FAPI_MIRRORS) {
        if ((fapiMirrorDownUntil.get(base) || 0) > Date.now()) continue;
        triedFapi++;
        const reqTimeout = isBook ? 8000 : (relativePath.includes('limit=1000') || relativePath.includes('limit=500') || relativePath.includes('exchangeInfo') ? 12000 : 5500);
        const hit = await fetchJson(base + relativePath, reqTimeout);
        if (hit.banMs) {
          fapiMirrorDownUntil.set(base, Date.now() + hit.banMs);
          errors.push(`${hostName(base)} ${hit.status}`);
          continue;
        }
        if (hit.status === 451) {
          fapiMirrorDownUntil.set(base, Date.now() + 30 * 60 * 1000);
          errors.push(`${hostName(base)} 451`);
          continue;
        }
        allFapiBlocked = false;
        if (hit.data && (!isBook || usableBook(hit.data))) {
          fapiDownUntil = 0;
          noteFeed(relativePath, 'futures');
          lastFeedError = '';
          return isBook ? normalizeTickerList(hit.data) : hit.data;
        }
        errors.push(`${hostName(base)} ${hit.status}`);
      }
      // Yalnızca tüm Futures mirror'ları başarısız olursa kısa süre bekle; tekil sembol hatasında fapi'yi kapatma!
      if (isBook && Date.now() >= fapiDownUntil) {
        fapiDownUntil = Date.now() + (triedFapi === 0 || allFapiBlocked ? 5 * 60 * 1000 : 15 * 1000);
      }
    } finally {
      if (needProbeLock) isFapiProbing = false;
    }
  } else if (Date.now() < fapiDownUntil) {
    errors.push('fapi bekliyor');
  }

  const spotPath = relativePath.replace(/^\/fapi\/v1\//, '/api/v3/');
  const spotHosts = BINANCE_SPOT_MIRRORS.slice(0, isBook ? 3 : 2);
  for (const spotBase of spotHosts) {
    if ((spotMirrorDownUntil.get(spotBase) || 0) > Date.now()) continue;
    let path = spotPath;
    if (isBook && !path.includes('type=')) path += (path.includes('?') ? '&' : '?') + 'type=MINI';
    const hit = await fetchJson(spotBase + path, isBook ? 12000 : 5000);
    if (hit.banMs) {
      spotMirrorDownUntil.set(spotBase, Date.now() + hit.banMs);
      errors.push(`${hostName(spotBase)} ${hit.status}`);
      continue;
    }
    if (hit.status === 451) {
      spotMirrorDownUntil.set(spotBase, Date.now() + 30 * 60 * 1000);
      errors.push(`${hostName(spotBase)} 451`);
      continue;
    }
    if (hit.data && (!isBook || usableBook(hit.data))) {
      noteFeed(relativePath, 'spot');
      lastFeedError = '';
      return isBook ? normalizeTickerList(hit.data) : hit.data;
    }
    errors.push(`${hostName(spotBase)} ${hit.status}`);
  }

  if (isBook) {
    const compact = await fetchCompactBook();
    if (compact) {
      noteFeed(relativePath, 'spot');
      lastFeedError = '';
      return compact;
    }
    errors.push('kisa liste yok');
  }

  lastFeedError = errors.slice(0, 4).join(', ');
  return null;
}

async function fetchBinance(url) {
  let relativePath = url;
  if (url.startsWith("http")) {
    try {
      const parsed = new URL(url);
      relativePath = parsed.pathname + parsed.search;
    } catch (e) {
      relativePath = url.replace(/^https?:\/\/[^\/]+/, "");
    }
  }

  const now = Date.now();
  const policy = getCachePolicy(relativePath);
  const cached = binanceCache.get(relativePath);
  if (cached && (now - cached.ts) <= policy.ttlMs) {
    return cached.data;
  }

  if (binanceInFlight.has(relativePath)) {
    return binanceInFlight.get(relativePath);
  }

  const reqPromise = (async () => {
    try {
      const fresh = await fetchBinanceRaw(relativePath);
      if (fresh !== null && fresh !== undefined) {
        binanceCache.set(relativePath, { data: fresh, ts: Date.now() });
        if (binanceCache.size > 1500) {
          const cutoff = Date.now() - 120000;
          for (const [k, v] of binanceCache.entries()) {
            if (v.ts < cutoff) binanceCache.delete(k);
          }
        }
        return fresh;
      }
      // Anlık ağ/rate-limit kesintisinde taze önbellek (stale fallback) varsa taramayı durdurmadan devam et
      if (cached && (Date.now() - cached.ts) <= policy.staleMs) {
        return cached.data;
      }
      if (relativePath.includes('ticker/24hr')) {
        if (cached && cached.data) {
          return cached.data; // Kesinlikle taramayı durdurma, önbellekteki koin listesiyle devam et
        }
        warnFetch(`Binance fiyatı alınamadı (${lastFeedError || 'yanıt yok'}).`);
      }
      return null;
    } finally {
      binanceInFlight.delete(relativePath);
    }
  })();

  binanceInFlight.set(relativePath, reqPromise);
  return reqPromise;
}

// 1. RADAR (3S & 15DK ÇOKLU ZAMAN, ALICI BASKISI VE SİNYAL MOTORU)
let radarList = [];
let radarLeaderLong = new Set();
let radarLeaderShort = new Set();
let btcPriceHistory = [];
async function updateRadar() {
  if (isRadarRunning) return;
  isRadarRunning = true;
  try {
    await refreshExchangeInfoFilter();
    const tickers = await fetchBinance('/fapi/v1/ticker/24hr');
    if (!tickers || !Array.isArray(tickers)) return;

    const btcTicker = tickers.find(t => t.symbol === 'BTCUSDT');
    if (btcTicker) {
      const now = Date.now();
      const p = parseFloat(btcTicker.lastPrice);
      if (btcPriceHistory.length < 3) {
        try {
          const bk5 = await fetchBinance('/fapi/v1/klines?symbol=BTCUSDT&interval=5m&limit=4');
          if (Array.isArray(bk5) && bk5.length >= 3) {
            btcPriceHistory = bk5.map(k => ({ t: Number(k[0]) || (now - 300000), p: parseFloat(k[1]) || p }));
          }
        } catch (e) {}
      }
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

    const validAll = tickers.filter(t => {
      if (!isTradableCryptoSymbol(t.symbol)) return false;
      const p = parseFloat(t.lastPrice) || 0;
      const volM = (parseFloat(t.quoteVolume) || 0) / 1e6;
      return p >= 0.008 && volM >= 8.0;
    });

    // 🚀 HEM YÜKSEK İVMELİ (+%10-%50) FUTURES BREAKOUT KOİNLERİ HEM DE LİKİT DEVLERİ TARA
    const byMomentum = [...validAll]
      .filter(t => ((parseFloat(t.quoteVolume) || 0) / 1e6) >= 10.0 && Math.abs(parseFloat(t.priceChangePercent) || 0) <= 65)
      .sort((a, b) => Math.abs(parseFloat(b.priceChangePercent) || 0) - Math.abs(parseFloat(a.priceChangePercent) || 0))
      .slice(0, 80);
    const byVolume = [...validAll]
      .sort((a, b) => (parseFloat(b.quoteVolume) || 0) - (parseFloat(a.quoteVolume) || 0))
      .slice(0, 65);

    const seenRadarSyms = new Set();
    const valid = [];
    for (const item of [...byMomentum, ...byVolume]) {
      if (!seenRadarSyms.has(item.symbol)) {
        seenRadarSyms.add(item.symbol);
        valid.push(item);
      }
      if (valid.length >= 120) break;
    }

    const chunkSize = 15;
    const scanned = [];
    const freshRadarMap = {};
    for (let i = 0; i < Math.min(valid.length, 105); i += chunkSize) {
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
          const high15 = parseFloat(last15[2]);
          const low15 = parseFloat(last15[3]);
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
            open15m: open15,
            high15m: high15,
            low15m: low15,
            chg3h,
            chg15m,
            vol3hM: volUsdt / 1e6,
            vol15m: vol15,
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
      radarList = scanned.sort((a, b) => Math.abs(b.chg15m) - Math.abs(a.chg15m));
      const liquid = scanned.filter(x => (x.vol24hM || 0) >= 10);
      radarLeaderLong = new Set(
        liquid
          .filter(x => x.chg15m >= 0.65 && x.chg15m <= 6.5 && (x.taker15m || 50) >= 56 && (x.chg3h || 0) >= 0.5)
          .sort((a, b) => b.chg15m - a.chg15m)
          .slice(0, 10)
          .map(x => x.symbol)
      );
      radarLeaderShort = new Set(
        liquid
          .filter(x => x.chg15m <= -0.65 && x.chg15m >= -6.5 && (x.taker15m || 50) <= 44 && (x.chg3h || 0) <= -0.5)
          .sort((a, b) => a.chg15m - b.chg15m)
          .slice(0, 10)
          .map(x => x.symbol)
      );
    }
  } catch (err) {
  } finally {
    isRadarRunning = false;
  }
}

async function scanRadarBoard(tf) {
  await refreshExchangeInfoFilter();
  const tickers = await fetchBinance('/fapi/v1/ticker/24hr');
  if (!Array.isArray(tickers)) return [];
  const tickerMap = {};
  const validItems = [];
  for (const t of tickers) {
    if (!isTradableCryptoSymbol(t.symbol)) continue;
    const lastP = parseFloat(t.lastPrice) || 0;
    const vol24 = parseFloat(t.quoteVolume) || 0;
    if (lastP < 0.008 || vol24 < 5e6) continue;
    const chg24h = parseFloat(t.priceChangePercent) || 0;
    const vol24hM = vol24 / 1e6;
    tickerMap[t.symbol] = { chg24h, vol24hM };
    validItems.push({ symbol: t.symbol, chg24h, vol24hM });
  }
  const byMom = [...validItems].filter(x => x.vol24hM >= 10).sort((a, b) => Math.abs(b.chg24h) - Math.abs(a.chg24h)).slice(0, 45);
  const byVol = [...validItems].sort((a, b) => b.vol24hM - a.vol24hM).slice(0, 45);
  const picked = [];
  const seenP = new Set();
  for (const x of [...byMom, ...byVol]) {
    if (!seenP.has(x.symbol)) { seenP.add(x.symbol); picked.push(x.symbol); }
    if (picked.length >= 80) break;
  }
  const out = [];
  for (let i = 0; i < picked.length; i += 10) {
    const chunk = picked.slice(i, i + 10);
    const part = await Promise.all(chunk.map(async sym => {
      const klines = await fetchBinance(`/fapi/v1/klines?symbol=${sym}&interval=${tf}&limit=2`);
      if (!klines || !klines.length) return null;
      const k = klines[klines.length - 1];
      const openP = parseFloat(k[1]) || 0;
      const highP = parseFloat(k[2]) || 0;
      const lowP = parseFloat(k[3]) || 0;
      const closeP = parseFloat(k[4]) || 0;
      const vol = parseFloat(k[7]) || 0;
      const takerBuy = parseFloat(k[10]) || 0;
      const chg = openP > 0 ? ((closeP - openP) / openP) * 100 : 0;
      const taker = vol > 0 ? (takerBuy / vol) * 100 : 50;
      const info = tickerMap[sym] || {};
      const rCached = radarMap[sym] || {};
      const pump = tf === '1d' ? 15 : (tf === '4h' ? 8 : 5);
      let signal = '⚖️ NÖTR';
      if (chg >= pump) signal = '🚀 SÜPER ROKET';
      else if (chg >= pump / 2.5) signal = '🟢 GÜÇLÜ BOĞA';
      else if (chg <= -pump) signal = '🩸 ŞELALE';
      else if (chg <= -pump / 2.5) signal = '🔴 GÜÇLÜ AYI';
      return {
        symbol: sym,
        lastPrice: closeP,
        open15m: openP,
        high15m: highP,
        low15m: lowP,
        chg15m: chg,
        chg3h: Number.isFinite(Number(rCached.chg3h)) ? Number(rCached.chg3h) : 0,
        vol15m: vol,
        vol24hM: info.vol24hM || 0,
        chg24h: info.chg24h || 0,
        taker15m: taker,
        takerBuyRatio: taker,
        signal
      };
    }));
    part.forEach(row => { if (row) out.push(row); });
  }
  return out;
}

// ============================================================================
// 🐋 MARSCOIN V3 ORTAK 15DK BALİNA MOTORU (CANLI BOT + GEÇMİŞ REPLAY BİREBİR AYNI!)
// 10.4 Gün (156 işlem, 55 Saf Kripto Futures) Gerçek Portföy Testi: +$41.96 (+%42 ROI) | LONG +$31.92 | SHORT +$10.05
// ============================================================================
function evaluateWhaleSpike15m(k, idx) {
  if (!Array.isArray(k) || idx < 60 || idx >= k.length) return null;
  let ema20 = parseFloat(k[0][4]) || 0;
  let ema50 = ema20;
  const k20 = 2 / 21;
  const k50 = 2 / 51;
  for (let m = 1; m <= idx; m++) {
    const cm = parseFloat(k[m][4]) || ema20;
    ema20 = cm * k20 + ema20 * (1 - k20);
    ema50 = cm * k50 + ema50 * (1 - k50);
  }
  const c = parseFloat(k[idx][4]) || 0;
  const o = parseFloat(k[idx][1]) || 0;
  const h = parseFloat(k[idx][2]) || 0;
  const l = parseFloat(k[idx][3]) || 0;
  const v = parseFloat(k[idx][5]) || 0;
  const q = parseFloat(k[idx][7]) || 0;
  const tb = parseFloat(k[idx][10]) || 0;
  if (c <= 0 || o <= 0) return null;

  let trSum = 0;
  for (let m = idx - 14; m < idx; m++) {
    const hh = parseFloat(k[m][2]) || 0;
    const ll = parseFloat(k[m][3]) || 0;
    const pc = parseFloat(k[m - 1][4]) || 0;
    if (pc > 0) trSum += (Math.max(hh - ll, Math.abs(hh - pc), Math.abs(ll - pc)) / pc) * 100;
  }
  const atr15 = trSum / 14;

  let sumV = 0;
  for (let m = idx - 20; m < idx; m++) sumV += parseFloat(k[m][5]) || 0;
  const avgVol20 = sumV / 20;
  const volMult = avgVol20 > 0 ? v / avgVol20 : 1;

  const taker = q > 0 ? (tb / q) * 100 : 50;
  const move = ((c - o) / o) * 100;
  const open4h = parseFloat(k[idx - 16][1]) || o;
  const chg4h = open4h > 0 ? ((c - open4h) / open4h) * 100 : 0;
  const open1h = parseFloat(k[idx - 4][1]) || o;
  const chg1h = open1h > 0 ? ((c - open1h) / open1h) * 100 : 0;
  const open3h = parseFloat(k[idx - 12][1]) || o;
  const chg3h = open3h > 0 ? ((c - open3h) / open3h) * 100 : 0;

  let rg = 0, rl = 0;
  for (let m = idx - 14; m <= idx; m++) {
    const d = (parseFloat(k[m][4]) || 0) - (parseFloat(k[m - 1][4]) || 0);
    if (d > 0) rg += d; else rl -= d;
  }
  const rsi15 = rl === 0 ? 100 : 100 - (100 / (1 + (rg / rl)));

  const span = h - l;
  const upperWick = span > 0 ? (h - Math.max(c, o)) / span : 0;
  const lowerWick = span > 0 ? (Math.min(c, o) - l) / span : 0;

  const distEma20 = ema20 > 0 ? Math.abs((c - ema20) / ema20) * 100 : 0;
  const diag = { atr15, volMult, taker, move, chg1h, chg3h, chg4h, ema20, ema50, distEma20, rsi15, closePx: c, candleTs: Number(k[idx][0]) || 0 };

  if (atr15 < 1.05 || atr15 > 3.50) return { approved: false, why: 'ATR15', ...diag };
  if (volMult < 2.50) return { approved: false, why: 'VOL_LOW', ...diag };
  // 🌋 Wyckoff Hacim Tükenişi (Climax) + Anti-Chase Kalkanı (102 saf kripto 10.4g önyargısız testte H1+H2 kanıtlı):
  // - Vol > 5.5x: likidasyon/FOMO zirvesi (VELVET 5.78x, SKY 5.86x gibi)
  // - distEma20 > %4.5 veya |move| > 2.4x ATR: hareket bitmiş, EMA20'den aşırı kopmuş geç kovalama (-$36.7 / -$49.7)
  if (volMult > 5.50) return { approved: false, why: 'VOL_CLIMAX', ...diag };
  if (distEma20 > 4.50) return { approved: false, why: 'EMA_STRETCH', ...diag };

  const longOk =
    move >= atr15 * 0.90 &&
    move <= atr15 * 2.40 &&
    c > ema20 &&
    ema20 > ema50 &&
    taker >= 56.0 &&
    chg4h >= 2.0 &&
    chg4h <= 12.0 &&
    upperWick <= 0.45;

  const shortOk =
    move <= -atr15 * 0.90 &&
    move >= -atr15 * 2.40 &&
    c < ema20 &&
    ema20 < ema50 &&
    taker <= 44.0 &&
    chg4h <= -2.0 &&
    chg4h >= -12.0 &&
    lowerWick <= 0.45;

  if (longOk) {
    return {
      approved: true,
      side: 'LONG',
      score: (volMult * 15) + (Math.abs(move) * 10) + (taker - 50),
      ...diag
    };
  }
  if (shortOk) {
    return {
      approved: true,
      side: 'SHORT',
      score: (volMult * 15) + (Math.abs(move) * 10) + (50 - taker),
      ...diag
    };
  }
  return { approved: false, why: 'TREND_OR_TAKER', ...diag };
}

function simulateWhaleTrade15m(k, entryIdx, sig, riskUsd, forceSide = null) {
  const side = forceSide || sig.side;
  const isLong = side === 'LONG';
  const slPct = Number(Math.max(1.00, Math.min(2.80, sig.atr15 * 1.50)).toFixed(2));
  const entryPx = isLong ? sig.closePx * 1.0002 : sig.closePx * 0.9998;
  const maker = Number(CONFIG.makerRate) || 0.0002;
  const taker = Number(CONFIG.feeRate) || 0.0005;
  const nominal = riskUsd / ((slPct + 0.09) / 100);
  const lockSpot = (pct) => isLong ? entryPx * (1 + pct / 100) : entryPx * (1 - pct / 100);
  let stopPrice = isLong ? entryPx * (1 - slPct / 100) : entryPx * (1 + slPct / 100);
  let beLocked = false;
  let trailing = false;
  let mfe = 0;
  let mae = 0;

  const tighten = (pct) => {
    const ns = lockSpot(pct);
    if ((isLong && ns > stopPrice) || (!isLong && ns < stopPrice)) stopPrice = ns;
  };

  for (let b = 1; b <= 32 && (entryIdx + b) < k.length; b++) {
    const bar = k[entryIdx + b];
    const h = parseFloat(bar[2]) || entryPx;
    const l = parseFloat(bar[3]) || entryPx;
    const c = parseFloat(bar[4]) || entryPx;
    const favMove = isLong ? ((h - entryPx) / entryPx) * 100 : ((entryPx - l) / entryPx) * 100;
    const advMove = isLong ? ((l - entryPx) / entryPx) * 100 : ((entryPx - h) / entryPx) * 100;
    const closeMove = isLong ? ((c - entryPx) / entryPx) * 100 : ((entryPx - c) / entryPx) * 100;

    // Muhafazakâr kural: aynı 15dk mumda hem stop hem hedef görünürse ÖNCE STOP varsayılır!
    if (isLong ? (l <= stopPrice) : (h >= stopPrice)) {
      const fill = isLong ? stopPrice * (1 - 0.0002) : stopPrice * (1 + 0.0002);
      const fm = isLong ? ((fill - entryPx) / entryPx) * 100 : ((entryPx - fill) / entryPx) * 100;
      const grossPnl = nominal * (fm / 100);
      const feeUsd = nominal * (maker + taker);
      return {
        side, entryPx, exitPx: fill, slPct, nominal,
        entryTs: sig.candleTs + (15 * 60 * 1000),
        exitTs: Number(bar[0]) + (15 * 60 * 1000),
        durationMin: b * 15,
        mfe: Number(mfe.toFixed(2)),
        mae: Number(Math.max(mae, -advMove).toFixed(2)),
        grossPnl: Number(grossPnl.toFixed(2)),
        feeUsd: Number(feeUsd.toFixed(2)),
        netPnl: Number((grossPnl - feeUsd).toFixed(2)),
        reason: trailing ? '🔒 Runner İz Süren Kâr' : (beLocked ? '🛡️ Başabaş ($0 Risk)' : `🛑 Stop Loss (-%${slPct.toFixed(2)})`)
      };
    }

    mfe = Math.max(mfe, favMove);
    mae = Math.max(mae, -advMove);

    // Asimetrik kripto fiziği: LONG merdiven gibi tırmanır (3.5R / 0.85R trail), SHORT sert V-dönüşü yapar (2.5R / 0.50R trail)!
    const beMult = isLong ? 1.00 : 0.80;
    const trailStartMult = isLong ? 1.40 : 1.10;
    const trailGapMult = isLong ? 0.85 : 0.50;
    const moonMult = isLong ? 3.50 : 2.50;
    const tpGoal = slPct * moonMult;
    if (favMove >= tpGoal) {
      const grossPnl = nominal * (tpGoal / 100);
      const feeUsd = nominal * (maker + maker);
      return {
        side, entryPx, exitPx: lockSpot(tpGoal), slPct, nominal,
        entryTs: sig.candleTs + (15 * 60 * 1000),
        exitTs: Number(bar[0]) + (15 * 60 * 1000),
        durationMin: b * 15,
        mfe: Number(mfe.toFixed(2)),
        mae: Number(mae.toFixed(2)),
        grossPnl: Number(grossPnl.toFixed(2)),
        feeUsd: Number(feeUsd.toFixed(2)),
        netPnl: Number((grossPnl - feeUsd).toFixed(2)),
        reason: `🎯 ${moonMult.toFixed(1)}R Moonshot (+%${tpGoal.toFixed(2)})`
      };
    }

    if (mfe >= slPct * trailStartMult) {
      tighten(mfe - (slPct * trailGapMult));
      trailing = true;
      beLocked = true;
    } else if (!beLocked && mfe >= slPct * beMult && closeMove > 0.20) {
      tighten(0.15);
      beLocked = true;
    }

    if (b === 32 || (entryIdx + b) === k.length - 1) {
      const grossPnl = nominal * (closeMove / 100);
      const feeUsd = nominal * (maker + taker);
      return {
        side, entryPx, exitPx: c, slPct, nominal,
        entryTs: sig.candleTs + (15 * 60 * 1000),
        exitTs: Number(bar[0]) + (15 * 60 * 1000),
        durationMin: b * 15,
        mfe: Number(mfe.toFixed(2)),
        mae: Number(mae.toFixed(2)),
        grossPnl: Number(grossPnl.toFixed(2)),
        feeUsd: Number(feeUsd.toFixed(2)),
        netPnl: Number((grossPnl - feeUsd).toFixed(2)),
        reason: (entryIdx + b) === k.length - 1 ? '⏳ Açık (Son Mum)' : '⏱️ 8s Süre Doldu'
      };
    }
  }
  return null;
}

const replayCache = new Map();
let replayInFlight = null;

async function runHistoricalReplay(hours = 72, maxCoins = 45) {
  const hClamped = Math.max(12, Math.min(240, Math.round(Number(hours) || 72)));
  const cClamped = Math.max(15, Math.min(55, Math.round(Number(maxCoins) || 45)));
  const cacheKey = `${hClamped}:${cClamped}`;
  const cached = replayCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < 5 * 60 * 1000) return cached.result;
  if (replayInFlight) return replayInFlight;

  replayInFlight = (async () => {
    try {
      await refreshExchangeInfoFilter();
      const tickers = await fetchBinance('/fapi/v1/ticker/24hr');
      if (!Array.isArray(tickers)) return { ok: false, error: 'Binance Futures verisi alınamadı.' };

      const valid = tickers.filter(t => {
        if (!isTradableCryptoSymbol(t.symbol)) return false;
        const p = parseFloat(t.lastPrice) || 0;
        const volM = (parseFloat(t.quoteVolume) || 0) / 1e6;
        return p >= 0.008 && volM >= 10.0;
      });
      const byMom = [...valid].sort((a, b) => Math.abs(parseFloat(b.priceChangePercent) || 0) - Math.abs(parseFloat(a.priceChangePercent) || 0)).slice(0, 35);
      const byVol = [...valid].sort((a, b) => (parseFloat(b.quoteVolume) || 0) - (parseFloat(a.quoteVolume) || 0)).slice(0, 35);
      const picked = [];
      const seen = new Set();
      for (const x of [...byMom, ...byVol]) {
        if (!seen.has(x.symbol)) { seen.add(x.symbol); picked.push(x.symbol); }
        if (picked.length >= cClamped) break;
      }

      const barLimit = Math.min(1000, Math.ceil(hClamped * 4) + 65);
      const coinKlines = [];
      // 🛡️ Kibar 5'li tarama + rate-limit koruması (Futures koinlerinin Spot'a düşüp eksilmesini önler!)
      for (let i = 0; i < picked.length; i += 5) {
        const chunk = picked.slice(i, i + 5);
        const part = await Promise.all(chunk.map(async sym => {
          try {
            let k = await fetchBinance(`/fapi/v1/klines?symbol=${sym}&interval=15m&limit=${barLimit}`);
            if (!Array.isArray(k) || k.length < 75) {
              await new Promise(r => setTimeout(r, 400));
              k = await fetchBinance(`/fapi/v1/klines?symbol=${sym}&interval=15m&limit=${barLimit}`);
            }
            return (Array.isArray(k) && k.length >= 75) ? { symbol: sym, k } : null;
          } catch (e) { return null; }
        }));
        part.forEach(x => { if (x) coinKlines.push(x); });
        if (i + 5 < picked.length) await new Promise(r => setTimeout(r, 200));
      }

      const cutoffTs = Date.now() - (hClamped * 60 * 60 * 1000);
      const events = [];
      for (const cd of coinKlines) {
        const k = cd.k;
        for (let i = 60; i < k.length - 2; i++) {
          const ts = Number(k[i][0]) || 0;
          if (ts < cutoffTs) continue;
          const q = parseFloat(k[i][7]) || 0;
          const tb = parseFloat(k[i][10]) || 0;
          const takerFast = q > 0 ? (tb / q) * 100 : 50;
          if (takerFast > 44 && takerFast < 56) continue;
          const sig = evaluateWhaleSpike15m(k, i);
          if (sig && sig.approved) {
            events.push({ ...sig, symbol: cd.symbol, idx: i, k });
          }
        }
      }
      events.sort((a, b) => a.candleTs - b.candleTs || b.score - a.score);

      let bal = 100.0;
      let peak = 100.0;
      let maxDD = 0;
      const openSlots = [];
      const coinCd = {};
      const lossStreak = {}; // 🛡️ Canlı closeTrade ile birebir: 2 ardışık zarar → 4 saat soğuma
      const trades = [];
      let oppNetTotal = 0;
      let idSeq = 1;

      const settleSlot = (p) => {
        bal += p.netPnl;
        if (bal > peak) peak = bal;
        const dd = peak > 0 ? ((peak - bal) / peak) * 100 : 0;
        if (dd > maxDD) maxDD = dd;
        p.ref.balanceAfter = Number(bal.toFixed(2));
        if (p.netPnl <= -0.05) {
          lossStreak[p.symbol] = (lossStreak[p.symbol] || 0) + 1;
          const coolMin = lossStreak[p.symbol] >= 2 ? 240 : 30;
          coinCd[p.symbol] = Math.max(coinCd[p.symbol] || 0, p.exitTs + coolMin * 60 * 1000);
          if (lossStreak[p.symbol] >= 2) lossStreak[p.symbol] = 1; // canlıdaki gibi: soğuma sonrası 1 zarar daha → tekrar kalkan
        } else if (p.netPnl > 0.05) {
          lossStreak[p.symbol] = 0;
        }
      };

      for (const ev of events) {
        openSlots.sort((a, b) => a.exitTs - b.exitTs);
        for (let j = 0; j < openSlots.length; ) {
          if (openSlots[j].exitTs <= ev.candleTs) { settleSlot(openSlots[j]); openSlots.splice(j, 1); }
          else j++;
        }
        if (openSlots.length >= 3) continue;
        if (openSlots.some(p => p.symbol === ev.symbol)) continue;
        if (openSlots.filter(p => p.side === ev.side).length >= 2) continue;
        if ((coinCd[ev.symbol] || 0) > ev.candleTs) continue;

        const riskUsd = Math.max(1.50, Math.min(5.00, bal * 0.025));
        const res = simulateWhaleTrade15m(ev.k, ev.idx, ev, riskUsd);
        if (!res) continue;

        const oppSide = ev.side === 'LONG' ? 'SHORT' : 'LONG';
        const oppRes = simulateWhaleTrade15m(ev.k, ev.idx, ev, riskUsd, oppSide);
        if (oppRes) oppNetTotal += oppRes.netPnl;

        const rec = {
          id: idSeq++,
          entryTime: trDateTime(res.entryTs),
          exitTime: trDateTime(res.exitTs),
          entryTs: res.entryTs,
          exitTs: res.exitTs,
          symbol: ev.symbol,
          side: ev.side,
          entryPrice: Number(res.entryPx.toFixed(6)),
          exitPrice: Number(res.exitPx.toFixed(6)),
          slPct: res.slPct,
          volMult: Number(ev.volMult.toFixed(2)),
          taker: Number((ev.side === 'LONG' ? ev.taker : (100 - ev.taker)).toFixed(1)),
          chg4h: Number(ev.chg4h.toFixed(2)),
          atr15: Number(ev.atr15.toFixed(2)),
          mfe: res.mfe,
          mae: res.mae,
          durationMin: res.durationMin,
          reason: res.reason,
          grossPnl: res.grossPnl,
          feeUsd: res.feeUsd,
          netPnl: res.netPnl,
          oppPnl: oppRes ? oppRes.netPnl : 0,
          balanceAfter: Number(bal.toFixed(2))
        };
        openSlots.push({ symbol: ev.symbol, side: ev.side, exitTs: res.exitTs, netPnl: res.netPnl, ref: rec });
        coinCd[ev.symbol] = Math.max(coinCd[ev.symbol] || 0, res.exitTs + (30 * 60 * 1000));
        trades.push(rec);
      }
      openSlots.sort((a, b) => a.exitTs - b.exitTs);
      for (const p of openSlots) settleSlot(p);

      const sum = (arr, fn) => arr.reduce((a, x) => a + fn(x), 0);
      const wins = trades.filter(x => x.netPnl > 0.05);
      const losses = trades.filter(x => x.netPnl < -0.05);
      const longs = trades.filter(x => x.side === 'LONG');
      const shorts = trades.filter(x => x.side === 'SHORT');
      const grossWins = sum(wins, x => x.netPnl);
      const grossLosses = Math.abs(sum(losses, x => x.netPnl));
      const result = {
        ok: true,
        generatedAt: trDateTime(),
        summary: {
          hours: hClamped,
          coinsScanned: coinKlines.length,
          initialBalance: 100.0,
          finalBalance: Number(bal.toFixed(2)),
          netPnl: Number((bal - 100.0).toFixed(2)),
          roiPct: Number((bal - 100.0).toFixed(1)),
          peakBalance: Number(peak.toFixed(2)),
          maxDrawdownPct: Number(maxDD.toFixed(1)),
          totalTrades: trades.length,
          wins: wins.length,
          losses: losses.length,
          winRate: trades.length ? Number(((wins.length / trades.length) * 100).toFixed(1)) : 0,
          profitFactor: grossLosses > 0 ? Number((grossWins / grossLosses).toFixed(2)) : (grossWins > 0 ? 99 : 0),
          totalGross: Number(sum(trades, x => x.grossPnl).toFixed(2)),
          totalFees: Number(sum(trades, x => x.feeUsd).toFixed(2)),
          longCount: longs.length,
          longNet: Number(sum(longs, x => x.netPnl).toFixed(2)),
          longWr: longs.length ? Number(((longs.filter(x => x.netPnl > 0.05).length / longs.length) * 100).toFixed(1)) : 0,
          shortCount: shorts.length,
          shortNet: Number(sum(shorts, x => x.netPnl).toFixed(2)),
          shortWr: shorts.length ? Number(((shorts.filter(x => x.netPnl > 0.05).length / shorts.length) * 100).toFixed(1)) : 0,
          oppositeNet: Number(oppNetTotal.toFixed(2))
        },
        trades: trades.slice().reverse()
      };
      if (coinKlines.length >= Math.floor(picked.length * 0.65)) {
        replayCache.set(cacheKey, { ts: Date.now(), result });
      }
      return result;
    } finally {
      replayInFlight = null;
    }
  })();

  return replayInFlight;
}

// 2. CANLI TARAMA (350+ KOİN BALİNA & MOONSHOT AVCISI)
let lastScanHeartbeat = 0;
async function scanLoop() {
  if (isScanRunning || !isBotActive) return;
  isScanRunning = true;
  try {
    applyCircuitBreaker();
    if (activePositions.length >= CONFIG.maxSlots) {
      checkSlotRotation();
      return;
    }

    const maxDay = Number(CONFIG.maxTradesPerDay) || 0;
    if (maxDay > 0 && countTradesToday() >= maxDay) {
      if (Date.now() - lastScanHeartbeat > 120000) {
        lastScanHeartbeat = Date.now();
        addLog(`⏸️ Günlük limit (${maxDay} işlem) doldu.`, 'INFO');
      }
      return;
    }
    // 🛑 ACİL DURUM SERMAYE TABANI (HARD CIRCUIT BREAKER)
    if (todayNetPnl() <= -15) {
      if (Date.now() - lastScanHeartbeat > 120000) {
        lastScanHeartbeat = Date.now();
        addLog('⏸️ Günlük zarar limiti (-$15). Yeni işlem yok.', 'RISK');
      }
      return;
    }

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
    const minEntryMargin = 6.0;
    if (freeMargin < minEntryMargin || balance < minEntryMargin) {
      if (Date.now() - lastScanHeartbeat > 60000) {
        addLog(`⚠️ Yetersiz Serbest Teminat: Kasa $${balance.toFixed(2)} (Serbest: $${freeMargin.toFixed(2)}) < $${minEntryMargin.toFixed(2)}. Yeni işlem açılmıyor.`, 'WARN');
      }
      return;
    }

    const tickers = await fetchBinance("https://fapi.binance.com/fapi/v1/ticker/24hr");
    if (!tickers || !Array.isArray(tickers)) {
      if (Date.now() - lastScanHeartbeat > 60000) {
        lastScanHeartbeat = Date.now();
        addLog(`Fiyat listesi boş (${lastFeedError || 'yanıt yok'}). Yeni işlem açılmıyor.`, 'WARN');
      }
      return;
    }

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

    const validTickers = tickers.filter(t => {
      if (!isTradableCryptoSymbol(t.symbol)) return false;
      const p = parseFloat(t.lastPrice);
      return p >= 0.008;
    });

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

      // 🐋 15DK BALİNA ÖNCELİĞİ: Güçlü 15dk ivme + baskın Taker olan koinler en üste çıkar!
      const rInfo = radarMap[sym];
      let radarBoost = 0;
      if (rInfo) {
        if (rInfo.signal && rInfo.signal.includes("BALİNA")) radarBoost += 65;
        else if (rInfo.signal && (rInfo.signal.includes("ROKET") || rInfo.signal.includes("BOĞA") || rInfo.signal.includes("SIÇRAMA") || rInfo.signal.includes("AYI") || rInfo.signal.includes("ŞELALE"))) radarBoost += 35;
        const c15 = Number(rInfo.chg15m) || 0;
        const t15 = Number(rInfo.taker15m) || 50;
        if (c15 >= 0.70 && c15 <= 7.50 && t15 >= 55) radarBoost += 70;
        if (c15 <= -0.70 && c15 >= -7.50 && t15 <= 45) radarBoost += 70;
        const buyTaker = rInfo.takerBuyRatio || 50;
        const sellTaker = 100 - buyTaker;
        if (buyTaker >= 54.0 || sellTaker >= 54.0 || t15 >= 56.0 || (100 - t15) >= 56.0) radarBoost += 20;
      }

      const cappedDailyChg = Math.min(Math.abs(rawChg), 45.0);
      const hotScore = (Math.abs(rollMovePct) * 25) + radarBoost + (cappedDailyChg * 1.5) + Math.min(volM * 0.15, 20) + (isVip ? 15 : 0);

      return {
        ...t,
        volM,
        chg: rawChg,
        rollMovePct,
        hotScore,
        isVip
      };
    })
    // 🚀 TÜM LİKİT SAF KRİPTO FUTURES'LAR (≥$10M, ~105-120 koin) TARANIR — radarMap kör noktası kaldırıldı!
    // Böylece uyuyup yeni uyanan BARDUSDT (+$8.88) gibi Moonshot'lar 15dk kapanış anında kaçmaz!
    .filter(t => t.volM >= 10 && t.chg <= 80 && t.chg >= -50)
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, Math.max(120, Number(DYNAMIC.candidateSlice) || 120));

    const secIn15mNow = Math.floor((now / 1000) % 900);
    const expectedClosedTs = (Math.floor(now / 900000) * 900000) - 900000;

    if (now - lastScanHeartbeat > 60000 && topCandidates.length > 0) {
      lastScanHeartbeat = now;
      const windowLbl = (secIn15mNow >= 4 && secIn15mNow <= 180)
        ? '⚡ 15dk Kapanış Taraması AÇIK'
        : `⏳ Sonraki 15dk mum: ${Math.ceil((900 - secIn15mNow) / 60)} dk`;
      addLog(`🐋 [15dk Balina Tarayıcı]: ${validTickers.length} Saf Kripto (${topCandidates.length} Likit Aday ≥$10M) | Lider: ${topCandidates[0].symbol} (24s: %${topCandidates[0].chg.toFixed(1)}, Puan: ${topCandidates[0].hotScore.toFixed(0)}) | ${windowLbl} | Slot: ${activePositions.length}/${CONFIG.maxSlots}`);
    }

    if (!global.whaleEvaluatedCandles) global.whaleEvaluatedCandles = new Map();

    // 🛡️ API AĞIRLIK KORUMASI & REPLAY 1-E-1 EŞİTLEME:
    // Yalnızca 15dk mum kapandıktan hemen sonra (4sn..180sn) tara ve her koini o kapanış için YALNIZCA 1 KEZ değerlendir!
    // (Kapanmamış LATE_15M mumlara erken atlama yok; ~110 koin ~3 saniyede taranır, kalan 14.5 dk 0 kline ağırlığı!)
    if (secIn15mNow < 4 || secIn15mNow > 180) {
      return;
    }

    // 10'lu paralel 15dk kline taraması (~110 koin = ~3 sn, Geçmiş Replay Backtest ile 1-e-1 aynı motor!)
    const chunkSize = 10;
    const scanEntryCandidates = [];

    for (let ci = 0; ci < topCandidates.length; ci += chunkSize) {
      if (activePositions.length >= CONFIG.maxSlots) break;
      const chunk = topCandidates.slice(ci, ci + chunkSize);

      const chunkData = await Promise.all(chunk.map(async item => {
        const sym = item.symbol;
        if (global.whaleEvaluatedCandles.get(sym) === expectedClosedTs) return null;
        if (activeSyms.has(sym)) return null;
        if (activePositions.some(x => x.symbol === sym)) return null;
        if (coinCooldowns[sym] && coinCooldowns[sym] > Date.now()) return null;
        const lastP = parseFloat(item.lastPrice);
        if (lastP < 0.008) return null;
        const k15m = await fetchBinance(`/fapi/v1/klines?symbol=${sym}&interval=15m&limit=80`);
        return { sym, lastP, k15m, chg: parseFloat(item.priceChangePercent) || 0, isVip: item.isVip, volM: item.volM };
      }));

      for (const data of chunkData) {
        if (!data || !data.k15m || data.k15m.length < 65) continue;
        if (activePositions.length >= CONFIG.maxSlots) break;

        const { sym, lastP, k15m, chg } = data;
        if (activePositions.some(x => x.symbol === sym) || activeSyms.has(sym) || (coinCooldowns[sym] && coinCooldowns[sym] > Date.now())) continue;
        if (coinLossCount[sym] >= 2) {
          if (coinCooldowns[sym] && coinCooldowns[sym] > Date.now()) continue;
          coinLossCount[sym] = 1;
        }

        const rInfo = radarMap[sym] || {};
        const lastIdx = k15m.length - 1;
        const closedIdx = lastIdx - 1;
        const curP = parseFloat(k15m[lastIdx][4]) || lastP;

        // 🕐 KESİN KAPALI 15DK MUM ONAYI (Replay ile %100 aynı mum!)
        const targetCandleTs = Number(k15m[closedIdx][0]) || 0;
        if (targetCandleTs !== expectedClosedTs) continue; // Binance yeni mumu henüz açmadı; 5sn sonraki turda tekrar dene
        if (global.whaleEvaluatedCandles.get(sym) === targetCandleTs) continue;
        global.whaleEvaluatedCandles.set(sym, targetCandleTs);

        const sig = evaluateWhaleSpike15m(k15m, closedIdx);
        if (!sig) continue;

        const shadow = (stage, extra = {}) => recordShadowSignal({
          symbol: sym, side: sig.side || (sig.move >= 0 ? 'LONG' : 'SHORT'), stage, price: curP,
          chg15: Number((sig.move || 0).toFixed(2)),
          chg3h: Number((sig.chg3h || 0).toFixed(2)),
          chg24h: Number(chg.toFixed(2)),
          rangePos: 50,
          taker: Number((sig.taker || 50).toFixed(1)),
          cur3m: Number((sig.move || 0).toFixed(2)),
          prev3m: Number((sig.chg1h || 0).toFixed(2)),
          atr3m: Number((sig.atr15 || 0).toFixed(2)),
          signal: rInfo.signal || '⚖️ NÖTR', ...extra
        });

        if (!sig.approved) {
          if (sig.volMult >= 1.8) shadow(`WHALE_${sig.why}`, { volMult: Number(sig.volMult.toFixed(2)) });
          continue;
        }

        // Fiyat kapalı mumdan çok uzaklaştıysa (%1.10+) kovalama (hızlı breakout'ları boğmadan runaway kovalamayı önler)
        const driftPct = sig.closePx > 0 ? Math.abs((curP - sig.closePx) / sig.closePx) * 100 : 0;
        if (driftPct > 1.10) {
          shadow('DRIFT_SKIP', { driftPct: Number(driftPct.toFixed(2)) });
          continue;
        }
        // Canlı fiyat hâlâ EMA20'nin doğru tarafında olmalı
        if ((sig.side === 'LONG' && curP <= sig.ema20) || (sig.side === 'SHORT' && curP >= sig.ema20)) {
          shadow('EMA_LOST');
          continue;
        }

        const side = sig.side;
        const maxSameSide = 2;
        if (activePositions.filter(p => p.side === side).length + scanEntryCandidates.filter(c => c.side === side).length >= maxSameSide) continue;

        let judgeClearance = null;
        try {
          judgeClearance = evaluatePreTradeClearance(sym, side, {
            takerBuyRatio: sig.taker,
            chg15m: sig.move,
            chg3h: sig.chg3h,
            chg24h: chg
          });
        } catch (e) {}

        if (!judgeClearance || judgeClearance.approved !== true) {
          coinCooldowns[sym] = now + (2 * 60 * 1000);
          addLog(`🛡️ [YARGIÇ VETO]: ${sym} ${side} engellendi — ${(judgeClearance && judgeClearance.reason) || 'yargıç cevap vermedi'}`, 'WARN');
          shadow('JUDGE_VETO');
          continue;
        }

        if (activePositions.length >= CONFIG.maxSlots) continue;

        // 🛡️ 15DK ATR STOP (%1.00 - %2.80) + SABİT %2.5 (~$2.50) RİSK ÖLÇEKLEMESİ:
        const tradeSlPct = Number(Math.max(1.00, Math.min(2.80, sig.atr15 * 1.50)).toFixed(2));
        const baseRiskUsd = Number(CONFIG.riskPerTradeUsd) || 2.50;
        const equityRiskUsd = Math.max(1.50, Math.min(5.00, Number((balance * 0.025).toFixed(2))));
        const targetRiskUsd = circuitOn ? Math.min(1.50, equityRiskUsd) : Math.min(baseRiskUsd * 2.0, Math.max(1.50, equityRiskUsd));
        const effectiveStopCostPct = tradeSlPct + 0.09;
        const targetNominal = targetRiskUsd / (effectiveStopCostPct / 100);
        const levNow = Math.max(5, Number(CONFIG.leverage) || 10);
        const maxAllowedMargin = Math.min(35.0, Math.max(15.0, balance * 0.34));
        let tradeMargin = Number(Math.max(6.0, Math.min(maxAllowedMargin, targetNominal / levNow)).toFixed(2));

        const queuedMargin = scanEntryCandidates.reduce((acc, c) => acc + (Number(c.tradeMargin) || 0), 0);
        const curUsedMargin = activePositions.reduce((acc, p) => acc + (p.margin || 0), 0) + queuedMargin;
        const curFreeMargin = Math.max(0, balance - curUsedMargin);
        if (tradeMargin > curFreeMargin) tradeMargin = Number(curFreeMargin.toFixed(2));
        if (tradeMargin < 6.0) continue;

        let fillPx = side === "LONG" ? curP * 1.0002 : curP * 0.9998;
        let spreadBps = null;
        try {
          const bk = await fetchBinance(`/fapi/v1/ticker/bookTicker?symbol=${sym}`);
          const ask = bk && parseFloat(bk.askPrice);
          const bid = bk && parseFloat(bk.bidPrice);
          if (ask > 0 && bid > 0) {
            fillPx = side === "LONG" ? ask : bid;
            const mid = (ask + bid) / 2;
            if (mid > 0) spreadBps = Number(((ask - bid) / mid * 10000).toFixed(2));
          }
        } catch (e) {}
        // 15dk swing hedefleri (%4.5-%9.8) için 1-tick ($0.08-$0.11 koin = 9-12 bps) spread yüzünden PONS/BARD gibi Moonshot'ları yasaklama!
        if (spreadBps !== null && spreadBps > 22.0) {
          shadow('HIGH_SPREAD', { spreadBps });
          continue;
        }

        const stopPrice = side === "LONG"
          ? fillPx * (1 - tradeSlPct / 100)
          : fillPx * (1 + tradeSlPct / 100);

        const isLongSide = side === 'LONG';
        const tradeBePct = Number((tradeSlPct * (isLongSide ? 1.00 : 0.80)).toFixed(2));
        const tradeTp1Pct = Number((tradeSlPct * (isLongSide ? 1.40 : 1.10)).toFixed(2));
        const tradeTp2Pct = Number((tradeSlPct * (isLongSide ? 2.25 : 1.80)).toFixed(2));
        const tradeMoonPct = Number((tradeSlPct * (isLongSide ? 3.50 : 2.50)).toFixed(2));

        const dirEmoji = side === 'LONG' ? '🐋🚀 BALİNA LONG' : '🐋🩸 BALİNA SHORT';
        const flowText = side === 'LONG' ? `Alıcı %${sig.taker.toFixed(0)}` : `Satıcı %${(100 - sig.taker).toFixed(0)}`;
        const radarTag = `[${dirEmoji} | 15dk ${sig.move >= 0 ? '+' : ''}%${sig.move.toFixed(2)} | Hacim ${sig.volMult.toFixed(1)}x | 4s ${sig.chg4h >= 0 ? '+' : ''}%${sig.chg4h.toFixed(1)} | ${flowText}] [SL: %${tradeSlPct.toFixed(2)} | ATR15m: %${sig.atr15.toFixed(2)} | Risk: ~$${targetRiskUsd.toFixed(2)}]`;

        const isRadarLeader = (side === 'LONG' && radarLeaderLong.has(sym)) || (side === 'SHORT' && radarLeaderShort.has(sym));
        const entryScore = sig.score + (isRadarLeader ? 20 : 0) + Math.min(data.volM || 0, 100) * 0.15;

        const position = {
          id: Date.now() + Math.random().toString(36).substring(2, 6),
          symbol: sym,
          side: side,
          entryPrice: fillPx,
          currentPrice: curP,
          entryTime: Date.now(),
          stopPrice: stopPrice,
          beLocked: false,
          tier1Locked: false,
          tp1Taken: false,
          tp2Taken: false,
          midPartialTaken: false,
          tp1Pnl: 0,
          tp2Pnl: 0,
          tp1Gross: 0,
          tp1Fee: 0,
          tp2Gross: 0,
          tp2Fee: 0,
          mfe: 0.0,
          mae: 0.0,
          pnl: 0.0,
          roi: 0.0,
          cp1m: null,
          cp3m: null,
          cp5m: null,
          cp15m: null,
          entryRsi: Number(sig.rsi15.toFixed(1)),
          chg15: Number(sig.move.toFixed(2)),
          chg1h: Number(sig.chg1h.toFixed(2)),
          vol24M: Number((data.volM || 0).toFixed(1)),
          pos1h: 50,
          breakVol: Number(sig.volMult.toFixed(2)),
          trigger3m: Number(sig.move.toFixed(2)),
          spreadBps,
          strategy: 'WHALE_15M',
          margin: tradeMargin,
          initialMargin: tradeMargin,
          leverage: levNow,
          slPct: tradeSlPct,
          volK: 1.0,
          atr3mPct: Number(sig.atr15.toFixed(2)),
          bePct: tradeBePct,
          tp1Pct: tradeTp1Pct,
          tp2Pct: tradeTp2Pct,
          moonPct: tradeMoonPct,
          convictionTier: 'WHALE_15M',
          convictionScore: 95,
          convictionLabel: side === 'LONG' ? '🐋 BALİNA ROKET 15M' : '🐋 BALİNA ŞELALE 15M',
          radarTag: radarTag,
          chg3h: Number(sig.chg3h.toFixed(2)),
          vol3hM: Number((rInfo.vol3hM || 0).toFixed(1)),
          chg24h: Number(chg.toFixed(2)),
          range3h: rInfo.range3h || "",
          takerBuyRatio: Number(sig.taker.toFixed(1)),
          signal: rInfo.signal || (side === "LONG" ? "🐋🚀 BALİNA BOĞA" : "🐋🩸 BALİNA AYI"),
          btc5mEntry: btc5mNumeric,
          btc15mEntry: btc15mNumeric
        };

        scanEntryCandidates.push({
          entryScore,
          position,
          sym,
          side,
          curP: fillPx,
          radarTag,
          tradeMargin,
          stopPrice,
          tradeSlPct,
          tradeTp1Pct,
          tradeTp2Pct,
          tradeMoonPct,
          volK: 1.0,
          candleTs: targetCandleTs,
          markTaken: () => {
            global.whaleEvaluatedCandles.set(sym, targetCandleTs);
            shadow('TAKEN', { slPct: tradeSlPct, volMult: Number(sig.volMult.toFixed(2)) });
          }
        });
      }
    }

    if (scanEntryCandidates.length > 0 && activePositions.length < CONFIG.maxSlots) {
      scanEntryCandidates.sort((a, b) => b.entryScore - a.entryScore);
      const taken = new Set(activePositions.map((p) => p.symbol));
      const sideCounts = {
        LONG: activePositions.filter(p => p.side === 'LONG').length,
        SHORT: activePositions.filter(p => p.side === 'SHORT').length
      };
      const maxSameSide = 2;
      const room = CONFIG.maxSlots - activePositions.length;
      let opened = 0;
      let bookedMargin = activePositions.reduce((acc, p) => acc + (p.margin || 0), 0);
      for (const pick of scanEntryCandidates) {
        if (opened >= room || taken.has(pick.sym) || (sideCounts[pick.side] || 0) >= maxSameSide) continue;
        if (bookedMargin + pick.tradeMargin > balance) continue;
        taken.add(pick.sym);
        sideCounts[pick.side] = (sideCounts[pick.side] || 0) + 1;
        bookedMargin += pick.tradeMargin;
        activePositions.push(pick.position);
        activeSyms.add(pick.sym);
        lastTradeOpenTime = Date.now();
        persistState();
        pick.markTaken();
        opened++;
        randomOpen.push({
          symbol: pick.sym,
          side: pick.side === 'LONG' ? 'SHORT' : 'LONG',
          entryPrice: pick.position.entryPrice,
          entryTime: pick.position.entryTime,
          slPct: pick.tradeSlPct,
          linkId: pick.position.id,
          stopPrice: pick.side === 'LONG'
            ? pick.position.entryPrice * (1 + pick.tradeSlPct / 100)
            : pick.position.entryPrice * (1 - pick.tradeSlPct / 100),
          tpPct: pick.tradeMoonPct,
          margin: pick.tradeMargin,
          leverage: pick.position.leverage,
          mfe: 0
        });
        if (randomOpen.length > 20) randomOpen.shift();
        addLog(
          `🐋 POZİSYON AÇILDI: [${pick.side}] ${pick.sym} @ $${pick.curP.toFixed(4)} | ${pick.radarTag} | Teminat: $${pick.tradeMargin.toFixed(1)} (${pick.position.leverage}x) | SL: -%${pick.tradeSlPct.toFixed(2)} | BE: +%${pick.tradeSlPct.toFixed(2)} | Trail: +%${pick.tradeTp1Pct.toFixed(2)} | Moon(3.5R): +%${pick.tradeMoonPct.toFixed(2)}`,
          'TRADE'
        );
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
  return;
}

// 3. LAZER RİSK & KÂR KİLİTLEME (FAST RISK LOOP)
async function fastRiskLoop() {
  if (isRiskRunning || (activePositions.length === 0 && randomOpen.length === 0)) return;
  isRiskRunning = true;
  try {
    const symbols = [...new Set([
      ...activePositions.map(p => p.symbol),
      ...randomOpen.map(s => s.symbol)
    ])];
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
      const durMin = (now - pos.entryTime) / 60000;

      // 📊 SİNYAL SONRASI 1, 3, 5 ve 15. DAKİKA PERFORMANS TELEMETRİSİ
      if (durMin >= 1 && (pos.cp1m === null || pos.cp1m === undefined)) { pos.cp1m = Number(move.toFixed(2)); stateChanged = true; }
      if (durMin >= 3 && (pos.cp3m === null || pos.cp3m === undefined)) { pos.cp3m = Number(move.toFixed(2)); stateChanged = true; }
      if (durMin >= 5 && (pos.cp5m === null || pos.cp5m === undefined)) { pos.cp5m = Number(move.toFixed(2)); stateChanged = true; }
      if (durMin >= 15 && (pos.cp15m === null || pos.cp15m === undefined)) { pos.cp15m = Number(move.toFixed(2)); stateChanged = true; }

      const nominalSize = pos.margin * pos.leverage;
      const feeCost = nominalSize * ((Number(CONFIG.makerRate) || 0.0002) + CONFIG.feeRate);
      pos.feeUsd = feeCost;
      pos.slipUsd = 0;
      pos.grossPnl = nominalSize * (move / 100);
      pos.pnl = pos.grossPnl - feeCost;
      pos.roi = (pos.pnl / pos.margin) * 100;

      let exitReason = null;

      // 🐋 MARSCOIN V3 — ASİMETRİK 15DK BALİNA RUNNER ÇIKIŞ MOTORU (Replay Backtest ile 1-e-1 Aynı!)
      // LONG : 1.00R BE -> 1.40R+ Geniş Trail (0.85R) -> 3.50R Moonshot (ralli basamaklarını taşır)
      // SHORT: 0.80R BE -> 1.10R+ Sıkı Trail  (0.50R) -> 2.50R Moonshot (V-dönüşü öncesi kârı kilitler)
      const slBase = Math.max(0.75, Number(pos.slPct) || Number(CONFIG.slPct) || 1.50);
      const lockSpot = (pct) => isLong ? pos.entryPrice * (1 + pct / 100) : pos.entryPrice * (1 - pct / 100);
      const tightenStop = (pct) => {
        const nextStop = lockSpot(pct);
        if ((isLong && nextStop > pos.stopPrice) || (!isLong && nextStop < pos.stopPrice)) {
          pos.stopPrice = nextStop;
          stateChanged = true;
          return true;
        }
        return false;
      };

      const beMult = isLong ? 1.00 : 0.80;
      const trailStartMult = isLong ? 1.40 : 1.10;
      const trailGapMult = isLong ? 0.85 : 0.50;
      const moonMult = isLong ? 3.50 : 2.50;

      const beGoal = slBase * beMult;
      const trailStart = slBase * trailStartMult;
      const trailGap = slBase * trailGapMult;
      const moonGoal = slBase * moonMult;
      const initMargin = pos.initialMargin || pos.margin || 20;
      const makerRate = Number(CONFIG.makerRate) || 0.0002;

      // Kademe 1: BE (LONG 1.0R / SHORT 0.8R) -> Stop +%0.15'e çekilir ($0 Risk!)
      if (!pos.beLocked && mfe >= beGoal && move > 0.20) {
        tightenStop(0.15);
        pos.beLocked = true;
        stateChanged = true;
        addLog(`🛡️ [${beMult.toFixed(1)}R BAŞABAŞ]: ${pos.symbol} (${pos.side}) +%${mfe.toFixed(2)} gördü ➔ Stop +%0.15 kâra çekildi ($0 Risk)!`, 'INFO');
      }

      // Kademe 2: Runner İz Süren (LONG 1.4R-0.85R / SHORT 1.1R-0.50R)
      if (mfe >= trailStart) {
        const trailPct = mfe - trailGap;
        const moved = tightenStop(trailPct);
        if (!pos.tp1Taken) {
          pos.tp1Taken = true;
          pos.beLocked = true;
          stateChanged = true;
          addLog(`🔒 [RUNNER İZ SÜREN AKTİF]: ${pos.symbol} (${pos.side}) +%${mfe.toFixed(2)} gördü ➔ Stop +%${trailPct.toFixed(2)}'ye kilitlendi, hedef ${moonMult.toFixed(1)}R (+%${moonGoal.toFixed(2)})!`, 'WIN');
        } else if (moved) {
          stateChanged = true;
        }
      }

      // ========================================================
      // 🛑 1. STOP LOSS VEYA KİLİTLİ STOP KONTROLÜ (EN YÜKSEK ÖNCELİK)
      // ========================================================
      const curNominal = pos.margin * pos.leverage;
      const curFeeCost = curNominal * (makerRate + CONFIG.feeRate);
      const isStopHit = (isLong && curP <= pos.stopPrice) || (!isLong && curP >= pos.stopPrice);
      if (isStopHit) {
        const fill = isLong ? pos.stopPrice * (1 - 0.0002) : pos.stopPrice * (1 + 0.0002);
        const fillMove = isLong
          ? ((fill - pos.entryPrice) / pos.entryPrice) * 100
          : ((pos.entryPrice - fill) / pos.entryPrice) * 100;
        pos.currentPrice = fill;
        pos.pnl = (curNominal * (fillMove / 100)) - curFeeCost;
        const totPnlPreview = pos.pnl + (pos.tp1Pnl || 0) + (pos.tp2Pnl || 0);
        pos.roi = (totPnlPreview / initMargin) * 100;
        if (pos.tp1Taken && ((isLong && pos.stopPrice > pos.entryPrice * 1.0020) || (!isLong && pos.stopPrice < pos.entryPrice * 0.9980))) {
          exitReason = `🔒 Garanti Kilitli Kâr Çıkışı (+%${pos.roi.toFixed(1)} ROI / Zirve: +%${mfe.toFixed(2)} Spot)`;
        } else if (pos.beLocked) {
          const lockPct = pos.entryPrice > 0 ? Math.abs((pos.stopPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0;
          exitReason = `🛡️ Başabaş (kilit +%${lockPct.toFixed(2)} / Zirve: +%${mfe.toFixed(2)})`;
        } else {
          exitReason = `🛑 Moonshot Stop Loss (-%${slBase.toFixed(2)})`;
        }
      }

      // 🚀 Kademe 3: BALİNA MOONSHOT HEDEFİ (LONG 3.5R / SHORT 2.5R)!
      if (!exitReason && move >= moonGoal) {
        exitReason = `🎯 ${moonMult.toFixed(1)}R BALİNA MOONSHOT ALINDI (+%${move.toFixed(2)} / hedef %${moonGoal.toFixed(2)})`;
      }

      const maxHold = Number(CONFIG.maxTradeMin) || 480;
      if (!exitReason && durMin >= maxHold) {
        exitReason = `⏱️ 8s Maksimum süre doldu (${maxHold}dk / MFE: +%${mfe.toFixed(2)})`;
      }

      // ========================================================
      // 🏁 ÇIKIŞ VE MUTLAK FİYAT KORUMASI (Clamping Safeguard)
      // ========================================================
      if (exitReason) {
        if (!isStopHit && exitReason.includes('Stop Loss')) {
          pos.currentPrice = isLong ? pos.stopPrice * (1 - 0.0002) : pos.stopPrice * (1 + 0.0002);
        }

        const finalNominal = pos.margin * pos.leverage;
        const finalMove = isLong
          ? ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100
          : ((pos.entryPrice - pos.currentPrice) / pos.entryPrice) * 100;
        const exitFeeRate = (exitReason.includes('kâr alındı') || exitReason.includes('MOONSHOT')) ? makerRate : CONFIG.feeRate;
        pos.grossPnl = finalNominal * (finalMove / 100);
        pos.feeUsd = finalNominal * (makerRate + exitFeeRate);
        pos.slipUsd = 0;
        pos.pnl = pos.grossPnl - pos.feeUsd;
        pos.roi = pos.margin > 0 ? (pos.pnl / pos.margin) * 100 : 0;

        activePositions.splice(i, 1);
        closeTrade(pos, exitReason);
        stateChanged = true;
      }
    }

    settleRandomShadows(priceMap);
    if (stateChanged) persistState();
  } catch (err) {
    console.error("fastRiskLoop Hatası:", err);
    addLog(`⚠️ fastRiskLoop Hatası: ${err.message}`, 'ERROR');
  } finally {
    isRiskRunning = false;
  }
}

function schedulePostTradeTelemetry(tradeRecord, entryTimeMs) {
  const checkpoints = [
    { key: 'cp1m', min: 1 },
    { key: 'cp3m', min: 3 },
    { key: 'cp5m', min: 5 },
    { key: 'cp15m', min: 15 }
  ];
  const now = Date.now();
  for (const cp of checkpoints) {
    if (tradeRecord[cp.key] !== null && tradeRecord[cp.key] !== undefined) continue;
    const targetMs = entryTimeMs + (cp.min * 60 * 1000);
    const delayMs = Math.max(1000, targetMs - now);
    setTimeout(async () => {
      try {
        const pData = await fetchBinance(`/fapi/v1/ticker/price?symbol=${tradeRecord.symbol}`);
        if (pData && pData.price && tradeRecord.entryPrice > 0) {
          const curP = parseFloat(pData.price);
          const isLong = tradeRecord.side === "LONG";
          const move = isLong
            ? ((curP - tradeRecord.entryPrice) / tradeRecord.entryPrice) * 100
            : ((tradeRecord.entryPrice - curP) / tradeRecord.entryPrice) * 100;
          tradeRecord[cp.key] = Number(move.toFixed(2));
          fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 500), null, 2), 'utf8');
          rewriteCsvFile();
        }
      } catch (e) {}
    }, delayMs);
  }
}

function stampOpposite(linkId, pnl) {
  if (!linkId) return;
  const n = Number(Number(pnl).toFixed(2));
  const live = activePositions.find(p => p.id === linkId);
  if (live) live.oppositePnl = n;
  const closed = history.find(t => t.linkId === linkId);
  if (!closed || closed.oppositePnl === n) return;
  closed.oppositePnl = n;
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 500), null, 2), 'utf8');
    rewriteCsvFile();
  } catch (e) {}
}

function settleRandomShadows(priceMap) {
  const now = Date.now();
  const still = [];
  for (const s of randomOpen) {
    const px = priceMap[s.symbol];
    if (!px || !s.entryPrice) { still.push(s); continue; }
    const long = s.side === 'LONG';
    const move = long ? ((px - s.entryPrice) / s.entryPrice) * 100 : ((s.entryPrice - px) / s.entryPrice) * 100;
    s.mfe = Math.max(s.mfe || 0, move);
    const dur = (now - s.entryTime) / 60000;
    const slPct = Number(s.slPct) || 0.8;
    const stopPrice = Number(s.stopPrice) > 0
      ? Number(s.stopPrice)
      : (long ? s.entryPrice * (1 - slPct / 100) : s.entryPrice * (1 + slPct / 100));
    const stopHit = long ? px <= stopPrice : px >= stopPrice;
    let why = null;
    let bookMove = move;
    if (stopHit) {
      why = 'stop';
      const fill = long ? stopPrice * (1 - 0.0002) : stopPrice * (1 + 0.0002);
      bookMove = long
        ? ((fill - s.entryPrice) / s.entryPrice) * 100
        : ((s.entryPrice - fill) / s.entryPrice) * 100;
    } else if (move >= (s.tpPct || 1.6)) why = 'tp';
    else if (dur >= 45 && (s.mfe || 0) < slPct * 0.5) why = 'flat';
    else if (dur >= (Number(CONFIG.maxTradeMin) || 60)) why = 'sure';
    if (!why) { still.push(s); continue; }
    const nominal = (s.margin || 30) * (s.leverage || 5);
    const fee = nominal * ((Number(CONFIG.makerRate) || 0.0002) + (why === 'tp' ? (Number(CONFIG.makerRate) || 0.0002) : CONFIG.feeRate));
    const pnl = nominal * (bookMove / 100) - fee;
    randomClosed.unshift({ symbol: s.symbol, side: s.side, pnl, why, move: bookMove, linkId: s.linkId || null });
    stampOpposite(s.linkId, pnl);
    if (randomClosed.length > 200) randomClosed.pop();
  }
  randomOpen = still;
}

function expectancyOf(rows) {
  const list = rows || [];
  const pnls = list.map(r => Number(r.pnl) || 0);
  const wins = pnls.filter(v => v > 0.05);
  const losses = pnls.filter(v => v < -0.05);
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const sum = pnls.reduce((a, b) => a + b, 0);
  return {
    n: list.length,
    wins: wins.length,
    losses: losses.length,
    winRate: list.length ? Number((wins.length / list.length * 100).toFixed(1)) : 0,
    avgWin: Number(avg(wins).toFixed(3)),
    avgLoss: Number(avg(losses).toFixed(3)),
    expectancy: list.length ? Number((sum / list.length).toFixed(3)) : 0,
    net: Number(sum.toFixed(2))
  };
}

function buildTradeReport() {
  const bySide = {};
  const byExit = {};
  for (const t of history) {
    const side = t.side || '?';
    const why = String(t.exitReason || '').slice(0, 42);
    bySide[side] = bySide[side] || [];
    byExit[why] = byExit[why] || [];
    bySide[side].push(t);
    byExit[why].push(t);
  }
  const pack = (map) => Object.fromEntries(Object.entries(map).map(([k, v]) => [k, expectancyOf(v)]));
  return {
    strategy: expectancyOf(history),
    randomOpposite: expectancyOf(randomClosed),
    bySide: pack(bySide),
    byExit: pack(byExit)
  };
}

function closeTrade(pos, exitReason) {
  const now = Date.now();
  const durMin = Math.round((now - pos.entryTime) / 60000);
  
  // Kalan pozisyonun PnL'i bakiyeye eklenir (TP1 ve TP2 anında zaten eklenmişti)
  balance += pos.pnl;

  const totalTradePnl = pos.pnl + (pos.tp1Pnl || 0) + (pos.tp2Pnl || 0);
  const initialMargin = pos.initialMargin || pos.margin || 15.0;
  const totalTradeRoi = (totalTradePnl / initialMargin) * 100;
  
  let formattedExitReason = exitReason;
  const anyTpTaken = pos.tp1Taken || pos.tp2Taken;
  const tpTag = pos.tp2Taken ? "TP1+TP2 CEPTE" : (pos.tp1Taken ? "TP1 CEPTE" : "");
  if (anyTpTaken && exitReason.includes("Başabaş")) {
    formattedExitReason = `🛡️ ${tpTag} + Kalan Başabaş Kapandı (+%${totalTradeRoi.toFixed(1)} ROI / +$${totalTradePnl.toFixed(2)})`;
  } else if (anyTpTaken && exitReason.includes("Garanti Kilitli")) {
    formattedExitReason = `🔒 ${tpTag} + Runner Kilitli Kâr (+%${totalTradeRoi.toFixed(1)} ROI / +$${totalTradePnl.toFixed(2)} / Zirve: +%${(pos.mfe || 0).toFixed(2)} Spot)`;
  } else if (anyTpTaken && (exitReason.includes("Lazer Kâr Kilidi") || exitReason.includes("Zirve Kâr Neşteri"))) {
    formattedExitReason = `🏆 ${tpTag} + Zirve Kâr Neşteri (+%${totalTradeRoi.toFixed(1)} ROI / +${totalTradePnl.toFixed(2)} / Zirve: +%${(pos.mfe || 0).toFixed(2)} Spot)`;
  } else if (anyTpTaken && exitReason.includes("MOONSHOT")) {
    formattedExitReason = `🎯 3 KADEMELİ MOONSHOT ALINDI (Toplam: +$${totalTradePnl.toFixed(2)} / +%${totalTradeRoi.toFixed(1)} ROI)`;
  }

  // 🛡️ Aynı koinde ardışık zarar kalkanı + 30 dk soğuma (2 ardışık zararda 4 saat soğuma!)
  if (totalTradePnl <= -0.05) {
    coinLossCount[pos.symbol] = (coinLossCount[pos.symbol] || 0) + 1;
    const coolMin = coinLossCount[pos.symbol] >= 2 ? 240 : 30;
    coinCooldowns[pos.symbol] = now + (coolMin * 60 * 1000);
    if (coinLossCount[pos.symbol] >= 2) {
      addLog(`🛡️ [2-ZARAR KALKANI]: ${pos.symbol} üst üste 2 kez zarar etti ➔ 4 saat soğumaya alındı!`, 'WARN');
    }
  } else if (totalTradePnl > 0.05) {
    coinLossCount[pos.symbol] = 0;
    coinCooldowns[pos.symbol] = now + (30 * 60 * 1000);
  } else {
    coinCooldowns[pos.symbol] = now + (30 * 60 * 1000);
  }

  const exitMovePct = pos.entryPrice > 0
    ? (pos.side === 'LONG'
        ? ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100
        : ((pos.entryPrice - pos.currentPrice) / pos.entryPrice) * 100)
    : 0;
  const margin = Number(pos.initialMargin || pos.margin) || 0;
  const leverage = Number(pos.leverage) || Number(CONFIG.leverage) || 0;
  const totalGrossPnl = (pos.grossPnl || 0) + (pos.tp1Gross || 0) + (pos.tp2Gross || 0);
  const totalFeeUsd = (pos.feeUsd || 0) + (pos.tp1Fee || 0) + (pos.tp2Fee || 0);

  const tradeRecord = {
    id: (history.length > 0 ? Math.max(...history.map(h => h.id || 0)) : 0) + 1,
    time: trTime(),
    dateFullStr: trDateTime(),
    entryTimeStr: trDateTime(pos.entryTime),
    entryTimeMs: pos.entryTime || now,
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
    btc15mEntry: pos.btc15mEntry !== undefined ? pos.btc15mEntry : 0,
    cp1m: pos.cp1m !== undefined ? pos.cp1m : null,
    cp3m: pos.cp3m !== undefined ? pos.cp3m : null,
    cp5m: pos.cp5m !== undefined ? pos.cp5m : null,
    cp15m: pos.cp15m !== undefined ? pos.cp15m : null,
    atr3m: pos.atr3mPct !== undefined ? pos.atr3mPct : null,
    rsi3m: pos.entryRsi !== undefined ? pos.entryRsi : null,
    chg15: pos.chg15 !== undefined ? pos.chg15 : null,
    grossPnl: totalGrossPnl,
    feeUsd: totalFeeUsd,
    slipUsd: pos.slipUsd !== undefined ? pos.slipUsd : null,
    strategy: pos.strategy || '',
    linkId: pos.id || null,
    margin,
    leverage,
    notional: Number((margin * leverage).toFixed(2)),
    slPct: pos.slPct != null ? Number(pos.slPct) : null,
    tpPct: pos.moonPct != null ? Number((pos.moonPct * (pos.volK || 1)).toFixed(2)) : (pos.tp1Pct != null ? Number(pos.tp1Pct) : null),
    exitMovePct: Number(exitMovePct.toFixed(3)),
    givebackPct: Number(((pos.mfe || 0) - exitMovePct).toFixed(3)),
    chg1h: pos.chg1h != null ? pos.chg1h : null,
    vol24M: pos.vol24M != null ? pos.vol24M : null,
    pos1h: pos.pos1h != null ? pos.pos1h : null,
    breakVol: pos.breakVol != null ? pos.breakVol : null,
    trigger3m: pos.trigger3m != null ? pos.trigger3m : null,
    spreadBps: pos.spreadBps != null ? pos.spreadBps : null,
    btc5mExit: Number(btc5mNumeric.toFixed(3)),
    btc15mExit: Number(btc15mNumeric.toFixed(3)),
    balanceAfter: Number(balance.toFixed(2)),
    oppositePnl: pos.oppositePnl != null ? pos.oppositePnl : null
  };

  history.unshift(tradeRecord);
  if (history.length > 500) history.pop();

  appendTradeToCsv(tradeRecord);
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 500), null, 2), 'utf8');
  } catch (e) {}

  // İşlem 15 dakikadan erken kapansa bile 1, 3, 5 ve 15. dakikadaki fiyat hareketini ölçüp CSV'ye işle!
  schedulePostTradeTelemetry(tradeRecord, pos.entryTime || (now - durMin * 60000));

  addLog(`🏁 KAPANDI: [${pos.side}] ${pos.symbol} | PnL: ${totalTradePnl >= 0 ? '+' : ''}$${totalTradePnl.toFixed(2)} (%${totalTradeRoi >= 0 ? '+' : ''}${totalTradeRoi.toFixed(1)} ROI) | ${formattedExitReason}`, totalTradePnl >= 0 ? 'WIN' : 'LOSS');
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
  const megaWins = history.filter(h => {
    const r = String(h.exitReason || '');
    return r.includes('MOONSHOT') || r.includes('TP1+TP2') || r.includes('kâr alındı');
  }).length;

  const peak = getPeakBalance();
  const ddPct = peak > 0 ? (((peak - balance) / peak) * 100).toFixed(1) : "0.0";

  return {
    balance: balance.toFixed(2),
    peakBalance: peak.toFixed(2),
    drawdownPct: ddPct,
    mode: DYNAMIC.mode || 'HIZLI_VUR_KAC',
    circuit: circuitOn,
    liveSlots: CONFIG.maxSlots,
    liveMargin: CONFIG.marginPerTrade,
    totalPnl: totalPnl.toFixed(2),
    totalRoi: totalRoi.toFixed(2),
    totalTrades,
    wins,
    losses,
    breakevens,
    winRate,
    megaWins,
    botActive: isBotActive,
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
  const gateSnap = engineSnapshot().gates || {};
  const gateEntryLbl = (gateSnap.entry || 'motor').length > 38
    ? (gateSnap.entry || '').slice(0, 36) + '…'
    : (gateSnap.entry || 'motor');
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
    <div class="tabs">
      <button class="tab-btn active" id="tabLive" onclick="switchView('liveView')">📡 1. CANLI SİMÜLASYON</button>
      <button class="tab-btn" id="tabRadar" onclick="switchView('scanner15mView')" style="color:#38bdf8;">🔍 3. 15DK RADAR & EXCEL AKTARICI</button>
    </div>

    <div class="dashboard" id="liveView">
      <!-- SOL PANEL: MOTOR KONTROLÜ -->
      <div class="panel">
        <h2>
          <span>🎛️ MOTOR KONTROLÜ</span>
          <button id="themeToggleBtn" onclick="toggleTheme()" class="theme-toggle-btn">☀️ Açık Mod</button>
        </h2>

        <div class="sidebar-section-title" style="margin-top:0;">MOTOR</div>
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
              <span class="agent-name">Giriş</span>
              <span class="status-pill green" id="gateEngine">${gateEntryLbl}</span>
            </div>
            <div class="agent-row">
              <span class="agent-name">Emir defteri</span>
              <span class="status-pill green" id="gateBook">${gateSnap.book || 'OBI'}</span>
            </div>
            <div class="agent-row">
              <span class="agent-name">Yargıç</span>
              <span class="status-pill green" id="gateJudge">${gateSnap.judge || 'açık'}</span>
            </div>
            <div class="agent-row">
              <span class="agent-name">Devre kesici</span>
              <span class="status-pill" id="gateBreaker">${stats.circuit ? 'AÇIK' : 'kapalı'}</span>
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
            <span class="perf-mini-label">Hedefe ulaşan</span>
            <span class="perf-mini-val" style="color:var(--amber);" id="stMega">${stats.megaWins} Adet</span>
          </div>
        </div>

        <div class="sidebar-section-title">⚙️ TEMEL RİSK & POZİSYON</div>
        <div class="param-grid-2x2">
          <div class="param-card">
            <div class="param-header"><span>MAX SLOT</span><span>yön başı 1</span></div>
            <div class="param-input-wrap"><input type="number" id="inpSlots" value="${CONFIG.maxSlots}"><span class="param-unit">adet</span></div>
          </div>
          <div class="param-card">
            <div class="param-header"><span>TEMİNAT</span><span>kâğıt</span></div>
            <div class="param-input-wrap"><input type="number" id="inpMargin" value="${CONFIG.marginPerTrade}"><span class="param-unit">$</span></div>
          </div>
          <div class="param-card">
            <div class="param-header"><span>KALDIRAÇ</span><span>sabit</span></div>
            <div class="param-input-wrap"><input type="number" id="inpLev" value="${CONFIG.leverage}"><span class="param-unit">x</span></div>
          </div>
          <div class="param-card">
            <div class="param-header"><span>STOP LOSS</span><span>sabit</span></div>
            <div class="param-input-wrap"><input type="number" id="inpSl" value="${CONFIG.slPct.toFixed(2)}" step="0.1"><span class="param-unit">%</span></div>
          </div>
        </div>

        <div class="sidebar-section-title">ÇIKIŞ & KÂR KİLİDİ</div>
        <div style="background:linear-gradient(90deg, var(--blue-bg) 0%, var(--panel) 100%); border-left:3px solid var(--blue); border:1px solid var(--blue-border); border-radius:5px; padding:6px 8px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center; box-shadow:var(--shadow-sm);">
          <div>
            <div style="font-size:10px;font-weight:800;color:var(--blue);letter-spacing:0.3px;">ANA HEDEF (TP)</div>
            <div style="font-size:8.5px;color:var(--muted);margin-top:1px;">Pozisyonun tamamı kârla kapanır</div>
          </div>
          <div style="display:flex;align-items:baseline;gap:2px;background:var(--panel2);padding:2px 6px;border-radius:4px;border:1px solid var(--blue-border);">
            <input type="number" id="inpTp1" value="${(CONFIG.tp1Pct || 1.20).toFixed(2)}" step="0.1" style="width:52px;background:none;border:none;color:var(--blue);font-family:'JetBrains Mono';font-size:13px;font-weight:650;text-align:right;outline:none;">
            <span style="font-size:10px;color:var(--blue);opacity:0.7;">%</span>
          </div>
        </div>
        <div style="background:var(--panel); border:1px solid var(--border); border-radius:5px; padding:6px 8px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:10px;font-weight:800;color:var(--green);letter-spacing:0.3px;">🛡️ 3 KADEMELİ İZ SÜREN KİLİT</div>
            <div style="font-size:8.5px;color:var(--muted);margin-top:1px;">+%0.40 ➔ BE (+%0.12) | +%0.65 ➔ +%0.38 | +%0.90 ➔ +%0.65</div>
          </div>
        </div>
        <div style="background:var(--panel); border:1px solid var(--border); border-radius:5px; padding:6px 8px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:10px;font-weight:800;color:var(--text);letter-spacing:0.3px;">⏱️ 22 DK / 35 DK / ${CONFIG.maxTradeMin} DK</div>
            <div style="font-size:8.5px;color:var(--muted);margin-top:1px;">Ölü işlem 22dk'da, yatay 35dk'da, süre ${CONFIG.maxTradeMin}dk'da kesilir</div>
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
          <span>CANLI KAYIT</span>
        </h2>
        <div id="dialogueBox" style="background:var(--panel2); border:1px solid var(--border); border-radius:12px; padding:12px 14px; max-height:320px; overflow-y:auto; font-family:-apple-system,Segoe UI,sans-serif; font-size:13px; line-height:1.5; display:flex; flex-direction:column; gap:8px;">
          ${renderLogs(logs.slice(0, 30))}
        </div>
      </div>
    </div>

    <div id="scanner15mView" style="display:none; width:100%; margin-top:8px;">
      <!-- ⏪ GERÇEK GEÇMİŞ REPLAY BACKTEST (SIFIR HİLE, GERÇEK MUM & KOMİSYON) -->
      <div class="panel" style="margin-bottom:12px; border:1px solid rgba(56,189,248,0.35);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h2 style="margin:0; color:#38bdf8;">⏪ GERÇEK GEÇMİŞ REPLAY BACKTEST (GİRSEYDİK NE OLURDU?)</h2>
            <div style="font-size:12px; color:var(--muted); margin-top:4px;">Birebir canlı <b>15dk Balina Motoru (2.5x Hacim + EMA20/50 + 3.5R İz Süren Runner)</b> ile geçmiş Binance Futures mumlarını kronolojik tarar. Aynı mumda hem stop hem hedef varsa önce STOP sayar, tam komisyon ve kayma düşer.</div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
            <select id="selReplayHours" onchange="loadReplay()" style="background:var(--panel2); color:var(--text); border:1px solid var(--border); border-radius:6px; padding:6px 8px; font-weight:800;">
              <option value="24">Son 24 Saat</option>
              <option value="72" selected>Son 3 Gün (72s)</option>
              <option value="168">Son 7 Gün (168s)</option>
              <option value="240">Son 10 Gün (240s)</option>
            </select>
            <button class="theme-toggle-btn" id="btnRunReplay" onclick="loadReplay()">⏪ Geçmişi Simüle Et</button>
            <button class="theme-toggle-btn" onclick="exportReplayExcel()">📥 Replay Excel / CSV</button>
          </div>
        </div>
        <div id="replayStatusLine" style="margin-top:8px; font-size:12px; color:var(--muted);">Geçmiş simülasyon için "Geçmişi Simüle Et" butonuna basın veya sekme yüklenmesini bekleyin...</div>
        <div id="replaySummaryGrid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:8px; margin-top:10px;"></div>
        <div class="table-container" style="max-height:380px; overflow:auto; margin-top:10px;">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Giriş Saati</th><th>Koin</th><th>Yön</th><th>Giriş ➔ Çıkış</th><th>Hacim</th><th>SL (%)</th><th>MFE (%)</th><th>Süre</th><th>Çıkış Nedeni</th><th>Net Kâr ($)</th><th>Kasa ($)</th>
              </tr>
            </thead>
            <tbody id="tbodyReplayTrades"><tr><td colspan="12" style="text-align:center;color:var(--muted);padding:16px;">Geçmiş simülasyon bekleniyor...</td></tr></tbody>
          </table>
        </div>
      </div>

      <!-- 🔍 CANLI FUTURES RADAR (DÜZELTİLMİŞ, GELECEĞİ GÖRME HİLESİZ) -->
      <div class="panel" style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <h2 style="margin:0;">🔍 <span id="radarTimeframeTitle">15 DAKİKALIK</span> CANLI FUTURES RADARI & BALİNA TAKİBİ</h2>
            <div style="font-size:12px; color:var(--muted); margin-top:4px;">Sadece saf Kripto Futures koinleri (383+ hisse/emtia temiz). Tüm tablolarda birebir aynı 15dk/mum Alıcı-Satıcı baskısı ve gerçek bot uygunluk durumu gösterilir.</div>
          </div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
            <select id="selRadarTimeframe" onchange="loadRadar()" style="background:var(--panel2); color:var(--text); border:1px solid var(--border); border-radius:6px; padding:6px 8px; font-weight:800;">
              <option value="15m">15 Dakika</option>
              <option value="1h">1 Saat</option>
              <option value="4h">4 Saat</option>
              <option value="1d">Günlük</option>
            </select>
            <select id="sel15mMinVol" onchange="renderRadar()" style="background:var(--panel2); color:var(--text); border:1px solid var(--border); border-radius:6px; padding:6px 8px; font-weight:800;">
              <option value="0">Tüm koinler</option>
              <option value="5">Min $5M</option>
              <option value="10" selected>Min $10M</option>
              <option value="25">Min $25M</option>
            </select>
            <button class="theme-toggle-btn" onclick="loadRadar()">🚀 Şimdi Tara</button>
            <button class="theme-toggle-btn" onclick="exportRadarExcel()">📥 Radar Excel / CSV</button>
          </div>
        </div>
        <div id="radarStatusLine" style="margin-top:8px; font-size:12px; color:var(--muted);">Radar bekleniyor.</div>
      </div>
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(460px, 1fr)); gap:12px;">
        <div class="panel">
          <h2 style="color:var(--green);">🟢 EN ÇOK YÜKSELEN 15 (CANLI LONG RADARI)</h2>
          <div class="table-container" style="max-height:460px; overflow:auto;"><table><thead><tr><th>#</th><th>Sembol</th><th>Fiyat</th><th>Mum (%)</th><th>3s (%)</th><th>Alıcı (%)</th><th>24s Hacim</th><th>Bot Durumu</th></tr></thead><tbody id="tbody15mGainers"></tbody></table></div>
        </div>
        <div class="panel">
          <h2 style="color:var(--red);">🔴 EN ÇOK DÜŞEN 15 (CANLI SHORT RADARI)</h2>
          <div class="table-container" style="max-height:460px; overflow:auto;"><table><thead><tr><th>#</th><th>Sembol</th><th>Fiyat</th><th>Mum (%)</th><th>3s (%)</th><th>Satıcı (%)</th><th>24s Hacim</th><th>Bot Durumu</th></tr></thead><tbody id="tbody15mLosers"></tbody></table></div>
        </div>
      </div>
      <div class="panel" style="margin-top:12px;">
        <h2>📋 TÜM SAF KRİPTO FUTURES LİSTESİ <span id="badgeAllCoinsCount" style="font-size:12px; color:var(--muted);"></span></h2>
        <input id="inp15mSearch" oninput="renderRadar()" placeholder="Koin ara" style="background:var(--panel2); border:1px solid var(--border); color:var(--text); border-radius:6px; padding:6px 10px; margin-bottom:8px;">
        <div class="table-container" style="max-height:420px; overflow:auto;"><table><thead><tr><th>#</th><th>Sembol</th><th>Fiyat</th><th>Mum (%)</th><th>3s (%)</th><th>24s (%)</th><th>24s Hacim</th><th>Alıcı (%)</th><th>Bot Durumu</th><th>Sinyal</th></tr></thead><tbody id="tbody15mAll"></tbody></table></div>
      </div>
    </div>
  </div>

  <script>
    let radarCache = [];
    let replayCache = null;
    function switchView(id) {
      var live = document.getElementById('liveView');
      var radar = document.getElementById('scanner15mView');
      if (live) live.style.display = id === 'liveView' ? '' : 'none';
      if (radar) radar.style.display = id === 'scanner15mView' ? 'block' : 'none';
      var tabLive = document.getElementById('tabLive');
      var tabRadar = document.getElementById('tabRadar');
      if (tabLive) tabLive.classList.toggle('active', id === 'liveView');
      if (tabRadar) tabRadar.classList.toggle('active', id === 'scanner15mView');
      if (id === 'scanner15mView') {
        loadRadar();
        if (!replayCache) loadReplay();
      }
    }
    function radarNum(p) {
      var n = Number(p) || 0;
      if (n < 0.0001) return n.toFixed(6);
      if (n < 0.01) return n.toFixed(5);
      if (n < 1) return n.toFixed(4);
      return n.toFixed(2);
    }
    function radarVol(v) {
      var n = Number(v) || 0;
      if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
      if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
      return '$' + Math.round(n);
    }
    function evalRadarBotFit(item, side) {
      var chg = Number(item.chg15m) || 0;
      var chg3 = Number(item.chg3h) || 0;
      var vol24 = Number(item.vol24hM) || 0;
      var taker = Number(item.taker15m) || Number(item.takerBuyRatio) || 50;
      if (vol24 < 10) return { label: '💤 Düşük Hacim', color: 'var(--muted)' };
      if (side === 'long') {
        if (chg >= 0.70 && chg <= 6.5 && taker >= 56 && chg3 >= 0.5 && chg3 <= 15) return { label: '🐋 BALİNA ADAYI', color: 'var(--green)' };
        if (chg > 6.5 || chg3 > 15) return { label: '🔥 Aşırı Uzamış', color: '#f59e0b' };
        if (chg >= 0.40 && taker >= 53) return { label: '⚡ Takipte', color: 'var(--blue)' };
        return { label: '⚖️ Nötr / Zayıf', color: 'var(--muted)' };
      } else {
        if (chg <= -0.70 && chg >= -6.5 && taker <= 44 && chg3 <= -0.5 && chg3 >= -15) return { label: '🐋 BALİNA ADAYI', color: 'var(--red)' };
        if (chg < -6.5 || chg3 < -15) return { label: '🔥 Aşırı Düşmüş', color: '#f59e0b' };
        if (chg <= -0.40 && taker <= 47) return { label: '⚡ Takipte', color: 'var(--blue)' };
        return { label: '⚖️ Nötr / Zayıf', color: 'var(--muted)' };
      }
    }
    function radarRows(list, side) {
      return list.map(function (item, idx) {
        var chg = Number(item.chg15m) || 0;
        var chg3 = Number(item.chg3h) || 0;
        var color = chg >= 0 ? 'var(--green)' : 'var(--red)';
        var c3Color = chg3 >= 0 ? 'var(--green)' : 'var(--red)';
        var taker = Number(item.taker15m) || Number(item.takerBuyRatio) || 50;
        var press = side === 'short' ? (100 - taker) : taker;
        var pressLbl = side === 'short' ? ' satıcı' : ' alıcı';
        var star = item.bot ? ' ★' : '';
        var fit = evalRadarBotFit(item, side);
        return '<tr><td>' + (idx + 1) + '</td><td style="font-weight:900;">' + item.symbol + star + '</td><td>$' + radarNum(item.lastPrice) + '</td><td style="color:' + color + ';font-weight:900;">' + (chg >= 0 ? '+' : '') + '%' + chg.toFixed(2) + '</td><td style="color:' + c3Color + ';font-weight:700;">' + (chg3 >= 0 ? '+' : '') + '%' + chg3.toFixed(2) + '</td><td style="font-weight:700;">%' + press.toFixed(1) + pressLbl + '</td><td>$' + (Number(item.vol24hM) || 0).toFixed(1) + 'M</td><td style="color:' + fit.color + ';font-weight:800;font-size:11px;">' + fit.label + '</td></tr>';
      }).join('');
    }
    function renderRadar() {
      var minVol = Number((document.getElementById('sel15mMinVol') || {}).value || 0);
      var q = ((document.getElementById('inp15mSearch') || {}).value || '').toUpperCase();
      var rows = radarCache.filter(function (x) { return (Number(x.vol24hM) || 0) >= minVol; });
      var gainers = rows.slice().sort(function (a, b) { return (b.chg15m || 0) - (a.chg15m || 0); }).slice(0, 15);
      var losers = rows.slice().sort(function (a, b) { return (a.chg15m || 0) - (b.chg15m || 0); }).slice(0, 15);
      var all = rows.slice().sort(function (a, b) { return Math.abs(b.chg15m || 0) - Math.abs(a.chg15m || 0); });
      if (q) all = all.filter(function (x) { return String(x.symbol).indexOf(q) !== -1; });
      var g = document.getElementById('tbody15mGainers');
      var l = document.getElementById('tbody15mLosers');
      var a = document.getElementById('tbody15mAll');
      if (g) g.innerHTML = radarRows(gainers, 'long') || '<tr><td colspan="8">Veri yok</td></tr>';
      if (l) l.innerHTML = radarRows(losers, 'short') || '<tr><td colspan="8">Veri yok</td></tr>';
      if (a) a.innerHTML = all.map(function (item, idx) {
        var chg = Number(item.chg15m) || 0;
        var chg3 = Number(item.chg3h) || 0;
        var chg24 = Number(item.chg24h) || 0;
        var side = chg >= 0 ? 'long' : 'short';
        var fit = evalRadarBotFit(item, side);
        var taker = Number(item.taker15m) || Number(item.takerBuyRatio) || 50;
        return '<tr><td>' + (idx + 1) + '</td><td style="font-weight:800;">' + item.symbol + (item.bot ? ' ★' : '') + ' (' + (side === 'long' ? 'LONG' : 'SHORT') + ')</td><td>$' + radarNum(item.lastPrice) + '</td><td style="color:' + (chg >= 0 ? 'var(--green)' : 'var(--red)') + ';font-weight:800;">' + (chg >= 0 ? '+' : '') + '%' + chg.toFixed(2) + '</td><td style="color:' + (chg3 >= 0 ? 'var(--green)' : 'var(--red)') + ';">' + (chg3 >= 0 ? '+' : '') + '%' + chg3.toFixed(2) + '</td><td style="color:' + (chg24 >= 0 ? 'var(--green)' : 'var(--red)') + ';">' + (chg24 >= 0 ? '+' : '') + '%' + chg24.toFixed(1) + '</td><td>$' + (Number(item.vol24hM) || 0).toFixed(1) + 'M</td><td>%' + taker.toFixed(1) + '</td><td style="color:' + fit.color + ';font-weight:800;font-size:11px;">' + fit.label + '</td><td>' + (item.signal || '') + '</td></tr>';
      }).join('') || '<tr><td colspan="10">Veri yok</td></tr>';
      var badge = document.getElementById('badgeAllCoinsCount');
      if (badge) badge.textContent = all.length + ' koin';
    }
    async function loadRadar() {
      var line = document.getElementById('radarStatusLine');
      var tfEl = document.getElementById('selRadarTimeframe');
      var tf = tfEl ? tfEl.value : '15m';
      var title = document.getElementById('radarTimeframeTitle');
      if (title) title.textContent = tf === '15m' ? '15 DAKİKALIK' : (tf === '1h' ? '1 SAATLİK' : (tf === '4h' ? '4 SAATLİK' : 'GÜNLÜK'));
      if (line) line.textContent = 'Canlı Futures koinleri taranıyor...';
      try {
        var res = await fetch('/api/radar?tf=' + encodeURIComponent(tf));
        var data = await res.json();
        radarCache = data.items || [];
        renderRadar();
        var whaleCount = radarCache.filter(function (x) {
          var s = (Number(x.chg15m) || 0) >= 0 ? 'long' : 'short';
          return evalRadarBotFit(x, s).label.indexOf('BALİNA') !== -1;
        }).length;
        if (line) line.textContent = (data.count || radarCache.length) + ' saf kripto Futures tarandı | Anlık Balina Adayı: ' + whaleCount + ' koin (★ = 15dk Balina Lideri)';
      } catch (e) {
        if (line) line.textContent = 'Radar alınamadı.';
      }
    }
    async function loadReplay() {
      var line = document.getElementById('replayStatusLine');
      var grid = document.getElementById('replaySummaryGrid');
      var tbody = document.getElementById('tbodyReplayTrades');
      var btn = document.getElementById('btnRunReplay');
      var hEl = document.getElementById('selReplayHours');
      var hours = hEl ? Number(hEl.value) : 72;
      if (btn) btn.disabled = true;
      if (line) line.textContent = '⏳ Son ' + hours + ' saatlik gerçek Binance Futures 15dk mumları çekilip simüle ediliyor (5–15 sn)...';
      if (tbody) tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--muted);padding:18px;">⏳ Gerçek geçmiş mumlar hesaplanıyor...</td></tr>';
      try {
        var res = await fetch('/api/replay-backtest?hours=' + encodeURIComponent(hours) + '&coins=45');
        var data = await res.json();
        if (!data || !data.ok) {
          if (line) line.textContent = '❌ Replay alınamadı: ' + ((data && data.error) || 'hata');
          return;
        }
        replayCache = data;
        var s = data.summary || {};
        var netClr = (s.netPnl || 0) >= 0 ? 'var(--green)' : 'var(--red)';
        var lClr = (s.longNet || 0) >= 0 ? 'var(--green)' : 'var(--red)';
        var sClr = (s.shortNet || 0) >= 0 ? 'var(--green)' : 'var(--red)';
        var oClr = (s.oppositeNet || 0) >= 0 ? 'var(--green)' : 'var(--red)';
        if (line) line.textContent = '✅ Tamamlandı (' + (data.generatedAt || '') + ') | ' + s.coinsScanned + ' Saf Kripto Futures · Son ' + s.hours + ' Saat · $100 Başlangıç Kasası · 3 Slot · %2.5 Risk · Tam Komisyon + Kayma Dahil';
        if (grid) {
          var card = function (lbl, val, sub, clr) {
            return '<div style="background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;"><div style="font-size:10px;color:var(--muted);font-weight:700;">' + lbl + '</div><div style="font-size:16px;font-weight:900;color:' + (clr || 'var(--text)') + ';margin-top:2px;">' + val + '</div><div style="font-size:10px;color:var(--muted);margin-top:2px;">' + sub + '</div></div>';
          };
          grid.innerHTML =
            card('BİTİŞ BAKİYESİ ($100 ->)', '$' + Number(s.finalBalance || 100).toFixed(2), 'Net: ' + ((s.netPnl >= 0 ? '+$' : '-$') + Math.abs(s.netPnl || 0).toFixed(2)) + ' (%' + (s.roiPct >= 0 ? '+' : '') + Number(s.roiPct || 0).toFixed(1) + ')', netClr) +
            card('İŞLEM & WIN RATE', s.totalTrades + ' İşlem', s.wins + 'W / ' + s.losses + 'L (%' + s.winRate + ' WR) · PF: ' + s.profitFactor, 'var(--text)') +
            card('🟢 LONG PERFORMANSI', (s.longNet >= 0 ? '+$' : '-$') + Math.abs(s.longNet || 0).toFixed(2), s.longCount + ' işlem · %' + s.longWr + ' WR', lClr) +
            card('🔴 SHORT PERFORMANSI', (s.shortNet >= 0 ? '+$' : '-$') + Math.abs(s.shortNet || 0).toFixed(2), s.shortCount + ' işlem · %' + s.shortWr + ' WR', sClr) +
            card('🔄 TERS YÖN KIYAS', (s.oppositeNet >= 0 ? '+$' : '-$') + Math.abs(s.oppositeNet || 0).toFixed(2), 'Avantaj: ' + (((s.netPnl - s.oppositeNet) >= 0 ? '+$' : '-$') + Math.abs((s.netPnl || 0) - (s.oppositeNet || 0)).toFixed(2)), oClr) +
            card('MAX DÜŞÜŞ & KOMİSYON', '-%' + Number(s.maxDrawdownPct || 0).toFixed(1) + ' DD', 'Zirve: $' + Number(s.peakBalance || 100).toFixed(2) + ' · Komisyon: $' + Number(s.totalFees || 0).toFixed(2), 'var(--muted)');
        }
        var list = data.trades || [];
        if (tbody) {
          tbody.innerHTML = list.map(function (t) {
            var isW = (t.netPnl || 0) >= 0;
            var sCls = t.side === 'LONG' ? 'badge-side-long' : 'badge-side-short';
            return '<tr><td>' + t.id + '</td><td style="font-size:10px;color:var(--muted);">' + t.entryTime + '</td><td style="font-weight:900;">' + t.symbol + '</td><td><span class="' + sCls + '">' + t.side + '</span></td><td style="font-size:11px;">$' + radarNum(t.entryPrice) + ' ➔ $' + radarNum(t.exitPrice) + '</td><td style="font-weight:700;">' + Number(t.volMult || 0).toFixed(1) + 'x</td><td>%' + Number(t.slPct || 0).toFixed(2) + '</td><td style="color:var(--green);font-weight:800;">+%' + Number(t.mfe || 0).toFixed(2) + '</td><td>' + t.durationMin + 'dk</td><td style="font-size:11px;">' + t.reason + '</td><td style="color:' + (isW ? 'var(--green)' : 'var(--red)') + ';font-weight:900;">' + (isW ? '+$' : '-$') + Math.abs(t.netPnl || 0).toFixed(2) + '</td><td style="font-weight:700;">$' + Number(t.balanceAfter || 100).toFixed(2) + '</td></tr>';
          }).join('') || '<tr><td colspan="12" style="text-align:center;color:var(--muted);padding:16px;">Bu zaman aralığında balina kriterine uyan geçmiş işlem bulunmadı.</td></tr>';
        }
      } catch (e) {
        if (line) line.textContent = '❌ Replay bağlantısı başarısız.';
      } finally {
        if (btn) btn.disabled = false;
      }
    }
    function exportReplayExcel() {
      if (!replayCache || !replayCache.trades || !replayCache.trades.length) { loadReplay(); return; }
      var lines = ['ID;Giris_Saati;Cikis_Saati;Koin;Yon;Giris_Fiyati;Cikis_Fiyati;Hacim_Kati;Taker_Pct;4s_Pct;ATR15m_Pct;SL_Pct;MFE_Pct;MAE_Pct;Sure_Dk;Cikis_Nedeni;Brut_USD;Komisyon_USD;Net_Kar_USD;Ters_PnL_USD;Kasa_Sonrasi_USD'];
      replayCache.trades.slice().reverse().forEach(function (t) {
        lines.push([t.id, '"' + t.entryTime + '"', '"' + t.exitTime + '"', t.symbol, t.side, t.entryPrice, t.exitPrice, t.volMult, t.taker, t.chg4h, t.atr15, t.slPct, t.mfe, t.mae, t.durationMin, '"' + String(t.reason || '') + '"', t.grossPnl, t.feeUsd, t.netPnl, t.oppPnl, t.balanceAfter].join(';'));
      });
      var blob = new Blob(['\uFEFF' + lines.join('\\n')], { type: 'text/csv;charset=utf-8;' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'marscoin_gecmis_replay_' + (replayCache.summary ? replayCache.summary.hours : 72) + 's.csv';
      link.click();
    }
    function exportRadarExcel() {
      if (!radarCache.length) { loadRadar(); return; }
      var lines = ['Sira;Sembol;Yon;Fiyat;Mum_Pct;3s_Pct;24s_Pct;24s_Hacim_M;15dk_Alici_Pct;Bot_Durumu;Sinyal;BotLideri'];
      radarCache.slice().sort(function (a, b) { return Math.abs(b.chg15m || 0) - Math.abs(a.chg15m || 0); }).forEach(function (item, idx) {
        var chg = Number(item.chg15m) || 0;
        var side = chg >= 0 ? 'LONG' : 'SHORT';
        var fit = evalRadarBotFit(item, chg >= 0 ? 'long' : 'short');
        var taker = Number(item.taker15m) || Number(item.takerBuyRatio) || 50;
        lines.push([idx + 1, item.symbol, side, item.lastPrice, chg.toFixed(2), (Number(item.chg3h) || 0).toFixed(2), (Number(item.chg24h) || 0).toFixed(2), (Number(item.vol24hM) || 0).toFixed(2), taker.toFixed(1), '"' + fit.label + '"', '"' + String(item.signal || '') + '"', item.bot ? 'EVET' : ''].join(';'));
      });
      var blob = new Blob(['\uFEFF' + lines.join('\\n')], { type: 'text/csv;charset=utf-8;' });
      var link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'binance_futures_canli_radar.csv';
      link.click();
    }
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
        const liveSt = document.getElementById("liveStatus");
        if (liveSt) {
          const on = data.stats.botActive !== false;
          liveSt.innerText = on ? 'ÇALIŞIYOR' : 'DURDU';
          liveSt.className = 'status-pill ' + (on ? 'green' : '');
        }
        document.getElementById("posCount").innerText = data.stats.activeCount + ' / ' + (data.stats.liveSlots || (data.settings && data.settings.slots) || '1');
        document.getElementById("histCount").innerText = data.history.length;

        const btcEl = document.getElementById("btcVal");
        btcEl.innerText = data.stats.btcTrend;
        btcEl.style.color = data.stats.btcIsGreen ? 'var(--green)' : 'var(--red)';

        const ts = data.teamStatus || {};
        const g = ts.gates || {};
        const ge = document.getElementById('gateEngine');
        if (ge && g.entry) {
          ge.innerText = g.entry.length > 38 ? g.entry.slice(0, 36) + '…' : g.entry;
        }
        const gb = document.getElementById('gateBook');
        if (gb && g.book) gb.innerText = g.book;
        const gj = document.getElementById('gateJudge');
        if (gj && g.judge) gj.innerText = g.judge;

        const br = document.getElementById("gateBreaker");
        if (br) {
          br.innerText = data.stats.circuit ? ('AÇIK · $' + data.stats.liveMargin) : 'kapalı';
          br.className = 'status-pill ' + (data.stats.circuit ? 'purple' : '');
        }

        const dBox = document.getElementById("dialogueBox");
        if (dBox && data.logs) {
          const wasNearTop = dBox.scrollTop < 40;
          dBox.innerHTML = renderLogsClient(data.logs);
          // En yeni kayıt en üstte (index 0) olduğu için kutu üstte kalır (eskiden en alta/en eski kayda kaydırıyordu!)
          if (wasNearTop || !window._dBoxInitialized) {
            dBox.scrollTop = 0;
            window._dBoxInitialized = true;
          }
        }

        // Aktif Pozisyonlar Tablosu
        const tbody = document.getElementById("activeTbody");
        if (data.positions.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:35px 15px;"><div style="font-size:32px; margin-bottom:12px; filter:grayscale(0.3);">🔭</div><div style="color:var(--text); font-weight:700; font-size:14px; letter-spacing:0.5px;">TETİKTE BEKLENİYOR</div><div style="color:var(--muted); font-size:11px; margin-top:6px; max-width:320px; margin-left:auto; margin-right:auto; line-height:1.4;">Kırılım testi, defter fiyatı ve yargıç taranıyor.</div></td></tr>';
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
            activeCardsEl.innerHTML = '<div class="empty-cards-msg">Kırılım testi taranıyor.</div>';
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
                      <span class="\${isLong ? 'badge-side-long' : 'badge-side-short'}">\${isLong ? '▲ LONG ' : '▼ SHORT '}\${p.leverage || 40}x</span>
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

    function renderLogsClient(rows) {
      if (!rows || rows.length === 0) {
        return '<div style="color:var(--muted);text-align:center;padding:12px;">Kayıt bekleniyor.</div>';
      }
      return rows.slice(0, 30).map(function(l) {
        return '<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 10px;background:var(--panel);border-radius:8px;border:1px solid var(--border);">' +
          '<span style="color:var(--muted);font-size:12px;white-space:nowrap;padding-top:1px;">' + escapeHtml(l.time) + '</span>' +
          '<div style="color:var(--text-secondary);font-size:13px;line-height:1.45;">' + escapeHtml(l.msg) + '</div>' +
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
    const SET_IDS = { slots: 'inpSlots', margin: 'inpMargin', lev: 'inpLev', sl: 'inpSl', tp1: 'inpTp1' };
    let settingsSynced = false;

    function readSettingsFromInputs() {
      const o = {};
      Object.keys(SET_IDS).forEach(k => {
        const el = document.getElementById(SET_IDS[k]);
        if (el) o[k] = el.value;
      });
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
      const el = document.getElementById(SET_IDS[k]);
      if (el) {
        el.addEventListener('change', async () => {
          const o = readSettingsFromInputs();
          try { localStorage.setItem(LS_SET, JSON.stringify(o)); } catch (e) {}
          await pushSettings(o);
        });
      }
    });

    updateDashboard();
    setInterval(updateDashboard, 2000);
  </script>
</body>
</html>`;
}

function renderActiveRows(positions) {
  if (!positions || positions.length === 0) {
    return '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px;font-size:12px;">Kırılım testi taranıyor.</td></tr>';
  }
  return positions.map((p, idx) => {
    const isLong = p.side === 'LONG';
    const totOpenPnl = (p.pnl || 0) + (p.tp1Pnl || 0) + (p.tp2Pnl || 0);
    const initM = p.initialMargin || p.margin || 25;
    const totOpenRoi = initM > 0 ? (totOpenPnl / initM) * 100 : (p.roi || 0);
    const isWin = totOpenPnl >= 0;
    const stopText = p.beLocked
      ? (p.tp1Taken
          ? '<span class="badge-be" style="background:#059669;color:#fff;">🔒 RUNNER İZ SÜREN</span>'
          : '<span class="badge-be">🛡️ 1.0R BAŞABAŞ ($0 RİSK)</span>')
      : `<span class="badge-sl">🛑 STOP: -%${(p.slPct || CONFIG.slPct).toFixed(2)}</span>`;

    const roiStr = (totOpenRoi >= 0 ? '+' : '') + totOpenRoi.toFixed(1) + '%';
    const pnlStr = (totOpenPnl >= 0 ? '+$' : '-$') + Math.abs(totOpenPnl).toFixed(2);

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
    return '<div class="empty-cards-msg">Kırılım testi taranıyor.</div>';
  }
  return positions.map((p, idx) => {
    const isLong = p.side === 'LONG';
    const totOpenPnl = (p.pnl || 0) + (p.tp1Pnl || 0) + (p.tp2Pnl || 0);
    const initM = p.initialMargin || p.margin || 25;
    const totOpenRoi = initM > 0 ? (totOpenPnl / initM) * 100 : (p.roi || 0);
    const isWin = totOpenPnl >= 0;
    const stopText = p.beLocked
      ? (p.tp1Taken
          ? '<span class="badge-be" style="background:#059669;color:#fff;">🔒 RUNNER İZ SÜREN</span>'
          : '<span class="badge-be">🛡️ 1.0R BAŞABAŞ ($0 RİSK)</span>')
      : `<span class="badge-sl">🛑 STOP: -%${(p.slPct || CONFIG.slPct).toFixed(2)}</span>`;
    const roiStr = (totOpenRoi >= 0 ? '+' : '') + totOpenRoi.toFixed(1) + '%';
    const pnlStr = (totOpenPnl >= 0 ? '+$' : '-$') + Math.abs(totOpenPnl).toFixed(2);

    return `
      <div class="pos-card-mobile ${isLong ? 'card-long' : 'card-short'}">
        <div class="pos-card-header">
          <div style="display:flex;align-items:center;gap:6px;">
            <span class="pos-card-sym">${p.symbol}</span>
            <span class="${isLong ? 'badge-side-long' : 'badge-side-short'}">${isLong ? '▲ LONG ' : '▼ SHORT '}${p.leverage || CONFIG.leverage}x</span>
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

function renderLogs(rows) {
  if (!rows || rows.length === 0) {
    return '<div style="color:var(--muted);text-align:center;padding:12px;">Kayıt bekleniyor.</div>';
  }
  return rows.slice(0, 30).map(l => {
    return `
      <div style="display:flex;gap:10px;align-items:flex-start;padding:8px 10px;background:var(--panel);border-radius:8px;border:1px solid var(--border);">
        <span style="color:var(--muted);font-size:12px;white-space:nowrap;padding-top:1px;">${escapeHtml(l.time)}</span>
        <div style="color:var(--text-secondary);font-size:13px;line-height:1.45;">${escapeHtml(l.msg)}</div>
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

// 📡 PING VE UYKU ÖNLEYİCİ İSTATİSTİKLERİ
const pingStats = {
  total: 0,
  cronJobCount: 0,
  internalCount: 0,
  otherCount: 0,
  lastPingAt: null,
  lastCronJobAt: null,
  lastSource: null
};

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
    const mirrorTests = [];
    for (const m of BINANCE_FAPI_MIRRORS) {
      const t0 = Date.now();
      try {
        const c = new AbortController();
        const tid = setTimeout(() => c.abort(), 4000);
        const res = await fetch(`${m}/fapi/v1/ping`, { signal: c.signal });
        clearTimeout(tid);
        mirrorTests.push({ type: 'fapi', mirror: m, status: res.status, ok: res.ok, ms: Date.now() - t0 });
      } catch (e) {
        mirrorTests.push({ type: 'fapi', mirror: m, error: e.name === 'AbortError' ? 'TIMEOUT' : e.message, ms: Date.now() - t0 });
      }
    }
    for (const m of BINANCE_SPOT_MIRRORS) {
      const t0 = Date.now();
      try {
        const c = new AbortController();
        const tid = setTimeout(() => c.abort(), 4000);
        const res = await fetch(`${m}/api/v3/ping`, {
          signal: c.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
        });
        clearTimeout(tid);
        const text = await res.text();
        mirrorTests.push({ type: 'spot', mirror: m, status: res.status, ok: res.ok, ms: Date.now() - t0, body: text.slice(0, 150) });
      } catch (e) {
        mirrorTests.push({ type: 'spot', mirror: m, error: e.name === 'AbortError' ? 'TIMEOUT' : e.message, ms: Date.now() - t0 });
      }
    }

    const results = {
      fapiDownUntil: fapiDownUntil ? new Date(fapiDownUntil).toISOString() : 0,
      bookFeed,
      futuresSymbols: [...symbolFeed.values()].filter(v => v === 'futures').length,
      spotSymbols: [...symbolFeed.values()].filter(v => v === 'spot').length,
      activeSlots: `${activePositions.length}/${CONFIG.maxSlots}`,
      mirrorTests,
      positions: {}
    };
    for (const p of activePositions) {
      try {
        const t0 = Date.now();
        const pData = await fetchBinance(`/fapi/v1/ticker/price?symbol=${p.symbol}`);
        results.positions[p.symbol] = {
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
        results.positions[p.symbol] = { error: err.message };
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
    const userAgent = (req.headers['user-agent'] || 'unknown').toLowerCase();
    const isCronJob = userAgent.includes('cron-job') || userAgent.includes('cronjob');
    const isInternal = userAgent.includes('keepalive') || userAgent.includes('node') || userAgent.includes('undici');

    pingStats.total++;
    pingStats.lastPingAt = new Date().toISOString();

    if (isCronJob) {
      pingStats.cronJobCount++;
      pingStats.lastSource = 'cron-job.org';
      pingStats.lastCronJobAt = pingStats.lastPingAt;
      addLog(`📡 [CRON-JOB PING]: cron-job.org uyandırma sinyali alındı! (#${pingStats.cronJobCount})`, 'INFO');
    } else if (isInternal) {
      pingStats.internalCount++;
      pingStats.lastSource = 'internal_keepalive';
    } else {
      pingStats.otherCount++;
      pingStats.lastSource = req.headers['user-agent'] ? req.headers['user-agent'].slice(0, 50) : 'external';
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: "online",
      version: "1.1.0",
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      pingStats
    }, null, 2));
    return;
  }

  if (pathname === '/api/radar') {
    const tf = parsedUrl.searchParams.get('tf') || '15m';
    const items = tf === '15m' ? radarList : await scanRadarBoard(tf);
    const tagged = items.map(x => ({
      ...x,
      bot: tf === '15m' && (radarLeaderLong.has(x.symbol) || radarLeaderShort.has(x.symbol))
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tf, count: tagged.length, items: tagged }));
    return;
  }

  if (pathname === '/api/replay-backtest') {
    try {
      const hours = Number(parsedUrl.searchParams.get('hours')) || 72;
      const coins = Number(parsedUrl.searchParams.get('coins')) || 45;
      const result = await runHistoricalReplay(hours, coins);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
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
      report: buildTradeReport(),
      teamStatus: engineSnapshot(),
      dynamic: DYNAMIC,
      pingStats: pingStats,
      shadowCount: shadowSignals.length,
      feed: {
        book: bookFeed,
        futuresSymbols: [...symbolFeed.values()].filter(v => v === 'futures').length,
        spotSymbols: [...symbolFeed.values()].filter(v => v === 'spot').length,
        fapiBlockedForMin: Math.max(0, Math.round((fapiDownUntil - Date.now()) / 60000))
      }
    }));
    return;
  }

  if (pathname === '/api/shadows') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ count: shadowSignals.length, items: shadowSignals.slice(0, 100) }, null, 2));
    return;
  }

  if (pathname === '/api/team') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(engineSnapshot(), null, 2));
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
        const activeTpPnl = Array.isArray(activePositions) ? activePositions.reduce((acc, p) => acc + (p.tp1Pnl || 0) + (p.tp2Pnl || 0), 0) : 0;
        balance = CONFIG.initialBalance + totalPnl + activeTpPnl;

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
          const activeTpPnl = Array.isArray(activePositions) ? activePositions.reduce((acc, p) => acc + (p.tp1Pnl || 0) + (p.tp2Pnl || 0), 0) : 0;
          balance = (body.initialBalance || CONFIG.initialBalance) + totalPnl + activeTpPnl;
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
      try {
        const pData = await fetchBinance(`/fapi/v1/ticker/price?symbol=${closed.symbol}`);
        if (pData && pData.price) closed.currentPrice = parseFloat(pData.price);
      } catch (e) {}
      const isLong = closed.side === 'LONG';
      const curMove = closed.entryPrice > 0
        ? (isLong ? ((closed.currentPrice - closed.entryPrice) / closed.entryPrice) * 100 : ((closed.entryPrice - closed.currentPrice) / closed.entryPrice) * 100)
        : 0;
      const nom = (closed.margin || 0) * (closed.leverage || CONFIG.leverage || 15);
      const maker = Number(CONFIG.makerRate) || 0.0002;
      closed.grossPnl = nom * (curMove / 100);
      closed.feeUsd = nom * (maker + CONFIG.feeRate);
      closed.slipUsd = 0;
      closed.pnl = closed.grossPnl - closed.feeUsd;
      closed.roi = closed.margin > 0 ? (closed.pnl / closed.margin) * 100 : 0;
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
    DYNAMIC.mode = 'MARSCOIN_15M_WHALE';
    DYNAMIC.vol3hMin = 0.8;
    DYNAMIC.candidateSlice = 120;
    circuitOn = false;
    CONFIG.maxSlots = userRisk.maxSlots;
    CONFIG.marginPerTrade = userRisk.marginPerTrade;
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
      tp1: parsedUrl.searchParams.get('tp1'),
      tp2: parsedUrl.searchParams.get('tp2')
    });
    Object.assign(CONFIG, clean);
    rememberUserRisk();
    saveSettings();
    applyCircuitBreaker();
    addLog(`⚙️ Ayarlar kaydedildi: Slot ${CONFIG.maxSlots} | Teminat $${CONFIG.marginPerTrade} | ${CONFIG.leverage}x | SL %${CONFIG.slPct} | BE %${CONFIG.bePct} | TP1 %${CONFIG.tp1Pct} | TP2 %${CONFIG.tp2Pct} | Moon %${CONFIG.moonPct}`, 'INFO');

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

  if (pathname === '/api/download-shadow-csv' || pathname === '/api/export-shadow-csv') {
    const header = "\uFEFFID;Tarih;Koin;Yön;Aşama;Fiyat;ATR3m (%);3dk (%);Önceki 3dk (%);15dk (%);3s (%);24s (%);Kanal (%);Taker (%);1dk Sonra (%);3dk Sonra (%);5dk Sonra (%);15dk Sonra (%)\n";
    const rows = shadowSignals.map(s => [
      s.id || '',
      s.time || '',
      s.symbol || '',
      s.side || '',
      s.stage || '',
      s.entryPrice || s.price || 0,
      s.atr3m ?? '',
      s.cur3m ?? '',
      s.prev3m ?? '',
      s.chg15 ?? '',
      s.chg3h ?? '',
      s.chg24h ?? '',
      s.rangePos ?? '',
      s.taker ?? '',
      s.cp1m ?? s.post1mPct ?? '',
      s.cp3m ?? s.post3mPct ?? '',
      s.cp5m ?? s.post5mPct ?? '',
      s.cp15m ?? s.post15mPct ?? ''
    ].join(';')).join('\n');
    const csvBody = header + rows;
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="moonshot_shadow_signals.csv"'
    });
    res.end(csvBody, 'utf8');
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
      await fetch(`${KEEP_ALIVE_URL}/ping`, {
        headers: { 'User-Agent': 'Moonshot-Internal-KeepAlive/1.0' }
      });
    } catch(e) {}
  }, 4 * 60 * 1000);

  applyCircuitBreaker();
});
