/**
 * Ultra-Smooth Scroll-Based Frame Animation Engine
 * Portfolio: Harsh Chahal
 *
 * Performance Strategy: Single ZIP fetch → JSZip in-memory extraction → Blob URL canvas rendering
 * - 1 HTTP request instead of 192 separate image requests
 * - Progressive frame reveal: renders as frames are decoded
 * - LERP inertial smoothing for butter-smooth Apple-style scrolling
 * - High-DPI / Retina canvas cover-fit
 */

(() => {
  const TOTAL_FRAMES = 192;
  const LERP_FACTOR = 0.08;
  const ZIP_URL = 'video_frames_30fps.zip';

  // DOM Elements
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const loader = document.getElementById('loader');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const frameCounter = document.getElementById('frame-counter');
  const scrollIndicator = document.getElementById('scroll-indicator');
  const typedEl = document.getElementById('typed');
  const cur = document.getElementById('cur');
  const cur2 = document.getElementById('cur2');

  // Animation State
  const images = new Array(TOTAL_FRAMES).fill(null);
  let loadedCount = 0;
  let targetProgress = 0;
  let currentProgress = 0;
  let lastRenderedIndex = -1;
  let isCanvasDirty = true;
  let dpr = 1;
  let animStarted = false;

  // ==========================================
  // 1. Custom Magnetic Cursor
  // ==========================================
  if (cur && cur2) {
    let cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    let tx = cx, ty = cy;
    window.addEventListener('mousemove', (e) => {
      tx = e.clientX; ty = e.clientY;
      cur.style.left = `${tx}px`;
      cur.style.top = `${ty}px`;
    });
    function trailCursor() {
      cx += (tx - cx) * 0.12;
      cy += (ty - cy) * 0.12;
      cur2.style.left = `${cx}px`;
      cur2.style.top = `${cy}px`;
      requestAnimationFrame(trailCursor);
    }
    trailCursor();
  }

  // ==========================================
  // 2. Typewriter Effect
  // ==========================================
  if (typedEl) {
    const words = ['SOFTWARE', 'FULL-STACK', 'ALGORITHM', 'SYSTEMS', 'C++ / JAVA'];
    let wi = 0, ci = 0, deleting = false;
    function tick() {
      const w = words[wi];
      if (!deleting) {
        ci++;
        typedEl.textContent = w.slice(0, ci);
        if (ci === w.length) { deleting = true; setTimeout(tick, 1400); return; }
      } else {
        ci--;
        typedEl.textContent = w.slice(0, ci);
        if (ci === 0) { deleting = false; wi = (wi + 1) % words.length; }
      }
      setTimeout(tick, deleting ? 50 : 100);
    }
    tick();
  }

  // ==========================================
  // 3. Canvas Resize (HiDPI)
  // ==========================================
  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      isCanvasDirty = true;
    }
  }

  // ==========================================
  // 4. Cover-fit Draw
  // ==========================================
  function drawFrame(index) {
    const img = getBestFrame(index);
    if (!img) return;
    const cW = canvas.width, cH = canvas.height;
    const iW = img.naturalWidth || 1920, iH = img.naturalHeight || 1080;
    const ratio = Math.max(cW / iW, cH / iH);
    const dW = iW * ratio, dH = iH * ratio;
    const ox = (cW - dW) / 2, oy = (cH - dH) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, iW, iH, ox, oy, dW, dH);
  }

  // ==========================================
  // 5. Nearest Loaded Frame Fallback
  // ==========================================
  function getBestFrame(index) {
    if (images[index]?.complete && images[index].naturalWidth) return images[index];
    for (let o = 1; o < TOTAL_FRAMES; o++) {
      const p = index - o;
      if (p >= 0 && images[p]?.complete && images[p].naturalWidth) return images[p];
      const n = index + o;
      if (n < TOTAL_FRAMES && images[n]?.complete && images[n].naturalWidth) return images[n];
    }
    return null;
  }

  // ==========================================
  // 6. Scroll Progress
  // ==========================================
  function calcProgress() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    return scrollable <= 0 ? 0 : Math.max(0, Math.min(1, window.scrollY / scrollable));
  }

  // ==========================================
  // 7. LERP Animation Loop
  // ==========================================
  function animationLoop() {
    targetProgress = calcProgress();
    const delta = targetProgress - currentProgress;
    currentProgress += Math.abs(delta) < 0.00005 ? (targetProgress - currentProgress) : delta * LERP_FACTOR;

    const frameIndex = Math.min(TOTAL_FRAMES - 1, Math.max(0, Math.round(currentProgress * (TOTAL_FRAMES - 1))));

    if (frameIndex !== lastRenderedIndex || isCanvasDirty) {
      drawFrame(frameIndex);
      lastRenderedIndex = frameIndex;
      isCanvasDirty = false;
    }

    if (scrollIndicator) {
      scrollIndicator.classList.toggle('scrolled', window.scrollY > 40);
    }

    requestAnimationFrame(animationLoop);
  }

  // ==========================================
  // 8. ZIP Loader — Single request, all frames
  // ==========================================
  async function loadFromZip() {
    // Dynamically load JSZip from CDN
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });

    // Fetch zip with progress tracking
    const response = await fetch(ZIP_URL);
    const contentLength = response.headers.get('Content-Length');
    const total = contentLength ? parseInt(contentLength) : null;
    let received = 0;

    const reader = response.body.getReader();
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (total && progressBar) {
        const pct = Math.round((received / total) * 60); // first 60% = download
        progressBar.style.width = `${pct}%`;
        if (progressText) progressText.textContent = `Downloading ${pct}%`;
        if (frameCounter) frameCounter.textContent = `${(received / 1048576).toFixed(1)} MB`;
      }
    }

    // Combine chunks into ArrayBuffer
    const blob = new Blob(chunks);
    const arrayBuffer = await blob.arrayBuffer();

    if (progressBar) progressBar.style.width = '65%';
    if (progressText) progressText.textContent = 'Extracting frames…';

    // Load zip
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Sort files to maintain frame order
    const frameFiles = Object.keys(zip.files)
      .filter(name => name.match(/frame_\d+\.jpg$/i))
      .sort();

    const frameTotal = frameFiles.length;

    // Extract all frames and create Image objects with Blob URLs
    let extractedCount = 0;

    const extractPromises = frameFiles.map(async (name, i) => {
      const fileData = await zip.files[name].async('blob');
      const url = URL.createObjectURL(fileData);
      const img = new Image();
      img.src = url;
      await new Promise((res) => {
        img.onload = res;
        img.onerror = res;
      });
      images[i] = img;
      extractedCount++;
      loadedCount++;

      const pct = 65 + Math.round((extractedCount / frameTotal) * 35);
      if (progressBar) progressBar.style.width = `${pct}%`;
      if (progressText) progressText.textContent = `Loading ${pct}%`;
      if (frameCounter) frameCounter.textContent = `${extractedCount} / ${frameTotal} frames`;

      // Start animation as soon as first frame is ready
      if (extractedCount === 1 && !animStarted) {
        animStarted = true;
        resizeCanvas();
        requestAnimationFrame(animationLoop);
      }
    });

    // Wait for all frames to be ready
    await Promise.all(extractPromises);
  }

  // ==========================================
  // 9. Init
  // ==========================================
  async function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    try {
      await loadFromZip();
    } catch (err) {
      console.error('ZIP load failed:', err);
      // Fallback: try loading frames individually
      if (progressText) progressText.textContent = 'Loading frames…';
      let fallbackLoaded = 0;
      const promises = Array.from({ length: TOTAL_FRAMES }, (_, i) => {
        const img = new Image();
        img.src = `video_frames_30fps/frame_${String(i).padStart(6, '0')}.jpg`;
        return new Promise(res => {
          img.onload = img.onerror = () => {
            images[i] = img;
            fallbackLoaded++;
            if (progressBar) progressBar.style.width = `${Math.round((fallbackLoaded / TOTAL_FRAMES) * 100)}%`;
            res();
          };
        });
      });
      await Promise.all(promises);
    }

    // All frames loaded — hide loader
    setTimeout(() => {
      if (loader) loader.classList.add('hidden');
    }, 200);

    // Start loop if not already started
    if (!animStarted) {
      animStarted = true;
      requestAnimationFrame(animationLoop);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
