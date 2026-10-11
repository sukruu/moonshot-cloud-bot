const fs = require('fs');
const path = require('path');

const DIALOGUE_FILE = path.join(__dirname, 'team_dialogue.json');
const MAX_DIALOGUES = 50;

const AGENTS = {
  MANAGER:  { name: '👑 YÖNETİCİ',  color: '#c084fc', title: 'Risk Direktörü' },
  ANALYST:  { name: '🧠 ANALİZCİ',  color: '#38bdf8', title: 'Piyasa İstihbaratı' },
  TRADER:   { name: '⚔️ TRADER',    color: '#facc15', title: 'Sinyal & Yürütme' },
  TESTER:   { name: '🧪 TESTÇİ',    color: '#4ade80', title: 'QA & Simülatör' },
  ENGINEER: { name: '💻 YAZILIMCI', color: '#a78bfa', title: 'DevOps & Sistem' }
};

let dialogues = [];
try {
  if (fs.existsSync(DIALOGUE_FILE)) {
    const raw = JSON.parse(fs.readFileSync(DIALOGUE_FILE, 'utf8'));
    // Eski ters sıralı veya bayat test mesajlarını filtrele (10:19 seed'ini temizle)
    if (Array.isArray(raw)) {
      dialogues = raw.filter(d => !d.text.includes('durumu raporla'));
    }
  }
} catch (e) {
  dialogues = [];
}

// HTML enjeksiyonuna karşı metni kaçışla
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function trTime() {
  return new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' });
}

/**
 * Yeni bir diyalog satırı ekler (KRONOLOJİK: en yeni mesaj en sona eklenir).
 */
function addDialogue(agentRole, text, tag = 'SYSTEM') {
  const meta = AGENTS[agentRole] || { name: '🤖 AJAN', color: '#94a3b8', title: 'Otonom' };
  const entry = {
    id: Date.now() + Math.random().toString(36).substring(2, 6),
    time: trTime(),
    timestamp: Date.now(),
    agent: meta.name,
    roleKey: agentRole,
    color: meta.color,
    title: meta.title,
    text: escapeHtml(text),
    tag
  };

  // KRONOLOJİK EKLE (En yeni mesaj en altta)
  dialogues.push(entry);
  if (dialogues.length > MAX_DIALOGUES) {
    dialogues = dialogues.slice(dialogues.length - MAX_DIALOGUES);
  }

  try {
    fs.writeFileSync(DIALOGUE_FILE, JSON.stringify(dialogues, null, 2), 'utf8');
  } catch (e) {}

  return entry;
}

/**
 * Toplantı satırlarını KRONOLOJİK sırayla ekler:
 * 1. Yönetici açılışı
 * 2. Analist rejim & adli tıp raporu
 * 3. Testçi simülasyon sonucu
 * 4. Yönetici karar & onay
 * 5. Trader yürütme planı
 * 6. Yazılımcı sistem durumu
 */
function addMeeting(lines) {
  for (const [role, text, tag] of lines) {
    addDialogue(role, text, tag);
  }
}

/**
 * Kronolojik sırayla (en eskiden en yeniye) son 'limit' adet mesajı döner.
 */
function getDialogues(limit = 40) {
  return dialogues.slice(Math.max(0, dialogues.length - limit));
}

module.exports = { addDialogue, addMeeting, getDialogues };
