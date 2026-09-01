
import { showToast, textColorPalette } from "./ui.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { auth, db, rtdb } from "./firebase-config.js";
import { ref as rRef, update as rUpdate } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";


// Estado global do módulo VIP
window.__vipMENSAGEM_COR_SELECIONADA = "#333333";
window.__vipNOME_COR_SELECIONADA = "#6f42c1";

// Função auxiliar de fallback cirúrgico para evitar quebras em mobile
function obterFallbackFonteVip(fonte) {
  const cursivas = [
    "Charm-Bold", "CherryBombOne", "EduAUVICWANTHand", "MeaCulpa", 
    "PlaywriteBEVLG", "Praise", "RockSalt", "Tangerine", "Courgette", 
    "Lobster", "Bangers", "Pacifico", "Satisfy"
  ];
  const serifadas = ["CinzelDecorative", "CaesarDressing", "Pridi", "Pridi-ExtraLight", "Pridi-SemiBold", "UnifrakturMaguntia"];

  if (cursivas.includes(fonte)) return "cursive";
  if (serifadas.includes(fonte)) return "serif";
  return "sans-serif";
}



/* ========================================================================
   APLICAÇÃO VISUAL VIP (INFO / VISUALIZAÇÃO)
===================================================================== */
export function aplicarVisualVipCompleto(data = {}) {
  const topName = document.getElementById("profileName");
  const topFrame = document.getElementById("vipTopPreviewFrame");
  const topBanner = document.querySelector(".profile-cover");
  const topTag = document.getElementById("vipTopPreviewTag");
  const topMood = document.getElementById("profileMood");
  const profilePanel = document.getElementById("profilePanel");

  if (!topName || !topBanner) return;

  const nome = data.nome || "Usuário";
  const bannerCorOriginal = data.bannerColor || "#00000063";

  const temEfeitoNome = data.vipNameColorType && data.vipNameColorType !== "solid";
  const temCorNome = !!data.vipNameColorSolid;
  const temFonte = data.vipNameFont && data.vipNameFont !== "default";
  const temMoldura = data.vipAvatarFrame && data.vipAvatarFrame !== "none";
  const temTema = data.vipProfileBanner && data.vipProfileBanner !== "default";
  const temBannerUrl = !!data.vipBannerUrl;
  const isVipUser = data.isVip === true;

  // 1. Nome
  topName.className = "fw-bold";
  topName.style.background = "";
  topName.style.webkitBackgroundClip = "";
  topName.style.webkitTextFillColor = "";
  topName.style.color = "";
  topName.style.fontFamily = "";
  topName.textContent = nome;

  if (temEfeitoNome) {
    topName.className = topName.className.replace(/nick-\S+/g, "").trim();
    topName.classList.add(`nick-${data.vipNameColorType}`);
  } else if (temCorNome) {
    topName.style.color = data.vipNameColorSolid;
  }

// 2. Fonte
  if (temFonte) {
    const fallback = obterFallbackFonteVip(data.vipNameFont);
    topName.style.fontFamily = `'${data.vipNameFont}', ${fallback}`;
  }

  // 3. Moldura
  if (topFrame) {
    topFrame.className = "position-absolute top-0 start-0 w-100 h-100 rounded-circle d-none";
    if (temMoldura) {
      topFrame.className = `position-absolute top-0 start-0 w-100 h-100 rounded-circle ${data.vipAvatarFrame}`;
    }
  }

  // 4. Banner / Capa
  if (data.isVip === true && temBannerUrl) {
    topBanner.style.background = `url("${data.vipBannerUrl}") center/cover no-repeat`;
  } else {
    topBanner.style.backgroundImage = "none";
    topBanner.style.background = bannerCorOriginal;
  }

  // 5. Tema
  if (profilePanel) {
    profilePanel.className = profilePanel.className.replace(/banner-\S+/g, "").trim();
    if (temTema) {
      profilePanel.classList.add(data.vipProfileBanner);
    } else {
      profilePanel.style.background = "";
    }
  }

  // 6. Tag Diamante
  if (topTag) {
    if (isVipUser) {
      topTag.classList.remove("d-none");
      topTag.classList.add("d-inline-block");
    } else {
      topTag.classList.remove("d-inline-block");
      topTag.classList.add("d-none");
    }
  }

  // 7. Recado
  if (topMood) {
    topMood.style.display = "block";
  }
}

