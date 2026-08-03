// ============================== IMPORTS ======================================================
import { avataresEles, avataresElas, avataresUnissex } from "./avatar.js"; // 03-06-26 não apagar, é a lista de avatares para o perfil
import { initAuth } from "./auth.js";
import { initMessages, sendMessage } from './messages.js?v=2';
import { showToast, openAttachmentSheet, openUIPanel, textColorPalette } from "./ui.js";
import { initStickerPanel } from "./stickers-panel.js"; // esse codigo e dos sticker 17-02-26
import { auth, db, rtdb } from "./firebase-config.js";
import { initUsersPanel } from "./users-panel.js"; // USER-PANEL
import { updateProfile } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { animations } from "./animations.js"; // Importa a lista de animações em JSON
import { ref, set, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js"; // 13-07-2026 ADICIONADO: Importações do RTDB para presença da sala


import {
  addDoc,
  collection,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
// ESSE CODIGO E DO PAINEL SOMBRA DO PAINEL   let overlay;    NAO APAGAR  17-03-26 
let overlay;
document.body.classList.add("chat-loading");

// ================= GERENCIADOR DE PAINÉIS padronizando mobile e desktop ================= 17-03-26
let currentPanel = null;
function openPanel(panelName) {
  // fecha tudo antes
  closeAllPanels();
  currentPanel = panelName;
  if (panelName === "users") {
    document.getElementById("onlineUsersPanel")?.classList.add("open");
    overlay?.classList.add("open");
  }
  if (panelName === "attachments") {
    attachmentPanel?.classList.add("show");
  }
}

// padronizando 17-03 
function closeAllPanels() {

  currentPanel = null;

  // USERS
  document.getElementById("onlineUsersPanel")?.classList.remove("open");

  // ATTACHMENTS
  attachmentPanel?.classList.remove("show");

  // STICKERS
  document.getElementById("stickerPanel")?.classList.remove("show");

  // COLOR (UI.JS)
  if (window.closeColorPanel) {
    window.closeColorPanel();
  }

  // OVERLAY
  overlay?.classList.remove("open");

}


//--------- edita o novo campo de usuario mostra so o perfil de outros usuario 12-04 -------------------
const attachmentActions = {
  users: () => {
    openPanel("users");
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
//  EXPÕE AÇÕES PARA O UI (MOBILE) PAINEL IGUAL DO WATSAP
window.attachmentActions = attachmentActions;

//  DOM ELEMENTS 
const isChatRoute = window.location.pathname.includes("chat.html");
const attachBtn = document.getElementById("attachBtn");
const attachmentPanel = document.getElementById("attachmentPanel");
let messageInput;
let chatInitialized = false;




//  INPUT DE ENVIAR MENSAGEM 
function autoResize() {
  if (!messageInput) return;
  const scrollHeight = messageInput.scrollHeight;
  const currentHeight = messageInput.offsetHeight;
  if (scrollHeight !== currentHeight) {
    messageInput.style.height = scrollHeight + "px";
  }
}



//  SALA DA URL 
const urlParams = new URLSearchParams(window.location.search);
const sala = urlParams.get("sala") || "geral";

const appState = {
  userReady: false,
  currentUser: null,
  currentRoom: sala,
  chatMounted: false,
  unsubscribeMessages: null,
  unsubscribeProfileLock: null,
  reportCount: 0 // 07-07-26 ADICIONADO: Contador global de denúncias por sessão/login
};
// 01-05-26
window.appState = appState;
// ================= PRESENÇA DA SALA RTDB realtime================= 18-05-26 E 07-07-26 ADICIONADO: Contador de denúncias por sessão/login
// ================= PRESENÇA DA SALA RTDB COM RECONEXÃO GARANTIDA =================

async function updateUserRoomPresence() {
  const user = auth.currentUser;
  if (!user) return;
  try {
    const { update, onValue, onDisconnect } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js");
    
    const userStatusRef = ref(rtdb, "status/" + user.uid);
    const connectedRef = ref(rtdb, ".info/connected");

    // 1. Escuta o estado do Socket do Firebase
    onValue(connectedRef, async (snap) => {
      if (snap.val() === true) {
        await onDisconnect(userStatusRef).update({
          online: false,
          lastChanged: Date.now()
        });

        await update(userStatusRef, {
          uid: user.uid,
          name: appState.currentUser?.nome || appState.currentUser?.displayNameChat || user.displayName || "Usuário",
          avatar: appState.currentUser?.photoURL || "./img/avatar.png",
          online: true,
          sala: appState.currentRoom || null,
          lastChanged: Date.now()
        });
      }
    });

  } catch (err) {
    console.error("Erro ao atualizar presença da sala:", err);
  }
}

// 2. ESCUTA NATIVA DO NAVEGADOR (Força o envio assim que a rede/Wi-Fi voltar)
window.addEventListener("online", () => {
  if (auth.currentUser) {
    updateUserRoomPresence();
  }
});



// ------------------------ BLOQUEAR ÁREA DE ENVIO SEM PERFIL COMPLETO 21-05-26 --------------------------
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

  // CORREÇÃO 21-06-26: Transforma a trava em um botão interativo, centralizado e otimizado para clique mobile
  if (aviso) {
    aviso.className = "message-profile-lock-btn";
    aviso.innerHTML = `<i class="bi bi-pencil-square" style="font-size:22px;"></i> Complete o seu perfil para liberar o envio de mensagens`;

    // Injeção de estilos inline profissionais para centralização e ganho de área de toque (mobile friendly)
    aviso.style.display = "flex";
    aviso.style.alignItems = "center";
    aviso.style.justifyContent = "center";
    aviso.style.textAlign = "center";
    aviso.style.width = "100%";
    aviso.style.height = "50%"; // Ocupa toda a altura do wrapper bloqueado
    aviso.style.padding = "10px 16px"; // Botão maior e mais robusto
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




/*O que isso faz           20-04-2024
Essa parte cria a lógica: usuário autenticado → mountChatIfReady()
usuário saiu → limpa visual do chat sem recarregar página  */
function mountChatIfNeeded() {
  if (!isChatRoute) return;
  if (appState.chatMounted) return;

  setupChat();
}
// melhoira 01-05-26
function handleUserReady(detail = {}) {
  appState.userReady = true;
  appState.currentUser = detail.user || auth.currentUser || null;
  // melhoria 06-05 
  if (detail.userData?.nome) {
    appState.currentUser.nome = detail.userData.nome;
    appState.currentUser.displayNameChat = detail.userData.nome;
  }


  appState.userCity = null;
  if (detail.userData && detail.userData.cidade) {
    appState.userCity = detail.userData.cidade;
  }

  // ------------------------ OUVIR PERFIL E BLOQUEAR ENVIO SE NÃO ESTIVER COMPLETO --------------------------
  // ------------------------ OUVIR PERFIL VIA EVENTOS (Leitura Inteligente sem onSnapshot Duplicado) 21-06-26 --------------------------
  if (isChatRoute) {
    // Escuta o perfil atualizado que já é transmitido pelo onSnapshot do auth.js
    if (detail.userData) {
      atualizarBloqueioCampoMensagem(detail.userData.perfilCompleto === true);
    }
  }
}


function handleUserLogout() {
  appState.userReady = false;
  appState.currentUser = null;
  appState.reportCount = 0; // 07-07-26 ADICIONADO: Zera o contador de denúncias ao deslogar

  window.replyingTo = null;

  const roomTitle = document.getElementById("chatRoomName");
  if (roomTitle) {
    roomTitle.textContent = appState.currentRoom || sala;
  }

  document.body.classList.remove("keyboard-open");
  closeAllPanels();

  // ------------------------ LIMPAR BLOQUEIO DO CAMPO AO SAIR 11-05-26 --------------------------
  if (typeof appState.unsubscribeProfileLock === "function") {
    appState.unsubscribeProfileLock();
    appState.unsubscribeProfileLock = null;
  }

  // ------------------------ LIMPAR BLOQUEIO DO CAMPO AO SAIR 11-05-26 --------------------------
  atualizarBloqueioCampoMensagem(false);
}
function cleanupChatMessages() {
  if (typeof appState.unsubscribeMessages === "function") {
    appState.unsubscribeMessages();
    appState.unsubscribeMessages = null;
  }
}


//   AUTH + MENSAGENS=
initAuth(showToast);
initUsersPanel(openPanel, closeAllPanels);
document.addEventListener("chatdf:user-ready", (e) => {
  handleUserReady(e.detail || {});
});

document.addEventListener("chatdf:user-logout", () => {
  handleUserLogout();
});


// ABRIR PERFIL PELO MENU DO USUÁRIO NO INDEX / NAVBAR  08-05-2026
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

// =====esse script  BOTÃO HERO "FAÇA LOGIN" e desee html  <a href="#" class="btn btn-outline-light btn-lg fw-bold open-login">Faça login</a>=====
// 06-06-26 abre o modal de privacidade ao clicar no link "Política de Privacidade" do rodapé

//16-07-26  Adicionado: Clique no botão VIP para liberar as configurações e o Preview na mesma hora
document.addEventListener("click", (e) => {
  // Captura o clique do botão VIP para liberar as configurações e o Preview na mesma hora
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

  // Ação para abrir a Modal de Política de Privacidade
  const openPrivacyBtn = e.target.closest("#openPrivacyModalBtn");
  if (openPrivacyBtn) {
    e.preventDefault();
    const privacyWrapper = document.getElementById("privacyTermsWrapper");
    if (privacyWrapper) {
      privacyWrapper.classList.remove("hidden");
      privacyWrapper.style.pointerEvents = "auto"; // Ativa cliques no modal
      document.body.style.overflow = "hidden"; // 🔒 TRAVA A ROLAGEM DO INDEX
    }
    return;
  }

  // Ações para fechar a Modal de Política de Privacidade
  const closePrivacyBtn = e.target.closest("#closePrivacyModalBtn") || e.target.closest("#agreePrivacyBtn");
  if (closePrivacyBtn) {
    e.preventDefault();
    const privacyWrapper = document.getElementById("privacyTermsWrapper");
    if (privacyWrapper) {
      privacyWrapper.classList.add("hidden");
      privacyWrapper.style.pointerEvents = "none"; // Desativa cliques para sumir a parede invisível
      document.body.style.overflow = ""; // 🔓 LIBERA A ROLAGEM DO INDEX NOVAMENTE
    }
    return;
  }
});

document.addEventListener("DOMContentLoaded", () => {
  initNavbarCollapse();

  if (!isChatRoute) return;

  mountChatIfNeeded();

  if (auth.currentUser) {
    handleUserReady({ user: auth.currentUser });
  }
});


// ====================================AÇÕES DOS ANEXOS (DESKTOP) ELEMENTOS DEFINIDOS ================================================

function setupChat() {
  if (chatInitialized) return;
  const chat = document.getElementById("chat-container");
  const input = document.getElementById("messageInput");
  const sendBtn = document.getElementById("sendBtn");
  const emojiBtn = document.getElementById("emojiBtn");
  const stickerBtn = document.getElementById("stickerBtn");
  const stickerPanel = document.getElementById("stickerPanel");
  const stickerList = document.getElementById("stickerList");
  const animBtn = document.getElementById("animBtn");
  const colorBtn = document.getElementById("colorBtn");
  const attachBtn = document.getElementById("attachBtn");
  const openOnlineUsersBtn = document.getElementById("openOnlineUsers");
  overlay = document.getElementById("onlineOverlay");
  let stickerReady = false;
  if (!chat || !input || !sendBtn) {
    console.warn("Elementos do chat não encontrados; inicialização cancelada.");
    return;
  }

  // FAZ O TECLADO MOBILE FECHAR AO ROLAR A TELA 05-06-20026
  let lastScrollTop = 0;
  let isKeyboardOpen = false;

  input.addEventListener("focus", () => {
    isKeyboardOpen = true;
  });

  input.addEventListener("blur", () => {
    isKeyboardOpen = false;
  });


  // 21-06-26 melhoria para evitar que o teclado feche com rolagens pequenas acidentais, só fecha se o usuário rolar mais de 15px
  // CORREÇÃO: Fecha o teclado mobile ao rolar a tela, exigindo uma distância mínima calculada (delta) para evitar blurs acidentais
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

      // Só fecha se o usuário realmente arrastar o dedo por mais de 25 pixels verticalmente
      if (deltaY > 25) {
        input.blur();
      }
    }
  }, { passive: true });



  // Emoji
  emojiBtn?.addEventListener("click", () => {

    closeAllPanels();

    if (window.innerWidth <= 768) {
      openUIPanel("emoji");
    }

  });

  // Stickers
  stickerBtn?.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      openUIPanel("stickers");
      return;
    }
  });

  // Animações
  animBtn?.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      openUIPanel("animations");
      return;
    }
  });
  // BOTÃO CLIP — DESKTOP x MOBILE (MESMO PAINEL)
  attachBtn?.addEventListener("click", (e) => {

    e.preventDefault();
    e.stopImmediatePropagation();

    closeAllPanels();

    if (window.innerWidth <= 768) {
      openAttachmentSheet();
      return;
    }

    openPanel("attachments");

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
  updateUserRoomPresence(); // presença da sala RTDB 18-05-26
  setTimeout(() => {
    document.body.classList.remove("chat-loading");
  }, 500);


  //21-05-26 melhoria para evitar que o botão enviar fique "grudado" no dedo em telas touch, causando envios acidentais ao tentar clicar em outros elementos próximos
  sendBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
  });
  // BOTÃO ENVIAR
  sendBtn.onclick = () => sendMessage(input);
  // ENTER PARA ENVIAR
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage(input);
    }
  });
  // EXPANDIR TEXTO (Mostrar mais / menos)
  chat.addEventListener("click", (e) => {
    if (e.target.classList.contains("toggle-expand")) {
      const textEl = e.target.previousElementSibling;
      if (textEl && textEl.classList.contains("msg-text")) {
        const expanded = textEl.classList.toggle("expanded");
        textEl.style.maxHeight = expanded ? "none" : "4.5em";
        e.target.textContent = expanded ? "Ler menos" : "Ler mais";
      }
    }
  });

  // DETECTAR TECLADO MOBILE
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
  // TEXTAREA AUTO-RESIZE
  messageInput.addEventListener("input", autoResize);
  initStickerPanel(); // esse codigo e dos sticker 17-02-26
  stickerReady = true;





}// fim da function setupChat


