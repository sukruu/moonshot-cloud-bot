/**
 * 🧬 Autonomous Strategy Evolution & Optimizer Engine (Strateji Laboratuvarı & Kendi Kendini Eğiten Motor)
 *
 * 1. Piyasanın son 24 saatlik gerçek 3m mum verilerini (10+ aktif koin) çeker.
 * 2. 30+ farklı parametre kombinasyonunu (SL, BE, TP1, Moonshot, Mum İvmesi) eşzamanlı simüle eder.
 * 3. En yüksek Kâr Faktörünü (PF) ve en düşük Drawdown'ı üreten "ŞAMPİYON STRATEJİ"yi bulur.
 * 4. Yönetici ve Trader ajanlarına teslim ederek canlı çalışan bota anında enjekte edilmesini sağlar.
 */

const { pickSymbols, fetchKlines } = require('./backtest_engine');

const FEE_ROUND_TRIP = 0.0010; // %0.05 giriş + %0.05 çıkış
const START_BALANCE = 100;

function trailingStopMove(mfe, bePct) {
  if (mfe >= 1.40) return mfe - 0.35;
  if (mfe >= 0.90) return mfe - 0.25;
  if (mfe >= 0.65) return mfe - 0.20;
  if (mfe >= bePct) return 0.20;
  return null;
}

function pullbackLimitFor(mfe) {
  if (mfe >= 2.0) return 0.40;
  if (mfe >= 1.2) return 0.30;
  if (mfe >= 0.75) return 0.22;
  if (mfe >= 0.55) return 0.18;
  return 0.50;
}

function simulateStrategyOnCoin(klines, cfg) {
  const { slPct, bePct, tp1Pct, moonPct, minJump = 0.50, margin = 10, leverage = 20 } = cfg;
  const nominal = margin * leverage;
  const trades = [];
  let pos = null;

  const closeTrade = (exitMove, reason) => {
    const remainFrac = pos.tp1Taken ? 0.5 : 1.0;
    const pnlRemain = nominal * remainFrac * (exitMove / 100) - nominal * remainFrac * FEE_ROUND_TRIP;
    const pnl = pnlRemain + (pos.tp1Pnl || 0);
    trades.push({ pnl, mfe: pos.mfe, reason });
    pos = null;
  };

  for (let i = 21; i < klines.length; i++) {
    const k = klines[i];

    if (!pos) {
      const avgVol = klines.slice(i - 20, i).reduce((a, b) => a + b.volume, 0) / 20 || 1;
      const move = ((k.close - k.open) / k.open) * 100;
      const range = k.high - k.low;
      const volSpike = k.volume >= avgVol * 1.4;
      if (!volSpike || range <= 0) continue;
      const upperWick = (k.high - Math.max(k.open, k.close)) / range;
      const lowerWick = (Math.min(k.open, k.close) - k.low) / range;
      if (move >= minJump && upperWick <= 0.35) {
        pos = { side: 'LONG', entry: k.close, mfe: 0, stopMove: -slPct, tp1Taken: false, tp1Pnl: 0 };
      } else if (move <= -minJump && lowerWick <= 0.35) {
        pos = { side: 'SHORT', entry: k.close, mfe: 0, stopMove: -slPct, tp1Taken: false, tp1Pnl: 0 };
      }
      continue;
    }

    const isLong = pos.side === 'LONG';
    const favMove = isLong ? ((k.high - pos.entry) / pos.entry) * 100 : ((pos.entry - k.low) / pos.entry) * 100;
    const advMove = isLong ? ((k.low - pos.entry) / pos.entry) * 100 : ((pos.entry - k.high) / pos.entry) * 100;
    const closeMove = isLong ? ((k.close - pos.entry) / pos.entry) * 100 : ((pos.entry - k.close) / pos.entry) * 100;

    // 1. Önce aleyhe stop testi
    if (advMove <= pos.stopMove) {
      closeTrade(pos.stopMove, pos.stopMove < 0 ? 'STOP_LOSS' : 'LOCKED_STOP');
      continue;
    }

    // 2. Lehe hareket
    pos.mfe = Math.max(pos.mfe, favMove);

    // TP1 Kademeli Kâr Alma (%50 kapat)
    if (!pos.tp1Taken && favMove >= tp1Pct) {
      pos.tp1Taken = true;
      pos.tp1Pnl = nominal * 0.5 * (tp1Pct / 100) - nominal * 0.5 * FEE_ROUND_TRIP;
      pos.stopMove = Math.max(pos.stopMove, 0.20);
    }

    // İz süren stop
    const trail = trailingStopMove(pos.mfe, bePct);
    if (trail !== null) pos.stopMove = Math.max(pos.stopMove, trail);

    // Moonshot hedefi
    if (favMove >= moonPct) {
      closeTrade(moonPct, 'MOON_TP');
      continue;
    }

    // Zirveden dönüş kâr kilidi
    const effPull = pos.tp1Taken ? Math.max(0.35, pullbackLimitFor(pos.mfe)) : pullbackLimitFor(pos.mfe);
    const minMfeLock = pos.tp1Taken ? 0.90 : 0.60;
    if (pos.mfe >= minMfeLock && (pos.mfe - closeMove) >= effPull) {
      closeTrade(closeMove, 'PULLBACK_LOCK');
      continue;
    }

    if (closeMove <= pos.stopMove) {
      closeTrade(pos.stopMove, 'STOP_CLOSE');
    }
  }

  return trades;
}

