import { db } from './firebase-config.js';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  where,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  limitToLast,
  deleteDoc,
  getCountFromServer,
  limit
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { currentUser } from "./auth.js";
import { showToast, getColorFromName, highlightMentions } from "./ui.js";
import { showReplyPreview } from "./ui.js";


// =================== STATE ========================================================
window.replyingTo = null;
window.isUserReading = false;
window.newMessagesCount = 0;

let isInitialLoad = true;
let chatRef = null;
let renderedMessages = new Set();
let unsubscribeCurrentMessages = null;
const historyListeners = new Set();
let currentMountedRoom = null;
let currentMountedChat = null;

const MESSAGES_CACHE_PREFIX = "chatdf_messages_cache_v1:";
const USER_AREA_CACHE_KEY = "chatdf_user_area_cache";
const DEFAULT_AVATAR = "./img/avatar.png";
// ================= MAPEAMENTO DE SALAS ================= 18-05-26  
 // mapear nomes de salas para IDs, para evitar problemas com caracteres especiais e facilitar mudanças futuras
const ROOM_ALIASES = {
  "Bate papo Geral": "geral",
  "Religiao": "religiao",
  "Politica": "politica",
  "Transito": "transito",
  "Lugares para sair": "lugares",
  "Futebol": "futebol",
  "Eventos": "eventos",
  "Entretenimento": "entretenimento"
};

function normalizeRoomId(room) {
  return ROOM_ALIASES[room] || room || "geral";
}

// CONTROLE DE HISTÓRICO de mensagem de dias no chat 
let diaAtualChat = new Date();
let carregandoHistorico = false;
let diasCarregados = 1;


// CACHE / ESTADO
const replyCache = new Map();
const messagesState = [];
const messagesMap = new Map();

// CONTROLES DE ENVIO
let floodCount = 0;
let floodResetTimeout = null;
// CONTROLE DE DENÚNCIA (COOLDOWN)
let ultimaDenunciaTime = 0;

// =================== HELPERS VISUAIS ========================================================
function sanitizeMessageAvatar(photo) {
  if (!photo || typeof photo !== "string") return DEFAULT_AVATAR;

  const trimmed = photo.trim();

  if (trimmed.includes("127.0.0.1") || trimmed.includes("localhost")) {
    return DEFAULT_AVATAR;
  }

  return trimmed;
}

