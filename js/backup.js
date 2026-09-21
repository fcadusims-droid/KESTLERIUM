// Backup: salva tudo num arquivo (para você guardar) e restaura depois.
// Importante porque dados do navegador podem ser apagados. Não usa internet.

import * as db from './db.js';

const VERSAO_BACKUP = 1;

function blobParaBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = String(reader.result);
      const i = s.indexOf(','); // remove o prefixo "data:...;base64,"
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function base64ParaBlob(base64, tipo) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: tipo || 'audio/mpeg' });
}

// Monta o backup completo (ou só textos) e devolve um objeto JavaScript.
export async function montarBackup({ incluirAudios = true, onProgress } = {}) {
  const subjects = await db.getAll(db.STORES.subjects);
  const lessons = await db.getAll(db.STORES.lessons);
  const research = await db.getAll(db.STORES.research);
  const saida = { versao: VERSAO_BACKUP, exportadoEm: new Date().toISOString(), incluiAudios: incluirAudios, subjects, research, lessons: [] };

  let i = 0;
  for (const lesson of lessons) {
    const segments = await db.getAllByIndex(db.STORES.segments, 'lessonId', lesson.id);
    const terms = await db.getAllByIndex(db.STORES.terms, 'lessonId', lesson.id);
    const item = { ...lesson, segments, terms };
    if (incluirAudios) {
      const audio = await db.get(db.STORES.audio, lesson.id);
      if (audio && audio.blob) {
        item.audioBase64 = await blobParaBase64(audio.blob);
        item.audioType = audio.type || 'audio/mpeg';
      }
    }
    saida.lessons.push(item);
    i++;
    if (onProgress) onProgress(i / lessons.length);
  }
  return saida;
}

// Exporta e baixa o arquivo de backup.
export async function exportarBackup(opcoes = {}) {
  const dados = await montarBackup(opcoes);
  const json = JSON.stringify(dados);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dia = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `kestlerium-backup-${dia}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { aulas: dados.lessons.length };
}

// Importa um backup a partir de um arquivo escolhido pelo usuário.
export async function importarBackup(file, { onProgress } = {}) {
  const texto = await file.text();
  let dados;
  try { dados = JSON.parse(texto); } catch { throw new Error('Arquivo de backup inválido (não é um JSON).'); }
  if (!dados || typeof dados !== 'object' || !Array.isArray(dados.lessons)) {
    throw new Error('Este arquivo não parece ser um backup do Kestlerium.');
  }

  for (const s of dados.subjects || []) await db.put(db.STORES.subjects, s);
  for (const r of dados.research || []) await db.put(db.STORES.research, r);

  let i = 0;
  for (const item of dados.lessons) {
    const { segments = [], terms = [], audioBase64, audioType, ...lesson } = item;
    await db.put(db.STORES.lessons, lesson);
    if (segments.length) await db.putMany(db.STORES.segments, segments);
    if (terms.length) await db.putMany(db.STORES.terms, terms);
    if (audioBase64) {
      const blob = base64ParaBlob(audioBase64, audioType);
      await db.put(db.STORES.audio, { lessonId: lesson.id, blob, fileName: lesson.fileName, type: audioType });
    }
    i++;
    if (onProgress) onProgress(i / dados.lessons.length);
  }
  return { aulas: dados.lessons.length, comAudio: dados.incluiAudios !== false };
}
