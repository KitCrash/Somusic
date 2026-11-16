/**
 * SoMusic Web Player & Streaming Server
 * Runs in pure Node.js on process.env.PORT || 3001
 * Serves both the backend streaming API and the production web client.
 */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as music from "./music-service.mjs";
import * as locallib from "./local-library.mjs";
import * as sp from "./spotify-web.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const HOST = process.env.HOST || "0.0.0.0";
const DATA_DIR = path.join(__dirname, ".data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mp3": "audio/mpeg",
};

function serveStatic(req, res, pathname) {
  const distDir = path.resolve(__dirname, "..", "dist");
  const webDistDir = path.resolve(__dirname, "..", "web-dist");
  const baseDir = fs.existsSync(distDir) ? distDir : webDistDir;

  if (!fs.existsSync(baseDir)) return false;

  let filePath = path.join(baseDir, pathname === "/" ? "index.html" : pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(baseDir, "index.html");
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000",
      "Access-Control-Allow-Origin": "*",
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }
  return false;
}

function cleanSongTitle(title) {
  if (!title) return "";
  return title
    .replace(/\s*[\(\[](feat\.?|ft\.?|official|video|audio|lyrics?|visualizer|remastered|explicit).*?[\)\]]/gi, "")
    .replace(/\s*-\s*(official|video|audio|lyrics?).*$/gi, "")
    .replace(/\s+(feat\.?|ft\.?)\s+.*$/gi, "")
    .trim();
}

function parseLrcToSynced(lrcText) {
  if (!lrcText || typeof lrcText !== "string") return null;
  const lines = lrcText.split(/\r?\n/);
  const result = [];
  const timeRegex = /\[(\d{2}):(\d{2}(?:\.\d+)?)\](.*)/;
  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;
    const match = timeRegex.exec(trimmed);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseFloat(match[2]);
      const text = match[3].trim();
      const time = min * 60 + sec;
      result.push({ time, text });
    }
  }
  if (!result.length) return null;

  for (let i = 0; i < result.length; i++) {
    const cur = result[i];
    const nextTime = i < result.length - 1 ? result[i + 1].time : cur.time + 5;
    cur.end = Math.max(cur.time + 0.5, nextTime);

    const words = cur.text.split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const dur = cur.end - cur.time;
      cur.words = words.map((w, idx) => ({
        text: w,
        start: cur.time + (dur * idx) / words.length,
        end: cur.time + (dur * (idx + 1)) / words.length,
      }));
    }
  }
  return result;
}

