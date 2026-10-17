/**
 * 🏛️ Aslan11 Architecture: LLM as Judge & MCP Audit Trail
 * (Based on Aslan11/crypto-trading-agents)
 *
 * 1. Bağımsız Adli Yargıç (Judge Agent): Tüm işlemleri tarafsız bir mahkeme gibi denetler.
 * 2. Her işleme 0-100 arası Disiplin & Hukuk Puanı (Judicial Score) verir.
 * 3. Suç Unsurlarını Tespit Eder:
 *    - Taker < %51 iken girmek (Yetersiz Delil / Hacimsiz Giriş Suçu)
 *    - Günlük trende ters işlem açmak (Piyasa Nizamına Karşı Gelme Suçu)
 *    - 15m kırmızı iken Long açmak (Düşen Bıçağa Atlama Suçu)
 * 4. Sabıka Kaydı & Mahkeme Tedbiri (Judicial Injunction / Blacklist):
 *    - 2 kez ağır kusur işleyen koinlere 24 saatlik kesin işlem yasağı uygular.
 * 5. MCP Uyumlu Denetim Kayıt Defteri (judge_audit_trail.json).
 */

const fs = require('fs');
const path = require('path');

const AUDIT_FILE = path.join(__dirname, 'judge_audit_trail.json');
const HISTORY_FILE = path.join(__dirname, '..', 'trades_history.json');

class JudicialAuditCourt {
  constructor() {
    this.auditTrail = [];
    this.probationList = {}; // { 'CHIPUSDT': { bannedUntil: timestamp, offense: '...' } }
    this.stats = {
      totalTrials: 0,
      convictions: 0,
      acquittals: 0,
      averageJudicialScore: 78,
      lastAuditAt: null
    };
    this.loadAuditTrail();
    this.runCourtSession();
  }

  loadAuditTrail() {
    try {
      if (fs.existsSync(AUDIT_FILE)) {
        const data = JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf8'));
        this.auditTrail = data.trials || [];
        this.probationList = data.probationList || {};
        this.stats = data.stats || this.stats;
      }
    } catch (e) {
      this.auditTrail = [];
      this.probationList = {};
    }
  }

  saveAuditTrail() {
    try {
      fs.writeFileSync(AUDIT_FILE, JSON.stringify({
        updatedAt: new Date().toISOString(),
        stats: this.stats,
        probationList: this.probationList,
        trials: this.auditTrail.slice(-60) // son 60 duruşma kaydı
      }, null, 2), 'utf8');
    } catch (e) {}
  }

