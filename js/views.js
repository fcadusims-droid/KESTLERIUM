// Telas principais: a Biblioteca (início) e a página de um termo entre aulas.

import * as lessons from './lessons.js';
import * as subjects from './subjects.js';
import * as library from './library.js';
import { exportarBackup, importarBackup, estadoBackup, suportaPastaBackup, escolherPastaBackup, temPastaBackup, salvarBackupNaPasta } from './backup.js';
import { estimateStorage } from './db.js';
import { formatTime, humanSize, humanDuration, escapeHtml, normalize } from './format.js';
import { el, toast, confirmDialog, promptDialog, dica, ajuda } from './ui.js';
import { MODELS, DEFAULT_MODEL, IDIOMAS, DEFAULT_IDIOMA } from './config.js';

const rotuloStatus = {
  pending: 'aguardando', transcribing: 'transcrevendo', paused: 'pausada',
  done: 'pronta', error: 'com erro',
};

export async function renderBiblioteca(container, ctx) {
  container.innerHTML = '';
  container.appendChild(await bannerBackup(ctx));

  // Ações principais.
  const inputArquivo = el('input', { type: 'file', accept: 'audio/*,.mp3,.m4a,.wav,.ogg', style: 'display:none', multiple: true, onchange: (e) => escolherArquivos(e.target.files, ctx) });
  const acoes = el('div', { class: 'acoes-topo' }, [
    el('button', { class: 'btn btn-primario', onclick: () => inputArquivo.click() }, '➕ Enviar aula (áudio)'),
    el('button', { class: 'btn btn-secundario', onclick: () => menuBackup(ctx) }, '💾 Backup'),
    inputArquivo,
  ]);
  container.appendChild(acoes);
  container.appendChild(dica('Envie um arquivo de áudio (MP3, M4A, WAV…) de uma aula. O Kestlerium transcreve dentro do seu navegador e monta sua biblioteca de estudos. Nada é enviado para a internet.'));

  // Busca global.
  const busca = el('input', { class: 'campo campo-busca', type: 'search', placeholder: 'Buscar em todas as aulas…', 'aria-label': 'Buscar em todas as aulas' });
  const resBusca = el('div', { class: 'resultados-busca' });
  container.appendChild(el('div', { class: 'barra-busca-global' }, [busca]));
  container.appendChild(resBusca);
  let tBusca = null;
  busca.addEventListener('input', () => { clearTimeout(tBusca); tBusca = setTimeout(async () => {
    resBusca.innerHTML = '';
    const q = busca.value.trim();
    if (!q) return;
    resBusca.appendChild(el('p', { class: 'dica' }, 'Buscando…'));
    const achados = await library.buscaGlobal(q);
    resBusca.innerHTML = '';
    if (!achados.length) { resBusca.appendChild(el('p', { class: 'dica' }, `Nada encontrado para "${q}".`)); return; }
    resBusca.appendChild(el('p', { class: 'dica' }, `${achados.length} resultado(s) em todas as aulas:`));
    for (const r of achados.slice(0, 60)) {
      const html = escapeHtml(r.snippet).replace(/\u0001/g, '<mark>').replace(/\u0002/g, '</mark>');
      resBusca.appendChild(el('a', { class: 'resultado', href: `#/aula/${r.lessonId}?t=${Math.floor(r.start)}` }, [
        el('span', { class: 'resultado-aula' }, r.lessonTitle),
        el('span', { class: 'seg-tempo' }, formatTime(r.start)),
        el('span', { class: 'resultado-texto', html }),
      ]));
    }
  }, 300); });

  // Aulas e matérias.
  const aulas = await lessons.listarAulas();
  const materias = await subjects.listarMaterias();

  const cabecalho = el('div', { class: 'secao-cabecalho' }, [
    el('h2', {}, 'Minhas aulas'),
    el('div', {}, [
      el('a', { class: 'link', href: '#/termos' }, 'Índice de termos'),
      el('span', {}, '  ·  '),
      el('button', { class: 'btn-mini', onclick: async () => { const n = await promptDialog('Nome da nova matéria (ex.: História, Biologia):'); if (n) { await subjects.criarMateria(n); ctx.recarregar(); } } }, '+ nova matéria'),
    ]),
  ]);
  container.appendChild(cabecalho);

  if (!aulas.length) {
    container.appendChild(el('div', { class: 'vazio' }, [
      el('p', {}, 'Você ainda não enviou nenhuma aula.'),
      el('p', { class: 'dica' }, 'Clique em "Enviar aula (áudio)" acima para começar.'),
    ]));
    return;
  }

  const arvore = subjects.montarArvore(materias);
  const aulasPorMateria = new Map();
  for (const a of aulas) {
    const k = a.subjectId || 'sem';
    if (!aulasPorMateria.has(k)) aulasPorMateria.set(k, []);
    aulasPorMateria.get(k).push(a);
  }

  const container_materias = el('div', { class: 'arvore-materias' });
  for (const no of arvore) container_materias.appendChild(await renderNoMateria(no, aulas, aulasPorMateria, materias, ctx));
  // Aulas sem matéria.
  const semMateria = aulasPorMateria.get('sem') || [];
  if (semMateria.length) {
    const grupo = el('div', { class: 'materia' }, [el('h3', { class: 'materia-nome' }, 'Sem matéria')]);
    for (const a of semMateria) grupo.appendChild(renderLinhaAula(a, materias, ctx));
    container_materias.appendChild(grupo);
  }
  container.appendChild(container_materias);
}

