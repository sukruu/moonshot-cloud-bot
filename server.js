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

// --- EKRAN 1 BİREBİR AYARLARI ---
let CONFIG = {
  initialBalance: 100.0,     // Bakiye 100 Dolar
  marginPerTrade: 10.0,      // Teminat 10$
  leverage: 20,              // Kaldıraç 20x
  maxSlots: 4,               // Max Slot 4 Adet
  slPct: 2.50,               // Stop Loss %2.50
  bePct: 1.80,               // Otomatik Başabaş %1.80 ($0 Risk)
  moonPct: 15.00,            // Vur-Kaç Moonshot %15.00
  feeRate: 0.0008,           // 0.04% Giriş + 0.04% Çıkış Taker
  scanIntervalMs: 3500,
  riskIntervalMs: 2000,
  radarIntervalMs: 60000
};

// ŞAMPİYON ÖNCELİKLİ KOİNLER (Ekran 1 VIP Listesi)
const DEFAULT_VIP_TARGETS = {
  "ONEUSDT":   { minVol: 50,  label: "🎯 Lazer Sniper ($400M+ Hacim)" },
  "SAGAUSDT":  { minVol: 50,  label: "🎯 Roket Kırılım ($200M Hacim)" },
  "BULLAUSDT": { minVol: 30,  label: "🚀 Güçlü İvme" },
  "ENAUSDT":   { minVol: 50,  label: "💎 Hacim Lideri ($540M Hacim)" },
  "NEARUSDT":  { minVol: 100, label: "💎 Dev Trendci ($1.2B Hacim)" },
  "SEIUSDT":   { minVol: 40,  label: "🚀 Hızlı Sıçrayan ($110M Hacim)" },
  "TIAUSDT":   { minVol: 50,  label: "🚀 Trend Lideri ($300M+ Hacim)" },
  "SUIUSDT":   { minVol: 100, label: "⚡ Likidite Canavarı ($900M+ Hacim)" },
  "PLUMEUSDT": { minVol: 20,  label: "⚡ Yeni Ralli" },
  "BERAUSDT":  { minVol: 20,  label: "🔥 Hızlı Hareket" },
  "PEOPLEUSDT":{ minVol: 30,  label: "🎯 Yüksek Volatilite" }
};

let VIP_TARGETS = { ...DEFAULT_VIP_TARGETS };

const BANNED_SYMBOLS = new Set([
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT',
  'USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'EURUSDT'
]);

// --- DURUM DEĞİŞKENLERİ ---
let balance = CONFIG.initialBalance;
let activePositions = [];
let history = [];
let coinCooldowns = {};
let rollingTickerPrices = {};
let radarMap = {};
let logs = [];
let startTime = Date.now();
let btc15mTrend = "+0.00%";
let btc15mIsGreen = true;
let isScanRunning = false;
let isRiskRunning = false;
let isRadarRunning = false;
let isBotActive = true;

function addLog(msg, type = "INFO") {
  const time = new Date().toLocaleTimeString('tr-TR');
  logs.unshift({ time, type, msg });
  if (logs.length > 150) logs.pop();
  console.log(`[${time}] [${type}] ${msg}`);
}

// Depolamayı Başlat & Sıfırla (Bakiye 100$)
function initStorage() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      balance = (saved.balance !== undefined && !isNaN(saved.balance)) ? saved.balance : CONFIG.initialBalance;
      activePositions = saved.activePositions || [];
      coinCooldowns = saved.coinCooldowns || {};
    } else {
      balance = CONFIG.initialBalance;
    }

    if (fs.existsSync(HISTORY_FILE)) {
      history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      if (Array.isArray(history) && history.length > 0) {
        const totalPnl = history.reduce((acc, h) => acc + (h.pnl || 0), 0);
        balance = CONFIG.initialBalance + totalPnl;
      }
    }

    rewriteCsvFile();
  } catch (err) {
    addLog(`Dosya okuma: ${err.message}`, 'WARN');
  }
}

function persistState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({
      balance,
      activePositions,
      coinCooldowns,
      savedAt: Date.now()
    }, null, 2), 'utf8');
  } catch (e) {}
}

function rewriteCsvFile() {
  try {
    const csvHeader = '\uFEFF' + [
      'ID',
      'Tarih & Saat',
      'Koin',
      'Yön',
      'Giriş Fiyatı',
      'Çıkış Fiyatı',
      'Süre (Dk)',
      'MFE (Max Kâr %)',
      'Net Kâr ($)',
      'ROI (%)',
      'Çıkış Nedeni',
      'Radar Teyidi'
    ].join(';') + '\n';

    let content = csvHeader;
    const rows = history.slice().reverse();
    rows.forEach(trade => {
      content += [
        trade.id,
        `"${trade.time || trade.dateFullStr || ''}"`,
        trade.symbol,
        trade.side,
        trade.entryPrice,
        trade.exitPrice,
        trade.durationMin,
        `"%${(trade.mfe || 0).toFixed(2)}"`,
        `"$${(trade.pnl || 0).toFixed(2)}"`,
        `"%${(trade.roi || 0).toFixed(2)}"`,
        `"${(trade.exitReason || '').replace(/"/g, '""')}"`,
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
    const row = [
      trade.id,
      `"${trade.time}"`,
      trade.symbol,
      trade.side,
      trade.entryPrice,
      trade.exitPrice,
      trade.durationMin,
      `"%${(trade.mfe || 0).toFixed(2)}"`,
      `"$${(trade.pnl || 0).toFixed(2)}"`,
      `"%${(trade.roi || 0).toFixed(2)}"`,
      `"${(trade.exitReason || '').replace(/"/g, '""')}"`,
      `"${(trade.radarTag || '').replace(/"/g, '""')}"`
    ].join(';') + '\n';
    fs.appendFileSync(CSV_FILE, row, 'utf8');
  } catch (err) {
    addLog(`CSV Hatası: ${err.message}`, 'ERROR');
  }
}

// BİNANCE RESMİ API & ISP/DPI/BULUT ENGELİNE KARŞI ÇOKLU AYNA SİSTEMİ
const BINANCE_FAPI_MIRRORS = [
  "https://www.binance.info",
  "https://fapi.binance.com",
  "https://fapi1.binance.com",
  "https://fapi2.binance.com",
  "https://fapi3.binance.com"
];

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

  for (const base of BINANCE_FAPI_MIRRORS) {
    try {
      const targetUrl = base + relativePath;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      });
      clearTimeout(timeoutId);
      if (!res.ok) continue;
      const data = await res.json();
      if (data) return data;
    } catch(e) {
      // Bir sonraki aynaya otomatik geç
    }
  }
  return null;
}

