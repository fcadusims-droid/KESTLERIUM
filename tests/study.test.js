import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chapterize, keyTerms, makeTermHighlighter } from '../js/study.js';

function seg(index, start, text) {
  return { lessonId: 'a', index, start, end: start + 10, text };
}

test('chapterize divide por tempo e escolhe frase-chave real', () => {
  const segs = [
    seg(0, 0, 'Vamos falar sobre a Revolução Francesa hoje.'),
    seg(1, 10, 'A Revolução Francesa começou em 1789 e mudou tudo.'),
    seg(2, 20, 'Depois disso muita coisa aconteceu na Europa.'),
    seg(3, 160, 'Agora falaremos de Napoleão Bonaparte.'),
    seg(4, 170, 'Napoleão Bonaparte conquistou vários países da Europa.'),
  ];
  const terms = [
    { name: 'Revolução Francesa', norm: 'revolucao francesa', kind: 'nome', count: 2 },
    { name: 'Napoleão Bonaparte', norm: 'napoleao bonaparte', kind: 'nome', count: 2 },
  ];
  const caps = chapterize(segs, terms, { targetSec: 150 });
  assert.ok(caps.length >= 2, `esperava 2+ capítulos, veio ${caps.length}`);
  // a frase-chave precisa ser uma frase que existe de verdade nos segmentos
  for (const c of caps) {
    assert.ok(segs.some((s) => s.text === c.fraseChave.text), 'frase-chave deve ser real');
    assert.equal(typeof c.fraseChave.start, 'number');
  }
});

test('chapterize funciona sem termos', () => {
  const segs = [seg(0, 0, 'Frase um.'), seg(1, 200, 'Frase dois final.')];
  const caps = chapterize(segs, [], { targetSec: 150 });
  assert.ok(caps.length >= 1);
  assert.ok(caps[0].titulo);
});

test('keyTerms devolve os principais com horário', () => {
  const terms = [
    { name: 'Brasil', norm: 'brasil', kind: 'nome', count: 5, occurrences: [{ start: 3 }] },
    { name: '1500', norm: '1500', kind: 'data', count: 2, occurrences: [{ start: 1 }] },
    { name: 'colônia', norm: 'colonia', kind: 'conceito', count: 4, occurrences: [{ start: 9 }] },
  ];
  const k = keyTerms(terms, 5);
  assert.equal(k.length, 2); // datas são excluídas do pré-treinamento
  assert.equal(k[0].name, 'Brasil');
  assert.equal(k[0].start, 3);
});

test('makeTermHighlighter marca só termos reais, com cor por tipo', () => {
  const terms = [
    { name: 'Napoleão', norm: 'napoleao', kind: 'nome' },
    { name: 'revolução', norm: 'revolucao', kind: 'conceito' },
  ];
  const hl = makeTermHighlighter(terms);
  const out = hl('Napoleão liderou a revolução com força.');
  assert.match(out, /<span class="termo-hl hl-nome">Napoleão<\/span>/);
  assert.match(out, /<span class="termo-hl hl-conceito">revolução<\/span>/);
  // não deve marcar dentro de outra palavra
  const out2 = hl('reviravolta não é revolução');
  assert.equal((out2.match(/hl-conceito/g) || []).length, 1);
});

test('makeTermHighlighter escapa HTML perigoso', () => {
  const hl = makeTermHighlighter([{ name: 'teste', norm: 'teste', kind: 'nome' }]);
  const out = hl('<script>alerta</script> teste');
  assert.ok(!out.includes('<script>'));
  assert.match(out, /hl-nome">teste/);
});
