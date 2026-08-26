import { stickers } from "./stickers.js";
import { sendMessage } from "./messages.js";

export function initStickerPanel() {
  const panel = document.getElementById("stickerPanel");
  const list = document.getElementById("stickerList");
  const emojiList = document.getElementById("emojiList");
  const closeBtn = document.getElementById("stickerClose");
  const catButtons = document.querySelectorAll(".sticker-cat");
  const tabs = document.querySelectorAll(".expr-tab");
  const categories = document.querySelector(".sticker-categories");

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
    "♓","🆔","♎","♏","♐","♑"
  ];

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

  // ============================= STICKERS / FIGURINHAS PNG =============================
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
          if (typeof closeBtn !== "undefined" && closeBtn) {
            closeBtn.click();
          }
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

  // ============================= ABAS (EMOJI / STICKER) =============================
  function setMode(mode) {
    emojiList.innerHTML = "";
    list.innerHTML = "";

    [emojiList, list].forEach(el => {
      el.classList.remove("active");
    });

    categories.classList.remove("active");

    if (mode === "emoji") {
      renderEmojis();
      emojiList.classList.add("active");
    }

    if (mode === "sticker") {
      renderCategory("all");
      list.classList.add("active");
      categories.classList.add("active");
    }

    tabs.forEach(t =>
      t.classList.toggle("active", t.dataset.mode === mode)
    );
  }

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      setMode(tab.dataset.mode);
    });
  });

  // ============================= CATEGORIAS (STICKER) =============================
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

  // ============================= ABRIR / FECHAR PAINEL =============================
  const emojiBtn = document.getElementById("emojiBtn");
  if (emojiBtn) {
    emojiBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.isMobileUI?.() || window.innerWidth <= 768) return;
      panel.classList.toggle("show");
    });
  }

  closeBtn.addEventListener("click", () => {
    panel.classList.remove("show");
  });

  // Inicialização padrão
  renderEmojis();
  renderCategory("all");

  if (window.innerWidth <= 768) {
    setMode("sticker");
  } else {
    setMode("emoji");
  }

  panel.classList.remove("show");

  // Exposição global para o Bottom Sheet (Mobile)
  window.renderEmojis = renderEmojis;
  window.renderStickers = function (cat, target) {
    renderCategory(cat, target);
  };
}