// 1. RADAR (3S & 15DK ÇOKLU ZAMAN, ALICI BASKISI VE SİNYAL MOTORU)
let radarList = [];
async function updateRadar() {
  if (isRadarRunning) return;
  isRadarRunning = true;
  try {
    const [btcKlines, tickers] = await Promise.all([
      fetchBinance("/fapi/v1/klines?symbol=BTCUSDT&interval=15m&limit=2"),
      fetchBinance("/fapi/v1/ticker/24hr")
    ]);

    if (btcKlines && btcKlines.length >= 2) {
      const o = parseFloat(btcKlines[btcKlines.length - 1][1]);
      const c = parseFloat(btcKlines[btcKlines.length - 1][4]);
      const btcMove = ((c - o) / o) * 100;
      btc15mTrend = `${btcMove >= 0 ? '+' : ''}${btcMove.toFixed(2)}%`;
      btc15mIsGreen = btcMove >= 0;
    }

    if (!tickers || !Array.isArray(tickers)) return;

    const tickerMap = {};
    tickers.forEach(t => {
      tickerMap[t.symbol] = {
        lastPrice: parseFloat(t.lastPrice) || 0,
        chg24h: parseFloat(t.priceChangePercent) || 0,
        vol24hM: (parseFloat(t.quoteVolume) || 0) / 1e6
      };
    });

    const valid = tickers.filter(t => {
      if (!t.symbol.endsWith("USDT") || t.symbol.startsWith("USDC") || BANNED_SYMBOLS.has(t.symbol)) return false;
      const volM = (parseFloat(t.quoteVolume) || 0) / 1e6;
      return volM >= 3.0;
    }).sort((a, b) => Math.abs(parseFloat(b.priceChangePercent) || 0) - Math.abs(parseFloat(a.priceChangePercent) || 0));

    // Top 80 koinin 3 saatlik (3x 1h) kline ve alıcı baskısını çek
    const chunkSize = 15;
    const scanned = [];
    for (let i = 0; i < Math.min(valid.length, 75); i += chunkSize) {
      const chunk = valid.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async item => {
        const sym = item.symbol;
        const klines = await fetchBinance(`/fapi/v1/klines?symbol=${sym}&interval=1h&limit=3`);
        if (klines && klines.length > 0) {
          const open3h = parseFloat(klines[0][1]);
          const close3h = parseFloat(klines[klines.length - 1][4]);
          const high3h = Math.max(...klines.map(k => parseFloat(k[2])));
          const low3h = Math.min(...klines.map(k => parseFloat(k[3])));
          const volUsdt = klines.reduce((acc, k) => acc + (parseFloat(k[7]) || 0), 0);
          const takerBuyUsdt = klines.reduce((acc, k) => acc + (parseFloat(k[10]) || 0), 0);

          const takerRatio = volUsdt > 0 ? (takerBuyUsdt / volUsdt) * 100 : 50;
          const chg3h = open3h > 0 ? ((close3h - open3h) / open3h) * 100 : 0;
          const tInfo = tickerMap[sym] || {};

          let signal = "⚖️ NÖTR";
          if (chg3h >= 5.0) signal = "🚀 SÜPER ROKET";
          else if (chg3h >= 2.0) signal = "🟢 GÜÇLÜ BOĞA";
          else if (chg3h <= -5.0) signal = "🩸 ŞELALE";
          else if (chg3h <= -2.0) signal = "🔴 GÜÇLÜ AYI";

          const rItem = {
            symbol: sym,
            lastPrice: close3h,
            chg3h,
            chg15m: chg3h / 4, // Tahmini 15m alt momentum
            vol3hM: volUsdt / 1e6,
            range3h: `$${low3h.toFixed(4)} - $${high3h.toFixed(4)}`,
            low3h,
            high3h,
            takerBuyRatio: takerRatio,
            chg24h: tInfo.chg24h || 0,
            vol24hM: tInfo.vol24hM || 0,
            signal,
            lastUpdate: Date.now()
          };

          radarMap[sym] = rItem;
          scanned.push(rItem);
        }
      }));
    }

    if (scanned.length > 0) {
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

    const validTickers = tickers.filter(t => {
      if (!t.symbol.endsWith("USDT") || t.symbol.startsWith("USDC") || BANNED_SYMBOLS.has(t.symbol)) return false;
      const p = parseFloat(t.lastPrice);
      return p >= 0.0001;
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

      const rInfo = radarMap[sym];
      let radarBoost = 0;
      if (rInfo) {
        if (rInfo.chg15m >= 1.0 && rInfo.takerBuyRatio >= 50) {
          radarBoost = (rInfo.chg15m * 20) + ((rInfo.takerBuyRatio - 50) * 4.0);
          if (rInfo.signal && (rInfo.signal.includes("ROKET") || rInfo.signal.includes("BOĞA"))) radarBoost += 30;
        } else if (rInfo.chg15m <= -1.0 && rInfo.takerBuyRatio <= 50) {
          radarBoost = (Math.abs(rInfo.chg15m) * 16) + ((50 - rInfo.takerBuyRatio) * 3.5);
          if (rInfo.signal && (rInfo.signal.includes("ŞELALE") || rInfo.signal.includes("AYI"))) radarBoost += 30;
        }
      }

      const instantScore = rollMovePct > 0 ? rollMovePct * 12 : Math.abs(rollMovePct) * 8;
      const hotScore = instantScore + Math.abs(rawChg > 0 ? Math.min(rawChg, 25) : Math.max(rawChg, -25)) + (Math.sqrt(volM) * 1.8) + (isVip ? 20 : 0) + radarBoost;

      return {
        ...t,
        volM,
        chg: rawChg,
        rollMovePct,
        hotScore,
        isVip
      };
    })
    .filter(t => t.isVip || t.volM >= 4.0)
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, 80);

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
        const k3m = await fetchBinance(`/fapi/v1/klines?symbol=${sym}&interval=3m&limit=30`);
        return { sym, lastP, k3m, chg: parseFloat(item.priceChangePercent) || 0, isVip: item.isVip };
      }));

      for (const data of chunkData) {
        if (!data || !data.k3m || data.k3m.length < 22) continue;
        if (activePositions.length >= CONFIG.maxSlots || signalFound) break;

        const { sym, lastP, k3m, chg, isVip } = data;
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
        const minJump = isVip ? 0.70 : 0.90;

        const isWhaleVol = curV >= avgVol20 * 1.8 || (curV + prevV) >= avgVol20 * 2.5 || prevV >= avgVol20 * 1.8;
        const isDailyTrending = chg >= 2.0 && chg <= 80.0;
        const hasMomentum = (curMovePct >= minJump && curP > curO) || (twoCandleMovePct >= (minJump + 0.25) && curP >= curO * 0.998);

        const rInfo = radarMap[sym];
        let radarOkLong = true;
        let radarOkShort = true;
        let isDirectRadarLong = false;
        let isDirectRadarShort = false;
        let radarTag = "";

        if (rInfo) {
          // 🎯 RADAR DOĞRUDAN VUR-KAÇ TETİĞİ (YÜKSELİRKEN VE DÜŞERKEN ANINDA YAKALA)
          const taker = rInfo.takerBuyRatio || 50;
          const chg3 = rInfo.chg3h || 0;
          const sig = rInfo.signal || "";

          // 1. YÜKSELİRKEN VUR-KAÇ (LONG): 3s Değişim >= %1.8 VEYA Alıcı Baskısı >= %51.5 + Boğa/Roket
          if ((chg3 >= 1.8 || curMovePct >= 0.65) && taker >= 51.5 && (sig.includes("ROKET") || sig.includes("BOĞA"))) {
            isDirectRadarLong = true;
            radarTag = `[3s: +%${chg3.toFixed(1)} / %${taker.toFixed(0)} Alıcı - ${sig}]`;
          }

          // 2. DÜŞERKEN VUR-KAÇ (SHORT): 3s Değişim <= -%1.8 VEYA Satıcı Baskısı >= %51.5 + Ayı/Şelale
          if ((chg3 <= -1.8 || curMovePct <= -0.65) && taker <= 48.5 && (sig.includes("ŞELALE") || sig.includes("AYI"))) {
            isDirectRadarShort = true;
            radarTag = `[3s: %${chg3.toFixed(1)} / %${(100 - taker).toFixed(0)} Satıcı - ${sig}]`;
          }

          if (taker < 48.5 && chg3 < -0.5) radarOkLong = false;
          if (taker > 51.5 && chg3 > 0.5) radarOkShort = false;
        }

        // İğne tuzağı kontrolü: Doğrudan Radar Roket/Şelale sinyallerinde %3 tolerans tanı
        const validWickLong = isDirectRadarLong ? (curP >= curH * 0.970) : (curP >= curH * 0.991);
        const validWickShort = isDirectRadarShort ? (curP <= curL * 1.030) : (curP <= curL * 1.009);

        const isLongPump = (isDirectRadarLong || (hasMomentum && isWhaleVol) || (isDailyTrending && curMovePct >= 0.60 && isWhaleVol)) && validWickLong && radarOkLong;
        
        const isDailyOverbought = chg >= 12.0;
        const hasDownMomentum = (curMovePct <= -minJump && curP < curO) || (twoCandleMovePct <= -(minJump + 0.25) && curP < curO);
        const isShortDump = (isDirectRadarShort || (hasDownMomentum && isWhaleVol) || (isDailyOverbought && curMovePct <= -0.80 && isWhaleVol)) && validWickShort && radarOkShort;

        if (isLongPump || isShortDump) {
          const side = isLongPump ? "LONG" : "SHORT";
          const stopPrice = side === "LONG" 
            ? curP * (1 - CONFIG.slPct / 100) 
            : curP * (1 + CONFIG.slPct / 100);

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
            margin: CONFIG.marginPerTrade,
            leverage: CONFIG.leverage,
            radarTag: radarTag
          };

          activePositions.push(position);
          activeSyms.add(sym);
          signalFound = true;
          persistState();

          addLog(`🚀 POZİSYON AÇILDI: [${side}] ${sym} @ $${curP.toFixed(4)} (SL: $${stopPrice.toFixed(4)}) ${radarTag}`, 'TRADE');
          break;
        }
      }
    }
  } catch (err) {
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
    if (durMin >= 25 && Math.abs(pos.mfe || 0) < 0.60 && Math.abs(pos.roi || 0) < 5.0) {
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
  }
}

