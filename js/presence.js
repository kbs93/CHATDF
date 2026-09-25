// ========================================================================
// presence.js - Gerenciamento Unificado de Presença e Status Online (RTDB)
// ========================================================================
import { rtdb } from "./firebase-config.js";
import {
  ref,
  set,
  update,
  onValue,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

const TEMPO_LIMITE_OFFLINE_MS = 120000; // 2 minutos de tolerância sem sinal

/**
 * Atualiza ou define o status de um usuário específico no nó status/{userId}
 */
export async function setUserStatus(userId, statusData) {
  if (!userId) return;
  const userStatusRef = ref(rtdb, "status/" + userId);
  await update(userStatusRef, {
    uid: userId,
    lastChanged: Date.now(),
    ...statusData
  });
}

/**
 * Escuta se determinado usuário está online para exibir a bolinha de status
 */
export function listenUserOnlineStatus(userId, callback) {
  if (!userId || typeof callback !== "function") return () => {};
  const statusRef = ref(rtdb, "status/" + userId);
  return onValue(statusRef, (snapshot) => {
    const statusData = snapshot.val();
    const agora = Date.now();
    const sinalValido = statusData?.lastChanged && (agora - statusData.lastChanged < TEMPO_LIMITE_OFFLINE_MS);
    const isOnline = statusData?.online === true && sinalValido;
    callback(isOnline, statusData);
  });
}

// ========================================================================
// CONTROLE DE CONEXÃO, HEARTBEAT E DESCONEXÃO ÚNICA
// ========================================================================
let heartbeatInterval = null;
let connectedListenerActive = false;
let currentTrackingUser = null;
let lastRegisteredRoom = null;
let roomDebounceTimeout = null;

export async function trackUserRoomPresence(user, appState, currentRoomFallback = "geral") {
  if (!user || !user.uid) return;
  currentTrackingUser = user;

  const getSalaAtual = () => (appState?.currentRoom || currentRoomFallback || "geral").toLowerCase();
  const userStatusRef = ref(rtdb, "status/" + user.uid);
  const connectedRef = ref(rtdb, ".info/connected");

  const getPayloadPresenca = () => {
    const vipData = appState?.currentUser?.vipData || {};
    const fotoReal =
      appState?.currentUser?.foto ||
      appState?.currentUser?.avatar ||
      window.__currentProfileData?.foto ||
      user.photoURL ||
      "./img/avatar.png";

    const nomeReal =
      appState?.currentUser?.nome ||
      appState?.currentUser?.displayNameChat ||
      user.displayName ||
      "Usuário";

    return {
      uid: user.uid,
      name: nomeReal,
      avatar: fotoReal,
      online: true,
      sala: getSalaAtual(),
      lastChanged: Date.now(),
      ...vipData
    };
  };

  // 1. Ouvinte central do socket (evita duplicar ouvintes da conexão)
  if (!connectedListenerActive) {
    connectedListenerActive = true;
    onValue(connectedRef, async (snap) => {
      if (snap.val() === true && currentTrackingUser?.uid) {
        const refAtiva = ref(rtdb, "status/" + currentTrackingUser.uid);
        
        // Arma a desconexão suave no servidor
        await onDisconnect(refAtiva).update({
          online: false,
          lastChanged: Date.now()
        });

        // Grava o status online inicial
        await set(refAtiva, getPayloadPresenca());
        lastRegisteredRoom = getSalaAtual();
      }
    });
  }

  // 2. Limpa cronômetro antigo de batimento antes de iniciar novo
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // 3. Heartbeat a cada 45 segundos para renovar a atividade
  heartbeatInterval = setInterval(async () => {
    try {
      if (!currentTrackingUser?.uid) return;
      await update(userStatusRef, {
        online: true,
        lastChanged: Date.now(),
        sala: getSalaAtual()
      });
    } catch (err) {
      console.warn("Falha no batimento de presença:", err);
    }
  }, 45000);
}

// ========================================================================
// DEBOUNCE NA TROCA DE SALAS (7 SEGUNDOS)
// ========================================================================
export function debounceUpdateRoomPresence(userId, novaSala) {
  if (!userId || !novaSala) return;

  const salaNormalizada = String(novaSala).toLowerCase().trim();
  if (lastRegisteredRoom === salaNormalizada) return;

  if (roomDebounceTimeout) {
    clearTimeout(roomDebounceTimeout);
    roomDebounceTimeout = null;
  }

  roomDebounceTimeout = setTimeout(async () => {
    try {
      const userStatusRef = ref(rtdb, "status/" + userId);
      await update(userStatusRef, {
        sala: salaNormalizada,
        lastChanged: Date.now()
      });
      lastRegisteredRoom = salaNormalizada;
      roomDebounceTimeout = null;
    } catch (err) {
      console.warn("Falha ao atualizar presença com debounce:", err);
    }
  }, 7000);
}

// ========================================================================
// FUNÇÕES DE CONSUMO DELEGADAS (UTILIZADAS POR salas.js E users-panel.js)
// ========================================================================

/**
 * Escuta centralizada para alimentar os contadores de cada sala (salas.js)
 */
export function listenRoomsUserCounts(salasArray, callback) {
  if (!Array.isArray(salasArray) || typeof callback !== "function") return () => {};
  const statusRef = ref(rtdb, "status");

  return onValue(statusRef, (snapshot) => {
    const statusData = snapshot.val() || {};
    const agora = Date.now();
    const counts = {};

    salasArray.forEach((s) => {
      counts[s.id] = 0;
    });

    Object.values(statusData).forEach((u) => {
      if (!u || u.online !== true) return;
      const ultimaAtividade = u.lastChanged || 0;
      if (agora - ultimaAtividade > TEMPO_LIMITE_OFFLINE_MS) return;

      const salaAtual = (u.sala || "").toLowerCase();
      if (counts[salaAtual] !== undefined) {
        counts[salaAtual]++;
      }
    });

    callback(counts);
  });
}

/**
 * Escuta centralizada para listar quem está online na sala atual (users-panel.js)
 */
export function listenRoomOnlineUsers(getSalaAtualCallback, callback) {
  if (typeof callback !== "function") return () => {};
  const statusRef = ref(rtdb, "status");

  return onValue(statusRef, (snapshot) => {
    const data = snapshot.val();
    const agora = Date.now();
    const salaAlvo = typeof getSalaAtualCallback === "function" ? getSalaAtualCallback().toLowerCase() : "geral";

    if (!data || typeof data !== "object") {
      callback([]);
      return;
    }

    const onlineUsers = Object.entries(data)
      .map(([uid, user]) => {
        if (!user || typeof user !== "object") return null;
        return { uid, ...user };
      })
      .filter((user) => {
        if (!user || !user.uid) return false;
        const mesmaSala = !user.sala || user.sala.toLowerCase() === salaAlvo;
        if (!mesmaSala) return false;
        if (user.online === false || user.online === "false") return false;

        const sinalValido = !user.lastChanged || (agora - user.lastChanged < TEMPO_LIMITE_OFFLINE_MS);
        return (user.online === true || user.online === "true") && sinalValido;
      });

    callback(onlineUsers);
  });
}