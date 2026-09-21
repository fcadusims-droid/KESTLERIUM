// Teste de navegador (não faz parte do `npm test`, pois precisa do Chromium).
// Sobe um servidor estático, abre a página e valida os fluxos principais.
// Roda com: node tests/browser.mjs
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };

const servidor = createServer(async (req, res) => {
  try {
    let caminho = decodeURIComponent(req.url.split('?')[0]);
    if (caminho === '/') caminho = '/index.html';
    const arquivo = join(raiz, normalize(caminho).replace(/^(\.\.[/\\])+/, ''));
    const dados = await readFile(arquivo);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream' });
    res.end(dados);
  } catch {
    res.writeHead(404); res.end('404');
  }
});

const resultados = [];
function checar(nome, ok) { resultados.push({ nome, ok }); console.log(`${ok ? '✓' : '✗'} ${nome}`); }

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const base = `http://localhost:${porta}`;

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('  [erro na página]', e.message));

try {
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForSelector('.marca-nome', { timeout: 15000 });
  checar('cabeçalho com o nome Kestlerium', (await page.textContent('.marca-nome')) === 'Kestlerium');
  await page.waitForSelector('.banner-backup', { timeout: 5000 });
  checar('aviso de backup aparece', await page.isVisible('.banner-backup'));
  checar('estado vazio da biblioteca', (await page.textContent('.vazio')).includes('ainda não enviou'));

  // Navegação para Ajuda.
  await page.click('a.nav-link[href="#/ajuda"]');
  await page.waitForSelector('.ajuda-secao', { timeout: 5000 });
  checar('tela de ajuda abre', (await page.textContent('h2')).includes('Ajuda'));

  // Injeta uma aula de teste no IndexedDB (simula uma transcrição pronta).
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForSelector('.marca-nome', { timeout: 15000 });
  const okInsert = await page.evaluate(async () => {
    // Cria um WAV silencioso de ~20s para o áudio de teste (permite testar o estudo guiado).
    const makeWav = (segundos, rate = 8000) => {
      const n = segundos * rate;
      const buf = new ArrayBuffer(44 + n);
      const dv = new DataView(buf);
      const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
      ws(0, 'RIFF'); dv.setUint32(4, 36 + n, true); ws(8, 'WAVE'); ws(12, 'fmt ');
      dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
      dv.setUint32(24, rate, true); dv.setUint32(28, rate, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
      ws(36, 'data'); dv.setUint32(40, n, true);
      for (let i = 0; i < n; i++) dv.setUint8(44 + i, 128);
      return new Blob([buf], { type: 'audio/wav' });
    };
    const abrir = () => new Promise((res, rej) => { const r = indexedDB.open('kestlerium', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const db = await abrir();
    const tx = db.transaction(['lessons', 'segments', 'audio'], 'readwrite');
    tx.objectStore('lessons').put({ id: 'aula_test', title: 'Aula de Teste', subjectId: null, status: 'done', progress: 1, duration: 20, modelKey: 'base', language: 'portuguese', chunksDone: [0], chunksTotal: 1, createdAt: new Date().toISOString() });
    const segs = [
      { lessonId: 'aula_test', index: 0, start: 0, end: 6, text: 'A Revolução Francesa começou em 1789.' },
      { lessonId: 'aula_test', index: 1, start: 6, end: 12, text: 'Napoleão Bonaparte subiu ao poder depois da revolução.' },
      { lessonId: 'aula_test', index: 2, start: 12, end: 18, text: 'A revolução mudou toda a Europa daquela época.' },
    ];
    for (const s of segs) tx.objectStore('segments').put(s);
    tx.objectStore('audio').put({ lessonId: 'aula_test', blob: makeWav(20), fileName: 'teste.wav', type: 'audio/wav' });
    await new Promise((res) => { tx.oncomplete = res; });
    return true;
  });
  checar('inserção de aula de teste no banco', okInsert);

  // Abre a aula e valida transcrição, termos e busca.
  await page.goto(base + '/#/aula/aula_test', { waitUntil: 'load' });
  await page.waitForSelector('.transcricao .seg', { timeout: 8000 });
  const numSeg = await page.locator('.transcricao .seg').count();
  checar('transcrição mostra os 3 trechos', numSeg === 3);

  await page.waitForSelector('.painel-termos .termo', { timeout: 8000 });
  const termos = await page.locator('.painel-termos .termo-nome').allTextContents();
  checar('extraiu "Revolução Francesa"', termos.some((t) => t.includes('Revolução Francesa')));
  checar('extraiu "Napoleão"', termos.some((t) => t.includes('Napoleão')));
  checar('extraiu a data 1789', termos.some((t) => t.includes('1789')));

  // Busca dentro da aula.
  await page.fill('.barra-busca .campo', 'europa');
  await page.waitForSelector('.resultados-busca .resultado', { timeout: 5000 });
  const nBusca = await page.locator('.resultados-busca .resultado').count();
  checar('busca dentro da aula encontra "europa"', nBusca >= 1);

  // Fase B: pré-treinamento, destaque de termos, roteiro e modo foco.
  checar('pré-treinamento mostra termos-chave', (await page.locator('.chip-pretreino').count()) >= 1);
  checar('termos destacados no texto', (await page.locator('.transcricao .termo-hl').count()) >= 1);
  await page.click('.barra-estudo button:has-text("Roteiro")');
  await page.waitForSelector('.roteiro.aberto', { timeout: 4000 });
  checar('roteiro abre com capítulos', (await page.locator('.roteiro-item').count()) >= 1);
  checar('roteiro mostra frase da própria aula', (await page.locator('.roteiro-frase').count()) >= 1);
  await page.click('.barra-estudo button:has-text("Modo foco")');
  checar('modo foco é ativado', await page.isVisible('.aula-layout.foco'));
  await page.click('.barra-estudo button:has-text("Modo foco")');

  // Fase C: estudo guiado — inicia e simula chegar ao fim do capítulo.
  await page.waitForFunction(() => { const a = document.querySelector('audio.player'); return a && !Number.isNaN(a.duration) && a.duration > 15; }, undefined, { timeout: 8000 }).catch(() => {});
  await page.click('.barra-estudo button:has-text("Estudo guiado")');
  await page.evaluate(async () => {
    const audio = document.querySelector('audio.player');
    if (audio) { audio.currentTime = 19.5; audio.dispatchEvent(new Event('timeupdate')); }
  });
  const apareceuCard = await page.waitForSelector('.atividade-card', { timeout: 5000 }).then(() => true).catch(() => false);
  checar('estudo guiado mostra atividade ao fim do capítulo', apareceuCard);
  if (apareceuCard) {
    await page.click('.atividade-card .atividade-acoes button');
    const fim = await page.waitForSelector('.atividade-card:has-text("Fim do estudo guiado")', { timeout: 4000 }).then(() => true).catch(() => false);
    checar('estudo guiado chega ao fim', fim);
  }

  // Abre a pesquisa de um termo (só valida que o modal abre).
  await page.click('.painel-termos .termo:first-child button:has-text("pesquisar")');
  await page.waitForSelector('.modal-largo', { timeout: 5000 });
  checar('modal de pesquisa abre', await page.isVisible('.colunas-pesquisa'));
  checar('mostra "O que a aula disse"', (await page.textContent('.lado-aula')).includes('O que a aula disse'));
  await page.click('.modal-topo button');

  // Corrige um trecho da transcrição (Fase A).
  await page.hover('.transcricao .seg:first-child');
  await page.click('.transcricao .seg:first-child .seg-editar');
  await page.fill('.transcricao .seg:first-child .seg-edicao', 'Texto corrigido pelo teste.');
  await page.click('.transcricao .seg:first-child .seg-edicao-acoes button:has-text("salvar")');
  await page.waitForTimeout(300);
  const textoCorrigido = await page.textContent('.transcricao .seg:first-child .seg-texto');
  checar('correção de trecho é salva', textoCorrigido === 'Texto corrigido pelo teste.');

  // Volta e cria uma matéria.
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForSelector('.marca-nome', { timeout: 15000 });
  await page.evaluate(async () => {
    const abrir = () => new Promise((res, rej) => { const r = indexedDB.open('kestlerium', 1); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const db = await abrir();
    const tx = db.transaction(['subjects'], 'readwrite');
    tx.objectStore('subjects').put({ id: 'mat1', name: 'História', parentId: null, order: 1, pinned: [] });
    await new Promise((res) => { tx.oncomplete = res; });
  });
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForSelector('.materia-nome', { timeout: 8000 });
  checar('matéria "História" aparece', (await page.locator('.materia-nome').allTextContents()).some((t) => t.includes('História')));
} catch (err) {
  checar('execução sem exceções: ' + err.message, false);
} finally {
  await browser.close();
  servidor.close();
}

const falhas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - falhas.length}/${resultados.length} verificações passaram.`);
process.exit(falhas.length ? 1 : 0);
