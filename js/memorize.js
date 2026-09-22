// Mecânicas de memorização montadas automaticamente a partir da aula.
// Tudo é FUNDAMENTADO: usa os capítulos, termos e frases reais da aula.
// Funções puras e testáveis.

import { normalize } from './format.js';

// Termos que aparecem dentro de um capítulo (pelas ocorrências), do mais ao
// menos frequente.
function termosDoCapitulo(capitulo, terms, limite = 6) {
  const idxs = new Set(capitulo.segIndexes || []);
  const presentes = [];
  for (const t of terms) {
    if (t.hidden || t.kind === 'data') continue;
    const oc = (t.occurrences || []).find((o) => idxs.has(o.index));
    if (oc) presentes.push({ name: t.name, start: oc.start, count: t.count || 1 });
  }
  presentes.sort((a, b) => b.count - a.count);
  return presentes.slice(0, limite);
}

// Mapa mental hierárquico: aula (centro) -> capítulos -> termos-chave.
export function mindMap(lessonTitle, chapters, terms) {
  const ramos = (chapters || []).map((c) => ({
    titulo: c.titulo || 'Parte',
    start: c.startSec,
    filhos: termosDoCapitulo(c, terms, 5),
  })).filter((r) => r.filhos.length);
  return { centro: lessonTitle || 'Aula', ramos };
}

// Siglas mnemônicas: junta as iniciais dos termos-chave de cada capítulo.
// Não força virar "palavra"; mostra as iniciais e os termos para você criar a
// sua própria frase de memória.
export function acronyms(chapters, terms) {
  const saida = [];
  for (const c of (chapters || [])) {
    const ts = termosDoCapitulo(c, terms, 6);
    if (ts.length < 2) continue;
    const iniciais = ts.map((t) => primeiraLetra(t.name)).join('');
    saida.push({ titulo: c.titulo || 'Parte', start: c.startSec, iniciais, termos: ts });
  }
  return saida;
}

function primeiraLetra(nome) {
  const m = String(nome || '').trim().match(/[A-Za-zÀ-ÿ]/);
  return m ? m[0].toLocaleUpperCase('pt-BR') : '';
}

// Comparação de conceitos: pares de termos que aparecem no mesmo trecho, com
// uma frase de exemplo de cada um (para você comparar semelhanças/diferenças).
export function comparisons(segments, terms, graph, limite = 6) {
  const segPorIndex = new Map((segments || []).map((s) => [s.index, s]));
  const termoPorNorm = new Map((terms || []).map((t) => [t.norm, t]));
  const exemplo = (t) => {
    const oc = t && (t.occurrences || [])[0];
    const seg = oc ? segPorIndex.get(oc.index) : null;
    return { name: t ? t.name : '', text: seg ? seg.text : '', start: oc ? oc.start : 0 };
  };
  const pares = [];
  for (const e of (graph && graph.edges ? graph.edges : []).slice(0, limite)) {
    const a = termoPorNorm.get(e.a);
    const b = termoPorNorm.get(e.b);
    if (!a || !b) continue;
    pares.push({ a: exemplo(a), b: exemplo(b), peso: e.weight });
  }
  return pares;
}

// "Andaimes" (o app prepara, VOCÊ cria): lista ordenada de termos para o
// palácio da memória / associação por imagens / história.
export function scaffolds(chapters, terms) {
  const sequencia = [];
  for (const c of (chapters || [])) {
    for (const t of termosDoCapitulo(c, terms, 4)) {
      if (!sequencia.some((x) => normalize(x.name) === normalize(t.name))) sequencia.push(t);
    }
  }
  return sequencia.slice(0, 12);
}