/* ========================================================================
   RESTAURAÇÃO DO PADRÃO ORIGINAL DO PERFIL
===================================================================== */
export function restaurarVisualPadraoPerfil(selectedBannerColor = "#00000063") {
  const topName = document.getElementById("profileName");
  const topFrame = document.getElementById("vipTopPreviewFrame");
  const topBanner = document.querySelector(".profile-cover");
  const profilePanel = document.getElementById("profilePanel");
  const data = window.__currentProfileData || {};

  if (topName) {
    topName.className = "fw-bold";
    topName.style.background = "";
    topName.style.webkitBackgroundClip = "";
    topName.style.webkitTextFillColor = "";
    topName.style.fontFamily = "";
    topName.style.color = "";
    topName.textContent = data.nome || "Usuário";
  }

  if (topFrame) {
    topFrame.className = "position-absolute top-0 start-0 w-100 h-100 rounded-circle d-none";
  }

  if (topBanner) {
    topBanner.className = "profile-cover position-relative";
    topBanner.style.backgroundImage = "none";
    topBanner.style.background = data.bannerColor || selectedBannerColor || "#00000063";
  }

  if (profilePanel) {
    profilePanel.classList.remove("vip-mode-active");
    profilePanel.className = profilePanel.className.replace(/banner-\S+/g, "").trim();
    profilePanel.style.padding = "";
    profilePanel.style.background = "";
  }

  const typeSelect = document.getElementById("vipNameColorType");
  const fontSelect = document.getElementById("vipNameFont");
  const frameSelect = document.getElementById("vipAvatarFrameSelect");
  const bannerSelect = document.getElementById("vipProfileBannerSelect");

if (typeSelect) typeSelect.value = "none";
  if (fontSelect) fontSelect.value = "default";
  if (frameSelect) frameSelect.value = "none";
  if (bannerSelect) bannerSelect.value = "default";

  const btnType = document.getElementById("btnVipNameColorType");
  const btnFont = document.getElementById("btnVipNameFont");
  const btnFrame = document.getElementById("btnVipAvatarFrameSelect");
  const btnBanner = document.getElementById("btnVipProfileBannerSelect");

if (btnType) btnType.textContent = "Escolha uma cor";
  if (btnFont) btnFont.textContent = "Padrão do Chat";
  if (btnFrame) btnFrame.textContent = "Nenhuma Moldura";
  if (btnBanner) btnBanner.textContent = "Padrão do Sistema";

  document.querySelectorAll('.vip-custom-dropdown').forEach(dropdown => {
    dropdown.querySelectorAll('.vip-dropdown-option').forEach(option => {
      option.classList.remove('active');
      const val = option.getAttribute('data-value');
      if (val === "solid" || val === "default" || val === "none") {
        option.classList.add('active');
      }
    });
    dropdown.classList.add('hidden');
  });

  window.__vipNOME_COR_SELECIONADA = "#6f42c1";
  window.__vipMENSAGEM_COR_SELECIONADA = "#333333";
}

/* ========================================================================
   SIMULADOR / ATUALIZAÇÃO DO TOPO VIP
===================================================================== */
export function atualizarSimulacaoTopoVip(selectedBannerColor = "#00000063") {
  const topName = document.getElementById("profileName");
  const topText = document.getElementById("vipTopPreviewText");
  const topFrame = document.getElementById("vipTopPreviewFrame");
  const topBanner = document.querySelector(".profile-cover");
  const profilePanel = document.getElementById("profilePanel");
  const solidWrapper = document.getElementById("vipSolidColorWrapper");
  const typeSelect = document.getElementById("vipNameColorType");
  const fontSelect = document.getElementById("vipNameFont");
  const frameSelect = document.getElementById("vipAvatarFrameSelect");
  const bannerSelect = document.getElementById("vipProfileBannerSelect");

  if (!topName || !topText || !topFrame || !topBanner) return;

  topName.className = "fw-bold";
  topName.style.background = "";
  topName.style.webkitBackgroundClip = "";
  topName.style.webkitTextFillColor = "";
  topName.style.color = "";

const valorEfeito = typeSelect ? typeSelect.value : "none";

  if (valorEfeito === "solid") {
    if (solidWrapper) solidWrapper.classList.remove("hidden");
    topName.style.color = window.__vipNOME_COR_SELECIONADA || "#6f42c1";
  } else {
    if (solidWrapper) solidWrapper.classList.add("hidden");
    topName.className = topName.className.replace(/nick-\S+/g, "").trim();
    if (valorEfeito !== "none" && valorEfeito !== "default") {
      topName.classList.add(`nick-${valorEfeito}`);
    }
  }

if (fontSelect) {
    if (fontSelect.value !== "default") {
      const fallback = obterFallbackFonteVip(fontSelect.value);
      topName.style.fontFamily = `'${fontSelect.value}', ${fallback}`;
    } else {
      topName.style.fontFamily = "";
    }
  }

  if (topText) {
    topText.style.color = window.__vipMENSAGEM_COR_SELECIONADA || "#333333";
  }

  if (topFrame) {
    topFrame.className = "position-absolute top-0 start-0 w-100 h-100 rounded-circle";
    const valorMoldura = frameSelect ? frameSelect.value : "none";
    if (valorMoldura !== "none") {
      topFrame.classList.remove("d-none");
      topFrame.classList.add(valorMoldura);
    } else {
      topFrame.classList.add("d-none");
    }
  }

  if (profilePanel && bannerSelect) {
    profilePanel.className = profilePanel.className.replace(/banner-\S+/g, "").trim();
    const data = window.__currentProfileData || {};

    if (bannerSelect.value === "default") {
      profilePanel.style.border = "";
      profilePanel.style.background = "";
    } else {
      profilePanel.classList.add(bannerSelect.value);
    }
if (topBanner) {
      const bannerUrlAtual = window.__vipBannerUrlTemp !== undefined ? window.__vipBannerUrlTemp : data.vipBannerUrl;
      if (bannerUrlAtual) {
        topBanner.style.background = `url("${bannerUrlAtual}") center/cover no-repeat`;
      } else {
        topBanner.style.backgroundImage = "none";
        topBanner.style.background = selectedBannerColor || "#00000063";
      }
    }

  }
}
window.atualizarSimulacaoTopoVip = atualizarSimulacaoTopoVip;


