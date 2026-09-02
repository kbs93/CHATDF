/**
 * BACKEND ISOLADO: SERVIÇO DE PIX MERCADO PAGO + FIRESTORE
 * Instalação de dependências:
 * npm install express cors dotenv
 */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// INSIRA O ACCESS TOKEN AQUI (TEST-... ou APP_USR-...) quando tiver hospedado colocar o original do Mercado Pago
const MP_ACCESS_TOKEN = "TEST-7106146778120922-090215-4d244f95870dc007e8a21228c681f77f-2445082082";

// 1. ROTA: GERAR COBRANÇA PIX
app.post('/api/pix/criar', async (req, res) => {
  try {
    const { uid, email, nome, valor, descricao } = req.body;

    if (!uid || !valor) {
      return res.status(400).json({ error: "Campos 'uid' e 'valor' são obrigatórios." });
    }

    const bodyPagamento = {
      transaction_amount: Number(valor),
      description: descricao || "Assinatura VIP - Chat DF",
      payment_method_id: "pix",
      payer: {
        email: email || "cliente@chatdf.com",
        first_name: nome || "Usuario",
      },
      metadata: {
        user_uid: uid,
        plano: "vip_30_dias"
      }
    };

// DEPOIS (ajuste cirúrgico):
    const response = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${MP_ACCESS_TOKEN.trim()}`,
        "X-Idempotency-Key": `${uid}-${Date.now()}`
      },
      body: JSON.stringify(bodyPagamento)
    });
    const data = await response.json();

    if (!response.ok) {
      console.error("Erro Mercado Pago:", data);
      return res.status(response.status).json({ error: data.message || "Erro ao gerar Pix" });
    }

    const qrCodeBase64 = data.point_of_interaction?.transaction_data?.qr_code_base64;
    const copiaECola = data.point_of_interaction?.transaction_data?.qr_code;
    const paymentId = data.id;

    return res.json({
      success: true,
      paymentId: paymentId,
      qrCodeBase64: `data:image/png;base64,${qrCodeBase64}`,
      copiaECola: copiaECola
    });

  } catch (err) {
    console.error("Erro interno ao criar Pix:", err);
    return res.status(500).json({ error: "Erro interno do servidor." });
  }
});

// 2. ROTA: WEBHOOK DO MERCADO PAGO
app.post('/api/pix/webhook', async (req, res) => {
  try {
    const { data } = req.body;
    res.status(200).send("OK");

    const paymentId = data?.id || req.query["data.id"] || req.query.id;
    if (!paymentId) return;

    const consulta = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`
      }
    });

    if (!consulta.ok) return;

    const paymentData = await consulta.json();

    if (paymentData.status === "approved") {
      const userUid = paymentData.metadata?.user_uid;
      console.log(`Pagamento ${paymentId} APROVADO para o UID: ${userUid}`);
    }

  } catch (err) {
    console.error("Erro no webhook:", err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` Servidor Pix rodando na porta ${PORT}`);
});