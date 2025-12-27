import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signInWithEmailAndPassword,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import { auth, db } from "./firebase-config.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { showToast } from "./ui.js";

// ======================== CONSTANTES ========================
const DEFAULT_AVATAR = "img/avatar.png";

// ======================== MODAL ========================
const loginModal = document.getElementById("loginModal");

document.getElementById("btnLogin")?.addEventListener("click", () => {
  loginModal.classList.remove("hidden");
});

document.querySelector(".close-login")?.addEventListener("click", () => {
  loginModal.classList.add("hidden");
  limparLogin();
  limparCadastro();
  limparAvatar();
});

// ======================== VIEWS ========================
const loginView = document.getElementById("loginView");
const registerView = document.getElementById("registerView");
const backTop = document.getElementById("backToLoginTop");

function showLogin() {
  loginView.classList.remove("hidden");
  registerView.classList.add("hidden");
  backTop.classList.add("hidden");
  limparCadastro();
  limparAvatar();
}

function showRegister() {
  loginView.classList.add("hidden");
  registerView.classList.remove("hidden");
  backTop.classList.remove("hidden");
}

document.getElementById("openRegister")?.addEventListener("click", e => {
  e.preventDefault();
  showRegister();
});

document.getElementById("backToLogin")?.addEventListener("click", e => {
  e.preventDefault();
  showLogin();
});

backTop?.addEventListener("click", showLogin);

// ======================== AVATAR ========================
let selectedAvatar = DEFAULT_AVATAR;

const avatarPicker = document.querySelector(".avatar-picker");
const avatarModal = document.getElementById("avatarModal");
const avatarPreviewImg = document.querySelector(".avatar-preview img");
const closeAvatarModal = document.getElementById("closeAvatarModal");

avatarPicker?.addEventListener("click", () => {
  avatarModal.classList.remove("hidden");
});

closeAvatarModal?.addEventListener("click", () => {
  avatarModal.classList.add("hidden");
});

document.querySelectorAll(".avatar-grid img").forEach(img => {
  img.addEventListener("click", () => {
    selectedAvatar = img.src;
    avatarPreviewImg.src = selectedAvatar;
    avatarModal.classList.add("hidden");
  });
});

// ======================== FILTRO AVATAR ========================
document.querySelectorAll(".avatar-cat").forEach(btn => {
  btn.addEventListener("click", () => {
    const cat = btn.dataset.cat;

    document.querySelectorAll(".avatar-cat").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".avatar-grid img").forEach(img => {
      img.style.display = cat === "all" || img.dataset.category === cat ? "block" : "none";
    });
  });
});

// ======================== CADASTRO ========================

document.getElementById("registerBtn")?.addEventListener("click", async () => {
  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value.trim();

  if (!name || !email || !password) {
    showToast("Preencha todos os campos");
    return;
  }

  // ============== REGEX FINAL DO NOME ================================
  // Letras (3 a 10) + números (1 a 3 no final)
  const regexNome = /^[a-zA-ZÀ-ÿ]{3,10}[0-9]{1,4}$/;

  if (!regexNome.test(name)) {
    showToast("Use um nome válido (ex: Joao1, Maria23).");
    return;
  }

  // BLOQUEIO DE PALAVRÕES
  const bannedWords = ["puta","pputa", "caralho", "porra", "bosta","merda", "viado", "idiota", "fdp",
  "desgraça", "inferno","putta","PUTA","PPUTTA","PPUTA","GAY","gay","Gayy","Gay","gayy","Viaadu","Viado","VViadoo","viaado","Viadoo","gozar","goza","Gozar", 
  "Goza","buceta","Buceta","Bucetinha","bucetinha","Bucetinhaa","bucetao","Bucetao","Viadinho","ativo","Ativo","Ativoo","ativoo","pass","passivo","passivinho","passivinhoo",
  "karalho","Caralhoo","CARALHO","CARALHOO","SLK","slk","FDS","fds","cu","CU","CUZINHO","CUZINHOO","cuzinho","cuzao","koll","kool","KUL","PINTO","pinto","PINTINHO","pintinho",
  "penis","PENIS","PAU","pau","PAUZAO","pauzao","PENISS","peniss"
  ];

  const nomeLower = name.toLowerCase();
  for (const word of bannedWords) {
    if (nomeLower.includes(word)) {
      showToast("O nome contém palavras não permitidas.");
      return;
    }
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(cred.user, {
      displayName: name,
      photoURL: selectedAvatar
    });

    await sendEmailVerification(cred.user);

    await setDoc(doc(db, "users", cred.user.uid), {
      name,
      email,
      avatar: selectedAvatar,
      createdAt: new Date()
    });

    await auth.signOut();
    limparCadastro();
    limparAvatar();

    showToast("Verifique seu e-mail para ativar a conta.");

   

  } catch (err) {
    console.error("ERRO CADASTRO:", err.code);

    if (err.code === "auth/email-already-in-use") {
      showToast("Este e-mail já está cadastrado.");
    } else if (err.code === "auth/invalid-email") {
      showToast("E-mail inválido.");
    } else if (err.code === "auth/weak-password") {
      showToast("Senha fraca. Use pelo menos 6 caracteres.");
    } else {
      showToast("Erro ao criar conta.");
    }
  }
});



// ======================== LOGIN ========================
document.getElementById("loginEmailBtn")?.addEventListener("click", async e => {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) {
    showToast("Informe email e senha");
    return;
  }
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);

    if (!cred.user.emailVerified) {
      showToast("Confirme seu e-mail antes de entrar.");
      await auth.signOut();
      return;
    }
    limparLogin();
    loginModal.classList.add("hidden");

  } catch {
    showToast("Email ou senha incorretos");
  }

// valida senha
if (password.length < 6 || password.length > 10) {
  showToast("Senha deve ter entre 6 e 10 caracteres.");
  return;
}

});

// ======================== REDEFINIR SENHA ========================
document.getElementById("forgotPassword")?.addEventListener("click", async e => {
  e.preventDefault();

  const emailInput = document.getElementById("loginEmail");
  if (!emailInput.value) {
    showToast("Informe seu e-mail primeiro.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, emailInput.value);
    showToast("Email de redefinição enviado.");
    emailInput.value = "";
  } catch {
    showToast("Erro ao enviar email.");
  }
});

// ======================== UTIL ========================
function limparLogin() {
  document.getElementById("loginEmail").value = "";
  document.getElementById("loginPassword").value = "";
}

function limparCadastro() {
  document.getElementById("registerName").value = "";
  document.getElementById("registerEmail").value = "";
  document.getElementById("registerPassword").value = "";
}

function limparAvatar() {
  selectedAvatar = DEFAULT_AVATAR;
  avatarPreviewImg.src = DEFAULT_AVATAR;
}



