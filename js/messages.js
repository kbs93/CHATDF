import { db } from './firebase-config.js';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

import { currentUser } from "./auth.js";
import { showToast, getColorFromName, highlightMentions } from "./ui.js";
import { showReplyPreview } from "./ui.js";   // ⭐ IMPORTANTE ⭐

// =================== STATE ===========================================================================
window.replyingTo = null;    // ⭐ Agora global, e não some
let chatRef = null;
let renderedMessages = new Set();

let floodCount = 0;
let floodResetTimeout = null;
let ultimaMensagem = "";
let repetidas = 0;

//======================= ID ORGANIZADO  =============================================================
function gerarIdISO() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  const localISO = `${yyyy}-${mm}-${dd}_${hh}:${min}:${ss}`;
  const rand = Math.random().toString(36).substring(2, 8);
  return `${localISO}_BRT_${rand}`;
}

// ================================  HELPERS  ==========================================================
const isSticker = (text) => /\.(png|webp|jpg|jpeg|gif)$/i.test(text.trim());

function extractYouTubeId(url) {
  const match = url.match(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}
// ------------------  Função da data e hora que aparece no site --------------------------------------
function formatTimestamp(ts) {
  if (!ts) return "";
  const d = ts.toDate();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} 
${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")} `;
}
function renderPlainMessage(msg) {
  const highlighted = highlightMentions(msg.text);
  const long = msg.text.length > 200;
  const color = msg.color || "#000000";

  if (long) {
    return `
      <span class="msg-text" style="color:${color};">${highlighted}</span>
      <button class="toggle-expand">Mostrar mais</button>`;
  }
  return `<span style="white-space:pre-wrap;color:${color};">${highlighted}</span>`;
}
function renderSticker(url) {
  return `<img src="${url.trim()}" alt="sticker" class="sticker-img" draggable="false">`;
}
function renderYouTube(id) {
  const thumb = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  return `
    <div class="youtube-preview" data-video="${id}">
      <img src="${thumb}" alt="YouTube thumbnail" class="youtube-thumb">
      <div class="youtube-play">&#9658;</div>
    </div>
  `;
}

async function renderReply(msg) {
  if (!msg.replyTo) return "";
  try {
    const repliedDoc = await getDoc(doc(chatRef, msg.replyTo));
    if (!repliedDoc.exists()) return "";
    const d = repliedDoc.data();
    const color = getColorFromName(d.user);
    let content = "";
    if (isSticker(d.text)) {
      content = renderSticker(d.text);}
    else {
      const ytId = extractYouTubeId(d.text);
      if (ytId) {
        const thumb = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
        content = `
          <div class="youtube-reply-thumb" data-video="${ytId}">
            <img src="${thumb}" alt="YouTube" class="youtube-thumb">
          </div>
        `;
      } else {
        const short = d.text.length > 200 ? d.text.slice(0, 190) + "..." : d.text;// edita a parte de menção de usuario no desktop
        content = `<div class="quoted-text">${short}</div>`;
      }
    }

    return `
      <div class="quoted-reply-box" style="border-left:4px solid ${color};">
        <div class="quoted-header" style="color:${color};"><strong>${d.user}</strong></div>
        ${content}
      </div>
    `;

  } catch (err) {
    console.warn("Erro carregar reply:", err);
    return "";
  }
}

// =====================INIT LISTENER DE MENSAGENS =======================================================
export function initMessages(chat, sala) {
  // 🔒 PROTEÇÃO TOTAL (evita erro no GitHub)
  if (!chat) {
    console.warn("initMessages: container de chat não encontrado");
    return;
  }

  renderedMessages = new Set();
  chat.innerHTML = ""; // agora é seguro

  chatRef = collection(db, "salas", sala, "messages");

  // ================== FILTRO POR DIAS ==================
  const dias = 4;
  const limite = new Date();
  limite.setDate(limite.getDate() - dias);

  const q = query(
    chatRef,
    where("createdAt", ">=", limite),
    orderBy("createdAt")
  );

  // ================== SNAPSHOT ==================
  onSnapshot(q, (snapshot) => {
    const fragment = document.createDocumentFragment();

    snapshot.docChanges().forEach(async (change) => {
      if (change.type !== "added") return;

      const docSnap = change.doc;
      const msgId = docSnap.id;

      if (renderedMessages.has(msgId)) return;
      renderedMessages.add(msgId);

      const msg = docSnap.data();

      const timestamp = msg.createdAt
        ? formatTimestamp(msg.createdAt)
        : "";

      const userColor = getColorFromName(msg.user);
      const ytId = extractYouTubeId(msg.text);

      let content = "";
      if (isSticker(msg.text)) content = renderSticker(msg.text);
      else if (ytId) content = renderYouTube(ytId);
      else content = renderPlainMessage(msg);

      // ✅ AVATAR SEGURO (usuários antigos e novos)
      const avatar = msg.photo && msg.photo.startsWith("http")
        ? msg.photo
        : "img/avatar.png";

      const div = document.createElement("div");
      div.classList.add("message");
      div.dataset.id = msgId;

      div.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;">
          <img 
            src="${avatar}" 
            class="user-photo"
            onerror="this.src='img/avatar.png'"
          >
          <b class="user-name" style="color:${userColor};cursor:pointer;">
            ${msg.user}:
          </b>
        </div>

        <div class="reply-container"></div>

        <div>${content}</div>
        <div class="message-time">${timestamp}</div>
      `;

      // ================== CLICK REPLY ==================
      div.addEventListener("click", (event) => {
        if (
          event.target.classList.contains("toggle-expand") ||
          event.target.closest(".quoted-reply-box") ||
          event.target.closest(".youtube-preview") ||
          event.target.closest(".youtube-reply-thumb") ||
          event.target.classList.contains("sticker-img")
        ) return;

        showReplyPreview(msgId, msg.text, msg.user);
      });

      fragment.appendChild(div);

      // ================== REPLY ==================
      if (msg.replyTo) {
        renderReply(msg).then(replyHTML => {
          const box = div.querySelector(".reply-container");
          if (box && replyHTML) box.innerHTML = replyHTML;
        });
      }
    });

    chat.appendChild(fragment);
    chat.scrollTop = chat.scrollHeight;
  });
}

// ================= ENVIO — AGORA COM REPLY FUNCIONANDO =========================================================
export async function sendMessage(input) {
  const text = input.value.trim();
  if (!text) return;
if (floodCount >= 5) {showToast(" Aguarde um instante.");return;} // usuario so pode enviar 5 mensagens rapido 
// Incrementa contador
floodCount++;
// Reseta contador automaticamente em 1 minuto
if (!floodResetTimeout) {
  floodResetTimeout = setTimeout(() => {
    floodCount = 0;
    floodResetTimeout = null;
  }, 60000); // 60.000 ms = 1 minuto
}
  // Flood / validações (mantido exatamente como você tinha) HTML
  const htmlPattern = /<[^>]*>/g;
  if (htmlPattern.test(text)) {showToast("Não é permitido este tipo de mensagens.");
    return;
  }
  if (!currentUser) {showToast("Faça login para enviar mensagens.");
    return;
  }
if (bloqueiaTelefone(text)) {showToast("Não é permitido enviar número de celular.");
  return;
}

//BLOQUEIA NUMERO DO TELEFONE
function bloqueiaTelefone(text) {
  // Remove tudo que não for número
  const nums = text.replace(/\D/g, "");
  // Caso 1: telefone sem DDD (9 dígitos começando com 9)
  if (/^9\d{8}$/.test(nums)) {
    return true;}
  // Caso 2: telefone com DDD (11 dígitos começando com 9 depois do DDD)
  if (/^\d{2}9\d{8}$/.test(nums)) {
    return true;}
  // Caso 3: telefones com formatação comum (+55 opcional)
  const padrao = /(\+?55)?\s*\(?\d{0,2}\)?\s*9\d{4}[-\s]?\d{4}/;
  if (padrao.test(text)) {
    return true;}
  return false;
}
if (bloqueiaTelefone(text)) {
  showToast(" Não é permitido enviar número de celular.");
  return;
}

// BLOQUEIA RG
function bloqueiaRG(text) {
  const padraoRG = /\b\d{2}\.?\d{3}\.?\d{3}-?[0-9Xx]\b/;
  return padraoRG.test(text);
}
//BLOQUEIA SPAM 
// bloqueia textos aleatórios como "asdasdasdasd"
// bloqueia 3 mensagens iguais seguidas

function bloqueiaSpam(text) {
  if (text === ultimaMensagem) {
    repetidas++;
  } else {
    repetidas = 0;
    ultimaMensagem = text;
  }

  // Texto sem sentido repetitivo (ex: asdasdasdasd)
  if (/^[a-zA-Z]{8,}$/.test(text)) return true;
  // Três mensagens idênticas em sequência (contando a atual)
  if (repetidas >= 2) return true;

  return false;
}
if (bloqueiaRG(text)) {
  showToast("RG não é permitido no chat.");
  return;
}
if (bloqueiaSpam(text)) {showToast("Envia uma mensagem correta.");
  return;
}

// Bloqueio de scripts ocultos
const dangerousPatterns = ["javascript:","onerror=","onload=","<script","data:text/html","data:text/javascript","vbscript:","base64"];
const lower = text.toLowerCase();
for (const p of dangerousPatterns) {
  if (lower.includes(p)) {
    showToast("Nao e permitido esse tipo de mensagem.");
    return;
  }
}
//  Bloqueio de mensagens gigantes
// Limite: 720 caracteres (recomendado)
// Pode aumentar/diminuir conforme seu chat
if (text.length > 720) {
  showToast(" Texto muito grande! ");
  return;
}

// Bloqueio extremo de segurança:
// Impede travamento mesmo com tentativas maliciosas
if (text.length > 1000) {
  showToast(" Mensagem excessivamente longa bloqueada.");
  return;
}

  const youtubeId = extractYouTubeId(text);
  if (/https?:\/\//.test(text) && !youtubeId) {
    showToast("Apenas links do YouTube são permitidos.");
    return;
  }

  try {
    const userColorChoice =
      window.getSelectedColor ? window.getSelectedColor() : "#000000";
    const idOrganizado = gerarIdISO();
    // TIMESTAMP PROVISÓRIO (mostrar imediatamente)
const now = new Date();
    await setDoc(doc(chatRef, idOrganizado), {
      user: currentUser.displayName,
      photo: currentUser.photoURL,
      text,
      color: userColorChoice,
      createdAt: serverTimestamp(),
      replyTo: window.replyingTo || null,
    });
    // LIMPAR UI — não remove mais a caixa!
    input.value = "";
    window.replyingTo = null;
//  MOSTRA A HORA IMEDIATAMENTE APÓS O ENVIO
setTimeout(() => {
  const lastTime = document.querySelector(".message:last-child .message-time");
  if (lastTime) {
    const now = new Date();
    lastTime.textContent = formatTimestamp({ toDate: () => now });
  }
}, 30);
    const preview = document.getElementById("replyPreview");
    if (preview) preview.style.display = "none";
    document.querySelector("emoji-picker")?.remove();
   setTimeout(() => {
  if (input) {   // Só executa se existir
    input.style.height = "44px";
  }
}, 10);
  } catch (err) {
    console.error(err);
    showToast("Erro ao enviar: " + err.message);
  }
}

// ======================================================
// EVENTOS
// ======================================================
window.addEventListener("resize", () => {
  const vh = window.innerHeight * 0.01;
  document.body.style.setProperty("--vh", `${vh}px`);
});
document.addEventListener("click", (e) => {
  const preview = e.target.closest(".youtube-preview, .youtube-reply-thumb");
  if (preview) {
    const videoId = preview.dataset.video;
    window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank");
  }
});
