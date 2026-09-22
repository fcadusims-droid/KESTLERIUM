// Detecção de perguntas/intervenções na aula.
//
// HONESTIDADE: isto NÃO é reconhecimento de voz (diarização). Não dá para saber,
// só pela voz, quem é professor e quem é aluno de forma confiável dentro do
// navegador, de graça, num computador fraco. O que fazemos aqui é detectar, pelo
// TEXTO e pelas PAUSAS, quais trechos parecem ser perguntas/intervenções. Isso
// já resolve o objetivo importante: NÃO montar material de estudo a partir de uma
// pergunta (o que geraria material errado). As perguntas são marcadas e o
// material é montado a partir da explicação.
// Função pura e testável.

import { normalize } from './format.js';

const PALAVRAS_PERGUNTA = [
  'o que', 'qual', 'quais', 'como', 'por que', 'porque', 'quando', 'onde', 'quem',
  'sera que', 'será que', 'professor', 'pode', 'poderia', 'e verdade que', 'é verdade que',
  'nao entendi', 'não entendi', 'uma duvida', 'uma dúvida', 'posso',
];

export function annotateSpeakers(segments, opts = {}) {
  const gapTurno = opts.gapTurno != null ? opts.gapTurno : 1.2;
  let turno = 0;
  let perguntas = 0;
  let interjeicoes = 0;
  const out = (segments || []).map((s, i) => {
    const gapAntes = i > 0 ? (s.start - segments[i - 1].end) : 0;
    if (i > 0 && gapAntes > gapTurno) turno++;
    const texto = String(s.text || '').trim();
    const low = normalize(texto);
    const poucasPalavras = texto.split(/\s+/).filter(Boolean).length <= 14;
    const temInterrogacao = /\?/.test(texto);
    const comecaComPergunta = poucasPalavras && PALAVRAS_PERGUNTA.some((q) => low.startsWith(normalize(q)));
    const pergunta = temInterrogacao || comecaComPergunta;
    // "interjeição": uma pergunta que começa depois de uma pausa maior — sinal de
    // que outra pessoa provavelmente interrompeu para perguntar.
    const interjeicao = pergunta && gapAntes > gapTurno;
    if (pergunta) perguntas++;
    if (interjeicao) interjeicoes++;
    return { ...s, turno, gapAntes: Math.round(gapAntes * 100) / 100, pergunta, interjeicao };
  });
  return {
    segments: out,
    perguntas,
    interjeicoes,
    // "Provavelmente há mais de uma pessoa" quando há interjeições (pergunta
    // depois de pausa). É um palpite, por isso a interface deixa isso claro.
    temVariasPessoas: interjeicoes > 0,
  };
}

// Devolve só os trechos de explicação (sem as perguntas) — base do material.
export function exposicao(segmentsAnotados) {
  return (segmentsAnotados || []).filter((s) => !s.pergunta);
}
