// Tela de uma aula: tocador de áudio com transcrição sincronizada, busca
// dentro da aula, painel de termos (com edição) e pesquisa nas fontes.

import * as lessons from './lessons.js';
import * as db from './db.js';
import { formatTime, escapeHtml, humanDuration, makeId, normalize } from './format.js';
import { searchSegments, segmentIndexAtTime, highlight } from './search.js';
import { mergeTerms } from './entities.js';
import { researchTerm, resolveOption } from './research.js';
import { el, toast, confirmDialog, promptDialog, dica, ajuda } from './ui.js';
import { MODELS, IDIOMAS } from './config.js';

export async function renderAula(container, lessonId, ctx, seekSec = null) {
  container.innerHTML = '';
  const lesson = await lessons.obterAula(lessonId);
  if (!lesson) {
    container.appendChild(el('p', { class: 'aviso' }, 'Aula não encontrada. Ela pode ter sido apagada.'));
    container.appendChild(el('p', {}, [el('a', { href: '#/', class: 'link' }, '← Voltar para a biblioteca')]));
    return;
  }

  const topo = el('div', { class: 'aula-topo' }, [
    el('a', { href: '#/', class: 'link voltar' }, '← Biblioteca'),
    el('h2', { class: 'aula-titulo' }, lesson.title),
    el('button', { class: 'btn-mini', title: 'Renomear aula', onclick: renomear }, '✎ renomear'),
  ]);
  container.appendChild(topo);

  async function renomear() {
    const novo = await promptDialog('Novo nome da aula:', lesson.title);
    if (novo) { lesson.title = novo; await lessons.salvarAula(lesson); topo.querySelector('.aula-titulo').textContent = novo; }
  }

  const segs = await lessons.obterSegmentos(lessonId);
  const temTranscricao = segs.length > 0;

  // ---- Área de transcrição (quando ainda não terminou) ----
  if (lesson.status !== 'done' || !temTranscricao) {
    container.appendChild(painelTranscricao(lesson, ctx));
  }

  if (!temTranscricao) return;

  // ---- Tocador + transcrição sincronizada ----
  const audioBlob = await lessons.obterAudio(lessonId);
  const audioUrl = audioBlob ? URL.createObjectURL(audioBlob) : null;
  const audio = el('audio', { class: 'player', controls: true, preload: 'metadata' });
  if (audioUrl) audio.src = audioUrl;

  // Se veio de um resultado de busca (#/aula/ID?t=NN), pula para aquele tempo.
  if (seekSec != null && !Number.isNaN(seekSec) && audioUrl) {
    const irNoInicio = () => { audio.currentTime = Math.max(0, seekSec + 0.01); audio.play().catch(() => {}); audio.removeEventListener('loadedmetadata', irNoInicio); };
    audio.addEventListener('loadedmetadata', irNoInicio);
  }

  const busca = el('input', { class: 'campo', type: 'search', placeholder: 'Buscar uma palavra nesta aula…', 'aria-label': 'Buscar nesta aula' });
  const resultadosBusca = el('div', { class: 'resultados-busca' });
  const transcricao = el('div', { class: 'transcricao', role: 'list' });

  const layout = el('div', { class: 'aula-layout' }, [
    el('div', { class: 'coluna-principal' }, [
      el('div', { class: 'player-caixa' }, [audio]),
      el('div', { class: 'barra-busca' }, [busca]),
      resultadosBusca,
      transcricao,
    ]),
    el('div', { class: 'coluna-lateral' }, [await painelTermos(lesson, segs, audio, ctx)]),
  ]);
  container.appendChild(layout);

  // Monta os trechos clicáveis.
  const segEls = [];
  for (const s of segs) {
    const t = el('div', {
      class: 'seg', role: 'listitem', 'data-start': s.start, tabindex: '0',
      onclick: () => irPara(s.start),
      onkeydown: (e) => { if (e.key === 'Enter') irPara(s.start); },
    }, [
      el('span', { class: 'seg-tempo' }, formatTime(s.start)),
      el('span', { class: 'seg-texto' }, s.text),
    ]);
    segEls.push(t);
    transcricao.appendChild(t);
  }

  function irPara(segundos) {
    if (!audio.src) return;
    audio.currentTime = Math.max(0, segundos + 0.01);
    audio.play().catch(() => {});
  }

  // Destaca o trecho atual conforme o áudio toca.
  let atual = -1;
  audio.addEventListener('timeupdate', () => {
    const idx = segmentIndexAtTime(segs, audio.currentTime);
    if (idx !== atual && idx >= 0) {
      if (segEls[atual]) segEls[atual].classList.remove('seg-atual');
      atual = idx;
      const node = segEls[atual];
      if (node) {
        node.classList.add('seg-atual');
        const r = node.getBoundingClientRect();
        if (r.top < 90 || r.bottom > window.innerHeight - 40) {
          node.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      }
    }
  });

  // Busca dentro da aula.
  let buscaTimer = null;
  busca.addEventListener('input', () => {
    clearTimeout(buscaTimer);
    buscaTimer = setTimeout(() => mostrarBusca(busca.value), 200);
  });
  function mostrarBusca(q) {
    resultadosBusca.innerHTML = '';
    const query = q.trim();
    if (!query) return;
    const achados = searchSegments(segs, query, { maxResults: 100 });
    if (!achados.length) {
      resultadosBusca.appendChild(el('p', { class: 'dica' }, `Nada encontrado para "${query}".`));
      return;
    }
    resultadosBusca.appendChild(el('p', { class: 'dica' }, `${achados.length} resultado(s):`));
    for (const r of achados) {
      const snippetHtml = escapeHtml(r.snippet).replace(/\u0001/g, '<mark>').replace(/\u0002/g, '</mark>');
      resultadosBusca.appendChild(el('button', { class: 'resultado', onclick: () => irPara(r.start) }, [
        el('span', { class: 'seg-tempo' }, formatTime(r.start)),
        el('span', { class: 'resultado-texto', html: snippetHtml }),
      ]));
    }
  }

  // Limpa o object URL quando sair da tela.
  ctx.aoSair(() => { if (audioUrl) URL.revokeObjectURL(audioUrl); });
}

// -------- Painel de transcrição (início/retomar/cancelar/progresso) --------
function painelTranscricao(lesson, ctx) {
  const box = el('div', { class: 'painel-transcricao' });
  const estado = ctx.estadoJob(lesson.id);
  const emAndamento = estado && estado.ativo;

  const titulo = el('h3', {}, emAndamento ? 'Transcrevendo…' : (lesson.status === 'paused' ? 'Transcrição pausada' : (lesson.status === 'error' ? 'A transcrição falhou' : 'Transcrever esta aula')));
  box.appendChild(titulo);

  box.appendChild(dica(
    'A transcrição acontece dentro do seu navegador (nada é enviado para a internet). ' +
    'Na primeira vez, o programa de transcrição é baixado (uma vez só). ' +
    'Em computadores mais fracos pode demorar: uma aula de 1 hora pode levar de alguns minutos a várias horas. ' +
    'Você pode deixar a aba aberta em segundo plano; se fechar, dá para continuar de onde parou.'
  ));

  const barra = el('div', { class: 'barra-progresso' }, [el('div', { class: 'barra-preenche' })]);
  const preenche = barra.querySelector('.barra-preenche');
  const rotulo = el('p', { class: 'progresso-rotulo' });
  const statusModelo = el('p', { class: 'dica modelo-status' });

  function pintar(p) {
    const pct = Math.round((p || 0) * 100);
    preenche.style.width = pct + '%';
    rotulo.textContent = `${pct}% concluído`;
  }
  pintar(lesson.progress || 0);

  const botao = el('button', { class: 'btn btn-primario' });
  const cancelar = el('button', { class: 'btn btn-secundario', style: 'display:none' }, 'Cancelar');

  function modoOcioso() {
    botao.textContent = lesson.status === 'paused' || (lesson.chunksDone && lesson.chunksDone.length) ? 'Continuar transcrição' : 'Iniciar transcrição';
    botao.style.display = '';
    cancelar.style.display = 'none';
  }
  function modoAtivo() {
    botao.style.display = 'none';
    cancelar.style.display = '';
  }

  botao.onclick = () => {
    modoAtivo();
    ctx.iniciarTranscricao(lesson.id, {
      onProgress: (p) => pintar(p),
      onModelProgress: (d) => {
        if (d.type === 'model-progress') statusModelo.textContent = `Baixando modelo de transcrição: ${Math.round(d.progress)}% (${d.file || ''})`;
        else if (d.status === 'ready') statusModelo.textContent = '';
      },
      onDevice: (dev) => { statusModelo.textContent = dev === 'webgpu' ? 'Usando a placa de vídeo (mais rápido).' : 'Usando o processador (WASM). Pode ser mais lento.'; },
      onDone: () => { toast('Transcrição concluída!', 'sucesso'); ctx.navigate(`#/aula/${lesson.id}`); ctx.recarregar(); },
      onError: (e) => { statusModelo.textContent = 'Erro: ' + (e && e.message || e); modoOcioso(); },
    });
  };
  cancelar.onclick = () => { ctx.cancelarTranscricao(lesson.id); modoOcioso(); toast('Transcrição pausada. Você pode continuar depois.', 'info'); };

  if (emAndamento) {
    modoAtivo();
    ctx.assinarJob(lesson.id, {
      onProgress: (p) => pintar(p),
      onModelProgress: (d) => { if (d.type === 'model-progress') statusModelo.textContent = `Baixando modelo: ${Math.round(d.progress)}%`; },
      onDone: () => { toast('Transcrição concluída!', 'sucesso'); ctx.navigate(`#/aula/${lesson.id}`); ctx.recarregar(); },
    });
  } else {
    modoOcioso();
  }

  const info = el('p', { class: 'dica' }, `Modelo: ${(MODELS[lesson.modelKey] || {}).rotulo || lesson.modelKey} · Idioma: ${IDIOMAS[lesson.language] || lesson.language}`);

  box.appendChild(barra);
  box.appendChild(rotulo);
  box.appendChild(statusModelo);
  box.appendChild(el('div', { class: 'acoes' }, [botao, cancelar]));
  box.appendChild(info);
  if (lesson.status === 'error' && lesson.errorMsg) {
    box.appendChild(el('p', { class: 'aviso' }, 'Detalhe do erro: ' + lesson.errorMsg));
  }
  return box;
}

// -------- Painel de termos (Fase 2) --------
async function painelTermos(lesson, segs, audio, ctx) {
  const box = el('div', { class: 'painel-termos' });
  box.appendChild(el('h3', {}, 'Termos da aula'));
  box.appendChild(dica('Nomes, conceitos e datas que apareceram na aula. Clique num horário para ouvir aquele trecho. Você pode corrigir tudo à mão.'));

  const lista = el('div', { class: 'lista-termos' });
  const acoes = el('div', { class: 'acoes-termos' });
  box.appendChild(acoes);
  box.appendChild(lista);

  let termos = await lessons.gerarTermos(lesson.id);
  let mergeSource = null;

  const btnAdicionar = el('button', { class: 'btn-mini', onclick: adicionar }, '+ adicionar termo');
  const btnRefazer = el('button', { class: 'btn-mini', title: 'Recalcula os termos a partir da transcrição (descarta suas correções)', onclick: refazer }, '↻ refazer automático');
  acoes.appendChild(btnAdicionar);
  acoes.appendChild(btnRefazer);

  function irPara(segundos) { if (audio && audio.src) { audio.currentTime = Math.max(0, segundos + 0.01); audio.play().catch(() => {}); } }

  function pintarLista() {
    lista.innerHTML = '';
    const visiveis = termos.filter((t) => !t.hidden);
    if (!visiveis.length) { lista.appendChild(el('p', { class: 'dica' }, 'Nenhum termo ainda.')); return; }
    for (const t of visiveis) {
      const badge = t.kind === 'data' ? 'data' : (t.kind === 'conceito' ? 'conceito' : 'nome');
      const cabecalho = el('div', { class: 'termo-cabecalho' }, [
        el('span', { class: `termo-nome ${mergeSource === t.id ? 'merge-ativo' : ''}`, title: 'Clique para ver os horários' }, t.name),
        el('span', { class: `etiqueta etiqueta-${badge}` }, badge),
        el('span', { class: 'termo-contagem', title: 'Quantas vezes apareceu' }, String(t.count)),
      ]);
      const controles = el('div', { class: 'termo-controles' }, [
        el('button', { class: 'btn-mini', title: 'Pesquisar nas fontes', onclick: () => abrirPesquisa(t) }, '🔎 pesquisar'),
        el('button', { class: 'btn-mini', title: 'Renomear', onclick: () => renomearTermo(t) }, 'renomear'),
        el('button', { class: 'btn-mini', title: 'Juntar com outro termo', onclick: () => iniciarMerge(t) }, 'mesclar'),
        el('button', { class: 'btn-mini btn-mini-perigo', title: 'Apagar (falso positivo)', onclick: () => apagar(t) }, 'apagar'),
      ]);
      const horarios = el('div', { class: 'termo-horarios' },
        (t.occurrences || []).slice(0, 30).map((o) =>
          el('button', { class: 'chip-tempo', onclick: () => irPara(o.start) }, formatTime(o.start))));
      const item = el('div', { class: 'termo', onclick: (e) => { if (mergeSource && mergeSource !== t.id && !e.target.closest('button')) concluirMerge(t); } }, [cabecalho, horarios, controles]);
      lista.appendChild(item);
    }
  }

  async function renomearTermo(t) {
    const novo = await promptDialog('Novo nome do termo:', t.name);
    if (!novo) return;
    t.name = novo; t.norm = normalize(novo); t.manual = true;
    await lessons.salvarTermo(t);
    pintarLista();
  }
  async function apagar(t) {
    const ok = await confirmDialog(`Apagar o termo "${t.name}"?`, { okText: 'Apagar', perigo: true });
    if (!ok) return;
    await lessons.apagarTermo(lesson.id, t.id);
    termos = termos.filter((x) => x.id !== t.id);
    pintarLista();
  }
  function iniciarMerge(t) {
    mergeSource = t.id;
    toast(`Agora clique em outro termo para juntar com "${t.name}".`, 'info', 6000);
    pintarLista();
  }
  async function concluirMerge(alvo) {
    const origem = termos.find((x) => x.id === mergeSource);
    mergeSource = null;
    if (!origem || origem.id === alvo.id) { pintarLista(); return; }
    const nome = await promptDialog('Nome do termo unido:', alvo.name.length >= origem.name.length ? alvo.name : origem.name);
    if (!nome) { pintarLista(); return; }
    const unido = mergeTerms(alvo, origem, nome);
    unido.lessonId = lesson.id; unido.manual = true;
    await lessons.apagarTermo(lesson.id, origem.id);
    await lessons.salvarTermo(unido);
    termos = termos.filter((x) => x.id !== origem.id && x.id !== alvo.id);
    termos.push(unido);
    termos.sort((a, b) => b.count - a.count);
    pintarLista();
    toast('Termos unidos.', 'sucesso');
  }
  async function adicionar() {
    const nome = await promptDialog('Qual termo você quer adicionar?');
    if (!nome) return;
    const norm = normalize(nome);
    const occurrences = [];
    for (const s of segs) { if (normalize(s.text).includes(norm)) occurrences.push({ index: s.index, start: s.start }); }
    const novo = { lessonId: lesson.id, id: makeId('t'), name: nome, norm, kind: 'nome', count: occurrences.length || 1, occurrences, hidden: false, manual: true };
    await lessons.salvarTermo(novo);
    termos.push(novo); termos.sort((a, b) => b.count - a.count);
    pintarLista();
    toast(occurrences.length ? `Encontrei "${nome}" ${occurrences.length}x.` : `"${nome}" adicionado (sem horários encontrados).`, 'sucesso');
  }
  async function refazer() {
    const ok = await confirmDialog('Refazer os termos automaticamente vai descartar suas correções manuais nesta aula. Continuar?', { okText: 'Refazer' });
    if (!ok) return;
    termos = await lessons.gerarTermos(lesson.id, { force: true });
    pintarLista();
    toast('Termos recalculados.', 'sucesso');
  }

  function abrirPesquisa(t) { modalPesquisa(t, segs, irPara); }

  pintarLista();
  return box;
}

// -------- Pesquisa nas fontes (Fase 3) --------
async function modalPesquisa(termo, segs, irPara) {
  const overlay = el('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const corpo = el('div', { class: 'modal modal-largo', role: 'dialog', 'aria-modal': 'true' });
  overlay.appendChild(corpo);
  document.body.appendChild(overlay);

  corpo.appendChild(el('div', { class: 'modal-topo' }, [
    el('h3', {}, `Pesquisar: ${termo.name}`),
    el('button', { class: 'btn-mini', onclick: () => overlay.remove() }, '✕ fechar'),
  ]));

  // Lado esquerdo: o que a aula disse.
  const ladoAula = el('div', { class: 'lado lado-aula' }, [
    el('h4', {}, 'O que a aula disse'),
    dica('Trechos desta aula onde o termo aparece. Clique no horário para ouvir.'),
  ]);
  const trechos = (termo.occurrences || []).slice(0, 20).map((o) => {
    const seg = segs.find((s) => s.index === o.index) || segs.find((s) => Math.abs(s.start - o.start) < 0.5);
    const texto = seg ? seg.text : '';
    const html = highlight(escapeHtml(texto), termo.name);
    return el('div', { class: 'trecho-aula' }, [
      el('button', { class: 'chip-tempo', onclick: () => irPara(o.start) }, formatTime(o.start)),
      el('span', { class: 'trecho-texto', html }),
    ]);
  });
  if (!trechos.length) ladoAula.appendChild(el('p', { class: 'dica' }, 'Sem trechos registrados.'));
  trechos.forEach((t) => ladoAula.appendChild(t));

  // Lado direito: o que a fonte diz.
  const ladoFonte = el('div', { class: 'lado lado-fonte' }, [el('h4', {}, 'O que a fonte diz')]);
  const areaFonte = el('div', { class: 'fonte-conteudo' }, [el('p', { class: 'dica' }, 'Pesquisando na Wikipédia e no Wikidata…')]);
  ladoFonte.appendChild(areaFonte);

  corpo.appendChild(el('div', { class: 'colunas-pesquisa' }, [ladoAula, ladoFonte]));
  corpo.appendChild(el('p', { class: 'dica rodape-fontes' }, 'As fontes são externas e independentes. O Kestlerium não julga se algo é verdadeiro ou falso: mostra o que cada fonte diz, com o link para você conferir.'));

  const chaveCache = `${normalize(termo.name)}|pt`;

  // Usa cache se já pesquisou antes.
  const cache = await db.get(db.STORES.research, chaveCache);
  if (cache && cache.resultado) {
    mostrarResultado(cache.resultado, areaFonte, termo, chaveCache, true);
    return;
  }

  const resultado = await researchTerm(termo.name, { lang: 'pt' });
  if (resultado.status === 'ok' || resultado.status === 'ambiguous') {
    await db.put(db.STORES.research, { key: chaveCache, termo: termo.name, resultado, fetchedAt: resultado.fetchedAt });
  }
  mostrarResultado(resultado, areaFonte, termo, chaveCache, false);
}

function mostrarResultado(resultado, area, termo, chaveCache, doCache) {
  area.innerHTML = '';
  if (resultado.status === 'error') {
    area.appendChild(el('p', { class: 'aviso' }, resultado.message));
    area.appendChild(el('button', { class: 'btn btn-secundario', onclick: async () => {
      area.innerHTML = ''; area.appendChild(el('p', { class: 'dica' }, 'Tentando de novo…'));
      const novo = await researchTerm(termo.name, { lang: 'pt' });
      if (novo.status === 'ok' || novo.status === 'ambiguous') await db.put(db.STORES.research, { key: chaveCache, termo: termo.name, resultado: novo, fetchedAt: novo.fetchedAt });
      mostrarResultado(novo, area, termo, chaveCache, false);
    } }, 'Tentar de novo'));
    return;
  }
  if (resultado.status === 'notfound') {
    area.appendChild(el('p', { class: 'dica' }, 'Nenhuma página encontrada na Wikipédia para este termo. Tente renomear o termo e pesquisar de novo.'));
    mostrarWikidata(resultado.wikidata, area);
    return;
  }
  if (resultado.status === 'ambiguous') {
    area.appendChild(el('p', { class: 'dica' }, 'Há mais de um significado possível. Escolha qual você quer:'));
    const ul = el('div', { class: 'opcoes' });
    for (const op of resultado.options) {
      ul.appendChild(el('button', { class: 'opcao', onclick: async () => {
        area.innerHTML = ''; area.appendChild(el('p', { class: 'dica' }, 'Carregando…'));
        const escolhido = await resolveOption(op.title, resultado.lang, termo.name);
        if (escolhido.status === 'ok') await db.put(db.STORES.research, { key: chaveCache, termo: termo.name, resultado: escolhido, fetchedAt: escolhido.fetchedAt });
        mostrarResultado(escolhido, area, termo, chaveCache, false);
      } }, [el('strong', {}, op.title), el('span', { class: 'opcao-snippet' }, op.snippet || '')]));
    }
    area.appendChild(ul);
    mostrarWikidata(resultado.wikidata, area);
    return;
  }
  // status ok
  const w = resultado.wikipedia;
  if (w) {
    const card = el('div', { class: 'fonte-card' }, [
      el('div', { class: 'fonte-cabecalho' }, [
        el('strong', {}, w.title),
        el('span', { class: 'etiqueta etiqueta-fonte' }, `Wikipédia (${(w.lang || 'pt').toUpperCase()})`),
      ]),
      el('p', { class: 'fonte-resumo' }, w.extract || 'Sem resumo disponível.'),
    ]);
    if (w.url) card.appendChild(el('a', { class: 'link', href: w.url, target: '_blank', rel: 'noopener' }, 'Abrir na Wikipédia ↗'));
    area.appendChild(card);
  }
  mostrarWikidata(resultado.wikidata, area);
  const data = resultado.fetchedAt ? new Date(resultado.fetchedAt) : null;
  if (data) area.appendChild(el('p', { class: 'dica' }, `Consultado em ${data.toLocaleDateString('pt-BR')}${doCache ? ' (guardado do seu último acesso)' : ''}.`));
}

function mostrarWikidata(wikidata, area) {
  if (!wikidata || !wikidata.length) return;
  const box = el('div', { class: 'wikidata-box' }, [el('h5', {}, 'Wikidata (dados relacionados)')]);
  for (const wd of wikidata.slice(0, 3)) {
    box.appendChild(el('div', { class: 'wikidata-item' }, [
      el('a', { class: 'link', href: wd.url, target: '_blank', rel: 'noopener' }, wd.label),
      wd.description ? el('span', { class: 'wikidata-desc' }, ' — ' + wd.description) : null,
    ]));
  }
  area.appendChild(box);
}
