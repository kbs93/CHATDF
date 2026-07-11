

//=================== PAINEL DE CORES DO TEXTO (UI) ======================================================

// ------ STORAGE CONTROLADO -------
const USER_COLOR_KEY = "chatdf_user_color";
// ----------- COR INTERNA PROTEGIDA ----------
let selectedColor = "#000000";
let colorLocked = false;
let _secureColor = selectedColor;
// ELEMENTOS
const messageInput = document.getElementById("messageInput");
const colorBtn = document.getElementById("colorBtn");
const colorPanel = document.getElementById("colorPanel");
const grid = document.getElementById("dynamicColors");
// GARANTE PRETO INICIAL
if (messageInput) {
  messageInput.style.color = "#000000";
}

// PALETA de CORES 
export const textColorPalette = [
  "#0D1B2A","#1B263B","#274060","#2C3E50","#34495E",
  "#003049","#1F3A5F","#0A2540","#102A43","#1E3A8A",
  "#0F766E","#065F46","#064E3B","#e3eaa7","#86af49",
  "#134E4A","#0F3D3E","#1C4532","#2F4F4F","#004D40",
  "#3B0764","#4C1D95","#5B21B6","#6D28D9","#312E81",
  "#7F1D1D","#991B1B","#7C2D12","#78350F","#4E342E",
  "#1F2937","#111827","#27272A","#3F3F46","#4B5563",
  "#00b300","#01a37b","#cc00cc","#e67300","#996633",
  "#cc0052","#d84d4d","#ff9966","#999900","#86b300",
  "#e60000","#000000","#3399ff","#590085","#800066",
  "#00a6c9","#7a66a3","#80bfff","#1a4c8c","#00cce0",
  "#006666","#660033","#266073","#4794b2","#6bb2ad",
  "#5c5c7a","#555532","#82ffab","#b2ad7f","#a2b9bc",
  "#6b5b95","#c1946a","#c4b7a6","#f7786b","#50394c",
  "#b2b2b2","#618685","#625750","#bd9441","#7e4a35",
  "#d4ac6e","#FFBB00",
  "<br>"
];
const palette = textColorPalette;
window.textColorPalette = textColorPalette;
// RENDERIZA PALETA
if (grid) {
  palette.forEach(color => {
    if (!color || color === "<br>") return;

    const box = document.createElement("div");
    box.className = "color-box";
    box.style.backgroundColor = color;
    box.dataset.color = color;

    const check = document.createElement("span");
    check.className = "color-check";
    check.textContent = "✔";

    box.appendChild(check);
    grid.appendChild(box);
  });
}

// SELECIONAR COR
// ================= SELECIONAR COR =================
// ================= SELECIONAR COR =================
document.addEventListener("click", (e) => {
  const box = e.target.closest(".color-box");
  if (!box) return;

  if (colorLocked) return;

  const color = box.dataset.color;
  selectedColor = color;
  _secureColor = color;

  if (messageInput) messageInput.style.color = color;

  localStorage.setItem(USER_COLOR_KEY, color);

  document.querySelectorAll(".color-box").forEach(b => {
    b.classList.remove("selected");
    b.style.opacity = "0.5";
  });

  box.classList.add("selected");
  box.style.opacity = "1";

  colorLocked = true;
});


// ================= FECHAR PAINEL AO CLICAR FORA (PROTEGIDO) 21-06-26=================
document.addEventListener("click", (e) => {
  if (!colorPanel?.classList.contains("show")) return;

  // Se o clique foi no próprio painel, no botão dele, ou em elementos de controle do chat, ignora
  if (
    colorPanel.contains(e.target) || 
    colorBtn?.contains(e.target) || 
    e.target.closest("#colorBtn") ||
    e.target.closest("#attachBtn")
  ) return;

  colorPanel.classList.remove("show");
  colorPanel.style.display = "none";
});

// BOTAO X
document.getElementById("closeColorPanel")?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation(); 
  colorPanel.classList.remove("show");
  colorPanel.style.display = "none";
});

// ================================== BOTAO COR DO TEXTO — MOBILE ==================================================
export function openColorPanel() {
  if (!colorPanel) return;

  colorPanel.style.display = "block";
  requestAnimationFrame(() => {
    colorPanel.classList.add("show");
  });
}
// =============================== BOTAO COR DO TEXTO — DESKTOP ======================================================
colorBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();

  if (window.closeAllPanels) {
    window.closeAllPanels();
  }

  const open = colorPanel.classList.contains("show");

  if (open) {
    closeColorPanel();
  } else {
    colorPanel.style.display = "block";
    requestAnimationFrame(() => {
      colorPanel.classList.add("show");
    });
  }
});

