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
    'A pesquisa só aparece quando o professor, na fala da aula, pede para pesquisar algo ("pesquise…", "procurem…", "leiam…"). Esses momentos ficam no painel "🔎 Pesquisas pedidas", e com um clique o Kestlerium consulta a Wikipédia e o Wikidata (fontes gratuitas), mostrando lado a lado o que a aula disse e o que a fonte diz, com o link. O app nunca diz se algo é "verdadeiro" nem pesquisa por conta própria: quem confere é você.'));

  container.appendChild(secao('Corrigir a transcrição',
    'A transcrição pode errar. Passe o mouse sobre um trecho e clique no lápis (✎) para corrigir o texto à mão. Fica salvo.'));

  container.appendChild(secao('Ferramentas de estudo ativo',
    'Na tela da aula, a barra de estudo tem várias ferramentas, todas montadas a partir da PRÓPRIA aula (o app nunca inventa conteúdo):',
    '• Estudo guiado: o áudio para em cada parte e pede para você lembrar, prever, completar uma frase ou explicar — isso fixa muito mais do que só ouvir.',
    '• Roteiro: divide a aula em partes, cada uma com uma frase-chave da própria aula.',
    '• Mapa e Linha do tempo: diagramas montados sozinhos; as bolinhas e datas acendem conforme o áudio fala. Clique para ir ao trecho.',
    '• Destacar termos, Modo foco e Velocidade (com aviso: acelerar demais atrapalha a memória).'));

  container.appendChild(secao('Cartões e revisão espaçada',
    'Na aula, clique em "Criar cartões". O app gera perguntas a partir das frases da aula. Depois, no menu "Revisar", você responde os cartões do dia: o que você sabe volta mais tarde, o que erra volta logo. É a forma mais eficiente de não esquecer.'));

  container.appendChild(secao('Backup (muito importante)',
    'Seus dados ficam só neste navegador. Se você limpar os dados do navegador, trocar de computador ou o navegador apagar por falta de espaço, pode perder tudo. Por isso, clique em "Backup" de vez em quando e baixe o arquivo. Para restaurar, use "Restaurar backup".'));

  container.appendChild(secao('Problemas comuns',
    'Transcrição muito lenta: escolha a qualidade "Rápido (tiny)" ao enviar a aula, ou deixe transcrevendo à noite.',
    'A pesquisa não abre: verifique sua conexão com a internet (a pesquisa precisa de internet; a transcrição, não).',
    'Sumiu tudo: se você tinha um backup, use "Restaurar backup". Sem backup, infelizmente não há como recuperar.'));

  container.appendChild(el('p', { class: 'dica' }, 'Versão da plataforma: Kestlerium 3.0 (estudo ativo e memorização).'));
}
