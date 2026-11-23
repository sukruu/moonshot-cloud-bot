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

// --- EKRAN 1 BİREBİR AYARLARI (MARSCOIN V5 TRINITY — 15DK/1S BALİNA + BB DÖNÜŞ + GİZLİ DAĞITIM) ---
let CONFIG = {
  initialBalance: 100.0,     // Bakiye 100 Dolar
  marginPerTrade: 20.0,      // Referans teminat (Risk %'sine ve ATR15m stopa göre limitsiz bileşik ölçeklenir)
  riskPct: 6.0,              // Kasa bazlı bileşik işlem riski (%1.0 - %10.0 arası sol panelden ayarlanabilir, tavan yok!)
  riskPerTradeUsd: 6.00,     // Referans dolar riski
  leverage: 15,              // 15x kaldıraç (Likidasyon ~%6.0 uzaklıkta; maks SL %2.80'in 2 katından fazla güvenlik tamponu)
  maxSlots: 4,               // Max 4 pozisyon (Balina 4 slota kadar %100 risk; BB Dönüş & Gizli Dağıtım max 2 slot %50 risk!)
  slPct: 1.50,               // Baz stop (15dk ATR x 1.50 ile %1.00 - %2.80 arası otomatik esner)
  bePct: 1.50,               // LONG 1.0R / SHORT 0.75R kâr görünce stop +%0.15'e çekilir ($0 risk!)
  tp1Pct: 1.80,              // LONG 1.2R (0.70R aralık) / SHORT 0.90R (0.45R aralık) iz süren Runner devreye girer
  tp2Pct: 3.50,              // Referans kademe
  moonPct: 5.25,             // 🚀 LONG 5.0R / SHORT 3.5R Moonshot hedefi!
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
  candidateSlice: 200,
  regime: 'WHALE_15M',
  mode: 'MARSCOIN_15M_WHALE',
  updatedAt: 0
};