// Reset após envio
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
  // Garante que o menu sempre inicie fechado, mesmo após reload / bfcache
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

// CLIQUE NAS OPÇÕES (DESKTOP)
attachmentPanel?.addEventListener("click", (e) => {
  const item = e.target.closest(".attachment-item");
  if (!item) return;
  closeAllPanels();
  const action = item.dataset.action;
  const handler = attachmentActions[action];
  handler?.();
});

// GERENCIADOR CENTRAL DE CLIQUES FORA (ANTI-CONFLITO) 21-06-26
document.addEventListener("click", (e) => {
  // 1. Controle do Painel de Figurínhas/Stickers (Desktop)
  const stickerPanelEl = document.getElementById("stickerPanel");
  const emojiBtnEl = document.getElementById("emojiBtn");
  if (stickerPanelEl?.classList.contains("show")) {
    if (!stickerPanelEl.contains(e.target) && !emojiBtnEl?.contains(e.target) && !e.target.closest("#emojiBtn")) {
      stickerPanelEl.classList.remove("show");
    }
  }

  // 2. Controle do Painel de Anexos/Clip (Desktop)
  const attachmentPanelEl = document.getElementById("attachmentPanel");
  const attachBtnEl = document.getElementById("attachBtn");
  if (attachmentPanelEl?.classList.contains("show")) {
    if (!attachmentPanelEl.contains(e.target) && !attachBtnEl?.contains(e.target) && !e.target.closest("#attachBtn")) {
      closeAllPanels();
    }
  }
});

// FECHAR COM ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeAllPanels();
});


// =================================== FEEDBACK (AI)============================
const FEEDBACK_COOLDOWN = 300;
const feedbackText = document.getElementById("feedbackText");
document.getElementById("cancelFeedback")?.addEventListener("click", () => {
  document.getElementById("feedbackModal")?.classList.add("hidden");
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
    const wait = Math.ceil(
      (FEEDBACK_COOLDOWN * 1000 - (now - lastSent)) / 1000
    );
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


// AÇÕES DE ANEXO VINDAS DO BOTTOM SHEET (MOBILE)
window.addEventListener("attachmentAction", (e) => {
  const action = attachmentActions[e.detail];
  action?.();
});

// PAINEL DE ANEXOS — DESKTOP
const toggleAttachmentPanel = () => {
  if (!attachmentPanel) return;
  if (attachmentPanel.classList.contains("show")) {
    closeAllPanels();
  } else {
    openPanel("attachments");
  }

  attachBtn?.setAttribute(
    "aria-expanded",
    attachmentPanel.classList.contains("show") ? "true" : "false"
  );
};

const closeAttachmentPanel = () => {
  attachmentPanel?.classList.remove("show");
  attachBtn?.setAttribute("aria-expanded", "false");
};



// padronizando funcao global 17-03-26
window.closeAllPanels = closeAllPanels;


// ================= VER PERFIL PELO MENU DA MENSAGEM 06-05-26  =================
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

// ================= DENUNCIAR MENSAGEM PELO MINI MENU 06-05-26 E 04-07-26 =================
// ================= DENUNCIAR USUÁRIO PELO MINI MENU DA MENSAGEM (CHAT-DF UX) =================
// ================= DENUNCIAR USUÁRIO PELO MINI MENU DA MENSAGEM (CHAT-DF UX) =================
document.getElementById("contextReportBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  // Removido o stopPropagation para permitir que o clique chegue perfeitamente até a validação unificada do users-panel.js

  const menu = document.getElementById("messageContextMenu");
  const reportUserModal = document.getElementById("reportUserModal");
  const reportUserBtn = document.getElementById("reportUserBtn");
  const reportReasonSelect = document.getElementById("reportReasonSelect");

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
});

document.getElementById("cancelReport")?.addEventListener("click", () => {
  document.getElementById("reportModal")?.classList.add("hidden");
  currentReportData = null;
});

document.getElementById("sendReport")?.addEventListener("click", async () => {
  const user = auth.currentUser;
  const reportText = document.getElementById("reportText");
  const reason = reportText?.value.trim() || "";

  if (!user) {
    showToast("Faça login para denunciar.");
    return;
  }

  if (!currentReportData) {
    showToast("Mensagem não encontrada para denunciar.");
    return;
  }

  if (!reason) {
    showToast("Escreva o motivo da denúncia.");
    return;
  }
  // essa parte editar os campos do firebase 06-05-26
  try {
    const agora = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const dataId =
      agora.getFullYear() + "-" +
      pad(agora.getMonth() + 1) + "-" +
      pad(agora.getDate()) + "_" +
      pad(agora.getHours()) + "-" +
      pad(agora.getMinutes()) + "-" +
      pad(agora.getSeconds());

    const reporterSnap = await getDoc(doc(db, "users", user.uid));
    const reporterData = reporterSnap.exists() ? reporterSnap.data() : {};

    const reporterChatName =
      reporterData.nome ||
      user.displayName ||
      "Usuario";

    const nomeLimpo = reporterChatName
      .trim()
      .replace(/\s+/g, "_")
      .replace(/[^\wÀ-ÿ_-]/g, "");

    const reportId = `${nomeLimpo}_${dataId}`;

    await setDoc(doc(db, "denuncias", reportId), {
      sala: currentReportData.sala,
      messageId: currentReportData.messageId,
      reportedUid: currentReportData.reportedUid,
      reportedUser: currentReportData.reportedUser,
      messageText: currentReportData.messageText,
      reason,
      reporterUid: user.uid,
      reporterName: reporterChatName,
      createdAt: serverTimestamp()
    });

    reportText.value = "";
    currentReportData = null;

    document.getElementById("reportModal")?.classList.add("hidden");
    showToast("Denúncia enviada. Obrigado por ajudar.");
  } catch (err) {
    console.error(err);
    showToast("Erro ao enviar denúncia.");
  }
});



// ===================== PERFIL DO USUÁRIO PERFIL===================== 03-04-26

import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
// ELEMENTOS
const profilePanel = document.getElementById("profilePanel");
const profileOverlay = document.getElementById("profileOverlay");
const closeProfileBtn = document.getElementById("closeProfilePanel");
const editProfileCoverBtn = document.getElementById("editProfileCoverBtn");

const profileName = document.getElementById("profileName");

const profileMood = document.getElementById("profileMood");
const profileCity = document.getElementById("profileCity");
const profileAvatar = document.getElementById("profileAvatar");
const profileOnlineDot = document.getElementById("profileOnlineDot"); // bolinha verde 03-05-26

const editName = document.getElementById("editName");
const editCity = document.getElementById("editCity");
const editMood = document.getElementById("editMood");
const editAge = document.getElementById("editAge");
const editGender = document.getElementById("editGender"); // Garantindo mapeamento estável no DOM
const saveProfileBtn = document.getElementById("saveProfileBtn");

// ================= LISTA PADRÃO DE CIDADES DO DF 01-05-26 DENTRO PAINEL PERFIL=================
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



// ================= LISTA PADRÃO DE GÊNERO 01-05-26 =================
const GENEROS_PADRAO = [
  "Masculino",
  "Feminino",
  "Prefiro não dizer"
];

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









// melhoria 29-04-26
const profileAge = document.getElementById("profileAge");
const profileGender = document.getElementById("profileGender");
const profileMemberSince = document.getElementById("profileMemberSince");

// melhoria 29-04-26 editar o campo de idade do perfil impede do usuario digitar letra ao invez de numero 
editAge?.addEventListener("input", () => {
  let value = editAge.value.replace(/\D/g, "");

  if (value !== "" && Number(value) > 100) {
    value = "100";
  }

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


//=============================              =========================================12-04-2026 
const profileInfoSection = document.getElementById("profileInfo");
const profileEditSection = document.getElementById("profileEdit");
const profileInfoTab = document.querySelector('.profile-tab[data-tab="info"]');
const profileEditTab = document.querySelector('.profile-tab[data-tab="edit"]');
let currentViewedProfileId = null;
let currentProfileIsOwner = false;
let profileRequestToken = 0;
const DEFAULT_PROFILE_AVATAR = "./img/avatar.png";

// painel perfil editar a parte membro desde, mostra a data e hora dentro, melhoria 29-04-26
function formatProfileDate(value) {
  if (!value) return "-";

  let date;

  if (typeof value === "number") {
    date = new Date(value);
  } else if (value?.toDate) {
    date = value.toDate();
  } else {
    date = new Date(value);
  }

  if (isNaN(date.getTime())) return "-";

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    //hour: "2-digit",
    //minute: "2-digit"
  });
}

let selectedBannerColor = "#000000";
let selectedProfileAvatar = DEFAULT_PROFILE_AVATAR;
let isProfileEditLocked = false;
let profileEditRemainingDays = 0;


// =====================  BLOQUEIo NO PAINEL PERFIL DO USUARIO USUARIO 23-04-2026 ================== 
const PROFILE_EDIT_COOLDOWN_DAYS = 1; // depois pode mudar para 2
const PROFILE_EDIT_COOLDOWN_MS =
  PROFILE_EDIT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

function getRemainingEditDays(lastEditAt) {
  if (!lastEditAt) return 0;
  const diff = Date.now() - lastEditAt;
  if (diff >= PROFILE_EDIT_COOLDOWN_MS) return 0;
  return Math.ceil(
    (PROFILE_EDIT_COOLDOWN_MS - diff) / (24 * 60 * 60 * 1000)
  );
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

//25-04-26
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

    if (color === selectedBannerColor) {
      box.classList.add("selected");
    }

    box.addEventListener("click", () => {
      if (!currentProfileIsOwner) return;

      selectedBannerColor = color;

      if (profileEditorBannerPreview) {
        profileEditorBannerPreview.style.background = color;
      }

      profileEditorBannerColors
        .querySelectorAll(".profile-banner-editor-color-box")
        .forEach(el => el.classList.remove("selected"));

      box.classList.add("selected");
    });

    profileEditorBannerColors.appendChild(box);
  });
}




