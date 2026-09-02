// bloqueio.js - Módulo de Moderação, Denúncias e Bloqueio do Chat-DF
import { auth, db, rtdb, signOutUser } from "./firebase-config.js";
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { showToast } from "./ui.js";

/**
 * Verifica se o usuário autenticado está na lista de banidos/bloqueados.
 * Retorna true se estiver bloqueado (e executa a rotina de expulsão).
 */
export async function verificarUsuarioBloqueado(user, userData = null) {
  if (!user) return false;

  try {
    // 1. Checagem direta nos dados do documento do usuário
    if (userData && (userData.isBanned === true || userData.status === "banned")) {
      await executarExpulsaoBloqueio(user, userData.banReason || "Violação dos termos de uso da comunidade.");
      return true;
    }

    // 2. Checagem por documento se userData não foi passado
    if (!userData) {
      const userDocRef = doc(db, "users", user.uid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data.isBanned === true || data.status === "banned") {
          await executarExpulsaoBloqueio(user, data.banReason || "Violação dos termos de uso da comunidade.");
          return true;
        }
      }
    }

    // 3. Checagem secundária por e-mail na coleção banned_emails (caso tenha sido banido por e-mail direto)
    if (user.email) {
      const sanitizedEmail = user.email.toLowerCase().trim().replace(/\./g, "_");
      const bannedEmailRef = doc(db, "banned_emails", sanitizedEmail);
      const bannedSnap = await getDoc(bannedEmailRef);

      if (bannedSnap.exists()) {
        const banInfo = bannedSnap.data();
        await executarExpulsaoBloqueio(user, banInfo.reason || "E-mail suspenso por moderação.");
        return true;
      }
    }

    return false;
  } catch (err) {
    console.error("Erro na checagem de bloqueio:", err);
    return false;
  }
}

/**
 * Executa o encerramento de sessão do usuário banido e exibe o modal informativo (UX).
 */
async function executarExpulsaoBloqueio(user, motivo) {
  try {
    // Remove presença online imediata
    if (user?.uid) {
      const userStatusRef = ref(rtdb, "status/" + user.uid);
      await set(userStatusRef, null);
    }

    // Limpa caches locais
    localStorage.removeItem("chatdf_user_area_cache");
    localStorage.removeItem("chatdf_user_color");

    // Desloga no Firebase Auth
    await signOutUser();

    // Renderiza modal de aviso de suspensão
    exibirModalContaSuspensa(motivo);
  } catch (err) {
    console.error("Erro ao processar expulsão:", err);
  }
}

/**
 * Modal visual informando a suspensão da conta ao usuário.
 */
function exibirModalContaSuspensa(motivo) {
  let modal = document.getElementById("bannedNoticeModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "bannedNoticeModal";
    modal.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.75);
      display: flex; align-items: center; justify-content: center;
      z-index: 100000; padding: 16px;
    `;
    modal.innerHTML = `
      <div style="background: #fff; width: 100%; max-width: 420px; border-radius: 20px; padding: 26px; text-align: center; box-shadow: 0 15px 35px rgba(0,0,0,0.3);">
        <div style="width: 58px; height: 58px; background: #fee2e2; color: #dc2626; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 14px;">
          <i class="bi bi-shield-x"></i>
        </div>
        <h4 style="font-size: 20px; font-weight: 700; color: #1e1b4b; margin-bottom: 8px;">Acesso Suspenso</h4>
        <p style="font-size: 14px; color: #555; line-height: 1.5; margin-bottom: 18px;">
          Sua conta foi suspensa do Chat-DF por descumprimento das Diretrizes da Comunidade.
        </p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; font-size: 13px; color: #64748b; margin-bottom: 20px;">
          <strong>Motivo:</strong> ${motivo}
        </div>
        <button id="closeBannedNoticeBtn" type="button" style="width: 100%; padding: 12px; background: #020641; color: #fff; border: none; border-radius: 12px; font-weight: 600; font-size: 14px; cursor: pointer;">
          Entendido
        </button>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById("closeBannedNoticeBtn")?.addEventListener("click", () => {
      modal.remove();
      window.location.href = "index.html";
    });
  }
}