function getCachedUserArea() {
  try {
    const raw = sessionStorage.getItem(USER_AREA_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.warn("Não foi possível ler cache visual do usuário:", err);
    return null;
  }
}

function resolveUserVisualProfile(userProfile = {}, currentUserData = null) {
  const cachedUserArea = getCachedUserArea();

  const profileName =
    userProfile.nome ||
    userProfile.name ||
    userProfile.displayName ||
    cachedUserArea?.profileName ||
    currentUserData?.displayName ||
    "Usuário";

  const profilePhoto = sanitizeMessageAvatar(
    userProfile.foto ||
    userProfile.avatar ||
    userProfile.photoURL ||
    cachedUserArea?.profilePhoto ||
    currentUserData?.photoURL
  );
//01-05-26
  const profileCity =
  userProfile.cidade ||
  userProfile.city ||
  "";

return { profileName, profilePhoto, profileCity };
}

function getMessagesCacheKey(sala) {
  return `${MESSAGES_CACHE_PREFIX}${sala}`;
}

function setChatLoading(isLoading) {
  document.body.classList.toggle("chat-loading", Boolean(isLoading));
}


// 10-06-26 EDITA o botao de denuncia dentro do reply 
// EDITA o botão do reply: Lixeira para mensagem própria / Bandeira para mensagem de terceiros
function bindMessageReplyClick(div, msgId, msg) {
div.addEventListener("click", (event) => {
    // Busca o dado atualizado no Map ou verifica se a mensagem está excluída/ocultada
    const msgAtualizada = messagesMap.get(msgId) || msg;
    const temClasseOculta = div.querySelector(".msg-hidden") !== null;
    const isExcluida = msgAtualizada.deleted === true || div.classList.contains("deleted-message-node");
    const isOcultada = temClasseOculta || (msgAtualizada.denunciasContador && msgAtualizada.denunciasContador >= 1);

    // BLOQUEIA O REPLY SE A MENSAGEM ESTIVER EXCLUÍDA OU OCULTADA
    if (isExcluida || isOcultada) return;

    if (
      event.target.classList.contains("toggle-expand") ||
      event.target.closest(".quoted-reply-box") ||
      event.target.closest(".youtube-preview") ||
      event.target.closest(".youtube-reply-thumb")
    ) return;

    if (!window.replyingTo) {

      // Garantia de ocultação de texto no reply
      const ehLottie = !isOcultada && typeof msgAtualizada.text === "string" && msgAtualizada.text.trim().endsWith(".json");
      const idLottiePreview = "lottie-preview-" + Math.random().toString(36).substring(2, 11);
      
      const textoPassado = isOcultada
        ? `<span class="msg-hidden" style="font-style: italic; font-size: 1rem; font-weight: 400;"><i class="bi bi-emoji-frown"> Mensagem ocultada..</i></span>`
        : (ehLottie 
            ? `<div id="${idLottiePreview}" style="width: 32px; height: 32px; display: inline-block; vertical-align: middle;"></div>` 
            : msgAtualizada.text);

      
      showReplyPreview(msgId, textoPassado, msg.user, msg.photo || msg.avatar);
      if (ehLottie) {
        requestAnimationFrame(() => {
          if (typeof window.renderizarEmojiLottie === "function") {
            window.renderizarEmojiLottie(idLottiePreview, msg.text.trim());
          }
        });
      }
const preview = document.getElementById("replyPreview");
      if (preview) {
        const antigoBtn = preview.querySelector(".reply-report-action");
        if (antigoBtn) antigoBtn.remove();

        // Identifica se a mensagem pertence ao usuário atualmente logado
        const isMinhaMensagem = currentUser && (currentUser.uid === msg.uid);

        const actionBtn = document.createElement("span");
        actionBtn.className = "reply-report-action";

        // Função auxiliar para fechar a prévia suavemente sem dar tranco no scroll
        const fecharPreviewSuave = () => {
          preview.style.transition = "opacity 0.15s ease";
          preview.style.opacity = "0";
          setTimeout(() => {
            preview.style.display = "none";
            preview.style.opacity = "1";
            preview.innerHTML = "";
            window.replyingTo = null;
          }, 150);
        };

        if (isMinhaMensagem) {
          // ICONE DE LIXEIRA PARA MENSAGEM PRÓPRIA
          actionBtn.setAttribute("title", "Excluir mensagem");
          actionBtn.innerHTML = `<i class="bi bi-trash" style="color: #000000; font-size:20px;"></i>`;
          actionBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            try {
              const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");
              const msgDocRef = doc(db, "salas", window.salaAtual, "messages", msgId);

              // Fecha suavemente a prévia de resposta antes de atualizar no Firebase
              fecharPreviewSuave();

              // Soft Delete: Atualiza o status da mensagem sem apagar o documento do banco
              await updateDoc(msgDocRef, {
                deleted: true,
                text: "Mensagem excluída"
              });

              showToast("Mensagem excluída");
            } catch (err) {
              console.error("Erro ao excluir mensagem:", err);
              showToast("Erro ao excluir mensagem.");
            }
          });



        } else {
          // DENUNCIA ICONE DE BANDEIRA PARA MENSAGENS DE OUTROS USUÁRIOS
          actionBtn.setAttribute("title", "Denunciar mensagem");
          actionBtn.innerHTML = `<i class="bi bi-flag-fill"><span style="color: #00000063; font-size:0.82rem;">Denunciar mensagem</span></i>`;
          
          actionBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();

            if (actionBtn.classList.contains("reported")) return;

            const agora = Date.now();
            const tempoEspera = 180000; // 3 minutos
            const ultimaDenuncia = window.lastReportTime || 0;
            const tempoPassado = agora - ultimaDenuncia;

            if (tempoPassado < tempoEspera) {
              showToast(`Aguarde um instante.`);
              return;
            }

            try {
              const { doc, updateDoc, arrayUnion, increment, getDoc } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");
              const { auth } = await import("./firebase-config.js");

              const user = auth.currentUser;
              if (!user) {
                showToast("Faça login para denunciar.");
                return;
              }

              const msgDocRef = doc(db, "salas", window.salaAtual, "messages", msgId);
              const snapshot = await getDoc(msgDocRef);
              
              if (snapshot.exists()) {
                const data = snapshot.data();
                const denunciantes = data.denunciadoPor || [];

                if (denunciantes.includes(user.uid)) {
                  showToast("Você já denunciou esta mensagem.");
                  actionBtn.classList.add("reported");
                  return;
                }
              }

              await updateDoc(msgDocRef, {
                denunciasContador: increment(1),
                denunciadoPor: arrayUnion(user.uid)
              });

              window.lastReportTime = Date.now();

              // Atualiza o texto visual mantendo a caixa firme sem alterar a estrutura do reply
              actionBtn.classList.add("reported");
              actionBtn.innerHTML = `<i class="bi bi-pin-angle-fill"></i>`; 
              
              // Fecha a caixa suavemente após a denúncia ser concluída
              fecharPreviewSuave();
              showToast("Mensagem denunciada.");

            } catch (err) {
              console.error("Erro ao registrar denúncia:", err);
              showToast("Erro ao processar denúncia.");
            }
          });
        }
        preview.appendChild(actionBtn);
      }
    }
  });
}
function createMessageElement(msgId, msg, timestamp = "") {
  const div = document.createElement("div");
  div.classList.add("message");
  div.dataset.id = msgId;
  div.dataset.uid = msg.uid || msg.user;

  const userColor = msg.vipNameColorSolid || msg.vipNameColor || "#1E293B";
  const ytId = extractYouTubeId(msg.text);
  const avatar = sanitizeMessageAvatar(msg.photo || msg.avatar);
  const cidade = msg.replyTo ? "" : (msg.cidade || msg.city || "");

  let content = "";
  const idUnicoLottie = "lottie-" + Math.random().toString(36).substring(2, 11);

// Se a mensagem estiver excluída, altera apenas o texto interno sem injetar classe externa
  if (msg.deleted === true) {
    content = `
      <div class="msg-deleted-box">
        <i class="bi bi-ban" style="font-size: 0.9rem; color: #a0a0a0;"></i>
        <span style="font-size:0.92rem; font-style: italic; color: #888;">Mensagem excluída</span>
      </div>
    `;
  } else if (msg.denunciasContador && msg.denunciasContador >= 1) {
    content = renderPlainMessage(msg);
  } else if (isSticker(msg.text)) {
    if (msg.text.trim().endsWith(".json")) {
      content = `<div id="${idUnicoLottie}" class="sticker-img" style="width: 30px; height: 30px; display: inline-block;" draggable="false"></div>`;
    } else {
      content = renderSticker(msg.text);
    }
  } else if (ytId) {
    content = renderYouTube(ytId);
  } else {
    content = renderPlainMessage(msg);
  }

  if (msg.user === "Kbsweb") {
    div.classList.add("admin-message");
  }

  // Monta sempre o cabeçalho com foto, nome e cidade para manter o clustering estável
  div.innerHTML = `
  <div class="message-click-area" style="display:flex;align-items:center;gap:6px;">
    <img 
      src="${avatar}" 
      class="user-photo"
      onerror="this.src='./img/avatar.png'"
    >

    <div class="message-user-info">
      <div class="message-header">
        <b class="user-name message-author-name" style="color:${userColor};cursor:pointer;">
          ${msg.user}${msg.user === "Kbsweb" ? "&nbsp Adm" : ""}:
        </b>
      </div>
      ${cidade ? `<span class="user-city"><i class="icon-cidade bi bi-geo-alt"></i> ${cidade}</span>` : ""}
    </div>
  </div>

  <div class="reply-container"></div>

  <div>${content}</div>
  <div class="message-time">${timestamp}</div>
  `;

  if (isSticker(msg.text) && msg.text.trim().endsWith(".json") && !msg.deleted && !(msg.denunciasContador && msg.denunciasContador >= 1)) {
    requestAnimationFrame(() => {
      if (typeof window.renderizarEmojiLottie === "function") {
        window.renderizarEmojiLottie(idUnicoLottie, msg.text.trim());
      }
    });
  }

  bindMessageReplyClick(div, msgId, msg);

  const clickArea = div.querySelector(".message-click-area");
  if (clickArea) {
    clickArea.addEventListener("click", (e) => {
      e.stopPropagation();

      const menu = document.getElementById("messageContextMenu");
      if (!menu) return;

      const rect = clickArea.getBoundingClientRect();
      const menuWidth = 170;
      const margin = 8;

      let left = rect.left;
      let top = rect.bottom + 6;

      if (left < margin) left = margin;
      if (left + menuWidth > window.innerWidth - margin) {
        left = window.innerWidth - margin - menuWidth;
      }

      menu.style.left = left + "px";
      menu.style.top = top + "px";
      menu.classList.remove("hidden");

      menu.dataset.msgId = msgId;
      menu.dataset.uid = msg.uid || "";
      menu.dataset.user = msg.user;
      menu.dataset.text = msg.text;
    });
  }

  return div;
}