//15-04-2026
function renderProfileBannerPalette() {
  if (!profileBannerColors) return;

  profileBannerColors.innerHTML = "";

  textColorPalette.forEach(color => {
    if (!color || color === "<br>") return;

    const box = document.createElement("div");
    box.className = "profile-banner-color-box";
    box.style.backgroundColor = color;
    box.dataset.color = color;

    if (color === selectedBannerColor) {
      box.classList.add("selected");
    }

    box.addEventListener("click", () => {
      if (!currentProfileIsOwner) return;

      selectedBannerColor = color;

      if (profileCover) {
        profileCover.style.background = color;
      }

      if (profileBannerPreview) {
        profileBannerPreview.style.background = color;
      }

      profileBannerColors.querySelectorAll(".profile-banner-color-box").forEach(el => {
        el.classList.remove("selected");
      });

      box.classList.add("selected");
    });

    profileBannerColors.appendChild(box);
  });
}



/*-------------- 12-04-26 --------------------
Essa função é a função central que abre e atualiza o painel principal de perfil.

Em português simples, ela faz isso:

O papel dela

Quando você clica em:

Meu perfil
ou em um usuário online

é essa função que:

decide de quem é o perfil
abre o painel se ele ainda estiver fechado
troca o painel para modo:
dono do perfil
ou visitante
busca os dados no Firestore
preenche nome, email, cidade, telefone e foto




*/
let unsubscribeProfileListener = null; // melhoria 03-05-26 
window.openMainProfilePanel = async (userId, options = {}) => {
  if (!auth.currentUser) {
    if (typeof showToast === "function") {
      showToast("Faça login para ver o perfil");
    }

    const modal = document.getElementById("loginModal");
    if (modal) modal.classList.remove("hidden");

    return;
  }

  if (!userId) return;

  const loggedUser = auth.currentUser;
  const isOwner = !!loggedUser && loggedUser.uid === userId;
  const isPanelOpen = profilePanel?.classList.contains("open");

  // 07-07-26 Alimenta a variável local e a do estado global para o users-panel.js ter acesso
  currentViewedProfileId = userId;
  if (window.appState) {
    window.appState.currentViewedProfileId = userId;
  }

  profileRequestToken += 1;
  const requestToken = profileRequestToken;

 
if (!isPanelOpen) {
    openProfilePanel();
  }

  // LIMPEZA IMEDIATA DA FOTO ANTIGA PARA EVITAR O BUG VISUAL
  if (profileAvatar) {
    profileAvatar.src = DEFAULT_PROFILE_AVATAR;
  }

  renderProfileBannerPalette();

  document.body.classList.toggle("viewing-other-profile", !isOwner);
  applyProfileMode(isOwner);

  await new Promise(resolve => requestAnimationFrame(resolve));



  try {
    const refUser = doc(db, "users", userId);

    if (unsubscribeProfileListener) {
      unsubscribeProfileListener();
    }

    unsubscribeProfileListener = onSnapshot(refUser, (snap) => {
      if (requestToken !== profileRequestToken) return;

      if (!snap.exists()) {
        profileName.textContent = "Usuário";
        profileMood.textContent = "Sem recado no momento.";
        profileCity.textContent = "-";
        profileAvatar.src = "img/avatar.png";
        selectedBannerColor = "#8b898963";

        if (profileCover) {
          profileCover.style.background = selectedBannerColor;
        }

        if (profileEditorBannerPreview) {
          profileEditorBannerPreview.style.background = selectedBannerColor;
        }

        renderProfileBannerPalette();
        renderProfileEditorBannerPalette();
        return;
      }

      const data = snap.data();

      //bolinha verde dentro do perfil painel 03-05-26
      const statusRef = ref(rtdb, "status/" + userId);

      onValue(statusRef, (statusSnap) => {
        const statusData = statusSnap.val();
        const isOnline = statusData?.online === true;

        if (profileOnlineDot) {
          profileOnlineDot.classList.toggle("hidden", !isOnline);
        }
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
      const instagram = data.instagram || ""; // 21-07-26 

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

  if (profileCover) {
        // Ao abrir o perfil (que inicia na aba Info), exibe sempre a cor sólida original
        profileCover.style.backgroundImage = "none";
        profileCover.style.background = bannerColor;
      }

      if (profileEditorBannerPreview) {
        profileEditorBannerPreview.style.background = bannerColor;
      }

      renderProfileBannerPalette();
      renderProfileEditorBannerPalette();

    if (editName) editName.value = nome;
      if (editCity) editCity.value = data.cidade || "";
      if (editMood) editMood.value = data.mood || "";

      if (editAge) editAge.value = data.idade || "";
      if (editGender) editGender.value = data.genero || "";
      // Garante acesso seguro mesmo que algum campo de edição não esteja no HTML atual
const setInputValue = (el, val) => {
  if (el && 'value' in el) {
    el.value = val ?? "";
  }
};

setInputValue(editName, nome);
setInputValue(editCity, data.cidade);
setInputValue(editMood, data.mood);
setInputValue(editAge, data.idade);
setInputValue(editGender, data.genero);



// 21-07-26 PREENCHE O CAMPO DE EDIÇÃO E EXIBE/OCULTA O BOTAO SOCIAL
     // ================= EXIBIÇÃO DE INSTAGRAM E TELEGRAM EM TEXTO NO PAINEL =================
      const editInstagram = document.getElementById("editInstagram");
      const editTelegram = document.getElementById("editTelegram");
      const profileInstagramText = document.getElementById("profileInstagramText");
      const profileTelegramText = document.getElementById("profileTelegramText");

      const telegram = data.telegram || "";

      // 1. Tratamento do Instagram
      let username = instagram ? String(instagram).trim() : "";
      if (username.includes("instagram.com/")) {
        username = username.split("instagram.com/")[1];
      }
      username = username.split("?")[0].split("#")[0].split("/")[0];
      if (username.startsWith("@")) {
        username = username.substring(1);
      }
      username = username.replace(/[^a-zA-Z0-9_.]/g, "").toLowerCase();

      if (editInstagram) {
        editInstagram.value = username ? `@${username}` : "";
      }

      if (profileInstagramText) {
        if (username !== "") {
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

     if (isMobile) {
            profileInstagramText.innerHTML = `<a id="instaClickBtn" href="instagram://user?username=${username}" style="color: #000000 !important; font-weight: 600; text-decoration: none;">@${username}</a>`;
            const btn = document.getElementById("instaClickBtn");
            btn?.addEventListener("click", (e) => {
              e.stopPropagation();
              setTimeout(() => {
                window.location.href = `https://www.instagram.com/${username}/`;
              }, 800);
            });
          } else {
            profileInstagramText.innerHTML = `<span id="instaDesktopBtn" style="color: #161616dc; font-weight: 600; cursor: pointer;" title="Acesse pelo celular para abrir o perfil">@${username}</span>`;
            const deskBtn = document.getElementById("instaDesktopBtn");
            deskBtn?.addEventListener("click", (e) => {
              e.stopPropagation();
              if (typeof showToast === "function") {
                showToast("O link do Instagram está disponível apenas no acesso pelo celular.");
              }
            });
          }
        } else {
          profileInstagramText.textContent = "-";
        }
      }

      // 2. Tratamento do Telegram
      let teleUser = telegram ? String(telegram).trim() : "";
      if (teleUser.includes("t.me/")) teleUser = teleUser.split("t.me/")[1];
      if (teleUser.includes("telegram.me/")) teleUser = teleUser.split("telegram.me/")[1];
      teleUser = teleUser.split("?")[0].split("#")[0].split("/")[0];
      if (teleUser.startsWith("@")) teleUser = teleUser.substring(1);
      teleUser = teleUser.replace(/[^a-zA-Z0-9_.]/g, "").toLowerCase();

      if (editTelegram) {
        editTelegram.value = teleUser ? `@${teleUser}` : "";
      }

      if (profileTelegramText) {
        if (teleUser !== "") {
          profileTelegramText.innerHTML = `<a href="https://t.me/${teleUser}" target="_blank" rel="noopener noreferrer" style="color: #161616dc; font-weight: 600; text-decoration: none;">@${teleUser}</a>`;
        } else {
          profileTelegramText.textContent = "-";
        }
      }
      criarListaCidadesPerfil();
      criarListaGeneroPerfil();
      setTimeout(perfilEstaCompleto, 200);//04-06-26 melhoria para verificar se o perfil está completo após carregar os dados, 
      // e não antes como era feito, evitando erros de verificação por conta do carregamento assíncrono dos dados do perfil
    });

  } catch (err) {
    if (requestToken !== profileRequestToken) return;
    console.error(err);
    showToast("Erro ao carregar perfil");
  }
};




/*=========================================================================================
// 13-07-26 melhoria para travar edição de perfil quando estiver bloqueado por dias
EDITA ESSA FUNÇÃO function applyProfileMode  Ela         15-04-26
configura o painel de perfil:
se for dono, mostra edição
se for outro usuário, esconde edição.
===========================================================================================*/
function applyProfileMode(isOwner) {
  currentProfileIsOwner = isOwner;

  const reportBtn = document.getElementById("reportUserBtn");
  const uploadPhotoBtn = document.getElementById("btnUploadPhoto");
  const vipTabBtn = document.querySelector('.profile-tab[data-tab="vip"]');
  let isLocked = false;

  if (isOwner && auth.currentUser) {
    const profileDoc = window.__currentProfileData || {};
    const remainingDays = getRemainingEditDays(profileDoc.lastProfileEditAt);
    isLocked = remainingDays > 0;
  }

  if (isOwner) {
    document.body.classList.remove("viewing-other-profile");

    if (reportBtn) reportBtn.style.display = "none";

    const activeTab = document.querySelector('.profile-tab.active')?.dataset.tab || "info";
    if (editProfileCoverBtn) {
      editProfileCoverBtn.style.display = (activeTab === "vip") ? "none" : "grid";
    }

    // GARANTE QUE AS 3 ABAS (INFO, EDITAR PERFIL, VIP) FIQUEM VISÍVEIS NO PAINEL DO DONO
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
        uploadPhotoBtn.classList.remove("hidden");
        uploadPhotoBtn.style.opacity = "1";
        uploadPhotoBtn.style.cursor = "pointer";
      }
      if (editProfileCoverBtn) {
        editProfileCoverBtn.style.opacity = "1";
        editProfileCoverBtn.style.cursor = "pointer";
      }
      editName?.removeAttribute("disabled");
      editCity?.removeAttribute("disabled");
      editMood?.removeAttribute("disabled");
    } else {
      if (uploadPhotoBtn) {
        uploadPhotoBtn.style.opacity = "0.01";
        uploadPhotoBtn.style.cursor = "not-allowed";
      }
      if (editProfileCoverBtn) {
        editProfileCoverBtn.style.opacity = "0.01";
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


/* ========================================================================
Função que ZERA 100% qualquer efeito VIP no painel padrão (Info e Editar perfil)
=====================================================================*/
/* ========================================================================
Função que ZERA 100% qualquer efeito VIP no painel padrão (Info e Editar perfil)
=====================================================================*/
function restaurarVisualPadraoPerfil() {
  const topName = document.getElementById("profileName");
  const topFrame = document.getElementById("vipTopPreviewFrame");
  const topBanner = document.querySelector(".profile-cover");
  const data = window.__currentProfileData || {};

  // 1. Reseta o Nome para o texto limpo e comum
  if (topName) {
    topName.className = "fw-bold";
    topName.style.background = "";
    topName.style.webkitBackgroundClip = "";
    topName.style.webkitTextFillColor = "";
    topName.style.fontFamily = "";
    topName.style.color = "";
    topName.textContent = data.nome || "Usuário";
  }

  // 2. Esconde e limpa 100% a Moldura do Avatar
  if (topFrame) {
    topFrame.className = "position-absolute top-0 start-0 w-100 h-100 rounded-circle d-none";
  }

  // 3. Força a capa a voltar estritamente para a cor padrão
  if (topBanner) {
    topBanner.className = "profile-cover position-relative";
    topBanner.style.backgroundImage = "none";
    topBanner.style.background = data.bannerColor || selectedBannerColor || "#00000063";
  }

  // 4. Remove o modo VIP e raspa todas as classes de temas do container do painel
  if (profilePanel) {
    profilePanel.classList.remove("vip-mode-active");
    profilePanel.className = profilePanel.className.replace(/banner-\S+/g, "").trim();
    profilePanel.style.padding = "";
    profilePanel.style.background = "";
  }

  // 5. Reseta os selects nativos ocultos para os valores padrão do sistema
  const typeSelect = document.getElementById("vipNameColorType");
  const fontSelect = document.getElementById("vipNameFont");
  const frameSelect = document.getElementById("vipAvatarFrameSelect");
  const bannerSelect = document.getElementById("vipProfileBannerSelect");

  if (typeSelect) typeSelect.value = "solid";
  if (fontSelect) fontSelect.value = "default";
  if (frameSelect) frameSelect.value = "none";
  if (bannerSelect) bannerSelect.value = "default";

  // 6. Reseta o texto dos botões visíveis dos dropdowns personalizados
  const btnType = document.getElementById("btnVipNameColorType");
  const btnFont = document.getElementById("btnVipNameFont");
  const btnFrame = document.getElementById("btnVipAvatarFrameSelect");
  const btnBanner = document.getElementById("btnVipProfileBannerSelect");

  if (btnType) btnType.textContent = "Cor Sólida Comum";
  if (btnFont) btnFont.textContent = "Padrão do Chat";
  if (btnFrame) btnFrame.textContent = "Nenhuma Moldura";
  if (btnBanner) btnBanner.textContent = "Padrão do Sistema";

  // 7. Limpa a marcação ativa (classe "active") das opções dentro dos dropdowns personalizados
  document.querySelectorAll('.vip-custom-dropdown').forEach(dropdown => {
    dropdown.querySelectorAll('.vip-dropdown-option').forEach(option => {
      option.classList.remove('active');
      const val = option.getAttribute('data-value');
      if (val === "solid" || val === "default" || val === "none") {
        option.classList.add('active');
      }
    });
    dropdown.classList.add('hidden'); // Garante que a lista feche ao alternar de aba
  });

  // 8. Reseta as variáveis globais temporárias de cores VIP
  window.__vipNOME_COR_SELECIONADA = "#6f42c1";
  window.__vipMENSAGEM_COR_SELECIONADA = "#333333";
}




/* ================================================================================
REESTRUTURAÇÃO DAS ABAS E MOTOR VIP DEFINITIVO  ABAS REESTRUTURADAS (TOTALMENTE INDEPENDENTES
====================================================================================*/

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

   

    //  ============================

// Alterna a classe VIP para ativar tema e bordas apenas na aba VIP
    const isVip = target === "vip";
    if (profilePanel) {
      profilePanel.classList.toggle("vip-mode-active", isVip);
    }

    // Oculta o recado apenas quando estiver na aba VIP
    const topMood = document.getElementById("profileMood");
    if (topMood) {
      topMood.style.display = isVip ? "none" : "block";
    }

    // ISOLAMENTO VIP: Se você clicou em "Info" ou "Editar perfil", restaura o topo original
    if (!isVip) {
      restaurarVisualPadraoPerfil();
    }





    // Troca o botão Lápis pelo Botão VIP exclusivo no topo
// Troca os botões de ação do topo de acordo com a aba ativa
    const editBtn = document.getElementById("editProfileCoverBtn");
    const vipBtn = document.getElementById("vipHeaderActionBtn");

    if (currentProfileIsOwner) {
      if (editBtn) {
        // Se estiver travado pelo tempo de edição, respeita a opacidade e visibilidade do perfil
        editBtn.style.display = isVip ? "none" : "grid";
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

if (target === "vip") {
      // Puxa o elemento real da capa de forma segura, corrigindo o erro 'topBanner is not defined'
      const profileCoverEl = document.querySelector(".profile-cover");
      const data = window.__currentProfileData || {};
      
      if (profileCoverEl && data.vipBannerUrl) {
        profileCoverEl.style.background = `url("${data.vipBannerUrl}") center/cover no-repeat`;
      }
      inicializarPainelVipDinamico();
    }
  });
});




function inicializarPainelVipDinamico() {
  const promoSec = document.getElementById("vipPromoSection");
  const settingsSec = document.getElementById("vipSettingsSection");
  const expiryRow = document.getElementById("vipExpiryRow");

  // Força a exibição da Seção 2 diretamente ao clicar na aba VIP, pulando travas do Firestore
  if (promoSec) { promoSec.classList.add("d-none"); promoSec.style.setProperty("display", "none", "important"); }
  if (settingsSec) { settingsSec.classList.remove("d-none"); settingsSec.style.setProperty("display", "block", "important"); }
  if (expiryRow) { expiryRow.classList.remove("d-none"); expiryRow.style.setProperty("display", "block", "important"); }

  // Renderização estável dos quadradinhos da paleta de cores do Nome VIP
  const vipNameGrid = document.getElementById("vipNameColorGrid");
  if (vipNameGrid && vipNameGrid.children.length === 0) {
    vipNameGrid.innerHTML = "";
    textColorPalette.forEach(color => {
      if (!color || color === "<br>") return;
      const box = document.createElement("div");
      box.className = "color-box";
      box.style.width = "32px";
      box.style.height = "32px";
      box.style.backgroundColor = color;
      box.style.borderRadius = "6px";
      box.style.cursor = "pointer";
      box.style.display = "inline-block";
      box.style.margin = "3px";
      box.dataset.color = color;
      box.innerHTML = `<span class="color-check" style="display:none; color:#fff; text-align:center; line-height:32px;">✓</span>`;
      vipNameGrid.appendChild(box);
    });
  }

  // Renderização estável dos quadradinhos da paleta de cores da Mensagem VIP
  const vipMsgGrid = document.getElementById("vipMsgColorGrid");
  if (vipMsgGrid && vipMsgGrid.children.length === 0) {
    vipMsgGrid.innerHTML = "";
    textColorPalette.forEach(color => {
      if (!color || color === "<br>") return;
      const box = document.createElement("div");
      box.className = "color-box";
      box.style.width = "32px";
      box.style.height = "32px";
      box.style.backgroundColor = color;
      box.style.borderRadius = "6px";
      box.style.cursor = "pointer";
      box.style.display = "inline-block";
      box.style.margin = "3px";
      box.dataset.color = color;
      box.innerHTML = `<span class="color-check" style="display:none; color:#fff; text-align:center; line-height:32px;">✓</span>`;
      vipMsgGrid.appendChild(box);
    });
  }

  const previewName = document.getElementById("vipPreviewName");
  const previewAvatar = document.getElementById("vipPreviewAvatar");

  if (previewName) previewName.textContent = editName?.value || "Usuário";
  if (previewAvatar) previewAvatar.src = selectedProfileAvatar || "./img/avatar.png";

  vincularEventosPreviewVip();
}
// =========== 18-07-2026  SISTEMA DE ACORDEÃO VIP PROFESSIONAL (UX CHAT-DF) ======================
// ENGINE DO ACORDEÃO VIP (BOTÕES FIXOS NA GRADE E CONTEÚDO ABAIXO)
document.querySelectorAll(".vip-btn-card").forEach(button => {
  button.addEventListener("click", (e) => {
    e.preventDefault();
    const targetId = button.getAttribute("data-target");

    // Oculta todas as gavetas de conteúdo
    document.querySelectorAll(".vip-drawer-content").forEach(drawer => {
      drawer.classList.add("hidden");
    });

    // Desativa o estado ativo de todos os botões
    document.querySelectorAll(".vip-btn-card").forEach(btn => {
      btn.classList.remove("active");
    });

    // Exibe a gaveta selecionada e ativa o botão clicado
    const targetDrawer = document.getElementById(targetId);
    if (targetDrawer) {
      targetDrawer.classList.remove("hidden");
      button.classList.add("active");
    }
  });
});
window.__vipMENSAGEM_COR_SELECIONADA = "#333333";
window.__vipNOME_COR_SELECIONADA = "#6f42c1";
function vincularEventosPreviewVip() {
  const topName = document.getElementById("profileName");
  const topText = document.getElementById("vipTopPreviewText");
  const topFrame = document.getElementById("vipTopPreviewFrame");
  const topBanner = document.querySelector(".profile-cover");
  const solidWrapper = document.getElementById("vipSolidColorWrapper");
  const typeSelect = document.getElementById("vipNameColorType");
  const fontSelect = document.getElementById("vipNameFont");
  const frameSelect = document.getElementById("vipAvatarFrameSelect");
  const bannerSelect = document.getElementById("vipProfileBannerSelect");
  const atualizarSimulacaoTopo = () => {
    if (!topName || !topText || !topFrame || !topBanner) return;

    // Reset limpo do Nome
    topName.className = "fw-bold";
    topName.style.background = "";
    topName.style.webkitBackgroundClip = "";
    topName.style.webkitTextFillColor = "";
    topName.style.color = "";// Limpa a cor fixa inline para o CSS poder aplicar a cor do Glow

    const valorEfeito = typeSelect ? typeSelect.value : "solid";

    // 1. CORREÇÃO DO EFEITO NO NOME (Aplica a classe no formato nick-...)
    if (valorEfeito === "solid") {
      if (solidWrapper) solidWrapper.style.setProperty("display", "block", "important");
      topName.style.color = window.__vipNOME_COR_SELECIONADA || "#6f42c1";
    } else {
      if (solidWrapper) solidWrapper.style.setProperty("display", "none", "important");
      
      // Garante o formato correto da classe do CSS (nick-gradient-xxx ou nick-anim-xxx)
   // Remove qualquer classe de efeito antiga antes de colocar a nova
topName.className = topName.className.replace(/nick-\S+/g, "").trim();

if (valorEfeito !== "solid") {
  topName.classList.add(`nick-${valorEfeito}`);
}
    }

    // Estilo de Fonte
// Estilo de Fonte
    if (fontSelect) {
      if (fontSelect.value !== "default") {
        let herancaTipo = "sans-serif";
        if (["Courgette", "Lobster", "Bangers", "Pacifico", "Satisfy"].includes(fontSelect.value)) {
          herancaTipo = "cursive";
        }
        topName.style.fontFamily = `'${fontSelect.value}', ${herancaTipo}`;
      } else {
        // Limpa a fonte personalizada e restaura o padrão do sistema/chat
        topName.style.fontFamily = "";
      }
    }

    if (topText) {
      topText.style.color = window.__vipMENSAGEM_COR_SELECIONADA || "#333333";
    }

    // 2. CORREÇÃO DA MOLDURA DO AVATAR (Remove d-none e aplica a classe)
    if (topFrame) {
      topFrame.className = "position-absolute top-0 start-0 w-100 h-100 rounded-circle";
      const valorMoldura = frameSelect ? frameSelect.value : "none";
      
      if (valorMoldura !== "none") {
        topFrame.classList.remove("d-none"); // Remove a trava do Bootstrap
        topFrame.classList.add(valorMoldura); // Aplica o efeito de borda/luz
      } else {
        topFrame.classList.add("d-none");
      }
    }

    // Capa de Perfil
// Tema BORDA em torno do Modal Inteiro


// Tema em torno do Modal Inteiro com limpeza da Capa
    if (profilePanel && bannerSelect) {
      // Remove qualquer classe antiga de tema do painel
      profilePanel.className = profilePanel.className.replace(/banner-\S+/g, "").trim();
      
      if (bannerSelect.value === "default") {
        profilePanel.style.border = "";
        profilePanel.style.background = "";
        // Restaura a cor padrão da capa quando não houver tema ativo
        if (topBanner) {
          topBanner.style.backgroundImage = "none";
          topBanner.style.background = selectedBannerColor || "#00000063";
        }
      } else {
        profilePanel.classList.add(bannerSelect.value);
        // Limpa o fundo inline da capa para o tema do painel/capa sobressair
        if (topBanner) {
          topBanner.style.background = "";
        }
      }
    }


  };

  // Conecta as alterações dos selects com a função de atualização
  [typeSelect, fontSelect, frameSelect, bannerSelect].forEach(selectEl => {
    selectEl?.addEventListener("change", atualizarSimulacaoTopo);
  });

  window.atualizarSimulacaoTopoVip = atualizarSimulacaoTopo;

  // Paleta de Cores do Nome
  const vipNameGrid = document.getElementById("vipNameColorGrid");
  if (vipNameGrid) {
    vipNameGrid.onclick = (e) => {
      const box = e.target.closest(".color-box");
      if (!box) return;
      window.__vipNOME_COR_SELECIONADA = box.dataset.color;
      vipNameGrid.querySelectorAll(".color-box").forEach(b => b.classList.remove("selected"));
      box.classList.add("selected");
      atualizarSimulacaoTopo();
    };
  }

  // Paleta de Cores do Texto
  const vipMsgGrid = document.getElementById("vipMsgColorGrid");
  if (vipMsgGrid) {
    vipMsgGrid.onclick = (e) => {
      const box = e.target.closest(".color-box");
      if (!box) return;
      window.__vipMENSAGEM_COR_SELECIONADA = box.dataset.color;
      vipMsgGrid.querySelectorAll(".color-box").forEach(b => b.classList.remove("selected"));
      box.classList.add("selected");
      atualizarSimulacaoTopo();
    };
  }

  atualizarSimulacaoTopo();
}

// Vincula a gravação dos dados VIP ao botão de Salvar exclusivo
document.getElementById("btnSaveVipSettings")?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;

  try {
    showToast("Gravando configurações VIP...");
    const refUser = doc(db, "users", user.uid);

    await updateDoc(refUser, {
      vipNameColorType: document.getElementById("vipNameColorType").value,
      vipNameColorSolid: window.__vipNOME_COR_SELECIONADA || "#6f42c1", // Salva a cor do quadradinho do nome
      vipNameFont: document.getElementById("vipNameFont").value,
      vipMsgColor: window.__vipMENSAGEM_COR_SELECIONADA || "#333333", // Salva a cor do quadradinho do texto
      vipAvatarFrame: document.getElementById("vipAvatarFrameSelect").value,
      vipProfileBanner: document.getElementById("vipProfileBannerSelect").value
    });
    showToast("Vantagens VIP salvas e aplicadas com sucesso!");
    inicializarPainelVipDinamico();
  } catch (err) {
    console.error("Erro ao salvar dados VIP:", err);
    showToast("Erro ao salvar configurações.");
  }
});
// --------------- ABRIR / FECHAR ------------------
function openProfilePanel() {
  if (!profilePanel) return;
  // Zera qualquer tema temporário antigo antes de exibir o painel
  restaurarVisualPadraoPerfil();
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
  profilePanel.classList.remove("open");
  profilePanel.classList.remove("dragging");
  profilePanel.style.transform = "";
  profileOverlay?.classList.remove("show");
  if (force) {
    profilePanel.classList.add("hidden");
    profileOverlay?.classList.add("hidden");
    //adicionado  11-05-26
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

      // Reseta as propriedades inline para garantir que as 3 abas fiquem visíveis na abertura
      if (profileEditTab) {
        profileEditTab.style.removeProperty("display");
      }
      const vipTabBtnReset2 = document.querySelector('.profile-tab[data-tab="vip"]');
      if (vipTabBtnReset2) {
        vipTabBtnReset2.style.removeProperty("display");
      }
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
      //adicionado  11-05-26
      document.body.classList.remove("profile-open");
      document.body.style.top = "";
      document.body.style.position = "";
      document.body.style.overflow = "";
      document.body.style.height = "";
      document.body.style.width = "";

      window.scrollTo(0, window.__profileScrollY || 0);//11-05-26
      if (typeof unlockProfileBackground === "function") {
        unlockProfileBackground();
      }

     document.body.classList.remove("viewing-other-profile");
      currentViewedProfileId = null;
      currentProfileIsOwner = false;

      // Reseta as propriedades inline para garantir que as 3 abas fiquem visíveis na abertura
      if (profileEditTab) {
        profileEditTab.style.removeProperty("display");
      }
      const vipTabBtnReset2 = document.querySelector('.profile-tab[data-tab="vip"]');
      if (vipTabBtnReset2) {
        vipTabBtnReset2.style.removeProperty("display");
      }
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
    const time =
      first.endsWith("ms") ? parseFloat(first) : parseFloat(first) * 1000;
    setTimeout(finalizeClose, isNaN(time) ? 300 : time + 40);
  });
}

closeProfileBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  closeProfilePanel(true);
});

//15-04-2026
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
  if (e.target === profileEditorModal) {
    closeProfileEditor();
  }
});
showBannerEditorBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  showBannerEditorBtn.classList.add("active");
  openAvatarPickerBtn?.classList.remove("active");
  profileEditorBannerPreview?.classList.remove("hidden");
  profileEditorBannerColors?.classList.remove("hidden");
  profileEditorAvatarArea?.classList.add("hidden");
  renderProfileEditorBannerPalette();
});
//========================================= novo avatar picker 03-06-26 =========================================
// 03-06-26  EVENTO UNIFICADO PARA ABRIR O SELETOR DE AVATAR JÁ CARREGANDO "ELES"
openAvatarPickerBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  openAvatarPickerBtn.classList.add("active");
  showBannerEditorBtn?.classList.remove("active");
  profileEditorBannerPreview?.classList.add("hidden");
  profileEditorBannerColors?.classList.add("hidden");
  profileEditorAvatarArea?.classList.remove("hidden");
  carregarCategoria("eles"); // Aciona o lote inicial masculino do avatar.js
});
// ====================== 03-06-26 NOVO MOTOR MULTIAVATAR ======================
// ====================== MOTOR MULTIAVATAR CORRIGIDO COM BOTÕES BOOTSTRAP ======================
let listaAtual = [];
let avataresRenderizados = 0;
const LOTE_TAMANHO = 15;
let categoriaAtual = "eles";
// Índices numéricos isolados para a linha de montagem genética
let partesDna = {
  ambiente: 0,
  roupas: 0,
  cabeca: 0,
  boca: 0,
  olhos: 0,
  cabelo: 0
};
// ENGINES DE RESOLUÇÃO SEPARADAS (CONFORME A DOCUMENTAÇÃO OFICIAL)
function gerarAvatarDnaUri(dna12Digitos) {
  // O parâmetro 'true' desliga a criptografia e lê as coordenadas das peças de 00 a 47
  const svgCode = multiavatar(dna12Digitos, true);
  return "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgCode)));
}

