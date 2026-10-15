const IST = 'Asia/Kolkata'; // SRS 2.6: IST by default

export function initials(name = '') {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const lettered = words.filter((w) => /^\p{L}/u.test(w));
  const parts = lettered.length ? lettered : words;
  if (!parts.length) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]).toUpperCase();
}

// Same soft palette as the design canvas; a name always gets the same colour
const PALETTE = [
  ['#DBEAFE', '#1E40AF'],
  ['#D1FAE5', '#065F46'],
  ['#FFEDD5', '#9A3412'],
  ['#E0E7FF', '#3730A3'],
  ['#FCE7F3', '#9D174D'],
  ['#CCFBF1', '#115E59'],
  ['#FEF3C7', '#92400E'],
];

export function colorFor(seed = '') {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

export function timeOf(date) {
  return new Date(date).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: IST });
}

export function dayLabel(date) {
  const d = new Date(date);
  const key = (x) => x.toLocaleDateString('en-CA', { timeZone: IST });
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (key(d) === key(today)) return 'Today';
  if (key(d) === key(yesterday)) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric', timeZone: IST });
}

export function sameDay(a, b) {
  const key = (x) => new Date(x).toLocaleDateString('en-CA', { timeZone: IST });
  return key(a) === key(b);
}

export function timeAgo(date) {
  const s = Math.max(0, (Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} d ago`;
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: IST });
}

export function fileSize(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const EXAMS = ['JEE', 'NEET', 'UPSC', 'GATE', 'CA', 'Boards'];

export const PRIVACY_LABEL = {
  open: 'Open',
  approval: 'Approval',
  invite: 'Invite only',
};

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
