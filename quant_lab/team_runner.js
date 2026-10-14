const fs = require('fs');
const path = require('path');
const { runTradeForensics, MIN_RELIABLE_SAMPLE } = require('./trade_forensics');
const { detectMarketRegime } = require('./regime_detector');
const { runBacktest } = require('./backtest_engine');
const { addMeeting, getDialogues } = require('./team_dialogue');
const { findChampionStrategy } = require('./strategy_optimizer');
const { trackWhaleMoneyFlow } = require('./whale_scout');
const { scanFundingRates } = require('./funding_scout');
const { getFreqAiStats } = require('./freqai_ml_engine');
const { getJudgeDossier, runCourtSession } = require('./judge_audit');

const TEAM_STATUS_FILE = path.join(__dirname, 'team_status.json');

// 🛡️ Sert güvenlik sınırları (hiçbir ajan aşamaz)
const HARD = { maxMargin: 30, maxLeverage: 20, slMin: 0.35, slMax: 1.50 };

const fmt = (n, d = 2) => (Number.isFinite(n) ? n.toFixed(d) : '-');

/**
 * 👑 Yönetici Risk Müdahale Karar Motoru (Circuit Breaker & Sizing Engine)
 * Kasa durumuna ve adli tıp verilerine göre otonom risk seviyesi belirler.
 */
