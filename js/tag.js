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
function coletarMensagensDaTag(nomeTag) {
  // As mensagens ficam inseridas diretamente dentro do #chat-container
  const containerChat = document.getElementById("chat-container");
  if (!containerChat) return [];

  // Mapeamento normalizado da classe CSS
  const config = TAGS_CONFIG[nomeTag];
  const classeBadge = config ? config.classe : ""; // ex: "tag-seguranca"
  const prefixoTexto = `[${nomeTag.toLowerCase()}]`;

  // Seleciona todas as mensagens renderizadas na tela
  const todasMensagens = containerChat.querySelectorAll(".message");
  const listaRelatos = [];

  todasMensagens.forEach((el) => {
    // 1. Pula mensagens excluídas ou nós inválidos
    if (el.classList.contains("deleted-message-node") || el.querySelector(".msg-deleted-box")) {
      return;
    }

    // 2. Verifica se dentro do elemento existe a badge da tag
    const badgeEl = classeBadge ? el.querySelector(`.chat-tag-badge.${classeBadge}`) : null;
    
    // Verifica também pelo texto bruto
    const textoBruto = el.textContent || "";
    const textoMinusculo = textoBruto.toLowerCase();
    const temPrefixoTexto = textoMinusculo.includes(prefixoTexto);

    // Se NÃO tem nem a badge visual e nem o texto com a tag, pula para a próxima
    if (!badgeEl && !temPrefixoTexto) {
      return;
    }

    // 3. Captura os dados do usuário (suporta mensagens normais e mensagens agrupadas)
    let nome = "Usuário";
    let avatar = "./img/avatar.png";
    let cidade = "";

    const userEl = el.querySelector(".message-author-name") || el.querySelector(".user-name");
    const avatarEl = el.querySelector(".user-photo");
    const cityEl = el.querySelector(".user-city");

    if (userEl) {
      nome = userEl.childNodes[0]?.textContent?.trim() || userEl.textContent.trim();
      if (avatarEl) avatar = avatarEl.getAttribute("src") || avatar;
      if (cityEl) cidade = cityEl.textContent.replace("bi-geo-alt", "").trim();
    } else {
      // Caso a mensagem esteja com agrupamento visual (.is-grouped), busca o autor na anterior
      let elementoAnterior = el.previousElementSibling;
      while (elementoAnterior) {
        const prevUser = elementoAnterior.querySelector(".message-author-name") || elementoAnterior.querySelector(".user-name");
        if (prevUser) {
          nome = prevUser.childNodes[0]?.textContent?.trim() || prevUser.textContent.trim();
          const prevAvatar = elementoAnterior.querySelector(".user-photo");
          if (prevAvatar) avatar = prevAvatar.getAttribute("src") || avatar;
          const prevCity = elementoAnterior.querySelector(".user-city");
          if (prevCity) cidade = prevCity.textContent.replace("bi-geo-alt", "").trim();
          break;
        }
        elementoAnterior = elementoAnterior.previousElementSibling;
      }
    }

    // 4. Captura a hora da mensagem
    const timeEl = el.querySelector(".message-time");
    const hora = timeEl ? timeEl.textContent.trim() : "";

    // 5. Captura o texto real do relato
    // Em createMessageElement o corpo fica no 4º nó filho: div.children[2]
    const bodyEl = el.querySelector(".msg-text") || el.children[2] || el;
    let textoMensagem = bodyEl.textContent.trim();

    // Remove a palavra da tag se ela estiver repetida no início do texto
    if (textoMensagem.toLowerCase().startsWith(prefixoTexto)) {
      textoMensagem = textoMensagem.substring(prefixoTexto.length).trim();
    } else if (badgeEl) {
      // Remove o texto da badge capturado pelo textContent (ex: remove "securitySegurança")
      const textoBadge = badgeEl.textContent.trim();
      if (textoMensagem.startsWith(textoBadge)) {
        textoMensagem = textoMensagem.substring(textoBadge.length).trim();
      }
    }

listaRelatos.push({
      nome,
      avatar,
      cidade,
      hora,
      texto: textoMensagem,
      tag: nomeTag
    });
  });

  // Função auxiliar para converter "DD/MM HH:mm:ss" em timestamp real
  const converterDataHora = (strHora) => {
    if (!strHora) return 0;
    // Exemplo: "09/09 12:54:14"
    const partes = strHora.trim().split(" ");
    if (partes.length < 2) return 0;
    const [dia, mes] = partes[0].split("/").map(Number);
    const [hora, min, seg] = partes[1].split(":").map(Number);
    const anoAtual = new Date().getFullYear();
    return new Date(anoAtual, mes - 1, dia, hora, min, seg || 0).getTime();
  };

  // Antigas em cima (timestamp menor), recentes embaixo (timestamp maior)
  return listaRelatos.sort((a, b) => converterDataHora(a.hora) - converterDataHora(b.hora));
}

// 3. Abre o Segundo Modal (Feed de Relatos)
export function abrirFeedDaTag(nomeTag) {
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

  const relatos = coletarMensagensDaTag(nomeTag);

  if (modalCount) {
    modalCount.textContent = `${relatos.length} relato${relatos.length === 1 ? "" : "s"}`;
  }

  feedList.innerHTML = "";

  if (relatos.length === 0) {
    feedList.innerHTML = `
      <div class="filter-tag-empty-box">
        <i class="bi bi-chat-square-text"></i>
        <strong>Nenhum relato recente</strong>
        <p style="font-size: 13px; margin: 0;">Nenhuma mensagem com a tag [${nomeTag}] foi enviada recentemente nesta sala.</p>
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

  feedModal.classList.remove("hidden");
  setBodyScrollLocked(true);

  // UX Chat-DF: Garante que o painel abra exibindo a mensagem mais recente (na base)
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