function gerarAvatarUri(texto) {
  // Modo clássico por semente (usado para renderizar os lotes fixos do avatar.js)
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
      codigo = Math.random().toString(36).substring(7);
    } else {
      if (i >= listaAtual.length) break;
      codigo = listaAtual[i];
    }

    let imagemUri = gerarAvatarUri(codigo);
    html += `<img src="${imagemUri}" class="avatar-option" data-uri="${imagemUri}" style="width: 65px; height: 65px; cursor: pointer; border-radius: 50%; border: 3px solid transparent;" />`;
  }

  profileEditorAvatarGrid.insertAdjacentHTML("beforeend", html);
  avataresRenderizados += LOTE_TAMANHO;
}

// Controla a troca de abas ocultando ou exibindo o Construtor Dinâmico
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

function padDoisDigitos(val) {
  return String(val).padStart(2, "0");
}

// Junta as 6 variáveis em Direct DNA e reconecta na visualização profissional
function atualizarPreviewConstrutor() {
  if (document.getElementById("valAmbiente")) document.getElementById("valAmbiente").textContent = padDoisDigitos(partesDna.ambiente);
  if (document.getElementById("valRoupas")) document.getElementById("valRoupas").textContent = padDoisDigitos(partesDna.roupas);
  if (document.getElementById("valCabeca")) document.getElementById("valCabeca").textContent = padDoisDigitos(partesDna.cabeca);
  if (document.getElementById("valBoca")) document.getElementById("valBoca").textContent = padDoisDigitos(partesDna.boca);
  if (document.getElementById("valOlhos")) document.getElementById("valOlhos").textContent = padDoisDigitos(partesDna.olhos);
  if (document.getElementById("valCabelo")) document.getElementById("valCabelo").textContent = padDoisDigitos(partesDna.cabelo);

  // Amarra os 6 blocos sequenciais da esquerda para a direita
  const dnaFinal = padDoisDigitos(partesDna.ambiente) +
    padDoisDigitos(partesDna.roupas) +
    padDoisDigitos(partesDna.cabeca) +
    padDoisDigitos(partesDna.boca) +
    padDoisDigitos(partesDna.olhos) +
    padDoisDigitos(partesDna.cabelo);

  // CORREÇÃO: Puxa o renderizador direto de peças sem embaralhar o boneco
  const novaUri = gerarAvatarDnaUri(dnaFinal);
  const previewImg = document.getElementById("constructorPreview");
  if (previewImg) previewImg.src = novaUri;

  selectedProfileAvatar = novaUri;
}

