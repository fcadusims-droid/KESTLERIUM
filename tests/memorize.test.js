import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mindMap, acronyms, comparisons, scaffolds } from '../js/memorize.js';

const terms = [
  { name: 'Revolução Francesa', norm: 'revolucao francesa', kind: 'nome', count: 3, occurrences: [{ index: 0, start: 0 }] },
  { name: 'Napoleão', norm: 'napoleao', kind: 'nome', count: 2, occurrences: [{ index: 0, start: 0 }, { index: 1, start: 6 }] },
  { name: 'Europa', norm: 'europa', kind: 'nome', count: 1, occurrences: [{ index: 1, start: 6 }] },
  { name: '1789', norm: '1789', kind: 'data', count: 1, occurrences: [{ index: 0, start: 0 }] },
];
const chapters = [
  { titulo: 'Revolução', startSec: 0, endSec: 6, segIndexes: [0] },
  { titulo: 'Napoleão', startSec: 6, endSec: 12, segIndexes: [1] },
];
const segments = [
  { index: 0, start: 0, end: 6, text: 'A Revolução Francesa e Napoleão em 1789.' },
  { index: 1, start: 6, end: 12, text: 'Napoleão dominou a Europa.' },
];
const graph = { edges: [{ a: 'napoleao', b: 'europa', weight: 1 }, { a: 'napoleao', b: 'revolucao francesa', weight: 1 }] };

test('mindMap monta aula -> capítulos -> termos', () => {
  const m = mindMap('Aula X', chapters, terms);
  assert.equal(m.centro, 'Aula X');
  assert.ok(m.ramos.length >= 1);
  assert.ok(m.ramos[0].filhos.length >= 1);
  // não inclui datas
  assert.ok(!m.ramos.some((r) => r.filhos.some((f) => f.name === '1789')));
});

test('acronyms junta iniciais dos termos do capítulo', () => {
  const a = acronyms(chapters, terms);
  // capítulo 0 tem só 1 termo (Revolução Francesa) -> ignorado (min 2)
  // então esperamos foco no capítulo com >=2 termos, ou nenhum se não houver
  for (const s of a) {
    assert.ok(s.iniciais.length >= 2);
    assert.equal(s.iniciais.length, s.termos.length);
  }
});

test('comparisons traz pares com frase de exemplo real', () => {
  const c = comparisons(segments, terms, graph);
  assert.ok(c.length >= 1);
  assert.ok(segments.some((s) => s.text === c[0].a.text));
  assert.ok(segments.some((s) => s.text === c[0].b.text));
});

test('scaffolds devolve sequência de termos sem repetir', () => {
  const s = scaffolds(chapters, terms);
  const nomes = s.map((x) => x.name);
  assert.equal(new Set(nomes).size, nomes.length);
  assert.ok(nomes.includes('Napoleão'));
});