// 3. LAZER RİSK & KÂR KİLİTLEME (FAST RISK LOOP)
async function fastRiskLoop() {
  if (isRiskRunning || activePositions.length === 0) return;
  isRiskRunning = true;
  try {
    const prices = await fetchBinance("https://fapi.binance.com/fapi/v1/ticker/price");
    if (!prices || !Array.isArray(prices)) return;

    const priceMap = {};
    prices.forEach(p => priceMap[p.symbol] = parseFloat(p.price));

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

      const nominalSize = pos.margin * pos.leverage;
      const feeCost = nominalSize * CONFIG.feeRate;
      pos.pnl = (nominalSize * (move / 100)) - feeCost;
      pos.roi = (pos.pnl / pos.margin) * 100;

      let exitReason = null;

      // 1. ERKEN BAŞABAŞ KİLİDİ (%1.80)
      if (!pos.beLocked && pos.mfe >= CONFIG.bePct) {
        pos.beLocked = true;
        pos.stopPrice = isLong ? pos.entryPrice * 1.002 : pos.entryPrice * 0.998;
        stateChanged = true;
        addLog(`🛡️ ${pos.symbol} +%${pos.mfe.toFixed(2)} Kâra Ulaştı! Stop Girişe Çekildi ($0 RİSK)`);
      }

      // 2. GARANTİ KÂR KİLİTLERİ
      if (pos.mfe >= 2.50) {
        const guaranteedStop = isLong ? pos.entryPrice * 1.0120 : pos.entryPrice * 0.9880;
        if (!pos.stopPrice || (isLong && guaranteedStop > pos.stopPrice) || (!isLong && guaranteedStop < pos.stopPrice)) {
          pos.stopPrice = guaranteedStop;
          stateChanged = true;
        }
      }
      if (pos.mfe >= 4.50) {
        const guaranteedStop2 = isLong ? pos.entryPrice * 1.0280 : pos.entryPrice * 0.9720;
        if (!pos.stopPrice || (isLong && guaranteedStop2 > pos.stopPrice) || (!isLong && guaranteedStop2 < pos.stopPrice)) {
          pos.stopPrice = guaranteedStop2;
          stateChanged = true;
        }
      }
      if (pos.mfe >= 7.50) {
        const guaranteedStop3 = isLong ? pos.entryPrice * 1.0500 : pos.entryPrice * 0.9500;
        if (!pos.stopPrice || (isLong && guaranteedStop3 > pos.stopPrice) || (!isLong && guaranteedStop3 < pos.stopPrice)) {
          pos.stopPrice = guaranteedStop3;
          stateChanged = true;
        }
      }

      // 3. DİNAMİK İZSÜREN TRAILING STOP
      const mfe = pos.mfe || 0;
      const pullbackLimit = mfe >= 20.0 ? 6.00 : (mfe >= 12.0 ? 4.50 : (mfe >= 7.0 ? 3.00 : 2.00));
      if (!exitReason && mfe >= CONFIG.bePct && (mfe - move) >= pullbackLimit) {
        exitReason = `🏆 Zirveden Takip Kârı Alındı (+%${pos.roi.toFixed(1)} ROI / Zirve: +%${mfe.toFixed(2)} Spot)`;
      }

      // 4. MEGA MOONSHOT HEDEFİ (+%15 Spot = +%300 ROI)
      if (!exitReason && move >= CONFIG.moonPct) {
        exitReason = `🏆 MEGA VUR-KAÇ HEDEFİ ALINDI (+%${pos.roi.toFixed(0)} ROI / +%${mfe.toFixed(1)} Spot)`;
      }

      // 5. STOP LOSS VEYA KİLİTLİ STOP TETİKLENMESİ
      if (!exitReason && ((isLong && curP <= pos.stopPrice) || (!isLong && curP >= pos.stopPrice))) {
        if ((isLong && pos.stopPrice > pos.entryPrice * 1.005) || (!isLong && pos.stopPrice < pos.entryPrice * 0.995)) {
          exitReason = `🔒 Garanti Kilitli Kâr Çıkışı (+%${pos.roi.toFixed(1)} ROI)`;
          coinCooldowns[pos.symbol] = now + (10 * 60 * 1000);
        } else if (pos.beLocked) {
          exitReason = `🛡️ Başabaş Koruma Çıkışı ($0.00 Risk / Zirve: +%${mfe.toFixed(2)})`;
          coinCooldowns[pos.symbol] = now + (15 * 60 * 1000);
        } else {
          exitReason = `🛑 Moonshot Stop Loss (-%${CONFIG.slPct.toFixed(2)})`;
          coinCooldowns[pos.symbol] = now + (30 * 60 * 1000);
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
  } finally {
    isRiskRunning = false;
  }
}

function closeTrade(pos, exitReason) {
  const now = Date.now();
  const durMin = Math.round((now - pos.entryTime) / 60000);
  balance += pos.pnl;

  const tradeRecord = {
    id: history.length + 1,
    time: new Date().toLocaleTimeString('tr-TR'),
    dateFullStr: new Date().toLocaleString('tr-TR'),
    symbol: pos.symbol,
    side: pos.side,
    entryPrice: pos.entryPrice,
    exitPrice: pos.currentPrice,
    durationMin: durMin,
    mfe: pos.mfe,
    pnl: pos.pnl,
    roi: pos.roi,
    exitReason: exitReason,
    radarTag: pos.radarTag || ""
  };

  history.unshift(tradeRecord);
  if (history.length > 500) history.pop();

  appendTradeToCsv(tradeRecord);
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 100), null, 2), 'utf8');
  } catch (e) {}

  addLog(`🏁 KAPANDI: [${pos.side}] ${pos.symbol} | PnL: ${pos.pnl >= 0 ? '+' : ''}$${pos.pnl.toFixed(2)} (%${pos.roi.toFixed(1)} ROI) | ${exitReason}`, pos.pnl >= 0 ? 'WIN' : 'LOSS');
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

  return {
    balance: balance.toFixed(2),
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

function serveDashboardHtml() {
  const stats = getStats();
  const vipKeys = Object.keys(VIP_TARGETS);

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Moonshot Bot">
  <meta name="theme-color" content="#07090e">
  <meta name="format-detection" content="telephone=no">
  <title>🚀 Moonshot 7/24 Bulut Test Laboratuvarı</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220%22%22><text y=%2226%22 font-size=%2224%22>🚀</text></svg>">
  <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #07090e;
      --panel: #0e131f;
      --panel2: #141b2d;
      --panel-hover: #1a233a;
      --border: rgba(255, 255, 255, 0.08);
      --border-accent: rgba(168, 85, 247, 0.3);
      --text: #f8fafc;
      --muted: #94a3b8;
      --green: #10b981;
      --red: #f43f5e;
      --amber: #f59e0b;
      --purple: #a855f7;
      --blue: #38bdf8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif;
      padding: max(8px, env(safe-area-inset-top)) max(10px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(10px, env(safe-area-inset-left));
      font-size: 13px;
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .container { max-width: 1560px; margin: 0 auto; width: 100%; }

    /* TABS */
    .tabs {
      display: flex;
      gap: 6px;
      margin-bottom: 12px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    }
    .tabs::-webkit-scrollbar { display: none; }
    .tab-btn {
      background: var(--panel);
      border: 1px solid var(--border);
      color: var(--muted);
      font-size: 11px;
      font-weight: 800;
      padding: 8px 13px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .tab-btn.active {
      background: var(--panel2);
      color: #fff;
      border-color: rgba(168, 85, 247, 0.5);
      box-shadow: 0 0 15px rgba(168, 85, 247, 0.25);
    }

    /* GRID */
    .dashboard {
      display: grid;
      grid-template-columns: 310px 1fr;
      gap: 12px;
      align-items: start;
    }
    @media (max-width: 960px) {
      .dashboard { grid-template-columns: 1fr; gap: 10px; }
    }

    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 14px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    }
    .panel h2 {
      font-size: 12.5px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* STATUS BOX */
    .status-box {
      background: rgba(8, 11, 18, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      padding: 9px 11px;
      margin-bottom: 10px;
    }
    .status-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      margin-bottom: 5px;
      font-weight: 600;
      color: var(--muted);
    }
    .status-item:last-child { margin-bottom: 0; }
    .status-pill {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 800;
      font-size: 10.5px;
      padding: 2px 7px;
      border-radius: 4px;
      background: rgba(255,255,255,0.06);
      color: #fff;
    }
    .status-pill.green { background: rgba(16,185,129,0.15); color: var(--green); border: 1px solid rgba(16,185,129,0.3); }
    .status-pill.purple { background: rgba(168,85,247,0.15); color: var(--purple); border: 1px solid rgba(168,85,247,0.3); }

    /* STRATEGY BANNER */
    .strategy-banner-card {
      background: linear-gradient(135deg, rgba(88,28,135,0.25), rgba(15,23,42,0.6));
      border: 1px solid rgba(168,85,247,0.35);
      border-radius: 8px;
      padding: 9px 11px;
      margin-bottom: 10px;
    }
    .strat-card-head { display: flex; justify-content: space-between; font-size: 10.5px; margin-bottom: 4px; }
    .strat-badge-pill { background: var(--purple); color: #fff; font-weight: 900; font-size: 9px; padding: 2px 6px; border-radius: 4px; }
    .strat-card-title { font-weight: 800; font-size: 12.5px; color: #fff; }
    .strat-card-sub { font-size: 10px; color: var(--muted); margin-top: 2px; }

    /* PARAMETERS */
    .sidebar-section-title { font-size: 10px; font-weight: 800; color: var(--muted); text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
    .param-grid-2x2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 8px; }
    .param-card { background: rgba(8, 11, 18, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px 9px; }
    .param-header { display: flex; justify-content: space-between; font-size: 10px; color: var(--muted); font-weight: 700; margin-bottom: 2px; }
    .param-input-wrap { display: flex; align-items: baseline; justify-content: space-between; }
    .param-input-wrap input { width: 58px; background: none; border: none; color: #fff; font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 800; outline: none; }
    .param-unit { font-size: 10.5px; color: var(--muted); }

    /* HERO PERF */
    .perf-hero-card {
      background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(15,23,42,0.8));
      border: 1px solid rgba(16,185,129,0.3);
      border-radius: 8px;
      padding: 9px 11px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .perf-hero-title { font-size: 10px; font-weight: 800; color: var(--muted); display: block; }
    .perf-hero-sub { font-size: 11px; font-weight: 700; color: var(--green); }
    .perf-hero-val { font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 900; color: #fff; }

    .perf-grid-4 { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 10px; }
    .perf-mini-card { background: rgba(8, 11, 18, 0.7); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 6px 8px; }
    .perf-mini-label { font-size: 9.5px; color: var(--muted); display: block; }
    .perf-mini-val { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 800; }

    /* BUTTONS GRID */
    .action-buttons-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-top: 6px;
    }
    .btn-action {
      width: 100%;
      padding: 8px 8px;
      border-radius: 7px;
      font-weight: 800;
      font-size: 10.5px;
      cursor: pointer;
      border: 1px solid var(--border);
      transition: 0.15s;
      text-align: center;
      text-decoration: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      min-height: 36px;
    }
    .btn-secondary { background: var(--panel2); color: var(--text); }
    .btn-secondary:hover { background: var(--panel-hover); }
    .btn-reset {
      grid-column: span 2;
      background: rgba(244, 63, 94, 0.12);
      border-color: rgba(244, 63, 94, 0.35);
      color: var(--red);
    }
    .btn-reset:hover { background: var(--red); color: #fff; }

    /* TABLES */
    .table-container {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: rgba(8, 11, 18, 0.4);
      margin-bottom: 12px;
    }
    .table-container::-webkit-scrollbar { height: 4px; }
    .table-container::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; white-space: nowrap; }
    th {
      position: sticky;
      top: 0;
      background: #111724;
      text-align: left;
      padding: 7px 9px;
      color: var(--muted);
      font-weight: 800;
      font-size: 9.5px;
      text-transform: uppercase;
      border-bottom: 1px solid var(--border);
      z-index: 2;
    }
    td { padding: 7px 9px; border-bottom: 1px solid rgba(255, 255, 255, 0.03); font-family: 'JetBrains Mono', monospace; }
    tr:hover td { background: rgba(255, 255, 255, 0.03); }

    /* BADGES */
    .badge-moon { background: rgba(168,85,247,0.18); border: 1px solid rgba(168,85,247,0.4); color: #c084fc; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 800; }
    .badge-strat { background: rgba(250,204,21,0.12); border: 1px solid rgba(250,204,21,0.3); color: #facc15; font-size: 9px; padding: 2px 5px; border-radius: 3px; font-weight: 700; margin-left: 4px; }
    .badge-side-long { background: rgba(16,185,129,0.2); border: 1px solid rgba(16,185,129,0.4); color: var(--green); font-size: 9.5px; padding: 2px 6px; border-radius: 4px; font-weight: 800; }
    .badge-side-short { background: rgba(244,63,94,0.2); border: 1px solid rgba(244,63,94,0.4); color: var(--red); font-size: 9.5px; padding: 2px 6px; border-radius: 4px; font-weight: 800; }
    .badge-sl { color: var(--red); font-weight: 800; font-size: 10.5px; }
    .badge-be { color: var(--green); font-weight: 800; font-size: 10.5px; }
    .badge-pnl-pos { color: var(--green); font-weight: 800; font-size: 11px; }
    .badge-pnl-neg { color: var(--red); font-weight: 800; font-size: 11px; }
    .btn-close-pos {
      background: rgba(244,63,94,0.15);
      border: 1px solid rgba(244,63,94,0.35);
      color: var(--red);
      font-weight: 800;
      font-size: 10.5px;
      padding: 3px 8px;
      border-radius: 4px;
      cursor: pointer;
      min-height: 28px;
      transition: 0.15s;
    }
    .btn-close-pos:hover { background: var(--red); color: #fff; }

    /* CHIPS */
    .chip { font-size: 9.5px; padding: 2px 6px; border-radius: 4px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); color: var(--green); font-family: 'JetBrains Mono', monospace; font-weight: 700; }
    
    .mobile-swipe-hint {
      font-size: 9.5px;
      color: var(--muted);
      margin-bottom: 5px;
      display: none;
      align-items: center;
      gap: 4px;
    }

    @media (max-width: 768px) {
      .mobile-swipe-hint { display: flex; }
      input[type="number"], input[type="text"] { font-size: 16px !important; }
      .param-card { padding: 5px 8px; }
      .panel { padding: 10px; border-radius: 10px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- TABS -->
    <div class="tabs">
      <div class="tab-btn active">⚡ 1. CANLI SİMÜLASYON (TEST LAB)</div>
      <div class="tab-btn" onclick="alert('Gerçek Binance API modu bulut test sürümünde güvenlik için pasiftir. Test Lab 7/24 çalışmaktadır.')">⚡ 2. GERÇEK BINANCE İŞLEMLERİ (CANLI API)</div>
      <a href="/api/download-csv" class="tab-btn" style="text-decoration:none;">🔍 3. 15DK RADAR & EXCEL AKTARICI</a>
    </div>

    <div class="dashboard">
      <!-- SOL PANEL: MOTOR KONTROLÜ -->
      <div class="panel">
        <h2>
          <span>🎛️ MOTOR KONTROLÜ</span>
        </h2>

        <div class="status-box">
          <div class="status-item">
            <span>⚡ Sistem Durumu</span>
            <span class="status-pill green" id="liveStatus">ÇALIŞIYOR</span>
          </div>
          <div class="status-item">
            <span>🛡️ 1s Lazer Motor</span>
            <span class="status-pill green">AKTİF (2s Lazer)</span>
          </div>
          <div class="status-item">
            <span>🐋 Balina Radarı</span>
            <span class="status-pill green">⚡ SAF BALİNA (Canlı 3m)</span>
          </div>
          <div class="status-item">
            <span>📡 Likit Radar</span>
            <span class="status-pill green">Aktif ($50M+ Likit: 25L/20S)</span>
          </div>
          <div class="status-item">
            <span>📊 BTC 15m Trend</span>
            <span class="status-pill" id="btcVal" style="color:${stats.btcIsGreen ? 'var(--green)' : 'var(--red)'};">${stats.btcTrend}</span>
          </div>
          <div class="status-item">
            <span>🎯 Slot Kullanımı</span>
            <span class="status-pill purple" id="posCount">${stats.activeCount} / ${CONFIG.maxSlots} (Sniper Slot)</span>
          </div>
        </div>

        <div class="strategy-banner-card">
          <div class="strat-card-head">
            <span class="strat-badge-pill">AKTİF MOTOR</span>
            <span style="font-size:10px; color:#c084fc;">⚡ Vur-Kaç Sniper</span>
          </div>
          <div class="strat-card-title">🐋 Balina Avcısı (3m Hızlı Vur-Kaç)</div>
          <div class="strat-card-sub">Dakikalar İçinde Kâr Al • 3m Hacim Patlaması & %100 Çıkış</div>
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
        <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);border-radius:6px;padding:8px 10px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:10.5px;font-weight:800;color:var(--green)">🛡️ Otomatik Başabaş ($0 Risk)</div>
            <div style="font-size:9.5px;color:var(--muted)">Koin girilen kâra ulaşınca stop maliyete çekilir ($0 Risk)</div>
          </div>
          <div style="display:flex;align-items:baseline;gap:3px;">
            <input type="number" id="inpBe" value="${CONFIG.bePct.toFixed(2)}" step="0.1" style="width:48px;background:none;border:none;color:var(--green);font-family:'JetBrains Mono';font-size:13px;font-weight:800;text-align:right;outline:none;">
            <span style="font-size:10px;color:var(--muted)">%</span>
          </div>
        </div>

        <div style="background:rgba(250,204,21,0.08);border:1px solid rgba(250,204,21,0.3);border-radius:6px;padding:8px 10px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:10.5px;font-weight:800;color:#facc15">🏆 VUR-KAÇ MOONSHOT</div>
            <div style="font-size:9.5px;color:var(--muted)">Hedefe ulaşınca %100 pozisyon kapatılır</div>
          </div>
          <div style="display:flex;align-items:baseline;gap:3px;">
            <input type="number" id="inpMoon" value="${CONFIG.moonPct.toFixed(2)}" step="1" style="width:48px;background:none;border:none;color:#facc15;font-family:'JetBrains Mono';font-size:13px;font-weight:800;text-align:right;outline:none;">
            <span style="font-size:10px;color:var(--muted)">%</span>
          </div>
        </div>

        <div class="sidebar-section-title">💰 SEANS PERFORMANSI</div>
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
            <span class="perf-mini-val" style="color:#facc15;" id="stMega">${stats.megaWins} Adet</span>
          </div>
        </div>

        <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.25);border-radius:6px;padding:6px 8px;margin-bottom:8px;display:flex;align-items:center;gap:6px;font-size:10px;color:var(--green);font-weight:700;">
          <span>⚡</span>
          <span>7/24 Kesintisiz Hafıza & Eşitleme Aktif</span>
        </div>

        <div class="action-buttons-grid">
          <a href="/api/download-csv" class="btn-action btn-secondary">📊 CSV İNDİR</a>
          <a href="/api/backup-json" class="btn-action btn-secondary" style="color:var(--blue);">💾 YEDEK AL</a>
          <button onclick="document.getElementById('importFile').click()" class="btn-action btn-secondary" style="color:var(--purple);">📂 YEDEK YÜKLE</button>
          <button onclick="resetBalance()" class="btn-action btn-reset">🧹 SIFIRLA ($100)</button>
          <input type="file" id="importFile" accept=".json" style="display:none" onchange="handleImportBackup(event)">
        </div>
      </div>

      <!-- SAĞ PANEL: İŞLEMLER -->
      <div class="panel">
        <h2>
          <span>🎯 BEKLEYEN MOONSHOT POZİSYONLARI</span>
          <span class="badge-moon">🚀 10X TREND MODU</span>
        </h2>

        <!-- ŞAMPİYON KOİNLER -->
        <div style="background:var(--panel2);border:1px solid var(--border);border-radius:6px;padding:7px 10px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:5px;">
          <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
            <span style="font-size:9.5px;color:var(--muted);font-weight:700;">🎯 ÖNCELİKLİ ŞAMPİYONLAR:</span>
            <div id="vipChips" style="display:flex;flex-wrap:wrap;gap:4px;">
              ${vipKeys.map(k => `<span class="chip">${k}</span>`).join('')}
            </div>
          </div>
          <button onclick="location.reload()" style="font-size:9.5px;padding:2px 7px;background:none;border:1px solid var(--border);border-radius:4px;color:var(--muted);cursor:pointer;">Yenile</button>
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
        <div class="mobile-swipe-hint">👉 <span>Yana kaydırarak tüm sütunları inceleyebilirsiniz</span></div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Zaman</th>
                <th>Sembol</th>
                <th>Yön</th>
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
      </div>
    </div>
  </div>

  <script>
    const LS_HIST = "moon_cloud_history";
    const LS_BAL = "moon_cloud_balance";
    let isRestoring = false;

    async function updateDashboard() {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) return;
        const data = await res.json();

        // 🛡️ İki Yönlü Dayanıklı Hafıza (Auto Self-Healing)
        const localHistStr = localStorage.getItem(LS_HIST);
        const localSavedHist = localHistStr ? JSON.parse(localHistStr) : [];
        const localSavedBal = localStorage.getItem(LS_BAL);

        // Durum A: Render yeniden başlamış (Sunucu geçmişi 0, ama tarayıcıda kayıt var)
        if ((!data.history || data.history.length === 0) && localSavedHist.length > 0 && !isRestoring) {
          isRestoring = true;
          console.log("Sunucu belleği Render yeniden başlatması sonrası temizlenmiş. Tarayıcıdan geri yükleniyor...");
          try {
            const restRes = await fetch('/api/restore-state', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                history: localSavedHist,
                balance: localSavedBal ? parseFloat(localSavedBal) : 100.0
              })
            });
            const restData = await restRes.json();
            if (restData.ok) {
              console.log("Sunucu durumu başarıyla kurtarıldı:", restData);
              isRestoring = false;
              setTimeout(updateDashboard, 400);
              return;
            }
          } catch (err) {
            console.error("Geri yükleme hatası:", err);
          }
          isRestoring = false;
        }

        // Durum B: Sunucuda işlemler var -> Tarayıcı hafızasını güncelle
        if (data.history && data.history.length > 0) {
          localStorage.setItem(LS_HIST, JSON.stringify(data.history));
          localStorage.setItem(LS_BAL, data.stats.balance);
        }

        // Performans & İstatistikler
        document.getElementById("stBalance").innerText = '$' + data.stats.balance;
        const pnlEl = document.getElementById("stPnl");
        pnlEl.innerText = (parseFloat(data.stats.totalPnl) >= 0 ? '+' : '') + '$' + data.stats.totalPnl + ' (%' + data.stats.totalRoi + ')';
        pnlEl.style.color = parseFloat(data.stats.totalPnl) >= 0 ? 'var(--green)' : 'var(--red)';
        document.getElementById("stTotalTrades").innerText = data.stats.totalTrades;
        document.getElementById("stWinRate").innerText = '%' + data.stats.winRate;
        document.getElementById("stWinsLosses").innerText = data.stats.wins + 'K / ' + data.stats.losses + 'Z';
        document.getElementById("stMega").innerText = data.stats.megaWins + ' Adet';
        document.getElementById("posCount").innerText = data.stats.activeCount + ' / ' + ${CONFIG.maxSlots} + ' (Sniper Slot)';
        document.getElementById("histCount").innerText = data.history.length;

        const btcEl = document.getElementById("btcVal");
        btcEl.innerText = data.stats.btcTrend;
        btcEl.style.color = data.stats.btcIsGreen ? 'var(--green)' : 'var(--red)';

        // Aktif Pozisyonlar Tablosu
        const tbody = document.getElementById("activeTbody");
        if (data.positions.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px;font-size:12px;">🔍 350+ Vadeli Koinlerde 3m Balina & Moonshot Kırılımları Taranıyor...</td></tr>';
        } else {
          tbody.innerHTML = data.positions.map((p, idx) => {
            const isLong = p.side === 'LONG';
            const isWin = (p.pnl || 0) >= 0;
            const stopText = p.beLocked 
              ? '<span class="badge-be">🛡️ BAŞABAŞ ($0 RİSK)</span>' 
              : '<span class="badge-sl">🛑 STOP: -%${CONFIG.slPct.toFixed(2)}</span>';

            const roiStr = (p.roi >= 0 ? '+' : '') + (p.roi || 0).toFixed(1) + '%';
            const pnlStr = (p.pnl >= 0 ? '+$' : '-$') + Math.abs(p.pnl || 0).toFixed(2);

            return \`
              <tr>
                <td style="color:var(--muted);font-weight:700;">\${idx+1}</td>
                <td>
                  <div style="display:flex;align-items:center;gap:4px;">
                    <span style="font-weight:900;color:#fff;">\${p.symbol}</span>
                    <span class="badge-strat">🚀 MOONSHOT TREND</span>
                  </div>
                </td>
                <td>
                  <span class="\${isLong ? 'badge-side-long' : 'badge-side-short'}">\${isLong ? '▲ LONG' : '▼ SHORT'}</span>
                </td>
                <td>
                  <span style="color:var(--muted);">$ \${parseFloat(p.entryPrice).toFixed(4)}</span>
                  <span style="color:var(--blue);margin:0 2px;">➔</span>
                  <span style="color:#fff;font-weight:800;">$ \${parseFloat(p.currentPrice).toFixed(4)}</span>
                  <div style="font-size:9.5px;color:var(--muted)">RSI: 50</div>
                </td>
                <td>\${stopText}</td>
                <td><span style="color:var(--green);font-weight:800;">+%\${(p.mfe || 0).toFixed(2)}</span></td>
                <td>
                  <span class="\${isWin ? 'badge-pnl-pos' : 'badge-pnl-neg'}">\${roiStr} (\${pnlStr})</span>
                </td>
                <td>
                  <button onclick="closePosition('\${p.id}')" class="btn-close-pos">Kapat</button>
                </td>
              </tr>
            \`;
          }).join('');
        }

        // Geçmiş Tablosu
        const histTbody = document.getElementById("historyTbody");
        if (data.history.length === 0) {
          histTbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:18px;">Henüz tamamlanan işlem geçmişi bulunmuyor.</td></tr>';
        } else {
          histTbody.innerHTML = data.history.slice(0, 50).map((h, idx) => {
            const isWin = (h.pnl || 0) >= 0;
            return \`
              <tr>
                <td style="color:var(--muted);font-weight:700;">\${idx+1}</td>
                <td style="color:var(--muted);font-size:10.5px;">\${h.time}</td>
                <td style="font-weight:800;color:#fff;">\${h.symbol}</td>
                <td><span class="\${h.side === 'LONG' ? 'badge-side-long' : 'badge-side-short'}">\${h.side}</span></td>
                <td>\${h.durationMin} dk</td>
                <td style="font-size:11px;color:var(--muted);">\${h.exitReason}</td>
                <td style="color:var(--green);font-weight:800;">+%\${(h.mfe || 0).toFixed(2)}</td>
                <td style="color:\${isWin ? 'var(--green)' : 'var(--red)'};font-weight:800;">\${isWin ? '+' : ''}$\${(h.pnl || 0).toFixed(2)}</td>
                <td style="color:\${isWin ? 'var(--green)' : 'var(--red)'};font-weight:800;">\${isWin ? '+' : ''}%\${(h.roi || 0).toFixed(1)}</td>
              </tr>
            \`;
          }).join('');
        }
      } catch (e) {}
    }

    async function closePosition(id) {
      if (!confirm("Bu pozisyonu manuel olarak kapatmak istiyor musunuz?")) return;
      await fetch('/api/close-position?id=' + id);
      updateDashboard();
    }

    async function resetBalance() {
      if (!confirm("DİKKAT: Bakiye $100.00 olarak sıfırlanacak ve hem sunucudaki hem tarayıcınızdaki tüm geçmiş silinecektir. Emin misiniz?")) return;
      localStorage.removeItem(LS_HIST);
      localStorage.removeItem(LS_BAL);
      await fetch('/api/reset-balance');
      location.reload();
    }

    async function handleImportBackup(e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const json = JSON.parse(evt.target.result);
          if (!json.history || !Array.isArray(json.history)) {
            alert("Hata: Geçersiz yedek dosyası formatı!");
            return;
          }
          localStorage.setItem(LS_HIST, JSON.stringify(json.history));
          if (json.balance) localStorage.setItem(LS_BAL, json.balance);
          const res = await fetch('/api/import-backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(json)
          });
          const d = await res.json();
          if (d.ok) {
            alert("✅ Yedek başarıyla yüklendi! (" + d.restored + " adet işlem kurtarıldı, Bakiye: $" + d.balance + ")");
            location.reload();
          } else {
            alert("Yükleme başarısız: " + (d.error || "Bilinmeyen hata"));
          }
        } catch(err) {
          alert("Dosya okunamadı: " + err.message);
        }
      };
      reader.readAsText(file);
    }

    // Parametreleri Dinamik Güncelleme
    ['inpSlots', 'inpMargin', 'inpLev', 'inpSl', 'inpBe', 'inpMoon'].forEach(id => {
      document.getElementById(id).addEventListener('change', async () => {
        const slots = document.getElementById('inpSlots').value;
        const margin = document.getElementById('inpMargin').value;
        const lev = document.getElementById('inpLev').value;
        const sl = document.getElementById('inpSl').value;
        const be = document.getElementById('inpBe').value;
        const moon = document.getElementById('inpMoon').value;
        await fetch(\`/api/update-settings?slots=\${slots}&margin=\${margin}&lev=\${lev}&sl=\${sl}&be=\${be}&moon=\${moon}\`);
      });
    });

    setInterval(updateDashboard, 2000);
  </script>
</body>
</html>`;
}

function renderActiveRows(positions) {
  if (!positions || positions.length === 0) {
    return '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px;font-size:12px;">🔍 350+ Vadeli Koinlerde 3m Balina & Moonshot Kırılımları Taranıyor...</td></tr>';
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
            <span style="font-weight:900;color:#fff;">${p.symbol}</span>
            <span class="badge-strat">🚀 MOONSHOT TREND</span>
          </div>
        </td>
        <td>
          <span class="${isLong ? 'badge-side-long' : 'badge-side-short'}">${isLong ? '▲ LONG' : '▼ SHORT'}</span>
        </td>
        <td>
          <span style="color:var(--muted);">$ ${parseFloat(p.entryPrice).toFixed(4)}</span>
          <span style="color:var(--blue);margin:0 2px;">➔</span>
          <span style="color:#fff;font-weight:800;">$ ${parseFloat(p.currentPrice).toFixed(4)}</span>
          <div style="font-size:9.5px;color:var(--muted)">RSI: 50</div>
        </td>
        <td>${stopText}</td>
        <td><span style="color:var(--green);font-weight:800;">+%${(p.mfe || 0).toFixed(2)}</span></td>
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
    return '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:18px;">Henüz tamamlanan işlem geçmişi bulunmuyor.</td></tr>';
  }
  return hist.slice(0, 50).map((h, idx) => {
    const isWin = (h.pnl || 0) >= 0;
    return `
      <tr>
        <td style="color:var(--muted);font-weight:700;">${idx+1}</td>
        <td style="color:var(--muted);font-size:10.5px;">${h.time}</td>
        <td style="font-weight:800;color:#fff;">${h.symbol}</td>
        <td><span class="${h.side === 'LONG' ? 'badge-side-long' : 'badge-side-short'}">${h.side}</span></td>
        <td>${h.durationMin} dk</td>
        <td style="font-size:11px;color:var(--muted);">${h.exitReason}</td>
        <td style="color:var(--green);font-weight:800;">+%${(h.mfe || 0).toFixed(2)}</td>
        <td style="color:${isWin ? 'var(--green)' : 'var(--red)'};font-weight:800;">${isWin ? '+' : ''}$${(h.pnl || 0).toFixed(2)}</td>
        <td style="color:${isWin ? 'var(--green)' : 'var(--red)'};font-weight:800;">${isWin ? '+' : ''}%${(h.roi || 0).toFixed(1)}</td>
      </tr>
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
    const urls = [
      "https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT",
      "https://fapi1.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT",
      "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
      "https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCUSDT"
    ];
    for (const u of urls) {
      try {
        const t0 = Date.now();
        const r = await fetch(u, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36' }
        });
        const txt = await r.text();
        results[u] = { status: r.status, statusText: r.statusText, ms: Date.now() - t0, sample: txt.slice(0, 100) };
      } catch (err) {
        results[u] = { error: err.message };
      }
    }
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
      radar: radarList.slice(0, 30)
    }));
    return;
  }

  // 🛡️ TARAYICIDAN OTOMATİK DURUM VE GEÇMİŞ KURTARMA (RENDER YENİDEN BAŞLAMASINA KARŞI)
  if (pathname === '/api/restore-state' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req);
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
        balance = CONFIG.initialBalance + totalPnl;

        rewriteCsvFile();
        persistState();
        try {
          fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 100), null, 2), 'utf8');
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
          balance = (body.initialBalance || CONFIG.initialBalance) + totalPnl;
        }
        rewriteCsvFile();
        persistState();
        try {
          fs.writeFileSync(HISTORY_FILE, JSON.stringify(history.slice(0, 100), null, 2), 'utf8');
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
    balance = CONFIG.initialBalance;
    activePositions = [];
    history = [];
    try {
      if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
      if (fs.existsSync(HISTORY_FILE)) fs.unlinkSync(HISTORY_FILE);
      if (fs.existsSync(CSV_FILE)) fs.unlinkSync(CSV_FILE);
    } catch (e) {}
    initStorage();
    persistState();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, balance }));
    return;
  }

  if (pathname === '/api/update-settings') {
    const slots = parseInt(parsedUrl.searchParams.get('slots'));
    const margin = parseFloat(parsedUrl.searchParams.get('margin'));
    const lev = parseFloat(parsedUrl.searchParams.get('lev'));
    const sl = parseFloat(parsedUrl.searchParams.get('sl'));
    const be = parseFloat(parsedUrl.searchParams.get('be'));
    const moon = parseFloat(parsedUrl.searchParams.get('moon'));

    if (slots) CONFIG.maxSlots = slots;
    if (margin) CONFIG.marginPerTrade = margin;
    if (lev) CONFIG.leverage = lev;
    if (sl) CONFIG.slPct = sl;
    if (be) CONFIG.bePct = be;
    if (moon) CONFIG.moonPct = moon;

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
  addLog(`🚀 Moonshot 7/24 Bulut Test Laboratuvarı Başlatıldı! (Bakiye: $${CONFIG.initialBalance})`);
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
  }, 8 * 60 * 1000);
});
