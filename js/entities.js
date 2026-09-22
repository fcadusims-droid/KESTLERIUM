// Extração de termos e conceitos da aula, sem internet e sem modelo pesado.
// Usamos heurísticas: nomes próprios (palavras com inicial maiúscula),
// datas/anos e palavras que se repetem muito. É rápido e funciona offline.
// Decisão registrada no PROGRESSO.md: preferimos heurísticas a um modelo NER
// porque modelos de reconhecimento de nomes em português no navegador são
// grandes, lentos e pouco confiáveis; o usuário pode corrigir manualmente.

import { normalize, makeId } from './format.js';

// Palavras comuns que não devem virar termos sozinhas.
const STOPWORDS = new Set([
  'a','o','as','os','um','uma','uns','umas','de','do','da','dos','das','em','no','na','nos','nas',
  'por','para','com','sem','sob','sobre','entre','ate','ate','apos','desde','e','ou','mas','porem',
  'que','qual','quais','quando','onde','como','porque','pois','se','nao','sim','ja','tambem','ainda',
  'muito','pouco','mais','menos','todo','toda','todos','todas','cada','algum','alguns','alguma','algumas',
  'este','esta','estes','estas','esse','essa','esses','essas','aquele','aquela','isto','isso','aquilo',
  'eu','tu','ele','ela','nos','vos','eles','elas','me','te','se','lhe','nos','vos','meu','minha','teu','seu','sua',
  'foi','era','ser','sao','ter','tem','tinha','havia','ha','entao','assim','aqui','ali','la','hoje','ontem','amanha',
  'agora','depois','antes','bem','mal','vez','vezes','coisa','coisas','forma','modo','maneira','parte','partes',
  'ele','dela','dele','deles','delas','nele','nela','numa','num','pelo','pela','pelos','pelas','ao','aos','à','às',
  'the','of','and','to','in','is','was','for','that','this','with','as','by','an','be','are',
]);

const CONNECTORS = new Set(['de','da','do','das','dos','du','del','di','van','von','la','le','y']);

const MESES = 'janeiro|fevereiro|marco|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro';

// Um "token" com informação de posição dentro do segmento.
function isUpperFirst(word) {
  const c = word[0];
  return c && c === c.toLocaleUpperCase('pt-BR') && c !== c.toLocaleLowerCase('pt-BR');
}

function isAllCaps(word) {
  return word.length >= 2 && word === word.toLocaleUpperCase('pt-BR') && /[A-ZÀ-Ý]/.test(word);
}

// Divide um texto em palavras, marcando início de frase.
function tokenizeWords(text) {
  const tokens = [];
  // Casa palavras (incluindo acentuadas e com hífen/apóstrofo internos).
  const re = /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]*/g;
  let m;
  let sentenceStart = true;
  let lastEnd = 0;
  while ((m = re.exec(text)) !== null) {
    const between = text.slice(lastEnd, m.index);
    if (/[.!?…]/.test(between)) sentenceStart = true;
    tokens.push({ word: m[0], atSentenceStart: sentenceStart });
    sentenceStart = false;
    lastEnd = m.index + m[0].length;
  }
  return tokens;
}

// Encontra candidatos a nomes próprios num segmento de texto.
// Retorna lista de { name, atSentenceStart }.
function findProperNouns(text) {
  const tokens = tokenizeWords(text);
  const found = [];
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (isUpperFirst(tok.word) || isAllCaps(tok.word)) {
      const parts = [tok.word];
      const startedAtSentence = tok.atSentenceStart;
      let j = i + 1;
      while (j < tokens.length) {
        const next = tokens[j];
        const lower = next.word.toLocaleLowerCase('pt-BR');
        if (isUpperFirst(next.word) || isAllCaps(next.word)) {
          parts.push(next.word);
          j++;
        } else if (CONNECTORS.has(normalize(lower)) && j + 1 < tokens.length &&
                   (isUpperFirst(tokens[j + 1].word) || isAllCaps(tokens[j + 1].word))) {
          // conector minúsculo entre dois nomes: "Machado de Assis"
          parts.push(next.word);
          j++;
        } else {
          break;
        }
      }
      found.push({ name: parts.join(' '), atSentenceStart: startedAtSentence, words: parts.length });
      i = j;
    } else {
      i++;
    }
  }
  return found;
}

