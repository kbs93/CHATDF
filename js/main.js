// ============================== IMPORTS ======================================================
import { avataresEles, avataresElas, avataresUnissex } from "./avatar.js";
import { initAuth } from "./auth.js";
import { initMessages, sendMessage } from './messages.js?v=2';
import { showToast, openAttachmentSheet, openUIPanel, textColorPalette } from "./ui.js";
import { initStickerPanel } from "./stickers-panel.js";

import { auth, db, rtdb } from "./firebase-config.js";
import { ref as dbRef, onValue as dbOnValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { initUsersPanel } from "./users-panel.js";
import { initDenuncias } from "./bloqueio.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { setUserStatus, listenUserOnlineStatus, trackUserRoomPresence } from "./presence.js";


import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

import {
  addDoc,
  collection,
  serverTimestamp,
  setDoc,
  doc,
  getDoc,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Importação do Módulo VIP Isolado
import {
  aplicarVisualVipCompleto,
  restaurarVisualPadraoPerfil,
  inicializarPainelVipDinamico,
  initVipEngine,
  abrirPainelVip,
  fecharPainelVip
} from "./vip.js";
// Importação do Módulo de Curtidas & Interesses Isolado tag 30-08-26
import {
  renderProfileInterests,
  renderEditInterestsSelector,
  setSelectedInterests,
  selectedInterests
} from "./curtidas.js";

// ========================================================================
// ROTINA DE VERIFICACAO E RESET AUTOMÁTICO DO VIP EXPIRADO
// ========================================================================
export async function verificarEExpiraVipUsuario(userId, userData) {
  if (!userId || !userData) return userData;

  if (userData.isVip === true) {
    const agora = Date.now();
    const expiresAt = userData.vipExpiresAt || 0;

    // Se a validade for menor ou igual a agora, zera e reseta para usuário comum
    if (expiresAt <= agora) {
      try {
        const refUser = doc(db, "users", userId);
        const resetData = {
          isVip: false,
          vipExpiresAt: 0,
          vipNameColorType: "none",
          vipNameColorSolid: "#1E293B",
          vipNameFont: "default",
          vipMsgColor: "#333333",
          vipAvatarFrame: "none",
          vipProfileBanner: "default",
          vipBannerUrl: ""
        };

        await updateDoc(refUser, resetData);

        await setUserStatus(userId, {
          name: userData.nome || "Usuário",
          avatar: userData.foto || "./img/avatar.png",
          online: true,
          sala: appState.currentRoom || sala,
          ...resetData
        });

        Object.assign(userData, resetData);
      } catch (err) {
        console.error("Erro ao expirar VIP do usuário:", err);
      }
    }
  }
  return userData;
}

// Torna a função acessível para o setInterval do vip.js
window.verificarEExpiraVipUsuario = verificarEExpiraVipUsuario;

let overlay;
document.body.classList.add("chat-loading");

// ================= GERENCIADOR DE PAINÉIS padronizando mobile e desktop =================
// ================= GERENCIADOR DE PAINÉIS padronizando mobile e desktop =================
let currentPanel = null;
function openPanel(panelName) {
  const isAlreadyOpen = currentPanel === panelName;
  closeAllPanels();
  
  if (isAlreadyOpen) return;

  currentPanel = panelName;
  const backdrop = document.getElementById("chatPanelsBackdrop");

  if (panelName === "users") {
    document.getElementById("onlineUsersPanel")?.classList.add("open");
    overlay?.classList.add("open");
  }
  if (panelName === "attachments") {
    attachmentPanel?.classList.add("show");
    if (window.innerWidth <= 768) backdrop?.classList.remove("hidden");
  }
  if (panelName === "emojis") {
    const stickerPanel = document.getElementById("stickerPanel");
    stickerPanel?.classList.add("show");
    if (window.innerWidth <= 768) backdrop?.classList.remove("hidden");
  }
}

function closeAllPanels() {
  currentPanel = null;
  document.getElementById("onlineUsersPanel")?.classList.remove("open");
  attachmentPanel?.classList.remove("show");
  document.getElementById("stickerPanel")?.classList.remove("show");
  document.getElementById("chatPanelsBackdrop")?.classList.add("hidden");
  if (window.closeColorPanel) {
    window.closeColorPanel();
  }
  overlay?.classList.remove("open");
}

  const attachmentActions = {
  users: () => {
    openPanel("users");
  },
  rooms: () => {
    const modal = document.getElementById("roomsModal");
    modal?.classList.remove("hidden");
  },
  profile: async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (typeof window.openMainProfilePanel === "function") {
      await window.openMainProfilePanel(user.uid);
    } else {
      showToast("Painel de perfil ainda não criado.");
    }
  },
  gallery: () => showToast("Galeria em breve."),
  camera: () => showToast("Câmera em breve."),
  location: () => showToast("Localização em breve."),
  contact: () => showToast("Contato em breve."),
  documento: () => showToast("Documento em breve."),
  audio: () => showToast("Áudio em breve."),
  poll: () => showToast("Enquete em breve."),
  event: () => showToast("Evento em breve."),
  ai: () => {
    const modal = document.getElementById("feedbackModal");
    modal?.classList.remove("hidden");
  }
};
window.attachmentActions = attachmentActions;

// DOM ELEMENTS 
const isChatRoute = window.location.pathname.includes("chat.html");
const attachBtn = document.getElementById("attachBtn");
const attachmentPanel = document.getElementById("attachmentPanel");
let messageInput;
let chatInitialized = false;

function autoResize() {
  if (!messageInput) return;
  const scrollHeight = messageInput.scrollHeight;
  const currentHeight = messageInput.offsetHeight;
  if (scrollHeight !== currentHeight) {
    messageInput.style.height = scrollHeight + "px";
  }
}

const urlParams = new URLSearchParams(window.location.search);
const sala = urlParams.get("sala") || "geral";

const appState = {
  userReady: false,
  currentUser: null,
  currentRoom: sala,
  chatMounted: false,
  unsubscribeMessages: null,
  unsubscribeProfileLock: null,
  reportCount: 0
};
window.appState = appState;

function updateUserRoomPresence() {
  const user = auth.currentUser;
  if (!user) return;
  trackUserRoomPresence(user, appState, sala);
}

window.addEventListener("online", () => {
  if (auth.currentUser) {
    updateUserRoomPresence();
  }
});

function atualizarBloqueioCampoMensagem(perfilCompleto) {
  const wrapper = document.getElementById("message-input-wrapper");
  let aviso = document.getElementById("messageProfileLock");
  const input = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");

  if (!wrapper) return;

  if (perfilCompleto === true) {
    wrapper.classList.remove("profile-locked");
    if (aviso) aviso.classList.add("hidden");
    input?.removeAttribute("disabled");
    sendBtn?.removeAttribute("disabled");
    return;
  }

  if (aviso) {
    aviso.className = "message-profile-lock-btn";
    aviso.innerHTML = `<i class="bi bi-pencil-square" style="font-size:22px;"></i> Complete o seu perfil para liberar o envio de mensagens`;
    aviso.style.display = "flex";
    aviso.style.alignItems = "center";
    aviso.style.justifyContent = "center";
    aviso.style.textAlign = "center";
    aviso.style.width = "100%";
    aviso.style.height = "50%";
    aviso.style.padding = "10px 16px";
    aviso.style.boxSizing = "border-box";
    aviso.style.gap = "1px";
    aviso.style.cursor = "pointer";
    aviso.style.fontSize = "0.95rem";
    aviso.style.fontWeight = "600";
    aviso.style.color = "#213883c7";

    aviso.onclick = (e) => {
      e.preventDefault();
      document.dispatchEvent(new CustomEvent("chatdf:open-profile"));
    };
  }

  wrapper.classList.add("profile-locked");
  if (aviso) aviso.classList.remove("hidden");
  input?.setAttribute("disabled", "disabled");
  sendBtn?.setAttribute("disabled", "disabled");
}

function mountChatIfNeeded() {
  if (!isChatRoute) return;
  if (appState.chatMounted) return;
  setupChat();
}

async function handleUserReady(detail = {}) {
  appState.userReady = true;
  appState.currentUser = detail.user || auth.currentUser || null;
  
  if (detail.userData && appState.currentUser) {
    detail.userData = await verificarEExpiraVipUsuario(appState.currentUser.uid, detail.userData);
  }

if (detail.userData?.nome) {
    appState.currentUser.nome = detail.userData.nome;
    appState.currentUser.displayNameChat = detail.userData.nome;
  }

  if (detail.userData?.foto) {
    appState.currentUser.foto = detail.userData.foto;
    appState.currentUser.avatar = detail.userData.foto;
  }

  appState.userCity = null;
  if (detail.userData && detail.userData.cidade) {
    appState.userCity = detail.userData.cidade;
  }

  if (detail.userData) {
    appState.currentUser.vipData = {
      isVip: detail.userData.isVip || false,
      vipNameColorType: detail.userData.vipNameColorType || "solid",
      vipNameColorSolid: detail.userData.vipNameColorSolid || "#1E293B",
      vipNameFont: detail.userData.vipNameFont || "default",
      vipAvatarFrame: detail.userData.vipAvatarFrame || "none"
    };
  }

  if (isChatRoute) {
    if (detail.userData) {
      atualizarBloqueioCampoMensagem(detail.userData.perfilCompleto === true);
      
      const input = document.getElementById("messageInput");
      if (input && detail.userData.vipMsgColor) {
        input.style.color = detail.userData.vipMsgColor;
        input.style.caretColor = detail.userData.vipMsgColor;
      }
    }
    updateUserRoomPresence();
  }
}

function handleUserLogout() {
  appState.userReady = false;
  appState.currentUser = null;
  appState.reportCount = 0;

  window.replyingTo = null;

  const roomTitle = document.getElementById("chatRoomName");
  if (roomTitle) {
    roomTitle.textContent = appState.currentRoom || sala;
  }

  document.body.classList.remove("keyboard-open");
  closeAllPanels();

  if (typeof appState.unsubscribeProfileLock === "function") {
    appState.unsubscribeProfileLock();
    appState.unsubscribeProfileLock = null;
  }

  atualizarBloqueioCampoMensagem(false);
}

function cleanupChatMessages() {
  if (typeof appState.unsubscribeMessages === "function") {
    appState.unsubscribeMessages();
    appState.unsubscribeMessages = null;
  }
}

// AUTH + MENSAGENS
initAuth(showToast);
initUsersPanel(openPanel, closeAllPanels);
document.addEventListener("chatdf:user-ready", (e) => {
  handleUserReady(e.detail || {});
});

document.addEventListener("chatdf:user-logout", () => {
  handleUserLogout();
});

document.addEventListener("chatdf:open-profile", async () => {
  const user = auth.currentUser;
  if (!user) {
    showToast("Faça login para editar seu perfil.");
    return;
  }

  if (typeof window.openMainProfilePanel === "function") {
    await window.openMainProfilePanel(user.uid);
  } else {
    showToast("Painel de perfil ainda não carregado.");
  }
});

// Ações Globais de Clique
document.addEventListener("click", (e) => {
  const vipBuyBtn = e.target.closest("#btnBuyVip");
  if (vipBuyBtn) {
    e.preventDefault();
    const promoSec = document.getElementById("vipPromoSection");
    const settingsSec = document.getElementById("vipSettingsSection");

    if (promoSec && settingsSec) {
      promoSec.classList.add("d-none");
      settingsSec.classList.remove("d-none");
    }
    return;
  }

  const btn = e.target.closest(".open-login");
  if (btn) {
    e.preventDefault();
    const modal = document.getElementById("loginModal");
    if (modal) modal.classList.remove("hidden");
    return;
  }

  const openPrivacyBtn = e.target.closest("#openPrivacyModalBtn");
  if (openPrivacyBtn) {
    e.preventDefault();
    const privacyWrapper = document.getElementById("privacyTermsWrapper");
    if (privacyWrapper) {
      privacyWrapper.classList.remove("hidden");
      privacyWrapper.style.pointerEvents = "auto";
      document.body.style.overflow = "hidden";
    }
    return;
  }

  const closePrivacyBtn = e.target.closest("#closePrivacyModalBtn") || e.target.closest("#agreePrivacyBtn");
  if (closePrivacyBtn) {
    e.preventDefault();
    const privacyWrapper = document.getElementById("privacyTermsWrapper");
    if (privacyWrapper) {
      privacyWrapper.classList.add("hidden");
      privacyWrapper.style.pointerEvents = "none";
      document.body.style.overflow = "";
    }
    return;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  initNavbarCollapse();
  initVipEngine(() => currentProfileIsOwner);
initDenuncias(); // <--- Adicionado aqui 01-09-2026


  

  // Vincular Abertura e Retorno do VIP
  document.getElementById("vipTopHeaderBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!currentProfileIsOwner) return;
    abrirPainelVip();
  });

  document.getElementById("vipBackToProfileBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    fecharPainelVip();
  });

  if (!isChatRoute) return;
  mountChatIfNeeded();

  if (auth.currentUser) {
    handleUserReady({ user: auth.currentUser });
  }
});

