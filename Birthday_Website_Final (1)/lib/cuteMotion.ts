/**
 * Cute motion overlay — a lightweight canvas particle engine.
 *
 * - Pure canvas, no dependencies, never intercepts pointer events.
 * - Stays invisible on the first screen (the black "counting the years" reveal)
 *   so that moment is not spoiled, then fades in as soon as she scrolls on.
 * - Ambient floating hearts / sparkles / petals + occasional balloons.
 * - Sparkle trail that follows the finger / cursor.
 * - Tap / click: heart + confetti burst with a cute floating phrase.
 * - Every new section gets its own little celebration (cannons, heart rain,
 *   sparkle shower, balloons) with a pop-up message.
 * - Respects "reduce motion" and pauses when the tab is hidden.
 */

type Kind = "heart" | "spark" | "confetti" | "balloon" | "text" | "ring";

interface Particle {
  k: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number; // gravity (px/s^2)
  drag: number; // per-frame (60fps) velocity multiplier
  life: number; // seconds lived
  max: number; // lifespan in seconds
  size: number;
  rot: number;
  vr: number;
  col: string;
  col2: string;
  a: number; // base alpha
  sway: number;
  ph: number;
  shape: number;
  txt: string;
}

const PALETTE = ["#ff8fb1", "#ffb3c7", "#ff6f9f", "#ffd1dc", "#c9a7ff", "#ffd27a", "#9fe3ff", "#ffffff"];
const HEARTS = ["#ff5c8a", "#ff8fb1", "#ffb3c7", "#ff7eb6", "#ff9ec4", "#e75a9a"];
const BALLOONS = ["#ff8fb1", "#c9a7ff", "#ffd27a", "#9fe3ff", "#ffb3c7", "#a8e6cf"];

const TAP_PHRASES = [
  "LOVEE YOUUU TWINNNN \u{1F497}",
  "nenuu ka birthdayy \u{1F382}",
  "happy birthday twinnn \u{1F389}",
  "my favourite human \u{1F979}",
  "bestie forever \u{1FAF6}",
  "you're the best twin ✨",
  "cutieeee \u{1F9F8}",
  "mwahhh \u{1F49E}",
];

const SECTION_BANNERS = [
  "", // 0: reveal screen
  "",
  "",
  "",
  "",
];

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

function make(partial: Partial<Particle> & { k: Kind; x: number; y: number }): Particle {
  return {
    vx: 0,
    vy: 0,
    g: 0,
    drag: 1,
    life: 0,
    max: 2,
    size: 14,
    rot: 0,
    vr: 0,
    col: "#ff8fb1",
    col2: "#ffffff",
    a: 1,
    sway: 0,
    ph: Math.random() * 6.28,
    shape: 0,
    txt: "",
    ...partial,
  };
}

