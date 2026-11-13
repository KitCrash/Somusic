# SoMusic 🎵

> **Free, open-source Spotify & YouTube Music alternative for Android, Web, and Desktop: the entire YouTube Music catalog and your own local files in one modern app, with no ads, no subscription, and word-synced lyrics.**

[![Release APK](https://img.shields.io/badge/Download-Android%20APK%20(v1.0)-success?style=for-the-badge&logo=android)](release/somusic.apk)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg?style=for-the-badge)](LICENSE)
[![Platform: Android · Web · Windows · macOS](https://img.shields.io/badge/Platform-Android%20%7C%20Web%20%7C%20Desktop-purple?style=for-the-badge)](#)

---

## 📱 Android APK Installation

You can download the ready-to-install Android APK directly from this repository:
👉 **[Download SoMusic Android APK (16.6 MB)](release/somusic.apk)**

1. Download `release/somusic.apk` to your Android device (Android 8.0+ supported).
2. Tap the downloaded file to install (allow "Install from Unknown Sources" if prompted).
3. Open **SoMusic** and enjoy ad-free music streaming!

---

## ✨ Features

- **No Ads, No Subscription, No Login Required**: Stream the full YouTube Music catalog completely free.
- **Word-Synced & Line-Synced Lyrics**: Real-time synchronized lyrics highlighting word-by-word with auto-scroll and click-to-seek (powered by LRCLIB and YouTube Transcripts).
- **Mobile-Optimized Touch UI**:
  - Bottom navigation bar (Home, Explore, Search, Library)
  - Quick player bar with thumb controls
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
├── android/                 # Native Android Studio / Gradle Project
│   ├── app/
│   │   ├── src/main/assets/ # Bundled production web build
│   │   └── src/main/kotlin/ # Native Android OkHttp & WebView Bridge
│   ├── build.gradle.kts
│   └── gradlew.bat
├── server/                  # Standalone Node.js Audio Streaming & Search API
│   ├── index.mjs            # HTTP server with Range (206) proxy
│   ├── music-service.mjs    # InnerTube YouTube Music integration
│   └── local-library.mjs    # Audio metadata & tag extractor
├── src/                     # React 18 + TypeScript + Tailwind SPA
│   ├── components/          # TopBar, MobileBottomNav, PlayerBar, SyncedLyrics, etc.
│   ├── stores/              # Zustand stores (player, library, settings, ui)
│   ├── views/               # Home, Search, Explore, Album, Artist, Replay, Settings
│   └── web-bridge.ts        # Dynamic IPC & Web API bridge
├── release/                 # Pre-built APK releases
│   └── somusic.apk          # Production-ready Android package
└── package.json             # NPM dependencies & build scripts
```

---

## 🚀 Running the Web Player Locally

### Prerequisites
- Node.js 18+ and npm

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Both the Backend API and Web Player
```bash
npm run dev
```

Open your browser to:
**`http://localhost:5173`**

---

## 🛠️ Building the Android APK from Source

```bash
cd android
./gradlew assembleDebug
```
The compiled APK will be at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 📜 License
GPL-3.0 License. Free and open source for everyone.