// Encontra datas e anos num texto.
function findDates(text) {
  const results = [];
  const push = (s) => { const t = s.trim(); if (t) results.push(t); };
  // "12 de março de 1889" ou "março de 1889"
  const full = new RegExp(`\\b(\\d{1,2}\\s+de\\s+)?(${MESES})\\s+de\\s+\\d{3,4}\\b`, 'gi');
  let m;
  while ((m = full.exec(text)) !== null) push(m[0]);
  // "século XVI" / "seculo 16"
  const sec = /\bs[ée]culo\s+([IVXLCDM]+|\d{1,2})\b/gi;
  while ((m = sec.exec(text)) !== null) push(m[0]);
  // Anos com era: "44 a.C.", "476 d.C."
  const era = /\b\d{1,4}\s*(a\.?\s?c\.?|d\.?\s?c\.?)\b/gi;
  while ((m = era.exec(text)) !== null) push(m[0]);
  // Anos soltos de 4 dígitos (1500..2099) que não fazem parte de datas maiores.
  const year = /\b(1[0-9]{3}|20[0-9]{2})\b/g;
  while ((m = year.exec(text)) !== null) push(m[0]);
  return results;
}

// Palavras que se repetem muito (conceitos), fora nomes e stopwords.
function findFrequentWords(allText, minCount = 4, minLen = 5) {
  const counts = new Map();
  const re = /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]*/g;
  let m;
  while ((m = re.exec(allText)) !== null) {
    const w = m[0];
    if (isUpperFirst(w) || isAllCaps(w)) continue; // nomes tratados à parte
    const norm = normalize(w);
    if (norm.length < minLen || STOPWORDS.has(norm)) continue;
    counts.set(norm, (counts.get(norm) || 0) + 1);
  }
  const out = [];
  for (const [norm, c] of counts) {
    if (c >= minCount) out.push({ norm, count: c });
  }
  return out;
}