/* ========================================================================
   INICIALIZACAO DO PAINEL VIP (COM CONTADOR E TRAVA COMPLETA DE BOTÕES)
===================================================================== */
/* ========================================================================
   INICIALIZAÇÃO DO PAINEL VIP (COM CONTADOR E TRAVA COMPLETA DE BOTÕES)
===================================================================== */
let vipCountdownInterval = null;

// Função auxiliar para formatar o tempo regressivo de forma limpa
function formatarTempoRegressivoVip(msRestantes) {
  if (msRestantes <= 0) return "VIP Expirado";

  const totalSegundos = Math.floor(msRestantes / 1000);
  const dias = Math.floor(totalSegundos / 86400);
  const horas = Math.floor((totalSegundos % 86400) / 3600);
  const minutos = Math.floor((totalSegundos % 3600) / 60);
  const segundos = totalSegundos % 60;

  const pad = (n) => String(n).padStart(2, "0");

  if (dias > 0) {
    return `${dias}d ${pad(horas)}h ${pad(minutos)}m`;
  }
  if (horas > 0) {
    return `${pad(horas)}h ${pad(minutos)}m ${pad(segundos)}s`;
  }
  return `${pad(minutos)}m ${pad(segundos)}s`;
}

export function inicializarPainelVipDinamico(editNameValue, selectedAvatar) {
  if (vipCountdownInterval) {
    clearInterval(vipCountdownInterval);
    vipCountdownInterval = null;
  }

  const btnSaveVip = document.getElementById("btnSaveVipSettings");
  const customCards = document.querySelectorAll('.vip-btn-card:not([data-target="gaveta-renovar"])');
  const vipBannerHeaderBtn = document.getElementById("vipHeaderActionBtn");

  const atualizarStatusInterfaceVip = () => {
    const data = window.__currentProfileData || {};
    const isVipAtivo = data.isVip === true;
    const agora = Date.now();
    const expiresAt = data.vipExpiresAt || 0;
    const diffMs = expiresAt - agora;

    const topExpiryDays = document.getElementById("vipTopExpiryDays");
    const drawerExpiryDays = document.getElementById("vipDrawerExpiryDays");
    const drawerBtnRenew = document.getElementById("btnDrawerRenewVip");

    if (isVipAtivo && diffMs > 0) {
      const tempoFormatado = formatarTempoRegressivoVip(diffMs);

      if (topExpiryDays) topExpiryDays.textContent = tempoFormatado;
      if (drawerExpiryDays) {
        drawerExpiryDays.textContent = tempoFormatado;
        drawerExpiryDays.className = "text-warning fw-bold font-monospace";
      }
      if (drawerBtnRenew) {
        drawerBtnRenew.className = "btn btn-warning w-100 fw-bold py-2 shadow-sm";
        drawerBtnRenew.innerHTML = `<i class="bi bi-arrow-repeat me-1"></i> Renovar assinatura VIP`;
      }

      // 1. OFUSCA E TRAVA O BOTÃO SALVAR VIP
      if (btnSaveVip) {
        btnSaveVip.setAttribute("disabled", "disabled");
        btnSaveVip.style.opacity = "0.35";
        btnSaveVip.style.cursor = "not-allowed";
        btnSaveVip.style.pointerEvents = "none";
      }

      // 2. OFUSCA E TRAVA OS 4 BOTÕES DE CUSTOMIZAÇÃO (NOME, TEXTO, MOLDURA, TEMA)
      customCards.forEach(card => {
        card.setAttribute("disabled", "disabled");
        card.style.opacity = "0.35";
        card.style.cursor = "not-allowed";
        card.style.pointerEvents = "none";
      });

      // 3. OFUSCA E TRAVA O BOTÃO DE IMAGEM/BANNER DO TOPO
      if (vipBannerHeaderBtn) {
        vipBannerHeaderBtn.setAttribute("disabled", "disabled");
        vipBannerHeaderBtn.style.opacity = "0.35";
        vipBannerHeaderBtn.style.cursor = "not-allowed";
        vipBannerHeaderBtn.style.pointerEvents = "none";
      }

    } else {
      // Quando o tempo zera ou o usuário não é VIP
      if (topExpiryDays) topExpiryDays.textContent = `Expirado`;
      if (drawerExpiryDays) {
        drawerExpiryDays.textContent = `VIP Expirado`;
        drawerExpiryDays.className = "text-danger fw-bold";
      }
      if (drawerBtnRenew) {
        drawerBtnRenew.className = "btn btn-warning w-100 fw-bold py-2 shadow-sm text-dark";
        drawerBtnRenew.innerHTML = `<i class="bi bi-gem me-1"></i> RENOVAR VIP`;
      }

      // LIBERA O BOTÃO SALVAR VIP
      if (btnSaveVip) {
        btnSaveVip.removeAttribute("disabled");
        btnSaveVip.style.opacity = "1";
        btnSaveVip.style.cursor = "pointer";
        btnSaveVip.style.pointerEvents = "auto";
      }

      // LIBERA OS 4 BOTÕES DE CUSTOMIZAÇÃO
      customCards.forEach(card => {
        card.removeAttribute("disabled");
        card.style.opacity = "1";
        card.style.cursor = "pointer";
        card.style.pointerEvents = "auto";
      });

      // LIBERA O BOTÃO DE IMAGEM/BANNER DO TOPO
      if (vipBannerHeaderBtn) {
        vipBannerHeaderBtn.removeAttribute("disabled");
        vipBannerHeaderBtn.style.opacity = "1";
        vipBannerHeaderBtn.style.cursor = "pointer";
        vipBannerHeaderBtn.style.pointerEvents = "auto";
      }

      if (data.isVip === true && typeof window.verificarEExpiraVipUsuario === "function" && auth.currentUser) {
        window.verificarEExpiraVipUsuario(auth.currentUser.uid, data);
      }

      if (vipCountdownInterval) {
        clearInterval(vipCountdownInterval);
        vipCountdownInterval = null;
      }
    }
  };

  atualizarStatusInterfaceVip();
  vipCountdownInterval = setInterval(atualizarStatusInterfaceVip, 1000);

  const vipNameGrid = document.getElementById("vipNameColorGrid");
  if (vipNameGrid && vipNameGrid.children.length === 0) {
    vipNameGrid.innerHTML = "";
    textColorPalette.forEach(color => {
      if (!color || color === "<br>") return;
      const box = document.createElement("div");
      box.className = "color-box";
      box.style.width = "32px";
      box.style.height = "32px";
      box.style.backgroundColor = color;
      box.style.borderRadius = "6px";
      box.style.cursor = "pointer";
      box.style.display = "inline-block";
      box.style.margin = "3px";
      box.dataset.color = color;
      box.innerHTML = `<span class="color-check" style="display:none; color:#fff; text-align:center; line-height:32px;">✓</span>`;
      vipNameGrid.appendChild(box);
    });
  }

  const vipMsgGrid = document.getElementById("vipMsgColorGrid");
  if (vipMsgGrid && vipMsgGrid.children.length === 0) {
    vipMsgGrid.innerHTML = "";
    textColorPalette.forEach(color => {
      if (!color || color === "<br>") return;
      const box = document.createElement("div");
      box.className = "color-box";
      box.style.width = "32px";
      box.style.height = "32px";
      box.style.backgroundColor = color;
      box.style.borderRadius = "6px";
      box.style.cursor = "pointer";
      box.style.display = "inline-block";
      box.style.margin = "3px";
      box.dataset.color = color;
      box.innerHTML = `<span class="color-check" style="display:none; color:#fff; text-align:center; line-height:32px;">✓</span>`;
      vipMsgGrid.appendChild(box);
    });
  }

  const previewName = document.getElementById("vipPreviewName");
  const previewAvatar = document.getElementById("vipPreviewAvatar");

  if (previewName) previewName.textContent = editNameValue || "Usuário";
  if (previewAvatar) previewAvatar.src = selectedAvatar || "./img/avatar.png";

  const data = window.__currentProfileData || {};
  const btnType = document.getElementById("btnVipNameColorType");
  if (btnType && (!data.vipNameColorType || data.vipNameColorType === "solid")) {
    btnType.textContent = "Escolha uma cor";
  }

  const solidWrapper = document.getElementById("vipSolidColorWrapper");
  if (solidWrapper) {
    solidWrapper.classList.add("hidden");
  }

  vincularEventosPreviewVip();
}




