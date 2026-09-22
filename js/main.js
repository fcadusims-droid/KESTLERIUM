// Ponto de partida do Kestlerium: monta a página, controla a navegação entre
// as telas e cuida das transcrições que rodam em segundo plano.

import * as lessons from './lessons.js';
import { TranscriptionJob } from './transcriber.js';
import { renderAula } from './player.js';
import { renderBiblioteca, renderTermoGlobal, renderIndiceTermos } from './views.js';
import { renderRevisao } from './review.js';
import { contarVencidos, criarCartoesDaAula } from './cards.js';
import { chapterize } from './study.js';
import { annotateSpeakers, exposicao } from './speakers.js';
import { renderAjuda } from './help.js';
import { el, toast } from './ui.js';

const app = document.getElementById('app');

// ---- Gerenciador de transcrições (continua mesmo trocando de tela) ----
const jobs = new Map(); // lessonId -> { job, ativo, progress, subscribers: Set }

function notificar(lessonId, evento, ...args) {
  const st = jobs.get(lessonId);
  if (!st) return;
  for (const sub of st.subscribers) {
    if (typeof sub[evento] === 'function') { try { sub[evento](...args); } catch { /* ignora */ } }
  }
}

async function iniciarTranscricao(lessonId, handlers) {
  let st = jobs.get(lessonId);
  if (!st) { st = { job: null, ativo: false, progress: 0, subscribers: new Set() }; jobs.set(lessonId, st); }
  if (handlers && Object.keys(handlers).length) st.subscribers.add(handlers);
  if (st.ativo) return;

  const lesson = await lessons.obterAula(lessonId);
  const blob = await lessons.obterAudio(lessonId);
  if (!lesson || !blob) { toast('Áudio não encontrado para esta aula.', 'erro'); return; }
  st.progress = lesson.progress || 0;
  st.ativo = true;

  const job = new TranscriptionJob(lesson, blob, {
    onProgress: (p) => { st.progress = p; notificar(lessonId, 'onProgress', p); },
    onModelProgress: (d) => notificar(lessonId, 'onModelProgress', d),
    onDevice: (d) => notificar(lessonId, 'onDevice', d),
    onSegments: (segs) => notificar(lessonId, 'onSegments', segs),
    onDone: async (l) => {
      st.ativo = false;
      // Preparo automático: gera termos e cartões assim que a transcrição termina.
      try {
        const segs = await lessons.obterSegmentos(l.id);
        const termos = await lessons.gerarTermos(l.id);
        const expo = exposicao(annotateSpeakers(segs).segments); // material só da explicação
        await criarCartoesDaAula(l.id, expo, termos, chapterize(expo, termos));
      } catch { /* segue mesmo se falhar */ }
      notificar(lessonId, 'onDone', l);
      atualizarContadores();
    },
    onError: (e) => { st.ativo = false; notificar(lessonId, 'onError', e); toast('A transcrição falhou: ' + (e && e.message || e), 'erro'); },
  });
  st.job = job;
  job.start();
}

function cancelarTranscricao(lessonId) {
  const st = jobs.get(lessonId);
  if (st && st.job) { st.job.cancel(); st.ativo = false; }
}

function estadoJob(lessonId) {
  const st = jobs.get(lessonId);
  return st ? { ativo: st.ativo, progress: st.progress } : null;
}

function assinarJob(lessonId, handlers) {
  const st = jobs.get(lessonId);
  if (st) st.subscribers.add(handlers);
}

// ---- Navegação ----
let limpezas = [];
function limparTela() { for (const fn of limpezas) { try { fn(); } catch { /* ignora */ } } limpezas = []; }

const ctx = {
  navigate: (hash) => { if (location.hash === hash) rotear(); else location.hash = hash; },
  recarregar: () => rotear(),
  aoSair: (fn) => limpezas.push(fn),
  iniciarTranscricao,
  cancelarTranscricao,
  estadoJob,
  assinarJob,
  atualizarContadores,
};

function parseHash() {
  const h = location.hash || '#/';
  const [caminho, query] = h.slice(1).split('?');
  const params = new URLSearchParams(query || '');
  const partes = caminho.split('/').filter(Boolean); // ex.: ['aula','ID']
  return { partes, params };
}

async function rotear() {
  limparTela();
  marcarNavAtiva();
  atualizarContadores();
  const { partes, params } = parseHash();
  try {
    if (!partes.length) return void renderBiblioteca(app, ctx);
    if (partes[0] === 'aula') return void renderAula(app, decodeURIComponent(partes[1] || ''), ctx, params.get('t') ? Number(params.get('t')) : null);
    if (partes[0] === 'termos') return void renderIndiceTermos(app, ctx);
    if (partes[0] === 'termo') return void renderTermoGlobal(app, decodeURIComponent(partes[1] || ''), ctx);
    if (partes[0] === 'revisar') return void renderRevisao(app, ctx);
    if (partes[0] === 'ajuda') return void renderAjuda(app, ctx);
    renderBiblioteca(app, ctx);
  } catch (err) {
    app.innerHTML = '';
    app.appendChild(el('p', { class: 'aviso' }, 'Ocorreu um erro ao abrir esta tela: ' + (err && err.message || err)));
    app.appendChild(el('p', {}, [el('a', { class: 'link', href: '#/' }, 'Voltar para a biblioteca')]));
  }
}

function marcarNavAtiva() {
  const h = location.hash || '#/';
  document.querySelectorAll('.nav-link').forEach((a) => {
    a.classList.toggle('ativo', a.getAttribute('href') === h || (a.getAttribute('href') === '#/' && h === '#/'));
  });
}

// ---- Ao iniciar: transcrições interrompidas viram "pausadas" ----
async function ajustarInterrompidas() {
  try {
    const aulas = await lessons.listarAulas();
    for (const a of aulas) {
      if (a.status === 'transcribing') { a.status = 'paused'; await lessons.salvarAula(a); }
    }
  } catch { /* banco pode ainda não existir */ }
}

// ---- Cabeçalho ----
function montarCabecalho() {
  const header = document.getElementById('cabecalho');
  header.innerHTML = '';
  header.appendChild(el('div', { class: 'cabecalho-inner' }, [
    el('a', { class: 'marca', href: '#/' }, [el('span', { class: 'marca-nome' }, 'Kestlerium'), el('span', { class: 'marca-sub' }, 'suas aulas viram estudo')]),
    el('nav', { class: 'nav' }, [
      el('a', { class: 'nav-link', href: '#/' }, 'Biblioteca'),
      el('a', { class: 'nav-link', href: '#/termos' }, 'Termos'),
      el('a', { class: 'nav-link', id: 'nav-revisar', href: '#/revisar' }, 'Revisar'),
      el('a', { class: 'nav-link', href: '#/ajuda' }, 'Ajuda'),
    ]),
  ]));
}

async function atualizarContadores() {
  try {
    const n = await contarVencidos();
    const link = document.getElementById('nav-revisar');
    if (link) {
      link.textContent = n > 0 ? `Revisar (${n})` : 'Revisar';
      link.classList.toggle('tem-pendencia', n > 0);
    }
  } catch { /* ignora */ }
}

async function iniciar() {
  montarCabecalho();
  await ajustarInterrompidas();
  window.addEventListener('hashchange', rotear);
  // Aviso ao fechar a aba enquanto transcreve.
  window.addEventListener('beforeunload', (e) => {
    for (const st of jobs.values()) if (st.ativo) { e.preventDefault(); e.returnValue = ''; return; }
  });
  rotear();
}

iniciar();
