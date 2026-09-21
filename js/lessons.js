// Operações com aulas: criar a partir de um arquivo, listar, apagar (com tudo
// que pertence a ela) e cuidar dos termos. Fica entre a interface e o banco.

import * as db from './db.js';
import { makeId } from './format.js';
import { DEFAULT_MODEL, MODELS, DEFAULT_IDIOMA } from './config.js';
import { extractTerms } from './entities.js';

export async function criarAula(file, { titulo, subjectId = null, modelKey = DEFAULT_MODEL, language = DEFAULT_IDIOMA } = {}) {
  const id = makeId('aula');
  const modelId = (MODELS[modelKey] || MODELS[DEFAULT_MODEL]).id;
  const lesson = {
    id,
    title: titulo || file.name.replace(/\.[^.]+$/, ''),
    subjectId,
    fileName: file.name,
    fileSize: file.size,
    modelKey,
    modelId,
    language,
    duration: 0,
    status: 'pending',       // pending | transcribing | paused | done | error
    progress: 0,
    chunksDone: [],
    chunksTotal: 0,
    createdAt: new Date().toISOString(),
  };
  await db.put(db.STORES.audio, { lessonId: id, blob: file, fileName: file.name, type: file.type || 'audio/mpeg' });
  await db.put(db.STORES.lessons, lesson);
  return lesson;
}

export async function listarAulas() {
  const aulas = await db.getAll(db.STORES.lessons);
  aulas.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return aulas;
}

export async function obterAula(id) {
  return db.get(db.STORES.lessons, id);
}

export async function obterAudio(lessonId) {
  const rec = await db.get(db.STORES.audio, lessonId);
  return rec ? rec.blob : null;
}

export async function obterSegmentos(lessonId) {
  const segs = await db.getAllByIndex(db.STORES.segments, 'lessonId', lessonId);
  segs.sort((a, b) => a.start - b.start || a.index - b.index);
  return segs;
}

export async function salvarAula(lesson) {
  return db.put(db.STORES.lessons, lesson);
}

export async function apagarAula(lessonId) {
  await db.delByIndex(db.STORES.segments, 'lessonId', lessonId);
  await db.delByIndex(db.STORES.terms, 'lessonId', lessonId);
  await db.del(db.STORES.audio, lessonId);
  await db.del(db.STORES.lessons, lessonId);
}

// ---- Termos ----

export async function obterTermos(lessonId) {
  const termos = await db.getAllByIndex(db.STORES.terms, 'lessonId', lessonId);
  termos.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
  return termos;
}

// Gera os termos a partir da transcrição e salva (só quando ainda não existem,
// a não ser que force = true, que refaz do zero descartando edições manuais).
export async function gerarTermos(lessonId, { force = false } = {}) {
  const existentes = await obterTermos(lessonId);
  if (existentes.length && !force) return existentes;
  if (force) await db.delByIndex(db.STORES.terms, 'lessonId', lessonId);
  const segs = await obterSegmentos(lessonId);
  const termos = extractTerms(segs).map((t) => ({ ...t, lessonId }));
  if (termos.length) await db.putMany(db.STORES.terms, termos);
  return termos;
}

export async function salvarTermo(termo) {
  return db.put(db.STORES.terms, termo);
}

export async function apagarTermo(lessonId, termoId) {
  return db.del(db.STORES.terms, [lessonId, termoId]);
}