  /**
   * ⚖️ Mahkeme Oturumu: Geçmiş İşlemleri Denetle ve Sabıka Kaydı Oluştur
   */
  runCourtSession() {
    const emptyStats = {
      totalTrials: 0,
      convictions: 0,
      acquittals: 0,
      averageJudicialScore: null,
      lastAuditAt: new Date().toISOString()
    };
    try {
      if (!fs.existsSync(HISTORY_FILE)) {
        this.auditTrail = [];
        this.probationList = {};
        this.stats = emptyStats;
        this.saveAuditTrail();
        return;
      }
      const history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
      if (!Array.isArray(history) || history.length === 0) {
        this.auditTrail = [];
        this.probationList = {};
        this.stats = emptyStats;
        this.saveAuditTrail();
        return;
      }

      const coinOffenses = {};
      let totalScores = 0;
      let trialsCount = 0;
      let convictions = 0;
      let acquittals = 0;

      for (const t of history) {
        trialsCount++;
        const pnl = typeof t.pnl === 'number' ? t.pnl : 0;
        const sym = t.symbol || 'UNKNOWN';
        const side = t.side || 'LONG';
        const taker = t.takerBuyRatio || 50;
        const chg24 = t.chg24h || 0;

        let score = 80;
        const offenses = [];

        // Kusur Değerlendirmeleri
        if (pnl > 0.05) {
          score += 15;
        } else if (pnl < -0.50) {
          score -= 25;
          offenses.push("Ağır Sermaye Kaybı");
        }

        // Taker Kusuru
        if (side === 'LONG' && taker < 52.0) {
          score -= 20;
          offenses.push(`Yetersiz Alıcı Baskısı (%${taker.toFixed(1)})`);
        } else if (side === 'SHORT' && taker > 48.0) {
          score -= 20;
          offenses.push(`Yetersiz Satıcı Baskısı (%${(100 - taker).toFixed(1)})`);
        }

        // Trend Kusuru
        if (side === 'LONG' && chg24 < -2.0) {
          score -= 20;
          offenses.push(`Piyasa Nizamına Aykırı (Günlük Düşüşte Long: %${chg24})`);
        } else if (side === 'SHORT' && chg24 > 2.0) {
          score -= 20;
          offenses.push(`Piyasa Nizamına Aykırı (Günlük Yükselişte Short: +%${chg24})`);
        }

        score = Math.max(10, Math.min(100, score));
        totalScores += score;

        let verdict = 'BERAAT (Kusursuz İşlem)';
        if (score < 55) {
          verdict = 'MAHKUMİYET (Ağır Kural İhlali)';
          convictions++;
          coinOffenses[sym] = (coinOffenses[sym] || 0) + 1;
        } else {
          acquittals++;
        }
      }

      // Sabıka Kaydı: 2 kez mahkum olan koinlere 24 saat infaz kararı
      const now = Date.now();
      for (const [sym, count] of Object.entries(coinOffenses)) {
        if (count >= 2) {
          const existing = this.probationList[sym];
          // Eğer zaten aktif bir ceza varsa süresini sıfırlama, orijinal süreyi koru
          if (existing && existing.bannedUntil > now) {
            continue;
          }
          // Eğer ceza süresi geçmişte dolduysa ve yeni duruşmada ilave suç eklenmediyse tekrar cezalandırma
          if (existing && existing.bannedUntil <= now && existing.offenseCount >= count) {
            continue;
          }
          this.probationList[sym] = {
            bannedUntil: now + (24 * 60 * 60 * 1000),
            offenseCount: count,
            reason: `Tekrarlayan Ağır Kusur (${count} mahkumiyet) — Mahkeme Tedbiriyle Yasaklandı`
          };
        }
      }

      this.stats = {
        totalTrials: trialsCount,
        convictions,
        acquittals,
        averageJudicialScore: trialsCount > 0 ? Math.round(totalScores / trialsCount) : 78,
        lastAuditAt: new Date().toISOString()
      };

      this.saveAuditTrail();
    } catch (e) {
      console.error("[JudgeCourt] Mahkeme hatası:", e.message);
    }
  }

