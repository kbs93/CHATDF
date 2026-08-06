// ============================== IMPORTS ======================================================

import { auth, db, rtdb } from "./firebase-config.js";
import { showToast } from "./ui.js";
import {
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

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
  membroDesde: user.membroDesde || null
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

  item.innerHTML = `
    <div class="avatar-wrapper">
      <img src="${avatar}" alt="" onerror="this.src='./img/avatar.png'">
      <span class="status-dot"></span>
    </div>
    <span style="font-weight: 600; color: #000000; font-size: 16px; line-height: 1.5;">${name}</span>
  `;
  // 01-07-26  Adicionando evento de clique para abrir o painel de perfil do usuário
item.addEventListener("click", () => {
    if (!user.uid) return;

    if (!auth.currentUser) {
      showToast("Faça login no site");
      const modal = document.getElementById("loginModal");
      if (modal) modal.classList.remove("hidden");
      return;
    }

    if (typeof window.openMainProfilePanel === "function") {
      // 01-07-26  Exibe o botão DENUNCIA DENTRO DO PAINEL USUARIO NO CHAT APARECE apenas se o perfil aberto não for o do próprio usuário logado
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
  const TOLERANCIA_OFFLINE_MS = 0; // 10 segundos de margem

  onValue(statusRef, (snapshot) => {
    if (!onlineUsersList) return;

    const data = snapshot.val();
    const agora = Date.now();

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

    // Mantém o usuário visualmente online se ele esteve ativo nos últimos segundos,
    // evitando que uma queda momentânea remova a bolinha verde da tela de imediato.
    const users = Object.entries(data)
      .map(([uid, user]) => {
        if (!user || typeof user !== "object") return null;
        return { uid, ...user };
      })
      .filter(user => {
        if (!user || !user.uid) return false;
        
        const isOnline = user.online === true || user.online === "true";
        const recente = user.lastChanged && (agora - user.lastChanged < TOLERANCIA_OFFLINE_MS);

        return isOnline || recente;
      });

    renderOnlineUsers(onlineUsersList, onlineCount, users);
    saveOnlineUsersCache(users);

    if (!window.__onlineFirstPaintDone) {
      window.dispatchEvent(new CustomEvent("chatdf:first-online-render"));
      window.__onlineFirstPaintDone = true;
    }
  });
}


// --- 01-07-26  CONTROLE DE EVENTOS DO MODAL DE DENÚNCIA dentro do painel do Usuário ---
// --- 01-07-26 CONTROLE DINÂMICO DO MODAL DE DENÚNCIA (CHAT-DF UX) ---
  const closeReportX = document.getElementById("closeReportModalX");
  const cancelReportBtn = document.getElementById("cancelReportBtn");
  const submitReportBtn = document.getElementById("submitReportBtn");
  const reportReasonSelect = document.getElementById("reportReasonSelect");

  const fecharDenuncia = () => {
    const userModal = document.getElementById("reportUserModal");
    if (userModal) userModal.style.display = "none";
  };

  // Escuta delegada mapeando o ID correto para não conflitar com o modal de mensagens
// Escuta delegada inteligente: captura o UID do perfil ativo na tela ao clicar na bandeira

// 07-07-26 E 10-07-2026   Escuta delegada estável: Garante que o UID correto seja passado ao clicar na bandeira do painel
// Escuta de denúncia sincronizada direto com o nó de presença do Firebase

document.addEventListener("click", async (e) => {
    const reportUserBtn = e.target.closest("#reportUserBtn");
    const contextReportBtn = e.target.closest("#contextReportBtn");
    
    // Intercepta a ação se qualquer um dos dois botões de denúncia for clicado
    if (reportUserBtn || contextReportBtn) {
      const userModal = document.getElementById("reportUserModal");
      
      if (!auth.currentUser) {
        showToast("Você precisa estar logado para denunciar.");
        return;
      }

      // Se clicou no mini menu, pega o UID associado à mensagem; se foi no perfil, pega o UID do perfil aberto
      const menuContexto = document.getElementById("messageContextMenu");
      const targetUid = contextReportBtn ? menuContexto?.dataset.uid : window.appState?.currentViewedProfileId;

      if (!targetUid) {
        showToast("Erro ao identificar o usuário.");
        return;
      }

      try {
        const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");
        const perfilRef = doc(db, "users", auth.currentUser.uid);
        const perfilSnap = await getDoc(perfilRef);
        
        if (perfilSnap.exists()) {
          const dadosPerfil = perfilSnap.data();
          const tempoLiberacao = dadosPerfil.travaDenunciaAtiva || 0;
          const ultimoDenunciado = dadosPerfil.ultimoUsuarioDenunciado || "";

          if (Date.now() < tempoLiberacao) {
            // Ofusca os dois elementos visualmente mantendo o comportamento de clique ativo
            if (document.getElementById("reportUserBtn")) document.getElementById("reportUserBtn").style.opacity = "0.5";
            if (document.getElementById("contextReportBtn")) document.getElementById("contextReportBtn").style.opacity = "0.5";
            
            if (targetUid === ultimoDenunciado) {
              showToast("Você já denunciou esse usuário");
            } else {
              showToast("aguarde um instante");
            }
            return;
          } else {
            if (document.getElementById("reportUserBtn")) document.getElementById("reportUserBtn").style.opacity = "1";
            if (document.getElementById("contextReportBtn")) document.getElementById("contextReportBtn").style.opacity = "1";
          }
        }
      } catch (err) {
        console.error("Erro ao processar trava unificada:", err);
      }

      // Sincroniza o UID correto no botão oculto de envio para a gravação no banco funcionar
      const mainReportBtn = document.getElementById("reportUserBtn");
      if (mainReportBtn) {
        mainReportBtn.setAttribute("data-target-uid", targetUid);
      }

      if (userModal) {
        if (reportReasonSelect) reportReasonSelect.value = ""; 
        userModal.style.display = "flex";
      }
    }
  });


  closeReportX?.addEventListener("click", fecharDenuncia);
  cancelReportBtn?.addEventListener("click", fecharDenuncia);



  submitReportBtn?.addEventListener("click", async () => {
    const reportUserBtn = document.getElementById("reportUserBtn");
    const targetUid = reportUserBtn?.getAttribute("data-target-uid");
    const reporterEmail = reportUserBtn?.getAttribute("data-reporter-email") || auth.currentUser?.email || "Sem Email"; // Email de quem denuncia
    const motivo = reportReasonSelect?.value;

    // 1. 07-07-26 
    // Trava Inteligente UX: Se o usuário já estourou o limite de 2 denúncias neste login
showToast("Usuário denunciado.");

      // Mantém o botão totalmente normal e clicável para que o próximo clique chame o Toast de bloqueio
      if (reportUserBtn) {
        reportUserBtn.style.opacity = "1";
        reportUserBtn.style.pointerEvents = "auto";
        reportUserBtn.removeAttribute("disabled");
      }

      fecharDenuncia();

    if (!auth.currentUser) {
      showToast("Você precisa estar logado para denunciar.");
      return;
    }

    if (!motivo) {
      showToast("Por favor, selecione um motivo para a denúncia.");
      return;
    }

    if (!targetUid) {
      showToast("Erro ao identificar o usuário denunciado.");
      return;
    }

    try {
      // Importações dinâmicas do Firestore para manter o arquivo limpo
      const { 
        doc, 
        setDoc, 
        getDoc,
        serverTimestamp 
      } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");

      // Coleta dados de quem está denunciando para ficar registrado
      const reporterProfileRef = doc(db, "users", auth.currentUser.uid);
      const reporterSnap = await getDoc(reporterProfileRef);
      const reporterData = reporterSnap.exists() ? reporterSnap.data() : {};
      const reporterName = reporterData.nome || auth.currentUser.displayName || "Usuário";

      // Coleta os dados básicos de quem está SENDO denunciado
      const targetProfileRef = doc(db, "users", targetUid);
      const targetSnap = await getDoc(targetProfileRef);
      const targetData = targetSnap.exists() ? targetSnap.data() : {};
      const targetName = targetData.nome || "Usuário Desconsecido";
      
      // Captura o email de quem está sendo denunciado (caso exista salvo no nó do usuário)
      const reportedEmail = targetData.email || "Sem Email"; 

      // Formatação profissional de ID para a denúncia (ex: Nome_2026-07-04_14-30-00)
      const agora = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const dataId = agora.getFullYear() + "-" + pad(agora.getMonth() + 1) + "-" + pad(agora.getDate()) + "_" + pad(agora.getHours()) + "-" + pad(agora.getMinutes()) + "-" + pad(agora.getSeconds());
      const nomeLimpo = reporterName.trim().replace(/\s+/g, "_").replace(/[^\wÀ-ÿ_-]/g, "");
      const reportId = `user_${nomeLimpo}_${dataId}`;

      // Grava diretamente na coleção "denuncias_usuarios"
      const denunciaRef = doc(db, "denuncias_usuarios", reportId);
      await setDoc(denunciaRef, {
        reportedUid: targetUid,          // UID de quem foi denunciado
        reportedName: targetName,        // Nome de quem foi denunciado
        reportedEmail: reportedEmail,    // Email de quem foi denunciado
        reporterUid: auth.currentUser.uid, // UID de quem denunciou
        reporterName: reporterName,      // Nome de quem denunciou
        reporterEmail: reporterEmail,    // Email de quem denunciou
        reason: motivo,                  // Motivo selecionado no select
        createdAt: serverTimestamp()     // Carimbo de data do servidor
      });



// 10-07-26 TEMPO DO BOTAO DE DENUNCIA Calcula exatamente 2 minutos no futuro baseado no relógio atual (2 * 60 * 1000 ms)
const tempoLimiteMs = 2 * 60 * 1000; 
      const horarioLiberacao = Date.now() + tempoLimiteMs;

      try {
        const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");
        const perfilRef = doc(db, "users", auth.currentUser.uid);
        
        // Salva o tempo futuro e armazena de forma fixa QUAL usuário foi o alvo da denúncia
        await updateDoc(perfilRef, { 
          travaDenunciaAtiva: horarioLiberacao,
          ultimoUsuarioDenunciado: targetUid
        });
      } catch (eRef) {
        console.error("Erro ao injetar timestamp no perfil:", eRef);
      }

      showToast("Usuário denunciado.");

      // Deixa o botão imediatamente ofuscado (opacity 0.5), mas 100% ativo para capturar os próximos cliques
      if (reportUserBtn) {
        reportUserBtn.style.opacity = "0.5";
        reportUserBtn.style.pointerEvents = "auto";
        reportUserBtn.removeAttribute("disabled");
      }

      const contextReportBtn = document.getElementById("contextReportBtn");
      if (contextReportBtn) {
        contextReportBtn.style.opacity = "0.5";
      }

      fecharDenuncia();



    } catch (err) {
      console.error("Erro ao salvar denúncia no Firebase:", err);
      showToast("Erro ao enviar denúncia. Tente novamente.");
    }
  });