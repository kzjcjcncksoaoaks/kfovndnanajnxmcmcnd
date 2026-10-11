/* ============================================================
   PLAYER
============================================================ */
(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const audio        = $("audio");
  const cover        = $("cover");
  const coverGlow    = $("coverGlow");
  const playerEl     = $("player");

  const trackTitle   = $("trackTitle");
  const trackArtist  = $("trackArtist");
  const trackAlbum   = $("trackAlbum");

  const progressTrack = $("progressTrack");
  const progressFill  = $("progressFill");
  const timeCurrent   = $("timeCurrent");
  const timeDuration  = $("timeDuration");

  const playBtn  = $("playBtn");
  const prevBtn  = $("prevBtn");
  const nextBtn  = $("nextBtn");

  const volumeSlider = $("volumeSlider");
  const muteBtn      = $("muteBtn");
  const loopBtn      = $("loopBtn");

  const viz          = $("viz");
  const vctx         = viz.getContext("2d");

  const toast        = $("toast");
  const toastText    = $("toastText");
  const pulseLayer   = $("pulseLayer");
  const particles    = $("particles");
  const hintEl       = $("hint");

  /* ============================================================
     BOOT
  ============================================================ */
  function boot() {
    // Тексты
    document.title    = `${CONFIG.title} — ${CONFIG.artist}`;
    trackTitle.textContent  = CONFIG.title;
    trackArtist.textContent = CONFIG.artist;
    if (CONFIG.showAlbum) trackAlbum.textContent = CONFIG.album;
    else trackAlbum.style.display = "none";

    // Медиа
    audio.src = CONFIG.audio;
    cover.src = CONFIG.cover;

    // Loop
    audio.loop = !!CONFIG.loop;
    loopBtn.classList.toggle("active", !!CONFIG.loop);

    // Volume
    audio.volume = 1;
    setVolumeUI(1);

    // Визуализайзер видимость
    if (!CONFIG.visualizer) viz.style.display = "none";

    // Хинт
    hintEl.textContent = "Space — пауза · ← → — громкость · клик по полосе — перемотка";

    // Частицы
    spawnParticles();

    // Цвет из обложки
    cover.addEventListener("load", () => applyCoverColor(cover), { once: true });
    cover.addEventListener("error", () => {
      console.warn("[player] обложка не найдена:", CONFIG.cover);
    });

    // Размер канваса
    resizeViz();
    window.addEventListener("resize", resizeViz);

    // Автоплей
    if (CONFIG.autoplay) {
      audio.play().catch(()=>{});
    }
  }

  /* ============================================================
     ЦВЕТ ИЗ ОБЛОЖКИ
  ============================================================ */
  function applyCoverColor(img) {
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const cx = c.getContext("2d");
      cx.drawImage(img, 0, 0, 64, 64);
      const data = cx.getImageData(0, 0, 64, 64).data;

      let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 128) continue;
        // отбрасываем слишком тёмные/светлые пиксели — берём насыщенный средний
        const lum = 0.2126 * data[i] + 0.7152 * data[i+1] + 0.0722 * data[i+2];
        if (lum < 20 || lum > 240) continue;
        r += data[i]; g += data[i+1]; b += data[i+2]; n++;
      }
      if (!n) return;
      r = Math.round(r / n); g = Math.round(g / n); b = Math.round(b / n);

      // Слегка "подкручиваем" насыщенность
      const boost = (v) => Math.min(255, Math.round(v * 1.25));
      r = boost(r); g = boost(g); b = boost(b);

      document.documentElement.style.setProperty("--accent",  `${r} ${g} ${b}`);

      // Второй цвет — сдвиг оттенка
      const [h, s, l] = rgbToHsl(r, g, b);
      const [r2, g2, b2] = hslToRgb((h + 0.12) % 1, Math.min(1, s * 1.1), Math.min(.8, l * 1.15));
      document.documentElement.style.setProperty("--accent-2", `${r2} ${g2} ${b2}`);
    } catch (e) {
      // CORS или что-то ещё — не страшно
      console.warn("[player] не смог вытащить цвет:", e);
    }
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b);
    let h = 0, s = 0; const l = (max + min) / 2;
    const d = max - min;
    if (d) {
      s = l > .5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h, s, l];
  }
  function hslToRgb(h, s, l) {
    let r, g, b;
    if (!s) { r = g = b = l; }
    else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < .5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r*255), Math.round(g*255), Math.round(b*255)];
  }

  /* ============================================================
     PLAY / PAUSE
  ============================================================ */
  playBtn.addEventListener("click", (e) => {
    if (audio.paused) audio.play().catch(err => {
      console.warn("[player] не смог проиграть:", err);
      showToast("Не могу запустить трек. Проверь файл: " + CONFIG.audio);
    });
    else audio.pause();

    // Пульс
    const rect = playBtn.getBoundingClientRect();
    pulseAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
  });

  audio.addEventListener("play",  () => playerEl.classList.add("playing"));
  audio.addEventListener("pause", () => playerEl.classList.remove("playing"));
  audio.addEventListener("ended", () => playerEl.classList.remove("playing"));

  audio.addEventListener("error", () => {
    showToast("Аудио не найдено: " + CONFIG.audio);
  });

  /* ============================================================
     PREV / NEXT — запрещено
  ============================================================ */
  prevBtn.addEventListener("click", () => {
    if (audio.currentTime > 3) {
      // Перемотка в начало — норм, это не "перелистывание"
      audio.currentTime = 0;
      return;
    }
    showToast(CONFIG.messages.noPrev);
    shake(prevBtn);
  });
  nextBtn.addEventListener("click", () => {
    showToast(CONFIG.messages.noNext);
    shake(nextBtn);
  });

  function shake(el) {
    el.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-6px)" },
        { transform: "translateX(6px)" },
        { transform: "translateX(-3px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 380, easing: "cubic-bezier(.2,.8,.2,1)" }
    );
  }

  /* ============================================================
     PROGRESS
  ============================================================ */
  let dragging = false;

  function updateProgress() {
    if (dragging) return;
    const d = audio.duration || 0;
    const p = d ? (audio.currentTime / d) * 100 : 0;
    progressFill.style.width = p + "%";
    timeCurrent.textContent = fmt(audio.currentTime);
    progressTrack.setAttribute("aria-valuenow", Math.round(p));
  }

  audio.addEventListener("timeupdate", updateProgress);
  audio.addEventListener("loadedmetadata", () => {
    timeDuration.textContent = fmt(audio.duration);
    updateProgress();
  });

  function fmt(s) {
    if (!isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  function seekFromEvent(e) {
    const rect = progressTrack.getBoundingClientRect();
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    if (audio.duration) audio.currentTime = ratio * audio.duration;
    progressFill.style.width = (ratio * 100) + "%";
    timeCurrent.textContent = fmt(ratio * (audio.duration || 0));
  }

  progressTrack.addEventListener("mousedown", (e) => {
    dragging = true;
    progressTrack.classList.add("dragging");
    seekFromEvent(e);
  });
  progressTrack.addEventListener("touchstart", (e) => {
    dragging = true;
    progressTrack.classList.add("dragging");
    seekFromEvent(e);
  }, { passive: true });

  window.addEventListener("mousemove", (e) => { if (dragging) seekFromEvent(e); });
  window.addEventListener("touchmove",  (e) => { if (dragging) seekFromEvent(e); }, { passive: true });

  window.addEventListener("mouseup", () => {
    dragging = false;
    progressTrack.classList.remove("dragging");
  });
  window.addEventListener("touchend", () => {
    dragging = false;
    progressTrack.classList.remove("dragging");
  });

  /* ============================================================
     VOLUME
  ============================================================ */
  function setVolumeUI(v) {
    volumeSlider.value = v;
    volumeSlider.style.setProperty("--vol", (v * 100) + "%");
    updateVolIcon(v);
  }

  volumeSlider.addEventListener("input", () => {
    const v = parseFloat(volumeSlider.value);
    audio.volume = v;
    audio.muted = v === 0;
    setVolumeUI(v);
  });

  muteBtn.addEventListener("click", () => {
    audio.muted = !audio.muted;
    if (!audio.muted && audio.volume === 0) {
      audio.volume = 1;
      setVolumeUI(1);
    }
    setVolumeUI(audio.muted ? 0 : audio.volume);
    showToast(audio.muted ? CONFIG.messages.muted : CONFIG.messages.unmuted);
  });

  function updateVolIcon(v) {
    const icon = $("volIcon");
    let d;
    if (audio.muted || v === 0) {
      d = "M3 9v6h4l5 5V4L7 9H3zm13.6 3 2.7-2.7-1.4-1.4L15.2 10.6 12.5 7.9 11.1 9.3l2.7 2.7-2.7 2.7 1.4 1.4 2.7-2.7 2.7 2.7 1.4-1.4z";
    } else if (v < 0.5) {
      d = "M3 9v6h4l5 5V4L7 9H3zm11.5 3c0-1.2-.6-2.2-1.5-2.8v5.6c.9-.6 1.5-1.6 1.5-2.8z";
    } else {
      d = "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.8-1-3.3-2.5-4v8c1.5-.7 2.5-2.2 2.5-4zM14 3.2v2.1c2.9.9 5 3.6 5 6.7s-2.1 5.8-5 6.7v2.1c4-1 7-4.6 7-8.8s-3-7.8-7-8.8z";
    }
    icon.innerHTML = `<path d="${d}"/>`;
  }

  /* ============================================================
     LOOP
  ============================================================ */
  loopBtn.addEventListener("click", () => {
    audio.loop = !audio.loop;
    loopBtn.classList.toggle("active", audio.loop);
    showToast(audio.loop ? CONFIG.messages.loopOn : CONFIG.messages.loopOff);
  });

  /* ============================================================
     RIPPLE
  ============================================================ */
  document.querySelectorAll(".ripple").forEach((btn) => {
    btn.addEventListener("pointerdown", (e) => {
      const rect = btn.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.4;
      const rip = document.createElement("span");
      rip.className = "rip";
      rip.style.width = rip.style.height = size + "px";
      rip.style.left = (e.clientX - rect.left) + "px";
      rip.style.top  = (e.clientY - rect.top)  + "px";
      btn.appendChild(rip);
      setTimeout(() => rip.remove(), 650);
    });
  });

  /* ============================================================
     PULSE (вокруг play-кнопки)
  ============================================================ */
  function pulseAt(x, y) {
    const size = 160;
    const span = document.createElement("span");
    span.style.width = span.style.height = size + "px";
    span.style.left = x + "px";
    span.style.top  = y + "px";
    pulseLayer.appendChild(span);
    setTimeout(() => span.remove(), 1200);
  }

  /* ============================================================
     TOAST
  ============================================================ */
  let toastTimer;
  function showToast(msg) {
    toastText.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  /* ============================================================
     ЧАСТИЦЫ
  ============================================================ */
  function spawnParticles() {
    const N = 24;
    for (let i = 0; i < N; i++) {
      const p = document.createElement("i");
      p.style.left = Math.random() * 100 + "%";
      p.style.bottom = "-10px";
      const dur = 12 + Math.random() * 16;
      p.style.animationDuration = dur + "s";
      p.style.animationDelay = (-Math.random() * dur) + "s";
      const s = 1 + Math.random() * 3;
      p.style.width = p.style.height = s + "px";
      p.style.opacity = 0.2 + Math.random() * 0.5;
      particles.appendChild(p);
    }
  }

  /* ============================================================
     ВИЗУАЛИЗАЙЗЕР
  ============================================================ */
  let analyser = null, dataArr = null, ac = null;

  function initAudioGraph() {
    if (ac || !CONFIG.visualizer) return;
    try {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const src = ac.createMediaElementSource(audio);
      analyser = ac.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;
      dataArr = new Uint8Array(analyser.frequencyBinCount);
      src.connect(analyser);
      analyser.connect(ac.destination);
    } catch (e) {
      console.warn("[player] аудиограф не собрался:", e);
    }
  }

  audio.addEventListener("play", () => {
    initAudioGraph();
    if (ac && ac.state === "suspended") ac.resume();
  });

  function resizeViz() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = viz.getBoundingClientRect();
    viz.width  = Math.max(1, Math.floor(rect.width  * dpr));
    viz.height = Math.max(1, Math.floor(rect.height * dpr));
    vctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const BARS = 48;

  function drawViz() {
    requestAnimationFrame(drawViz);
    const w = viz.clientWidth;
    const h = viz.clientHeight;
    vctx.clearRect(0, 0, w, h);

    const accent   = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim();
    const accent2  = getComputedStyle(document.documentElement).getPropertyValue("--accent-2").trim();

    const grad = vctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0,   `rgb(${accent})`);
    grad.addColorStop(1,   `rgb(${accent2})`);

    const barW = w / BARS;
    const gap  = Math.max(1, barW * 0.25);

    // если нет аналитика — рисуем "сонный" синус
    const t = performance.now() / 1000;
    const idle = !analyser;

    if (!idle) analyser.getByteFrequencyData(dataArr);

    for (let i = 0; i < BARS; i++) {
      let v;
      if (idle) {
        v = (Math.sin(t * 1.4 + i * 0.4) * 0.5 + 0.5) * 0.25;
      } else {
        const idx = Math.floor(i * (dataArr.length / BARS) * 0.7);
        v = dataArr[idx] / 255;
      }
      const bh = Math.max(2, v * h);
      const x = i * barW + gap / 2;
      const y = (h - bh) / 2;

      vctx.fillStyle = grad;
      vctx.globalAlpha = 0.35 + v * 0.65;

      roundRect(vctx, x, y, barW - gap, bh, (barW - gap) / 2);
      vctx.fill();
    }
    vctx.globalAlpha = 1;
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  requestAnimationFrame(drawViz);

  /* ============================================================
     КЛАВИАТУРА
  ============================================================ */
  window.addEventListener("keydown", (e) => {
    // Не мешаем, если фокус в поле ввода
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;

    if (e.code === "Space") {
      e.preventDefault();
      playBtn.click();
    } else if (e.key === "ArrowRight") {
      audio.volume = Math.min(1, audio.volume + 0.05);
      audio.muted = false;
      setVolumeUI(audio.volume);
    } else if (e.key === "ArrowLeft") {
      audio.volume = Math.max(0, audio.volume - 0.05);
      setVolumeUI(audio.volume);
    } else if (e.key === "m" || e.key === "M" || e.key === "ь") {
      muteBtn.click();
    }
  });

  /* ============================================================
     МЕЛОЧЬ — лёгкий параллакс по курсору
  ============================================================ */
  const frame = document.getElementById("coverFrame");
  if (window.matchMedia("(hover: hover)").matches) {
    playerEl.addEventListener("mousemove", (e) => {
      const r = playerEl.getBoundingClientRect();
      const cx = (e.clientX - r.left) / r.width  - 0.5;
      const cy = (e.clientY - r.top ) / r.height - 0.5;
      frame.style.transform = `rotate(-1.2deg) scale(1.02) translate(${cx * 8}px, ${cy * 8}px) rotateX(${-cy * 6}deg) rotateY(${cx * 6}deg)`;
    });
    playerEl.addEventListener("mouseleave", () => {
      frame.style.transform = "rotate(-1.2deg)";
    });
  }

  /* ============================================================
     GO
  ============================================================ */
  boot();
})();