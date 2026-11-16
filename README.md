# SoMusic 🎵

> **Free, open-source Spotify & YouTube Music web alternative: the entire YouTube Music catalog and your own local files in one modern app, with no ads, no subscription, and word-synced lyrics.**

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg?style=for-the-badge)](LICENSE)
[![Platform: Web](https://img.shields.io/badge/Platform-Web-purple?style=for-the-badge)](#)

---

## ✨ Features

- **No Ads, No Subscription, No Login Required**: Stream the full YouTube Music catalog completely free.
- **Word-Synced & Line-Synced Lyrics**: Real-time synchronized lyrics highlighting word-by-word with auto-scroll and click-to-seek (powered by LRCLIB and YouTube Transcripts).
- **Responsive Touch & Desktop UI**:
  - Top navigation bar & responsive mobile navigation (Home, Explore, Search, Library)
  - Quick player bar with controls
  - Fullscreen Now Playing screen with album art, live lyrics, and audio visualizer
- **Studio Audio Engine**:
  - 10-band Graphic Equalizer (31 Hz – 16 kHz)
  - Volume leveling (LUFS & ReplayGain)
  - Equal-power crossfade and beat-aware Automix
- **Local Music Library**: Play offline MP3, FLAC, M4A, AAC, WAV, and OGG files beside streaming tracks with automated non-music filtering.
- **Listening Analytics (Replay)**: Track your top songs, top artists, minutes listened, and listening streaks with shareable story cards.
- **Spotify Playlist Importer**: Paste public Spotify playlist links to instantly find and play them on YouTube Music without requiring a Spotify login.

---

## 🏗️ Project Architecture

```
somusic/
├── server/                  # Standalone Node.js Audio Streaming & Search API
│   ├── index.mjs            # HTTP server with Range (206) proxy
│   ├── music-service.mjs    # InnerTube YouTube Music integration
│   └── local-library.mjs    # Audio metadata & tag extractor
├── src/                     # React 18 + TypeScript + Tailwind SPA
│   ├── components/          # TopBar, MobileBottomNav, PlayerBar, SyncedLyrics, etc.
│   ├── stores/              # Zustand stores (player, library, settings, ui)
│   ├── views/               # Home, Search, Explore, Album, Artist, Replay, Settings
│   └── web-bridge.ts        # Dynamic Web API bridge
└── package.json             # NPM dependencies & build scripts
```

---

## 🚀 Running Locally & Deploying to Web

### Prerequisites
- Node.js 18+ and npm

### 1. Run Locally
```bash
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 🌐 Deploying to the Web via GitHub

### Option 1: 1-Click Full-Stack Cloud Deployment (Recommended)
Because YouTube Music audio streaming and synchronized lyrics proxies require a lightweight Node.js runtime, you can deploy the full app for free on **Render**, **Railway**, or **Koyeb** directly linked to your GitHub repository:

1. Push this repository to GitHub (`KitCrash/Somusic`).
2. Log into [Render.com](https://render.com) (or [Railway.app](https://railway.app)).
3. Click **New +** → **Web Service** → Select your GitHub repository **`KitCrash/Somusic`**.
4. Configure settings (or let Render read `render.yaml` automatically):
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Click **Deploy**! Your web player will be live with full streaming audio and lyrics at `https://your-app.onrender.com`.

### Option 2: GitHub Pages (Automatic via GitHub Actions)
This repository includes a GitHub Actions workflow (`.github/workflows/deploy.yml`):
1. In your GitHub repository, go to **Settings** → **Pages**.
2. Under **Build and deployment** → **Source**, select **GitHub Actions**.
3. Every push to `main` will automatically build and publish the web player to `https://<your-username>.github.io/Somusic/`.

---

## 📜 License
GPL-3.0 License. Free and open source for everyone.
