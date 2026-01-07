// ui.js

// EDITA todos os aviso que aparece no chat 
export function showToast(message, type = "error") {
  const toast = document.createElement("div");
  toast.className = `custom-toast ${type}`;
  toast.innerHTML = `
    <span class="icon"></span>
    <span>${message}</span>
  `;

  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 200);
  }, 2000);
}

// Destaca @menções como "badges"
export function highlightMentions(text) {
  return text.replace(/@(\w+)/g, (_, nome) => {
    const cor = getColorFromName(nome);
    return `<span class="mention-badge" style="background-color:${cor};">@${nome}</span>`;
  });
}

// Gera cor consistente com base no nome
export function getColorFromName(name) {

  // BLINDAGEM OBRIGATÓRIA
  if (!name || typeof name !== "string") {
    return "#000000"; // cor padrão segura
  }

  const palette = [
    "#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#f1c40f", "#e67e22", "#1abc9c", "#ff69b4",
    "#5e5b34ff", "#95a5a6", "#014134ff", "#d35400", "#8e44ad", "#27ae60", "#f39c12", "#7a0234ff",
    "#c0392b", "#bdc3c7", "#07998dff", "#7f8c8d", "#ff7f50", "#03a0c7ff", "#00ced1", "#ffa500",
    "#009688", "#00a500ef", "#558000", "#001c77ff", "#ff9800", "#795548", "#334d00", "#00994d"
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return palette[Math.abs(hash) % palette.length];
}

// Faz scroll automático, só se estiver no fim
export function scrollToBottom(container) {
  const nearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 150;
  if (nearBottom) {
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }
}

//========================= MOSTRAR PRÉVIA DE RESPOSTA (igual WhatsApp) FOI ADICIONADO DIA 28-11-25  ===================================
// Detecta sticker
function isSticker(text) {
  return /\.(png|jpg|jpeg|webp|gif)$/i.test(text.trim());
}

// Detecta vídeo YouTube
function extractYouTubeId(url) {
  const match = url.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// Caixa estilo WhatsApp
export function showReplyPreview(msgId, msgText, author) {
  let preview = document.getElementById("replyPreview");

  if (!preview) {
    preview = document.createElement("div");
    preview.id = "replyPreview";
    preview.className = "reply-preview";
    document.body.appendChild(preview);
  }

  let mediaHTML = "";
  let shortText = msgText;

  // STICKER
  if (isSticker(msgText)) {
    mediaHTML = `<img src="${msgText}">`;
    shortText = "&#9829;";
  }

  // VÍDEO YOUTUBE
  const ytId = extractYouTubeId(msgText);
  if (ytId) {
    const thumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    mediaHTML = `<img src="${thumb}">`;
    shortText = "&#9829;";
  }

  // EMOJI GRANDE (se tiver 1 emoji)
  if (/^\p{Emoji}$/u.test(msgText)) {
    shortText = msgText;
  }
  preview.innerHTML = `
    ${mediaHTML}

    <div class="reply-info">
      <div class="reply-author">${author}</div>
      <div class="reply-text">${shortText}</div>
    </div>

    <span class="close-reply">✕</span>
  `;



//  FORÇA a cor do FUNDO pelo NOME do usuário
const userColor = getColorFromName(author);

// fundo sólido (sem transparência)
preview.style.backgroundColor = userColor;

// texto sempre legível
preview.style.color = "#ffffff";

// detalhe lateral opcional
preview.style.borderLeft = `4px solid ${userColor}`;




  preview.style.display = "inline-flex";
  window.replyingTo = msgId;

  preview.querySelector(".close-reply").onclick = () => {
    preview.style.display = "none";
    window.replyingTo = null;
  };
}