async function renderNoMateria(no, aulas, aulasPorMateria, materias, ctx, nivel = 0) {
  const wrap = el('div', { class: 'materia', style: `margin-left:${nivel ? 16 : 0}px` });
  const controles = el('div', { class: 'materia-controles' }, [
    el('button', { class: 'btn-mini', title: 'Adicionar subtema', onclick: async () => { const n = await promptDialog(`Nome do subtema dentro de "${no.name}":`); if (n) { await subjects.criarMateria(n, no.id); ctx.recarregar(); } } }, '+ subtema'),
    el('button', { class: 'btn-mini', onclick: async () => { const n = await promptDialog('Novo nome:', no.name); if (n) { await subjects.renomearMateria(no.id, n); ctx.recarregar(); } } }, 'renomear'),
    el('button', { class: 'btn-mini btn-mini-perigo', onclick: async () => { if (await confirmDialog(`Apagar a matéria "${no.name}"? As aulas dentro dela ficam sem matéria (não são apagadas).`, { okText: 'Apagar', perigo: true })) { await subjects.apagarMateria(no.id); ctx.recarregar(); } } }, 'apagar'),
  ]);
  wrap.appendChild(el('div', { class: 'materia-topo' }, [el('h3', { class: 'materia-nome' }, no.name), controles]));

  // Termos fixados (árvore de estudo).
  if (no.pinned && no.pinned.length) {
    wrap.appendChild(el('div', { class: 'termos-fixados' }, no.pinned.map((termo) =>
      el('span', { class: 'chip-termo' }, [
        el('a', { class: 'link', href: `#/termo/${encodeURIComponent(normalize(termo))}` }, termo),
        el('button', { class: 'chip-x', title: 'Remover da árvore', onclick: async () => { await subjects.desfixarTermo(no.id, termo); ctx.recarregar(); } }, '✕'),
      ]))));
  }

  // Sugestões de termos.
  const sugestoes = await library.sugestoesParaMateria(no, aulas);
  if (sugestoes.length) {
    wrap.appendChild(el('div', { class: 'sugestoes' }, [
      el('span', { class: 'dica' }, 'Sugestões para a árvore de estudo: '),
      ...sugestoes.map((s) => el('button', { class: 'chip-sugestao', title: 'Adicionar à árvore de estudo', onclick: async () => { await subjects.fixarTermo(no.id, s.name); ctx.recarregar(); } }, `+ ${s.name}`)),
    ]));
  }

  // Aulas desta matéria.
  const daMateria = aulasPorMateria.get(no.id) || [];
  for (const a of daMateria) wrap.appendChild(renderLinhaAula(a, materias, ctx));

  // Subtemas.
  for (const filho of no.filhos) wrap.appendChild(await renderNoMateria(filho, aulas, aulasPorMateria, materias, ctx, nivel + 1));
  return wrap;
}