  /**
   * 🏛️ Ön Yargılama İzni: İşlem Açılmadan Önce Mahkeme Onayı
   * @returns { approved: boolean, verdict: string, judicialScore: number, probationActive: boolean, reason: string }
   */
  evaluatePreTradeClearance(symbol, side, candidateInfo = {}) {
    const now = Date.now();

    // 1. Sabıka / İnfaz Kontrolü
    const prob = this.probationList[symbol];
    if (prob && prob.bannedUntil > now) {
      const remainingHours = Math.ceil((prob.bannedUntil - now) / 3600000);
      return {
        approved: false,
        judicialScore: 25,
        verdict: 'MAHKEME TEDBİRİ DEVREDE (HÜKÜMLÜ)',
        probationActive: true,
        reason: `[YARGIÇ İNFAZ KARARI]: ${symbol} sabıkalı koin (${prob.reason}). Kalan yasak: ${remainingHours} saat!`
      };
    }

    // 2. Anlık İddianame ve Kural Uyumu
    let judicialScore = 85;
    const accusations = [];

    const takerRaw = Number(candidateInfo.takerBuyRatio);
    const chg15raw = Number(candidateInfo.chg15m);
    const chg24raw = Number(candidateInfo.chg24h);
    if (!Number.isFinite(takerRaw) || !Number.isFinite(chg15raw) || !Number.isFinite(chg24raw)) {
      return {
        approved: false,
        judicialScore: 0,
        verdict: 'DELİL YOK',
        probationActive: false,
        reason: 'Taker, 15m veya 24s verisi yok. Eksik veriyle işlem açılmaz.'
      };
    }
    const taker = takerRaw;
    const chg24 = chg24raw;
    const chg15 = chg15raw;

    const chg3raw = Number(candidateInfo.chg3h || 0);
    if (side === 'LONG') {
      if (taker < 51.8 || taker > 69.5) {
        judicialScore -= 35;
        accusations.push(`Sağlıksız Taker oranı (%${taker.toFixed(1)})`);
      }
      if (chg15 < 0.10) {
        judicialScore -= 35;
        accusations.push(`15dk ivme yetersiz (%${chg15.toFixed(2)})`);
      }
      if (chg3raw < 1.5 || chg3raw > 26.0) {
        judicialScore -= 35;
        accusations.push(`3s trend uygunsuz (%${chg3raw.toFixed(1)})`);
      }
      if (chg24 < 1.5) {
        judicialScore -= 35;
        accusations.push(`24s trend zayıf/eksi (%${chg24.toFixed(1)})`);
      }
    } else { // SHORT
      const sellTaker = 100 - taker;
      if (sellTaker < 52.5 || sellTaker > 76.5) {
        judicialScore -= 35;
        accusations.push(`Satıcı delili sağlıksız (%${sellTaker.toFixed(1)})`);
      }
      if (chg15 > -0.20) {
        judicialScore -= 35;
        accusations.push(`15dk düşüş ivmesi yetersiz (%${chg15.toFixed(2)})`);
      }
      if (chg3raw > -1.8 || chg3raw < -6.8) {
        judicialScore -= 35;
        accusations.push(`3s düşüş kanalı uygunsuz (%${chg3raw.toFixed(1)})`);
      }
      if (chg24 > -2.5) {
        judicialScore -= 35;
        accusations.push(`24s düşüş trendi yetersiz (%${chg24.toFixed(1)})`);
      }
    }

    const approved = judicialScore >= 70;
    const verdict = approved ? 'BERAAT (İntizamlı Giriş İzni)' : 'MAHKEME VETOSU (Kural İhlali)';
    const reason = approved
      ? `Disiplin Puanı: ${judicialScore}/100 — Kurallara uygun`
      : accusations.join(', ');

    return {
      approved,
      judicialScore,
      verdict,
      probationActive: false,
      reason
    };
  }

  getJudgeDossier() {
    const activeBans = Object.keys(this.probationList).filter(s => this.probationList[s].bannedUntil > Date.now());
    return {
      stats: this.stats,
      activeBannedCount: activeBans.length,
      bannedSymbols: activeBans,
      courtSummary: this.stats.totalTrials
        ? `Mahkeme Denetimi: ${this.stats.totalTrials} duruşma (${this.stats.convictions} mahkumiyet, ${this.stats.acquittals} beraat). Ortalama İntizam Skoru: ${this.stats.averageJudicialScore}/100. Aktif Tedbirli Koinler: ${activeBans.join(', ') || 'Yok'}.`
        : 'Mahkeme: bu seans henüz duruşma yok. Eski kayıt kullanılmıyor.'
    };
  }
}

const courtInstance = new JudicialAuditCourt();

module.exports = {
  evaluatePreTradeClearance: (sym, side, info) => courtInstance.evaluatePreTradeClearance(sym, side, info),
  runCourtSession: () => courtInstance.runCourtSession(),
  getJudgeDossier: () => courtInstance.getJudgeDossier()
};

if (require.main === module) {
  console.log("=== 🏛️ ASLAN11 YARGIÇ VE MAHKEME DOSYASI ===");
  console.log(courtInstance.getJudgeDossier());

  console.log("\n🧪 Duruşma Testi 1 (CHIP - Sabıkalı):");
  console.log(courtInstance.evaluatePreTradeClearance('CHIPUSDT', 'LONG', { takerBuyRatio: 45, chg24h: -5, chg15m: -0.5 }));

  console.log("\n🧪 Duruşma Testi 2 (CKB - Disiplinli):");
  console.log(courtInstance.evaluatePreTradeClearance('CKBUSDT', 'LONG', { takerBuyRatio: 58, chg24h: 7, chg15m: 1.0 }));
}
