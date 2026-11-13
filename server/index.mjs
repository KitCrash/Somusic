/**
 * SoMusic Web Player & Mobile API Streaming Backend
 * Runs in pure Node.js on port 3001
 */
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as music from "./music-service.mjs";
import * as locallib from "./local-library.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const DATA_DIR = path.join(__dirname, ".data");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

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
    req.on("data", chunk => { body += chunk; });
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
      console.warn(`[bytune-web] 403 for ${trackId}, retrying...`);
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
    console.error(`[bytune-web] Stream proxy error for ${trackId}:`, err);
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

  try {
    // Audio stream route
    if (pathname === "/api/stream" || pathname === "/stream") {
      await handleStream(req, res, url);
      return;
    }

    // Music API routes
    if (pathname === "/api/music/search") {
      const q = url.searchParams.get("q") || "";
      const results = await music.searchAll(q);
      sendJson(res, results);
      return;
    }

    if (pathname === "/api/music/searchPage") {
      const q = url.searchParams.get("q") || "";
      const filter = url.searchParams.get("filter") || "all";
      const results = await music.searchPage(q, filter);
      sendJson(res, results);
      return;
    }

    if (pathname === "/api/music/searchMore" && req.method === "POST") {
      const body = await parseBody(req);
      const results = await music.searchMore(body.token, body.filter || "all");
      sendJson(res, results);
      return;
    }

    if (pathname === "/api/music/suggestions") {
      const q = url.searchParams.get("q") || "";
      const items = await music.getSuggestions(q);
      sendJson(res, { items });
      return;
    }

    if (pathname === "/api/music/home") {
      const shelves = await music.getHome();
      sendJson(res, shelves);
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

    if (pathname === "/api/music/lyrics" && req.method === "POST") {
      const track = await parseBody(req);
      const lyrics = await music.getLyrics(track);
      sendJson(res, lyrics);
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
    console.error(`[bytune-web] Error handling ${pathname}:`, err);
    sendJson(res, { error: err.message }, 500);
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[bytune-web] Backend server running on http://127.0.0.1:${PORT}`);
});
