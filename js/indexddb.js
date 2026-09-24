import { db } from './firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

const DB_NAME = "ChatDF_LocalDatabase";
const DB_VERSION = 1;
const STORE_PROFILES = "user_profiles";
const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 horas de validade

// Cache primária em memória RAM da aba (acesso síncrono em 0ms)
const memoryCache = new Map();

// Fila para evitar requisições repetidas ao mesmo UID no Firebase
const pendingRequests = new Map();

let idbPromise = null;

/**
 * Inicializa e mantém a conexão assíncrona única com o IndexedDB.
 */
function getIDB() {
  if (!idbPromise) {
    idbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const idb = event.target.result;
        if (!idb.objectStoreNames.contains(STORE_PROFILES)) {
          idb.createObjectStore(STORE_PROFILES, { keyPath: "uid" });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  return idbPromise;
}

/**
 * Lê o registo de um perfil gravado no IndexedDB.
 */
async function getProfileFromIDB(uid) {
  try {
    const idb = await getIDB();
    return new Promise((resolve) => {
      const transaction = idb.transaction(STORE_PROFILES, "readonly");
      const store = transaction.objectStore(STORE_PROFILES);
      const req = store.get(uid);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn("Falha na leitura do IndexedDB:", err);
    return null;
  }
}

/**
 * Grava ou atualiza a ficha do perfil no IndexedDB.
 */
async function saveProfileToIDB(profileData) {
  try {
    const idb = await getIDB();
    return new Promise((resolve) => {
      const transaction = idb.transaction(STORE_PROFILES, "readwrite");
      const store = transaction.objectStore(STORE_PROFILES);
      store.put(profileData);

      transaction.oncomplete = () => resolve(true);
      transaction.onerror = () => resolve(false);
    });
  } catch (err) {
    console.warn("Falha na gravação do IndexedDB:", err);
    return false;
  }
}

/**
 * Procura os dados oficiais na coleção /users do Firestore.
 */
async function fetchProfileFromFirestore(uid) {
  try {
    const docRef = doc(db, "users", uid);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      return {
        uid,
        user: "Usuário",
        photo: "./img/avatar.png",
        cidade: "",
        vipNameColorType: "solid",
        vipNameColorSolid: "#1E293B",
        vipNameFont: "default",
        vipAvatarFrame: "none",
        cachedAt: Date.now()
      };
    }

    const data = snap.data();
    return {
      uid,
      user: data.nome || data.displayName || "Usuário",
      photo: data.foto || data.avatar || data.photoURL || "./img/avatar.png",
      cidade: data.cidade || data.city || "",
      vipNameColorType: data.vipNameColorType || "solid",
      vipNameColorSolid: data.vipNameColorSolid || "#1E293B",
      vipNameFont: data.vipNameFont || "default",
      vipAvatarFrame: data.vipAvatarFrame || "none",
      isVip: data.isVip === true,
      cachedAt: Date.now()
    };
  } catch (err) {
    console.error(`Erro ao obter perfil remoto do utilizador (${uid}):`, err);
    return null;
  }
}

/**
 * Resolve o perfil do utilizador seguindo o fluxo de camadas:
 * 1. RAM da aba -> 2. IndexedDB -> 3. Firestore /users (com deduplicação)
 *
 * @param {string} uid Identificador único do utilizador
 * @param {object} fallbackData Dados provisórios caso existam na mensagem legada
 * @returns {Promise<object>} Ficha consolidada do utilizador
 */
export async function resolveUserProfile(uid, fallbackData = {}) {
  if (!uid) {
    return {
      user: fallbackData.user || "Usuário",
      photo: fallbackData.photo || fallbackData.avatar || "./img/avatar.png",
      cidade: fallbackData.cidade || "",
      vipNameColorType: fallbackData.vipNameColorType || "solid",
      vipNameColorSolid: fallbackData.vipNameColorSolid || "#1E293B",
      vipNameFont: fallbackData.vipNameFont || "default",
      vipAvatarFrame: fallbackData.vipAvatarFrame || "none"
    };
  }

  // 1. Verificação na Memória RAM
  if (memoryCache.has(uid)) {
    return memoryCache.get(uid);
  }

  // 2. Verificação no IndexedDB (Disco Local)
  const cachedIDB = await getProfileFromIDB(uid);
  const now = Date.now();

  if (cachedIDB && (now - cachedIDB.cachedAt < CACHE_TTL_MS)) {
    memoryCache.set(uid, cachedIDB);
    return cachedIDB;
  }

  // 3. Deduplicação de requisições ao Firestore
  if (pendingRequests.has(uid)) {
    return await pendingRequests.get(uid);
  }

  const fetchPromise = (async () => {
    const remoteProfile = await fetchProfileFromFirestore(uid);
    const finalProfile = remoteProfile || cachedIDB || {
      uid,
      user: fallbackData.user || "Usuário",
      photo: fallbackData.photo || fallbackData.avatar || "./img/avatar.png",
      cidade: fallbackData.cidade || "",
      vipNameColorType: fallbackData.vipNameColorType || "solid",
      vipNameColorSolid: fallbackData.vipNameColorSolid || "#1E293B",
      vipNameFont: fallbackData.vipNameFont || "default",
      vipAvatarFrame: fallbackData.vipAvatarFrame || "none",
      cachedAt: now
    };

    memoryCache.set(uid, finalProfile);
    saveProfileToIDB(finalProfile);
    pendingRequests.delete(uid);

    return finalProfile;
  })();

  pendingRequests.set(uid, fetchPromise);
  return await fetchPromise;
}

/**
 * Atualiza o cache local imediatamente caso o próprio utilizador altere o perfil.
 */
export function invalidateLocalProfile(uid) {
  memoryCache.delete(uid);
}