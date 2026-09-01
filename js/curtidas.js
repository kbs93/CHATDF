// ========================================================================= 
// MÓDULO DE CURTIDAS E TAGS DE GOSTOS & HOBBIES DO DF (CHAT-DF)
// Arquitetura de Alta Escala: Contador Agregado + Trava de Like Único
// =========================================================================
import { auth, db } from "./firebase-config.js";
import { showToast } from "./ui.js";
import {
  setDoc,
  doc,
  getDoc,
  arrayUnion,
  arrayRemove,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
// Lista base dos Interesses do DF
export const LISTA_INTERESSES_DF = [
  // Lugares do DF (Verde Esmeralda)
  { id: "parquedacidade", nome: "ParqueDaCidade", categoria: "lugares" },
  { id: "pontao", nome: "Pontão", categoria: "lugares" },
  { id: "eixao", nome: "Eixão", categoria: "lugares" },
  { id: "feirasdf", nome: "FeirasDF", categoria: "lugares" },
  { id: "lagoparanoa", nome: "LagoParanoa", categoria: "lugares" },
  { id: "shopping", nome: "Shopping", categoria: "lugares" },
  { id: "feiradorolo", nome: "FeiraDoRolo", categoria: "lugares" },
  { id: "natureza", nome: "Natureza", categoria: "lugares" },
  { id: "trilhas", nome: "Trilhas", categoria: "lugares" },
  { id: "taguaparque", nome: "TaguaParque", categoria: "lugares" },
  { id: "torredetv", nome: "TorreDeTV", categoria: "lugares" },
  { id: "torredetvdigital", nome: "TorreDeTvDigital", categoria: "lugares" },
  { id: "pontejk", nome: "PonteJK", categoria: "lugares" },

  // Música (Roxo / Índigo)
  { id: "sertanejo", nome: "Sertanejo", categoria: "musica" },
  { id: "rock", nome: "Rock", categoria: "musica" },
  { id: "mpb", nome: "MPB", categoria: "musica" },
  { id: "funk", nome: "Funk", categoria: "musica" },
  { id: "raptrap", nome: "RapTrap", categoria: "musica" },
  { id: "hiphop", nome: "HipHop", categoria: "musica" },
  { id: "flashback", nome: "FlashBack", categoria: "musica" },
  { id: "pagode", nome: "Pagode", categoria: "musica" },
  { id: "samba", nome: "Samba", categoria: "musica" },
  { id: "gospel", nome: "Gospel", categoria: "musica" },
  { id: "reggae", nome: "Reggae", categoria: "musica" },
  { id: "forro", nome: "Forró", categoria: "musica" },
  { id: "axe", nome: "Axe", categoria: "musica" },
  { id: "jazzblues", nome: "JazzBlues", categoria: "musica" },
  { id: "classicas", nome: "Classicas", categoria: "musica" },
  { id: "pop", nome: "Pop", categoria: "musica" },
  { id: "eletronica", nome: "Eletrônica", categoria: "musica" },

  // Hobbies / Jogos / Estudo / Estilo de Vida (Azul Cobalto & Âmbar)
  { id: "roles", nome: "Roles", categoria: "hobbies" },
  { id: "cinema", nome: "Cinema", categoria: "hobbies" },
  { id: "concurseiro", nome: "Concurseiro(a)", categoria: "hobbies" },
  { id: "futebol", nome: "Futebol", categoria: "hobbies" },
  { id: "gamers", nome: "Gamers", categoria: "hobbies" },
  { id: "cafe", nome: "Café", categoria: "hobbies" },
  { id: "pets", nome: "Pets", categoria: "hobbies" },
  { id: "pesca", nome: "Pescaria", categoria: "hobbies" },
  { id: "memes", nome: "Memes", categoria: "hobbies" },
  { id: "pedal", nome: "Pedal", categoria: "hobbies" },
  { id: "bicicleta", nome: "Bicicleta", categoria: "hobbies" },
  { id: "patins", nome: "Patins", categoria: "hobbies" },
  { id: "skate", nome: "Skate", categoria: "hobbies" },

  // Religião
  { id: "cristao", nome: "Cristão", categoria: "religiao" },
  { id: "evangelico", nome: "Evangelico", categoria: "religiao" },
  { id: "ateu", nome: "Ateu", categoria: "religiao" },
  { id: "candomble", nome: "Candomblé", categoria: "religiao" },
  { id: "umbanda", nome: "Umbanda", categoria: "religiao" },
  
  // Artes Marciais / Lutas
  { id: "boxe", nome: "Boxe", categoria: "luta" },
  { id: "muaythai", nome: "MuayThai", categoria: "luta" },
  { id: "kickboxing", nome: "Kickboxing", categoria: "luta" },
  { id: "carater", nome: "Caratê", categoria: "luta" },
  { id: "taekwondo", nome: "Taekwondo", categoria: "luta" },
  { id: "kungfu", nome: "KungFu", categoria: "luta" },
  { id: "capoeira", nome: "Capoeira", categoria: "luta" },
  { id: "jiujitsu", nome: "JiuJitsu", categoria: "luta" },
  { id: "judo", nome: "Judô", categoria: "luta" },
  { id: "mma", nome: "MMA", categoria: "luta" }
];

// Gera chave legível e curta para o documento: NomeSemAcentos_Primeiros5DigitosUID
export function obterDocIdTotais(targetUid) {
  const nomeBruto = document.getElementById("profileName")?.textContent?.trim() || "Usuario";
  const nomeLimpo = nomeBruto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "");
  const prefixoId = String(targetUid || "").slice(0, 5);
  return `${nomeLimpo || "Usuario"}_${prefixoId}`;
}

