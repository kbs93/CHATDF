// --- Criação das salas ---
    const salas = [
      "Bate papo Geral",
      "Religiao",
      "Politica",
      "Transito",
      "Lugares para sair",
      "Futebol",
      "Eventos",
      "DESABAFO",
    ];

    const container = document.getElementById("salas-lista");
    salas.forEach((nome) => {
      const col = document.createElement("div");
      col.className = "col-md-3 col-6 sala-col d-flex justify-content-center";
      const link = document.createElement("a");
      link.href = `chat.html?sala=${encodeURIComponent(nome)}`;
      link.className = "sala-btn w-100";
      link.innerText = nome;
      col.appendChild(link);
      container.appendChild(col);
    });
