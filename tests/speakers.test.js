import { test } from 'node:test';
import assert from 'node:assert/strict';
import { annotateSpeakers, exposicao } from '../js/speakers.js';

test('marca perguntas (com "?") e mantém explicação', () => {
  const segs = [
    { index: 0, start: 0, end: 5, text: 'Hoje vamos falar da fotossíntese.' },
    { index: 1, start: 5, end: 8, text: 'A planta capta a luz do sol.' },
    { index: 2, start: 12, end: 14, text: 'Professor, e à noite como fica?' },
    { index: 3, start: 14, end: 20, text: 'Boa pergunta, à noite ela respira.' },
  ];
  const r = annotateSpeakers(segs);
  assert.equal(r.segments[2].pergunta, true);
  assert.equal(r.segments[0].pergunta, false);
  assert.equal(r.perguntas, 1);
  // a pergunta veio depois de uma pausa (8 -> 12) => interjeição => várias pessoas
  assert.equal(r.segments[2].interjeicao, true);
  assert.equal(r.temVariasPessoas, true);
});

test('exposicao remove as perguntas', () => {
  const segs = [
    { index: 0, start: 0, end: 5, text: 'Explicação um.' },
    { index: 1, start: 5, end: 8, text: 'Isso está certo?' },
  ];
  const { segments } = annotateSpeakers(segs);
  const expo = exposicao(segments);
  assert.equal(expo.length, 1);
  assert.equal(expo[0].text, 'Explicação um.');
});

test('aula sem perguntas não marca várias pessoas', () => {
  const segs = [
    { index: 0, start: 0, end: 5, text: 'Primeira parte da explicação.' },
    { index: 1, start: 5, end: 10, text: 'Segunda parte da explicação.' },
  ];
  const r = annotateSpeakers(segs);
  assert.equal(r.temVariasPessoas, false);
  assert.equal(r.perguntas, 0);
});
