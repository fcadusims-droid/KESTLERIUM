// Matérias e temas: as "pastas" que você cria para organizar as aulas.
// Formam uma árvore (matéria > tema > subtema...), do jeito que você quiser.

import * as db from './db.js';
import { makeId } from './format.js';

export async function listarMaterias() {
  const itens = await db.getAll(db.STORES.subjects);
  itens.sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name, 'pt-BR'));
  return itens;
}

export async function criarMateria(nome, parentId = null) {
  const item = { id: makeId('mat'), name: nome, parentId: parentId || null, order: Date.now(), pinned: [] };
  await db.put(db.STORES.subjects, item);
  return item;
}

export async function renomearMateria(id, novoNome) {
  const m = await db.get(db.STORES.subjects, id);
  if (!m) return null;
  m.name = novoNome;
  await db.put(db.STORES.subjects, m);
  return m;
}

export async function moverMateria(id, novoParentId) {
  const m = await db.get(db.STORES.subjects, id);
  if (!m) return null;
  if (id === novoParentId) return m;
  m.parentId = novoParentId || null;
  await db.put(db.STORES.subjects, m);
  return m;
}

// Apaga a matéria. As aulas dentro dela NÃO são apagadas: ficam "sem matéria".
export async function apagarMateria(id) {
  const todas = await listarMaterias();
  const filhas = todas.filter((m) => m.parentId === id);
  for (const f of filhas) await moverMateria(f.id, null); // sobem um nível
  const { getAllByIndex, put, STORES } = db;
  const aulas = await getAllByIndex(STORES.lessons, 'subjectId', id);
  for (const aula of aulas) { aula.subjectId = null; await put(STORES.lessons, aula); }
  await db.del(db.STORES.subjects, id);
}

// Monta a árvore (lista com filhos) a partir da lista plana.
export function montarArvore(materias) {
  const porPai = new Map();
  for (const m of materias) {
    const p = m.parentId || 'raiz';
    if (!porPai.has(p)) porPai.set(p, []);
    porPai.get(p).push(m);
  }
  const construir = (paiId) => (porPai.get(paiId) || []).map((m) => ({ ...m, filhos: construir(m.id) }));
  return construir('raiz');
}

// Fixa (ou remove) um termo sugerido numa matéria, na árvore de estudo.
export async function fixarTermo(materiaId, termo) {
  const m = await db.get(db.STORES.subjects, materiaId);
  if (!m) return null;
  m.pinned = m.pinned || [];
  if (!m.pinned.includes(termo)) m.pinned.push(termo);
  await db.put(db.STORES.subjects, m);
  return m;
}

export async function desfixarTermo(materiaId, termo) {
  const m = await db.get(db.STORES.subjects, materiaId);
  if (!m) return null;
  m.pinned = (m.pinned || []).filter((t) => t !== termo);
  await db.put(db.STORES.subjects, m);
  return m;
}
