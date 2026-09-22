// Tela de uma aula: tocador de áudio com transcrição sincronizada, busca
// dentro da aula, painel de termos (com edição) e pesquisa nas fontes.

import * as lessons from './lessons.js';
import * as db from './db.js';
import { formatTime, escapeHtml, makeId, normalize } from './format.js';
import { searchSegments, segmentIndexAtTime, highlight } from './search.js';
import { mergeTerms, suggestMerges } from './entities.js';
import { chapterize, keyTerms, makeTermHighlighter, gerarAtividades } from './study.js';
import { criarCartoesDaAula, cartoesDaAula } from './cards.js';
import { buildConceptGraph, layoutGraph, conceptGraphSVG, buildTimeline } from './diagrams.js';
import { mindMap, acronyms, comparisons, scaffolds } from './memorize.js';
import { annotateSpeakers, exposicao } from './speakers.js';
import { painelMapaMental, painelSiglas, painelComparacoes, painelMnemonicos, painelAnotacoes, painelQuiz } from './studypanels.js';
import { researchTerm, resolveOption, detectResearchRequests } from './research.js';
import { el, toast, confirmDialog, promptDialog, dica } from './ui.js';
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

  // Termos, destaque e capítulos — tudo fundamentado no texto real da aula.
  let termos = await lessons.gerarTermos(lessonId).catch(() => []);
  // Detecta perguntas/intervenções (não é reconhecimento de voz): o material é
  // montado a partir da EXPLICAÇÃO, não das perguntas, para não gerar algo errado.
  const infoFala = annotateSpeakers(segs);
  const segsPergunta = new Set(infoFala.segments.filter((s) => s.pergunta).map((s) => s.index));
  const expoSegs = exposicao(infoFala.segments);

  const highlighter = makeTermHighlighter(termos);
  const capitulos = chapterize(expoSegs, termos);
  const atividades = gerarAtividades(capitulos, termos);
  const grafo = buildConceptGraph(segs, termos);
  const linhaTempo = buildTimeline(segs, termos);
  const pedidosPesquisa = detectResearchRequests(segs, termos);
  let destacarTermos = true;

  // Preparo automático: garante que os cartões desta aula existam (sem botão).
  // Usa só a explicação (expoSegs), nunca as perguntas.
  criarCartoesDaAula(lessonId, expoSegs, termos, capitulos)
    .then(() => { if (ctx.atualizarContadores) ctx.atualizarContadores(); })
    .catch(() => {});

  // Para sincronizar os diagramas com o áudio: quais termos há em cada trecho,
  // e onde cada termo aparece pela primeira vez (para clicar e ouvir).
  const termosPorSeg = new Map();
  const startPorNorm = new Map();
  for (const t of termos) {
    for (const oc of (t.occurrences || [])) {
      if (!termosPorSeg.has(oc.index)) termosPorSeg.set(oc.index, new Set());
      termosPorSeg.get(oc.index).add(t.norm);
      if (!startPorNorm.has(t.norm)) startPorNorm.set(t.norm, oc.start);
    }
  }

  const busca = el('input', { class: 'campo', type: 'search', placeholder: 'Buscar uma palavra nesta aula…', 'aria-label': 'Buscar nesta aula' });
  const resultadosBusca = el('div', { class: 'resultados-busca' });
  const transcricao = el('div', { class: 'transcricao', role: 'list' });

  // Barra de estudo.
  const btnDestacar = el('button', { class: 'btn-mini ativo', onclick: () => { destacarTermos = !destacarTermos; btnDestacar.classList.toggle('ativo', destacarTermos); aplicarDestaque(); } }, '🖍️ Destacar termos');
  const roteiro = construirRoteiro(capitulos, irPara);
  const estudoGuiado = el('div', { class: 'estudo-guiado' });
  const mapaPanel = el('div', { class: 'diagrama-panel' });
  const linhaPanel = el('div', { class: 'diagrama-panel' });
  const mmPanel = el('div', { class: 'diagrama-panel' });
  const siglasPanel = el('div', { class: 'diagrama-panel' });
  const compPanel = el('div', { class: 'diagrama-panel' });
  const mnemoPanel = el('div', { class: 'diagrama-panel' });
  const notasPanel = el('div', { class: 'diagrama-panel' });
  const quizPanel = el('div', { class: 'diagrama-panel' });
  const pesquisaPanel = el('div', { class: 'diagrama-panel' });

  const barraEstudo = el('div', { class: 'barra-estudo' }, [
    el('button', { class: 'btn-mini btn-estudo', onclick: () => iniciarGuiado() }, '▶️ Estudo guiado'),
    el('button', { class: 'btn-mini', onclick: async () => { const aberto = quizPanel.classList.toggle('aberto'); if (aberto) await montarQuiz(); } }, '🎯 Quiz'),
    el('button', { class: 'btn-mini', onclick: () => { ctx.navigate('#/revisar'); } }, '🃏 Revisar cartões'),
    el('button', { class: 'btn-mini', onclick: () => togglePanel(notasPanel, () => notasPanel.appendChild(painelAnotacoes(lesson, lessons.salvarAula))) }, '📝 Anotações'),
    el('button', { class: 'btn-mini', onclick: () => togglePanel(pesquisaPanel, montarPesquisas) }, `🔎 Pesquisas pedidas (${pedidosPesquisa.length})`),
    el('button', { class: 'btn-mini', onclick: () => alternarFoco() }, '🎯 Modo foco'),
    btnDestacar,
  ]);

  function montarPesquisas() {
    pesquisaPanel.appendChild(dica('Momentos em que a AULA pediu para você pesquisar algo. A pesquisa só aparece quando o professor pede — o app não pesquisa por conta própria.'));
    if (!pedidosPesquisa.length) { pesquisaPanel.appendChild(el('p', { class: 'dica' }, 'O professor não pediu nenhuma pesquisa nesta aula.')); return; }
    for (const p of pedidosPesquisa) {
      pesquisaPanel.appendChild(el('div', { class: 'pesquisa-pedido' }, [
        el('button', { class: 'seg-tempo', onclick: () => irPara(p.start) }, formatTime(p.start)),
        el('span', { class: 'pesquisa-frase' }, `“${p.frase}”`),
        el('button', { class: 'btn-mini', onclick: () => abrirPesquisaDeTermo(p.termo) }, `🔎 pesquisar “${p.termo}”`),
      ]));
    }
  }
  function abrirPesquisaDeTermo(nome) {
    const norm = normalize(nome);
    const occurrences = [];
    for (const s of segs) if (normalize(s.text).includes(norm)) occurrences.push({ index: s.index, start: s.start });
    modalPesquisa({ name: nome, occurrences }, segs, irPara);
  }
  const barraEstudo2 = el('div', { class: 'barra-estudo' }, [
    el('button', { class: 'btn-mini', onclick: () => roteiro.classList.toggle('aberto') }, `🗺️ Roteiro (${capitulos.length})`),
    el('button', { class: 'btn-mini', onclick: () => togglePanel(mmPanel, () => { mmPanel.appendChild(painelMapaMental(mindMap(lesson.title, capitulos, termos), irPara)); atualizarLiberacao(); }) }, '🧠 Mapa mental'),
    el('button', { class: 'btn-mini', onclick: () => toggleMapa() }, `🕸️ Mapa de conexões (${grafo.nodes.length})`),
    el('button', { class: 'btn-mini', onclick: () => togglePanel(siglasPanel, () => siglasPanel.appendChild(painelSiglas(acronyms(capitulos, termos), irPara))) }, '🔤 Siglas'),
    el('button', { class: 'btn-mini', onclick: () => togglePanel(compPanel, () => compPanel.appendChild(painelComparacoes(comparisons(expoSegs, termos, grafo), irPara))) }, '⚖️ Comparar'),
    el('button', { class: 'btn-mini', onclick: () => togglePanel(mnemoPanel, () => mnemoPanel.appendChild(painelMnemonicos(scaffolds(capitulos, termos), irPara))) }, '🏛️ Mnemônicos'),
    el('button', { class: 'btn-mini', onclick: () => toggleLinha() }, `📅 Linha do tempo (${linhaTempo.length})`),
  ]);

  // Liga/desliga um painel, montando o conteúdo só na primeira vez.
  function togglePanel(panel, montar) {
    if (!panel.dataset.montado) { montar(); panel.dataset.montado = '1'; }
    panel.classList.toggle('aberto');
  }
  async function montarQuiz() {
    const todos = await cartoesDaAula(lessonId);
    const cs = todos.filter((c) => (c.start || 0) <= tempoMax + 1);
    if (!cs.length && todos.length) {
      quizPanel.innerHTML = '';
      quizPanel.appendChild(dica('As perguntas são liberadas conforme você ouve a aula. Toque um pouco e volte aqui.'));
      return;
    }
    painelQuiz(quizPanel, cs, irPara);
  }

  // Controle de ritmo: velocidade (com aviso) e repetir o trecho atual.
  let avisouVelocidade = false;
  const controlesAudio = el('div', { class: 'controles-audio' }, [
    el('span', { class: 'dica' }, 'Velocidade:'),
    ...[0.75, 1, 1.25, 1.5, 2].map((v) => el('button', {
      class: 'btn-mini' + (v === 1 ? ' ativo' : ''), 'data-vel': String(v),
      onclick: () => {
        audio.playbackRate = v;
        controlesAudio.querySelectorAll('[data-vel]').forEach((b) => b.classList.toggle('ativo', Number(b.getAttribute('data-vel')) === v));
        if (v > 1.25 && !avisouVelocidade) {
          avisouVelocidade = true;
          toast('Acelerar demais aumenta a carga mental e costuma piorar a retenção (estudos de 2025). Use com moderação em conteúdo difícil.', 'info', 6500);
        }
      },
    }, `${v}x`)),
    el('button', { class: 'btn-mini', onclick: () => repetirTrecho() }, '🔁 Repetir trecho'),
  ]);
  function repetirTrecho() {
    const i = atual >= 0 ? atual : segmentIndexAtTime(segs, audio.currentTime);
    const s = segs[i];
    if (s) irPara(s.start);
  }

  const layout = el('div', { class: 'aula-layout' }, [
    el('div', { class: 'coluna-principal' }, [
      el('div', { class: 'player-caixa' }, [audio, controlesAudio]),
      construirPreTreino(termos, irPara),
      barraEstudo,
      barraEstudo2,
      infoFala.temVariasPessoas ? el('div', { class: 'nota-fala' }, `❓ Esta aula parece ter perguntas/intervenções de outra(s) pessoa(s) (${infoFala.perguntas} detectada(s)). Elas ficam marcadas com ❓ na transcrição e NÃO entram no material de estudo — ele é montado a partir da explicação. (O app não identifica quem fala pela voz; detecta perguntas pelo texto e pelas pausas, então pode errar; corrija editando o trecho se precisar.)`) : null,
      estudoGuiado,
      quizPanel,
      notasPanel,
      pesquisaPanel,
      roteiro,
      mmPanel,
      mapaPanel,
      siglasPanel,
      compPanel,
      mnemoPanel,
      linhaPanel,
      el('div', { class: 'barra-busca' }, [busca]),
      resultadosBusca,
      transcricao,
    ]),
    el('div', { class: 'coluna-lateral' }, [await painelTermos(lesson, segs, audio, ctx)]),
  ]);
  container.appendChild(layout);

  // ---- Diagramas automáticos, que "acendem" conforme o áudio toca ----
  let mapaMontado = false;
  let linhaMontada = false;
  function toggleMapa() {
    if (!mapaMontado) { montarMapa(); mapaMontado = true; }
    mapaPanel.classList.toggle('aberto');
  }
  function toggleLinha() {
    if (!linhaMontada) { montarLinha(); linhaMontada = true; }
    linhaPanel.classList.toggle('aberto');
  }
  function montarMapa() {
    mapaPanel.appendChild(dica('Mapa de conceitos: termos ligados quando aparecem no mesmo trecho da aula. As bolinhas acendem conforme o áudio fala. Clique numa para ouvir onde ela aparece.'));
    if (grafo.nodes.length < 2) { mapaPanel.appendChild(el('p', { class: 'dica' }, 'Poucos termos para montar um mapa.')); return; }
    const wrap = el('div', { class: 'grafo-wrap' });
    wrap.innerHTML = conceptGraphSVG(layoutGraph(grafo, { width: 640, height: 420 }));
    wrap.querySelectorAll('.no-grafo').forEach((g) => {
      const norm = g.getAttribute('data-norm');
      const ir = () => { const st = startPorNorm.get(norm); if (st != null) irPara(st); };
      g.addEventListener('click', ir);
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter') ir(); });
    });
    mapaPanel.appendChild(wrap);
  }
  function montarLinha() {
    linhaPanel.appendChild(dica('Linha do tempo montada com as datas encontradas na aula. Cada evento traz uma frase da própria aula (com o horário).'));
    if (!linhaTempo.length) { linhaPanel.appendChild(el('p', { class: 'dica' }, 'Nenhuma data encontrada nesta aula.')); return; }
    const lista = el('div', { class: 'linha-tempo' });
    for (const ev of linhaTempo) {
      lista.appendChild(el('button', { class: 'linha-evento', 'data-start': ev.start, onclick: () => irPara(ev.start) }, [
        el('span', { class: 'linha-data' }, ev.label),
        el('span', { class: 'linha-texto' }, ev.text || ''),
        el('span', { class: 'seg-tempo' }, formatTime(ev.start)),
      ]));
    }
    linhaPanel.appendChild(lista);
  }

  // Acende os nós/eventos do trecho atual.
  function sincronizarDiagramas(segIndex) {
    const norms = termosPorSeg.get(segIndex) || new Set();
    if (mapaMontado) {
      mapaPanel.querySelectorAll('.no-grafo').forEach((g) => {
        g.classList.toggle('aceso', norms.has(g.getAttribute('data-norm')));
      });
    }
    if (linhaMontada) {
      const segObj = segs[segIndex];
      linhaPanel.querySelectorAll('.linha-evento').forEach((ev) => {
        const st = Number(ev.getAttribute('data-start'));
        ev.classList.toggle('aceso', segObj && st >= segObj.start && st < segObj.end);
      });
    }
  }

  // ---- Estudo guiado: o player pausa ao fim de cada capítulo e propõe uma
  // atividade (recuperar, prever, responder uma lacuna, autoexplicar). ----
  let guiado = false;
  let capAtual = 0;
  let aguardando = false;

  function iniciarGuiado() {
    if (!atividades.length || !audio.src) { toast('Sem áudio para o estudo guiado.', 'info'); return; }
    guiado = true; capAtual = 0; aguardando = false;
    estudoGuiado.classList.add('ativo');
    toast('Estudo guiado começou. O áudio vai parar em cada parte para você pensar.', 'info', 5000);
    audio.currentTime = Math.max(0, capitulos[0].startSec + 0.01);
    audio.play().catch(() => {});
  }
  function sairGuiado() {
    guiado = false; aguardando = false;
    estudoGuiado.classList.remove('ativo');
    estudoGuiado.innerHTML = '';
  }
  function checarLimiteGuiado() {
    if (!guiado || aguardando) return;
    const cap = capitulos[capAtual];
    if (cap && audio.currentTime >= cap.endSec - 0.05) {
      aguardando = true;
      audio.pause();
      mostrarAtividade(capAtual);
    }
  }
  function mostrarAtividade(i) {
    const at = atividades[i];
    estudoGuiado.innerHTML = '';
    estudoGuiado.appendChild(cardAtividade(at, capitulos[i], i, atividades.length, {
      continuar: () => {
        aguardando = false;
        capAtual = i + 1;
        estudoGuiado.innerHTML = '';
        if (capAtual >= capitulos.length) {
          estudoGuiado.appendChild(el('div', { class: 'atividade-card' }, [
            el('h4', {}, '✅ Fim do estudo guiado'),
            el('p', {}, 'Você percorreu a aula inteira parando para pensar em cada parte. Isso fixa muito melhor do que só ouvir.'),
            el('button', { class: 'btn btn-secundario', onclick: () => sairGuiado() }, 'Concluir'),
          ]));
          guiado = false;
          return;
        }
        audio.currentTime = Math.max(0, capitulos[capAtual].startSec + 0.01);
        audio.play().catch(() => {});
      },
      sair: () => sairGuiado(),
      irPara,
    }));
    estudoGuiado.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  function alternarFoco() {
    layout.classList.toggle('foco');
    if (layout.classList.contains('foco') && segEls[atual]) segEls[atual].scrollIntoView({ block: 'center' });
  }
  function aplicarDestaque() {
    for (const { s, texto } of segTextos) {
      if (destacarTermos) texto.innerHTML = highlighter(s.text);
      else texto.textContent = s.text;
    }
  }

  // Monta os trechos clicáveis (e editáveis, para corrigir erros).
  const segEls = [];
  const segTextos = [];
  for (const s of segs) {
    const texto = el('span', { class: 'seg-texto' });
    texto.innerHTML = highlighter(s.text);
    segTextos.push({ s, texto });
    const editar = el('button', {
      class: 'seg-editar', title: 'Corrigir este trecho', 'aria-label': 'Corrigir este trecho',
      onclick: (e) => { e.stopPropagation(); abrirEdicao(s, t, texto); },
    }, '✎');
    const ehPergunta = segsPergunta.has(s.index);
    const t = el('div', {
      class: 'seg' + (ehPergunta ? ' seg-pergunta' : ''), role: 'listitem', 'data-start': s.start, tabindex: '0',
      onclick: () => irPara(s.start),
      onkeydown: (e) => { if (e.key === 'Enter') irPara(s.start); },
    }, [
      el('span', { class: 'seg-tempo' }, formatTime(s.start)),
      ehPergunta ? el('span', { class: 'seg-badge', title: 'Pergunta/intervenção (não entra no material)' }, '❓') : null,
      texto,
      editar,
    ]);
    segEls.push(t);
    transcricao.appendChild(t);
  }

  function abrirEdicao(s, segEl, textoEl) {
    if (segEl.querySelector('.seg-edicao')) return;
    const area = el('textarea', { class: 'seg-edicao', rows: '2' });
    area.value = s.text;
    const salvar = el('button', { class: 'btn-mini', onclick: async (e) => {
      e.stopPropagation();
      const novo = area.value.trim();
      await lessons.salvarTextoSegmento(lessonId, s.index, novo);
      s.text = novo; textoEl.textContent = novo;
      caixa.remove(); textoEl.style.display = '';
      toast('Trecho corrigido.', 'sucesso');
    } }, 'salvar');
    const cancelar = el('button', { class: 'btn-mini', onclick: (e) => { e.stopPropagation(); caixa.remove(); textoEl.style.display = ''; } }, 'cancelar');
    const caixa = el('div', { class: 'seg-edicao-caixa', onclick: (e) => e.stopPropagation() }, [area, el('div', { class: 'seg-edicao-acoes' }, [salvar, cancelar])]);
    textoEl.style.display = 'none';
    textoEl.after(caixa);
    setTimeout(() => area.focus(), 30);
  }

  function irPara(segundos) {
    if (!audio.src) return;
    audio.currentTime = Math.max(0, segundos + 0.01);
    audio.play().catch(() => {});
  }

  // Liberação progressiva: o material já existe, mas só é liberado conforme o
  // player avança. Guardamos o ponto máximo já alcançado (voltar não re-bloqueia).
  let tempoMax = 0;
  let capsLiberados = capitulos.filter((c) => c.startSec <= 0.1).length;
  function atualizarLiberacao() {
    tempoMax = Math.max(tempoMax, audio.currentTime);
    const container = layout;
    container.querySelectorAll('.roteiro-item[data-start], .mm-ramo[data-start]').forEach((elm) => {
      const st = Number(elm.getAttribute('data-start'));
      elm.classList.toggle('bloqueado', st > tempoMax + 0.1);
    });
    const liberadosAgora = capitulos.filter((c) => c.startSec <= tempoMax + 0.1).length;
    if (liberadosAgora > capsLiberados) {
      capsLiberados = liberadosAgora;
      toast('🔓 Novo trecho de estudo liberado.', 'info', 2500);
    }
  }

  atualizarLiberacao(); // estado inicial dos bloqueios

  // Destaca o trecho atual conforme o áudio toca.
  let atual = -1;
  audio.addEventListener('timeupdate', () => {
    checarLimiteGuiado();
    atualizarLiberacao();
    const idx = segmentIndexAtTime(segs, audio.currentTime);
    if (idx !== atual && idx >= 0) {
      if (segEls[atual]) segEls[atual].classList.remove('seg-atual');
      atual = idx;
      sincronizarDiagramas(atual);
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

// -------- Pré-treinamento: conhecer os termos-chave antes de ouvir --------
function construirPreTreino(termos, irPara) {
  const chaves = keyTerms(termos, 8);
  if (!chaves.length) return el('span', {});
  const chips = chaves.map((k) => el('button', {
    class: `chip-pretreino hl-${k.kind || 'nome'}`, title: `Ouvir onde aparece (${formatTime(k.start)})`,
    onclick: () => irPara(k.start),
  }, `${k.name} · ${formatTime(k.start)}`));
  const det = el('details', { class: 'pre-treino', open: true }, [
    el('summary', {}, 'Prepare-se: termos-chave desta aula'),
    dica('Conhecer estes termos antes ajuda a entender melhor. Clique num deles para ouvir onde aparece. (Foram tirados da própria aula.)'),
    el('div', { class: 'pretreino-chips' }, chips),
  ]);
  return det;
}

// -------- Roteiro automático (capítulos com a frase-chave da própria aula) --------
function construirRoteiro(capitulos, irPara) {
  const box = el('div', { class: 'roteiro' });
  box.appendChild(dica('Roteiro montado automaticamente. Cada trecho mostra uma frase da PRÓPRIA aula (com o horário) — o app não inventa resumo.'));
  if (!capitulos.length) { box.appendChild(el('p', { class: 'dica' }, 'Sem capítulos.')); return box; }
  capitulos.forEach((c, i) => {
    box.appendChild(el('div', { class: 'roteiro-item', 'data-start': c.startSec }, [
      el('button', { class: 'roteiro-titulo', onclick: () => irPara(c.startSec) }, [
        el('span', { class: 'roteiro-num' }, String(i + 1)),
        el('span', {}, c.titulo || `Parte ${i + 1}`),
        el('span', { class: 'cadeado', title: 'Libera quando você chegar aqui' }, '🔒'),
        el('span', { class: 'seg-tempo' }, formatTime(c.startSec)),
      ]),
      el('button', { class: 'roteiro-frase', title: `Ouvir (${formatTime(c.fraseChave.start)})`, onclick: () => irPara(c.fraseChave.start) }, [
        el('span', { class: 'aspas' }, '“'),
        el('span', {}, c.fraseChave.text),
        el('span', { class: 'seg-tempo' }, formatTime(c.fraseChave.start)),
      ]),
    ]));
  });
  return box;
}

// -------- Card de atividade do estudo guiado (Fase C) --------
function cardAtividade(at, cap, i, total, h) {
  const card = el('div', { class: 'atividade-card' });
  card.appendChild(el('div', { class: 'atividade-topo' }, [
    el('span', { class: 'atividade-progresso' }, `Parte ${i + 1} de ${total}`),
    el('button', { class: 'btn-mini', onclick: () => h.sair() }, 'sair do estudo guiado'),
  ]));

  const revelarTrecho = () => el('button', { class: 'roteiro-frase', onclick: () => h.irPara(cap.fraseChave.start) }, [
    el('span', { class: 'aspas' }, '“'), el('span', {}, cap.fraseChave.text), el('span', { class: 'seg-tempo' }, formatTime(cap.fraseChave.start)),
  ]);
  const btnContinuar = el('button', { class: 'btn btn-primario', onclick: () => h.continuar() }, i + 1 >= total ? 'Finalizar' : 'Continuar ▶');

  if (at.tipo === 'recuperacao') {
    card.appendChild(el('h4', {}, '🧠 Recupere de memória'));
    card.appendChild(el('p', {}, 'Sem olhar, tente lembrar: o que foi dito nesta parte? Diga em voz alta ou anote. Lembrar dá muito mais resultado do que reler.'));
    const area = el('div', { class: 'atividade-revelar' });
    card.appendChild(el('button', { class: 'btn btn-secundario', onclick: () => { area.innerHTML = ''; area.appendChild(el('p', { class: 'dica' }, 'Uma frase-chave desta parte:')); area.appendChild(revelarTrecho()); } }, 'Mostrar o trecho'));
    card.appendChild(area);
  } else if (at.tipo === 'previsao') {
    card.appendChild(el('h4', {}, '🔮 Faça um palpite'));
    card.appendChild(el('p', {}, 'O que você acha que vem a seguir? Arriscar um palpite antes de ouvir ajuda a fixar, mesmo se você errar.'));
  } else if (at.tipo === 'pergunta' && at.cloze) {
    card.appendChild(el('h4', {}, '✍️ Complete a frase'));
    card.appendChild(el('p', { class: 'atividade-cloze' }, at.cloze.pergunta));
    const input = el('input', { class: 'campo', type: 'text', placeholder: 'Sua resposta…' });
    const feedback = el('p', { class: 'dica' });
    const verificar = () => {
      const acertou = normalize(input.value) && (normalize(input.value) === normalize(at.cloze.resposta) || normalize(at.cloze.resposta).includes(normalize(input.value)));
      feedback.innerHTML = acertou ? '✅ Isso mesmo!' : `A aula usou: <strong>${escapeHtml(at.cloze.resposta)}</strong>`;
      feedback.className = acertou ? 'feedback-ok' : 'feedback-quase';
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') verificar(); });
    card.appendChild(el('div', { class: 'atividade-linha' }, [input, el('button', { class: 'btn btn-secundario', onclick: verificar }, 'Verificar')]));
    card.appendChild(feedback);
  } else if (at.tipo === 'elaborativa') {
    card.appendChild(el('h4', {}, '🤔 Pergunte "por quê?"'));
    card.appendChild(el('p', {}, 'Responda para você mesmo: Por que isto acontece? Como se liga ao que veio antes? Qual a causa e qual a consequência? Ligar as ideias fixa muito mais do que decorar solto.'));
    const area = el('div', { class: 'atividade-revelar' });
    card.appendChild(el('button', { class: 'btn btn-secundario', onclick: () => { area.innerHTML = ''; area.appendChild(el('p', { class: 'dica' }, 'Frase desta parte para pensar em cima:')); area.appendChild(revelarTrecho()); } }, 'Mostrar o trecho'));
    card.appendChild(area);
  } else if (at.tipo === 'feynman') {
    card.appendChild(el('h4', {}, '👶 Explique como para uma criança (Feynman)'));
    card.appendChild(el('p', {}, 'Explique esta parte da forma mais simples possível, como se a pessoa nunca tivesse ouvido falar disso. Onde você travar ou usar palavra difícil, é aí que você ainda não entendeu — volte ao trecho e tente de novo.'));
    const area = el('div', { class: 'atividade-revelar' });
    card.appendChild(el('textarea', { class: 'campo', rows: '3', placeholder: 'Escreva sua explicação simples…' }));
    card.appendChild(el('button', { class: 'btn btn-secundario', onclick: () => { area.innerHTML = ''; area.appendChild(el('p', { class: 'dica' }, 'Confira com a frase desta parte:')); area.appendChild(revelarTrecho()); } }, 'Mostrar o trecho'));
    card.appendChild(area);
  } else {
    card.appendChild(el('h4', {}, '🗣️ Explique com suas palavras'));
    card.appendChild(el('p', {}, 'Explique esta parte como se ensinasse alguém. Falar com as próprias palavras revela o que você realmente entendeu.'));
    const area = el('div', { class: 'atividade-revelar' });
    card.appendChild(el('textarea', { class: 'campo', rows: '3', placeholder: 'Escreva sua explicação (opcional)…' }));
    card.appendChild(el('button', { class: 'btn btn-secundario', onclick: () => { area.innerHTML = ''; area.appendChild(el('p', { class: 'dica' }, 'Confira com uma frase-chave desta parte:')); area.appendChild(revelarTrecho()); } }, 'Mostrar o trecho'));
    card.appendChild(area);
  }

  card.appendChild(el('div', { class: 'atividade-acoes' }, [btnContinuar]));
  return card;
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
  const sugestoesMerge = el('div', { class: 'sugestoes-merge' });
  box.appendChild(acoes);
  box.appendChild(sugestoesMerge);
  box.appendChild(lista);

  let termos = await lessons.gerarTermos(lesson.id);
  let mergeSource = null;

  function pintarSugestoes() {
    sugestoesMerge.innerHTML = '';
    const sugs = suggestMerges(termos).slice(0, 6);
    if (!sugs.length) return;
    sugestoesMerge.appendChild(el('p', { class: 'dica' }, 'Talvez sejam o mesmo termo. Quer juntar?'));
    for (const sug of sugs) {
      sugestoesMerge.appendChild(el('div', { class: 'sugestao-merge' }, [
        el('span', {}, `${sug.menor.name} + ${sug.maior.name}`),
        el('button', { class: 'btn-mini', onclick: () => aplicarMerge(sug) }, 'juntar'),
        el('button', { class: 'btn-mini', onclick: () => { sug._ignorado = true; sugestoesMerge.querySelector('.sugestao-merge')?.remove(); pintarSugestoes(); }, title: 'Dispensar' }, 'não'),
      ]));
    }
  }
  async function aplicarMerge(sug) {
    const unido = mergeTerms(sug.maior, sug.menor, sug.maior.name);
    unido.lessonId = lesson.id; unido.manual = true;
    await lessons.apagarTermo(lesson.id, sug.menor.id);
    await lessons.salvarTermo(unido);
    termos = termos.filter((x) => x.id !== sug.menor.id && x.id !== sug.maior.id);
    termos.push(unido); termos.sort((a, b) => b.count - a.count);
    pintarLista(); pintarSugestoes();
    toast('Termos juntados.', 'sucesso');
  }

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

  pintarLista();
  pintarSugestoes();
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
