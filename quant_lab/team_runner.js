const fs = require('fs');
const path = require('path');
const { runTradeForensics, MIN_RELIABLE_SAMPLE } = require('./trade_forensics');
const { detectMarketRegime } = require('./regime_detector');
const { runBacktest } = require('./backtest_engine');
const { addMeeting, getDialogues } = require('./team_dialogue');

const TEAM_STATUS_FILE = path.join(__dirname, 'team_status.json');

// ⚙️ Çıkış parametrelerini (SL/BE/TP1/Moon) ekip OTOMATİK değiştirsin mi?
// Varsayılan KAPALI: Backtest girişleri yaklaşık simüle ettiği için TP/SL değişikliği
// önce öneri olarak raporlanır. Açmak için ortam değişkeni: AUTO_EXIT_PARAMS=1
const AUTO_EXIT_PARAMS = process.env.AUTO_EXIT_PARAMS === '1';

// 🛡️ Sert güvenlik duvarları (hiçbir ajan aşamaz)
const HARD = { maxMargin: 20, maxLeverage: 20, slMin: 0.8, slMax: 1.5 };

const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '-');

/**
 * 🏛️ Otonom 5-Ajan Toplantısı
 * @param {object} ctx  Sunucudan gelen canlı bağlam (bakiye, slot, mevcut filtreler, mevcut config)
 */
