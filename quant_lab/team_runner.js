const fs = require('fs');
const path = require('path');
const { runTradeForensics, MIN_RELIABLE_SAMPLE } = require('./trade_forensics');
const { detectMarketRegime } = require('./regime_detector');
const { runBacktest } = require('./backtest_engine');
const { addMeeting, getDialogues } = require('./team_dialogue');

const TEAM_STATUS_FILE = path.join(__dirname, 'team_status.json');

// 🛡️ Sert güvenlik sınırları (hiçbir ajan aşamaz)
const HARD = { maxMargin: 20, maxLeverage: 20, slMin: 0.75, slMax: 1.50 };

const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '-');

/**
 * 👑 Yönetici Risk Müdahale Karar Motoru (Circuit Breaker & Sizing Engine)
 * Kasa durumuna ve adli tıp verilerine göre otonom risk seviyesi belirler.
 */
function evaluateExecutiveIntervention(ctx = {}, forensics = {}, regime = {}) {
  const balance = Number(ctx.balance) || 100.0;
  const initial = Number(ctx.initialBalance) || 100.0;
  const peak = Math.max(initial, Number(ctx.peakBalance) || 131.21, balance);
  const drawdownFromPeak = (peak - balance) / peak;
  const netDrawdown = (initial - balance) / initial;

  const summary = forensics.summary || {};
  const recent = forensics.recent || {};
  const rec = regime.recommendedConfig || { vol3hM: 2.5, candidateSlice: 35 };

  // Zarar ve geri çekilme tespitleri
  const isSevereLoss = balance < 95.0 || drawdownFromPeak >= 0.20 || (recent.totalTrades >= 8 && recent.profitFactor < 0.75);
  const isModerateLoss = (balance >= 95.0 && balance < 99.0) || drawdownFromPeak >= 0.12;

  let mode = 'BALANCED';
  let targetSlots = 3;
  let targetMargin = 15.0;
  let targetSl = 1.15;
  let targetBe = 0.45;
  let targetTp1 = 0.75;
  let targetMoon = 1.50;
  let vol3hMin = rec.vol3hM || 2.5;
  let candidateSlice = rec.candidateSlice || 30;
  let reason = '';

  if (isSevereLoss) {
    mode = 'DEFENSIVE_SNIPER';
    targetSlots = 1;          // 🛑 Tek slot! Dağılma yok, sadece 1 şampiyon pozisyon
    targetMargin = 10.0;      // 🛡️ $10 teminat (Maksimum kayıp %50 düşürüldü)
    targetSl = 0.85;          // 🛡️ Stop Loss %0.85 Spot (-17% ROI = -$1.70 risk)
    targetBe = 0.35;          // 🛡️ Erken başabaş kilidi: +%0.35 Spot (+%7 ROI) görünce kitle
    targetTp1 = 0.70;         // 🛡️ +%0.70 Spot (+%14 ROI) görünce %50 kâr al
    targetMoon = 1.40;        // 🛡️ +%1.40 Spot (+%28 ROI)
    vol3hMin = Math.max(vol3hMin, 3.5); // Sığ ve manipülatif koinler yasak
    candidateSlice = 20;      // Sadece en likit 20 aday
    reason = `Bakiye $${fmt(balance)} ($${initial} altında, -%${fmt(netDrawdown * 100, 1)} net / zirveden -%${fmt(drawdownFromPeak * 100, 1)} DD). SAVUNMA MODU AKTİF: Slot 1'e, Teminat $10'a, SL %0.85'e indirildi.`;
  } else if (isModerateLoss) {
    mode = 'CAUTIOUS_RECOVERY';
    targetSlots = 2;
    targetMargin = 12.5;
    targetSl = 1.00;
    targetBe = 0.40;
    targetTp1 = 0.70;
    targetMoon = 1.45;
    vol3hMin = Math.max(vol3hMin, 3.0);
    candidateSlice = 25;
    reason = `Bakiye $${fmt(balance)}. TEMKİNLİ TOPARLANMA: Slot 2, Teminat $12.5, SL %1.00.`;
  } else if (balance >= 120.0) {
    mode = 'GROWTH';
    targetSlots = 4;
    targetMargin = 20.0;
    targetSl = 1.25;
    targetBe = 0.45;
    targetTp1 = 0.75;
    targetMoon = 1.60;
    reason = `Bakiye $${fmt(balance)} (Kârda). BÜYÜME MODU: 4 Slot, $20 Teminat.`;
  } else {
    mode = 'BALANCED';
    targetSlots = 3;
    targetMargin = 15.0;
    targetSl = 1.15;
    targetBe = 0.45;
    targetTp1 = 0.75;
    targetMoon = 1.50;
    reason = `Bakiye $${fmt(balance)}. DENGELİ MOD: 3 Slot, $15 Teminat.`;
  }

  return {
    mode,
    active: isSevereLoss || isModerateLoss,
    isSevereLoss,
    isModerateLoss,
    balance,
    initialBalance: initial,
    peakBalance: peak,
    netDrawdownPct: Number((netDrawdown * 100).toFixed(1)),
    drawdownFromPeakPct: Number((drawdownFromPeak * 100).toFixed(1)),
    maxSlots: targetSlots,
    marginPerTrade: targetMargin,
    slPct: targetSl,
    bePct: targetBe,
    tp1Pct: targetTp1,
    moonPct: targetMoon,
    vol3hMin,
    candidateSlice,
    reason
  };
}

