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

let evaluatePreTradeClearance = () => ({ approved: true, judicialScore: 85, verdict: 'BERAAT', reason: '' });
try {
  const judgeMod = require('./quant_lab/judge_audit');
  evaluatePreTradeClearance = judgeMod.evaluatePreTradeClearance;
} catch (e) {}

// --- EKRAN 1 BİREBİR AYARLARI ---
let CONFIG = {
  initialBalance: 100.0,     // Bakiye 100 Dolar
  marginPerTrade: 15.0,      // Temel Teminat 15$ (Kasa Zirve Kalkanı + Dinamik Bileşik Motor)
  leverage: 20,              // Kaldıraç 20x (Sabit güvenli kaldıraç)
  maxSlots: 2,               // 2 Slot
  slPct: 0.82,               // Nefes alan sıkı SL -%0.82 spot (Normal 3dk gürültüsünde patlamaz, tavan -%0.88)
  bePct: 0.40,               // +%0.40 spot görünce kâr kilidi (+%0.28 spot) devreye girer
  moonPct: 2.00,             // +%2.00 spotta (%15 runner) roket vur-kaç hedefini alır (+%40 ROI)
  tp1Pct: 0.48,              // +%0.48 spotta (+%9.6 ROI) %55 kârı anında cebe indirir
  tp2Pct: 0.80,              // +%0.80 spotta (+%16 ROI) %30 kârı cebe indirir, %15 runner rokete gider
  feeRate: 0.0005,           // Binance Futures taker %0.05 (TEK YÖN)
  scanIntervalMs: 2000,
  riskIntervalMs: 1000,
  radarIntervalMs: 20000
};

// Giriş genişliği. Ajan toplantısı bunu değiştirmez.
let DYNAMIC = {
  vol3hMin: 1.0,
  candidateSlice: 35,
  regime: 'SCALP',
  mode: 'HIZLI_VUR_KAC',
  updatedAt: 0
};

let userRisk = { maxSlots: 2, marginPerTrade: 15 };
let circuitOn = false;

function getDynamicMargin() {
  if (circuitOn) {
    return Math.min(Number(userRisk.marginPerTrade) || 12, 10);
  }
  // 🛡️ KASA ZİRVE KALKANI (Ardışık Zarar Koruması):
  // Son 2 işlem üst üste zarar kapattıysa, yeni bir kazanan işleme kadar teminatı $14.0'a çek!
  const recentTwo = Array.isArray(history) ? history.slice(0, 2) : [];
  if (recentTwo.length === 2 && (recentTwo[0].pnl || 0) < -0.05 && (recentTwo[1].pnl || 0) < -0.05) {
    return 14.0;
  }
  // 🚀 DİNAMİK BİLEŞİK KASA MOTORU (Dynamic Compounding):
  // Kasanın %16'sı teminat olarak kullanılır (min $15.0, tavan $22.0).
  const currentBal = Math.max(balance, 30.0);
  const compoundMargin = currentBal * 0.16;
  return Number(Math.max(15.0, Math.min(compoundMargin, 22.0)).toFixed(1));
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
  if (severe) {
    const nextMargin = Math.min(Number(userRisk.marginPerTrade) || 12, 10);
    const changed = !circuitOn || CONFIG.maxSlots !== 1 || CONFIG.marginPerTrade !== nextMargin;
    circuitOn = true;
    CONFIG.maxSlots = 1;
    CONFIG.marginPerTrade = nextMargin;
    DYNAMIC.mode = 'DEFENSIVE_SNIPER';
    if (changed) {
      addLog(`🛑 Devre kesici: kasa $${balance.toFixed(2)}, zirveden %${(dd * 100).toFixed(1)}. Slot 1, teminat $${nextMargin}. Çıkış ayarı aynı.`, 'RISK');
    }
    return;
  }
  const dynamicMargin = getDynamicMargin();
  if (circuitOn) {
    circuitOn = false;
    CONFIG.maxSlots = userRisk.maxSlots;
    CONFIG.marginPerTrade = dynamicMargin;
    DYNAMIC.mode = 'MARSCOIN_ROCKET';
    addLog(`✅ Devre kesici kapandı. Slot ${CONFIG.maxSlots}, teminat $${CONFIG.marginPerTrade}.`, 'INFO');
  } else {
    CONFIG.maxSlots = userRisk.maxSlots || 2;
    CONFIG.marginPerTrade = dynamicMargin;
    DYNAMIC.mode = 'MARSCOIN_ROCKET';
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
      entry: '3dk Marscoin Trend+Kanal+Runner Motoru (BE +%0.62 / Tier1 +%0.85 / TP1 +%1.05 [%40] / Moon +%2.40)',
      book: 'OBI veto',
      judge: 'açık',
      flow: 'son 12 mum',
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
  'AMPUSDT', 'XAUTUSDT', 'PAXGUSDT'
]);