function renderLinhaAula(a, materias, ctx) {
  const status = el('span', { class: `chip-status status-${a.status}` }, rotuloStatus[a.status] || a.status);
  const detalhe = a.status === 'transcribing' || a.status === 'paused'
    ? ` · ${Math.round((a.progress || 0) * 100)}%`
    : (a.duration ? ` · ${humanDuration(a.duration)}` : '');
  const select = el('select', { class: 'select-materia', title: 'Mover para matéria', onchange: async (e) => { const val = e.target.value || null; a.subjectId = val; await lessons.salvarAula(a); toast('Aula movida.', 'sucesso'); ctx.recarregar(); } }, [
    el('option', { value: '' }, 'Sem matéria'),
    ...materias.map((m) => el('option', { value: m.id, selected: a.subjectId === m.id }, m.name)),
  ]);
  return el('div', { class: 'linha-aula' }, [
    el('a', { class: 'aula-link', href: `#/aula/${a.id}` }, [el('span', { class: 'aula-nome' }, a.title), status, el('span', { class: 'aula-detalhe' }, detalhe)]),
    el('div', { class: 'linha-acoes' }, [
      select,
      el('button', { class: 'btn-mini btn-mini-perigo', title: 'Apagar aula', onclick: async () => { if (await confirmDialog(`Apagar a aula "${a.title}"? Isso remove o áudio e a transcrição do seu navegador. Faça um backup antes se quiser guardar.`, { okText: 'Apagar', perigo: true })) { await lessons.apagarAula(a.id); toast('Aula apagada.', 'info'); ctx.recarregar(); } } }, 'apagar'),
    ]),
  ]);
}

// -------- Página de um termo entre várias aulas --------
export async function renderTermoGlobal(container, norm, ctx) {
  container.innerHTML = '';
  container.appendChild(el('a', { href: '#/termos', class: 'link voltar' }, '← Índice de termos'));
  const indice = await library.indiceDeTermos();
  const termo = indice.find((t) => t.norm === norm);
  if (!termo) { container.appendChild(el('p', { class: 'aviso' }, 'Termo não encontrado.')); return; }
  container.appendChild(el('h2', {}, termo.name));
  container.appendChild(dica(`Aparece ${termo.total}x em ${termo.lessons.length} aula(s). Aqui só mostramos o que as suas aulas disseram.`));
  for (const l of termo.lessons) {
    const bloco = el('div', { class: 'termo-aula-bloco' }, [
      el('h4', {}, [el('a', { class: 'link', href: `#/aula/${l.lessonId}` }, l.title), el('span', { class: 'termo-contagem' }, ` ${l.count}x`)]),
      el('div', { class: 'termo-horarios' }, (l.occurrences || []).slice(0, 40).map((o) =>
        el('a', { class: 'chip-tempo', href: `#/aula/${l.lessonId}?t=${Math.floor(o.start)}` }, formatTime(o.start)))),
    ]);
    container.appendChild(bloco);
  }
}

// -------- Índice de termos (todos) --------
export async function renderIndiceTermos(container, ctx) {
  container.innerHTML = '';
  container.appendChild(el('a', { href: '#/', class: 'link voltar' }, '← Biblioteca'));
  container.appendChild(el('h2', {}, 'Índice de termos'));
  container.appendChild(dica('Todos os termos das suas aulas, juntos. Clique num termo para ver em quais aulas ele aparece.'));
  const filtro = el('input', { class: 'campo', type: 'search', placeholder: 'Filtrar termos…' });
  const lista = el('div', { class: 'indice-termos' });
  container.appendChild(filtro);
  container.appendChild(lista);
  const indice = await library.indiceDeTermos();
  function pintar(q = '') {
    lista.innerHTML = '';
    const nq = normalize(q);
    const filtrados = indice.filter((t) => !nq || t.norm.includes(nq));
    if (!filtrados.length) { lista.appendChild(el('p', { class: 'dica' }, 'Nenhum termo.')); return; }
    for (const t of filtrados.slice(0, 500)) {
      lista.appendChild(el('a', { class: 'indice-item', href: `#/termo/${encodeURIComponent(t.norm)}` }, [
        el('span', { class: 'indice-nome' }, t.name),
        el('span', { class: 'termo-contagem' }, `${t.total}x · ${t.lessons.length} aula(s)`),
      ]));
    }
  }
  filtro.addEventListener('input', () => pintar(filtro.value));
  pintar();
}