// fechar mini menu ao clicar fora 06-05-26
document.addEventListener("click", () => {
  const menu = document.getElementById("messageContextMenu");
  if (menu) {
    menu.classList.add("hidden");
  }

  document.querySelectorAll(".message").forEach(m => {
    m.classList.remove("show-actions");
  });
});
// botao x dentro do mini menu 
const closeBtn = document.getElementById("closeContextMenu");

if (closeBtn) {
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    const menu = document.getElementById("messageContextMenu");
    if (menu) {
      menu.classList.add("hidden");
    }
  });
}

function saveMessagesCache(sala, chat) {
  if (!chat || !sala) return;

  try {
    const items = [...chat.querySelectorAll(".message[data-id]")]
      .map((el) => {
        const id = el.dataset.id;
        const msg = messagesMap.get(id);
        if (!id || !msg) return null;

        return {
          id,
          msg,
          timestamp: el.querySelector(".message-time")?.textContent || ""
        };
      })
      .filter(Boolean);

    sessionStorage.setItem(getMessagesCacheKey(sala), JSON.stringify(items));
  } catch (err) {
    console.warn("Não foi possível salvar cache das mensagens:", err);
  }
}

function restoreMessagesCache(chat, sala) {
  if (!chat || !sala) return false;

  try {
    const raw = sessionStorage.getItem(getMessagesCacheKey(sala));
    if (!raw) return false;

    const cachedItems = JSON.parse(raw);
    if (!Array.isArray(cachedItems) || !cachedItems.length) return false;

    const fragment = document.createDocumentFragment();
    const pendingReplies = [];

    renderedMessages = new Set();
    replyCache.clear();
    messagesState.length = 0;
    messagesMap.clear();

    cachedItems.forEach(({ id, msg, timestamp }) => {
      if (!id || !msg) return;

      const safeMsg = {
        ...msg,
        text: typeof msg.text === "string" ? msg.text : ""
      };

      renderedMessages.add(id);

      replyCache.set(id, {
        user: safeMsg.user,
        text: safeMsg.text,
        photo: safeMsg.photo,
        color: safeMsg.color
      });

      const fullMsg = { id, ...safeMsg };

      messagesState.push(fullMsg);
      messagesMap.set(id, fullMsg);

      const div = createMessageElement(id, safeMsg, timestamp);
//15-05-26 edita o formato do timestamp para mostrar data e hora em linhas separadas, 
// facilitando a extração para a função de remoção de mensagens expiradas
      const createdAtMs =
  safeMsg.createdAt?.seconds
    ? safeMsg.createdAt.seconds * 1000
    : Date.now();



div.setAttribute(
  "data-created-at",
  createdAtMs
);
      
      fragment.appendChild(div);

      if (safeMsg.replyTo) {
        pendingReplies.push({ msg: safeMsg, div });
      }
    });

    chat.replaceChildren(fragment);
    chat.scrollTop = chat.scrollHeight;
    applyClustering(); // AGRUPANDO AS MENSAGEM Aplica o visual agrupado no cache 09-06-26


    pendingReplies.forEach(({ msg, div }) => {
      renderReply(msg).then((replyHTML) => {
        const box = div.querySelector(".reply-container");
        if (box && replyHTML) box.innerHTML = replyHTML;
      });
    });

    return true;
  } catch (err) {
    console.warn("Não foi possível restaurar cache das mensagens:", err);
    return false;
  }
}

function cleanupMessageListeners() {
  if (typeof unsubscribeCurrentMessages === "function") {
    unsubscribeCurrentMessages();
    unsubscribeCurrentMessages = null;
  }

  historyListeners.forEach((unsub) => {
    if (typeof unsub === "function") unsub();
  });

  historyListeners.clear();
}