let userRisk = { maxSlots: 4, marginPerTrade: 20 };
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
  const severe = balance < Math.max(30, initial * 0.35) || dd >= 0.45;
  const profitGuard = !severe && dd >= 0.30;
  if (severe) {
    const nextMargin = Math.min(Number(userRisk.marginPerTrade) || 30, 10);
    const changed = !circuitOn || CONFIG.maxSlots !== 1 || CONFIG.marginPerTrade !== nextMargin;
    circuitOn = true;
    CONFIG.maxSlots = 1;
    CONFIG.marginPerTrade = nextMargin;
    DYNAMIC.mode = 'DEFENSIVE_SNIPER';
    if (changed) {
      addLog(`🛑 Devre kesici: kasa $${balance.toFixed(2)}, zirveden %${(dd * 100).toFixed(1)}. Slot 1, risk yarıya düşürüldü.`, 'RISK');
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
      entry: '3lü Motor · 15dk+1S Balina + BB',
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

const MAJOR_CRYPTO_SYMBOLS = new Set(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT']);
const NON_CRYPTO_OR_STABLE_EXACT = new Set([
  'USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'EURUSDT',
  'BFUSDUSDT', 'USD1USDT', 'RLUSDUSDT', 'RWUSDUSDT', 'USDEUSDT', 'USDPUSDT',
  'AMPUSDT', 'XAUTUSDT', 'PAXGUSDT', 'XAUUSDT', 'XAGUSDT', 'XPTUSDT', 'XPDUSDT',
  'CLUSDT', 'BZUSDT', 'NATGASUSDT', 'COPPERUSDT', 'DEFIUSDT', 'BTCDOMUSDT', 'ALLUSDT'
]);
const BANNED_SYMBOLS = new Set([...MAJOR_CRYPTO_SYMBOLS, ...NON_CRYPTO_OR_STABLE_EXACT]);

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

function isPureCryptoFuturesSymbol(sym) {
  if (!sym || !SYMBOL_REGEX_GLOBAL.test(sym) || sym.startsWith("USDC") || NON_CRYPTO_OR_STABLE_EXACT.has(sym)) return false;
  if (nonCryptoFuturesSymbols.has(sym)) return false;
  if (/(UP|DOWN|BULL|BEAR)USDT$/.test(sym)) return false;
  // Spot yedekte gelen ABD hisse senedi / ETF tokenlarını engelle
  if (sym.endsWith("BUSDT") && !KNOWN_CRYPTO_B.has(sym)) return false;
  return true;
}

function isTradableCryptoSymbol(sym) {
  if (MAJOR_CRYPTO_SYMBOLS.has(sym)) return false;
  return isPureCryptoFuturesSymbol(sym);
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
  const slots = num(s.slots), margin = num(s.margin), lev = num(s.lev), riskPct = num(s.riskPct);
  const sl = num(s.sl), be = num(s.be), moon = num(s.moon), tp1 = num(s.tp1), tp2 = num(s.tp2);
  if (inRange(slots, 1, 4)) out.maxSlots = Math.round(slots);
  if (inRange(margin, 6, 40)) out.marginPerTrade = margin;
  if (inRange(riskPct, 1.0, 10.0)) out.riskPct = Number(riskPct.toFixed(1));
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
      riskPct: CONFIG.riskPct,
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
      slots: saved.maxSlots, margin: saved.marginPerTrade, riskPct: saved.riskPct, lev: saved.leverage,
      sl: saved.slPct, be: saved.bePct, moon: saved.moonPct, tp1: saved.tp1Pct, tp2: saved.tp2Pct
    });
    // Eski 3dk scalp varsayılanlarından (SL 0.45/0.80/0.90) yeni 15dk Balina Motoruna (3.5R Runner) otomatik geçiş
    const isOldLegacy =
      (clean.slPct === 0.45 && clean.tp1Pct === 0.72) ||
      (clean.slPct === 0.90 && clean.tp1Pct === 0.75 && clean.moonPct === 2.80) ||
      (clean.slPct === 0.80 && (clean.tp1Pct === 0.48 || clean.tp1Pct === 0.90 || clean.tp1Pct === 1.20 || clean.tp1Pct === 1.60));
    if (isOldLegacy) {
      clean.leverage = 15;
      clean.riskPct = 7.5;
      clean.marginPerTrade = 20;
      clean.slPct = 1.50;
      clean.bePct = 1.50;
      clean.tp1Pct = 1.80;
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
    riskPct: CONFIG.riskPct,
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
      if (history.length > 0) {
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
  if (relativePath.includes('limit=1500') || relativePath.includes('limit=1000') || relativePath.includes('limit=500') || relativePath.includes('endTime=')) {
    return { ttlMs: 10 * 60 * 1000, staleMs: 30 * 60 * 1000 }; // Geçmiş Replay mumları 10 dk önbellekte kalır (429 rate-limit engeli!)
  }
  if (relativePath.includes('ticker/24hr')) {
    return { ttlMs: 8000, staleMs: 300000 }; // 8 sn taze, 5 dakika stale toleransı
  }
  if (relativePath.includes('interval=1d')) {
    return { ttlMs: 30 * 60 * 1000, staleMs: 60 * 60 * 1000 };
  }
  if (relativePath.includes('interval=15m')) {
    return { ttlMs: 15000, staleMs: 90000 }; // 15 sn taze (15m rollover kilitlenmesini önler)
  }
  if (relativePath.includes('interval=3m')) {
    return { ttlMs: 5000, staleMs: 25000 };
  }
  if (relativePath.includes('klines')) {
    return { ttlMs: 5000, staleMs: 25000 };
  }
  if (relativePath.includes('ticker/price')) {
    return { ttlMs: 1000, staleMs: 10000 };
  }
  return { ttlMs: 2000, staleMs: 15000 };
}

function normalizeBinanceRelativePath(url) {
  let relativePath = url;
  if (String(url).startsWith('http')) {
    try {
      const parsed = new URL(url);
      relativePath = parsed.pathname + parsed.search;
    } catch (e) {
      relativePath = String(url).replace(/^https?:\/\/[^\/]+/, '');
    }
  }
  return relativePath;
}

function invalidateBinanceCache(url) {
  binanceCache.delete(normalizeBinanceRelativePath(url));
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
        const reqTimeout = isBook ? 8000 : (relativePath.includes('limit=1500') || relativePath.includes('limit=1000') || relativePath.includes('limit=500') || relativePath.includes('endTime=') || relativePath.includes('exchangeInfo') ? 12000 : 5500);
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

  // Futures işlem/fiyat uçlarını (klines, exchangeInfo, bookTicker, ticker/price) ASLA Spot verisiyle kirletme!
  // Spot-Futures makası (%0.3-%0.8) sahte stop-loss veya yanlış Taker sinyaline yol açar; 1sn sonra Futures tekrar denenir.
  const allowSpotFallback =
    !relativePath.includes('/fapi/v1/klines') &&
    !relativePath.includes('/fapi/v1/exchangeInfo') &&
    !relativePath.includes('/fapi/v1/ticker/bookTicker') &&
    !relativePath.includes('/fapi/v1/ticker/price');
  if (!allowSpotFallback) {
    lastFeedError = errors.slice(0, 4).join(', ');
    return null;
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
  const relativePath = normalizeBinanceRelativePath(url);

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
        const storedAt = Date.now();
        binanceCache.set(relativePath, { data: fresh, ts: storedAt, staleUntil: storedAt + policy.staleMs });
        if (binanceCache.size > 1500) {
          const pruneNow = Date.now();
          for (const [k, v] of binanceCache.entries()) {
            if ((v.staleUntil || (v.ts + 120000)) < pruneNow) binanceCache.delete(k);
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

        btc15mNumeric = oldest15m > 0 ? ((p - oldest15m) / oldest15m) * 100 : 0;
        btc5mNumeric = oldest5m > 0 ? ((p - oldest5m) / oldest5m) * 100 : 0;

        const f15 = `${btc15mNumeric >= 0 ? '+' : ''}${btc15mNumeric.toFixed(2)}%`;
        btc15mTrend = `15m: ${f15}`;
        btc15mIsGreen = btc15mNumeric >= 0;
      }
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

  if (atr15 < 0.90 || atr15 > 3.50) return { approved: false, why: 'ATR15', ...diag };
  if (volMult < 2.50) return { approved: false, why: 'VOL_LOW', ...diag };
  // 🌋 Wyckoff Hacim Tükenişi (Climax) + Taze Hareket (Anti-Chase) + 🌀 Sıkışmış Yay (Coiled-Spring) Kalkanı:
  // - ATR 0.90..1.05 arası yatay sıkışmadan yeni patlayan koinlerde (WHALE_ATR15'e takılan %49 adayın kârlı kısmı):
  //   EMA20'ye yakın taze kalkış (distEma20 <= %3.00), en az %1.00 net 15dk mum boyu ve ≥%61 Taker baskısı aranır.
  //   (62.5g 102 koinde 3. slot kilidiyle birlikte işlem sayısını +%75 artırır: 80 -> 140 işlem, 6/6 dönem pozitif, MT $176.8 -> $277.0, DT $160.6 -> $240.8!)
  if (volMult > 8.00) return { approved: false, why: 'VOL_CLIMAX', ...diag };
  const isCoiledSpring = atr15 < 1.05;
  const maxDistAllowed = isCoiledSpring ? 3.00 : 4.00;
  if (distEma20 > maxDistAllowed) return { approved: false, why: 'EMA_STRETCH', ...diag };

  const minMoveReq = isCoiledSpring ? Math.max(1.00, atr15 * 0.90) : (atr15 * 0.90);
  const minTakerLong = isCoiledSpring ? 61.0 : 60.0;
  const maxTakerShort = isCoiledSpring ? 39.0 : 40.0;

  const longOk =
    move >= minMoveReq &&
    move <= atr15 * 2.40 &&
    c > ema20 &&
    ema20 > ema50 &&
    taker >= minTakerLong &&
    chg4h >= 2.0 &&
    chg4h <= 6.0 &&
    upperWick <= 0.45;

  const shortOk =
    move <= -minMoveReq &&
    move >= -atr15 * 2.40 &&
    c < ema20 &&
    ema20 < ema50 &&
    taker <= maxTakerShort &&
    chg4h <= -2.0 &&
    chg4h >= -6.0 &&
    lowerWick <= 0.45;

  if (longOk) {
    return {
      approved: true,
      engine: 'WHALE_15M',
      timeframe: '15m',
      isAux: false,
      riskMult: 1.0,
      exitMode: 'RUNNER',
      maxBars15: 32,
      side: 'LONG',
      score: 300 + (volMult * 15) + (Math.abs(move) * 10) + (taker - 50),
      ...diag
    };
  }
  if (shortOk) {
    return {
      approved: true,
      engine: 'WHALE_15M',
      timeframe: '15m',
      isAux: false,
      riskMult: 1.0,
      exitMode: 'RUNNER',
      maxBars15: 32,
      side: 'SHORT',
      score: 300 + (volMult * 15) + (Math.abs(move) * 10) + (50 - taker),
      ...diag
    };
  }
  return { approved: false, why: 'TREND_OR_TAKER', ...diag };
}

// ⏱️ ÇİFT MOTOR — 1 SAATLİK BALİNA KIRILIMI (15dk mumlardan 0 ek API maliyetiyle türetilir)
// 62.5g 102 koinde BTC 15dk rejimiyle hizalı tek başına Brutal DT: H1 +7.5R (%59 WR) & H2 +6.1R (%64 WR), LONG +4.0R & SHORT +9.6R!
// 15dk Balina ile birleştiğinde: 139 -> 192 işlem (+%38), WR %69.1 -> %69.3, PF 1.89 -> 2.01, 6/6 dönem pozitif!
function aggregate15mTo1h(k15m) {
  if (!Array.isArray(k15m) || k15m.length < 4) return [];
  const out = [];
  const stepMs = 3600000;
  let cur = null;
  for (let i = 0; i < k15m.length; i++) {
    const row = k15m[i];
    const ts = Number(row[0]) || 0;
    if (!ts) continue;
    const bucket = Math.floor(ts / stepMs) * stepMs;
    const o = parseFloat(row[1]) || 0;
    const h = parseFloat(row[2]) || 0;
    const l = parseFloat(row[3]) || 0;
    const c = parseFloat(row[4]) || 0;
    const v = parseFloat(row[5]) || 0;
    const q = parseFloat(row[7]) || 0;
    const tb = parseFloat(row[10]) || 0;
    if (!cur || cur.bucket !== bucket) {
      if (cur && cur.cnt === 4) out.push(cur);
      cur = { bucket, ts: bucket, lastTs15: ts, lastIdx15: i, o, h, l, c, v, q, tb, cnt: 1 };
    } else {
      if (h > cur.h) cur.h = h;
      if (l < cur.l) cur.l = l;
      cur.c = c;
      cur.v += v;
      cur.q += q;
      cur.tb += tb;
      cur.cnt++;
      cur.lastTs15 = ts;
      cur.lastIdx15 = i;
    }
  }
  if (cur && cur.cnt === 4) out.push(cur);
  return out;
}

function evaluateWhaleSpike1h(k1h, idx) {
  if (!Array.isArray(k1h) || idx < 55 || idx >= k1h.length) return null;
  let ema20 = k1h[0].c || 0;
  let ema50 = ema20;
  const k20 = 2 / 21;
  const k50 = 2 / 51;
  for (let i = 1; i <= idx; i++) {
    const ci = k1h[i].c || ema20;
    ema20 = ci * k20 + ema20 * (1 - k20);
    ema50 = ci * k50 + ema50 * (1 - k50);
  }
  const bar = k1h[idx];
  const o = bar.o, h = bar.h, l = bar.l, c = bar.c, v = bar.v, q = bar.q, tb = bar.tb;
  if (c <= 0 || o <= 0) return null;

  let trSum = 0;
  for (let m = idx - 14; m < idx; m++) {
    const pc = k1h[m - 1].c || 0;
    if (pc > 0) trSum += (Math.max(k1h[m].h - k1h[m].l, Math.abs(k1h[m].h - pc), Math.abs(k1h[m].l - pc)) / pc) * 100;
  }
  const atr1h = trSum / 14;

  let sumV = 0;
  for (let m = idx - 20; m < idx; m++) sumV += k1h[m].v || 0;
  const avgVol20 = sumV / 20;
  const volMult = avgVol20 > 0 ? v / avgVol20 : 1;

  const taker = q > 0 ? (tb / q) * 100 : 50;
  const move = ((c - o) / o) * 100;
  const open8h = k1h[idx - 8].o || o;
  const chg8h = open8h > 0 ? ((c - open8h) / open8h) * 100 : 0;
  const open4h = k1h[idx - 4].o || o;
  const chg4h = open4h > 0 ? ((c - open4h) / open4h) * 100 : 0;
  const open3h = k1h[idx - 3].o || o;
  const chg3h = open3h > 0 ? ((c - open3h) / open3h) * 100 : 0;

  let rg = 0, rl = 0;
  for (let m = idx - 14; m <= idx; m++) {
    const d = (k1h[m].c || 0) - (k1h[m - 1].c || 0);
    if (d > 0) rg += d; else rl -= d;
  }
  const rsi1h = rl === 0 ? 100 : 100 - (100 / (1 + (rg / rl)));

  const span = h - l;
  const upperWick = span > 0 ? (h - Math.max(c, o)) / span : 0;
  const lowerWick = span > 0 ? (Math.min(c, o) - l) / span : 0;
  const distEma20 = ema20 > 0 ? Math.abs((c - ema20) / ema20) * 100 : 0;
  const slPctOverride = Number(Math.max(1.20, Math.min(2.80, atr1h * 1.20)).toFixed(2));
  const diag = {
    timeframe: '1H', atr15: atr1h, atr1h, slPctOverride, volMult, taker, move,
    chg1h: move, chg3h, chg4h, chg8h, ema20, ema50, distEma20, rsi15: rsi1h,
    closePx: c, candleTs: bar.lastTs15
  };

  if (atr1h < 1.30 || atr1h > 5.50) return { approved: false, why: 'ATR1H', ...diag };
  if (volMult < 2.20 || volMult > 5.50) return { approved: false, why: volMult < 2.20 ? 'VOL_LOW' : 'VOL_CLIMAX', ...diag };
  if (distEma20 > 5.00) return { approved: false, why: 'EMA_STRETCH', ...diag };

  const longOk =
    move >= atr1h * 0.85 &&
    move <= atr1h * 2.30 &&
    c > ema20 &&
    ema20 > ema50 &&
    taker >= 60.0 &&
    chg8h >= 2.5 &&
    chg8h <= 9.0 &&
    upperWick <= 0.40;

  const shortOk =
    move <= -atr1h * 0.85 &&
    move >= -atr1h * 2.30 &&
    c < ema20 &&
    ema20 < ema50 &&
    taker <= 40.0 &&
    chg8h <= -2.5 &&
    chg8h >= -9.0 &&
    lowerWick <= 0.40;

  if (longOk) {
    return {
      approved: true,
      engine: 'WHALE_1H',
      isAux: false,
      riskMult: 1.0,
      exitMode: 'RUNNER',
      maxBars15: 32,
      side: 'LONG',
      score: 250 + (volMult * 14) + (Math.abs(move) * 7) + (taker - 50),
      ...diag
    };
  }
  if (shortOk) {
    return {
      approved: true,
      engine: 'WHALE_1H',
      isAux: false,
      riskMult: 1.0,
      exitMode: 'RUNNER',
      maxBars15: 32,
      side: 'SHORT',
      score: 250 + (volMult * 14) + (Math.abs(move) * 7) + (50 - taker),
      ...diag
    };
  }
  return { approved: false, why: 'TREND_OR_TAKER', ...diag };
}

// 🧲 3. MOTOR — V7 TEMİZLENMİŞ BB Z-SCORE AŞIRI ALIM DÖNÜŞÜ (BTC BOĞA + TESTERE'de 7/24 AKTİF!)
// 488 Koin 30g + 62.5g Dış-Örneklem Çift Doğrulamalı: RSI≥72, EMA20≥+%1.6, Satıcı≥%53, ATR 0.90–2.00, 15dk>-1.20%, 4s<+%9.0 (%69.8 WR, PF 1.63, 6/6 dönem pozitif!)
function evaluateBbSnapback15m(k, idx, btcReg, btc15m = 0) {
  if (!Array.isArray(k) || idx < 55 || idx >= k.length) return null;
  if (btcReg === 'BEAR' || btc15m > 0.25) return null;
  const o = parseFloat(k[idx][1]) || 0;
  const c = parseFloat(k[idx][4]) || 0;
  if (c <= 0 || o <= 0 || c >= o) return null; // Kırmızı teyit mumu şart!
  const move = ((c - o) / o) * 100;
  if (move <= -1.20) return null; // Zaten -%1.2+ çakılmış dibi kovalama (62.5g H1+H2 & 30g net negatif!)

  const q = parseFloat(k[idx][7]) || 0;
  const tb = parseFloat(k[idx][10]) || 0;
  const taker = q > 0 ? (tb / q) * 100 : 50;
  if (taker > 47.0) return null;

  let ema20 = parseFloat(k[0][4]) || 0;
  let ema50 = ema20;
  let avgG = 0, avgL = 0, rsiPrev = 50;
  for (let m = 1; m <= idx; m++) {
    const cm = parseFloat(k[m][4]) || ema20;
    const pm = parseFloat(k[m - 1][4]) || cm;
    ema20 = cm * (2 / 21) + ema20 * (19 / 21);
    ema50 = cm * (2 / 51) + ema50 * (49 / 51);
    const d = cm - pm, g = d > 0 ? d : 0, ls = d < 0 ? -d : 0;
    if (m <= 14) { avgG += g / 14; avgL += ls / 14; }
    else { avgG = (avgG * 13 + g) / 14; avgL = (avgL * 13 + ls) / 14; }
    if (m === idx - 1) rsiPrev = avgL === 0 ? 100 : 100 - (100 / (1 + avgG / avgL));
  }
  if (rsiPrev < 72.0) return null;

  const distPct = ema20 > 0 ? ((c - ema20) / ema20) * 100 : 0;
  if (distPct < 1.60) return null;

  // Önceki mumun (idx - 1) 20 barlık Bollinger Z-Skoru
  let mean = 0;
  for (let m = idx - 20; m <= idx - 1; m++) mean += parseFloat(k[m][4]) || 0;
  mean /= 20;
  let v2 = 0;
  for (let m = idx - 20; m <= idx - 1; m++) { const df = (parseFloat(k[m][4]) || 0) - mean; v2 += df * df; }
  const sd = Math.sqrt(v2 / 20);
  const prevC = parseFloat(k[idx - 1][4]) || 0;
  const bbzPrev = sd > 0 ? (prevC - mean) / sd : 0;
  if (bbzPrev < 2.30) return null;

  let trSum = 0;
  for (let m = idx - 14; m < idx; m++) {
    const hh = parseFloat(k[m][2]) || 0, ll = parseFloat(k[m][3]) || 0, pc = parseFloat(k[m - 1][4]) || 0;
    if (pc > 0) trSum += (Math.max(hh - ll, Math.abs(hh - pc), Math.abs(ll - pc)) / pc) * 100;
  }
  const atr15 = trSum / 14;
  if (atr15 < 0.90 || atr15 > 2.00) return null; // Aşırı oynak (ATR>2.0) short-squeeze koinlerini ele!

  const open4h = parseFloat(k[idx - 16][1]) || o;
  const chg4h = open4h > 0 ? ((c - open4h) / open4h) * 100 : 0;
  if (chg4h >= 9.0) return null; // 4s +%9+ parabolik roketlerin önüne geçme!

  let sumV = 0;
  for (let m = idx - 20; m < idx; m++) sumV += parseFloat(k[m][5]) || 0;
  const volMult = sumV > 0 ? (parseFloat(k[idx][5]) || 0) / (sumV / 20) : 1;
  if (volMult < 1.00) return null; // Ortalamanın altındaki (<1.0x) hacimsiz cılız kırmızı mumları ele (48s + 30g + 62.5g PF 1.68, DD %34.5!)
  const open1h = parseFloat(k[idx - 4][1]) || o;
  const open3h = parseFloat(k[idx - 12][1]) || o;
  const slPct = Number(Math.max(1.00, Math.min(2.80, atr15 * 1.50)).toFixed(2));
  const tpPctOverride = Number(Math.max(slPct * 1.15, distPct).toFixed(2));

  return {
    approved: true,
    engine: 'BB_MR',
    timeframe: 'BB',
    isAux: true,
    riskMult: 0.75,
    exitMode: 'SNAP_RUNNER',
    maxBars15: 16,
    side: 'SHORT',
    score: 100 + (bbzPrev * 12) + (50 - taker),
    slPctOverride: slPct,
    tpPctOverride,
    bbzPrev: Number(bbzPrev.toFixed(2)),
    atr15, volMult, taker, move,
    chg1h: open1h > 0 ? ((c - open1h) / open1h) * 100 : 0,
    chg3h: open3h > 0 ? ((c - open3h) / open3h) * 100 : 0,
    chg4h,
    ema20, ema50, distEma20: distPct, rsi15: rsiPrev,
    closePx: c, candleTs: Number(k[idx][0]) || 0
  };
}

// 🕵️ 4. MOTOR — GİZLİ BALİNA DAĞITIMI (Yeşil mumda yüksek hacim + ≥%58 agresif satıcı baskısı! BOĞA+TESTERE+AYI tüm rejimlerde kârlı!)
function evaluateHiddenDistrib15m(k, idx, btc15m = 0) {
  if (!Array.isArray(k) || idx < 55 || idx >= k.length) return null;
  if (btc15m > 0.30) return null;
  const o = parseFloat(k[idx][1]) || 0;
  const c = parseFloat(k[idx][4]) || 0;
  if (c <= 0 || o <= 0 || c <= o) return null; // Yeşil tuzak mumu şart!

  const q = parseFloat(k[idx][7]) || 0;
  const tb = parseFloat(k[idx][10]) || 0;
  const taker = q > 0 ? (tb / q) * 100 : 50;
  if (taker > 42.0) return null;

  let sumV = 0;
  for (let m = idx - 20; m < idx; m++) sumV += parseFloat(k[m][5]) || 0;
  const volMult = sumV > 0 ? (parseFloat(k[idx][5]) || 0) / (sumV / 20) : 1;
  if (volMult < 1.00) return null; // Ortalamanın altındaki (<1.0x) hacimsiz cılız kırmızı mumları ele (48s + 30g + 62.5g PF 1.68, DD %34.5!)
  if (volMult < 1.60) return null;

  let trSum = 0;
  for (let m = idx - 14; m < idx; m++) {
    const hh = parseFloat(k[m][2]) || 0, ll = parseFloat(k[m][3]) || 0, pc = parseFloat(k[m - 1][4]) || 0;
    if (pc > 0) trSum += (Math.max(hh - ll, Math.abs(hh - pc), Math.abs(ll - pc)) / pc) * 100;
  }
  const atr15 = trSum / 14;
  if (atr15 < 0.90 || atr15 > 3.50) return null;

  const move = ((c - o) / o) * 100;
  if (move < atr15 * 0.70) return null;

  let ema20 = parseFloat(k[0][4]) || 0, ema50 = ema20;
  let rg = 0, rl = 0;
  for (let m = 1; m <= idx; m++) {
    const cm = parseFloat(k[m][4]) || ema20;
    ema20 = cm * (2 / 21) + ema20 * (19 / 21);
    ema50 = cm * (2 / 51) + ema50 * (49 / 51);
  }
  for (let m = idx - 14; m <= idx; m++) {
    const d = (parseFloat(k[m][4]) || 0) - (parseFloat(k[m - 1][4]) || 0);
    if (d > 0) rg += d; else rl -= d;
  }
  const rsi15 = rl === 0 ? 100 : 100 - (100 / (1 + rg / rl));
  const open1h = parseFloat(k[idx - 4][1]) || o;
  const open3h = parseFloat(k[idx - 12][1]) || o;
  const open4h = parseFloat(k[idx - 16][1]) || o;
  const slPct = Number(Math.max(1.00, Math.min(2.80, atr15 * 1.50)).toFixed(2));

  return {
    approved: true,
    engine: 'HDIST',
    timeframe: 'GD',
    isAux: true,
    riskMult: 0.50,
    exitMode: 'RUNNER',
    maxBars15: 24,
    side: 'SHORT',
    score: 150 + (volMult * 10) + (50 - taker),
    slPctOverride: slPct,
    atr15, volMult, taker, move,
    chg1h: open1h > 0 ? ((c - open1h) / open1h) * 100 : 0,
    chg3h: open3h > 0 ? ((c - open3h) / open3h) * 100 : 0,
    chg4h: open4h > 0 ? ((c - open4h) / open4h) * 100 : 0,
    ema20, ema50, distEma20: ema20 > 0 ? Math.abs((c - ema20) / ema20) * 100 : 0, rsi15,
    closePx: c, candleTs: Number(k[idx][0]) || 0
  };
}

function simulateWhaleTrade15m(k, entryIdx, sig, riskUsd, forceSide = null) {
  const side = forceSide || sig.side;
  const isLong = side === 'LONG';
  const slPct = Number((sig.slPctOverride || Math.max(1.00, Math.min(2.80, sig.atr15 * 1.50))).toFixed(2));
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
  const maxBars = Number(sig.maxBars15) || 32;
  const isSnapRunner = sig.exitMode === 'SNAP_RUNNER';

  const tighten = (pct) => {
    const ns = lockSpot(pct);
    if ((isLong && ns > stopPrice) || (!isLong && ns < stopPrice)) stopPrice = ns;
  };

  const invRisk = riskUsd > 0 ? (1 / riskUsd) : 1;
  const packSim = (exitPx, barTs, b, maeFinal, grossPnl, feeUsd, reason) => ({
    side, entryPx, exitPx, slPct, nominal,
    entryTs: sig.candleTs + (15 * 60 * 1000),
    exitTs: barTs + (15 * 60 * 1000),
    durationMin: b * 15,
    mfe: Number(mfe.toFixed(2)),
    mae: Number(maeFinal.toFixed(2)),
    grossPnl: Number(grossPnl.toFixed(2)),
    feeUsd: Number(feeUsd.toFixed(2)),
    netPnl: Number((grossPnl - feeUsd).toFixed(2)),
    grossPer1R: grossPnl * invRisk,
    feePer1R: feeUsd * invRisk,
    netPer1R: (grossPnl - feeUsd) * invRisk,
    reason
  });

  for (let b = 1; b <= maxBars && (entryIdx + b) < k.length; b++) {
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
      return packSim(
        fill, Number(bar[0]), b, Math.max(mae, -advMove), grossPnl, feeUsd,
        trailing ? '🔒 Runner İz Süren Kâr' : (beLocked ? '🛡️ Başabaş ($0 Risk)' : `🛑 Stop Loss (-%${slPct.toFixed(2)})`)
      );
    }

    mfe = Math.max(mfe, favMove);
    mae = Math.max(mae, -advMove);

    if (isSnapRunner) {
      const tpGoal = Number(sig.tpPctOverride) || (slPct * 1.35);
      if (favMove >= tpGoal) {
        const grossPnl = nominal * (tpGoal / 100);
        const feeUsd = nominal * (maker + maker);
        return packSim(lockSpot(tpGoal), Number(bar[0]), b, mae, grossPnl, feeUsd, `🎯 BB Dönüş Hedefi (+%${tpGoal.toFixed(2)})`);
      }
      if (mfe >= slPct * 0.85) {
        tighten(mfe - (slPct * 0.40));
        trailing = true;
        beLocked = true;
      } else if (!beLocked && mfe >= slPct * 0.65 && closeMove > 0.20) {
        tighten(0.15);
        beLocked = true;
      }
    } else {
      const beMult = isLong ? 1.00 : 0.75;
      const trailStartMult = isLong ? 1.20 : 0.90;
      const trailGapMult = isLong ? 0.70 : 0.45;
      const moonMult = isLong ? 5.00 : 3.50;
      const tpGoal = slPct * moonMult;
      if (favMove >= tpGoal) {
        const grossPnl = nominal * (tpGoal / 100);
        const feeUsd = nominal * (maker + maker);
        return packSim(lockSpot(tpGoal), Number(bar[0]), b, mae, grossPnl, feeUsd, `🎯 ${moonMult.toFixed(1)}R Moonshot (+%${tpGoal.toFixed(2)})`);
      }

      if (isLong && mfe >= slPct * 3.00) {
        tighten(mfe - (slPct * 0.60));
        trailing = true;
        beLocked = true;
      } else if (!isLong && mfe >= slPct * 2.00) {
        tighten(mfe - (slPct * 0.50));
        trailing = true;
        beLocked = true;
      } else if (mfe >= slPct * trailStartMult) {
        tighten(mfe - (slPct * trailGapMult));
        trailing = true;
        beLocked = true;
      } else if (!beLocked && mfe >= slPct * beMult && closeMove > 0.20) {
        tighten(0.15);
        beLocked = true;
      }
    }

    if (b === maxBars || (entryIdx + b) === k.length - 1) {
      const grossPnl = nominal * (closeMove / 100);
      const feeUsd = nominal * (maker + taker);
      const hrsLbl = Math.round((maxBars * 15) / 60);
      return packSim(c, Number(bar[0]), b, mae, grossPnl, feeUsd, (entryIdx + b) === k.length - 1 ? '⏳ Açık (Son Mum)' : `⏱️ ${hrsLbl}s Süre Doldu`);
    }
  }
  return null;
}

// 🧭 BTC 15DK EMA20/EMA50 REJİM MOTORU (V5 TRINITY):
// - BULL: Balina LONG + BB Dönüş SHORT + Gizli Dağıtım SHORT
// - BEAR: Balina SHORT + Gizli Dağıtım SHORT
// - CHOP: BB Dönüş SHORT + Gizli Dağıtım SHORT (Bot 7/24 aktif!)
let liveBtcRegime = { ts: 0, regime: 'UNKNOWN', label: '⏳ BTC Rejimi hesaplanıyor', close: 0, ema20: 0, ema50: 0, btc15m: 0 };

function formatBtcRegimeLabel(regime) {
  if (regime === 'BULL') return '🟢 BTC BOĞA (Balina L + BB S)';
  if (regime === 'BEAR') return '🔴 BTC AYI (Balina 15dk+1S)';
  if (regime === 'CHOP') return '🟡 BTC TESTERE (BB Dönüş Aktif)';
  return '⏳ BTC Rejimi hesaplanıyor';
}

function buildBtcRegimeMap15m(btcKlines) {
  const byTs = new Map();
  const byMove = new Map();
  let latest = { ts: 0, regime: 'UNKNOWN', label: formatBtcRegimeLabel('UNKNOWN'), close: 0, ema20: 0, ema50: 0, btc15m: 0 };
  if (!Array.isArray(btcKlines) || btcKlines.length < 55) return { byTs, byMove, latest };
  let ema20 = parseFloat(btcKlines[0][4]) || 0;
  let ema50 = ema20;
  for (let i = 0; i < btcKlines.length; i++) {
    const o = parseFloat(btcKlines[i][1]) || 0;
    const c = parseFloat(btcKlines[i][4]) || ema20;
    if (i > 0) {
      ema20 = (c * (2 / 21)) + (ema20 * (19 / 21));
      ema50 = (c * (2 / 51)) + (ema50 * (49 / 51));
    }
    if (i >= 50) {
      let regime = 'CHOP';
      if (c > ema20 && ema20 > ema50) regime = 'BULL';
      else if (c < ema20 && ema20 < ema50) regime = 'BEAR';
      const ts = Number(btcKlines[i][0]) || 0;
      const btc15m = o > 0 ? ((c - o) / o) * 100 : 0;
      byTs.set(ts, regime);
      byMove.set(ts, btc15m);
      latest = { ts, regime, label: formatBtcRegimeLabel(regime), close: c, ema20, ema50, btc15m };
    }
  }
  return { byTs, byMove, latest };
}

async function fetchKlines15mPaged(sym, totalBars, bypassCache = true) {
  const want = Math.max(80, Math.min(3000, Math.round(totalBars)));
  const fetcher = bypassCache ? fetchBinanceRaw : fetchBinance;
  if (want <= 1500) {
    const pathUrl = `/fapi/v1/klines?symbol=${sym}&interval=15m&limit=${want}`;
    let k = await fetcher(pathUrl);
    if (!Array.isArray(k) || k.length < 75) {
      await new Promise(r => setTimeout(r, 400));
      k = await fetcher(pathUrl);
    }
    return Array.isArray(k) ? k : null;
  }
  const pages = Math.ceil(want / 1500);
  const chunks = [];
  let endTime = null;
  for (let p = 0; p < pages; p++) {
    const reqLimit = Math.min(1500, want - (p * 1500) + 10);
    const pathUrl = `/fapi/v1/klines?symbol=${sym}&interval=15m&limit=${reqLimit}` + (endTime ? `&endTime=${endTime}` : '');
    let k = null;
    for (let att = 0; att < 3; att++) {
      if (att > 0) await new Promise(r => setTimeout(r, 450 * att));
      k = await fetcher(pathUrl);
      if (Array.isArray(k) && k.length >= 20) break;
    }
    if (!Array.isArray(k) || k.length === 0) break;
    chunks.unshift(k);
    if (k.length < reqLimit - 20) break;
    endTime = Number(k[0][0]) - 1;
  }
  const merged = [];
  let lastTs = -1;
  for (const ch of chunks) {
    for (const row of ch) {
      const ts = Number(row[0]) || 0;
      if (ts <= lastTs) continue;
      lastTs = ts;
      merged.push(row);
    }
  }
  return merged.length >= 75 ? merged : null;
}

function classifyCoinTier(sym, price, vol24M) {
  if (MAJOR_CRYPTO_SYMBOLS.has(sym)) return 'MAJOR';
  if (price >= 0.008 && vol24M >= 10.0) return 'LIKIT_10M+';
  if (price >= 0.008 && vol24M >= 5.0) return 'LIKIT_5M_10M';
  if (vol24M >= 2.0) return 'ORTA_2M_5M';
  return 'DUSUK_<2M';
}

function analyzeCoinForReplay(sym, k, meta, btcRegime, cutoffTs, mode) {
  const n = k.length;
  const oArr = new Float64Array(n);
  const hArr = new Float64Array(n);
  const lArr = new Float64Array(n);
  const cArr = new Float64Array(n);
  const vArr = new Float64Array(n);
  const qArr = new Float64Array(n);
  const tbArr = new Float64Array(n);
  const tsArr = new Float64Array(n);
  const ema20Arr = new Float64Array(n);
  const ema50Arr = new Float64Array(n);
  const rsiArr = new Float64Array(n);
  const atr15Arr = new Float64Array(n);
  const avgVol20Arr = new Float64Array(n);

  let ema20 = 0, ema50 = 0, avgG = 0, avgL = 0;
  let volWin = 0, trWin = 0;
  const trArr = new Float64Array(n);

  let startPrice = 0, endPrice = 0, winHigh = 0, winLow = Infinity, atrSum = 0, atrCnt = 0;

  for (let i = 0; i < n; i++) {
    const row = k[i];
    const ts = Number(row[0]) || 0;
    const o = parseFloat(row[1]) || 0;
    const h = parseFloat(row[2]) || o;
    const l = parseFloat(row[3]) || o;
    const c = parseFloat(row[4]) || o;
    const v = parseFloat(row[5]) || 0;
    const q = parseFloat(row[7]) || 0;
    const tb = parseFloat(row[10]) || 0;
    tsArr[i] = ts; oArr[i] = o; hArr[i] = h; lArr[i] = l; cArr[i] = c; vArr[i] = v; qArr[i] = q; tbArr[i] = tb;

    if (i === 0) {
      ema20 = c; ema50 = c; rsiArr[0] = 50;
    } else {
      ema20 = c * (2 / 21) + ema20 * (19 / 21);
      ema50 = c * (2 / 51) + ema50 * (49 / 51);
      const d = c - cArr[i - 1];
      const g = d > 0 ? d : 0;
      const ls = d < 0 ? -d : 0;
      if (i <= 14) { avgG += g / 14; avgL += ls / 14; }
      else { avgG = (avgG * 13 + g) / 14; avgL = (avgL * 13 + ls) / 14; }
      rsiArr[i] = avgL === 0 ? 100 : (100 - (100 / (1 + (avgG / avgL))));
      const pc = cArr[i - 1];
      trArr[i] = pc > 0 ? (Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)) / pc) * 100 : 0;
    }
    ema20Arr[i] = ema20;
    ema50Arr[i] = ema50;

    if (i >= 1) trWin += trArr[i - 1];
    if (i > 14) trWin -= trArr[i - 15];
    atr15Arr[i] = i >= 14 ? (trWin / 14) : 0;

    if (i >= 1) volWin += vArr[i - 1];
    if (i > 20) volWin -= vArr[i - 21];
    avgVol20Arr[i] = i >= 20 ? (volWin / 20) : 0;

    if (ts >= cutoffTs && c > 0) {
      if (startPrice === 0) startPrice = o > 0 ? o : c;
      endPrice = c;
      if (h > winHigh) winHigh = h;
      if (l > 0 && l < winLow) winLow = l;
      if (atr15Arr[i] > 0) { atrSum += atr15Arr[i]; atrCnt++; }
    }
  }

  const periodChgPct = startPrice > 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0;
  const maxUpPct = startPrice > 0 && winHigh > 0 ? ((winHigh - startPrice) / startPrice) * 100 : 0;
  const maxDownPct = startPrice > 0 && winLow < Infinity ? ((winLow - startPrice) / startPrice) * 100 : 0;
  const avgAtr15 = atrCnt > 0 ? (atrSum / atrCnt) : 0;

  const coinStat = {
    symbol: sym,
    tier: meta.tier,
    vol24M: Number(meta.vol24M.toFixed(2)),
    chg24h: Number(meta.chg24h.toFixed(2)),
    startPrice: Number(startPrice.toFixed(6)),
    endPrice: Number(endPrice.toFixed(6)),
    periodChgPct: Number(periodChgPct.toFixed(2)),
    maxUpPct: Number(maxUpPct.toFixed(2)),
    maxDownPct: Number(maxDownPct.toFixed(2)),
    avgAtr15: Number(avgAtr15.toFixed(2)),
    totalSetups: 0,
    botSignals: 0,
    botNet: 0,
    botWins: 0,
    botWr: 0,
    allLongNet: 0,
    allLongWins: 0,
    allLongWr: 0,
    allShortNet: 0,
    allShortWins: 0,
    allShortWr: 0,
    bestSide: 'NOTR'
  };

  const calcBbzAt = (idx) => {
    if (idx < 20) return 0;
    let mean = 0;
    for (let m = idx - 19; m <= idx; m++) mean += cArr[m];
    mean /= 20;
    let v2 = 0;
    for (let m = idx - 19; m <= idx; m++) { const df = cArr[m] - mean; v2 += df * df; }
    const sd = Math.sqrt(v2 / 20);
    return sd > 0 ? (cArr[idx] - mean) / sd : 0;
  };

  const emitEvent = (sig, idx, btcReg, btc15m, botApproved, skipReason) => {
    const simLong = simulateWhaleTrade15m(k, idx, sig, 1.0, 'LONG');
    const simShort = simulateWhaleTrade15m(k, idx, sig, 1.0, 'SHORT');
    if (!simLong || !simShort) return null;
    const c = cArr[idx] || sig.closePx || 0;
    const e20 = ema20Arr[idx] || sig.ema20 || c;
    const e50 = ema50Arr[idx] || sig.ema50 || c;
    const ema20DistSigned = e20 > 0 ? ((c - e20) / e20) * 100 : 0;
    const emaTrend = (c > e20 && e20 > e50) ? 'YUKARI' : ((c < e20 && e20 < e50) ? 'ASAGI' : 'YATAY');
    const bbz = sig.bbzPrev != null ? Number(sig.bbzPrev) : Number(calcBbzAt(idx).toFixed(2));
    return {
      symbol: sym,
      tier: meta.tier,
      vol24M: coinStat.vol24M,
      timeframe: sig.timeframe || '15m',
      engine: sig.engine || 'WHALE_15M',
      isAux: !!sig.isAux,
      riskMult: sig.riskMult || 1.0,
      side: sig.side,
      score: Number(sig.score) || 0,
      candleTs: Number(sig.candleTs) || tsArr[idx],
      botApproved: !!botApproved,
      skipReason: skipReason || '-',
      btcReg: btcReg || 'CHOP',
      btc15m: Number((btc15m || 0).toFixed(2)),
      move15m: Number((sig.move || 0).toFixed(2)),
      volMult: Number((sig.volMult || 1).toFixed(2)),
      takerRaw: Number((sig.taker != null ? sig.taker : 50).toFixed(1)),
      rsi15: Number((sig.rsi15 != null ? sig.rsi15 : rsiArr[idx]).toFixed(1)),
      ema20Dist: Number(ema20DistSigned.toFixed(2)),
      emaTrend,
      bbz,
      chg1h: Number((sig.chg1h || 0).toFixed(2)),
      chg4h: Number((sig.chg4h || 0).toFixed(2)),
      atr15: Number((sig.atr15 || atr15Arr[idx] || 1).toFixed(2)),
      slPct: Number(simLong.slPct || 1.5),
      simLong,
      simShort
    };
  };

  const events = [];
  const seenEventKey = new Set();
  let lastMarketIdx = -100;

  for (let i = 60; i < n - 1; i++) {
    const ts = tsArr[i];
    if (ts < cutoffTs) continue;
    const btcReg = btcRegime.byTs.get(ts) || 'CHOP';
    const btc15m = btcRegime.byMove ? (btcRegime.byMove.get(ts) || 0) : 0;
    const q = qArr[i], tb = tbArr[i];
    const takerFast = q > 0 ? (tb / q) * 100 : 50;
    const volMultFast = avgVol20Arr[i] > 0 ? (vArr[i] / avgVol20Arr[i]) : 1;

    // 1. Öncelik: 15dk Balina Kırılımı (BTC BULL/BEAR hizalı)
    if ((btcReg === 'BULL' || btcReg === 'BEAR') && (takerFast <= 40 || takerFast >= 60) && volMultFast >= 2.45) {
      const sig = evaluateWhaleSpike15m(k, i);
      if (sig && sig.approved && ((sig.side === 'LONG' && btcReg === 'BULL') || (sig.side === 'SHORT' && btcReg === 'BEAR'))) {
        seenEventKey.add(ts);
        const ev = emitEvent(sig, i, btcReg, btc15m, true, '-');
        if (ev) events.push(ev);
        continue;
      }
    }

    // 2. Öncelik: BB Z-Score Aşırı Alım Dönüşü (BTC BOĞA + TESTERE'de 7/24 aktif)
    if (btcReg !== 'BEAR' && takerFast <= 47 && btc15m <= 0.25 && cArr[i] < oArr[i] && rsiArr[i - 1] >= 71.5) {
      const sigBb = evaluateBbSnapback15m(k, i, btcReg, btc15m);
      if (sigBb && sigBb.approved) {
        seenEventKey.add(ts);
        const ev = emitEvent(sigBb, i, btcReg, btc15m, true, '-');
        if (ev) events.push(ev);
        continue;
      }
    }

    // 3. Geniş Piyasa Analizi Modu: Mevcut botun pas geçtiği güçlü hareket ve aşırı RSI kurulumlarını da L vs S test et!
    if (mode === 'market' && (i - lastMarketIdx) >= 8) {
      const o = oArr[i], c = cArr[i];
      if (o <= 0 || c <= 0) continue;
      const move = ((c - o) / o) * 100;
      const atr15 = atr15Arr[i];
      const rsiPrev = rsiArr[i - 1];
      const distSigned = ema20Arr[i] > 0 ? ((c - ema20Arr[i]) / ema20Arr[i]) * 100 : 0;
      const isImpulse = volMultFast >= 2.20 && atr15 >= 0.65 && atr15 <= 6.50 && Math.abs(move) >= Math.max(0.95, atr15 * 0.90);
      const isRsiRev = atr15 >= 0.70 && atr15 <= 5.50 && ((rsiPrev >= 74 && c < o && distSigned >= 1.20) || (rsiPrev <= 26 && c > o && distSigned <= -1.20));
      if (isImpulse || isRsiRev) {
        lastMarketIdx = i;
        const candSide = isImpulse ? (move >= 0 ? 'LONG' : 'SHORT') : (rsiPrev >= 74 ? 'SHORT' : 'LONG');
        const open1h = oArr[i - 4] || o;
        const open4h = oArr[i - 16] || o;
        const chg1h = open1h > 0 ? ((c - open1h) / open1h) * 100 : 0;
        const chg4h = open4h > 0 ? ((c - open4h) / open4h) * 100 : 0;

        // Mevcut botun neden pas geçtiğini teşhis et
        let skipReason = 'FILTRE_DISI';
        if (meta.tier === 'MAJOR') skipReason = 'MAJOR_YASAKLI';
        else if (meta.tier !== 'LIKIT_10M+' && meta.tier !== 'LIKIT_5M_10M') skipReason = 'KOIN_HACIM_<5M';
        else if (isImpulse) {
          if (btcReg === 'CHOP') skipReason = 'BTC_CHOP';
          else if ((candSide === 'LONG' && btcReg !== 'BULL') || (candSide === 'SHORT' && btcReg !== 'BEAR')) skipReason = 'BTC_TERS';
          else if (atr15 < 0.90 || atr15 > 3.50) skipReason = 'ATR_DISI';
          else if (volMultFast < 2.50) skipReason = 'HACIM_<2.5x';
          else if (volMultFast > 8.00) skipReason = 'HACIM_CLIMAX';
          else if ((candSide === 'LONG' && takerFast < 60) || (candSide === 'SHORT' && takerFast > 40)) skipReason = 'TAKER_ZAYIF';
          else if (Math.abs(chg4h) < 2.0 || Math.abs(chg4h) > 6.0) skipReason = '4S_LIMIT_DISI';
          else skipReason = 'EMA_VEYA_FITIL';
        } else {
          if (candSide === 'LONG') skipReason = 'DIP_LONG_KAPALI';
          else if (btcReg === 'BEAR') skipReason = 'BTC_BEAR';
          else if (move <= -1.20) skipReason = 'MUM_COK_DUSTU';
          else if (atr15 > 2.00) skipReason = 'ATR_YUKSEK(>2)';
          else if (chg4h >= 9.0) skipReason = '4S_PARABOLIK';
          else if (volMultFast < 1.00) skipReason = 'HACIM_<1.0x';
          else if (takerFast > 47) skipReason = 'SATICI_ZAYIF';
          else skipReason = 'BBZ_VEYA_EMA';
        }

        const slPctEst = Number(Math.max(1.00, Math.min(2.80, atr15 * 1.50)).toFixed(2));
        const synthSig = {
          engine: isImpulse ? 'MARKET_IMPULSE' : 'MARKET_RSI',
          timeframe: isImpulse ? 'PIYASA' : 'RSI_D',
          isAux: false,
          riskMult: 1.0,
          exitMode: 'RUNNER',
          maxBars15: 32,
          side: candSide,
          score: 50 + (volMultFast * 8) + (Math.abs(move) * 6),
          slPctOverride: slPctEst,
          atr15, volMult: volMultFast, taker: takerFast, move,
          chg1h, chg4h, ema20: ema20Arr[i], ema50: ema50Arr[i],
          rsi15: isRsiRev ? rsiPrev : rsiArr[i],
          closePx: c, candleTs: ts
        };
        const ev = emitEvent(synthSig, i, btcReg, btc15m, false, skipReason);
        if (ev) events.push(ev);
      }
    }
  }

  // ⏱️ 1 SAATLİK BALİNA KIRILIMI (BTC 15dk BULL/BEAR rejimiyle hizalı)
  const k1h = aggregate15mTo1h(k);
  for (let j = 55; j < k1h.length; j++) {
    const lastTs15 = k1h[j].lastTs15;
    const idx15 = k1h[j].lastIdx15;
    if (lastTs15 < cutoffTs || idx15 >= n - 1) continue;
    if (seenEventKey.has(lastTs15)) continue;
    const btcReg = btcRegime.byTs.get(lastTs15);
    if (btcRegime.byTs.size > 0 && (!btcReg || btcReg === 'CHOP')) continue;
    const takerFast1h = k1h[j].q > 0 ? (k1h[j].tb / k1h[j].q) * 100 : 50;
    if (takerFast1h > 40 && takerFast1h < 60) continue;
    const sig1h = evaluateWhaleSpike1h(k1h, j);
    if (sig1h && sig1h.approved) {
      if (btcReg && ((sig1h.side === 'LONG' && btcReg !== 'BULL') || (sig1h.side === 'SHORT' && btcReg !== 'BEAR'))) continue;
      seenEventKey.add(lastTs15);
      const btc15m = btcRegime.byMove ? (btcRegime.byMove.get(lastTs15) || 0) : 0;
      const ev = emitEvent({ ...sig1h, timeframe: '1H' }, idx15, btcReg || 'CHOP', btc15m, true, '-');
      if (ev) events.push(ev);
    }
  }

  return { coinStat, events };
}

const replayCache = new Map();
const replayInFlightMap = new Map();
const replayJobs = new Map();
let replayJobSeq = 1;
let replaySerialQueue = Promise.resolve();

function estimateWeightPerCoin(barLimit) {
  if (barLimit < 500) return 2;
  if (barLimit <= 1000) return 5;
  if (barLimit <= 1500) return 10;
  return 20;
}

function buildGroupBreakdown(trades, keyFn, labelMap) {
  const map = new Map();
  for (const t of trades) {
    const k = keyFn(t);
    if (!map.has(k)) {
      map.set(k, { key: k, label: (labelMap && labelMap[k]) || k, count: 0, wins: 0, botNet: 0, allLongNet: 0, allLongWins: 0, allShortNet: 0, allShortWins: 0, mfeSum: 0, maeSum: 0 });
    }
    const g = map.get(k);
    g.count++;
    if (t.netPnl > 0.05) g.wins++;
    g.botNet += t.netPnl;
    g.allLongNet += t.longNet;
    if (t.longNet > 0.05) g.allLongWins++;
    g.allShortNet += t.shortNet;
    if (t.shortNet > 0.05) g.allShortWins++;
    g.mfeSum += (t.mfe || 0);
    g.maeSum += (t.mae || 0);
  }
  return [...map.values()].map(g => ({
    key: g.key,
    label: g.label,
    count: g.count,
    wins: g.wins,
    wr: g.count ? Number(((g.wins / g.count) * 100).toFixed(1)) : 0,
    botNet: Number(g.botNet.toFixed(2)),
    allLongNet: Number(g.allLongNet.toFixed(2)),
    allLongWr: g.count ? Number(((g.allLongWins / g.count) * 100).toFixed(1)) : 0,
    allShortNet: Number(g.allShortNet.toFixed(2)),
    allShortWr: g.count ? Number(((g.allShortWins / g.count) * 100).toFixed(1)) : 0,
    avgMfe: g.count ? Number((g.mfeSum / g.count).toFixed(2)) : 0,
    avgMae: g.count ? Number((g.maeSum / g.count).toFixed(2)) : 0
  })).sort((a, b) => b.count - a.count);
}

async function runHistoricalReplay(hours = 72, maxCoins = 120, opts = {}) {
  const hClamped = Math.max(12, Math.min(720, Math.round(Number(hours) || 72)));
  const scope = (opts.scope === 'all' || opts.scope === 'liquid') ? opts.scope : (Number(maxCoins) >= 200 ? 'all' : 'liquid');
  const mode = (opts.mode === 'market' || opts.mode === 'all_signals' || opts.mode === 'portfolio') ? opts.mode : 'portfolio';
  const cClamped = scope === 'all'
    ? 600
    : Math.max(15, Math.min(200, Math.round(Number(maxCoins) || (hClamped > 240 ? 110 : 170))));
  const replayRiskPct = Math.max(1.0, Math.min(10.0, Number(CONFIG.riskPct) || 6.0));
  const replayLev = Math.max(5, Math.min(40, Number(CONFIG.leverage) || 15));
  const replaySlots = Math.max(1, Math.min(4, Number(userRisk.maxSlots) || Number(CONFIG.maxSlots) || 4));
  const fixedRiskUsd = 10.0;
  const cacheKey = `${hClamped}:${scope}:${mode}:${cClamped}:${replayRiskPct}:${replayLev}:${replaySlots}`;
  const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
  const isCancelled = typeof opts.isCancelled === 'function' ? opts.isCancelled : (() => false);

  if (!opts.forceRefresh) {
    const cached = replayCache.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < 8 * 60 * 1000) {
      if (onProgress) onProgress({ doneCoins: cached.result.summary.coinsScanned, totalCoins: cached.result.summary.coinsTotal || cached.result.summary.coinsScanned, loadedCoins: cached.result.summary.coinsScanned, eventsFound: cached.result.summary.totalTrades, etaSec: 0, statusText: 'Önbellekten anında yüklendi!' });
      return cached.result;
    }
    if (replayInFlightMap.has(cacheKey) && !onProgress) return replayInFlightMap.get(cacheKey);
  }

  const prevJob = replaySerialQueue;
  let releaseQueue;
  replaySerialQueue = new Promise(r => { releaseQueue = r; });

  const p = (async () => {
    try {
      await prevJob.catch(() => {});
      if (isCancelled()) return { ok: false, cancelled: true, error: 'Tarama kullanıcı tarafından iptal edildi.' };
      if (!opts.forceRefresh) {
        const cachedAfterWait = replayCache.get(cacheKey);
        if (cachedAfterWait && (Date.now() - cachedAfterWait.ts) < 8 * 60 * 1000) return cachedAfterWait.result;
      }

      if (onProgress) onProgress({ doneCoins: 0, totalCoins: 0, loadedCoins: 0, eventsFound: 0, etaSec: 0, statusText: 'Binance Futures tüm koin listesi çekiliyor...' });
      await refreshExchangeInfoFilter();
      const tickers = await fetchBinance('/fapi/v1/ticker/24hr');
      if (!Array.isArray(tickers)) return { ok: false, error: 'Binance Futures verisi alınamadı.' };

      const valid = tickers.filter(t => {
        const price = parseFloat(t.lastPrice) || 0;
        const volM = (parseFloat(t.quoteVolume) || 0) / 1e6;
        if (price <= 0 || volM <= 0) return false;
        if (scope === 'all') return isPureCryptoFuturesSymbol(t.symbol);
        return isTradableCryptoSymbol(t.symbol) && price >= 0.008 && volM >= 5.0;
      });

      const metaBySym = new Map();
      for (const t of valid) {
        const price = parseFloat(t.lastPrice) || 0;
        const volM = (parseFloat(t.quoteVolume) || 0) / 1e6;
        const chg24h = parseFloat(t.priceChangePercent) || 0;
        metaBySym.set(t.symbol, {
          price,
          vol24M: volM,
          chg24h,
          tier: classifyCoinTier(t.symbol, price, volM)
        });
      }

      const byVol = [...valid].sort((a, b) => (parseFloat(b.quoteVolume) || 0) - (parseFloat(a.quoteVolume) || 0));
      const byMom = [...valid].sort((a, b) => Math.abs(parseFloat(b.priceChangePercent) || 0) - Math.abs(parseFloat(a.priceChangePercent) || 0));
      const picked = [];
      const seen = new Set();
      // Canlıda açık olan veya yeni kapanan koinler DAİMA listenin en başında!
      for (const pos of [...activePositions, ...history.slice(0, 5)]) {
        if (pos && pos.symbol && metaBySym.has(pos.symbol) && !seen.has(pos.symbol)) {
          seen.add(pos.symbol);
          picked.push(pos.symbol);
        }
      }
      const ordered = scope === 'all' ? byVol : [...byMom.slice(0, 65), ...byVol];
      for (const x of ordered) {
        if (!seen.has(x.symbol)) { seen.add(x.symbol); picked.push(x.symbol); }
        if (picked.length >= cClamped) break;
      }

      const barLimit = Math.min(2950, Math.max(300, Math.ceil(hClamped * 4) + 240));
      const wtPerCoin = estimateWeightPerCoin(barLimit);
      const totalWeightEst = picked.length * wtPerCoin;
      const fastBurst = totalWeightEst <= 1200;
      const chunkSize = fastBurst ? 12 : (wtPerCoin >= 20 ? 4 : (wtPerCoin >= 10 ? 6 : 8));
      const minChunkMs = fastBurst ? 260 : Math.ceil(((chunkSize * wtPerCoin) / 22) * 1000);

      if (onProgress) {
        const initEta = Math.ceil((picked.length / chunkSize) * (Math.max(minChunkMs, 480) / 1000));
        onProgress({ doneCoins: 0, totalCoins: picked.length, loadedCoins: 0, eventsFound: 0, etaSec: initEta, statusText: `BTC referans grafiği çekiliyor (${picked.length} koin sırada)...` });
      }

      const btcKlines = await fetchKlines15mPaged('BTCUSDT', barLimit, true);
      const btcRegime = buildBtcRegimeMap15m(btcKlines);
      const cutoffTs = Date.now() - (hClamped * 60 * 60 * 1000);

      const coinStatMap = new Map();
      const events = [];
      let loadedCoins = 0;
      let doneCoins = 0;
      const loopStartMs = Date.now();

      for (let i = 0; i < picked.length; i += chunkSize) {
        if (isCancelled()) return { ok: false, cancelled: true, error: 'Tarama kullanıcı tarafından iptal edildi.' };
        const chunkT0 = Date.now();
        const chunk = picked.slice(i, i + chunkSize);

        // Rate-limit koruması: YALNIZCA tüm fapi aynaları (429/418) beklemedeyse kısa nefes ver (ABD 451'i tek aynada görmezden gel!)
        const allMirrorsCooling = BINANCE_FAPI_MIRRORS.length > 0 && BINANCE_FAPI_MIRRORS.every(m => (fapiMirrorDownUntil.get(m) || 0) > Date.now());
        if (allMirrorsCooling) {
          if (onProgress) onProgress({ doneCoins, totalCoins: picked.length, loadedCoins, eventsFound: events.length, etaSec: 30, statusText: '⚠️ Binance hız limiti koruması aktif (5 sn bekleniyor)...' });
          await new Promise(r => setTimeout(r, 5000));
        }

        const part = await Promise.all(chunk.map(async sym => {
          try {
            const k = (sym === 'BTCUSDT' && Array.isArray(btcKlines) && btcKlines.length >= 75)
              ? btcKlines
              : await fetchKlines15mPaged(sym, barLimit, true);
            if (!Array.isArray(k) || k.length < 75) return null;
            return analyzeCoinForReplay(sym, k, metaBySym.get(sym), btcRegime, cutoffTs, mode);
          } catch (e) { return null; }
        }));

        for (const item of part) {
          if (!item) continue;
          loadedCoins++;
          coinStatMap.set(item.coinStat.symbol, item.coinStat);
          for (const ev of item.events) events.push(ev);
        }
        doneCoins = Math.min(picked.length, i + chunk.length);

        const elapsedMs = Math.max(1, Date.now() - loopStartMs);
        const msPerCoin = elapsedMs / Math.max(1, doneCoins);
        const remCoins = Math.max(0, picked.length - doneCoins);
        const etaSec = Math.ceil((remCoins * msPerCoin) / 1000);
        if (onProgress) {
          onProgress({
            doneCoins,
            totalCoins: picked.length,
            loadedCoins,
            eventsFound: events.length,
            etaSec,
            statusText: `⏳ ${doneCoins} / ${picked.length} koin tarandı (%${Math.round((doneCoins / Math.max(1, picked.length)) * 100)}) · ${events.length} kurulum · Kalan ~${etaSec} sn`
          });
        }

        if (i + chunkSize < picked.length) {
          const chunkElapsed = Date.now() - chunkT0;
          const waitMs = Math.max(fastBurst ? 80 : 120, minChunkMs - chunkElapsed);
          await new Promise(r => setTimeout(r, waitMs));
        }
      }

      // Uzun aralık + market modunda RAM koruması: tüm bot sinyallerini %100 koru, fazla market kurulumlarını en güçlü 15.000 ile sınırla
      let workingEvents = events;
      if (mode === 'market' && events.length > 15000) {
        const botEvs = events.filter(e => e.botApproved);
        const mktEvs = events.filter(e => !e.botApproved).sort((a, b) => b.score - a.score).slice(0, Math.max(2000, 15000 - botEvs.length));
        workingEvents = [...botEvs, ...mktEvs];
      }
      workingEvents.sort((a, b) => a.candleTs - b.candleTs || b.score - a.score);

      const trades = [];
      let bal = 100.0;
      let peak = 100.0;
      let maxDD = 0;
      let oppNetTotal = 0;
      let idSeq = 1;

      const buildTradeRecord = (ev, riskUsd, balanceSnapshot) => {
        const isLong = ev.side === 'LONG';
        const actSim = isLong ? ev.simLong : ev.simShort;
        const oppSim = isLong ? ev.simShort : ev.simLong;
        const grossPnl = Number((actSim.grossPer1R * riskUsd).toFixed(2));
        const feeUsd = Number((actSim.feePer1R * riskUsd).toFixed(2));
        const netPnl = Number((actSim.netPer1R * riskUsd).toFixed(2));
        const oppPnl = Number((oppSim.netPer1R * riskUsd).toFixed(2));
        const longNet = Number((ev.simLong.netPer1R * riskUsd).toFixed(2));
        const shortNet = Number((ev.simShort.netPer1R * riskUsd).toFixed(2));
        const bestSide = (longNet <= 0 && shortNet <= 0) ? 'IKISI_DE_ZARAR' : (longNet >= shortNet ? 'LONG' : 'SHORT');
        const sideCorrect = (bestSide === ev.side) ? 'EVET' : 'HAYIR';
        return {
          id: idSeq++,
          entryTime: trDateTime(actSim.entryTs),
          exitTime: trDateTime(actSim.exitTs),
          entryTs: actSim.entryTs,
          exitTs: actSim.exitTs,
          symbol: ev.symbol,
          tier: ev.tier,
          vol24M: ev.vol24M,
          tf: ev.timeframe,
          botApproved: ev.botApproved,
          skipReason: ev.skipReason,
          btcReg: ev.btcReg,
          btc15m: ev.btc15m,
          side: ev.side,
          entryPrice: Number(actSim.entryPx.toFixed(6)),
          exitPrice: Number(actSim.exitPx.toFixed(6)),
          slPct: actSim.slPct,
          move15m: ev.move15m,
          volMult: ev.volMult,
          taker: Number((isLong ? ev.takerRaw : (100 - ev.takerRaw)).toFixed(1)),
          takerRaw: ev.takerRaw,
          rsi15: ev.rsi15,
          ema20Dist: ev.ema20Dist,
          emaTrend: ev.emaTrend,
          bbz: ev.bbz,
          chg1h: ev.chg1h,
          chg4h: ev.chg4h,
          atr15: ev.atr15,
          mfe: actSim.mfe,
          mae: actSim.mae,
          durationMin: actSim.durationMin,
          reason: actSim.reason,
          riskUsd: Number(riskUsd.toFixed(2)),
          grossPnl,
          feeUsd,
          netPnl,
          oppPnl,
          longNet,
          longMfe: ev.simLong.mfe,
          longReason: ev.simLong.reason,
          shortNet,
          shortMfe: ev.simShort.mfe,
          shortReason: ev.simShort.reason,
          bestSide,
          sideCorrect,
          balanceAfter: Number(balanceSnapshot.toFixed(2))
        };
      };

      if (mode === 'portfolio') {
        const openSlots = [];
        const coinCd = {};
        const lossStreak = {};
        const settleSlot = (pSlot) => {
          bal += pSlot.netPnl;
          if (bal < 1) bal = 1;
          if (bal > peak) peak = bal;
          const dd = peak > 0 ? ((peak - bal) / peak) * 100 : 0;
          if (dd > maxDD) maxDD = dd;
          pSlot.ref.balanceAfter = Number(bal.toFixed(2));
          if (pSlot.netPnl <= -0.05) {
            lossStreak[pSlot.symbol] = (lossStreak[pSlot.symbol] || 0) + 1;
            const coolMin = lossStreak[pSlot.symbol] >= 2 ? 240 : 30;
            coinCd[pSlot.symbol] = Math.max(coinCd[pSlot.symbol] || 0, pSlot.exitTs + coolMin * 60 * 1000);
            if (lossStreak[pSlot.symbol] >= 2) lossStreak[pSlot.symbol] = 1;
          } else if (pSlot.netPnl > 0.05) {
            lossStreak[pSlot.symbol] = 0;
          }
        };

        const maxAuxSlots = Math.max(1, Math.min(3, replaySlots - 1));
        for (const ev of workingEvents) {
          if (!ev.botApproved) continue;
          const evEntryTs = ev.candleTs + (15 * 60 * 1000);
          openSlots.sort((a, b) => a.exitTs - b.exitTs);
          for (let j = 0; j < openSlots.length; ) {
            if (openSlots[j].exitTs <= evEntryTs) { settleSlot(openSlots[j]); openSlots.splice(j, 1); }
            else j++;
          }
          if (openSlots.length >= replaySlots) continue;
          if (openSlots.some(pSlot => pSlot.symbol === ev.symbol)) continue;
          if (ev.isAux && openSlots.filter(pSlot => pSlot.isAux).length >= maxAuxSlots) continue;
          if ((coinCd[ev.symbol] || 0) > evEntryTs) continue;

          const slPctEst = ev.slPct;
          const rawRiskUsd = Math.max(1.50, bal * (replayRiskPct / 100) * (ev.riskMult || 1.0));
          const reqNominal = rawRiskUsd / ((slPctEst + 0.09) / 100);
          const reqMargin = reqNominal / replayLev;
          const bookedMargin = openSlots.reduce((acc, pSlot) => acc + (pSlot.margin || 0), 0);
          const freeMargin = Math.max(0, bal - bookedMargin);
          const maxSlotMargin = Math.max(12.0, bal * (0.94 / replaySlots));
          const actualMargin = Math.min(reqMargin, freeMargin, maxSlotMargin);
          if (actualMargin < 6.0) continue;
          const riskUsd = rawRiskUsd * (actualMargin / reqMargin);

          const rec = buildTradeRecord(ev, riskUsd, bal);
          oppNetTotal += rec.oppPnl;
          openSlots.push({ symbol: ev.symbol, side: ev.side, isAux: !!ev.isAux, margin: actualMargin, exitTs: rec.exitTs, netPnl: rec.netPnl, ref: rec });
          coinCd[ev.symbol] = Math.max(coinCd[ev.symbol] || 0, rec.exitTs + (30 * 60 * 1000));
          trades.push(rec);
        }
        openSlots.sort((a, b) => a.exitTs - b.exitTs);
        for (const pSlot of openSlots) settleSlot(pSlot);
      } else {
        // 'all_signals' veya 'market': Slot limiti YOK, standart $10 sabit risk ile HER KOİNİ objektif kıyasla!
        let cumBal = 100.0;
        let cumPeak = 100.0;
        for (const ev of workingEvents) {
          if (mode === 'all_signals' && !ev.botApproved) continue;
          const riskUsd = fixedRiskUsd;
          const rec = buildTradeRecord(ev, riskUsd, cumBal);
          cumBal += rec.netPnl;
          if (cumBal > cumPeak) cumPeak = cumBal;
          const dd = cumPeak > 0 ? ((cumPeak - cumBal) / cumPeak) * 100 : 0;
          if (dd > maxDD) maxDD = dd;
          rec.balanceAfter = Number(cumBal.toFixed(2));
          oppNetTotal += rec.oppPnl;
          trades.push(rec);
        }
        bal = cumBal;
        peak = cumPeak;
      }

      // Her taranan koin için (sinyal üretmeyenler dahil!) koin özet tablosunu doldur
      for (const rec of trades) {
        const cs = coinStatMap.get(rec.symbol);
        if (!cs) continue;
        cs.totalSetups++;
        if (rec.botApproved) cs.botSignals++;
        cs.botNet += rec.netPnl;
        if (rec.netPnl > 0.05) cs.botWins++;
        cs.allLongNet += rec.longNet;
        if (rec.longNet > 0.05) cs.allLongWins++;
        cs.allShortNet += rec.shortNet;
        if (rec.shortNet > 0.05) cs.allShortWins++;
      }
      const coinSummary = [...coinStatMap.values()].map(cs => {
        const botNet = Number(cs.botNet.toFixed(2));
        const allLongNet = Number(cs.allLongNet.toFixed(2));
        const allShortNet = Number(cs.allShortNet.toFixed(2));
        const bestSide = cs.totalSetups === 0
          ? (cs.periodChgPct >= 2 ? 'TREND_LONG' : (cs.periodChgPct <= -2 ? 'TREND_SHORT' : 'YATAY'))
          : (allLongNet <= 0 && allShortNet <= 0 ? 'IKISI_DE_ZARAR' : (allLongNet >= allShortNet ? 'LONG' : 'SHORT'));
        return {
          ...cs,
          botNet,
          botWr: cs.totalSetups ? Number(((cs.botWins / cs.totalSetups) * 100).toFixed(1)) : 0,
          allLongNet,
          allLongWr: cs.totalSetups ? Number(((cs.allLongWins / cs.totalSetups) * 100).toFixed(1)) : 0,
          allShortNet,
          allShortWr: cs.totalSetups ? Number(((cs.allShortWins / cs.totalSetups) * 100).toFixed(1)) : 0,
          bestSide
        };
      }).sort((a, b) => {
        if ((b.totalSetups > 0) !== (a.totalSetups > 0)) return b.totalSetups > 0 ? 1 : -1;
        const magB = Math.max(Math.abs(b.allLongNet), Math.abs(b.allShortNet), Math.abs(b.botNet));
        const magA = Math.max(Math.abs(a.allLongNet), Math.abs(a.allShortNet), Math.abs(a.botNet));
        if (magB !== magA) return magB - magA;
        return b.vol24M - a.vol24M;
      });

      const sum = (arr, fn) => arr.reduce((a, x) => a + fn(x), 0);
      const wins = trades.filter(x => x.netPnl > 0.05);
      const losses = trades.filter(x => x.netPnl < -0.05);
      const longs = trades.filter(x => x.side === 'LONG');
      const shorts = trades.filter(x => x.side === 'SHORT');
      const botOnlyTrades = trades.filter(x => x.botApproved);
      const grossWins = sum(wins, x => x.netPnl);
      const grossLosses = Math.abs(sum(losses, x => x.netPnl));
      const allLongNet = Number(sum(trades, x => x.longNet).toFixed(2));
      const allShortNet = Number(sum(trades, x => x.shortNet).toFixed(2));
      const allLongWins = trades.filter(x => x.longNet > 0.05).length;
      const allShortWins = trades.filter(x => x.shortNet > 0.05).length;
      const botOnlyNet = Number(sum(botOnlyTrades, x => x.netPnl).toFixed(2));
      const botOnlyWins = botOnlyTrades.filter(x => x.netPnl > 0.05).length;

      const engineBreakdown = buildGroupBreakdown(trades, t => t.tf, {
        '15m': '🐋 15dk Balina',
        '1H': '⏱️ 1S Balina',
        'BB': '🧲 BB Dönüş',
        'PIYASA': '⚡ Piyasa İvme (Pas)',
        'RSI_D': '📉 Aşırı RSI (Pas)'
      });
      const tierBreakdown = buildGroupBreakdown(trades, t => t.tier, {
        'LIKIT_10M+': '💧 Likit (≥$10M)',
        'LIKIT_5M_10M': '💎 Mid-Likit ($5M-$10M)',
        'ORTA_2M_5M': '🪙 Orta ($2M-$5M)',
        'DUSUK_<2M': '🔬 Küçük (<$2M)',
        'MAJOR': '👑 Major (BTC/ETH/SOL/BNB)'
      });
      const regimeBreakdown = buildGroupBreakdown(trades, t => t.btcReg, {
        'BULL': '🟢 BTC Boğa',
        'BEAR': '🔴 BTC Ayı',
        'CHOP': '🟡 BTC Testere'
      });

      const result = {
        ok: true,
        generatedAt: trDateTime(),
        summary: {
          hours: hClamped,
          scope,
          mode,
          coinsTotal: picked.length,
          coinsScanned: loadedCoins,
          riskPct: replayRiskPct,
          leverage: replayLev,
          maxSlots: replaySlots,
          fixedRiskUsd,
          initialBalance: 100.0,
          finalBalance: Number(bal.toFixed(2)),
          netPnl: Number((bal - 100.0).toFixed(2)),
          roiPct: Number((bal - 100.0).toFixed(1)),
          peakBalance: Number(peak.toFixed(2)),
          maxDrawdownPct: Number(maxDD.toFixed(1)),
          totalTrades: trades.length,
          botApprovedTrades: botOnlyTrades.length,
          botApprovedNet: botOnlyNet,
          botApprovedWr: botOnlyTrades.length ? Number(((botOnlyWins / botOnlyTrades.length) * 100).toFixed(1)) : 0,
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
          allLongNet,
          allLongWr: trades.length ? Number(((allLongWins / trades.length) * 100).toFixed(1)) : 0,
          allShortNet,
          allShortWr: trades.length ? Number(((allShortWins / trades.length) * 100).toFixed(1)) : 0,
          oppositeNet: Number(oppNetTotal.toFixed(2)),
          engineBreakdown,
          tierBreakdown,
          regimeBreakdown
        },
        coinSummary,
        trades: trades.slice().reverse()
      };

      if (Array.isArray(btcKlines) && btcKlines.length >= Math.floor(barLimit * 0.80) && loadedCoins >= Math.floor(picked.length * 0.65)) {
        // RAM koruması: önbellekte en fazla 2 sonuç tut
        if (replayCache.size >= 2) {
          const oldestKey = replayCache.keys().next().value;
          if (oldestKey) replayCache.delete(oldestKey);
        }
        replayCache.set(cacheKey, { ts: Date.now(), result });
      }
      return result;
    } finally {
      replayInFlightMap.delete(cacheKey);
      if (releaseQueue) releaseQueue();
    }
  })();

  if (!onProgress) replayInFlightMap.set(cacheKey, p);
  return p;
}

function csvSafeCell(val) {
  return '"' + String(val == null ? '' : val).replace(/[\r\n;]+/g, ' ').replace(/"/g, '""') + '"';
}

function buildReplayTradesCsv(result) {
  const header = [
    'ID','Giris_Saati','Cikis_Saati','Koin','Koin_Kapsam','24s_Hacim_M',
    'Motor','Bot_Durumu','Pas_Nedeni','BTC_Rejim','BTC_15m_Pct',
    'Bot_Yonu','Giris_Fiyati','Cikis_Fiyati','Mum_15m_Pct','Hacim_Kati',
    'Taker_Alis_Pct','RSI_15m','EMA20_Uzaklik_Pct','EMA_Trend','BBZ_Skor',
    '1s_Pct','4s_Pct','ATR15m_Pct','SL_Pct','Risk_USD',
    'Bot_MFE_Pct','Bot_MAE_Pct','Bot_Sure_Dk','Bot_Cikis_Nedeni',
    'Bot_Brut_USD','Bot_Komisyon_USD','Bot_Net_USD',
    'LONG_Net_USD','LONG_MFE_Pct','LONG_Cikis',
    'SHORT_Net_USD','SHORT_MFE_Pct','SHORT_Cikis',
    'En_Iyi_Yon','Yon_Dogru_Mu','Kasa_Sonrasi_USD'
  ].join(';');
  const lines = [header];
  const rows = (result && Array.isArray(result.trades)) ? result.trades.slice().reverse() : [];
  for (const t of rows) {
    lines.push([
      t.id, csvSafeCell(t.entryTime), csvSafeCell(t.exitTime), t.symbol, t.tier || '-', t.vol24M != null ? t.vol24M : 0,
      t.tf || '15m', t.botApproved ? 'BOT_GIRER' : 'BOT_PAS_GECTI', csvSafeCell(t.skipReason || '-'), t.btcReg || 'CHOP', t.btc15m != null ? t.btc15m : 0,
      t.side, t.entryPrice, t.exitPrice, t.move15m != null ? t.move15m : 0, t.volMult,
      t.takerRaw != null ? t.takerRaw : t.taker, t.rsi15 != null ? t.rsi15 : 50, t.ema20Dist != null ? t.ema20Dist : 0, t.emaTrend || '-', t.bbz != null ? t.bbz : 0,
      t.chg1h != null ? t.chg1h : 0, t.chg4h, t.atr15, t.slPct, t.riskUsd != null ? t.riskUsd : 10,
      t.mfe, t.mae, t.durationMin, csvSafeCell(t.reason || ''),
      t.grossPnl, t.feeUsd, t.netPnl,
      t.longNet != null ? t.longNet : 0, t.longMfe != null ? t.longMfe : 0, csvSafeCell(t.longReason || ''),
      t.shortNet != null ? t.shortNet : 0, t.shortMfe != null ? t.shortMfe : 0, csvSafeCell(t.shortReason || ''),
      t.bestSide || '-', t.sideCorrect || '-', t.balanceAfter
    ].join(';'));
  }
  return '\uFEFF' + lines.join('\r\n');
}

function buildReplayCoinsCsv(result) {
  const header = [
    'Sira','Koin','Koin_Kapsam','24s_Hacim_M','24s_Degisim_Pct',
    'Donem_Bas_Fiyat','Donem_Son_Fiyat','Donem_Degisim_Pct',
    'Max_Yukselis_Pct','Max_Dusus_Pct','Ort_ATR15m_Pct',
    'Sinyal_Sayisi','Bot_Girer_Sayisi','Bot_Net_USD','Bot_WinRate_Pct',
    'Hep_LONG_Net_USD','LONG_WinRate_Pct','Hep_SHORT_Net_USD','SHORT_WinRate_Pct','En_Karli_Yon'
  ].join(';');
  const lines = [header];
  const rows = (result && Array.isArray(result.coinSummary)) ? result.coinSummary : [];
  rows.forEach((c, idx) => {
    lines.push([
      idx + 1, c.symbol, c.tier || '-', c.vol24M, c.chg24h,
      c.startPrice, c.endPrice, c.periodChgPct,
      c.maxUpPct, c.maxDownPct, c.avgAtr15,
      c.totalSetups, c.botSignals, c.botNet, c.botWr,
      c.allLongNet, c.allLongWr, c.allShortNet, c.allShortWr, c.bestSide
    ].join(';'));
  });
  return '\uFEFF' + lines.join('\r\n');
}

function startReplayJob(hours = 48, scope = 'all', mode = 'market', forceRefresh = false) {
  const hClamped = Math.max(12, Math.min(720, Math.round(Number(hours) || 48)));
  const sNorm = scope === 'liquid' ? 'liquid' : 'all';
  const mNorm = (mode === 'portfolio' || mode === 'all_signals' || mode === 'market') ? mode : 'market';
  const jobKey = `${hClamped}:${sNorm}:${mNorm}:${CONFIG.riskPct}:${CONFIG.leverage}:${userRisk.maxSlots || CONFIG.maxSlots}`;

  // Aynı iş zaten çalışıyorsa ona bağlan
  for (const j of replayJobs.values()) {
    if (j.key === jobKey && j.status === 'running' && !j.cancelled) {
      return j;
    }
    if (!forceRefresh && j.key === jobKey && j.status === 'done' && (Date.now() - j.finishedAt) < 8 * 60 * 1000) {
      return j;
    }
  }

  // RAM koruması: eski tamamlanmış işleri temizle (en fazla 2 iş tut)
  if (replayJobs.size >= 3) {
    for (const [jid, j] of replayJobs.entries()) {
      if (j.status !== 'running') {
        replayJobs.delete(jid);
        if (replayJobs.size < 3) break;
      }
    }
  }

  const jobId = `rp_${Date.now()}_${replayJobSeq++}`;
  const job = {
    jobId,
    key: jobKey,
    hours: hClamped,
    scope: sNorm,
    mode: mNorm,
    status: 'running',
    cancelled: false,
    startedAt: Date.now(),
    finishedAt: 0,
    doneCoins: 0,
    totalCoins: 0,
    loadedCoins: 0,
    eventsFound: 0,
    etaSec: 0,
    statusText: 'Tarama başlatılıyor...',
    error: null,
    result: null
  };
  replayJobs.set(jobId, job);

  runHistoricalReplay(hClamped, sNorm === 'all' ? 600 : (hClamped > 240 ? 110 : 170), {
    scope: sNorm,
    mode: mNorm,
    forceRefresh,
    isCancelled: () => job.cancelled,
    onProgress: (p) => {
      job.doneCoins = p.doneCoins || 0;
      job.totalCoins = p.totalCoins || 0;
      job.loadedCoins = p.loadedCoins || 0;
      job.eventsFound = p.eventsFound || 0;
      job.etaSec = p.etaSec || 0;
      job.statusText = p.statusText || job.statusText;
    }
  }).then(res => {
    job.finishedAt = Date.now();
    if (job.cancelled || (res && res.cancelled)) {
      job.status = 'cancelled';
      job.error = 'Tarama iptal edildi.';
      job.statusText = '⏹️ Tarama iptal edildi.';
    } else if (res && res.ok) {
      job.status = 'done';
      job.result = res;
      job.doneCoins = res.summary.coinsTotal || res.summary.coinsScanned;
      job.totalCoins = res.summary.coinsTotal || res.summary.coinsScanned;
      job.loadedCoins = res.summary.coinsScanned;
      job.eventsFound = res.summary.totalTrades;
      job.etaSec = 0;
      job.statusText = '✅ Tarama tamamlandı!';
    } else {
      job.status = 'error';
      job.error = (res && res.error) || 'Replay hatası.';
      job.statusText = '❌ ' + job.error;
    }
  }).catch(err => {
    job.finishedAt = Date.now();
    job.status = 'error';
    job.error = err.message || 'Bilinmeyen hata';
    job.statusText = '❌ ' + job.error;
  });

  return job;
}

// 2. CANLI TARAMA (350+ KOİN BALİNA & MOONSHOT AVCISI)
let lastScanHeartbeat = 0;
async function scanLoop() {
  if (isScanRunning || !isBotActive) return;
  isScanRunning = true;
  const scanEpoch = resetEpoch;
  try {
    applyCircuitBreaker();
    await refreshExchangeInfoFilter();
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
    // 🛑 ACİL DURUM GÜNLÜK KAYIP TABANI (ORANSAL: KASANIN %25'İ, MİN $25)
    const maxDailyLossUsd = Math.max(25, Number((balance * 0.25).toFixed(2)));
    if (todayNetPnl() <= -maxDailyLossUsd) {
      if (Date.now() - lastScanHeartbeat > 120000) {
        lastScanHeartbeat = Date.now();
        addLog(`⏸️ Günlük zarar limiti (-$${maxDailyLossUsd.toFixed(0)} / -%25). Yeni işlem yok.`, 'RISK');
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

      const cappedDailyChg = Math.min(Math.abs(rawChg), 45.0);
      const hotScore = (Math.abs(rollMovePct) * 25) + (cappedDailyChg * 1.5) + Math.min(volM * 0.15, 20) + (isVip ? 15 : 0);

      return {
        ...t,
        volM,
        chg: rawChg,
        rollMovePct,
        hotScore,
        isVip
      };
    })
    // 🚀 V7 CANLI EVREN: TÜM LİKİT & MİD-LİKİT SAF KRİPTO FUTURES'LAR (≥$5M, ~150+ koin kesintisiz!) TARANIR!
    .filter(t => t.volM >= 5 && t.chg <= 80 && t.chg >= -50)
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, Math.max(220, Number(DYNAMIC.candidateSlice) || 220));

    const secIn15mNow = Math.floor((now / 1000) % 900);
    const expectedClosedTs = (Math.floor(now / 900000) * 900000) - 900000;

    // 🧭 BTC 15dk EMA20/EMA50 Rejimini tazele (250 mum: Replay ile %0.00 sapma + taze rollover cache koruma!)
    if (liveBtcRegime.ts !== expectedClosedTs && (liveBtcRegime.regime === 'UNKNOWN' || secIn15mNow >= 4)) {
      try {
        const btcPath = '/fapi/v1/klines?symbol=BTCUSDT&interval=15m&limit=250';
        const btcK = await fetchBinance(btcPath);
        if (Array.isArray(btcK) && btcK.length >= 60) {
          const closedBtcIdx = btcK.length - 2;
          const closedBtcTs = Number(btcK[closedBtcIdx][0]) || 0;
          if (closedBtcTs !== expectedClosedTs) {
            invalidateBinanceCache(btcPath); // Binance henüz yeni mumu kapatmadıysa 15s cache kilidini anında kır!
          }
          if (closedBtcTs === expectedClosedTs || liveBtcRegime.regime === 'UNKNOWN') {
            liveBtcRegime = buildBtcRegimeMap15m(btcK.slice(0, closedBtcIdx + 1)).latest;
          }
        }
      } catch (e) {}
    }

    if (now - lastScanHeartbeat > 60000 && topCandidates.length > 0) {
      lastScanHeartbeat = now;
      const windowLbl = (secIn15mNow >= 4 && secIn15mNow <= 180)
        ? '⚡ 15dk Kapanış Taraması AÇIK'
        : `⏳ Sonraki 15dk mum: ${Math.ceil((900 - secIn15mNow) / 60)} dk`;
      addLog(`🐋 [V7 Trinity Tarayıcı]: ${validTickers.length} Saf Kripto (${topCandidates.length} Likit Aday ≥$5M) | ${liveBtcRegime.label} | Lider: ${topCandidates[0].symbol} (24s: %${topCandidates[0].chg.toFixed(1)}) | ${windowLbl} | Slot: ${activePositions.length}/${CONFIG.maxSlots}`);
    }

    if (!global.whaleEvaluatedCandles) global.whaleEvaluatedCandles = new Map();

    // 🛡️ API AĞIRLIK KORUMASI & REPLAY 1-E-1 EŞİTLEME:
    // Yalnızca 15dk mum kapandıktan hemen sonra (4sn..180sn) tara ve her koini o kapanış için YALNIZCA 1 KEZ değerlendir!
    if (secIn15mNow < 4 || secIn15mNow > 180) {
      return;
    }

    // 🧭 BTC Rejimi henüz yeni mumu görmediyse 5sn bekle; V5 Trinity'de TESTERE (CHOP) iken bile BB Dönüş + Gizli Dağıtım aktiftir!
    if (liveBtcRegime.ts !== expectedClosedTs) {
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
        const k15mPath = `/fapi/v1/klines?symbol=${sym}&interval=15m&limit=480`;
        const k15m = await fetchBinance(k15mPath);
        return { sym, lastP, k15m, k15mPath, chg: parseFloat(item.priceChangePercent) || 0, isVip: item.isVip, volM: item.volM };
      }));

      for (const data of chunkData) {
        if (!data || !data.k15m || data.k15m.length < 65) continue;
        if (activePositions.length >= CONFIG.maxSlots) break;

        const { sym, lastP, k15m, k15mPath, chg } = data;
        if (activePositions.some(x => x.symbol === sym) || activeSyms.has(sym) || (coinCooldowns[sym] && coinCooldowns[sym] > Date.now())) continue;
        if (coinLossCount[sym] >= 2) {
          if (coinCooldowns[sym] && coinCooldowns[sym] > Date.now()) continue;
          coinLossCount[sym] = 1;
        }

        const lastIdx = k15m.length - 1;
        const closedIdx = lastIdx - 1;
        const curP = parseFloat(k15m[lastIdx][4]) || lastP;

        // 🕐 KESİN KAPALI 15DK MUM ONAYI (Replay ile %100 aynı mum!)
        const targetCandleTs = Number(k15m[closedIdx][0]) || 0;
        if (targetCandleTs !== expectedClosedTs) {
          invalidateBinanceCache(k15mPath); // Eski mum önbellekte kalıp 35sn dondurmasın; 5sn sonraki turda taze çek!
          continue;
        }
        if (global.whaleEvaluatedCandles.get(sym) === targetCandleTs) continue;
        global.whaleEvaluatedCandles.set(sym, targetCandleTs);

        const btcRegNow = liveBtcRegime.regime || 'CHOP';
        const btc15mNow = Number(liveBtcRegime.btc15m) || 0;
        let sig = null;
        let whaleDiag = null;
        // 1. Öncelik: 15dk Balina Kırılımı (BTC BULL/BEAR hizalı)
        if (btcRegNow === 'BULL' || btcRegNow === 'BEAR') {
          whaleDiag = evaluateWhaleSpike15m(k15m, closedIdx);
          if (whaleDiag && whaleDiag.approved && ((whaleDiag.side === 'LONG' && btcRegNow === 'BULL') || (whaleDiag.side === 'SHORT' && btcRegNow === 'BEAR'))) {
            sig = whaleDiag;
          }
          // 2. Öncelik: 1 Saatlik Balina Kırılımı (:00 tam saat kapanışı)
          const isHourClose = (targetCandleTs % 3600000) === 2700000;
          if (!sig && isHourClose && k15m.length >= 240) {
            const k1h = aggregate15mTo1h(k15m.slice(0, closedIdx + 1));
            if (k1h.length >= 56 && k1h[k1h.length - 1].lastTs15 === targetCandleTs) {
              const sig1h = evaluateWhaleSpike1h(k1h, k1h.length - 1);
              if (sig1h && sig1h.approved && ((sig1h.side === 'LONG' && btcRegNow === 'BULL') || (sig1h.side === 'SHORT' && btcRegNow === 'BEAR'))) {
                sig = sig1h;
              }
            }
          }
        }
        // 3. Öncelik: BB Z-Score Aşırı Alım Dönüşü (RSI≥75, EMA20≥+%2.2, Satıcı≥%55 — BTC BOĞA + TESTERE'de 7/24 aktif!)
        if (!sig) {
          const sigBb = evaluateBbSnapback15m(k15m, closedIdx, btcRegNow, btc15mNow);
          if (sigBb && sigBb.approved) sig = sigBb;
        }
        if (!sig) {
          if (whaleDiag && whaleDiag.volMult >= 1.8) {
            recordShadowSignal({
              symbol: sym, side: whaleDiag.side || (whaleDiag.move >= 0 ? 'LONG' : 'SHORT'),
              stage: `WHALE_${whaleDiag.why}`, price: curP,
              chg15: Number((whaleDiag.move || 0).toFixed(2)),
              chg3h: Number((whaleDiag.chg3h || 0).toFixed(2)),
              chg24h: Number(chg.toFixed(2)), rangePos: 50,
              taker: Number((whaleDiag.taker || 50).toFixed(1)),
              cur3m: Number((whaleDiag.move || 0).toFixed(2)),
              prev3m: Number((whaleDiag.chg1h || 0).toFixed(2)),
              atr3m: Number((whaleDiag.atr15 || 0).toFixed(2)),
              signal: '⚖️ NÖTR', volMult: Number(whaleDiag.volMult.toFixed(2))
            });
          }
          continue;
        }

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
          signal: sig.approved ? (sig.side === 'LONG' ? '🐋🚀 BALİNA BOĞA' : (sig.engine === 'BB_MR' ? '🧲 BB DÖNÜŞ' : (sig.engine === 'HDIST' ? '🕵️ GİZLİ DAĞITIM' : '🐋🩸 BALİNA AYI'))) : '⚖️ NÖTR', ...extra
        });

        // Fiyat kapalı mumdan çok uzaklaştıysa (%1.10+) kovalama
        const driftPct = sig.closePx > 0 ? Math.abs((curP - sig.closePx) / sig.closePx) * 100 : 0;
        if (driftPct > 1.10) {
          shadow('DRIFT_SKIP', { driftPct: Number(driftPct.toFixed(2)) });
          continue;
        }
        // Balina trend sinyallerinde canlı fiyat hâlâ EMA20'nin doğru tarafında olmalı (BB/Dağıtım ters dönüş olduğu için EMA20 üstünde short açar!)
        if (!sig.isAux && ((sig.side === 'LONG' && curP <= sig.ema20) || (sig.side === 'SHORT' && curP >= sig.ema20))) {
          shadow('EMA_LOST');
          continue;
        }

        const side = sig.side;

        let judgeClearance = null;
        try {
          judgeClearance = evaluatePreTradeClearance(sym, side, {
            strategy: sig.engine || 'WHALE_15M',
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

        // 🚀 TRINITY RİSK BÜTÇESİ: Balina (15dk+1S) %100 risk, BB Dönüş & Gizli Dağıtım %50 risk (Limitsiz Bileşik!)
        const tradeSlPct = Number((sig.slPctOverride || Math.max(1.00, Math.min(2.80, sig.atr15 * 1.50))).toFixed(2));
        const cfgRiskPct = Math.max(1.0, Math.min(10.0, Number(CONFIG.riskPct) || 6.0));
        const engineRiskMult = Number(sig.riskMult) || 1.0;
        const equityRiskUsd = Math.max(1.50, Number((balance * (cfgRiskPct / 100) * engineRiskMult).toFixed(2)));
        const targetRiskUsd = circuitOn ? Math.max(1.50, Number((equityRiskUsd * 0.50).toFixed(2))) : equityRiskUsd;
        const effectiveStopCostPct = tradeSlPct + 0.09;
        const targetNominal = targetRiskUsd / (effectiveStopCostPct / 100);
        const levNow = Math.max(5, Math.min(40, Number(CONFIG.leverage) || 15));
        const slotCount = Math.max(1, Number(CONFIG.maxSlots) || 4);
        const maxAllowedMargin = Math.max(12.0, balance * (0.94 / slotCount));
        const tradeMargin = Number(Math.max(6.0, Math.min(maxAllowedMargin, targetNominal / levNow)).toFixed(2));
        const effectiveRiskUsd = Number((tradeMargin * levNow * (effectiveStopCostPct / 100)).toFixed(2));

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
        if (spreadBps !== null && spreadBps > 22.0) {
          shadow('HIGH_SPREAD', { spreadBps });
          continue;
        }
        // Defter giriş fiyatı (ask/bid) da drift + (Balina ise EMA20) kuralını aşmamalı!
        const fillDriftPct = sig.closePx > 0 ? Math.abs((fillPx - sig.closePx) / sig.closePx) * 100 : 0;
        if (fillDriftPct > 1.10) {
          shadow('DRIFT_SKIP', { driftPct: Number(fillDriftPct.toFixed(2)) });
          continue;
        }
        if (!sig.isAux && ((side === 'LONG' && fillPx <= sig.ema20) || (side === 'SHORT' && fillPx >= sig.ema20))) {
          shadow('EMA_LOST');
          continue;
        }

        const win3h = k15m.slice(Math.max(0, closedIdx - 11), closedIdx + 1);
        const low3h = win3h.length ? Math.min(...win3h.map(b => parseFloat(b[3]) || fillPx)) : fillPx;
        const high3h = win3h.length ? Math.max(...win3h.map(b => parseFloat(b[2]) || fillPx)) : fillPx;
        const vol3hM = win3h.reduce((acc, b) => acc + (parseFloat(b[7]) || 0), 0) / 1e6;
        const range3hStr = `$${low3h.toFixed(4)} - $${high3h.toFixed(4)}`;

        const stopPrice = side === "LONG"
          ? fillPx * (1 - tradeSlPct / 100)
          : fillPx * (1 + tradeSlPct / 100);

        const isLongSide = side === 'LONG';
        const isSnapSig = sig.exitMode === 'SNAP_RUNNER';
        const tradeBePct = Number((tradeSlPct * (isSnapSig ? 0.65 : (isLongSide ? 1.00 : 0.75))).toFixed(2));
        const tradeTp1Pct = Number((tradeSlPct * (isSnapSig ? 0.85 : (isLongSide ? 1.20 : 0.90))).toFixed(2));
        const tradeTp2Pct = Number((tradeSlPct * (isSnapSig ? 1.15 : (isLongSide ? 3.00 : 2.00))).toFixed(2));
        const tradeMoonPct = isSnapSig
          ? Number((sig.tpPctOverride || (tradeSlPct * 1.35)).toFixed(2))
          : Number((tradeSlPct * (isLongSide ? 5.00 : 3.50)).toFixed(2));

        const is1hSig = sig.engine === 'WHALE_1H';
        const isBbSig = sig.engine === 'BB_MR';
        const isHdSig = sig.engine === 'HDIST';
        const dirEmoji = isBbSig ? '🧲 BB DÖNÜŞ SHORT'
          : (isHdSig ? '🕵️ GİZLİ DAĞITIM SHORT'
          : (is1hSig ? (side === 'LONG' ? '🐋🚀 BALİNA 1S LONG' : '🐋🩸 BALİNA 1S SHORT')
          : (side === 'LONG' ? '🐋🚀 BALİNA LONG' : '🐋🩸 BALİNA SHORT')));
        const flowText = side === 'LONG' ? `Alıcı %${sig.taker.toFixed(0)}` : `Satıcı %${(100 - sig.taker).toFixed(0)}`;
        const radarTag = isBbSig
          ? `[${dirEmoji} | BBZ ${sig.bbzPrev} | RSI ${sig.rsi15.toFixed(0)} | EMA20 +%${sig.distEma20.toFixed(1)} | ${flowText}] [SL: %${tradeSlPct.toFixed(2)} | Hedef: +%${tradeMoonPct.toFixed(2)} | Risk: ~$${effectiveRiskUsd.toFixed(2)}]`
          : (isHdSig
            ? `[${dirEmoji} | Yeşil +%${sig.move.toFixed(2)} | Hacim ${sig.volMult.toFixed(1)}x | ${flowText}] [SL: %${tradeSlPct.toFixed(2)} | ATR15m: %${sig.atr15.toFixed(2)} | Risk: ~$${effectiveRiskUsd.toFixed(2)}]`
            : (is1hSig
              ? `[${dirEmoji} | 1S ${sig.move >= 0 ? '+' : ''}%${sig.move.toFixed(2)} | Hacim ${sig.volMult.toFixed(1)}x | 8s ${(sig.chg8h || 0) >= 0 ? '+' : ''}%${(sig.chg8h || 0).toFixed(1)} | ${flowText}] [SL: %${tradeSlPct.toFixed(2)} | ATR1S: %${(sig.atr1h || sig.atr15).toFixed(2)} | Risk: ~$${effectiveRiskUsd.toFixed(2)}]`
              : `[${dirEmoji} | 15dk ${sig.move >= 0 ? '+' : ''}%${sig.move.toFixed(2)} | Hacim ${sig.volMult.toFixed(1)}x | 4s ${sig.chg4h >= 0 ? '+' : ''}%${sig.chg4h.toFixed(1)} | ${flowText}] [SL: %${tradeSlPct.toFixed(2)} | ATR15m: %${sig.atr15.toFixed(2)} | Risk: ~$${effectiveRiskUsd.toFixed(2)}]`));

        const entryScore = sig.score;

        const position = {
          id: Date.now() + Math.random().toString(36).substring(2, 6),
          symbol: sym,
          side: side,
          entryPrice: fillPx,
          currentPrice: fillPx,
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
          strategy: sig.engine || (is1hSig ? 'WHALE_1H' : 'WHALE_15M'),
          isAux: !!sig.isAux,
          exitMode: sig.exitMode || 'RUNNER',
          tpPctOverride: sig.tpPctOverride || null,
          maxTradeMin: (Number(sig.maxBars15) || 32) * 15,
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
          convictionTier: sig.engine || 'WHALE_15M',
          convictionScore: sig.isAux ? 85 : 95,
          convictionLabel: isBbSig ? '🧲 BB DÖNÜŞ SHORT'
            : (isHdSig ? '🕵️ GİZLİ DAĞITIM'
            : (is1hSig ? (side === 'LONG' ? '🐋 BALİNA 1S ROKET' : '🐋 BALİNA 1S ŞELALE')
            : (side === 'LONG' ? '🐋 BALİNA ROKET 15M' : '🐋 BALİNA ŞELALE 15M'))),
          radarTag: radarTag,
          chg3h: Number(sig.chg3h.toFixed(2)),
          vol3hM: Number(vol3hM.toFixed(1)),
          chg24h: Number(chg.toFixed(2)),
          range3h: range3hStr,
          takerBuyRatio: Number(sig.taker.toFixed(1)),
          signal: isBbSig ? '🧲 BB DÖNÜŞ' : (isHdSig ? '🕵️ GİZLİ DAĞITIM' : (side === "LONG" ? "🐋🚀 BALİNA BOĞA" : "🐋🩸 BALİNA AYI")),
          btc5mEntry: btc5mNumeric,
          btc15mEntry: btc15mNumeric
        };

        scanEntryCandidates.push({
          entryScore,
          position,
          sym,
          side,
          isAux: !!sig.isAux,
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
            shadow('TAKEN', { slPct: tradeSlPct, volMult: Number(sig.volMult.toFixed(2)), engine: sig.engine });
          }
        });
      }
    }

    if (resetEpoch !== scanEpoch || !isBotActive) return;

    if (scanEntryCandidates.length > 0 && activePositions.length < CONFIG.maxSlots) {
      scanEntryCandidates.sort((a, b) => b.entryScore - a.entryScore);
      const taken = new Set(activePositions.map((p) => p.symbol));
      let activeAuxCount = activePositions.filter(p => p.isAux || p.strategy === 'BB_MR' || p.strategy === 'HDIST').length;
      const maxAuxSlots = Math.max(1, Math.min(3, (Number(CONFIG.maxSlots) || 4) - 1));
      const room = CONFIG.maxSlots - activePositions.length;
      let opened = 0;
      let bookedMargin = activePositions.reduce((acc, p) => acc + (p.margin || 0), 0);
      for (const pick of scanEntryCandidates) {
        if (opened >= room || taken.has(pick.sym)) continue;
        if (pick.isAux && activeAuxCount >= maxAuxSlots) continue;
        const curFree = Math.max(0, Number((balance - bookedMargin).toFixed(2)));
        let finalMargin = Math.min(pick.tradeMargin, curFree);
        if (finalMargin < 6.0) continue;
        pick.tradeMargin = Number(finalMargin.toFixed(2));
        pick.position.margin = pick.tradeMargin;
        pick.position.initialMargin = pick.tradeMargin;
        taken.add(pick.sym);
        if (pick.isAux) activeAuxCount++;
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
        const moonR = pick.side === 'LONG' ? '5.0R' : '2.5R';
        addLog(
          `🐋 POZİSYON AÇILDI: [${pick.side}] ${pick.sym} @ $${pick.curP.toFixed(4)} | ${pick.radarTag} | Teminat: $${pick.tradeMargin.toFixed(1)} (${pick.position.leverage}x) | SL: -%${pick.tradeSlPct.toFixed(2)} | BE: +%${pick.position.bePct.toFixed(2)} | Trail: +%${pick.tradeTp1Pct.toFixed(2)} | Moon(${moonR}): +%${pick.tradeMoonPct.toFixed(2)}`,
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

      // 🐋 MARSCOIN V4 — ASİMETRİK 15DK BALİNA RUNNER ÇIKIŞ MOTORU (Replay Backtest ile 1-e-1 Aynı!)
      // LONG : 1.00R BE -> 1.20R+ Trail (0.70R) -> 3.00R+ Sıkı Trail (0.60R) -> 5.00R Moonshot
      // SHORT: 0.75R BE -> 0.90R+ Trail (0.45R) -> 2.00R+ Kademeli Trail (0.50R) -> 3.50R Şelale Moonshot
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

      const isSnapRunner = pos.exitMode === 'SNAP_RUNNER' || pos.strategy === 'BB_MR';
      const beMult = isSnapRunner ? 0.65 : (isLong ? 1.00 : 0.75);
      const trailStartMult = isSnapRunner ? 0.85 : (isLong ? 1.20 : 0.90);
      const trailGapMult = isSnapRunner ? 0.40 : (isLong ? 0.70 : 0.45);
      const moonMult = isSnapRunner ? 1.35 : (isLong ? 5.00 : 3.50);

      const beGoal = slBase * beMult;
      const trailStart = slBase * trailStartMult;
      const trailGap = isSnapRunner
        ? (slBase * 0.40)
        : ((isLong && mfe >= slBase * 3.00)
          ? (slBase * 0.60)
          : ((!isLong && mfe >= slBase * 2.00) ? (slBase * 0.50) : (slBase * trailGapMult)));
      const moonGoal = isSnapRunner ? (Number(pos.tpPctOverride) || (slBase * 1.35)) : (slBase * moonMult);
      const initMargin = pos.initialMargin || pos.margin || 20;
      const makerRate = Number(CONFIG.makerRate) || 0.0002;

      // Kademe 1: BE (LONG 1.0R / SHORT 0.75R) -> Stop +%0.15'e çekilir ($0 Risk!)
      if (!pos.beLocked && mfe >= beGoal && move > 0.20) {
        tightenStop(0.15);
        pos.beLocked = true;
        stateChanged = true;
        addLog(`🛡️ [${beMult.toFixed(2)}R BAŞABAŞ]: ${pos.symbol} (${pos.side}) +%${mfe.toFixed(2)} gördü ➔ Stop +%0.15 kâra çekildi ($0 Risk)!`, 'INFO');
      }

      // Kademe 2: Runner İz Süren (LONG 1.4R-0.85R & 3.0R+-0.60R / SHORT 0.90R-0.45R)
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

      // 🚀 Kademe 3: MOONSHOT veya BB DÖNÜŞ HEDEFİ!
      if (!exitReason && move >= moonGoal) {
        exitReason = isSnapRunner
          ? `🎯 BB DÖNÜŞ HEDEFİ kâr alındı (+%${move.toFixed(2)} / hedef %${moonGoal.toFixed(2)})`
          : `🎯 ${moonMult.toFixed(1)}R BALİNA MOONSHOT ALINDI (+%${move.toFixed(2)} / hedef %${moonGoal.toFixed(2)})`;
      }

      const maxHold = Number(pos.maxTradeMin) || Number(CONFIG.maxTradeMin) || 480;
      if (!exitReason && durMin >= maxHold) {
        exitReason = `⏱️ ${Math.round(maxHold / 60)}s Maksimum süre doldu (${maxHold}dk / MFE: +%${mfe.toFixed(2)})`;
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
  const capturedEpoch = resetEpoch;
  for (const cp of checkpoints) {
    if (tradeRecord[cp.key] !== null && tradeRecord[cp.key] !== undefined) continue;
    const targetMs = entryTimeMs + (cp.min * 60 * 1000);
    const delayMs = Math.max(1000, targetMs - now);
    setTimeout(async () => {
      if (resetEpoch !== capturedEpoch) return;
      try {
        const pData = await fetchBinance(`/fapi/v1/ticker/price?symbol=${tradeRecord.symbol}`);
        if (resetEpoch !== capturedEpoch) return;
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
  const hasPartialTp = Math.abs(pos.tp1Pnl || 0) > 0.001 || Math.abs(pos.tp2Pnl || 0) > 0.001;
  const tpTag = (pos.tp2Pnl ? "TP1+TP2 CEPTE" : (pos.tp1Pnl ? "TP1 CEPTE" : ""));
  const signRoi = `${totalTradeRoi >= 0 ? '+' : ''}%${totalTradeRoi.toFixed(1)}`;
  const signPnl = `${totalTradePnl >= 0 ? '+$' : '-$'}${Math.abs(totalTradePnl).toFixed(2)}`;
  if (hasPartialTp && exitReason.includes("Başabaş")) {
    formattedExitReason = `🛡️ ${tpTag} + Kalan Başabaş Kapandı (${signRoi} ROI / ${signPnl})`;
  } else if (hasPartialTp && exitReason.includes("Garanti Kilitli")) {
    formattedExitReason = `🔒 ${tpTag} + Runner Kilitli Kâr (${signRoi} ROI / ${signPnl} / Zirve: +%${(pos.mfe || 0).toFixed(2)} Spot)`;
  } else if (hasPartialTp && exitReason.includes("MOONSHOT")) {
    formattedExitReason = `🎯 3 KADEMELİ MOONSHOT ALINDI (Toplam: ${signPnl} / ${signRoi} ROI)`;
  } else if (!hasPartialTp && exitReason.includes("Garanti Kilitli")) {
    formattedExitReason = `🔒 Runner İz Süren Kilitli Kâr (${signRoi} ROI / ${signPnl} / Zirve: +%${(pos.mfe || 0).toFixed(2)} Spot)`;
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
      padding: 2px 8px;
      max-width: 215px;
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
    .status-pill.red { background: var(--red-bg); color: var(--red); border-color: var(--red-border); }
    .status-pill.amber { background: var(--amber-bg); color: var(--amber); border-color: var(--amber-border); }
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
    .param-static-val { display: flex; align-items: baseline; justify-content: space-between; padding: 4px 2px; font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 700; color: var(--text); }
    .param-unit { font-size: 9.5px; color: var(--muted); font-family: -apple-system, "Segoe UI", sans-serif; font-weight: 600; }
    .sidebar-plan-card { background: var(--panel2); border: 1px solid var(--border); border-radius: 7px; padding: 8px 10px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 6px; }
    .sidebar-plan-row { font-size: 11px; line-height: 1.4; color: var(--text-secondary); }
    .sidebar-plan-row b { color: var(--text); font-weight: 700; }

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
      <button class="tab-btn" id="tabRadar" onclick="switchView('scanner15mView')" style="color:#38bdf8;">⏪ 3. 15DK REPLAY & EXCEL AKTARICI</button>
    </div>

    <div class="dashboard" id="liveView">
      <!-- SOL PANEL: MOTOR KONTROLÜ -->
      <div class="panel">
        <h2>
          <span>🎛️ MOTOR KONTROLÜ</span>
          <button id="themeToggleBtn" onclick="toggleTheme()" class="theme-toggle-btn">☀️ Açık Mod</button>
        </h2>

        <div class="sidebar-section-title" style="margin-top:0;">DURUM</div>
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
              <span class="agent-name">Piyasa</span>
              <span class="status-pill ${liveBtcRegime.regime === 'BULL' ? 'green' : (liveBtcRegime.regime === 'BEAR' ? 'red' : (liveBtcRegime.regime === 'CHOP' ? 'amber' : ''))}" id="gateBtcRegime">${liveBtcRegime.label}</span>
            </div>
            <div class="agent-row">
              <span class="agent-name">Motor</span>
              <span class="status-pill green" id="gateEngine">${gateEntryLbl}</span>
            </div>
            <div class="agent-row" id="gateBreakerRow" style="display:${stats.circuit ? 'flex' : 'none'};">
              <span class="agent-name">Devre Kesici</span>
              <span class="status-pill red" id="gateBreaker">🛑 KORUMA AKTİF</span>
            </div>
          </div>
        </div>

        <div class="sidebar-section-title" style="margin-top:8px;">💰 SEANS PERFORMANSI</div>
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
            <span class="perf-mini-val" id="stTotalTrades">${stats.totalTrades}${stats.activeCount > 0 ? ` (+${stats.activeCount} Açık)` : ''}</span>
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

        <div class="sidebar-section-title">⚙️ RİSK & AYARLAR</div>
        <div class="param-grid-2x2">
          <div class="param-card">
            <div class="param-header"><span>MAX İŞLEM</span><span>BTC yönü</span></div>
            <div class="param-input-wrap"><input type="number" id="inpSlots" value="${CONFIG.maxSlots}"><span class="param-unit">adet</span></div>
          </div>
          <div class="param-card" title="Limitsiz bileşik kasa riski (%1–%10): Bakiye büyüdükçe işlem boyutu otomatik katlanır">
            <div class="param-header"><span>İŞLEM RİSKİ</span><span id="stRiskUsd">~$${(parseFloat(stats.balance || 100) * ((Number(CONFIG.riskPct) || 7.5) / 100)).toFixed(2)}</span></div>
            <div class="param-input-wrap"><input type="number" id="inpRiskPct" step="0.5" min="1" max="10" value="${CONFIG.riskPct}"><span class="param-unit">%</span></div>
          </div>
          <div class="param-card">
            <div class="param-header"><span>KALDIRAÇ</span><span>sınır</span></div>
            <div class="param-input-wrap"><input type="number" id="inpLev" value="${CONFIG.leverage}"><span class="param-unit">x</span></div>
          </div>
          <div class="param-card" title="Koindeki 15dk oynaklığa (ATR) göre %1.0 ile %2.8 arasında otomatik belirlenir">
            <div class="param-header"><span>ZARAR KES</span><span>otomatik</span></div>
            <div class="param-static-val"><span>%1 – %2.8</span></div>
          </div>
        </div>

        <div class="sidebar-section-title">🎯 V7 3'LÜ MOTOR & KORUMA</div>
        <div class="sidebar-plan-card">
          <div class="sidebar-plan-row">🐋 <b>Balina (15dk+1S):</b> <b>≥$5M</b> (~150 koin), <b>2.5–8x</b> hacim, tam risk (<b>L 5R / S 3.5R</b>).</div>
          <div class="sidebar-plan-row">🧲 <b>BB Dönüş V7:</b> <b>RSI≥72 · ATR≤2 · 4s&lt;%9 · 15dk&gt;-%1.2</b> (max 3 slot, <b>%75 risk</b>).</div>
          <div class="sidebar-plan-row">🚀 <b>Bileşik:</b> Tavan yok · 2 ardışık zarar ➔ <b>4s mola</b> · 62.5g PF <b>1.63</b> / 30g WR <b>%70</b>.</div>
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
      <!-- ⏪ TÜM BİNANCE GEÇMİŞ REPLAY & LONG vs SHORT EXCEL AKTARICI -->
      <div class="panel" style="border:1px solid rgba(56,189,248,0.35);">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px;">
          <div>
            <h2 style="margin:0; color:#38bdf8;">⏪ TÜM BİNANCE GEÇMİŞ REPLAY & EXCEL AKTARICI (LONG vs SHORT)</h2>
            <div style="font-size:12px; color:var(--muted); margin-top:4px;">Binance Futures'taki <b>tüm saf kripto koinlerin (~400 koin)</b> gerçek 15dk grafiklerini tarar; her kurulumda <b>LONG girseydik</b> ve <b>SHORT girseydik</b> komisyon+kayma dahil net kâr/zararı karşılaştırıp <b>Excel (CSV)</b>'e aktarır.</div>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
            <select id="selReplayHours" style="background:var(--panel2); color:var(--text); border:1px solid var(--border); border-radius:6px; padding:6px 8px; font-weight:800; font-size:11.5px;">
              <option value="24">Son 24 Saat (~15 sn)</option>
              <option value="48" selected>Son 48 Saat (~18 sn)</option>
              <option value="72">Son 3 Gün (72s · ~1.5 dk)</option>
              <option value="168">Son 7 Gün (168s · ~1.5 dk)</option>
              <option value="240">Son 10 Gün (240s · ~3 dk)</option>
              <option value="720">Son 30 Gün (720s)</option>
            </select>
            <select id="selReplayScope" style="background:var(--panel2); color:var(--text); border:1px solid var(--border); border-radius:6px; padding:6px 8px; font-weight:800; font-size:11.5px;">
              <option value="all" selected>🌐 Tüm Binance (~400 Koin)</option>
              <option value="liquid">💧 Canlı Likit (≥$5M · ~150 Koin)</option>
            </select>
            <select id="selReplayMode" style="background:var(--panel2); color:var(--text); border:1px solid var(--border); border-radius:6px; padding:6px 8px; font-weight:800; font-size:11.5px;">
              <option value="market" selected>🌐 Tüm Piyasa · L vs S Analizi</option>
              <option value="all_signals">🔬 Sadece Bot Sinyalleri (Slotsuz)</option>
              <option value="portfolio">📊 Canlı Bot Portföyü (4 Slot)</option>
            </select>
            <button class="theme-toggle-btn" id="btnRunReplay" onclick="loadReplay(true)" style="background:rgba(56,189,248,0.18);border-color:rgba(56,189,248,0.5);">⏪ Tara & Simüle Et</button>
            <button class="theme-toggle-btn" id="btnCancelReplay" onclick="cancelReplay()" style="display:none;background:rgba(239,68,68,0.18);border-color:rgba(239,68,68,0.5);color:var(--red);">⏹️ Durdur</button>
            <button class="theme-toggle-btn" id="btnExportTrades" onclick="exportReplayExcel('trades')" style="background:rgba(34,197,94,0.14);border-color:rgba(34,197,94,0.45);">📥 İşlemler Excel</button>
            <button class="theme-toggle-btn" id="btnExportCoins" onclick="exportReplayExcel('coins')" style="background:rgba(168,85,247,0.14);border-color:rgba(168,85,247,0.45);">📋 Tüm Koinler Excel</button>
          </div>
        </div>

        <div id="replayStatusLine" style="margin-top:8px; font-size:12px; color:var(--muted);">Tarama için "Tara & Simüle Et" butonuna basın veya otomatik yüklenmesini bekleyin...</div>
        <div id="replayProgressWrap" style="display:none; width:100%; height:8px; background:var(--panel2); border:1px solid var(--border); border-radius:99px; overflow:hidden; margin-top:6px;">
          <div id="replayProgressBar" style="width:0%; height:100%; background:linear-gradient(90deg,#38bdf8,#22c55e); transition:width 0.35s ease;"></div>
        </div>

        <div id="replaySummaryGrid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(155px, 1fr)); gap:8px; margin-top:10px;"></div>
        <div id="replayBreakdownGrid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(260px, 1fr)); gap:8px; margin-top:10px;"></div>

        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-top:12px;">
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="theme-toggle-btn" id="btnSubTrades" onclick="setReplaySubTab('trades')" style="background:rgba(56,189,248,0.2);border-color:rgba(56,189,248,0.6);">📋 İşlem & Sinyal Listesi</button>
            <button class="theme-toggle-btn" id="btnSubCoins" onclick="setReplaySubTab('coins')">🌐 Tüm Koinler Özeti</button>
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
            <select id="selReplayQuickFilter" onchange="renderReplayTables()" style="background:var(--panel2); color:var(--text); border:1px solid var(--border); border-radius:6px; padding:5px 8px; font-size:11px; font-weight:700;">
              <option value="all">Filtre: Tümü</option>
              <option value="bot">🤖 Sadece Bot Girenler</option>
              <option value="skip">⏭️ Sadece Pas Geçilenler</option>
              <option value="long_win">🟢 LONG Kârlı</option>
              <option value="short_win">🔴 SHORT Kârlı</option>
              <option value="wrong_side">🔄 Ters Yön Daha Kârlı</option>
            </select>
            <input type="text" id="inpReplaySearch" oninput="renderReplayTables()" placeholder="Koin ara (SOL, PEPE...)" style="background:var(--panel2); color:var(--text); border:1px solid var(--border); border-radius:6px; padding:5px 9px; font-size:11.5px; width:165px;">
          </div>
        </div>

        <div id="replayTradesTableWrap" class="table-container" style="max-height:580px; overflow:auto; margin-top:8px;">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Giriş Saati</th><th>Koin / Motor</th><th>Durum / BTC</th><th>Yön</th><th>Giriş ➔ Çıkış</th><th>Hacim / RSI</th><th>Bot Net ($)</th><th>🟢 LONG ($)</th><th>🔴 SHORT ($)</th><th>En İyi Yön</th><th>Çıkış / Pas Nedeni</th>
              </tr>
            </thead>
            <tbody id="tbodyReplayTrades"><tr><td colspan="12" style="text-align:center;color:var(--muted);padding:16px;">Geçmiş tarama bekleniyor...</td></tr></tbody>
          </table>
        </div>

        <div id="replayCoinsTableWrap" class="table-container" style="display:none; max-height:580px; overflow:auto; margin-top:8px;">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Koin</th><th>Kapsam</th><th>24s Hacim</th><th>Dönem %</th><th>Max Yükseliş / Düşüş</th><th>Ort ATR</th><th>Kurulum (Bot)</th><th>Bot Net ($)</th><th>🟢 Hep LONG ($)</th><th>🔴 Hep SHORT ($)</th><th>En Kârlı Yön</th>
              </tr>
            </thead>
            <tbody id="tbodyReplayCoins"><tr><td colspan="12" style="text-align:center;color:var(--muted);padding:16px;">Koin özeti bekleniyor...</td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <script>
    let replayCache = null;
    let replayActiveJobId = null;
    let replayPollTimer = null;
    let replaySubTab = 'trades';
    function switchView(id) {
      var live = document.getElementById('liveView');
      var radar = document.getElementById('scanner15mView');
      if (live) live.style.display = id === 'liveView' ? '' : 'none';
      if (radar) radar.style.display = id === 'scanner15mView' ? 'block' : 'none';
      var tabLive = document.getElementById('tabLive');
      var tabRadar = document.getElementById('tabRadar');
      if (tabLive) tabLive.classList.toggle('active', id === 'liveView');
      if (tabRadar) tabRadar.classList.toggle('active', id === 'scanner15mView');
      if (id === 'scanner15mView' && !replayCache && !replayActiveJobId) {
        loadReplay(false);
      }
    }
    function radarNum(p) {
      var n = Number(p) || 0;
      if (n < 0.0001) return n.toFixed(6);
      if (n < 0.01) return n.toFixed(5);
      if (n < 1) return n.toFixed(4);
      return n.toFixed(2);
    }
    function fmtUsdSign(v) {
      var n = Number(v) || 0;
      return (n >= 0 ? '+$' : '-$') + Math.abs(n).toFixed(2);
    }
    function usdClr(v) {
      var n = Number(v) || 0;
      return n > 0.01 ? 'var(--green)' : (n < -0.01 ? 'var(--red)' : 'var(--muted)');
    }
    function setReplaySubTab(tab) {
      replaySubTab = tab === 'coins' ? 'coins' : 'trades';
      var tw = document.getElementById('replayTradesTableWrap');
      var cw = document.getElementById('replayCoinsTableWrap');
      var bt = document.getElementById('btnSubTrades');
      var bc = document.getElementById('btnSubCoins');
      var qf = document.getElementById('selReplayQuickFilter');
      if (tw) tw.style.display = replaySubTab === 'trades' ? 'block' : 'none';
      if (cw) cw.style.display = replaySubTab === 'coins' ? 'block' : 'none';
      if (qf) qf.style.display = replaySubTab === 'trades' ? '' : 'none';
      if (bt) { bt.style.background = replaySubTab === 'trades' ? 'rgba(56,189,248,0.22)' : ''; bt.style.borderColor = replaySubTab === 'trades' ? 'rgba(56,189,248,0.65)' : ''; }
      if (bc) { bc.style.background = replaySubTab === 'coins' ? 'rgba(168,85,247,0.22)' : ''; bc.style.borderColor = replaySubTab === 'coins' ? 'rgba(168,85,247,0.65)' : ''; }
      renderReplayTables();
    }
    function renderBreakdownBox(title, rows) {
      if (!rows || !rows.length) return '';
      var body = rows.map(function (r) {
        return '<tr><td style="font-weight:700;font-size:10.5px;">' + escapeHtml(r.label) + '</td><td style="text-align:center;font-size:10.5px;">' + r.count + '</td><td style="color:' + usdClr(r.botNet) + ';font-weight:800;font-size:10.5px;">' + fmtUsdSign(r.botNet) + '</td><td style="color:' + usdClr(r.allLongNet) + ';font-weight:800;font-size:10.5px;">' + fmtUsdSign(r.allLongNet) + '</td><td style="color:' + usdClr(r.allShortNet) + ';font-weight:800;font-size:10.5px;">' + fmtUsdSign(r.allShortNet) + '</td></tr>';
      }).join('');
      return '<div style="background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:7px 9px;"><div style="font-size:10.5px;font-weight:800;color:#38bdf8;margin-bottom:5px;">' + title + '</div><table style="width:100%;font-size:10.5px;"><thead><tr><th style="padding:3px 4px;">Grup</th><th style="padding:3px 4px;text-align:center;">Adet</th><th style="padding:3px 4px;">Bot $</th><th style="padding:3px 4px;">LONG $</th><th style="padding:3px 4px;">SHORT $</th></tr></thead><tbody>' + body + '</tbody></table></div>';
    }
    function renderReplayTables() {
      if (!replayCache) return;
      var q = (document.getElementById('inpReplaySearch') ? document.getElementById('inpReplaySearch').value : '').trim().toUpperCase();
      var filt = document.getElementById('selReplayQuickFilter') ? document.getElementById('selReplayQuickFilter').value : 'all';

      var tbody = document.getElementById('tbodyReplayTrades');
      if (tbody && replaySubTab === 'trades') {
        var rawList = replayCache.tradesPreview || [];
        var filtered = rawList.filter(function (t) {
          if (q && String(t.symbol || '').toUpperCase().indexOf(q) === -1) return false;
          if (filt === 'bot' && !t.botApproved) return false;
          if (filt === 'skip' && t.botApproved) return false;
          if (filt === 'long_win' && (t.longNet || 0) <= 0.05) return false;
          if (filt === 'short_win' && (t.shortNet || 0) <= 0.05) return false;
          if (filt === 'wrong_side' && t.sideCorrect !== 'HAYIR') return false;
          return true;
        });
        var shown = filtered.slice(0, 300);
        var html = shown.map(function (t) {
          var sCls = t.side === 'LONG' ? 'badge-side-long' : 'badge-side-short';
          var tfTag = t.tf === '1H' ? ' <span style="font-size:9px;padding:1px 4px;border-radius:4px;background:rgba(124,58,237,0.16);color:var(--purple);font-weight:800;">1S</span>'
            : (t.tf === 'BB' ? ' <span style="font-size:9px;padding:1px 4px;border-radius:4px;background:rgba(245,158,11,0.18);color:var(--amber);font-weight:800;">BB</span>'
            : (t.tf === 'PIYASA' ? ' <span style="font-size:9px;padding:1px 4px;border-radius:4px;background:rgba(56,189,248,0.16);color:#38bdf8;font-weight:800;">PİYASA</span>'
            : (t.tf === 'RSI_D' ? ' <span style="font-size:9px;padding:1px 4px;border-radius:4px;background:rgba(236,72,153,0.16);color:#ec4899;font-weight:800;">RSI</span>'
            : ' <span style="font-size:9px;padding:1px 4px;border-radius:4px;background:rgba(34,197,94,0.16);color:var(--green);font-weight:800;">15dk</span>')));
          var botBadge = t.botApproved
            ? '<span style="font-size:9px;padding:1px 5px;border-radius:4px;background:rgba(34,197,94,0.16);color:var(--green);font-weight:800;">BOT GİRER</span>'
            : '<span style="font-size:9px;padding:1px 5px;border-radius:4px;background:rgba(148,163,184,0.18);color:var(--muted);font-weight:700;">PAS</span>';
          var bestBadge = t.bestSide === 'LONG'
            ? '<span style="color:var(--green);font-weight:900;">🟢 LONG</span>'
            : (t.bestSide === 'SHORT' ? '<span style="color:var(--red);font-weight:900;">🔴 SHORT</span>' : '<span style="color:var(--muted);font-size:10px;">İKİSİ DE ZARAR</span>');
          var reasonCol = t.botApproved ? escapeHtml(t.reason || '') : (escapeHtml(t.reason || '') + '<div style="font-size:9.5px;color:var(--amber);">Pas: ' + escapeHtml(t.skipReason || '-') + '</div>');
          return '<tr>' +
            '<td>' + t.id + '</td>' +
            '<td style="font-size:10px;color:var(--muted);">' + escapeHtml(t.entryTime || '') + '</td>' +
            '<td style="font-weight:900;">' + escapeHtml(t.symbol || '') + tfTag + '<div style="font-size:9.5px;color:var(--muted);font-weight:600;">$' + Number(t.vol24M || 0).toFixed(1) + 'M</div></td>' +
            '<td>' + botBadge + '<div style="font-size:9.5px;color:var(--muted);margin-top:2px;">BTC: ' + escapeHtml(t.btcReg || '-') + '</div></td>' +
            '<td><span class="' + sCls + '">' + t.side + '</span></td>' +
            '<td style="font-size:10.5px;">$' + radarNum(t.entryPrice) + ' ➔ $' + radarNum(t.exitPrice) + '<div style="font-size:9.5px;color:var(--muted);">SL %' + Number(t.slPct || 0).toFixed(2) + ' · ' + t.durationMin + 'dk</div></td>' +
            '<td style="font-size:10.5px;font-weight:700;">' + Number(t.volMult || 0).toFixed(1) + 'x<div style="font-size:9.5px;color:var(--muted);">RSI ' + Number(t.rsi15 || 50).toFixed(0) + ' · Tkr %' + Number(t.takerRaw || 50).toFixed(0) + '</div></td>' +
            '<td style="color:' + usdClr(t.netPnl) + ';font-weight:900;">' + fmtUsdSign(t.netPnl) + '</td>' +
            '<td style="color:' + usdClr(t.longNet) + ';font-weight:900;">' + fmtUsdSign(t.longNet) + '<div style="font-size:9px;color:var(--muted);">MFE +%' + Number(t.longMfe || 0).toFixed(1) + '</div></td>' +
            '<td style="color:' + usdClr(t.shortNet) + ';font-weight:900;">' + fmtUsdSign(t.shortNet) + '<div style="font-size:9px;color:var(--muted);">MFE +%' + Number(t.shortMfe || 0).toFixed(1) + '</div></td>' +
            '<td>' + bestBadge + '</td>' +
            '<td style="font-size:10.5px;">' + reasonCol + '</td>' +
          '</tr>';
        }).join('');
        var totalAll = Number(replayCache.totalTradesCount || rawList.length);
        if (totalAll > shown.length && !q && filt === 'all') {
          html += '<tr><td colspan="12" style="text-align:center;color:#38bdf8;font-weight:700;padding:12px;">Tabloda en güncel ' + shown.length + ' / ' + totalAll + ' kurulum gösteriliyor — TÜM ' + totalAll + ' SATIRI incelemek için yukarıdan "📥 İşlemler Excel" butonuna basın!</td></tr>';
        }
        tbody.innerHTML = html || '<tr><td colspan="12" style="text-align:center;color:var(--muted);padding:16px;">Seçili filtreye uyan kayıt bulunamadı.</td></tr>';
      }

      var cbody = document.getElementById('tbodyReplayCoins');
      if (cbody && replaySubTab === 'coins') {
        var coins = (replayCache.coinSummary || []).filter(function (c) {
          return !q || String(c.symbol || '').toUpperCase().indexOf(q) !== -1;
        });
        cbody.innerHTML = coins.map(function (c, idx) {
          var pClr = (c.periodChgPct || 0) >= 0 ? 'var(--green)' : 'var(--red)';
          var bestLbl = c.bestSide === 'LONG' ? '<span style="color:var(--green);font-weight:900;">🟢 LONG</span>'
            : (c.bestSide === 'SHORT' ? '<span style="color:var(--red);font-weight:900;">🔴 SHORT</span>'
            : '<span style="color:var(--muted);font-size:10px;">' + escapeHtml(c.bestSide || '-') + '</span>');
          return '<tr>' +
            '<td>' + (idx + 1) + '</td>' +
            '<td style="font-weight:900;">' + escapeHtml(c.symbol) + '</td>' +
            '<td style="font-size:10px;color:var(--muted);">' + escapeHtml(c.tier || '-') + '</td>' +
            '<td style="font-weight:700;">$' + Number(c.vol24M || 0).toFixed(1) + 'M</td>' +
            '<td style="color:' + pClr + ';font-weight:800;">' + ((c.periodChgPct || 0) >= 0 ? '+' : '') + Number(c.periodChgPct || 0).toFixed(2) + '%</td>' +
            '<td style="font-size:10.5px;"><span style="color:var(--green);">+%' + Number(c.maxUpPct || 0).toFixed(1) + '</span> / <span style="color:var(--red);">' + Number(c.maxDownPct || 0).toFixed(1) + '%</span></td>' +
            '<td>%' + Number(c.avgAtr15 || 0).toFixed(2) + '</td>' +
            '<td style="font-weight:700;">' + c.totalSetups + ' <span style="color:var(--muted);font-weight:600;">(' + c.botSignals + ' bot)</span></td>' +
            '<td style="color:' + usdClr(c.botNet) + ';font-weight:900;">' + fmtUsdSign(c.botNet) + '</td>' +
            '<td style="color:' + usdClr(c.allLongNet) + ';font-weight:900;">' + fmtUsdSign(c.allLongNet) + '<div style="font-size:9px;color:var(--muted);">%' + Number(c.allLongWr || 0).toFixed(0) + ' WR</div></td>' +
            '<td style="color:' + usdClr(c.allShortNet) + ';font-weight:900;">' + fmtUsdSign(c.allShortNet) + '<div style="font-size:9px;color:var(--muted);">%' + Number(c.allShortWr || 0).toFixed(0) + ' WR</div></td>' +
            '<td>' + bestLbl + '</td>' +
          '</tr>';
        }).join('') || '<tr><td colspan="12" style="text-align:center;color:var(--muted);padding:16px;">Koin bulunamadı.</td></tr>';
      }
    }
    function renderReplayCompleted(data) {
      replayCache = data;
      var line = document.getElementById('replayStatusLine');
      var grid = document.getElementById('replaySummaryGrid');
      var bGrid = document.getElementById('replayBreakdownGrid');
      var pWrap = document.getElementById('replayProgressWrap');
      var pBar = document.getElementById('replayProgressBar');
      var bt = document.getElementById('btnSubTrades');
      var bc = document.getElementById('btnSubCoins');
      if (pBar) pBar.style.width = '100%';
      setTimeout(function () { if (pWrap) pWrap.style.display = 'none'; }, 900);

      var s = data.summary || {};
      var modeLbl = s.mode === 'portfolio' ? ('Canlı Portföy (' + (s.maxSlots || 4) + ' Slot · %' + (s.riskPct || 6) + ' Bileşik)')
        : (s.mode === 'all_signals' ? 'Sadece Bot Sinyalleri (Slotsuz · $10 Sabit Risk)' : 'Tüm Piyasa L vs S Tarama (Slotsuz · $10 Sabit Risk)');
      if (line) line.textContent = '✅ Tamamlandı (' + (data.generatedAt || '') + ' · ' + (data.elapsedSec || 0) + ' sn) | ' + s.coinsScanned + '/' + (s.coinsTotal || s.coinsScanned) + ' Binance Koin · Son ' + s.hours + ' Saat · ' + modeLbl + ' · Komisyon + Kayma Dahil';
      if (bt) bt.textContent = '📋 İşlem & Sinyaller (' + (data.totalTradesCount || 0) + ')';
      if (bc) bc.textContent = '🌐 Tüm Koinler Özeti (' + ((data.coinSummary || []).length) + ' Koin)';

      if (grid) {
        var card = function (lbl, val, sub, clr) {
          return '<div style="background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;"><div style="font-size:10px;color:var(--muted);font-weight:700;">' + lbl + '</div><div style="font-size:16px;font-weight:900;color:' + (clr || 'var(--text)') + ';margin-top:2px;">' + val + '</div><div style="font-size:10px;color:var(--muted);margin-top:2px;">' + sub + '</div></div>';
        };
        var c1 = s.mode === 'portfolio'
          ? card('BİTİŞ BAKİYESİ ($100 ->)', '$' + Number(s.finalBalance || 100).toFixed(2), 'Net: ' + fmtUsdSign(s.netPnl) + ' (%' + (s.roiPct >= 0 ? '+' : '') + Number(s.roiPct || 0).toFixed(1) + ')', usdClr(s.netPnl))
          : card('🤖 MEVCUT BOT SİNYALLERİ', fmtUsdSign(s.botApprovedNet), (s.botApprovedTrades || 0) + ' bot işlemi · %' + Number(s.botApprovedWr || 0).toFixed(1) + ' WR', usdClr(s.botApprovedNet));
        grid.innerHTML =
          c1 +
          card('TOPLAM KURULUM & WR', (s.totalTrades || 0) + ' Kurulum', s.wins + 'W / ' + s.losses + 'L (%' + s.winRate + ' WR) · PF: ' + s.profitFactor, 'var(--text)') +
          card('🟢 HEP LONG GİRİLSE', fmtUsdSign(s.allLongNet), 'Tüm kurulumlarda LONG · %' + Number(s.allLongWr || 0).toFixed(1) + ' WR', usdClr(s.allLongNet)) +
          card('🔴 HEP SHORT GİRİLSE', fmtUsdSign(s.allShortNet), 'Tüm kurulumlarda SHORT · %' + Number(s.allShortWr || 0).toFixed(1) + ' WR', usdClr(s.allShortNet)) +
          card('🧭 YÖN AVANTAJI', fmtUsdSign(s.netPnl), 'Ters Yön: ' + fmtUsdSign(s.oppositeNet) + ' · Fark: ' + fmtUsdSign((s.netPnl || 0) - (s.oppositeNet || 0)), usdClr(s.netPnl)) +
          card('TARANAN KOİN & KOMİSYON', (s.coinsScanned || 0) + ' / ' + (s.coinsTotal || s.coinsScanned) + ' Koin', 'MaxDD: -%' + Number(s.maxDrawdownPct || 0).toFixed(1) + ' · Komisyon: $' + Number(s.totalFees || 0).toFixed(2), 'var(--muted)');
      }
      if (bGrid) {
        bGrid.innerHTML =
          renderBreakdownBox('⚙️ Motor Bazlı (Bot vs LONG vs SHORT)', s.engineBreakdown) +
          renderBreakdownBox('💧 Koin Likidite Bazlı', s.tierBreakdown) +
          renderBreakdownBox('🧭 BTC Rejimi Bazlı', s.regimeBreakdown);
      }
      renderReplayTables();
    }
    function stopReplayPolling() {
      if (replayPollTimer) { clearTimeout(replayPollTimer); replayPollTimer = null; }
      var btn = document.getElementById('btnRunReplay');
      var cBtn = document.getElementById('btnCancelReplay');
      if (btn) btn.disabled = false;
      if (cBtn) cBtn.style.display = 'none';
    }
    async function cancelReplay() {
      if (!replayActiveJobId) return;
      try { await fetch('/api/replay-cancel?jobId=' + encodeURIComponent(replayActiveJobId)); } catch (e) {}
      replayActiveJobId = null;
      stopReplayPolling();
      var line = document.getElementById('replayStatusLine');
      var pWrap = document.getElementById('replayProgressWrap');
      if (line) line.textContent = '⏹️ Tarama kullanıcı tarafından durduruldu.';
      if (pWrap) pWrap.style.display = 'none';
    }
    async function pollReplayJob(jobId) {
      if (replayActiveJobId !== jobId) return;
      try {
        var res = await fetch('/api/replay-progress?jobId=' + encodeURIComponent(jobId));
        var data = await res.json();
        if (replayActiveJobId !== jobId) return;
        var line = document.getElementById('replayStatusLine');
        var pWrap = document.getElementById('replayProgressWrap');
        var pBar = document.getElementById('replayProgressBar');
        if (!data || !data.ok) {
          stopReplayPolling();
          replayActiveJobId = null;
          if (line) line.textContent = '❌ Replay alınamadı: ' + ((data && data.error) || 'hata');
          if (pWrap) pWrap.style.display = 'none';
          return;
        }
        var pct = data.totalCoins > 0 ? Math.min(99, Math.round((data.doneCoins / data.totalCoins) * 100)) : 4;
        if (pWrap) pWrap.style.display = 'block';
        if (pBar) pBar.style.width = (data.status === 'done' ? 100 : pct) + '%';
        if (data.status === 'running') {
          if (line) line.textContent = data.statusText || ('⏳ Taranıyor... ' + data.doneCoins + '/' + data.totalCoins);
          replayPollTimer = setTimeout(function () { pollReplayJob(jobId); }, 1200);
          return;
        }
        stopReplayPolling();
        if (data.status === 'done') {
          renderReplayCompleted(data);
        } else {
          if (pWrap) pWrap.style.display = 'none';
          if (line) line.textContent = data.statusText || ('❌ ' + (data.error || 'Tarama tamamlanamadı.'));
        }
      } catch (e) {
        if (replayActiveJobId === jobId) {
          replayPollTimer = setTimeout(function () { pollReplayJob(jobId); }, 2000);
        }
      }
    }
    async function loadReplay(forceRefresh) {
      if (replayActiveJobId) {
        try { await fetch('/api/replay-cancel?jobId=' + encodeURIComponent(replayActiveJobId)); } catch (e) {}
      }
      if (replayPollTimer) { clearTimeout(replayPollTimer); replayPollTimer = null; }
      var line = document.getElementById('replayStatusLine');
      var pWrap = document.getElementById('replayProgressWrap');
      var pBar = document.getElementById('replayProgressBar');
      var tbody = document.getElementById('tbodyReplayTrades');
      var btn = document.getElementById('btnRunReplay');
      var cBtn = document.getElementById('btnCancelReplay');
      var hours = document.getElementById('selReplayHours') ? Number(document.getElementById('selReplayHours').value) : 48;
      var scope = document.getElementById('selReplayScope') ? document.getElementById('selReplayScope').value : 'all';
      var mode = document.getElementById('selReplayMode') ? document.getElementById('selReplayMode').value : 'market';

      if (btn) btn.disabled = true;
      if (cBtn) cBtn.style.display = '';
      if (pWrap) pWrap.style.display = 'block';
      if (pBar) pBar.style.width = '3%';
      if (line) line.textContent = '⏳ Tarama başlatılıyor (' + (scope === 'all' ? 'Tüm Binance ~400 Koin' : 'Likit ~100 Koin') + ' · Son ' + hours + ' Saat)...';
      if (tbody) tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;color:var(--muted);padding:18px;">⏳ Binance Futures grafikleri arka planda taranıyor (zaman aşımı yok)...</td></tr>';

      try {
        var url = '/api/replay-start?hours=' + encodeURIComponent(hours) + '&scope=' + encodeURIComponent(scope) + '&mode=' + encodeURIComponent(mode) + (forceRefresh ? '&force=1' : '');
        var res = await fetch(url);
        var started = await res.json();
        if (!started || !started.ok || !started.jobId) {
          stopReplayPolling();
          if (pWrap) pWrap.style.display = 'none';
          if (line) line.textContent = '❌ Başlatılamadı: ' + ((started && started.error) || 'hata');
          return;
        }
        replayActiveJobId = started.jobId;
        pollReplayJob(started.jobId);
      } catch (e) {
        stopReplayPolling();
        if (pWrap) pWrap.style.display = 'none';
        if (line) line.textContent = '❌ Sunucuya bağlanılamadı.';
      }
    }
    function exportReplayExcel(type) {
      var kind = type === 'coins' ? 'coins' : 'trades';
      if (!replayCache || !replayCache.jobId) {
        loadReplay(false);
        return;
      }
      window.location.href = '/api/replay-csv?jobId=' + encodeURIComponent(replayCache.jobId) + '&type=' + kind;
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
        const riskUsdEl = document.getElementById("stRiskUsd");
        if (riskUsdEl) {
          const rPctNow = (data.settings && data.settings.riskPct) ? parseFloat(data.settings.riskPct) : 7.5;
          riskUsdEl.innerText = '~$' + (parseFloat(data.stats.balance || 100) * (rPctNow / 100)).toFixed(2);
        }
        const pnlEl = document.getElementById("stPnl");
        pnlEl.innerText = (parseFloat(data.stats.totalPnl) >= 0 ? '+' : '') + '$' + data.stats.totalPnl + ' (%' + data.stats.totalRoi + ')';
        pnlEl.style.color = parseFloat(data.stats.totalPnl) >= 0 ? 'var(--green)' : 'var(--red)';
        const actCnt = Number(data.stats.activeCount) || 0;
        document.getElementById("stTotalTrades").innerText = data.stats.totalTrades + (actCnt > 0 ? (' (+' + actCnt + ' Açık)') : '');
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
        const gbr = document.getElementById('gateBtcRegime');
        if (gbr && data.btcRegime && data.btcRegime.label) {
          gbr.innerText = data.btcRegime.label;
          gbr.className = 'status-pill ' + (data.btcRegime.regime === 'BULL' ? 'green' : (data.btcRegime.regime === 'BEAR' ? 'red' : (data.btcRegime.regime === 'CHOP' ? 'amber' : '')));
        }
        const brRow = document.getElementById("gateBreakerRow");
        const br = document.getElementById("gateBreaker");
        if (brRow) brRow.style.display = data.stats.circuit ? 'flex' : 'none';
        if (br) {
          br.innerText = data.stats.circuit ? '🛑 KORUMA AKTİF' : 'kapalı';
          br.className = 'status-pill ' + (data.stats.circuit ? 'red' : '');
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
              ? (p.tp1Taken
                  ? '<span class="badge-be" style="background:#059669;color:#fff;">🔒 RUNNER İZ SÜREN</span>'
                  : '<span class="badge-be">🛡️ KÂR KİLİDİ ($0 RİSK)</span>')
              : '<span class="badge-sl">🛑 STOP: -%' + (p.slPct || 1.5).toFixed(2) + '</span>';

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
                ? (p.tp1Taken
                    ? '<span class="badge-be" style="background:#059669;color:#fff;">🔒 RUNNER İZ SÜREN</span>'
                    : '<span class="badge-be">🛡️ BAŞABAŞ ($0 RİSK)</span>')
                : ('<span class="badge-sl">🛑 STOP: -%' + (p.slPct || 1.5).toFixed(2) + '</span>');
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
    const SET_IDS = { slots: 'inpSlots', riskPct: 'inpRiskPct', lev: 'inpLev' };
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
          replayCache = null;
          await pushSettings(o);
          updateDashboard();
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
  try {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
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
    const items = (tf === '15m' && radarList.length > 0) ? radarList : await scanRadarBoard(tf);
    const tagged = items.map(x => ({
      ...x,
      bot: tf === '15m' && (radarLeaderLong.has(x.symbol) || radarLeaderShort.has(x.symbol))
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ tf, count: tagged.length, items: tagged }));
    return;
  }

  if (pathname === '/api/replay-start') {
    try {
      const hours = Number(parsedUrl.searchParams.get('hours')) || 48;
      const scope = parsedUrl.searchParams.get('scope') || 'all';
      const mode = parsedUrl.searchParams.get('mode') || 'market';
      const force = parsedUrl.searchParams.get('force') === '1';
      const job = startReplayJob(hours, scope, mode, force);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        jobId: job.jobId,
        status: job.status,
        hours: job.hours,
        scope: job.scope,
        mode: job.mode
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
    return;
  }

  if (pathname === '/api/replay-progress') {
    const jobId = parsedUrl.searchParams.get('jobId') || '';
    const job = replayJobs.get(jobId);
    if (!job) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Tarama işi bulunamadı (sunucu yeniden başlamış olabilir).' }));
      return;
    }
    const elapsedSec = Math.max(0, Math.round(((job.finishedAt || Date.now()) - job.startedAt) / 1000));
    const payload = {
      ok: true,
      jobId: job.jobId,
      status: job.status,
      hours: job.hours,
      scope: job.scope,
      mode: job.mode,
      doneCoins: job.doneCoins,
      totalCoins: job.totalCoins,
      loadedCoins: job.loadedCoins,
      eventsFound: job.eventsFound,
      elapsedSec,
      etaSec: job.etaSec,
      statusText: job.statusText,
      error: job.error
    };
    if (job.status === 'done' && job.result) {
      payload.generatedAt = job.result.generatedAt;
      payload.summary = job.result.summary;
      payload.coinSummary = job.result.coinSummary || [];
      payload.totalTradesCount = (job.result.trades || []).length;
      payload.tradesPreview = (job.result.trades || []).slice(0, 600);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
    return;
  }

  if (pathname === '/api/replay-cancel') {
    const jobId = parsedUrl.searchParams.get('jobId') || '';
    const job = replayJobs.get(jobId);
    if (job && job.status === 'running') {
      job.cancelled = true;
      job.statusText = '⏹️ İptal ediliyor...';
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (pathname === '/api/replay-csv') {
    const jobId = parsedUrl.searchParams.get('jobId') || '';
    const type = parsedUrl.searchParams.get('type') === 'coins' ? 'coins' : 'trades';
    const job = replayJobs.get(jobId);
    if (!job || job.status !== 'done' || !job.result) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Önce taramayı tamamlayın.');
      return;
    }
    const s = job.result.summary || {};
    const fname = type === 'coins'
      ? `marscoin_tum_koinler_${s.scope || 'all'}_${s.mode || 'market'}_${s.hours || 48}s.csv`
      : `marscoin_tum_islemler_${s.scope || 'all'}_${s.mode || 'market'}_${s.hours || 48}s.csv`;
    const csv = type === 'coins' ? buildReplayCoinsCsv(job.result) : buildReplayTradesCsv(job.result);
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fname}"`
    });
    res.end(csv);
    return;
  }

  if (pathname === '/api/replay-backtest') {
    try {
      const hours = Number(parsedUrl.searchParams.get('hours')) || 72;
      const coins = Number(parsedUrl.searchParams.get('coins')) || (hours > 240 ? 65 : 120);
      const scope = parsedUrl.searchParams.get('scope') || (coins >= 200 ? 'all' : 'liquid');
      const mode = parsedUrl.searchParams.get('mode') || 'portfolio';
      const result = await runHistoricalReplay(hours, coins, { scope, mode });
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
      btcRegime: liveBtcRegime,
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
      if (body && ((Array.isArray(body.history) && body.history.length > 0) || (Array.isArray(body.positions) && body.positions.length > 0))) {
        const existingIds = new Set(history.map(h => h.id));
        let addedCount = 0;
        if (Array.isArray(body.history)) {
          body.history.forEach(t => {
            if (!existingIds.has(t.id)) {
              history.push(t);
              existingIds.add(t.id);
              addedCount++;
            }
          });
        }
        history.sort((a, b) => (b.id || 0) - (a.id || 0));
        if (history.length > 500) history = history.slice(0, 500);

        let restoredPositions = 0;
        if (Array.isArray(body.positions) && body.positions.length > 0 && activePositions.length === 0) {
          activePositions = body.positions.slice(0, CONFIG.maxSlots);
          restoredPositions = activePositions.length;
        }

        const totalPnl = history.reduce((acc, h) => acc + (h.pnl || 0), 0);
        const activeTpPnl = Array.isArray(activePositions) ? activePositions.reduce((acc, p) => acc + (p.tp1Pnl || 0) + (p.tp2Pnl || 0), 0) : 0;
        balance = CONFIG.initialBalance + totalPnl + activeTpPnl;

        rebuildCoinLossHistory();
        rewriteCsvFile();
        persistState();
        try {
          fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 500), null, 2), 'utf8');
        } catch(e) {}

        addLog(`💾 Bakiye ($${balance.toFixed(2)}), ${history.length} İşlem ve ${restoredPositions} Açık Pozisyon Kurtarıldı! (+${addedCount} yeni)`, 'RESTORE');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, restored: history.length, restoredPositions, balance, added: addedCount }));
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
    randomOpen = [];
    randomClosed = [];
    dayBanLogged.clear();
    if (global.whaleEvaluatedCandles) global.whaleEvaluatedCandles.clear();
    DYNAMIC.mode = 'MARSCOIN_15M_WHALE';
    DYNAMIC.vol3hMin = 0.8;
    DYNAMIC.candidateSlice = 200;
    circuitOn = false;
    isBotActive = true;
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
      riskPct: parsedUrl.searchParams.get('riskPct'),
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
    replayCache.clear();
    addLog(`⚙️ Ayarlar kaydedildi: Slot ${CONFIG.maxSlots} | Risk %${CONFIG.riskPct} (Limitsiz Bileşik) | ${CONFIG.leverage}x | SL %${CONFIG.slPct}`, 'INFO');

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
  } catch (err) {
    try {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err && err.message ? err.message : 'Sunucu hatası' }));
      }
    } catch (e) {}
  }
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
