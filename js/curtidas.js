// ========================================================================= 
// MÓDULO DE CURTIDAS E TAGS DE GOSTOS & HOBBIES DO DF (CHAT-DF)
// Arquitetura de Alta Escala: Contador Agregado + Trava de Like Único
// =========================================================================
import { auth, db } from "./firebase-config.js";
import { showToast } from "./ui.js";
import {
  serverTimestamp,
  setDoc,
  doc,
  getDoc,
  deleteDoc,
  increment,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// Lista base dos Interesses do DF
export const LISTA_INTERESSES_DF = [
   { id: "parquedacidade", nome: "ParqueDaCidade" },
  { id: "pontao", nome: "Pontão" },
  { id: "eixao", nome: "Eixão" },
  { id: "feirasdf", nome: "FeirasDF" },
   { id: "lagoparanoa", nome: "LagoParanoa" },
   { id: "shopping", nome: "Shopping" },
   { id: "feiradorolo", nome: "FeiraDoRolo" },
  { id: "sertanejo", nome: "Sertanejo" },
  { id: "rock", nome: "Rock" },
  { id: "mpb", nome: "MPB" },
   { id: "funk", nome: "Funk" },
   { id: "raptrap", nome: "RapTrap" },
   { id: "hiphop", nome: "HipHop" },
   { id: "flashback", nome: "FlashBack" },
   { id: "pagode", nome: "Pagode" },
   { id: "samba", nome: "Samba" },
   { id: "gospel", nome: "Gospel" },
   { id: "reggae", nome: "Reggae" },
   { id: "forro", nome: "Forró" },
   { id: "axe", nome: "Axe" },
   { id: "jazzblues", nome: "JazzBlues" },
   { id: "classicas", nome: "Classicas" },
   { id: "pop", nome: "Pop" },
  { id: "eletronica", nome: "Eletrônica" },
  { id: "roles", nome: "Roles" },
   { id: "cinema", nome: "Cinema" },
  { id: "concurseiro", nome: "Concurseiro(a)" },
  { id: "futebol", nome: "Futebol" },
  { id: "gamers", nome: "Gamers" },
  { id: "cafe", nome: "Café" },
  { id: "pets", nome: "Pets" },
  { id: "natureza", nome: "Natureza" },
   { id: "trilhas", nome: "Trilhas" },
   { id: "pesca", nome: "Pescaria" },
   { id: "cristao", nome: "Cristão" },
   { id: "evangelico", nome: "Evangelico" },
   { id: "ateu", nome: "Ateu" },
   { id: "memes", nome: "Memes" },
  
];

export let selectedInterests = [];
export function setSelectedInterests(novosInteresses) {
  selectedInterests = Array.isArray(novosInteresses) ? [...novosInteresses] : [];
}

let unsubscribeTotalsListener = null;
let unsubscribeUserLikesListener = [];

// Renderiza as tags na aba Info com apenas 1 leitura de documento de resumo
// Renderiza as tags na aba Info com normalização automática para perfis antigos e novos
export function renderProfileInterests(userInterests = [], targetUid, isOwner) {
  const container = document.getElementById("profileInterestsList");
  if (!container) return;

  // Limpa ouvintes anteriores
  if (unsubscribeTotalsListener) {
    unsubscribeTotalsListener();
    unsubscribeTotalsListener = null;
  }
  if (unsubscribeUserLikesListener.length > 0) {
    unsubscribeUserLikesListener.forEach(unsub => unsub());
    unsubscribeUserLikesListener = [];
  }

  container.innerHTML = "";

  if (!userInterests || userInterests.length === 0) {
    container.innerHTML = `<span class="text-muted small">Nenhum interesse selecionado.</span>`;
    return;
  }

  const currentUserId = auth.currentUser?.uid || window.appState?.currentUser?.uid || null;

  // Normalização: garante que tagId seja SEMPRE string limpa
  const sanitizedInterests = userInterests.map(item => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object" && item.id) return item.id;
    return String(item);
  }).filter(Boolean);

  // 1. Cria os botões das tags no DOM
  sanitizedInterests.forEach(tagId => {
    const meta = LISTA_INTERESSES_DF.find(i => i.id === tagId) || {
      id: tagId,
      nome: tagId,
      icone: "#"
    };

const pill = document.createElement("button");
    pill.type = "button";
    pill.id = `pill-interest-${tagId}`;
    pill.className = `interest-pill ${isOwner ? "owner-view" : ""}`;
 pill.innerHTML = `
      <span>${meta.nome}</span>
      ${!isOwner ? '<i class="bi bi-heart interest-like-icon"></i>' : ''}
      <span class="interest-like-badge">0</span>
    `;

    // 2. Trava de Like Único para o visitante
    if (!isOwner && currentUserId) {
      const myLikeDocRef = doc(db, "curtidas_tags", `${targetUid}_${tagId}_${currentUserId}`);
      const unsubLike = onSnapshot(myLikeDocRef, (snap) => {
        const isLiked = snap.exists();
        const icon = pill.querySelector(".interest-like-icon");
        if (icon) {
          icon.className = `bi ${isLiked ? "bi-heart-fill" : "bi-heart"} interest-like-icon`;
        }
        pill.classList.toggle("liked", isLiked);
      });
      unsubscribeUserLikesListener.push(unsubLike);

      pill.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();

        const loggedUid = auth.currentUser?.uid || window.appState?.currentUser?.uid;
        if (!loggedUid) {
          if (typeof showToast === "function") showToast("Faça login para curtir os interesses.");
          return;
        }

        await toggleInterestLike(targetUid, tagId);
      });
    }

    container.appendChild(pill);
  });

  // 3. Ouvinte dos totais agregados
