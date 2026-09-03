/* =========================================================================
   COMPONENTE ISOLADO: MODAL PIX VIP (ES MODULE)
   ========================================================================= */

// 1. INJEÇÃO DO CSS EXCLUSIVO DO MODAL
const modalStyles = `
  .pix-modal-overlay {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10005;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;
    font-family: 'Poppins', system-ui, sans-serif;
  }

  .pix-modal-overlay.open {
    opacity: 1;
    pointer-events: auto;
  }

  .pix-modal-card {
    background: #ffffff;
    width: 90%;
    max-width: 400px;
    border-radius: 20px;
    padding: 24px;
    box-shadow: 0 12px 36px rgba(0, 0, 0, 0.25);
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    transform: translateY(12px) scale(0.97);
    transition: transform 0.25s ease;
  }

  .pix-modal-overlay.open .pix-modal-card {
    transform: translateY(0) scale(1);
  }

  .pix-btn-close {
    position: absolute;
    top: 14px;
    right: 16px;
    width: 36px;
    height: 36px;
    background: rgba(71, 70, 70, 0.075);
    border: none;
    font-size: 22px;
    color: #64748b;
    cursor: pointer;
    line-height: 1;
    padding: 4px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    transition: color 0.15s ease;
  }

  .pix-btn-close:hover {
    color: #0f172a;
  }

  .pix-header-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: rgba(2, 6, 65, 0.08);
    color: #020641;
    padding: 4px 14px;
    border-radius: 999px;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 8px;
  }

  .pix-title {
    font-size: 18px;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 4px 0;
  }

  .pix-value {
    font-size: 22px;
    font-weight: 800;
    color: #10b981;
    margin-bottom: 14px;
  }

  .pix-qrcode-box {
    width: 180px;
    height: 180px;
    border: 2px dashed #cbd5e1;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    background: #f8fafc;
    overflow: hidden;
  }

  .pix-qrcode-box img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .pix-copy-area {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 14px;
    box-sizing: border-box;
  }

  .pix-code-input {
    width: 100%;
    height: 38px;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 12px;
    color: #475569;
    outline: none;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
    box-sizing: border-box;
    text-align: center;
  }

  .pix-btn-copy {
    width: 100%;
    height: 42px;
    background: #020641;
    color: #ffffff;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: background 0.15s ease, transform 0.1s ease;
    white-space: nowrap;
    user-select: none;
  }

  .pix-btn-copy:active {
    transform: scale(0.96);
  }

  .pix-status-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    font-weight: 600;
    color: #64748b;
  }

  .pix-spinner-dot {
    width: 12px;
    height: 12px;
    border: 2px solid #020641;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spinPix 0.8s linear infinite;
  }

  @keyframes spinPix {
    to { transform: rotate(360deg); }
  }
`;

const styleEl = document.createElement("style");
styleEl.textContent = modalStyles;
document.head.appendChild(styleEl);

// 2. INJEÇÃO DO HTML
const modalHTML = `
  <div id="pixModalOverlay" class="pix-modal-overlay">
    <div class="pix-modal-card">
      <button id="closePixModalBtn" type="button" class="pix-btn-close" aria-label="Fechar">✕</button>
      
      <div class="pix-header-badge">
        <i class="bi bi-gem"></i> Assinatura VIP
      </div>
      
      <h4 class="pix-title" id="pixPlanTitle">Plano 30 Dias</h4>
      <div class="pix-value" id="pixPlanPrice">R$ 15,00</div>

      <div class="pix-qrcode-box">
        <img id="pixQrCodeImg" src="" alt="Aguardando QR Code..." style="display: none;">
      </div>

      <div class="pix-copy-area">
        <input type="text" id="pixCopyInput" class="pix-code-input" readonly value="Aguardando código Pix...">
        <button type="button" id="pixCopyBtn" class="pix-btn-copy">
          <i class="bi bi-clipboard"></i> Copiar
        </button>
      </div>

      <div class="pix-status-indicator">
        <div class="pix-spinner-dot"></div>
        <span>Aguardando pagamento...</span>
      </div>
    </div>
  </div>
`;

document.body.insertAdjacentHTML("beforeend", modalHTML);

// 3. LÓGICA E EVENTOS DO MODAL
const overlay = document.getElementById("pixModalOverlay");
const closeBtn = document.getElementById("closePixModalBtn");
const copyBtn = document.getElementById("pixCopyBtn");
const copyInput = document.getElementById("pixCopyInput");

export function fecharModalPix() {
  if (overlay) overlay.classList.remove("open");
}

closeBtn?.addEventListener("click", fecharModalPix);
overlay?.addEventListener("click", (e) => {
  if (e.target === overlay) fecharModalPix();
});

copyBtn?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(copyInput.value);
  } catch (err) {
    copyInput.select();
    document.execCommand("copy");
  }

  const originalText = `<i class="bi bi-clipboard"></i> Copiar`;
  copyBtn.innerHTML = `<i class="bi bi-check2"></i> Código Copiado!`;
  copyBtn.style.background = "#10b981";

  setTimeout(() => {
    copyBtn.innerHTML = originalText;
    copyBtn.style.background = "#020641";
  }, 2000);
});

export function abrirModalPix({ titulo = "Plano 30 Dias", valor = "R$ 15,00", qrCodeBase64 = "", copiaECola = "" } = {}) {
  if (titulo) document.getElementById("pixPlanTitle").textContent = titulo;
  if (valor) document.getElementById("pixPlanPrice").textContent = valor;
  
  const imgEl = document.getElementById("pixQrCodeImg");
  if (qrCodeBase64) {
    imgEl.src = qrCodeBase64;
    imgEl.style.display = "block";
  } else {
    imgEl.src = "";
    imgEl.style.display = "none";
  }

  if (copiaECola) copyInput.value = copiaECola;

  overlay.classList.add("open");
}

// Compatibilidade retroativa global
window.abrirModalPix = abrirModalPix;
window.fecharModalPix = fecharModalPix;