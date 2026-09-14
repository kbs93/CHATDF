import { db } from './firebase-config.js';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";


// =========================================================================
// tag.js - Módulo Isolado de Filtragem e Feed de Relatos por Tags (Chat-DF)
// =========================================================================

// Mapeamento idêntico às 12 tags já criadas no seu sistema
export const TAGS_CONFIG = {
  "Trânsito": { classe: "tag-transito", icon: "traffic" },
  "Chuva": { classe: "tag-chuva", icon: "rainy" },
  "Transporte": { classe: "tag-transporte", icon: "directions_bus" },
  "Saúde": { classe: "tag-saude", icon: "local_hospital" },
  "Fiscalização": { classe: "tag-fiscalizacao", icon: "shield_person" },
  "Segurança": { classe: "tag-seguranca", icon: "security" },
  "Serviços": { classe: "tag-servicos", icon: "build" },
  "Concursos": { classe: "tag-concursos", icon: "menu_book" },
  "Feiras": { classe: "tag-feiras", icon: "storefront" },
  "Entorno": { classe: "tag-entorno", icon: "signpost" },
  "Estações e BRT": { classe: "tag-achados", icon: "find_in_page" },
  "Alerta Geral": { classe: "tag-alerta", icon: "warning" }
};

let tagSelecionadaAtual = null;

// Bloqueia e desbloqueia scroll de fundo no iOS/Android
function setBodyScrollLocked(isLocked) {
  if (isLocked) {
    document.body.style.overflow = "hidden";
    document.body.style.touchAction = "none";
  } else {
    document.body.style.overflow = "";
    document.body.style.touchAction = "";
  }
}

