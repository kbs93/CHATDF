// auth.js
import { auth, provider, signOutUser, onAuthChange, db, rtdb } from "./firebase-config.js";
import {
  GoogleAuthProvider,
  signInWithPopup,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  linkWithCredential
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import {
  ref,
  set,
  update,
  onValue,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
export let currentUser = null;
let googleLoginInProgress = false;
let unsubscribeUserAreaProfileListener = null; // 03-05-26 
let profileTooltipAlreadyShown = false;//11-05-2026 
const USER_AREA_CACHE_KEY = "chatdf_user_area_cache";
const DEFAULT_AVATAR = "./img/avatar.png";

// ================= SALA ATUAL ================= 18-05-26 
// Pega o ID da sala da URL, ou usa "geral" como padrão
const urlParams = new URLSearchParams(window.location.search); 

// 18-05-26 detectar se estamos no chat.html para evitar erros de URL em outras páginas
const isChatPage = 
  window.location.pathname.includes("chat.html");

const currentRoom =
  isChatPage
    ? (urlParams.get("sala") || "geral")
    : null;


function sanitizeAvatarUrl(photo) {
  if (!photo || typeof photo !== "string") {
    return DEFAULT_AVATAR;
  }

  const trimmed = photo.trim();

  if (
    trimmed.includes("127.0.0.1") ||
    trimmed.includes("localhost")
  ) {
    return DEFAULT_AVATAR;
  }

  return trimmed;
}
function saveUserAreaCache(data) {
  try {
    localStorage.setItem(USER_AREA_CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Não foi possível salvar cache visual do usuário:", err);
  }
}

function getUserAreaCache() {
  try {
    const raw = localStorage.getItem(USER_AREA_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("Não foi possível ler cache visual do usuário:", err);
    return null;
  }
}

function clearUserAreaCache() {
  try {
    localStorage.removeItem(USER_AREA_CACHE_KEY);
  } catch (err) {
    console.warn("Não foi possível limpar cache visual do usuário:", err);
  }
}


/*ADICIONANDO NOVO CODIGO  11-05-2026 
Verifica se o tooltip já apareceu e pega o botão do usuário (foto/nome).
Cria o tooltip dinamicamente no HTML caso ele ainda não exista.
Posiciona o tooltip abaixo do avatar, exibe na tela e permite fechar no “X”.
*/
function showEditProfileTooltip() {
  if (profileTooltipAlreadyShown) return;

  const userMenuBtn = document.getElementById("userMenuBtn");
  if (!userMenuBtn) return;

  profileTooltipAlreadyShown = true;

  let tooltip = document.getElementById("profileEditTooltip");

  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "profileEditTooltip";
    tooltip.className = "profile-edit-tooltip";
    tooltip.innerHTML = `
      <button class="profile-tooltip-close" type="button">×</button>
      <strong>Complete o seu perfil</strong>
      <p>Clique aqui para completar seu perfil  no chat.</p>
    `;

    document.body.appendChild(tooltip);
  }

  const rect = userMenuBtn.getBoundingClientRect();

  tooltip.style.top = `${rect.bottom + 12}px`;
  tooltip.style.left = `${Math.max(12, rect.left - 125)}px`;//tooltip mais pra esquerda 
  tooltip.classList.add("show");


function closeProfileTooltip() {
  tooltip.classList.remove("show");
  document.removeEventListener("click", outsideTooltipClick);
}

function outsideTooltipClick(e) {
  if (
    tooltip.contains(e.target) ||
    userMenuBtn.contains(e.target)
  ) {
    return;
  }

  closeProfileTooltip();
}

const closeBtn = tooltip.querySelector(".profile-tooltip-close");
if (closeBtn) {
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    closeProfileTooltip();
  };
}

tooltip.onclick = (e) => {
  e.stopPropagation();
};

setTimeout(() => {
  document.addEventListener("click", outsideTooltipClick);
}, 100);

setTimeout(() => {
  closeProfileTooltip();
}, 4000);//tooltip aparee e desaparece em 4 segundos

}


// EDITA O PERFIL NO INDEX 08-05-2026
function renderLoggedUserArea(userArea, profileName, profilePhoto) {
  if (!userArea) return;

userArea.innerHTML = `
<div class="user-menu-wrap">

  <button id="userMenuBtn" class="user-menu-btn">

    <img 
      src="${profilePhoto || './img/avatar.png'}"
      class="user-menu-avatar"
      onerror="this.src='./img/avatar.png'"
    >

    <span class="user-menu-name">
      ${profileName || "Usuário"}
    </span>

  </button>
<div id="userDropdown" class="user-dropdown hidden">


<button id="openProfileBtn" class="user-dropdown-item" type="button">
  <i class="bi bi-gear-fill user-dropdown-icon"></i>
  <span>Editar perfil</span>
</button>

<button id="logoutBtn" class="user-dropdown-item logout" type="button">
  <i class="bi bi-box-arrow-right user-dropdown-icon"></i>
  <span>Sair</span>
</button>

</div>

</div>
`;
/* 08-05-26
abre o menu no index perfil ao clicar, fecha clicando fora*/
const userMenuBtn = document.getElementById("userMenuBtn");
const userDropdown = document.getElementById("userDropdown");
const openProfileBtn = document.getElementById("openProfileBtn");

if (userMenuBtn && userDropdown) {
  userMenuBtn.onclick = (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle("hidden");
  };

  userDropdown.onclick = (e) => {
    e.stopPropagation();
  };

  document.onclick = () => {
    userDropdown.classList.add("hidden");
  };
}

if (openProfileBtn) {
  openProfileBtn.onclick = () => {
    userDropdown?.classList.add("hidden");

    document.dispatchEvent(new CustomEvent("chatdf:open-profile"));
  };
}



}

function renderLoggedOutUserArea(userArea, isChatPage) {
  if (!userArea) return;

  if (!isChatPage) {
    userArea.innerHTML = `<a class="nav-link" id="btnLogin" href="#">
      <img src="img/avatar.png" height="65px" width="65px" style="padding:1px; margin-top: -8px;">
    </a>`;
    return;
  }

  userArea.innerHTML = `<a class="nav-link" id="btnLogin" href="#">
    <img src="./img/avatar.png" height="65px" width="85px" style="padding:1px; margin-top:2px;">
  </a>`;
}

function restoreCachedUserArea(userArea, isChatPage) {
  if (!userArea) return;

  const cached = getUserAreaCache();

  if (cached?.isLoggedIn) {
    renderLoggedUserArea(
      userArea,
      cached.profileName || "Usuário",
      cached.profilePhoto || "img/avatar.png"
    );
    return;
  }

  renderLoggedOutUserArea(userArea, isChatPage);
}

function dispatchUserReady(user, extra = {}) {

  document.dispatchEvent(new CustomEvent("chatdf:user-ready", {
    detail: { user, ...extra }
  }));
}

function dispatchUserLogout() {
  document.dispatchEvent(new CustomEvent("chatdf:user-logout"));
}

     /* =====================================================
       USUÁRIO LOGADO
    ===================================================== */
export function initAuth(showToast) {
  const loginBtnModal = document.getElementById("googleModalBtn");
  const userArea = document.getElementById("userArea"); 
  const loginTopBtn = document.getElementById("btnLogin");
  // Detectar se está no chat.html
  const isChatPage = window.location.pathname.includes("chat.html");
   restoreCachedUserArea(userArea, isChatPage);
  // SOMENTE NO CHAT.HTML: esconder o botão "Inscreva-se"
  if (isChatPage && loginTopBtn) {
    loginTopBtn.style.display = "none";
  }


  onAuthChange(async (user) => {
if (user) {
  currentUser = user;

// ===================== CRIAR / ATUALIZAR USUÁRIO (FIRESTORE) ====================== 18-03-26
// ===================== CRIAR / ATUALIZAR USUÁRIO (FIRESTORE) ======================
let profileName = "Usuário";
let profilePhoto = user.photoURL || "";

try {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);




if (!userSnap.exists()) {
  const defaultPhoto = sanitizeAvatarUrl(user.photoURL);

  const userData = {
    nome: user.displayName || "Usuário",
    email: user.email || "",
    foto: defaultPhoto,
    cidade: "",
    telefone: "",
    lastLogin: Date.now(),
    createdAt: Date.now()
  };

  await setDoc(userRef, userData);
  profileName = userData.nome;
  profilePhoto = userData.foto;
}
else {
  const dbUser = userSnap.data();

  profileName =
    dbUser.nome ||
    dbUser.name ||
    dbUser.displayName ||
    user.displayName ||
    "Usuário";

  profilePhoto = sanitizeAvatarUrl(
    dbUser.foto ||
    dbUser.avatar ||
    dbUser.photoURL ||
    user.photoURL
  );

  await updateDoc(userRef, {
    email: user.email || dbUser.email || "",
    foto: profilePhoto,
    lastLogin: Date.now()
  });
}

} catch (err) {
  console.error("Erro ao salvar usuário:", err);
}

// ===================== PRESENÇA ONLINE ======================
// ===================== PRESENÇA ONLINE (RECONEXÃO AUTOMÁTICA FIX) ======================
const userStatusRef = ref(rtdb, "status/" + user.uid);
const connectedRef = ref(rtdb, ".info/connected");

const isPasswordUser = user.providerData?.some(
  p => p.providerId === "password"
);

if (isPasswordUser && !user.emailVerified) {
  await set(userStatusRef, null);
} else {
  let finalAvatar = sanitizeAvatarUrl(profilePhoto);

  onValue(connectedRef, async (snap) => {
    if (snap.val() === true) {
      // 1. Quando o socket cair, apenas altera o status para offline, sem apagar o nó
      await onDisconnect(userStatusRef).update({
        online: false,
        lastChanged: Date.now()
      });

      // 2. Sempre que a rede conectar/reconectar, regrava online: true imediatamente
      const dynamicUrlParams = new URLSearchParams(window.location.search);
      const activeRoom = window.location.pathname.includes("chat.html") ? (dynamicUrlParams.get("sala") || "geral") : null;

      await set(userStatusRef, { 
        uid: user.uid,
        name: profileName,
        avatar: finalAvatar,
        online: true,
        sala: activeRoom,
        lastChanged: Date.now()
      });
    }
  });
}




  // Fecha modal (se estiver no index)
  const modal = document.getElementById("loginModal");
  if (modal) modal.classList.add("hidden");
  // Some botão do Google dentro do modal
  if (loginBtnModal) loginBtnModal.style.display = "none";

  // ATUALIZA NAVBAR (index e chat) Botao de sair 
saveUserAreaCache({
  isLoggedIn: true,
  uid: user.uid,
  profileName,
  profilePhoto
});



// atualizando o topo 03-05-26 
if (unsubscribeUserAreaProfileListener) {
  unsubscribeUserAreaProfileListener();
}

const liveUserRef = doc(db, "users", user.uid);

unsubscribeUserAreaProfileListener = onSnapshot(liveUserRef, (snap) => {
  if (!snap.exists()) {
    renderLoggedUserArea(userArea, profileName, profilePhoto);
    return;
  }

  const liveData = snap.data();

  const liveName =
    liveData.nome ||
    liveData.name ||
    liveData.displayName ||
    profileName ||
    "Usuário";

  const livePhoto = sanitizeAvatarUrl(
    liveData.foto ||
    liveData.avatar ||
    liveData.photoURL ||
    profilePhoto
  );

  saveUserAreaCache({
    isLoggedIn: true,
    uid: user.uid,
    profileName: liveName,
    profilePhoto: livePhoto
  });

  renderLoggedUserArea(userArea, liveName, livePhoto);

  //11-05-2026
  if (!liveData.perfilCompleto) {
  setTimeout(() => {
    showEditProfileTooltip();
  }, 500);
}
// 21-06-26 Notifica dinamicamente os scripts do chat sobre mudanças no perfil para o bloqueio de envio
  document.dispatchEvent(new CustomEvent("chatdf:user-ready", {
    detail: { user, userData: liveData }
  }));

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      try {
        window.replyingTo = null;
        window.dispatchEvent(new Event("resetColorPicker"));
        localStorage.removeItem("chatdf_user_color");
if (currentUser?.uid) {
  const userStatusRef = ref(rtdb, "status/" + currentUser.uid);
  await set(userStatusRef, null); // Deleta o nó imediatamente do banco ao clicar em Sair
}
 

        clearUserAreaCache();
        await signOutUser();
        showToast("Volte sempre!");
      } catch (err) {
        console.error("Erro ao sair:", err);
      }
    };
  }
});
  // Evento sair (CORRIGIDO) presença do suario 
 const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.onclick = async () => {
    try {
      // Limpa estado global do chat
      window.replyingTo = null;
      // Reset da paleta SOMENTE no cliente
      window.dispatchEvent(new Event("resetColorPicker"));
      localStorage.removeItem("chatdf_user_color");

      // Remove presença online antes do logout
      if (currentUser?.uid) {
  const userStatusRef = ref(rtdb, "status/" + currentUser.uid);
  await set(userStatusRef, null); // Deleta o nó imediatamente do banco ao clicar em Sair
}
      // Logout
         clearUserAreaCache();

      // Logout
      await signOutUser();
      showToast("Volte sempre!");
   
    } catch (err) {
      console.error("Erro ao sair:", err);
    }
  };
}
  dispatchUserReady(user, {
    profileName,
    profilePhoto
  });

  return; // FIM DO LOGIN

}

    /* =====================================================
     USUÁRIO DESLOGADO
    ===================================================== */
// evita logout falso durante recarregamento da página
if (auth.currentUser) return;

//LIMPAR LISTENER AO SAIR
currentUser = null;
if (unsubscribeUserAreaProfileListener) {
  unsubscribeUserAreaProfileListener();
  unsubscribeUserAreaProfileListener = null;
}

clearUserAreaCache();
dispatchUserLogout();

renderLoggedOutUserArea(userArea, isChatPage);


    // evento para abrir modal quando clicar
    const newLoginBtn = document.getElementById("btnLogin");
    if (newLoginBtn) {
      newLoginBtn.onclick = () => {
        const modal = document.getElementById("loginModal");
        if (modal) modal.classList.remove("hidden");
      };
    }



// Botão Google
if (loginBtnModal) {
  loginBtnModal.style.display = "block";

  loginBtnModal.onclick = async () => {
    if (googleLoginInProgress) return;

    googleLoginInProgress = true;
    loginBtnModal.disabled = true;

    const modal = document.getElementById("loginModal");
    if (modal) modal.classList.add("hidden");
    document.body.style.overflow = "auto";

    try {
      await signInWithPopup(auth, provider);

    } catch (error) {
      console.error("Erro Google:", error);

      if (error.code === "auth/cancelled-popup-request") {
        showToast("Já existe uma tentativa de login em andamento.");
        return;
      }

      if (error.code === "auth/popup-closed-by-user") {
        showToast("Login cancelado.");
        if (modal) modal.classList.remove("hidden");
        return;
      }

      if (error.code === "auth/account-exists-with-different-credential") {
        try {
          const email = error.customData?.email;

          if (!email) {
            showToast("Não foi possível identificar o e-mail da conta.");
            if (modal) modal.classList.remove("hidden");
            return;
          }

          const methods = await fetchSignInMethodsForEmail(auth, email);
          const pendingGoogleCred =
            GoogleAuthProvider.credentialFromError(error);

          if (methods.includes("password")) {
            const password = prompt(
              "Este e-mail já possui conta com senha.\nDigite sua senha para vincular ao Google:"
            );

            if (!password) {
              showToast("Vinculação cancelada.");
              if (modal) modal.classList.remove("hidden");
              return;
            }

            const userCred = await signInWithEmailAndPassword(
              auth,
              email,
              password
            );

            await linkWithCredential(userCred.user, pendingGoogleCred);
            showToast("Conta Google vinculada com sucesso!");
            return;
          }

          showToast("Este e-mail já está vinculado a outro método de login.");
          if (modal) modal.classList.remove("hidden");

        } catch (linkError) {
          console.error("Erro ao vincular conta Google:", linkError);
          showToast("Não foi possível vincular sua conta Google.");
          if (modal) modal.classList.remove("hidden");
        }

        return;
      }

      showToast("Erro ao fazer login com Google");
      if (modal) modal.classList.remove("hidden");

    } finally {
      googleLoginInProgress = false;
      loginBtnModal.disabled = false;
    }
  };
}

  });
}
