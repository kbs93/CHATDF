import { db } from './firebase-config.js';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit 
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// =========================================================================
// Mapeamento Centralizado: 10 Tags Exclusivas por Sala (Chat-DF)
// =========================================================================
export const TAGS_POR_SALA = {
  transito: {
    "Trânsito": { classe: "tag-transito", icon: "traffic" },
    "Acidente": { classe: "tag-alerta", icon: "car_crash" },
    "Fiscalização": { classe: "tag-fiscalizacao", icon: "shield_person" },
    "Metrô e BRT": { classe: "tag-transporte", icon: "train" },
    "Ônibus": { classe: "tag-transporte", icon: "directions_bus" },
    "Obras": { classe: "tag-transito", icon: "construction" },
    "Radar": { classe: "tag-fiscalizacao", icon: "speed" },
    "Parada": { classe: "tag-transporte", icon: "departure_board" },
    "Alagamento": { classe: "tag-transito", icon: "alt_route" },
    "Buracos": { classe: "tag-transito", icon: "navigation" }
  },
  religiao: {
    "Reflexão": { classe: "tag-religiao", icon: "auto_stories" },
    "Oração": { classe: "tag-religiao", icon: "folded_hands" },
    "Eventos": { classe: "tag-religiao", icon: "event" },
    "Visita": { classe: "tag-religiao", icon: "campaign" },
    "Culto e Missa": { classe: "tag-religiao", icon: "church" },
    "Testemunho": { classe: "tag-religiao", icon: "record_voice_over" },
    "Louvor": { classe: "tag-religiao", icon: "library_music" },
    "Estudo Bíblico": { classe: "tag-religiao", icon: "menu_book" },
    "Ação Social": { classe: "tag-religiao", icon: "volunteer_activism" },
    "Pedido": { classe: "tag-religiao", icon: "favorite" }
  },
  politica: {
    "GDF": { classe: "tag-politica", icon: "account_balance" },
    "Câmara DF": { classe: "tag-politica", icon: "gavel" },
    "Debate": { classe: "tag-politica", icon: "forum" },
    "Notícias": { classe: "tag-politica", icon: "newspaper" },
    "Projetos": { classe: "tag-politica", icon: "assignment" },
    "Eleições": { classe: "tag-politica", icon: "how_to_vote" },
    "Opinião": { classe: "tag-politica", icon: "chat" },
    "Congresso": { classe: "tag-politica", icon: "commute" },
    "Bastidores": { classe: "tag-politica", icon: "school" },
    "Propostas": { classe: "tag-politica", icon: "local_hospital" }
  },
  lugares: {
    "Bares": { classe: "tag-lugares", icon: "local_bar" },
    "Restaurantes": { classe: "tag-lugares", icon: "restaurant" },
    "Passeios": { classe: "tag-lugares", icon: "nature_people" },
    "Dicas DF": { classe: "tag-lugares", icon: "tips_and_updates" },
    "Cafés": { classe: "tag-lugares", icon: "local_cafe" },
    "Parques": { classe: "tag-lugares", icon: "park" },
    "Cachoeiras": { classe: "tag-lugares", icon: "water" },
    "Feiras": { classe: "tag-lugares", icon: "directions_walk" },
    "Picos Baratos": { classe: "tag-lugares", icon: "savings" },
    "Novidades": { classe: "tag-lugares", icon: "star" }
  },
  futebol: {
    "Brasileirão": { classe: "tag-futebol", icon: "sports_soccer" },
    "Futebol DF": { classe: "tag-futebol", icon: "sports_soccer" },
    "Peladas": { classe: "tag-futebol", icon: "group" },
    "Resenha": { classe: "tag-futebol", icon: "chat" },
    "Campo sintetico": { classe: "tag-futebol", icon: "shield" },
    "Quadra coberta": { classe: "tag-futebol", icon: "shield" },
    "Corrida de Rua": { classe: "tag-futebol", icon: "directions_run" },
    "Futsal": { classe: "tag-futebol", icon: "sports" },
    "Academia": { classe: "tag-futebol", icon: "fitness_center" },
    "Torcida": { classe: "tag-futebol", icon: "stadium" }
  },
  eventos: {
    "Shows": { classe: "tag-eventos", icon: "music_note" },
    "Festas": { classe: "tag-eventos", icon: "celebration" },
    "Cultural": { classe: "tag-eventos", icon: "theater_comedy" },
    "Gratuito": { classe: "tag-eventos", icon: "confirmation_number" },
    "Teatro": { classe: "tag-eventos", icon: "masks" },
    "Baladas": { classe: "tag-eventos", icon: "nightlife" },
    "Exposições": { classe: "tag-eventos", icon: "palette" },
    "Parque da Cidade": { classe: "tag-eventos", icon: "attractions" },
    "Ingressos": { classe: "tag-eventos", icon: "airplane_ticket" },
    "Festival": { classe: "tag-eventos", icon: "festival" }
  },
  entretenimento: {
    "Filmes e Séries": { classe: "tag-entretenimento", icon: "movie" },
    "Música": { classe: "tag-entretenimento", icon: "headphones" },
    "Livros": { classe: "tag-entretenimento", icon: "menu_book" },
    "Memes": { classe: "tag-entretenimento", icon: "sentiment_very_satisfied" },
    "Cinema": { classe: "tag-entretenimento", icon: "theaters" },
    "Streaming": { classe: "tag-entretenimento", icon: "tv" },
    "Anime": { classe: "tag-entretenimento", icon: "animation" },
    "Podcasts": { classe: "tag-entretenimento", icon: "mic" },
    "Humor": { classe: "tag-entretenimento", icon: "mood" },
    "Recomendações": { classe: "tag-entretenimento", icon: "thumb_up" }
  },
  games: {
    "PC e Console": { classe: "tag-games", icon: "sports_esports" },
    "Mobile": { classe: "tag-games", icon: "smartphone" },
    "Dicas": { classe: "tag-games", icon: "lightbulb" },
    "Torneios": { classe: "tag-games", icon: "emoji_events" },
    "PlayStation": { classe: "tag-games", icon: "gamepad" },
    "Xbox": { classe: "tag-games", icon: "videogame_asset" },
    "Nintendo": { classe: "tag-games", icon: "stadia_controller" },
    "Multiplayer": { classe: "tag-games", icon: "hub" },
    "Lançamentos": { classe: "tag-games", icon: "rocket_launch" },
    "Setup": { classe: "tag-games", icon: "desktop_windows" }
  },
  concurso: {
    "Editais": { classe: "tag-concursos", icon: "description" },
    "Dúvidas": { classe: "tag-concursos", icon: "help" },
    "Material": { classe: "tag-concursos", icon: "library_books" },
    "Dicas de Estudo": { classe: "tag-concursos", icon: "school" },
    "Locais de Prova": { classe: "tag-concursos", icon: "pin_drop" },
    "Bancas": { classe: "tag-concursos", icon: "domain" },
    "Gabaritos": { classe: "tag-concursos", icon: "fact_check" },
    "Inscrições": { classe: "tag-concursos", icon: "app_registration" },
    "Bibliotecas Publicas": { classe: "tag-concursos", icon: "balance" },
    "Polícia e DF": { classe: "tag-concursos", icon: "local_police" }
  }
};