// Função principal: recebe os segmentos {index, start, end, text} e devolve
// a lista de termos com contagem e todas as ocorrências (com tempo).
export function extractTerms(segments) {
  const byKey = new Map(); // norm -> termo agregado

  const addOccurrence = (rawName, kind, seg, count = 1) => {
    const norm = normalize(rawName);
    if (!norm) return;
    let term = byKey.get(norm);
    if (!term) {
      term = { id: makeId('t'), name: rawName, norm, kind, count: 0, occurrences: [], _names: new Map() };
      byKey.set(norm, term);
    }
    term.count += count;
    // guarda a forma escrita mais frequente como nome de exibição
    term._names.set(rawName, (term._names.get(rawName) || 0) + count);
    term.occurrences.push({ index: seg.index, start: seg.start });
    if (kind === 'data' && term.kind !== 'data') term.kind = 'data';
  };

  const allTextParts = [];
  // Para reduzir falsos positivos de início de frase, contamos com que forma
  // (maiúscula/minúscula) cada palavra aparece ao longo de toda a aula.
  const lowerSeen = new Set();
  for (const seg of segments) {
    allTextParts.push(seg.text || '');
    const re = /[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]*/g;
    let m;
    while ((m = re.exec(seg.text || '')) !== null) {
      const w = m[0];
      if (!isUpperFirst(w) && !isAllCaps(w)) lowerSeen.add(normalize(w));
    }
  }
  const allText = allTextParts.join('\n');

  for (const seg of segments) {
    const text = seg.text || '';
    for (const pn of findProperNouns(text)) {
      const norm = normalize(pn.name);
      // Descarta palavra única de início de frase que também aparece em
      // minúscula na aula (provavelmente é só o começo da frase).
      if (pn.words === 1 && pn.atSentenceStart && lowerSeen.has(norm)) continue;
      if (STOPWORDS.has(norm)) continue;
      addOccurrence(pn.name, 'nome', seg);
    }
    for (const d of findDates(text)) {
      addOccurrence(d, 'data', seg);
    }
  }

  // Conceitos frequentes (palavras minúsculas repetidas).
  for (const fw of findFrequentWords(allText)) {
    // localiza as ocorrências para ter tempos
    for (const seg of segments) {
      const re = new RegExp(`\\b${fw.norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
      const normText = normalize(seg.text || '');
      if (re.test(normText)) {
        addOccurrence(fw.norm, 'conceito', seg, 0); // conta via count final
      }
    }
    const term = byKey.get(fw.norm);
    if (term) term.count = fw.count;
  }

  // Finaliza: escolhe o melhor nome de exibição e ordena por frequência.
  const terms = [];
  for (const term of byKey.values()) {
    let best = term.name;
    let bestC = -1;
    for (const [name, c] of term._names) {
      if (c > bestC) { best = name; bestC = c; }
    }
    delete term._names;
    term.name = best;
    term.hidden = false;
    terms.push(term);
  }
  terms.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
  return terms;
}

// Sugere pares de termos que provavelmente são a mesma coisa, para você mesclar.
// Ex.: "Napoleão" e "Napoleão Bonaparte" (um é parte do outro, palavra a palavra).
// Função pura e testável. Devolve [{ menor, maior, motivo }].
export function suggestMerges(terms) {
  const visiveis = (terms || []).filter((t) => !t.hidden && t.kind !== 'data' && t.norm);
  const sugestoes = [];
  const jaSugerido = new Set();
  for (let i = 0; i < visiveis.length; i++) {
    for (let j = 0; j < visiveis.length; j++) {
      if (i === j) continue;
      const a = visiveis[i];
      const b = visiveis[j];
      const tokensA = a.norm.split(/\s+/).filter(Boolean);
      const tokensB = b.norm.split(/\s+/).filter(Boolean);
      if (tokensA.length >= tokensB.length) continue; // "a" precisa ser o menor
      // Todos os tokens do menor aparecem no maior, na mesma ordem contígua?
      if (!contemSequencia(tokensB, tokensA)) continue;
      // Evita mesclar palavras únicas muito curtas (ex.: "rei" dentro de "rei sol").
      if (tokensA.length === 1 && tokensA[0].length < 4) continue;
      const chave = [a.norm, b.norm].sort().join('|');
      if (jaSugerido.has(chave)) continue;
      jaSugerido.add(chave);
      sugestoes.push({ menor: a, maior: b, motivo: `"${a.name}" faz parte de "${b.name}"` });
    }
  }
  return sugestoes;
}

// Verifica se a sequência "peq" aparece contígua dentro de "grande".
function contemSequencia(grande, peq) {
  if (peq.length > grande.length) return false;
  for (let i = 0; i + peq.length <= grande.length; i++) {
    let ok = true;
    for (let k = 0; k < peq.length; k++) { if (grande[i + k] !== peq[k]) { ok = false; break; } }
    if (ok) return true;
  }
  return false;
}

// Junta dois termos num só (mesclar duplicatas). Retorna novo termo.
export function mergeTerms(a, b, newName) {
  const occurrences = [...a.occurrences, ...b.occurrences]
    .sort((x, y) => x.start - y.start);
  return {
    id: a.id,
    name: newName || a.name,
    norm: normalize(newName || a.name),
    kind: a.kind === 'data' || b.kind === 'data' ? 'data' : a.kind,
    count: a.count + b.count,
    occurrences,
    hidden: false,
    manual: a.manual || b.manual || false,
  };
}
