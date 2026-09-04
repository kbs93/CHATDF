// ========================================================================
// presence.js - Gerenciamento de Presença e Status Online (RTDB)
// ========================================================================
import { rtdb } from "./firebase-config.js";
import { ref, set, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

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

    const gravarStatusOnline = async () => {
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

      await set(userStatusRef, {
        uid: user.uid,
        name: nomeReal,
        avatar: fotoReal,
        online: true,
        sala: appState?.currentRoom || currentRoomFallback,
        lastChanged: Date.now(),
        ...vipData
      });
    };

    // 1. Grava online de imediato para não depender de delay inicial
    await gravarStatusOnline();

    // 2. Configura a desconexão automática e reconexão contínua
    onValue(connectedRef, async (snap) => {
      if (snap.val() === true) {
        await onDisconnect(userStatusRef).update({
          online: false,
          lastChanged: Date.now()
        });

        await gravarStatusOnline();
      }
    });

    // 3. Heartbeat: a cada 45 segundos renova o carimbo no Firebase para manter o usuário ativo
    heartbeatInterval = setInterval(async () => {
      try {
        await gravarStatusOnline();
      } catch (err) {
        console.warn("Falha no batimento de presença:", err);
      }
    }, 45000);

  } catch (err) {
    console.error("Erro ao atualizar presença da sala:", err);
  }
}