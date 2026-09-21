# Progresso do Kestlerium

Este arquivo conta, em linguagem simples, tudo o que foi feito, o que foi
testado, o que funcionou, o que tem limitação e por quê. Escrevi para você
(que não programa) conseguir entender.

Resumo em uma frase: **está funcionando de ponta a ponta** — dá para enviar um
áudio de aula, transcrever dentro do navegador, ouvir com o texto sincronizado,
buscar trechos, ver os termos, pesquisar nas fontes e organizar em matérias,
tudo publicado como site estático no GitHub Pages.

---

## Decisões técnicas que tomei sozinho (e por quê)

1. **Transcrição: usei Transformers.js (Whisper) em vez de whisper.cpp.**
   Motivo: o Transformers.js é mais fácil de integrar num site estático (carrega
   direto de um endereço público, sem precisar compilar nada), é mantido pela
   Hugging Face e já usa a placa de vídeo (WebGPU) quando existe, caindo sozinho
   para o processador (WASM) quando não existe. Menos peças, mais robusto.

2. **Modelo padrão: "base" (com opção "tiny" e "small").**
   O "tiny" é rápido mas erra bastante em português. O "base" ficou com boa
   qualidade e ainda assim rápido nos testes (veja as medições abaixo). Deixei
   você escolher "Rápido (tiny)" para computadores mais fracos e "Preciso
   (small)" para quem tem paciência.

3. **Extração de termos por regras (heurísticas), não por um modelo de IA.**
   Testei a ideia de usar um modelo de "reconhecimento de nomes" (NER) em
   português no navegador, mas eles são grandes, lentos e pouco confiáveis. Como
   o plano permitia, usei regras simples: nomes com letra maiúscula, datas/anos
   e palavras que se repetem muito. É rápido, funciona offline e você corrige à
   mão o que estiver errado. **Limitação conhecida:** "Napoleão" e "Napoleão
   Bonaparte" são tratados como termos diferentes (o programa não sabe que são a
   mesma pessoa). Por isso existe o botão "mesclar", para você juntar.

4. **Guardei tudo no navegador (IndexedDB), inclusive o MP3.** Nada é enviado
   para a internet. A única coisa que sai do navegador é: (a) o download único do
   "programa de transcrição" (o modelo Whisper) e (b) o termo que você mandar
   pesquisar na Wikipédia/Wikidata. O áudio e a transcrição nunca saem.

5. **Backup em um único arquivo JSON (com os áudios embutidos).** É simples,
   funciona offline e não depende de nenhuma biblioteca externa. Também deixei um
   "backup só de textos" (bem menor) para quando você quiser um backup rápido.

6. **Adicionei o "coi-serviceworker".** É um arquivo pequenininho que liga o
   "modo rápido" da transcrição no GitHub Pages (permite usar vários núcleos do
   processador). Sem ele, o GitHub Pages não deixaria a transcrição usar toda a
   força do computador. Ele faz a página recarregar uma vez sozinha na primeira
   abertura — isso é normal.

7. **Otimização de memória para aulas longas.** Uma aula de 1 hora, se
   decodificada do jeito comum, ocuparia mais de 1 GB de memória e poderia travar
   um computador fraco. Mudei para o áudio ser decodificado já em 16 kHz, o que
   reduz bastante o uso de memória.

---

## Medições reais de velocidade (Fase 0 — viabilidade)

Testei de verdade, rodando o Whisper num navegador automatizado, usando **só o
processador (WASM)** — que é o cenário do computador fraco (sem placa de vídeo).

| Áudio | Modelo | Duração | Tempo de transcrição | Velocidade |
|------|--------|---------|----------------------|------------|
| Frase de teste | tiny | 9,4 s | 4,2 s | **0,44x** (mais rápido que o tempo real) |
| Frase de teste | base | 9,4 s | 8,1 s | **0,86x** |
| Trecho de uma **aula real** (a que você mandou) | base | 136 s | 38,5 s | **0,28x** |

Além disso, o "programa de transcrição" (o modelo) baixa **uma vez só** e leva
poucos segundos para carregar depois (ficou em ~5 s nos testes).

**O que isso quer dizer:** todos os resultados ficaram MUITO abaixo do limite de
"3x a duração" que combinamos. Ou seja, transcrever é rápido. Pela conta do teste
com a sua aula, uma aula de **68 minutos** levaria por volta de **~19 minutos**
de transcrição no servidor onde testei.

**Aviso honesto:** esses tempos foram medidos no computador onde eu montei o
projeto, que pode ser mais forte que o seu notebook. No seu computador pode
demorar mais (talvez 2 a 4 vezes esses tempos). Mesmo assim, continua dentro do
aceitável, e você pode deixar processando em segundo plano. Por isso a interface
já avisa que "uma aula de 1 h pode levar um tempo" e permite continuar de onde
parou se você fechar a aba.

**Qualidade real (trecho da sua aula, modelo base):**
> "Esta mensagem é dirigida a todos os meus alunos, ex-alunos, futuros alunos e
> leitores. Quando eu comecei o meu seminário de filosofia em 1987..."

Ficou bem legível. Aparecem pequenos erros (ex.: "Concílio Vaticano II" saiu
como "concilho batica no segundo"), normais num modelo gratuito que roda no
navegador. Dá para estudar tranquilamente.

---

## O que foi feito em cada fase

