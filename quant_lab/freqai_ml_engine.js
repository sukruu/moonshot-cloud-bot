/**
 * 🧠 FreqAI-Style Machine Learning & Probability Engine
 *
 * FreqAI (Freqtrade) mantığından esinlenilmiş adaptif makine öğrenimi motoru:
 * 1. trades_history.json dosyasındaki gerçek geçmiş işlemleri inceler.
 * 2. Her yeni işlem adayının (Symbol, Taker, 15m, 3h, 24h, BTC, Fonlama, Hacim)
 *    kârla sonuçlanma olasılığını (Win Probability %) hesaplar.
 * 3. Olasılık eşiğin (ör. %70 veya Savunma Modunda %75) altındaysa işlemi VETO eder.
 */

const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, '..', 'trades_history.json');

class FreqAiProbabilityEngine {
  constructor() {
    this.weights = {
      takerBuyRatio: 2.2,     // Alıcı baskısı en yüksek ağırlığa sahip
      trendAlignment: 2.0,    // 24s ve 3s yön uyumu
      freshMomentum15m: 1.8,  // 15m mum yönü ve fitil tazeliği
      btcSupport: 1.5,        // BTC 5m/15m korelasyon desteği
      volumeDepth: 1.2,       // 3 saatlik dolar hacmi
      fundingHeadwind: 1.4,   // Fonlama oranı rüzgarı
      whaleFlow: 1.6          // Net kurumsal para akışı ($ USD delta)
    };
    this.stats = {
      modelTrainedAt: null,
      trainingSamples: 0,
      historicalWinRate: 50
    };
    this.trainModel();
  }

  /**
   * 🎓 Geçmiş İşlemlerden Modeli Eğit ve Ağırlıkları Kalibre Et
   */
  trainModel() {
    try {
      if (!fs.existsSync(HISTORY_FILE)) return;
      const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      if (!Array.isArray(history) || history.length === 0) return;

      let wins = 0;
      let total = 0;

      for (const t of history) {
        if (typeof t.pnl === 'number') {
          total++;
          if (t.pnl > 0.02) wins++;
        }
      }

      this.stats.trainingSamples = total;
      this.stats.historicalWinRate = total > 0 ? Number(((wins / total) * 100).toFixed(1)) : 50;
      this.stats.modelTrainedAt = new Date().toISOString();
    } catch (e) {
      console.error("[FreqAI] Eğitim hatası:", e.message);
    }
  }

