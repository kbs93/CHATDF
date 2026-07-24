import { stickers } from "./stickers.js";
import { sendMessage } from "./messages.js";
import { animations } from "./animations.js"; // ✅ NOVO
  // -----REFERENCIA ----------
export function initStickerPanel() {
  const panel = document.getElementById("stickerPanel");
  const list = document.getElementById("stickerList");
  const animList = document.getElementById("animList"); 
  const emojiList = document.getElementById("emojiList");
  const closeBtn = document.getElementById("stickerClose");
  const catButtons = document.querySelectorAll(".sticker-cat");
  const tabs = document.querySelectorAll(".expr-tab");
  const categories = document.querySelector(".sticker-categories");
  const animCategories = document.querySelector(".anim-categories");
const animCatButtons = document.querySelectorAll(".anim-cat");


  if (!panel || !list || !emojiList || !closeBtn) return;


  // ============================= EMOJIS (UNICODE SIMPLES) =============================
  const emojis = [
"😀","😁","😂","🤣","😃","😄","😅","😆","😉","😊","😋","😎","😍","😘","🥰","😗","😙","😚","🙂","🤗","🤩","🤔","🤨","😐","😑","😶","🙄","😏","😣",
"😥","😮","🤐","😯","😪","😫","🥱","😴","😌","😛","😜","😝","🤤","😒","😓","😔","😕","🙃","🤑","😲","☹","🙁","😖","😞","😟","😤","😢","😭","😦",
"😧","😨","😩","🤯","😬","😰","😱","🥵","🥶","😳","🤪","😵","🥴","😠","😡","🤬","😷","🤒","🤕","🤢","🤮","🤧","😇","🥳","🥺","🤠","🤡","🤥","🤫",
"🤭","🧐","🤓","😈","👿","👩","👨","🧑","👧","👦","🧒","👶","👵","👴","🧓","👩‍🦰","👨‍🦰","👩‍🦱","👨‍🦱","👩‍🦲","👨‍🦲","👩‍🦳","👨‍🦳","👱‍♀️","👱‍♂️","👸","🤴","👳‍♀️","👳‍♂️","👲",
"🧔","👼","🤶","🎅","👮‍♀️","👮‍♂️","🕵️‍♀️","🕵️‍♂️","💂‍♀️","💂‍♂️","👷‍♀️","👷‍♂️","👩‍⚕️","👨‍⚕️","👩‍🎓","👨‍🎓","👩‍🏫","👨‍🏫","👩‍⚖️","👨‍⚖️","👩‍🌾","👨‍🌾","👩‍🍳","👨‍🍳","👩‍🔧","👨‍🔧","👩‍🏭","👨‍🏭","👩‍💼","👨‍💼",
"👩‍🔬","👨‍🔬","👩‍💻","👨‍💻","👩‍🎤","👨‍🎤","👩‍🎨","👨‍🎨","👩‍✈️","👨‍✈️","👩‍🚀","👨‍🚀","👩‍🚒","👨‍🚒","🧕","👰","🤵","🤱","🤰","🦸‍♀️","🦸‍♂️","🦹‍♀️","🦹‍♂️","🧙‍♀️","🧙‍♂️","🧚‍♀️","🧚‍♂️","🧛‍♀️","🧛‍♂️","🧜‍♀️",
"🧜‍♂️","🧝‍♀️","🧝‍♂️","🧟‍♀️","🧟‍♂️","🙍‍♀️","🙍‍♂️","🙎‍♀️","🙎‍♂️","🙅‍♀️","🙅‍♂️","🙆‍♀️","🙆‍♂️","🧏‍♀️","🧏‍♂️","💁‍♀️","💁‍♂️","🙋‍♀️","🙋‍♂️","🙇‍♀️","🙇‍♂️","🤦‍♀️","🤦‍♂️","🤷‍♀️","🤷‍♂️","💆‍♀️","💆‍♂️","💇‍♀️","💇‍♂️","🧖‍♀️",
"🧖‍♂️","🤹‍♀️","🤹‍♂️","👩‍🦽","👨‍🦽","👩‍🦼","👨‍🦼","👩‍🦯","👨‍🦯","🧎‍♀️","🧎‍♂️","🧍‍♀️","🧍‍♂️","🚶‍♀️","🚶‍♂️","🏃‍♀️","🏃‍♂️","💃","🕺","🧗‍♀️","🧗‍♂️","🧘‍♀️","🧘‍♂️","🛀","🛌","🕴","🏇","🏂","🏌️‍♀️","🏌️‍♂️","🏄‍♀️",
"🏄‍♂️","🚣‍♀️","🚣‍♂️","🏊‍♀️","🏊‍♂️","🤽‍♀️","🤽‍♂️","🤾‍♀️","🤾‍♂️","⛹️‍♀️","⛹️‍♂️","🏋️‍♀️","🏋️‍♂️","🚴‍♀️","🚴‍♂️","🚵‍♀️","🚵‍♂️","🤸‍♀️","🤸‍♂️","🤳","🦶","👂","🦻","👃","🤏","👈","👉","☝","🦵","💪",
"👆","👇","✌","🤞","🖖","🤘","🤙","🖐","✋","👌","👍","👎","✊","👊","🤛","🤜","🤚","👋","🤟","✍","👏","👐","🙌","🤲","🙏","🤝","💅","👹","👺","💀","☠",
"👻","👽","👾","🤖","💩","😺","😸","😹","😻","😼","😽","🙀","😿","🙈","🙉","🙊","🐵","🐶","🐺","🦁","🐯","🦒",
"🦊","🦝","🐮","🐷","🐗","🐭","🐹","🐰","🐻","🐨","🐼","🐸","🦓","🐴","🦄","🐔","🐲","🐽","🐾","🐒","🦍","🦧","🦮","🐕‍🦺","🐩","🐕","🐈","🐅","🐆","🐎",
"🦌","🦏","🦛","🐂","🐃","🐄","🐖","🐏","🐑","🐐","🐪","🐫","🦙","🦘","🦥","🦨","🦡","🐘","🐁","🐀","🦔","🐇","🐿","🦎","🐊","🐢","🐍","🐉","🦕","🦖",
"🦦","🦈","🐬","🐳","🐋","🐟","🐠","🐡","🦐","🦑","🐙","🦞","🦀","🐚","🦆","🐓","🦃","🦅","🕊","🦢","🦜","🦩","🦚","🦉","🐦","🐧","🐥","🐤","🐣","🦇",
"🦋","🐌","🐛","🦟","🦗","🐜","🐝","🐞","🦂","🕷","🕸","🦠","🧞‍♀️","🧞‍♂️","🗣","👤","👥","👁","👀","🦴","🦷","👅","👄","🧠","🦾","🦿","👣","🤺","⛷","🤼‍♂️",
"🤼‍♀️","👯‍♂️","👯‍♀️","💑","👩‍❤️‍👩","👨‍❤️‍👨","💏","👩‍❤️‍💋‍👩","👨‍❤️‍💋‍👨","👪","👨‍👩‍👦","👨‍👩‍👧","👨‍👩‍👧‍👦","👨‍👩‍👦‍👦","👨‍👩‍👧‍👧","👨‍👨‍👦","👨‍👨‍👧","👨‍👨‍👧‍👦","👨‍👨‍👦‍👦","👨‍👨‍👧‍👧","👩‍👩‍👦","👩‍👩‍👧","👩‍👩‍👧‍👦","👩‍👩‍👦‍👦","👩‍👩‍👧‍👧","👩‍👦","👩‍👧",
"👩‍👧‍👦","👩‍👦‍👦","👩‍👧‍👧","👨‍👦","👨‍👧","👨‍👧‍👦","👨‍👦‍👦","👨‍👧‍👧","🧡","💛","💚","💙","💜","🤎","🖤","🤍","💔","❣","💕","💓","💗","💖","💘","💝","💟","💞","💌","🏳‍🌈","🏳",
"🏴","🏴‍☠️","🚩","☁","⛅","⛈","🌤","🌥","🌦","🌧","🌨","🌩","🌪","🌫","🌝","🌑","🌒","🌓","🌕","🌖","🌗","🌘","🌙","🌚","🌛","🌜","☀","🌞","⭐","🌟","☄",
"🌡","🌬","🌀","🌈","🌂","☂","☮","✝","☪","🕉","☸","✡","☯","☦","⚕","♾","⚛","💭","🗯","💬","🗨","👁‍🗨","🔯","🕎","🛐","⛎","♈","♉","♊","♋","♌","♍","♒",
"♓","🆔","♎","♏","♐","♑",

  ];

    // =============================
  // NOVO CODIGO 26-02-26
  // =============================
function renderEmojis(target = emojiList) {
  target.innerHTML = "";

  emojis.forEach(e => {
    const span = document.createElement("span");
    span.textContent = e;
    span.className = "emoji-item";

    span.onclick = () => {
      const input = window.messageInput;
      if (!input) return;

      const start = input.selectionStart;
      const end = input.selectionEnd;

      const textoAntes = input.value.substring(0, start);
      const textoDepois = input.value.substring(end);

      input.value = textoAntes + e + textoDepois;

      const novaPosicao = start + e.length;
      input.setSelectionRange(novaPosicao, novaPosicao);
      input.focus();
    };

    target.appendChild(span);
  });
}

  // =============================
  // STICKERS (LÓGICA EXISTENTE)
  // =============================
// =============================
  // STICKERS (UNIFICADO COM LAZY RENDER RESPONSIVO)
  // =============================
  function renderCategory(cat, target = list) {
    target.innerHTML = "";

    let items = [];
    if (cat === "all") {
      const unique = new Set();
      Object.keys(stickers).forEach(key => {
        if (key === "all") return;
        stickers[key].forEach(url => unique.add(url));
      });
      items = Array.from(unique);
    } else {
      items = stickers[cat] || [];
    }

    // define quantidade conforme dispositivo
    const PAGE_SIZE = window.innerWidth <= 768 ? 8 : 12;
    let currentIndex = 0;

    // renderiza o próximo lote
    function renderNextBatch() {
      const slice = items.slice(currentIndex, currentIndex + PAGE_SIZE);

      slice.forEach((url) => {
        const img = document.createElement("img");
        img.src = url;
        img.alt = "sticker";
        img.className = "sticker-img";
        img.style.cursor = "pointer";
        img.loading = "lazy";

        img.onclick = async () => {
          await sendMessage({ value: url });
          if (typeof closeBtn !== "undefined" && closeBtn) {
            closeBtn.click();
          }
        };

        target.appendChild(img);
      });

      currentIndex += PAGE_SIZE;
    }

    // garante que exista scroll
    function ensureScrollable() {
      while (
        target.scrollHeight <= target.clientHeight &&
        currentIndex < items.length
      ) {
        renderNextBatch();
      }
    }

    // primeiro render
    renderNextBatch();
    ensureScrollable();

    // ao rolar até o final, carrega mais
    target.onscroll = () => {
      const chegouNoFinal =
        target.scrollTop + target.clientHeight >= target.scrollHeight - 10;

      if (chegouNoFinal && currentIndex < items.length) {
        renderNextBatch();
      }
    };
  }




function renderCategory(cat, target = list) {
  target.innerHTML = "";

  let items = [];
  if (cat === "all") {
    const unique = new Set();
    Object.keys(stickers).forEach(key => {
      if (key === "all") return;
      stickers[key].forEach(url => unique.add(url));
    });
    items = Array.from(unique);
  } else {
    items = stickers[cat] || [];
  }

  // PAGE SIZE por dispositivo (mantido)
  const PAGE_SIZE = window.innerWidth <= 768 ? 8 : 12;
  let currentIndex = 0;

  function renderNextBatch() {
    const slice = items.slice(currentIndex, currentIndex + PAGE_SIZE);

    slice.forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "sticker";
      img.className = "sticker-img";
      img.style.cursor = "pointer";
      img.loading = "lazy";

      img.onclick = async () => {
        await sendMessage({ value: url });
        // fecha painel antigo se existir
        if (typeof closeBtn !== "undefined" && closeBtn) closeBtn.click();
      };

      target.appendChild(img);
    });

    currentIndex += PAGE_SIZE;
  }

  function ensureScrollable() {
    while (
      target.scrollHeight <= target.clientHeight &&
      currentIndex < items.length
    ) {
      renderNextBatch();
    }
  }

  renderNextBatch();
  ensureScrollable();

  target.onscroll = () => {
    const chegouNoFinal =
      target.scrollTop + target.clientHeight >= target.scrollHeight - 10;

    if (chegouNoFinal && currentIndex < items.length) {
      renderNextBatch();
    }
  };
}

  