function setupChat() {
  if (chatInitialized) return;
  const chat = document.getElementById("chat-container");
  const input = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");
  const emojiBtn = document.getElementById("emojiBtn");
  const stickerBtn = document.getElementById("stickerBtn");

  const attachBtn = document.getElementById("attachBtn");
  const openOnlineUsersBtn = document.getElementById("openOnlineUsers");
  overlay = document.getElementById("onlineOverlay");

  if (!chat || !input || !sendBtn) {
    console.warn("Elementos do chat não encontrados; inicialização cancelada.");
    return;
  }

  let touchStartY = 0;
  chat.addEventListener("touchstart", (e) => {
    if (window.innerWidth > 768) return;
    touchStartY = e.touches[0].clientY;
  }, { passive: true });

  chat.addEventListener("touchmove", (e) => {
    if (window.innerWidth > 768) return;

    if (document.activeElement === input) {
      let touchCurrentY = e.touches[0].clientY;
      let deltaY = Math.abs(touchCurrentY - touchStartY);

      if (deltaY > 50 && touchCurrentY < touchStartY) {
        input.blur();
      }
    }
  }, { passive: true });

// Evita que o clique no botão tire o foco antes do evento 'click' rodar
  emojiBtn?.addEventListener("mousedown", (e) => e.preventDefault());
  attachBtn?.addEventListener("mousedown", (e) => e.preventDefault());

  // Fechar painéis ao focar no campo de digitação
  input.addEventListener("focus", () => {
    closeAllPanels();
  });

  // Abertura instantânea no 1º clique
// Abertura instantânea e fechamento forçado do teclado mobile
// Abertura suave sem flash/piscada ao recolher o teclado mobile
  const abrirPainelSemFlashTeclado = (nomePainel) => {
    const tecladoEstavaAberto = document.activeElement === input || window.innerHeight < 500;
    
    if (input) input.blur();
    if (document.activeElement && typeof document.activeElement.blur === "function") {
      document.activeElement.blur();
    }

    if (tecladoEstavaAberto && window.innerWidth <= 768) {
      setTimeout(() => {
        openPanel(nomePainel);
      }, 100);
    } else {
      openPanel(nomePainel);
    }
  };

  emojiBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    abrirPainelSemFlashTeclado("emojis");
  });

  attachBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    abrirPainelSemFlashTeclado("attachments");
  });

  // Fechamento via Backdrop ao clicar fora
  document.getElementById("chatPanelsBackdrop")?.addEventListener("click", () => {
    closeAllPanels();
  });

  openOnlineUsersBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopImmediatePropagation();
    openPanel("users");
  });

  chatInitialized = true;
  appState.chatMounted = true;
  messageInput = input;
  document.title = `Chat - ${appState.currentRoom || sala}`;

  const roomTitle = document.getElementById("chatRoomName");
  if (roomTitle) {
    roomTitle.textContent = appState.currentRoom || sala;
  }

  cleanupChatMessages();
  appState.unsubscribeMessages = initMessages(chat, appState.currentRoom || sala);
  updateUserRoomPresence();
  setTimeout(() => {
    document.body.classList.remove("chat-loading");
  }, 500);

  sendBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });

const dispararEnvioMensagem = async () => {
    if (auth.currentUser && window.__currentProfileData) {
      window.__currentProfileData = await verificarEExpiraVipUsuario(auth.currentUser.uid, window.__currentProfileData);
    }
    sendMessage(input);
  };

  sendBtn.onclick = dispararEnvioMensagem;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      dispararEnvioMensagem();
    }
  });

  chat.addEventListener("click", (e) => {
    if (e.target.classList.contains("toggle-expand")) {
      const textEl = e.target.previousElementSibling;
      if (textEl && textEl.classList.contains("msg-text")) {
        const expanded = textEl.classList.toggle("expanded");
        textEl.style.maxHeight = expanded ? "none" : "4.5em";
        e.target.textContent = expanded ? "Ler mais" : "Ler menos";
      }
    }
  });

  (function handleKeyboardMobile() {
    const detectKeyboard = () => {
      if (window.innerWidth <= 768) {
        const vh = window.innerHeight;
        const body = document.body;
        if (vh < 500) body.classList.add("keyboard-open");
        else body.classList.remove("keyboard-open");
      }
    };
    window.visualViewport?.addEventListener("resize", detectKeyboard);
    window.addEventListener("resize", detectKeyboard);
  })();

  messageInput.addEventListener("input", autoResize);
  initStickerPanel();

// Fechar painel de anexos pelo botão X
  document.getElementById("closeAttachmentPanel")?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeAllPanels();
  });




}

export function resetMessageInput() {
  if (!messageInput) return;
  messageInput.removeEventListener("input", autoResize);
  messageInput.value = "";
  messageInput.style.height = "44px";
  requestAnimationFrame(() => {
    messageInput.addEventListener("input", autoResize);
  });
}

function initNavbarCollapse() {
  const navbarNav = document.getElementById("navbarNav");
  const toggler = document.querySelector(".navbar-toggler");
  if (!navbarNav || typeof bootstrap === "undefined") return;
  const collapse = bootstrap.Collapse.getOrCreateInstance(navbarNav, { toggle: false });
  collapse.hide();
  if (toggler) {
    toggler.setAttribute("aria-expanded", "false");
    toggler.classList.add("collapsed");
  }
  const navLinks = navbarNav.querySelectorAll("a");
  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      collapse.hide();
      if (toggler) {
        toggler.setAttribute("aria-expanded", "false");
        toggler.classList.add("collapsed");
      }
    });
  });
}

attachmentPanel?.addEventListener("click", (e) => {
  const item = e.target.closest(".attachment-item");
  if (!item) return;
  closeAllPanels();
  const action = item.dataset.action;
  const handler = attachmentActions[action];
  handler?.();
});

