// Lida com o áudio: lê o MP3, transforma em amostras que o Whisper entende
// (16 kHz, mono) e corta em blocos para processar aos poucos.
// Tudo acontece no navegador; o áudio não é enviado para lugar nenhum.

const TARGET_RATE = 16000;

// Decodifica um Blob de áudio (MP3) para um Float32Array mono em 16 kHz.
// IMPORTANTE (correção de travamento): juntar canais e reamostrar milhões de
// amostras "na mão" congelava o navegador em aulas longas. Agora deixamos o
// próprio motor de áudio do navegador (OfflineAudioContext) fazer isso de forma
// nativa e sem travar a tela. Só caímos no método manual se algo falhar.
export async function decodeToMono16k(blob, onProgress) {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  // Pede para decodificar já em 16 kHz (reduz memória em aulas longas).
  let tmpCtx;
  try { tmpCtx = new AudioCtx({ sampleRate: TARGET_RATE }); } catch { tmpCtx = new AudioCtx(); }
  let decoded;
  try {
    decoded = await tmpCtx.decodeAudioData(arrayBuffer);
  } finally {
    if (tmpCtx.close) tmpCtx.close();
  }
  if (onProgress) onProgress(0.5);
  const duration = decoded.duration;

  // Caminho rápido e sem travar: renderiza mono 16 kHz com OfflineAudioContext.
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (OfflineCtx) {
    try {
      const frames = Math.max(1, Math.ceil(duration * TARGET_RATE));
      const offline = new OfflineCtx(1, frames, TARGET_RATE);
      const src = offline.createBufferSource();
      src.buffer = decoded;               // ligar a fonte (estéreo) a um destino mono já mistura os canais
      src.connect(offline.destination);
      src.start(0);
      const rendered = await offline.startRendering();
      const samples = rendered.getChannelData(0);
      if (onProgress) onProgress(1);
      return { samples, sampleRate: TARGET_RATE, duration };
    } catch {
      // se falhar, segue para o método manual (mais lento) abaixo
    }
  }

  // Método manual de reserva: mistura e reamostra em pedaços, cedendo a vez para
  // a interface entre eles (para não congelar).
  const samples = await downmixResampleChunked(decoded, onProgress);
  if (onProgress) onProgress(1);
  return { samples, sampleRate: TARGET_RATE, duration };
}

// Mistura para mono e reamostra em pedaços, sem bloquear a tela.
async function downmixResampleChunked(decoded, onProgress) {
  const numCh = decoded.numberOfChannels;
  const length = decoded.length;
  const canais = [];
  for (let ch = 0; ch < numCh; ch++) canais.push(decoded.getChannelData(ch));
  const mono = new Float32Array(length);
  const PASSO = 500000;
  for (let i = 0; i < length; i += PASSO) {
    const fim = Math.min(length, i + PASSO);
    for (let j = i; j < fim; j++) {
      let soma = 0;
      for (let ch = 0; ch < numCh; ch++) soma += canais[ch][j];
      mono[j] = soma / numCh;
    }
    if (onProgress) onProgress(0.5 + 0.4 * (fim / length));
    await new Promise((r) => setTimeout(r)); // deixa a interface respirar
  }
  return decoded.sampleRate === TARGET_RATE ? mono : resampleLinear(mono, decoded.sampleRate, TARGET_RATE);
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