async function fetchLyricsMultiTier(track, DATA_DIR) {
  const id = track.id || "";
  const title = track.title || "";
  const artist = track.artist || "";
  const album = track.album || "";
  const duration = Number(track.duration) || 0;
  const cleanTitle = cleanSongTitle(title);
  const cleanArtist = artist.split(/,|&|\s+x\s+|\s+(?:feat\.?|ft\.?)\s+/i)[0]?.trim() || artist;

  const cacheKey = `lyrics_${(id || `${cleanTitle}_${cleanArtist}`).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const cachePath = path.join(DATA_DIR, `${cacheKey}.json`);
  if (fs.existsSync(cachePath)) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, "utf8"));
      if (cached && (cached.synced || cached.plain)) return cached;
    } catch {}
  }

  // Tier 1: Native getLyrics
  if (id) {
    try {
      const native = await music.getLyrics({ id, title: cleanTitle, artist: cleanArtist, album, duration });
      if (native && (native.synced?.length || native.plain)) {
        if (native.synced && !native.wordSynced) {
          for (const line of native.synced) {
            if (!line.words && line.text) {
              const words = line.text.split(/\s+/).filter(Boolean);
              const end = line.end || line.time + 4;
              const dur = end - line.time;
              line.words = words.map((w, i) => ({
                text: w,
                start: line.time + (dur * i) / words.length,
                end: line.time + (dur * (i + 1)) / words.length,
              }));
            }
          }
          native.wordSynced = true;
        }
        try { fs.writeFileSync(cachePath, JSON.stringify(native), "utf8"); } catch {}
        return native;
      }
    } catch (e) {
      console.warn("[lyrics] native getLyrics error:", e.message);
    }
  }

  // Tier 2: LRCLIB exact get
  try {
    const params = new URLSearchParams({
      track_name: cleanTitle,
      artist_name: cleanArtist,
    });
    if (duration > 0) params.set("duration", String(Math.round(duration)));
    if (album) params.set("album_name", album);

    const r = await fetch(`https://lrclib.net/api/get?${params.toString()}`, {
      headers: { "User-Agent": "SoMusic Web Player (github.com/KitCrash/somusic)" },
    });
    if (r.ok) {
      const data = await r.json();
      if (data.syncedLyrics) {
        const synced = parseLrcToSynced(data.syncedLyrics);
        if (synced) {
          const res = { synced, plain: data.plainLyrics || null, source: "LRCLIB", wordSynced: true };
          try { fs.writeFileSync(cachePath, JSON.stringify(res), "utf8"); } catch {}
          return res;
        }
      }
      if (data.plainLyrics) {
        const res = { synced: null, plain: data.plainLyrics, source: "LRCLIB", wordSynced: false };
        try { fs.writeFileSync(cachePath, JSON.stringify(res), "utf8"); } catch {}
        return res;
      }
    }
  } catch (e) {
    console.warn("[lyrics] LRCLIB get error:", e.message);
  }

  // Tier 3: LRCLIB fuzzy search
  try {
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanTitle} ${cleanArtist}`)}`;
    const r = await fetch(searchUrl, {
      headers: { "User-Agent": "SoMusic Web Player (github.com/KitCrash/somusic)" },
    });
    if (r.ok) {
      const list = await r.json();
      if (Array.isArray(list) && list.length > 0) {
        const best = list.find((item) => item.syncedLyrics) || list[0];
        if (best.syncedLyrics) {
          const synced = parseLrcToSynced(best.syncedLyrics);
          if (synced) {
            const res = { synced, plain: best.plainLyrics || null, source: "LRCLIB Search", wordSynced: true };
            try { fs.writeFileSync(cachePath, JSON.stringify(res), "utf8"); } catch {}
            return res;
          }
        }
      }
    }
  } catch (e) {
    console.warn("[lyrics] LRCLIB search error:", e.message);
  }

  // Tier 4: YouTube transcript captions
  if (id && !id.startsWith("local:")) {
    try {
      const yt = await music.getYT();
      const info = await yt.getInfo(id);
      const transcriptData = await info.getTranscript().catch(() => null);
      if (transcriptData?.transcript?.content?.body?.initial_segments) {
        const segs = transcriptData.transcript.content.body.initial_segments;
        const synced = [];
        for (const seg of segs) {
          const startMs = Number(seg.start_ms);
          const endMs = Number(seg.end_ms);
          const text = seg.snippet?.text?.trim();
          if (text) {
            const time = startMs / 1000;
            const end = endMs / 1000;
            const words = text.split(/\s+/).filter(Boolean);
            const dur = end - time;
            synced.push({
              time,
              end,
              text,
              words: words.map((w, i) => ({
                text: w,
                start: time + (dur * i) / words.length,
                end: time + (dur * (i + 1)) / words.length,
              })),
            });
          }
        }
        if (synced.length > 0) {
          const res = { synced, plain: synced.map((s) => s.text).join("\n"), source: "YouTube Captions", wordSynced: true };
          try { fs.writeFileSync(cachePath, JSON.stringify(res), "utf8"); } catch {}
          return res;
        }
      }
    } catch {}
  }

  return { synced: null, plain: null };
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Range, Authorization");
  res.setHeader("Access-Control-Expose-Headers", "Content-Range, Content-Length, Accept-Ranges");
}

