// ============================== IMPORTS ======================================================

import { auth, db, rtdb } from "./firebase-config.js";
import { showToast } from "./ui.js";
import {
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { formatarAutorVipChat } from "./vip.js";


// ========================= CACHE LOCAL ONLINE =========================
const ONLINE_USERS_CACHE_KEY = "chatdf_online_users_cache";
const DEFAULT_AVATAR = "./img/avatar.png";

function sanitizeAvatar(avatar) {
  if (!avatar || typeof avatar !== "string") {
    return DEFAULT_AVATAR;
  }

  const trimmed = avatar.trim();

  if (
    trimmed.includes("127.0.0.1") ||
    trimmed.includes("localhost")
  ) {
    return DEFAULT_AVATAR;
  }

  return trimmed;
}
function saveOnlineUsersCache(users) {
  try {
    const safeUsers = users.map(user => ({
      uid: user.uid || null,
      name: user.name || "Usuário",
      avatar: sanitizeAvatar(user.avatar),
      idade: user.idade || "",
      genero: user.genero || "",
      cidade: user.cidade || "",
      recado: user.recado || "",
      online: !!user.online,
      lastChanged: user.lastChanged || Date.now(),
      membroDesde: user.membroDesde || null,
      isVip: user.isVip || false,
      vipNameColorType: user.vipNameColorType || "solid",
      vipNameColorSolid: user.vipNameColorSolid || "#1E293B",
      vipNameFont: user.vipNameFont || "default",
      vipAvatarFrame: user.vipAvatarFrame || "none"
    }));

    localStorage.setItem(
      ONLINE_USERS_CACHE_KEY,
      JSON.stringify(safeUsers)
    );
  } catch (err) {
    console.warn("Erro ao salvar cache de usuários online:", err);
  }
}


function loadOnlineUsersCache() {
  try {
    const raw = localStorage.getItem(ONLINE_USERS_CACHE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(user => user && user.uid && user.online === true);
  } catch (err) {
    console.warn("Erro ao carregar cache de usuários online:", err);
    return [];
  }
}
// edita os usuarios no painel da lateral
function buildOnlineUserItem(user) {
  const item = document.createElement("div");
  item.className = "online-user";

  const avatar = sanitizeAvatar(user.avatar);
  const name = user.name || "Usuário";

  const {
    classeEfeito: classeEfeitoNome,
    corInline: corInlineNome,
    fonteInline: fonteInlineNome,
    tagDiamante,
    moldura
  } = formatarAutorVipChat(user);

item.innerHTML = `
    <div class="message-avatar-wrap avatar-wrapper position-relative d-inline-flex align-items-center justify-content-center" style="width: 36px; height: 36px; min-width: 36px; min-height: 36px; flex-shrink: 0;">
      <img src="${avatar}" alt="" onerror="this.src='./img/avatar.png'" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block;">
      <div class="avatar-frame position-absolute rounded-circle ${moldura && moldura !== 'none' ? moldura : 'd-none'}" style="top: 0; left: 0; width: 100%; height: 100%; box-sizing: border-box; pointer-events: none; z-index: 2;"></div>
      <span class="status-dot"></span>
    </div>
    <span class="message-author-name ${classeEfeitoNome}" style="font-weight: 600; font-size: 15px; line-height: 1.3; ${corInlineNome} ${fonteInlineNome} display: inline-flex; align-items: center; gap: 3px; max-width: calc(100% - 48px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
      ${name}${tagDiamante}
    </span>
  `;

  item.addEventListener("click", () => {
    if (!user.uid) return;

    if (!auth.currentUser) {
      showToast("Faça login no site");
      const modal = document.getElementById("loginModal");
      if (modal) modal.classList.remove("hidden");
      return;
    }

    if (typeof window.openMainProfilePanel === "function") {
      const reportBtn = document.getElementById("reportUserBtn");
      if (reportBtn) {
        reportBtn.setAttribute("data-target-uid", user.uid);
      }
      window.openMainProfilePanel(user.uid, {
        isOwner: false,
        userData: {
          name: user.name || "Usuário",
          avatar: sanitizeAvatar(user.avatar),
          idade: user.idade || "",
          genero: user.genero || "",
          cidade: user.cidade || "",
          recado: user.recado || "",
          vistoPorUltimo: user.lastChanged || null,
          membroDesde: user.membroDesde || null
        }
      });
    }
  });

  return item;
}

function renderOnlineUsers(listEl, countEl, users) {
  if (!listEl) return;

  const fragment = document.createDocumentFragment();
  users.forEach(user => {
    fragment.appendChild(buildOnlineUserItem(user));
  });
  listEl.replaceChildren(fragment);
  if (countEl) {
    countEl.textContent = String(users.length);
  }
}
// ========================= PAINEL ========================================
export function initUsersPanel(openPanel, closeAllPanels) {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("#openOnlineUsers");
    if (!btn) return;

    e.preventDefault();
    openPanel("users");
document.body.classList.add("panel-open");
  });

  document.getElementById("closeOnlinePanel")?.addEventListener("click", () => {
  closeAllPanels();
document.body.classList.remove("panel-open");
  });

  // ========================= LISTA ONLINE =========================

  const onlineUsersList = document.getElementById("onlineUsersList");
  const onlineCount = document.getElementById("onlineCount");
  const statusRef = ref(rtdb, "status");

  // renderiza cache imediatamente para evitar piscar no F5
const cachedUsers = loadOnlineUsersCache();
if (cachedUsers.length) {
  renderOnlineUsers(onlineUsersList, onlineCount, cachedUsers);
}
  
// Tolerância para quedas rápidas de conexão (evita piscar a bolinha verde)
// Limite de 2 minutos (120000ms) sem pulso para descartar conexões mortas/fantasmas
  const LIMITE_INATIVIDADE_MS = 120000;

  onValue(statusRef, (snapshot) => {
    if (!onlineUsersList) return;

    const data = snapshot.val();
    const agora = Date.now();
    const salaAtual = window.appState?.currentRoom || "geral";

    if (!data || typeof data !== "object") {
      const fallbackUsers = loadOnlineUsersCache();
      if (fallbackUsers.length) {
        renderOnlineUsers(onlineUsersList, onlineCount, fallbackUsers);
      } else {
        if (onlineCount) onlineCount.textContent = "0";
        onlineUsersList.replaceChildren();
      }
      return;
    }

    const users = Object.entries(data)
      .map(([uid, user]) => {
        if (!user || typeof user !== "object") return null;
        return { uid, ...user };
      })
      .filter(user => {
        if (!user || !user.uid) return false;
        
        // 1. Filtra para exibir apenas usuários que pertencem à mesma sala aberta
        const mesmaSala = !user.sala || user.sala.toLowerCase() === salaAtual.toLowerCase();
        if (!mesmaSala) return false;

        // 2. Se for explicitamente offline no Firebase, descarta imediatamente
        if (user.online === false || user.online === "false") return false;

        // 3. Valida se o heartbeat do usuário respondeu nos últimos 2 minutos
        const sinalValido = !user.lastChanged || (agora - user.lastChanged < LIMITE_INATIVIDADE_MS);

        return (user.online === true || user.online === "true") && sinalValido;
      });

    renderOnlineUsers(onlineUsersList, onlineCount, users);
    saveOnlineUsersCache(users);

    if (!window.__onlineFirstPaintDone) {
      window.dispatchEvent(new CustomEvent("chatdf:first-online-render"));
      window.__onlineFirstPaintDone = true;
    }
  });

}








