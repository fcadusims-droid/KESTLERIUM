import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stripHtml, parseWikipediaSearch, parseWikipediaSummary, parseWikidataSearch,
} from '../js/research.js';

test('stripHtml remove tags e entidades', () => {
  assert.equal(stripHtml('<span class="x">Rio de <b>Janeiro</b></span>'), 'Rio de Janeiro');
  assert.equal(stripHtml('a &amp; b'), 'a & b');
});

test('parseWikipediaSearch extrai títulos', () => {
  const json = { query: { search: [
    { title: 'Napoleão Bonaparte', snippet: 'foi um <b>líder</b>' },
    { title: 'Napoleão III', snippet: 'sobrinho' },
  ] } };
  const r = parseWikipediaSearch(json);
  assert.equal(r.length, 2);
  assert.equal(r[0].title, 'Napoleão Bonaparte');
  assert.equal(r[0].snippet, 'foi um líder');
});

test('parseWikipediaSummary lê resumo e link', () => {
  const json = {
    title: 'Brasil',
    extract: 'O Brasil é um país.',
    type: 'standard',
    content_urls: { desktop: { page: 'https://pt.wikipedia.org/wiki/Brasil' } },
    thumbnail: { source: 'https://x/img.jpg' },
  };
  const s = parseWikipediaSummary(json, 'pt');
  assert.equal(s.title, 'Brasil');
  assert.equal(s.url, 'https://pt.wikipedia.org/wiki/Brasil');
  assert.equal(s.lang, 'pt');
  assert.equal(s.thumbnail, 'https://x/img.jpg');
});

test('parseWikipediaSummary detecta desambiguação', () => {
  const s = parseWikipediaSummary({ title: 'Java', type: 'disambiguation', extract: '' }, 'pt');
  assert.equal(s.type, 'disambiguation');
});

test('parseWikidataSearch extrai entidades', () => {
  const json = { search: [
    { id: 'Q517', label: 'Napoleão', description: 'imperador francês', concepturi: 'http://www.wikidata.org/entity/Q517' },
  ] };
  const r = parseWikidataSearch(json);
  assert.equal(r[0].id, 'Q517');
  assert.equal(r[0].description, 'imperador francês');
  assert.equal(r[0].url, 'http://www.wikidata.org/entity/Q517');
});

import { detectResearchRequests } from '../js/research.js';

test('detectResearchRequests acha pedido do professor com termo conhecido', () => {
  const segs = [
    { index: 0, start: 5, end: 10, text: 'Isso é importante. Pesquisem sobre a Guerra Fria em casa.' },
    { index: 1, start: 10, end: 15, text: 'A aula continua normalmente aqui.' },
  ];
  const terms = [{ name: 'Guerra Fria', norm: 'guerra fria', kind: 'nome', hidden: false }];
  const r = detectResearchRequests(segs, terms);
  assert.equal(r.length, 1);
  assert.equal(r[0].termo, 'Guerra Fria');
  assert.equal(r[0].start, 5);
});

test('detectResearchRequests pega nome próprio quando não é termo conhecido', () => {
  const segs = [{ index: 0, start: 0, end: 5, text: 'Leiam Descartes para a próxima aula.' }];
  const r = detectResearchRequests(segs, []);
  assert.equal(r.length, 1);
  assert.equal(r[0].termo, 'Descartes');
});

test('detectResearchRequests ignora "pesquisa" que não é pedido', () => {
  const segs = [{ index: 0, start: 0, end: 5, text: 'A pesquisa mostra que os resultados melhoraram muito.' }];
  const r = detectResearchRequests(segs, []);
  assert.equal(r.length, 0);
});
