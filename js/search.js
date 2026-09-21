// Busca de texto dentro das transcrições. Funções puras e testáveis.
import { normalize, escapeRegExp } from './format.js';

// Procura um texto dentro de uma lista de segmentos {index, start, end, text}.
// Devolve os trechos que batem, com um pedaço do texto ao redor e o tempo.
// A busca ignora acentos e maiúsculas/minúsculas.
export function searchSegments(segments, query, options = {}) {
  const maxResults = options.maxResults || 200;
  const q = normalize(query);
  if (!q) return [];
  const results = [];
  for (const seg of segments) {
    const text = seg.text || '';
    const normText = normalize(text);
    let from = 0;
    let pos;
    while ((pos = normText.indexOf(q, from)) !== -1) {
      results.push({
        lessonId: seg.lessonId,
        index: seg.index,
        start: seg.start,
        end: seg.end,
        snippet: makeSnippet(text, pos, q.length),
        text,
      });
      from = pos + q.length;
      if (results.length >= maxResults) return results;
    }
  }
  return results;
}

// Monta um trecho curto em volta da posição encontrada, marcando o termo.
// A marcação usa colchetes «...» que a interface transforma em destaque.
function makeSnippet(text, pos, len, context = 40) {
  const start = Math.max(0, pos - context);
  const end = Math.min(text.length, pos + len + context);
  let snippet = text.slice(start, end);
  const relPos = pos - start;
  const before = snippet.slice(0, relPos);
  const match = snippet.slice(relPos, relPos + len);
  const after = snippet.slice(relPos + len);
  let out = `${before}\u0001${match}\u0002${after}`;
  if (start > 0) out = '…' + out;
  if (end < text.length) out = out + '…';
  return out;
}

// Destaca todas as ocorrências de um termo dentro de um texto já "escapado".
// Recebe texto seguro (HTML escapado) e devolve HTML com <mark>.
export function highlight(safeText, query) {
  const q = String(query || '').trim();
  if (!q) return safeText;
  try {
    const re = new RegExp(escapeRegExp(q), 'gi');
    return safeText.replace(re, (m) => `<mark>${m}</mark>`);
  } catch {
    return safeText;
  }
}

// Descobre qual segmento está tocando num dado tempo (em segundos).
// Retorna o índice na lista, ou -1. Assume segmentos em ordem de tempo.
export function segmentIndexAtTime(segments, timeSec) {
  if (!segments || segments.length === 0) return -1;
  let lo = 0;
  let hi = segments.length - 1;
  let answer = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const seg = segments[mid];
    if (timeSec < seg.start) {
      hi = mid - 1;
    } else if (timeSec >= seg.end) {
      answer = mid; // pode ser este ou um posterior
      lo = mid + 1;
    } else {
      return mid; // dentro do intervalo
    }
  }
  // Se não caiu em nenhum intervalo, devolve o último que já começou.
  return answer;
}
