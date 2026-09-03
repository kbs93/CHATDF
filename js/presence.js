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
export async function trackUserRoomPresence(user, appState, currentRoomFallback = "geral") {
  if (!user) return;

  try {
    const userStatusRef = ref(rtdb, "status/" + user.uid);
    const connectedRef = ref(rtdb, ".info/connected");
    const vipData = appState?.currentUser?.vipData || {};

    onValue(connectedRef, async (snap) => {
      if (snap.val() === true) {
        await onDisconnect(userStatusRef).update({
          online: false,
          lastChanged: Date.now()
        });

        const fotoReal =
          appState?.currentUser?.foto ||
          appState?.currentUser?.avatar ||
          window.__currentProfileData?.foto ||
          appState?.currentUser?.photoURL ||
          "./img/avatar.png";

        await set(userStatusRef, {
          uid: user.uid,
          name: appState?.currentUser?.nome || appState?.currentUser?.displayNameChat || user.displayName || "Usuário",
          avatar: fotoReal,
          online: true,
          sala: appState?.currentRoom || currentRoomFallback,
          lastChanged: Date.now(),
          ...vipData
        });
      }
    });
  } catch (err) {
    console.error("Erro ao atualizar presença da sala:", err);
  }
}