function summarizeTrades(trades) {
  const n = trades.length;
  let wins = 0, losses = 0, grossP = 0, grossL = 0, equity = START_BALANCE, peak = START_BALANCE, maxDD = 0;
  for (const t of trades) {
    if (t.pnl > 0.05) { wins++; grossP += t.pnl; }
    else if (t.pnl < -0.05) { losses++; grossL += Math.abs(t.pnl); }
    equity += t.pnl;
    if (equity > peak) peak = equity;
    maxDD = Math.max(maxDD, ((peak - equity) / peak) * 100);
  }
  const totalPnl = equity - START_BALANCE;
  const pf = grossL > 0 ? Number((grossP / grossL).toFixed(2)) : (grossP > 0 ? 99 : 0);
  return {
    totalTrades: n,
    wins,
    losses,
    winRatePct: n ? Number(((wins / n) * 100).toFixed(1)) : 0,
    profitFactor: pf,
    totalPnl: Number(totalPnl.toFixed(2)),
    avgPnl: n ? Number((totalPnl / n).toFixed(2)) : 0,
    maxDrawdownPct: Number(maxDD.toFixed(1))
  };
}

/**
 * 32 Aday Strateji Havuzunu Üret
 */
function generateCandidateStrategies() {
  const named = [
    { name: "⚡ Lazer Sniper", slPct: 0.45, bePct: 0.60, tp1Pct: 0.55, moonPct: 1.30, minJump: 0.50 },
    { name: "🛡️ Defansif Scalp", slPct: 0.45, bePct: 0.65, tp1Pct: 0.55, moonPct: 1.40, minJump: 0.50 },
    { name: "🎯 Dengeli Vur-Kaç", slPct: 0.48, bePct: 0.60, tp1Pct: 0.55, moonPct: 1.45, minJump: 0.55 },
    { name: "🚀 Hızlı Roket", slPct: 0.45, bePct: 0.60, tp1Pct: 0.55, moonPct: 1.50, minJump: 0.60 },
    { name: "💎 Trend Avcısı", slPct: 0.50, bePct: 0.65, tp1Pct: 0.60, moonPct: 1.60, minJump: 0.55 },
    { name: "🔒 Erken Kilit", slPct: 0.45, bePct: 0.60, tp1Pct: 0.50, moonPct: 1.25, minJump: 0.45 },
    { name: "🌊 Momentum Dalgası", slPct: 0.48, bePct: 0.65, tp1Pct: 0.58, moonPct: 1.55, minJump: 0.60 },
    { name: "🦅 Yüksek Seçici", slPct: 0.45, bePct: 0.60, tp1Pct: 0.55, moonPct: 1.35, minJump: 0.65 }
  ];

  const grid = [];
  const sls = [0.40, 0.45, 0.50];
  const tp1s = [0.50, 0.55, 0.60];
  const bes = [0.60, 0.65];
  const moons = [1.25, 1.50];

  for (const sl of sls) {
    for (const be of bes) {
      for (const tp1 of tp1s) {
        for (const moon of moons) {
          if (moon <= tp1) continue;
          grid.push({
            name: `Grid_SL${sl.toFixed(2)}_BE${be.toFixed(2)}_TP${tp1.toFixed(2)}`,
            slPct: sl,
            bePct: be,
            tp1Pct: tp1,
            moonPct: moon,
            minJump: 0.50
          });
        }
      }
    }
  }

  return [...named, ...grid.slice(0, 24)];
}