document.addEventListener("click", (e) => {
  const stickerPanelEl = document.getElementById("stickerPanel");
  const emojiBtnEl = document.getElementById("emojiBtn");
  if (stickerPanelEl?.classList.contains("show")) {
    if (!stickerPanelEl.contains(e.target) && !emojiBtnEl?.contains(e.target) && !e.target.closest("#emojiBtn")) {
      stickerPanelEl.classList.remove("show");
    }
  }

  const attachmentPanelEl = document.getElementById("attachmentPanel");
  const attachBtnEl = document.getElementById("attachBtn");
  if (attachmentPanelEl?.classList.contains("show")) {
    if (!attachmentPanelEl.contains(e.target) && !attachBtnEl?.contains(e.target) && !e.target.closest("#attachBtn")) {
      closeAllPanels();
    }
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAllPanels();
});

// Feedback
const FEEDBACK_COOLDOWN = 300;
const feedbackText = document.getElementById("feedbackText");
document.getElementById("cancelFeedback")?.addEventListener("click", () => {
  document.getElementById("feedbackModal")?.classList.add("hidden");
});
// Troca de Salas rapida
// Troca de Salas rapida com contagem em tempo real e catraca
document.getElementById("closeRoomsModal")?.addEventListener("click", () => {
  document.getElementById("roomsModal")?.classList.add("hidden");
});

const MAX_USERS_PER_ROOM_MODAL = 5;
const modalRoomCounts = {};
const listaSalasIds = ["geral", "religiao", "politica", "transito", "lugares", "futebol", "eventos", "entretenimento", "games", "concurso"];

// Listener do Realtime Database para atualizar contagem de cada sala no modal
if (isChatRoute) {
  const statusRefModal = dbRef(rtdb, "status");
  const agoraLimite = 120000;

  dbOnValue(statusRefModal, (snapshot) => {
    const statusData = snapshot.val() || {};
    const agora = Date.now();

    // 1. Zera as contagens
    listaSalasIds.forEach((id) => {
      modalRoomCounts[id] = 0;
    });

    // 2. Soma os usuários conectados e ativos por sala
    Object.values(statusData).forEach((user) => {
      if (!user || user.online !== true) return;
      if (user.lastChanged && (agora - user.lastChanged > agoraLimite)) return;

      const salaUser = user.sala ? user.sala.toLowerCase() : "";
      if (modalRoomCounts[salaUser] !== undefined) {
        modalRoomCounts[salaUser]++;
      }
    });

    // 3. Atualiza os badges no modal
    listaSalasIds.forEach((id) => {
      const badge = document.getElementById(`modal-online-${id}`);
      if (!badge) return;

      const total = modalRoomCounts[id] || 0;
    if (total >= MAX_USERS_PER_ROOM_MODAL) {
        badge.textContent = `${total}`;
        badge.classList.add("lotada");
      } else {
        badge.textContent = `${total}`;
        badge.classList.remove("lotada");
      }
    });
  });
}

document.querySelectorAll(".btn-change-room").forEach((btn) => {
  btn.addEventListener("click", () => {
    const targetRoom = btn.getAttribute("data-room");
    if (!targetRoom) return;

    if (appState.currentRoom && appState.currentRoom.toLowerCase() === targetRoom.toLowerCase()) {
      showToast("Você já está nesta sala.");
      document.getElementById("roomsModal")?.classList.add("hidden");
      return;
    }

    // Catraca no modal: bloqueia sala cheia
    const totalNaSala = modalRoomCounts[targetRoom.toLowerCase()] || 0;
    if (totalNaSala >= MAX_USERS_PER_ROOM_MODAL) {
      showToast(`A sala está cheia no momento (${MAX_USERS_PER_ROOM_MODAL}/${MAX_USERS_PER_ROOM_MODAL}). Aguarde alguns instantes!`);
      return;
    }

    window.location.href = `chat.html?sala=${encodeURIComponent(targetRoom)}`;
  });
});





document.getElementById("sendFeedback")?.addEventListener("click", async () => {
  const text = feedbackText.value.trim();
  if (!text) {
    showToast("Escreva uma sugestão.");
    return;
  }
  const lastSent = localStorage.getItem("lastFeedbackTime");
  const now = Date.now();
  if (lastSent && now - lastSent < FEEDBACK_COOLDOWN * 1000) {
    const wait = Math.ceil((FEEDBACK_COOLDOWN * 1000 - (now - lastSent)) / 1000);
    showToast(`Aguarde ${wait}s para enviar outra sugestão.`);
    return;
  }

  try {
    const user = auth.currentUser;
    await addDoc(collection(db, "feedbacks"), {
      text,
      uid: user?.uid || null,
      name: user?.displayName || "Anônimo",
      createdAt: serverTimestamp()
    });

    localStorage.setItem("lastFeedbackTime", now);
    feedbackText.value = "";
    document.getElementById("feedbackModal")?.classList.add("hidden");
    showToast("Obrigado pela sugestão!");
  } catch (err) {
    console.error(err);
    showToast("Erro ao enviar sugestão.");
  }
});

window.addEventListener("attachmentAction", (e) => {
  const action = attachmentActions[e.detail];
  action?.();
});

window.closeAllPanels = closeAllPanels;

// Menu de Mensagem
document.getElementById("contextProfileBtn")?.addEventListener("click", async (e) => {
  e.preventDefault();
  e.stopPropagation();

  const menu = document.getElementById("messageContextMenu");
  if (!menu) return;

  const userId = menu.dataset.uid;
  menu.classList.add("hidden");

  if (!userId) {
    showToast("Perfil não encontrado para essa mensagem antiga.");
    return;
  }

  if (typeof window.openMainProfilePanel === "function") {
    await window.openMainProfilePanel(userId);
  }
});

document.getElementById("contextReportBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  const menu = document.getElementById("messageContextMenu");
  const reportUserModal = document.getElementById("reportUserModal");
  const reportUserBtn = document.getElementById("reportUserBtn");

  if (!menu || !reportUserModal) return;
  const targetUid = menu.dataset.uid;

  if (!targetUid) {
    showToast("Não foi possível identificar o usuário desta mensagem.");
    return;
  }

  if (reportUserBtn) {
    reportUserBtn.setAttribute("data-target-uid", targetUid);
  }

  menu.classList.add("hidden");

  // Abre o modal de denúncia na tela
  reportUserModal.classList.remove("hidden");
  reportUserModal.style.display = "flex";
});

document.getElementById("cancelReport")?.addEventListener("click", () => {
  document.getElementById("reportModal")?.classList.add("hidden");
  currentReportData = null;
});

// Accordion Denúncia
document.addEventListener("DOMContentLoaded", () => {
  const customSelect = document.getElementById("customReportSelect");
  const trigger = document.getElementById("accordionTrigger");
  const dropdown = document.getElementById("accordionDropdown");
  const selectedText = document.getElementById("accordionSelectedText");
  const hiddenInput = document.getElementById("reportReasonSelect");

  if (trigger && dropdown) {
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = customSelect.classList.toggle("open");
      dropdown.classList.toggle("hidden", !isOpen);
    });

    dropdown.querySelectorAll(".accordion-option").forEach((option) => {
      option.addEventListener("click", (e) => {
        e.stopPropagation();
        const value = option.getAttribute("data-value");
        hiddenInput.value = value;
        selectedText.textContent = option.textContent;

        dropdown.querySelectorAll(".accordion-option").forEach(opt => opt.classList.remove("selected"));
        option.classList.add("selected");

        customSelect.classList.remove("open");
        dropdown.classList.add("hidden");
      });
    });

    document.addEventListener("click", (e) => {
      if (customSelect && !customSelect.contains(e.target)) {
        customSelect.classList.remove("open");
        dropdown.classList.add("hidden");
      }
    });
  }
});

// ===================== PERFIL DO USUÁRIO =====================
const profilePanel = document.getElementById("profilePanel");
const profileOverlay = document.getElementById("profileOverlay");
const closeProfileBtn = document.getElementById("closeProfilePanel");
const editProfileCoverBtn = document.getElementById("editProfileCoverBtn");

const profileName = document.getElementById("profileName");
const profileMood = document.getElementById("profileMood");
const profileCity = document.getElementById("profileCity");
const profileAvatar = document.getElementById("profileAvatar");
const profileOnlineDot = document.getElementById("profileOnlineDot");

const editName = document.getElementById("editName");
const editCity = document.getElementById("editCity");
const editMood = document.getElementById("editMood");
const editAge = document.getElementById("editAge");
const editGender = document.getElementById("editGender");
const saveProfileBtn = document.getElementById("saveProfileBtn");

const CIDADES_DF = [
  "Águas Claras", "Arniqueira", "Asa Norte", "Asa Sul", "Brazlândia", "Candangolândia", "Ceilândia", "Cruzeiro", "Fercal", "Gama",
  "Guará", "Guará II", "Itapoã", "Jardim Botânico", "Lago Norte", "Lago Sul", "Núcleo Bandeirante", "Paranoá", "Park Way", "Planaltina",
  "Plano Piloto", "Recanto das Emas", "Riacho Fundo", "Riacho Fundo II", "Samambaia N", "Samambaia S", "Santa Maria", "São Sebastião",
  "Estrutural", "SIA", "Sobradinho", "Sobradinho II", "Sol Nascente", "Pôr do Sol", "Sudoeste", "Octogonal", "Taguatinga", "Taguatinga N",
  "Taguatinga S", "Varjão", "Vicente Pires"
];

function criarListaCidadesPerfil() {
  if (!editCity) return;
  editCity.setAttribute("readonly", "readonly");
  editCity.setAttribute("placeholder", "Selecione sua cidade");

  const antigo = document.getElementById("cityDropdownProfile");
  if (antigo) antigo.remove();

  const lista = document.createElement("div");
  lista.id = "cityDropdownProfile";
  lista.className = "city-dropdown-profile hidden";

  CIDADES_DF.forEach((cidade) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "city-dropdown-item";
    item.textContent = cidade;

    item.addEventListener("click", () => {
      editCity.value = cidade;
      lista.classList.add("hidden");
    });
    lista.appendChild(item);
  });

  editCity.parentElement.appendChild(lista);
  editCity.addEventListener("click", (e) => {
    e.stopPropagation();
    lista.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!lista.contains(e.target) && e.target !== editCity) {
      lista.classList.add("hidden");
    }
  });
}

const GENEROS_PADRAO = ["Masculino", "Feminino", "Prefiro não dizer"];

function criarListaGeneroPerfil() {
  if (!editGender) return;
  editGender.setAttribute("readonly", "readonly");
  editGender.setAttribute("placeholder", "Selecione seu gênero");

  const antigo = document.getElementById("genderDropdownProfile");
  if (antigo) antigo.remove();

  const lista = document.createElement("div");
  lista.id = "genderDropdownProfile";
  lista.className = "gender-dropdown-profile hidden";

  GENEROS_PADRAO.forEach((genero) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "gender-dropdown-item";
    item.textContent = genero;

    item.addEventListener("click", () => {
      editGender.value = genero;
      lista.classList.add("hidden");
    });
    lista.appendChild(item);
  });

  editGender.parentElement.appendChild(lista);
  editGender.addEventListener("click", (e) => {
    e.stopPropagation();
    lista.classList.toggle("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!lista.contains(e.target) && e.target !== editGender) {
      lista.classList.add("hidden");
    }
  });
}