export let selectedInterests = [];
export function setSelectedInterests(novosInteresses) {
  selectedInterests = Array.isArray(novosInteresses) ? [...novosInteresses] : [];
}

let unsubscribeTotalsListener = null;
let unsubscribeUserLikesListener = [];

// Renderiza as tags na aba Info
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

  const targetDocKey = obterDocIdTotais(targetUid);

// 1. Cria os botões das tags no DOM
  sanitizedInterests.forEach(tagId => {
    const meta = LISTA_INTERESSES_DF.find(i => i.id === tagId) || {
      id: tagId,
      nome: tagId,
      categoria: ""
    };

    const pill = document.createElement("button");
    pill.type = "button";
    pill.id = `pill-interest-${tagId}`;
    const catClass = meta.categoria ? `tag-cat-${meta.categoria}` : "";
    pill.className = `interest-pill ${catClass} ${isOwner ? "owner-view" : ""}`;
    pill.innerHTML = `
      <span>${meta.nome}</span>
      ${!isOwner ? '<i class="bi bi-heart interest-like-icon"></i>' : ''}
      <span class="interest-like-badge">0</span>
    `;

    // Evento de clique para visitante
    if (!isOwner) {
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

  // 2. Ouvinte ÚNICO em tempo real para Contagem e Trava de Like (via Array)
  const totalsDocRef = doc(db, "totais_tags", targetDocKey);
  unsubscribeTotalsListener = onSnapshot(totalsDocRef, (snap) => {
    const data = snap.exists() ? snap.data() : {};

    sanitizedInterests.forEach(tagId => {
      const pill = document.getElementById(`pill-interest-${tagId}`);
      if (!pill) return;

      const arrayCurtidas = Array.isArray(data[`curtidas_${tagId}`]) ? data[`curtidas_${tagId}`] : [];
      const count = arrayCurtidas.length;
      const isLiked = currentUserId ? arrayCurtidas.includes(currentUserId) : false;

      const badge = pill.querySelector(".interest-like-badge");
      const icon = pill.querySelector(".interest-like-icon");

      if (badge) badge.textContent = count;
      if (icon) {
        icon.className = `bi ${isLiked ? "bi-heart-fill" : "bi-heart"} interest-like-icon`;
      }
      pill.classList.toggle("liked", isLiked);
    });
  });
}



// Alterna o like de forma atômica no array do documento principal
export async function toggleInterestLike(targetUid, tagId) {
  const currentUserId = auth.currentUser?.uid || window.appState?.currentUser?.uid;
  if (!currentUserId || !targetUid) return;

  const pill = document.getElementById(`pill-interest-${tagId}`);
  const badge = pill?.querySelector(".interest-like-badge");
  const icon = pill?.querySelector(".interest-like-icon");

  let currentCount = badge ? (parseInt(badge.textContent, 10) || 0) : 0;
  const isCurrentlyLiked = pill?.classList.contains("liked");

  // Atualização otimista imediata na interface
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
    const targetDocKey = obterDocIdTotais(targetUid);
    const totalsDocRef = doc(db, "totais_tags", targetDocKey);
    const snap = await getDoc(totalsDocRef);
    const data = snap.exists() ? snap.data() : {};
    const arrayCurtidas = Array.isArray(data[`curtidas_${tagId}`]) ? data[`curtidas_${tagId}`] : [];

    if (arrayCurtidas.includes(currentUserId)) {
      // Descurtir: remove o UID do array
      await setDoc(totalsDocRef, {
        [`curtidas_${tagId}`]: arrayRemove(currentUserId)
      }, { merge: true });
    } else {
      // Curtiu: adiciona o UID ao array
      await setDoc(totalsDocRef, {
        [`curtidas_${tagId}`]: arrayUnion(currentUserId)
      }, { merge: true });
    }
  } catch (err) {
    console.error("Erro ao processar curtida no Firestore:", err);

    // Reverte interface se falhar
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