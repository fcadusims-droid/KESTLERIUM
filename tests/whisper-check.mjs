// Teste REAL de transcrição: decodifica um áudio, roda o Whisper no navegador
// e mede a velocidade. Uso: node tests/whisper-check.mjs /caminho/audio.mp3 [modelo]
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const audioPath = process.argv[2] || '/tmp/aula_teste.mp3';
const modelo = process.argv[3] || 'Xenova/whisper-tiny';
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4' };

const servidor = createServer(async (req, res) => {
  try {
    const url = req.url.split('?')[0];
    if (url === '/fixture.mp3') { const b = await readFile(audioPath); res.writeHead(200, { 'Content-Type': 'audio/mpeg' }); return res.end(b); }
    let caminho = decodeURIComponent(url); if (caminho === '/') caminho = '/index.html';
    const arquivo = join(raiz, normalize(caminho).replace(/^(\.\.[/\\])+/, ''));
    const conteudo = await readFile(arquivo);
    res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream' });
    res.end(conteudo);
  } catch { if (!res.headersSent) { res.writeHead(404); res.end('404'); } }
});

await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;
const proxy = process.env.HTTPS_PROXY || 'http://127.0.0.1:42997';
const browser = await chromium.launch({ executablePath: CHROME, proxy: { server: proxy, bypass: 'localhost,127.0.0.1' }, args: ['--no-sandbox', '--ignore-certificate-errors', '--allow-insecure-localhost'] });
const context = await browser.newContext({ ignoreHTTPSErrors: true });
const page = await context.newPage();
page.on('pageerror', (e) => console.log('  [pageerror]', e.message));
page.on('console', (m) => console.log('  [console]', m.text()));
let saida = { ok: false, erro: 'timeout' };
try {
  await page.goto(`http://localhost:${porta}/tests/whisper-check.html?model=${encodeURIComponent(modelo)}`, { waitUntil: 'load' });
  await page.waitForFunction(() => { const r = document.getElementById('resultado'); return r && r.textContent.includes('RESULTADO_JSON:'); }, undefined, { timeout: 290000, polling: 1000 });
  const txt = await page.textContent('#resultado');
  saida = JSON.parse(txt.replace('RESULTADO_JSON:', ''));
  console.log(await page.textContent('#log'));
} catch (e) { saida = { ok: false, erro: String(e && e.message || e) }; }
finally { await browser.close(); servidor.close(); }
console.log('\n=== RESULTADO ===');
console.log(JSON.stringify(saida, null, 2));
process.exit(saida.ok ? 0 : 1);
