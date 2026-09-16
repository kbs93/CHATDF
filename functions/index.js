const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");

const app = express();

// Habilita CORS completo
app.use(cors({ origin: true }));
app.use(express.json());

const MP_ACCESS_TOKEN = "APP_USR-7106146778120922-090215-2590fc2fb5e4f0bf4c00f1b4088cb6ad-2445082082";

// Handler para criação do Pix (responde tanto em /api/pix/criar quanto em /pix/criar)
const criarPixHandler = async (req, res) => {
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
        plano: "vip_3_dias"
      }
    };

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
      return res.status(response.status).json({ 
        error: data.message || (data.cause && data.cause[0]?.description) || "Erro ao gerar Pix" 
      });
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
};

// Handler para consulta de status do Pix
const statusPixHandler = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const consulta = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: {
        "Authorization": `Bearer ${MP_ACCESS_TOKEN}`
      }
    });

    if (!consulta.ok) {
      return res.status(consulta.status).json({ error: "Erro ao consultar pagamento" });
    }

    const paymentData = await consulta.json();
    return res.json({ status: paymentData.status });
  } catch (err) {
    console.error("Erro ao verificar status:", err);
    return res.status(500).json({ error: "Erro interno ao checar status" });
  }
};

// Rotas mapeadas para suportar com ou sem o prefixo /api
app.post("/pix/criar", criarPixHandler);
app.post("/api/pix/criar", criarPixHandler);

app.get("/pix/status/:paymentId", statusPixHandler);
app.get("/api/pix/status/:paymentId", statusPixHandler);

exports.api = functions.https.onRequest(app);