const profileAge = document.getElementById("profileAge");
const profileGender = document.getElementById("profileGender");
const profileMemberSince = document.getElementById("profileMemberSince");

editAge?.addEventListener("input", () => {
  let value = editAge.value.replace(/\D/g, "");
  if (value !== "" && Number(value) > 100) value = "100";
  editAge.value = value;
});

const profileCover = document.querySelector(".profile-cover");
const profileBannerPreview = document.getElementById("profileBannerPreview");
const profileBannerColors = document.getElementById("profileBannerColors");

const profileEditorModal = document.getElementById("profileEditorModal");
const closeProfileEditorBtn = document.getElementById("closeProfileEditorBtn");
const profileEditorBannerPreview = document.getElementById("profileEditorBannerPreview");
const profileEditorBannerColors = document.getElementById("profileEditorBannerColors");
const showBannerEditorBtn = document.getElementById("showBannerEditorBtn");
const openAvatarPickerBtn = document.getElementById("openAvatarPickerBtn");
const profileEditorAvatarArea = document.getElementById("profileEditorAvatarArea");
const profileEditorAvatarGrid = document.getElementById("profileEditorAvatarGrid");
const saveProfileEditorBtn = document.getElementById("saveProfileEditorBtn");

const profileEditTab = document.querySelector('.profile-tab[data-tab="edit"]');
let currentViewedProfileId = null;
let currentProfileIsOwner = false;
let profileRequestToken = 0;
const DEFAULT_PROFILE_AVATAR = "./img/avatar.png";