// AGRUPANDO AS MENSAGEM 09-06-26 nova função para aplicar agrupamento visual de mensagens do mesmo usuário enviadas em sequência, 
// ignorando mensagens de outros usuários no meio e considerando o minuto de envio para evitar agrupamento de mensagens enviadas com muito tempo de diferença
function applyClustering() {
  // Pega todas as mensagens renderizadas na tela
  const msgs = document.querySelectorAll(".message");
  let lastUid = null;
  let lastTimeMin = null;

  msgs.forEach((el) => {
    const currentUid = el.dataset.uid;
    
    // Extrai o tempo exato do atributo que você já criou (data-created-at)
    const timestampMs = Number(el.getAttribute("data-created-at")) || 0;
    const dateObj = new Date(timestampMs);
    // Cria uma string no formato "YYYY-MM-DD-HH-MM" (ignora os segundos)
    const currentMinute = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}-${dateObj.getHours()}-${dateObj.getMinutes()}`;

    // Se o UID for igual ao anterior E o minuto for o mesmo, agrupa!
    if (currentUid && currentUid === lastUid && currentMinute === lastTimeMin) {
      el.classList.add("is-grouped");
    } else {
      el.classList.remove("is-grouped");
    }

    // Atualiza as variáveis para comparar com a próxima mensagem do loop
    lastUid = currentUid;
    lastTimeMin = currentMinute;
  });
}



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
  const localISO = `${yyyy}-${mm}-${dd}_${hh}:${min}:${ss}.${ms}`;
  const rand = Math.random().toString(36).substring(2, 8);

  return `${localISO}_BRT_${rand}`;
}

function formatarDia(d) {
  const pad = (n) => n.toString().padStart(2, "0");

  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());

  return `${yyyy}-${mm}-${dd}`;
}

function getDiaAtual() {
  const d = new Date();
  const pad = (n) => n.toString().padStart(2, "0");

  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());

  return `${yyyy}-${mm}-${dd}`;
}

// ================================ HELPERS ==========================================================


const isSticker = (text = "") => /\.(png|webp|jpg|jpeg|gif|json)$/i.test(String(text).trim());

function extractYouTubeId(url = "") {
  const match = String(url).match(
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function formatTimestamp(ts) {
  if (!ts) return "";
  const d = ts.toDate();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} 
${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")} `;
}

// 10-06-26 edita o Botao de denuncia dentro do reply 
/*Renderização Inicial (Quando o Chat Carrega ou Atualiza do Zero)
O que faz: É a função responsável por montar o HTML das mensagens de texto comum. Quando o chat abre, ele verifica se a mensagem tem denunciasContador >= 1.
Resultado: Se a mensagem já possui 1 denúncia no banco, ele renderiza na tela o texto: 
"[Mensagem ocultada..]". Se não tiver denúncia, exibe o texto normal da mensagem. */

function renderPlainMessage(msg) {
  if (msg.deleted === true) {
    return `
      <div class="msg-deleted-box-fixed">
        <i class="bi bi-ban"></i>
        <span>Mensagem excluída</span>
      </div>
    `;
  }
  if (msg.denunciasContador && msg.denunciasContador >= 1) {
    return `<span class="msg-hidden" style=" font-style: italic; font-size: 1rem; font-weight: 400;"><i class="bi bi-emoji-frown"> Mensagem ocultada..</i></span>`;
  }
  const long = msg.text.length > 200;
  const color = msg.color || "#1E293B";
  if (long) {
    return `
      <span class="msg-text" style="color:${color};">${msg.text}</span>
      <button class="toggle-expand">Ler mais</button>`;
  }
  return `<span style="white-space:pre-wrap;color:${color};">${msg.text}</span>`;
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

function toRGBA(color, alpha = 0.15) {
  const el = document.createElement("span");
  el.style.color = color;
  document.body.appendChild(el);

  const rgb = getComputedStyle(el).color;
  document.body.removeChild(el);

  return rgb.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
}


//================== Edita os emoji ANIMADOS dentro do reply  adicionando o JSON LITTE  23-06-26 ======================
async function renderReply(msg) {
  if (!msg.replyTo) return "";
  let d = replyCache.get(msg.replyTo);
  if (!d) {
    try {
      const salaDefinida = window.salaAtual || "geral";
      const msgDocRef = doc(db, "salas", salaDefinida, "messages", msg.replyTo);
      
      const repliedDoc = await getDoc(msgDocRef);
      if (!repliedDoc.exists()) return "";

      d = repliedDoc.data();
      replyCache.set(msg.replyTo, d);
    } catch (err) {
      console.warn("Erro carregar reply:", err);
      return "";
    }
  }

  let color = msg.replyUserColor || msg.replyColor || null;
  if (!color) {
    const messageEl = document.querySelector(`[data-id="${msg.replyTo}"]`);
    if (messageEl) {
      const nameEl = messageEl.querySelector(".user-name");
      if (nameEl) {
        color = getComputedStyle(nameEl).color;
      }
    }
  }
  if (!color) color = "#3f3f3f";
  let content = "";
  const idUnicoReplyLottie = "lottie-reply-" + Math.random().toString(36).substring(2, 11);
  if (isSticker(d.text)) {
    if (d.text.trim().endsWith(".json")) {
      // EDITA O tamanho do emoji dentro do reply para 35px 10-06-26
      content = `<div id="${idUnicoReplyLottie}" class="sticker-img" style="width: 30px; height: 30px; display: inline-block;"></div>`;
      requestAnimationFrame(() => {
        if (typeof window.renderizarEmojiLottie === "function") {
          window.renderizarEmojiLottie(idUnicoReplyLottie, d.text.trim());
        }
      });
    } else {
      content = renderSticker(d.text);
    }
    
  } 
  
  // edita a borda o reply ao responde o usuario
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
      const short = d.text.length > 200 ? d.text.slice(0, 190) + "..." : d.text;
      content = `<div class="quoted-text reply-text">${short}</div>`;
    }
  }
  // 04-07-26  EDITAR  usuário respondido NO CAMPO DO CHAT REPLY e a foto 
const bg = toRGBA(color, 0.17);
  const safeRepliedAvatar = d.photo || d.avatar || "./img/avatar.png";
return `
    <div class="quoted-reply-box"
         style="
           border-left: 4px solid ${color};
           display: inline-flex;
           flex-direction: row;
           align-items: flex-start;
           gap: 10px;
           padding: 6px 10px;
           width: fit-content;
           max-width: 100%;
           border-radius: 6px;
           margin-bottom: 6px;
         ">
      <img src="${safeRepliedAvatar}" class="reply-user-avatar" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; flex-shrink: 0; margin-top: 2px;" onerror="this.src='./img/avatar.png'">
      <div style="display: flex; flex-direction: column; overflow: hidden; flex-grow: 1; text-align: left;">
        <div class="quoted-header" style="color:${color}; font-weight: 600; font-size: .97rem; text-align: left; width: 100%; margin-bottom: 2px;">
          ${d.user}
        </div>
        <div style="display: flex; text-align: left; width: 100%;">
          ${content}
        </div>
      </div>
    </div>
  `;


}

