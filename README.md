# Harsh Chahal — Software Developer & Systems Engineer Portfolio

Ultra-smooth scroll-based frame animation portfolio built with pure web technologies and optimized for lightning-fast asset delivery.

## 🚀 Performance Highlights

- **ZIP-Based Streaming**: Loads all 192 animation frames via a single HTTP archive stream (`video_frames_30fps.zip`) instead of 192 individual network requests.
- **Hardware-Accelerated Decoding**: Utilizes `createImageBitmap` for off-thread multi-threaded GPU decoding.
- **Instant Repeat Loads**: Powered by a Service Worker (`sw.js`) with Cache Storage API caching.
- **Apple-Grade LERP Inertia**: Butter-smooth canvas frame transitions locked to window scroll position.

## 🛠️ Tech Stack

- **Frontend**: HTML5, Vanilla CSS3 (Design Tokens, Glassmorphism, HiDPI Canvas), JavaScript (ES6+)
- **Frame Decoding**: JSZip, `createImageBitmap`, Canvas 2D Context
- **Deployment**: GitHub Pages via GitHub Actions CI/CD workflow

## 💻 Local Development

```bash
# Start local server
npm start
```

Visit `http://localhost:3000` in your browser.