function vincularEventosPreviewVip() {
  const typeSelect = document.getElementById("vipNameColorType");
  const fontSelect = document.getElementById("vipNameFont");
  const frameSelect = document.getElementById("vipAvatarFrameSelect");
  const bannerSelect = document.getElementById("vipProfileBannerSelect");

  [typeSelect, fontSelect, frameSelect, bannerSelect].forEach(selectEl => {
    selectEl?.addEventListener("change", () => atualizarSimulacaoTopoVip());
  });

  const vipNameGrid = document.getElementById("vipNameColorGrid");
  if (vipNameGrid) {
    vipNameGrid.onclick = (e) => {
      const box = e.target.closest(".color-box");
      if (!box) return;
      window.__vipNOME_COR_SELECIONADA = box.dataset.color;
      vipNameGrid.querySelectorAll(".color-box").forEach(b => b.classList.remove("selected"));
      box.classList.add("selected");
      atualizarSimulacaoTopoVip();
    };
  }

  const vipMsgGrid = document.getElementById("vipMsgColorGrid");
  if (vipMsgGrid) {
    vipMsgGrid.onclick = (e) => {
      const box = e.target.closest(".color-box");
      if (!box) return;
      window.__vipMENSAGEM_COR_SELECIONADA = box.dataset.color;
      vipMsgGrid.querySelectorAll(".color-box").forEach(b => b.classList.remove("selected"));
      box.classList.add("selected");
      atualizarSimulacaoTopoVip();
    };
  }

  atualizarSimulacaoTopoVip();
}