// ================= PERFORMANCE limite de mensagens no DOM =================
const MAX_MESSAGES_DESKTOP = 150;
const MAX_MESSAGES_MOBILE = 100;

function getMaxMessages() {
  return window.innerWidth < 600 ? MAX_MESSAGES_MOBILE : MAX_MESSAGES_DESKTOP;
}

function trimMessages(chat) {
  const max = getMaxMessages();
  while (chat.children.length > max) {
    const first = chat.firstElementChild;
    if (!first) break;

    const id = first.dataset?.id;
    if (id) renderedMessages.delete(id);

    chat.removeChild(first);
  }
}


// ===================== INIT LISTENER DE MENSAGENS =======================================================
export function initMessages(chat, sala) {
    sala = normalizeRoomId(sala); // 18-05-26 normalizar o ID da sala para evitar problemas com caracteres especiais e facilitar mudanças futuras
  const isSameRoom =
    currentMountedRoom === sala &&
    currentMountedChat === chat;

  window.salaAtual = sala;

  cleanupMessageListeners();

  if (!chat) {
    console.warn("initMessages: container de chat não encontrado");
    return () => {};
  }

  setChatLoading(true);
  isInitialLoad = true;

// NOVA ESTRUTURA ACHATADA: Busca direto da sala, sem pastas de dias 28-05-26 
const chatRefAchatado = collection(db, "salas", sala, "messages");
  if (!isSameRoom) {
    diasCarregados = 1;
    diaAtualChat = new Date();

    const restoredFromCache = restoreMessagesCache(chat, sala);

    if (!restoredFromCache) {
      renderedMessages = new Set();
      replyCache.clear();
      messagesState.length = 0;
      messagesMap.clear();

      if (chat.children.length === 0) {
        chat.textContent = "";
      }
    }
  }

  currentMountedRoom = sala;
  currentMountedChat = chat;

// 27-06-26 Limite controlado dinamicamente para expansão em tempo real
  let limiteAtual = 50; 

  const obterQueryAtiva = () => query(
    chatRefAchatado,
    orderBy("createdAt"),
    limitToLast(limiteAtual)
  );

  let qAchatada = obterQueryAtiva();

//14-05-26 dias modelo de janela deslizantes 
//14-05-26 dias modelo de janela deslizantes 
const processSnapshot = (snapshot) => {
  const fragment = document.createDocumentFragment();
  const pendingReplies = [];
  let addedCount = 0;




snapshot.docChanges().forEach((change) => {
    // TRATAMENTO EM TEMPO REAL PARA REMOÇÃO DE MENSAGEM no CHAT (EXCLUI e  LIXEIRA)
    if (change.type === "removed") {
  const msgId = change.doc.id;
  const msgDiv = document.querySelector(`[data-id="${msgId}"]`);

  if (msgDiv && chat) {
    // 1. Captura a altura da mensagem e a posição do scroll antes de alterar a estrutura
    const alturaAntes = msgDiv.offsetHeight;
    const scrollAntes = chat.scrollTop;

    const timeDiv = msgDiv.querySelector(".message-time");
    const replyBox = msgDiv.querySelector(".reply-container");
    
    if (replyBox) replyBox.style.display = "none";
    if (timeDiv) timeDiv.style.display = "none"; // Esconde a hora para não empurrar o layout

    if (timeDiv && timeDiv.previousElementSibling) {
      timeDiv.previousElementSibling.innerHTML = `
        <div class="msg-deleted-box" style="display: flex; align-items: center; gap: 6px; color: #888; font-style: italic; margin-top: 2px; min-height: 24px;">
          <i class="bi bi-ban" style="font-size: 0.9rem; color: #a0a0a0;"></i>
          <span style="font-size:0.92rem;">Mensagem excluida</span>
        </div>
      `;
    }

    // 2. Calcula a nova altura e compensa no scroll instantaneamente para a tela não pular
    const alturaDepois = msgDiv.offsetHeight;
    const diferenca = alturaAntes - alturaDepois;
    if (diferenca > 0) {
      chat.scrollTop = scrollAntes - diferenca;
    }

    msgDiv.style.pointerEvents = "none";
  }

  replyCache.delete(msgId);
  messagesMap.delete(msgId);

  return;
}


    //TRATAMENTO EM MENSAGEM OCULTADA POR DENUNCIA (OCULTA O TEXTO E MANTÉM A ESTRUTURA DO REPLY)    
// TRATAMENTO EM MENSAGEM EXCLUIDA OU OCULTADA (ATUALIZA O CONTEÚDO SEM REMOVER A DIV DO DOM)
if (change.type === "modified") {
      const msgId = change.doc.id;
      const msgData = change.doc.data();
      const msgDiv = document.querySelector(`[data-id="${msgId}"]`);

      if (msgDiv) {
        if (msgData.deleted === true) {
          const replyBox = msgDiv.querySelector(".reply-container");
          if (replyBox) replyBox.style.display = "none";

          // Atualiza apenas a div do texto, preservando a foto e a estrutura intactas
          const bodyContent = msgDiv.children[2];
          if (bodyContent) {
            bodyContent.innerHTML = `
              <div class="msg-deleted-box">
                <i class="bi bi-ban" style="font-size: 0.9rem; color: #a0a0a0;"></i>
                <span style="font-size:0.92rem; font-style: italic; color: #888;">Mensagem excluída</span>
              </div>
            `;
          }
        } else if (msgData.denunciasContador && msgData.denunciasContador >= 1) {
          const textSpan = msgDiv.querySelector(".msg-text") || msgDiv.querySelector("span[style*='color']");
          if (textSpan) {
            textSpan.className = "msg-hidden";
            textSpan.style.color = "";
            textSpan.innerHTML = `<i class="bi bi-emoji-frown"></i> Mensagem ocultada..`;
          }
        }
      }
      return;
    }

    

    // 🔹 SUA LÓGICA ORIGINAL DE ADIÇÃO
    if (change.type !== "added") return;
    const docSnap = change.doc;
    const msgId = docSnap.id;
    if (renderedMessages.has(msgId)) return;
    renderedMessages.add(msgId);
    const raw = docSnap.data();
    const msg = {
      ...raw,
      text: typeof raw.text === "string"
        ? raw.text
        : ""
    };

    replyCache.set(msgId, {
      user: msg.user,
      text: msg.text,
      photo: msg.photo,
      color: msg.color
    });

    if (!messagesMap.has(msgId)) {
      const fullMsg = {
        id: msgId,
        ...msg
      };

      messagesState.push(fullMsg);
      messagesMap.set(msgId, fullMsg);
    }

    const timestamp = msg.createdAt
      ? formatTimestamp(msg.createdAt)
      : "";

    const div = createMessageElement(
      msgId,
      msg,
      timestamp
    );
    const createdAtMs =
  msg.createdAt?.toMillis?.()
  || (msg.createdAt?.seconds * 1000)
  || Date.now();


// 15-05-26 edita o formato do timestamp para mostrar data e hora em linhas separadas, 
// facilitando a extração para a função de remoção de mensagens expiradas
div.setAttribute(
  "data-created-at",
  createdAtMs
);

    fragment.appendChild(div);

    addedCount++;

    if (msg.replyTo) {
      pendingReplies.push({
        msg,
        div
      });
    }
  });

//14-05-26 dias modelo de janela deslizantes
if (addedCount > 0) {
  chat.appendChild(fragment);

  const msgs = [
    ...chat.querySelectorAll(".message")
  ];


msgs.sort((a, b) => {
    const timeA = Number(a.getAttribute("data-created-at")) || 0;
    const timeB = Number(b.getAttribute("data-created-at")) || 0;
    
    return timeA - timeB;
  });


  msgs.forEach(el => {
    chat.appendChild(el);
  });
  applyClustering(); // AGRUPANDO AS MENSAGEM Aplica o visual agrupado em tempo real 09-06-26
}


  if (!carregandoHistorico && addedCount > 0) {
    setTimeout(() => {
      window.smartScrollToBottom?.();
    }, isInitialLoad ? 0 : 80);
  }

  requestAnimationFrame(() => {
    trimMessages(chat);
  });

  pendingReplies.forEach(({ msg, div }) => {
    renderReply(msg).then((replyHTML) => {
      const box = div.querySelector(".reply-container");

      if (box && replyHTML) {
        box.innerHTML = replyHTML;
      }
    });
  });

  setTimeout(() => {
    saveMessagesCache(sala, chat);

    isInitialLoad = false;

    setChatLoading(false);
  }, 0);
};



// 28-05-26  Como o banco agora é unificado, não precisamos de fallback de "ontem"
let unsubCurrent = onSnapshot(qAchatada, (snapshot) => {
  processSnapshot(snapshot);
});

// CORREÇÃO 21-06-26 : Busca mensagens antigas de forma estática com getDocs para evitar refaturamento do onSnapshot
let mensagemMaisVelhaCarregada = null;

const paginacaoScroll = async () => {
  if (isInitialLoad || carregandoHistorico) return;
  
  // Executa a busca quando o scroll chega próximo ao topo (< 40px)
  if (chat.scrollTop <= 40) {
    const maxLimit = getMaxMessages();
    const totalRenderizadas = chat.querySelectorAll(".message").length;
    
    if (totalRenderizadas >= maxLimit) return;
    
    const primeiraMsgEl = chat.querySelector(".message");
    if (!primeiraMsgEl) return;
    
    const idPrimeira = primeiraMsgEl.dataset.id;
    const msgReferencia = messagesMap.get(idPrimeira);
    if (!msgReferencia || !msgReferencia.createdAt) return;
    
    const alturaAntes = chat.scrollHeight;
    const scrollPosAntes = chat.scrollTop;
    carregandoHistorico = true;
    
    try {
      limiteAtual += 30;
      qAchatada = obterQueryAtiva();
      
      // Mantém o ouvinte ativo e só re-executa a busca via snapshot ordenado sem recriar objetos do zero
      if (typeof unsubCurrent === "function") unsubCurrent();
      
      unsubCurrent = onSnapshot(qAchatada, (snapshot) => {
        processSnapshot(snapshot);
        
        // Mantém exatamente o nó de visualização travado
        requestAnimationFrame(() => {
          const alturaDepois = chat.scrollHeight;
          chat.scrollTop = scrollPosAntes + (alturaDepois - alturaAntes);
        });
      });
    } catch (errHist) {
      console.warn("Erro ao buscar histórico estático:", errHist);
    } finally {
      setTimeout(() => {
        carregandoHistorico = false;
      }, 300);
    }
  }
};



chat.addEventListener("scroll", paginacaoScroll);

unsubscribeCurrentMessages = () => {
  if (unsubCurrent) unsubCurrent();
  setChatLoading(false);
};



return () => {
    chat.removeEventListener("scroll", paginacaoScroll);
    saveMessagesCache(sala, chat);
    cleanupMessageListeners();
  };
}

