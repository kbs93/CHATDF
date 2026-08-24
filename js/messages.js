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
import { formatarAutorVipChat } from "./vip.js";

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

/*====================================================================================================
Normaliza o nome da sala retornado do front-end para corresponder ao ID interno da coleção no banco
======================================================================================================== */
function normalizeRoomId(room) {
return ROOM_ALIASES[room] || room || "geral";
}

// CACHE / ESTADO
const replyCache = new Map();
const messagesState = [];
const messagesMap = new Map();

// CONTROLES DE ENVIO
let floodCount = 0;
let floodResetTimeout = null;
let ultimaDenunciaTime = 0;

// =================== HELPERS VISUAIS ========================================================
/*====================================================================================================
Sanitiza o avatar do usuário, aplicando o avatar padrão caso a foto seja inválida ou um link local
======================================================================================================== */
function sanitizeMessageAvatar(photo) {
/*====================================================================================================
Verifica se a foto é nula ou não é uma string válida
======================================================================================================== */
if (!photo || typeof photo !== "string") return DEFAULT_AVATAR;

const trimmed = photo.trim();

/*====================================================================================================
Bloqueia URLs de ambiente local (localhost/127.0.0.1) para evitar quebras no ambiente de produção
======================================================================================================== */
if (trimmed.includes("127.0.0.1") || trimmed.includes("localhost")) {
return DEFAULT_AVATAR;
}

return trimmed;
}

/*====================================================================================================
Lê os dados salvos em cache na sessionStorage referente à área do usuário logado
======================================================================================================== */
function getCachedUserArea() {
try {
const raw = sessionStorage.getItem(USER_AREA_CACHE_KEY);
return raw ? JSON.parse(raw) : null;
} catch (err) {
console.warn("Não foi possível ler cache visual do usuário:", err);
return null;
}
}

/*====================================================================================================
Consolida os dados do perfil visual do usuário buscando do perfil do banco, cache ou dados de auth
======================================================================================================== */
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

const profileCity =
userProfile.cidade ||
userProfile.city ||
"";

return { profileName, profilePhoto, profileCity };
}

/*====================================================================================================
Gera a chave de identificação do cache local de mensagens no sessionStorage baseado na sala atual
======================================================================================================== */
function getMessagesCacheKey(sala) {
return `${MESSAGES_CACHE_PREFIX}${sala}`;
}