// =============================  ABAS (EMOJI / STICKER / ANIMAÇA0) =============================
function setMode(mode) {
  // limpa conteúdo
  emojiList.innerHTML = "";
  list.innerHTML = "";
  animList.innerHTML = "";

  // desativa listas
  [emojiList, list, animList].forEach(el => {
    el.classList.remove("active");
  });

  //  DESATIVA TODAS AS CATEGORIAS PRIMEIRO
  categories.classList.remove("active");
  animCategories.classList.remove("active");

  if (mode === "emoji") {
    renderEmojis();
    emojiList.classList.add("active");
    // emoji NÃO usa categorias
  }

  if (mode === "sticker") {
    renderCategory("all");
    list.classList.add("active");

    // só stickers
    categories.classList.add("active");
  }
  if (mode === "anim") {
    renderAnimCategory("all");
    animList.classList.add("active");
    // só animações
    animCategories.classList.add("active");
  }

  // ativa aba correta
  tabs.forEach(t =>
    t.classList.toggle("active", t.dataset.mode === mode)
  );
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    setMode(tab.dataset.mode);
  });
});

// =============================
// CATEGORIAS (STICKER)
// =============================
catButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    catButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    btn.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest"
    });

    renderCategory(btn.dataset.cat);
  });
});

// =============================
// ABRIR PAINEL (DESKTOP ONLY)
// =============================
const emojiBtn = document.getElementById("emojiBtn");