function formatProfileDate(value) {
  if (!value) return "-";
  let date;
  if (typeof value === "number") date = new Date(value);
  else if (value?.toDate) date = value.toDate();
  else date = new Date(value);

  if (isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

let selectedBannerColor = "#000000";
let selectedProfileAvatar = DEFAULT_PROFILE_AVATAR;
let isProfileEditLocked = false;
let profileEditRemainingDays = 0;

const PROFILE_EDIT_COOLDOWN_DAYS = 1;
const PROFILE_EDIT_COOLDOWN_MS = PROFILE_EDIT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

function getRemainingEditDays(lastEditAt) {
  if (!lastEditAt) return 0;
  const diff = Date.now() - lastEditAt;
  if (diff >= PROFILE_EDIT_COOLDOWN_MS) return 0;
  return Math.ceil((PROFILE_EDIT_COOLDOWN_MS - diff) / (24 * 60 * 60 * 1000));
}

function openProfileEditor() {
  if (!currentProfileIsOwner || !profileEditorModal) return;
  profileEditorModal.classList.remove("hidden");
  requestAnimationFrame(() => {
    profileEditorModal.classList.add("open");
  });
  showBannerEditorBtn?.classList.add("active");
  openAvatarPickerBtn?.classList.remove("active");
  profileEditorBannerPreview?.classList.remove("hidden");
  profileEditorBannerColors?.classList.remove("hidden");
  profileEditorAvatarArea?.classList.add("hidden");
  if (profileEditorBannerPreview) {
    profileEditorBannerPreview.style.background = selectedBannerColor || "#000000";
  }
  renderProfileEditorBannerPalette();
}

function closeProfileEditor() {
  if (!profileEditorModal) return;
  profileEditorModal.classList.remove("open");
  const finalizeClose = () => {
    profileEditorModal.classList.add("hidden");
    profileEditorModal.removeEventListener("transitionend", handleTransitionEnd);
  };
  const handleTransitionEnd = (e) => {
    if (e.target !== profileEditorModal) return;
    finalizeClose();
  };
  profileEditorModal.addEventListener("transitionend", handleTransitionEnd);
  setTimeout(finalizeClose, 320);
}

function renderProfileEditorBannerPalette() {
  if (!profileEditorBannerColors) return;
  profileEditorBannerColors.innerHTML = "";

  textColorPalette.forEach(color => {
    if (!color || color === "<br>") return;
    const box = document.createElement("div");
    box.className = "profile-banner-editor-color-box";
    box.style.backgroundColor = color;
    box.dataset.color = color;

    if (color === selectedBannerColor) box.classList.add("selected");

    box.addEventListener("click", () => {
      if (!currentProfileIsOwner) return;
      selectedBannerColor = color;
      if (profileEditorBannerPreview) profileEditorBannerPreview.style.background = color;
      profileEditorBannerColors.querySelectorAll(".profile-banner-editor-color-box").forEach(el => el.classList.remove("selected"));
      box.classList.add("selected");
    });
    profileEditorBannerColors.appendChild(box);
  });
}

function renderProfileBannerPalette() {
  if (!profileBannerColors) return;
  profileBannerColors.innerHTML = "";

  textColorPalette.forEach(color => {
    if (!color || color === "<br>") return;
    const box = document.createElement("div");
    box.className = "profile-banner-color-box";
    box.style.backgroundColor = color;
    box.dataset.color = color;

    if (color === selectedBannerColor) box.classList.add("selected");

    box.addEventListener("click", () => {
      if (!currentProfileIsOwner) return;
      selectedBannerColor = color;
      if (profileCover) profileCover.style.background = color;
      if (profileBannerPreview) profileBannerPreview.style.background = color;
      profileBannerColors.querySelectorAll(".profile-banner-color-box").forEach(el => el.classList.remove("selected"));
      box.classList.add("selected");
    });
    profileBannerColors.appendChild(box);
  });
}

let unsubscribeProfileListener = null;
window.openMainProfilePanel = async (userId) => {
  if (!auth.currentUser) {
    if (typeof showToast === "function") showToast("Faça login para ver o perfil");
    const modal = document.getElementById("loginModal");
    if (modal) modal.classList.remove("hidden");
    return;
  }

  if (!userId) return;

  const loggedUser = auth.currentUser;
  const isOwner = !!loggedUser && loggedUser.uid === userId;
  const isPanelOpen = profilePanel?.classList.contains("open");

  currentViewedProfileId = userId;
  if (window.appState) {
    window.appState.currentViewedProfileId = userId;
  }

  profileRequestToken += 1;
  const requestToken = profileRequestToken;


if (!isPanelOpen) {
    if (typeof fecharPainelVip === "function") {
      fecharPainelVip();
    }
    openProfilePanel();
    document.querySelector('.profile-tab[data-tab="info"]')?.click();
  }

  if (profileAvatar) {
    profileAvatar.src = DEFAULT_PROFILE_AVATAR;
  }

  renderProfileBannerPalette();
  document.body.classList.toggle("viewing-other-profile", !isOwner);
  applyProfileMode(isOwner);


  await new Promise(resolve => requestAnimationFrame(resolve));

  try {
    const refUser = doc(db, "users", userId);
    if (unsubscribeProfileListener) unsubscribeProfileListener();

    unsubscribeProfileListener = onSnapshot(refUser, async (snap) => {
      if (requestToken !== profileRequestToken) return;

      if (!snap.exists()) {
        profileName.textContent = "Usuário";
        profileMood.textContent = "Sem recado no momento.";
        profileCity.textContent = "-";
        profileAvatar.src = "img/avatar.png";
        selectedBannerColor = "#8b898963";

        if (profileCover) profileCover.style.background = selectedBannerColor;
        if (profileEditorBannerPreview) profileEditorBannerPreview.style.background = selectedBannerColor;

        renderProfileBannerPalette();
        renderProfileEditorBannerPalette();
        return;
      }

      let data = snap.data();
      if (isOwner) {
        data = await verificarEExpiraVipUsuario(userId, data);
      }
      listenUserOnlineStatus(userId, (isOnline) => {
        if (profileOnlineDot) profileOnlineDot.classList.toggle("hidden", !isOnline);
      });

      window.__currentProfileData = data;
      profileEditRemainingDays = getRemainingEditDays(data.lastProfileEditAt);
      isProfileEditLocked = isOwner && profileEditRemainingDays > 0;
      applyProfileMode(isOwner);

      const nome = data.nome || "Usuário";
      const foto = data.foto || "img/avatar.png";
      const mood = data.mood || "Sem recado no momento.";
      const cidade = data.cidade || "-";
      const idade = data.idade || "-";
      const genero = data.genero || "-";
      const membroDesde = data.membroDesde || data.createdAt || null;
      const bannerColor = data.bannerColor || "#00000063";
      const instagram = data.instagram || "";

      selectedBannerColor = bannerColor;
      selectedProfileAvatar = foto;

      profileName.textContent = nome;
      if (profileMood) profileMood.textContent = mood;
      profileCity.textContent = cidade;
      profileAvatar.src = foto;

      if (profileAge) profileAge.textContent = idade;
      if (profileGender) profileGender.textContent = genero;
      if (profileMemberSince) {
        profileMemberSince.textContent = formatProfileDate(membroDesde);
      }

      const abaAtiva = document.querySelector('.profile-tab.active')?.dataset.tab || "info";
      const profileCoverEl = document.querySelector(".profile-cover");

      if (abaAtiva === "vip") {
        if (profileCoverEl) {
          if (data.vipBannerUrl) {
            profileCoverEl.style.background = `url("${data.vipBannerUrl}") center/cover no-repeat`;
          } else {
            profileCoverEl.style.backgroundImage = "none";
            profileCoverEl.style.background = selectedBannerColor || "#00000063";
          }
        }
        if (typeof window.atualizarSimulacaoTopoVip === "function") {
          window.atualizarSimulacaoTopoVip();
        }
      } else {
        if (data.isVip === true) {
          aplicarVisualVipCompleto(data);
        } else {
          restaurarVisualPadraoPerfil(selectedBannerColor);
          if (profileCoverEl) {
            profileCoverEl.style.backgroundImage = "none";
            profileCoverEl.style.background = bannerColor;
          }
        }
   // Garante que o botão do lápis só apareça se a aba ativa for "Editar perfil"
        if (isOwner && editProfileCoverBtn) {
          const abaAtivaAtual = document.querySelector('.profile-tab.active')?.dataset.tab || "info";
          editProfileCoverBtn.style.display = (abaAtivaAtual === "edit") ? "grid" : "none";
        }
      }

      if (profileEditorBannerPreview) profileEditorBannerPreview.style.background = bannerColor;
      renderProfileBannerPalette();
      renderProfileEditorBannerPalette();

      const setInputValue = (el, val) => {
        if (el && 'value' in el) el.value = val ?? "";
      };

      setInputValue(editName, nome);
      setInputValue(editCity, data.cidade);
      setInputValue(editAge, data.idade);
      setInputValue(editGender, data.genero);

      const editInstagram = document.getElementById("editInstagram");
      const editTelegram = document.getElementById("editTelegram");
      const profileInstagramText = document.getElementById("profileInstagramText");
      const profileTelegramText = document.getElementById("profileTelegramText");
      const telegram = data.telegram || "";

      let username = instagram ? String(instagram).trim() : "";
      if (username.includes("instagram.com/")) username = username.split("instagram.com/")[1];
      username = username.split("?")[0].split("#")[0].split("/")[0];
      if (username.startsWith("@")) username = username.substring(1);
      username = username.replace(/[^a-zA-Z0-9_.]/g, "").toLowerCase();

      if (editInstagram) editInstagram.value = username ? `@${username}` : "";

      if (profileInstagramText) {
        if (username !== "") {
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          if (isMobile) {
            profileInstagramText.innerHTML = `<a id="instaClickBtn" href="instagram://user?username=${username}" style="color: #000000 !important; font-weight: 600; text-decoration: none;">@${username}</a>`;
            document.getElementById("instaClickBtn")?.addEventListener("click", (e) => {
              e.stopPropagation();
              setTimeout(() => { window.location.href = `https://www.instagram.com/${username}/`; }, 800);
            });
          } else {
            profileInstagramText.innerHTML = `<span id="instaDesktopBtn" style="color: #161616dc; font-weight: 600; cursor: pointer;" title="Acesse pelo celular para abrir o perfil">@${username}</span>`;
            document.getElementById("instaDesktopBtn")?.addEventListener("click", (e) => {
              e.stopPropagation();
              if (typeof showToast === "function") showToast("O link do Instagram está disponível apenas no acesso pelo celular.");
            });
          }
        } else {
          profileInstagramText.textContent = "-";
        }
      }

      let teleUser = telegram ? String(telegram).trim() : "";
      if (teleUser.includes("t.me/")) teleUser = teleUser.split("t.me/")[1];
      if (teleUser.includes("telegram.me/")) teleUser = teleUser.split("telegram.me/")[1];
      teleUser = teleUser.split("?")[0].split("#")[0].split("/")[0];
      if (teleUser.startsWith("@")) teleUser = teleUser.substring(1);
      teleUser = teleUser.replace(/[^a-zA-Z0-9_.]/g, "").toLowerCase();

      if (editTelegram) editTelegram.value = teleUser ? `@${teleUser}` : "";

if (profileTelegramText) {
        if (teleUser !== "") {
          profileTelegramText.innerHTML = `<a href="https://t.me/${teleUser}" target="_blank" rel="noopener noreferrer" style="color: #161616dc; font-weight: 600; text-decoration: none;">@${teleUser}</a>`;
        } else {
          profileTelegramText.textContent = "-";
        }
      }

      // Carrega e renderiza os interesses do usuario (Aba Info e Aba Editar) tag
      const interessesData = Array.isArray(data.interesses) ? data.interesses : [];
      setSelectedInterests(interessesData.map(i => (typeof i === "string" ? i : i.id)));
      renderProfileInterests(interessesData, userId, isOwner);
      renderEditInterestsSelector();

      criarListaCidadesPerfil();
      criarListaGeneroPerfil();
      setTimeout(perfilEstaCompleto, 200);
    });

  } catch (err) {
    if (requestToken !== profileRequestToken) return;
    console.error(err);
    showToast("Erro ao carregar perfil");
  }
};

function applyProfileMode(isOwner) {
  currentProfileIsOwner = isOwner;
  const reportBtn = document.getElementById("reportUserBtn");
  const uploadPhotoBtn = document.getElementById("btnUploadPhoto");
  const vipTabBtn = document.querySelector('.profile-tab[data-tab="vip"]');
  let isLocked = false;

  if (isOwner && auth.currentUser) {
    const profileDoc = window.__currentProfileData || {};
    isLocked = getRemainingEditDays(profileDoc.lastProfileEditAt) > 0;
  }

  if (isOwner) {
    document.body.classList.remove("viewing-other-profile");
    if (reportBtn) reportBtn.style.display = "none";

const abaAtual = document.querySelector('.profile-tab.active')?.dataset.tab || "info";
    const isEditAba = (abaAtual === "edit");
    const isInfoAba = (abaAtual === "info");
    const vipTopBtn = document.getElementById("vipTopHeaderBtn");
    
    // Lápis e Câmera na aba Editar; Botão VIP exibido na aba Info
    if (editProfileCoverBtn) editProfileCoverBtn.style.display = isEditAba ? "grid" : "none";
    if (vipTopBtn) vipTopBtn.style.display = isInfoAba ? "inline-flex" : "none";
    if (uploadPhotoBtn) {
      uploadPhotoBtn.classList.toggle("hidden", !isEditAba);
      uploadPhotoBtn.style.display = isEditAba ? "flex" : "none";
    }



    if (vipTabBtn) {
      vipTabBtn.hidden = false;
      vipTabBtn.style.setProperty("display", "inline-block", "important");
      vipTabBtn.classList.remove("hidden");
    }

    if (profileEditTab) {
      profileEditTab.hidden = false;
      profileEditTab.style.setProperty("display", "inline-block", "important");
      profileEditTab.classList.remove("hidden");
      profileEditTab.style.opacity = isLocked ? "0.45" : "1";
    }

    if (!isLocked) {
      if (uploadPhotoBtn) {
        uploadPhotoBtn.style.opacity = "1";
        uploadPhotoBtn.style.cursor = "pointer";
      }
      if (editProfileCoverBtn) {
        editProfileCoverBtn.style.opacity = "1";
        editProfileCoverBtn.style.cursor = "pointer";
      }
      editName?.removeAttribute("disabled");
      editCity?.removeAttribute("disabled");
    } else {
      if (uploadPhotoBtn) {
        uploadPhotoBtn.style.opacity = "0.45";
        uploadPhotoBtn.style.cursor = "not-allowed";
      }
      if (editProfileCoverBtn) {
        editProfileCoverBtn.style.opacity = "0.45";
        editProfileCoverBtn.style.cursor = "not-allowed";
      }
    }
  } else {
    document.body.classList.add("viewing-other-profile");
    if (reportBtn) reportBtn.style.display = "flex";
    if (uploadPhotoBtn) uploadPhotoBtn.classList.add("hidden");
    if (editProfileCoverBtn) editProfileCoverBtn.style.display = "none";

    const vipHeaderBtn = document.getElementById("vipHeaderActionBtn");
    if (vipHeaderBtn) vipHeaderBtn.style.display = "none";

    if (vipTabBtn) vipTabBtn.style.setProperty("display", "none", "important");
    if (profileEditTab) profileEditTab.style.setProperty("display", "none", "important");

    document.querySelector('.profile-tab[data-tab="info"]')?.click();
  }
}

// Abas de Perfil
const tabs = document.querySelectorAll(".profile-tab");
const sections = document.querySelectorAll(".profile-section");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.tab;

    if (target === "edit" && isProfileEditLocked) {
      showToast(`Você poderá editar novamente em ${profileEditRemainingDays} dia(s).`);
      return;
    }

    tabs.forEach(t => {
      t.classList.remove("active");
      if (t.dataset.tab === "edit" || t.dataset.tab === "vip") {
        t.style.background = "";
        t.style.color = "";
      }
    });

    sections.forEach(s => {
      s.classList.remove("active");
      s.classList.add("hidden");
      s.style.setProperty("display", "none", "important");
    });

    tab.classList.add("active");

    let sectionId = "profileInfo";
    if (target === "edit") sectionId = "profileEdit";
    if (target === "vip") sectionId = "profileVip";

    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
      targetSection.classList.remove("hidden");
      targetSection.classList.add("active");
      targetSection.style.setProperty("display", "block", "important");
    }

    const isVip = target === "vip";
    if (profilePanel) {
      profilePanel.classList.toggle("vip-mode-active", isVip);
    }

    const topMood = document.getElementById("profileMood");
    if (topMood) {
      topMood.style.display = isVip ? "none" : "block";
    }

      const editBtn = document.getElementById("editProfileCoverBtn");
    const vipBtn = document.getElementById("vipHeaderActionBtn");
    const vipTopBtn = document.getElementById("vipTopHeaderBtn");
    const uploadPhotoBtn = document.getElementById("btnUploadPhoto");

if (currentProfileIsOwner) {
      const isEdit = (target === "edit");
      const isInfo = (target === "info");

      // Lápis e Câmera na aba Editar perfil; Botão VIP na aba Info
      if (editBtn) editBtn.style.display = isEdit ? "grid" : "none";
      if (vipTopBtn) vipTopBtn.style.display = isInfo ? "inline-flex" : "none";
      if (uploadPhotoBtn) {
        uploadPhotoBtn.classList.toggle("hidden", !isEdit);
        uploadPhotoBtn.style.display = isEdit ? "flex" : "none";
      }

      if (vipBtn) {
        vipBtn.style.display = isVip ? "grid" : "none";
        vipBtn.classList.toggle("d-none", !isVip);
      }
    }



    const topExpiry = document.getElementById("vipTopExpiryRow");
    if (topExpiry) {
      topExpiry.classList.toggle("d-flex", isVip);
      topExpiry.classList.toggle("d-none", !isVip);
    }

    const topTag = document.getElementById("vipTopPreviewTag");
    if (topTag) {
      topTag.classList.toggle("d-inline-block", isVip);
      topTag.classList.toggle("d-none", !isVip);
    }

    const topMsgBox = document.getElementById("vipTopMsgPreviewBox");
    if (topMsgBox) {
      topMsgBox.classList.toggle("d-block", isVip);
      topMsgBox.classList.toggle("d-none", !isVip);
    }

    const data = window.__currentProfileData || {};

    if (!isVip) {
      if (data.isVip === true) {
        aplicarVisualVipCompleto(data);
      } else {
        restaurarVisualPadraoPerfil(selectedBannerColor);
      }
    } else {
      const profileCoverEl = document.querySelector(".profile-cover");
      if (profileCoverEl) {
        if (data.vipBannerUrl) {
          profileCoverEl.style.background = `url("${data.vipBannerUrl}") center/cover no-repeat`;
        } else {
          profileCoverEl.style.background = selectedBannerColor || "#00000063";
        }
      }
      inicializarPainelVipDinamico(editName?.value, selectedProfileAvatar);
    }
  });
});

