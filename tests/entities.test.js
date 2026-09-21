import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractTerms, mergeTerms, suggestMerges } from '../js/entities.js';

function seg(index, start, text) {
  return { lessonId: 'a', index, start, end: start + 5, text };
}

test('extrai nomes próprios com timestamps', () => {
  // A mesma forma escrita "Napoleão" repete em dois trechos: deve ser 1 termo
  // com 2 ocorrências. (Formas diferentes, como "Napoleão Bonaparte", ficam
  // separadas de propósito; o usuário pode mesclar manualmente.)
  const segs = [
    seg(0, 0, 'Hoje falamos sobre Napoleão e a França.'),
    seg(1, 5, 'Napoleão nasceu na Córsega.'),
    seg(2, 10, 'A Revolução Francesa foi importante.'),
  ];
  const terms = extractTerms(segs);
  const nomes = terms.map((t) => t.name);
  assert.ok(nomes.some((n) => n.includes('Napoleão')), 'deveria achar Napoleão');
  assert.ok(nomes.some((n) => n.includes('Revolução Francesa')), 'deveria achar Revolução Francesa');
  const nap = terms.find((t) => t.name === 'Napoleão');
  assert.ok(nap.count >= 2, 'Napoleão aparece pelo menos 2 vezes');
  assert.ok(nap.occurrences.length >= 2);
  assert.equal(nap.occurrences[0].start, 0);
});

test('junta nomes com conector "de"', () => {
  const segs = [seg(0, 0, 'O escritor Machado de Assis escreveu Dom Casmurro.')];
  const terms = extractTerms(segs);
  const nomes = terms.map((t) => t.name);
  assert.ok(nomes.some((n) => n === 'Machado de Assis'), `nomes: ${nomes.join(', ')}`);
});

test('detecta datas e anos', () => {
  const segs = [seg(0, 0, 'A independência foi em 1822 e a república em 15 de novembro de 1889.')];
  const terms = extractTerms(segs);
  const datas = terms.filter((t) => t.kind === 'data').map((t) => t.name);
  assert.ok(datas.some((d) => d.includes('1822')), `datas: ${datas.join(', ')}`);
  assert.ok(datas.some((d) => /1889/.test(d)), `datas: ${datas.join(', ')}`);
});

test('ignora palavra comum no início de frase', () => {
  const segs = [
    seg(0, 0, 'Hoje vamos estudar biologia.'),
    seg(1, 5, 'Depois falamos de química.'),
    seg(2, 10, 'hoje o assunto muda.'),
  ];
  const terms = extractTerms(segs);
  const nomes = terms.map((t) => t.name.toLowerCase());
  assert.ok(!nomes.includes('hoje'), 'não deveria virar termo "Hoje"');
});

test('suggestMerges encontra "Napoleão" dentro de "Napoleão Bonaparte"', () => {
  const terms = [
    { name: 'Napoleão', norm: 'napoleao', kind: 'nome', count: 2 },
    { name: 'Napoleão Bonaparte', norm: 'napoleao bonaparte', kind: 'nome', count: 1 },
    { name: 'Revolução Francesa', norm: 'revolucao francesa', kind: 'nome', count: 3 },
    { name: '1789', norm: '1789', kind: 'data', count: 1 },
  ];
  const s = suggestMerges(terms);
  assert.equal(s.length, 1);
  assert.equal(s[0].menor.name, 'Napoleão');
  assert.equal(s[0].maior.name, 'Napoleão Bonaparte');
});

test('suggestMerges ignora palavra curta e datas', () => {
  const terms = [
    { name: 'Rei', norm: 'rei', kind: 'nome', count: 5 },
    { name: 'Rei Sol', norm: 'rei sol', kind: 'nome', count: 2 },
    { name: '1500', norm: '1500', kind: 'data', count: 1 },
    { name: '1500 a.C.', norm: '1500 a c', kind: 'data', count: 1 },
  ];
  const s = suggestMerges(terms);
  assert.equal(s.length, 0);
});

test('mergeTerms soma contagens e ocorrências', () => {
  const a = { id: 'x', name: 'Brasil', norm: 'brasil', kind: 'nome', count: 2, occurrences: [{ index: 0, start: 1 }] };
  const b = { id: 'y', name: 'brasil', norm: 'brasil', kind: 'nome', count: 1, occurrences: [{ index: 2, start: 9 }] };
  const m = mergeTerms(a, b, 'Brasil');
  assert.equal(m.count, 3);
  assert.equal(m.occurrences.length, 2);
  assert.equal(m.occurrences[0].start, 1);
});
