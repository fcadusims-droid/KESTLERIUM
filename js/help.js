// Tela de ajuda, escrita para quem nunca usou o programa.

import { el } from './ui.js';

export async function renderAjuda(container) {
  container.innerHTML = '';
  const secao = (titulo, ...paras) => el('section', { class: 'ajuda-secao' }, [el('h3', {}, titulo), ...paras.map((p) => el('p', {}, p))]);

  container.appendChild(el('a', { href: '#/', class: 'link voltar' }, '← Biblioteca'));
  container.appendChild(el('h2', {}, 'Ajuda — como usar o Kestlerium'));

  container.appendChild(secao('O que é',
    'O Kestlerium transforma áudios de aulas em texto que você pode ler, buscar e estudar. Tudo acontece dentro do seu navegador: seus áudios não são enviados para a internet.'));

  container.appendChild(secao('Enviar uma aula',
    'Na Biblioteca, clique em "Enviar aula (áudio)" e escolha um arquivo (MP3, M4A, WAV…). Você pode escolher a qualidade da transcrição, o idioma e uma matéria. Depois, a transcrição começa sozinha.'));

  container.appendChild(secao('Sobre a transcrição (leia isto)',
    'A primeira transcrição baixa um "programa de transcrição" (uma vez só). Isso pode levar alguns minutos dependendo da internet.',
    'Em computadores mais fracos, transcrever é lento: uma aula de 1 hora pode levar de alguns minutos a várias horas. Você pode deixar a aba aberta trabalhando em segundo plano. Se fechar a aba no meio, é só abrir a aula de novo e clicar em "Continuar transcrição": ela retoma de onde parou.'));

  container.appendChild(secao('Ouvir e navegar',
    'Quando a transcrição termina, aparece o tocador de áudio e o texto. A frase que está tocando fica destacada. Clique em qualquer frase para pular o áudio para aquele momento. Use a caixa de busca para achar uma palavra e ir direto ao trecho.'));

  container.appendChild(secao('Termos da aula',
    'O Kestlerium destaca automaticamente nomes, conceitos e datas que apareceram na aula, com os horários. Isso é feito por regras simples, então pode errar: você pode apagar termos errados, renomear, juntar dois termos iguais ou adicionar um que faltou.'));

  container.appendChild(secao('Pesquisar nas fontes',
    'Em cada termo há o botão "pesquisar". Ele consulta a Wikipédia e o Wikidata (fontes gratuitas) e mostra, lado a lado, o que a sua aula disse e o que a fonte diz, sempre com o link. O Kestlerium nunca diz se algo é "verdadeiro" ou "falso": quem confere é você.'));

  container.appendChild(secao('Backup (muito importante)',
    'Seus dados ficam só neste navegador. Se você limpar os dados do navegador, trocar de computador ou o navegador apagar por falta de espaço, pode perder tudo. Por isso, clique em "Backup" de vez em quando e baixe o arquivo. Para restaurar, use "Restaurar backup".'));

  container.appendChild(secao('Problemas comuns',
    'Transcrição muito lenta: escolha a qualidade "Rápido (tiny)" ao enviar a aula, ou deixe transcrevendo à noite.',
    'A pesquisa não abre: verifique sua conexão com a internet (a pesquisa precisa de internet; a transcrição, não).',
    'Sumiu tudo: se você tinha um backup, use "Restaurar backup". Sem backup, infelizmente não há como recuperar.'));

  container.appendChild(el('p', { class: 'dica' }, 'Versão da plataforma: Kestlerium 1.0.'));
}
