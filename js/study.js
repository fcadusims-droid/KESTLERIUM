// Lógica de estudo — SEMPRE "fundamentada": nada é inventado. Tudo o que aparece
// (capítulos, frase-chave, destaques) vem de uma frase real da aula, com o
// horário. Assim, mesmo sendo regras simples, o app não distorce o conteúdo:
// quem interpreta é o estudante; o app só organiza e aponta o trecho exato.
// Funções puras e testáveis.

import { normalize, escapeHtml, escapeRegExp } from './format.js';

// Conta quantos termos-chave (por forma normalizada) aparecem num texto.
function contarTermos(textoNorm, termNorms) {
  let n = 0;
  for (const tn of termNorms) {
    if (tn && textoNorm.includes(tn)) n++;
  }
  return n;
}

// Divide a aula em capítulos por tempo, quebrando só no fim de uma frase.
// Para cada capítulo escolhe uma FRASE-CHAVE (a frase real do próprio áudio
// que mais concentra termos-chave) — nunca um resumo inventado.
export function chapterize(segments, terms = [], opts = {}) {
  const targetSec = opts.targetSec || 150; // ~2,5 min por capítulo
  const termNorms = (terms || []).filter((t) => !t.hidden).map((t) => t.norm).filter(Boolean);
  const chapters = [];
  let cur = null;

  const fechar = (c) => {
    // frase-chave = segmento com mais termos-chave (empate: o mais longo)
    let melhor = c.segs[0];
    let melhorPont = -1;
    for (const s of c.segs) {
      const pont = contarTermos(normalize(s.text || ''), termNorms);
      if (pont > melhorPont || (pont === melhorPont && (s.text || '').length > (melhor.text || '').length)) {
        melhor = s; melhorPont = pont;
      }
    }
    c.fraseChave = { text: (melhor.text || '').trim(), start: melhor.start, index: melhor.index };
    // título = termo-chave mais frequente do capítulo, senão as primeiras palavras
    c.titulo = tituloDoCapitulo(c.segs, termNorms, terms) || primeirasPalavras(c.segs[0].text);
    delete c.segs;
  };

  for (const s of segments) {
    if (!cur) cur = { startSec: s.start, endSec: s.end, segIndexes: [], segs: [] };
    cur.segIndexes.push(s.index);
    cur.segs.push(s);
    cur.endSec = s.end;
    const dur = cur.endSec - cur.startSec;
    const fimFrase = /[.!?…]\s*$/.test(s.text || '');
    if (dur >= targetSec && fimFrase) { fechar(cur); chapters.push(cur); cur = null; }
  }
  if (cur) { fechar(cur); chapters.push(cur); }
  chapters.forEach((c, i) => { c.index = i; });
  return chapters;
}

function tituloDoCapitulo(segs, termNorms, terms) {
  if (!termNorms.length) return null;
  const nomePorNorm = new Map((terms || []).map((t) => [t.norm, t.name]));
  const cont = new Map();
  const textoNorm = normalize(segs.map((s) => s.text || '').join(' '));
  for (const tn of termNorms) {
    if (!tn) continue;
    // conta ocorrências aproximadas
    let idx = 0; let c = 0;
    while ((idx = textoNorm.indexOf(tn, idx)) !== -1) { c++; idx += tn.length; }
    if (c > 0) cont.set(tn, c);
  }
  let melhor = null; let melhorC = 0;
  for (const [tn, c] of cont) { if (c > melhorC) { melhorC = c; melhor = tn; } }
  return melhor ? (nomePorNorm.get(melhor) || null) : null;
}

function primeirasPalavras(texto, n = 6) {
  const palavras = String(texto || '').trim().split(/\s+/).slice(0, n).join(' ');
  return palavras + (String(texto || '').trim().split(/\s+/).length > n ? '…' : '');
}

// Termos-chave para o "pré-treinamento" (conhecer o vocabulário antes).
// São os termos reais mais frequentes, com o primeiro horário onde aparecem.
export function keyTerms(terms, n = 8) {
  return (terms || [])
    .filter((t) => !t.hidden && t.kind !== 'data')
    .slice(0, n)
    .map((t) => ({
      name: t.name,
      kind: t.kind,
      count: t.count,
      start: (t.occurrences && t.occurrences[0]) ? t.occurrences[0].start : 0,
    }));
}

// Cria uma função que destaca (com cor por tipo) os termos dentro de um texto.
// Recebe texto CRU e devolve HTML seguro. É fundamentado: só marca termos que
// realmente existem na lista de termos daquela aula.
export function makeTermHighlighter(terms) {
  const vis = (terms || []).filter((t) => !t.hidden && t.name && t.name.length >= 3);
  if (!vis.length) return (text) => escapeHtml(text);
  vis.sort((a, b) => b.name.length - a.name.length);
  const kindPorNorm = new Map(vis.map((t) => [normalize(t.name), t.kind || 'nome']));
  const pattern = vis.map((t) => escapeRegExp(t.name)).join('|');
  let re;
  try {
    re = new RegExp(`(?<![A-Za-zÀ-ÿ])(${pattern})(?![A-Za-zÀ-ÿ])`, 'gi');
  } catch {
    re = new RegExp(`(${pattern})`, 'gi');
  }
  return (text) => {
    const str = String(text || '');
    let out = ''; let last = 0; let m;
    re.lastIndex = 0;
    while ((m = re.exec(str)) !== null) {
      out += escapeHtml(str.slice(last, m.index));
      const kind = kindPorNorm.get(normalize(m[0])) || 'nome';
      out += `<span class="termo-hl hl-${kind}">${escapeHtml(m[0])}</span>`;
      last = m.index + m[0].length;
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    out += escapeHtml(str.slice(last));
    return out;
  };
}