const KNOWN_CRYPTO_B = new Set(['ARBUSDT', 'CKBUSDT', 'TRBUSDT', 'PHBUSDT', 'AMBUSDT', 'BBUSDT', 'BELUSDT', 'BLZUSDT', 'BOMEUSDT']);
const SYMBOL_REGEX_GLOBAL = /^[A-Z0-9]{2,12}USDT$/;
function isTradableCryptoSymbol(sym) {
  if (!sym || !SYMBOL_REGEX_GLOBAL.test(sym) || sym.startsWith("USDC") || BANNED_SYMBOLS.has(sym)) return false;
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
  const sl = num(s.sl), be = num(s.be), moon = num(s.moon), tp1 = num(s.tp1), tp2 = num(s.tp2);
  if (inRange(slots, 1, 4)) out.maxSlots = Math.round(slots);
  if (inRange(margin, 10, 25)) out.marginPerTrade = margin;
  if (lev !== null) out.leverage = Math.min(20, Math.max(5, Math.round(lev)));
  if (inRange(sl, 0.55, 0.90)) out.slPct = sl;
  if (inRange(be, 0.25, 0.60)) out.bePct = be;
  if (inRange(moon, 1.2, 3.5)) out.moonPct = moon;
  if (inRange(tp1, 0.35, 1.0)) out.tp1Pct = tp1;
  if (inRange(tp2, 0.65, 2.0)) out.tp2Pct = tp2;
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
    clean.maxSlots = 2;
    clean.leverage = 20;
    clean.slPct = 0.82;
    clean.bePct = 0.40;
    clean.tp1Pct = 0.48;
    clean.tp2Pct = 0.80;
    clean.moonPct = 2.00;
    Object.assign(CONFIG, clean);
    rememberUserRisk();
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
      if (Array.isArray(history) && history.length > 0) {
        const totalPnl = history.reduce((acc, h) => acc + (h.pnl || 0), 0);
        const activeTpPnl = Array.isArray(activePositions) ? activePositions.reduce((acc, p) => acc + (p.tp1Pnl || 0) + (p.tp2Pnl || 0), 0) : 0;
        balance = CONFIG.initialBalance + totalPnl + activeTpPnl;
      }
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
  const now = Date.now();
  coinLossCount = {};
  if (!Array.isArray(history) || history.length === 0) return;
  const chron = [...history].sort((a, b) => (a.id || 0) - (b.id || 0));
  const banned = [];
  for (const t of chron) {
    const sym = t.symbol;
    if (!sym) continue;
    const closeMs = parseTrDateMs(t.dateFullStr, now - (30 * 60 * 1000));
    const isLoss = (t.pnl <= -0.05) || (t.exitReason && (t.exitReason.includes("Stop Loss") || t.exitReason.includes("İvmesizlik") || t.exitReason.includes("Durgunluk") || t.exitReason.includes("Zarar")));
    if (isLoss) {
      coinLossCount[sym] = (coinLossCount[sym] || 0) + 1;
      if (coinLossCount[sym] >= 2) {
        coinCooldowns[sym] = Math.max(coinCooldowns[sym] || 0, closeMs + (24 * 60 * 60 * 1000));
        if (!banned.includes(sym)) banned.push(sym);
      } else {
        coinCooldowns[sym] = Math.max(coinCooldowns[sym] || 0, closeMs + (12 * 60 * 60 * 1000));
      }
    } else {
      const winHours = t.side === "LONG" ? 12 : 4;
      coinLossCount[sym] = 0;
      coinCooldowns[sym] = Math.max(coinCooldowns[sym] || 0, closeMs + (winHours * 60 * 60 * 1000));
      const bIdx = banned.indexOf(sym);
      if (bIdx !== -1) banned.splice(bIdx, 1);
    }
  }
  if (banned.length > 0) {
    addLog(`🚫 Koin Zarar Hafızası: 2+ kez zarar veren koinler 24 saat kilitlendi: ${banned.join(", ")}`, 'INFO');
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
      '15dk Sonra (%)'
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
        formatCpPct(trade.cp15m)
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
      formatCpPct(trade.cp15m)
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

setTimeout(runHistoricalDeepScan, 3 * 60 * 1000);
setInterval(runHistoricalDeepScan, 4 * 60 * 60 * 1000);
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
let fapiDownUntil = 0;
let isFapiProbing = false;
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
  if (relativePath.includes('ticker/24hr')) {
    return { ttlMs: 8000, staleMs: 300000 }; // 8 sn taze, 5 dakika stale toleransı
  }
  if (relativePath.includes('interval=1d')) {
    return { ttlMs: 30 * 60 * 1000, staleMs: 60 * 60 * 1000 };
  }
  if (relativePath.includes('klines')) {
    return { ttlMs: 2500, staleMs: 25000 };
  }
  if (relativePath.includes('ticker/price')) {
    return { ttlMs: 800, staleMs: 10000 };
  }
  return { ttlMs: 1500, staleMs: 15000 };
}

async function fetchBinanceRaw(relativePath) {
  // Vadeli ayna cevap vermiyorsa (veya ABD IP 451 engeli varsa) tek bir probe dışındaki tüm istekler doğrudan Spot havuzuna geçer.
  if (Date.now() >= fapiDownUntil && !isFapiProbing) {
    isFapiProbing = true;
    try {
      const probeTimeoutMs = relativePath.includes('ticker/24hr') ? 9500 : 3500;
      for (const base of BINANCE_FAPI_MIRRORS) {
        try {
          const targetUrl = base + relativePath;
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), probeTimeoutMs);
          const res = await fetch(targetUrl, {
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'application/json'
            }
          });
          clearTimeout(timeoutId);
          if (res.status === 429 || res.status === 418) break;
          if (res.status === 451) continue;
          if (!res.ok) continue;
          const data = await res.json();
          if (data) {
            fapiDownUntil = 0;
            noteFeed(relativePath, 'futures');
            return data;
          }
        } catch (e) {}
      }
      // Render ABD IP'sinde vadeli uçlar 451 veya timeout verdiğinde paralel istekleri 10 dk beklet
      fapiDownUntil = Date.now() + 10 * 60 * 1000;
    } finally {
      isFapiProbing = false;
    }
  }

  const spotPath = relativePath.replace(/^\/fapi\/v1\//, '/api/v3/');
  const now = Date.now();
  for (const spotBase of BINANCE_SPOT_MIRRORS) {
    const downUntil = spotMirrorDownUntil.get(spotBase) || 0;
    if (now < downUntil) continue;

    const spotUrl = spotBase + spotPath;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutMs = relativePath.includes('ticker/24hr') ? 9500 : 4500;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const res = await fetch(spotUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json'
          }
        });
        clearTimeout(timeoutId);
        if (res.status === 400 || res.status === 404) return null; // Spot borsasında olmayan vadeli sembol
        if (res.status === 451) {
          spotMirrorDownUntil.set(spotBase, Date.now() + 30 * 60 * 1000);
          break;
        }
        if (res.status === 429 || res.status === 418) {
          spotMirrorDownUntil.set(spotBase, Date.now() + 60 * 1000);
          break;
        }
        if (res.ok) {
          const data = await res.json();
          if (data) {
            noteFeed(relativePath, 'spot');
            return data;
          }
        }
      } catch (e) {}
    }
  }

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
        warnFetch('Binance fiyatı alınamadı. Tarama durdu, işlem açılmıyor.');
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

    const validAll = tickers.filter(t => {
      if (!isTradableCryptoSymbol(t.symbol)) return false;
      const p = parseFloat(t.lastPrice) || 0;
      const volM = (parseFloat(t.quoteVolume) || 0) / 1e6;
      return p >= 0.008 && volM >= 1.5;
    });

    // 🚀 HEM YÜKSEK İVMELİ (+%10-%50) BREAKOUT KOİNLERİ HEM DE LİKİT DEVLERİ TARA
    const byMomentum = [...validAll]
      .filter(t => ((parseFloat(t.quoteVolume) || 0) / 1e6) >= 1.8 && Math.abs(parseFloat(t.priceChangePercent) || 0) <= 65)
      .sort((a, b) => Math.abs(parseFloat(b.priceChangePercent) || 0) - Math.abs(parseFloat(a.priceChangePercent) || 0))
      .slice(0, 75);
    const byVolume = [...validAll]
      .sort((a, b) => (parseFloat(b.quoteVolume) || 0) - (parseFloat(a.quoteVolume) || 0))
      .slice(0, 60);

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
    for (let i = 0; i < Math.min(valid.length, 120); i += chunkSize) {
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
    applyCircuitBreaker();
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
    if (!tickers || !Array.isArray(tickers)) {
      if (Date.now() - lastScanHeartbeat > 60000) {
        lastScanHeartbeat = Date.now();
        addLog('Fiyat listesi boş. Yeni işlem açılmıyor.', 'WARN');
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
      return p >= 0.008; // 🛡️ Kuruşluk manipülatif ve spreadi yüksek koinler (AMP, SOLV vb.) filtrelenir
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

      // 🎯 MARSCOIN RADAR & BALİNA ÖNCELİĞİ: +%10-%50 yürüyen koinler de taranır!
      const rInfo = radarMap[sym];
      let radarBoost = 0;
      if (rInfo) {
        if (rInfo.signal && rInfo.signal.includes("BALİNA")) radarBoost += 60;
        else if (rInfo.signal && (rInfo.signal.includes("ROKET") || rInfo.signal.includes("BOĞA") || rInfo.signal.includes("SIÇRAMA"))) radarBoost += 35;
        if (Math.abs(rInfo.chg15m || 0) >= 0.8) radarBoost += Math.min(40, Math.abs(rInfo.chg15m) * 10);
        if ((rInfo.takerBuyRatio || 50) >= 54.0 || (rInfo.taker15m || 50) >= 55.0) radarBoost += 20;
      }

      const cappedDailyChg = Math.min(Math.abs(rawChg), 35.0);
      const hotScore = (Math.abs(rollMovePct) * 28) + radarBoost + (cappedDailyChg * 1.4) + Math.min(volM * 0.15, 18) + (isVip ? 25 : 0);

      return {
        ...t,
        volM,
        chg: rawChg,
        rollMovePct,
        hotScore,
        isVip
      };
    })
    .filter(t => (t.isVip || t.volM >= 1.5) && t.chg <= 65 && t.chg >= -40)
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, DYNAMIC.candidateSlice);

    if (now - lastScanHeartbeat > 45000 && topCandidates.length > 0) {
      lastScanHeartbeat = now;
      addLog(`🔍 ${validTickers.length} Koin Taranıyor (En Sıcak ${topCandidates.length} Aday Mercekte) | Lider: ${topCandidates[0].symbol} (%${topCandidates[0].chg.toFixed(1)}, Puan: ${topCandidates[0].hotScore.toFixed(0)}) | Slot: ${activePositions.length}/${CONFIG.maxSlots}`);
    }

    // 5'li paralel kline taraması (3m Marscoin Motoru)
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
        if (lastP < 0.008) return null;
        const k3m = await fetchBinance(`/fapi/v1/klines?symbol=${sym}&interval=3m&limit=30`);
        return { sym, lastP, k3m, chg: parseFloat(item.priceChangePercent) || 0, isVip: item.isVip, volM: item.volM };
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
        // 🛡️ KÖR GİRİŞ ENGELİ: 3 saatlik / 15 dakikalık radar verisi ve fiyat kanalı olmayan koine asla girme!
        if (!rInfo || !rInfo.high3h || !rInfo.low3h) continue;
        const vol24 = data.volM || rInfo.vol24hM || 0;
        if (!isVip && vol24 < 1.8) continue;

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
        const prevH = parseFloat(k3m[lastIdx - 1][2]);
        const prevL = parseFloat(k3m[lastIdx - 1][3]);
        const prevV = parseFloat(k3m[lastIdx - 1][5]);

        const recentVols = [];
        for (let m = Math.max(0, lastIdx - 12); m < lastIdx; m++) {
          recentVols.push(parseFloat(k3m[m][5]) || 0);
        }
        const sortedVols = [...recentVols].sort((a, b) => a - b);
        const medianVol12 = sortedVols[Math.floor(sortedVols.length / 2)] || 1;
        let sumVol20 = 0;
        for (let m = lastIdx - 20; m < lastIdx; m++) sumVol20 += parseFloat(k3m[m][5]);
        const avgVol20 = (sumVol20 / 20) || 1;
        // 1 saat önceki tekil hacim patlamasının (outlier) sonraki sağlıklı kırılım mumlarını "hacimsiz" göstermesini engellemek için medyan korumalı taban hacim
        const baselineVol = Math.min(avgVol20, medianVol12 * 1.35) || 1;

        const curMovePct = ((curP - curO) / curO) * 100;
        const prevMovePct = prevO > 0 ? ((prevC - prevO) / prevO) * 100 : 0;
        const twoCandleMovePct = ((curP - prevO) / prevO) * 100;

        // Son 5 tam mumdan (15dk), 10 mumdan (30dk), 20 mumdan (1s) ve 30 mumdan (90dk) gerçek kline akış metrikleri
        const slice15m = k3m.slice(-5);
        const open15mCalc = parseFloat(slice15m[0][1]) || curO;
        const chg15mCalc = open15mCalc > 0 ? ((curP - open15mCalc) / open15mCalc) * 100 : 0;
        const quote15mCalc = slice15m.reduce((acc, k) => acc + (parseFloat(k[7]) || 0), 0);
        const takerBuy15mCalc = slice15m.reduce((acc, k) => acc + (parseFloat(k[10]) || 0), 0);
        const taker15mCalc = quote15mCalc > 0 ? (takerBuy15mCalc / quote15mCalc) * 100 : 50;

        const open15mTrue = parseFloat(k3m[Math.max(0, lastIdx - 5)][1]) || curO;
        const chg15mTrue = open15mTrue > 0 ? ((curP - open15mTrue) / open15mTrue) * 100 : 0;
        const open30mCalc = parseFloat(k3m[Math.max(0, lastIdx - 10)][1]) || curO;
        const chg30mCalc = open30mCalc > 0 ? ((curP - open30mCalc) / open30mCalc) * 100 : 0;
        const open1hCalc = parseFloat(k3m[Math.max(0, lastIdx - 20)][1]) || curO;
        const chg1hCalc = open1hCalc > 0 ? ((curP - open1hCalc) / open1hCalc) * 100 : 0;

        // 📏 1 SAATLİK (20x3dk) KANAL KONUMU (pos1h) & 3dk RSI-14:
        // LONG: 1 saatlik kanalın %50-%80 soluklanma bölgesinden kalkmalı (pos1h > %80 tepe kovalamasını ve pos1h < %50 düşen bıçağı keser).
        // SHORT: 1 saatlik kanalın desteğini aşağı kırarken (pos1h <= %12) açılmalı (kanal ortası %15-%60 tepki yükselişlerinde short açmayı keser).
        let hi1h = -Infinity, lo1h = Infinity;
        for (let m = Math.max(0, lastIdx - 20); m < lastIdx; m++) {
          const mh = parseFloat(k3m[m][2]), ml = parseFloat(k3m[m][3]);
          if (mh > hi1h) hi1h = mh;
          if (ml < lo1h) lo1h = ml;
        }
        const pos1h = hi1h > lo1h ? ((curP - lo1h) / (hi1h - lo1h)) * 100 : 50;

        let rsiGains = 0, rsiLosses = 0;
        for (let m = Math.max(1, lastIdx - 14); m < lastIdx; m++) {
          const diff = parseFloat(k3m[m][4]) - parseFloat(k3m[m - 1][4]);
          if (diff > 0) rsiGains += diff; else rsiLosses -= diff;
        }
        const rsi3m = rsiLosses === 0 ? 100 : 100 - (100 / (1 + (rsiGains / rsiLosses)));

        const open90mCalc = parseFloat(k3m[0][1]) || curO;
        const chg90mCalc = open90mCalc > 0 ? ((curP - open90mCalc) / open90mCalc) * 100 : 0;
        const quote90mCalc = k3m.reduce((acc, k) => acc + (parseFloat(k[7]) || 0), 0);
        const takerBuy90mCalc = k3m.reduce((acc, k) => acc + (parseFloat(k[10]) || 0), 0);
        const taker90mCalc = quote90mCalc > 0 ? (takerBuy90mCalc / quote90mCalc) * 100 : 50;

        const sig = rInfo.signal || "⚖️ NÖTR";
        const chg24Val = Number.isFinite(Number(rInfo.chg24h)) ? Number(rInfo.chg24h) : chg;
        const rawChg15 = Number.isFinite(Number(rInfo.chg15m)) ? Number(rInfo.chg15m) : chg15mCalc;
        const chg15Long = Math.max(rawChg15, chg15mCalc);
        const chg15Short = Math.min(rawChg15, chg15mCalc);
        const chg3hVal = Number.isFinite(Number(rInfo.chg3h)) ? Number(rInfo.chg3h) : chg90mCalc;

        // 🛡️ DÜZELTME: 12 saniyelik 3m mumundaki sahte %75-%99 taker yanılsaması (Math.max taker3m) KALDIRILDI!
        // Gerçek 3 saatlik ve 15 dakikalık (5x3m) kurumsal alıcı/satıcı akışı baz alınır.
        const radarTaker3h = Number.isFinite(Number(rInfo.takerBuyRatio)) ? Number(rInfo.takerBuyRatio) : taker90mCalc;
        const radarTaker15m = Number.isFinite(Number(rInfo.taker15m)) ? Number(rInfo.taker15m) : taker15mCalc;
        const avg15mTaker = (radarTaker15m + taker15mCalc) / 2;
        const effectiveTaker = Math.max(
          (radarTaker3h * 0.45) + (avg15mTaker * 0.55),
          radarTaker3h >= 49.0 ? avg15mTaker * 0.98 : (radarTaker3h * 0.50) + (avg15mTaker * 0.50)
        );
        const effectiveTakerShort = Math.min(
          (radarTaker3h * 0.45) + (avg15mTaker * 0.55),
          radarTaker3h <= 51.0 ? avg15mTaker * 1.02 : (radarTaker3h * 0.50) + (avg15mTaker * 0.50)
        );

        // 📏 3 SAATLİK KANAL KONUMU:
        const rangeSpan3h = (rInfo.high3h || curP) - (rInfo.low3h || curP);
        const rangePos = rangeSpan3h > 0 ? ((curP - rInfo.low3h) / rangeSpan3h) * 100 : 50;

        // 📐 VOLATİLİTE (3dk ATR-14, %): Stop mesafesi koinin normal gürültüsüne göre ayarlanır
        let trSum = 0, trCount = 0;
        for (let m = Math.max(1, lastIdx - 14); m < lastIdx; m++) {
          const h = parseFloat(k3m[m][2]), l = parseFloat(k3m[m][3]), pc = parseFloat(k3m[m - 1][4]);
          if (pc > 0) {
            trSum += (Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)) / pc) * 100;
            trCount++;
          }
        }
        const atr3mPct = trCount > 0 ? trSum / trCount : 0.5;

        // 🧭 ÇOKLU ZAMAN DİLİMİ (15dk + 30dk + 1s + 3s + 24s), 1S KANAL (pos1h), VOLATİLİTE & RSI-14 UYUMU:
        // LONG: 3s, 1s (+%0.70+) ve 30dk (+%0.50+) sağlıklı yükselişte olmalı;
        // 1s kanalında %45-%88 arası soluklanma/kırılım modunda, RSI 48-74 bandında ve 3dk ATR <= %1.75 olmalı!
        // LONG: 24s (+%2.0+), 3s (+%1.6..+%7.5) ve 15dk (+%0.65+) güçlü yükselişte olmalı;
        // 1s ve 3s direnç kırılımlarında pos1h (%45-%120) ve rangePos (%45-%108) tavan kilidine takılmamalı!
        const radarOkLong =
          !sig.includes("ŞELALE") &&
          !sig.includes("AYI") &&
          chg24Val >= 2.0 && chg24Val <= 45.0 &&
          chg3hVal >= 1.6 && chg3hVal <= 7.5 &&
          chg1hCalc >= 0.25 && chg1hCalc <= 12.0 && chg30mCalc >= 0.15 && chg15Long >= 0.65 &&
          rangePos >= 45.0 && rangePos <= 108.0 &&
          pos1h >= 45.0 && pos1h <= 120.0 &&
          rsi3m >= 48.0 && rsi3m <= 78.0 &&
          atr3mPct >= 0.35 && atr3mPct <= 1.65;

        // SHORT: BTC yeşilken (>+%0.02) veya koin V-tepki yükselişindeyken (pos1h > %18, Kanal > %24) short yasak!
        // Gerçek 1 saatlik destek kırılımı (pos1h <= %18, Kanal %3-%24) ve aşırı çökmemiş (3s -%1.8..-%6.5, 24s -%2.5..-%15.5) koinler!
        const radarOkShort =
          !sig.includes("ROKET") &&
          !sig.includes("BOĞA") &&
          btc15mNumeric <= 0.02 && btc5mNumeric <= 0.05 &&
          chg24Val <= -2.5 && chg24Val >= -15.5 &&
          chg3hVal <= -1.8 && chg3hVal >= -6.5 &&
          chg1hCalc <= -0.25 && chg30mCalc <= -0.20 && chg15Short <= -0.32 &&
          rangePos >= 3.0 && rangePos <= 24.0 &&
          pos1h <= 18.0 &&
          rsi3m >= 18.0 && rsi3m <= 48.0 &&
          atr3mPct >= 0.25 && atr3mPct <= 0.95;

        if (!radarOkLong && !radarOkShort) {
          // 👻 Radar'a ÇOK YAKIN elenen adayları da kaydet (yeni 1s/30dk/pos1h/RSI/ATR filtrelerinin etkisi ölçülebilsin)
          const nearLong = chg24Val >= 1.2 && chg3hVal >= 1.5 && chg15Long >= 0.12;
          const nearShort = chg24Val <= -1.8 && chg3hVal <= -1.5 && chg15Short <= -0.10;
          if (nearLong || nearShort) {
            const nSide = nearLong ? 'LONG' : 'SHORT';
            let why = 'RADAR_OTHER';
            if (nSide === 'LONG') {
              if (chg1hCalc < 0.70 || chg1hCalc > 7.5) why = 'RADAR_1H';
              else if (chg30mCalc < 0.50) why = 'RADAR_30M';
              else if (pos1h < 45 || pos1h > 88) why = 'RADAR_POS1H';
              else if (rsi3m < 48 || rsi3m > 74) why = 'RADAR_RSI';
              else if (atr3mPct > 1.75) why = 'RADAR_ATR';
              else if (rangePos < 40 || rangePos > 90) why = 'RADAR_RANGE';
            } else {
              if (chg1hCalc > -0.30) why = 'RADAR_1H';
              else if (chg30mCalc > -0.35) why = 'RADAR_30M';
              else if (pos1h > 24) why = 'RADAR_POS1H';
              else if (rsi3m < 15 || rsi3m > 55) why = 'RADAR_RSI';
              else if (rangePos < 2 || rangePos > 55) why = 'RADAR_RANGE';
            }
            recordShadowSignal({
              symbol: sym, side: nSide, stage: why, price: curP,
              chg15: Number((nSide === 'LONG' ? chg15Long : chg15Short).toFixed(2)),
              chg3h: Number(chg3hVal.toFixed(2)), chg24h: Number(chg24Val.toFixed(2)),
              rangePos: Number(rangePos.toFixed(0)),
              taker: Number((nSide === 'LONG' ? effectiveTaker : effectiveTakerShort).toFixed(1)),
              cur3m: Number(curMovePct.toFixed(2)), prev3m: Number(prevMovePct.toFixed(2)),
              atr3m: Number(atr3mPct.toFixed(2)), signal: sig
            });
          }
          continue;
        }

        // 👻 GÖLGE SİNYAL KAYDI: Radar ön filtresini geçen her aday, açılsa da reddedilse de kaydedilir
        const shadowSide = radarOkLong ? 'LONG' : 'SHORT';
        const shadow = (stage, extra = {}) => recordShadowSignal({
          symbol: sym, side: shadowSide, stage, price: curP,
          chg15: Number((shadowSide === 'LONG' ? chg15Long : chg15Short).toFixed(2)),
          chg3h: Number(chg3hVal.toFixed(2)), chg24h: Number(chg24Val.toFixed(2)),
          rangePos: Number(rangePos.toFixed(0)),
          taker: Number((shadowSide === 'LONG' ? effectiveTaker : effectiveTakerShort).toFixed(1)),
          cur3m: Number(curMovePct.toFixed(2)), prev3m: Number(prevMovePct.toFixed(2)),
          atr3m: Number(atr3mPct.toFixed(2)), signal: sig, ...extra
        });

        let radarTag = "";

        // 🕐 1. 3 DAKİKALIK MUM TEYİDİ & KAPANMAMIŞ İLK 18 SANİYE TUZAĞI ENGELİ
        const candleStart = (k3m[lastIdx] && k3m[lastIdx][0]) ? k3m[lastIdx][0] : (Date.now() - 90000);
        const candleElapsedSec = (Date.now() - candleStart) / 1000;
        // Yeni açılmış mumun ilk 18 saniyesindeki sahte/anlık fitillere atlama!
        if (candleElapsedSec < 18) continue;
        const clampedElapsed = Math.max(18, Math.min(180, candleElapsedSec));
        const curPaceVol = curV * (180 / Math.max(24, clampedElapsed));
        const rawVolMult = curPaceVol / baselineVol;
        const prevVolMult = prevV / baselineVol;
        const volMult = Math.max(rawVolMult, (rawVolMult * 0.60) + (prevVolMult * 0.40));
        const spikeVolMult = (curPaceVol / avgVol20);

        // Aktif veya bir önceki 3dk mumunda aşırı (+%1.55+) fırlamışsa fitil tepesinden kovalama!
        if (Math.abs(curMovePct) > 1.55 || Math.abs(prevMovePct) > 1.35 || Math.abs(twoCandleMovePct) > 2.45) {
          shadow('CLIMAX');
          continue;
        }

        // 🧱 2. EMİLİM (ABSORPTION / EFFORT vs. RESULT) FİLTRESİ:
        const isCurrentAbsorbed = spikeVolMult >= 4.5 && ((Math.abs(curMovePct) / spikeVolMult) < 0.085 || Math.abs(curMovePct) < 0.35);
        const isPrevAbsorbed = (prevV / avgVol20) >= 3.8 && Math.abs(prevMovePct) < 0.18;
        if (isCurrentAbsorbed || isPrevAbsorbed) {
          shadow('ABSORPTION', { volMult: Number(spikeVolMult.toFixed(2)) });
          continue;
        }

        // 4. Kural: Mum Dikliği (Wick Filtresi) - Zirveden satış yemiş fitilli mumları ele
        const candleSpan = curH - curL;
        const upperWick = curH - Math.max(curP, curO);
        const lowerWick = Math.min(curP, curO) - curL;
        const noWickLong = candleSpan > 0 ? (upperWick / candleSpan <= 0.40) : true;
        const noWickShort = candleSpan > 0 ? (lowerWick / candleSpan <= 0.40) : true;

        const vol3hCheck = rInfo.vol3hM || ((quote90mCalc * 2) / 1e6);
        const hasRealLiquidity = isVip || (vol3hCheck >= 0.70 && vol24 >= 1.5);
        const hasBuyerDominance = effectiveTaker >= 52.0 && effectiveTaker <= 84.0 && taker15mCalc >= 50.5;
        const hasSellerDominance = effectiveTakerShort <= 46.0 && effectiveTakerShort >= 16.0 && taker15mCalc <= 48.5;

        // 📐 3. KAPANMIŞ MUM & YAPI KIRILIMI + DİRENÇ ÜSTÜ KALICILIK TEYİDİ:
        const brokePrevHigh = curP > prevH || (curP > prevC && (prevC >= prevO || curMovePct >= 0.22) && curP >= prevH * 0.9982);
        const brokePrevLow = curP < prevL || (curP < prevC && (prevC <= prevO || curMovePct <= -0.22) && curP <= prevL * 1.0018);
        const isBreakoutHoldLong = prevMovePct >= 0.28 && prevMovePct <= 0.85 && curMovePct >= 0.12 && curP >= prevC && twoCandleMovePct >= 0.38;
        const isBreakoutHoldShort = prevMovePct <= -0.28 && prevMovePct >= -0.85 && curMovePct <= -0.12 && curP <= prevC && twoCandleMovePct <= -0.38;
        const continuationLong = (curP > curO && brokePrevHigh) || isBreakoutHoldLong;
        const continuationShort = (curP < curO && brokePrevLow) || isBreakoutHoldShort;

        // 🟢 MARSCOIN ÇOKLU ZAMAN DİLİMİ + 2-MUM ONAYLI HACİMLİ KIRILIM LONG MOTORU:
        let isLongPump = false;
        let isRocketSignal = false;
        if (hasRealLiquidity && noWickLong && hasBuyerDominance && radarOkLong && continuationLong && !nearMax6m) {
          if (curMovePct >= 0.28 && prevMovePct >= -0.10 && twoCandleMovePct >= 0.36 && volMult >= 1.00 && spikeVolMult <= 5.2 && chg3hVal >= 1.6) {
            isLongPump = true;
            isRocketSignal = true;
            radarTag = `[🚀 MARSCOIN ROKET SPIKE | 3dk: +%${curMovePct.toFixed(2)} | 1s: +%${chg1hCalc.toFixed(1)} | Pos1h: %${pos1h.toFixed(0)} | RSI: ${rsi3m.toFixed(0)} | Kanal: %${rangePos.toFixed(0)}]`;
          }
        }

        // 🔴 MARSCOIN 1S DESTEK KIRILIMI + 2-MUM ONAYLI ŞELALE SHORT MOTORU:
        let isShortDump = false;
        if (hasRealLiquidity && noWickShort && hasSellerDominance && radarOkShort && continuationShort && btc15mNumeric <= 0.02 && btc5mNumeric <= 0.05) {
          if (
            curMovePct <= -0.22 &&
            prevMovePct <= 0.00 &&
            twoCandleMovePct <= -0.30 &&
            volMult >= 0.75 && spikeVolMult <= 5.2 &&
            effectiveTakerShort <= 46.0
          ) {
            isShortDump = true;
            radarTag = `[🩸 MARSCOIN ŞELALE SHORT | 3dk: %${curMovePct.toFixed(2)} | 1s: %${chg1hCalc.toFixed(1)} | Pos1h: %${pos1h.toFixed(0)} | RSI: ${rsi3m.toFixed(0)} | Kanal: %${rangePos.toFixed(0)}]`;
          }
        }

        if (!isLongPump && !isShortDump) {
          shadow('NO_TRIGGER', { volMult: Number(volMult.toFixed(2)) });
        }

        if (isLongPump || isShortDump) {
          const side = isLongPump ? "LONG" : "SHORT";

          let scoutInfo = null;
          if (k3m && k3m.length >= 8) {
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
            if (priceChg >= 0.50 && takerPct <= 48.0) cvdDivergence = 'BEARISH_DIVERGENCE';
            else if (priceChg <= -0.50 && takerPct >= 52.0) cvdDivergence = 'BULLISH_DIVERGENCE';
            scoutInfo = {
              cvdDivergence,
              isApprovedLong: takerPct >= 49.5 && netFlowM >= -0.05,
              isApprovedShort: takerPct <= 50.5 && netFlowM <= 0.05,
              netFlowM: Number(netFlowM.toFixed(3)),
              takerPct
            };
          }
          if (scoutInfo) {
            if (side === 'LONG' && scoutInfo.cvdDivergence === 'BEARISH_DIVERGENCE') {
              addLog(`🛑 [AKIŞ VETO]: ${sym} LONG — son 12 mumda fiyat yükselirken alıcı zayıf.`, 'WARN');
              shadow('FLOW_VETO');
              continue;
            }
            if (side === 'SHORT' && scoutInfo.cvdDivergence === 'BULLISH_DIVERGENCE') {
              addLog(`🛑 [AKIŞ VETO]: ${sym} SHORT — son 12 mumda fiyat düşerken alıcı güçlü.`, 'WARN');
              shadow('FLOW_VETO');
              continue;
            }
            if (side === 'LONG' && scoutInfo.isApprovedLong === false) {
              addLog(`🛑 [AKIŞ VETO]: ${sym} LONG — son 12 mumda net alıcı yok.`, 'WARN');
              shadow('FLOW_VETO');
              continue;
            }
            if (side === 'SHORT' && scoutInfo.isApprovedShort === false) {
              addLog(`🛑 [AKIŞ VETO]: ${sym} SHORT — son 12 mumda net satıcı yok.`, 'WARN');
              shadow('FLOW_VETO');
              continue;
            }
          }

          let depthData = null;
          try {
            depthData = await fetchBinance(`/fapi/v1/depth?symbol=${sym}&limit=10`);
          } catch(e) {}
          if (depthData && Array.isArray(depthData.bids) && Array.isArray(depthData.asks)) {
            const bidVol = depthData.bids.reduce((acc, b) => acc + ((parseFloat(b[0]) || 0) * (parseFloat(b[1]) || 0)), 0);
            const askVol = depthData.asks.reduce((acc, a) => acc + ((parseFloat(a[0]) || 0) * (parseFloat(a[1]) || 0)), 0);
            const totalDepth = bidVol + askVol;
            if (totalDepth > 0) {
              const obi = (bidVol - askVol) / totalDepth;
              if (side === 'LONG' && obi < -0.35) {
                addLog(`🛑 [OBI VETO]: ${sym} LONG — Satış duvarı (OBI: ${obi.toFixed(2)}).`, 'WARN');
                shadow('OBI_VETO', { obi: Number(obi.toFixed(2)) });
                continue;
              }
              if (side === 'SHORT' && obi > 0.35) {
                addLog(`🛑 [OBI VETO]: ${sym} SHORT — Alış duvarı (OBI: +${obi.toFixed(2)}).`, 'WARN');
                shadow('OBI_VETO', { obi: Number(obi.toFixed(2)) });
                continue;
              }
            }
          }

          const judgeTakerInput = side === 'LONG' ? effectiveTaker : effectiveTakerShort;
          const judgeChg15Input = side === 'LONG' ? chg15Long : chg15Short;
          let judgeClearance = null;
          try {
            judgeClearance = evaluatePreTradeClearance(sym, side, {
              takerBuyRatio: judgeTakerInput,
              chg15m: judgeChg15Input,
              chg3h: chg3hVal,
              chg24h: chg24Val
            });
          } catch(e) {}

          if (!judgeClearance || judgeClearance.approved !== true) {
            coinCooldowns[sym] = now + (5 * 60 * 1000);
            addLog(`🛡️ [YARGIÇ VETO]: ${sym} ${side} engellendi — ${(judgeClearance && judgeClearance.reason) || 'yargıç cevap vermedi'}`, 'WARN');
            shadow('JUDGE_VETO');
            continue;
          }

          if (activePositions.length >= CONFIG.maxSlots) {
            continue;
          }

          // 📐 VOLATİLİTEYE VE DİNAMİK BİLEŞİK KASAYA GÖRE TEMİNAT & HEDEFLER:
          // Teminat Dinamik Bileşik Kasa Motorundan (%18) gelir ($116 bakiyede ~$21, $150 bakiyede $27).
          // Stop = 1.6 × 3dk ATR (taban %0.78, tavan %2.0). Stop genişledikçe teminat aynı oranda küçülür,
          // böylece işlem başına dolar riski sabit kalır. Kâr kademeleri (BE, kilit, TP1, TP2, Moon) volK ile ölçeklenir.
          const baseMargin = getDynamicMargin();
          const baseSlPct = Math.min(0.88, Math.max(0.65, Number(CONFIG.slPct) || 0.82));
          const tradeSlPct = Math.min(0.88, Math.max(0.72, baseSlPct));
          const volK = 1.0;
          let tradeMargin = Number(baseMargin.toFixed(2));

          // 🛡️ KASA SERBEST NAKİT KORUMASI: Açık pozisyonlar ve yeni işlem serbest bakiyeyi aşamaz
          const usedMargin = activePositions.reduce((acc, p) => acc + (p.margin || 0), 0);
          const freeMargin = Math.max(0, balance - usedMargin);
          if (tradeMargin > freeMargin) {
            tradeMargin = Number(freeMargin.toFixed(2));
          }
          if (tradeMargin < 10.0) {
            continue; // Yetersiz serbest teminat
          }

          const tradeBePct = Number(CONFIG.bePct) || 0.40;
          const tradeTp1Pct = Number(CONFIG.tp1Pct) || 0.48;
          const tradeTp2Pct = Number(CONFIG.tp2Pct) || 0.80;
          const tradeMoonPct = Number(CONFIG.moonPct) || 2.00;
          radarTag += ` [SL: %${tradeSlPct.toFixed(2)} | ATR3m: %${atr3mPct.toFixed(2)} | Teminat: $${tradeMargin.toFixed(1)}]`;

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
            tp1Pnl: 0,
            tp2Pnl: 0,
            mfe: 0.0,
            mae: 0.0,
            pnl: 0.0,
            roi: 0.0,
            cp1m: null,
            cp3m: null,
            cp5m: null,
            cp15m: null,
            entryRsi: 50,
            margin: tradeMargin,
            initialMargin: tradeMargin,
            leverage: CONFIG.leverage,
            slPct: tradeSlPct,
            volK: volK,
            atr3mPct: atr3mPct,
            bePct: tradeBePct,
            tp1Pct: tradeTp1Pct,
            tp2Pct: tradeTp2Pct,
            moonPct: tradeMoonPct,
            convictionTier: isRocketSignal ? 'A_PLUS' : 'B_STANDARD',
            convictionScore: isRocketSignal ? 90 : 75,
            convictionLabel: isRocketSignal ? '🚀 MARSCOIN ROKET' : '🐋 BALİNA MOMENTUM',
            radarTag: radarTag,
            chg3h: chg3hVal,
            vol3hM: vol3hCheck,
            chg24h: chg24Val,
            range3h: rInfo.range3h || "",
            takerBuyRatio: judgeTakerInput,
            signal: rInfo.signal || (side === "LONG" ? "🟢 GÜÇLÜ BOĞA" : "🔴 GÜÇLÜ AYI"),
            btc5mEntry: btc5mNumeric,
            btc15mEntry: btc15mNumeric
          };

          activePositions.push(position);
          activeSyms.add(sym);
          signalFound = true;
          lastTradeOpenTime = Date.now();
          persistState();
          shadow('TAKEN', { slPct: Number(tradeSlPct.toFixed(2)) });

          addLog(`🚀 POZİSYON AÇILDI: [${side}] ${sym} @ $${curP.toFixed(4)} | ${radarTag} | Teminat: $${tradeMargin.toFixed(1)} | SL: $${stopPrice.toFixed(4)} | TP1: +%${(tradeTp1Pct * volK).toFixed(2)} | TP2: +%${(tradeTp2Pct * volK).toFixed(2)} | Moon: +%${(tradeMoonPct * volK).toFixed(2)}`, 'TRADE');
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
    // 🛡️ Sadece 20+ dakika boyunca hiç yürüyememiş ve yatay kalmış işlemleri rotasyona sok.
    if (durMin >= 20 && (pos.mfe || 0) < 0.25 && Math.abs(pos.roi || 0) <= 2.5) {
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
      const durMin = (now - pos.entryTime) / 60000;

      // 📊 SİNYAL SONRASI 1, 3, 5 ve 15. DAKİKA PERFORMANS TELEMETRİSİ
      if (durMin >= 1 && (pos.cp1m === null || pos.cp1m === undefined)) { pos.cp1m = Number(move.toFixed(2)); stateChanged = true; }
      if (durMin >= 3 && (pos.cp3m === null || pos.cp3m === undefined)) { pos.cp3m = Number(move.toFixed(2)); stateChanged = true; }
      if (durMin >= 5 && (pos.cp5m === null || pos.cp5m === undefined)) { pos.cp5m = Number(move.toFixed(2)); stateChanged = true; }
      if (durMin >= 15 && (pos.cp15m === null || pos.cp15m === undefined)) { pos.cp15m = Number(move.toFixed(2)); stateChanged = true; }

      const nominalSize = pos.margin * pos.leverage;
      const feeCost = nominalSize * CONFIG.feeRate * 2;
      pos.pnl = (nominalSize * (move / 100)) - feeCost;
      pos.roi = (pos.pnl / pos.margin) * 100;

      let exitReason = null;

      // 📐 VOLATİLİTE ÖLÇEĞİ: Tüm eşikler "normal koin" (%0.78 stop) birimindedir.
      // nMove/nMfe = hareket / volK. Stop/kilit fiyatları ise eşik × volK ile hesaplanır.
      const k = Math.max(1, Number(pos.volK) || 1);
      const nMove = move / k;
      const nMfe = mfe / k;
      const lockSpot = (pct) => isLong ? pos.entryPrice * (1 + pct / 100) : pos.entryPrice * (1 - pct / 100);

      // ========================================================
      // 🛑 1. STOP LOSS VEYA KİLİTLİ STOP KONTROLÜ (EN YÜKSEK ÖNCELİK)
      // ========================================================
      const isStopHit = (isLong && curP <= pos.stopPrice) || (!isLong && curP >= pos.stopPrice);
      if (isStopHit) {
        const fill = pos.stopPrice;
        const fillMove = isLong
          ? ((fill - pos.entryPrice) / pos.entryPrice) * 100
          : ((pos.entryPrice - fill) / pos.entryPrice) * 100;
        pos.currentPrice = fill;
        pos.pnl = (nominalSize * (fillMove / 100)) - feeCost;
        pos.roi = pos.margin > 0 ? (pos.pnl / pos.margin) * 100 : 0;
        if ((isLong && pos.stopPrice > pos.entryPrice * 1.0025) || (!isLong && pos.stopPrice < pos.entryPrice * 0.9975)) {
          exitReason = `🔒 Garanti Kilitli Kâr Çıkışı (+%${pos.roi.toFixed(1)} ROI / Zirve: +%${mfe.toFixed(2)} Spot)`;
        } else if (pos.beLocked) {
          exitReason = (pos.tp1Taken || pos.tp2Taken)
            ? `🛡️ TP KÂRI CEPTE + Kalan Başabaş Kapandı`
            : `🛡️ Başabaş (ücret payı +%0.18 / Zirve: +%${mfe.toFixed(2)})`;
        } else {
          exitReason = `🛑 Moonshot Stop Loss (-%${(pos.slPct || CONFIG.slPct).toFixed(2)})`;
        }
      }

      // ========================================================
      // 🎯 2. KADEMELİ KÂR ALMA - TP1 (+%0.50 spot, %55 Pozisyon Kapatılır!)
      // ========================================================
      const tp1Goal = pos.tp1Pct || CONFIG.tp1Pct || 0.50;
      if (!exitReason && !pos.tp1Taken && (move >= tp1Goal || nMove >= tp1Goal)) {
        pos.tp1Taken = true;
        pos.initialMargin = pos.initialMargin || pos.margin;
        const closedMargin = Number((pos.initialMargin * 0.55).toFixed(4));
        const closedNominal = closedMargin * pos.leverage;
        const closedFee = closedNominal * CONFIG.feeRate * 2;
        const tp1Profit = (closedNominal * (move / 100)) - closedFee;

        pos.tp1Pnl = (pos.tp1Pnl || 0) + tp1Profit;
        balance += tp1Profit; // Kâr bakiyeye anında eklenir
        pos.margin = Number((pos.margin - closedMargin).toFixed(4)); // Kalan %45 pozisyon marjini

        // Kalan marjin için anlık nominal ve pnl güncellemesi
        const remNominal = pos.margin * pos.leverage;
        const remFee = remNominal * CONFIG.feeRate * 2;
        pos.pnl = (remNominal * (move / 100)) - remFee;
        pos.roi = pos.margin > 0 ? (pos.pnl / pos.margin) * 100 : 0;

        // Kalan %45 pozisyon için Stop Loss derhal +%0.28 kâra kilitlenir (komisyon üstü net kâr)
        pos.beLocked = true;
        pos.tier1Locked = true;
        pos.stopPrice = lockSpot(0.28);
        stateChanged = true;

        addLog(`💰 [TP1 ALINDI] ${pos.symbol} %55 Pozisyon Kapatıldı! +${tp1Profit.toFixed(2)} Kâr Cebe İndi (+%${(move * pos.leverage).toFixed(1)} ROI). Kalan %45 Stop +%0.28 Kâra Kilitlendi.`, 'TRADE');
      }

      // ========================================================
      // 🎯 3. İKİNCİ KADEMELİ KÂR ALMA - TP2 (+%0.80 spot, %30 Daha Pozisyon Kapatılır!)
      // ========================================================
      const tp2Goal = pos.tp2Pct || CONFIG.tp2Pct || 0.80;
      if (!exitReason && pos.tp1Taken && !pos.tp2Taken && (move >= tp2Goal || nMove >= tp2Goal)) {
        pos.tp2Taken = true;
        pos.initialMargin = pos.initialMargin || pos.margin;
        const closedMargin = Number((pos.initialMargin * 0.30).toFixed(4));
        const closedNominal = closedMargin * pos.leverage;
        const closedFee = closedNominal * CONFIG.feeRate * 2;
        const tp2Profit = (closedNominal * (move / 100)) - closedFee;

        pos.tp2Pnl = (pos.tp2Pnl || 0) + tp2Profit;
        balance += tp2Profit; // Kâr bakiyeye anında eklenir
        pos.margin = Number((pos.margin - closedMargin).toFixed(4)); // Kalan %15 runner marjini

        // Kalan marjin için anlık nominal ve pnl güncellemesi
        const remNominal = pos.margin * pos.leverage;
        const remFee = remNominal * CONFIG.feeRate * 2;
        pos.pnl = (remNominal * (move / 100)) - remFee;
        pos.roi = pos.margin > 0 ? (pos.pnl / pos.margin) * 100 : 0;

        // Kalan %15 Runner için Stop Loss +%0.55 kâra yükseltilir
        pos.stopPrice = lockSpot(0.55);
        stateChanged = true;

        addLog(`💰 [TP2 ALINDI] ${pos.symbol} %30 Pozisyon Kapatıldı! +${tp2Profit.toFixed(2)} Kâr Cebe İndi (+%${(move * pos.leverage).toFixed(1)} ROI). Kalan %15 Runner Stop +%0.55 Kâra Yükseltildi!`, 'TRADE');
      }

      // ========================================================
      // 🛡️ 4. KADEMELİ İZ SÜREN LAZER KÂR KİLİTLERİ
      // ========================================================
      const beGoal = Math.min(0.42, pos.bePct || CONFIG.bePct || 0.42);
      let targetStop = null;
      if (mfe >= 2.00 || nMfe >= 2.00) {
        targetStop = lockSpot(Math.max(1.55, mfe - 0.35));
      } else if (mfe >= 1.40 || nMfe >= 1.40) {
        targetStop = lockSpot(Math.max(1.05, mfe - 0.30));
      } else if (mfe >= 1.00 || nMfe >= 1.00) {
        targetStop = lockSpot(Math.max(0.72, mfe - 0.25));
      } else if (mfe >= 0.80 || nMfe >= 0.80) {
        targetStop = lockSpot(0.55); // Spot +%0.55 -> Net ROI +%9.0!
      } else if (mfe >= 0.60 || nMfe >= 0.60) {
        targetStop = lockSpot(0.40); // Spot +%0.40 -> Net ROI +%6.0!
      } else if (mfe >= beGoal || nMfe >= beGoal) {
        targetStop = lockSpot(0.28); // Spot +%0.28 -> Net ROI +%3.6
      }

      if (targetStop) {
        if (!pos.beLocked && (mfe >= beGoal || nMfe >= beGoal)) {
          pos.beLocked = true;
          addLog(`🛡️ [KÂR KİLİDİ 1] ${pos.symbol} +%${mfe.toFixed(2)} gördü. Stop giriş+%0.28 kâra çekildi.`, 'TRADE');
        }
        if (!pos.tier1Locked && (mfe >= 0.60 || nMfe >= 0.60)) {
          pos.tier1Locked = true;
          addLog(`🔒 [KÂR KİLİDİ 2] ${pos.symbol} +%${mfe.toFixed(2)} gördü. Garanti kâr stopu +%0.40 seviyesine yükseltildi!`, 'TRADE');
        }
        if (!pos.stopPrice || (isLong && targetStop > pos.stopPrice) || (!isLong && targetStop < pos.stopPrice)) {
          pos.stopPrice = targetStop;
          stateChanged = true;
        }
      }

      // ========================================================
      // 🎯 5. MOONSHOT HEDEFİ (+%2.00 Spot ile Runner Tam Kapat!)
      // ========================================================
      const moonGoal = Math.max(1.80, pos.moonPct || CONFIG.moonPct || 2.00);
      if (!exitReason && nMove >= moonGoal) {
        exitReason = (pos.tp1Taken || pos.tp2Taken)
          ? `🎯 KADEMELİ MOONSHOT ALINDI (TP1+TP2+Runner: +%${pos.roi.toFixed(1)} ROI / +%${move.toFixed(2)} Spot)`
          : `🎯 MOONSHOT HEDEFİ VURULDU (+%${pos.roi.toFixed(1)} ROI / +%${move.toFixed(2)} Spot)`;
      }

      // ========================================================
      // 🏆 6. ZİRVE KÂR NEŞTERİ (TP1/TP2 SONRASI +%0.62+ ZİRVEDEN %0.18 GERİ ÇEKİLMEDE ANINDA CEBE İNDİR!)
      // ========================================================
      if (!exitReason && (pos.tp1Taken || pos.tp2Taken) && mfe >= 0.62 && move >= 0.36) {
        const pullbackLimit = mfe >= 1.20 ? 0.28 : (mfe >= 0.85 ? 0.22 : 0.18);
        if ((mfe - move) >= pullbackLimit) {
          exitReason = `🏆 TP CEPTE + Zirve Kâr Neşteri (+%${pos.roi.toFixed(1)} ROI / Zirve: +%${mfe.toFixed(2)} Spot)`;
        }
      }

      // ========================================================
      // ⏱️ 7. ÖLÜ İŞLEM NEŞTERİ (Dead Trade Scalpel)
      // ========================================================
      // İvmesiz kalan ölü işlemleri saatlerce bekleyip tam stop (-$2.50) yemek yerine erkenden küçük bir çizikle (-%0.25 spot / -$0.75) keser!
      if (!exitReason && !pos.beLocked) {
        if (durMin >= 8 && nMfe < 0.20 && nMove <= -0.25) {
          exitReason = `⏱️ Ölü İşlem Neşteri (${Math.round(durMin)}dk İvmesiz / MFE: +%${mfe.toFixed(2)} / Erken Kesim)`;
        } else if (durMin >= 15 && nMfe < 0.35 && nMove <= -0.20) {
          exitReason = `⏱️ İvmesizlik Neşteri (${Math.round(durMin)}dk Zayıf Akış / MFE: +%${mfe.toFixed(2)} / Erken Kesim)`;
        } else if (durMin >= 30 && nMfe < 0.40) {
          exitReason = `⏱️ Maksimum Süre Aşımı (${Math.round(durMin)}dk Yatay / MFE: +%${mfe.toFixed(2)} / Rotasyon Çıkışı)`;
        }
      }

      // ========================================================
      // 🚨 8. AJAN ACİL DURUM TAHLİYESİ (MAKRO PİYASA TERS DÖNÜŞ FRENİ)
      // ========================================================
      if (!exitReason && pos.roi <= -5.0) {
        if (!isLong && (btc15mNumeric >= 0.65 || btc5mNumeric >= 0.70)) {
          exitReason = `🚨 BTC ters dönüş, SHORT erken kesildi (${btc15mTrend}, %${pos.roi.toFixed(1)} ROI)`;
        } else if (isLong && (btc15mNumeric <= -0.65 || btc5mNumeric <= -0.70)) {
          exitReason = `🚨 BTC ters dönüş, LONG erken kesildi (${btc15mTrend}, %${pos.roi.toFixed(1)} ROI)`;
        }
      }

      // ========================================================
      // 🏁 ÇIKIŞ VE MUTLAK FİYAT KORUMASI (Clamping Safeguard)
      // ========================================================
      if (exitReason) {
        // MUTLAK KORUMA: Hiçbir çıkış fiyatı belirlenmiş stopPrice'tan daha kötü olamaz!
        if (isLong && pos.currentPrice < pos.stopPrice) {
          pos.currentPrice = pos.stopPrice;
        } else if (!isLong && pos.currentPrice > pos.stopPrice) {
          pos.currentPrice = pos.stopPrice;
        }

        const finalNominal = pos.margin * pos.leverage;
        const finalMove = isLong 
          ? ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100 
          : ((pos.entryPrice - pos.currentPrice) / pos.entryPrice) * 100;
        pos.pnl = (finalNominal * (finalMove / 100)) - (finalNominal * CONFIG.feeRate * 2);
        pos.roi = pos.margin > 0 ? (pos.pnl / pos.margin) * 100 : 0;

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

  // 🛡️ ÇOKLAMA / DALGA YORGUNLUĞU VE ARDIŞIK ZARAR KORUMASI (COOLDOWN)
  const isRealLoss = (totalTradePnl <= -0.05) || exitReason.includes("Stop Loss") || exitReason.includes("Neşteri") || exitReason.includes("İvmesizlik");
  if (isRealLoss) {
    coinLossCount[pos.symbol] = (coinLossCount[pos.symbol] || 0) + 1;
    if (coinLossCount[pos.symbol] >= 2) {
      // 2 kez zarar eden koin 24 saat kilitlenir!
      coinCooldowns[pos.symbol] = now + (24 * 60 * 60 * 1000);
      addLog(`🚫 ${pos.symbol} ardışık ${coinLossCount[pos.symbol]} zarar verdi — koin 24 saat boyunca yasaklandı!`, 'TRADE');
    } else {
      // İlk zararda 12 saat ceza (AVA/EPIC gibi aynı koinden tekrar stop yemeyi engelle)
      coinCooldowns[pos.symbol] = now + (12 * 60 * 60 * 1000);
      addLog(`⚠️ ${pos.symbol} zarar yazdı ($${totalTradePnl.toFixed(2)}) — koin 12 saat donduruldu!`, 'TRADE');
    }
  } else {
    // 🛡️ Kâr veya Başabaş sonrası: LONG'da 12 saat (pump bitti), SHORT'ta 4 saat Dalga Yorgunluğu Kilidi!
    coinLossCount[pos.symbol] = 0;
    const winLockHours = pos.side === 'LONG' ? 12 : 4;
    coinCooldowns[pos.symbol] = now + (winLockHours * 60 * 60 * 1000);
    addLog(`🔒 ${pos.symbol} dalgası tamamlandı ($${totalTradePnl >= 0 ? '+' : ''}${totalTradePnl.toFixed(2)}) — tepe yorgunluğuna yakalanmamak için ${winLockHours} saat soğumaya alındı.`, 'INFO');
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
    btc15mEntry: pos.btc15mEntry !== undefined ? pos.btc15mEntry : 0,
    cp1m: pos.cp1m !== undefined ? pos.cp1m : null,
    cp3m: pos.cp3m !== undefined ? pos.cp3m : null,
    cp5m: pos.cp5m !== undefined ? pos.cp5m : null,
    cp15m: pos.cp15m !== undefined ? pos.cp15m : null
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
  const megaWins = history.filter(h => (h.mfe || 0) >= 15.0).length;

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
              <span class="status-pill green" id="gateEngine">1dk bant</span>
            </div>
            <div class="agent-row">
              <span class="agent-name">Emir defteri</span>
              <span class="status-pill green" id="gateBook">OBI açık</span>
            </div>
            <div class="agent-row">
              <span class="agent-name">Yargıç</span>
              <span class="status-pill green" id="gateJudge">veto açık</span>
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
            <div style="font-size:8.5px;color:var(--muted);margin-top:1px;">%55 Cebe, Kalan %45 Kilitli</div>
          </div>
          <div style="display:flex;align-items:baseline;gap:2px;background:var(--panel2);padding:2px 6px;border-radius:4px;border:1px solid var(--blue-border);">
            <input type="number" id="inpTp1" value="${(CONFIG.tp1Pct || 0.50).toFixed(2)}" step="0.1" style="width:52px;background:none;border:none;color:var(--blue);font-family:'JetBrains Mono';font-size:13px;font-weight:650;text-align:right;outline:none;">
            <span style="font-size:10px;color:var(--blue);opacity:0.7;">%</span>
          </div>
        </div>

        <div style="background:linear-gradient(90deg, rgba(99,102,241,0.08) 0%, var(--panel) 100%); border-left:3px solid #6366f1; border:1px solid rgba(99,102,241,0.3); border-radius:5px; padding:6px 8px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center; box-shadow:var(--shadow-sm);">
          <div>
            <div style="font-size:10px;font-weight:800;color:#6366f1;letter-spacing:0.3px;">🚀 2. KÂR ALMA (TP2)</div>
            <div style="font-size:8.5px;color:var(--muted);margin-top:1px;">%30 Cebe, %15 Runner Rokete</div>
          </div>
          <div style="display:flex;align-items:baseline;gap:2px;background:var(--panel2);padding:2px 6px;border-radius:4px;border:1px solid rgba(99,102,241,0.3);">
            <input type="number" id="inpTp2" value="${(CONFIG.tp2Pct || 1.00).toFixed(2)}" step="0.1" style="width:52px;background:none;border:none;color:#6366f1;font-family:'JetBrains Mono';font-size:13px;font-weight:650;text-align:right;outline:none;">
            <span style="font-size:10px;color:#6366f1;opacity:0.7;">%</span>
          </div>
        </div>

        <div style="background:linear-gradient(90deg, var(--amber-bg) 0%, var(--panel) 100%); border-left:3px solid var(--amber); border:1px solid var(--amber-border); border-radius:5px; padding:6px 8px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; box-shadow:var(--shadow-sm);">
          <div>
            <div style="font-size:10px;font-weight:800;color:var(--amber);letter-spacing:0.3px;">🏆 VUR-KAÇ MOONSHOT</div>
            <div style="font-size:8.5px;color:var(--muted);margin-top:1px;">%15 Runner Zirvede Vurur</div>
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
          <span>CANLI KAYIT</span>
        </h2>
        <div id="dialogueBox" style="background:var(--panel2); border:1px solid var(--border); border-radius:12px; padding:12px 14px; max-height:320px; overflow-y:auto; font-family:-apple-system,Segoe UI,sans-serif; font-size:13px; line-height:1.5; display:flex; flex-direction:column; gap:8px;">
          ${renderLogs(logs.slice(0, 30))}
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
        document.getElementById("posCount").innerText = data.stats.activeCount + ' / ' + (data.stats.liveSlots || (data.settings && data.settings.slots) || '1');
        document.getElementById("histCount").innerText = data.history.length;

        const btcEl = document.getElementById("btcVal");
        btcEl.innerText = data.stats.btcTrend;
        btcEl.style.color = data.stats.btcIsGreen ? 'var(--green)' : 'var(--red)';

        const br = document.getElementById("gateBreaker");
        if (br) {
          br.innerText = data.stats.circuit ? ('AÇIK · $' + data.stats.liveMargin) : 'kapalı';
          br.className = 'status-pill ' + (data.stats.circuit ? 'purple' : '');
        }

        const dBox = document.getElementById("dialogueBox");
        if (dBox && data.logs) {
          const wasAtBottom = (dBox.scrollHeight - dBox.scrollTop - dBox.clientHeight) < 60;
          dBox.innerHTML = renderLogsClient(data.logs);
          if (wasAtBottom || !window._dBoxInitialized) {
            dBox.scrollTop = dBox.scrollHeight;
            window._dBoxInitialized = true;
          }
        }

        // Aktif Pozisyonlar Tablosu
        const tbody = document.getElementById("activeTbody");
        if (data.positions.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:35px 15px;"><div style="font-size:32px; margin-bottom:12px; filter:grayscale(0.3);">🔭</div><div style="color:var(--text); font-weight:700; font-size:14px; letter-spacing:0.5px;">TETİKTE BEKLENİYOR</div><div style="color:var(--muted); font-size:11px; margin-top:6px; max-width:320px; margin-left:auto; margin-right:auto; line-height:1.4;">1 dakikalık bant, emir defteri ve yargıç vetosu taranıyor.</div></td></tr>';
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
            activeCardsEl.innerHTML = '<div class="empty-cards-msg">🔍 1dk bant taranıyor.</div>';
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
    const SET_IDS = { slots: 'inpSlots', margin: 'inpMargin', lev: 'inpLev', sl: 'inpSl', be: 'inpBe', moon: 'inpMoon', tp1: 'inpTp1', tp2: 'inpTp2' };
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
    return '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px;font-size:12px;">🔍 1dk bant taranıyor.</td></tr>';
  }
  return positions.map((p, idx) => {
    const isLong = p.side === 'LONG';
    const isWin = (p.pnl || 0) >= 0;
    const stopText = p.beLocked 
      ? (p.tp2Taken 
          ? '<span class="badge-be" style="background:#059669;color:#fff;">🎯 TP1+TP2 ALINDI (+%0.70 KİLİT)</span>' 
          : (p.tp1Taken 
              ? '<span class="badge-be" style="background:#10b981;color:#fff;">💰 TP1 CEPTE (+%0.28 KİLİT)</span>' 
              : '<span class="badge-be">🛡️ BAŞABAŞ ($0 RİSK)</span>'))
      : `<span class="badge-sl">🛑 STOP: -%${(p.slPct || CONFIG.slPct).toFixed(2)}</span>`;

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
    return '<div class="empty-cards-msg">🔍 1dk bant taranıyor.</div>';
  }
  return positions.map((p, idx) => {
    const isLong = p.side === 'LONG';
    const isWin = (p.pnl || 0) >= 0;
    const stopText = p.beLocked 
      ? (p.tp2Taken 
          ? '<span class="badge-be" style="background:#059669;color:#fff;">🎯 TP1+TP2 ALINDI (+%0.70 KİLİT)</span>' 
          : (p.tp1Taken 
              ? '<span class="badge-be" style="background:#10b981;color:#fff;">💰 TP1 CEPTE (+%0.28 KİLİT)</span>' 
              : '<span class="badge-be">🛡️ BAŞABAŞ ($0 RİSK)</span>'))
      : `<span class="badge-sl">🛑 STOP: -%${(p.slPct || CONFIG.slPct).toFixed(2)}</span>`;
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
    DYNAMIC.mode = 'HIZLI_VUR_KAC';
    DYNAMIC.vol3hMin = 1.0;
    DYNAMIC.candidateSlice = 35;
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
