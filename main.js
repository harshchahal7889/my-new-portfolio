/**
 * Ultra-Smooth Scroll-Based Frame Animation & Interaction Engine
 * Portfolio: Harsh Chahal
 * 
 * Features:
 * - 60/120 FPS inertial LERP interpolation for notchless, butter-smooth video frame playback
 * - High-DPI / Retina canvas scaling with dynamic cover-fit aspect ratio
 * - Asynchronous progressive preloading with nearest loaded frame fallback
 * - Custom magnetic trailing cursor
 * - Dynamic typewriter role animation in hero
 * - Minimalist dark loader & auto-fading scroll cue
 */

(() => {
  const TOTAL_FRAMES = 192;
  const LERP_FACTOR = 0.08; // Inertial smoothing coefficient (0.05 to 0.1 gives Apple-level momentum)
  
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
  const images = new Array(TOTAL_FRAMES);
  let loadedCount = 0;
  let targetProgress = 0;
  let currentProgress = 0;
  let lastRenderedIndex = -1;
  let isCanvasDirty = true;
  let dpr = 1;

  // ==========================================
  // 1. Custom Magnetic Cursor
  // ==========================================
  if (cur && cur2) {
    window.addEventListener('mousemove', (e) => {
      cur.style.left = `${e.clientX}px`;
      cur.style.top = `${e.clientY}px`;
      cur2.style.left = `${e.clientX}px`;
      cur2.style.top = `${e.clientY}px`;
    });
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
        if (ci === w.length) {
          deleting = true;
          setTimeout(tick, 1400);
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
      setTimeout(tick, deleting ? 50 : 100);
    }
    tick();
  }

  // ==========================================
  // 3. Frame URL Formatter
  // ==========================================
  function getFrameUrl(index) {
    const padIndex = String(index).padStart(6, '0');
    return `video_frames_30fps/frame_${padIndex}.jpg`;
  }

  // ==========================================
  // 4. Setup Canvas Resolution for Crisp High-DPI Rendering
  // ==========================================
  function resizeCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr;
      canvas.height = displayHeight * dpr;
      isCanvasDirty = true;
    }
  }

  // ==========================================
  // 5. Cover-fit Drawing Logic
  // ==========================================
  function drawFrame(index) {
    const img = getBestFrame(index);
    if (!img) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const imgWidth = img.naturalWidth || 1400;
    const imgHeight = img.naturalHeight || 1080;

    // Calculate aspect ratio cover
    const hRatio = canvasWidth / imgWidth;
    const vRatio = canvasHeight / imgHeight;
    const ratio = Math.max(hRatio, vRatio);

    const drawWidth = imgWidth * ratio;
    const drawHeight = imgHeight * ratio;
    const offsetX = (canvasWidth - drawWidth) / 2;
    const offsetY = (canvasHeight - drawHeight) / 2;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, imgWidth, imgHeight, offsetX, offsetY, drawWidth, drawHeight);
  }

  // ==========================================
  // 6. Nearest Loaded Frame Fallback
  // ==========================================
  function getBestFrame(index) {
    if (images[index] && images[index].complete && images[index].naturalWidth !== 0) {
      return images[index];
    }
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = index - offset;
      if (prev >= 0 && images[prev] && images[prev].complete && images[prev].naturalWidth !== 0) {
        return images[prev];
      }
      const next = index + offset;
      if (next < TOTAL_FRAMES && images[next] && images[next].complete && images[next].naturalWidth !== 0) {
        return images[next];
      }
    }
    return null;
  }

  // ==========================================
  // 7. Calculate Target Scroll Progress (0.0 to 1.0)
  // ==========================================
  function calculateTargetProgress() {
    const scrollableDistance = document.documentElement.scrollHeight - window.innerHeight;
    if (scrollableDistance <= 0) return 0;
    return Math.max(0, Math.min(1, window.scrollY / scrollableDistance));
  }

  // ==========================================
  // 8. Progressive Preloading for All 192 Frames
  // ==========================================
  function preloadImages() {
    return new Promise((resolve) => {
      let isResolved = false;

      // Load frame 0 immediately to paint initial canvas state ASAP
      const initialFrame = new Image();
      initialFrame.src = getFrameUrl(0);
      initialFrame.onload = () => {
        images[0] = initialFrame;
        drawFrame(0);
      };

      for (let i = 0; i < TOTAL_FRAMES; i++) {
        const img = new Image();
        img.src = getFrameUrl(i);

        const onComplete = () => {
          loadedCount++;
          const percent = Math.round((loadedCount / TOTAL_FRAMES) * 100);

          if (progressBar) progressBar.style.width = `${percent}%`;
          if (progressText) progressText.textContent = `Loading ${percent}%`;
          if (frameCounter) frameCounter.textContent = `${loadedCount} / ${TOTAL_FRAMES} frames`;

          // Once 95% or all loaded, unlock the experience smoothly
          if (!isResolved && (loadedCount >= Math.floor(TOTAL_FRAMES * 0.95) || loadedCount === TOTAL_FRAMES)) {
            isResolved = true;
            resolve();
          }
        };

        img.onload = () => {
          images[i] = img;
          onComplete();
        };

        img.onerror = () => {
          console.warn(`Failed to load frame ${i}`);
          onComplete();
        };
      }
    });
  }

  // ==========================================
  // 9. Continuous 60/120 FPS Render Loop with LERP Inertia
  // ==========================================
  function animationLoop() {
    targetProgress = calculateTargetProgress();

    // Linear Interpolation: current = current + (target - current) * ease
    const delta = targetProgress - currentProgress;
    if (Math.abs(delta) < 0.00005) {
      currentProgress = targetProgress;
    } else {
      currentProgress += delta * LERP_FACTOR;
    }

    // Map normalized progress [0, 1] to frame index [0, 191]
    const frameIndex = Math.min(
      TOTAL_FRAMES - 1,
      Math.max(0, Math.round(currentProgress * (TOTAL_FRAMES - 1)))
    );

    // Only draw when frame index changes or window resized
    if (frameIndex !== lastRenderedIndex || isCanvasDirty) {
      drawFrame(frameIndex);
      lastRenderedIndex = frameIndex;
      isCanvasDirty = false;
    }

    // Fade scroll indicator as user scrolls
    if (window.scrollY > 40) {
      if (scrollIndicator && !scrollIndicator.classList.contains('scrolled')) {
        scrollIndicator.classList.add('scrolled');
      }
    } else {
      if (scrollIndicator && scrollIndicator.classList.contains('scrolled')) {
        scrollIndicator.classList.remove('scrolled');
      }
    }

    requestAnimationFrame(animationLoop);
  }

  // ==========================================
  // 10. Initialization
  // ==========================================
  async function init() {
    resizeCanvas();
    window.addEventListener('resize', () => {
      resizeCanvas();
    }, { passive: true });

    // Start preloading
    await preloadImages();

    // Smoothly reveal experience
    setTimeout(() => {
      if (loader) {
        loader.classList.add('hidden');
      }
    }, 250);

    // Start render loop
    requestAnimationFrame(animationLoop);
  }

  // Run on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
