// matrix.js — makes the 1s and 0s rain down in the background, like The Matrix.
// How it works: the screen is split into skinny columns. Each column has a "raindrop"
// that falls one step at a time, drawing a 1 or a 0 as it goes. Every frame we paint
// a see-through black layer over everything, so old numbers slowly fade away.
(function () {
  const canvas = document.getElementById("matrix");
  const ctx = canvas.getContext("2d");
  const fontSize = 18;
  let columns = 0;
  let drops = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    columns = Math.floor(canvas.width / fontSize);
    // Start each raindrop at a random height so they don't all fall together.
    const rows = Math.floor(canvas.height / fontSize);
    drops = Array.from({ length: columns }, () => Math.floor(Math.random() * rows));
  }

  function draw() {
    // The fade: a see-through black layer over the old numbers.
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = fontSize + "px 'Share Tech Mono', monospace";

    for (let i = 0; i < columns; i++) {
      const digit = Math.random() < 0.5 ? "0" : "1";
      const x = i * fontSize;
      const y = drops[i] * fontSize;

      // The front of each raindrop is bright white-green, the rest is green.
      ctx.fillStyle = Math.random() < 0.1 ? "#d4ffe0" : "#00ff41";
      ctx.fillText(digit, x, y);

      // When a drop falls off the bottom, sometimes start it again at the top.
      if (y > canvas.height && Math.random() > 0.95) drops[i] = 0;
      drops[i]++;
    }
  }

  resize();
  window.addEventListener("resize", resize);

  // People who turn on "reduce motion" get one still frame instead of animation.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    for (let n = 0; n < 60; n++) draw();
  } else {
    setInterval(draw, 50); // 20 frames every second
  }
})();