// ================= ENVIO — AGORA COM REPLY FUNCIONANDO =========================================================
export async function sendMessage(input) {
  let text = input.value.trim(); // melhoria 03-05-26 
  if (!text) return;
// 03-05-26  (floodCount >= 4): Limite de 4 mensagens por minuto para evitar flood. Contagem é resetada a cada 60 segundos.
  if (floodCount >= 4) {
    showToast("Envio muito rápido, Aguarde um instante.");
    return;
  }
  floodCount++;
  if (!floodResetTimeout) {
    floodResetTimeout = setTimeout(() => {
      floodCount = 0;
      floodResetTimeout = null;
    }, 40000);// 40 segundos para resetar a contagem de mensagens enviadas, permitindo um pouco mais de flexibilidade sem ser tão restritivo quanto 1 minuto exato
  }
  const htmlPattern = /<[^>]*>/g;
  if (htmlPattern.test(text)) {
    showToast("Não é permitido este tipo de mensagens.");
    return;
  }
  if (!currentUser) {
    showToast("Faça login para enviar mensagens.");
    return;
  }

// ------------------------ BLOQUEAR ENVIO SEM PERFIL COMPLETO 11-05-26 --------------------------
const perfilRef = doc(db, "users", currentUser.uid);
const perfilSnap = await getDoc(perfilRef);
const userProfile = perfilSnap.exists() ? perfilSnap.data() : {};

if (userProfile.perfilCompleto !== true) {
  showToast("Complete seu perfil para enviar mensagens.");

  document.dispatchEvent(new CustomEvent("chatdf:open-profile"));

  return;
}


// -------------- SANITIZAÇÃO DE DADOS PESSOAIS 03-05-26  -----------------

// EMAIL
// EMAIL (mesmo sem .com, .br etc)
text = text.replace(
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\b/gi,
  "***"
);
// TELEFONE (formatos comuns)
text = text.replace(
  /(\+?55)?\s*\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}/g,
  "***"
);

