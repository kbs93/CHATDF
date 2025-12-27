
    // --- Canvas e partículas ---
    const canvas = document.getElementById('background-animation');
    const ctx = canvas.getContext('2d');
    let width, height;
    let particles = [];

    const imageSrc = "";
    const img = new Image();
    img.src = imageSrc;

    function resizeCanvas() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight * 0.9;
    }

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

// 🔹 Criação dos balões 3D espalhados por toda a área azul
const chatBalloons = [];
const numBalloons = 15; // aumenta a quantidade total

for (let i = 0; i < numBalloons; i++) {
  chatBalloons.push({
    // espalha os balões por toda a tela
    x: (Math.random() - 0.5) * window.innerWidth * 1.5, 
    y: (Math.random() - 0.5) * window.innerHeight * 1.2,
    z: Math.random() * 1000 + 200,
    speed: 0.6 + Math.random() * 1.2,
    size: 60 + Math.random() * 70
  });
}



    // --- Função principal ---
  function draw() {
  ctx.clearRect(0, 0, width, height);

  // 🔸 Linhas entre partículas
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 100) {
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255,255,255,0.1)";
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }

  // 🔸 Partículas
  for (let p of particles) {
    if (p.hasImage && img.complete) {
      ctx.globalAlpha = p.opacity;
      ctx.drawImage(img, p.x - 8, p.y - 8, 16, 16);
      ctx.globalAlpha = 1;
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
      ctx.fill();
    }
    p.x += p.dx;
    p.y += p.dy;
    if (p.x < 0 || p.x > width) p.dx *= -1;
    if (p.y < 0 || p.y > height) p.dy *= -1;
  }

  // 🔹 Balões 3D com perspectiva real
  // 🔹 Balões 3D com perspectiva real e rotação simulada
// 🔹 Balões 3D com rotação e flutuação vertical realista
const fov = 500;
const time = Date.now() * 0.001;

for (let b of chatBalloons) {
  // Movimento no eixo Z (profundidade)
  b.z -= b.speed;
  if (b.z < 100) {
    b.z = 1200;
    b.x = (Math.random() - 0.5) * window.innerWidth * 1.5;
    b.y = (Math.random() - 0.5) * window.innerHeight * 1.2;
  }

  // 🔸 Flutuação vertical suave (efeito “subindo no ar”)
  b.y -= 0.1 * Math.cos(time + b.x * 0.01);
  if (b.y < -window.innerHeight / 1.5) {
    b.y = window.innerHeight / 1.5;
  }

  // 🔸 Rotação 3D simulada no eixo Y
  const rotation = Math.sin(time + b.x * 0.002) * 0.6 + 1.2; // varia entre 0.6 e 1.8
  const scale = fov / (fov + b.z);
  const x2d = width / 2 + b.x * scale;
  const y2d = height / 2 + b.y * scale;

  ctx.save();
  ctx.translate(x2d, y2d);
  ctx.scale(scale * rotation, scale); // 👈 rotação 3D simulada
  ctx.rotate(Math.sin(b.x * 0.002 + Date.now() / 2000) * 0.2);

  // 🔸 Gradiente translúcido com reflexo dinâmico (efeito vidro)
  const grad = ctx.createLinearGradient(-b.size / 2, -b.size / 3, b.size / 2, b.size / 3);
  grad.addColorStop(0, "rgba(255,255,255,0.05)");
  grad.addColorStop(0.5, "rgba(255,255,255,0.25)");
  grad.addColorStop(1, "rgba(255,255,255,0.05)");
  ctx.fillStyle = grad;

  // Corpo do balão
  ctx.beginPath();
  ctx.roundRect(-b.size / 2, -b.size / 3, b.size, b.size / 1.5, 20);
  ctx.fill();

  // Ponta do balão
  ctx.beginPath();
  ctx.moveTo(0, b.size / 3);
  ctx.lineTo(10, b.size / 2);
  ctx.lineTo(-10, b.size / 3);
  ctx.closePath();
  ctx.fill();

  // 🔸 Reflexo animado (simula luz passando pelo vidro)
  const reflectionX = Math.sin(time + b.x * 0.004) * (b.size / 4);
  const reflectionY = Math.cos(time * 1.5 + b.y * 0.002) * (b.size / 6);
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(-b.size / 4 + reflectionX, -b.size / 5 + reflectionY, b.size / 8, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}


  requestAnimationFrame(draw);
}
    draw();