/* ========================================================================
   SISTEMA DE ACORDEÃO, DROPDOWNS E BUSCADOR DE BANNER
===================================================================== */
export function initVipEngine(isOwnerCallback) {
  // 1. Acordeão de Categorias
  document.querySelectorAll(".vip-btn-card").forEach(button => {
    button.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = button.getAttribute("data-target");

      document.querySelectorAll(".vip-drawer-content").forEach(drawer => drawer.classList.add("hidden"));
      document.querySelectorAll(".vip-btn-card").forEach(btn => btn.classList.remove("active"));

      const targetDrawer = document.getElementById(targetId);
      if (targetDrawer) {
        targetDrawer.classList.remove("hidden");
        button.classList.add("active");
      }
      document.querySelectorAll('.vip-custom-dropdown').forEach(d => d.classList.add('hidden'));
    });
  });

  //=============================== 2. Dropdowns Personalizados ===========================
  document.querySelectorAll('.vip-custom-dropdown').forEach(dropdown => {
    const wrapper = dropdown.parentElement;
    const btn = wrapper.querySelector('.vip-custom-select-btn');
    const selectNativo = wrapper.querySelector('select');

    if (btn && selectNativo) {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.querySelectorAll('.vip-custom-dropdown').forEach(d => {
          if (d !== dropdown) d.classList.add('hidden');
        });
        dropdown.classList.toggle('hidden');
      });

      dropdown.querySelectorAll('.vip-dropdown-option').forEach(option => {
        option.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          const val = option.getAttribute('data-value');
          selectNativo.value = val;
          selectNativo.dispatchEvent(new Event('change'));

          // Se for o dropdown de cor do nome, controla a exibição do carrossel
          if (selectNativo.id === "vipNameColorType") {
            const solidWrapper = document.getElementById("vipSolidColorWrapper");
            if (solidWrapper) {
              if (val === "solid") {
                solidWrapper.classList.remove("hidden");
              } else {
                solidWrapper.classList.add("hidden");
              }
            }
          }

          atualizarSimulacaoTopoVip();

          btn.textContent = option.textContent;
          dropdown.querySelectorAll('.vip-dropdown-option').forEach(o => o.classList.remove('active'));
          option.classList.add('active');
        });
      });
    }
  });

 
// ====================================3. Gravação das Configurações VIP VERIFICACAO E RESET AUTOMÁTICO DO VIP EXPIRADO 
//  RESETANDO O PAINEL VIP.. =============================
  document.getElementById("btnSaveVipSettings")?.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      showToast("Gravando configurações VIP...");
      const refUser = doc(db, "users", user.uid);
      const bannerUrlFinal = window.__vipBannerUrlTemp !== undefined 
        ? window.__vipBannerUrlTemp 
        : (window.__currentProfileData?.vipBannerUrl || "");

/*  RESETANDO o original ,  const validadeVip = window.__currentProfileData?.vipExpiresAt || (Date.now() + 7 * 24 * 60 * 60 * 1000);

O trecho window.__currentProfileData?.vipExpiresAt preserva a data que o usuário já tinha caso ele esteja apenas editando/salvando as cores do VIP,
e o fallback cria um prazo de 7 dias a partir do momento atual.
Portanto, a premissa está correta.*/

// TESTE 1 : Validade de apenas 1 minuto (60 segundos)  const validadeVip = Date.now() + 1 * 60 * 1000;
// TESTE 2 : Validade de 3 horas  const validadeVip = Date.now() + 3 * 60 * 60 * 1000;
// TESTE 3 : Validade de 3 dias   const validadeVip = Date.now() + 3 * 24 * 60 * 60 * 1000; 
    
      const validadeVip = Date.now() + 1 * 60 * 1000;
      await updateDoc(refUser, {
        isVip: true,
        vipExpiresAt: validadeVip,
        vipNameColorType: document.getElementById("vipNameColorType").value,
        vipNameColorSolid: window.__vipNOME_COR_SELECIONADA || "#6f42c1",
        vipNameFont: document.getElementById("vipNameFont").value,
        vipMsgColor: window.__vipMENSAGEM_COR_SELECIONADA || "#333333",
        vipAvatarFrame: document.getElementById("vipAvatarFrameSelect").value,
        vipProfileBanner: document.getElementById("vipProfileBannerSelect").value,
        vipBannerUrl: bannerUrlFinal
      });


      const userStatusRef = rRef(rtdb, "status/" + user.uid);
      await rUpdate(userStatusRef, {
        isVip: true,
        vipNameColorType: document.getElementById("vipNameColorType").value,
        vipNameColorSolid: window.__vipNOME_COR_SELECIONADA || "#6f42c1",
        vipNameFont: document.getElementById("vipNameFont").value,
        vipAvatarFrame: document.getElementById("vipAvatarFrameSelect").value
      });

      if (window.__currentProfileData) {
        window.__currentProfileData.vipBannerUrl = bannerUrlFinal;
        window.__currentProfileData.vipMsgColor = window.__vipMENSAGEM_COR_SELECIONADA || "#333333";
      }
      window.__vipBannerUrlTemp = undefined;

      // Aplica a cor do texto e do cursor no input do chat instantaneamente
      const chatInput = document.getElementById("messageInput");
      if (chatInput) {
        const corFinalTexto = window.__vipMENSAGEM_COR_SELECIONADA || "#333333";
        chatInput.style.color = corFinalTexto;
        chatInput.style.caretColor = corFinalTexto;
      }

      //showToast("Vantagens VIP salvas e aplicadas com sucesso!");
 // 1. Fecha imediatamente todos os dropdowns/accordions abertos
      document.querySelectorAll('.vip-custom-dropdown').forEach(d => d.classList.add('hidden'));

      // 2. Transfere a visualização para a gaveta "Renovar" (Status do Plano)
      const btnRenovar = document.querySelector('.vip-btn-card[data-target="gaveta-renovar"]');
      if (btnRenovar) {
        document.querySelectorAll(".vip-drawer-content").forEach(drawer => drawer.classList.add("hidden"));
        document.querySelectorAll(".vip-btn-card").forEach(btn => btn.classList.remove("active"));
        document.getElementById("gaveta-renovar")?.classList.remove("hidden");
        btnRenovar.classList.add("active");
      }

      // 3. Atualiza os dados e trava os botões pelo tempo VIP
      const editName = document.getElementById("editName");
      const profileAvatar = document.getElementById("profileAvatar");
      inicializarPainelVipDinamico(editName?.value, profileAvatar?.src);


    } catch (err) {
      console.error("Erro ao salvar dados VIP:", err);
      showToast("Erro ao salvar configurações.");
    }
  });

  //===============================  4. Modal de Banner & Buscador Multi-Plataforma ===================================
  initVipBannerModal(isOwnerCallback);
}