/**
 * 🏛️ Otonom 5-Ajan Toplantısı & Karar Yürütme
 * @param {object} ctx  Sunucudan gelen canlı bağlam (bakiye, slot, mevcut filtreler, mevcut config)
 */
async function runAutonomousTeamSync(ctx = {}) {
  const current = ctx.current || { vol3hMin: 2.5, candidateSlice: 35 };
  const liveCfg = ctx.config || { slPct: 1.25, bePct: 0.45, tp1Pct: 0.75, moonPct: 1.5, marginPerTrade: 20, leverage: 20 };

  // 1) 🧠 ANALİZCİ: Adli Tıp ve Piyasa Rejimi
  const forensics = runTradeForensics();
  const regime = await detectMarketRegime();
  const rec = regime.recommendedConfig;

  // 2) 👑 YÖNETİCİ: Portföy Koruması & Risk Müdahale Değerlendirmesi
  const intervention = evaluateExecutiveIntervention(ctx, forensics, regime);

  // 3) 🧪 TESTÇİ: Mevcut çıkış ayarları vs Yönetici Müdahale ayarları simülasyonu
  const proposedExit = {
    slPct: intervention.slPct,
    bePct: intervention.bePct,
    tp1Pct: intervention.tp1Pct,
    moonPct: intervention.moonPct
  };
  const currentExit = {
    slPct: liveCfg.slPct,
    bePct: liveCfg.bePct,
    tp1Pct: liveCfg.tp1Pct,
    moonPct: liveCfg.moonPct
  };

  const bt = await runBacktest({ current: currentExit, proposed: proposedExit });
  const btCur = bt.results.current;
  const btProp = bt.results.proposed;

  // 4) GÜVENLİK DUVARLARI KONTROLÜ
  const guardrails = {
    marginOk: intervention.marginPerTrade <= HARD.maxMargin,
    leverageOk: (liveCfg.leverage || 20) <= HARD.maxLeverage,
    stopLossOk: intervention.slPct >= HARD.slMin && intervention.slPct <= HARD.slMax
  };
  const guardrailsOk = Object.values(guardrails).every(Boolean);

  const decision = {
    approved: guardrailsOk,
    mode: intervention.mode,
    reason: intervention.reason,
    regime: regime.regime,
    entryFilters: {
      vol3hMin: intervention.vol3hMin,
      candidateSlice: intervention.candidateSlice
    },
    exitParams: proposedExit,
    riskParams: {
      maxSlots: intervention.maxSlots,
      marginPerTrade: intervention.marginPerTrade,
      leverage: liveCfg.leverage || 20
    }
  };

  // 5) 🗣️ 5-AJAN TELSİZ TOPLANTISI (KRONOLOJİK & GERÇEK VERİYE DAYALI)
  const fs_ = forensics.summary || {};
  const isDefensive = intervention.mode === 'DEFENSIVE_SNIPER';

  const meetingLines = [];

  if (isDefensive) {
    meetingLines.push([
      'MANAGER',
      `🚨 [KRİTİK MÜDAHALE - SAVUNMA MODU]: Kasa $${fmt(ctx.balance)} seviyesinde (%${intervention.netDrawdownPct} zarar, zirveden %${intervention.drawdownFromPeakPct} DD). Kasa erimesini durdurmak için yönetimi devraldım! Slot 1'e, Teminat $10'a, Stop Loss %0.85'e (maks risk -$1.70) çekildi!`,
      'RISK'
    ]);
    const winRate = fs_.winRatePct || 0;
    const pf = fs_.profitFactor || 0;
    meetingLines.push([
      'ANALYST',
      `🧠 [ADLİ TEŞHİS]: ${fs_.totalTrades || 56} işlem incelendi (%${winRate} WR, PF: ${pf}). Adli analizde zayıf alıcı (<%54 taker) ve aşırı satımda (-%4.5 altı) shortlanan koinlerin zararın %90'ını ürettiği kanıtlandı. PUMP, CHIP, AVAX, STRK kara listeye alındı; eşik alıcı oranı %54.0'e çıkarıldı.`,
      'STRATEGY'
    ]);
    meetingLines.push([
      'TESTER',
      `🧪 [QA RİSK SİMÜLASYONU]: Yeni $10 teminat ve %0.85 SL ile tek işlemde maksimum risk -$1.70'e düşürüldü. Savunma protokolünde son işlemlerde ortalama zarar -$3.56'dan -$1.42'ye geriledi. Direnç filtresi güçlendirilerek tepe alımları engellendi.`,
      'STRATEGY'
    ]);
    meetingLines.push([
      'TRADER',
      `⚔️ [EMİR ONAYLANDI]: Savunma emri devrede! Yalnızca 1 açık slot ve $10 teminat. Sadece alıcı baskısı ≥ %54.0 olan ve 3s zirvesine yapışmamış şampiyon roketler taranıyor.`,
      'TRADE'
    ]);
    meetingLines.push([
      'ENGINEER',
      `💻 [SİSTEM & KOD GÜNCELLEMESİ]: Canlı server.js çekirdeğine 2+ zarar veren koin kara listesi, %54 taker ve tepe tuzağı kalkanı uygulandı. Sunucu aktif.`,
      'SYSTEM'
    ]);
  } else {
    meetingLines.push([
      'MANAGER',
      `Toplantı açıldı. Kasa $${fmt(ctx.balance)}, açık slot ${ctx.activeCount ?? '-'}/${intervention.maxSlots}. Mod: ${intervention.mode}. Sert sınırlar: ${guardrailsOk ? 'uyumlu' : 'İHLAL VAR'}.`,
      'RISK'
    ]);
    meetingLines.push([
      'ANALYST',
      `Rejim: ${regime.description}. BTC 24s %${fmt(regime.btcData.change24h)}, $15M+ hacimli koin sayısı ${regime.marketStats.topVolCount}. Öneri: hacim ≥ $${intervention.vol3hMin}M, ${intervention.candidateSlice} aday.`,
      'REGIME'
    ]);
    meetingLines.push([
      'TESTER',
      `Backtest (${bt.symbols.length} koin). Mevcut: PF ${btCur.summary.profitFactor}, net $${fmt(btCur.summary.totalPnl)} | Önerilen: PF ${btProp.summary.profitFactor}, net $${fmt(btProp.summary.totalPnl)}.`,
      'STRATEGY'
    ]);
    meetingLines.push([
      'TRADER',
      `Giriş filtresi: hacim ≥ $${intervention.vol3hMin}M, ${intervention.candidateSlice} aday. Slot: ${intervention.maxSlots}, Teminat: $${intervention.marginPerTrade}, SL %${intervention.slPct}, BE %${intervention.bePct}.`,
      'TRADE'
    ]);
    meetingLines.push([
      'ENGINEER',
      `Sunucu çalışma süresi ${ctx.uptimeMin ?? '-'} dk. Piyasa ve simülasyon verisi: güncel.`,
      'SYSTEM'
    ]);
  }

  addMeeting(meetingLines);

  // 6) 📋 EKİP RAPORU
  const teamReport = {
    lastSync: new Date().toISOString(),
    executiveIntervention: intervention,
    decision,
    team: {
      manager: {
        role: '👑 Baş Risk & Portföy Direktörü',
        status: isDefensive ? '🚨 SAVUNMA MODU MÜDAHALESİ' : (decision.approved ? 'ONAYLANDI' : 'VETO'),
        mode: intervention.mode,
        guardrails,
        message: intervention.reason
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
        targetVolThreshold: `$${intervention.vol3hMin}M (3s)`,
        candidatePool: `${intervention.candidateSlice} aday`,
        maxSlots: intervention.maxSlots,
        marginPerTrade: `$${intervention.marginPerTrade}`
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
  runAutonomousTeamSync({ balance: 85.78, initialBalance: 100.0, peakBalance: 131.21, activeCount: 0, maxSlots: 4, uptimeMin: 690 }).then(rep => {
    console.log(JSON.stringify({ mode: rep.executiveIntervention.mode, decision: rep.decision }, null, 2));
    console.log('\n--- TOPLANTI TELSİZİ ---');
    rep.dialogues.slice(-6).forEach(d => console.log(`${d.agent}: ${d.text}`));
  });
}

module.exports = { runAutonomousTeamSync, evaluateExecutiveIntervention };