function openProfilePanel() {
  if (!profilePanel) return;
  restaurarVisualPadraoPerfil(selectedBannerColor);
  window.__profileScrollY = window.scrollY || 0;
  profilePanel.classList.remove("hidden");
  profileOverlay?.classList.remove("hidden");
  document.body.classList.add("profile-open");
  document.body.style.top = `-${window.__profileScrollY}px`;
  requestAnimationFrame(() => {
    profilePanel.classList.add("open");
    profileOverlay?.classList.add("show");
  });
}

function closeProfilePanel(force = false) {
  if (!profilePanel) return;

  // Garante que o painel VIP seja completamente resetado ao fechar o modal
  if (typeof fecharPainelVip === "function") {
    fecharPainelVip();
  }

  profilePanel.classList.remove("open");
  profilePanel.classList.remove("dragging");
  profilePanel.style.transform = "";
  profileOverlay?.classList.remove("show");
  if (force) {
    profilePanel.classList.add("hidden");
    profileOverlay?.classList.add("hidden");
    document.body.classList.remove("profile-open");
    document.body.style.top = "";
    document.body.style.position = "";
    document.body.style.overflow = "";
    document.body.style.height = "";
    document.body.style.width = "";
    window.scrollTo(0, window.__profileScrollY || 0);

    if (typeof unlockProfileBackground === "function") {
      unlockProfileBackground();
    }
    document.body.classList.remove("viewing-other-profile");
    currentViewedProfileId = null;
    currentProfileIsOwner = false;

    if (profileEditTab) profileEditTab.style.removeProperty("display");
    const vipTabBtnReset = document.querySelector('.profile-tab[data-tab="vip"]');
    if (vipTabBtnReset) vipTabBtnReset.style.removeProperty("display");
    return;
  }

  let closed = false;
  const finalizeClose = () => {
    if (closed) return;
    closed = true;
    profilePanel.removeEventListener("transitionend", handleTransitionEnd);
    if (!profilePanel.classList.contains("open")) {
      profilePanel.classList.add("hidden");
      profileOverlay?.classList.add("hidden");
      document.body.classList.remove("profile-open");
      document.body.style.top = "";
      document.body.style.position = "";
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.body.style.width = "";

      window.scrollTo(0, window.__profileScrollY || 0);
      if (typeof unlockProfileBackground === "function") {
        unlockProfileBackground();
      }

      document.body.classList.remove("viewing-other-profile");
      currentViewedProfileId = null;
      currentProfileIsOwner = false;

      if (profileEditTab) profileEditTab.style.removeProperty("display");
      const vipTabBtnReset2 = document.querySelector('.profile-tab[data-tab="vip"]');
      if (vipTabBtnReset2) vipTabBtnReset2.style.removeProperty("display");
    }
  };

  const handleTransitionEnd = (e) => {
    if (e.target !== profilePanel) return;
    if (e.propertyName !== "transform") return;
    finalizeClose();
  };

  profilePanel.addEventListener("transitionend", handleTransitionEnd);
  requestAnimationFrame(() => {
    const duration = getComputedStyle(profilePanel).transitionDuration || "0s";
    const first = duration.split(",")[0].trim();
    const time = first.endsWith("ms") ? parseFloat(first) : parseFloat(first) * 1000;
    setTimeout(finalizeClose, isNaN(time) ? 300 : time + 40);
  });
}

closeProfileBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  closeProfilePanel(true);
});

editProfileCoverBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (!currentProfileIsOwner) return;
  if (isProfileEditLocked) {
    showToast(`Você poderá editar novamente em ${profileEditRemainingDays} dia(s).`);
    return;
  }
  openProfileEditor();
});

closeProfileEditorBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  closeProfileEditor();
});

profileEditorModal?.addEventListener("click", (e) => {
  if (e.target === profileEditorModal) closeProfileEditor();
});

let paletteRendered = false;
let avatarGridRendered = false;

showBannerEditorBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (showBannerEditorBtn.classList.contains("active")) return;

  showBannerEditorBtn.classList.add("active");
  openAvatarPickerBtn?.classList.remove("active");
  profileEditorBannerPreview?.classList.remove("hidden");
  profileEditorBannerColors?.classList.remove("hidden");
  profileEditorAvatarArea?.classList.add("hidden");

  if (!paletteRendered) {
    renderProfileEditorBannerPalette();
    paletteRendered = true;
  }
});

openAvatarPickerBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (openAvatarPickerBtn.classList.contains("active")) return;

  openAvatarPickerBtn.classList.add("active");
  showBannerEditorBtn?.classList.remove("active");
  profileEditorBannerPreview?.classList.add("hidden");
  profileEditorBannerColors?.classList.add("hidden");
  profileEditorAvatarArea?.classList.remove("hidden");

  if (!avatarGridRendered) {
    carregarCategoria("aleatorios");
    avatarGridRendered = true;
  }
});



// Motor Multiavatar
let listaAtual = [];
let avataresRenderizados = 0;
const LOTE_TAMANHO = 60; // Carrega 60 avatares de imediato para liberar a barra vertical completa
let categoriaAtual = "aleatorios";
let partesDna = { ambiente: 0, roupas: 0, cabeca: 0, boca: 0, olhos: 0, cabelo: 0 };

function gerarAvatarDnaUri(dna12Digitos) {
  const svgCode = multiavatar(dna12Digitos, true);
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgCode)));
}

function gerarAvatarUri(texto) {
  const svgCode = multiavatar(texto);
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgCode)));
}

function renderizarLote() {
  if (!profileEditorAvatarGrid) return;
  let html = "";
  let limite = avataresRenderizados + LOTE_TAMANHO;

  for (let i = avataresRenderizados; i < limite; i++) {
    let codigo;
    if (categoriaAtual === "aleatorios") {
      codigo = Math.random().toString(36).substring(7) + "_" + i;
    } else {
      if (i >= listaAtual.length) break;
      codigo = listaAtual[i];
    }
    let imagemUri = gerarAvatarUri(codigo);
    html += `<img src="${imagemUri}" class="avatar-option" data-uri="${imagemUri}" style="width: 58px; height: 58px; cursor: pointer; border-radius: 50%; border: 3px solid transparent;" />`;
  }

  profileEditorAvatarGrid.insertAdjacentHTML("beforeend", html);
  avataresRenderizados += LOTE_TAMANHO;
}

function carregarCategoria(categoria) {
  categoriaAtual = categoria;
  avataresRenderizados = 0;

  const construtorContainer = document.getElementById("avatarConstructorContainer");
  if (profileEditorAvatarGrid) profileEditorAvatarGrid.innerHTML = "";

  if (categoria === "criar") {
    profileEditorAvatarGrid?.classList.add("hidden");
    construtorContainer?.classList.remove("hidden");
    atualizarPreviewConstrutor();
    return;
  }

  construtorContainer?.classList.add("hidden");
  profileEditorAvatarGrid?.classList.remove("hidden");

  if (categoria === "eles") listaAtual = avataresEles;
  else if (categoria === "elas") listaAtual = avataresElas;
  else if (categoria === "unissex") listaAtual = avataresUnissex;
  else if (categoria === "aleatorios") listaAtual = [];

  renderizarLote();
}

// Escuta a rolagem e carrega mais avatares automaticamente sem travar
profileEditorAvatarGrid?.addEventListener("scroll", function () {
  if (categoriaAtual !== "criar" && this.scrollTop + this.clientHeight >= this.scrollHeight - 80) {
    renderizarLote();
  }
});
function padDoisDigitos(val) {
  return String(val).padStart(2, "0");
}

function atualizarPreviewConstrutor() {
  if (document.getElementById("valAmbiente")) document.getElementById("valAmbiente").textContent = padDoisDigitos(partesDna.ambiente);
  if (document.getElementById("valRoupas")) document.getElementById("valRoupas").textContent = padDoisDigitos(partesDna.roupas);
  if (document.getElementById("valCabeca")) document.getElementById("valCabeca").textContent = padDoisDigitos(partesDna.cabeca);
  if (document.getElementById("valBoca")) document.getElementById("valBoca").textContent = padDoisDigitos(partesDna.boca);
  if (document.getElementById("valOlhos")) document.getElementById("valOlhos").textContent = padDoisDigitos(partesDna.olhos);
  if (document.getElementById("valCabelo")) document.getElementById("valCabelo").textContent = padDoisDigitos(partesDna.cabelo);

  const dnaFinal = padDoisDigitos(partesDna.ambiente) +
    padDoisDigitos(partesDna.roupas) +
    padDoisDigitos(partesDna.cabeca) +
    padDoisDigitos(partesDna.boca) +
    padDoisDigitos(partesDna.olhos) +
    padDoisDigitos(partesDna.cabelo);

  const novaUri = gerarAvatarDnaUri(dnaFinal);
  const previewImg = document.getElementById("constructorPreview");
  if (previewImg) previewImg.src = novaUri;

  selectedProfileAvatar = novaUri;
}

function VincularAcaoParte(idPrev, idNext, chaveParte) {
  document.getElementById(idPrev)?.addEventListener("click", (e) => {
    e.preventDefault();
    partesDna[chaveParte] = partesDna[chaveParte] <= 0 ? 47 : partesDna[chaveParte] - 1;
    atualizarPreviewConstrutor();
  });
  document.getElementById(idNext)?.addEventListener("click", (e) => {
    e.preventDefault();
    partesDna[chaveParte] = partesDna[chaveParte] >= 47 ? 0 : partesDna[chaveParte] + 1;
    atualizarPreviewConstrutor();
  });
}

