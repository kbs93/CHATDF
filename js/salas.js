import { auth } from "./firebase-config.js";
import { showToast } from "./ui.js";
import { debounceUpdateRoomPresence, listenRoomsUserCounts } from "./presence.js";

// --- Criação das salas ---
export const salas = [
  {
    id: "geral",
    nome: "Bate papo Geral",
    descricao: "Resenha livre e amizades pelo quadradinho",
    icone: "bi bi-chat-dots"
  },
  {
    id: "concurso",
    nome: "Concurso Público",
    descricao: "Acompanhamento e dicas sobre concursos públicos.",
    icone: "bi bi-journal-bookmark-fill"
  },
  {
    id: "transito",
    nome: "Trânsito e Transporte",
    descricao: "Mobilidade, Metrô e ônibus do DF",
    icone: "bi bi-sign-stop"
  },
  {
    id: "lugares",
    nome: "Lugares para sair",
    descricao: "Dicas de bares, cafés, lanchonetes e picos no quadradinho",
    icone: "bi bi-cup-hot"
  },
  {
    id: "eventos",
    nome: "Eventos e Shows",
    descricao: "O que fazer no fim de semana em Brasília",
    icone: "bi bi-calendar2-day"
  },
  {
    id: "entretenimento",
    nome: "Entretenimento",
    descricao: "Fala Sobre Filmes,Series,Animes e musicas Favoritos.",
    icone: "bi bi-chat-heart"
  },
  {
    id: "games",
    nome: "Games",
    descricao: "Recomendação e tudo sobre jogos, online.",
    icone: "bi-controller"
  },
  {
    id: "futebol",
    nome: "Futebol e Esportes",
    descricao: "Gama, Brasiliense, peladas e grandes jogos",
    icone: "bi bi-trophy"
  },
  {
    id: "religiao",
    nome: "Religião e Fé",
    descricao: "Conversas, reflexões e eventos religiosos no DF",
    icone: "bi bi-house-heart"
  },
  {
    id: "politica",
    nome: "Politica",
    descricao: "Debates, opiniões sobre os bastidores da nossa capital ",
    icone: "bi bi-megaphone"
  }
];

// ==========================================
// A CATRACA: LIMITE DE USUÁRIOS POR SALA
// ==========================================
const container = document.getElementById("salas-lista");
const MAX_USERS_PER_ROOM = 5;
export const roomCounts = {};

if (container) {
  const urlParams = new URLSearchParams(window.location.search);
  const salaAtualUrl = (urlParams.get("sala") || "geral").toLowerCase();

  salas.forEach((sala) => {
    const col = document.createElement("div");
    col.className = "col-12 col-lg-6";

    const link = document.createElement("a");
    link.href = `chat.html?sala=${sala.id}`;
    link.dataset.salaId = sala.id;

    const isSalaAtiva = sala.id.toLowerCase() === salaAtualUrl;
    link.className = `live-room-item room-card ${isSalaAtiva ? "active" : ""}`;

    link.innerHTML = `
      <div class="room-card-left">
        <div class="room-icon">
          <i class="bi ${sala.icone}"></i>
        </div>
        <div class="room-content">
          <strong>${sala.nome}</strong>
          <p>${sala.descricao}</p>
        </div>
      </div>
      <span class="room-online" id="online-${sala.id}">0 online</span>
    `;

    // Interceptação de clique: SPA real sem recarregar
link.addEventListener("click", (e) => {
      e.preventDefault();

      const totalNaSala = roomCounts[sala.id] || 0;
      if (totalNaSala >= MAX_USERS_PER_ROOM) {
        showToast(`A sala ${sala.nome} está Cheia no momento. Tente novamente em alguns minutos!`);
        return;
      }

      // 1. Dispara a troca visual e de mensagens imediatamente (0ms de atraso)
      if (window.trocarSalaSemPiscar) {
        window.trocarSalaSemPiscar(sala.id);
      }

      // 2. Debounce de 7s no Realtime Database para economizar escritas e conexões
      const user = auth?.currentUser;
      if (user && user.uid) {
        debounceUpdateRoomPresence(user.uid, sala.id);
      }
    });

    col.appendChild(link);
    container.appendChild(col);
  });
}

// Ouvinte de Presença
// Ouvinte de Presença Delegado ao presence.js
listenRoomsUserCounts(salas, (counts) => {
  salas.forEach((sala) => {
    const total = counts[sala.id] || 0;
    roomCounts[sala.id] = total;

    const el = document.getElementById(`online-${sala.id}`);
    if (!el) return;

    if (total >= MAX_USERS_PER_ROOM) {
      el.innerHTML = `<span style="color: #07884c;">Sala Cheia ( ${MAX_USERS_PER_ROOM}/${MAX_USERS_PER_ROOM} )</span>`;
    } else {
      el.textContent = total === 1 ? "1 online" : `${total} online`;
    }
  });
});