// Lógica da biblioteca: juntar termos de várias aulas, busca global entre
// todas as aulas e sugestões de termos por matéria (para a árvore de estudo).

import * as db from './db.js';
import { normalize } from './format.js';
import { searchSegments } from './search.js';
import { listarAulas } from './lessons.js';

// Agrupa termos (de várias aulas) pela forma normalizada. Função pura/testável.
// Recebe [{lessonId, name, norm, count, kind, hidden, occurrences}] e a lista
// de aulas [{id, title}]. Devolve termos agregados com em quais aulas aparecem.
export function groupTermsByNorm(terms, lessonsById = {}) {
  const mapa = new Map();
  for (const t of terms) {
    if (t.hidden) continue;
    const norm = t.norm || normalize(t.name);
    let g = mapa.get(norm);
    if (!g) {
      g = { norm, name: t.name, kind: t.kind, total: 0, lessons: [] };
      mapa.set(norm, g);
    }
    g.total += t.count || 0;
    if (t.kind === 'nome' && g.kind !== 'nome') g.kind = 'nome';
    g.lessons.push({
      lessonId: t.lessonId,
      title: (lessonsById[t.lessonId] && lessonsById[t.lessonId].title) || 'Aula',
      count: t.count || 0,
      occurrences: t.occurrences || [],
    });
  }
  const saida = Array.from(mapa.values());
  saida.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'pt-BR'));
  return saida;
}

// Junta todos os termos visíveis de todas as aulas, já agregados.
export async function indiceDeTermos() {
  const aulas = await listarAulas();
  const lessonsById = Object.fromEntries(aulas.map((a) => [a.id, a]));
  const todos = [];
  for (const aula of aulas) {
    const termos = await db.getAllByIndex(db.STORES.terms, 'lessonId', aula.id);
    for (const t of termos) todos.push(t);
  }
  return groupTermsByNorm(todos, lessonsById);
}

// Busca um texto em TODAS as aulas. Devolve resultados com título da aula.
export async function buscaGlobal(query) {
  const aulas = await listarAulas();
  const resultados = [];
  for (const aula of aulas) {
    const segs = await db.getAllByIndex(db.STORES.segments, 'lessonId', aula.id);
    segs.sort((a, b) => a.start - b.start);
    const achados = searchSegments(segs, query, { maxResults: 20 });
    for (const r of achados) resultados.push({ ...r, lessonTitle: aula.title });
  }
  return resultados;
}

// Sugere termos para uma matéria a partir das aulas que estão nela.
export async function sugestoesParaMateria(materia, aulas) {
  const daMateria = aulas.filter((a) => a.subjectId === materia.id);
  const contagem = new Map();
  for (const aula of daMateria) {
    const termos = await db.getAllByIndex(db.STORES.terms, 'lessonId', aula.id);
    for (const t of termos) {
      if (t.hidden || t.kind === 'data') continue;
      const g = contagem.get(t.norm) || { name: t.name, total: 0 };
      g.total += t.count || 0;
      contagem.set(t.norm, g);
    }
  }
  const fixados = new Set((materia.pinned || []));
  return Array.from(contagem.values())
    .filter((g) => !fixados.has(g.name))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}
