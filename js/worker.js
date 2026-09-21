// Web Worker: roda o Whisper (transcrição) em segundo plano, para a página
// não travar. Recebe blocos de áudio e devolve o texto com marcações de tempo.
// Carrega a biblioteca Transformers.js de um CDN público.

import { TRANSFORMERS_URL } from './config.js';

let transformers = null;
let transcriber = null;
let currentModelId = null;
let currentDevice = null;
let cancelled = false;

async function loadLib() {
  if (!transformers) {
    transformers = await import(TRANSFORMERS_URL);
    transformers.env.allowLocalModels = false;
    // Deixa a biblioteca usar cache do navegador para os modelos baixados.
  }
  return transformers;
}

async function ensurePipeline(modelId) {
  const lib = await loadLib();
  if (transcriber && currentModelId === modelId) return transcriber;

  const progress = (data) => {
    if (data && data.status === 'progress' && data.file) {
      post({ type: 'model-progress', file: data.file, progress: data.progress || 0 });
    } else if (data && data.status) {
      post({ type: 'model-status', status: data.status, file: data.file || '' });
    }
  };

  // Tenta WebGPU (rápido). Se falhar, usa WASM (mais lento, mas sempre funciona).
  let pipe = null;
  let device = 'wasm';
  let hasWebGPU = false;
  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      hasWebGPU = !!adapter; // só usa WebGPU se houver uma placa de vídeo utilizável
    } catch { hasWebGPU = false; }
  }
  if (hasWebGPU) {
    try {
      pipe = await lib.pipeline('automatic-speech-recognition', modelId, {
        device: 'webgpu',
        progress_callback: progress,
      });
      device = 'webgpu';
    } catch (e) {
      pipe = null;
    }
  }
  if (!pipe) {
    pipe = await lib.pipeline('automatic-speech-recognition', modelId, {
      device: 'wasm',
      progress_callback: progress,
    });
    device = 'wasm';
  }

  transcriber = pipe;
  currentModelId = modelId;
  currentDevice = device;
  post({ type: 'ready', device });
  return transcriber;
}

function post(msg, transfer) {
  self.postMessage(msg, transfer || []);
}

self.onmessage = async (e) => {
  const msg = e.data;
  try {
    if (msg.type === 'init') {
      cancelled = false;
      await ensurePipeline(msg.modelId);
    } else if (msg.type === 'cancel') {
      cancelled = true;
    } else if (msg.type === 'transcribe-chunk') {
      if (cancelled) return;
      const pipe = await ensurePipeline(msg.modelId);
      const options = { return_timestamps: true, chunk_length_s: 30, stride_length_s: 5 };
      if (msg.language && msg.language !== 'auto') {
        options.language = msg.language;
        options.task = 'transcribe';
      }
      const samples = msg.samples; // Float32Array
      const output = await pipe(samples, options);
      const startSec = msg.startSec || 0;
      const segments = [];
      if (output && Array.isArray(output.chunks) && output.chunks.length) {
        for (const c of output.chunks) {
          const ts = c.timestamp || [0, 0];
          segments.push({
            start: startSec + (ts[0] || 0),
            end: startSec + (ts[1] != null ? ts[1] : (ts[0] || 0)),
            text: (c.text || '').trim(),
          });
        }
      } else if (output && output.text) {
        segments.push({ start: startSec, end: startSec + (msg.durationSec || 0), text: output.text.trim() });
      }
      post({ type: 'chunk-done', chunkIndex: msg.chunkIndex, segments, device: currentDevice });
    }
  } catch (err) {
    post({ type: 'error', chunkIndex: msg && msg.chunkIndex, message: String(err && err.message || err) });
  }
};