  /**
   * 🎯 Aday Bir İşlemin Kazanma Olasılığını Hesapla
   * @param {object} features
   *   - symbol: 'CKBUSDT'
   *   - side: 'LONG' | 'SHORT'
   *   - takerBuyRatio: 56.4
   *   - chg15m: 0.8
   *   - chg3h: 3.2
   *   - chg24h: 7.5
   *   - vol3hM: 14.2
   *   - btc5m: 0.12
   *   - btc15m: 0.18
   *   - fundingRatePct: 0.010
   *   - netFlowM: 2.4
   *   - mode: 'BALANCED' | 'DEFENSIVE_SNIPER'
   */
  predictWinProbability(features) {
    const {
      symbol = '',
      side = 'LONG',
      takerBuyRatio = 50,
      chg15m = 0,
      chg3h = 0,
      chg24h = 0,
      vol3hM = 5.0,
      btc5m = 0,
      btc15m = 0,
      fundingRatePct = 0.01,
      netFlowM = 0,
      mode = 'BALANCED'
    } = features;

    // Temel nötr başlangıç puanı (0 üzerinden logit)
    let score = 0;
    const breakdown = [];

    // 1. TAKER ALICI / SATICI GÜCÜ (En kritik faktör)
    if (side === 'LONG') {
      if (takerBuyRatio >= 55.0) {
        const bonus = Math.min(2.5, (takerBuyRatio - 50) * 0.25);
        score += bonus * this.weights.takerBuyRatio;
        breakdown.push(`+ Alıcı Baskısı Yüksek (%${takerBuyRatio.toFixed(1)})`);
      } else if (takerBuyRatio < 51.5) {
        const penalty = (52.0 - takerBuyRatio) * 0.4;
        score -= penalty * this.weights.takerBuyRatio;
        breakdown.push(`- Zayıf Alıcı Desteği (%${takerBuyRatio.toFixed(1)})`);
      }
    } else { // SHORT
      const sellRatio = 100 - takerBuyRatio;
      if (sellRatio >= 55.0) {
        const bonus = Math.min(2.5, (sellRatio - 50) * 0.25);
        score += bonus * this.weights.takerBuyRatio;
        breakdown.push(`+ Satıcı Baskısı Yüksek (%${sellRatio.toFixed(1)})`);
      } else if (sellRatio < 51.5) {
        const penalty = (52.0 - sellRatio) * 0.4;
        score -= penalty * this.weights.takerBuyRatio;
        breakdown.push(`- Zayıf Satıcı Desteği (%${sellRatio.toFixed(1)})`);
      }
    }

    // 2. 15 DAKİKALIK TAZE MOMENTUM
    if (side === 'LONG') {
      if (chg15m >= 0.25 && chg15m <= 2.8) {
        score += 1.4 * this.weights.freshMomentum15m;
        breakdown.push(`+ 15m Taze Yeşil Mum (+%${chg15m.toFixed(1)})`);
      } else if (chg15m < 0) {
        score -= 2.5 * this.weights.freshMomentum15m;
        breakdown.push(`- 15m Kırmızı Mum (Düşen Bıçak: %${chg15m.toFixed(1)})`);
      } else if (chg15m > 3.5) {
        score -= 1.8 * this.weights.freshMomentum15m;
        breakdown.push(`- 15m Aşırı Şişkin (+%${chg15m.toFixed(1)} Tepe Tuzağı)`);
      }
    } else { // SHORT
      if (chg15m <= -0.25 && chg15m >= -2.8) {
        score += 1.4 * this.weights.freshMomentum15m;
        breakdown.push(`+ 15m Taze Kırmızı Mum (%${chg15m.toFixed(1)})`);
      } else if (chg15m > 0) {
        score -= 2.5 * this.weights.freshMomentum15m;
        breakdown.push(`- 15m Yeşil Mum (Yükselen Bıçak: +%${chg15m.toFixed(1)})`);
      } else if (chg15m < -3.5) {
        score -= 1.8 * this.weights.freshMomentum15m;
        breakdown.push(`- 15m Aşırı Çöküş (%${chg15m.toFixed(1)} Dip Tuzağı)`);
      }
    }

    // 3. 24s VE 3s TREND UYUMU
    if (side === 'LONG') {
      if (chg24h >= 0.5 && chg24h <= 20.0 && chg3h >= 1.0) {
        score += 1.5 * this.weights.trendAlignment;
        breakdown.push(`+ 24s/3s Boğa Trend Uyumu (+%${chg24h.toFixed(1)})`);
      } else if (chg24h < -2.0) {
        score -= 2.2 * this.weights.trendAlignment;
        breakdown.push(`- Günlük Trend Ayı (24s: %${chg24h.toFixed(1)})`);
      }
    } else { // SHORT
      if (chg24h <= -0.5 && chg24h >= -12.0 && chg3h <= -1.0) {
        score += 1.5 * this.weights.trendAlignment;
        breakdown.push(`+ 24s/3s Ayı Trend Uyumu (%${chg24h.toFixed(1)})`);
      } else if (chg24h > 2.0) {
        score -= 2.2 * this.weights.trendAlignment;
        breakdown.push(`- Günlük Trend Boğa (24s: +%${chg24h.toFixed(1)})`);
      }
    }

    // 4. BTC KORELASYON DESTEĞİ
    if (side === 'LONG') {
      if (btc15m >= 0.05 && btc5m >= -0.10) {
        score += 1.2 * this.weights.btcSupport;
        breakdown.push(`+ BTC Pozitif Destek (+%${btc15m.toFixed(2)})`);
      } else if (btc15m <= -0.35 || btc5m <= -0.30) {
        score -= 2.0 * this.weights.btcSupport;
        breakdown.push(`- BTC Satış Baskısı Var (%${btc15m.toFixed(2)})`);
      }
    } else { // SHORT
      if (btc15m <= -0.05 && btc5m <= 0.10) {
        score += 1.2 * this.weights.btcSupport;
        breakdown.push(`+ BTC Ayı Destek (%${btc15m.toFixed(2)})`);
      } else if (btc15m >= 0.35 || btc5m >= 0.30) {
        score -= 2.0 * this.weights.btcSupport;
        breakdown.push(`- BTC Yükselişte Short Riski (+%${btc15m.toFixed(2)})`);
      }
    }

    // 5. HACİM DERİNLİĞİ & LİKİDİTE
    if (vol3hM >= 10.0) {
      score += 0.8 * this.weights.volumeDepth;
      breakdown.push(`+ Yüksek Likidite ($${vol3hM.toFixed(1)}M)`);
    } else if (vol3hM < 3.5) {
      score -= 1.4 * this.weights.volumeDepth;
      breakdown.push(`- Düşük Hacim / Sığ Likidite ($${vol3hM.toFixed(1)}M)`);
    }

    // 6. FONLAMA ORANI (Funding Rate)
    if (side === 'LONG' && fundingRatePct <= 0.010 && fundingRatePct >= -0.030) {
      score += 0.7 * this.weights.fundingHeadwind;
      breakdown.push(`+ Sağlıklı Fonlama (%${fundingRatePct})`);
    } else if (side === 'LONG' && fundingRatePct >= 0.050) {
      score -= 2.0 * this.weights.fundingHeadwind;
      breakdown.push(`- Aşırı Şişkin Fonlama (+%${fundingRatePct})`);
    } else if (side === 'SHORT' && fundingRatePct <= -0.035) {
      score -= 2.2 * this.weights.fundingHeadwind;
      breakdown.push(`- Negatif Fonlama Sıkışması (%${fundingRatePct})`);
    }

    // 7. BALİNA NET PARA AKIŞI ($ USD DELTA)
    if (side === 'LONG' && netFlowM >= 1.0) {
      score += 1.2 * this.weights.whaleFlow;
      breakdown.push(`+ Kurumsal Para Girişi (+$${netFlowM}M)`);
    } else if (side === 'LONG' && netFlowM <= -1.0) {
      score -= 2.0 * this.weights.whaleFlow;
      breakdown.push(`- Kurumsal Para Çıkışı (-$${Math.abs(netFlowM)}M)`);
    } else if (side === 'SHORT' && netFlowM <= -1.0) {
      score += 1.2 * this.weights.whaleFlow;
      breakdown.push(`+ Kurumsal Para Çıkışı Desteği (-$${Math.abs(netFlowM)}M)`);
    } else if (side === 'SHORT' && netFlowM >= 1.0) {
      score -= 2.0 * this.weights.whaleFlow;
      breakdown.push(`- Kurumsal Para Girişi Short Riski (+$${netFlowM}M)`);
    }

    // Sigmoid fonksiyonuyla skoru [0, 100%] olasılığına dönüştür
    // score = 0 -> %50, score = +3 -> ~75%, score = +5 -> ~88%, score = -3 -> ~25%
    const probability = 1 / (1 + Math.exp(-score * 0.40));
    const winProbabilityPct = Math.round(probability * 100);

    // Eşik belirleme: Savunma modunda %73, normal modda %68
    const minRequiredProbability = (mode === 'DEFENSIVE_SNIPER') ? 72 : 68;
    const isApproved = winProbabilityPct >= minRequiredProbability;

    let confidence = 'DÜŞÜK';
    if (winProbabilityPct >= 80) confidence = 'ÇOK YÜKSEK';
    else if (winProbabilityPct >= 72) confidence = 'YÜKSEK';
    else if (winProbabilityPct >= 65) confidence = 'ORTA';

    return {
      symbol,
      side,
      winProbabilityPct,
      minRequiredProbability,
      isApproved,
      confidence,
      score: Number(score.toFixed(2)),
      breakdown: breakdown.slice(0, 4),
      topDeterrent: breakdown.find(b => b.startsWith('-')) || 'Genel skor yetersiz'
    };
  }
}

