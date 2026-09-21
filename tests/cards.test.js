import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarCartoes, agendar, estaVencido } from '../js/cards.js';

const segments = [
  { lessonId: 'a', index: 0, start: 0, end: 6, text: 'A Revolução Francesa começou em 1789.' },
  { lessonId: 'a', index: 1, start: 6, end: 12, text: 'Napoleão Bonaparte governou a França.' },
];
const terms = [
  { name: 'Revolução Francesa', norm: 'revolucao francesa', kind: 'nome', count: 3, occurrences: [{ index: 0, start: 0 }] },
  { name: 'Napoleão Bonaparte', norm: 'napoleao bonaparte', kind: 'nome', count: 2, occurrences: [{ index: 1, start: 6 }] },
  { name: '1789', norm: '1789', kind: 'data', count: 1, occurrences: [{ index: 0, start: 0 }] },
];
const chapters = [{ titulo: 'Rev', fraseChave: { text: 'A Revolução Francesa começou em 1789.', start: 0 }, startSec: 0, endSec: 12 }];

test('gerarCartoes cria cartões fundamentados (verso é frase real)', () => {
  const cards = gerarCartoes({ lessonId: 'a', segments, terms, chapters }, 1000);
  assert.ok(cards.length >= 3);
  const termo = cards.find((c) => c.tipo === 'termo');
  assert.ok(segments.some((s) => s.text === termo.verso), 'verso deve ser uma frase real');
  assert.ok(cards.some((c) => c.tipo === 'cloze'));
  assert.ok(cards.some((c) => c.tipo === 'data'));
  for (const c of cards) { assert.equal(c.reps, 0); assert.equal(c.due, 1000); }
});

test('agendar: acertar aumenta o intervalo, errar reseta', () => {
  let c = { ease: 2.5, reps: 0, interval: 0, lapses: 0, due: 0 };
  c = agendar(c, 2, 0); // bom
  assert.equal(c.interval, 1);
  c = agendar(c, 2, 0); // bom
  assert.equal(c.interval, 3);
  c = agendar(c, 2, 0); // bom -> cresce
  assert.ok(c.interval > 3, `intervalo deveria crescer, veio ${c.interval}`);
  const antes = c.interval;
  c = agendar(c, 0, 0); // errei -> reseta
  assert.equal(c.reps, 0);
  assert.ok(c.interval < antes);
  assert.ok(c.lapses >= 1);
});

test('estaVencido compara com a data', () => {
  assert.equal(estaVencido({ due: 100 }, 200), true);
  assert.equal(estaVencido({ due: 300 }, 200), false);
});

test('agendar fácil cresce mais que difícil', () => {
  const base = { ease: 2.5, reps: 2, interval: 3, lapses: 0, due: 0 };
  const facil = agendar({ ...base }, 3, 0);
  const dificil = agendar({ ...base }, 1, 0);
  assert.ok(facil.interval > dificil.interval);
});
