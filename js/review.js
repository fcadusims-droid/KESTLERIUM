// Tela de revisão espaçada: mostra os cartões que "venceram" hoje, um a um.
// Você tenta lembrar, revela a resposta (que é uma frase real da aula) e diz
// se acertou. O app reagenda cada cartão para o melhor momento de rever.

import * as cards from './cards.js';
import { formatTime } from './format.js';
import { el } from './ui.js';

const rotuloTipo = { cloze: 'complete a frase', termo: 'conceito', data: 'data' };

export async function renderRevisao(container, ctx) {
  container.innerHTML = '';
  container.appendChild(el('a', { href: '#/', class: 'link voltar' }, '← Biblioteca'));
  container.appendChild(el('h2', {}, 'Revisão'));

  const vencidos = await cards.cartoesVencidos();
  const total = (await cards.todosCartoes()).length;

  if (!total) {
    container.appendChild(el('div', { class: 'vazio' }, [
      el('p', {}, 'Você ainda não tem cartões de revisão.'),
      el('p', { class: 'dica' }, 'Abra uma aula e clique em "Cartões" para criar cartões a partir dela.'),
    ]));
    return;
  }
  if (!vencidos.length) {
    const prox = (await cards.todosCartoes()).sort((a, b) => (a.due || 0) - (b.due || 0))[0];
    container.appendChild(el('div', { class: 'vazio' }, [
      el('p', {}, '🎉 Nada para revisar agora!'),
      el('p', { class: 'dica' }, prox ? `Próxima revisão: ${new Date(prox.due).toLocaleDateString('pt-BR')}. Você tem ${total} cartão(ões) no total.` : ''),
    ]));
    return;
  }

  const fila = vencidos.slice();
  let revisados = 0;
  const painel = el('div', { class: 'revisao-painel' });
  const progresso = el('p', { class: 'dica' });
  container.appendChild(progresso);
  container.appendChild(painel);

  function atualizarProgresso(restantes) {
    progresso.textContent = `Faltam ${restantes} cartão(ões) nesta rodada · ${revisados} revisado(s).`;
  }

  function proximo() {
    painel.innerHTML = '';
    if (!fila.length) {
      painel.appendChild(el('div', { class: 'vazio' }, [
        el('p', {}, `👏 Você revisou ${revisados} cartão(ões)!`),
        el('p', { class: 'dica' }, 'Volte amanhã para as próximas revisões.'),
        el('a', { class: 'btn btn-secundario', href: '#/' }, 'Voltar à biblioteca'),
      ]));
      atualizarProgresso(0);
      if (ctx && ctx.atualizarContadores) ctx.atualizarContadores();
      return;
    }
    const card = fila.shift();
    atualizarProgresso(fila.length + 1);

    const verso = el('div', { class: 'card-verso' });
    const notas = el('div', { class: 'card-notas' });
    const mostrar = el('button', { class: 'btn btn-primario', onclick: () => {
      verso.classList.add('revelado');
      verso.innerHTML = '';
      if (card.tipo === 'cloze') {
        verso.appendChild(el('p', {}, [el('span', { class: 'dica' }, 'Resposta: '), el('strong', {}, card.verso)]));
      } else {
        verso.appendChild(el('p', { class: 'card-frase' }, `“${card.verso}”`));
      }
      verso.appendChild(el('a', { class: 'link', href: `#/aula/${card.lessonId}?t=${Math.floor(card.start || 0)}` }, `ouvir na aula (${formatTime(card.start || 0)}) ↗`));
      mostrar.style.display = 'none';
      notas.style.display = 'flex';
    } }, 'Mostrar resposta');

    const nota = (valor) => async () => {
      const atualizado = cards.agendar(card, valor);
      await cards.salvarCartao(atualizado);
      if (valor === 0) fila.push(atualizado); // errei: volta no fim da rodada
      revisados++;
      proximo();
    };
    notas.style.display = 'none';
    notas.appendChild(el('button', { class: 'btn btn-nota nota-errei', onclick: nota(0) }, 'Errei'));
    notas.appendChild(el('button', { class: 'btn btn-nota nota-dificil', onclick: nota(1) }, 'Difícil'));
    notas.appendChild(el('button', { class: 'btn btn-nota nota-bom', onclick: nota(2) }, 'Bom'));
    notas.appendChild(el('button', { class: 'btn btn-nota nota-facil', onclick: nota(3) }, 'Fácil'));

    painel.appendChild(el('div', { class: 'card-revisao' }, [
      el('span', { class: 'card-tipo' }, rotuloTipo[card.tipo] || 'cartão'),
      el('p', { class: 'card-frente' }, card.frente),
      mostrar,
      verso,
      notas,
    ]));
  }

  proximo();
}