function initVipBannerModal(isOwnerCallback) {
  const vipHeaderBtn = document.getElementById("vipHeaderActionBtn");
  const bannerModal = document.getElementById("vipBannerModal");
  const closeBannerModal = document.getElementById("closeVipBannerModal");
  const urlInput = document.getElementById("vipBannerUrlInput");
  const previewBox = document.getElementById("vipBannerPreviewBox");
  const saveBannerBtn = document.getElementById("btnSaveVipBannerUrl");

  const mediaInput = document.getElementById("giphySearchInput");
  const btnSearchMedia = document.getElementById("btnSearchGiphy");
  const mediaGrid = document.getElementById("giphyResultsGrid");
  const attributionLabel = document.getElementById("mediaAttributionLabel");
  const mediaTabBtns = document.querySelectorAll(".media-tab-btn");

  const GIPHY_API_KEY = "bmd1luYYvD3dGiycldIl3W1bUovionrR"; 
  const PIXABAY_API_KEY = "56897614-e2f814aca2c37034dcc515af2";
  const PEXELS_API_KEY = "4MoHwhHC16imBbdA7sGO13i5HDbAQtfNDcQGNsNZ3LWuHpB1sExnbNHH";

  let currentSource = "giphy";
  let currentQuery = "";
  let currentPage = 1;
  let currentOffset = 0;
  const LIMIT_PER_PAGE = 18;
  let isLoadingMedia = false;
  let hasMoreMedia = true;

  mediaTabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      mediaTabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentSource = btn.dataset.source;

      if (attributionLabel) {
        if (currentSource === "giphy") attributionLabel.textContent = "GIPHY";
        if (currentSource === "pexels") attributionLabel.textContent = "Pexels";
        if (currentSource === "pixabay") attributionLabel.textContent = "Pixabay";
      }
      if (currentQuery) fetchMedia(true);
    });
  });

  const renderImageItem = (thumbUrl, fullUrl) => {
    const img = document.createElement("img");
    img.src = thumbUrl;
    img.alt = "Mídia";
    img.addEventListener("click", () => {
      if (urlInput) urlInput.value = fullUrl;
      if (previewBox) previewBox.style.backgroundImage = `url("${fullUrl}")`;
    });
    mediaGrid?.appendChild(img);
  };

  const fetchGiphy = async (isNewSearch) => {
    const response = await fetch(`https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(currentQuery)}&limit=${LIMIT_PER_PAGE}&offset=${currentOffset}&api_key=${GIPHY_API_KEY}`);
    const data = await response.json();
    if (!data.data || data.data.length === 0) {
      if (isNewSearch && mediaGrid) mediaGrid.innerHTML = `<span class="small text-muted p-2 w-100 text-center d-block">Nenhum GIF encontrado.</span>`;
      hasMoreMedia = false;
      return;
    }
    data.data.forEach(item => renderImageItem(item.images.fixed_height_small.url, item.images.original.url));
    currentOffset += data.data.length;
    if (data.data.length < LIMIT_PER_PAGE) hasMoreMedia = false;
  };

  const fetchPexels = async (isNewSearch) => {
    const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(currentQuery)}&per_page=${LIMIT_PER_PAGE}&page=${currentPage}`, {
      headers: { Authorization: PEXELS_API_KEY }
    });
    const data = await response.json();
    if (!data.photos || data.photos.length === 0) {
      if (isNewSearch && mediaGrid) mediaGrid.innerHTML = `<span class="small text-muted p-2 w-100 text-center d-block">Nenhuma foto encontrada.</span>`;
      hasMoreMedia = false;
      return;
    }
    data.photos.forEach(photo => renderImageItem(photo.src.tiny, photo.src.large));
    currentPage++;
    if (data.photos.length < LIMIT_PER_PAGE) hasMoreMedia = false;
  };

  const fetchPixabay = async (isNewSearch) => {
    const response = await fetch(`https://pixabay.com/api/?key=${PIXABAY_API_KEY}&q=${encodeURIComponent(currentQuery)}&image_type=photo&per_page=${LIMIT_PER_PAGE}&page=${currentPage}`);
    const data = await response.json();
    if (!data.hits || data.hits.length === 0) {
      if (isNewSearch && mediaGrid) mediaGrid.innerHTML = `<span class="small text-muted p-2 w-100 text-center d-block">Nenhuma foto encontrada.</span>`;
      hasMoreMedia = false;
      return;
    }
    data.hits.forEach(hit => renderImageItem(hit.previewURL, hit.largeImageURL));
    currentPage++;
    if (data.hits.length < LIMIT_PER_PAGE) hasMoreMedia = false;
  };

  const fetchMedia = async (isNewSearch = false) => {
    if (isLoadingMedia || !currentQuery) return;

    if (isNewSearch) {
      currentOffset = 0;
      currentPage = 1;
      hasMoreMedia = true;
      if (mediaGrid) {
        mediaGrid.innerHTML = `<span class="small text-muted p-2 w-100 text-center d-block">Carregando...</span>`;
        mediaGrid.classList.remove("hidden");
      }
    }

    if (!hasMoreMedia) return;
    isLoadingMedia = true;

    try {
      if (isNewSearch && mediaGrid) mediaGrid.innerHTML = "";
      if (currentSource === "giphy") await fetchGiphy(isNewSearch);
      else if (currentSource === "pexels") await fetchPexels(isNewSearch);
      else if (currentSource === "pixabay") await fetchPixabay(isNewSearch);
    } catch (err) {
      console.error("Erro na busca de mídias:", err);
      if (isNewSearch && mediaGrid) mediaGrid.innerHTML = `<span class="small text-danger p-2 w-100 text-center d-block">Erro ao carregar resultados.</span>`;
    } finally {
      isLoadingMedia = false;
    }
  };

  const dispararNovaBusca = () => {
    const termo = mediaInput?.value.trim() || "";
    if (!termo) return;
    currentQuery = termo;
    fetchMedia(true);
  };

  btnSearchMedia?.addEventListener("click", dispararNovaBusca);
  mediaInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      dispararNovaBusca();
    }
  });

  mediaGrid?.addEventListener("scroll", () => {
    if (!mediaGrid || isLoadingMedia || !hasMoreMedia) return;
    if (mediaGrid.scrollTop + mediaGrid.clientHeight >= mediaGrid.scrollHeight - 30) {
      fetchMedia(false);
    }
  });

  vipHeaderBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOwnerCallback()) return;

    const data = window.__currentProfileData || {};
    const linkAtual = data.vipBannerUrl || "";

    if (urlInput) urlInput.value = linkAtual;
    if (previewBox) previewBox.style.backgroundImage = linkAtual ? `url("${linkAtual}")` : "none";

    if (mediaGrid) {
      mediaGrid.innerHTML = "";
      mediaGrid.classList.add("hidden");
    }
    if (mediaInput) mediaInput.value = "";

    currentQuery = "";
    currentOffset = 0;
    currentPage = 1;
    hasMoreMedia = true;

    bannerModal?.classList.remove("hidden");
  });

  closeBannerModal?.addEventListener("click", () => bannerModal?.classList.add("hidden"));

  document.getElementById("btnClearVipBannerUrl")?.addEventListener("click", () => {
    if (urlInput) urlInput.value = "";
    if (previewBox) previewBox.style.backgroundImage = "none";
  });

  urlInput?.addEventListener("input", () => {
    const val = urlInput.value.trim();
    if (previewBox) previewBox.style.backgroundImage = val ? `url("${val}")` : "none";
  });

saveBannerBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!isOwnerCallback()) return;

    const newUrl = urlInput?.value.trim() || "";

    // Salva na memória temporária para a prévia sem disparar o Firebase
    window.__vipBannerUrlTemp = newUrl;

    const profileCoverEl = document.querySelector(".profile-cover");
    if (profileCoverEl) {
      if (newUrl) {
        profileCoverEl.style.background = `url("${newUrl}") center/cover no-repeat`;
      } else {
        profileCoverEl.style.backgroundImage = "none";
        profileCoverEl.style.background = "#00000063";
      }
    }

    atualizarSimulacaoTopoVip();
    bannerModal?.classList.add("hidden");
    showToast("Banner selecionado! Clique em 'Salvar VIP' para confirmar.");
  });

}

/* ========================================================================= 
   FLUXO DE ABERTURA E e FECHAMENTO E RETORNO DO PAINEL VIP ISOLADO
   ========================================================================= */
export function abrirPainelVip() {
  const profilePanel = document.getElementById("profilePanel");
  const mainTabs = document.getElementById("profileMainTabs");
  const profileContent = document.querySelector(".profile-content");
  const profileVip = document.getElementById("profileVip");
  
  const vipBtn = document.getElementById("vipTopHeaderBtn");
  const backBtn = document.getElementById("vipBackToProfileBtn");
  const editCoverBtn = document.getElementById("editProfileCoverBtn");
  const vipHeaderActionBtn = document.getElementById("vipHeaderActionBtn");
  
  const topMood = document.getElementById("profileMood");
  const topTag = document.getElementById("vipTopPreviewTag");
  const topMsgBox = document.getElementById("vipTopMsgPreviewBox");

  // 1. Alterna a visão das seções centrais
  if (mainTabs) mainTabs.classList.add("d-none");
  if (profileContent) profileContent.classList.add("d-none");
  if (profileVip) profileVip.classList.remove("d-none");

  // 2. Troca os botões do cabeçalho
  if (vipBtn) vipBtn.classList.add("d-none");
  if (backBtn) backBtn.classList.remove("d-none");
 if (editCoverBtn) editCoverBtn.style.display = "none";
  if (vipHeaderActionBtn) {
    vipHeaderActionBtn.classList.remove("d-none");
    vipHeaderActionBtn.style.display = "grid";
  }

  // 3. Ativa o modo VIP visual
  if (profilePanel) profilePanel.classList.add("vip-mode-active");
  if (topMood) topMood.style.display = "none";
  if (topTag) { topTag.classList.remove("d-none"); topTag.classList.add("d-inline-block"); }
  if (topMsgBox) { topMsgBox.classList.remove("d-none"); topMsgBox.classList.add("d-block"); }

  // 4. Banner e simuladores
  const data = window.__currentProfileData || {};
  const profileCoverEl = document.querySelector(".profile-cover");
  if (profileCoverEl) {
    if (data.vipBannerUrl) {
      profileCoverEl.style.background = `url("${data.vipBannerUrl}") center/cover no-repeat`;
    }
  }

  // Se o VIP estiver ativo, foca diretamente na aba Renovar
  if (data.isVip === true) {
    const btnRenovar = document.querySelector('.vip-btn-card[data-target="gaveta-renovar"]');
    if (btnRenovar) {
      btnRenovar.click();
    }
  }

  const editName = document.getElementById("editName");
  const profileAvatar = document.getElementById("profileAvatar");
  inicializarPainelVipDinamico(editName?.value, profileAvatar?.src);
}