// -------- Banner de backup (lembrete que fica mais forte com o tempo) --------
async function bannerBackup(ctx) {
  const est = await estadoBackup().catch(() => ({ nunca: true, totalAulas: 0 }));
  // Sem aulas: não precisa alarmar.
  if (est.totalAulas === 0) {
    return el('div', { class: 'banner-backup' }, [
      el('span', { class: 'banner-icone' }, '⚠️'),
      el('span', {}, 'Seus dados ficam apenas neste navegador. Depois de enviar aulas, '),
      el('strong', {}, 'faça backup de vez em quando'),
      el('span', {}, '.'),
    ]);
  }
  const urgente = est.nunca || (est.diasDesde != null && est.diasDesde >= 7) || (est.aulasDesde >= 3);
  const msg = est.nunca
    ? 'Você ainda não fez nenhum backup. Se o navegador apagar os dados, você perde tudo.'
    : (urgente
        ? `Faz ${est.diasDesde} dia(s) desde o último backup${est.aulasDesde ? ` e você adicionou ${est.aulasDesde} aula(s) desde então` : ''}. É uma boa hora para fazer backup.`
        : `Último backup há ${est.diasDesde} dia(s). Seus dados ficam só neste navegador.`);
  return el('div', { class: urgente ? 'banner-backup urgente' : 'banner-backup' }, [
    el('span', { class: 'banner-icone' }, urgente ? '🔴' : '⚠️'),
    el('span', {}, msg + ' '),
    el('button', { class: 'btn-mini', onclick: () => menuBackup(ctx) }, 'Fazer backup agora'),
  ]);
}

async function escolherArquivos(fileList, ctx) {
  const arquivos = Array.from(fileList || []);
  if (!arquivos.length) return;
  const materias = await subjects.listarMaterias();
  // Formulário simples para as opções (vale para todos os arquivos escolhidos).
  const selModelo = el('select', { class: 'campo' }, Object.entries(MODELS).map(([k, m]) => el('option', { value: k, selected: k === DEFAULT_MODEL }, m.rotulo)));
  const selIdioma = el('select', { class: 'campo' }, Object.entries(IDIOMAS).map(([k, v]) => el('option', { value: k, selected: k === DEFAULT_IDIOMA }, v)));
  const selMateria = el('select', { class: 'campo' }, [el('option', { value: '' }, 'Sem matéria'), ...materias.map((m) => el('option', { value: m.id }, m.name))]);

  const overlay = el('div', { class: 'modal-overlay' });
  const nomes = arquivos.map((f) => f.name).join(', ');
  const corpo = el('div', { class: 'modal', role: 'dialog' }, [
    el('h3', {}, arquivos.length > 1 ? `Enviar ${arquivos.length} aulas` : 'Enviar aula'),
    el('p', { class: 'dica' }, nomes),
    el('label', { class: 'rotulo' }, 'Qualidade da transcrição'),
    selModelo,
    dica('"Equilibrado" é o recomendado. "Rápido" serve para computadores fracos, mas erra mais. "Preciso" é bem mais lento.'),
    el('label', { class: 'rotulo' }, 'Idioma falado na aula'),
    selIdioma,
    el('label', { class: 'rotulo' }, 'Matéria (opcional)'),
    selMateria,
    el('div', { class: 'modal-acoes' }, [
      el('button', { class: 'btn btn-secundario', onclick: () => overlay.remove() }, 'Cancelar'),
      el('button', { class: 'btn btn-primario', onclick: async () => {
        overlay.remove();
        let primeira = null;
        for (const f of arquivos) {
          const lesson = await lessons.criarAula(f, { modelKey: selModelo.value, language: selIdioma.value, subjectId: selMateria.value || null });
          if (!primeira) primeira = lesson;
          ctx.iniciarTranscricao(lesson.id, {});
        }
        toast(arquivos.length > 1 ? `${arquivos.length} aulas adicionadas. A transcrição começou.` : 'Aula adicionada. A transcrição começou.', 'sucesso');
        if (arquivos.length === 1 && primeira) ctx.navigate(`#/aula/${primeira.id}`);
        else ctx.recarregar();
      } }, 'Enviar e transcrever'),
    ]),
  ]);
  overlay.appendChild(corpo);
  document.body.appendChild(overlay);
}

