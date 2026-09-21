// Comanda a transcrição de uma aula: prepara o áudio, divide em blocos,
// manda cada bloco para o Web Worker, salva o resultado aos poucos e permite
// cancelar ou retomar de onde parou (mesmo se a aba tiver sido fechada).

import { decodeToMono16k, planChunks } from './audio.js';
import { CHUNK_SEC, OVERLAP_SEC } from './config.js';
import * as db from './db.js';

let _worker = null;
function getWorker() {
  if (!_worker) {
    _worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
  }
  return _worker;
}

// Envia uma mensagem ao worker e espera a resposta correspondente.
function askWorker(worker, message, matchType, transfer) {
  return new Promise((resolve, reject) => {
    const onMsg = (e) => {
      const d = e.data;
      if (d.type === matchType && (d.chunkIndex === undefined || d.chunkIndex === message.chunkIndex)) {
        cleanup();
        resolve(d);
      } else if (d.type === 'error' && (d.chunkIndex === undefined || d.chunkIndex === message.chunkIndex)) {
        cleanup();
        reject(new Error(d.message || 'Erro na transcrição'));
      } else if (d.type === 'model-progress' || d.type === 'model-status' || d.type === 'ready') {
        if (message.onStatus) message.onStatus(d);
      }
    };
    const cleanup = () => worker.removeEventListener('message', onMsg);
    worker.addEventListener('message', onMsg);
    worker.postMessage(message, transfer || []);
  });
}

export class TranscriptionJob {
  constructor(lesson, blob, handlers = {}) {
    this.lesson = lesson;
    this.blob = blob;
    this.handlers = handlers; // { onProgress, onDevice, onModelProgress, onSegments, onDone, onError }
    this.cancelled = false;
  }

  cancel() {
    this.cancelled = true;
    if (_worker) _worker.postMessage({ type: 'cancel' });
  }

  async start() {
    const { lesson, blob, handlers } = this;
    const worker = getWorker();
    try {
      // 1) Prepara o áudio (decodifica e reamostra para 16 kHz).
      const { samples, sampleRate, duration } = await decodeToMono16k(blob);
      const chunks = planChunks(samples.length, sampleRate, CHUNK_SEC, OVERLAP_SEC);

      // 2) Descobre o que já foi feito (para retomar).
      const existing = await db.getAllByIndex(db.STORES.segments, 'lessonId', lesson.id);
      const done = new Set((lesson.chunksDone || []));
      let segCounter = existing.length;

      lesson.chunksTotal = chunks.length;
      lesson.status = 'transcribing';
      lesson.duration = duration;
      await db.put(db.STORES.lessons, lesson);

      const onStatus = (d) => {
        if (d.type === 'ready' && handlers.onDevice) handlers.onDevice(d.device);
        if (d.type === 'model-progress' && handlers.onModelProgress) handlers.onModelProgress(d);
        if (d.type === 'model-status' && handlers.onModelProgress) handlers.onModelProgress(d);
      };

      // 3) Garante o modelo carregado (mostra progresso do download).
      await askWorker(worker, {
        type: 'init', modelId: lesson.modelId, onStatus,
      }, 'ready');

      // 4) Processa bloco a bloco, em ordem, salvando cada resultado.
      for (let i = 0; i < chunks.length; i++) {
        if (this.cancelled) { lesson.status = 'paused'; await db.put(db.STORES.lessons, lesson); return; }
        if (done.has(i)) continue;

        const c = chunks[i];
        const slice = samples.subarray(c.startSample, c.endSample);
        // Cópia para poder transferir ao worker sem afetar o buffer principal.
        const copy = new Float32Array(slice);

        const resp = await askWorker(worker, {
          type: 'transcribe-chunk',
          chunkIndex: i,
          modelId: lesson.modelId,
          language: lesson.language,
          samples: copy,
          startSec: c.startSec,
          durationSec: c.endSec - c.startSec,
          onStatus,
        }, 'chunk-done', [copy.buffer]);

        if (this.cancelled) { lesson.status = 'paused'; await db.put(db.STORES.lessons, lesson); return; }

        // Remove trechos que caem na área de sobreposição (já cobertos antes).
        const dropBefore = i > 0 ? c.startSec + OVERLAP_SEC - 0.2 : -1;
        const newSegs = [];
        for (const s of resp.segments) {
          if (!s.text) continue;
          if (s.start < dropBefore) continue;
          newSegs.push({
            lessonId: lesson.id,
            index: segCounter++,
            start: s.start,
            end: s.end,
            text: s.text,
          });
        }
        if (newSegs.length) await db.putMany(db.STORES.segments, newSegs);

        done.add(i);
        lesson.chunksDone = Array.from(done);
        lesson.progress = done.size / chunks.length;
        if (resp.device) lesson.device = resp.device;
        await db.put(db.STORES.lessons, lesson);

        if (handlers.onSegments) handlers.onSegments(newSegs);
        if (handlers.onProgress) handlers.onProgress(lesson.progress, done.size, chunks.length);
      }

      // 5) Concluído: renumera segmentos por ordem de tempo (limpo para exibir).
      lesson.status = 'done';
      lesson.progress = 1;
      await db.put(db.STORES.lessons, lesson);
      if (handlers.onDone) handlers.onDone(lesson);
    } catch (err) {
      lesson.status = 'error';
      lesson.errorMsg = String(err && err.message || err);
      await db.put(db.STORES.lessons, lesson).catch(() => {});
      if (handlers.onError) handlers.onError(err);
    }
  }
}