// 3. Ouvinte dos totais agregados
  const totalsDocRef = doc(db, "totais_tags", targetUid);
  unsubscribeTotalsListener = onSnapshot(totalsDocRef, (snap) => {
    const totalsData = snap.exists() ? snap.data() : {};

    // Normaliza todas as chaves do banco para minúsculas
    const normalizedTotals = {};
    Object.keys(totalsData).forEach(k => {
      normalizedTotals[k.toLowerCase()] = totalsData[k];
    });

    sanitizedInterests.forEach(tagId => {
      const cleanId = String(tagId).toLowerCase();
      const pill = document.getElementById(`pill-interest-${tagId}`);
      if (pill) {
        const badge = pill.querySelector(".interest-like-badge");
        const rawCount = normalizedTotals[cleanId] ?? totalsData[tagId] ?? 0;
        const count = typeof rawCount === "number" ? rawCount : (parseInt(rawCount, 10) || 0);
        if (badge) badge.textContent = Math.max(0, count);
      }
    });
  });
}

// Alterna o like usando atomic increment (+1 / -1)
// Alterna o like com atualização instantânea na interface e persistência atômica
export async function toggleInterestLike(targetUid, tagId) {
  const currentUserId = auth.currentUser?.uid || window.appState?.currentUser?.uid;
  if (!currentUserId || !targetUid) return;

  const pill = document.getElementById(`pill-interest-${tagId}`);
  const badge = pill?.querySelector(".interest-like-badge");
  const icon = pill?.querySelector(".interest-like-icon");

  // Leitura visual imediata da tela
  let currentCount = badge ? (parseInt(badge.textContent, 10) || 0) : 0;
  const isCurrentlyLiked = pill?.classList.contains("liked");

  // --- ATUALIZAÇÃO OTIMISTA IMEDIATA NA INTERFACE ---
  if (isCurrentlyLiked) {
    if (pill) pill.classList.remove("liked");
    if (icon) icon.className = "bi bi-heart interest-like-icon";
    if (badge) badge.textContent = Math.max(0, currentCount - 1);
  } else {
    if (pill) pill.classList.add("liked");
    if (icon) icon.className = "bi bi-heart-fill interest-like-icon";
    if (badge) badge.textContent = currentCount + 1;
  }

  try {
    const likeDocId = `${targetUid}_${tagId}_${currentUserId}`;
    const likeDocRef = doc(db, "curtidas_tags", likeDocId);
    const totalsDocRef = doc(db, "totais_tags", targetUid);

    const snap = await getDoc(likeDocRef);

    if (snap.exists()) {
      // 1. Descurtir: apaga a trava e decrementa
      await deleteDoc(likeDocRef);
      await setDoc(totalsDocRef, { [tagId]: increment(-1) }, { merge: true });
    } else {
      // 2. Curtiu: cria a trava do visitante com dados de auditoria
      const visitorName =
        auth.currentUser?.displayName ||
        window.appState?.currentUser?.nome ||
        "Usuário";

      const targetName = document.getElementById("profileName")?.textContent?.trim() || "Usuário";

      await setDoc(likeDocRef, {
        targetUid: targetUid,
        targetName: targetName,
        tagId: tagId,
        visitorUid: currentUserId,
        visitorName: visitorName,
        createdAt: serverTimestamp()
      });

      // 3. Incrementa no documento de totais
      await setDoc(totalsDocRef, { [tagId]: increment(1) }, { merge: true });
    }
  } catch (err) {
    console.error("Erro ao processar curtida no Firestore:", err);

    // Reverte visualmente caso a gravação falhe
    if (pill) {
      pill.classList.toggle("liked", isCurrentlyLiked);
      if (icon) {
        icon.className = `bi ${isCurrentlyLiked ? "bi-heart-fill" : "bi-heart"} interest-like-icon`;
      }
      if (badge) badge.textContent = currentCount;
    }
    if (typeof showToast === "function") showToast("Erro ao registrar curtida.");
  }
}



// Renderiza a seleção de tags na aba "Editar perfil"
export function renderEditInterestsSelector() {
  const container = document.getElementById("editInterestsSelectorGrid");
  const countDisplay = document.getElementById("selectedInterestsCount");
  if (!container) return;

  container.innerHTML = "";
  if (countDisplay) countDisplay.textContent = `${selectedInterests.length}/6`;

  LISTA_INTERESSES_DF.forEach(item => {
    const isSelected = selectedInterests.includes(item.id);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `interest-toggle-btn ${isSelected ? "selected" : ""}`;
   btn.textContent = item.nome;

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      if (selectedInterests.includes(item.id)) {
        selectedInterests = selectedInterests.filter(id => id !== item.id);
      } else {
        if (selectedInterests.length >= 6) {
          if (typeof showToast === "function") showToast("Você pode selecionar no máximo 6 tags.");
          return;
        }
        selectedInterests.push(item.id);
      }
      renderEditInterestsSelector();
    });

    container.appendChild(btn);
  });
}