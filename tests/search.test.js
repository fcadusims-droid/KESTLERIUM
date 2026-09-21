import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchSegments, highlight, segmentIndexAtTime } from '../js/search.js';

const segs = [
  { lessonId: 'a', index: 0, start: 0, end: 5, text: 'A Revolução Francesa começou em 1789.' },
  { lessonId: 'a', index: 1, start: 5, end: 10, text: 'Napoleão subiu ao poder depois da revolução.' },
  { lessonId: 'a', index: 2, start: 10, end: 15, text: 'A revolução mudou a Europa.' },
];

test('busca ignora acentos e maiúsculas', () => {
  const r = searchSegments(segs, 'revolucao');
  assert.equal(r.length, 3);
  assert.equal(r[0].start, 0);
});

test('busca não encontra o que não existe', () => {
  assert.equal(searchSegments(segs, 'inexistente').length, 0);
  assert.equal(searchSegments(segs, '').length, 0);
});

test('destaque envolve o termo em <mark>', () => {
  const out = highlight('a revolução francesa', 'revolução');
  assert.match(out, /<mark>revolução<\/mark>/);
});

test('segmentIndexAtTime encontra o trecho tocando', () => {
  assert.equal(segmentIndexAtTime(segs, 0), 0);
  assert.equal(segmentIndexAtTime(segs, 7), 1);
  assert.equal(segmentIndexAtTime(segs, 12), 2);
  assert.equal(segmentIndexAtTime(segs, 100), 2); // além do fim: último
  assert.equal(segmentIndexAtTime([], 5), -1);
});