async function runAutonomousTeamSync(ctx = {}) {
  const current = ctx.current || { vol3hMin: 2.5, candidateSlice: 35 };
  const liveCfg = ctx.config || { slPct: 1.25, bePct: 0.45, tp1Pct: 0.75, moonPct: 1.5, marginPerTrade: 20, leverage: 20 };

  // 1) 🧠 ANALİZCİ
  const forensics = runTradeForensics();
  const regime = await detectMarketRegime();
  const rec = regime.recommendedConfig;

  // 2) 🧪 TESTÇİ: mevcut çıkış ayarları vs rejimin önerdiği ayarlar, AYNI veride
  const proposedExit = { slPct: rec.slPct, bePct: rec.bePct, tp1Pct: rec.tp1Pct, moonPct: rec.moonPct };
  const currentExit = { slPct: liveCfg.slPct, bePct: liveCfg.bePct, tp1Pct: liveCfg.tp1Pct, moonPct: liveCfg.moonPct };
  const bt = await runBacktest({ current: currentExit, proposed: proposedExit });
  const btCur = bt.results.current;
  const btProp = bt.results.proposed;

  // 3) 👑 YÖNETİCİ: sert kurallar + performans tabanlı veto
  const guardrails = {
    marginOk: liveCfg.marginPerTrade <= HARD.maxMargin,
    leverageOk: liveCfg.leverage <= HARD.maxLeverage,
    stopLossOk: liveCfg.slPct >= HARD.slMin && liveCfg.slPct <= HARD.slMax
  };
  const guardrailsOk = Object.values(guardrails).every(Boolean);

  const proposal = { vol3hMin: rec.vol3hM, candidateSlice: rec.candidateSlice };
  const isLoosening = proposal.vol3hMin < current.vol3hMin || proposal.candidateSlice > current.candidateSlice;
  const recent = forensics.recent || { totalTrades: 0, profitFactor: 0 };
  const recentLosing = recent.totalTrades >= 10 && recent.profitFactor < 1;

  let decision;
  if (!guardrailsOk) {
    decision = { approved: false, reason: 'canlı ayarlar sert güvenlik sınırlarının dışında', regime: regime.regime };
  } else if (isLoosening && recentLosing) {
    decision = { approved: false, reason: `son ${recent.totalTrades} işlemde PF ${recent.profitFactor} — filtre gevşetme reddedildi`, regime: regime.regime };
  } else {
    decision = { approved: true, reason: 'rejime uygun filtreler onaylandı', regime: regime.regime, entryFilters: proposal };
  }

  // Çıkış parametreleri: yalnızca öneri testi geçer VE mevcuttan açıkça iyiyse
  const exitBetter = btProp.verdict.passed &&
    btProp.summary.profitFactor > btCur.summary.profitFactor * 1.10 &&
    btProp.summary.totalPnl > btCur.summary.totalPnl;
  const exitSafe = proposedExit.slPct >= HARD.slMin && proposedExit.slPct <= HARD.slMax;
  const exitChanged = JSON.stringify(proposedExit) !== JSON.stringify(currentExit);
  let exitRecommendation = 'mevcut ayarlar korunuyor';
  if (exitChanged && exitBetter && exitSafe) {
    if (AUTO_EXIT_PARAMS && decision.approved) {
      decision.exitParams = proposedExit;
      exitRecommendation = 'önerilen çıkış ayarları OTOMATİK uygulanıyor';
    } else {
      exitRecommendation = 'önerilen çıkış ayarları daha iyi görünüyor — otomatik uygulama kapalı, öneri olarak kaydedildi';
    }
  }

  // 4) 🗣️ TOPLANTI KAYDI (tamamen gerçek veriden)
  const fs_ = forensics.summary || {};
  const changeTxt = decision.approved
    ? ((proposal.vol3hMin !== current.vol3hMin || proposal.candidateSlice !== current.candidateSlice)
        ? `Hacim eşiği $${current.vol3hMin}M → $${proposal.vol3hMin}M, aday ${current.candidateSlice} → ${proposal.candidateSlice}.`
        : `Filtreler zaten uygun ($${current.vol3hMin}M / ${current.candidateSlice} aday), değişiklik yok.`)
    : `Değişiklik REDDEDİLDİ: ${decision.reason}.`;

  addMeeting([
    ['MANAGER', `Toplantı açıldı. Kasa $${fmt(ctx.balance)}, açık slot ${ctx.activeCount ?? '-'}/${ctx.maxSlots ?? '-'}. Sert sınırlar: ${guardrailsOk ? 'uyumlu' : 'İHLAL VAR'}.`, 'RISK'],
    ['ANALYST', `Rejim: ${regime.description}. BTC 24s %${fmt(regime.btcData.change24h)}, $15M+ hacimli koin sayısı ${regime.marketStats.topVolCount}. Öneri: hacim ≥ $${proposal.vol3hMin}M, ${proposal.candidateSlice} aday.`, 'REGIME'],
    ['ANALYST', `Canlı geçmiş: ${fs_.totalTrades || 0} işlem, kazanma %${fs_.winRatePct || 0}, PF ${fs_.profitFactor || 0}, net $${fmt(fs_.totalPnl)}.${forensics.reliable ? '' : ` Örneklem ${MIN_RELIABLE_SAMPLE} işlemin altında, sonuç güvenilir değil.`}`, 'STRATEGY'],
    ['TESTER', `Backtest (${bt.symbols.length} koin, 3dk×480 mum). Mevcut ayar: ${btCur.summary.totalTrades} işlem, kazanma %${btCur.summary.winRatePct}, PF ${btCur.summary.profitFactor}, net $${fmt(btCur.summary.totalPnl)}, DD %${btCur.summary.maxDrawdownPct} → ${btCur.verdict.passed ? 'GEÇTİ' : 'KALDI (' + btCur.verdict.reason + ')'}.`, 'STRATEGY'],
    ['TESTER', `Önerilen çıkış ayarı (BE ${proposedExit.bePct} / TP1 ${proposedExit.tp1Pct} / Moon ${proposedExit.moonPct}): PF ${btProp.summary.profitFactor}, net $${fmt(btProp.summary.totalPnl)} → ${btProp.verdict.passed ? 'GEÇTİ' : 'KALDI (' + btProp.verdict.reason + ')'}.`, 'STRATEGY'],
    ['MANAGER', `${changeTxt} Çıkış ayarları: ${exitRecommendation}.`, 'RISK'],
    ['TRADER', `Uygulanacak giriş filtresi: hacim ≥ $${decision.approved ? proposal.vol3hMin : current.vol3hMin}M, ${decision.approved ? proposal.candidateSlice : current.candidateSlice} aday. SL %${liveCfg.slPct}, BE %${liveCfg.bePct}, TP1 %${liveCfg.tp1Pct}, Moon %${liveCfg.moonPct}.`, 'TRADE'],
    ['ENGINEER', `Sunucu çalışma süresi ${ctx.uptimeMin ?? '-'} dk. Piyasa verisi: ${regime.btcData.lastPrice > 0 ? 'alındı' : 'ALINAMADI'}, backtest verisi: ${bt.success ? 'alındı' : 'ALINAMADI'}.`, 'SYSTEM']
  ]);

  // 5) 📋 RAPOR
  const teamReport = {
    lastSync: new Date().toISOString(),
    decision,
    exitRecommendation,
    autoExitParams: AUTO_EXIT_PARAMS,
    team: {
      manager: {
        role: '👑 Baş Risk & Portföy Direktörü',
        status: decision.approved ? 'ONAYLANDI' : 'VETO',
        guardrails,
        message: decision.reason
      },
      analyst: {
        role: '🧠 Piyasa İstihbaratı',
        regime: regime.regime,
        description: regime.description,
        isWeekend: regime.isWeekend,
        btcTrend: `24s: %${fmt(regime.btcData.change24h)}`,
        insight: (forensics.insights && forensics.insights[0]) || '-'
      },
      trader: {
        role: '⚔️ Sinyal & Yürütme',
        targetVolThreshold: `$${decision.approved ? proposal.vol3hMin : current.vol3hMin}M (3s)`,
        candidatePool: `${decision.approved ? proposal.candidateSlice : current.candidateSlice} aday`
      },
      tester: {
        role: '🧪 QA & Simülatör',
        lastTestWinRate: `%${btCur.summary.winRatePct} BT / PF ${btCur.summary.profitFactor}`,
        backtest: { current: btCur, proposed: btProp, symbols: bt.symbols }
      },
      engineer: {
        role: '💻 DevOps & Sistem',
        uptimeMin: ctx.uptimeMin ?? null,
        dataOk: regime.btcData.lastPrice > 0 && bt.success
      }
    },
    forensics,
    recommendedConfig: rec,
    dialogues: getDialogues()
  };

  try {
    fs.writeFileSync(TEAM_STATUS_FILE, JSON.stringify(teamReport, null, 2), 'utf8');
  } catch (err) {}

  return teamReport;
}

if (require.main === module) {
  runAutonomousTeamSync({ balance: 131.21, activeCount: 0, maxSlots: 4, uptimeMin: 0 }).then(rep => {
    console.log(JSON.stringify({ decision: rep.decision, exitRecommendation: rep.exitRecommendation }, null, 2));
    console.log('\n--- TOPLANTI ---');
    rep.dialogues.slice(-8).forEach(d => console.log(`${d.agent}: ${d.text}`));
  });
}

module.exports = { runAutonomousTeamSync };