/**
 * Inicializa a escuta dos modais de denúncia existentes no chat.html e index.html.
 */
/**
 * Inicializa a escuta dos modais de denúncia existentes no chat.html e index.html.
 * Centralizado e compatível com as regras de 'denuncias_usuarios'.
 */
export function initDenuncias() {
  const modalDenuncia = document.getElementById("reportUserModal") || document.getElementById("reportModal");
  const btnSubmit = document.getElementById("submitReportBtn");
  const btnCancel = document.getElementById("cancelReportBtn");
  const btnCloseX = document.getElementById("closeReportModalX");
  const reasonInput = document.getElementById("reportReasonSelect");
  const reportBtn = document.getElementById("reportUserBtn");

  const fecharModal = () => {
    if (modalDenuncia) {
      modalDenuncia.style.display = "none";
      modalDenuncia.classList.add("hidden");
    }
  };

  btnCancel?.addEventListener("click", fecharModal);
  btnCloseX?.addEventListener("click", fecharModal);

  btnSubmit?.addEventListener("click", async () => {
    const targetUid = reportBtn?.getAttribute("data-target-uid") || window.appState?.currentViewedProfileId;
    const motivo = reasonInput?.value?.trim();

    if (!auth.currentUser) {
      showToast("Você precisa estar logado para denunciar.");
      return;
    }

    if (!targetUid) {
      showToast("Não foi possível identificar o usuário denunciado.");
      return;
    }

    if (auth.currentUser.uid === targetUid) {
      showToast("Você não pode denunciar a si mesmo.");
      return;
    }

    if (!motivo) {
      showToast("Selecione o motivo da denúncia.");
      return;
    }

    try {
      //showToast("Enviando denúncia...");

      // 1. Busca os dados do autor da denúncia
      const reporterProfileRef = doc(db, "users", auth.currentUser.uid);
      const reporterSnap = await getDoc(reporterProfileRef);
      const reporterData = reporterSnap.exists() ? reporterSnap.data() : {};
      const reporterName = reporterData.nome || auth.currentUser.displayName || "Usuário";

      // 2. Busca os dados do usuário denunciado
      const targetProfileRef = doc(db, "users", targetUid);
      const targetSnap = await getDoc(targetProfileRef);
      const targetData = targetSnap.exists() ? targetSnap.data() : {};
      const targetName = targetData.nome || window.__currentProfileData?.nome || "Usuário";

      // 3. Monta o ID idêntico ao seu banco: user_Nome_AAAA-MM-DD_HH-MM-SS
      const agora = new Date();
      const pad = (n) => String(n).padStart(2, "0");
      const dataId = `${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}_${pad(agora.getHours())}-${pad(agora.getMinutes())}-${pad(agora.getSeconds())}`;
      const nomeLimpo = reporterName.trim().replace(/\s+/g, "_").replace(/[^\wÀ-ÿ_-]/g, "");
      const docId = `user_${nomeLimpo}_${dataId}`;

      // 4. Salva com os exatos 6 campos validados pela sua regra do Firebase
      await setDoc(doc(db, "denuncias_usuarios", docId), {
        reportedUid: targetUid,
        reportedName: targetName,
        reporterUid: auth.currentUser.uid,
        reporterName: reporterName,
        reason: motivo,
        createdAt: serverTimestamp()
      });

      // 5. Injeta a trava de 2 minutos no perfil do denunciante
      const tempoLimiteMs = 2 * 60 * 1000;
      const horarioLiberacao = Date.now() + tempoLimiteMs;
      await setDoc(reporterProfileRef, {
        travaDenunciaAtiva: horarioLiberacao,
        ultimoUsuarioDenunciado: targetUid
      }, { merge: true });

      showToast("Denúncia enviada");
      fecharModal();

      if (reportBtn) reportBtn.style.opacity = "0.5";
      const contextReportBtn = document.getElementById("contextReportBtn");
      if (contextReportBtn) contextReportBtn.style.opacity = "0.5";

    } catch (err) {
      console.error("Erro ao registrar denúncia:", err);
      showToast("Erro ao enviar denúncia. Tente novamente.");
    }
  });
}