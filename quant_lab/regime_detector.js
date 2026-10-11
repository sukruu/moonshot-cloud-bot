/**
 * 🧠 Market Regime Detector (Piyasa Rejim Dedektörü)
 * Piyasanın mevcut durumunu (Hafta sonu sığlığı, Boğa rallisi, Yatay testere, vb.)
 * tespit eder ve optimal parametre önerilerini üretir.
 */

async function detectMarketRegime() {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0 = Pazar, 6 = Cumartesi
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

  let btcData = { change24h: 0, lastPrice: 0 };
  let marketStats = { topVolCount: 0, avgTopGain: 0 };

  try {
    const urls = [
      'https://fapi.binance.com/fapi/v1/ticker/24hr',
      'https://data-api.binance.vision/api/v3/ticker/24hr'
    ];

    let tickers = null;
    for (const url of urls) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          tickers = await res.json();
          break;
        }
      } catch (e) {}
    }

    if (Array.isArray(tickers)) {
      const btc = tickers.find(t => t.symbol === 'BTCUSDT');
      if (btc) {
        btcData.change24h = parseFloat(btc.priceChangePercent) || 0;
        btcData.lastPrice = parseFloat(btc.lastPrice) || 0;
      }

      const usdtPairs = tickers.filter(t => t.symbol.endsWith('USDT') && !t.symbol.includes('_'));
      const highVolPairs = usdtPairs.filter(t => (parseFloat(t.quoteVolume) / 1e6) >= 15.0);
      marketStats.topVolCount = highVolPairs.length;

      const topGains = usdtPairs
        .map(t => parseFloat(t.priceChangePercent) || 0)
        .sort((a, b) => b - a)
        .slice(0, 10);
      const avgGain = topGains.reduce((a, b) => a + b, 0) / (topGains.length || 1);
      marketStats.avgTopGain = parseFloat(avgGain.toFixed(2));
    }
  } catch (err) {
    // API gecikmesi olursa fallback
  }

  // Rejim Tespiti
  let regime = 'CHOPPY_RANGE';
  let description = 'Yatay / Sakin Piyasa';
  let recommended = {
    vol3hM: 3.5,
    candidateSlice: 30,
    bePct: 0.45,
    tp1Pct: 0.75,
    moonPct: 1.50,
    slPct: 1.25,
    leverage: 20,
    marginPerTrade: 20.0
  };

  if (btcData.change24h <= -3.0) {
    regime = 'BEAR_DUMP_PRESSURE';
    description = 'Ayı Baskısı & Sert Düşüş Eğilimi';
    recommended.vol3hM = 5.0;
    recommended.candidateSlice = 20;
    recommended.bePct = 0.35;
    recommended.tp1Pct = 0.65;
    recommended.moonPct = 1.25;
  } else if (btcData.change24h >= 3.0 && marketStats.avgTopGain >= 12.0) {
    regime = 'AGGRESSIVE_BULL_RALLY';
    description = 'Agresif Boğa Rallisi & Yüksek Momentum';
    recommended.vol3hM = 8.0;
    recommended.candidateSlice = 25;
    recommended.bePct = 0.50;
    recommended.tp1Pct = 1.00;
    recommended.moonPct = 2.20;
  } else if (isWeekend) {
    regime = 'WEEKEND_LOW_LIQUIDITY';
    description = 'Hafta Sonu Düşük Likidite & Sıkışık Hacim';
    recommended.vol3hM = 2.5;
    recommended.candidateSlice = 35;
    recommended.bePct = 0.40;
    recommended.tp1Pct = 0.70;
    recommended.moonPct = 1.40;
  }

  return {
    success: true,
    detectedAt: new Date().toISOString(),
    isWeekend,
    btcData,
    marketStats,
    regime,
    description,
    recommendedConfig: recommended,
    agentAssessment: {
      analyst: `Piyasa rejimi: ${description}. Likiditeye göre hacim eşiği $${recommended.vol3hM}M olarak kalibre edilmeli.`,
      riskManager: `Maksimum slot 4, marjin $20 sabit tutulmalı. Risk sınırı güvende.`
    }
  };
}

if (require.main === module) {
  detectMarketRegime().then(res => console.log(JSON.stringify(res, null, 2)));
}

module.exports = { detectMarketRegime };
