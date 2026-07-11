import {
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  fetchSignInMethodsForEmail,
  signInWithPopup,
  linkWithCredential,
  EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

import { auth, db, provider } from "./firebase-config.js";
import { doc, setDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { showToast } from "./ui.js";



// ======================== CONSTANTES ========================
const DEFAULT_AVATAR = "./img/avatar.png";

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


  
// BLOQUEIA CADASTRO SE O EMAIL JÁ USA GOOGLE
  const methods = await fetchSignInMethodsForEmail(auth, email);

  if (methods.includes("password")) {
    showToast("Este e-mail já está cadastrado. Faça login.");
    return;
  }


if (methods.includes("google.com")) {
  try {
    showToast("Confirme com Google para vincular sua senha.");

    const result = await signInWithPopup(auth, provider);
    const googleUser = result.user;

    if ((googleUser.email || "").toLowerCase() !== email.toLowerCase()) {
      showToast("Entre no Google com o mesmo e-mail digitado no cadastro.");
      await auth.signOut();
      return;
    }

    const emailCredential = EmailAuthProvider.credential(email, password);
    await linkWithCredential(googleUser, emailCredential);

    await setDoc(doc(db, "users", googleUser.uid), {
      email,
      emailVerified: true
    }, { merge: true });

    limparCadastro();
    limparAvatar();
    loginModal.classList.add("hidden");

    showToast("Senha vinculada com sucesso! Seu perfil atual foi mantido.");
    return;

  } catch (err) {
    console.error("ERRO VINCULAR SENHA NO GOOGLE:", err.code || err);

    if (err.code === "auth/popup-closed-by-user") {
      showToast("Login com Google cancelado.");
    } else if (err.code === "auth/credential-already-in-use") {
      showToast("Essa senha já está vinculada a outra conta.");
    } else if (err.code === "auth/provider-already-linked") {
      showToast("Esta conta já está vinculada.");
    } else {
      showToast("Não foi possível vincular a senha à conta Google.");
    }

    return;
  }
}










  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    await updateProfile(cred.user, {
      displayName: name,
      photoURL: selectedAvatar
    });

    await sendEmailVerification(cred.user, {
      url: "https://kbs93.github.io/CHATDF/index.html"
    });

await setDoc(doc(db, "users", cred.user.uid), {
  nome: name,
  email,
  foto: selectedAvatar,
  cidade: "",
  telefone: "",
  emailVerified: false,
  createdAt: Date.now(),
  lastLogin: Date.now()
});

    await auth.signOut();
    limparCadastro();
    limparAvatar();

    showToast("Verifique seu e-mail para ativar a conta.");

  } catch (err) {
    console.error("ERRO CADASTRO:", err.code);

    if (err.code === "auth/email-already-in-use") {
      showToast("Este e-mail já está cadastrado entra com a conta google.");
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

  const emailInput = document.getElementById("loginEmail");
  const passInput = document.getElementById("loginPassword");
  
  const email = emailInput.value.trim();
  const password = passInput.value.trim();

  if (!email || !password) {
    showToast("Informe email e senha");
    return;
  }

  // valida senha antes de chamar o Firebase
  if (password.length < 6 || password.length > 10) {
    showToast("Senha deve ter entre 6 e 10 caracteres.");
    return;
  }

// ======== CONTROLE DA TRAVA INVISÍVEL ========
  const googleBtn = document.getElementById("googleModalBtn");
  const linkRegistro = document.getElementById("openRegister");
  const btnEntrar = document.getElementById("loginEmailBtn");

  const toggleTrava = (ativar) => {
    const acao = ativar ? "add" : "remove";
    if(emailInput) emailInput.classList[acao]("bloqueado-interacao");
    if(passInput) passInput.classList[acao]("bloqueado-interacao");
    if(googleBtn) googleBtn.classList[acao]("bloqueado-interacao");
    
    // Congela o link de registro visualmente
    if(linkRegistro) {
      linkRegistro.classList[acao]("bloqueado-interacao");
      linkRegistro.style.pointerEvents = ativar ? "none" : "auto";
      linkRegistro.style.opacity = ativar ? "0.5" : "1";
    }
    
    // Congela o botão e muda o texto
    if(btnEntrar) {
      btnEntrar.classList[acao]("bloqueado-interacao");
      btnEntrar.disabled = ativar;
      btnEntrar.textContent = ativar ? "Entrando..." : "Entrar";
    }
  };

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await cred.user.reload();

   if (!cred.user.emailVerified) {
      showToast("Confirme seu e-mail antes de entrar.");
      await auth.signOut();
      toggleTrava(false); // Descongela APENAS AQUI porque deu erro de verificação
      return;
    }
    
    limparLogin();
    // AQUI É O SEGREDO: Não descongela! Deixa o botão travado enquanto o usuário entra no chat.
    loginModal.classList.add("hidden");
  } catch {
    showToast("Email ou senha incorretos");
    limparLogin(); 
    emailInput.focus(); 
    toggleTrava(false); // DESLIGA A TRAVA NO ERRO
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
}