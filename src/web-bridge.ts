/**
 * Web Bridge polyfill for SoMusic Web Player
 * Connects window.bytune to the local Node backend API and browser Web APIs.
 */
import type { ByTuneApi } from "../electron/preload";

function getApiBase(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:3001";
  const custom = window.localStorage?.getItem("somusic_api_url") || (window as any).__SOMUSIC_API_URL__;
  if (custom && typeof custom === "string" && custom.trim()) {
    return custom.trim().replace(/\/+$/, "");
  }
  return window.location.origin;
}

const API_BASE = getApiBase();

// PiP / Miniplayer window tracking & broadcast sync
let pipWindowRef: Window | null = null;
const pipChannel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("somusic_pip") : null;
const pipOpenSubscribers = new Set<(open: boolean) => void>();
const pipCommandSubscribers = new Set<(cmd: any) => void>();
const pipStateSubscribers = new Set<(state: any) => void>();

if (pipChannel) {
  pipChannel.onmessage = (e) => {
    const { type, payload } = e.data || {};
    if (type === "pip:command") {
      pipCommandSubscribers.forEach((cb) => cb(payload));
    } else if (type === "pip:state") {
      pipStateSubscribers.forEach((cb) => cb(payload));
    } else if (type === "pip:open-change") {
      pipOpenSubscribers.forEach((cb) => cb(payload));
    }
  };
}

// Download event subscribers
const downloadEventSubscribers = new Set<(e: any) => void>();
const downloadProgressSubscribers = new Set<(p: any) => void>();

function emitDownloadEvent(evt: any) {
  downloadEventSubscribers.forEach((cb) => cb(evt));
}

function emitDownloadProgress(prog: any) {
  downloadProgressSubscribers.forEach((cb) => cb(prog));
}

// In-memory web local library
let webLocalLibrary: {
  folders: Array<{ path: string; name: string; trackCount: number }>;
  scannedAt: number;
  tracks: any[];
} = {
  folders: [],
  scannedAt: Date.now(),
  tracks: [],
};

// Try to hydrate web local library from localStorage
try {
  const saved = localStorage.getItem("somusic_local_library");
  if (saved) webLocalLibrary = JSON.parse(saved);
} catch {}

