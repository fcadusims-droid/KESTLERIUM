// Configurações centrais do Kestlerium, num só lugar para facilitar ajustes.

// Biblioteca de transcrição (Whisper no navegador), carregada de um CDN público.
// Usamos a versão 3 do Transformers.js, que suporta WebGPU (rápido) e,
// quando não há WebGPU, cai automaticamente para WASM (mais lento, mas funciona).
export const TRANSFORMERS_URL =
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3/dist/transformers.min.js';

// Modelos de transcrição disponíveis. "base" tem melhor qualidade em português;
// "tiny" é mais rápido, bom para computadores fracos.
export const MODELS = {
  tiny: { id: 'Xenova/whisper-tiny', rotulo: 'Rápido (tiny) — menos preciso' },
  base: { id: 'Xenova/whisper-base', rotulo: 'Equilibrado (base) — recomendado' },
  small: { id: 'Xenova/whisper-small', rotulo: 'Preciso (small) — bem mais lento' },
};

export const DEFAULT_MODEL = 'base';

// Idioma padrão da transcrição. "auto" tenta detectar sozinho.
export const IDIOMAS = {
  portuguese: 'Português',
  auto: 'Detectar automaticamente',
  english: 'Inglês',
  spanish: 'Espanhol',
  french: 'Francês',
  italian: 'Italiano',
  german: 'Alemão',
};

export const DEFAULT_IDIOMA = 'portuguese';

// Tamanho de cada bloco de áudio processado (em segundos).
export const CHUNK_SEC = 30;
export const OVERLAP_SEC = 1;