if (emojiBtn) {
  emojiBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    // 📱 BLOQUEIA PAINEL DESKTOP NO MOBILE
    if (window.isMobileUI?.() || window.innerWidth <= 768) return;

    panel.classList.toggle("show");
  });
}
// =============================
// FECHAR PAINEL
// =============================
closeBtn.addEventListener("click", () => {
  panel.classList.remove("show");
});


// =============================
// INICIALIZAÇÃO
// =============================
renderEmojis();
renderCategory("all");
// ocultando o emoji no modo mobile 12-05-26
if (window.innerWidth <= 768) {
  setMode("sticker");
} else {
  setMode("emoji");
}

// =============================
// GARANTE PAINEL FECHADO AO CARREGAR
// =============================
panel.classList.remove("show");

// =============================
// aAnimação dentro do painel sticke 23-06-25 JSON LOTTIE EMOJI
// =============================
let animacaoAtivaMobile = null; // Guardador global da animação em prévia no mobile

function renderAnimCategory(cat, target = animList) {
    target.innerHTML = "";
    animacaoAtivaMobile = null; // Limpa a prévia ao trocar de categoria

    let listAnims = [];
    if (cat === "all" || cat === "Todas") {
      Object.keys(animations).forEach(key => {
        if (key === "all") return;
        animations[key].forEach(src => listAnims.push(src));
      });
    } else {
      listAnims = animations[cat] || [];
    }
listAnims.forEach(src => {
      // Cria uma div para ser o botão do emoji em vez de uma tag img edita o emoji dentro do painel
      const containerAnim = document.createElement("div");
      containerAnim.className = "sticker-img animation-img";
      containerAnim.style.display = "inline-block";
      containerAnim.style.cursor = "pointer";
      containerAnim.style.width = "35px";
      containerAnim.style.height = "35px";

      let instanceLottie = null; // Guarda o player do Lottie

      // Se for um arquivo JSON (Lottie), cria um ID único e inicializa o player nele
      if (typeof src === "string" && src.trim().endsWith(".json")) {
        const idUnicoPainel = "lottie-panel-" + Math.random().toString(36).substring(2, 11);
        containerAnim.id = idUnicoPainel;


        // 23-06-25 - Inicializa o Lottie com autoplay false para que fique parado no painel
requestAnimationFrame(() => {
          if (typeof lottie !== "undefined") {
            // Guardamos a instância da animação na variável 'anim' para poder controlá-la
            instanceLottie = lottie.loadAnimation({
              container: document.getElementById(idUnicoPainel),
              renderer: 'svg',
              loop: true,
              autoplay: false, //  Inicia parado por padrão
              path: src.trim()
            });

            // Dá play na animação específica quando o mouse entra no botão (Desktop)
            containerAnim.addEventListener("mouseenter", () => {
              if (window.innerWidth > 768) {
                instanceLottie.play();
              }
            });

            // Pausa a animação específica quando o mouse sai do botão (Desktop)
            containerAnim.addEventListener("mouseleave", () => {
              if (window.innerWidth > 768) {
                instanceLottie.pause();
              }
            });
          }
        });
      } else {
        // Fallback caso você tenha misturado algum GIF ou imagem na lista
        containerAnim.innerHTML = `<img src="${src}" style="width:100%; height:100%; object-fit:contain;">`;
      }

      // Ao clicar na div (1º Toque = Prévia no Mobile | 2º Toque / Clique Desktop = Envia para o chat)
      containerAnim.addEventListener("click", async (e) => {
        const isMobile = window.innerWidth <= 768;

        if (isMobile) {
          // Se não for o mesmo emoji que já está tocando no mobile, ativa a prévia e não envia ainda
          if (animacaoAtivaMobile !== containerAnim) {
            e.preventDefault();
            e.stopPropagation();

            // Se tinha outro emoji tocando antes no mobile, pausa ele
            if (animacaoAtivaMobile && animacaoAtivaMobile._lottiePlayer) {
              animacaoAtivaMobile._lottiePlayer.pause();
            }

            // Ativa o novo emoji
            animacaoAtivaMobile = containerAnim;
            containerAnim._lottiePlayer = instanceLottie;

            if (instanceLottie) {
              instanceLottie.play();
            }
            return; // Interrompe o envio para aguardar o 2º toque!
          }
        }

        // Se for Desktop OU se for o SEGUNDO toque no mesmo emoji no Mobile: realiza o envio!
        await sendMessage({ value: src });
        animacaoAtivaMobile = null;

        if (typeof closeBtn !== "undefined" && closeBtn) {
          closeBtn.click();
        }
      });

      target.appendChild(containerAnim);
    });
 
  }
animCatButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    animCatButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    btn.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest"
    });

    renderAnimCategory(btn.dataset.cat);
  });
});

// expõe para uso no bottom sheet (mobile)
window.renderEmojis = renderEmojis;

// ======================================================
// EXPOSIÇÃO PARA BOTTOM SHEET (MOBILE)
// ======================================================

// Stickers
window.renderStickers = function (cat, target) {
  renderCategory(cat, target);
};
// Animações
window.renderAnimations = function (cat, target) {
  renderAnimCategory(cat, target);
};
}// FIM DA FUNCAO export function 