VincularAcaoParte("prevAmbiente", "nextAmbiente", "ambiente");
VincularAcaoParte("prevRoupas", "nextRoupas", "roupas");
VincularAcaoParte("prevCabeca", "nextCabeca", "cabeca");
VincularAcaoParte("prevBoca", "nextBoca", "boca");
VincularAcaoParte("prevOlhos", "nextOlhos", "olhos");
VincularAcaoParte("prevCabelo", "nextCabelo", "cabelo");



profileEditorAvatarGrid?.addEventListener("click", (e) => {
  if (e.target.tagName === "IMG" && e.target.classList.contains("avatar-option")) {
    profileEditorAvatarGrid.querySelectorAll("img").forEach(img => {
      img.style.border = "3px solid transparent";
      img.classList.remove("selected");
    });
    e.target.style.border = "3px solid #ff6b6b";
    e.target.classList.add("selected");
    selectedProfileAvatar = e.target.getAttribute("data-uri");
  }
});

document.querySelectorAll(".profile-avatar-cat").forEach(botao => {
  botao.addEventListener("click", (e) => {
    e.preventDefault();
    document.querySelectorAll(".profile-avatar-cat").forEach(b => b.classList.remove("active"));
    botao.classList.add("active");
    carregarCategoria(botao.getAttribute("data-cat"));
  });
});

window.renderProfileAvatarGrid = function () {
  carregarCategoria("aleatorios");
};

function perfilEstaCompleto() {
  const nome = editName?.value.trim();
  const cidade = editCity?.value.trim();
  const idade = editAge?.value.trim();
  const genero = editGender?.value.trim();

  const avatarValido =
    selectedProfileAvatar &&
    selectedProfileAvatar !== DEFAULT_PROFILE_AVATAR &&
    selectedProfileAvatar !== "./img/avatar.png" &&
    selectedProfileAvatar !== "img/avatar.png";

  const bannerValido =
    selectedBannerColor &&
    selectedBannerColor !== "#00000063" &&
    selectedBannerColor !== "#8b898963" &&
    selectedBannerColor !== "#000000";

  const completo = !!(nome && cidade && idade && genero && avatarValido && bannerValido);

  if (saveProfileBtn) {
    if (currentProfileIsOwner && !isProfileEditLocked) {
      saveProfileBtn.removeAttribute("disabled");
      saveProfileBtn.style.opacity = "1";
      saveProfileBtn.style.cursor = "pointer";
    } else {
      saveProfileBtn.setAttribute("disabled", "disabled");
      saveProfileBtn.style.opacity = "0.5";
      saveProfileBtn.style.cursor = "not-allowed";
    }
  }

  return completo;
}

setTimeout(() => {
  [editName, editAge].forEach(input => {
    input?.addEventListener("input", perfilEstaCompleto);
  });

  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("city-dropdown-item") || e.target.classList.contains("gender-dropdown-item")) {
      setTimeout(perfilEstaCompleto, 50);
    }
  });

  saveProfileEditorBtn?.addEventListener("click", () => {
    setTimeout(perfilEstaCompleto, 100);
  });
}, 1000);

saveProfileEditorBtn?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;
  if (!currentProfileIsOwner || currentViewedProfileId !== user.uid) return;

  if (profileCover) profileCover.style.background = selectedBannerColor;
  if (profileAvatar) profileAvatar.src = selectedProfileAvatar;

  showToast("Alteração aplicada! Lembre-se de clicar em Salvar para gravar o perfil.");
});

saveProfileBtn?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;
  if (!currentProfileIsOwner || currentViewedProfileId !== user.uid) {
    showToast("Você só pode editar o seu próprio perfil.");
    return;
  }

  const refUser = doc(db, "users", user.uid);
  const snap = await getDoc(refUser);
  const data = snap.data() || {};
  const remainingDays = getRemainingEditDays(data.lastProfileEditAt);

  if (remainingDays > 0) {
    showToast(`Você poderá editar novamente em ${remainingDays} dia(s).`);
    return;
  }

  const bannerValido = selectedBannerColor && selectedBannerColor !== "#00000063" && selectedBannerColor !== "#8b898963" && selectedBannerColor !== "#000000";
  if (!bannerValido) {
    showToast("Editar capa e selecione uma cor de fundo.");
    return;
  }

  const avatarValido = selectedProfileAvatar && selectedProfileAvatar !== DEFAULT_PROFILE_AVATAR && selectedProfileAvatar !== "./img/avatar.png" && selectedProfileAvatar !== "img/avatar.png";
  if (!avatarValido) {
    showToast("Selecione um avatar.");
    return;
  }

  if (!editName.value.trim()) {
    showToast("Por favor, preencha o campo: Nome.");
    return;
  }

  if (!editAge || !editAge.value.trim()) {
    showToast("Por favor, preencha o campo: Idade.");
    return;
  }

  const generoSelecionado = editGender ? editGender.value.trim() : "";
  if (!generoSelecionado || !GENEROS_PADRAO.includes(generoSelecionado)) {
    showToast("Por favor, selecione um Gênero válido da lista.");
    return;
  }

  const cidadeSelecionada = editCity.value.trim();
  if (!cidadeSelecionada || !CIDADES_DF.includes(cidadeSelecionada)) {
    showToast("Por favor, selecione uma Cidade válida da lista.");
    return;
  }

  try {
    showToast("Salvando alterações...");
    let linkFotoFinal = selectedProfileAvatar;

    if (window.blobFotoTemporaria) {
      showToast("Enviando foto ao servidor...");
      const storage = getStorage();
      const fotoRef = sRef(storage, `profile_foto/${user.uid}.jpg`);
      await uploadBytes(fotoRef, window.blobFotoTemporaria);
      linkFotoFinal = await getDownloadURL(fotoRef);
      window.blobFotoTemporaria = null;
    }

    let rawInsta = document.getElementById("editInstagram")?.value.trim() || "";
    if (rawInsta.includes("instagram.com/")) rawInsta = rawInsta.split("instagram.com/")[1];
    rawInsta = rawInsta.split("?")[0].split("#")[0].split("/")[0];
    if (rawInsta.startsWith("@")) rawInsta = rawInsta.substring(1);
    const instaUser = rawInsta.replace(/[^a-zA-Z0-9_.]/g, "").toLowerCase();

    let rawTele = document.getElementById("editTelegram")?.value.trim() || "";
    if (rawTele.includes("t.me/")) rawTele = rawTele.split("t.me/")[1];
    if (rawTele.includes("telegram.me/")) rawTele = rawTele.split("telegram.me/")[1];
    rawTele = rawTele.split("?")[0].split("#")[0].split("/")[0];
    if (rawTele.startsWith("@")) rawTele = rawTele.substring(1);
    const teleUser = rawTele.replace(/[^a-zA-Z0-9_.]/g, "").toLowerCase();
await updateDoc(refUser, {
      nome: editName.value.trim(),
      cidade: cidadeSelecionada,
      idade: editAge.value.trim(),
      genero: generoSelecionado,
      instagram: instaUser,
      telegram: teleUser,
      foto: linkFotoFinal,
      bannerColor: selectedBannerColor,
      interesses: selectedInterests,//curtidas tags 30-08-26
      perfilCompleto: true,
      lastProfileEditAt: Date.now()
    });

    if (!linkFotoFinal.startsWith("data:image")) {
      await updateProfile(user, { photoURL: linkFotoFinal });
    }

await setUserStatus(user.uid, {
      name: editName.value.trim() || "Usuário",
      avatar: linkFotoFinal || "./img/avatar.png",
      online: true,
      sala: appState.currentRoom || sala,
      isVip: data.isVip || false,
      vipNameColorType: data.vipNameColorType || "solid",
      vipNameColorSolid: data.vipNameColorSolid || "#1E293B",
      vipNameFont: data.vipNameFont || "default",
      vipAvatarFrame: data.vipAvatarFrame || "none"
    });
  
    document.getElementById("profileEditTooltip")?.classList.remove("show");
    window.attachmentActions.profile();
  } catch (err) {
    console.error(err);
    showToast("Erro ao salvar perfil");
  }
});

// Drag Mobile/Desktop Perfil
let startY = 0;
let currentY = 0;
let isDraggingProfile = false;
let profileStartTranslate = 0;

function getTranslateY(element) {
  const style = window.getComputedStyle(element);
  const transform = style.transform || style.webkitTransform;
  if (!transform || transform === "none") return 0;
  const matrix = new DOMMatrix(transform);
  return matrix.m42;
}


// Trava de segurança: impede arrastar/fechar o modal ao tocar em qualquer campo, botão ou lista interna
function onProfileDragStart(e) {
  if (document.body.classList.contains("index-page")) return;
  if (
    e.target.closest(".profile-content") ||
    e.target.closest("#profileEdit") ||
    e.target.closest("#profileInfo") ||
    e.target.closest(".profile-field") ||
    e.target.closest("input") ||
    e.target.closest("button") ||
    e.target.closest(".city-dropdown-profile") ||
    e.target.closest(".gender-dropdown-profile") ||
    e.target.closest("#profileVip") ||
    e.target.closest(".vip-custom-dropdown") ||
    e.target.closest(".vip-dropdown-option") ||
    e.target.closest(".vip-drawer-content") ||
    e.target.closest(".vip-carousel-wrapper")
  ) {
    return;
  }

  if (window.innerWidth > 768) return;
  if (!profilePanel || !profilePanel.classList.contains("open")) return;

  isDraggingProfile = true;
  profilePanel.classList.add("dragging");

  startY = e.touches ? e.touches[0].clientY : e.clientY;
  profileStartTranslate = getTranslateY(profilePanel);
}

function onProfileDragMove(e) {
  if (!isDraggingProfile || !profilePanel) return;
  currentY = e.touches ? e.touches[0].clientY : e.clientY;
  const diff = currentY - startY;
  let nextTranslate = profileStartTranslate + diff;
  if (nextTranslate < 0) nextTranslate = 0;
  profilePanel.style.transform = `translateY(${nextTranslate}px)`;
}

