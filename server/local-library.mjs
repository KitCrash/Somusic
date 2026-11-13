// electron-mock.mjs
var app = {
  getLocaleCountryCode: () => "US",
  isPackaged: false,
  getLocale: () => "en-US",
  getPath: (name) => "./.data"
};

// electron/local-library.ts
import * as crypto from "crypto";
import * as fs2 from "fs";
import * as path3 from "path";

// electron/persist.ts
import * as fs from "fs";
import * as path from "path";
function dataDir() {
  const dir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dir, { recursive: true });
  sweepTmpFiles(dir);
  return dir;
}
var lastSweep = 0;
function sweepTmpFiles(dir) {
  const now = Date.now();
  if (now - lastSweep < 5 * 60 * 1e3) return;
  lastSweep = now;
  try {
    for (const f of fs.readdirSync(dir)) {
      if (f.endsWith(".tmp") && !activeTemps.has(path.join(dir, f))) {
        try {
          fs.unlinkSync(path.join(dir, f));
        } catch {
        }
      }
    }
  } catch {
  }
}
function safeName(name) {
  const clean = name.replace(/[^a-zA-Z0-9_-]/g, "");
  return clean || "store";
}
function readData(name) {
  const file = path.join(dataDir(), `${safeName(name)}.json`);
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch {
    return null;
  }
}
async function writeAtomic(file, json, current) {
  if (!current()) return;
  const tmp = `${file}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  activeTemps.add(tmp);
  try {
    await fs.promises.writeFile(tmp, json, "utf-8");
    for (let attempt = 0; attempt < 4; attempt++) {
      if (!current()) return;
      try {
        fs.renameSync(tmp, file);
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
      }
    }
    if (current()) fs.copyFileSync(tmp, file);
  } finally {
    try {
      await fs.promises.unlink(tmp);
    } catch {
    }
    activeTemps.delete(tmp);
  }
}
var pendingWrites = /* @__PURE__ */ new Map();
var activeTemps = /* @__PURE__ */ new Set();
var syncVersions = /* @__PURE__ */ new Map();
var resetGeneration = 0;
var resetting = false;
async function writeData(name, data) {
  if (resetting) throw new Error("App data reset in progress");
  const dir = dataDir();
  const file = path.join(dir, `${safeName(name)}.json`);
  const json = JSON.stringify(data);
  const previous = pendingWrites.get(file) ?? Promise.resolve();
  const generation = resetGeneration;
  const syncVersion = syncVersions.get(file) ?? 0;
  const current = () => !resetting && generation === resetGeneration && syncVersion === (syncVersions.get(file) ?? 0);
  const write = previous.catch(() => void 0).then(() => writeAtomic(file, json, current));
  pendingWrites.set(file, write);
  try {
    await write;
  } finally {
    if (pendingWrites.get(file) === write) pendingWrites.delete(file);
  }
}

// electron/local-paths.ts
function isUnderPath(child, root) {
  const c = String(child ?? "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  const r = String(root ?? "").replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
  if (!c || !r) return false;
  if (c === r) return true;
  return c.startsWith(r + "/");
}

// electron/audio-types.ts
import * as path2 from "path";
var PLAYABLE_AUDIO = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".webm": "audio/webm"
};
var UNPLAYABLE_BY_EXT = { ".wma": "WMA", ".aiff": "AIFF", ".aif": "AIFF", ".aifc": "AIFF" };
var ext = (file) => path2.extname(file).toLowerCase();
function isPlayableAudio(file) {
  return Object.hasOwn(PLAYABLE_AUDIO, ext(file));
}
function isKnownAudio(file) {
  return isPlayableAudio(file) || Object.hasOwn(UNPLAYABLE_BY_EXT, ext(file));
}
function unplayableFormat(file, codec) {
  if (codec === "alac") return "ALAC";
  return UNPLAYABLE_BY_EXT[ext(file)] ?? null;
}

// electron/local-library.ts
var MIN_DURATION_SEC = 30;
var MAX_FOLDERS = 200;
var MAX_WALK_DEPTH = 8;
var NON_MUSIC_PATHS = [
  "recordings",
  "voice recorder",
  "sound_recorder",
  "voicenotes",
  "whatsapp voice notes",
  "telegram",
  "screen recorder",
  "call recordings",
  "call_rec",
  "alarms",
  "notifications",
  "ringtones",
  "podcasts",
  "audiobooks"
];
var NON_MUSIC_NAMES = ["voice", "recording", "record_", "call_", "memo", "note", "audio_", "clip"];
function hashPath(p) {
  return crypto.createHash("sha1").update(p.toLowerCase()).digest("hex").slice(0, 16);
}
function normalizeFolderPath(p) {
  if (typeof p !== "string" || !p.trim()) return null;
  try {
    const abs = path3.resolve(p.trim());
    const root = path3.parse(abs).root;
    return abs.length === root.length ? root : abs.replace(/[\\/]+$/, "");
  } catch {
    return null;
  }
}
function folderKey(p) {
  return p.toLowerCase();
}
function isNonMusic(relPath, fileName) {
  const rp = relPath.toLowerCase();
  if (NON_MUSIC_PATHS.some((frag) => rp.includes(frag))) return true;
  const name = fileName.toLowerCase();
  return NON_MUSIC_NAMES.some((frag) => name.startsWith(frag) || name.includes(` ${frag} `));
}
function titleFromFile(fileName) {
  const stem = fileName.replace(/\.[^.]+$/, "").replace(/_/g, " ").trim();
  const dash = /^(.*?)\s*[-–]\s*(.+)$/.exec(stem);
  if (dash && dash[1] && dash[2]) {
    return { artist: dash[1].trim(), title: dash[2].trim() };
  }
  return { title: stem };
}
function toFolderEntry(raw) {
  if (typeof raw === "string") {
    const norm = normalizeFolderPath(raw);
    return norm ? { path: norm, name: path3.basename(norm) || norm, addedAt: 0 } : null;
  }
  if (raw && typeof raw === "object") {
    const o = raw;
    const norm = normalizeFolderPath(typeof o.path === "string" ? o.path : "");
    if (!norm) return null;
    const entry = {
      path: norm,
      name: typeof o.name === "string" && o.name.trim() ? o.name : path3.basename(norm) || norm,
      addedAt: typeof o.addedAt === "number" ? o.addedAt : 0
    };
    if (typeof o.displayName === "string" && o.displayName.trim()) entry.displayName = o.displayName;
    return entry;
  }
  return null;
}
var cachedRawLibrary = null;
var cachedLibraryGeneration = -1;
function readRawLibrary() {
  if (cachedLibraryGeneration === libraryGeneration && cachedRawLibrary) return cachedRawLibrary;
  const raw = readData("local-library");
  cachedRawLibrary = raw && Array.isArray(raw.tracks) ? raw : null;
  cachedLibraryGeneration = libraryGeneration;
  return cachedRawLibrary;
}
function readLocalLibrary() {
  const raw = readRawLibrary();
  if (raw && Array.isArray(raw.tracks)) {
    const byKey = /* @__PURE__ */ new Map();
    for (const f of (Array.isArray(raw.folders) ? raw.folders : []).map(toFolderEntry)) {
      if (f && !byKey.has(folderKey(f.path))) byKey.set(folderKey(f.path), f);
    }
    return {
      folders: [...byKey.values()],
      scannedAt: typeof raw.scannedAt === "number" ? raw.scannedAt : 0,
      tracks: raw.tracks,
      ...Array.isArray(raw.unplayable) ? { unplayable: raw.unplayable } : {}
    };
  }
  return { folders: [], scannedAt: 0, tracks: [] };
}
var writeChain = Promise.resolve();
var mutationChain = Promise.resolve();
var libraryGeneration = 0;
function mutateLibrary(work) {
  const generation = libraryGeneration;
  const result = mutationChain.catch(() => void 0).then(() => {
    checkGeneration(generation);
    return work();
  });
  mutationChain = result;
  return result;
}
function checkGeneration(generation) {
  if (generation !== libraryGeneration) throw new Error("Local library operation cancelled by reset");
}
function saveLocalLibrary(lib, generation = libraryGeneration) {
  const write = writeChain.then(() => {
    checkGeneration(generation);
    return writeData("local-library", lib);
  });
  writeChain = write.catch((err) => console.warn("[bytune] local-library save failed:", err));
  void write.then(() => {
    if (generation === libraryGeneration) {
      cachedRawLibrary = lib;
      cachedLibraryGeneration = generation;
    }
  });
  return write;
}
async function resetLocalLibrary() {
  libraryGeneration += 1;
  openedCache = null;
  await writeChain;
}
function newFolderEntry(norm) {
  return { path: norm, name: path3.basename(norm) || norm, addedAt: Date.now() };
}
function isDirectory(p) {
  try {
    return fs2.statSync(p).isDirectory();
  } catch {
    return false;
  }
}
function containsAudio(dir, root, depth) {
  if (depth > MAX_WALK_DEPTH) return false;
  let entries;
  try {
    entries = fs2.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const abs = path3.join(dir, e.name);
    if (e.isDirectory()) {
      if (containsAudio(abs, root, depth + 1)) return true;
    } else if (e.isFile() && isPlayableAudio(e.name)) {
      if (!isNonMusic(path3.relative(root, abs).replace(/\\/g, "/"), e.name)) return true;
    }
  }
  return false;
}
function musicSubfolders(root) {
  let entries;
  try {
    entries = fs2.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const e of entries) {
    if (e.name.startsWith(".") || !e.isDirectory()) continue;
    const abs = path3.join(root, e.name);
    if (containsAudio(abs, abs, 0)) out.push(abs);
  }
  return out.sort((a, b) => a.localeCompare(b));
}
function addLibraryFolders(paths) {
  return mutateLibrary(() => addLibraryFoldersExclusive(paths));
}
async function addLibraryFoldersExclusive(paths) {
  const lib = readLocalLibrary();
  const existing = new Set(lib.folders.map((f) => folderKey(f.path)));
  const added = [];
  const skipped = [];
  const list = Array.isArray(paths) ? paths.slice(0, MAX_FOLDERS) : [];
  const store = (norm) => {
    const key = folderKey(norm);
    if (existing.has(key) || lib.folders.length >= MAX_FOLDERS) {
      skipped.push(norm);
      return;
    }
    const entry = newFolderEntry(norm);
    lib.folders.push(entry);
    existing.add(key);
    added.push(entry);
  };
  for (const raw of list) {
    const norm = normalizeFolderPath(typeof raw === "string" ? raw : "");
    if (!norm || !isDirectory(norm)) {
      if (norm) skipped.push(norm);
      continue;
    }
    const before = added.length;
    store(norm);
    if (added.length > before || existing.has(folderKey(norm))) {
      for (const sub of musicSubfolders(norm)) store(sub);
    }
  }
  if (added.length > 0) await saveLocalLibrary(lib);
  return { lib, added, skipped };
}
function renameLibraryFolder(p, displayName) {
  return mutateLibrary(() => renameLibraryFolderExclusive(p, displayName));
}
async function renameLibraryFolderExclusive(p, displayName) {
  const lib = readLocalLibrary();
  const norm = normalizeFolderPath(p);
  const entry = norm ? lib.folders.find((f) => folderKey(f.path) === folderKey(norm)) : void 0;
  if (entry) {
    const name = typeof displayName === "string" ? displayName.trim().slice(0, 80) : "";
    if (name) entry.displayName = name;
    else delete entry.displayName;
    await saveLocalLibrary(lib);
  }
  return lib;
}
function removeLibraryFolder(p) {
  return mutateLibrary(() => removeLibraryFolderExclusive(p));
}
async function removeLibraryFolderExclusive(p) {
  const lib = readLocalLibrary();
  const norm = normalizeFolderPath(p);
  if (!norm) return lib;
  const key = folderKey(norm);
  if (!lib.folders.some((f) => folderKey(f.path) === key)) return lib;
  lib.folders = lib.folders.filter((f) => folderKey(f.path) !== key);
  lib.tracks = lib.tracks.filter((t) => lib.folders.some((f) => isUnderPath(t.path, f.path)));
  await saveLocalLibrary(lib);
  return lib;
}
function folderStatuses() {
  return readLocalLibrary().folders.map((f) => ({ path: f.path, exists: isDirectory(f.path) }));
}
function setLibraryFolders(folders) {
  return mutateLibrary(() => setLibraryFoldersExclusive(folders));
}
async function setLibraryFoldersExclusive(folders) {
  const lib = readLocalLibrary();
  const byKey = new Map(lib.folders.map((f) => [folderKey(f.path), f]));
  const next = [];
  for (const f of Array.isArray(folders) ? folders : []) {
    const norm = normalizeFolderPath(typeof f === "string" ? f : "");
    if (!norm || !isDirectory(norm)) continue;
    const key = folderKey(norm);
    if (next.some((e) => folderKey(e.path) === key)) continue;
    next.push(byKey.get(key) ?? newFolderEntry(norm));
  }
  lib.folders = next;
  lib.tracks = lib.tracks.filter((t) => next.some((e) => isUnderPath(t.path, e.path)));
  await saveLocalLibrary(lib);
  return lib;
}
var artDirEnsured = false;
function extractArt(hash, picture, refresh) {
  const MAX_ART_BYTES = 8 * 1024 * 1024;
  if (!picture?.data?.length || picture.data.length > MAX_ART_BYTES) return void 0;
  try {
    const dir = path3.join(app.getPath("userData"), "local-art");
    if (!artDirEnsured) {
      fs2.mkdirSync(dir, { recursive: true });
      artDirEnsured = true;
    }
    const ext2 = picture.format.includes("png") ? "png" : "jpg";
    const file = path3.join(dir, `${hash}.${ext2}`);
    if (refresh) {
      for (const e of ["jpg", "png"]) {
        try {
          fs2.unlinkSync(path3.join(dir, `${hash}.${e}`));
        } catch {
        }
      }
    }
    if (!fs2.existsSync(file)) fs2.writeFileSync(file, Buffer.from(picture.data));
    return `localart://${hash}.${ext2}`;
  } catch {
    return void 0;
  }
}
var parsedDuration = (value) => typeof value === "number" && Number.isFinite(value) ? Math.round(value) : 0;
async function readTrackFile(abs, stat, stillCurrent = () => void 0) {
  const nameParts = titleFromFile(path3.basename(abs));
  const track = {
    id: `local:${hashPath(abs)}`,
    path: abs,
    title: nameParts.title || path3.basename(abs),
    artist: nameParts.artist ?? "Unknown artist",
    album: "Unknown album",
    duration: 0,
    size: stat.size,
    mtime: Math.floor(stat.mtimeMs)
  };
  try {
    const { parseFile } = await import("music-metadata");
    const meta = await parseFile(abs, { duration: true, skipCovers: false });
    stillCurrent();
    const c = meta.common;
    const bounded = (value) => typeof value === "string" ? value.slice(0, 200) : void 0;
    return {
      ...track,
      title: bounded(c.title?.trim()) || track.title,
      artist: bounded(c.artist?.trim()) || bounded(c.albumartist?.trim()) || track.artist,
      album: bounded(c.album?.trim()) || track.album,
      genre: bounded(c.genre?.[0]),
      duration: parsedDuration(meta.format.duration),
      codec: bounded(meta.format.codec)?.toLowerCase(),
      gainDb: Number.isFinite(c.replaygain_track_gain?.dB) ? c.replaygain_track_gain?.dB : void 0,
      // Re-parsed (mtime changed) → refresh the extracted cover too.
      art: extractArt(hashPath(abs), c.picture?.[0], true)
    };
  } catch {
    stillCurrent();
    return track;
  }
}
async function scanLibrary(filterNonMusic, onProgress) {
  const generation = libraryGeneration;
  const existing = readLocalLibrary();
  const folders = existing.folders;
  const files = [];
  const seen = /* @__PURE__ */ new Set();
  for (const folder of folders) {
    const walk = (dir, depth) => {
      if (depth > MAX_WALK_DEPTH) return;
      let entries;
      try {
        entries = fs2.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (e.name.startsWith(".")) continue;
        const abs = path3.join(dir, e.name);
        if (e.isDirectory()) {
          walk(abs, depth + 1);
        } else if (e.isFile() && isKnownAudio(e.name)) {
          const key = abs.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          files.push({ abs, rel: path3.relative(folder.path, abs) });
        }
      }
    };
    try {
      walk(folder.path, 0);
    } catch {
    }
  }
  const tracks = [];
  const prevByPath = new Map(existing.tracks.map((t) => [t.path, t]));
  const unplayable = /* @__PURE__ */ new Map();
  const leaveOut = (format) => void unplayable.set(format, (unplayable.get(format) ?? 0) + 1);
  let done = 0;
  for (const f of files) {
    checkGeneration(generation);
    done++;
    if (onProgress && done % 10 === 0) onProgress(done, files.length);
    const prev = prevByPath.get(f.abs);
    let stat;
    try {
      stat = fs2.statSync(f.abs);
    } catch {
      continue;
    }
    if (prev && prev.mtime === Math.floor(stat.mtimeMs) && prev.codec !== void 0) {
      const format = unplayableFormat(prev.path, prev.codec);
      if (format) leaveOut(format);
      else tracks.push(prev);
      continue;
    }
    const byExtension = unplayableFormat(f.abs);
    if (byExtension) {
      leaveOut(byExtension);
      continue;
    }
    const track = await readTrackFile(f.abs, stat, () => checkGeneration(generation));
    const byCodec = unplayableFormat(f.abs, track.codec);
    if (byCodec) {
      leaveOut(byCodec);
      continue;
    }
    if (track.duration < MIN_DURATION_SEC) continue;
    if (filterNonMusic && isNonMusic(f.rel.replace(/\\/g, "/"), path3.basename(f.abs))) continue;
    tracks.push(track);
  }
  checkGeneration(generation);
  const lib = {
    folders,
    scannedAt: Date.now(),
    tracks,
    unplayable: [...unplayable].map(([format, count]) => ({ format, count }))
  };
  await mutateLibrary(async () => {
    await saveLocalLibrary({ ...lib, folders: readLocalLibrary().folders }, generation);
  });
  checkGeneration(generation);
  onProgress?.(files.length, files.length);
  return lib;
}
function readArtFile(name) {
  if (!/^[a-f0-9]{16}\.(jpg|png)$/.test(name)) return null;
  try {
    const file = path3.join(app.getPath("userData"), "local-art", name);
    return { data: fs2.readFileSync(file), mime: name.endsWith(".png") ? "image/png" : "image/jpeg" };
  } catch {
    return null;
  }
}
function readLocalArtThumb(thumb) {
  const m = /^localart:\/\/([a-f0-9]{16}\.(jpg|png))$/i.exec(String(thumb ?? "").trim());
  if (!m) return null;
  return readArtFile(m[1].toLowerCase());
}
function localTrackById(id) {
  return readLocalLibrary().tracks.find((t) => t.id === id) ?? openedFiles().find((t) => t.id === id) ?? null;
}
var OPENED_STORE = "opened-files";
var MAX_OPENED = 200;
var openedCache = null;
function openedFiles() {
  if (!openedCache) {
    const raw = readData(OPENED_STORE);
    openedCache = Array.isArray(raw) ? raw.filter((t) => typeof t?.id === "string" && typeof t.path === "string") : [];
  }
  return openedCache;
}
async function saveOpened(list) {
  openedCache = list;
  await writeData(OPENED_STORE, list);
}
async function openFiles(paths) {
  const tracks = [];
  const unplayable = [];
  for (const p of paths) {
    const abs = path3.resolve(p);
    let stat;
    try {
      stat = fs2.statSync(abs);
    } catch {
      continue;
    }
    if (!stat.isFile() || !isKnownAudio(abs)) continue;
    const byExtension = unplayableFormat(abs);
    if (byExtension) {
      unplayable.push(byExtension);
      continue;
    }
    const track = await readTrackFile(abs, stat);
    const byCodec = unplayableFormat(abs, track.codec);
    if (byCodec) unplayable.push(byCodec);
    else if (!tracks.some((t) => t.id === track.id)) tracks.push(track);
  }
  if (tracks.length) {
    const ids = new Set(tracks.map((t) => t.id));
    await saveOpened([...tracks, ...openedFiles().filter((t) => !ids.has(t.id))].slice(0, MAX_OPENED));
  }
  return { tracks, unplayable };
}
async function forgetOpenedFile(id) {
  await saveOpened(openedFiles().filter((t) => t.id !== id));
  return openedFiles();
}
function localStreamPath(id) {
  const t = localTrackById(id);
  if (!t) return null;
  try {
    fs2.accessSync(t.path);
    return t.path;
  } catch {
    return null;
  }
}
export {
  addLibraryFolders,
  folderStatuses,
  forgetOpenedFile,
  localStreamPath,
  localTrackById,
  openFiles,
  openedFiles,
  readArtFile,
  readLocalArtThumb,
  readLocalLibrary,
  removeLibraryFolder,
  renameLibraryFolder,
  resetLocalLibrary,
  scanLibrary,
  setLibraryFolders
};
