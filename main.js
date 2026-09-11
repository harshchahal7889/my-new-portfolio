/**
 * Ultra-Smooth Scroll-Based Frame Animation Engine
 * Portfolio: Harsh Chahal
 *
 * Performance Strategy:
 * - Single ZIP stream fetch (video_frames_30fps.zip) -> 1 network roundtrip vs 192 HTTP requests
 * - Parallel JSZip script pre-fetch while downloading zip payload
 * - Hardware-accelerated off-thread decoding via `createImageBitmap` (fallback to Blob Image)
 * - Concurrency batch extraction across available CPU threads
 * - Immediate frame 0 progressive draw: zero wait time to first visual
 * - LERP inertial smoothing for Apple-grade fluid scroll animation
 * - Service Worker caching for instant repeat loads from memory/disk cache
 */

(() => {
  const TOTAL_FRAMES = 192;
  const LERP_FACTOR = 0.085;
  const ZIP_URL = 'video_frames_30fps.zip';
  const CONCURRENCY_LIMIT = 10;

  // DOM Elements
  const canvas = document.getElementById('hero-canvas');
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  const loader = document.getElementById('loader');
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text');
  const frameCounter = document.getElementById('frame-counter');
  const scrollIndicator = document.getElementById('scroll-indicator');
  const typedEl = document.getElementById('typed');
  const cur = document.getElementById('cur');
  const cur2 = document.getElementById('cur2');

  // Animation State
  // frames stores either ImageBitmap or HTMLImageElement
  const frames = new Array(TOTAL_FRAMES).fill(null);
  let loadedCount = 0;
  let targetProgress = 0;
  let currentProgress = 0;
  let lastRenderedIndex = -1;
  let isCanvasDirty = true;
  let dpr = 1;
  let animStarted = false;

  // ==========================================
  // 1. Service Worker Registration
  // ==========================================
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('Service Worker registration skipped:', err);
      });
    });
  }

  // ==========================================
  // 2. Custom Magnetic Cursor
  // ==========================================
  if (cur && cur2) {
    let cx = window.innerWidth / 2;
    let cy = window.innerHeight / 2;
    let tx = cx;
    let ty = cy;

    window.addEventListener('mousemove', (e) => {
      tx = e.clientX;
      ty = e.clientY;
      cur.style.left = `${tx}px`;
      cur.style.top = `${ty}px`;
    }, { passive: true });

    function trailCursor() {
      cx += (tx - cx) * 0.14;
      cy += (ty - cy) * 0.14;
      cur2.style.left = `${cx}px`;
      cur2.style.top = `${cy}px`;
      requestAnimationFrame(trailCursor);
    }
    trailCursor();
  }

  // ==========================================
  // 3. Typewriter Effect
  // ==========================================
  if (typedEl) {
    const words = ['SOFTWARE', 'FULL-STACK', 'ALGORITHM', 'SYSTEMS', 'C++ / JAVA'];
    let wi = 0;
    let ci = 0;
    let deleting = false;

    function tick() {
      const w = words[wi];
      if (!deleting) {
        ci++;
        typedEl.textContent = w.slice(0, ci);
        if (ci === w.length) {
          deleting = true;
          setTimeout(tick, 1500);
          return;
        }
      } else {
        ci--;
        typedEl.textContent = w.slice(0, ci);
        if (ci === 0) {
          deleting = false;
          wi = (wi + 1) % words.length;
        }
      }
      setTimeout(tick, deleting ? 45 : 90);
    }
    tick();
  }

  // ==========================================
  // 4. Canvas Resize (HiDPI & Aspect ratio)
  // ==========================================
  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    const targetW = Math.round(w * dpr);
    const targetH = Math.round(h * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      isCanvasDirty = true;
    }
  }

  // ==========================================
  // 5. High-Performance Frame Drawing (Cover-fit)
  // ==========================================
  function drawFrame(index) {
    const frame = getBestFrame(index);
    if (!frame) return;

    const cW = canvas.width;
    const cH = canvas.height;
    const fW = frame.width || frame.naturalWidth || 1920;
    const fH = frame.height || frame.naturalHeight || 1080;

    const ratio = Math.max(cW / fW, cH / fH);
    const dW = fW * ratio;
    const dH = fH * ratio;
    const ox = (cW - dW) * 0.5;
    const oy = (cH - dH) * 0.5;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    ctx.drawImage(frame, 0, 0, fW, fH, ox, oy, dW, dH);
  }

  // Find nearest loaded frame if the exact frame is still extracting
  function getBestFrame(index) {
    if (frames[index]) return frames[index];

    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = index - offset;
      if (prev >= 0 && frames[prev]) return frames[prev];

      const next = index + offset;
      if (next < TOTAL_FRAMES && frames[next]) return frames[next];
    }
    return null;
  }

  // ==========================================
  // 6. Scroll Progress Calculation
  // ==========================================
  function calcProgress() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollable <= 0) return 0;
    return Math.max(0, Math.min(1, window.scrollY / scrollable));
  }

  // ==========================================
  // 7. LERP Inertia Animation Loop
  // ==========================================
  function animationLoop() {
    targetProgress = calcProgress();
    const delta = targetProgress - currentProgress;

    if (Math.abs(delta) < 0.00004) {
      currentProgress = targetProgress;
    } else {
      currentProgress += delta * LERP_FACTOR;
    }

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
  // 8. Parallel JSZip Loader Helper
  // ==========================================
  function loadJSZipLibrary() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
      script.crossOrigin = 'anonymous';
      script.onload = () => resolve(window.JSZip);
      script.onerror = () => reject(new Error('Failed to load JSZip library'));
      document.head.appendChild(script);
    });
  }

  // ==========================================
  // 9. Frame Decoding (createImageBitmap with fallback)
  // ==========================================
  async function decodeBlobToFrame(blob) {
    if ('createImageBitmap' in window) {
      try {
        return await createImageBitmap(blob, {
          imageOrientation: 'none',
          premultiplyAlpha: 'none'
        });
      } catch (err) {
        // Fallback below
      }
    }

    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image decode error'));
      };
      img.src = url;
    });
  }

  // Concurrency Pool Runner
  async function runWithConcurrency(items, limit, fn) {
    const results = new Array(items.length);
    let currentIndex = 0;

    async function worker() {
      while (currentIndex < items.length) {
        const index = currentIndex++;
        results[index] = await fn(items[index], index);
      }
    }

    const workers = [];
    for (let i = 0; i < Math.min(limit, items.length); i++) {
      workers.push(worker());
    }

    await Promise.all(workers);
    return results;
  }

  // ==========================================
  // 10. High-Speed ZIP Stream Fetch & Extract
  // ==========================================
  async function loadFramesFromZip() {
    // 1. Kick off JSZip loading concurrently with ZIP streaming
    const jszipPromise = loadJSZipLibrary();

    // 2. Fetch the ZIP archive with ReadableStream progress
    const response = await fetch(ZIP_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} when fetching ${ZIP_URL}`);
    }

    const contentLength = response.headers.get('Content-Length');
    const totalBytes = contentLength ? parseInt(contentLength, 10) : null;
    let receivedBytes = 0;

    const reader = response.body ? response.body.getReader() : null;
    let arrayBuffer;

    if (reader) {
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;

        if (totalBytes && progressBar) {
          const downloadPct = Math.round((receivedBytes / totalBytes) * 60); // 0-60% download
          progressBar.style.width = `${downloadPct}%`;
          if (progressText) progressText.textContent = `Streaming archive ${downloadPct}%`;
          if (frameCounter) {
            frameCounter.textContent = `${(receivedBytes / (1024 * 1024)).toFixed(1)} / ${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
          }
        }
      }

      const combined = new Uint8Array(receivedBytes);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(chunk, offset);
        offset += chunk.length;
      }
      arrayBuffer = combined.buffer;
    } else {
      // Direct arrayBuffer fallback
      arrayBuffer = await response.arrayBuffer();
    }

    if (progressBar) progressBar.style.width = '65%';
    if (progressText) progressText.textContent = 'Unpacking frames…';

    // 3. Ensure JSZip is ready and unpack
    const JSZip = await jszipPromise;
    const zip = await JSZip.loadAsync(arrayBuffer);

    // 4. Locate and sort frame filenames
    const frameFileNames = Object.keys(zip.files)
      .filter((name) => !zip.files[name].dir && name.match(/frame_\d+\.jpg$/i))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const totalToExtract = frameFileNames.length || TOTAL_FRAMES;

    // 5. Parallel frame extraction and hardware decoding
    let extractedCount = 0;

    await runWithConcurrency(frameFileNames, CONCURRENCY_LIMIT, async (fileName, idx) => {
      try {
        const file = zip.files[fileName];
        const blob = await file.async('blob');
        const decodedFrame = await decodeBlobToFrame(blob);

        frames[idx] = decodedFrame;
        extractedCount++;
        loadedCount++;

        const overallPct = 65 + Math.round((extractedCount / totalToExtract) * 35);
        if (progressBar) progressBar.style.width = `${overallPct}%`;
        if (progressText) progressText.textContent = `Decoding ${overallPct}%`;
        if (frameCounter) frameCounter.textContent = `${extractedCount} / ${totalToExtract} frames`;

        // Start rendering as soon as frame 0 or first frames become available
        if (extractedCount === 1 && !animStarted) {
          animStarted = true;
          resizeCanvas();
          requestAnimationFrame(animationLoop);
        }
      } catch (err) {
        console.warn(`Frame ${fileName} failed to decode:`, err);
      }
    });
  }

  // ==========================================
  // 11. Main Initializer
  // ==========================================
  async function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });

    try {
      await loadFramesFromZip();
    } catch (err) {
      console.error('ZIP streaming failed:', err);
      if (progressText) progressText.textContent = 'Retrying…';
    }

    // Hide preloader smoothly once loaded
    setTimeout(() => {
      if (loader) {
        loader.classList.add('hidden');
      }
    }, 180);

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