export function fecharPainelVip() {
  const profilePanel = document.getElementById("profilePanel");
  const mainTabs = document.getElementById("profileMainTabs");
  const profileContent = document.querySelector(".profile-content");
  const profileVip = document.getElementById("profileVip");
  
  const vipBtn = document.getElementById("vipTopHeaderBtn");
  const backBtn = document.getElementById("vipBackToProfileBtn");
  const editCoverBtn = document.getElementById("editProfileCoverBtn");
  const vipHeaderActionBtn = document.getElementById("vipHeaderActionBtn");
  
  const topMood = document.getElementById("profileMood");
  const topTag = document.getElementById("vipTopPreviewTag");
  const topMsgBox = document.getElementById("vipTopMsgPreviewBox");
  const topExpiry = document.getElementById("vipTopExpiryRow");

  // 1. Descarta a imagem temporária não salva do banner
  window.__vipBannerUrlTemp = undefined;

  // 2. Restaura as abas principais e o conteúdo comum
  if (mainTabs) mainTabs.classList.remove("d-none");
  if (profileContent) profileContent.classList.remove("d-none");
  if (profileVip) profileVip.classList.add("d-none");

  // 3. Restaura os botões do cabeçalho
  if (vipBtn) vipBtn.classList.remove("d-none");
  if (backBtn) backBtn.classList.add("d-none");
  if (editCoverBtn) editCoverBtn.style.display = "grid";
  if (vipHeaderActionBtn) {
    vipHeaderActionBtn.classList.add("d-none");
    vipHeaderActionBtn.style.display = "none";
  }

  // 4. Desativa o modo VIP visual temporário do simulador
  if (profilePanel) profilePanel.classList.remove("vip-mode-active");
  if (topMood) topMood.style.display = "block";
  if (topTag) { topTag.classList.remove("d-inline-block"); topTag.classList.add("d-none"); }
  if (topMsgBox) { topMsgBox.classList.remove("d-block"); topMsgBox.classList.add("d-none"); }

  // 5. Restaura a capa oficial salva no banco ou a cor comum padrão
  const data = window.__currentProfileData || {};
  const topBanner = document.querySelector(".profile-cover");

  if (data.isVip === true) {
    aplicarVisualVipCompleto(data);
  } else {
    restaurarVisualPadraoPerfil(data.bannerColor);
    if (topBanner) {
      topBanner.style.backgroundImage = "none";
      topBanner.style.background = data.bannerColor || "#00000063";
    }
  }
}

/* ========================================================================
   RENDERIZADOR AUXILIAR DE METADADOS VIP PARA O CHAT
===================================================================== */
export function formatarAutorVipChat(msg = {}) {
  const tipoEfeito = msg.vipNameColorType || "solid";
  const corSolida = msg.vipNameColorSolid || msg.color || "#1E293B";
  const fonte = msg.vipNameFont || "default";
  const moldura = msg.vipAvatarFrame || "none";

  let classeEfeito = "";
  let corInline = "";
  let fonteInline = "";

const isVipMsg = msg.isVip === true || (tipoEfeito !== "solid" && tipoEfeito !== "none") || fonte !== "default" || moldura !== "none";
const tagDiamante = isVipMsg ? `<i class="bi bi-gem" style="font-size: 13px; color: #01b1f7; -webkit-text-fill-color: #01b1f7; margin-left: 4px; vertical-align: middle; display: inline-block;"></i>` : "";

  if (tipoEfeito !== "solid" && tipoEfeito !== "none") {
    classeEfeito = `nick-${tipoEfeito}`;
  } else {
    corInline = `color: ${corSolida};`;
  }

if (fonte !== "default") {
    const fallback = obterFallbackFonteVip(fonte);
    fonteInline = `font-family: '${fonte}', ${fallback};`;
  }

  return { classeEfeito, corInline, fonteInline, tagDiamante, moldura };
}