function sendJson(res, data, status = 200) {
  setCors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

async function handleStream(req, res, url) {
  setCors(res);
  const trackId = url.searchParams.get("id");
  const localId = url.searchParams.get("lid");
  const range = req.headers.range;

  if (!trackId && !localId) {
    res.writeHead(400);
    res.end("Missing track id");
    return;
  }

  // Handle local track streaming if requested
  if (localId) {
    const track = locallib.localTrackById(localId);
    if (!track || !fs.existsSync(track.path)) {
      res.writeHead(404);
      res.end("Local track not found");
      return;
    }
    const stat = fs.statSync(track.path);
    const size = stat.size;
    let start = 0;
    let end = size - 1;
    let status = 200;

    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (match) {
        if (match[1] === "") {
          start = size - parseInt(match[2], 10);
        } else {
          start = parseInt(match[1], 10);
          end = match[2] ? parseInt(match[2], 10) : size - 1;
        }
        status = 206;
      }
    }

    res.writeHead(status, {
      "Content-Type": "audio/mpeg",
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    });

    const stream = fs.createReadStream(track.path, { start, end });
    stream.pipe(res);
    return;
  }

  // Handle metadata query
  if (url.searchParams.get("meta") === "1") {
    try {
      const meta = await music.resolveStream(trackId, false);
      sendJson(res, { lufs: meta.lufs });
    } catch {
      sendJson(res, { lufs: null });
    }
    return;
  }

  // Handle YouTube stream resolution and proxy
  try {
    const retry = url.searchParams.has("retry");
    let streamInfo = await music.resolveStream(trackId, retry);
    const headers = { "User-Agent": UA };
    if (range) headers.Range = range;

    let upstream = await fetch(streamInfo.url, { headers });
    if (upstream.status === 403) {
      console.warn(`[somusic] 403 for ${trackId}, retrying...`);
      streamInfo = await music.resolveStream(trackId, true);
      upstream = await fetch(streamInfo.url, { headers });
    }

    const resHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
      "Accept-Ranges": "bytes",
    };
    if (upstream.headers.get("content-type")) resHeaders["Content-Type"] = upstream.headers.get("content-type");
    if (upstream.headers.get("content-length")) resHeaders["Content-Length"] = upstream.headers.get("content-length");
    if (upstream.headers.get("content-range")) resHeaders["Content-Range"] = upstream.headers.get("content-range");

    res.writeHead(upstream.status, resHeaders);

    const reader = upstream.body.getReader();
    req.on("close", () => {
      reader.cancel().catch(() => {});
    });

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    console.error(`[somusic] Stream proxy error for ${trackId}:`, err);
    if (!res.headersSent) {
      res.writeHead(502);
      res.end("Stream resolution failed");
    }
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  const pathname = url.pathname;

  // Serve production web frontend for non-API routes
  if (!pathname.startsWith("/api") && !pathname.startsWith("/stream")) {
    if (serveStatic(req, res, pathname)) return;
  }

  try {
    // Audio stream route
    if (pathname === "/api/stream" || pathname === "/stream") {
      await handleStream(req, res, url);
      return;
    }

    // Music API routes
    if (pathname === "/api/music/search") {
      const q = url.searchParams.get("q") || "";
      const light = url.searchParams.get("light") === "1";
      const results = await music.search(q, light);
      sendJson(res, results);
      return;
    }

    if (pathname === "/api/music/searchPage") {
      const q = url.searchParams.get("q") || "";
      const filter = url.searchParams.get("filter") || "songs";
      const results = await music.searchPage(q, filter);
      sendJson(res, results);
      return;
    }

    if (pathname === "/api/music/searchMore" && req.method === "POST") {
      const body = await parseBody(req);
      const results = await music.searchMore(body.token, body.filter);
      sendJson(res, results);
      return;
    }

    if (pathname === "/api/music/suggestions") {
      const q = url.searchParams.get("q") || "";
      const suggestions = await music.getSuggestions(q);
      sendJson(res, suggestions);
      return;
    }

    if (pathname === "/api/music/home") {
      const home = await music.getHome();
      sendJson(res, home);
      return;
    }

    if (pathname === "/api/music/charts") {
      const charts = await music.getCharts();
      sendJson(res, charts);
      return;
    }

    if (pathname === "/api/music/moods") {
      const moods = await music.getMoods();
      sendJson(res, moods);
      return;
    }

    if (pathname === "/api/music/moodCovers") {
      const browseId = url.searchParams.get("browseId") || "";
      const params = url.searchParams.get("params") || "";
      const covers = await music.getMoodCovers(browseId, params);
      sendJson(res, covers);
      return;
    }

    if (pathname === "/api/music/moodPage") {
      const browseId = url.searchParams.get("browseId") || "";
      const params = url.searchParams.get("params") || "";
      const page = await music.getMoodPage(browseId, params);
      sendJson(res, page);
      return;
    }

    if (pathname === "/api/music/album") {
      const id = url.searchParams.get("id") || "";
      const album = await music.getAlbum(id);
      sendJson(res, album);
      return;
    }

    if (pathname === "/api/music/artist") {
      const id = url.searchParams.get("id") || "";
      const artist = await music.getArtistPage(id);
      sendJson(res, artist);
      return;
    }

    if (pathname === "/api/music/playlist") {
      const id = url.searchParams.get("id") || "";
      const playlist = await music.getPlaylist(id);
      sendJson(res, playlist);
      return;
    }

    if (pathname === "/api/music/playlistPage") {
      const id = url.searchParams.get("id") || "";
      const page = await music.getPlaylistPage(id);
      sendJson(res, page);
      return;
    }

    if (pathname === "/api/music/radio") {
      const id = url.searchParams.get("id") || "";
      const token = url.searchParams.get("token") || undefined;
      const radio = await music.getRadio(id, token);
      sendJson(res, radio);
      return;
    }

    if (pathname === "/api/music/lyrics") {
      let track = {};
      if (req.method === "POST") {
        track = await parseBody(req);
      } else {
        track = {
          id: url.searchParams.get("id") || "",
          title: url.searchParams.get("title") || "",
          artist: url.searchParams.get("artist") || "",
          album: url.searchParams.get("album") || "",
          duration: Number(url.searchParams.get("duration")) || 0,
        };
      }
      const lyrics = await fetchLyricsMultiTier(track, DATA_DIR);
      sendJson(res, lyrics);
      return;
    }

    // Spotify Public Playlist Importer API
    if (pathname === "/api/spotify/public-playlist") {
      try {
        const inputUrl = url.searchParams.get("url") || url.searchParams.get("id") || "";
        const playlistId = sp.spotifyPlaylistId(inputUrl);
        if (!playlistId) {
          sendJson(res, { error: "Invalid Spotify playlist link or ID" }, 400);
          return;
        }
        const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
        const resp = await fetch(embedUrl, {
          headers: { "User-Agent": UA },
        });
        if (!resp.ok) {
          sendJson(res, { error: `Spotify returned HTTP ${resp.status}` }, resp.status);
          return;
        }
        const html = await resp.text();
        const parsed = sp.parseEmbedPage(html);
        sendJson(res, parsed);
      } catch (err) {
        console.error("[spotify] Public playlist import error:", err);
        sendJson(res, { error: err.message || "Failed to load Spotify playlist" }, 500);
      }
      return;
    }

    // Local library save/update API
    if (pathname === "/api/library/save" && req.method === "POST") {
      const body = await parseBody(req);
      const filePath = path.join(DATA_DIR, "local-library.json");
      fs.writeFileSync(filePath, JSON.stringify(body, null, 2), "utf8");
      sendJson(res, { ok: true, count: body.tracks?.length || 0 });
      return;
    }

    if (pathname === "/api/music/enrich" && req.method === "POST") {
      const body = await parseBody(req);
      const durations = await music.enrichDurations(body.ids || []);
      sendJson(res, durations);
      return;
    }

    if (pathname === "/api/music/stream-url") {
      const id = url.searchParams.get("id") || "";
      sendJson(res, { url: `http://127.0.0.1:${PORT}/api/stream?id=${encodeURIComponent(id)}` });
      return;
    }

    // Persistence API
    if (pathname.startsWith("/api/data/")) {
      const key = pathname.replace("/api/data/", "");
      const filePath = path.join(DATA_DIR, `${key}.json`);
      if (req.method === "GET") {
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, "utf8");
          sendJson(res, JSON.parse(content));
        } else {
          sendJson(res, null);
        }
        return;
      }
      if (req.method === "POST") {
        const body = await parseBody(req);
        fs.writeFileSync(filePath, JSON.stringify(body, null, 2), "utf8");
        sendJson(res, { ok: true });
        return;
      }
    }

    // Auth session
    if (pathname === "/api/auth/session") {
      sendJson(res, {
        mode: "guest",
        userId: "guest-user",
        username: "Guest",
        displayName: "Music Lover",
        freshInstall: false,
        needsUsername: false,
      });
      return;
    }

    // Local library
    if (pathname === "/api/library/get") {
      const lib = locallib.readLocalLibrary();
      sendJson(res, lib);
      return;
    }

    if (pathname === "/api/library/scan") {
      const lib = await locallib.scanLibrary(true);
      sendJson(res, lib);
      return;
    }

    // Default 404
    res.writeHead(404);
    res.end("Not Found");
  } catch (err) {
    console.error(`[somusic] Error handling ${pathname}:`, err);
    sendJson(res, { error: err.message }, 500);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[somusic] Server running on http://${HOST}:${PORT}`);
});
