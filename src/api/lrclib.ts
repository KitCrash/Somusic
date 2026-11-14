import { LyricsResponse, SyncedLine } from "../types";

export function cleanSongTitle(raw: string): string {
  return raw
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/["“”']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function primaryArtist(raw: string): string {
  return raw.split(/,|&|feat\.|ft\./i)[0].trim();
}

function parseLrc(syncedLyrics: string): SyncedLine[] {
  const lines: SyncedLine[] = [];
  const rawLines = syncedLyrics.split("\n");

  for (const line of rawLines) {
    const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
    if (match) {
      const min = parseInt(match[1]) || 0;
      const sec = parseInt(match[2]) || 0;
      const msStr = match[3];
      const ms = parseFloat(`0.${msStr}`) || 0;
      const text = match[4].trim();

      lines.push({
        time: min * 60 + sec + ms,
        text,
      });
    }
  }

  return lines;
}

export async function fetchLyrics(title: string, artist: string): Promise<LyricsResponse> {
  const cleanT = cleanSongTitle(title);
  const cleanA = primaryArtist(artist);

  // 1. Try exact match
  if (cleanT) {
    try {
      const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(
        cleanT
      )}&artist_name=${encodeURIComponent(cleanA)}`;
      const res = await fetch(url, { headers: { "User-Agent": "SoMusic/1.0.0" } });
      if (res.ok) {
        const json = await res.json();
        const synced = json.syncedLyrics ? parseLrc(json.syncedLyrics) : null;
        const plain = json.plainLyrics || null;
        if (synced || plain) {
          return {
            plain,
            synced,
            source: "LRCLIB",
            wordSynced: false,
          };
        }
      }
    } catch (e) {
      // Continue to search
    }
  }

  // 2. Fuzzy search with Title + Artist
  if (cleanT) {
    try {
      const query = cleanA ? `${cleanT} ${cleanA}` : cleanT;
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(query)}`;
      const res = await fetch(searchUrl, { headers: { "User-Agent": "SoMusic/1.0.0" } });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          for (let i = 0; i < Math.min(5, list.length); i++) {
            const item = list[i];
            const synced = item.syncedLyrics ? parseLrc(item.syncedLyrics) : null;
            const plain = item.plainLyrics || null;
            if (synced || plain) {
              return {
                plain,
                synced,
                source: "LRCLIB",
                wordSynced: false,
              };
            }
          }
        }
      }
    } catch (e) {
      // Continue
    }
  }

  // 3. Search with Title only
  if (cleanT) {
    try {
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(cleanT)}`;
      const res = await fetch(searchUrl, { headers: { "User-Agent": "SoMusic/1.0.0" } });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          const item = list[0];
          const synced = item.syncedLyrics ? parseLrc(item.syncedLyrics) : null;
          const plain = item.plainLyrics || null;
          return {
            plain,
            synced,
            source: "LRCLIB",
            wordSynced: false,
          };
        }
      }
    } catch (e) {
      // Continue
    }
  }

  return { plain: null, synced: null, source: null };
}
