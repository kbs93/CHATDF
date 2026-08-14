// contato.js
import {
  getFirestore,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const db = getFirestore();
const auth = getAuth();

document.addEventListener("DOMContentLoaded", () => {
  const contatoSection = document.getElementById("contato");
  if (!contatoSection) return;

  const form = contatoSection.querySelector("form");
  if (!form) return;

  const nomeInput = form.querySelector('input[type="text"]');
  const emailInput = form.querySelector('input[type="email"]');

  // 🔧 ALTERAÇÃO 1: usar TEL (telefone NÃO é number)
  const telefoneInput = form.querySelector('input[type="tel"]');

  const msgInput = form.querySelector("textarea");

  const feedback = document.createElement("div");
  feedback.style.marginTop = "10px";
  feedback.style.fontSize = "14px";
  form.appendChild(feedback);

  let usuarioLogado = null;

  onAuthStateChanged(auth, (user) => {
    usuarioLogado = user;
  });

  /* ========================= MELHORIA TELEFONE ========================= */
  if (telefoneInput) {

    // Bloqueia letras e símbolos no teclado
    telefoneInput.addEventListener("keydown", (e) => {
      const permitidas = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"];

      if (!/[0-9]/.test(e.key) && !permitidas.includes(e.key)) {
        e.preventDefault();
      }
    });

    // Limpa tudo que não for número e limita a 11 dígitos
    telefoneInput.addEventListener("input", (e) => {
      let numeros = e.target.value.replace(/\D/g, "").slice(0, 11);

      let formatado = "";
      if (numeros.length > 0) formatado = "(" + numeros.slice(0, 2);
      if (numeros.length >= 3) formatado += ") " + numeros.slice(2, 7);
      if (numeros.length >= 8) formatado += "-" + numeros.slice(7);

      e.target.value = formatado;
    });

    // Bloqueia colar texto com letras
    telefoneInput.addEventListener("paste", (e) => {
      e.preventDefault();
      let texto = (e.clipboardData || window.clipboardData)
        .getData("text")
        .replace(/\D/g, "")
        .slice(0, 11);

      let formatado = "";
      if (texto.length > 0) formatado = "(" + texto.slice(0, 2);
      if (texto.length >= 3) formatado += ") " + texto.slice(2, 7);
      if (texto.length >= 8) formatado += "-" + texto.slice(7);

      telefoneInput.value = formatado;
    });
  }



// função da validação do usuario 
function marcarErro(input) {
  input.style.borderColor = "red";}
function limparErro(input) {
  input.style.borderColor = "";}

/* =========================  SUBMIT  ======================================================= */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!usuarioLogado) {
      feedback.textContent = " Você precisa estar logado para enviar.";
      feedback.style.color = "red";
      return;
    }

const botao = form.querySelector("button[type='submit']");//variavel do botao de enviar 
const nome = nomeInput.value.trim();
const email = emailInput.value.trim();
const telefone = telefoneInput ? telefoneInput.value.trim() : "";
const mensagem = msgInput.value.trim();

// Nome
if (!nome) {
  marcarErro(nomeInput);
  feedback.textContent = " Informe seu nome.";
  feedback.style.color = "red";
  return;
} else {
  limparErro(nomeInput);
}

// Email
if (!email) {
  marcarErro(emailInput);
  feedback.textContent = "Informe seu e-mail.";
  feedback.style.color = "red";
  return;
} else {
  limparErro(emailInput);
}

// Telefone opcional
const telefoneNumeros = telefone.replace(/\D/g, "");
if (telefoneNumeros.length > 0 && telefoneNumeros.length !== 11) {
  marcarErro(telefoneInput);
  feedback.textContent = "informar telefone ";
  feedback.style.color = "red";
  return;
} else {
  limparErro(telefoneInput);
}

// Mensagem
if (mensagem.length < 5) {
  marcarErro(msgInput);
  feedback.textContent = " Escreva uma mensagem com pelo menos 5 caracteres.";
  feedback.style.color = "red";
  return;
} else {
  limparErro(msgInput);
}
// Validação individual do tamanho da mensagem
    if (mensagem.length > 500) {
      feedback.textContent = " Mensagem muito longa (máx. 500 caracteres).";
      feedback.style.color = "red";
      return;
    }

    // ID DO DOCUMENTO BASEADO NA DATA
    const agora = new Date();
    const dd = String(agora.getDate()).padStart(2, "0");
    const mm = String(agora.getMonth() + 1).padStart(2, "0");
    const yy = String(agora.getFullYear()).slice(-2);
    const hh = String(agora.getHours()).padStart(2, "0");
    const mi = String(agora.getMinutes()).padStart(2, "0");
    const ss = String(agora.getSeconds()).padStart(2, "0");
    const docId = `CONTATO_${dd}-${mm}-${yy}_${hh}-${mi}-${ss}`;

    feedback.textContent = " Enviando...";
    botao.disabled = true;

    try {
      await setDoc(
        doc(db, "feedbacks", docId),
        {
          nome: nome,
          email: email,
          telefone: telefone || "Não informado",
          mensagem: mensagem,
          createdAt: serverTimestamp()
        }
      );

      feedback.textContent = "Mensagem enviada com sucesso!";
      feedback.style.color = "green";
      form.reset();
      botao.disabled = false;

    } catch (err) {
      console.error("Erro ao enviar contato:", err);
      feedback.textContent = "Erro ao enviar. Tente novamente.";
      feedback.style.color = "red";

      botao.disabled = false;
    }






  });
});