// 1. Gera os botões do Primeiro Modal (Pequeno)
function renderizarBotoesFiltro() {
  const container = document.getElementById("filterTagSelectList");
  if (!container) return;

  container.innerHTML = "";

  Object.entries(TAGS_CONFIG).forEach(([nomeTag, config]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn-filter-tag-choice ${config.classe}`;
    btn.setAttribute("data-tag", nomeTag);
    btn.innerHTML = `
      <span class="material-symbols-outlined">${config.icon}</span>
      <span>${nomeTag}</span>
    `;

    btn.addEventListener("click", () => {
      abrirFeedDaTag(nomeTag);
    });

    container.appendChild(btn);
  });
}

// 2. Coleta mensagens do chat renderizadas no DOM local


// 2. Coleta mensagens do chat renderizadas no DOM local (Ajuste exato ao messages.js)
// Função auxiliar de formatação de data e hora do Firestore

const ROOM_ALIASES_TAG = {
  "Bate papo Geral": "geral",
  "Religiao": "religiao",
  "Politica": "politica",
  "Transito": "transito",
  "Lugares para sair": "lugares",
  "Futebol": "futebol",
  "Eventos": "eventos",
  "Entretenimento": "entretenimento",
  "Games": "games",
  "Consurso Publico": "concurso",
};

function normalizeRoomIdTag(room) {
  return ROOM_ALIASES_TAG[room] || room || "geral";
}

function formatarTimestampTag(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

// 2. Busca as primeiras 30 mensagens da tag direto no Firestore
// 2. Busca somente as mensagens com a tag enviadas no dia de hoje
async function buscarPrimeiras30Relatos(nomeTag) {
  const sala = normalizeRoomIdTag(window.salaAtual);
  const chatRef = collection(db, "salas", sala, "messages");
  const prefixoTag = `[${nomeTag}]`;
  const listaRelatos = [];

  // Pega o dia e mês de HOJE no fuso local: Ex: "14/09"
  const agora = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const hojeDDMM = `${pad(agora.getDate())}/${pad(agora.getMonth() + 1)}`;

  try {
    const q = query(
      chatRef,
      where("tag", "==", nomeTag),
      limit(30)
    );

    const snapshot = await getDocs(q);

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      // 1. Ignora mensagens deletadas ou ocultadas
      if (data.deleted === true || (data.denunciasContador && data.denunciasContador >= 1)) {
        return;
      }

      // Formata a data da mensagem (retorna: "DD/MM HH:mm:ss")
      const horaFormatada = formatarTimestampTag(data.createdAt);

      // 2. Trava absoluta: se não começar com o dia e mês de hoje (ex: "14/09"), descarta na hora!
      if (!horaFormatada.startsWith(hojeDDMM)) {
        return;
      }

      let textoLimpo = typeof data.text === "string" ? data.text : "";
      if (textoLimpo.startsWith(prefixoTag)) {
        textoLimpo = textoLimpo.substring(prefixoTag.length).trim();
      }

      listaRelatos.push({
        nome: data.user || "Usuário",
        avatar: data.photo || data.avatar || "./img/avatar.png",
        cidade: data.cidade || data.city || "",
        hora: horaFormatada,
        texto: textoLimpo,
        tag: nomeTag
      });
    });
  } catch (err) {
    console.error("Erro ao buscar mensagens da tag:", err);
  }

  return listaRelatos;
}







// 3. Abre o Segundo Modal (Feed de Relatos)
export async function abrirFeedDaTag(nomeTag) {
  tagSelecionadaAtual = nomeTag;

  // Fecha o primeiro modal de seleção
  document.getElementById("filterTagSelectModal")?.classList.add("hidden");

  const feedModal = document.getElementById("filterTagFeedModal");
  const feedList = document.getElementById("filterTagFeedList");
  const modalTitle = document.getElementById("filterTagModalTitle");
  const modalCount = document.getElementById("filterTagModalCount");
  const config = TAGS_CONFIG[nomeTag] || { classe: "", icon: "label" };

  if (!feedModal || !feedList) return;

  if (modalTitle) {
    modalTitle.innerHTML = `
      <span class="material-symbols-outlined" style="font-size:18px; vertical-align: middle; margin-right: 4px;">${config.icon}</span>
      Relatos de ${nomeTag}
    `;
  }

  if (modalCount) modalCount.textContent = "Buscando...";
  feedList.innerHTML = `<div style="text-align:center; padding: 25px; color: #888;"><i class="bi bi-arrow-repeat" style="font-size: 1.5rem;"></i><br>Buscando relatos...</div>`;
  feedModal.classList.remove("hidden");
  setBodyScrollLocked(true);

  // Busca as 30 mensagens da tag no banco
  const relatos = await buscarPrimeiras30Relatos(nomeTag);

  if (modalCount) {
    modalCount.textContent = `${relatos.length} relato${relatos.length === 1 ? "" : "s"}`;
  }

  feedList.innerHTML = "";

  if (relatos.length === 0) {
    feedList.innerHTML = `
      <div class="filter-tag-empty-box">
        <i class="bi bi-chat-square-text"></i>
        <strong>Nenhum relato encontrado</strong>
        <p style="font-size: 13px; margin: 0;">Nenhuma mensagem registrada com a tag [${nomeTag}] nesta sala.</p>
      </div>
    `;
  } else {
    relatos.forEach((r) => {
      const card = document.createElement("div");
      card.className = "message filter-tag-message-item";
      card.innerHTML = `
        <div class="message-click-area" style="display:flex;align-items:center;gap:6px;">
          <div class="message-avatar-wrap position-relative d-inline-flex align-items-center justify-content-center" style="width: 40px; height: 40px; min-width: 40px; min-height: 40px; flex-shrink: 0; margin-right: 8px;">
            <img src="${r.avatar}" class="user-photo" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; margin: 0;" onerror="this.src='./img/avatar.png'">
          </div>
          <div class="message-user-info">
            <div class="message-header">
              <b class="user-name message-author-name">${r.nome}</b>
            </div>
            ${r.cidade ? `<span class="user-city"><i class="icon-cidade bi bi-geo-alt"></i> ${r.cidade}</span>` : ""}
          </div>
        </div>
        <div class="filter-tag-msg-body">
          <span class="chat-tag-badge ${config.classe}">
            <span class="material-symbols-outlined">${config.icon}</span>
            <span>${r.tag}</span>
          </span>
          <span class="filter-tag-text-content">${r.texto}</span>
        </div>
        <div class="message-time">${r.hora}</div>
      `;
      feedList.appendChild(card);
    });
  }

  setTimeout(() => {
    feedList.scrollTop = feedList.scrollHeight;
  }, 50);
}

// 4. Funções de Abertura / Fechamento dos Modais
export function abrirModalSelecaoFiltro() {
  renderizarBotoesFiltro();
  document.getElementById("filterTagSelectModal")?.classList.remove("hidden");
}

export function fecharTodosModaisFiltro() {
  document.getElementById("filterTagSelectModal")?.classList.add("hidden");
  document.getElementById("filterTagFeedModal")?.classList.add("hidden");
  setBodyScrollLocked(false);
}

// Inicialização dos Ouvintes de Evento
document.addEventListener("DOMContentLoaded", () => {
  // Botão de fechar do modal pequeno
  document.getElementById("closeFilterTagSelectModal")?.addEventListener("click", () => {
    document.getElementById("filterTagSelectModal")?.classList.add("hidden");
  });

  // Botão fechar do modal grande
  document.getElementById("btnCloseFilterFeedModal")?.addEventListener("click", () => {
    fecharTodosModaisFiltro();
  });

  // Botão voltar do modal grande para o pequeno
  document.getElementById("btnBackToFilterSelect")?.addEventListener("click", () => {
    document.getElementById("filterTagFeedModal")?.classList.add("hidden");
    document.getElementById("filterTagSelectModal")?.classList.remove("hidden");
  });

  // Fechar ao clicar fora (backdrop)
  document.getElementById("filterTagFeedModal")?.addEventListener("click", (e) => {
    if (e.target.id === "filterTagFeedModal") {
      fecharTodosModaisFiltro();
    }
  });

  document.getElementById("filterTagSelectModal")?.addEventListener("click", (e) => {
    if (e.target.id === "filterTagSelectModal") {
      document.getElementById("filterTagSelectModal")?.classList.add("hidden");
    }
  });

  // Conecta ao attachmentActions se existir
  if (window.attachmentActions) {
    window.attachmentActions.filterTags = () => {
      abrirModalSelecaoFiltro();
    };
  }
});