export const webBridge: ByTuneApi = {
  platform: "win32",
  versions: {
    app: "1.1.1 (Web)",
    electron: "Web Browser",
    chrome: navigator.userAgent,
    node: "22",
  },

  // Music APIs
  search: (query: string, light = false) =>
    fetch(`${API_BASE}/api/music/search?q=${encodeURIComponent(query)}&light=${light ? "1" : "0"}`).then((r) => r.json()),
  searchPage: (query: string, filter: string) =>
    fetch(`${API_BASE}/api/music/searchPage?q=${encodeURIComponent(query)}&filter=${encodeURIComponent(filter)}`).then((r) => r.json()),
  searchMore: (token: string, filter: string) =>
    fetch(`${API_BASE}/api/music/searchMore`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, filter }),
    }).then((r) => r.json()),
  suggestions: (query: string) =>
    fetch(`${API_BASE}/api/music/suggestions?q=${encodeURIComponent(query)}`).then((r) => r.json()),
  getAlbum: (id: string) => fetch(`${API_BASE}/api/music/album?id=${encodeURIComponent(id)}`).then((r) => r.json()),
  getArtist: (id: string) => fetch(`${API_BASE}/api/music/artist?id=${encodeURIComponent(id)}`).then((r) => r.json()),
  getPlaylist: (id: string) => fetch(`${API_BASE}/api/music/playlist?id=${encodeURIComponent(id)}`).then((r) => r.json()),
  getPlaylistPage: (id: string) => fetch(`${API_BASE}/api/music/playlistPage?id=${encodeURIComponent(id)}`).then((r) => r.json()),
  getHome: () => fetch(`${API_BASE}/api/music/home`).then((r) => r.json()),
  getRadio: (id: string, token?: string) =>
    fetch(`${API_BASE}/api/music/radio?id=${encodeURIComponent(id)}${token ? `&token=${encodeURIComponent(token)}` : ""}`).then((r) => r.json()),
  getCharts: () => fetch(`${API_BASE}/api/music/charts`).then((r) => r.json()),
  getMoods: () => fetch(`${API_BASE}/api/music/moods`).then((r) => r.json()),
  getMoodCovers: (browseId: string, params: string) =>
    fetch(`${API_BASE}/api/music/moodCovers?browseId=${encodeURIComponent(browseId)}&params=${encodeURIComponent(params)}`).then((r) => r.json()),
  getMoodPage: (browseId: string, params: string) =>
    fetch(`${API_BASE}/api/music/moodPage?browseId=${encodeURIComponent(browseId)}&params=${encodeURIComponent(params)}`).then((r) => r.json()),
  marketInfo: () => Promise.resolve({ country: "US", source: "ip" }),

  // Lyrics API (POST + GET support, multi-tier fallback with word timings)
  getLyrics: (track: { id: string; title: string; artist: string; album?: string; duration?: number }) => {
    return fetch(`${API_BASE}/api/music/lyrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(track),
    })
      .then((r) => r.json())
      .catch(() => {
        const q = new URLSearchParams({
          id: track.id || "",
          title: track.title || "",
          artist: track.artist || "",
          duration: String(track.duration || 0),
        });
        return fetch(`${API_BASE}/api/music/lyrics?${q.toString()}`)
          .then((r) => r.json())
          .catch(() => null);
      });
  },

  enrichDurations: (ids: string[]) =>
    fetch(`${API_BASE}/api/music/enrich`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }).then((r) => r.json()),

  playbackEvent: () => {},
  statsSummary: () => Promise.resolve(null as any),

  getStreamUrl: (id: string, forceRotate = false, quality?: string) =>
    Promise.resolve(
      `${API_BASE}/api/stream?id=${encodeURIComponent(id)}${forceRotate ? `&retry=${Date.now()}` : ""}${quality ? `&quality=${quality}` : ""}`
    ),

  prefetchStream: (id: string) => {
    if (!id) return;
    void fetch(`${API_BASE}/api/stream?id=${encodeURIComponent(id)}&prefetch=1`).catch(() => {});
  },

  // Local library
  localLibrary: () => Promise.resolve(webLocalLibrary as any),
  scanLibrary: () => Promise.resolve(webLocalLibrary as any),
  setLibraryFolders: (folders: string[]) => {
    webLocalLibrary.folders = folders.map((f) => ({ path: f, name: f.split(/[\\/]/).pop() || f, trackCount: 0 }));
    try { localStorage.setItem("somusic_local_library", JSON.stringify(webLocalLibrary)); } catch {}
    return Promise.resolve(webLocalLibrary as any);
  },
  addLibraryFolders: (folders: string[]) => {
    const added: any[] = [];
    for (const f of folders) {
      if (!webLocalLibrary.folders.some((e) => e.path === f)) {
        const entry = { path: f, name: f.split(/[\\/]/).pop() || f, trackCount: 0 };
        webLocalLibrary.folders.push(entry);
        added.push(entry);
      }
    }
    try { localStorage.setItem("somusic_local_library", JSON.stringify(webLocalLibrary)); } catch {}
    return Promise.resolve({ lib: webLocalLibrary, added, skipped: [] } as any);
  },
  renameLibraryFolder: () => Promise.resolve(),
  removeLibraryFolder: (folderPath: string) => {
    webLocalLibrary.folders = webLocalLibrary.folders.filter((f) => f.path !== folderPath);
    try { localStorage.setItem("somusic_local_library", JSON.stringify(webLocalLibrary)); } catch {}
    return Promise.resolve();
  },
  libraryFolderStatuses: () => Promise.resolve(webLocalLibrary.folders.map((f) => ({ path: f.path, exists: true }))),
  localTrackUrl: (id: string) => Promise.resolve(`${API_BASE}/api/stream?lid=${encodeURIComponent(id)}`),
  localArtBytes: () => Promise.resolve(null as any),
  remoteArtBytes: () => Promise.resolve(null as any),
  getCanvas: () => Promise.resolve(null as any),

  // Updates
  updateState: () => Promise.resolve({ status: "idle", current: "1.1.1 (Web)", installs: false } as any),
  checkForUpdates: () => {
    return Promise.resolve();
  },
  installUpdate: () => Promise.resolve(),
  restartToUpdate: () => Promise.resolve(),
  onUpdateState: () => () => {},

  // Window controls
  windowMinimize: () => {},
  windowMaximizeToggle: () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen().catch(() => {});
    } else {
      void document.exitFullscreen().catch(() => {});
    }
  },
  windowClose: () => {},
  isMaximized: () => Promise.resolve(!!document.fullscreenElement),
  introDone: () => {},
  naturalScrolling: () => Promise.resolve(null),
  setOverlayChrome: () => Promise.resolve(),
  setFullScreen: (fsState?: boolean) => {
    if (fsState === undefined) {
      if (!document.fullscreenElement) {
        return document.documentElement.requestFullscreen().catch(() => {});
      } else {
        return document.exitFullscreen().catch(() => {});
      }
    } else if (fsState && !document.fullscreenElement) {
      return document.documentElement.requestFullscreen().catch(() => {});
    } else if (!fsState && document.fullscreenElement) {
      return document.exitFullscreen().catch(() => {});
    }
    return Promise.resolve();
  },
  onMaximizeChange: () => () => {},
  onFullScreenChange: () => () => {},

  // Picture-in-Picture / MiniPlayer
  pipToggle: () => {
    const isClosed = !pipWindowRef || pipWindowRef.closed;
    if (isClosed) {
      pipWindowRef = window.open(
        `${window.location.origin}/?window=pip`,
        "SoMusicMiniPlayer",
        "width=340,height=370,left=100,top=100,resizable=yes"
      );
      pipOpenSubscribers.forEach((cb) => cb(true));
      pipChannel?.postMessage({ type: "pip:open-change", payload: true });
    } else {
      pipWindowRef?.close();
      pipWindowRef = null;
      pipOpenSubscribers.forEach((cb) => cb(false));
      pipChannel?.postMessage({ type: "pip:open-change", payload: false });
    }
    return Promise.resolve();
  },
  pipIsOpen: () => Promise.resolve(!!(pipWindowRef && !pipWindowRef.closed)),
  pipClose: () => {
    pipWindowRef?.close();
    pipWindowRef = null;
    pipOpenSubscribers.forEach((cb) => cb(false));
    pipChannel?.postMessage({ type: "pip:open-change", payload: false });
  },
  pipMinimize: () => {},
  pipSetCompact: () => {},
  pipShowMain: () => {
    window.focus();
  },
  pipSendState: (state: any) => {
    pipChannel?.postMessage({ type: "pip:state", payload: state });
  },
  pipSendCommand: (cmd: any) => {
    pipChannel?.postMessage({ type: "pip:command", payload: cmd });
  },
  onPipState: (cb: (state: any) => void) => {
    pipStateSubscribers.add(cb);
    return () => pipStateSubscribers.delete(cb);
  },
  onPipCommand: (cb: (cmd: any) => void) => {
    pipCommandSubscribers.add(cb);
    return () => pipCommandSubscribers.delete(cb);
  },
  onPipOpenChange: (cb: (open: boolean) => void) => {
    pipOpenSubscribers.add(cb);
    return () => pipOpenSubscribers.delete(cb);
  },
  onPipNeedState: () => () => {},
  onPipCursorInside: () => () => {},

  // Persistence
  readData: async (name: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/data/${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = await res.json();
        if (data !== null) return data;
      }
    } catch {}
    try {
      const v = localStorage.getItem(name);
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  },
  writeData: async (name: string, data: unknown) => {
    try {
      await fetch(`${API_BASE}/api/data/${encodeURIComponent(name)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } catch {}
    try {
      localStorage.setItem(name, JSON.stringify(data));
    } catch {}
  },
  resetData: async () => {
    try {
      localStorage.clear();
    } catch {}
    return Promise.resolve();
  },

  // Backups & Playlists
  backupExport: async () => {
    try {
      const keys = ["settings", "library", "liked", "playlists", "history", "analytics"];
      const backup: Record<string, unknown> = {
        app: "SoMusic",
        version: "1.1.1",
        exportedAt: new Date().toISOString(),
      };
      for (const k of keys) {
        try {
          const val = localStorage.getItem(k);
          if (val) backup[k] = JSON.parse(val);
        } catch {}
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = `somusic-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(dlUrl);
      return { path: a.download };
    } catch (e: any) {
      throw new Error(e.message || "Failed to export backup");
    }
  },

  backupImport: async () => {
    return new Promise((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve({ restored: false });
          return;
        }
        try {
          const text = await file.text();
          const doc = JSON.parse(text);
          if (typeof doc !== "object" || !doc) throw new Error("Invalid backup format");
          for (const [k, v] of Object.entries(doc)) {
            if (k !== "app" && k !== "version" && k !== "exportedAt" && v !== undefined) {
              try {
                localStorage.setItem(k, JSON.stringify(v));
                await fetch(`${API_BASE}/api/data/${encodeURIComponent(k)}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(v),
                }).catch(() => {});
              } catch {}
            }
          }
          resolve({ restored: true, months: 6 });
        } catch (err: any) {
          reject(err);
        }
      };
      input.click();
    });
  },

  playlistExport: async (name: string, m3u8: string, json: string) => {
    try {
      const blob = new Blob([json || m3u8], { type: "application/json" });
      const dlUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = dlUrl;
      a.download = `${name.replace(/[^a-zA-Z0-9_\s-]/g, "") || "playlist"}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(dlUrl);
      return { path: a.download };
    } catch {
      return { cancelled: true };
    }
  },

  playlistImport: async () => {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,.m3u8,.m3u,.txt,.csv";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        const text = await file.text();
        const ext = file.name.split(".").pop()?.toLowerCase() || "json";
        const name = file.name.replace(/\.[^.]+$/, "");
        resolve({ name, ext, text });
      };
      input.click();
    });
  },

  // Spotify Public Playlist Integration
  spotifyPublicPlaylist: (url: string) => {
    return fetch(`${API_BASE}/api/spotify/public-playlist?url=${encodeURIComponent(url)}`).then((r) => {
      if (!r.ok) throw new Error("Could not load Spotify playlist");
      return r.json();
    });
  },
  spotifyStatus: () => Promise.resolve({ connected: false } as any),
  spotifyConnect: () => Promise.resolve({ connected: false } as any),
  spotifyDisconnect: () => Promise.resolve({ connected: false } as any),
  spotifyPlaylists: () => Promise.resolve([]),
  spotifyPlaylist: (id: string) => {
    return fetch(`${API_BASE}/api/spotify/public-playlist?id=${encodeURIComponent(id)}`).then((r) => {
      if (!r.ok) throw new Error("Could not load Spotify playlist");
      return r.json();
    });
  },
  matchSong: () => Promise.resolve(null),

  roomCurrent: () => Promise.resolve({ room: null, members: [] } as any),
  roomCreate: () => Promise.resolve({ room: null, members: [] } as any),
  roomJoin: () => Promise.resolve({ room: null, members: [] } as any),
  roomLeave: () => Promise.resolve({ room: null, members: [] } as any),
  roomUpdate: () => Promise.resolve({ room: null, members: [] } as any),
  roomHostOnly: () => Promise.resolve({ room: null, members: [] } as any),
  roomMakeHost: () => Promise.resolve({ room: null, members: [] } as any),
  roomRemove: () => Promise.resolve({ room: null, members: [] } as any),
  roomStash: () => Promise.resolve(),
  roomUnstash: () => Promise.resolve(null),
  roomTakeInvite: () => Promise.resolve(null),
  onRoomState: () => () => {},
  onRoomInvite: () => () => {},

  saveReplayImage: () => Promise.resolve({ cancelled: true }),
  copyReplayImage: () => Promise.resolve(false),
  localGainDb: () => Promise.resolve(null),
  getPodcast: () => Promise.resolve({ podcast: null, episodes: [] } as any),
  getPodcasts: () => Promise.resolve([]),

  // Auth (Persistent Profile state)
  authGetSession: () => {
    let username = "Guest";
    let displayName = "Music Lover";
    try {
      username = localStorage.getItem("somusic_username") || "Guest";
      displayName = localStorage.getItem("somusic_display_name") || "Music Lover";
    } catch {}
    return Promise.resolve({
      mode: "guest",
      userId: "guest-user",
      username,
      displayName,
      freshInstall: false,
      needsUsername: false,
    } as any);
  },
  authSignUp: () => Promise.resolve(),
  authSignIn: () => Promise.resolve(),
  authSignInGoogle: () => Promise.resolve(),
  authContinueGuest: () => Promise.resolve(),
  authClearGuestProfile: () => {
    try {
      localStorage.removeItem("somusic_username");
      localStorage.removeItem("somusic_display_name");
    } catch {}
    return Promise.resolve();
  },
  authUsernameAvailable: () => Promise.resolve(true),
  authSetUsername: (u: string) => {
    try {
      localStorage.setItem("somusic_username", u);
    } catch {}
    return Promise.resolve();
  },
  authSkipUsername: () => Promise.resolve(),
  authSetDisplayName: (d: string) => {
    try {
      localStorage.setItem("somusic_display_name", d);
    } catch {}
    return Promise.resolve();
  },
  authSignOut: () => {
    try {
      localStorage.removeItem("somusic_username");
      localStorage.removeItem("somusic_display_name");
    } catch {}
    return Promise.resolve();
  },
  onAuthChanged: () => () => {},
  syncStatus: () => Promise.resolve({ syncing: false, lastSyncAt: Date.now(), state: "idle", lastError: null } as any),
  syncNow: () => Promise.resolve(),
  syncBackupNow: () => Promise.resolve(),
  syncRestoreNow: () => Promise.resolve(),
  onSyncRestored: () => () => {},

  // Menu commands & Media controls
  onMenuCommand: () => () => {},
  menuPushState: () => {},
  mediaSetMetadata: (track) => {
    if ("mediaSession" in navigator && track) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork: [{ src: track.thumb, sizes: "512x512", type: "image/jpeg" }],
      });
    }
  },
  mediaSetPosition: (pos, dur) => {
    if ("mediaSession" in navigator && "setPositionState" in navigator.mediaSession && Number.isFinite(dur) && dur > 0) {
      try {
        navigator.mediaSession.setPositionState({
          duration: dur,
          playbackRate: 1,
          position: Math.min(pos, dur),
        });
      } catch {}
    }
  },
  onMediaAction: () => () => {},

  // Files, Folders & Downloads
  takeOpenedFiles: () => Promise.resolve([]),
  onFilesOpened: () => () => {},
  openedFiles: () => Promise.resolve([]),
  forgetOpenedFile: () => Promise.resolve([]),
  defaultDownloadDir: () => Promise.resolve("Downloads (Browser)"),
  pickFolder: async () => {
    if ("showDirectoryPicker" in window) {
      try {
        const handle = await (window as any).showDirectoryPicker();
        return handle.name || "Local Music Folder";
      } catch (err: any) {
        if (err.name === "AbortError") return null;
      }
    }
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.webkitdirectory = true as any;
      (input as any).directory = true;
      input.onchange = () => {
        if (input.files && input.files.length > 0) {
          const folderName = input.files[0].webkitRelativePath?.split("/")[0] || "Imported Music";
          resolve(folderName);
        } else {
          resolve(null);
        }
      };
      input.click();
    });
  },
  revealPath: () => Promise.resolve(),
  openPath: () => Promise.resolve(),

  startDownload: async (track: any) => {
    try {
      emitDownloadEvent({ event: "queued", id: track.id, track });
      emitDownloadProgress({ id: track.id, progress: 0.1 });

      const streamUrl = `${API_BASE}/api/stream?id=${encodeURIComponent(track.id)}`;
      const res = await fetch(streamUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const contentLength = Number(res.headers.get("content-length")) || 0;
      const reader = res.body?.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      emitDownloadEvent({ event: "started", id: track.id, track });

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            if (contentLength > 0) {
              const prog = Math.min(0.95, received / contentLength);
              emitDownloadProgress({ id: track.id, progress: prog, downloaded: received, total: contentLength });
            }
          }
        }
      }

      const audioBlob = new Blob(chunks, { type: "audio/mpeg" });
      const blobUrl = URL.createObjectURL(audioBlob);

      const safeTitle = `${track.artist} - ${track.title}`.replace(/[<>:"/\\|?*]+/g, "_");
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${safeTitle}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      emitDownloadProgress({ id: track.id, progress: 1, downloaded: received, total: received });
      emitDownloadEvent({ event: "completed", id: track.id, path: `${safeTitle}.mp3`, track });
      return;
    } catch (err: any) {
      emitDownloadEvent({ event: "failed", id: track.id, error: err.message, track });
      throw err;
    }
  },
  cancelDownload: () => Promise.resolve(),
  downloadQueue: () => Promise.resolve([]),
  onDownloadEvent: (cb: (e: any) => void) => {
    downloadEventSubscribers.add(cb);
    return () => downloadEventSubscribers.delete(cb);
  },
  onDownloadProgress: (cb: (p: any) => void) => {
    downloadProgressSubscribers.add(cb);
    return () => downloadProgressSubscribers.delete(cb);
  },
};

// Expose directly to window
if (typeof window !== "undefined") {
  window.bytune = webBridge;
}