// Configura as ações de avanço e recuo das setas (Limite de 00 a 47)
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

// Vincula as ações individuais das setas do Bootstrap
VincularAcaoParte("prevAmbiente", "nextAmbiente", "ambiente");
VincularAcaoParte("prevRoupas", "nextRoupas", "roupas");
VincularAcaoParte("prevCabeca", "nextCabeca", "cabeca");
VincularAcaoParte("prevBoca", "nextBoca", "boca");
VincularAcaoParte("prevOlhos", "nextOlhos", "olhos");
VincularAcaoParte("prevCabelo", "nextCabelo", "cabelo");

profileEditorAvatarGrid?.addEventListener("scroll", function () {
  if (categoriaAtual !== "criar" && this.scrollTop + this.clientHeight >= this.scrollHeight - 15) {
    renderizarLote();
  }
});

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
    const cat = botao.getAttribute("data-cat");
    carregarCategoria(cat);
  });
});

window.renderProfileAvatarGrid = function () {
  carregarCategoria("eles");
};
//========================================================== DAQUI PRA CIMA ===================================

window.attachmentActions.profile = async () => {
  const user = auth.currentUser;
  if (!user) return;

  await window.openMainProfilePanel(user.uid);
};

//======================= adicionando 06-06-26 ========================
//======================= VALIDAÇÃO EVOLUÍDA EM TEMPO REAL E ALERTA SEQUENCIAL ========================
function perfilEstaCompleto() {
  const nome = editName?.value.trim();
  const cidade = editCity?.value.trim();
  const recado = editMood?.value.trim();
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

  const completo = !!(
    nome &&
    cidade &&
    recado &&
    idade &&
    genero &&
    avatarValido &&
    bannerValido
  );

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
  [editName, editAge, editMood].forEach(input => {
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

// 06-06-26  APLICA AS MUDANÇAS DE AVATAR E BANNER NO PAINEL DE EDIÇÃO ANTES DE SALVAR, PARA MELHOR VISUALIZAÇÃO DO USUÁRIO
saveProfileEditorBtn?.addEventListener("click", async () => {
  const user = auth.currentUser;
  if (!user) return;
  if (!currentProfileIsOwner || currentViewedProfileId !== user.uid) return;

  if (profileCover) {
    profileCover.style.background = selectedBannerColor;
  }
  if (profileAvatar) {
    profileAvatar.src = selectedProfileAvatar;
  }

  showToast("Alteração aplicada! Lembre-se de clicar em Salvar para gravar o perfil.");
});


// 14-07-2026
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

  if (!editMood.value.trim()) {
    showToast("Por favor, preencha o seu Recado (Frase Favorita).");
    return;
  }

  try {
    showToast("Salvando alterações...");

    let linkFotoFinal = selectedProfileAvatar;

    // SE HOUVER UMA FOTO DE PRÉVIA NA MEMÓRIA, FAZEMOS O UPLOAD AGORA!
    // SE HOUVER UMA FOTO DE PRÉVIA NA MEMÓRIA, FAZEMOS O UPLOAD AGORA!
    if (window.blobFotoTemporaria) {
      showToast("Enviando foto ao servidor...");
      const storage = getStorage();
      const fotoRef = sRef(storage, `profile_foto/${user.uid}.jpg`);

      await uploadBytes(fotoRef, window.blobFotoTemporaria);
      linkFotoFinal = await getDownloadURL(fotoRef);

      // Limpa a memória temporária após o sucesso do upload
      window.blobFotoTemporaria = null;
    }

    // Grava todas as alterações juntas de uma vez só no Firestore
// Higieniza a entrada do usuário caso tenha digitado o '@'
// 21-07-26  Tratamento do usuário do Instagram (remover espaços, @ e caracteres inválidos)

// ================= DECLARAÇÃO E TRATAMENTO DO INSTAGRAM =================
// ================= TRATAMENTO DO INSTAGRAM E TELEGRAM AO SALVAR =================
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

    // Grava todas as alterações juntas de uma vez só no Firestore
    await updateDoc(refUser, {
      nome: editName.value.trim(),
      cidade: cidadeSelecionada,
      mood: editMood.value.trim(),
      idade: editAge.value.trim(),
      genero: generoSelecionado,
      instagram: instaUser,
      telegram: teleUser,
      foto: linkFotoFinal,
      bannerColor: selectedBannerColor,
      perfilCompleto: true,
      lastProfileEditAt: Date.now()
    });

    if (!linkFotoFinal.startsWith("data:image")) {
      await updateProfile(user, { photoURL: linkFotoFinal });
    }

    // Atualiza a presença online com o novo link de foto definitivo
    const userStatusRef = ref(rtdb, "status/" + user.uid);
    await set(userStatusRef, {
      uid: user.uid,
      name: editName.value.trim() || "Usuário",
      avatar: linkFotoFinal || "./img/avatar.png",
      online: true,
      sala: appState.currentRoom || sala,
      lastChanged: Date.now()
    });

    showToast("Perfil salvo e atualizado com sucesso!");
    document.getElementById("profileEditTooltip")?.classList.remove("show");

    window.attachmentActions.profile();

  } catch (err) {
    console.error(err);
    showToast("Erro ao salvar perfil");
  }
});



// ---------------- DRAG MOBILE / DESKTOP ----------------
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

function onProfileDragStart(e) {
  if (document.body.classList.contains("index-page")) return;//10-05-26
  // 01-05-26  impede o painel de tentar fechar quando o usuário estiver rolando o conteúdo/formulário
  if (
    e.target.closest(".profile-content") ||
    e.target.closest("#profileEdit") ||
    e.target.closest("#profileInfo") ||
    e.target.closest(".profile-field") ||
    e.target.closest("input") ||
    e.target.closest("button")
  ) {
    return;
  }

  // 01-05-26 edita o toque do mobile dentro da lista de cidade
  if (
    e.target.closest(".city-dropdown-profile") ||
    e.target.closest(".gender-dropdown-profile")
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

  if (nextTranslate < 0) {
    nextTranslate = 0;
  }

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

// ================== DETECTAR VERIFICAÇÃO DE EMAIL ==================
// DESATIVADO: estava deslogando usuários verificados ao atualizar a página.
// A verificação de e-mail deve acontecer apenas no fluxo de cadastro/login,
// não toda vez que o site carregar.



// ================== ANIMAÇÃO DAS FOTOS 28-04-2026  ==================
const heroAnimation = document.getElementById("heroAnimation");

const images = [
  "img/1.png",
  "img/2.png",
  "img/3.png",
  "img/4.png",
  "img/5.png",
  "img/6.png",
  "img/7.png",
  "img/8.png",
  "img/9.png",
  "img/10.png",
  "img/11.png",
  "img/12.png",

];


let imageIndex = 0;

function createImg() {
  const img = document.createElement("img");

  img.src = images[imageIndex];

  imageIndex++;
  if (imageIndex >= images.length) {
    imageIndex = 0;
  }

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
  if (heroAnimation) {
    createPhotoGrid();
  }
});

// ================= RENDERIZADOR DE EMOJIS LOTTIE (CHAT-DF UX) =================
window.renderizarEmojiLottie = function (containerId, caminhoJson) {
  if (typeof lottie === "undefined") {
    console.warn("Biblioteca Lottie não carregada no HTML.");
    return;
  }

  lottie.loadAnimation({
    container: document.getElementById(containerId),
    renderer: 'svg', // Mantém o vetor nítido em qualquer tela mobile/desktop
    loop: true,
    autoplay: true,
    path: caminhoJson
  });
};
// ========================== 13-07-26 PRÉVIA LOCAL DA FOTO DE PERFIL (COMPRESSÃO) ==========================
// Variável global temporária para guardar o arquivo que o usuário escolheu antes dele salvar definitivamente
// ========================== 14-07-26 ENGINE DE CORTE E ZOOM DO ZERO NATIVO ==========================


// ========================== 14-07-26 ENGINE DE CORTE E ZOOM DO ZERO NATIVO (CORRIGIDO) ==========================
// DEIXE APENAS ESTA NO ESCOPO GLOBAL DO ARQUIVO (FORA DE QUALQUER FUNCTION OU DOMCONTENTLOADED)
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


  // 15-07-2026 Sincroniza cirurgicamente com a trava global de tempo do perfil
  cameraBtnLabel?.addEventListener("click", (e) => {
    e.preventDefault();


    if (isProfileEditLocked) {
      showToast(`Você poderá editar novamente em ${profileEditRemainingDays} dia(s).`);
      return;
    }

    cropModal?.classList.remove("hidden");
  });

  // Função para limpar apenas o visual do visor ao fechar no X
  const resetarVisorVisual = () => {
    if (cropPreviewImg) {
      cropPreviewImg.src = "";
      cropPreviewImg.style.display = "none";
    }
    if (cropInputFile) {
      cropInputFile.value = "";
    }
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


  // Variáveis extras para o cálculo matemático de dois dedos (Zoom por Toque)
  let distanciaPinchInicial = 0;
  let zoomPinchInicial = 1;

  const iniciarArrasto = (e) => {
    estaArrastando = true;

    // FLUXO DE 2 DEDOS: Zoom por toque (Pinch)
    if (e.touches && e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      distanciaPinchInicial = Math.sqrt(dx * dx + dy * dy);
      zoomPinchInicial = zoomAtual;
      return;
    }

    // FLUXO DE 1 DEDO / MOUSE: Arraste normal de posicionamento
    const clienteX = e.touches ? e.touches[0].clientX : e.clientX;
    const clienteY = e.touches ? e.touches[0].clientY : e.clientY;
    startX = clienteX - imgX;
    startY = clienteY - imgY;
  };

  const moverArrasto = (e) => {
    if (!estaArrastando) return;

    if (e.touches) {
      e.preventDefault(); // Impede a rolagem padrão da página no mobile

      // SE ESTIVER COM 2 DEDOS NA TELA: Calcula o Zoom Dinâmico
      if (e.touches.length === 2 && distanciaPinchInicial > 0) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const distanciaAtual = Math.sqrt(dx * dx + dy * dy);

        const proporcaoMapeamento = distanciaAtual / distanciaPinchInicial;
        let novoZoom = zoomPinchInicial * proporcaoMapeamento;

        // Limita o zoom entre o mínimo (0.2) e o máximo (3)
        zoomAtual = Math.max(0.2, Math.min(3, novoZoom));

        if (cropZoomSlider) {
          cropZoomSlider.value = zoomAtual;
        }

        atualizarTransformacaoImagem();
        return;
      }
    }

    // SE ESTIVER COM 1 DEDO OU MOUSE: Arraste normal de posicionamento
    if (e.touches && e.touches.length > 1) return;
    const clienteX = e.touches ? e.touches[0].clientX : e.clientX;
    const clienteY = e.touches ? e.touches[0].clientY : e.clientY;
    imgX = clienteX - startX;
    imgY = clienteY - startY;
    atualizarTransformacaoImagem();
  };

  const finalizarArrasto = (e) => {
    estaArrastando = false;
    distanciaPinchInicial = 0;
  };

  // Cadastro estável das escutas sem travas passivas
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

  // O RECORTE DO CANVAS COM MATEMÁTICA CORRIGIDA (CENTRALIZAÇÃO PREMIUM)
  btnSaveCropPhoto?.addEventListener("click", () => {
    if (!cropPreviewImg || !cropPreviewImg.src) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 150;
    canvas.height = 150;

    // Obtém o fator real de escala entre os pixels naturais da foto e a renderização na tela
    const escalaExibicao = imgLarguraOriginal / cropPreviewImg.naturalWidth;
    const fatorZoomReal = zoomAtual * escalaExibicao;

    // Visor central quadrado tem 280x280. O círculo centralizado de corte tem 200x200.
    // Portanto, a margem de recuo do topo esquerdo do círculo até a borda do visor é exatamente 40px ( (280 - 200) / 2 ).
    const margemCorteVisor = 40;

    // Cálculo absoluto corrigindo o deslocamento central e o alinhamento flex da tag img
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

      // Vincula diretamente à propriedade global visível por todo o arquivo main.js
      window.blobFotoTemporaria = blob;

      const urlPreview = URL.createObjectURL(blob);
      selectedProfileAvatar = urlPreview;

      const profileAvatarEl = document.getElementById("profileAvatar");
      if (profileAvatarEl) {
        profileAvatarEl.src = urlPreview;
      }

      if (typeof perfilEstaCompleto === "function") {
        perfilEstaCompleto();
      }

      resetarVisorVisual();
      cropModal?.classList.add("hidden");
      showToast("Foto recortada! Clique em Salvar abaixo para concluir.");

    }, "image/jpeg", 0.85);
  });
});



