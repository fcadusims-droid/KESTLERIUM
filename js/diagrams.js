// Diagramas automáticos, montados a partir da própria aula (fundamentados):
//  - Mapa conceitual: termos ligados quando aparecem no mesmo trecho.
//  - Linha do tempo: as datas encontradas, em ordem, com a frase da aula.
// A lógica é pura e testável. O desenho (SVG) e a sincronização com o áudio
// ficam no player.

import { escapeHtml } from './format.js';

// ---- Mapa conceitual ----
// Nós = termos mais frequentes. Ligações = termos que aparecem no mesmo trecho.
export function buildConceptGraph(segments, terms, opts = {}) {
  const maxNodes = opts.maxNodes || 18;
  const nós = (terms || [])
    .filter((t) => !t.hidden && t.kind !== 'data')
    .slice(0, maxNodes)
    .map((t) => ({ norm: t.norm, name: t.name, count: t.count || 1, kind: t.kind || 'nome' }));
  const normSet = new Set(nós.map((n) => n.norm));

  // Para cada trecho, quais nós aparecem nele (pelas ocorrências dos termos).
  const porSeg = new Map();
  for (const t of (terms || [])) {
    if (!normSet.has(t.norm)) continue;
    for (const oc of (t.occurrences || [])) {
      if (!porSeg.has(oc.index)) porSeg.set(oc.index, new Set());
      porSeg.get(oc.index).add(t.norm);
    }
  }
  const pesoAresta = new Map();
  for (const conjunto of porSeg.values()) {
    const arr = Array.from(conjunto);
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const chave = [arr[i], arr[j]].sort().join('|');
        pesoAresta.set(chave, (pesoAresta.get(chave) || 0) + 1);
      }
    }
  }
  const arestas = [];
  for (const [chave, weight] of pesoAresta) {
    const [a, b] = chave.split('|');
    arestas.push({ a, b, weight });
  }
  arestas.sort((x, y) => y.weight - x.weight);
  return { nodes: nós, edges: arestas };
}

// Posiciona os nós de forma determinística (força dirigida simples, sem sorteio).
export function layoutGraph(graph, opts = {}) {
  const width = opts.width || 600;
  const height = opts.height || 420;
  const pad = opts.pad || 40;
  const iter = opts.iterations || 140;
  const nodes = graph.nodes.map((n, i) => {
    const ang = (2 * Math.PI * i) / Math.max(1, graph.nodes.length);
    return { ...n, x: width / 2 + Math.cos(ang) * width / 4, y: height / 2 + Math.sin(ang) * height / 4 };
  });
  const idx = new Map(nodes.map((n, i) => [n.norm, i]));
  const k = Math.sqrt((width * height) / Math.max(1, nodes.length)) * 0.6;

  for (let passo = 0; passo < iter; passo++) {
    const fx = new Array(nodes.length).fill(0);
    const fy = new Array(nodes.length).fill(0);
    // repulsão entre todos os pares
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = nodes[i].x - nodes[j].x;
        let dy = nodes[i].y - nodes[j].y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const rep = (k * k) / dist;
        const ux = dx / dist; const uy = dy / dist;
        fx[i] += ux * rep; fy[i] += uy * rep;
        fx[j] -= ux * rep; fy[j] -= uy * rep;
      }
    }
    // atração pelas ligações
    for (const e of graph.edges) {
      const i = idx.get(e.a); const j = idx.get(e.b);
      if (i == null || j == null) continue;
      let dx = nodes[i].x - nodes[j].x;
      let dy = nodes[i].y - nodes[j].y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const att = (dist * dist) / k * (0.4 + 0.2 * e.weight);
      const ux = dx / dist; const uy = dy / dist;
      fx[i] -= ux * att / 8; fy[i] -= uy * att / 8;
      fx[j] += ux * att / 8; fy[j] += uy * att / 8;
    }
    const temp = 1 - passo / iter;
    for (let i = 0; i < nodes.length; i++) {
      const mag = Math.sqrt(fx[i] * fx[i] + fy[i] * fy[i]) || 0.01;
      const passoMax = 12 * temp;
      nodes[i].x += (fx[i] / mag) * Math.min(mag, passoMax);
      nodes[i].y += (fy[i] / mag) * Math.min(mag, passoMax);
      nodes[i].x = Math.max(pad, Math.min(width - pad, nodes[i].x));
      nodes[i].y = Math.max(pad, Math.min(height - pad, nodes[i].y));
    }
  }
  return { nodes, edges: graph.edges, width, height };
}

