/**
 * Web Bridge polyfill for ByTune Web Player
 * Connects window.bytune to the local Node backend API
 */
import type { ByTuneApi } from "../electron/preload";

const API_BASE = window.location.origin;

export const webBridge: ByTuneApi = {
  platform: "win32",
  versions: {
    app: "1.1.1 (Web Player)",
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
  getLyrics: (track: { id: string; title: string; artist: string; album?: string; duration?: number }) =>
    fetch(`${API_BASE}/api/music/lyrics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(track),
    }).then((r) => r.json()),
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

  // Local library
  localLibrary: () =>
    fetch(`${API_BASE}/api/library/get`)
      .then((r) => r.json())
      .catch(() => ({ folders: [], scannedAt: 0, tracks: [] })),
  scanLibrary: () =>
    fetch(`${API_BASE}/api/library/scan`)
      .then((r) => r.json())
      .catch(() => ({ folders: [], scannedAt: 0, tracks: [] })),
  setLibraryFolders: () => Promise.resolve({ folders: [], scannedAt: 0, tracks: [] } as any),
  addLibraryFolders: () => Promise.resolve({ lib: { folders: [], scannedAt: 0, tracks: [] }, added: [], skipped: [] } as any),
  renameLibraryFolder: () => Promise.resolve(),
  removeLibraryFolder: () => Promise.resolve(),
  libraryFolderStatuses: () => Promise.resolve([]),
  localTrackUrl: (id: string) => Promise.resolve(`${API_BASE}/api/stream?lid=${encodeURIComponent(id)}`),
  localArtBytes: () => Promise.resolve(null as any),
  remoteArtBytes: () => Promise.resolve(null as any),
  getCanvas: () => Promise.resolve(null as any),

  // Updates
  updateState: () => Promise.resolve({ status: "idle", current: "1.1.1" } as any),
  checkForUpdates: () => Promise.resolve(),
  installUpdate: () => Promise.resolve(),
  restartToUpdate: () => Promise.resolve(),
  onUpdateState: () => () => {},

  // Window controls
  windowMinimize: () => {},
  windowMaximizeToggle: () => {},
  windowClose: () => {},
  isMaximized: () => Promise.resolve(false),
  introDone: () => {},
  naturalScrolling: () => Promise.resolve(null),
  setOverlayChrome: () => Promise.resolve(),
  setFullScreen: (fs: boolean) => {
    if (fs) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
    return Promise.resolve();
  },
  onMaximizeChange: () => () => {},
  onFullScreenChange: () => () => {},

  // PiP
  pipToggle: () => Promise.resolve(),
  pipIsOpen: () => Promise.resolve(false),
  pipClose: () => {},
  pipMinimize: () => {},
  pipSetCompact: () => {},
  pipShowMain: () => {},
  pipSendState: () => {},
  pipSendCommand: () => {},
  onPipState: () => () => {},
  onPipCommand: () => () => {},
  onPipOpenChange: () => () => {},
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
    } catch {
      /* fall back to localStorage */
    }
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
    } catch {
      /* ignore */
    }
    try {
      localStorage.setItem(name, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  },
  resetData: () => {
    try {
      localStorage.clear();
    } catch {}
    return Promise.resolve();
  },

  // Backups, Playlists, Spotify, Rooms
  backupExport: () => Promise.resolve(),
  playlistExport: () => Promise.resolve({ cancelled: true }),
  playlistImport: () => Promise.resolve(null),
  spotifyPublicPlaylist: () => Promise.reject(new Error("Spotify import available in desktop version")),
  spotifyStatus: () => Promise.resolve({ connected: false } as any),
  spotifyConnect: () => Promise.resolve({ connected: false } as any),
  spotifyDisconnect: () => Promise.resolve({ connected: false } as any),
  spotifyPlaylists: () => Promise.resolve([]),
  spotifyPlaylist: () => Promise.reject(new Error("Spotify not connected")),
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
  backupImport: () => Promise.resolve(),

  // Auth (Guest mode by default)
  authGetSession: () =>
    Promise.resolve({
      mode: "guest",
      userId: "guest-user",
      username: "Guest",
      displayName: "Music Lover",
      freshInstall: false,
      needsUsername: false,
    } as any),
  authSignUp: () => Promise.resolve(),
  authSignIn: () => Promise.resolve(),
  authSignInGoogle: () => Promise.resolve(),
  authContinueGuest: () => Promise.resolve(),
  authClearGuestProfile: () => Promise.resolve(),
  authUsernameAvailable: () => Promise.resolve(true),
  authSetUsername: () => Promise.resolve(),
  authSkipUsername: () => Promise.resolve(),
  authSetDisplayName: () => Promise.resolve(),
  authSignOut: () => Promise.resolve(),
  onAuthChanged: () => () => {},
  syncStatus: () => Promise.resolve({ syncing: false } as any),
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

  // Files & Downloads
  takeOpenedFiles: () => Promise.resolve([]),
  onFilesOpened: () => () => {},
  openedFiles: () => Promise.resolve([]),
  forgetOpenedFile: () => Promise.resolve([]),
  defaultDownloadDir: () => Promise.resolve("/downloads"),
  pickFolder: () => Promise.resolve(null),
  revealPath: () => Promise.resolve(),
  openPath: () => Promise.resolve(),
  startDownload: () => Promise.resolve(),
  cancelDownload: () => Promise.resolve(),
  downloadQueue: () => Promise.resolve([]),
  onDownloadEvent: () => () => {},
  onDownloadProgress: () => () => {},
};

// Expose directly to window
if (typeof window !== "undefined") {
  window.bytune = webBridge;
}
