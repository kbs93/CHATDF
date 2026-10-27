// ========================================================================
// js/privado.js - Bate-Papo Privado Efêmero 1 a 1 (Realtime Database)
// Arquitetura de Ligação Centralizada (conexoes_pv)
// Desacoplado: Sem histórico salvo, onDisconnect().remove() e zero custo no Firestore.
// ========================================================================

import {
  ref,
  push,
  set,
  update,
  onValue,
  off,
  remove,
  onDisconnect
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { auth, rtdb } from "./firebase-config.js";
import { showToast } from "./ui.js";

let chatPrivadoAtivoId = null;
let ouvinteSessaoAtiva = null;
let ouvinteConvitesRecebidos = null;
let outroUsuarioData = null;

function obterChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

function sanitizarTexto(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function injetarDOMPrivado() {
  if (document.getElementById("containerChatPrivado")) return;
  if (!document.body) return;
  const html = `
    <!-- Fundo escuro do Bottom Sheet -->
    <div id="privadoBackdrop" class="privado-backdrop hidden"></div>

    <!-- Janela Bottom Sheet do Chat Privado -->
    <div id="containerChatPrivado" class="privado-flutuante hidden">
      <!-- Barra para puxar para baixo no telemóvel -->
      <div class="privado-drag-indicator">
        <div class="privado-drag-handle"></div>
      </div>
      <div class="privado-header">
        <div class="privado-user-info">
          <img id="privadoAvatar" src="./img/avatar.png" class="privado-avatar" alt="Avatar">
          <div class="privado-user-detalhes">
            <span id="privadoNome" class="privado-nome">Usuário</span>
            <span class="privado-status">Privado temporário</span>
          </div>
        </div>
        <div class="privado-header-actions">
          <button type="button" id="btnMinimizarPrivado" class="privado-btn-header" title="Minimizar">_</button>
          <button type="button" id="btnFecharPrivado" class="privado-btn-header" title="Encerrar conversa">✕</button>
        </div>
      </div>

      <div id="privadoCorpoMensagens" class="privado-mensagens">
        <div class="privado-aviso-seguranca">
          <i class="bi bi-shield-check"></i>
          <span>Mensagens efêmeras: esta conversa é apagada ao fechar a janela.</span>
        </div>
      </div>

      <form id="privadoFormEnvio" class="privado-input-area">
        <input type="text" id="privadoInputMsg" placeholder="Mensagem privada..." maxlength="500" autocomplete="off">
        <button type="submit" id="privadoBtnEnviar" title="Enviar">
          <i class="bi bi-send-fill"></i>
        </button>
      </form>
    </div>

    <!-- Modal de Convite de Privado -->
    <div id="modalSolicitacaoPrivado" class="modal-solicitacao-pv hidden">
      <div class="card-solicitacao-pv">
        <div class="solicitacao-avatar-wrap">
          <img id="solicitacaoAvatar" src="./img/avatar.png" alt="Avatar">
        </div>
        <h5 id="solicitacaoTitulo">Convite de Privado</h5>
        <p id="solicitacaoTexto">Um usuário quer conversar com você no privado.</p>
        <div class="solicitacao-acoes">
          <button type="button" id="btnRecusarPrivado" class="btn-recusar-pv">Recusar</button>
          <button type="button" id="btnAceitarPrivado" class="btn-aceitar-pv">Conversar</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("beforeend", html);
  configurarEventosDOM();
}

function configurarEventosDOM() {
  const container = document.getElementById("containerChatPrivado");
  const form = document.getElementById("privadoFormEnvio");
  const input = document.getElementById("privadoInputMsg");
  const btnFechar = document.getElementById("btnFecharPrivado");
  const btnMinimizar = document.getElementById("btnMinimizarPrivado");
  const btnEnviar = document.getElementById("privadoBtnEnviar");

  container?.addEventListener("click", (e) => {
    e.stopPropagation();
  });
  container?.addEventListener("mousedown", (e) => {
    e.stopPropagation();
  });

  const resetarPosicaoArrasto = () => {
    if (!container) return;
    container.style.removeProperty("left");
    container.style.removeProperty("top");
    container.style.removeProperty("bottom");
    container.style.removeProperty("right");
    container.style.removeProperty("transform");
    container.classList.remove("arrastando");
  };

  const processarEnvioPrivado = () => {
    const texto = input?.value.trim();
    if (!texto || !chatPrivadoAtivoId) return;

    enviarMensagemPrivada(texto);
    input.value = "";
    input.focus({ preventScroll: true });
  };

  btnEnviar?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    processarEnvioPrivado();
  });

  btnEnviar?.addEventListener("click", (e) => {
    e.preventDefault();
    processarEnvioPrivado();
  });

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    e.stopPropagation();
    processarEnvioPrivado();
  });

  btnFechar?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetarPosicaoArrasto();
    encerrarChatPrivado(true);
  });

  btnMinimizar?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    resetarPosicaoArrasto();
    container?.classList.toggle("minimizado");
  });

  const mainInput = document.getElementById("messageInput");
  if (mainInput) {
    mainInput.addEventListener("focus", () => {
      if (container && !container.classList.contains("hidden") && !container.classList.contains("minimizado")) {
        resetarPosicaoArrasto();
        container.classList.add("minimizado");
      }
    });
  }

  // Arrasto quando minimizado
  let isDragging = false;
  let hasMoved = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  const onPointerDown = (e) => {
    if (!container || !container.classList.contains("minimizado")) return;
    if (e.target.closest("#btnFecharPrivado") || e.target.closest("#btnMinimizarPrivado")) return;

    isDragging = true;
    hasMoved = false;
    startX = e.clientX;
    startY = e.clientY;

    const rect = container.getBoundingClientRect();
    initialLeft = rect.left;
    initialTop = rect.top;

    container.style.bottom = "auto";
    container.style.right = "auto";
    container.style.left = `${initialLeft}px`;
    container.style.top = `${initialTop}px`;
    container.style.transform = "none";

    try {
      container.setPointerCapture(e.pointerId);
    } catch (_) {}
  };

  const onPointerMove = (e) => {
    if (!isDragging || !container || !container.classList.contains("minimizado")) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    if (!hasMoved && (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6)) {
      hasMoved = true;
      container.classList.add("arrastando");
    }

    if (hasMoved) {
      let newLeft = initialLeft + deltaX;
      let newTop = initialTop + deltaY;

      const maxLeft = window.innerWidth - container.offsetWidth - 8;
      const maxTop = window.innerHeight - container.offsetHeight - 8;

      newLeft = Math.max(8, Math.min(newLeft, maxLeft));
      newTop = Math.max(8, Math.min(newTop, maxTop));

      container.style.left = `${newLeft}px`;
      container.style.top = `${newTop}px`;
    }
  };

  const onPointerUp = (e) => {
    if (!isDragging) return;
    isDragging = false;
    container?.classList.remove("arrastando");

    try {
      if (container && container.hasPointerCapture(e.pointerId)) {
        container.releasePointerCapture(e.pointerId);
      }
    } catch (_) {}

    if (!hasMoved && container) {
      resetarPosicaoArrasto();
      container.classList.remove("minimizado");
    }
  };

  container?.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerUp);

  // Gesto mobile para recolher
  let sheetStartY = 0;
  let isDraggingSheet = false;
  let podePuxarJanela = false;

  container?.addEventListener("touchstart", (e) => {
    if (container.classList.contains("minimizado") || window.innerWidth > 576) return;
    if (e.target.closest("input") || e.target.closest("button") || e.target.closest("#btnFecharPrivado")) return;

    const corpoMsg = document.getElementById("privadoCorpoMensagens");
    if (corpoMsg && e.target.closest("#privadoCorpoMensagens")) {
      if (corpoMsg.scrollTop > 5) return;
    }

    podePuxarJanela = true;
    isDraggingSheet = true;
    sheetStartY = e.touches[0].clientY;
    container.style.transition = "none";
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (!isDraggingSheet || !podePuxarJanela || container.classList.contains("minimizado")) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - sheetStartY;

    if (deltaY > 0) {
      if (e.cancelable) e.preventDefault();
      container.style.transform = `translateY(${deltaY}px)`;
    }
  }, { passive: false });

  const finalizarGestoSheet = (e) => {
    if (!isDraggingSheet) return;
    isDraggingSheet = false;
    podePuxarJanela = false;

    const endY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : sheetStartY;
    const deltaY = endY - sheetStartY;

    container.style.transition = "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)";

    if (deltaY > 60) {
      resetarPosicaoArrasto();
      container.classList.add("minimizado");
    } else {
      container.style.transform = "none";
    }
  };

  window.addEventListener("touchend", finalizarGestoSheet);
  window.addEventListener("touchcancel", finalizarGestoSheet);
}

async function enviarMensagemPrivada(texto) {
  const user = auth.currentUser;
  if (!user || !chatPrivadoAtivoId) return;

  try {
    const mensagensRef = ref(rtdb, `conexoes_pv/${chatPrivadoAtivoId}/mensagens`);
    const novaMsgRef = push(mensagensRef);

    await set(novaMsgRef, {
      senderId: user.uid,
      senderNome: user.displayName || "Usuário",
      text: texto,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error("Erro ao enviar mensagem privada:", err);
    showToast("Erro ao entregar mensagem privada.");
  }
}

function renderizarMensagemPrivada(msgData) {
  const corpo = document.getElementById("privadoCorpoMensagens");
  if (!corpo) return;

  const user = auth.currentUser;
  const isMinha = user && msgData.senderId === user.uid;

  const d = new Date(msgData.timestamp || Date.now());
  const hora = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  const div = document.createElement("div");
  div.className = `privado-balao ${isMinha ? "enviada" : "recebida"}`;
  div.innerHTML = `
    <span class="privado-texto">${sanitizarTexto(msgData.text)}</span>
    <span class="privado-hora">${hora}</span>
  `;

  corpo.appendChild(div);
  corpo.scrollTop = corpo.scrollHeight;
}

function abrirJanelaPrivadoVisual(avatar, nome) {
  injetarDOMPrivado();
  const container = document.getElementById("containerChatPrivado");
  const avatarEl = document.getElementById("privadoAvatar");
  const nomeEl = document.getElementById("privadoNome");
  const corpo = document.getElementById("privadoCorpoMensagens");

  if (avatarEl) avatarEl.src = avatar || "./img/avatar.png";
  if (nomeEl) nomeEl.textContent = nome || "Usuário";
  if (corpo) {
    corpo.innerHTML = `
      <div class="privado-aviso-seguranca">
        <i class="bi bi-shield-check"></i>
        <span>Mensagens efêmeras: esta conversa é apagada ao fechar a janela.</span>
      </div>
    `;
  }

  container?.classList.remove("hidden", "minimizado");
}

function fecharJanelaPrivadoVisual() {
  const container = document.getElementById("containerChatPrivado");
  if (container) {
    container.classList.add("hidden");
    container.classList.remove("minimizado");
    container.style.removeProperty("left");
    container.style.removeProperty("top");
    container.style.removeProperty("bottom");
    container.style.removeProperty("right");
    container.style.removeProperty("transform");
  }

  const corpo = document.getElementById("privadoCorpoMensagens");
  if (corpo) {
    corpo.innerHTML = `
      <div class="privado-aviso-seguranca">
        <i class="bi bi-shield-check"></i>
        <span>Mensagens efêmeras: esta conversa é apagada ao fechar a janela.</span>
      </div>
    `;
  }
}

function desconectarOuvinteSessao() {
  if (ouvinteSessaoAtiva && chatPrivadoAtivoId) {
    off(ref(rtdb, `conexoes_pv/${chatPrivadoAtivoId}`));
    ouvinteSessaoAtiva = null;
  }
}

// =========================================================================
// INICIAR CONVERSA PRIVADA (REMETENTE SOLICITA A LIGAÇÃO)
// =========================================================================
export async function iniciarConversaPrivada(outroUid, outroNome, outroAvatar) {
  const user = auth.currentUser;
  if (!user) {
    showToast("Faça login para conversar no privado.");
    return;
  }

  if (user.uid === outroUid) {
    showToast("Você não pode abrir privado com você mesmo.");
    return;
  }

  const wrapper = document.getElementById("message-input-wrapper");
  if (wrapper && wrapper.classList.contains("profile-locked")) {
    showToast("Complete seu perfil para chamar no privado.");
    document.dispatchEvent(new CustomEvent("chatdf:open-profile"));
    return;
  }

  const novoChatId = obterChatId(user.uid, outroUid);

  // REGRA DE CONVERSA ÚNICA: Impede chamar outro utilizador se já estiver numa ligação ativa
  if (chatPrivadoAtivoId && chatPrivadoAtivoId !== novoChatId) {
    showToast("Feche a conversa atual no 'X' para iniciar outra.");
    return;
  }

  injetarDOMPrivado();
  desconectarOuvinteSessao();

  chatPrivadoAtivoId = novoChatId;
  outroUsuarioData = {
    uid: outroUid,
    nome: outroNome || "Usuário",
    avatar: outroAvatar || "./img/avatar.png"
  };

const sessaoRef = ref(rtdb, `conexoes_pv/${novoChatId}`);
  const solicitacaoRef = ref(rtdb, `solicitacoes_pv/${outroUid}/${user.uid}`);

  // Regista o nó da sessão
  await set(sessaoRef, {
    remetenteUid: user.uid,
    remetenteNome: user.displayName || "Usuário",
    remetenteAvatar: user.photoURL || "./img/avatar.png",
    destinatarioUid: outroUid,
    status: "aguardando",
    timestamp: Date.now()
  });

  // Regista na caixa direta do destinatário (garante o alerta imediato)
  await set(solicitacaoRef, {
    chatId: novoChatId,
    remetenteUid: user.uid,
    remetenteNome: user.displayName || "Usuário",
    remetenteAvatar: user.photoURL || "./img/avatar.png",
    status: "aguardando",
    timestamp: Date.now()
  });

  onDisconnect(sessaoRef).remove();
  onDisconnect(solicitacaoRef).remove();

  showToast(`Chamando ${outroUsuarioData.nome} no privado...`);

  // Garante que, se o remetente cair ou fechar a janela, o nó é destruído
  onDisconnect(sessaoRef).remove();

  showToast(`Chamando ${outroUsuarioData.nome} no privado...`);

  // O remetente escuta o nó da ligação para reagir à aceitação ou recusa
  ouvinteSessaoAtiva = onValue(sessaoRef, (snapshot) => {
    const dados = snapshot.val();

    // Se o nó foi apagado (por exemplo, encerramento ou saída súbita)
    if (!dados) {
      if (document.getElementById("containerChatPrivado")?.classList.contains("hidden") === false) {
        showToast("A conversa privada foi encerrada.");
      }
      encerrarChatPrivado(false);
      return;
    }

    // 1. Destinatário recusou a conversa
    if (dados.status === "recusada") {
      showToast(`${outroUsuarioData?.nome || "O usuário"} Conversa não aceita.`);
      desconectarOuvinteSessao();
      remove(sessaoRef).catch(() => {});
      encerrarChatPrivado(false);
      return;
    }

    // 2. Destinatário aceitou a conversa: abre a janela e carrega as mensagens
    if (dados.status === "ativa") {
      const container = document.getElementById("containerChatPrivado");
      if (container && container.classList.contains("hidden")) {
        abrirJanelaPrivadoVisual(outroUsuarioData.avatar, outroUsuarioData.nome);
      }

      // Renderiza as mensagens trocadas em tempo real
      const corpo = document.getElementById("privadoCorpoMensagens");
      if (corpo && dados.mensagens) {
        corpo.innerHTML = `
          <div class="privado-aviso-seguranca">
            <i class="bi bi-shield-check"></i>
            <span>Mensagens efêmeras: esta conversa é apagada ao fechar a janela.</span>
          </div>
        `;
        Object.values(dados.mensagens).forEach((msg) => {
          renderizarMensagemPrivada(msg);
        });
      }
    }
  });
}

// =========================================================================
// MONITORAR CONVITES RECEBIDOS (DESTINATÁRIO ESCUTA SE ESTÁ A SER CHAMADO)
// =========================================================================
export function monitorarSolicitacoesRecebidas(meuUid) {
  if (!meuUid) return;

  // Escuta diretamente a caixa do utilizador (já permitida nas suas regras)
  const minhaCaixaRef = ref(rtdb, `solicitacoes_pv/${meuUid}`);

  if (ouvinteConvitesRecebidos) {
    off(minhaCaixaRef);
  }

  ouvinteConvitesRecebidos = onValue(minhaCaixaRef, (snapshot) => {
    const dados = snapshot.val();
    const modal = document.getElementById("modalSolicitacaoPrivado");

    if (!dados) {
      modal?.classList.add("hidden");
      return;
    }

    const pendentes = Object.entries(dados).filter(([_, item]) => item.status === "aguardando");
    if (!pendentes.length) {
      modal?.classList.add("hidden");
      return;
    }

    const [remetenteUid, convite] = pendentes[pendentes.length - 1];
    const chatId = convite.chatId || obterChatId(meuUid, remetenteUid);

    if (chatPrivadoAtivoId && chatPrivadoAtivoId !== chatId) {
      return;
    }

    exibirModalConvite(chatId, convite);
  });
}

function exibirModalConvite(chatId, convite) {
  injetarDOMPrivado();

  const modal = document.getElementById("modalSolicitacaoPrivado");
  const avatar = document.getElementById("solicitacaoAvatar");
  const titulo = document.getElementById("solicitacaoTitulo");
  const texto = document.getElementById("solicitacaoTexto");
  const btnAceitar = document.getElementById("btnAceitarPrivado");
  const btnRecusar = document.getElementById("btnRecusarPrivado");

  if (!modal) return;

  if (avatar) avatar.src = convite.remetenteAvatar || "./img/avatar.png";
  if (titulo) titulo.textContent = `${convite.remetenteNome}`;
  if (texto) texto.textContent = `${convite.remetenteNome} chamou você para uma conversa privada.`;

  modal.classList.remove("hidden");

  // AÇÃO AO CLICAR EM CONVERSAR (ACEITAR)
// AÇÃO AO CLICAR EM CONVERSAR (ACEITAR)
  btnAceitar.onclick = async () => {
    modal.classList.add("hidden");
    const user = auth.currentUser;
    if (!user) return;

    // Limpa o convite da caixa de entrada
    remove(ref(rtdb, `solicitacoes_pv/${user.uid}/${convite.remetenteUid}`)).catch(() => {});

    desconectarOuvinteSessao();

    chatPrivadoAtivoId = chatId;
    outroUsuarioData = {
      uid: convite.remetenteUid,
      nome: convite.remetenteNome,
      avatar: convite.remetenteAvatar
    };

    const sessaoRef = ref(rtdb, `conexoes_pv/${chatId}`);

    // Ativa a ligação
    await update(sessaoRef, {
      status: "ativa"
    });

    onDisconnect(sessaoRef).remove();

    abrirJanelaPrivadoVisual(outroUsuarioData.avatar, outroUsuarioData.nome);

    ouvinteSessaoAtiva = onValue(sessaoRef, (snapshot) => {
      const dados = snapshot.val();
      if (!dados) {
        showToast("A conversa privada foi encerrada.");
        encerrarChatPrivado(false);
        return;
      }

      const corpo = document.getElementById("privadoCorpoMensagens");
      if (corpo && dados.mensagens) {
        corpo.innerHTML = `
          <div class="privado-aviso-seguranca">
            <i class="bi bi-shield-check"></i>
            <span>Mensagens efêmeras: esta conversa é apagada ao fechar a janela.</span>
          </div>
        `;
        Object.values(dados.mensagens).forEach((msg) => {
          renderizarMensagemPrivada(msg);
        });
      }
    });
  };

  // AÇÃO AO CLICAR EM RECUSAR
  btnRecusar.onclick = async () => {
    modal.classList.add("hidden");
    const user = auth.currentUser;

    if (user) {
      remove(ref(rtdb, `solicitacoes_pv/${user.uid}/${convite.remetenteUid}`)).catch(() => {});
    }

    try {
      const sessaoRef = ref(rtdb, `conexoes_pv/${chatId}`);
      await update(sessaoRef, {
        status: "recusada"
      });
    } catch (e) {
      console.warn("Falha ao atualizar recusa da ligação:", e);
    }
  };

  // AÇÃO AO CLICAR EM RECUSAR
  btnRecusar.onclick = async () => {
    modal.classList.add("hidden");

    try {
      const sessaoRef = ref(rtdb, `conexoes_pv/${chatId}`);
      // Marca como recusada para notificar imediatamente o remetente
      await update(sessaoRef, {
        status: "recusada"
      });
    } catch (e) {
      console.warn("Falha ao atualizar recusa da ligação:", e);
    }
  };
}

// =========================================================================
// ENCERRAMENTO E LIMPEZA TOTAL DA SESSÃO PRIVADA
// =========================================================================
export function encerrarChatPrivado(destruirNoBanco = true) {
  const chatIdParaRemover = chatPrivadoAtivoId;

  desconectarOuvinteSessao();

  if (destruirNoBanco && chatIdParaRemover) {
    remove(ref(rtdb, `conexoes_pv/${chatIdParaRemover}`)).catch(() => {});
  }

  chatPrivadoAtivoId = null;
  outroUsuarioData = null;

  fecharJanelaPrivadoVisual();
}

function inicializarSeguro() {
  injetarDOMPrivado();
  if (auth.currentUser) {
    monitorarSolicitacoesRecebidas(auth.currentUser.uid);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", inicializarSeguro);
} else {
  inicializarSeguro();
}

document.addEventListener("chatdf:user-ready", (e) => {
  const user = e.detail?.user;
  if (user?.uid) {
    injetarDOMPrivado();
    monitorarSolicitacoesRecebidas(user.uid);
  }
});

document.addEventListener("chatdf:user-logout", () => {
  encerrarChatPrivado(false);
  const user = auth.currentUser;
  if (ouvinteConvitesRecebidos && user) {
    off(ref(rtdb, `solicitacoes_pv/${user.uid}`));
    ouvinteConvitesRecebidos = null;
  }
});

window.iniciarConversaPrivada = iniciarConversaPrivada;