// ---- Linha do tempo ----
const ROMANOS = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
function romanoParaNumero(s) {
  let total = 0; let prev = 0;
  for (let i = s.length - 1; i >= 0; i--) {
    const v = ROMANOS[s[i].toUpperCase()] || 0;
    if (v < prev) total -= v; else { total += v; prev = v; }
  }
  return total;
}

// Tenta descobrir um "ano aproximado" de um rótulo de data, para ordenar.
export function parseAno(label) {
  const s = String(label || '');
  const sec = s.match(/s[ée]culo\s+([IVXLCDM]+|\d{1,2})/i);
  if (sec) {
    const n = /^\d+$/.test(sec[1]) ? Number(sec[1]) : romanoParaNumero(sec[1]);
    const ano = (n - 1) * 100 + 50;
    return /a\.?\s?c/i.test(s) ? -ano : ano;
  }
  const m = s.match(/\b(\d{1,4})\b/);
  if (!m) return null;
  let ano = Number(m[1]);
  if (/a\.?\s?c/i.test(s)) ano = -ano;
  return ano;
}

export function buildTimeline(segments, terms) {
  const segPorIndex = new Map((segments || []).map((s) => [s.index, s]));
  const eventos = [];
  for (const t of (terms || [])) {
    if (t.hidden || t.kind !== 'data') continue;
    const oc = (t.occurrences || [])[0];
    const seg = oc ? segPorIndex.get(oc.index) : null;
    eventos.push({
      label: t.name,
      ano: parseAno(t.name),
      text: seg ? seg.text : '',
      start: oc ? oc.start : 0,
    });
  }
  eventos.sort((a, b) => {
    if (a.ano == null && b.ano == null) return a.start - b.start;
    if (a.ano == null) return 1;
    if (b.ano == null) return -1;
    return a.ano - b.ano || a.start - b.start;
  });
  return eventos;
}

// ---- Desenho do mapa como SVG (string). Cada nó leva data-norm para sincronizar. ----
export function conceptGraphSVG(layout) {
  const { nodes, edges, width, height } = layout;
  const pos = new Map(nodes.map((n) => [n.norm, n]));
  const maxCount = Math.max(1, ...nodes.map((n) => n.count));
  const corKind = { nome: 'var(--primaria)', conceito: 'var(--sucesso)', data: '#6b45c9' };
  let s = `<svg viewBox="0 0 ${width} ${height}" class="grafo-svg" role="img" aria-label="Mapa de conceitos">`;
  for (const e of edges) {
    const a = pos.get(e.a); const b = pos.get(e.b);
    if (!a || !b) continue;
    const op = Math.min(0.5, 0.12 + e.weight * 0.08);
    s += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="var(--borda)" stroke-opacity="${op.toFixed(2)}" stroke-width="${Math.min(4, 1 + e.weight)}"/>`;
  }
  for (const n of nodes) {
    const r = 6 + 14 * (n.count / maxCount);
    const cor = corKind[n.kind] || 'var(--primaria)';
    s += `<g class="no-grafo" data-norm="${escapeHtml(n.norm)}" tabindex="0" role="button">`;
    s += `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${r.toFixed(1)}" fill="${cor}" fill-opacity="0.85"/>`;
    s += `<text x="${n.x.toFixed(1)}" y="${(n.y - r - 3).toFixed(1)}" text-anchor="middle" class="grafo-rotulo">${escapeHtml(n.name)}</text>`;
    s += `</g>`;
  }
  s += `</svg>`;
  return s;
}
