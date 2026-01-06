// auth.js
import { auth, signInWithGoogle, signOutUser, onAuthChange, db } from "./firebase-config.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import {
  GoogleAuthProvider,
  signInWithPopup,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  linkWithCredential
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";




export let currentUser = null;

export function initAuth(showToast) {

  const loginBtnModal = document.getElementById("googleModalBtn");
  const userArea = document.getElementById("userArea"); 
  const loginTopBtn = document.getElementById("btnLogin");

  // Detectar se está no chat.html
  const isChatPage = window.location.pathname.includes("chat.html");

  // SOMENTE NO CHAT.HTML: esconder o botão "Inscreva-se"
  if (isChatPage && loginTopBtn) {
    loginTopBtn.style.display = "none";
  }

  onAuthChange(async (user) => {

    /* =====================================================
       USUÁRIO LOGADO
    ===================================================== */
if (user) {
  currentUser = user;

  // Fecha modal (se estiver no index)
  const modal = document.getElementById("loginModal");
  if (modal) modal.classList.add("hidden");

  // Some botão do Google dentro do modal
  if (loginBtnModal) loginBtnModal.style.display = "none";

  // ATUALIZA NAVBAR (index e chat)
  if (userArea) {
    userArea.innerHTML = `
      <img src="${user.photoURL}" style="width:38px;height:38px;border-radius:50%; margin-right:8px;">
      <span class="text-white fw-bold">
        ${(user.displayName || "Usuário").split(" ")[0]}
      </span>
      <button id="logoutBtn" class="btn-logout ms-2">Sair</button>
    `;
  }

  // Evento sair (CORRIGIDO)
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      try {
        // Limpa estado global do chat
        window.replyingTo = null;

        // Reset da paleta SOMENTE no cliente
        window.dispatchEvent(new Event("resetColorPicker"));

        // Logout SEM depender do Firestore
        await signOutUser();

        showToast("Volte sempre!");

        // Redireciona para a página inicial
        window.location.href = "./index.html";
      } catch (err) {
        console.error("Erro ao sair:", err);
      }
    };
  }

  return; // FIM DO LOGIN
}







    /* =====================================================
     USUÁRIO DESLOGADO
    ===================================================== */

    currentUser = null;

    // Botao de login NO INDEX: mostra o botão login normalmente
    if (!isChatPage && userArea) {
      userArea.innerHTML = `<a class="nav-link" id="btnLogin" href="#" style="background: #522ef16e; border-radius: 19px"><img src="img/usu5.png" id="imgusu" height="34px" width=" 34px"
  style="padding:7px; margin-top: -8px;">Inscreva-se / Faça login</a> `;}

    // NO CHAT: não mostra nada quando está deslogado
    if (isChatPage && userArea) {
      userArea.innerHTML = "";
    }

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
  const modal = document.getElementById("loginModal");
  if (modal) modal.classList.add("hidden");

  document.body.style.overflow = "auto";

  const provider = new GoogleAuthProvider();

  try {
    // 🔹 1. Tenta login Google
    const result = await signInWithPopup(auth, provider);

    // 🔹 2. Verifica se já existe conta password
    const email = result.user.email;
    const methods = await fetchSignInMethodsForEmail(auth, email);

    if (methods.includes("password") && !methods.includes("google.com")) {
      // ⚠️ Já existe conta com senha → precisa vincular

      const password = prompt(
        "Este e-mail já possui conta com senha.\nDigite sua senha para vincular ao Google:"
      );

      if (!password) {
        await auth.signOut();
        return;
      }

      // Login com senha
      const userCred = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Credencial Google
      const googleCred = GoogleAuthProvider.credentialFromResult(result);

      // 🔗 Vincula Google à conta existente
      await linkWithCredential(userCred.user, googleCred);

      showToast("Conta Google vinculada com sucesso!");
    }

  } catch (error) {
    console.error("Erro Google:", error);
    showToast("Erro ao fazer login com Google");
    if (modal) modal.classList.remove("hidden");
  }
};























    }
  });
}
