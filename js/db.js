// Banco de dados local no navegador (IndexedDB).
// Guarda aulas, áudios (MP3), transcrições, termos, pesquisas e matérias.
// Nada aqui é enviado para a internet: fica tudo no seu navegador.

const DB_NAME = 'kestlerium';
const DB_VERSION = 1;

// Nomes das "gavetas" (object stores) do banco.
export const STORES = {
  lessons: 'lessons',     // dados de cada aula (sem o áudio)
  audio: 'audio',         // o arquivo MP3 de cada aula (Blob)
  segments: 'segments',   // trechos da transcrição com tempo
  terms: 'terms',         // termos/conceitos extraídos de cada aula
  research: 'research',   // resultados de pesquisa (Wikipédia/Wikidata)
  subjects: 'subjects',   // matérias e temas (árvore de estudo)
  meta: 'meta',           // configurações e estado geral
};

let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORES.lessons)) {
        const s = db.createObjectStore(STORES.lessons, { keyPath: 'id' });
        s.createIndex('subjectId', 'subjectId', { unique: false });
        s.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.audio)) {
        db.createObjectStore(STORES.audio, { keyPath: 'lessonId' });
      }
      if (!db.objectStoreNames.contains(STORES.segments)) {
        // chave composta [lessonId, index]
        const s = db.createObjectStore(STORES.segments, { keyPath: ['lessonId', 'index'] });
        s.createIndex('lessonId', 'lessonId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.terms)) {
        const s = db.createObjectStore(STORES.terms, { keyPath: ['lessonId', 'id'] });
        s.createIndex('lessonId', 'lessonId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.research)) {
        db.createObjectStore(STORES.research, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORES.subjects)) {
        const s = db.createObjectStore(STORES.subjects, { keyPath: 'id' });
        s.createIndex('parentId', 'parentId', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORES.meta)) {
        db.createObjectStore(STORES.meta, { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

function tx(storeNames, mode) {
  return openDB().then((db) => {
    const t = db.transaction(storeNames, mode);
    return t;
  });
}

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function put(store, value) {
  const t = await tx(store, 'readwrite');
  const r = t.objectStore(store).put(value);
  await reqToPromise(r);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve(value);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function putMany(store, values) {
  const t = await tx(store, 'readwrite');
  const os = t.objectStore(store);
  for (const v of values) os.put(v);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve(values.length);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export async function get(store, key) {
  const t = await tx(store, 'readonly');
  return reqToPromise(t.objectStore(store).get(key));
}

export async function getAll(store) {
  const t = await tx(store, 'readonly');
  return reqToPromise(t.objectStore(store).getAll());
}

export async function getAllByIndex(store, indexName, value) {
  const t = await tx(store, 'readonly');
  const idx = t.objectStore(store).index(indexName);
  return reqToPromise(idx.getAll(value));
}

export async function del(store, key) {
  const t = await tx(store, 'readwrite');
  t.objectStore(store).delete(key);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// Apaga todos os registros de um store cujo índice bate com o valor.
export async function delByIndex(store, indexName, value) {
  const t = await tx(store, 'readwrite');
  const os = t.objectStore(store);
  const idx = os.index(indexName);
  const keys = await reqToPromise(idx.getAllKeys(value));
  for (const k of keys) os.delete(k);
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve(keys.length);
    t.onerror = () => reject(t.error);
  });
}

export async function clearStore(store) {
  const t = await tx(store, 'readwrite');
  t.objectStore(store).clear();
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

// Estimativa de espaço usado no navegador (para avisos de backup).
export async function estimateStorage() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const { usage, quota } = await navigator.storage.estimate();
      return { usage: usage || 0, quota: quota || 0 };
    } catch {
      return { usage: 0, quota: 0 };
    }
  }
  return { usage: 0, quota: 0 };
}
