/**
 * ============================================================================
 * 🚀 MOONSHOT 7/24 BULUT TEST LABORATUVARI (SCREEN 1 HEADLESS MOTORU)
 * ============================================================================
 * Tamamen ücretsiz (0 TL), kredi kartsız bulutta (Render / Koyeb / Vps) 
 * veya yerel bilgisayarda 7/24 kesintisiz çalışarak Binance verilerini tarar,
 * alım-satım simülasyonunu yürütür ve tüm test sonuçlarını CSV/Excel'e kaydeder.
 * 
 * Sıfır NPM Bağımlılığı - Node.js yerel kütüphaneleri (http, fs, path) ile çalışır.
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

// --- BOT AYARLARI (HTML EKRAN 1 İLE BİREBİR AYNI) ---
const CONFIG = {
  initialBalance: 1000.0,
  marginPerTrade: 10.0,       // İşlem Başı Teminat ($)
  leverage: 20,              // Kaldıraç (20x)
  maxSlots: 3,               // Eşzamanlı Maksimum Pozisyon
  slPct: 1.20,               // Stop Loss (% spot = %24 ROI)
  bePct: 1.50,               // Erken Başabaş Kilidi (% spot)
  moonPct: 15.00,            // Mega Moonshot Hedefi (% spot = %300 ROI)
  feeRate: 0.0008,           // Giriş + Çıkış Taker Komisyonu (%0.08)
  scanIntervalMs: 3500,      // Tarama Döngüsü (3.5 saniye)
  riskIntervalMs: 2000,      // Risk & Stop Döngüsü (2 saniye)
  radarIntervalMs: 60000     // 15dk/1s Radar Confluence Döngüsü (60 saniye)
};

// Yasaklı koinler & stabil pariteler
const BANNED_SYMBOLS = new Set([
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT',
  'USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'EURUSDT'
]);

// --- DURUM YÖNETİMİ ---
let balance = CONFIG.initialBalance;
let activePositions = [];
let history = [];
let coinCooldowns = {};
let rollingTickerPrices = {};
let radarMap = {};
let logs = [];
let startTime = Date.now();
let lastScanTime = 0;
let lastScanLogTime = 0;
let lastRiskTime = 0;
let isScanRunning = false;
let isRiskRunning = false;
let isRadarRunning = false;

// --- GÜNLÜK KAYITLARI (LOGGING) ---
function addLog(msg, type = "INFO") {
  const time = new Date().toLocaleTimeString('tr-TR');
  const entry = { time, type, msg };
  logs.unshift(entry);
  if (logs.length > 150) logs.pop();
  console.log(`[${time}] [${type}] ${msg}`);
}

// --- CSV BAŞLIĞI VE DOSYA BAŞLATMA ---
function initStorage() {
  try {
    if (!fs.existsSync(CSV_FILE)) {
      // Excel Türkçe karakter ve sütun uyumu için UTF-8 BOM ve noktalı virgül
      const csvHeader = '\uFEFF' + [
        'ID',
        'Tarih & Saat',
        'Koin',
        'Yön',
        'Giriş Fiyatı',
        'Çıkış Fiyatı',
        'Süre (Dk)',
        'MFE (En Yüksek %)',
        'Net Kâr ($)',
        'ROI (%)',
        'Çıkış Nedeni',
        'Radar / Teyit Notu'
      ].join(';') + '\n';
      fs.writeFileSync(CSV_FILE, csvHeader, 'utf8');
      addLog("📁 Yeni CSV işlem kayıt dosyası oluşturuldu: trades_history.csv");
    }

    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf8');
      history = JSON.parse(data);
      addLog(`📁 ${history.length} adet geçmiş işlem dosyadan yüklendi.`);
    }

    if (fs.existsSync(STATE_FILE)) {
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      balance = state.balance || CONFIG.initialBalance;
      activePositions = state.activePositions || [];
      coinCooldowns = state.coinCooldowns || {};
      addLog(`📁 Önceki durum yüklendi: Bakiye $${balance.toFixed(2)}, Açık: ${activePositions.length}`);
    }
  } catch (err) {
    addLog(`Dosya okuma uyarısı: ${err.message}`, 'WARN');
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
  } catch (err) {
    console.error("Durum kaydedilemedi:", err.message);
  }
}

function appendTradeToCsv(trade) {
  try {
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
    addLog(`CSV yazma hatası: ${err.message}`, 'ERROR');
  }
}

// --- BİNANCE API YARDIMCISI ---
let lastApiErrorLog = 0;
async function fetchBinance(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      }
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      if (Date.now() - lastApiErrorLog > 15000) {
        lastApiErrorLog = Date.now();
        addLog(`⚠️ Binance HTTP ${res.status} (${res.statusText}) [${url.slice(0, 45)}]`, 'WARN');
      }
      return null;
    }
    return await res.json();
  } catch (err) {
    if (Date.now() - lastApiErrorLog > 15000) {
      lastApiErrorLog = Date.now();
      addLog(`⚠️ Binance Bağlantı Hatası: ${err.message}`, 'WARN');
    }
    return null;
  }
}

// --- 1. RADAR MODÜLÜ (15DK ÇOKLU ZAMAN VE ALICI BASKISI) ---
async function updateRadar() {
  if (isRadarRunning) return;
  isRadarRunning = true;
  try {
    const tickers = await fetchBinance("https://fapi.binance.com/fapi/v1/ticker/24hr");
    if (!tickers || !Array.isArray(tickers)) return;

    // Hacmi $5M+ olan USDT paritelerini filtrele
    const valid = tickers.filter(t => {
      if (!t.symbol.endsWith("USDT") || t.symbol.startsWith("USDC") || BANNED_SYMBOLS.has(t.symbol)) return false;
      const volM = (parseFloat(t.quoteVolume) || 0) / 1e6;
      return volM >= 4.0;
    });

    // 20'li paralel gruplarla 15m mumlarını çek
    const chunkSize = 20;
    for (let i = 0; i < Math.min(valid.length, 60); i += chunkSize) {
      const chunk = valid.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async item => {
        const sym = item.symbol;
        const klines = await fetchBinance(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=15m&limit=2`);
        if (klines && klines.length > 0) {
          const c = klines[klines.length - 1];
          const openP = parseFloat(c[1]);
          const highP = parseFloat(c[2]);
          const lowP = parseFloat(c[3]);
          const closeP = parseFloat(c[4]);
          const volUsdt = parseFloat(c[7]) || 0;
          const takerBuyUsdt = parseFloat(c[10]) || 0;

          const takerRatio = volUsdt > 0 ? (takerBuyUsdt / volUsdt) * 100 : 50;
          const chg15m = openP > 0 ? ((closeP - openP) / openP) * 100 : 0;

          let signal = "⚖️ NÖTR";
          if (chg15m >= 3.5) signal = "🚀 SÜPER ROKET";
          else if (chg15m >= 1.4) signal = "🟢 GÜÇLÜ BOĞA";
          else if (chg15m <= -3.5) signal = "🩸 ŞELALE";
          else if (chg15m <= -1.4) signal = "🔴 GÜÇLÜ AYI";

          radarMap[sym] = {
            symbol: sym,
            chg15m,
            takerBuyRatio: takerRatio,
            signal,
            lastUpdate: Date.now()
          };
        }
      }));
    }
    addLog(`📡 15dk/1s Radar güncellendi: ${Object.keys(radarMap).length} koin alıcı/satıcı baskısı analiz edildi.`);
  } catch (err) {
    // Sessiz hata yakalama
  } finally {
    isRadarRunning = false;
  }
}

// --- 2. CANLI TARAYICI MOTORU (SCAN LOOP) ---
async function scanLoop() {
  if (isScanRunning) return;
  isScanRunning = true;
  lastScanTime = Date.now();
  try {
    if (activePositions.length >= CONFIG.maxSlots) {
      // Slotlar doluysa ve uyuyan coin varsa rotasyon kontrolü
      checkSlotRotation();
      return;
    }

    const tickers = await fetchBinance("https://fapi.binance.com/fapi/v1/ticker/24hr");
    if (!tickers || !Array.isArray(tickers)) return;

    const now = Date.now();

    // Rolling momentum takibi (3 dakikalık hafıza)
    tickers.forEach(t => {
      const sym = t.symbol;
      const p = parseFloat(t.lastPrice);
      if (!rollingTickerPrices[sym]) rollingTickerPrices[sym] = [];
      const hist = rollingTickerPrices[sym];
      hist.push({ t: now, p });
      while (hist.length > 0 && now - hist[0].t > 180000) {
        hist.shift();
      }
    });

    const activeSymbols = new Set(activePositions.map(p => p.symbol));

    const candidates = tickers.filter(t => {
      if (!t.symbol.endsWith("USDT") || t.symbol.startsWith("USDC") || BANNED_SYMBOLS.has(t.symbol)) return false;
      if (activeSymbols.has(t.symbol)) return false;
      if (coinCooldowns[t.symbol] && coinCooldowns[t.symbol] > now) return false;
      const p = parseFloat(t.lastPrice);
      return p >= 0.0001;
    }).map(t => {
      const sym = t.symbol;
      const volM = (parseFloat(t.quoteVolume) || 0) / 1e6;
      const rawChg = parseFloat(t.priceChangePercent) || 0;
      
      const hist = rollingTickerPrices[sym];
      let rollMovePct = 0;
      if (hist && hist.length >= 2) {
        const oldest = hist[0];
        const newest = hist[hist.length - 1];
        if (oldest.p > 0) rollMovePct = ((newest.p - oldest.p) / oldest.p) * 100;
      }

      // Radar Puanı Katlayıcısı
      const rInfo = radarMap[sym];
      let radarBoost = 0;
      if (rInfo) {
        if (rInfo.chg15m >= 1.0 && rInfo.takerBuyRatio >= 50) {
          radarBoost = (rInfo.chg15m * 20) + ((rInfo.takerBuyRatio - 50) * 4.0);
          if (rInfo.signal.includes("ROKET") || rInfo.signal.includes("BOĞA")) radarBoost += 30;
        } else if (rInfo.chg15m <= -1.0 && rInfo.takerBuyRatio <= 50) {
          radarBoost = (Math.abs(rInfo.chg15m) * 16) + ((50 - rInfo.takerBuyRatio) * 3.5);
          if (rInfo.signal.includes("ŞELALE") || rInfo.signal.includes("AYI")) radarBoost += 30;
        }
      }

      const instantScore = rollMovePct > 0 ? rollMovePct * 12 : Math.abs(rollMovePct) * 8;
      const hotScore = instantScore + Math.abs(rawChg > 0 ? Math.min(rawChg, 25) : Math.max(rawChg, -25)) + (Math.sqrt(volM) * 1.8) + radarBoost;

      return {
        symbol: sym,
        lastPrice: parseFloat(t.lastPrice),
        volM,
        chg: rawChg,
        rollMovePct,
        hotScore
      };
    })
    .filter(t => t.volM >= 3.0)
    .sort((a, b) => b.hotScore - a.hotScore)
    .slice(0, 30);

    if (now - lastScanLogTime > 40000 && candidates.length > 0) {
      lastScanLogTime = now;
      const top1 = candidates[0];
      addLog(`🔍 Piyasa taranıyor (350+ vadeli koin). Lider ivme: ${top1.symbol} (24s: %${top1.chg.toFixed(1)}, Puan: ${top1.hotScore.toFixed(0)}) | Slot: ${activePositions.length}/${CONFIG.maxSlots}`);
    }

    // 5'li paralel kline incelemesi
    const chunkSize = 5;
    let opened = false;
    for (let ci = 0; ci < candidates.length && !opened; ci += chunkSize) {
      if (activePositions.length >= CONFIG.maxSlots) break;
      const chunk = candidates.slice(ci, ci + chunkSize);

      const chunkData = await Promise.all(chunk.map(async item => {
        const k3m = await fetchBinance(`https://fapi.binance.com/fapi/v1/klines?symbol=${item.symbol}&interval=3m&limit=30`);
        return { item, k3m };
      }));

      for (const res of chunkData) {
        if (!res || !res.k3m || res.k3m.length < 22) continue;
        if (activePositions.length >= CONFIG.maxSlots) break;

        const { item, k3m } = res;
        const sym = item.symbol;
        const lastIdx = k3m.length - 1;

        const curP = parseFloat(k3m[lastIdx][4]);
        const curO = parseFloat(k3m[lastIdx][1]);
        const curH = parseFloat(k3m[lastIdx][2]);
        const curL = parseFloat(k3m[lastIdx][3]);
        const curV = parseFloat(k3m[lastIdx][5]);

        const prevO = parseFloat(k3m[lastIdx - 1][1]);
        const prevC = parseFloat(k3m[lastIdx - 1][4]);
        const prevV = parseFloat(k3m[lastIdx - 1][5]);

        // 20 mumluk hacim ortalaması
        let sumVol20 = 0;
        for (let m = lastIdx - 20; m < lastIdx; m++) {
          sumVol20 += parseFloat(k3m[m][5]);
        }
        const avgVol20 = (sumVol20 / 20) || 1;

        const curMovePct = ((curP - curO) / curO) * 100;
        const twoCandleMovePct = ((curP - prevO) / prevO) * 100;

        const isWhaleVol = curV >= avgVol20 * 2.0 || (curV + prevV) >= avgVol20 * 3.0;
        const isDailyTrending = item.chg >= 2.0 && item.chg <= 80.0;
        const hasMomentum = (curMovePct >= 1.00 && curP > curO) || (twoCandleMovePct >= 1.30 && curP >= curO * 0.998);

        // İğne / Tuzak Filtresi: Tepeden %0.8'den fazla satış yememiş olmalı
        const noWickLong = curP >= curH * 0.992;

        // Radar Teyidi
        const rInfo = radarMap[sym];
        let radarOkLong = true;
        let radarOkShort = true;
        let radarTag = "";
        if (rInfo) {
          if (rInfo.takerBuyRatio < 50 || rInfo.chg15m < -0.20) radarOkLong = false;
          if (rInfo.takerBuyRatio > 50 || rInfo.chg15m > 0.20) radarOkShort = false;
          if (rInfo.chg15m >= 0.8 && rInfo.takerBuyRatio >= 52) {
            radarTag = `[15m: +%${rInfo.chg15m.toFixed(1)} / %${rInfo.takerBuyRatio.toFixed(0)} Alıcı - ${rInfo.signal}]`;
          } else if (rInfo.chg15m <= -0.8 && rInfo.takerBuyRatio <= 48) {
            radarTag = `[15m: %${rInfo.chg15m.toFixed(1)} / %${(100 - rInfo.takerBuyRatio).toFixed(0)} Satıcı - ${rInfo.signal}]`;
          }
        }

        const isLongPump = ((hasMomentum && isWhaleVol) || (isDailyTrending && curMovePct >= 0.70 && isWhaleVol)) && noWickLong && radarOkLong;
        
        // SHORT Kuralları
        const isDailyOverbought = item.chg >= 15.0;
        const hasDownMomentum = (curMovePct <= -1.00 && curP < curO) || (twoCandleMovePct <= -1.30 && curP < curO);
        const noWickShort = curP <= curL * 1.008;
        const isShortDump = ((hasDownMomentum && isWhaleVol) || (isDailyOverbought && curMovePct <= -0.90 && isWhaleVol)) && noWickShort && radarOkShort;

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
            mfe: 0.0,
            mae: 0.0,
            pnl: 0.0,
            roi: 0.0,
            margin: CONFIG.marginPerTrade,
            leverage: CONFIG.leverage,
            radarTag: radarTag
          };

          activePositions.push(position);
          opened = true;
          persistState();

          addLog(`🚀 POZİSYON AÇILDI: [${side}] ${sym} @ ${curP} (SL: ${stopPrice.toFixed(4)}) ${radarTag}`, 'TRADE');
          break;
        }
      }
    }
  } catch (err) {
    addLog(`Tarama hatası: ${err.message}`, 'WARN');
  } finally {
    isScanRunning = false;
  }
}

// Slot Doluysa Uyuyan Coini Kapatıp Yeni Fırsata Yer Aç
function checkSlotRotation() {
  if (activePositions.length < CONFIG.maxSlots) return;
  const now = Date.now();
  let stagnantIdx = -1;
  let maxDuration = 0;

  activePositions.forEach((pos, idx) => {
    const durMin = (now - pos.entryTime) / 60000;
    // 25 dakikadır açık ve kâr/zararı %0.30'u geçememişse "uykucu" sayılır
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

// --- 3. HIZLI RİSK & KÂR KİLİTLEME MOTORU (FAST RISK LOOP) ---
async function fastRiskLoop() {
  if (isRiskRunning || activePositions.length === 0) return;
  isRiskRunning = true;
  lastRiskTime = Date.now();
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

      // 1. AŞAMA: ERKEN BAŞABAŞ KİLİDİ (+%1.50)
      if (!pos.beLocked && pos.mfe >= CONFIG.bePct) {
        pos.beLocked = true;
        pos.stopPrice = isLong ? pos.entryPrice * 1.002 : pos.entryPrice * 0.998;
        stateChanged = true;
        addLog(`🛡️ ${pos.symbol} +%${pos.mfe.toFixed(2)} Kâra Ulaştı! Stop Girişe Çekildi ($0 RİSK)`);
      }

      // 2. AŞAMA: GARANTİ KÂR KİLİTLERİ (Kârı Masada Bırakma!)
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

      // 3. AŞAMA: DİNAMİK TRAILING STOP (Genişletilmiş Moonshot Toleransı)
      const mfe = pos.mfe || 0;
      const pullbackLimit = mfe >= 20.0 ? 6.00 : (mfe >= 12.0 ? 4.50 : (mfe >= 7.0 ? 3.00 : 2.00));
      if (!exitReason && mfe >= CONFIG.bePct && (mfe - move) >= pullbackLimit) {
        exitReason = `🏆 Zirveden Takip Kârı Alındı (+%${pos.roi.toFixed(1)} ROI / Zirve: +%${mfe.toFixed(2)} Spot)`;
      }

      // 4. AŞAMA: MEGA MOONSHOT HEDEFİ (+%15 Spot = +%300 ROI)
      if (!exitReason && move >= CONFIG.moonPct) {
        exitReason = `🏆 MEGA MOONSHOT HEDEFİ ALINDI (+%${pos.roi.toFixed(0)} ROI / +%${mfe.toFixed(1)} Spot)`;
      }

      // 5. AŞAMA: STOP LOSS / KİLİTLİ STOP TETİKLENMESİ
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

      // ÇIKIŞ İŞLEMİ
      if (exitReason) {
        activePositions.splice(i, 1);
        closeTrade(pos, exitReason);
        stateChanged = true;
      }
    }

    if (stateChanged) {
      persistState();
    }
  } catch (err) {
    addLog(`Risk motoru hatası: ${err.message}`, 'WARN');
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
    time: new Date().toLocaleString('tr-TR'),
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

  addLog(`🏁 POZİSYON KAPANDI: [${pos.side}] ${pos.symbol} | Net PnL: ${pos.pnl >= 0 ? '+' : ''}$${pos.pnl.toFixed(2)} (%${pos.roi.toFixed(1)} ROI) | ${exitReason}`, pos.pnl >= 0 ? 'WIN' : 'LOSS');
}

// --- 4. WEB SUNUCUSU VE CANLI DASHBOARD ---
function getStats() {
  const totalTrades = history.length;
  const wins = history.filter(h => (h.pnl || 0) > 0.05).length;
  const losses = history.filter(h => (h.pnl || 0) < -0.05).length;
  const breakevens = totalTrades - wins - losses;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : "0.0";
  const totalPnl = history.reduce((acc, h) => acc + (h.pnl || 0), 0);
  const totalRoi = (totalPnl / CONFIG.initialBalance) * 100;

  return {
    balance: balance.toFixed(2),
    totalPnl: totalPnl.toFixed(2),
    totalRoi: totalRoi.toFixed(2),
    totalTrades,
    wins,
    losses,
    breakevens,
    winRate,
    activeCount: activePositions.length,
    uptimeMin: Math.floor((Date.now() - startTime) / 60000)
  };
}

function serveDashboardHtml() {
  const stats = getStats();
  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>🚀 Moonshot 7/24 Bulut Test Laboratuvarı</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220%22%22><text y=%2226%22 font-size=%2224%22>🚀</text></svg>">
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #121826;
      --border: #1e293b;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --green: #10b981;
      --green-glow: rgba(16, 185, 129, 0.2);
      --red: #ef4444;
      --red-glow: rgba(239, 68, 68, 0.2);
      --amber: #f59e0b;
      --cyan: #06b6d4;
      --primary: #3b82f6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 16px; font-size: 14px; min-height: 100vh; }
    .container { max-width: 1200px; margin: 0 auto; }
    
    /* Header */
    header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }
    .logo-wrap { display: flex; align-items: center; gap: 10px; }
    .logo-badge { background: linear-gradient(135deg, #2563eb, #7c3aed); padding: 8px 12px; border-radius: 8px; font-size: 18px; font-weight: bold; }
    .title-sub { color: var(--text-muted); font-size: 12px; }
    .status-live { display: flex; align-items: center; gap: 8px; background: rgba(16, 185, 129, 0.1); border: 1px solid var(--green); color: var(--green); padding: 6px 14px; border-radius: 20px; font-weight: 600; font-size: 12px; }
    .pulse-dot { width: 8px; height: 8px; background: var(--green); border-radius: 50%; box-shadow: 0 0 10px var(--green); animation: pulse 1.5s infinite; }
    @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }

    /* Action Bar */
    .action-bar { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
    .btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 18px; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; text-decoration: none; font-size: 13px; transition: 0.2s; }
    .btn-green { background: #10b981; color: #fff; }
    .btn-green:hover { background: #059669; transform: translateY(-1px); }
    .btn-dark { background: #1e293b; color: var(--text); border: 1px solid var(--border); }
    .btn-dark:hover { background: #334155; }

    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .stat-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; }
    .stat-label { color: var(--text-muted); font-size: 12px; margin-bottom: 6px; }
    .stat-val { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
    .stat-sub { font-size: 11px; color: var(--text-muted); margin-top: 4px; }

    /* Sections */
    .sec-title { font-size: 16px; font-weight: 600; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; }
    .badge { font-size: 11px; padding: 3px 8px; border-radius: 12px; font-weight: 600; }
    .badge-green { background: rgba(16, 185, 129, 0.15); color: var(--green); }
    .badge-red { background: rgba(239, 68, 68, 0.15); color: var(--red); }
    .badge-cyan { background: rgba(6, 182, 212, 0.15); color: var(--cyan); }

    /* Positions Grid */
    .pos-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 14px; margin-bottom: 24px; }
    .pos-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 16px; border-left: 4px solid var(--cyan); }
    .pos-card.pos-long { border-left-color: var(--green); }
    .pos-card.pos-short { border-left-color: var(--red); }
    .pos-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .pos-sym { font-size: 16px; font-weight: bold; }
    .pos-details { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; color: var(--text-muted); }
    .pos-details span b { color: var(--text); }
    .pos-pnl { font-size: 18px; font-weight: bold; margin-top: 10px; text-align: right; }

    /* Tables */
    .table-wrap { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; overflow-x: auto; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; text-align: left; }
    th { background: #0d121f; padding: 12px 14px; color: var(--text-muted); font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid var(--border); }
    td { padding: 12px 14px; border-bottom: 1px solid rgba(30, 41, 59, 0.5); font-size: 13px; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(255, 255, 255, 0.02); }

    /* Console / Logs */
    .log-box { background: #070a10; border: 1px solid var(--border); border-radius: 12px; padding: 14px; height: 200px; overflow-y: auto; font-family: monospace; font-size: 12px; line-height: 1.6; }
    .log-row { margin-bottom: 4px; }
    .log-time { color: var(--text-muted); margin-right: 6px; }
    .log-TRADE { color: var(--cyan); font-weight: bold; }
    .log-WIN { color: var(--green); font-weight: bold; }
    .log-LOSS { color: var(--red); }
    .log-WARN { color: var(--amber); }

    .empty-state { text-align: center; padding: 30px; color: var(--text-muted); }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo-wrap">
        <div class="logo-badge">🚀 MS</div>
        <div>
          <h2>Moonshot 7/24 Bulut Test Laboratuvarı</h2>
          <div class="title-sub">Binance Vadeli Piyasalar 15dk/1s Radar & Şimşek Balina Avcısı (Screen 1)</div>
        </div>
      </div>
      <div class="status-live">
        <div class="pulse-dot"></div>
        <span>BULUTTA 7/24 AKTİF</span>
      </div>
    </header>

    <div class="action-bar">
      <a href="/api/download-csv" class="btn btn-green">
        📥 Excel / CSV Olarak İndir (Tüm Geçmiş)
      </a>
      <button onclick="location.reload()" class="btn btn-dark">
        🔄 Sayfayı Yenile
      </button>
      <a href="/ping" target="_blank" class="btn btn-dark" style="margin-left: auto;">
        🩺 Health Check (/ping)
      </a>
    </div>

    <!-- STATS -->
    <div class="stats-grid" id="statsGrid">
      <div class="stat-card">
        <div class="stat-label">Toplam Kasa Bakiyesi</div>
        <div class="stat-val" style="color:var(--cyan);">$<span id="stBalance">${stats.balance}</span></div>
        <div class="stat-sub">Başlangıç: $${CONFIG.initialBalance.toFixed(2)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Toplam Net Kâr</div>
        <div class="stat-val" style="color:${parseFloat(stats.totalPnl) >= 0 ? 'var(--green)' : 'var(--red)'};">
          <span id="stPnl">${parseFloat(stats.totalPnl) >= 0 ? '+' : ''}$${stats.totalPnl}</span>
        </div>
        <div class="stat-sub">Kasa ROI: <span id="stRoi">%${stats.totalRoi}</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Kazanma Oranı (Win Rate)</div>
        <div class="stat-val" style="color:var(--green);">
          %<span id="stWinRate">${stats.winRate}</span>
        </div>
        <div class="stat-sub">🟢 <span id="stWins">${stats.wins}</span> K | 🔴 <span id="stLosses">${stats.losses}</span> Z | 🛡️ <span id="stBes">${stats.breakevens}</span> B</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Aktif Pozisyonlar</div>
        <div class="stat-val" style="color:var(--text);"><span id="stActive">${stats.activeCount}</span> / ${CONFIG.maxSlots}</div>
        <div class="stat-sub">Tamamlanan: <span id="stTotalTrades">${stats.totalTrades}</span> işlem</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Çalışma Süresi</div>
        <div class="stat-val" style="color:var(--text-muted);"><span id="stUptime">${stats.uptimeMin}</span> dk</div>
        <div class="stat-sub">Motor 7/24 kesintisiz</div>
      </div>
    </div>

    <!-- AKTİF POZİSYONLAR -->
    <div class="sec-title">
      <span>⚡ Aktif Pozisyonlar (<span id="activeBadge">${stats.activeCount}</span>)</span>
      <span class="badge badge-cyan">${CONFIG.leverage}x Kaldıraç | $${CONFIG.marginPerTrade} Teminat</span>
    </div>
    <div class="pos-grid" id="posGrid">
      ${renderActiveCards(activePositions)}
    </div>

    <!-- GEÇMİŞ İŞLEMLER -->
    <div class="sec-title" style="margin-top: 10px;">
      <span>📜 Son Tamamlanan Test İşlemleri</span>
      <span class="badge badge-green">Otomatik CSV Kayıtlı</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Tarih</th>
            <th>Koin</th>
            <th>Yön</th>
            <th>Giriş</th>
            <th>Çıkış</th>
            <th>Süre</th>
            <th>Zirve (MFE)</th>
            <th>Net Kâr ($)</th>
            <th>ROI (%)</th>
            <th>Çıkış Nedeni</th>
          </tr>
        </thead>
        <tbody id="historyBody">
          ${renderHistoryRows(history)}
        </tbody>
      </table>
    </div>

    <!-- CANLI TERMİNAL GÜNLÜĞÜ -->
    <div class="sec-title">
      <span>🖥️ Canlı Bot Konsolu</span>
      <span style="font-size:11px; color:var(--text-muted);">Son 150 olay</span>
    </div>
    <div class="log-box" id="logBox">
      ${renderLogRows(logs)}
    </div>
  </div>

  <script>
    // 2 SANİYEDE BİR CANLI DURUM GÜNCELLEMESİ (AJAX POLLING)
    async function updateDashboard() {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) return;
        const data = await res.json();

        // İstatistikler
        document.getElementById("stBalance").innerText = data.stats.balance;
        const pnlEl = document.getElementById("stPnl");
        pnlEl.innerText = (parseFloat(data.stats.totalPnl) >= 0 ? '+' : '') + '$' + data.stats.totalPnl;
        pnlEl.style.color = parseFloat(data.stats.totalPnl) >= 0 ? 'var(--green)' : 'var(--red)';
        document.getElementById("stRoi").innerText = '%' + data.stats.totalRoi;
        document.getElementById("stWinRate").innerText = data.stats.winRate;
        document.getElementById("stWins").innerText = data.stats.wins;
        document.getElementById("stLosses").innerText = data.stats.losses;
        document.getElementById("stBes").innerText = data.stats.breakevens;
        document.getElementById("stActive").innerText = data.stats.activeCount;
        document.getElementById("activeBadge").innerText = data.stats.activeCount;
        document.getElementById("stTotalTrades").innerText = data.stats.totalTrades;
        document.getElementById("stUptime").innerText = data.stats.uptimeMin;

        // Pozisyonlar
        const posGrid = document.getElementById("posGrid");
        if (data.positions.length === 0) {
          posGrid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;">Şu anda açık pozisyon yok. Tarayıcı 7/24 balina patlamalarını izliyor...</div>';
        } else {
          posGrid.innerHTML = data.positions.map(p => {
            const isLong = p.side === 'LONG';
            const isWin = (p.pnl || 0) >= 0;
            return \`
              <div class="pos-card \${isLong ? 'pos-long' : 'pos-short'}">
                <div class="pos-header">
                  <div class="pos-sym">\${p.symbol} <span class="badge \${isLong ? 'badge-green' : 'badge-red'}">\${p.side} \${p.leverage}x</span></div>
                  <div class="badge \${p.beLocked ? 'badge-green' : 'badge-cyan'}">\${p.beLocked ? '🛡️ BE KİLİTLİ' : 'TAKİPTE'}</div>
                </div>
                <div class="pos-details">
                  <span>Giriş: <b>\${p.entryPrice}</b></span>
                  <span>Anlık: <b>\${p.currentPrice}</b></span>
                  <span>Stop: <b>\${p.stopPrice.toFixed(4)}</b></span>
                  <span>Zirve (MFE): <b style="color:var(--green)">+%\${(p.mfe || 0).toFixed(2)}</b></span>
                </div>
                <div class="pos-pnl" style="color: \${isWin ? 'var(--green)' : 'var(--red)'}">
                  \${isWin ? '+' : ''}$\${(p.pnl || 0).toFixed(2)} (%\${(p.roi || 0).toFixed(1)} ROI)
                </div>
              </div>
            \`;
          }).join('');
        }

        // Geçmiş Tablosu
        const historyBody = document.getElementById("historyBody");
        if (data.history.length === 0) {
          historyBody.innerHTML = '<tr><td colspan="11" class="empty-state">Henüz tamamlanan test işlemi yok.</td></tr>';
        } else {
          historyBody.innerHTML = data.history.slice(0, 50).map(h => {
            const isWin = (h.pnl || 0) >= 0;
            return \`
              <tr>
                <td>\${h.id}</td>
                <td style="color:var(--text-muted); font-size:11px;">\${h.time}</td>
                <td><b>\${h.symbol}</b></td>
                <td><span class="badge \${h.side === 'LONG' ? 'badge-green' : 'badge-red'}">\${h.side}</span></td>
                <td>\${h.entryPrice}</td>
                <td>\${h.exitPrice}</td>
                <td>\${h.durationMin} dk</td>
                <td style="color:var(--green)">+%\${(h.mfe || 0).toFixed(2)}</td>
                <td style="color:\${isWin ? 'var(--green)' : 'var(--red)'}; font-weight:600;">\${isWin ? '+' : ''}$\${(h.pnl || 0).toFixed(2)}</td>
                <td style="color:\${isWin ? 'var(--green)' : 'var(--red)'}; font-weight:600;">\${isWin ? '+' : ''}%\${(h.roi || 0).toFixed(2)}</td>
                <td style="font-size:12px; color:var(--text-muted)">\${h.exitReason}</td>
              </tr>
            \`;
          }).join('');
        }

        // Günlükler
        const logBox = document.getElementById("logBox");
        logBox.innerHTML = data.logs.map(l => \`
          <div class="log-row">
            <span class="log-time">[\${l.time}]</span>
            <span class="log-\${l.type}">[\${l.type}]</span>
            <span>\${l.msg}</span>
          </div>
        \`).join('');

      } catch (e) {
        console.error("Dashboard update failed:", e);
      }
    }

    setInterval(updateDashboard, 2000);
  </script>
</body>
</html>`;
}

function renderActiveCards(positions) {
  if (!positions || positions.length === 0) {
    return '<div class="empty-state" style="grid-column:1/-1;">Şu anda açık pozisyon yok. Tarayıcı 7/24 balina patlamalarını izliyor...</div>';
  }
  return positions.map(p => {
    const isLong = p.side === 'LONG';
    const isWin = (p.pnl || 0) >= 0;
    return `
      <div class="pos-card ${isLong ? 'pos-long' : 'pos-short'}">
        <div class="pos-header">
          <div class="pos-sym">${p.symbol} <span class="badge ${isLong ? 'badge-green' : 'badge-red'}">${p.side} ${p.leverage}x</span></div>
          <div class="badge ${p.beLocked ? 'badge-green' : 'badge-cyan'}">${p.beLocked ? '🛡️ BE KİLİTLİ' : 'TAKİPTE'}</div>
        </div>
        <div class="pos-details">
          <span>Giriş: <b>${p.entryPrice}</b></span>
          <span>Anlık: <b>${p.currentPrice}</b></span>
          <span>Stop: <b>${p.stopPrice.toFixed(4)}</b></span>
          <span>Zirve (MFE): <b style="color:var(--green)">+%${(p.mfe || 0).toFixed(2)}</b></span>
        </div>
        <div class="pos-pnl" style="color: ${isWin ? 'var(--green)' : 'var(--red)'}">
          ${isWin ? '+' : ''}$${(p.pnl || 0).toFixed(2)} (%${(p.roi || 0).toFixed(1)} ROI)
        </div>
      </div>
    `;
  }).join('');
}

function renderHistoryRows(hist) {
  if (!hist || hist.length === 0) {
    return '<tr><td colspan="11" class="empty-state">Henüz tamamlanan test işlemi yok.</td></tr>';
  }
  return hist.slice(0, 50).map(h => {
    const isWin = (h.pnl || 0) >= 0;
    return `
      <tr>
        <td>${h.id}</td>
        <td style="color:var(--text-muted); font-size:11px;">${h.time}</td>
        <td><b>${h.symbol}</b></td>
        <td><span class="badge ${h.side === 'LONG' ? 'badge-green' : 'badge-red'}">${h.side}</span></td>
        <td>${h.entryPrice}</td>
        <td>${h.exitPrice}</td>
        <td>${h.durationMin} dk</td>
        <td style="color:var(--green)">+%${(h.mfe || 0).toFixed(2)}</td>
        <td style="color:${isWin ? 'var(--green)' : 'var(--red)'}; font-weight:600;">${isWin ? '+' : ''}$${(h.pnl || 0).toFixed(2)}</td>
        <td style="color:${isWin ? 'var(--green)' : 'var(--red)'}; font-weight:600;">${isWin ? '+' : ''}%${(h.roi || 0).toFixed(2)}</td>
        <td style="font-size:12px; color:var(--text-muted)">${h.exitReason}</td>
      </tr>
    `;
  }).join('');
}

function renderLogRows(lgs) {
  return lgs.map(l => `
    <div class="log-row">
      <span class="log-time">[${l.time}]</span>
      <span class="log-${l.type}">[${l.type}]</span>
      <span>${l.msg}</span>
    </div>
  `).join('');
}

// HTTP İSTEK YÖNLENDİRİCİSİ
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // CORS başlıkları
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: "online",
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
      timestamp: Date.now()
    }));
    return;
  }

  if (pathname === '/api/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      stats: getStats(),
      positions: activePositions,
      history: history.slice(0, 50),
      logs: logs.slice(0, 50)
    }));
    return;
  }

  if (pathname === '/api/debug-binance') {
    try {
      const t0 = Date.now();
      const res = await fetch("https://fapi.binance.com/fapi/v1/ticker/24hr", {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      const text = await res.text();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: res.status,
        statusText: res.statusText,
        durationMs: Date.now() - t0,
        sample: text.slice(0, 200)
      }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/api/download-csv') {
    if (!fs.existsSync(CSV_FILE)) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end("Henüz CSV kayıt dosyası oluşmadı.");
      return;
    }
    const stat = fs.statSync(CSV_FILE);
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="moonshot_trades_history.csv"',
      'Content-Length': stat.size
    });
    const readStream = fs.createReadStream(CSV_FILE);
    readStream.pipe(res);
    return;
  }

  // Ana Web Paneli
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(serveDashboardHtml());
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end("Not Found");
});

// --- SUNUCU VE DÖNGÜLERİ BAŞLAT ---
initStorage();
server.listen(PORT, () => {
  addLog(`🌐 Web Sunucusu hazır: http://localhost:${PORT}`);
  addLog(`🚀 7/24 Moonshot & Balina Avcısı Test Motoru Başlatıldı!`);
  
  // İlk çalıştırmada radarı hemen güncelle
  updateRadar();

  // Döngüleri başlat
  setInterval(scanLoop, CONFIG.scanIntervalMs);
  setInterval(fastRiskLoop, CONFIG.riskIntervalMs);
  setInterval(updateRadar, CONFIG.radarIntervalMs);
});
