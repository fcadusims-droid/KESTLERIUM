// Pesquisa em fontes externas GRATUITAS e sem chave: Wikipédia e Wikidata.
// Só o termo pesquisado sai do navegador — nunca o áudio ou a transcrição.
// Nunca afirmamos "verdadeiro/falso": mostramos o que a fonte diz, com o link.

// ---- Parte "pura" (sem internet): interpreta as respostas. Testável. ----

export function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseWikipediaSearch(json) {
  const items = json && json.query && json.query.search ? json.query.search : [];
  return items.map((it) => ({
    title: it.title,
    snippet: stripHtml(it.snippet || ''),
  }));
}

export function parseWikipediaSummary(json, lang) {
  if (!json || !json.title) return null;
  const url = json.content_urls && json.content_urls.desktop
    ? json.content_urls.desktop.page
    : (json.content_urls && json.content_urls.mobile ? json.content_urls.mobile.page : '');
  return {
    title: json.title,
    extract: json.extract || '',
    url: url || '',
    thumbnail: json.thumbnail && json.thumbnail.source ? json.thumbnail.source : '',
    type: json.type || 'standard', // "disambiguation" quando é ambíguo
    lang: lang || 'pt',
  };
}

export function parseWikidataSearch(json) {
  const items = json && json.search ? json.search : [];
  return items.map((it) => ({
    id: it.id,
    label: it.label || it.match?.text || it.id,
    description: it.description || '',
    url: it.concepturi || (it.id ? `https://www.wikidata.org/wiki/${it.id}` : ''),
  }));
}

// ---- Parte com internet: faz as buscas de verdade. ----

function withTimeout(promise, ms, controller) {
  const timer = setTimeout(() => controller.abort(), ms);
  return promise.finally(() => clearTimeout(timer));
}

async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const resp = await withTimeout(
    fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } }),
    timeoutMs,
    controller,
  );
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  return resp.json();
}

const WIKI_API = (lang) => `https://${lang}.wikipedia.org/w/api.php`;
const WIKI_SUMMARY = (lang, title) =>
  `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`;

export async function wikipediaSearch(term, lang = 'pt') {
  const url = `${WIKI_API(lang)}?action=query&list=search&srsearch=${encodeURIComponent(term)}` +
    `&srlimit=5&format=json&origin=*`;
  const json = await fetchJson(url);
  return parseWikipediaSearch(json);
}

export async function wikipediaSummary(title, lang = 'pt') {
  const json = await fetchJson(WIKI_SUMMARY(lang, title));
  return parseWikipediaSummary(json, lang);
}

export async function wikidataSearch(term, lang = 'pt') {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities` +
    `&search=${encodeURIComponent(term)}&language=${lang}&uselang=${lang}` +
    `&format=json&limit=5&origin=*`;
  const json = await fetchJson(url);
  return parseWikidataSearch(json);
}

// Pesquisa completa de um termo. Devolve um objeto com status:
//  - { status: 'ok', wikipedia, wikidata, fetchedAt }
//  - { status: 'ambiguous', options, wikidata, fetchedAt }
//  - { status: 'notfound' }
//  - { status: 'error', message }
export async function researchTerm(term, opts = {}) {
  const preferred = opts.lang || 'pt';
  const fallback = preferred === 'pt' ? 'en' : 'pt';
  try {
    let lang = preferred;
    let results = await wikipediaSearch(term, lang).catch(() => []);
    if (!results.length) {
      lang = fallback;
      results = await wikipediaSearch(term, lang).catch(() => []);
    }

    let wikidata = [];
    try { wikidata = await wikidataSearch(term, preferred); } catch { /* segue sem wikidata */ }

    if (!results.length) {
      return { status: 'notfound', wikidata, fetchedAt: new Date().toISOString() };
    }

    // Se o melhor resultado for uma página de desambiguação, ou se houver
    // vários candidatos parecidos, devolvemos as opções para o usuário escolher.
    let summary = null;
    try { summary = await wikipediaSummary(results[0].title, lang); } catch { /* ignora */ }

    const ambiguous = (summary && summary.type === 'disambiguation') ||
      (results.length > 1 && !titlesVeryClose(results[0].title, term));

    if (ambiguous) {
      return {
        status: 'ambiguous',
        lang,
        options: results,
        wikidata,
        fetchedAt: new Date().toISOString(),
      };
    }

    return {
      status: 'ok',
      wikipedia: summary || { title: results[0].title, extract: results[0].snippet, url: '', lang, type: 'standard' },
      wikidata,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    return { status: 'error', message: friendlyError(err) };
  }
}

// Busca o resumo de um título específico (quando o usuário escolhe uma opção).
export async function resolveOption(title, lang, term) {
  try {
    const summary = await wikipediaSummary(title, lang);
    let wikidata = [];
    try { wikidata = await wikidataSearch(term || title, lang); } catch { /* ignora */ }
    return { status: 'ok', wikipedia: summary, wikidata, fetchedAt: new Date().toISOString() };
  } catch (err) {
    return { status: 'error', message: friendlyError(err) };
  }
}

function titlesVeryClose(title, term) {
  const a = String(title || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const b = String(term || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return a === b;
}

function friendlyError(err) {
  const msg = (err && err.message) || '';
  if (msg.includes('abort')) return 'A pesquisa demorou demais. Verifique sua internet e tente de novo.';
  if (/failed to fetch|networkerror|load failed/i.test(msg)) {
    return 'Não foi possível conectar. Verifique sua conexão com a internet e tente de novo.';
  }
  return 'Não foi possível concluir a pesquisa agora. Tente novamente em instantes.';
}
