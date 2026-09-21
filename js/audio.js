// Lida com o áudio: lê o MP3, transforma em amostras que o Whisper entende
// (16 kHz, mono) e corta em blocos para processar aos poucos.
// Tudo acontece no navegador; o áudio não é enviado para lugar nenhum.

const TARGET_RATE = 16000;

// Decodifica um Blob de áudio (MP3) para um Float32Array mono em 16 kHz.
export async function decodeToMono16k(blob, onProgress) {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  // Pede para decodificar já em 16 kHz. Isso reduz muito o uso de memória em
  // aulas longas (uma aula de 1 h ocuparia mais de 1 GB se decodificada na
  // taxa original). Se o navegador não aceitar 16 kHz, decodifica normal e
  // reamostra depois.
  let tmpCtx;
  try { tmpCtx = new AudioCtx({ sampleRate: TARGET_RATE }); } catch { tmpCtx = new AudioCtx(); }
  let decoded;
  try {
    decoded = await tmpCtx.decodeAudioData(arrayBuffer);
  } finally {
    if (tmpCtx.close) tmpCtx.close();
  }
  if (onProgress) onProgress(0.5);

  // Mistura para mono.
  const numCh = decoded.numberOfChannels;
  const length = decoded.length;
  const mono = new Float32Array(length);
  for (let ch = 0; ch < numCh; ch++) {
    const data = decoded.getChannelData(ch);
    for (let i = 0; i < length; i++) mono[i] += data[i] / numCh;
  }

  // Reamostra para 16 kHz, se necessário.
  let samples = mono;
  if (decoded.sampleRate !== TARGET_RATE) {
    samples = resampleLinear(mono, decoded.sampleRate, TARGET_RATE);
  }
  if (onProgress) onProgress(1);
  return { samples, sampleRate: TARGET_RATE, duration: decoded.duration };
}

// Reamostragem linear simples (leve e suficiente para voz).
export function resampleLinear(input, fromRate, toRate) {
  if (fromRate === toRate) return input;
  const ratio = fromRate / toRate;
  const newLength = Math.round(input.length / ratio);
  const output = new Float32Array(newLength);
  for (let i = 0; i < newLength; i++) {
    const pos = i * ratio;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const a = input[idx] || 0;
    const b = input[idx + 1] !== undefined ? input[idx + 1] : a;
    output[i] = a + (b - a) * frac;
  }
  return output;
}

// Divide as amostras em blocos com um pequeno "respiro" (overlap) entre eles,
// para não cortar palavras no meio. Retorna [{ startSample, endSample, startSec }].
export function planChunks(totalSamples, sampleRate, chunkSec = 30, overlapSec = 1) {
  const chunkSize = Math.floor(chunkSec * sampleRate);
  const overlap = Math.floor(overlapSec * sampleRate);
  const chunks = [];
  let start = 0;
  while (start < totalSamples) {
    const end = Math.min(start + chunkSize, totalSamples);
    chunks.push({
      startSample: start,
      endSample: end,
      startSec: start / sampleRate,
      endSec: end / sampleRate,
    });
    if (end >= totalSamples) break;
    start = end - overlap; // volta um pouco para dar continuidade
  }
  return chunks;
}
