import { rtdb } from "./firebase-config.js";
import { showToast } from "./ui.js";

import {
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";

// --- Criação das salas 17-05-26  ---
const salas = [

  {
    id: "geral",
    nome: "Bate papo Geral",
    descricao: "Resenha livre e amizades pelo quadradinho",
    icone:"bi bi-chat-dots"
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
  },

  {
    id: "transito",
    nome: "Trânsito e Transporte",
    descricao: "Mobilidade, Metrô e ônibus do DF",
    icone:"bi bi-sign-stop"
  },

  {
    id: "lugares",
    nome: "Lugares para sair",
    descricao: "Dicas de bares, cafés, lanchonetes e picos no quadradinho",
    icone: "bi bi-cup-hot"
  },

  {
    id: "futebol",
    nome: "Futebol e Esportes",
    descricao: "Gama, Brasiliense, peladas e grandes jogos",
    icone: "bi bi-trophy"
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
    id: "concurso",
    nome: "Concurso Público",
    descricao: "Acompanhamento e dicas sobre concursos públicos.",
    icone: "bi bi-journal-bookmark-fill"
  }

];
// ==========================================
// A CATRACA: LIMITE DE USUÁRIOS POR SALA 28-05-26 
// ==========================================
const container = document.getElementById("salas-lista");
const MAX_USERS_PER_ROOM =5; // Defina o limite máximo de usuários por sala
const roomCounts = {}; // Variável global para guardar a contagem em tempo real

salas.forEach((sala) => {

  const col = document.createElement("div");

col.className = "col-12 col-lg-6";

  const link = document.createElement("a");

  link.href = `chat.html?sala=${sala.id}`;

  link.className = "live-room-item room-card";

  link.innerHTML = `
  
    <div class="room-card-left">

      <div class="room-icon">
        <i class="bi ${sala.icone}"></i>
      </div>

      <div class="room-content">

        <strong>
          ${sala.nome}
        </strong>

        <p>
          ${sala.descricao}
        </p>

      </div>

    </div>

  <span 
  class="room-online"
 id="online-${sala.id}"
>
  0 online
</span>
  `;

// ==========================================
  // VERIFICAÇÃO DA CATRACA NO CLIQUE 28-05-26
  // ==========================================
  link.addEventListener("click", (e) => {
    // Pega o número atual de pessoas na sala (ou zero se estiver vazia)
    const totalNaSala = roomCounts[sala.id] || 0;
    if (totalNaSala >= MAX_USERS_PER_ROOM) {
      e.preventDefault(); // Trava a navegação (impede de abrir a sala)
      showToast(`A sala ${sala.nome} está Cheia no momento. Tente novamente em alguns minutos!`);
    }

  });

  col.appendChild(link);
  container.appendChild(col);

});

/* MUDANÇA  28-05-26 */


const statusRef = ref(rtdb, "status");

onValue(statusRef, (snapshot) => {

  const statusData = snapshot.val() || {};

  // 1. Zera a nossa contagem global
  salas.forEach((sala) => {
    roomCounts[sala.id] = 0;
  });

  // 2. Conta os usuários online e salva na variável da Catraca
  Object.values(statusData).forEach((user) => {
    if (!user?.online) return;

    const salaAtual = user.sala;

    if (roomCounts[salaAtual] !== undefined) {
      roomCounts[salaAtual]++;
    }
  });

  // 3. Atualiza o HTML das salas
  salas.forEach((sala) => {
    const el = document.getElementById(`online-${sala.id}`);
    if (!el) return;

    const total = roomCounts[sala.id] || 0;

    // Se bater o limite sala, mostra em destaque que está lotado
    if (total >= MAX_USERS_PER_ROOM) {
      el.innerHTML = `<span style="color: #07884c;">Sala Cheia ( ${MAX_USERS_PER_ROOM}/${MAX_USERS_PER_ROOM} )</span>`;
    } else {
      el.textContent = total === 1 ? "1 online" : `${total} online`;
    }
  });

});