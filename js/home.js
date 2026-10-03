// js/home.js - Script ultra-rápido da Home
import {
  onAuthStateChanged,
  signInWithPopup,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { auth, provider, signOutUser } from "./firebase-app.js";

const USER_AREA_CACHE_KEY = "chatdf_user_area_cache";
const userArea = document.getElementById("userArea");
const loginModal = document.getElementById("loginModal");
const heroVisitorBtn = document.getElementById("heroVisitorBtn");
const heroLoginBtn = document.getElementById("heroLoginBtn");
let googleLoginInProgress = false;

// Leitura do Cache
function getUserCache() {
  try {
    const raw = localStorage.getItem(USER_AREA_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveUserCache(data) {
  try {
    localStorage.setItem(USER_AREA_CACHE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("Erro ao salvar cache:", err);
  }
}

function renderUserArea(isLogged, name = "Usuário", photo = "./img/avatar.png") {
  if (!userArea) return;

  if (isLogged) {
    userArea.innerHTML = `
      <div class="user-menu-wrap">
        <button id="userMenuBtn" class="user-menu-btn">
          <img src="${photo}" class="user-menu-avatar" onerror="this.src='./img/avatar.png'">
          <span class="user-menu-name">${name}</span>
        </button>
        <div id="userDropdown" class="user-dropdown hidden">
          <a href="chat.html" class="user-dropdown-item">
            <i class="bi bi-chat-dots-fill user-dropdown-icon"></i>
            <span>Ir para o Chat</span>
          </a>
          <button id="logoutBtn" class="user-dropdown-item logout" type="button">
            <i class="bi bi-box-arrow-right user-dropdown-icon"></i>
            <span>Sair</span>
          </button>
        </div>
      </div>
    `;

    const userMenuBtn = document.getElementById("userMenuBtn");
    const userDropdown = document.getElementById("userDropdown");
    userMenuBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      userDropdown?.classList.toggle("hidden");
    });
    document.addEventListener("click", () => userDropdown?.classList.add("hidden"));

    document.getElementById("logoutBtn")?.addEventListener("click", async () => {
      localStorage.removeItem(USER_AREA_CACHE_KEY);
      await signOutUser();
      renderUserArea(false);
    });

    if (heroVisitorBtn) heroVisitorBtn.textContent = "Entrar nas Salas";
    if (heroLoginBtn) heroLoginBtn.classList.add("bloqueado");
  } else {
    userArea.innerHTML = `
      <a class="nav-link open-login" id="btnLogin" href="#">
        <img src="img/avatar.png" height="65px" width="65px" style="padding:1px; margin-top: -8px;">
      </a>
    `;
    if (heroVisitorBtn) heroVisitorBtn.textContent = "Modo Visitante";
    if (heroLoginBtn) heroLoginBtn.classList.remove("bloqueado");
  }
}

// Restaura estado visual inicial instantaneamente pelo cache
const cached = getUserCache();
renderUserArea(!!cached?.isLoggedIn, cached?.profileName, cached?.profilePhoto);

// Observador Auth nativo (Sem Firestore no Index)
onAuthStateChanged(auth, (user) => {
  if (user) {
    const nome = user.displayName || cached?.profileName || "Usuário";
    const foto = user.photoURL || cached?.profilePhoto || "./img/avatar.png";

    saveUserCache({ isLoggedIn: true, uid: user.uid, profileName: nome, profilePhoto: foto });
    renderUserArea(true, nome, foto);

    fecharModalLogin();
  } else {
    localStorage.removeItem(USER_AREA_CACHE_KEY);
    renderUserArea(false);
  }
});

// Controle do Modal de Login
function abrirModalLogin() {
  if (!loginModal) return;
  loginModal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
  document.body.style.touchAction = "none";
}

function fecharModalLogin() {
  if (!loginModal) return;
  loginModal.classList.add("hidden");
  document.body.style.overflow = "";
  document.body.style.touchAction = "";
}

document.querySelector(".close-login")?.addEventListener("click", fecharModalLogin);
loginModal?.addEventListener("click", (e) => {
  if (e.target === loginModal) fecharModalLogin();
});

document.addEventListener("click", (e) => {
  if (e.target.closest(".open-login")) {
    e.preventDefault();
    abrirModalLogin();
  }
});

// Ação de Login Google dentro do Modal
document.getElementById("googleModalBtn")?.addEventListener("click", async () => {
  if (googleLoginInProgress) return;
  googleLoginInProgress = true;
  try {
    await signInWithPopup(auth, provider);
  } catch (err) {
    console.error("Erro no login:", err);
  } finally {
    googleLoginInProgress = false;
  }
});

// Menu Hambúrguer e Scroll Suave
document.addEventListener("DOMContentLoaded", () => {
  const navbarNav = document.getElementById("navbarNav");
  const toggler = document.querySelector(".navbar-toggler");

  if (navbarNav && typeof bootstrap !== "undefined") {
    const bsCollapse = bootstrap.Collapse.getOrCreateInstance(navbarNav, { toggle: false });
    document.getElementById("btnSobreNav")?.addEventListener("click", (e) => {
      e.preventDefault();
      bsCollapse.hide();
      toggler?.classList.add("collapsed");
      setTimeout(() => {
        window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
      }, 200);
    });
  }
});