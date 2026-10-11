const fs = require('fs');
const path = require('path');

const HISTORY_FILE = path.join(__dirname, '..', 'trades_history.json');
const MIN_RELIABLE_SAMPLE = 30;

function statsOf(trades) {
  let wins = 0, losses = 0, be = 0, gp = 0, gl = 0, pnl = 0, mfe = 0, mae = 0, dur = 0;
  for (const t of trades) {
    const p = Number(t.pnl) || 0;
    pnl += p;
    mfe += Number(t.mfe) || 0;
    mae += Number(t.mae) || 0;
    dur += Number(t.durationMin) || 0;
    if (p > 0.05) { wins++; gp += p; }
    else if (p < -0.05) { losses++; gl += Math.abs(p); }
    else be++;
  }
  const n = trades.length;
  return {
    totalTrades: n,
    wins, losses, breakevens: be,
    winRatePct: n ? Number((wins / n * 100).toFixed(1)) : 0,
    profitFactor: gl > 0 ? Number((gp / gl).toFixed(2)) : (gp > 0 ? 99 : 0),
    totalPnl: Number(pnl.toFixed(2)),
    avgPnl: n ? Number((pnl / n).toFixed(2)) : 0,
    avgDurationMin: n ? Math.round(dur / n) : 0,
    avgMfePct: n ? Number((mfe / n).toFixed(2)) : 0,
    avgMaePct: n ? Number((mae / n).toFixed(2)) : 0
  };
}

/**
 * 🔬 Trade Forensics: Gerçek işlem geçmişini istatistiksel olarak inceler.
 * Örneklem küçükse bunu AÇIKÇA belirtir (3 işlemle "%100 başarı" yanıltıcıdır).
 */
function runTradeForensics() {
  if (!fs.existsSync(HISTORY_FILE)) {
    return { success: false, message: 'trades_history.json bulunamadı.', summary: statsOf([]), recent: statsOf([]), insights: [] };
  }
  try {
    const trades = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    if (!Array.isArray(trades)) throw new Error('Geçersiz format');

    const summary = statsOf(trades);
    const recent = statsOf(trades.slice(0, 20)); // en yeni 20 işlem (liste yeniden eskiye sıralı)
    const reliable = summary.totalTrades >= MIN_RELIABLE_SAMPLE;

    const insights = [];
    if (!reliable) {
      insights.push(`⚠️ Örneklem küçük (${summary.totalTrades}/${MIN_RELIABLE_SAMPLE}); kazanma oranı henüz istatistiksel olarak anlamlı değil.`);
    }
    if (summary.totalTrades > 0) {
      insights.push(`Ortalama MAE %${summary.avgMaePct}, ortalama MFE %${summary.avgMfePct}.`);
      if (recent.totalTrades >= 10 && recent.profitFactor < 1) {
        insights.push(`🔴 Son ${recent.totalTrades} işlemde kâr faktörü ${recent.profitFactor} (<1): strateji şu an para kaybediyor.`);
      }
    }

    return { success: true, auditedAt: new Date().toISOString(), reliable, summary, recent, insights };
  } catch (err) {
    return { success: false, error: err.message, summary: statsOf([]), recent: statsOf([]), insights: [] };
  }
}

if (require.main === module) {
  console.log(JSON.stringify(runTradeForensics(), null, 2));
}

module.exports = { runTradeForensics, MIN_RELIABLE_SAMPLE };