export function startCuteMotion(canvas: HTMLCanvasElement): () => void {
  const reduce =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return () => {};

  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  let W = 0;
  let H = 0;
  let dpr = 1;
  let parts: Particle[] = [];
  let raf = 0;
  let last = performance.now();
  let clock = 0;
  let section = 0;
  let announced = -1;
  let phraseIx = 0;
  let nextBalloon = 6;
  const jobs: { until: number; every: number; acc: number; fn: () => void }[] = [];

  /* ---------- sizing ---------- */
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);

  canvas.style.opacity = "0";
  canvas.style.transition = "opacity 0.8s ease";

  /* ---------- spawners ---------- */
  const add = (p: Particle) => {
    if (parts.length < 520) parts.push(p);
  };

  const floater = (fromBottom: boolean) => {
    const r = Math.random();
    const x = rand(-10, W + 10);
    const y = fromBottom ? H + rand(10, 60) : rand(0, H);
    if (r < 0.55) {
      add(make({ k: "heart", x, y, vy: -rand(26, 62), sway: rand(0.8, 1.8), size: rand(9, 22), rot: rand(-0.4, 0.4),
        vr: rand(-0.25, 0.25), col: pick(HEARTS), a: rand(0.28, 0.6), max: rand(9, 15), life: fromBottom ? 0 : rand(0, 4) }));
    } else if (r < 0.85) {
      add(make({ k: "spark", x, y, vy: -rand(8, 26), sway: rand(0.5, 1.4), size: rand(4, 10), col: pick(PALETTE),
        a: rand(0.4, 0.9), max: rand(5, 9), ph: rand(0, 6.28), life: fromBottom ? 0 : rand(0, 3) }));
    } else {
      add(make({ k: "confetti", x, y, vy: -rand(14, 34), sway: rand(0.6, 1.4), size: rand(5, 9), col: pick(PALETTE),
        a: rand(0.35, 0.65), max: rand(9, 14), shape: Math.random() < 0.5 ? 1 : 0, rot: rand(0, 6.28),
        vr: rand(-1.5, 1.5), life: fromBottom ? 0 : rand(0, 4) }));
    }
  };

  const pop = (x: number, y: number) => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * 6.283 + rand(-0.2, 0.2);
      const s = rand(130, 270);
      add(make({ k: "heart", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, g: 260, drag: 0.975,
        size: rand(8, 17), rot: rand(-0.6, 0.6), vr: rand(-2, 2), col: pick(HEARTS), a: 0.95, max: rand(1.0, 1.5) }));
    }
    for (let i = 0; i < 18; i++) {
      const a = rand(0, 6.283);
      const s = rand(90, 330);
      add(make({ k: "confetti", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 90, g: 520, drag: 0.972,
        size: rand(5, 9), rot: rand(0, 6.28), vr: rand(-9, 9), col: pick(PALETTE), a: 1, max: rand(1.1, 1.8),
        shape: Math.floor(rand(0, 3)) }));
    }
    for (let i = 0; i < 7; i++) {
      add(make({ k: "spark", x: x + rand(-18, 18), y: y + rand(-18, 18), vy: -rand(10, 40), size: rand(6, 12),
        col: pick(PALETTE), a: 1, max: rand(0.7, 1.2) }));
    }
    add(make({ k: "ring", x, y, size: 8, col: "#ff8fb1", a: 0.8, max: 0.6 }));
  };

  const fit = (txt: string, size: number, maxW: number) => {
    ctx.font = `800 ${size}px "Trebuchet MS", ui-rounded, "Segoe UI", system-ui, sans-serif`;
    const w = ctx.measureText(txt).width + size * 0.5;
    return w > maxW ? Math.max(12, Math.floor((size * maxW) / w)) : size;
  };

  const phrase = (x: number, y: number, txt: string, size: number, max = 1.9) => {
    add(make({ k: "text", x, y, vy: -34, size: fit(txt, size, W * 0.88), txt, rot: rand(-0.1, 0.1),
      col: "#ff4f87", col2: "#ffffff", a: 1, max }));
  };

  const cannon = (x: number, y: number, angleDeg: number, n = 60) => {
    for (let i = 0; i < n; i++) {
      const a = ((angleDeg + rand(-16, 16)) * Math.PI) / 180;
      const s = rand(480, 960);
      add(make({ k: "confetti", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 640, drag: 0.968,
        size: rand(6, 11), rot: rand(0, 6.28), vr: rand(-10, 10), col: pick(PALETTE), a: 1,
        max: rand(2.2, 3.6), shape: Math.floor(rand(0, 3)) }));
    }
    for (let i = 0; i < 8; i++) {
      const a = ((angleDeg + rand(-18, 18)) * Math.PI) / 180;
      const s = rand(380, 720);
      add(make({ k: "heart", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 520, drag: 0.968,
        size: rand(11, 18), rot: rand(-0.5, 0.5), vr: rand(-2, 2), col: pick(HEARTS), a: 1, max: rand(2.0, 3.0) }));
    }
  };

  const job = (seconds: number, perSecond: number, fn: () => void) => {
    jobs.push({ until: clock + seconds, every: 1 / perSecond, acc: 0, fn });
  };

  const balloon = (x?: number) => {
    add(make({ k: "balloon", x: x ?? rand(40, W - 40), y: H + 90, vy: -rand(48, 80), sway: rand(0.7, 1.2),
      size: rand(24, 36), col: pick(BALLOONS), a: 0.95, max: (H + 220) / 55 + 3, ph: rand(0, 6.28) }));
  };

  const celebrate = (idx: number) => {
    const banner = SECTION_BANNERS[Math.min(idx, SECTION_BANNERS.length - 1)];
    switch (idx) {
      case 1:
        cannon(0, H, -55);
        cannon(W, H, -125);
        setTimeout(() => {
          cannon(W * 0.25, H, -75, 40);
          cannon(W * 0.75, H, -105, 40);
        }, 350);
        break;
      case 2:
        job(2.6, 26, () => add(make({ k: "heart", x: rand(0, W), y: -20, vx: rand(-20, 20), vy: rand(90, 190),
          sway: rand(1, 2), size: rand(10, 22), col: pick(HEARTS), a: 0.9, rot: rand(-0.4, 0.4), vr: rand(-1, 1),
          max: (H + 60) / 120 + 2 })));
        break;
      case 3:
        job(2.8, 44, () => add(make({ k: "spark", x: rand(0, W), y: rand(0, H), size: rand(7, 15), col: pick(PALETTE),
          a: 1, max: rand(0.8, 1.6), vy: -rand(0, 20) })));
        for (let i = 0; i < 6; i++) setTimeout(() => balloon(), i * 260);
        break;
      default:
        cannon(0, H * 0.9, -45, 46);
        cannon(W, H * 0.9, -135, 46);
        job(2.4, 22, () => add(make({ k: "confetti", x: rand(0, W), y: -14, vx: rand(-30, 30), vy: rand(110, 220),
          sway: rand(1, 2), size: rand(6, 10), col: pick(PALETTE), a: 1, rot: rand(0, 6.28), vr: rand(-6, 6),
          shape: Math.floor(rand(0, 3)), max: (H + 40) / 140 + 2 })));
    }
    if (banner) {
      parts = parts.filter((p) => p.k !== "text");
      phrase(W / 2, H * 0.42, banner, clamp(W * 0.075, 26, 54), 2.6);
    }
  };

  /* ---------- section tracking (scroll-snap container) ---------- */
  const findScroller = (): HTMLElement | null => document.querySelector<HTMLElement>(".snap-y");
  const readSection = (el: HTMLElement | null) => {
    if (!el || el.clientHeight < 100) return 0;
    return Math.max(0, Math.round(el.scrollTop / el.clientHeight));
  };
  let settleTimer: number | undefined;
  const onScroll = (e: Event) => {
    const t = e.target as HTMLElement | Document;
    const sc = findScroller();
    if (!sc || t !== sc) return;
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => setSection(readSection(sc)), 140);
  };
  const setSection = (idx: number) => {
    if (idx === section) return;
    const prev = section;
    section = idx;
    const wasReveal = prev === 0;
    canvas.style.opacity = idx > 0 ? "1" : "0";
    if (idx > 0 && wasReveal) {
      const seed = Math.round(clamp((W * H) / 52000, 12, 34) * 0.85);
      for (let i = 0; i < seed; i++) floater(false);
    }
    if (idx > 0 && idx !== announced) {
      announced = idx;
      celebrate(idx);
    }
    if (idx === 0) {
      window.setTimeout(() => {
        if (section === 0) parts = [];
      }, 900);
    }
  };
  document.addEventListener("scroll", onScroll, true);
  // already scrolled when the engine starts (e.g. refresh mid-page)
  window.setTimeout(() => {
    const idx = readSection(findScroller());
    if (idx > 0) {
      section = idx;
      announced = idx;
      canvas.style.opacity = "1";
      for (let i = 0; i < 22; i++) floater(false);
    }
  }, 400);

  /* ---------- pointer: sparkle trail + tap bursts ---------- */
  let lx = -999;
  let ly = -999;
  const onMove = (e: PointerEvent) => {
    if (section === 0) return;
    const d = Math.hypot(e.clientX - lx, e.clientY - ly);
    if (d < 15) return;
    lx = e.clientX;
    ly = e.clientY;
    if (parts.length > 440) return;
    if (Math.random() < 0.16) {
      add(make({ k: "heart", x: lx + rand(-6, 6), y: ly + rand(-6, 6), vx: rand(-14, 14), vy: -rand(26, 60),
        size: rand(6, 11), col: pick(HEARTS), a: 0.9, max: rand(0.8, 1.3), rot: rand(-0.4, 0.4) }));
    } else {
      add(make({ k: "spark", x: lx + rand(-5, 5), y: ly + rand(-5, 5), vx: rand(-14, 14), vy: rand(-26, 14),
        size: rand(5, 11), col: pick(PALETTE), a: 1, max: rand(0.55, 0.95) }));
    }
  };
  const onDown = (e: PointerEvent) => {
    if (section === 0) return;
    pop(e.clientX, e.clientY);
    phraseIx = (phraseIx + 1 + Math.floor(Math.random() * 2)) % TAP_PHRASES.length;
    phrase(clamp(e.clientX, 110, W - 110), Math.max(60, e.clientY - 34), TAP_PHRASES[phraseIx], clamp(W * 0.05, 18, 28), 1.6);
  };
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown, { passive: true });

  /* ---------- drawing ---------- */
  const heartPath = (s: number) => {
    ctx.beginPath();
    ctx.moveTo(0, s * 0.38);
    ctx.bezierCurveTo(-s * 1.0, -s * 0.2, -s * 0.5, -s * 0.98, 0, -s * 0.38);
    ctx.bezierCurveTo(s * 0.5, -s * 0.98, s * 1.0, -s * 0.2, 0, s * 0.38);
    ctx.closePath();
  };
  const starPath = (r: number) => {
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(0, 0, r, 0);
    ctx.quadraticCurveTo(0, 0, 0, r);
    ctx.quadraticCurveTo(0, 0, -r, 0);
    ctx.quadraticCurveTo(0, 0, 0, -r);
    ctx.closePath();
  };

  const draw = (p: Particle) => {
    const t = p.life / p.max;
    const fadeIn = clamp(p.life / 0.25, 0, 1);
    const fadeOut = clamp((p.max - p.life) / (p.k === "text" ? 0.5 : 0.7), 0, 1);
    const alpha = p.a * Math.min(fadeIn, fadeOut);
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = alpha;

    switch (p.k) {
      case "heart": {
        const beat = 1 + Math.sin(clock * 5 + p.ph) * 0.06;
        ctx.rotate(p.rot);
        ctx.scale(beat, beat);
        heartPath(p.size);
        ctx.fillStyle = p.col;
        ctx.fill();
        ctx.globalAlpha = alpha * 0.55;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.ellipse(-p.size * 0.36, -p.size * 0.42, p.size * 0.17, p.size * 0.1, -0.6, 0, 6.283);
        ctx.fill();
        break;
      }
      case "spark": {
        const tw = 0.65 + 0.35 * Math.sin(clock * 9 + p.ph);
        const r = p.size * tw * (0.6 + 0.4 * Math.sin(t * Math.PI));
        ctx.rotate(0.4 * Math.sin(clock + p.ph));
        ctx.globalAlpha = alpha * 0.25;
        ctx.fillStyle = p.col;
        starPath(r * 2.1);
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#fff";
        starPath(r * 1.05);
        ctx.fill();
        ctx.fillStyle = p.col;
        ctx.globalAlpha = alpha * 0.55;
        starPath(r * 1.45);
        ctx.fill();
        break;
      }
      case "confetti": {
        ctx.rotate(p.rot);
        const flip = Math.cos(clock * 6 + p.ph);
        ctx.scale(1, 0.25 + Math.abs(flip) * 0.75);
        ctx.fillStyle = p.col;
        if (p.shape === 0) ctx.fillRect(-p.size * 0.6, -p.size * 0.3, p.size * 1.2, p.size * 0.6);
        else if (p.shape === 1) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size * 0.42, 0, 6.283);
          ctx.fill();
        } else {
          heartPath(p.size * 0.55);
          ctx.fill();
        }
        break;
      }
      case "balloon": {
        const s = p.size;
        const wob = Math.sin(clock * 1.6 + p.ph) * 0.07;
        ctx.rotate(wob);
        // string
        ctx.strokeStyle = "rgba(255,255,255,0.75)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, s * 1.08);
        for (let i = 1; i <= 6; i++) ctx.lineTo(Math.sin(clock * 3 + i + p.ph) * 4, s * 1.08 + i * 9);
        ctx.stroke();
        // body
        const g = ctx.createRadialGradient(-s * 0.3, -s * 0.4, s * 0.1, 0, 0, s * 1.1);
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.25, p.col);
        g.addColorStop(1, p.col);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.78, s, 0, 0, 6.283);
        ctx.fill();
        ctx.fillStyle = p.col;
        ctx.beginPath();
        ctx.moveTo(0, s * 0.98);
        ctx.lineTo(-s * 0.13, s * 1.14);
        ctx.lineTo(s * 0.13, s * 1.14);
        ctx.closePath();
        ctx.fill();
        break;
      }
      case "ring": {
        const r = p.size + t * 62;
        ctx.strokeStyle = p.col;
        ctx.lineWidth = 3 * (1 - t) + 0.5;
        ctx.globalAlpha = alpha * (1 - t);
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, 6.283);
        ctx.stroke();
        break;
      }
      case "text": {
        const k = easeOutBack(clamp(p.life / 0.45, 0, 1));
        ctx.rotate(p.rot);
        ctx.scale(k, k);
        ctx.font = `800 ${p.size}px "Trebuchet MS", ui-rounded, "Segoe UI", system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.lineJoin = "round";
        ctx.lineWidth = Math.max(4, p.size * 0.22);
        ctx.strokeStyle = "#ffffff";
        ctx.strokeText(p.txt, 0, 0);
        ctx.fillStyle = p.col;
        ctx.fillText(p.txt, 0, 0);
        break;
      }
    }
    ctx.restore();
  };

  /* ---------- main loop ---------- */
  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (document.hidden) return;
    clock += dt;

    // timed spawners
    for (let i = jobs.length - 1; i >= 0; i--) {
      const j = jobs[i];
      j.acc += dt;
      while (j.acc >= j.every) {
        j.acc -= j.every;
        j.fn();
      }
      if (clock > j.until) jobs.splice(i, 1);
    }

    if (section > 0) {
      // ambient floaters
      const target = clamp((W * H) / 52000, 12, 34);
      const ambient = parts.reduce((n, p) => n + (p.vy < 0 && p.g === 0 && p.k !== "text" && p.k !== "balloon" ? 1 : 0), 0);
      if (ambient < target && Math.random() < dt * 9) floater(true);
      nextBalloon -= dt;
      if (nextBalloon <= 0) {
        balloon();
        nextBalloon = rand(9, 16);
      }
    }

    ctx.clearRect(0, 0, W, H);
    const dragFrames = dt * 60;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life += dt;
      if (p.life >= p.max || p.y < -140 || p.y > H + 220 || p.x < -160 || p.x > W + 160) {
        parts.splice(i, 1);
        continue;
      }
      if (p.k !== "ring" && p.k !== "text") {
        p.vy += p.g * dt;
        const d = Math.pow(p.drag, dragFrames);
        p.vx *= d;
        p.vy *= p.g > 0 ? d : 1;
        const swayX = p.sway ? Math.sin(clock * p.sway + p.ph) * (p.k === "balloon" ? 26 : 20) : 0;
        p.x += (p.vx + swayX) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
      } else if (p.k === "text") {
        p.y += p.vy * dt;
        p.vy *= Math.pow(0.97, dragFrames);
      }
      draw(p);
    }
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(settleTimer);
    window.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerdown", onDown);
    document.removeEventListener("scroll", onScroll, true);
  };
}
