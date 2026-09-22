import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConceptGraph, layoutGraph, buildTimeline, parseAno, conceptGraphSVG } from '../js/diagrams.js';

const segments = [
  { index: 0, start: 0, end: 6, text: 'A Revolução Francesa e Napoleão em 1789.' },
  { index: 1, start: 6, end: 12, text: 'Napoleão dominou a Europa.' },
];
const terms = [
  { name: 'Revolução Francesa', norm: 'revolucao francesa', kind: 'nome', count: 2, occurrences: [{ index: 0, start: 0 }] },
  { name: 'Napoleão', norm: 'napoleao', kind: 'nome', count: 3, occurrences: [{ index: 0, start: 0 }, { index: 1, start: 6 }] },
  { name: 'Europa', norm: 'europa', kind: 'nome', count: 1, occurrences: [{ index: 1, start: 6 }] },
  { name: '1789', norm: '1789', kind: 'data', count: 1, occurrences: [{ index: 0, start: 0 }] },
];

test('buildConceptGraph liga termos do mesmo trecho', () => {
  const g = buildConceptGraph(segments, terms);
  const nomes = g.nodes.map((n) => n.norm);
  assert.ok(nomes.includes('napoleao'));
  assert.ok(!nomes.includes('1789'), 'datas não entram no mapa');
  // Revolução Francesa e Napoleão aparecem juntos no trecho 0
  assert.ok(g.edges.some((e) => [e.a, e.b].sort().join('|') === 'napoleao|revolucao francesa'));
  // Napoleão e Europa juntos no trecho 1
  assert.ok(g.edges.some((e) => [e.a, e.b].sort().join('|') === 'europa|napoleao'));
});

test('layoutGraph posiciona todos os nós dentro da área', () => {
  const g = buildConceptGraph(segments, terms);
  const l = layoutGraph(g, { width: 500, height: 400 });
  assert.equal(l.nodes.length, g.nodes.length);
  for (const n of l.nodes) {
    assert.ok(n.x >= 0 && n.x <= 500, `x fora: ${n.x}`);
    assert.ok(n.y >= 0 && n.y <= 400, `y fora: ${n.y}`);
  }
  // determinístico: mesma entrada, mesma saída
  const l2 = layoutGraph(g, { width: 500, height: 400 });
  assert.equal(l.nodes[0].x.toFixed(3), l2.nodes[0].x.toFixed(3));
});

test('conceptGraphSVG gera SVG com data-norm por nó', () => {
  const g = buildConceptGraph(segments, terms);
  const svg = conceptGraphSVG(layoutGraph(g, { width: 400, height: 300 }));
  assert.match(svg, /<svg/);
  assert.match(svg, /data-norm="napoleao"/);
});

test('parseAno entende anos, a.C. e séculos', () => {
  assert.equal(parseAno('1789'), 1789);
  assert.equal(parseAno('44 a.C.'), -44);
  assert.equal(parseAno('século XVI'), 1550);
  assert.equal(parseAno('sem data'), null);
});

test('buildTimeline ordena datas por ano', () => {
  const t = buildTimeline(segments, [
    { name: '1789', norm: '1789', kind: 'data', count: 1, occurrences: [{ index: 0, start: 0 }] },
    { name: '44 a.C.', norm: '44 a c', kind: 'data', count: 1, occurrences: [{ index: 1, start: 6 }] },
  ]);
  assert.equal(t.length, 2);
  assert.equal(t[0].label, '44 a.C.'); // antes de 1789
  assert.equal(t[1].label, '1789');
  assert.ok(t[0].text.length > 0, 'evento traz a frase da aula');
});
