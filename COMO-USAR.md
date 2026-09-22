# Como usar o Kestlerium

Guia simples, passo a passo. Não precisa saber programar.

---

## Parte 1 — Publicar o site (fazer só uma vez)

O Kestlerium é um site que roda no navegador. Para tê-lo no ar de graça, use o
GitHub Pages. Você já tem o código no GitHub. Falta ligar o Pages:

1. Abra o seu repositório no site do GitHub (github.com), na sua conta.
2. Clique na aba **Settings** (Configurações), no topo.
3. No menu da esquerda, clique em **Pages**.
4. Em **Build and deployment** → **Source**, escolha **GitHub Actions**.
5. Pronto. Agora, sempre que houver uma atualização na branch `main`, o site é
   publicado sozinho.

Para o site publicar de fato, o código precisa estar na branch `main`. Se as
mudanças estiverem em outra branch (por exemplo, uma branch de trabalho), abra o
**Pull Request** que foi criado e clique em **Merge** para levar tudo para a
`main`. Em poucos minutos o site fica no ar.

6. O endereço do seu site costuma ser:
   **https://SEU-USUARIO.github.io/KESTLERIUM/**
   (troque `SEU-USUARIO` pelo seu nome de usuário do GitHub). O endereço exato
   também aparece na própria tela **Settings → Pages** depois de publicar.

Guarde esse endereço nos favoritos. É por ele que você vai usar o Kestlerium.

> Dica: a primeira vez que abrir o site, ele pode recarregar sozinho uma vez.
> Isso é normal (é o "modo rápido" da transcrição sendo ligado).

---

## Parte 2 — Enviar uma aula

1. Abra o site do Kestlerium.
2. Clique em **➕ Enviar aula (áudio)**.
3. Escolha um arquivo de áudio (MP3, M4A, WAV…). Pode escolher vários de uma vez.
4. Na janelinha que abre, você pode ajustar:
   - **Qualidade da transcrição:** "Equilibrado (base)" é o recomendado. Se o seu
     computador for fraco e estiver muito lento, escolha "Rápido (tiny)".
   - **Idioma falado na aula:** normalmente "Português".
   - **Matéria:** opcional (pode organizar depois).
5. Clique em **Enviar e transcrever**. A transcrição começa sozinha.

> **Sobre o tempo:** a primeira transcrição baixa o "programa de transcrição"
> (uma vez só). Depois, transcrever uma aula longa pode levar de alguns minutos a
> algumas horas, dependendo do computador. Você pode deixar a aba aberta em
> segundo plano. Se fechar a aba no meio, é só abrir a aula de novo e clicar em
> **Continuar transcrição** — ela retoma de onde parou.

---

## Parte 3 — Estudar com a aula

Quando a transcrição termina, abra a aula. Você verá:

- **O tocador de áudio** e o **texto sincronizado**: a frase que está tocando
  fica destacada. Clique em qualquer frase para pular o áudio para aquele momento.
- **A busca**: digite uma palavra para achar onde ela aparece e clique no horário
  para ir direto ao trecho.
- **Termos da aula** (na lateral): nomes, conceitos e datas encontrados, com os
  horários. Você pode **apagar** os errados, **renomear**, **mesclar** dois iguais
  e **adicionar** um que faltou.
- **Pesquisar** (em cada termo): consulta a Wikipédia e o Wikidata e mostra, lado
  a lado, o que a sua aula disse e o que a fonte diz, com o link. O Kestlerium
  nunca diz se algo é "verdadeiro" — quem confere é você.

Na tela inicial (**Biblioteca**) você organiza tudo em **matérias**, vê o
**Índice de termos** e faz **busca em todas as aulas** ao mesmo tempo.

---

## Parte 3.5 — Ferramentas de estudo ativo

Na tela da aula há uma barra de estudo. Tudo é montado a partir da **própria
aula** — o app nunca inventa conteúdo, só organiza e aponta o trecho exato.

- **▶️ Estudo guiado:** o áudio para em cada parte e pede para você lembrar,
  prever, completar uma frase ou explicar. Parar para pensar fixa muito mais do
  que só ouvir.
- **🗺️ Roteiro:** divide a aula em partes, cada uma com uma frase-chave da aula.
- **🕸️ Mapa** e **📅 Linha do tempo:** diagramas automáticos; as bolinhas e as
  datas acendem conforme o áudio fala. Clique para ir ao trecho.
- **🖍️ Destacar termos**, **🎯 Modo foco** e **Velocidade** (com um aviso: acelerar
  demais atrapalha a memória).
- **🃏 Criar cartões:** gera perguntas a partir da aula. Depois use o menu
  **Revisar** para estudar os cartões do dia (revisão espaçada: o que você sabe
  volta mais tarde; o que erra volta logo).
- Para **corrigir** um erro da transcrição, passe o mouse sobre o trecho e clique
  no lápis (✎).

## Parte 4 — Backup (muito importante!)

Seus dados (áudios e transcrições) ficam **só no seu navegador**. Se você limpar
os dados do navegador, trocar de computador, ou o navegador apagar por falta de
espaço, **você pode perder tudo**. Por isso:

1. Na Biblioteca, clique em **💾 Backup**.
2. Clique em **⬇️ Baixar backup completo (com áudios)** e guarde o arquivo num
   lugar seguro (pen drive, nuvem, etc.). Faça isso de vez em quando.
   - Se quiser algo rápido e leve, use **Baixar backup só de textos** (não inclui
     os áudios).
3. Para restaurar depois (ou em outro computador): **💾 Backup → ⬆️ Restaurar
   backup** e escolha o arquivo que você guardou.

---

## Parte 5 — Problemas comuns

- **A transcrição está muito lenta.**
  Escolha a qualidade "Rápido (tiny)" ao enviar a aula, ou deixe transcrevendo à
  noite com a aba aberta. Fechar a aba não perde o progresso.

- **A página recarregou sozinha ao abrir.**
  É normal, acontece uma vez (é o "modo rápido" sendo ligado).

- **A pesquisa nas fontes não abre / dá erro.**
  A pesquisa precisa de internet. Verifique sua conexão e clique em "Tentar de
  novo". (A transcrição, essa sim, funciona sem internet depois do primeiro uso.)

- **Sumiu tudo!**
  Se você tinha um backup, use **Restaurar backup**. Sem backup, infelizmente não
  dá para recuperar. (Reforçando: faça backup.)

- **O site não abre / página em branco.**
  Confira se o GitHub Pages está publicado (Parte 1) e se você abriu o endereço
  certo (`https://SEU-USUARIO.github.io/KESTLERIUM/`). Use um navegador atualizado
  (Chrome, Edge ou Firefox recentes).

- **Quero mais precisão na transcrição.**
  Envie a aula escolhendo a qualidade "Preciso (small)". Fica bem mais lento, mas
  erra menos.

Qualquer dúvida, há também a aba **Ajuda** dentro do próprio site.
