// Funções simples de formatação e texto. São "puras" (sem navegador),
// por isso conseguem ser testadas automaticamente no Node.

// Converte segundos em texto de tempo: 75 -> "1:15", 3720 -> "1:02:00".
export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Descrição amigável de duração: 3720 -> "1 h 2 min".
export function humanDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${sec}s`;
  return `${sec}s`;
}

// Tamanho de arquivo legível: 1536 -> "1,5 KB".
export function humanSize(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let val = b / 1024;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  const rounded = val >= 10 ? Math.round(val) : Math.round(val * 10) / 10;
  return `${String(rounded).replace('.', ',')} ${units[i]}`;
}

// Remove acentos e coloca em minúsculas (para busca e comparação de termos).
export function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

// Escapa texto para uso seguro dentro de HTML (evita quebrar a página).
export function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Escapa caracteres especiais de expressão regular.
export function escapeRegExp(text) {
  return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Gera um identificador curto e único.
export function makeId(prefix = 'id') {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rnd}`;
}
