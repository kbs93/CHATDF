import { showToast, textColorPalette } from "./ui.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { auth, db, rtdb } from "./firebase-config.js";
import { ref as rRef, update as rUpdate } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";



// Estado global do módulo VIP
// Estado global do módulo VIP
window.__vipMENSAGEM_COR_SELECIONADA = null;
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
  window.__vipMENSAGEM_COR_SELECIONADA = null;
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
      // Identifica se já foi VIP alguma vez ou se é a primeira contratação
      const jaFoiVipAlgumaVez = Boolean(data.vipExpiresAt && data.vipExpiresAt > 0);

      if (jaFoiVipAlgumaVez) {
        // Usuário veterano com VIP Vencido -> Libera o botão de Renovar direto
        if (topExpiryDays) topExpiryDays.textContent = `Expirado`;
        if (drawerExpiryDays) {
          drawerExpiryDays.textContent = `VIP Expirado`;
          drawerExpiryDays.className = "text-danger fw-bold";
        }
        if (drawerBtnRenew) {
          drawerBtnRenew.removeAttribute("disabled");
          drawerBtnRenew.style.opacity = "1";
          drawerBtnRenew.style.cursor = "pointer";
          drawerBtnRenew.style.pointerEvents = "auto";
          drawerBtnRenew.className = "btn btn-warning w-100 fw-bold py-2 shadow-sm text-dark";
          drawerBtnRenew.innerHTML = `<i class="bi bi-arrow-repeat me-1"></i> Renovar assinatura VIP`;
        }
      } else {
        // Usuário Novo (Nunca assinou) -> Trava e ofusca o botão Renovar seguindo o padrão
        if (topExpiryDays) topExpiryDays.textContent = `Sem VIP`;
        if (drawerExpiryDays) {
          drawerExpiryDays.textContent = `Nenhum plano ativo`;
          drawerExpiryDays.className = "text-muted fw-bold";
        }
        if (drawerBtnRenew) {
          drawerBtnRenew.setAttribute("disabled", "disabled");
          drawerBtnRenew.style.opacity = "0.35";
          drawerBtnRenew.style.cursor = "not-allowed";
          drawerBtnRenew.style.pointerEvents = "none";
          drawerBtnRenew.className = "btn btn-warning w-100 fw-bold py-2 shadow-sm text-dark";
          drawerBtnRenew.innerHTML = `<i class="bi bi-lock-fill me-1"></i> Renovar assinatura VIP`;
        }
      }

      // LIBERA O BOTÃO SALVAR VIP (Porta de entrada principal)
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


// Função unificada para chamar o modal Pix
  const acionarModalPix = (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    if (typeof window.solicitarPixVip === "function") {
      window.solicitarPixVip(5.99, "VIP Diamante - 3 Dias");
    } else if (typeof window.abrirModalPix === "function") {
      window.abrirModalPix({
        titulo: "VIP Diamante - 30 Dias",
        valor: "R$ 5,99"
      });
    }
  };

  // 3. Gravação das Configurações VIP + Abertura Primária do Pix
  document.getElementById("btnSaveVipSettings")?.addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;

    // Captura os valores dos 6 campos VIP
    const tipoNome = document.getElementById("vipNameColorType")?.value || "none";
    const fonteNome = document.getElementById("vipNameFont")?.value || "default";
    const corMsg = window.__vipMENSAGEM_COR_SELECIONADA;
    const moldura = document.getElementById("vipAvatarFrameSelect")?.value || "none";
    const tema = document.getElementById("vipProfileBannerSelect")?.value || "default";
    const bannerUrlFinal = window.__vipBannerUrlTemp !== undefined 
      ? window.__vipBannerUrlTemp 
      : (window.__currentProfileData?.vipBannerUrl || "");

    // 1. Estilo do nome
    if (!tipoNome || tipoNome === "none") {
      showToast("Por favor, selecione o Estilo do nome.");
      return;
    }

    // 2. Fonte do nome
    if (!fonteNome || fonteNome === "default") {
      showToast("Por favor, selecione a Fonte do nome.");
      return;
    }

    // 3. Cor do texto
    if (!corMsg) {
      showToast("Por favor, selecione a Cor do texto.");
      return;
    }

    // 4. Moldura
    if (!moldura || moldura === "none") {
      showToast("Por favor, selecione uma Moldura.");
      return;
    }

    // 5. Tema
    if (!tema || tema === "default") {
      showToast("Por favor, selecione um Tema de perfil.");
      return;
    }

    // 6. Capa/Banner do topo
    if (!bannerUrlFinal || bannerUrlFinal.trim() === "") {
      showToast("Por favor, selecione uma Imagem para o Banner da capa.");
      return;
    }
