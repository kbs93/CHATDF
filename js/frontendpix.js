/* =========================================================================
   FRONT-END PIX: CONEXÃO COM O BACKEND E ABERTURA DO MODAL
   ========================================================================= */
import { auth } from "./firebase-config.js";

const BACKEND_URL = "http://localhost:3000";

export async function solicitarPixVip(valor = 15.00, plano = "VIP Diamante - 30 Dias") {
  const user = auth.currentUser;

  if (!user) {
    alert("Faça login para assinar o VIP.");
    return;
  }

  // 1. Abre o modal em estado de carregamento imediato
  if (typeof window.abrirModalPix === "function") {
    window.abrirModalPix({
      titulo: plano,
      valor: `R$ ${valor.toFixed(2).replace('.', ',')}`,
      copiaECola: "Gerando código Pix..."
    });
  }

  try {
    // 2. Chama a rota do serverpix.js
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
      if (typeof window.fecharModalPix === "function") window.fecharModalPix();
      return;
    }

    // 3. Atualiza o modal com o QR Code e o Copia e Cola oficiais
    if (typeof window.abrirModalPix === "function") {
      window.abrirModalPix({
        titulo: plano,
        valor: `R$ ${valor.toFixed(2).replace('.', ',')}`,
        qrCodeBase64: dados.qrCodeBase64,
        copiaECola: dados.copiaECola
      });
    }

  } catch (erro) {
    console.error("Erro ao chamar front-end Pix:", erro);
    alert("Erro de conexão ao gerar o Pix. Verifique se o serverpix está ativo.");
    if (typeof window.fecharModalPix === "function") window.fecharModalPix();
  }
}

// Deixa acessível globalmente
window.solicitarPixVip = solicitarPixVip;