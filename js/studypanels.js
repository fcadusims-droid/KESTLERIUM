// Painéis das mecânicas de memorização (parte visual). Tudo montado da aula.
import { el, dica, toast } from './ui.js';
import { formatTime } from './format.js';

// Mapa mental hierárquico: aula -> capítulos -> termos.
export function painelMapaMental(mind, irPara) {
  const box = el('div', {});
  box.appendChild(dica('Mapa mental: a aula no centro, os capítulos como ramos e os termos-chave em cada um. Clique num termo para ouvir onde aparece.'));
  box.appendChild(el('div', { class: 'mm-centro' }, mind.centro));
  const ramos = el('div', { class: 'mm-ramos' });
  for (const r of mind.ramos) {
    ramos.appendChild(el('div', { class: 'mm-ramo' }, [
      el('button', { class: 'mm-ramo-titulo', onclick: () => irPara(r.start) }, [el('span', {}, r.titulo), el('span', { class: 'seg-tempo' }, formatTime(r.start))]),
      el('div', { class: 'mm-filhos' }, r.filhos.map((f) => el('button', { class: 'chip-tempo', onclick: () => irPara(f.start) }, f.name))),
    ]));
  }
  box.appendChild(ramos);
  if (!mind.ramos.length) box.appendChild(el('p', { class: 'dica' }, 'Poucos termos para montar o mapa mental.'));
  return box;
}

// Siglas mnemônicas: iniciais dos termos de cada capítulo.
export function painelSiglas(siglas, irPara) {
  const box = el('div', {});
  box.appendChild(dica('Siglas para memorizar: junte as iniciais dos termos de cada parte e invente uma frase que te faça lembrar deles. As iniciais e os termos são da própria aula.'));
  if (!siglas.length) { box.appendChild(el('p', { class: 'dica' }, 'Sem siglas para esta aula.')); return box; }
  for (const s of siglas) {
    box.appendChild(el('div', { class: 'sigla-item' }, [
      el('div', { class: 'sigla-cabecalho' }, [el('span', { class: 'sigla-letras' }, s.iniciais), el('button', { class: 'seg-tempo', onclick: () => irPara(s.start) }, s.titulo)]),
      el('div', { class: 'termo-horarios' }, s.termos.map((t, i) => el('button', { class: 'chip-tempo', onclick: () => irPara(t.start) }, `${s.iniciais[i] || ''} — ${t.name}`))),
    ]));
  }
  return box;
}

// Comparação de conceitos, lado a lado.
export function painelComparacoes(pares, irPara) {
  const box = el('div', {});
  box.appendChild(dica('Compare conceitos que aparecem juntos: veja em que se parecem e em que diferem. As frases são da própria aula.'));
  if (!pares.length) { box.appendChild(el('p', { class: 'dica' }, 'Sem pares para comparar nesta aula.')); return box; }
  for (const p of pares) {
    box.appendChild(el('div', { class: 'comparacao' }, [
      ladoComparacao(p.a, irPara),
      el('div', { class: 'comparacao-vs' }, 'x'),
      ladoComparacao(p.b, irPara),
    ]));
  }
  return box;
}
function ladoComparacao(item, irPara) {
  return el('div', { class: 'comparacao-lado' }, [
    el('button', { class: 'comparacao-nome', onclick: () => irPara(item.start) }, item.name),
    el('p', { class: 'comparacao-frase' }, `“${item.text}”`),
    el('button', { class: 'seg-tempo', onclick: () => irPara(item.start) }, formatTime(item.start)),
  ]);
}

