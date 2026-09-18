/* =========================================================================
   FRONT-END PIX: CONEXÃO COM O BACKEND E ABERTURA DO MODAL
   ========================================================================= */
import { auth, db, rtdb } from "./firebase-config.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { ref as rRef, update as rUpdate } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { abrirModalPix, fecharModalPix } from "./pixmodal.js";
import { showToast } from "./ui.js";

const BACKEND_URL = "";
let pixPollingInterval = null;

// =========================================================================
// ATIVAÇÃO OFICIAL DO VIP NO BANCO APÓS APROVAÇÃO DO PAGAMENTO
// =========================================================================
async function efetivarVipAposPagamento(user) {
  try {
    const rawRascunho = sessionStorage.getItem("chatdf_vip_rascunho");
    const r = rawRascunho ? JSON.parse(rawRascunho) : {};

    // >>> AQUI É DEFINIDO O TEMPO DO VIP <<<
    // Para teste rápido de 2 minutos use: Date.now() + (2 * 60 * 1000)
    // Para o plano oficial de 3 dias use: Date.now() + (3 * 24 * 60 * 60 * 1000)
    const validadeVip = Date.now() + (5 * 60 * 1000)
    

    const refUser = doc(db, "users", user.uid);
    await updateDoc(refUser, {
      isVip: true,
      vipExpiresAt: validadeVip,
      vipNameColorType: r.vipNameColorType || "solid",
      vipNameColorSolid: r.vipNameColorSolid || "#6f42c1",
      vipNameFont: r.vipNameFont || "default",
      vipMsgColor: r.vipMsgColor || "#333333",
      vipAvatarFrame: r.vipAvatarFrame || "none",
      vipProfileBanner: r.vipProfileBanner || "default",
      vipBannerUrl: r.vipBannerUrl || ""
    });

    const userStatusRef = rRef(rtdb, "status/" + user.uid);
    await rUpdate(userStatusRef, {
      isVip: true,
      vipNameColorType: r.vipNameColorType || "solid",
      vipNameColorSolid: r.vipNameColorSolid || "#6f42c1",
      vipNameFont: r.vipNameFont || "default",
      vipAvatarFrame: r.vipAvatarFrame || "none"
    });

    if (window.__currentProfileData) {
      window.__currentProfileData.isVip = true;
      window.__currentProfileData.vipExpiresAt = validadeVip;
      window.__currentProfileData.vipBannerUrl = r.vipBannerUrl || "";
      window.__currentProfileData.vipMsgColor = r.vipMsgColor || "#333333";
      window.__currentProfileData.vipNameColorType = r.vipNameColorType || "solid";
      window.__currentProfileData.vipNameFont = r.vipNameFont || "default";
      window.__currentProfileData.vipAvatarFrame = r.vipAvatarFrame || "none";
      window.__currentProfileData.vipProfileBanner = r.vipProfileBanner || "default";
    }

    sessionStorage.removeItem("chatdf_vip_rascunho");

    // Fecha o modal e exibe o alerta de sucesso
    fecharModalPix();
    if (typeof showToast === "function") {
      showToast("Pagamento aprovado! Seu VIP de 3 dias está ativo!");
    }

    // Atualiza a visualização do painel VIP
    const editName = document.getElementById("editName");
    const profileAvatar = document.getElementById("profileAvatar");
    if (typeof window.inicializarPainelVipDinamico === "function") {
      window.inicializarPainelVipDinamico(editName?.value, profileAvatar?.src);
    }
  } catch (err) {
    console.error("Erro ao efetivar VIP no banco:", err);
  }
}

export async function solicitarPixVip(valor = 4.99, plano = "VIP Diamante - 3 Dias") {
  const user = auth.currentUser;

  if (!user) {
    alert("Faça login para assinar o VIP.");
    return;
  }

  if (pixPollingInterval) {
    clearInterval(pixPollingInterval);
    pixPollingInterval = null;
  }

  // 1. Abre o modal em estado de carregamento imediato
  abrirModalPix({
    titulo: plano,
    valor: `R$ ${valor.toFixed(2).replace('.', ',')}`,
    copiaECola: "Gerando código Pix..."
  });

  try {
    // 2. Chama a rota do backend local
    const resposta = await fetch(`${BACKEND_URL}/api/pix/criar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: user.uid,
        email: user.email || `${user.uid}@chatdf.com`,
        nome: user.displayName || "Usuário VIP",
        valor: valor,
        descricao: plano
      })
    });

    const dados = await resposta.json();

    if (!resposta.ok || !dados.success) {
      alert("Não foi possível gerar o Pix: " + (dados.error || "Tente novamente."));
      fecharModalPix();
      return;
    }

    // 3. Atualiza o modal com o QR Code e o Copia e Cola oficiais
    abrirModalPix({
      titulo: plano,
      valor: `R$ ${valor.toFixed(2).replace('.', ',')}`,
      qrCodeBase64: dados.qrCodeBase64,
      copiaECola: dados.copiaECola
    });

    // 4. Consulta o status a cada 3 segundos até aprovar
    const paymentId = dados.paymentId;
    if (paymentId) {
      pixPollingInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`${BACKEND_URL}/api/pix/status/${paymentId}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            if (statusData.status === "approved") {
              clearInterval(pixPollingInterval);
              pixPollingInterval = null;
              await efetivarVipAposPagamento(user);
            }
          }
        } catch (e) {
          // Trata oscilações de rede sem interromper a consulta
        }
      }, 3000);
    }

  } catch (erro) {
    console.error("Erro ao chamar front-end Pix:", erro);
    alert("Erro de conexão ao gerar o Pix. Verifique se o serverpix está ativo.");
    fecharModalPix();
  }
}

// Deixa acessível globalmente
window.solicitarPixVip = solicitarPixVip;