# Kestlerium

**Sua plataforma pessoal de estudos a partir de áudios de aulas — 100% no navegador.**

Envie o MP3 de uma aula de qualquer matéria e o Kestlerium:

- **transcreve** o áudio dentro do próprio navegador (Whisper via Transformers.js),
  sem enviar nada para a internet;
- mostra um **tocador com a transcrição sincronizada** (clique numa frase e o
  áudio pula para lá);
- permite **buscar** trechos por texto, com horários clicáveis;
- extrai **termos, nomes e datas** com os horários onde aparecem;
- prepara **material de estudo automático** a partir da própria aula: capítulos,
  mapa mental e de conexões, linha do tempo, siglas, comparações, **estudo
  guiado** (com pausas e perguntas), **cartões com revisão espaçada** e quiz —
  liberados conforme você avança no áudio;
- detecta **perguntas/intervenções** de outras pessoas (pelo texto e pausas) e as
  mantém fora do material de estudo;
- oferece **pesquisa** em fontes gratuitas (Wikipédia e Wikidata) **quando a
  própria aula pede** ("pesquise…"), mostrando lado a lado o que a aula disse e o
  que a fonte diz — sem julgar verdadeiro/falso;
- organiza tudo numa **biblioteca** de matérias, com busca global e árvore de
  estudo.

Os áudios e as transcrições ficam **só no seu navegador** (IndexedDB). Há
**backup** exportar/importar, porque dados de navegador podem ser apagados.

## Como usar

Veja o guia passo a passo em **[COMO-USAR.md](COMO-USAR.md)** (feito para quem não
programa): como publicar no GitHub Pages, enviar aulas, estudar e fazer backup.

O relatório do que foi feito, testado e das limitações está em
**[PROGRESSO.md](PROGRESSO.md)**.

## Para desenvolvedores

- Site estático (HTML/CSS/JS, sem servidor). Publicado no GitHub Pages via
  GitHub Actions (`.github/workflows/deploy.yml`).
- Testes de lógica: `npm test`. Teste de navegador: `node tests/browser.mjs`
  (requer Chromium/Playwright).
- Estrutura: `index.html`, `css/`, `js/` (um módulo por responsabilidade),
  `coi-serviceworker.js` (habilita multithread no Pages).

Nome da plataforma: **Kestlerium**.