// Dicionário global de busca
export const TAGS_CONFIG = Object.assign({}, ...Object.values(TAGS_POR_SALA));

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

// 1. Gera dinamicamente apenas os botões de tags da sala ativa
// 1. Gera dinamicamente apenas os botões de tags da sala ativa
function renderizarBotoesFiltro() {
  const container = document.getElementById("filterTagSelectList");
  if (!container) return;

  container.innerHTML = "";

  const salaAtualId = normalizeRoomIdTag(window.salaAtual);

  // Trava para a sala Bate-papo Geral ou qualquer sala sem tags configuradas
  if (salaAtualId === "geral" || !TAGS_POR_SALA[salaAtualId]) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 20px 10px; color: #64748b; font-size: 13.5px;">
        <i class="bi bi-chat-dots" style="font-size: 26px; display: block; margin-bottom: 8px; color: #7986cb;"></i>
        A sala <strong>Bate-papo Geral</strong> é livre e não possui filtros por tags.
      </div>
    `;
    return;
  }

  const tagsDaSala = TAGS_POR_SALA[salaAtualId];

  Object.entries(tagsDaSala).forEach(([nomeTag, config]) => {
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


// 2. Coleta mensagens do chat renderizadas no DOM local (Ajuste exato ao messages.js)
// Função auxiliar de formatação de data e hora do Firestore

const ROOM_ALIASES_TAG = {
  // Nomes exatos da interface (com e sem acento / com subtítulo)
  "Bate papo Geral": "geral",
  "geral": "geral",

  "Religião e Fé": "religiao",
  "Religião": "religiao",
  "Religiao": "religiao",
  "religiao": "religiao",

  "Política": "politica",
  "Politica": "politica",
  "politica": "politica",

  "Trânsito e Transporte": "transito",
  "Trânsito": "transito",
  "Transito": "transito",
  "transito": "transito",

  "Lugares para sair": "lugares",
  "Lugares": "lugares",
  "lugares": "lugares",

  "Futebol e Esportes": "futebol",
  "Futebol": "futebol",
  "futebol": "futebol",

  "Eventos e Shows": "eventos",
  "Eventos": "eventos",
  "eventos": "eventos",

  "Entretenimento": "entretenimento",
  "entretenimento": "entretenimento",

  "Games": "games",
  "games": "games",

  "Concurso Público": "concurso",
  "Concurso": "concurso",
  "Consurso Publico": "concurso",
  "concurso": "concurso"
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

// =========================================================================
// RENDERIZAÇÃO DO MODAL DE ENVIO DE TAGS (DINÂMICO POR SALA)
// =========================================================================
// =========================================================================
// RENDERIZAÇÃO DO MODAL DE ENVIO DE TAGS (DINÂMICO POR SALA)
// =========================================================================
export function renderizarModalEnvioTags() {
  const container = document.getElementById("tagsDfGridContainer");
  if (!container) return;

  container.innerHTML = "";

  const salaId = normalizeRoomIdTag(window.salaAtual);

  // Trava para a sala Bate-papo Geral
  if (salaId === "geral" || !TAGS_POR_SALA[salaId]) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 20px 10px; color: #64748b; font-size: 13.5px;">
        <i class="bi bi-chat-heart" style="font-size: 26px; display: block; margin-bottom: 8px; color: #7986cb;"></i>
        Esta é uma sala de conversa livre. As tags estão disponíveis nas outras salas temáticas.
      </div>
    `;
    return;
  }

  const tagsDaSala = TAGS_POR_SALA[salaId];

  Object.entries(tagsDaSala).forEach(([nomeTag, config]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn-tag-df ${config.classe}`;
    btn.setAttribute("data-tag", nomeTag);
    btn.innerHTML = `
      <span class="material-symbols-outlined">${config.icon}</span>
      <span>${nomeTag}</span>
    `;

    // Ao clicar na tag, insere [NomeDaTag] no input e fecha o modal
    btn.addEventListener("click", () => {
      const inputMsg = document.getElementById("messageInput");
      if (inputMsg) {
        inputMsg.value = `[${nomeTag}] ` + inputMsg.value.replace(/^\[.*?\]\s*/, "");
        inputMsg.focus();
      }
      document.getElementById("tagsDfModal")?.classList.add("hidden");
    });

    container.appendChild(btn);
  });
}

// Conecta a abertura do modal de envio ao botão do clipe (Tags)
if (window.attachmentActions) {
  window.attachmentActions.tags = () => {
    renderizarModalEnvioTags();
    document.getElementById("tagsDfModal")?.classList.remove("hidden");
  };
} else {
  document.addEventListener("click", (e) => {
    const itemTag = e.target.closest('[data-action="tags"]');
    if (itemTag) {
      renderizarModalEnvioTags();
      document.getElementById("tagsDfModal")?.classList.remove("hidden");
    }
  });
}

// Botão fechar do modal de envio
document.getElementById("closeTagsDfModal")?.addEventListener("click", () => {
  document.getElementById("tagsDfModal")?.classList.add("hidden");
});

// =========================================================================
// CONTROLE DE VISIBILIDADE DOS BOTOES DE TAG NO PAINEL DE ANEXOS (UX)
// =========================================================================
export function atualizarVisibilidadeBotoesTagsPorSala() {
  const salaId = normalizeRoomIdTag(window.salaAtual);
  const btnTags = document.getElementById("btnAttachTags");
  const btnFilterTags = document.getElementById("btnAttachFilterTags");

  if (!btnTags || !btnFilterTags) return;

  // Se estiver na sala Bate-papo Geral, oculta os dois botões
  if (salaId === "geral") {
    btnTags.classList.add("hidden");
    btnFilterTags.classList.add("hidden");
  } else {
    // Nas outras salas temáticas, exibe normalmente
    btnTags.classList.remove("hidden");
    btnFilterTags.classList.remove("hidden");
  }
}

// Atualiza a visibilidade toda vez que o painel de anexos (clipe) for clicado
document.getElementById("attachBtn")?.addEventListener("click", () => {
  atualizarVisibilidadeBotoesTagsPorSala();
});