/*====================================================================================================
Alterna a classe visual de carregamento no body durante transições de salas
======================================================================================================== */
function setChatLoading(isLoading) {
document.body.classList.toggle("chat-loading", Boolean(isLoading));
}
/*====================================================================================================
Associa o evento de clique na mensagem para acionar a janela de resposta (reply), exclusão ou denúncia
======================================================================================================== */
function bindMessageReplyClick(div, msgId, msg) {
  div.addEventListener("click", (event) => {
    const msgAtualizada = messagesMap.get(msgId) || msg;
    const temClasseOculta = div.querySelector(".msg-hidden") !== null;
    const isExcluida = msgAtualizada.deleted === true || msgAtualizada.text === "Mensagem excluída";
    const isOcultada = temClasseOculta || (msgAtualizada.denunciasContador && msgAtualizada.denunciasContador >= 1);

    /*====================================================================================================
    Bloqueia o acionamento da prévia de resposta se a mensagem estiver excluída ou ocultada
    ======================================================================================================== */
    if (isExcluida || isOcultada) return;

    /*====================================================================================================
    Ignora cliques em botões de expansão, caixas de citação e prévias de mídias/vídeos do YouTube
    ======================================================================================================== */
    if (
      event.target.classList.contains("toggle-expand") ||
      event.target.closest(".quoted-reply-box") ||
      event.target.closest(".youtube-preview") ||
      event.target.closest(".youtube-reply-thumb")
    ) return;


/*====================================================================================================
Se não houver uma resposta pendente no momento, ativa a caixa de prévia do reply
======================================================================================================== */
if (!window.replyingTo) {
const ehLottie = !isOcultada && typeof msgAtualizada.text === "string" && msgAtualizada.text.trim().endsWith(".json");
const idLottiePreview = "lottie-preview-" + Math.random().toString(36).substring(2, 11);

const textoPassado = isOcultada
? `<span class="msg-hidden" style="font-style: italic; font-size: 1rem; font-weight: 400;"><i class="bi bi-emoji-frown"> Mensagem ocultada..</i></span>`
: (ehLottie 
? `<div id="${idLottiePreview}" style="width: 32px; height: 32px; display: inline-block; vertical-align: middle;"></div>` 
: msgAtualizada.text);

showReplyPreview(msgId, textoPassado, msg.user, msg.photo || msg.avatar);

/*====================================================================================================
Renderiza animação Lottie na prévia de resposta caso a mensagem seja uma figurinha animada .json
======================================================================================================== */
if (ehLottie) {
requestAnimationFrame(() => {
/*====================================================================================================
Verifica a existência da função global de renderização de emojis Lottie antes da chamada
======================================================================================================== */
if (typeof window.renderizarEmojiLottie === "function") {
window.renderizarEmojiLottie(idLottiePreview, msg.text.trim());
}
});
}

const preview = document.getElementById("replyPreview");

/*====================================================================================================
Injeta os botões de ação dinâmicos de exclusão (própria) ou denúncia (terceiros) dentro do preview
======================================================================================================== */
if (preview) {
const antigoBtn = preview.querySelector(".reply-report-action");

/*====================================================================================================
Remove botão de ação antigo caso ele já exista na DOM antes de injetar o novo
======================================================================================================== */
if (antigoBtn) antigoBtn.remove();

const isMinhaMensagem = currentUser && (currentUser.uid === msg.uid);

const actionBtn = document.createElement("span");
actionBtn.className = "reply-report-action";

/*====================================================================================================
Função para fechar suavemente o balão de resposta sem gerar impactos ou saltos de scroll
======================================================================================================== */
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

/*====================================================================================================
Define a lógica do botão da prévia: Exclusão caso a mensagem pertença ao próprio usuário logado
======================================================================================================== */
if (isMinhaMensagem) {
actionBtn.setAttribute("title", "Excluir mensagem");
actionBtn.innerHTML = `<i class="bi bi-trash" style="color: #000000; font-size:20px;"></i>`;

/*====================================================================================================
Evento de clique para exclusão suave da mensagem enviada pelo próprio usuário
======================================================================================================== */
actionBtn.addEventListener("click", async (e) => {
e.preventDefault();
e.stopPropagation();

// CORREÇÃO: Zera a variável de memória na hora para liberar o envio de novas mensagens sem pegar o ID antigo
window.replyingTo = null;
fecharPreviewSuave();

try {
const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");
const msgDocRef = doc(db, "salas", window.salaAtual, "messages", msgId);

/*====================================================================================================
Aplica soft delete atualizando o campo 'deleted' para true no Firestore
======================================================================================================== */
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
actionBtn.setAttribute("title", "Denunciar mensagem");
actionBtn.innerHTML = `<i class="bi bi-flag-fill"><span style="color: #00000063; font-size:0.82rem;">Denunciar mensagem</span></i>`;

/*====================================================================================================
Evento de clique para registrar denúncia contra mensagens inadequadas de terceiros
======================================================================================================== */
actionBtn.addEventListener("click", async (e) => {
e.preventDefault();
e.stopPropagation();

/*====================================================================================================
Interrompe a ação caso a mensagem já tenha sido denunciada nesta sessão
======================================================================================================== */
if (actionBtn.classList.contains("reported")) return;

const agora = Date.now();
const tempoEspera = 180000;
const ultimaDenuncia = window.lastReportTime || 0;
const tempoPassado = agora - ultimaDenuncia;

/*====================================================================================================
Aplica tempo de espera (cooldown) de 3 minutos entre denúncias sucessivas
======================================================================================================== */
if (tempoPassado < tempoEspera) {
showToast(`Aguarde um instante.`);
return;
}

try {
const { doc, updateDoc, arrayUnion, increment, getDoc } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");
const { auth } = await import("./firebase-config.js");

const user = auth.currentUser;

/*====================================================================================================
Valida se existe usuário ativo antes de permitir o envio de denúncia ao banco
======================================================================================================== */
if (!user) {
showToast("Faça login para denunciar.");
return;
}

const msgDocRef = doc(db, "salas", window.salaAtual, "messages", msgId);
const snapshot = await getDoc(msgDocRef);

/*====================================================================================================
Verifica se o snapshot existe e impede denúncias duplicadas do mesmo usuário
======================================================================================================== */
if (snapshot.exists()) {
const data = snapshot.data();
const denunciantes = data.denunciadoPor || [];

/*====================================================================================================
Trava o reenvio caso o UID do usuário já conste no array de denunciantes
======================================================================================================== */
if (denunciantes.includes(user.uid)) {
showToast("Você já denunciou esta mensagem.");
actionBtn.classList.add("reported");
return;
}
}

/*====================================================================================================
Incrementa o contador de denúncias e registra a UID do denunciante no documento
======================================================================================================== */
await updateDoc(msgDocRef, {
denunciasContador: increment(1),
denunciadoPor: arrayUnion(user.uid)
});

window.lastReportTime = Date.now();

actionBtn.classList.add("reported");
actionBtn.innerHTML = `<i class="bi bi-pin-angle-fill"></i>`; 

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

/*====================================================================================================
Cria o elemento DOM HTML individual da mensagem com foto, nome, conteúdo, horario e menus de contexto
======================================================================================================== */
function createMessageElement(msgId, msg, timestamp = "") {
const div = document.createElement("div");
div.classList.add("message");
div.dataset.id = msgId;
div.dataset.uid = msg.uid || msg.user;

const ytId = extractYouTubeId(msg.text);
const avatar = sanitizeMessageAvatar(msg.photo || msg.avatar);
const cidade = msg.replyTo ? "" : (msg.cidade || msg.city || "");

// Formatação VIP centralizada direto do módulo vip.js
const { 
  classeEfeito: classeEfeitoNome, 
  corInline: corInlineNome, 
  fonteInline: fonteInlineNome, 
  tagDiamante, 
  moldura 
} = formatarAutorVipChat(msg);

let content = "";
const idUnicoLottie = "lottie-" + Math.random().toString(36).substring(2, 11);

/*====================================================================================================
Tratamento de renderização do conteúdo conforme o status da mensagem (Excluída, Ocultada ou Mídia)
======================================================================================================== */
if (msg.deleted === true) {
content = `
<div class="msg-deleted-box" style="display: flex; align-items: center; gap: 6px; color: #888; font-style: italic;">
<i class="bi bi-ban" style="font-size: 0.9rem; color: #888;"></i>
<span style="font-size: 0.92rem; color: #888 !important; font-style: italic;">Mensagem excluída</span>
</div>
`;
} else if (msg.denunciasContador && msg.denunciasContador >= 1) {
content = renderPlainMessage(msg);
} else if (isSticker(msg.text)) {
/*====================================================================================================
Diferencia a criação da div entre figurinha animada (.json) e figurinha estática (imagem)
======================================================================================================== */
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

/*====================================================================================================
Aplica estilo dos avatar dentro do chat fonte
======================================================================================================== */
if (msg.user === "Kbsweb") {
div.classList.add("admin-message");
}

div.innerHTML = `
<div class="message-click-area" style="display:flex;align-items:center;gap:6px;">
<div class="message-avatar-wrap position-relative d-inline-flex align-items-center justify-content-center" style="width: 40px; height: 40px; min-width: 40px; min-height: 40px; flex-shrink: 0; margin-right: 8px;">
  <img 
    src="${avatar}" 
    class="user-photo"
    style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; margin: 0;"
    onerror="this.src='./img/avatar.png'"
  >
  <div class="avatar-frame position-absolute rounded-circle ${moldura !== 'none' ? moldura : 'd-none'}" style="top: 0; left: 0; width: 100%; height: 100%; box-sizing: border-box; pointer-events: none; z-index: 2;"></div>
</div>

<div class="message-user-info">
<div class="message-header">
<b class="user-name message-author-name ${classeEfeitoNome}" style="${corInlineNome} ${fonteInlineNome} cursor:pointer; display:inline-flex; align-items:center; gap:2px;">
${msg.user}${tagDiamante}${msg.user === "Kbsweb" ? "&nbsp;Adm" : ""}
</b>
</div>
${cidade ? `<span class="user-city"><i class="icon-cidade bi bi-geo-alt"></i> ${cidade}</span>` : ""}
</div>
</div>

<div class="reply-container"></div>

<div>${content}</div>
<div class="message-time">${timestamp}</div>
`;

/*====================================================================================================
Agenda a inicialização da animação Lottie para figurinhas após a injeção da estrutura no DOM
======================================================================================================== */
if (isSticker(msg.text) && msg.text.trim().endsWith(".json") && !msg.deleted && !(msg.denunciasContador && msg.denunciasContador >= 1)) {
requestAnimationFrame(() => {
/*====================================================================================================
Executa a renderização do Lottie através da janela global caso o método esteja disponível
======================================================================================================== */
if (typeof window.renderizarEmojiLottie === "function") {
window.renderizarEmojiLottie(idUnicoLottie, msg.text.trim());
}
});
}

bindMessageReplyClick(div, msgId, msg);

const clickArea = div.querySelector(".message-click-area");

/*====================================================================================================
Associa evento de abertura do menu contextual ao clicar na foto ou nome do autor da mensagem
======================================================================================================== */
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

/*====================================================================================================
Ajusta a posição do menu contextual dentro dos limites visíveis da janela
======================================================================================================== */
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

/*====================================================================================================
Event Listener global para ocultar menus contextuais quando o usuário clica fora deles
======================================================================================================== */
document.addEventListener("click", () => {
const menu = document.getElementById("messageContextMenu");
if (menu) {
menu.classList.add("hidden");
}

document.querySelectorAll(".message").forEach(m => {
m.classList.remove("show-actions");
});
});

const closeBtn = document.getElementById("closeContextMenu");

/*====================================================================================================
Fecha o menu contextual flutuante ao clicar no botão X
======================================================================================================== */
if (closeBtn) {
closeBtn.addEventListener("click", (e) => {
e.stopPropagation();

const menu = document.getElementById("messageContextMenu");
if (menu) {
menu.classList.add("hidden");
}
});
}

/*====================================================================================================
Salva o estado e lista de mensagens exibidas na sala no cache local da sessionStorage
======================================================================================================== */
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

/*====================================================================================================
Restaura do cache (sessionStorage) as mensagens salvas para renderização instantânea ao trocar de sala
======================================================================================================== */
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

const createdAtMs = safeMsg.createdAt?.seconds
? safeMsg.createdAt.seconds * 1000
: Date.now();

div.setAttribute("data-created-at", createdAtMs);
fragment.appendChild(div);

if (safeMsg.replyTo) {
pendingReplies.push({ msg: safeMsg, div });
}
});

chat.replaceChildren(fragment);
chat.scrollTop = chat.scrollHeight;

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

/*====================================================================================================
Limpa e cancela as escutas ativas do Firebase Firestore para desocupar recursos de memória
======================================================================================================== */
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

/*====================================================================================================
Gera um ID único alfanumérico formatado por data/hora ISO com sufixo randômico para ordenação no banco
======================================================================================================== */
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

const isSticker = (text = "") => /\.(png|webp|jpg|jpeg|gif|json)$/i.test(String(text).trim());

/*====================================================================================================
Extrai o ID único de 11 caracteres de URLs válidas de vídeos do YouTube
======================================================================================================== */
function extractYouTubeId(url = "") {
const match = String(url).match(
/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
);
return match ? match[1] : null;
}

/*====================================================================================================
Converte o objeto de carimbo de data do Firestore em uma string formatada em DD/MM HH:MM:SS
======================================================================================================== */
function formatTimestamp(ts) {
if (!ts) return "";
const d = ts.toDate();
return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} 
${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")} `;
}

/*====================================================================================================
Gera o HTML de renderização para mensagens simples de texto, tratando mensagens longas ou ocultadas
======================================================================================================== */
function renderPlainMessage(msg) {
if (msg.deleted === true) {
return `
<div class="msg-deleted-box-fixed" style="display: flex; align-items: center; gap: 6px; color: #888; font-style: italic;">
<i class="bi bi-ban" style="color: #888;"></i>
<span style="color: #888 !important; font-style: italic;">Mensagem excluída</span>
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

/*====================================================================================================
Gera a tag HTML de imagem para exibição de figurinhas estáticas na conversa
======================================================================================================== */
function renderSticker(url) {
return `<img src="${url.trim()}" alt="sticker" class="sticker-img" draggable="false">`;
}

/*====================================================================================================
Gera o HTML da caixa de prévia com imagem de capa (thumbnail) e botão de play para vídeos do YouTube
======================================================================================================== */
function renderYouTube(id) {
const thumb = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;

return `
<div class="youtube-preview" data-video="${id}">
<img src="${thumb}" alt="YouTube thumbnail" class="youtube-thumb">
<div class="youtube-play">&#9658;</div>
</div>
`;
}

/*====================================================================================================
Converte cores em formato hexadecimal/nome para RGBA atribuindo nível de opacidade/transparência
======================================================================================================== */
function toRGBA(color, alpha = 0.15) {
const el = document.createElement("span");
el.style.color = color;
document.body.appendChild(el);

const rgb = getComputedStyle(el).color;
document.body.removeChild(el);

return rgb.replace("rgb(", "rgba(").replace(")", `, ${alpha})`);
}

/*====================================================================================================
Renderiza de forma assíncrona o trecho de prévia com a mensagem original quando citado em um reply
======================================================================================================== */
/*====================================================================================================
Renderiza de forma assíncrona o trecho de prévia com a mensagem original quando citado em um reply
======================================================================================================== */
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

  // Formatação VIP completa do autor citado no reply
// Formatação VIP completa do autor citado no reply
  const { 
    classeEfeito: classeEfeitoReply, 
    corInline: corInlineReply, 
    fonteInline: fonteInlineReply 
  } = formatarAutorVipChat(d);

  let color = d.vipNameColorSolid || d.color || msg.replyColor || "#3f3f3f";
  let content = "";
  const idUnicoReplyLottie = "lottie-reply-" + Math.random().toString(36).substring(2, 11);

  if (isSticker(d.text)) {
    if (d.text.trim().endsWith(".json")) {
      content = `<div id="${idUnicoReplyLottie}" class="sticker-img" style="width: 30px; height: 30px; display: inline-block;"></div>`;
      requestAnimationFrame(() => {
        if (typeof window.renderizarEmojiLottie === "function") {
          window.renderizarEmojiLottie(idUnicoReplyLottie, d.text.trim());
        }
      });
    } else {
      content = renderSticker(d.text);
    }
  } else {
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

  const safeRepliedAvatar = d.photo || d.avatar || "./img/avatar.png";
// borda lateral
  return `
<div class="quoted-reply-box ${classeEfeitoReply}"
      style="
        ${classeEfeitoReply ? '' : `border-left: 4px solid ${color};`}
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
        <div class="quoted-header ${classeEfeitoReply}" style="${classeEfeitoReply ? '' : corInlineReply} ${fonteInlineReply} font-weight: 600; font-size: .97rem; text-align: left; width: fit-content; margin-bottom: 2px;">
          ${d.user}
        </div>
        <div style="display: flex; text-align: left; width: 100%;">
          ${content}
        </div>
      </div>
      </div>
    </div>
  `;
}


/*====================================================================================================
QUANTIDADE DE MENSAGEM DENTRO DO CHAT PUXA DO FIREBASE
======================================================================================================== */
const MAX_MESSAGES_DESKTOP = 150;
const MAX_MESSAGES_MOBILE = 100;

/*====================================================================================================
Retorna o número máximo de mensagens mantidas na tela baseando-se no tamanho da tela do dispositivo
======================================================================================================== */
function getMaxMessages() {
return window.innerWidth < 600 ? MAX_MESSAGES_MOBILE : MAX_MESSAGES_DESKTOP;
}

/*====================================================================================================
Remove as mensagens excedentes no topo da árvore DOM quando o limite da tela for atingido
======================================================================================================== */
function trimMessages(chat) {
const max = getMaxMessages();
while (chat.children.length > max) {
const first = chat.firstElementChild;
if (!first || first.classList.contains("pull-to-refresh-spinner")) break;

const id = first.dataset?.id;
if (id) renderedMessages.delete(id);

chat.removeChild(first);
}
}

// ===================== INIT LISTENER DE MENSAGENS =======================================================
/*====================================================================================================
Inicializa o listener do chat, configurando o carregamento inicial, escutas do Firestore e scroll
======================================================================================================== */
export function initMessages(chat, sala) {
sala = normalizeRoomId(sala);
const isSameRoom = currentMountedRoom === sala && currentMountedChat === chat;

window.salaAtual = sala;

cleanupMessageListeners();

/*====================================================================================================
Verifica se o container do chat está presente no HTML antes de dar prosseguimento à inicialização
======================================================================================================== */
if (!chat) {
console.warn("initMessages: container de chat não encontrado");
return () => {};
}

// Trava o Pull-to-refresh nativo do navegador mobile
chat.style.overscrollBehaviorY = "contain";

setChatLoading(true);
isInitialLoad = true;

const chatRefAchatado = collection(db, "salas", sala, "messages");
if (!isSameRoom) {
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

// Garantia do Elemento Visual Spinner no topo
let spinnerEl = chat.querySelector(".pull-to-refresh-spinner");
if (!spinnerEl) {
spinnerEl = document.createElement("div");
spinnerEl.className = "pull-to-refresh-spinner";
spinnerEl.innerHTML = `<div class="spinner-box"><i class="bi bi-arrow-repeat"></i></div>`;
chat.prepend(spinnerEl);
}

// ============================================================================================================================
//ESTADO E PAGINAÇÃO INVERSA DAS MENSAGEM   MOSTRA AS MENSAGENS MAIS ANTIGAS PRIMEIRO, E VAI CARREGANDO MAIS CONFORME O USUÁRIO ROLA PARA CIMA
// ============================================================================================================================
let oldestDoc = null; // Guarda o ponteiro da mensagem mais antiga no topo
let hasMoreHistory = true; // Trava quando não houver mais mensagens antigas
let isLoadingHistory = false; // Trava para evitar requisições simultâneas
const BATCH_SIZE = 30; // Quantidade de mensagens antigas por lote

// 1. QUERY INICIAL (Escuta em tempo real apenas as últimas mensagens)

const qAchatada = query(
chatRefAchatado,
orderBy("createdAt"),
limitToLast(BATCH_SIZE)
);

/*====================================================================================================
Processa alterações do snapshot recebidas do Firestore (adição, modificação e remoção em tempo real)
======================================================================================================== */
const processSnapshot = (snapshot) => {
const fragment = document.createDocumentFragment();
const pendingReplies = [];
let addedCount = 0;

/*====================================================================================================
Armazena o documento mais antigo do lote inicial para servirem de cursor na paginação do histórico
======================================================================================================== */
if (snapshot.docs.length > 0 && !oldestDoc) {
oldestDoc = snapshot.docs[0];
}

/*====================================================================================================
Itera sobre cada alteração individual do snapshot retornado pelo banco de dados
======================================================================================================== */
snapshot.docChanges().forEach((change) => {
/*====================================================================================================
Tratamento para alteração do tipo 'removed': atualiza o visual da mensagem removida dinamicamente
======================================================================================================== */
if (change.type === "removed") {
const msgId = change.doc.id;
const msgDiv = document.querySelector(`[data-id="${msgId}"]`);

if (msgDiv && chat) {
const alturaAntes = msgDiv.offsetHeight;
const scrollAntes = chat.scrollTop;

const timeDiv = msgDiv.querySelector(".message-time");
const replyBox = msgDiv.querySelector(".reply-container");

if (replyBox) replyBox.style.display = "none";
if (timeDiv) timeDiv.style.display = "none";

if (timeDiv && timeDiv.previousElementSibling) {
timeDiv.previousElementSibling.innerHTML = `
<div class="msg-deleted-box" style="display: flex; align-items: center; gap: 6px; color: #888; font-style: italic; margin-top: 2px; min-height: 24px;">
<i class="bi bi-ban" style="font-size: 0.9rem; color: #a0a0a0;"></i>
<span style="font-size:0.92rem;">Mensagem excluída</span>
</div>
`;
}

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

/*====================================================================================================
Tratamento para alteração do tipo 'modified': atualiza os dados visuais de mensagens modificadas
======================================================================================================== */
if (change.type === "modified") {
  const msgId = change.doc.id;
  const msgData = change.doc.data();
  const msgDiv = document.querySelector(`[data-id="${msgId}"]`);

  // Sincroniza a memória global em tempo real
  const msgExistente = messagesMap.get(msgId) || {};
  messagesMap.set(msgId, { ...msgExistente, ...msgData });

  if (msgDiv) {
    if (msgData.deleted === true) {
      // Limpa o cache de citação
      replyCache.delete(msgId);

      // Fecha o preview caso a mensagem estivesse selecionada no momento
      if (window.replyingTo === msgId) {
        window.replyingTo = null;
        const preview = document.getElementById("replyPreview");
        if (preview) {
          preview.style.display = "none";
          preview.innerHTML = "";
        }
      }

      const replyBox = msgDiv.querySelector(".reply-container");
      if (replyBox) replyBox.style.display = "none";

      // Mantém a estrutura HTML original sem alterar classes ou alinhamento
      const bodyContent = msgDiv.children[2];
      if (bodyContent) {
        bodyContent.innerHTML = `
          <div class="msg-deleted-box">
            <i class="bi bi-ban" style="font-size: 0.9rem; color: #a0a0a0;"></i>
            <span style="font-size:0.92rem; font-style: italic; color: #888;">Mensagem excluída</span>
          </div>
        `;
      }
    }
    else if (msgData.denunciasContador && msgData.denunciasContador >= 1) {
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



/*====================================================================================================
Verifica se a alteração é do tipo 'added', ignorando outros tipos de alterações que não sejam adições
======================================================================================================== */
if (change.type !== "added") return;
const docSnap = change.doc;
const msgId = docSnap.id;
if (renderedMessages.has(msgId)) return;
renderedMessages.add(msgId);
const raw = docSnap.data();
const msg = {
...raw,
text: typeof raw.text === "string" ? raw.text : ""
};

replyCache.set(msgId, {
  user: msg.user,
  text: msg.text,
  photo: msg.photo,
  color: msg.color,
  vipNameFont: msg.vipNameFont || "default",
  vipNameColorType: msg.vipNameColorType || "solid",
  vipNameColorSolid: msg.vipNameColorSolid || msg.color || "#1E293B"
});

if (!messagesMap.has(msgId)) {
const fullMsg = { id: msgId, ...msg };
messagesState.push(fullMsg);
messagesMap.set(msgId, fullMsg);
}

const timestamp = msg.createdAt ? formatTimestamp(msg.createdAt) : "";
const div = createMessageElement(msgId, msg, timestamp);
const createdAtMs = msg.createdAt?.toMillis?.() || (msg.createdAt?.seconds * 1000) || Date.now();

div.setAttribute("data-created-at", createdAtMs);
fragment.appendChild(div);
addedCount++;

if (msg.replyTo) {
pendingReplies.push({ msg, div });
}
});

/*====================================================================================================
Se novas mensagens forem adicionadas, anexa o fragmento no chat e faz rolagem suave para o fundo
======================================================================================================== */
if (addedCount > 0) {
chat.appendChild(fragment);
setTimeout(() => {
window.smartScrollToBottom?.();
}, isInitialLoad ? 0 : 80);
}

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

/*====================================================================================================
Função assíncrona que busca lotes de mensagens antigas no banco de dados ao rolar até o topo do chat
======================================================================================================== */
async function loadMoreOlderMessages() {
/*====================================================================================================
Verifica se o sistema já está carregando, se não há mais mensagens ou se não há ponteiro de consulta
======================================================================================================== */
if (isLoadingHistory || !hasMoreHistory || !oldestDoc) return;

isLoadingHistory = true;

// Exibe o Spinner e ativa a rotação
if (spinnerEl) {
spinnerEl.classList.add("visible", "spinning");
}

try {
const { endBefore, limitToLast: firestoreLimitToLast } = await import("https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js");

const qHistorico = query(
chatRefAchatado,
orderBy("createdAt"),
endBefore(oldestDoc),
firestoreLimitToLast(BATCH_SIZE)
);

const snapshot = await getDocs(qHistorico);

// DELAY FORÇADO DE 2 SEGUNDOS COM SPINNER GIRANDO
await new Promise((resolve) => setTimeout(resolve, 2000));

/*====================================================================================================
Verifica se o snapshot do histórico retornou vazio e encerra a busca de histórico antigo
======================================================================================================== */
if (snapshot.empty) {
hasMoreHistory = false;
} else {
oldestDoc = snapshot.docs[0];

const previousScrollHeight = chat.scrollHeight;
const previousScrollTop = chat.scrollTop;

const fragment = document.createDocumentFragment();
const pendingReplies = [];

snapshot.docs.forEach((docSnap) => {
const msgId = docSnap.id;
if (renderedMessages.has(msgId)) return;
renderedMessages.add(msgId);

const raw = docSnap.data();
const msg = {
...raw,
text: typeof raw.text === "string" ? raw.text : ""
};

replyCache.set(msgId, {
  user: msg.user,
  text: msg.text,
  photo: msg.photo,
  color: msg.color,
  vipNameFont: msg.vipNameFont || "default",
  vipNameColorType: msg.vipNameColorType || "solid",
  vipNameColorSolid: msg.vipNameColorSolid || msg.color || "#1E293B"
});

if (!messagesMap.has(msgId)) {
const fullMsg = { id: msgId, ...msg };
messagesState.unshift(fullMsg);
messagesMap.set(msgId, fullMsg);
}

const timestamp = msg.createdAt ? formatTimestamp(msg.createdAt) : "";
const div = createMessageElement(msgId, msg, timestamp);
const createdAtMs = msg.createdAt?.toMillis?.() || (msg.createdAt?.seconds * 1000) || Date.now();

div.setAttribute("data-created-at", createdAtMs);
fragment.appendChild(div);

if (msg.replyTo) {
pendingReplies.push({ msg, div });
}
});

/*====================================================================================================
Insere o fragmento de mensagens antigas no topo, respeitando a posição do spinner
======================================================================================================== */
if (spinnerEl && spinnerEl.nextSibling) {
chat.insertBefore(fragment, spinnerEl.nextSibling);
} else {
chat.insertBefore(fragment, chat.firstChild);
}

pendingReplies.forEach(({ msg, div }) => {
renderReply(msg).then((replyHTML) => {
const box = div.querySelector(".reply-container");
if (box && replyHTML) box.innerHTML = replyHTML;
});
});

// RETENÇÃO EXATA DE SCROLL (SEM PULOS)
const newScrollHeight = chat.scrollHeight;
chat.scrollTop = (newScrollHeight - previousScrollHeight) + previousScrollTop;
}
} catch (err) {
console.error("Erro ao carregar histórico antigo:", err);
} finally {
isLoadingHistory = false;
if (spinnerEl) {
spinnerEl.classList.remove("visible", "spinning");
}
}
}

/*====================================================================================================
Função do ouvinte de scroll para identificar quando o usuário se aproxima do topo do container
======================================================================================================== */
const handleScroll = () => {
/*====================================================================================================
Verifica se a distância de rolagem do topo é menor ou igual a 10px para carregar mensagens antigas
======================================================================================================== */
if (chat.scrollTop <= 10) {
loadMoreOlderMessages();
}
};

chat.addEventListener("scroll", handleScroll);

let unsubCurrent = onSnapshot(qAchatada, (snapshot) => {
processSnapshot(snapshot);
});

unsubscribeCurrentMessages = () => {
if (unsubCurrent) unsubCurrent();
chat.removeEventListener("scroll", handleScroll);
setChatLoading(false);
};

return () => {
saveMessagesCache(sala, chat);
cleanupMessageListeners();
};
}

// ================= ENVIO =========================================================
/*====================================================================================================
Envia a mensagem digitada pelo usuário realizando sanitização, bloqueios e gravação no Firestore
======================================================================================================== */
export async function sendMessage(input) {
let text = input.value.trim();
if (!text) return;

/*====================================================================================================
Bloqueia o envio contínuo de mensagens caso a contagem de flood atinja o limite estabelecido
======================================================================================================== */
if (floodCount >= 4) {
showToast("Envio muito rápido, Aguarde um instante.");
return;
}
floodCount++;

/*====================================================================================================
Inicia o temporizador para resetar a contagem do controle de anti-flood após o tempo pré-definido
======================================================================================================== */
if (!floodResetTimeout) {
floodResetTimeout = setTimeout(() => {
floodCount = 0;
floodResetTimeout = null;
}, 40000);
}
const htmlPattern = /<[^>]*>/g;

/*====================================================================================================
Verifica e bloqueia tags HTML dentro do texto digitado para prevenir vulnerabilidades de XSS
======================================================================================================== */
if (htmlPattern.test(text)) {
showToast("Não é permitido este tipo de mensagens.");
return;
}

/*====================================================================================================
Verifica se existe um usuário autenticado no sistema antes de prosseguir com o envio
======================================================================================================== */
if (!currentUser) {
showToast("Faça login para enviar mensagens.");
return;
}

const perfilRef = doc(db, "users", currentUser.uid);
const perfilSnap = await getDoc(perfilRef);
const userProfile = perfilSnap.exists() ? perfilSnap.data() : {};

/*====================================================================================================
Verifica se o usuário completou seu perfil e dispara o evento de abertura de perfil se for falso
======================================================================================================== */
if (userProfile.perfilCompleto !== true) {
showToast("Complete seu perfil para enviar mensagens.");
document.dispatchEvent(new CustomEvent("chatdf:open-profile"));
return;
}

text = text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\b/gi, "***");
text = text.replace(/(\+?55)?\s*\(?\d{2}\)?\s*9?\d{4}[-\s]?\d{4}/g, "***");
text = text.replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "***");

const somenteNumeros = text.replace(/\D/g, "");

/*====================================================================================================
Verifica a presença de sequências numéricas longas e faz a substituição por asteriscos
======================================================================================================== */
if (somenteNumeros.length >= 10) {
text = text.replace(/\d/g, "*");
}

/*====================================================================================================
Identifica se a mensagem contém formatos de número de telefone usando padrões de expressões regulares
======================================================================================================== */
function bloqueiaTelefone(text) {
const nums = text.replace(/\D/g, "");
if (/^9\d{8}$/.test(nums)) return true;
if (/^\d{2}9\d{8}$/.test(nums)) return true;
const padrao = /(\+?55)?\s*\(?\d{0,2}\)?\s*9\d{4}[-\s]?\d{4}/;
return padrao.test(text);
}

/*====================================================================================================
Mascara os números do texto caso o validador de telefones retorne positivo
======================================================================================================== */
if (bloqueiaTelefone(text)) {
text = text.replace(/\d/g, "*");
}

const dangerousPatterns = [
"javascript:", "onerror=", "onload=", "<script", "data:text/html",
"data:text/javascript", "vbscript:", "base64"
];

const lower = text.toLowerCase();

/*====================================================================================================
Percorre a lista de termos e padrões perigosos para bloquear mensagens maliciosas no chat
======================================================================================================== */
for (const p of dangerousPatterns) {
if (lower.includes(p)) {
showToast("Nao e permitido esse tipo de mensagem.");
return;
}
}

/*====================================================================================================
Verifica o tamanho do texto para impedir o envio de mensagens acentuadamente extensas
======================================================================================================== */
if (text.length > 720) {
showToast(" Texto muito grande! ");
return;
}

/*====================================================================================================
Aplica travamento rigoroso para limites extremos de texto acima de 1000 caracteres
======================================================================================================== */
if (text.length > 1000) {
showToast(" Mensagem excessivamente longa bloqueada.");
return;
}

const youtubeId = extractYouTubeId(text);

/*====================================================================================================
Verifica se a mensagem contém links genéricos HTTP/HTTPS não autorizados (diferentes do YouTube)
======================================================================================================== */
if (/https?:\/\//.test(text) && !youtubeId) {
showToast("Apenas links do YouTube são permitidos.");
return;
}

try {
const userColorChoice = userProfile?.vipMsgColor || "#1E293B";
const idOrganizado = gerarIdISO();
let replyUserColor = null;

/*====================================================================================================
Recupera a cor personalizada configurada na prévia de resposta se houver um reply ativo
======================================================================================================== */
if (window.replyingTo) {
const replyPreview = document.getElementById("replyPreview");
replyUserColor = replyPreview?.dataset?.replyColor || null;
}

const { profileName, profilePhoto, profileCity } = resolveUserVisualProfile(userProfile, currentUser);

const finalPhoto = sanitizeMessageAvatar(
userProfile?.foto || userProfile?.avatar || userProfile?.photoURL || currentUser?.photoURL || profilePhoto
);

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
vipNameColorType: userProfile?.vipNameColorType || "solid",
vipNameColorSolid: userProfile?.vipNameColorSolid || "#1E293B",
vipNameFont: userProfile?.vipNameFont || "default",
vipAvatarFrame: userProfile?.vipAvatarFrame || "none",
replyTo: window.replyingTo || null,
replyColor: replyUserColor,
createdAt: serverTimestamp(),
});

/*====================================================================================================
Limpeza de Mensagens no firebse 110 passar disso gera limpeza de mensagem antiga dentro do banco de dados 
Math.random() < 0.10: Executar a faxina apenas em 10% dos envios
======================================================================================================== */
if (Math.random() < 0.10) {
setTimeout(async () => {
try {
const snapshotCount = await getCountFromServer(chatRefAchatado);
const totalMensagens = snapshotCount.data().count;

/*====================================================================================================
Verifica se a contagem total de mensagens ultrapassa 110 documentos para efetuar o expurgo
======================================================================================================== */
if (totalMensagens > 110) {
const excesso = totalMensagens - 110;
const qMaisVelhas = query(chatRefAchatado, orderBy("createdAt", "asc"), limit(excesso));
const docsMaisVelhos = await getDocs(qMaisVelhas);

/*====================================================================================================
Itera sobre os documentos retornados na consulta e executa a exclusão individual do banco
======================================================================================================== */
docsMaisVelhos.forEach((docSnap) => {
deleteDoc(docSnap.ref);
});
}
} catch (erroFaxina) {
console.warn("Faxina em segundo plano ignorada:", erroFaxina);
}
}, 2000);
}

input.value = "";

/*====================================================================================================
Garante que o campo de entrada recupere o foco do teclado após o envio bem-sucedido
======================================================================================================== */
if (typeof input.focus === 'function') {
input.focus();
}
window.replyingTo = null;

setTimeout(() => {
const lastTime = document.querySelector(".message:last-child .message-time");
/*====================================================================================================
Verifica a presença da hora da última mensagem e atualiza com o horário corrente do dispositivo
======================================================================================================== */
if (lastTime) {
const now = new Date();
lastTime.textContent = formatTimestamp({ toDate: () => now });
}
}, 30);

const preview = document.getElementById("replyPreview");
if (preview) preview.style.display = "none";

document.querySelector("emoji-picker")?.remove();

/*====================================================================================================
Ajusta a altura da caixa de texto do input e executa rolagem automática da conversa para a base
======================================================================================================== */
if (input && input.style) {
input.style.height = "44px";

requestAnimationFrame(() => {
/*====================================================================================================
Verifica a existência do elemento container do chat para realizar a rolagem
======================================================================================================== */
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

// ================= EVENTOS =================
/*====================================================================================================
Escuta o evento de redimensionamento de janela (resize) para ajustar unidades CSS dinâmicas (--vh)
======================================================================================================== */
window.addEventListener("resize", () => {
const vh = window.innerHeight * 0.01;
document.body.style.setProperty("--vh", `${vh}px`);
});

/*====================================================================================================
Salva as mensagens no cache local antes do descarregamento ou fechamento da aba no navegador
======================================================================================================== */
window.addEventListener("beforeunload", () => {
const chat = document.getElementById("chat-container");
if (chat && window.salaAtual) {
saveMessagesCache(window.salaAtual, chat);
}
});

/*====================================================================================================
Trata os cliques globais em prévias de vídeos do YouTube para abrir o link oficial em uma nova aba
======================================================================================================== */
document.addEventListener("click", (e) => {
const preview = e.target.closest(".youtube-preview, .youtube-reply-thumb");
if (preview) {
const videoId = preview.dataset.video;
window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank");
}
});

// ================= BOTÃO NOVA MENSAGEM + SCROLL INTELIGENTE =================
const chat = document.getElementById("chat-container");
const newMessagesBtn = document.getElementById("newMessagesBtn");

/*====================================================================================================
Configura os ouvintes de rolagem, contador de notificações e botão flutuante para ir ao fundo do chat
======================================================================================================== */
if (chat && newMessagesBtn) {
const countEl = newMessagesBtn.querySelector(".msg-badge");
window.newMessagesCount = Number(window.newMessagesCount) || 0;

chat.addEventListener("scroll", () => {
    // CORREÇÃO: Aumentado a margem para 150px para garantir a rolagem automática sempre que o usuário estiver perto do input
    const distanceFromBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight;
    const nearBottom = distanceFromBottom < 150;

    /*====================================================================================================
      Oculta o botão de rolagem e permite rolagem automática se o usuário estiver próximo do final do container
    ======================================================================================================== */
    if (nearBottom) {
      window.isUserReading = false;
      window.newMessagesCount = 0;
      newMessagesBtn.classList.add("hidden");
      if (countEl) {
        countEl.textContent = "";
        countEl.style.display = "none";
      }
    } else {
      window.isUserReading = true;
    }
  });

/*====================================================================================================
Oculta o botão de rolagem caso o usuário esteja próximo do final do container

chat.addEventListener("scroll", () => {
const nearBottom = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 60;
if (nearBottom) {
window.isUserReading = false;
newMessagesBtn.classList.add("hidden");
} else {
window.isUserReading = true;
}
});


======================================================================================================== */


newMessagesBtn.addEventListener("mousedown", (e) => e.preventDefault());

/*====================================================================================================
Trata o toque em telas mobile impedindo o fechamento nativo do teclado antes da rolagem
======================================================================================================== */
touchstart: newMessagesBtn.addEventListener("touchstart", (e) => {
e.preventDefault();
newMessagesBtn.click();
});

/*====================================================================================================
Associa o clique no botão flutuante para redefinir o contador e descer o scroll para o fundo
======================================================================================================== */
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

requestAnimationFrame(() => {
const input = document.getElementById("messageInput");
/*====================================================================================================
Foca a caixa de digitação automaticamente em navegadores desktop ao clicar para descer a tela
======================================================================================================== */
if (input && window.innerWidth > 768) {
input.focus();
const length = input.value.length;
input.setSelectionRange(length, length);
}
});
});
});

/*====================================================================================================
Executa rolagem inteligente controlando a exibição do selo badge de novas mensagens não lidas
======================================================================================================== */
window.smartScrollToBottom = () => {
/*====================================================================================================
Se o usuário não estiver lendo mensagens antigas no momento, rola automaticamente para a base
======================================================================================================== */
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
}
});

window.newMessagesCount = 0;

if (countEl) {
countEl.textContent = "";
countEl.style.display = "none";
}
} else {
window.newMessagesCount = Number(window.newMessagesCount) || 0;
window.newMessagesCount += 1;

/*====================================================================================================
Exibe a badge com a contagem incremental das novas mensagens recebidas no topo do botão
======================================================================================================== */
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

/*====================================================================================================
Fecha o botão flutuante de mensagens não lidas se o usuário clicar em outra área da tela
======================================================================================================== */
document.addEventListener("click", (e) => {
const btn = document.getElementById("newMessagesBtn");
if (!btn) return;

if (!btn.classList.contains("hidden") && !btn.contains(e.target)) {
btn.classList.add("hidden");
}
});


// Sincroniza a cor do input com a cor VIP salva do usuário
// Sincroniza a cor do texto e do cursor do input com a cor VIP salva do usuário
document.addEventListener("chatdf:user-ready", (e) => {
  const input = document.getElementById("messageInput");
  const userData = e.detail?.userData;
  if (input && userData?.vipMsgColor) {
    input.style.color = userData.vipMsgColor;
    input.style.caretColor = userData.vipMsgColor;
  }
});