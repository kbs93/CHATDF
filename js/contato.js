// contato.js - Com import dinâmico sob demanda
import { auth } from "./firebase-app.js";

document.addEventListener("DOMContentLoaded", () => {
  const contatoSection = document.getElementById("contato");
  if (!contatoSection) return;

  const form = contatoSection.querySelector("form");
  if (!form) return;

  const nomeInput = form.querySelector('input[type="text"]');
  const emailInput = form.querySelector('input[type="email"]');
  const telefoneInput = form.querySelector('input[type="tel"]');
  const msgInput = form.querySelector("textarea");

  const feedback = document.createElement("div");
  feedback.style.marginTop = "10px";
  feedback.style.fontSize = "14px";
  form.appendChild(feedback);

  if (telefoneInput) {
    telefoneInput.addEventListener("keydown", (e) => {
      const permitidas = ["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"];
      if (!/[0-9]/.test(e.key) && !permitidas.includes(e.key)) e.preventDefault();
    });

    telefoneInput.addEventListener("input", (e) => {
      const numeros = e.target.value.replace(/\D/g, "").slice(0, 11);
      let formatado = "";
      if (numeros.length > 0) formatado = "(" + numeros.slice(0, 2);
      if (numeros.length >= 3) formatado += ") " + numeros.slice(2, 7);
      if (numeros.length >= 8) formatado += "-" + numeros.slice(7);
      e.target.value = formatado;
    });
  }

  function marcarErro(input) { input.style.borderColor = "red"; }
  function limparErro(input) { input.style.borderColor = ""; }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!auth.currentUser) {
      feedback.textContent = " Você precisa estar logado para enviar.";
      feedback.style.color = "red";
      return;
    }

    const botao = form.querySelector("button[type='submit']");
    const nome = nomeInput.value.trim();
    const email = emailInput.value.trim();
    const telefone = telefoneInput ? telefoneInput.value.trim() : "";
    const mensagem = msgInput.value.trim();

    if (!nome) { marcarErro(nomeInput); feedback.textContent = " Informe seu nome."; feedback.style.color = "red"; return; }
    else limparErro(nomeInput);

    if (!email) { marcarErro(emailInput); feedback.textContent = "Informe seu e-mail."; feedback.style.color = "red"; return; }
    else limparErro(emailInput);

    if (mensagem.length < 5) { marcarErro(msgInput); feedback.textContent = " Escreva pelo menos 5 caracteres."; feedback.style.color = "red"; return; }
    else limparErro(msgInput);

    feedback.textContent = " Enviando...";
    botao.disabled = true;

    try {
      // 🚀 Carregamento sob demanda: o Firestore só desce pela rede neste milissegundo exato
      const { getFirestore, doc, setDoc, serverTimestamp } = await import(
        "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js"
      );
      const { app } = await import("./firebase-app.js");
      const db = getFirestore(app);

      const agora = new Date();
      const dd = String(agora.getDate()).padStart(2, "0");
      const mm = String(agora.getMonth() + 1).padStart(2, "0");
      const yy = String(agora.getFullYear()).slice(-2);
      const hh = String(agora.getHours()).padStart(2, "0");
      const mi = String(agora.getMinutes()).padStart(2, "0");
      const ss = String(agora.getSeconds()).padStart(2, "0");
      const docId = `CONTATO_${dd}-${mm}-${yy}_${hh}-${mi}-${ss}`;

      await setDoc(doc(db, "feedbacks", docId), {
        nome,
        email,
        telefone: telefone || "Não informado",
        mensagem,
        createdAt: serverTimestamp(),
      });

      feedback.textContent = "Mensagem enviada com sucesso!";
      feedback.style.color = "green";
      form.reset();
    } catch (err) {
      console.error("Erro ao enviar contato:", err);
      feedback.textContent = "Erro ao enviar. Tente novamente.";
      feedback.style.color = "red";
    } finally {
      botao.disabled = false;
    }
  });
});