async function menuBackup(ctx) {
  const { usage } = await estimateStorage();
  const inputImport = el('input', { type: 'file', accept: 'application/json,.json', style: 'display:none', onchange: async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const prog = el('p', { class: 'dica' }, 'Importando… 0%');
    corpo.appendChild(prog);
    try {
      const r = await importarBackup(f, { onProgress: (p) => { prog.textContent = `Importando… ${Math.round(p * 100)}%`; } });
      toast(`Backup restaurado: ${r.aulas} aula(s).`, 'sucesso');
      overlay.remove(); ctx.recarregar();
    } catch (err) { prog.textContent = 'Erro: ' + err.message; }
  } });

  const overlay = el('div', { class: 'modal-overlay', onclick: (e) => { if (e.target === overlay) overlay.remove(); } });
  const corpo = el('div', { class: 'modal', role: 'dialog' }, [
    el('h3', {}, 'Backup dos seus dados'),
    dica(`Espaço usado agora: aproximadamente ${humanSize(usage)}. O backup completo inclui os áudios, por isso pode ficar grande.`),
    el('div', { class: 'modal-acoes coluna' }, [
      el('button', { class: 'btn btn-primario', onclick: async () => { corpo.appendChild(el('p', { class: 'dica' }, 'Gerando backup completo… isso pode demorar um pouco.')); try { const r = await exportarBackup({ incluirAudios: true }); toast(`Backup gerado (${r.aulas} aula(s)). Guarde o arquivo em local seguro.`, 'sucesso'); } catch (e) { toast('Erro ao gerar backup: ' + e.message, 'erro'); } } }, '⬇️ Baixar backup completo (com áudios)'),
      el('button', { class: 'btn btn-secundario', onclick: async () => { try { const r = await exportarBackup({ incluirAudios: false }); toast(`Backup de textos gerado (${r.aulas} aula(s)).`, 'sucesso'); } catch (e) { toast('Erro: ' + e.message, 'erro'); } } }, '⬇️ Baixar backup só de textos (menor)'),
      el('button', { class: 'btn btn-secundario', onclick: () => inputImport.click() }, '⬆️ Restaurar backup (importar arquivo)'),
      inputImport,
      ...(suportaPastaBackup() ? [pastaBackupBotoes(corpo)] : []),
    ]),
    el('div', { class: 'modal-acoes' }, [el('button', { class: 'btn btn-secundario', onclick: () => overlay.remove() }, 'Fechar')]),
  ]);
  overlay.appendChild(corpo);
  document.body.appendChild(overlay);
}

// Botões para salvar backup direto numa pasta do computador (Chrome/Edge).
function pastaBackupBotoes(corpo) {
  const wrap = el('div', { class: 'pasta-backup' });
  const status = el('p', { class: 'dica' });
  const botaoSalvar = el('button', { class: 'btn btn-secundario', style: 'display:none', onclick: async () => {
    status.textContent = 'Salvando na pasta…';
    try { const r = await salvarBackupNaPasta({ incluirAudios: true }); status.textContent = `Backup salvo na pasta (${r.aulas} aula(s)).`; toast('Backup salvo na pasta.', 'sucesso'); }
    catch (e) { status.textContent = 'Erro: ' + e.message; }
  } }, '💾 Salvar backup agora na pasta');
  const botaoEscolher = el('button', { class: 'btn btn-secundario', onclick: async () => {
    try { await escolherPastaBackup(); botaoSalvar.style.display = ''; status.textContent = 'Pasta escolhida. Agora você pode salvar o backup nela quando quiser.'; }
    catch (e) { if (e.name !== 'AbortError') status.textContent = 'Erro: ' + e.message; }
  } }, '📁 Escolher uma pasta para os backups');
  wrap.appendChild(botaoEscolher);
  wrap.appendChild(botaoSalvar);
  wrap.appendChild(status);
  temPastaBackup().then((tem) => { if (tem) { botaoSalvar.style.display = ''; status.textContent = 'Já existe uma pasta escolhida para backups.'; } });
  return wrap;
}
