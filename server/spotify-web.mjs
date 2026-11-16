// electron/spotify-web.ts
import { createHmac } from "node:crypto";
var SpotifyFormatError = class extends Error {
};
var obj = (v) => v && typeof v === "object" && !Array.isArray(v) ? v : null;
var arr = (v) => Array.isArray(v) ? v : [];
var str = (v) => typeof v === "string" && v.trim() ? v.trim() : void 0;
var num = (v) => typeof v === "number" && Number.isFinite(v) ? v : void 0;
var at = (v, ...keys) => keys.reduce((o, k) => obj(o)?.[k], v);
var ID = /^[A-Za-z0-9]{22}$/;
function spotifyPlaylistId(input) {
  const text = input.trim();
  const uri = /^spotify:(?:user:[^:\s]+:)?playlist:([A-Za-z0-9]{22})$/.exec(text);
  if (uri) return uri[1];
  let url;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol) || !/(^|\.)spotify\.com$/i.test(url.hostname)) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const id = parts[parts.indexOf("playlist") + 1];
  return parts.includes("playlist") && id && ID.test(id) ? id : null;
}
function isSpotifyShortLink(input) {
  return /^https:\/\/spotify\.link\/[A-Za-z0-9]{6,20}\/?$/.test(input.trim());
}
function largest(sources) {
  let best;
  for (const s of arr(sources)) {
    const url = str(at(s, "url"));
    const width = num(at(s, "width")) ?? 0;
    if (url?.startsWith("https://") && (!best || width > best.width)) best = { url, width };
  }
  return best?.url;
}
function sized(sources, min = 300) {
  const list = arr(sources).map((s) => ({ url: str(at(s, "url")), width: num(at(s, "width")) ?? 0 })).filter((s) => !!s.url?.startsWith("https://")).sort((a, b) => a.width - b.width);
  return (list.find((s) => s.width >= min) ?? list.at(-1))?.url;
}
var trackId = (uri) => /^spotify:track:([A-Za-z0-9]{22})$/.exec(str(uri) ?? "")?.[1];
var seconds = (ms) => {
  const n = num(ms);
  return n && n > 0 && n < 864e5 ? Math.round(n / 1e3) : 0;
};
function songOf(data, uri) {
  const title = str(at(data, "name"));
  const spotifyId = trackId(uri) ?? trackId(at(data, "uri"));
  if (!title || !spotifyId) return null;
  const artist = arr(at(data, "artists", "items")).map((a) => str(at(a, "profile", "name"))).filter(Boolean).join(", ");
  const album = obj(at(data, "albumOfTrack"));
  return {
    spotifyId,
    title,
    artist,
    ...str(album?.name) ? { album: str(album?.name) } : {},
    duration: seconds(at(data, "trackDuration", "totalMilliseconds") ?? at(data, "duration", "totalMilliseconds")),
    ...sized(at(album, "coverArt", "sources")) ? { thumb: sized(at(album, "coverArt", "sources")) } : {},
    ...at(data, "contentRating", "label") === "EXPLICIT" ? { explicit: true } : {}
  };
}
function parseEmbedPage(html) {
  const data = /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/.exec(html)?.[1];
  if (!data) throw new SpotifyFormatError("The Spotify page had no playlist data");
  let root;
  try {
    root = JSON.parse(data);
  } catch {
    throw new SpotifyFormatError("The Spotify page's playlist data didn't read");
  }
  const state = at(root, "props", "pageProps", "state");
  const entity = obj(at(state, "data", "entity"));
  if (!entity) throw new SpotifyFormatError("That playlist is private or no longer exists");
  const songs = arr(entity.trackList).flatMap((t) => {
    const title = str(at(t, "title"));
    const spotifyId = trackId(at(t, "uri"));
    if (!title || !spotifyId) return [];
    return [
      {
        spotifyId,
        title,
        artist: str(at(t, "subtitle")) ?? "",
        duration: seconds(at(t, "duration")),
        ...at(t, "isExplicit") === true ? { explicit: true } : {}
      }
    ];
  });
  return {
    name: str(entity.name) ?? str(entity.title) ?? "Spotify playlist",
    ...str(entity.subtitle) ? { owner: str(entity.subtitle) } : {},
    ...largest(at(entity, "coverArt", "sources")) ? { thumb: largest(at(entity, "coverArt", "sources")) } : {},
    songs,
    total: songs.length,
    token: str(at(state, "settings", "session", "accessToken")) ?? null
  };
}
function parsePlaylistPage(json) {
  const p = obj(at(json, "data", "playlistV2"));
  const content = obj(p?.content);
  if (!p || !content) throw new SpotifyFormatError("Spotify's playlist answer didn't read");
  const songs = arr(content.items).flatMap((item) => {
    const data = at(item, "itemV2", "data");
    const song = at(data, "__typename") === "Track" ? songOf(data, at(data, "uri")) : null;
    return song ? [song] : [];
  });
  return {
    name: str(p.name) ?? "Spotify playlist",
    ...str(at(p, "ownerV2", "data", "name")) ? { owner: str(at(p, "ownerV2", "data", "name")) } : {},
    ...largest(at(arr(at(p, "images", "items"))[0], "sources")) ? { thumb: largest(at(arr(at(p, "images", "items"))[0], "sources")) } : {},
    songs,
    total: num(content.totalCount) ?? songs.length
  };
}
function parseLikedPage(json) {
  const tracks = obj(at(json, "data", "me", "library", "tracks"));
  if (!tracks) throw new SpotifyFormatError("Spotify's liked songs answer didn't read");
  const songs = arr(tracks.items).flatMap((item) => {
    const wrapper = at(item, "track");
    const song = songOf(at(wrapper, "data"), at(wrapper, "_uri"));
    return song ? [song] : [];
  });
  return { name: "Liked Songs", songs, total: num(tracks.totalCount) ?? songs.length };
}
function parseLibraryPage(json) {
  const library = obj(at(json, "data", "me", "libraryV3"));
  if (!library) throw new SpotifyFormatError("Spotify's library answer didn't read");
  const items = arr(library.items);
  const playlists = items.flatMap((entry) => {
    const wrapper = obj(at(entry, "item"));
    const data = obj(wrapper?.data);
    const id = /^spotify:playlist:([A-Za-z0-9]{22})$/.exec(str(wrapper?._uri) ?? "")?.[1];
    const name = str(data?.name);
    if (data?.__typename !== "Playlist" || !id || !name) return [];
    const thumb = largest(at(arr(at(data, "images", "items"))[0], "sources"));
    const owner = str(at(data, "ownerV2", "data", "name"));
    return [{ id, name, ...owner ? { owner } : {}, ...thumb ? { thumb } : {} }];
  });
  return { playlists, total: num(library.totalCount) ?? items.length, read: items.length };
}
function parseProfileName(json) {
  const profile = obj(at(json, "data", "me", "profile"));
  if (!profile) throw new SpotifyFormatError("Spotify's profile answer didn't read");
  return str(profile.name) ?? str(profile.username) ?? "Spotify";
}
function playerScriptUrl(html) {
  return /https:\/\/open\.spotifycdn\.com\/cdn\/build\/web-player\/web-player\.[0-9a-f]+\.js/.exec(html)?.[0] ?? null;
}
function unescapeJs(body) {
  return body.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|[\s\S])/g, (_, esc) => {
    if (esc[0] === "u" && esc.length > 1) return String.fromCodePoint(parseInt(esc.replace(/[u{}]/g, ""), 16));
    if (esc[0] === "x" && esc.length === 3) return String.fromCharCode(parseInt(esc.slice(1), 16));
    return { n: "\n", r: "\r", t: "	", b: "\b", f: "\f", v: "\v", "0": "\0" }[esc] ?? esc;
  });
}
function playerSecret(script) {
  const found = [...script.matchAll(/\{secret:(['"])((?:\\.|(?!\1).)*)\1,version:(\d+)\}/g)].map((m) => ({
    version: Number(m[3]),
    secret: unescapeJs(m[2])
  }));
  return found.sort((a, b) => b.version - a.version)[0] ?? null;
}
function queryHash(script, operation) {
  return new RegExp(`["']${operation}["']\\s*,\\s*["']query["']\\s*,\\s*["']([0-9a-f]{64})["']`).exec(script)?.[1] ?? null;
}
function parseTrackSearch(json) {
  return arr(at(json, "data", "searchV2", "tracksV2", "items")).flatMap((item) => {
    const d = at(item, "item", "data");
    const uri = str(at(d, "uri"));
    const name = str(at(d, "name"));
    if (!uri?.startsWith("spotify:track:") || !name) return [];
    const artists = arr(at(d, "artists", "items")).flatMap((a) => str(at(a, "profile", "name")) ?? []);
    return [{ uri, name, artists, album: str(at(d, "albumOfTrack", "name")) ?? "" }];
  });
}
var canvasVideo = (url) => url?.startsWith("https://") && /\.mp4(?:[?#]|$)/i.test(url) ? url : null;
function parseCanvasAnswer(json) {
  return canvasVideo(str(at(json, "data", "trackUnion", "canvas", "url")));
}
function varint(n) {
  const out = [];
  for (; n > 127; n >>>= 7) out.push(n & 127 | 128);
  return [...out, n];
}
var field1 = (bytes) => Uint8Array.from([10, ...varint(bytes.length), ...bytes]);
function canvazRequest(trackUri) {
  return field1(field1(new TextEncoder().encode(trackUri)));
}
function* protoFields(bytes) {
  let i = 0;
  const read = () => {
    let n = 0;
    for (let shift = 0; ; shift += 7) {
      if (i >= bytes.length || shift > 49) throw new SpotifyFormatError("truncated protobuf");
      const b = bytes[i++];
      n += (b & 127) * 2 ** shift;
      if (b < 128) return n;
    }
  };
  while (i < bytes.length) {
    const tag = read();
    const wire = tag % 8;
    if (wire === 0) yield [Math.floor(tag / 8), read()];
    else if (wire === 2) {
      const len = read();
      if (i + len > bytes.length) throw new SpotifyFormatError("truncated protobuf");
      yield [Math.floor(tag / 8), bytes.subarray(i, i + len)];
      i += len;
    } else if (wire === 1) i += 8;
    else if (wire === 5) i += 4;
    else throw new SpotifyFormatError(`protobuf wire type ${wire}`);
  }
}
function canvazClip(bytes, trackUri) {
  const hits = [];
  const text = (b) => typeof b === "number" ? void 0 : new TextDecoder().decode(b);
  try {
    for (const [n, canvas] of protoFields(bytes)) {
      if (n !== 1 || typeof canvas === "number") continue;
      const hit = {};
      for (const [f, v] of protoFields(canvas)) {
        if (f === 2) hit.url = text(v);
        else if (f === 5) hit.track = text(v);
      }
      if (hit.url) hits.push({ url: hit.url, track: hit.track });
    }
  } catch {
  }
  const url = (hits.find((h) => h.track === trackUri) ?? hits[0])?.url ?? /https:\/\/[^"'\s\x00-\x1F]+\.cnvs\.mp4/.exec(new TextDecoder("latin1").decode(bytes))?.[0];
  return canvasVideo(url);
}
function hotp(key, counter) {
  const block = Buffer.alloc(8);
  block.writeBigUInt64BE(counter);
  const h = createHmac("sha1", key).update(block).digest();
  const o = h[h.length - 1] & 15;
  const code = (h[o] & 127) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3];
  return String(code % 1e6).padStart(6, "0");
}
function playerTotp(secret, epochMs) {
  const key = Buffer.from([...secret].map((c, i) => c.charCodeAt(0) ^ i % 33 + 9).join(""), "utf8");
  return hotp(key, BigInt(Math.floor(epochMs / 3e4)));
}
export {
  SpotifyFormatError,
  canvazClip,
  canvazRequest,
  hotp,
  isSpotifyShortLink,
  parseCanvasAnswer,
  parseEmbedPage,
  parseLibraryPage,
  parseLikedPage,
  parsePlaylistPage,
  parseProfileName,
  parseTrackSearch,
  playerScriptUrl,
  playerSecret,
  playerTotp,
  queryHash,
  spotifyPlaylistId
};