//=============== 18-07-26  NOVO SELETOR DE CIDADE E GÊNERO ESTILIZADO  DENTRO DO BOTAO VIP =====================
// CORREÇÃO DOS DROPDOWNS VIP (EXPANDIR PARA BAIXO E PEGAR TODOS OS BOTÕES)
//=============== SELETOR VIP: MANTÉM LISTA ABERTA PARA TESTAR EFEITOS =====================
document.querySelectorAll('.vip-custom-dropdown').forEach(dropdown => {
  const wrapper = dropdown.parentElement;
  const btn = wrapper.querySelector('.vip-custom-select-btn');
  const selectNativo = wrapper.querySelector('select');

  if (btn && selectNativo) {
    // Clique no botão marcado de vermelho: ABRE E FECHA a lista
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Fecha outros dropdowns se houver mais de um
      document.querySelectorAll('.vip-custom-dropdown').forEach(d => {
        if (d !== dropdown) d.classList.add('hidden');
      });

      // Alterna abrir/fechar ao clicar no botão
      dropdown.classList.toggle('hidden');
    });

    // Clique na opção de degradê/efeito: APLICA O EFEITO E MANTÉM A LISTA ABERTA
    dropdown.querySelectorAll('.vip-dropdown-option').forEach(option => {
      option.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation(); // Impede o clique de fechar a lista

        const val = option.getAttribute('data-value');

        // Atualiza o select nativo oculto e dispara o preview em tempo real
       // Atualiza o select nativo oculto e dispara o preview em tempo real
        selectNativo.value = val;
        selectNativo.dispatchEvent(new Event('change'));
        if (typeof window.atualizarSimulacaoTopoVip === "function") {
          window.atualizarSimulacaoTopoVip();
        }
        // Atualiza o texto do botão
        btn.textContent = option.textContent;

        // Marca a opção selecionada como ativa
        dropdown.querySelectorAll('.vip-dropdown-option').forEach(o => o.classList.remove('active'));
        option.classList.add('active');

        // A lista NÃO é fechada aqui, permitindo testar múltiplos efeitos continuamente!
      });
    });
  }
});

