// Cartões de revisão (flashcards) + revisão espaçada.
// Os cartões são FUNDAMENTADOS: a resposta é sempre uma frase real da aula,
// com o horário para reouvir. O agendamento (quando revisar de novo) usa um
// algoritmo simples do tipo SM-2. A parte de lógica é pura e testável.

import * as db from './db.js';
import { normalize } from './format.js';
import { makeCloze } from './study.js';

const DIA = 86400000;

// ---- Geração dos cartões a partir da aula (pura) ----
export function gerarCartoes({ lessonId, segments, terms, chapters }, now = Date.now()) {
  const cartoes = [];
  const vistos = new Set();
  const segPorIndex = new Map((segments || []).map((s) => [s.index, s]));
  let n = 0;
  const base = () => ({ id: `${lessonId}:c:${n++}`, lessonId, ease: 2.5, interval: 0, reps: 0, lapses: 0, due: now, criadoEm: now });
  const add = (chave, extra) => { if (vistos.has(chave)) return; vistos.add(chave); cartoes.push({ ...base(), ...extra }); };

  // 1) Lacunas a partir da frase-chave de cada capítulo.
  for (const c of (chapters || [])) {
    const cl = makeCloze(c.fraseChave, terms);
    if (cl) add('cloze:' + normalize(cl.pergunta), { tipo: 'cloze', frente: cl.pergunta, verso: cl.resposta, start: cl.start });
  }

  // 2) Termos: "o que a aula diz sobre X?" com uma frase real como resposta.
  const termosOrdenados = (terms || []).filter((t) => !t.hidden && t.kind !== 'data').slice(0, 20);
  for (const t of termosOrdenados) {
    const oc = (t.occurrences || [])[0];
    const seg = oc ? segPorIndex.get(oc.index) : null;
    const frase = seg ? seg.text : '';
    if (!frase) continue;
    add('termo:' + t.norm, { tipo: 'termo', termo: t.name, frente: `O que a aula fala sobre “${t.name}”?`, verso: frase, start: oc ? oc.start : 0 });
  }

  // 3) Datas: "o que a aula associa a esta data?"
  const datas = (terms || []).filter((t) => !t.hidden && t.kind === 'data').slice(0, 10);
  for (const t of datas) {
    const oc = (t.occurrences || [])[0];
    const seg = oc ? segPorIndex.get(oc.index) : null;
    const frase = seg ? seg.text : '';
    if (!frase) continue;
    add('data:' + t.norm, { tipo: 'data', termo: t.name, frente: `O que a aula associa a “${t.name}”?`, verso: frase, start: oc ? oc.start : 0 });
  }

  return cartoes;
}

// ---- Agendamento (revisão espaçada), puro e testável ----
// nota: 0 = errei, 1 = difícil, 2 = bom, 3 = fácil.
export function agendar(card, nota, now = Date.now()) {
  let { ease = 2.5, reps = 0, interval = 0, lapses = 0 } = card;
  let due;
  if (nota === 0) {
    reps = 0; interval = 0; lapses += 1; ease = Math.max(1.3, ease - 0.2);
    due = now + 5 * 60 * 1000; // rever em ~5 min (mesma sessão)
  } else {
    reps += 1;
    if (nota === 1) ease = Math.max(1.3, ease - 0.15);
    else if (nota === 3) ease = ease + 0.15;
    if (reps === 1) interval = 1;
    else if (reps === 2) interval = nota === 1 ? 2 : 3;
    else interval = Math.max(1, Math.round(interval * ease * (nota === 1 ? 0.7 : 1)));
    due = now + interval * DIA;
  }
  return { ...card, ease: Math.round(ease * 100) / 100, reps, interval, lapses, due, ultimaRevisao: now };
}

export function estaVencido(card, now = Date.now()) {
  return (card.due || 0) <= now;
}

// ---- Operações de banco ----
export async function salvarCartoes(cartoes) {
  if (cartoes.length) await db.putMany(db.STORES.cards, cartoes);
  return cartoes.length;
}

export async function salvarCartao(card) { return db.put(db.STORES.cards, card); }

export async function cartoesDaAula(lessonId) {
  return db.getAllByIndex(db.STORES.cards, 'lessonId', lessonId);
}

export async function apagarCartoesDaAula(lessonId) {
  return db.delByIndex(db.STORES.cards, 'lessonId', lessonId);
}

export async function todosCartoes() { return db.getAll(db.STORES.cards); }

export async function cartoesVencidos(now = Date.now()) {
  const todos = await db.getAll(db.STORES.cards);
  return todos.filter((c) => estaVencido(c, now)).sort((a, b) => (a.due || 0) - (b.due || 0));
}

export async function contarVencidos(now = Date.now()) {
  return (await cartoesVencidos(now)).length;
}

// Cria (ou recria) os cartões de uma aula e salva.
export async function criarCartoesDaAula(lessonId, segments, terms, chapters, { recriar = false } = {}) {
  const existentes = await cartoesDaAula(lessonId);
  if (existentes.length && !recriar) return existentes;
  if (recriar) await apagarCartoesDaAula(lessonId);
  const novos = gerarCartoes({ lessonId, segments, terms, chapters });
  await salvarCartoes(novos);
  return novos;
}