// RESTAURA COR SALVA
const storedColor = localStorage.getItem(USER_COLOR_KEY);
if (storedColor) {
  selectedColor = storedColor;
  _secureColor = storedColor;
  colorLocked = true;

  if (messageInput) messageInput.style.color = storedColor;

  document.querySelectorAll(".color-box").forEach(b => {
    if (b.dataset.color === storedColor) {
      b.classList.add("selected");
      b.style.opacity = "1";
    } else {
      b.style.opacity = "0.5";
    }
  });
}

// USADO PELO messages.js
window.getSelectedColor = () => selectedColor;

// BLOQUEIO VIA CONSOLE
Object.defineProperty(window, "selectedColor", {
  get() {
    return _secureColor;
  },
  set() {
    console.warn("Alteração bloqueada");
  }
});
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

// Destaca @menções como "badges cor do nome do usuario dentro da menção"
export function highlightMentions(text) {
  return text.replace(/@(\w+)/g, (_, nome) => {
    const cor = getColorFromName(nome);
    return `<span class="mention-badge" style="background-color:${cor};">@${nome}</span>`;
  });
}

// ================================================= Gera cor consistente com base no nome ============================
export function getColorFromName(name) {
  // BLINDAGEM OBRIGATÓRIA
  if (!name || typeof name !== "string") {
    return "#000000"; // cor padrão segura
  }

  // cores do nome do usuario ao fazer login 
  const palette = [
  "#1E88E5", // azul forte
  "#D32F2F", // vermelho
  "#388E3C", // verde
  "#7B1FA2", // roxo
  "#F57C00", // laranja
  "#0097A7", // ciano
  "#C2185B", // rosa escuro
  "#512DA8", // roxo azulado
  "#00796B", // verde petróleo
  "#5D4037", // marrom

  "#1976D2", // azul clássico
  "#E53935", // vermelho vivo
  "#43A047", // verde médio
  "#8E24AA", // violeta
  "#FB8C00", // laranja claro
  "#00ACC1", // azul piscina
  "#D81B60", // pink
  "#3949AB", // azul índigo
  "#00897B", // verde água
  "#6D4C41", // marrom claro

  "#1565C0", // azul escuro
  "#B71C1C", // vinho
  "#2E7D32", // verde escuro
  "#6A1B9A", // roxo fechado
  "#EF6C00", // laranja queimado
  "#00838F", // teal escuro
  "#AD1457", // rosa vinho
  "#283593", // azul noturno
  "#00695C", // verde fechado
  "#4E342E", // marrom escuro

  "#0D47A1", // azul profundo
  "#C62828", // vermelho fechado
  "#1B5E20", // verde floresta
  "#4A148C", // roxo profundo
  "#E65100", // laranja escuro
  "#006064", // ciano profundo
  "#880E4F", // magenta escuro
  "#1A237E", // azul petróleo
  "#004D40", // verde petróleo escuro
  "#3E2723"  // marrom profundo
  
];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  } return palette[Math.abs(hash) % palette.length];
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
function isSticker(text) { return /\.(png|jpg|jpeg|webp|gif)$/i.test(text.trim());}
// Detecta vídeo YouTube
function extractYouTubeId(url) {
  const match = url.match(/(?:youtu\.be\/|v=)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// Caixa estilo WhatsApp
// showReplyPreview e responsavel pelas mensagem, menção, responder no chat 16-02-26
// quantidade de linha na menção 
// 
export function showReplyPreview(msgId, msgText, author, authorAvatar = "./img/avatar.png") {
  let preview = document.getElementById("replyPreview");

  // BLINDAGEM: se o preview já estiver aberto, não recalcula
  if (preview && preview.style.display === "inline-flex") {
    return;
  }

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
    shortText = "";
  }

  // VÍDEO YOUTUBE
  const ytId = extractYouTubeId(msgText);
  if (ytId) {
    const thumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    mediaHTML = `<img src="${thumb}">`;
    shortText = " ";
  }

  // EMOJI GRANDE (1 emoji apenas)
  if (/^\p{Emoji}$/u.test(msgText)) {
    shortText = msgText;
  }

  // COR DO USUÁRIO
  const userColor = getColorFromName(author);

  // Sanitização simples do link do avatar
  const safeAvatar = authorAvatar && authorAvatar.trim() !== "" ? authorAvatar : "./img/avatar.png";

  // ================= HTML do preview bota X  aqui muda  o comportamento do sticker dentro=================

// ================= HTML do preview bota X  aqui muda  o comportamento do sticker dentro=================
preview.innerHTML = `
  <div class="reply-info" style="display: flex; flex-direction: row; align-items: flex-start; gap: 10px; width: 100%; padding: 4px 0;">
    <img src="${safeAvatar}" class="reply-user-avatar" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; flex-shrink: 0; margin-top: 2px;" onerror="this.src='./img/avatar.png'">
    <div style="display: flex; flex-direction: column; flex-grow: 1; overflow: hidden;">
      <div class="reply-author">${author}</div>
      ${mediaHTML}
      <div class="reply-text" style="font-size: 0.88rem; color: #444a54;">${shortText}</div>
    </div>
  </div>

  <span class="close-reply">✕</span>
`;
  // CORES da mencao VIA CSS 
  const authorEl = preview.querySelector(".reply-author");
  if (authorEl) {
    authorEl.style.setProperty("--author-color", userColor);
  }

  preview.style.setProperty("--reply-bg-color", userColor);
  preview.style.setProperty("--reply-border-color", userColor);

  // EXIBE PREVIEW 
  preview.style.display = "inline-flex";
  window.replyingTo = msgId;

  //  CONTROLE DE texto grande botao de ler mais dentro da menção 
  const replyTextEl = preview.querySelector(".reply-text");

  // Só aplica para TEXTO PURO (sem imagem / vídeo)
  if (replyTextEl && !mediaHTML) {
    // Aguarda o browser calcular layout
    requestAnimationFrame(() => {
      const lineHeight = parseFloat(
        getComputedStyle(replyTextEl).lineHeight
      );
      const maxLines = 3;//linha na menção
      const maxHeight = lineHeight * maxLines;
      // força estado recolhido
      replyTextEl.classList.remove("expanded");
      if (replyTextEl.scrollHeight > maxHeight) {
        const toggle = document.createElement("span");
        toggle.className = "reply-toggle";
        toggle.textContent = "ver mais";

        toggle.onclick = () => {
          replyTextEl.classList.toggle("expanded");
          toggle.textContent =
            replyTextEl.classList.contains("expanded")
              ? "ver menos"
              : "ver mais";
        };
        replyTextEl.after(toggle);
      }
    });
  }
  // FECHAR PREVIEW 
  preview.querySelector(".close-reply").onclick = () => {
    preview.style.display = "none";
    preview.innerHTML = "";
    window.replyingTo = null;
  };
}

// =========================================================== 26-02-2026 ========
// BOTTOM SHEET – CONTROLE GLOBAL (MOBILE)
// NÃO REMOVE NADA EXISTENTE – SOMENTE EXTENSÃO
// ===================================================================

let bottomSheetState = {
  open: false,
  type: null
};

// detecta modo mobile
function isMobileMode() {
  return window.innerWidth <= 768;
}



// garante existência do bottom sheet
function ensureBottomSheet() {
  let sheet = document.getElementById("bottomSheet");

  if (!sheet) {
    sheet = document.createElement("div");
    sheet.id = "bottomSheet";
    sheet.className = "bottom-sheet hidden";

    sheet.innerHTML = `
      <div class="bottom-sheet-header">
        <span class="bottom-sheet-title"></span>
        <span class="bottom-sheet-close">✕</span>
      </div>
      <div class="bottom-sheet-content"></div>
    `;

    document.body.appendChild(sheet);
    // fechar
    sheet
      .querySelector(".bottom-sheet-close")
      .addEventListener("click", closeBottomSheet);
  }

  return sheet;
}

// ===========================================================
// FECHAR BOTTOM SHEET QUANDO O INPUT RECEBER FOCO (DEFINITIVO)
// FUNCIONA MESMO SE O SHEET COBRIR O INPUT
// ===========================================================

document.addEventListener(
  "focusin",
  (e) => {
    if (!isMobileMode()) return;

    const sheet = document.getElementById("bottomSheet");
    if (!sheet || sheet.classList.contains("hidden")) return;

    if (e.target && e.target.id === "messageInput") {
      closeBottomSheet();
    }
  },
  true
);

//===========================================================================================
// =============================  BOTAO SHEET  ==============================================
//===========================================================================================
// abre bottom sheet (somente mobile)
export function openUIPanel(type) {
  if (!isMobileMode()) return;
  const sheet = ensureBottomSheet();
  const title = sheet.querySelector(".bottom-sheet-title");
  const content = sheet.querySelector(".bottom-sheet-content");
  bottomSheetState.open = true;
  bottomSheetState.type = type;
  title.textContent = getBottomSheetTitle(type);

  // conteúdo real será injetado depois
  content.innerHTML = "";

//   ANEXOS (MOBILE) 
if (type === "attach") {
  const grid = document.createElement("div");
  grid.className = "bottom-sheet-attachments";

  const actions = [
    { key: "gallery", label: "Galeria" },
    { key: "camera", label: "Câmera" },
    { key: "documento", label: "Documento" },
    { key: "location", label: "Localização" },
    { key: "contact", label: "Contato" },
    { key: "audio", label: "Áudio" },
    { key: "poll", label: "Enquete" },
    { key: "event", label: "Evento" },
    { key: "ai", label: "IA" }
  ];

  actions.forEach(({ key, label }) => {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.onclick = () => {
      closeBottomSheet();
      window.attachmentActions?.[key]?.();
    };
    grid.appendChild(btn);
  });
  content.appendChild(grid);
  return;
}
  sheet.classList.remove("hidden");
  sheet.classList.add("open");

//  INJETAR CONTEÚDO (MOBILE) 
if (type === "emoji") {
  // cria container de emojis no bottom sheet
  const emojiContainer = document.createElement("div");
  emojiContainer.id = "bottomEmojiList";
  emojiContainer.className = "emoji-list";
  content.appendChild(emojiContainer);
  // chama renderEmojis do painel existente
  if (window.renderEmojis) {
    window.renderEmojis(emojiContainer);
  }
}

// STICKERS (MOBILE) 
if (type === "stickers") {
  const stickerContainer = document.createElement("div");
  stickerContainer.id = "bottomStickerList";
  stickerContainer.className = "sticker-list";
  content.appendChild(stickerContainer);
  if (window.renderStickers) {
    window.renderStickers("all", stickerContainer);
  }
}

//  CONTEÚDO DO BOTTOM SHEET (MOBILE)
content.innerHTML = "";
// cria seletor interno
const selector = document.createElement("div");
selector.className = "bottom-sheet-selector";


const btnEmoji = document.createElement("button");
btnEmoji.textContent = "Emojis";

const btnSticker = document.createElement("button");
btnSticker.textContent = "Stickers";

const btnAnim = document.createElement("button");
btnAnim.textContent = "Animações";

// 📱 Mobile → não adiciona Emoji
if (window.innerWidth <= 768) {
  selector.append(btnSticker, btnAnim);
} else {
  selector.append(btnEmoji, btnSticker, btnAnim);
}




content.appendChild(selector);
// container de conteúdo
const body = document.createElement("div");
body.className = "bottom-sheet-body"; // 🔥 separação real
content.appendChild(body);
// helper para trocar conteúdo
function setActive(activeBtn) {
  [btnEmoji, btnSticker, btnAnim].forEach(b =>
    b.classList.toggle("active", b === activeBtn)
  );
}
// ações
btnEmoji.onclick = () => {
  setActive(btnEmoji);
  body.classList.remove("bottom-sheet-grid");
  body.innerHTML = "";
  if (window.renderEmojis) window.renderEmojis(body);
};
btnSticker.onclick = () => {
  setActive(btnSticker);
  body.classList.add("bottom-sheet-grid");
  body.innerHTML = "";
  if (window.renderStickers) window.renderStickers("all", body);
};
btnAnim.onclick = () => {
  setActive(btnAnim);
  body.classList.add("bottom-sheet-grid");
  body.innerHTML = "";
  if (window.renderAnimations) window.renderAnimations("all", body);
};
// ocultando escondendo o emoji no modo mobile 12-05-26 
if (window.innerWidth <= 768) {
  btnSticker.onclick();
} else {
  if (type === "stickers") btnSticker.onclick();
  else if (type === "animations") btnAnim.onclick();
  else btnEmoji.onclick();
}

//  container de categorias (recriado conforme o modo)  CATEGORIA 
let categoriesBar = null;
function mountCategories(categories, onSelect) {
  if (categoriesBar) categoriesBar.remove();
  categoriesBar = document.createElement("div");
  categoriesBar.className = "bottom-sheet-categories";
  categories.forEach((cat, idx) => {
    const btn = document.createElement("button");
    btn.textContent = cat.label;
    btn.classList.toggle("active", idx === 0);
    btn.onclick = () => {
      [...categoriesBar.children].forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      onSelect(cat.value);
    };
    categoriesBar.appendChild(btn);
  });
  content.insertBefore(categoriesBar, body);
}

btnEmoji.onclick = () => {
  setActive(btnEmoji);
  if (categoriesBar) categoriesBar.remove();
  body.classList.remove("bottom-sheet-grid");
  body.innerHTML = "";
  window.renderEmojis?.(body);
};
btnSticker.onclick = () => {
  setActive(btnSticker);
  body.classList.add("bottom-sheet-grid");
  body.innerHTML = "";

  // categorias de stickers (reaproveita as existentes)
  const stickerCats = Array.from(document.querySelectorAll(".sticker-cat"))
    .map(btn => ({ label: btn.textContent, value: btn.dataset.cat }));
  mountCategories(stickerCats, (cat) => {
    body.innerHTML = "";
    window.renderStickers?.(cat, body);
  });
  window.renderStickers?.("all", body);
};

btnAnim.onclick = () => {
  setActive(btnAnim);
  body.classList.add("bottom-sheet-grid");
  body.innerHTML = "";
  // categorias de animações (reaproveita as existentes)
  const animCats = Array.from(document.querySelectorAll(".anim-cat"))
    .map(btn => ({ label: btn.textContent, value: btn.dataset.cat }));
  mountCategories(animCats, (cat) => {
    body.innerHTML = "";
    window.renderAnimations?.(cat, body);
  });
  window.renderAnimations?.("all", body);
};


/* UX: garante que o usuário veja o sheet abaixo do input */
requestAnimationFrame(() => {
  sheet.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

} // FIM DA function export function openUIPanel




// fecha bottom botao sheet
function closeBottomSheet() {
  const sheet = document.getElementById("bottomSheet");
  if (!sheet) return;

  bottomSheetState.open = false;
  bottomSheetState.type = null;

  sheet.classList.remove("open");
  sheet.classList.add("hidden");
  document.body.style.overflow = "";
}

// títulos por tipo
function getBottomSheetTitle(type) {
  switch (type) {
    case "emoji": return "Figurinhas";
    case "stickers": return "Stickers";
    case "animations": return "Animações";
    case "color": return "Cor do texto";
    case "attach": return "Anexo";
    case "profile": return "Meu perfil";
    default: return "";
  }
}

window.attachmentActions = window.attachmentActions || {};
window.openProfilePanel = () => {
  window.attachmentActions?.profile?.();
};



// ============================= REUTILIZAR PAINEL DE ANEXOS NO BOTTOM SHEET (MOBILE) ======================================================
export function openAttachmentSheet() {
  if (window.innerWidth > 768) return;
  const sheet = ensureBottomSheet();
  const title = sheet.querySelector(".bottom-sheet-title");
  const content = sheet.querySelector(".bottom-sheet-content");
  title.textContent = "Anexo";
  content.innerHTML = "";
  // reutiliza o painel REAL do desktop
  const desktopPanel = document.getElementById("attachmentPanel");
  if (!desktopPanel) {
    console.warn("attachmentPanel não encontrado");
    return;
  }

  // clona para não quebrar o desktop
// clona SEM herdar layout de desktop
const clone = desktopPanel.cloneNode(true);
// remove IDs duplicados
clone.id = "attachmentPanelMobile";
// limpa classes problemáticas
clone.className = "attachment-panel mobile";
// força layout mobile
clone.style.display = "grid";
clone.style.gridTemplateColumns = "repeat(3, 1fr)";
clone.style.gap = "12px";
clone.style.padding = "12px";
// remove posicionamento absoluto do desktop
clone.style.position = "static";
clone.style.left = "auto";
clone.style.top = "auto";
clone.style.transform = "none";
content.appendChild(clone);

// ======================================= REATIVAR CLIQUES DOS BOTÕES (MOBILE) ======================================================
clone.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;

  // COR DO TEXTO
  if (action === "color") {
    closeBottomSheet();
    openColorPanel();
    return;
  }

  // SUGESTÃO / IA
  if (action === "ai") {
    closeBottomSheet();
    document.getElementById("feedbackModal")?.classList.remove("hidden");
    return;
  }

  // MEU PERFIL
  if (action === "profile") {
    closeBottomSheet();
    window.attachmentActions?.profile?.();
    return;
  }

  // DEMAIS AÇÕES
  if (window.attachmentActions?.[action]) {
    closeBottomSheet();
    window.attachmentActions[action]();
  }
});




  sheet.classList.remove("hidden");
  sheet.classList.add("open");

  /* UX: garante que o usuário veja o sheet abaixo do input */
sheet.scrollIntoView({
  behavior: "smooth",
  block: "start"
});

}// fim da export function openAttachmentSheet


// padronizando 17-03-26 
export function closeColorPanel() {
  if (!colorPanel) return;
  colorPanel.classList.remove("show");
  colorPanel.style.display = "none";
}
window.closeColorPanel = closeColorPanel;