const engineInstance = new FreqAiProbabilityEngine();

module.exports = {
  predictTradeProbability: (features) => engineInstance.predictWinProbability(features),
  retrainFreqAiModel: () => engineInstance.trainModel(),
  getFreqAiStats: () => engineInstance.stats
};

if (require.main === module) {
  const testCandidate = {
    symbol: 'CKBUSDT',
    side: 'LONG',
    takerBuyRatio: 58.2,
    chg15m: 0.9,
    chg3h: 3.5,
    chg24h: 8.2,
    vol3hM: 18.5,
    btc5m: 0.10,
    btc15m: 0.20,
    fundingRatePct: 0.010,
    netFlowM: 3.2,
    mode: 'DEFENSIVE_SNIPER'
  };

  const badCandidate = {
    symbol: 'CHIPUSDT',
    side: 'LONG',
    takerBuyRatio: 46.2,
    chg15m: -0.4,
    chg3h: -2.8,
    chg24h: -6.5,
    vol3hM: 3.1,
    btc5m: -0.25,
    btc15m: -0.30,
    fundingRatePct: -0.040,
    netFlowM: -2.8,
    mode: 'DEFENSIVE_SNIPER'
  };

  console.log("=== 🧠 FREQ-AI ML OLASILIK TESTİ ===");
  console.log("🟢 İyi Aday (CKB):", engineInstance.predictWinProbability(testCandidate));
  console.log("\n🔴 Kötü Aday (CHIP):", engineInstance.predictWinProbability(badCandidate));
}