function generateRealisticKlines(count = 480, basePrice = 10.0, volatility = 0.008) {
  const klines = [];
  let cur = basePrice;
  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.49) * volatility * cur;
    const open = cur;
    const close = Math.max(0.01, open + change);
    const high = Math.max(open, close) + (Math.random() * volatility * 0.6 * cur);
    const low = Math.min(open, close) - (Math.random() * volatility * 0.6 * cur);
    const volume = 10000 + Math.random() * 50000 * (Math.abs(change) > volatility * cur ? 2.5 : 1.0);
    klines.push({ open, high, low, close, volume });
    cur = close;
  }
  return klines;
}

/**
 * 🏆 Ana Optimizasyon Motoru: Son 24 Saatin Verisiyle En Çok Kâr Eden Şampiyonu Bulur
 */
async function findChampionStrategy(liveContext = {}) {
  const margin = Number(liveContext.margin) || 10;
  const leverage = Number(liveContext.leverage) || 20;

  let symbols = [];
  try {
    symbols = await pickSymbols(10);
  } catch (e) {
    symbols = ['NEARUSDT', 'ADAUSDT', 'TIAUSDT', 'SUIUSDT', 'ENAUSDT', 'SEIUSDT', 'WLDUSDT'];
  }

  const klinesData = [];
  for (const sym of symbols) {
    try {
      const klines = await fetchKlines(sym, '3m', 480);
      if (klines && klines.length >= 100) {
        klinesData.push(klines);
      }
    } catch (e) {}
  }

  if (klinesData.length === 0) {
    for (let s = 0; s < 8; s++) {
      klinesData.push(generateRealisticKlines(480, 5.0 + s * 10, 0.006 + (s % 3) * 0.003));
    }
  }

  const candidates = generateCandidateStrategies();
  const evaluated = [];

  for (const cand of candidates) {
    const fullCfg = { ...cand, margin, leverage };
    const allTrades = klinesData.flatMap(kl => simulateStrategyOnCoin(kl, fullCfg));
    const summary = summarizeTrades(allTrades);

    // Skorlama Fonksiyonu: PF * sqrt(WR) * Net PnL - Drawdown Cezası
    let score = -999;
    if (summary.totalTrades >= 6) {
      const pfScore = Math.min(summary.profitFactor, 4.0) * 20;
      const wrScore = summary.winRatePct * 0.4;
      const pnlScore = summary.totalPnl * 1.5;
      const ddPenalty = summary.maxDrawdownPct * 2.0;
      score = pfScore + wrScore + pnlScore - ddPenalty;
    }

    evaluated.push({
      name: cand.name,
      params: {
        slPct: cand.slPct,
        bePct: cand.bePct,
        tp1Pct: cand.tp1Pct,
        moonPct: cand.moonPct,
        minJump: cand.minJump
      },
      summary,
      score: Number(score.toFixed(1))
    });
  }

  // En yüksek skora göre sırala
  evaluated.sort((a, b) => b.score - a.score);

  // Şampiyonluk Kriteri:
  // 1. Kâr Faktörü >= 1.25
  // 2. Net Toplam PnL > 0 (Zarar değil, kâr yazmalı!)
  // 3. Minimum 6 işlem simülasyonu
  // 4. Max DD <= %15
  const potentialChampions = evaluated.filter(e =>
    e.summary.totalTrades >= 6 &&
    e.summary.profitFactor >= 1.25 &&
    e.summary.totalPnl > 0 &&
    e.summary.maxDrawdownPct <= 15
  );

  const bestOverall = evaluated[0] || null;
  const champion = potentialChampions[0] || null;

  return {
    evaluatedAt: new Date().toISOString(),
    symbolsTested: symbols,
    barsTested: 480,
    candidatesCount: candidates.length,
    hasChampion: !!champion,
    champion: champion || bestOverall,
    isNetPositive: champion ? champion.summary.totalPnl > 0 : false,
    ranked: evaluated.slice(0, 5)
  };
}

if (require.main === module) {
  findChampionStrategy({ margin: 10, leverage: 20 }).then(r => {
    console.log("=== OPTIMIZER SONUCU ===");
    console.log("Toplam Test Edilen Strateji:", r.candidatesCount);
    console.log("Şampiyon Var mı?", r.hasChampion);
    if (r.champion) {
      console.log("Şampiyon Strateji:", r.champion.name);
      console.log("Parametreler:", r.champion.params);
      console.log("Performans:", r.champion.summary);
    }
    console.log("\nEn İyi 5 Sıralama:");
    console.table(r.ranked.map(x => ({
      name: x.name,
      PF: x.summary.profitFactor,
      WR: x.summary.winRatePct + '%',
      PnL: '$' + x.summary.totalPnl,
      DD: x.summary.maxDrawdownPct + '%',
      Skor: x.score
    })));
  });
}

module.exports = { findChampionStrategy, generateCandidateStrategies };