- **Fase 0 — Transcrição no navegador:** ✅ funciona. Web Worker (para não travar
  a tela), processamento em blocos de 30 s, barra de progresso, botão de
  cancelar, salvamento de cada bloco e retomada de onde parou.
- **Fase 1 — Transcrição navegável:** ✅ funciona. Envio de MP3, tocador com o
  texto sincronizado (a frase que está tocando fica destacada; clicar numa frase
  pula o áudio para ali), busca dentro da aula com horários clicáveis, tudo salvo
  no navegador, e backup exportar/importar com aviso visível.
- **Fase 2 — Termos e conceitos:** ✅ funciona. Painel "Termos da aula" com
  contagem, horários clicáveis e ordenação por frequência; dá para apagar,
  renomear, mesclar e adicionar termos.
- **Fase 3 — Pesquisa nas fontes:** ✅ funciona. Botão "pesquisar" em cada termo,
  consultando Wikipédia (pt com reserva em inglês) e Wikidata, sem chave. Mostra
  lado a lado "O que a aula disse" e "O que a fonte diz", com o link e a data da
  consulta, e guarda o resultado. Nunca dá selo de "verdadeiro/falso". Trata
  falta de internet com mensagem amigável e opção de tentar de novo.
- **Fase 4 — Biblioteca pessoal:** ✅ funciona. Matérias/pastas que você cria
  (inclusive subtemas), aulas organizadas por matéria, página de cada termo
  mostrando em quais aulas aparece, árvore de estudo com sugestões que você
  aceita ou dispensa, e busca global em todas as aulas.
- **Fase Final — Publicação:** ✅ pronto. Deploy automático via GitHub Actions
  para o GitHub Pages, e o guia COMO-USAR.md.
- **Grafo visual (item opcional):** ❌ não fiz. O plano dizia "só se sobrar tempo
  e nada estiver quebrado". Preferi deixar o resto sólido. Fica como sugestão
  futura.

---

## Testes automáticos que escrevi e rodei

- **Testes de lógica (19 testes, todos passando):** formatação de tempo/tamanho,
  busca (com e sem acento), extração de termos (nomes, datas, mesclagem, evitar
  falso positivo no início de frase) e leitura das respostas da Wikipédia/Wikidata.
  Rodar com: `npm test`.
- **Teste de navegador (13 verificações, todas passando):** abre o site num
  navegador de verdade e confere o cabeçalho, o aviso de backup, a tela de ajuda,
  a inserção no banco, a transcrição na tela, a extração de termos, a busca, o
  modal de pesquisa e a criação de matéria. Rodar com: `node tests/browser.mjs`.
- **Teste real de transcrição:** o `tests/whisper-check.mjs` baixa o modelo e
  transcreve um áudio de verdade, medindo a velocidade (foi como fiz as medições
  acima).

---

## Limitações honestas (o que NÃO é perfeito)

1. **Velocidade depende do seu computador.** Sem placa de vídeo compatível
   (WebGPU), usa o processador e fica mais lento. Ainda assim é utilizável.
2. **A transcrição erra às vezes**, principalmente nomes próprios e termos
   técnicos. É esperado num modelo gratuito. Você pode corrigir os termos à mão.
3. **A extração de termos é por regras simples.** Vai pegar alguns falsos
   positivos e deixar passar alguns termos. Por isso a edição manual existe.
4. **Os dados ficam só no navegador.** Se você limpar os dados do navegador ou
   trocar de computador sem backup, perde tudo. **Faça backup.**
5. **A primeira transcrição precisa de internet** para baixar o modelo (uma vez).
   Depois disso, a transcrição funciona offline. A pesquisa nas fontes sempre
   precisa de internet.
6. **Não testei uma aula inteira de 68 min do início ao fim** no meu ambiente de
   montagem (seria muito demorado ali). Testei um trecho real e medi a velocidade;
   o teste da aula completa é melhor fazer no seu computador.

---

## O que você precisa fazer (só você pode)

- Ativar o GitHub Pages no modo "GitHub Actions" (o passo a passo está no
  COMO-USAR.md). Você disse que já preparou o repositório para Actions — ótimo.
- Enviar suas aulas e, principalmente, **fazer backup de vez em quando.**

---

## Atualização — Kestlerium 2.0 (Estudo Ativo)

A pedido, comecei a transformar o app numa ferramenta de estudo ativo baseada
na ciência da aprendizagem multimídia, e a resolver as limitações registradas.
Reforço importante: **o "narrador" do estudo é sempre a voz da própria aula que
você enviou** — todo o app é construído em volta dela. O que ficou de fora é
apenas *inventar* um narrador/professor que não existe.

### Fase A — Correções das limitações (pronta e testada)

- **Transcrição editável:** agora dá para corrigir o texto de qualquer trecho à
  mão (resolve a limitação dos erros de reconhecimento). O trecho corrigido fica
  marcado e é salvo no navegador.
- **Sugestão de mesclagem de termos (correferência):** o app sugere juntar termos
  que provavelmente são o mesmo (ex.: "Napoleão" e "Napoleão Bonaparte"), com um
  clique. Resolve a limitação da falta de correferência.
- **Backup mais seguro:** o app agora lembra quando foi seu último backup e mostra
  um aviso mais forte (vermelho) quando faz tempo ou você adicionou várias aulas.
  Em Chrome/Edge, dá para **escolher uma pasta** e salvar o backup direto nela.
- Testes: 21 testes de lógica + 14 verificações de navegador, todos passando
  (incluindo um teste que corrige um trecho e confere que foi salvo).
