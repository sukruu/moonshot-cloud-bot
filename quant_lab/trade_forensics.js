const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, '..', 'trades_history.json');

/**
 * 🔬 Trade Forensics (Adli Tıp İşlem Analizi)
 * Son gerçekleşen işlemleri inceler, MFE/MAE oranlarını analiz eder ve istihbarat üretir.
 */
function runTradeForensics() {
  if (!fs.existsSync(HISTORY_FILE)) {
    return {
      success: false,
      message: 'trades_history.json bulunamadı.'
    };
  }

  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    const trades = JSON.parse(raw);

    if (!Array.isArray(trades) || trades.length === 0) {
      return {
        success: true,
        tradesCount: 0,
        message: 'Henüz incelenecek tamamlanmış işlem yok.'
      };
    }

    let wins = 0;
    let losses = 0;
    let beWins = 0;
    let totalPnl = 0;
    let totalRoi = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let totalMfe = 0;
    let totalMae = 0;
    let totalDuration = 0;

    const auditedTrades = trades.map(t => {
      const pnl = Number(t.pnl) || 0;
      const roi = Number(t.roi) || 0;
      const mfe = Number(t.mfe) || 0;
      const mae = Number(t.mae) || 0;
      const dur = Number(t.durationMin) || 0;

      totalPnl += pnl;
      totalRoi += roi;
      totalMfe += mfe;
      totalMae += mae;
      totalDuration += dur;

      if (pnl > 0.05) {
        wins++;
        grossProfit += pnl;
      } else if (pnl < -0.05) {
        losses++;
        grossLoss += Math.abs(pnl);
      } else {
        beWins++;
      }

      // Verimlilik: Zirveye (MFE) ne kadar yakın çıkıldı?
      const efficiency = mfe > 0 ? Math.min(100, Math.round(((roi / 20) / mfe) * 100)) : 100;

      return {
        id: t.id,
        symbol: t.symbol,
        side: t.side,
        pnl: Number(pnl.toFixed(2)),
        roi: Number(roi.toFixed(1)),
        mfePct: Number(mfe.toFixed(2)),
        maePct: Number(mae.toFixed(2)),
        durationMin: dur,
        efficiencyPct: efficiency,
        exitReason: t.exitReason || 'Bilinmiyor'
      };
    });

    const totalTrades = trades.length;
    const winRate = totalTrades > 0 ? Number(((wins / totalTrades) * 100).toFixed(1)) : 0;
    const profitFactor = grossLoss > 0 ? Number((grossProfit / grossLoss).toFixed(2)) : (grossProfit > 0 ? 99.9 : 1.0);
    const avgDurationMin = Math.round(totalDuration / totalTrades);
    const avgMfe = Number((totalMfe / totalTrades).toFixed(2));
    const avgMae = Number((totalMae / totalTrades).toFixed(2));

    return {
      success: true,
      auditedAt: new Date().toISOString(),
      summary: {
        totalTrades,
        wins,
        losses,
        breakevens: beWins,
        winRatePct: winRate,
        profitFactor,
        totalPnl: Number(totalPnl.toFixed(2)),
        totalRoi: Number(totalRoi.toFixed(1)),
        avgDurationMin,
        avgMfePct: avgMfe,
        avgMaePct: avgMae
      },
      insights: [
        winRate >= 80 ? '🟢 Mükemmel giriş isabet oranı (%80+)' : '🟡 Giriş filtreleri sıkılaştırılmalı',
        avgMae <= 0.6 ? '🛡️ Düşük MAE: Pozisyonlar ters yönde çok az yıpranıyor' : '⚠️ Yüksek MAE: Giriş zamanlaması gecikmeli',
        avgMfe >= 1.5 ? '🚀 Güçlü Moonshot potansiyeli yakalanıyor' : '🎯 Hedefler dar vur-kaç için uygun'
      ],
      trades: auditedTrades
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

if (require.main === module) {
  const result = runTradeForensics();
  console.log(JSON.stringify(result, null, 2));
}

module.exports = { runTradeForensics };
