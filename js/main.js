// ======================================================
//  IMPORTS
// ======================================================
import { initAuth } from "./auth.js";
import { initMessages, sendMessage } from "./messages.js";
import { showToast } from "./ui.js";
import { stickers } from "./stickers.js";
// ======================================================
// DOM ELEMENTS
// ======================================================
const chat = document.getElementById("chat-container");
const input = document.getElementById("messageInput");
const sendBtn = document.getElementById("sendBtn");
const loginBtn = document.getElementById("loginBtn");
const emojiBtn = document.getElementById("emojiBtn");
const stickerBtn = document.getElementById("stickerBtn");
const stickerPanel = document.getElementById("stickerPanel");
const stickerList = document.getElementById("stickerList");
// ======================================================
// SALA DA URL
// ======================================================
// ===============================
// SALA PELA URL
// ===============================
const sala =
  new URLSearchParams(window.location.search).get("sala") || "geral";

document.title = `Chat - ${sala}`;

// ===============================
// AUTH (PODE RODAR EM QUALQUER PÁGINA)
// ===============================
initAuth(showToast);

// ===============================
// CHAT (SÓ SE EXISTIR NO HTML)
// ===============================
const chatContainer = document.getElementById("chat-container");

if (chatContainer) {
  initMessages(chatContainer, sala);
}




// =====================================================
// BOTÃO ENVIAR
// ======================================================
sendBtn.onclick = () => sendMessage(input);
// ENTER PARA ENVIAR
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage(input);
  }
});
// ======================================================
// EXPANDIR TEXTO (Mostrar mais / menos)
// ======================================================
chat.addEventListener("click", (e) => {
  if (e.target.classList.contains("toggle-expand")) {
    const textEl = e.target.previousElementSibling;
    if (textEl && textEl.classList.contains("msg-text")) {
      const expanded = textEl.classList.toggle("expanded");
      textEl.style.maxHeight = expanded ? "none" : "4.5em";
      e.target.textContent = expanded ? "Mostrar menos" : "Mostrar mais";
    }
  }
});
// ======================================================
// EMOJIS
// ======================================================
emojiBtn?.addEventListener("click", () => {
  let picker = document.querySelector("emoji-picker");

  if (picker) {
    picker.style.animation = "fadeOutDown 0.25s ease forwards";
    setTimeout(() => picker.remove(), 200);
  } else {
    import("https://cdn.jsdelivr.net/npm/emoji-picker-element@^1/index.js").then(() => {
      picker = document.createElement("emoji-picker");
      picker.setAttribute("data-theme", "light");
      picker.style.position = "fixed";
      picker.style.bottom = "62px";
      picker.style.right = "10px";
      picker.style.zIndex = 2000;
      picker.style.maxHeight = "250px";
      picker.style.overflowY = "auto";
      picker.style.animation = "fadeInUp 0.25s ease forwards";
      picker.addEventListener("emoji-click", (e) => {
        input.value += e.detail.unicode;
      });
      document.body.appendChild(picker);
    });
  }
});
// ======================================================
// FIGURINHAS 
// ======================================================
if (stickerBtn && stickerPanel && stickerList) {
  stickerBtn.addEventListener("click", () => {
    const isVisible = stickerPanel.classList.contains("show");
    if (isVisible) {
      stickerPanel.classList.remove("show");
      stickerPanel.classList.add("hide");
      setTimeout(() => {
        stickerPanel.style.display = "none";
        stickerPanel.classList.remove("hide");
      }, 200);
    } else {
      stickerPanel.style.display = "block";
      stickerPanel.classList.add("show");
    }
  });
  stickers.forEach((url) => {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "sticker";
    img.style.width = "60px";
    img.style.cursor = "pointer";
    img.onclick = async () => {
      try {
        await sendMessage({ value: url }); // simula input com valor = figurinha
      } catch (err) {console.error("Erro ao enviar figurinha:", err);}
      stickerPanel.classList.remove("show");
      stickerPanel.classList.add("hide");
      setTimeout(() => {
        stickerPanel.style.display = "none";
        stickerPanel.classList.remove("hide");
      }, 200);
    };
    stickerList.appendChild(img);
  });
}
// ======================================================
// FECHAR PAINÉIS AO CLICAR FORA
// ======================================================
document.addEventListener("click", (e) => {
  const emojiPicker = document.querySelector("emoji-picker");
  const clickInsideEmoji =
    emojiBtn.contains(e.target) ||
    (emojiPicker && emojiPicker.contains(e.target));
  const clickInsideSticker =
    stickerBtn.contains(e.target) ||
    stickerPanel.contains(e.target);
  // Fechar figurinhas
  if (!clickInsideSticker && stickerPanel.style.display === "block") {
    stickerPanel.classList.remove("show");
    stickerPanel.classList.add("hide");
    setTimeout(() => {
      stickerPanel.style.display = "none";
      stickerPanel.classList.remove("hide");
    }, 200);
  }
  // Fechar emojis
  if (!clickInsideEmoji && emojiPicker) {
    emojiPicker.style.animation = "fadeOutDown 0.25s ease forwards";
    setTimeout(() => emojiPicker.remove(), 200);
  }
});
// ======================================================
// DETECTAR TECLADO MOBILE
// ======================================================
(function handleKeyboardMobile() {
  const detectKeyboard = () => {
    if (window.innerWidth <= 768) {
      const vh = window.innerHeight;
      const body = document.body;
      if (vh < 500) body.classList.add("keyboard-open");
      else body.classList.remove("keyboard-open");
    }
  };
  window.visualViewport?.addEventListener("resize", detectKeyboard);
  window.addEventListener("resize", detectKeyboard);
})();
// ======================================================
// TEXTAREA AUTO-RESIZE
// ======================================================
const messageInput = document.getElementById("messageInput");

function autoResize() {
  messageInput.style.height = "auto";
  messageInput.style.height = `${messageInput.scrollHeight}px`;
}
messageInput.addEventListener("input", autoResize);
// Reset após envio
export function resetMessageInput() {
  messageInput.removeEventListener("input", autoResize);
  messageInput.value = "";
  messageInput.style.height = "44px";
  requestAnimationFrame(() => {
    messageInput.addEventListener("input", autoResize);
  });
}







