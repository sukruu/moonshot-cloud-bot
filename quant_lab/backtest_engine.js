/**
 * 🧪 Backtest & Simulation Engine (Testçi / QA Motoru)
 *
 * Canlı botun ÇIKIŞ mantığını (SL, Başabaş, TP1 %50, iz süren stop, zirveden dönüş kilidi,
 * Moonshot hedefi) birebir taklit eder; gerçek komisyon (%0.10 gidiş-dönüş) düşülür.
 *
 * ⚠️ SINIR: Giriş sinyali canlıdaki radar/taker/BTC filtrelerinin tamamını içermez —
 * 3dk mum momentumu + hacim patlaması ile YAKLAŞIK simüle edilir. Bu yüzden sonuçlar
 * "parametre karşılaştırması" için kullanılır, mutlak kâr tahmini olarak değil.
 */

const BANNED = new Set(['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'EURUSDT']);
const FEE_ROUND_TRIP = 0.0010; // %0.05 giriş + %0.05 çıkış (taker)
const START_BALANCE = 100;

async function fetchJson(paths) {
  for (const url of paths) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) });
      if (res.ok) return await res.json();
    } catch (e) {}
  }
  return null;
}

async function fetchKlines(symbol, interval = '3m', limit = 480) {
  const raw = await fetchJson([
    `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  ]);
  if (!Array.isArray(raw)) return [];
  return raw.map(k => ({
    open: parseFloat(k[1]), high: parseFloat(k[2]), low: parseFloat(k[3]),
    close: parseFloat(k[4]), volume: parseFloat(k[5])
  }));
}

async function pickSymbols(count = 10) {
  const tickers = await fetchJson([
    'https://fapi.binance.com/fapi/v1/ticker/24hr',
    'https://data-api.binance.vision/api/v3/ticker/24hr'
  ]);
  if (!Array.isArray(tickers)) return ['NEARUSDT', 'ADAUSDT', 'TIAUSDT', 'SUIUSDT', 'ENAUSDT', 'SEIUSDT'];
  return tickers
    .filter(t => t.symbol.endsWith('USDT') && !BANNED.has(t.symbol) && parseFloat(t.lastPrice) >= 0.0001)
    .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    .slice(0, count)
    .map(t => t.symbol);
}

// Canlı fastRiskLoop ile aynı kademeler
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

/**
 * Tek koin simülasyonu. Hareketler "lehimize %" olarak hesaplanır (LONG/SHORT simetrik).
 * Mum içi sıra belirsiz olduğu için TEMKİNLİ varsayım: önce aleyhe uç (stop), sonra lehe uç.
 */
function simulateCoin(klines, cfg) {
  const { slPct, bePct, tp1Pct, moonPct, margin, leverage } = cfg;
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
      const volSpike = k.volume >= avgVol * 1.5;
      if (!volSpike || range <= 0) continue;
      const upperWick = (k.high - Math.max(k.open, k.close)) / range;
      const lowerWick = (Math.min(k.open, k.close) - k.low) / range;
      if (move >= 0.60 && upperWick <= 0.35) pos = { side: 'LONG', entry: k.close, mfe: 0, stopMove: -slPct, tp1Taken: false, tp1Pnl: 0 };
      else if (move <= -0.60 && lowerWick <= 0.35) pos = { side: 'SHORT', entry: k.close, mfe: 0, stopMove: -slPct, tp1Taken: false, tp1Pnl: 0 };
      continue;
    }

    const isLong = pos.side === 'LONG';
    const favMove = isLong ? ((k.high - pos.entry) / pos.entry) * 100 : ((pos.entry - k.low) / pos.entry) * 100;
    const advMove = isLong ? ((k.low - pos.entry) / pos.entry) * 100 : ((pos.entry - k.high) / pos.entry) * 100;
    const closeMove = isLong ? ((k.close - pos.entry) / pos.entry) * 100 : ((pos.entry - k.close) / pos.entry) * 100;

    // 1) Temkinli: mevcut stop önce test edilir
    if (advMove <= pos.stopMove) {
      closeTrade(pos.stopMove, pos.stopMove < 0 ? 'STOP_LOSS' : 'LOCKED_STOP');
      continue;
    }

    // 2) Lehe hareket
    pos.mfe = Math.max(pos.mfe, favMove);

    if (!pos.tp1Taken && favMove >= tp1Pct) {
      pos.tp1Taken = true;
      pos.tp1Pnl = nominal * 0.5 * (tp1Pct / 100) - nominal * 0.5 * FEE_ROUND_TRIP;
      pos.stopMove = Math.max(pos.stopMove, 0.20);
    }

    const trail = trailingStopMove(pos.mfe, bePct);
    if (trail !== null) pos.stopMove = Math.max(pos.stopMove, trail);

    if (favMove >= moonPct) {
      closeTrade(moonPct, 'MOON_TP');
      continue;
    }

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

function summarize(trades) {
  const n = trades.length;
  let wins = 0, losses = 0, grossP = 0, grossL = 0, equity = START_BALANCE, peak = START_BALANCE, maxDD = 0;
  for (const t of trades) {
    if (t.pnl > 0.05) { wins++; grossP += t.pnl; }
    else if (t.pnl < -0.05) { losses++; grossL += Math.abs(t.pnl); }
    equity += t.pnl;
    if (equity > peak) peak = equity;
    maxDD = Math.max(maxDD, (peak - equity) / peak * 100);
  }
  const totalPnl = equity - START_BALANCE;
  return {
    totalTrades: n,
    wins,
    losses,
    winRatePct: n ? Number((wins / n * 100).toFixed(1)) : 0,
    profitFactor: grossL > 0 ? Number((grossP / grossL).toFixed(2)) : (grossP > 0 ? 99 : 0),
    totalPnl: Number(totalPnl.toFixed(2)),
    avgPnl: n ? Number((totalPnl / n).toFixed(2)) : 0,
    maxDrawdownPct: Number(maxDD.toFixed(1))
  };
}

const PASS_RULES = { minTrades: 15, minProfitFactor: 1.2, maxDrawdownPct: 15 };

function verdictOf(s) {
  if (s.totalTrades < PASS_RULES.minTrades) return { passed: false, reason: `yetersiz örnek (${s.totalTrades}/${PASS_RULES.minTrades})` };
  if (s.profitFactor < PASS_RULES.minProfitFactor) return { passed: false, reason: `kâr faktörü düşük (${s.profitFactor} < ${PASS_RULES.minProfitFactor})` };
  if (s.maxDrawdownPct > PASS_RULES.maxDrawdownPct) return { passed: false, reason: `drawdown yüksek (%${s.maxDrawdownPct} > %${PASS_RULES.maxDrawdownPct})` };
  return { passed: true, reason: 'tüm kriterler sağlandı' };
}

/**
 * Bir veya birden fazla parametre setini AYNI veri üzerinde test eder.
 * @param {Object<string, Object>} configs  ör. { current: {...}, proposed: {...} }
 */
async function runBacktest(configs) {
  const symbols = await pickSymbols(10);
  const data = [];
  for (const sym of symbols) {
    const kl = await fetchKlines(sym, '3m', 480); // ~24 saat
    if (kl.length > 60) data.push(kl);
  }

  const results = {};
  for (const [name, cfg] of Object.entries(configs)) {
    const full = { margin: 20, leverage: 20, ...cfg };
    const trades = data.flatMap(kl => simulateCoin(kl, full));
    const summary = summarize(trades);
    results[name] = { config: full, summary, verdict: verdictOf(summary) };
  }

  return {
    success: data.length > 0,
    evaluatedAt: new Date().toISOString(),
    symbols,
    barsPerSymbol: 480,
    interval: '3m',
    passRules: PASS_RULES,
    results
  };
}

if (require.main === module) {
  runBacktest({
    current: { slPct: 1.25, bePct: 0.45, tp1Pct: 0.75, moonPct: 1.50 },
    weekend: { slPct: 1.25, bePct: 0.40, tp1Pct: 0.70, moonPct: 1.40 }
  }).then(r => console.log(JSON.stringify(r, null, 2)));
}

module.exports = { runBacktest, PASS_RULES };