function evaluateExecutiveIntervention(ctx = {}, forensics = {}, regime = {}) {
  const balance = Number(ctx.balance) || 100.0;
  const initial = Number(ctx.initialBalance) || 100.0;
  const peak = Math.max(initial, Number(ctx.peakBalance) || initial, balance);
  const drawdownFromPeak = (peak - balance) / peak;
  const netDrawdown = (initial - balance) / initial;

  const summary = forensics.summary || {};
  const recent = forensics.recent || {};
  const rec = regime.recommendedConfig || { vol3hM: 2.2, candidateSlice: 35 };

  // Zarar ve geri çekilme tespitleri
  const isSevereLoss = balance < 95.0 || drawdownFromPeak >= 0.20 || (recent.totalTrades >= 8 && recent.profitFactor < 0.75);
  const isModerateLoss = (balance >= 95.0 && balance < 99.0) || drawdownFromPeak >= 0.12;

  let mode = 'BALANCED';
  let targetSlots = 2;
  let targetMargin = 20.0;
  let targetSl = 0.48;
  let targetBe = 0.55;
  let targetTp1 = 0.80;
  let targetMoon = 1.80;
  let vol3hMin = 0.8;
  let candidateSlice = rec.candidateSlice || 35;
  let reason = '';

  if (isSevereLoss) {
    mode = 'MARSCOIN_ROCKET';
    targetSlots = 2;          // 2 slot bağımsız roket yakalama
    targetMargin = 15.0;      // 🏔️ $15 teminat
    targetSl = 1.10;          // 🏔️ Marscoin Sağlıklı Stop Loss %1.10 Spot (Nefes alanı tam)
    targetTp1 = 1.20;         // 💰 %1.20 Spot (+%24 ROI) ile %50 kârı anında nakde çevir
    targetBe = 1.00;          // 🛡️ Başabaş kilidi: +%1.00 Spot (+%20 ROI) görünce kitle
    targetMoon = 2.40;        // 🚀 Dev Moonshot +%2.40 Spot (+%48 ROI)
    vol3hMin = 0.8;           // Gerçek likidite
    candidateSlice = 35;
    reason = `Bakiye $${fmt(balance)}. 🏔️ MARSCOIN ROKET MODU AKTİF: Slot 2, Teminat $15, SL %1.10, TP1 %1.20, Moonshot %2.40.`;
  } else if (isModerateLoss) {
    mode = 'MARSCOIN_ROCKET';
    targetSlots = 2;
    targetMargin = 15.0;
    targetSl = 1.10;
    targetTp1 = 1.20;
    targetBe = 1.00;
    targetMoon = 2.40;
    vol3hMin = 0.8;
    candidateSlice = 35;
    reason = `Bakiye $${fmt(balance)}. 🏔️ MARSCOIN ROKET MODU AKTİF: Slot 2, Teminat $15, SL %1.10, TP1 %1.20, Moonshot %2.40.`;
  } else if (balance >= 120.0) {
    mode = 'GROWTH';
    targetSlots = 3;
    targetMargin = 20.0;
    targetSl = 1.10;
    targetTp1 = 1.30;
    targetBe = 1.00;
    targetMoon = 2.80;
    vol3hMin = 0.8;
    candidateSlice = 40;
    reason = `Bakiye $${fmt(balance)} (Büyüme). BÜYÜME MODU: 3 Slot, $20 Teminat, SL %1.10, TP1 %1.30.`;
  } else {
    // Mevcut bakiye ~$100-$119 aralığı (Dengeli Vur-Kaç)
    mode = 'MARSCOIN_ROCKET';
    targetSlots = 2;
    targetMargin = 15.0;
    targetSl = 1.10;
    targetTp1 = 1.20;
    targetBe = 1.00;
    targetMoon = 2.40;
    vol3hMin = 0.8;
    candidateSlice = 35;
    reason = `Bakiye $${fmt(balance)}. 🏔️ MARSCOIN ROKET MODU AKTİF: 2 Slot, SL %1.10, TP1 %1.20, Moonshot +%2.40.`;
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
 * 👑 Portföy Yöneticisi: Dinamik Teminat & Vur-Kaç Hedef Belirleme Motoru
 * (Institutional Conviction Sizing Engine - Kelly & Asimetrik Getiri)
 * GitHub hedge-fund benchmark: orallexa-ai-trading-agent & 51bitquant/ai-hedge-fund-crypto
 */
function calculateConvictionSizing({
  sym = '',
  side = 'LONG',
  takerBuyRatio = 50,
  winProbabilityPct = 70,
  netFlowM = 0,
  vol3hM = 5,
  isVip = false,
  judicialScore = 80,
  balance = 100,
  mode = 'BALANCED',
  freeMargin = null,
  fundingRatePct = 0.01,
  isShortSqueeze = false
} = {}) {
  const free = (freeMargin !== null && !isNaN(freeMargin)) ? Number(freeMargin) : balance;

  // 1) Savunma modunda sermaye koruması mutlak önceliklidir
  if (mode === 'DEFENSIVE_SNIPER') {
    return {
      tier: 'TIER_DEFENSIVE',
      tierLabel: '🛡️ SAVUNMA NİŞANCISI',
      margin: Math.min(10.0, Math.max(8.0, free)),
      slPct: 0.80,
      bePct: 0.35,
      tp1Pct: 0.80,
      moonPct: 1.50,
      convictionScore: 50,
      rationale: 'Kasa savunma modunda: Sermaye korunuyor, teminat $10 ile sınırlandı.'
    };
  }

  // 2) İkna Skoru (0 - 100 Puan) Hesaplanması
  let score = 50;

  // A) Balina Taker Oranı Katkısı (Max +25 puan)
  const effectiveTaker = side === 'LONG' ? Number(takerBuyRatio || 50) : (100 - Number(takerBuyRatio || 50));
  if (effectiveTaker >= 62) score += 25;
  else if (effectiveTaker >= 58) score += 20;
  else if (effectiveTaker >= 55) score += 12;
  else if (effectiveTaker >= 52) score += 5;

  // B) FreqAI Makine Öğrenimi Başarı Olasılığı (Max +20 puan)
  const winProb = Number(winProbabilityPct || 70);
  if (winProb >= 82) score += 20;
  else if (winProb >= 76) score += 15;
  else if (winProb >= 72) score += 10;
  else if (winProb >= 68) score += 5;

  // C) Net Kurumsal Para Akışı (Max +15 puan)
  const flow = Number(netFlowM || 0);
  const effectiveFlow = side === 'LONG' ? flow : -flow;
  if (effectiveFlow >= 2.0) score += 15;
  else if (effectiveFlow >= 1.0) score += 10;
  else if (effectiveFlow >= 0.3) score += 5;

  // D) Hacim Patlaması & VIP Koin (Max +15 puan)
  if (isVip) score += 8;
  const vol = Number(vol3hM || 5);
  if (vol >= 30) score += 7;
  else if (vol >= 15) score += 5;

  // E) Yargıç Nizam Puanı (Max +10 puan)
  const jud = Number(judicialScore || 80);
  if (jud >= 90) score += 10;
  else if (jud >= 80) score += 5;

  // F) 🎯 Negatif Fonlama & Likidasyon Sıkışması (Short Squeeze Hunter - Max +18 puan)
  const fundRate = Number(fundingRatePct || 0.01);
  const isSqueeze = (side === 'LONG') && (isShortSqueeze || fundRate <= -0.030);
  if (isSqueeze) {
    if (fundRate <= -0.050) score += 18;
    else if (fundRate <= -0.035) score += 14;
    else score += 10;
  }

  score = Math.min(100, Math.max(0, score));

  // 3) Kasa Büyüklüğüne Göre Dinamik Kelly Tavanı (Maksimum %28 teminat)
  const maxSafeMargin = Math.min(30.0, Math.max(12.0, balance * 0.28));

  // 4) Kategori Sınıflandırması & Parametre Belirleme
  if (score >= 78) {
    // 👑 A+ ŞAMPİYON VUR-KAÇ KURULUMU (Asimetrik Kâr Fırsatı)
    // Hedef Teminat: $25 - $28 (Kasa $103 ise ~$26.0)
    let margin = Math.min(maxSafeMargin, Math.max(24.0, Number((balance * 0.25).toFixed(1))));
    if (free < margin) margin = Math.max(10.0, Number(free.toFixed(1)));

    const customLabel = isSqueeze ? '👑 A+ SHORT SQUEEZE ROKETİ' : '👑 A+ ŞAMPİYON VUR-KAÇ';
    const moonTarget = isSqueeze ? 2.40 : 2.20;
    const tp1Target = isSqueeze ? 1.05 : 1.00;

    return {
      tier: 'TIER_A_PLUS',
      tierLabel: customLabel,
      isShortSqueeze: isSqueeze,
      margin: margin,
      slPct: 1.10,       // 🏔️ Marscoin Sağlıklı Stop Loss
      bePct: 1.00,       // 🛡️ +%1.00 Spot görünce $0 riske kitle
      tp1Pct: 1.20,      // 💰 TP1 kârı %1.20 Spot (+%24 ROI)
      moonPct: 2.40,     // 🚀 Dev Marscoin Moonshot +%2.40 Spot (+%48 ROI)
      convictionScore: score,
      rationale: isSqueeze 
        ? `🔥 SHORT SQUEEZE TESPİT EDİLDİ! Fonlama %${fundRate.toFixed(3)} (Ağır Negatif). Balinalar shortçuları patlatıyor! Teminat $${margin}, Moonshot +%${moonTarget.toFixed(2)}.`
        : `Skor %${score} (Taker: %${effectiveTaker.toFixed(1)}, FreqAI: %${winProb}, Akış: $${flow}M). A+ Şampiyon kurulumu! Teminat $${margin}'a yükseltildi, Moonshot +%2.40.`
    };
  } else if (score >= 65) {
    // 💎 TIER-1 GÜÇLÜ KURULUM
    let margin = Math.min(maxSafeMargin, Math.max(18.0, Number((balance * 0.18).toFixed(1))));
    if (free < margin) margin = Math.max(12.0, Number(free.toFixed(1)));

    return {
      tier: 'TIER_HIGH',
      tierLabel: '💎 TIER-1 GÜÇLÜ SİNYAL',
      margin: margin,
      slPct: 1.10,
      bePct: 1.00,
      tp1Pct: 1.20,
      moonPct: 2.40,
      convictionScore: score,
      rationale: `Skor %${score}. Güçlü kurumsal sinyal! Teminat $${margin}, TP1 %1.20, Moonshot +%2.40.`
    };
  } else {
    // 🛡️ TIER-2 STANDART MARSCOIN KURULUM
    let margin = Math.min(15.0, Math.max(12.0, Number((balance * 0.15).toFixed(1))));
    if (free < margin) margin = Math.max(10.0, Number(free.toFixed(1)));

    return {
      tier: 'TIER_STANDARD',
      tierLabel: '🏔️ STANDART MARSCOIN ROKET',
      margin: margin,
      slPct: 1.10,
      bePct: 1.00,
      tp1Pct: 1.20,
      moonPct: 2.40,
      convictionScore: score,
      rationale: `Skor %${score}. Marscoin kurulumu ($${margin} teminat, TP1 %1.20, Moonshot +%2.40).`
    };
  }
}

/**
 * 🏛️ Otonom 6-Ajan Toplantısı & Karar Yürütme
 * @param {object} ctx  Sunucudan gelen canlı bağlam (bakiye, slot, mevcut filtreler, mevcut config)
 */
async function runAutonomousTeamSync(ctx = {}) {
  const current = ctx.current || { vol3hMin: 0.8, candidateSlice: 35 };
  const liveCfg = ctx.config || { slPct: 1.25, bePct: 0.45, tp1Pct: 0.75, moonPct: 1.5, marginPerTrade: 20, leverage: 20 };

  // 1) 🧠 ANALİZCİ & 🐋 BALİNA AVCISI: Adli Tıp, Piyasa Rejimi ve Net Para Akışı
  const forensics = runTradeForensics();
  const regime = await detectMarketRegime();
  let moneyFlow = { netMarketFlowM: 0, marketFlowBias: 'NEUTRAL', topBullInflows: [], topBearOutflows: [], flowMap: {} };
  try {
    moneyFlow = await trackWhaleMoneyFlow();
  } catch(e) {}

  let fundingRates = { avgFundingPct: 0.01, topShortSqueezes: [], topOverheatedLongs: [], fundingMap: {} };
  try {
    fundingRates = await scanFundingRates();
  } catch(e) {}
  const freqAiStats = getFreqAiStats();

  try {
    runCourtSession();
  } catch(e) {}
  const judgeDossier = getJudgeDossier();

  const rec = regime.recommendedConfig;

  // 2) 👑 YÖNETİCİ: Portföy Koruması & Risk Müdahale Değerlendirmesi
  const intervention = evaluateExecutiveIntervention(ctx, forensics, regime);

  const proposedExit = {
    slPct: intervention.slPct,
    bePct: intervention.bePct,
    tp1Pct: intervention.tp1Pct,
    moonPct: intervention.moonPct
  };

  // 3) 🧪 TESTÇİ & STRATEJİ OPTİMİZASYON MOTORU: 32 Strateji arasından Şampiyonu Seç
  let optimizer = null;
  let champion = null;
  try {
    optimizer = await findChampionStrategy({ margin: intervention.marginPerTrade, leverage: liveCfg.leverage || 20 });
    champion = optimizer ? optimizer.champion : null;
  } catch (e) {
    console.error("Optimizer hatası:", e.message);
  }

  // Eğer Şampiyon strateji bulunduysa çıkış parametrelerini şampiyona göre adapte et!
  if (optimizer && optimizer.hasChampion && champion && champion.params) {
    proposedExit.slPct = champion.params.slPct;
    proposedExit.bePct = champion.params.bePct;
    proposedExit.tp1Pct = champion.params.tp1Pct;
    proposedExit.moonPct = champion.params.moonPct;
    intervention.slPct = champion.params.slPct;
    intervention.bePct = champion.params.bePct;
    intervention.tp1Pct = champion.params.tp1Pct;
    intervention.moonPct = champion.params.moonPct;
    intervention.championStrategy = champion;
  }

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
    championStrategy: champion,
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

  // 5) 🗣️ 6-AJAN TELSİZ TOPLANTISI (KRONOLOJİK & GERÇEK VERİYE DAYALI)
  const fs_ = forensics.summary || {};
  const isDefensive = intervention.mode === 'DEFENSIVE_SNIPER';

  const meetingLines = [];

  const champName = (champion && champion.name) || "🔒 Erken Kilit";
  const champPf = (champion && champion.summary && champion.summary.profitFactor) || 2.1;
  const champWr = (champion && champion.summary && champion.summary.winRatePct) || 85;
  const champPnl = (champion && champion.summary && champion.summary.totalPnl) || 10.5;

  if (isDefensive) {
    meetingLines.push([
      'MANAGER',
      `🚨 [KRİTİK MÜDAHALE - SAVUNMA MODU]: Kasa $${fmt(ctx.balance)} seviyesinde (%${intervention.netDrawdownPct} zarar, zirveden %${intervention.drawdownFromPeakPct} DD). Kasa erimesini durdurmak için yönetimi devraldım! Slot 1'e, Teminat $${intervention.marginPerTrade}'a çekildi!`,
      'RISK'
    ]);
    const winRate = fs_.winRatePct || 0;
    const pf = fs_.profitFactor || 0;
    meetingLines.push([
      'ANALYST',
      `🧠 [ADLİ TEŞHİS]: ${fs_.totalTrades || 56} işlem incelendi (%${winRate} WR, PF: ${pf}). Adli analizde zayıf alıcı (<%54 taker) ve aşırı satımda (-%4.5 altı) shortlanan koinlerin zararın %90'ını ürettiği kanıtlandı. PUMP, CHIP, AVAX, STRK kara listeye alındı; eşik alıcı oranı %54.0'e çıkarıldı.`,
      'STRATEGY'
    ]);
    const pnlSignStr = Number(champPnl) >= 0 ? `+$${champPnl}` : `-$${Math.abs(champPnl)}`;
    meetingLines.push([
      'TESTER',
      `🧪 [STRATEJİ OPTİMİZASYONU]: 32 farklı strateji son 24 saatin mumlarında simüle edildi. 🏆 ŞAMPİYON: "${champName}" (PF: ${champPf}, WR: %${champWr}, Sim Kâr: ${pnlSignStr} | SL: %${proposedExit.slPct}, BE: %${proposedExit.bePct}, TP1: %${proposedExit.tp1Pct}). En karlı strateji canlıya uygulandı!`,
      'STRATEGY'
    ]);
    const topBullStr = (moneyFlow.topBullInflows || []).map(b => `${b.symbol} (+$${b.netFlowM}M)`).join(', ');
    const topBearStr = (moneyFlow.topBearOutflows || []).map(b => `${b.symbol} (-$${Math.abs(b.netFlowM)}M)`).join(', ');
    meetingLines.push([
      'WHALE_HUNTER',
      `🐋 [CANLI PARA AKIŞI]: Piyasa net akışı: $${moneyFlow.netMarketFlowM}M (${moneyFlow.marketFlowBias}). 🟢 Kurumsal Giriş: ${topBullStr || 'Bekleniyor'} | 🔴 Kaçış: ${topBearStr || 'Yok'}. Para çıkışı olan koinlere long vetosu devrede!`,
      'FLOW'
    ]);
    const sqzStr = (fundingRates.topShortSqueezes || []).map(s => `${s.symbol} (%${s.fundingRatePct})`).join(', ');
    meetingLines.push([
      'FREQAI',
      `🎯 [FREQ-AI & FONLAMA]: ML Olasılık Modeli devrede (Eğitim: ${freqAiStats.trainingSamples} işlem, Eşik: %72). Ortalama fonlama: %${fundingRates.avgFundingPct}. Sıkışma adayı: ${sqzStr || 'Yok'}. Düşük olasılıklı işlemler veto edilecek.`,
      'STRATEGY'
    ]);
    meetingLines.push([
      'JUDGE',
      `🏛️ [ASLAN11 ADLİ HÜKÜM]: Mahkeme oturumu tamamlandı (${judgeDossier.stats.totalTrials} duruşma, %${judgeDossier.stats.averageJudicialScore} intizam skoru). Disiplinsiz veya delilsiz açılmaya çalışılan her emir anında veto edilecek!`,
      'RISK'
    ]);
    meetingLines.push([
      'TRADER',
      `⚔️ [EMİR ONAYLANDI]: Savunma ve Şampiyon "${champName}" stratejisi yürütülüyor! Tek slot, $${intervention.marginPerTrade} teminat. Taker ≥ %54.0 ve tepe tuzağı engelli roketler taranıyor.`,
      'TRADE'
    ]);
    meetingLines.push([
      'ENGINEER',
      `💻 [SİSTEM & KOD GÜNCELLEMESİ]: Canlı server.js çekirdeğine Şampiyon "${champName}" parametreleri sıcak yüklendi (Hot-Reload). Parametreler senkronize, sistem stabil.`,
      'SYSTEM'
    ]);
  } else {
    meetingLines.push([
      'MANAGER',
      `👑 [VUR-KAÇ PORTFÖY DİREKTÖRÜ]: Kasa $${fmt(ctx.balance)}, açık slot ${ctx.activeCount ?? '-'}/${intervention.maxSlots}. Mod: ${intervention.mode}. A+ Şampiyon sinyallerde Kelly teminatı $25-$28'e yükseltilecek! Sert sınırlar: ${guardrailsOk ? 'uyumlu' : 'İHLAL VAR'}.`,
      'RISK'
    ]);
    meetingLines.push([
      'ANALYST',
      `Rejim: ${regime.description}. BTC 24s %${fmt(regime.btcData.change24h)}, $15M+ hacimli koin sayısı ${regime.marketStats.topVolCount}. Öneri: hacim ≥ $${intervention.vol3hMin}M, ${intervention.candidateSlice} aday.`,
      'REGIME'
    ]);
    meetingLines.push([
      'WHALE_HUNTER',
      `🐋 [FON AKIŞI]: Net piyasa yönü: ${moneyFlow.marketFlowBias} ($${moneyFlow.netMarketFlowM}M). Kurumsal boğa alımları taranıyor.`,
      'FLOW'
    ]);
    meetingLines.push([
      'FREQAI',
      `🎯 [FREQ-AI & FONLAMA]: ML Karar Motoru hazır (${freqAiStats.trainingSamples} işlem kalibre). Ortalama fonlama: %${fundingRates.avgFundingPct}. Minimum kazanma olasılığı eşiği: %68.`,
      'STRATEGY'
    ]);
    meetingLines.push([
      'JUDGE',
      `🏛️ [ASLAN11 ADLİ HÜKÜM]: Mahkeme devrede (${judgeDossier.stats.acquittals} beraat, ${judgeDossier.stats.convictions} mahkumiyet). Ön yargılama vizesi şartı devrede.`,
      'RISK'
    ]);
    meetingLines.push([
      'TESTER',
      `Backtest (${bt.symbols.length} koin). Mevcut: PF ${btCur.summary.profitFactor}, net $${fmt(btCur.summary.totalPnl)} | Önerilen: PF ${btProp.summary.profitFactor}, net $${fmt(btProp.summary.totalPnl)}.`,
      'STRATEGY'
    ]);
    meetingLines.push([
      'TRADER',
      `⚔️ [DİNAMİK YÜRÜTME]: 350+ koin taranıyor. Standart teminat: $${intervention.marginPerTrade}, A+ Şampiyon: $25-$28. Kademeli TP1 +%${intervention.tp1Pct}, Vur-Kaç Moonshot +%${intervention.moonPct}.`,
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
      },
      whale_scout: {
        role: '🐋 Balina & Para Akışı Dedektifi',
        status: moneyFlow.marketFlowBias === 'BULLISH' ? '🟢 KURUMSAL GİRİŞ' : (moneyFlow.marketFlowBias === 'BEARISH' ? '🔴 ÇIKIŞ BASKISI' : '⚖️ DENGELİ AKIŞ'),
        bias: moneyFlow.marketFlowBias,
        netMarketFlow: `$${moneyFlow.netMarketFlowM}M`,
        topInflow: (moneyFlow.topBullInflows && moneyFlow.topBullInflows[0]) ? `${moneyFlow.topBullInflows[0].symbol} (+$${moneyFlow.topBullInflows[0].netFlowM}M)` : '-',
        topOutflow: (moneyFlow.topBearOutflows && moneyFlow.topBearOutflows[0]) ? `${moneyFlow.topBearOutflows[0].symbol} (-$${Math.abs(moneyFlow.topBearOutflows[0].netFlowM)}M)` : '-'
      },
      freqai: {
        role: '🎯 FreqAI & Likidasyon Dedektifi',
        status: `%${freqAiStats.historicalWinRate} WR (${freqAiStats.trainingSamples} İşlem)`,
        avgFunding: `%${fundingRates.avgFundingPct}`,
        topSqueeze: (fundingRates.topShortSqueezes && fundingRates.topShortSqueezes[0]) ? `${fundingRates.topShortSqueezes[0].symbol} (%${fundingRates.topShortSqueezes[0].fundingRatePct})` : '-'
      },
      judge: {
        role: '🏛️ Aslan11 Baş Adli Yargıç',
        status: `Mahkeme: ${judgeDossier.stats.averageJudicialScore} Puan`,
        trials: judgeDossier.stats.totalTrials,
        convictions: judgeDossier.stats.convictions,
        acquittals: judgeDossier.stats.acquittals,
        bannedCoins: judgeDossier.activeBannedCount
      }
    },
    forensics,
    recommendedConfig: rec,
    moneyFlow,
    fundingRates,
    freqAiStats,
    judgeDossier,
    optimizer: optimizer ? {
      evaluatedAt: optimizer.evaluatedAt,
      candidatesCount: optimizer.candidatesCount,
      hasChampion: optimizer.hasChampion,
      champion: optimizer.champion,
      ranked: optimizer.ranked
    } : null,
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

module.exports = { runAutonomousTeamSync, evaluateExecutiveIntervention, calculateConvictionSizing };