// Andaimes (você cria): palácio da memória / imagens / histórias.
export function painelMnemonicos(sequencia, irPara) {
  const box = el('div', {});
  box.appendChild(dica('Estas técnicas dependem da SUA imaginação — o app só prepara os termos na ordem; você cria as associações (é isso que faz a memória funcionar).'));
  if (!sequencia.length) { box.appendChild(el('p', { class: 'dica' }, 'Poucos termos para montar.')); return box; }
  box.appendChild(el('h5', {}, '🏛️ Palácio da memória'));
  box.appendChild(el('p', { class: 'dica' }, 'Imagine um lugar que você conhece bem (sua casa) e coloque cada termo, em ordem, num cômodo. Para lembrar, "caminhe" pelo lugar.'));
  box.appendChild(el('ol', { class: 'mnemo-lista' }, sequencia.map((t) => el('li', {}, [el('button', { class: 'chip-tempo', onclick: () => irPara(t.start) }, t.name)]))));
  box.appendChild(el('h5', {}, '🖼️ Imagem e 📖 história'));
  box.appendChild(el('p', { class: 'dica' }, 'Crie uma imagem marcante para cada termo, ou uma pequena história que ligue todos eles na ordem acima. Quanto mais absurda, mais fácil de lembrar.'));
  return box;
}

// Anotações da aula (salvas). Estrutura simples com dicas de campos.
export function painelAnotacoes(lesson, salvarAula) {
  const box = el('div', {});
  box.appendChild(dica('Anote com suas palavras (isso ajuda a fixar). Sugestão: conceito principal, exemplo, dúvida, e como se liga a algo que você já sabe.'));
  const area = el('textarea', { class: 'campo', rows: '8', placeholder: 'Conceito principal:\n\nExemplo:\n\nDúvida:\n\nLiga-se com:' });
  area.value = lesson.notes || '';
  let timer = null;
  const salvar = async () => { lesson.notes = area.value; await salvarAula(lesson); toast('Anotações salvas.', 'sucesso', 1500); };
  area.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(salvar, 1200); });
  area.addEventListener('blur', salvar);
  box.appendChild(area);
  return box;
}

// Quiz (practice testing): passa pelos cartões da aula, você se autoavalia.
export function painelQuiz(box, cartoes, irPara) {
  box.innerHTML = '';
  if (!cartoes.length) { box.appendChild(el('p', { class: 'dica' }, 'Ainda não há cartões para esta aula (eles são criados automaticamente após a transcrição).')); return; }
  const fila = cartoes.slice();
  let acertos = 0; let total = 0;
  const area = el('div', {});
  box.appendChild(dica('Teste rápido: tente responder de cabeça, revele e marque se acertou. (Isto é só prática; não muda o agendamento da revisão.)'));
  box.appendChild(area);

  function proximo() {
    area.innerHTML = '';
    if (!fila.length) {
      area.appendChild(el('div', { class: 'atividade-card' }, [
        el('h4', {}, `Resultado: ${acertos}/${total}`),
        el('p', { class: 'dica' }, acertos === total ? 'Perfeito! 🎉' : 'Bom treino — os que você errou valem uma revisão.'),
      ]));
      return;
    }
    const c = fila.shift(); total++;
    const verso = el('div', { class: 'card-verso' });
    const marcar = el('div', { class: 'card-notas', style: 'display:none' }, [
      el('button', { class: 'btn btn-nota nota-facil', onclick: () => { acertos++; proximo(); } }, 'Acertei'),
      el('button', { class: 'btn btn-nota nota-errei', onclick: () => proximo() }, 'Errei'),
    ]);
    const mostrar = el('button', { class: 'btn btn-primario', onclick: () => {
      verso.classList.add('revelado');
      verso.appendChild(c.tipo === 'cloze' ? el('p', {}, [el('span', { class: 'dica' }, 'Resposta: '), el('strong', {}, c.verso)]) : el('p', { class: 'card-frase' }, `“${c.verso}”`));
      verso.appendChild(el('button', { class: 'link', onclick: () => irPara(c.start || 0) }, `ouvir (${formatTime(c.start || 0)})`));
      mostrar.style.display = 'none'; marcar.style.display = 'flex';
    } }, 'Mostrar resposta');
    area.appendChild(el('div', { class: 'card-revisao' }, [
      el('span', { class: 'card-tipo' }, `Pergunta ${total} de ${cartoes.length}`),
      el('p', { class: 'card-frente' }, c.frente),
      mostrar, verso, marcar,
    ]));
  }
  proximo();
}