// Ao clicar nos botões do topo (Troca de aba VIP), fecha as listas de efeitos
document.querySelectorAll('.vip-btn-card').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.vip-custom-dropdown').forEach(d => d.classList.add('hidden'));
  });
});

// ================================================================  27-07-26
// CONTROLE DO MODAL DE BANNER VIP + BUSCADOR MULTI-PLATAFORMA (GIPHY / PEXELS / PIXABAY)
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  const vipHeaderBtn = document.getElementById("vipHeaderActionBtn");
  const bannerModal = document.getElementById("vipBannerModal");
  const closeBannerModal = document.getElementById("closeVipBannerModal");
  const urlInput = document.getElementById("vipBannerUrlInput");
  const previewBox = document.getElementById("vipBannerPreviewBox");
  const saveBannerBtn = document.getElementById("btnSaveVipBannerUrl");

  // Elementos do Buscador
  const mediaInput = document.getElementById("giphySearchInput");
  const btnSearchMedia = document.getElementById("btnSearchGiphy");
  const mediaGrid = document.getElementById("giphyResultsGrid");
  const attributionLabel = document.getElementById("mediaAttributionLabel");
  const mediaTabBtns = document.querySelectorAll(".media-tab-btn");

  // CHAVES DE API
  const GIPHY_API_KEY = "bmd1luYYvD3dGiycldIl3W1bUovionrR"; 
  const PIXABAY_API_KEY = "56897614-e2f814aca2c37034dcc515af2"; // Chave Pixabay
  const PEXELS_API_KEY = "4MoHwhHC16imBbdA7sGO13i5HDbAQtfNDcQGNsNZ3LWuHpB1sExnbNHH"; // Chave Pexels

  // Variáveis de Estado
  let currentSource = "giphy"; // giphy, pexels, pixabay
  let currentQuery = "";
  let currentPage = 1;
  let currentOffset = 0;
  const LIMIT_PER_PAGE = 18;// quantidade de gif e imagem aparece primeiro 
  let isLoadingMedia = false;
  let hasMoreMedia = true;

  // Troca de Plataforma
  mediaTabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      mediaTabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentSource = btn.dataset.source;

      if (attributionLabel) {
        if (currentSource === "giphy") attributionLabel.textContent = "GIPHY";
        if (currentSource === "pexels") attributionLabel.textContent = "Pexels";
        if (currentSource === "pixabay") attributionLabel.textContent = "Pixabay";
      }

      if (currentQuery) {
        fetchMedia(true);
      }
    });
  });

  // Função para buscar no GIPHY
  const fetchGiphy = async (isNewSearch) => {
    const response = await fetch(`https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(currentQuery)}&limit=${LIMIT_PER_PAGE}&offset=${currentOffset}&api_key=${GIPHY_API_KEY}`);
    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      if (isNewSearch && mediaGrid) mediaGrid.innerHTML = `<span class="small text-muted p-2 w-100 text-center d-block">Nenhum GIF encontrado.</span>`;
      hasMoreMedia = false;
      return;
    }

    data.data.forEach(item => {
      const fullUrl = item.images.original.url;
      const thumbUrl = item.images.fixed_height_small.url;
      renderImageItem(thumbUrl, fullUrl);
    });

    currentOffset += data.data.length;
    if (data.data.length < LIMIT_PER_PAGE) hasMoreMedia = false;
  };

  // Função para buscar no Pexels
  const fetchPexels = async (isNewSearch) => {
    const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(currentQuery)}&per_page=${LIMIT_PER_PAGE}&page=${currentPage}`, {
      headers: { Authorization: PEXELS_API_KEY }
    });
    const data = await response.json();

    if (!data.photos || data.photos.length === 0) {
      if (isNewSearch && mediaGrid) mediaGrid.innerHTML = `<span class="small text-muted p-2 w-100 text-center d-block">Nenhuma foto encontrada.</span>`;
      hasMoreMedia = false;
      return;
    }

    data.photos.forEach(photo => {
      const fullUrl = photo.src.large;
      const thumbUrl = photo.src.tiny;
      renderImageItem(thumbUrl, fullUrl);
    });

    currentPage++;
    if (data.photos.length < LIMIT_PER_PAGE) hasMoreMedia = false;
  };

  // Função para buscar no Pixabay
  const fetchPixabay = async (isNewSearch) => {
    const response = await fetch(`https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(currentQuery)}&image_type=photo&per_page=${LIMIT_PER_PAGE}&page=${currentPage}`);
    const data = await response.json();

    if (!data.hits || data.hits.length === 0) {
      if (isNewSearch && mediaGrid) mediaGrid.innerHTML = `<span class="small text-muted p-2 w-100 text-center d-block">Nenhuma foto encontrada.</span>`;
      hasMoreMedia = false;
      return;
    }

    data.hits.forEach(hit => {
      const fullUrl = hit.largeImageURL;
      const thumbUrl = hit.previewURL;
      renderImageItem(thumbUrl, fullUrl);
    });

    currentPage++;
    if (data.hits.length < LIMIT_PER_PAGE) hasMoreMedia = false;
  };


// Renderiza a foto/GIF na grade com evento de clique banner
const renderImageItem = (thumbUrl, fullUrl) => {
    const img = document.createElement("img");
    img.src = thumbUrl;
    img.alt = "Mídia";
    img.addEventListener("click", () => {
      if (urlInput) urlInput.value = fullUrl;
      // Atualiza a prévia do quadro no topo do modal VIP
      if (previewBox) {
        previewBox.style.backgroundImage = `url("${fullUrl}")`;
      }
    });
    mediaGrid?.appendChild(img);
  };

  // Motor Central de Busca
  const fetchMedia = async (isNewSearch = false) => {
    if (isLoadingMedia) return;
    if (!currentQuery) return;

    if (isNewSearch) {
      currentOffset = 0;
      currentPage = 1;
      hasMoreMedia = true;
      if (mediaGrid) {
        mediaGrid.innerHTML = `<span class="small text-muted p-2 w-100 text-center d-block">Carregando...</span>`;
        mediaGrid.classList.remove("hidden");
      }
    }

    if (!hasMoreMedia) return;
    isLoadingMedia = true;

    try {
      if (isNewSearch && mediaGrid) mediaGrid.innerHTML = "";

      if (currentSource === "giphy") await fetchGiphy(isNewSearch);
      else if (currentSource === "pexels") await fetchPexels(isNewSearch);
      else if (currentSource === "pixabay") await fetchPixabay(isNewSearch);

    } catch (err) {
      console.error("Erro na busca de mídias:", err);
      if (isNewSearch && mediaGrid) {
        mediaGrid.innerHTML = `<span class="small text-danger p-2 w-100 text-center d-block">Erro ao carregar resultados.</span>`;
      }
    } finally {
      isLoadingMedia = false;
    }
  };

  // Dispara Busca
  const dispararNovaBusca = () => {
    const termo = mediaInput?.value.trim() || "";
    if (!termo) return;
    currentQuery = termo;
    fetchMedia(true);
  };

  btnSearchMedia?.addEventListener("click", dispararNovaBusca);

  mediaInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      dispararNovaBusca();
    }
  });

  // Rolagem Infinita para carregar mais itens
  mediaGrid?.addEventListener("scroll", () => {
    if (!mediaGrid || isLoadingMedia || !hasMoreMedia) return;
    if (mediaGrid.scrollTop + mediaGrid.clientHeight >= mediaGrid.scrollHeight - 30) {
      fetchMedia(false);
    }
  });

  // ABRIR O MODAL AO CLICAR NO BOTÃO DA FOTO NO TOPO DA ABA VIP
  vipHeaderBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentProfileIsOwner) return;

    const data = window.__currentProfileData || {};
    const linkAtual = data.vipBannerUrl || "";

    if (urlInput) urlInput.value = linkAtual;
    if (previewBox) {
      previewBox.style.backgroundImage = linkAtual ? `url("${linkAtual}")` : "none";
    }

    if (mediaGrid) {
      mediaGrid.innerHTML = "";
      mediaGrid.classList.add("hidden");
    }
    if (mediaInput) mediaInput.value = "";

    currentQuery = "";
    currentOffset = 0;
    currentPage = 1;
    hasMoreMedia = true;

    bannerModal?.classList.remove("hidden");
  });

  // FECHAR O MODAL NO X
  closeBannerModal?.addEventListener("click", () => {
    bannerModal?.classList.add("hidden");
  });

  // PRÉVIA EM TEMPO REAL AO DIGITAR/COLAR LINK MANUAMENTE
// PRÉVIA EM TEMPO REAL APENAS NO QUADRO INTERNO DO MODAL
  // PRÉVIA EM TEMPO REAL NO QUADRO SUPERIOR DO MODAL VIP
  urlInput?.addEventListener("input", () => {
    const val = urlInput.value.trim();
    if (previewBox) {
      previewBox.style.backgroundImage = val ? `url("${val}")` : "none";
    }
  });

  // SALVAR NO FIRESTORE
// SALVAR NO FIRESTORE E APLICAR APENAS APÓS A CONFIRMAÇÃO
  saveBannerBtn?.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user || !currentProfileIsOwner) return;

    const newUrl = urlInput?.value.trim() || "";

    try {
      
      const refUser = doc(db, "users", user.uid);

      await updateDoc(refUser, {
        vipBannerUrl: newUrl
      });

      // Aplica a alteração no perfil visível somente após a gravação confirmada
      const profileCoverEl = document.querySelector(".profile-cover");
      if (profileCoverEl) {
        if (newUrl) {
          profileCoverEl.style.background = `url("${newUrl}") center/cover no-repeat`;
        } else {
          profileCoverEl.style.background = selectedBannerColor || "#00000063";
        }
      }

      bannerModal?.classList.add("hidden");
      showToast("atualizado com sucesso!");
    } catch (err) {
      console.error("Erro ao salvar Banner VIP:", err);
      showToast("Erro ao salvar o Banner VIP.");
    }
  });
});