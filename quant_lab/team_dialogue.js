const fs = require('fs');
const path = require('path');

const DIALOGUE_FILE = path.join(__dirname, 'team_dialogue.json');
const MAX_DIALOGUES = 60;

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
    if (Array.isArray(raw)) dialogues = raw;
  }
} catch (e) {
  dialogues = [];
}

// HTML enjeksiyonuna karşı metni kaçışla (dashboard innerHTML kullanıyor)
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
 * Yeni bir diyalog satırı ekler. Metin her zaman gerçek veriden üretilmelidir.
 * @param {'MANAGER'|'ANALYST'|'TRADER'|'TESTER'|'ENGINEER'} agentRole
 * @param {string} text
 * @param {'STRATEGY'|'RISK'|'TRADE'|'REGIME'|'SYSTEM'} tag
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

  dialogues.unshift(entry);
  if (dialogues.length > MAX_DIALOGUES) dialogues = dialogues.slice(0, MAX_DIALOGUES);

  try {
    fs.writeFileSync(DIALOGUE_FILE, JSON.stringify(dialogues, null, 2), 'utf8');
  } catch (e) {}

  return entry;
}

/**
 * Toplantı satırlarını sırayla ekler (ilk satır en eskide kalacak şekilde).
 * @param {Array<[string, string, string]>} lines [role, text, tag]
 */
function addMeeting(lines) {
  for (const [role, text, tag] of lines) addDialogue(role, text, tag);
}

function getDialogues(limit = 30) {
  return dialogues.slice(0, limit);
}

module.exports = { addDialogue, addMeeting, getDialogues };