function onProfileDragEnd() {
  if (!isDraggingProfile || !profilePanel) return;
  isDraggingProfile = false;
  profilePanel.classList.remove("dragging");

  const currentTranslate = getTranslateY(profilePanel);
  const panelHeight = profilePanel.offsetHeight;

  if (currentTranslate > panelHeight * 0.22) {
    closeProfilePanel();
  } else {
    profilePanel.classList.add("open");
    profilePanel.style.transform = "";
  }
}

if (profilePanel) {
  profilePanel.addEventListener("touchstart", onProfileDragStart, { passive: true });
  profilePanel.addEventListener("touchmove", onProfileDragMove, { passive: true });
  profilePanel.addEventListener("touchend", onProfileDragEnd);

  profilePanel.addEventListener("mousedown", onProfileDragStart);
  window.addEventListener("mousemove", onProfileDragMove);
  window.addEventListener("mouseup", onProfileDragEnd);
}

profileOverlay?.addEventListener("click", () => {
  closeProfilePanel();
});

// Animações Hero & Lottie
const heroAnimation = document.getElementById("heroAnimation");
const images = [
  "img/1.png", "img/2.png", "img/3.png", "img/4.png", "img/5.png", "img/6.png",
  "img/7.png", "img/8.png", "img/9.png", "img/10.png", "img/11.png", "img/12.png"
];
let imageIndex = 0;

function createImg() {
  const img = document.createElement("img");
  img.src = images[imageIndex];
  imageIndex = (imageIndex + 1) % images.length;
  img.alt = "";
  img.loading = "eager";
  img.decoding = "async";
  return img;
}

function createPhotoGrid() {
  const wall = document.createElement("div");
  wall.classList.add("photo-wall");
  const gridOne = document.createElement("div");
  const gridTwo = document.createElement("div");

  gridOne.classList.add("photo-grid");
  gridTwo.classList.add("photo-grid");

  for (let i = 0; i < 70; i++) {
    const img1 = createImg();
    const img2 = img1.cloneNode(true);
    gridOne.appendChild(img1);
    gridTwo.appendChild(img2);
  }

  wall.appendChild(gridOne);
  wall.appendChild(gridTwo);
  heroAnimation.appendChild(wall);

  setTimeout(() => {
    wall.classList.add("ready");
  }, 100);
}

window.addEventListener("load", () => {
  if (heroAnimation) createPhotoGrid();
});



// ========================== CROP & ZOOM FOTO DE PERFIL ==========================
window.blobFotoTemporaria = null;

document.addEventListener("DOMContentLoaded", () => {
  const cameraBtnLabel = document.getElementById("btnUploadPhoto");
  const cropModal = document.getElementById("cropModal");
  const closeCropModal = document.getElementById("closeCropModal");
  const btnSelectCropFile = document.getElementById("btnSelectCropFile");
  const btnSaveCropPhoto = document.getElementById("btnSaveCropPhoto");
  const cropInputFile = document.getElementById("cropInputFile");
  const cropPreviewImg = document.getElementById("cropPreviewImg");
  const cropZoomSlider = document.getElementById("cropZoomSlider");
  const btnZoomOut = document.getElementById("btnZoomOut");
  const btnZoomIn = document.getElementById("btnZoomIn");

  let zoomAtual = 0.5;
  let imgX = 0;
  let imgY = 0;
  let estaArrastando = false;
  let startX, startY;
  let imgLarguraOriginal = 0;
  let imgAlturaOriginal = 0;

  cameraBtnLabel?.addEventListener("click", (e) => {
    e.preventDefault();
    if (isProfileEditLocked) {
      showToast(`Você poderá editar novamente em ${profileEditRemainingDays} dia(s).`);
      return;
    }
    cropModal?.classList.remove("hidden");
  });

  const resetarVisorVisual = () => {
    if (cropPreviewImg) {
      cropPreviewImg.src = "";
      cropPreviewImg.style.display = "none";
    }
    if (cropInputFile) cropInputFile.value = "";
    imgX = 0;
    imgY = 0;
    zoomAtual = 0.5;
    if (cropZoomSlider) {
      cropZoomSlider.min = "0.2";
      cropZoomSlider.value = "0.5";
    }
  };

  closeCropModal?.addEventListener("click", () => {
    resetarVisorVisual();
    cropModal?.classList.add("hidden");
  });

  btnSelectCropFile?.addEventListener("click", () => {
    cropInputFile?.click();
  });

  cropInputFile?.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Por favor, selecione uma imagem válida.");
      return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
      if (cropPreviewImg) {
        cropPreviewImg.src = event.target.result;
        cropPreviewImg.style.display = "block";
        zoomAtual = 0.5;
        imgX = 0;
        imgY = 0;
        if (cropZoomSlider) {
          cropZoomSlider.min = "0.2";
          cropZoomSlider.value = "0.5";
        }

        cropPreviewImg.onload = function () {
          const proporcao = cropPreviewImg.naturalWidth / cropPreviewImg.naturalHeight;
          if (proporcao > 1) {
            cropPreviewImg.style.height = "280px";
            cropPreviewImg.style.width = (280 * proporcao) + "px";
          } else {
            cropPreviewImg.style.width = "280px";
            cropPreviewImg.style.height = (280 / proporcao) + "px";
          }
          imgLarguraOriginal = parseFloat(cropPreviewImg.style.width);
          imgAlturaOriginal = parseFloat(cropPreviewImg.style.height);
          atualizarTransformacaoImagem();
        };
      }
    };
    reader.readAsDataURL(file);
  });

  function atualizarTransformacaoImagem() {
    if (!cropPreviewImg) return;
    cropPreviewImg.style.transform = `translate(${imgX}px, ${imgY}px) scale(${zoomAtual})`;
  }

  let distanciaPinchInicial = 0;
  let zoomPinchInicial = 1;

  const iniciarArrasto = (e) => {
    estaArrastando = true;
    if (e.touches && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      distanciaPinchInicial = Math.sqrt(dx * dx + dy * dy);
      zoomPinchInicial = zoomAtual;
      return;
    }
    const clienteX = e.touches ? e.touches[0].clientX : e.clientX;
    const clienteY = e.touches ? e.touches[0].clientY : e.clientY;
    startX = clienteX - imgX;
    startY = clienteY - imgY;
  };

  const moverArrasto = (e) => {
    if (!estaArrastando) return;
    if (e.touches) {
      e.preventDefault();
      if (e.touches.length === 2 && distanciaPinchInicial > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distanciaAtual = Math.sqrt(dx * dx + dy * dy);
        const proporcaoMapeamento = distanciaAtual / distanciaPinchInicial;
        let novoZoom = zoomPinchInicial * proporcaoMapeamento;
        zoomAtual = Math.max(0.2, Math.min(3, novoZoom));
        if (cropZoomSlider) cropZoomSlider.value = zoomAtual;
        atualizarTransformacaoImagem();
        return;
      }
    }
    if (e.touches && e.touches.length > 1) return;
    const clienteX = e.touches ? e.touches[0].clientX : e.clientX;
    const clienteY = e.touches ? e.touches[0].clientY : e.clientY;
    imgX = clienteX - startX;
    imgY = clienteY - startY;
    atualizarTransformacaoImagem();
  };

  const finalizarArrasto = () => {
    estaArrastando = false;
    distanciaPinchInicial = 0;
  };

  cropPreviewImg?.addEventListener("mousedown", iniciarArrasto);
  window.addEventListener("mousemove", moverArrasto);
  window.addEventListener("mouseup", finalizarArrasto);

  cropPreviewImg?.addEventListener("touchstart", iniciarArrasto);
  window.addEventListener("touchmove", moverArrasto, { passive: false });
  window.addEventListener("touchend", finalizarArrasto);

  cropZoomSlider?.addEventListener("input", (e) => {
    zoomAtual = parseFloat(e.target.value);
    atualizarTransformacaoImagem();
  });

  btnZoomOut?.addEventListener("click", () => {
    zoomAtual = Math.max(0.2, zoomAtual - 0.1);
    if (cropZoomSlider) cropZoomSlider.value = zoomAtual;
    atualizarTransformacaoImagem();
  });

  btnZoomIn?.addEventListener("click", () => {
    zoomAtual = Math.min(3, zoomAtual + 0.1);
    if (cropZoomSlider) cropZoomSlider.value = zoomAtual;
    atualizarTransformacaoImagem();
  });

  btnSaveCropPhoto?.addEventListener("click", () => {
    if (!cropPreviewImg || !cropPreviewImg.src) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 150;
    canvas.height = 150;

    const escalaExibicao = imgLarguraOriginal / cropPreviewImg.naturalWidth;
    const fatorZoomReal = zoomAtual * escalaExibicao;
    const margemCorteVisor = 40;

    const renderX = (280 - imgLarguraOriginal * zoomAtual) / 2 + imgX;
    const renderY = (280 - imgAlturaOriginal * zoomAtual) / 2 + imgY;

    const corteRealX = (margemCorteVisor - renderX) / fatorZoomReal;
    const corteRealY = (margemCorteVisor - renderY) / fatorZoomReal;
    const tamanhoRealCorte = 200 / fatorZoomReal;

    ctx.drawImage(
      cropPreviewImg,
      corteRealX, corteRealY, tamanhoRealCorte, tamanhoRealCorte,
      0, 0, 150, 150
    );

    canvas.toBlob((blob) => {
      if (!blob) return;
      window.blobFotoTemporaria = blob;
      const urlPreview = URL.createObjectURL(blob);
      selectedProfileAvatar = urlPreview;

      const profileAvatarEl = document.getElementById("profileAvatar");
      if (profileAvatarEl) profileAvatarEl.src = urlPreview;

      if (typeof perfilEstaCompleto === "function") perfilEstaCompleto();

      resetarVisorVisual();
      cropModal?.classList.add("hidden");
      showToast("Foto recortada! Clique em Salvar abaixo para concluir.");
    }, "image/jpeg", 0.85);
  });
});