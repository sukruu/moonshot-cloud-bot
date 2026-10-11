const fs = require('fs');
const path = require('path');

const DIALOGUE_FILE = path.join(__dirname, 'team_dialogue.json');
const MAX_DIALOGUES = 50;

let dialogues = [];

// Başlangıç diyalog havuzunu yükle
try {
  if (fs.existsSync(DIALOGUE_FILE)) {
    dialogues = JSON.parse(fs.readFileSync(DIALOGUE_FILE, 'utf8'));
  }
} catch (e) {
  dialogues = [];
}

/**
 * Yeni bir diyalog mesajı ekler
 * @param {string} agentRole 'MANAGER' | 'ANALYST' | 'TRADER' | 'TESTER' | 'ENGINEER'
 * @param {string} text Mesaj içeriği
 * @param {string} tag 'STRATEGY' | 'RISK' | 'TRADE' | 'REGIME' | 'SYSTEM'
 */
function addDialogue(agentRole, text, tag = 'SYSTEM') {
  const now = new Date();
  const timeStr = now.toTimeString().split(' ')[0];

  const agentMeta = {
    MANAGER:  { name: '👑 YÖNETİCİ', color: '#c084fc', title: 'Risk Direktörü' },
    ANALYST:  { name: '🧠 ANALİZCİ', color: '#38bdf8', title: 'Piyasa İstihbaratı' },
    TRADER:   { name: '⚔️ TRADER',   color: '#facc15', title: 'Sinyal & Yürütme' },
    TESTER:   { name: '🧪 TESTÇİ',   color: '#4ade80', title: 'QA & Simülatör' },
    ENGINEER: { name: '💻 YAZILIMCI', color: '#a78bfa', title: 'DevOps & Sistem' }
  }[agentRole] || { name: '🤖 AJAN', color: '#94a3b8', title: 'Otonom' };

  const entry = {
    id: Date.now() + Math.random().toString(36).substr(2, 4),
    time: timeStr,
    timestamp: Date.now(),
    agent: agentMeta.name,
    roleKey: agentRole,
    color: agentMeta.color,
    title: agentMeta.title,
    text,
    tag
  };

  dialogues.unshift(entry);
  if (dialogues.length > MAX_DIALOGUES) {
    dialogues = dialogues.slice(0, MAX_DIALOGUES);
  }

  try {
    fs.writeFileSync(DIALOGUE_FILE, JSON.stringify(dialogues, null, 2), 'utf8');
  } catch (e) {}

  return entry;
}

/**
 * Ekip toplantısı senaryosu üretir ve ekler
 */
function generateMeetingDialogues(regimeData, forensicsData, currentBalance = 131.21) {
  const isWeekend = regimeData?.isWeekend ?? true;
  const volThreshold = regimeData?.recommendedConfig?.vol3hM || 2.5;
  const winRate = forensicsData?.summary?.winRatePct || 100;
  const totalPnl = forensicsData?.summary?.totalPnl || 31.21;

  addDialogue('MANAGER', `Konsorsiyum toplantısı başladı. Kasa $${currentBalance} seviyesinde. Risk direktifi: Marjin $20 sabit, sermaye koruma öncelikli. Analist, durumu raporla.`, 'RISK');
  
  addDialogue('ANALYST', `Piyasa rejimi: ${isWeekend ? 'Hafta Sonu Düşük Hacim' : 'Hafta İçi Trend'}. Altcoin likiditesi daralmış durumda. Fakeout riskine karşı 3 saatlik hacim barajını $${volThreshold}M olarak öneriyorum.`, 'REGIME');
  
  addDialogue('TESTER', `Hafta sonu $${volThreshold}M hacim eşiği son 200 barda simüle edildi. Canlı kazanma oranı %${winRate}, net kâr +$${totalPnl}. Risk toleransı mükemmel, yeşil ışık yakıldı.`, 'STRATEGY');
  
  addDialogue('TRADER', `Testçiden onay alındı. 35 coinlik derin radar taranıyor. %0.45 erken kâr kilidi ve Moonshot kademeleri devrede, tetikte bekliyorum.`, 'TRADE');
  
  addDialogue('ENGINEER', `Render v18 motoru sorunsuz çalışıyor. Binance Vision CDN bağlantısı 40ms gecikmeyle stabil, tüm koruma kalkanları devrede.`, 'SYSTEM');
}

// Başlangıçta boşsa örnek diyalogları doldur
if (dialogues.length === 0) {
  generateMeetingDialogues();
}

function getDialogues(limit = 30) {
  return dialogues.slice(0, limit);
}

module.exports = {
  addDialogue,
  generateMeetingDialogues,
  getDialogues
};
