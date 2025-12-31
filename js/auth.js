// auth.js
import { auth, signInWithGoogle, signOutUser, onAuthChange, db } from "./firebase-config.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

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
          <span class="text-white fw-bold">${(user.displayName || "Usuário").split(" ")[0]
}</span>
          <button id="logoutBtn"class="btn-logout ms-2">Sair</button>
        `;
      }

      // Evento sair
      const logoutBtn = document.getElementById("logoutBtn");
      if (logoutBtn) {

logoutBtn.onclick = async () => {

  const user = auth.currentUser;

  // Antes de deslogar, reseta a cor no Firestore
  if (user) {
    const ref = doc(db, "users", user.uid);
    await updateDoc(ref, { chatColor: "#000000" });
  }

  // Agora faz logout
  await signOutUser();

  // Reset na paleta do lado do cliente QUANDO O USUARIO SAI DA CONTA A COR VOLTA AO PADRAO PRETO
  window.dispatchEvent(new Event("resetColorPicker"));

  showToast("Volte sempre!");

  // Redireciona para a página inicial após o logout
  window.location.href = "./index.html";
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

  // FECHA O MODAL IMEDIATAMENTE
  if (modal) modal.classList.add("hidden");

  // Libera o scroll caso o modal trave o body
  document.body.style.overflow = "auto";

  try {
    await signInWithGoogle();
  } catch (err) {
    showToast("Erro ao fazer login: " + err.message);

    // Se der erro, reabre o modal
    if (modal) modal.classList.remove("hidden");
  }
};
    }
  });
}