try {
      // Guarda o rascunho apenas localmente (sem gravar no banco nem no status online)
      const rascunhoVip = {
        vipNameColorType: tipoNome,
        vipNameColorSolid: window.__vipNOME_COR_SELECIONADA || "#6f42c1",
        vipNameFont: fonteNome,
        vipMsgColor: corMsg,
        vipAvatarFrame: moldura,
        vipProfileBanner: tema,
        vipBannerUrl: bannerUrlFinal
      };
      sessionStorage.setItem("chatdf_vip_rascunho", JSON.stringify(rascunhoVip));

      // 1. Fecha dropdowns abertos
      document.querySelectorAll('.vip-custom-dropdown').forEach(d => d.classList.add('hidden'));

      // 2. Mantém a simulação visual apenas na tela local do usuário
      atualizarSimulacaoTopoVip();

      // 3. Direciona a visualização para a gaveta "Renovar"
      const btnRenovar = document.querySelector('.vip-btn-card[data-target="gaveta-renovar"]');
      if (btnRenovar) {
        document.querySelectorAll(".vip-drawer-content").forEach(drawer => drawer.classList.add("hidden"));
        document.querySelectorAll(".vip-btn-card").forEach(btn => btn.classList.remove("active"));
        document.getElementById("gaveta-renovar")?.classList.remove("hidden");
        btnRenovar.classList.add("active");
      }

      // 4. Dispara o Modal Pix imediatamente
      acionarModalPix();

    } catch (err) {
      console.error("Erro ao preparar rascunho VIP:", err);
      showToast("Erro ao processar opções VIP.");
    }

  });

  // 4. Modal de Banner & Buscador
  initVipBannerModal(isOwnerCallback);

  // 5. Botões de Renovação (Gatilho secundário/renovação posterior)
  document.getElementById("btnDrawerRenewVip")?.addEventListener("click", acionarModalPix);
  document.getElementById("btnTopRenewVip")?.addEventListener("click", acionarModalPix);
















}



