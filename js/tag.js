import { db } from './firebase-config.js';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  Timestamp 
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
function formatarTimestampTag(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

// 2. Coleta mensagens diretamente do Firestore (todas as mensagens do dia)
async function buscarRelatosDoBanco(nomeTag) {
  const sala = window.salaAtual || "geral";
  const chatRef = collection(db, "salas", sala, "messages");
  
  // Define o corte de 24 horas atrás
  const dataLimite = new Date();
  dataLimite.setHours(dataLimite.getHours() - 24);
  const tsLimite = Timestamp.fromDate(dataLimite);

  const prefixoTag = `[${nomeTag}]`;
  const listaRelatos = [];

  try {
    const q = query(
      chatRef,
      where("createdAt", ">=", tsLimite),
      orderBy("createdAt", "asc")
    );

    const snapshot = await getDocs(q);

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();

      // Ignora mensagens deletadas ou ocultadas
      if (data.deleted === true || (data.denunciasContador && data.denunciasContador >= 1)) {
        return;
      }

      const texto = typeof data.text === "string" ? data.text : "";
      
      // Valida pelo campo dedicado ou pelo prefixo no texto
      const possuiTag = data.tag === nomeTag || texto.startsWith(prefixoTag);
      if (!possuiTag) return;

      // Remove a tag do início do texto para exibição limpa
      let textoLimpo = texto;
      if (textoLimpo.startsWith(prefixoTag)) {
        textoLimpo = textoLimpo.substring(prefixoTag.length).trim();
      }

      listaRelatos.push({
        nome: data.user || "Usuário",
        avatar: data.photo || data.avatar || "./img/avatar.png",
        cidade: data.cidade || data.city || "",
        hora: formatarTimestampTag(data.createdAt),
        texto: textoLimpo,
        tag: nomeTag
      });
    });
  } catch (err) {
    console.error("Erro ao buscar relatos por tag do banco:", err);
  }

  return listaRelatos;
}

// 3. Abre o Segundo Modal (Feed de Relatos com busca direta)
export async function abrirFeedDaTag(nomeTag) {
  tagSelecionadaAtual = nomeTag;

  // Fecha o primeiro modal
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
  feedList.innerHTML = `<div style="text-align:center; padding: 25px; color: #888;"><i class="bi bi-arrow-repeat" style="font-size: 1.5rem;"></i><br>Carregando relatos do dia...</div>`;
  feedModal.classList.remove("hidden");
  setBodyScrollLocked(true);

  // Busca direto do banco sem depender do scroll da tela
  const relatos = await buscarRelatosDoBanco(nomeTag);

  if (modalCount) {
    modalCount.textContent = `${relatos.length} relato${relatos.length === 1 ? "" : "s"}`;
  }

  feedList.innerHTML = "";

  if (relatos.length === 0) {
    feedList.innerHTML = `
      <div class="filter-tag-empty-box">
        <i class="bi bi-chat-square-text"></i>
        <strong>Nenhum relato recente</strong>
        <p style="font-size: 13px; margin: 0;">Nenhuma mensagem com a tag [${nomeTag}] foi enviada nas últimas 24h nesta sala.</p>
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