// CPF (com ou sem pontuação)
text = text.replace(
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
  "***"
);

// -------- NORMALIZAÇÃO (anti-burlar com letras) 03-05-26 ---------------
const somenteNumeros = text.replace(/\D/g, "");

// se parecer telefone ou tentativa disfarçada
if (somenteNumeros.length >= 10) {
  text = text.replace(/\d/g, "*");
}
  function bloqueiaTelefone(text) {
    const nums = text.replace(/\D/g, "");

    if (/^9\d{8}$/.test(nums)) return true;
    if (/^\d{2}9\d{8}$/.test(nums)) return true;

    const padrao = /(\+?55)?\s*\(?\d{0,2}\)?\s*9\d{4}[-\s]?\d{4}/;
    if (padrao.test(text)) return true;

    return false;
  }

// TELEFONE → mascarar ao invés de bloquear 03-05-26
if (bloqueiaTelefone(text)) {
  text = text.replace(/\d/g, "*");
}

  const dangerousPatterns = [
    "javascript:",
    "onerror=",
    "onload=",
    "<script",
    "data:text/html",
    "data:text/javascript",
    "vbscript:",
    "base64"
  ];

  const lower = text.toLowerCase();

  for (const p of dangerousPatterns) {
    if (lower.includes(p)) {
      showToast("Nao e permitido esse tipo de mensagem.");
      return;
    }
  }

  if (text.length > 720) {
    showToast(" Texto muito grande! ");
    return;
  }

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
   // Se o usuário tiver cor VIP salva usa ela, senão padroniza como o grafite suave #1E293B
    const userColorChoice = userProfile?.vipMsgColor || "#1E293B";

    const idOrganizado = gerarIdISO();

    let replyUserColor = null;

    if (window.replyingTo) {
      const replyPreview = document.getElementById("replyPreview");
      replyUserColor = replyPreview?.dataset?.replyColor || null;
    }

   const { profileName, profilePhoto, profileCity } = resolveUserVisualProfile(
  userProfile,
  currentUser
);

    const finalPhoto = sanitizeMessageAvatar(
      userProfile?.foto ||
      userProfile?.avatar ||
      userProfile?.photoURL ||
      currentUser?.photoURL ||
      profilePhoto
    );
// 28-05-26 Salvando na nova estrutura achatada  NOVO BANCO DE DADOS 
    const chatRefAchatado = collection(
      db,
      "salas",
      normalizeRoomId(window.salaAtual),
      "messages"
    );
await setDoc(doc(chatRefAchatado, idOrganizado), {
  uid: currentUser.uid,
  user: profileName,
  cidade: profileCity,
  photo: finalPhoto,
  avatar: finalPhoto,
  text,
  color: userColorChoice,
  replyTo: window.replyingTo || null,
  replyColor: replyUserColor,
  createdAt: serverTimestamp(),
});

    /* ========================================================= 28-05-26 
Esse código faz uma limpeza automática de mensagens antigas no banco de dados para evitar acúmulo e reduzir custos, agindo assim:
Sorteio (Amostragem de 15%): Ele não roda sempre. Toda vez que uma mensagem é enviada, há uma chance de 15% (Math.random() < 0.15) de a limpeza ser ativada. 
Isso economiza leituras no Firebase.
Checagem de Limite: Ele conta o total de mensagens na sala. Se passar de 150 mensagens, ele calcula o excesso.
Exclusão: Ele busca as mensagens mais velhas daquela sala e deleta esse excesso do banco, mantendo o histórico sob controle de forma silenciosa
    // ========================================================= */