function initVipBannerModal(isOwnerCallback) {
  const vipHeaderBtn = document.getElementById("vipHeaderActionBtn");
  const bannerModal = document.getElementById("vipBannerModal");
  const closeBannerModal = document.getElementById("closeVipBannerModal");
  const previewBox = document.getElementById("vipBannerPreviewBox");
  const fileInput = document.getElementById("vipBannerFileInput");
  const saveBannerBtn = document.getElementById("btnSaveVipBannerUrl");
  const clearBannerBtn = document.getElementById("btnClearVipBannerUrl");

  let blobBannerComprimido = null;
  let urlTemporariaPreview = "";
  let solicitouRemoverBanner = false;

  // 1. Abrir Modal de Banner
  vipHeaderBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isOwnerCallback()) return;

    const data = window.__currentProfileData || {};
    const linkAtual = window.__vipBannerUrlTemp !== undefined ? window.__vipBannerUrlTemp : (data.vipBannerUrl || "");

    blobBannerComprimido = null;
    solicitouRemoverBanner = false;
    urlTemporariaPreview = linkAtual;

    if (previewBox) {
      previewBox.style.backgroundImage = linkAtual ? `url("${linkAtual}")` : "none";
    }
    if (fileInput) fileInput.value = "";

    bannerModal?.classList.remove("hidden");
  });

  // 2. Fechar Modal
  closeBannerModal?.addEventListener("click", () => {
    bannerModal?.classList.add("hidden");
  });

  // 3. Captura e Compressão via Canvas (Redimensionamento para 800px no formato Capa)
  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Por favor, selecione um arquivo de imagem válido.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Limita a largura máxima em 800px preservando a proporção exata
        const MAX_WIDTH = 800;
        let targetWidth = img.naturalWidth;
        let targetHeight = img.naturalHeight;

        if (targetWidth > MAX_WIDTH) {
          const ratio = MAX_WIDTH / targetWidth;
          targetWidth = MAX_WIDTH;
          targetHeight = Math.round(targetHeight * ratio);
        }

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // Converte para JPEG com qualidade 0.80 (gera imagem entre 40KB e 70KB)
        canvas.toBlob((blob) => {
          if (!blob) return;
          blobBannerComprimido = blob;
          solicitouRemoverBanner = false;
          urlTemporariaPreview = URL.createObjectURL(blob);

          if (previewBox) {
            previewBox.style.backgroundImage = `url("${urlTemporariaPreview}")`;
          }
          showToast("Imagem ajustada com sucesso!");
        }, "image/jpeg", 0.80);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  // 4. Botão Limpar Banner (Marca para remoção definitiva)
  clearBannerBtn?.addEventListener("click", () => {
    blobBannerComprimido = null;
    urlTemporariaPreview = "";
    solicitouRemoverBanner = true;
    if (fileInput) fileInput.value = "";
    if (previewBox) previewBox.style.backgroundImage = "none";
    showToast("Banner limpo. Clique em Salvar para confirmar a remoção.");
  });

  // 5. Salvar Banner (Sobe para o Storage ou remove o arquivo se tiver limpado)
  saveBannerBtn?.addEventListener("click", async (e) => {
    e.preventDefault();
    if (!isOwnerCallback()) return;

    const user = auth.currentUser;
    if (!user) return;

    const storage = getStorage();
    const bannerRef = sRef(storage, `banners_vip/${user.uid}.jpg`);

    try {
      let finalUrl = urlTemporariaPreview;

      // Se o usuário clicou em Limpar, remove do Storage
      if (solicitouRemoverBanner) {
        try {
          await deleteObject(bannerRef);
        } catch (delErr) {
          // Ignora caso o arquivo não existisse no Storage
        }
        finalUrl = "";
      } 
      // Se selecionou uma nova foto da câmera/galeria, envia comprimida
      else if (blobBannerComprimido) {
        showToast("Otimizando e enviando banner...");
        await uploadBytes(bannerRef, blobBannerComprimido);
        finalUrl = await getDownloadURL(bannerRef);
        blobBannerComprimido = null;
      }

      window.__vipBannerUrlTemp = finalUrl;

      const profileCoverEl = document.querySelector(".profile-cover");
      if (profileCoverEl) {
        if (finalUrl) {
          profileCoverEl.style.background = `url("${finalUrl}") center/cover no-repeat`;
        } else {
          profileCoverEl.style.backgroundImage = "none";
          profileCoverEl.style.background = "#00000063";
        }
      }

      atualizarSimulacaoTopoVip();
      bannerModal?.classList.add("hidden");
      showToast("Banner definido! Clique em 'Salvar VIP' para gravar.");
    } catch (err) {
      console.error("Erro ao salvar banner VIP:", err);
      showToast("Erro ao processar imagem do banner.");
    }
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

  // 2. Restaura o rascunho anterior para não perder o que foi selecionado
  try {
    const rawRascunho = sessionStorage.getItem("chatdf_vip_rascunho");
    if (rawRascunho) {
      const r = JSON.parse(rawRascunho);
      if (r.vipNameColorType) {
        const sel = document.getElementById("vipNameColorType");
        const btn = document.getElementById("btnVipNameColorType");
        if (sel) sel.value = r.vipNameColorType;
        const opt = document.querySelector(`#listVipNameColorType .vip-dropdown-option[data-value="${r.vipNameColorType}"]`);
        if (btn && opt) btn.textContent = opt.textContent;
      }
      if (r.vipNameFont) {
        const sel = document.getElementById("vipNameFont");
        const btn = document.getElementById("btnVipNameFont");
        if (sel) sel.value = r.vipNameFont;
        const opt = document.querySelector(`#listVipNameFont .vip-dropdown-option[data-value="${r.vipNameFont}"]`);
        if (btn && opt) btn.textContent = opt.textContent;
      }
      if (r.vipAvatarFrame) {
        const sel = document.getElementById("vipAvatarFrameSelect");
        const btn = document.getElementById("btnVipAvatarFrameSelect");
        if (sel) sel.value = r.vipAvatarFrame;
        const opt = document.querySelector(`#listVipAvatarFrameSelect .vip-dropdown-option[data-value="${r.vipAvatarFrame}"]`);
        if (btn && opt) btn.textContent = opt.textContent;
      }
      if (r.vipProfileBanner) {
        const sel = document.getElementById("vipProfileBannerSelect");
        const btn = document.getElementById("btnVipProfileBannerSelect");
        if (sel) sel.value = r.vipProfileBanner;
        const opt = document.querySelector(`#listVipProfileBannerSelect .vip-dropdown-option[data-value="${r.vipProfileBanner}"]`);
        if (btn && opt) btn.textContent = opt.textContent;
      }
      if (r.vipNameColorSolid) window.__vipNOME_COR_SELECIONADA = r.vipNameColorSolid;
      if (r.vipMsgColor) window.__vipMENSAGEM_COR_SELECIONADA = r.vipMsgColor;
      if (r.vipBannerUrl) window.__vipBannerUrlTemp = r.vipBannerUrl;
    }
  } catch (e) {
    console.warn("Sem rascunho VIP prévio:", e);
  }

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
 // 1. Descarta a imagem temporária e o rascunho apenas ao fechar ou voltar
  window.__vipBannerUrlTemp = undefined;
  sessionStorage.removeItem("chatdf_vip_rascunho");
  restaurarVisualPadraoPerfil();

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