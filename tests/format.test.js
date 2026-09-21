import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, humanDuration, humanSize, normalize, escapeHtml } from '../js/format.js';

test('formatTime mostra minutos e segundos', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(75), '1:15');
  assert.equal(formatTime(3720), '1:02:00');
  assert.equal(formatTime(-5), '0:00');
});

test('humanDuration descreve a duração', () => {
  assert.equal(humanDuration(45), '45s');
  assert.equal(humanDuration(125), '2 min 5s');
  assert.equal(humanDuration(3720), '1 h 2 min');
});

test('humanSize formata tamanhos', () => {
  assert.equal(humanSize(512), '512 B');
  assert.equal(humanSize(1536), '1,5 KB');
  assert.match(humanSize(5 * 1024 * 1024), /MB$/);
});

test('normalize remove acentos e maiúsculas', () => {
  assert.equal(normalize('Napoleão'), 'napoleao');
  assert.equal(normalize('  Revolução Francesa '), 'revolucao francesa');
});

test('escapeHtml protege contra HTML', () => {
  assert.equal(escapeHtml('<b>oi</b>'), '&lt;b&gt;oi&lt;/b&gt;');
  assert.equal(escapeHtml('a & b'), 'a &amp; b');
});
