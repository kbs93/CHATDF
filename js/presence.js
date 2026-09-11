// ========================================================================
// presence.js - Gerenciamento de Presença e Status Online (RTDB)
// ========================================================================
import { rtdb } from "./firebase-config.js";
import { ref, set, update, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

/**
 * Atualiza ou define o status de um usuário específico no nó status/{userId}
 */
export async function setUserStatus(userId, statusData) {
  if (!userId) return;
  const userStatusRef = ref(rtdb, "status/" + userId);
  await set(userStatusRef, {
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
    const isOnline = statusData?.online === true;
    callback(isOnline, statusData);
  });
}

/**
 * Registra o usuário atual na sala conectada com fallback via onDisconnect
 */


let heartbeatInterval = null;

/**
 * Registra o usuário atual na sala conectada com fallback via onDisconnect e batimento contínuo
 */


/**
 * Registra o usuário atual na sala conectada com fallback via onDisconnect e batimento contínuo
 */
export async function trackUserRoomPresence(user, appState, currentRoomFallback = "geral") {
  if (!user || !user.uid) return;

  // Evita duplicar múltiplos cronômetros se a função for chamada novamente
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  try {
    const userStatusRef = ref(rtdb, "status/" + user.uid);
    const connectedRef = ref(rtdb, ".info/connected");

    const getPayloadPresenca = () => {
      const vipData = appState?.currentUser?.vipData || {};
      const fotoReal =
        appState?.currentUser?.foto ||
        appState?.currentUser?.avatar ||
        window.__currentProfileData?.foto ||
        appState?.currentUser?.photoURL ||
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
        sala: (appState?.currentRoom || currentRoomFallback).toLowerCase(),
        lastChanged: Date.now(),
        ...vipData
      };
    };

    // 1. Escuta a conexão nativa do Firebase (gerencia quedas e voltas reais do socket)
    onValue(connectedRef, async (snap) => {
      if (snap.val() === true) {
        // Arma a ação de desconexão no servidor
        await onDisconnect(userStatusRef).update({
          online: false,
          lastChanged: Date.now()
        });

        // Grava o status online inicial do usuário
        await set(userStatusRef, getPayloadPresenca());
      }
    });

    // 2. Heartbeat leve: a cada 45 segundos APENAS atualiza o carimbo de tempo sem sobrescrever o nó
    heartbeatInterval = setInterval(async () => {
      try {
        await update(userStatusRef, {
          online: true,
          lastChanged: Date.now(),
          sala: (appState?.currentRoom || currentRoomFallback).toLowerCase()
        });
      } catch (err) {
        console.warn("Falha no batimento de presença:", err);
      }
    }, 45000);

  } catch (err) {
    console.error("Erro ao atualizar presença da sala:", err);
  }
}