// =========================================================
    // FIREBASE FAXINA AUTOMÁTICA OTIMIZADA (Roda por amostragem de 10% para economizar cota de leitura) 21-06-26
    // =========================================================
    // FIREBASE FAXINA AUTOMÁTICA OTIMIZADA COM DELAY DE CONSOLIDAÇÃO
    if (Math.random() < 0.15) { // Aumentado levemente para 15% para garantir maior eficácia
      setTimeout(async () => {
        try {
          const snapshotCount = await getCountFromServer(chatRefAchatado);
          const totalMensagens = snapshotCount.data().count;

          if (totalMensagens > 150) {
            const excesso = totalMensagens - 150;
            const qMaisVelhas = query(chatRefAchatado, orderBy("createdAt", "asc"), limit(excesso));
            const docsMaisVelhos = await getDocs(qMaisVelhas);

            docsMaisVelhos.forEach((docSnap) => {
              deleteDoc(docSnap.ref);
            });
          }
        } catch (erroFaxina) {
          console.warn("Faxina em segundo plano ignorada:", erroFaxina);
        }
      }, 2000); // Aguarda 2 segundos para o carimbo de data (serverTimestamp) se consolidar no banco
    }



    // =========================================================
input.value = "";
    if (typeof input.focus === 'function') {
      input.focus();
    }
    window.replyingTo = null;

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

if (input && input.style) {
  input.style.height = "44px";
  
  requestAnimationFrame(() => {
    if (chat) {
      chat.scrollTo({
        top: chat.scrollHeight,
        behavior: isInitialLoad ? "auto" : "smooth"
      });
    }
  });
}

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

window.addEventListener("beforeunload", () => {
  const chat = document.getElementById("chat-container");
  if (chat && window.salaAtual) {
    saveMessagesCache(window.salaAtual, chat);
  }
});

document.addEventListener("click", (e) => {
  const preview = e.target.closest(".youtube-preview, .youtube-reply-thumb");
  if (preview) {
    const videoId = preview.dataset.video;
    window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank");
  }
});

// ======================================================
// BOTÃO NOVA MENSAGEM + SCROLL INTELIGENTE
// ======================================================
const chat = document.getElementById("chat-container");
const newMessagesBtn = document.getElementById("newMessagesBtn");


if (chat && newMessagesBtn) {
  const countEl = newMessagesBtn.querySelector(".msg-badge");
  window.newMessagesCount = Number(window.newMessagesCount) || 0;

  chat.addEventListener("scroll", () => {
    const nearBottom =
      chat.scrollHeight - chat.scrollTop - chat.clientHeight < 60;

    if (nearBottom) {
      window.isUserReading = false;
      newMessagesBtn.classList.add("hidden");
    } else {
      window.isUserReading = true;
    }


  });
// SEGREDO MOBILE: Impede que o botão roube o foco da tela ao ser tocado
newMessagesBtn.addEventListener("mousedown", (e) => e.preventDefault());
newMessagesBtn.addEventListener("touchstart", (e) => {
  e.preventDefault(); // Bloqueia o celular de fechar o teclado nativamente
  newMessagesBtn.click(); // Força a descida da tela
});

newMessagesBtn.addEventListener("click", () => {
  window.isUserReading = false;
  window.newMessagesCount = 0;

  if (countEl) {
    countEl.textContent = "";
    countEl.style.display = "none";
  }

  newMessagesBtn.classList.add("hidden");

  requestAnimationFrame(() => {

    chat.scrollTo({
      top: chat.scrollHeight,
      behavior: "auto"
    });
    //23-05-26 melhoria para garantir que o foco seja aplicado após o scroll, evitando que o teclado no mobile abra antes do scroll terminar
requestAnimationFrame(() => {

      const input =
        document.getElementById("messageInput");

      if (input) {
        
        // Bloqueia o foco automático no mobile para não abrir o teclado sozinho
        if (window.innerWidth > 768) {
          input.focus();

          const length = input.value.length;

          input.setSelectionRange(
            length,
            length
          );
        }
      }

    });

  });

});
  
  window.smartScrollToBottom = () => {
    if (!window.isUserReading) {
      requestAnimationFrame(() => {
        const lastMsg = chat.lastElementChild;
        if (!lastMsg) return;

        if (isInitialLoad) {
          chat.scrollTop = chat.scrollHeight;
        } else {

requestAnimationFrame(() => {
  const scrollFinal = () => {
    chat.scrollTop = chat.scrollHeight;
  };

  scrollFinal();
  requestAnimationFrame(scrollFinal);
  setTimeout(scrollFinal, 50);
  setTimeout(scrollFinal, 120);

});



 }});

      window.newMessagesCount = 0;

      if (countEl) {
        countEl.textContent = "";
        countEl.style.display = "none";
      }
    } else {
      window.newMessagesCount = Number(window.newMessagesCount) || 0;
      window.newMessagesCount += 1;

      if (window.newMessagesCount > 0) {
        if (countEl) {
          countEl.textContent = String(window.newMessagesCount);
          countEl.style.display = "block";
        }

        newMessagesBtn.classList.remove("hidden");
      } else {
        if (countEl) {
          countEl.textContent = "";
          countEl.style.display = "none";
        }

        newMessagesBtn.classList.add("hidden");
      }
    }
  };
}

// ===================FECHA BOTÃO SE CLICAR FORA============================================
document.addEventListener("click", (e) => {
  const btn = document.getElementById("newMessagesBtn");
  if (!btn) return;

  if (!btn.classList.contains("hidden") && !btn.contains(e.target)) {
    btn.classList.add("hidden");
  }
});

