import { RadioTrack, Track } from "../types";

export interface RadioCandidate extends Track {
  videoType?: "song" | "video" | "upload" | "episode";
}

export interface PickOptions {
  excludeIds: ReadonlySet<string>;
  excludeKeys: ReadonlySet<string>;
  seedArtist?: string;
  limit: number;
}

const PER_ARTIST = 2;
const SEED_ARTIST = 3;
const MIN_SEC = 60;
const MAX_SEC = 15 * 60;
const VERSION_WORDS = /remix|cover|live|acoustic|instrumental|unplugged|karaoke|slowed|reverb|sped|lo-?fi|version/i;

export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[([【「][^)\]】」]*[)\]】」]/g, (group) => (VERSION_WORDS.test(group) ? group : " "))
    .replace(/\s+-\s+(?:official|lyrics?|audio|video|visuali[sz]er|from)\b.*$/u, " ")
    .replace(/\s(?:feat\.?|ft\.?|featuring)\s.*$/u, " ")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, " ")
    .trim();
}

export function artistKey(artist: string): string {
  return normalizeTitle(artist.split(/,|&|\s+x\s+|\s+(?:feat\.?|ft\.?)\s+/i)[0] ?? "");
}

export function recordingKey(title: string, artist: string): string {
  const name = normalizeTitle(title);
  return name ? `${name}|${artistKey(artist)}` : "";
}

export function pickSuggestions(candidates: readonly RadioCandidate[], opts: PickOptions): Track[] {
  const songs: RadioCandidate[] = [];
  const videos: RadioCandidate[] = [];

  for (const c of candidates) {
    if (!c?.id || opts.excludeIds.has(c.id) || c.videoType === "episode") continue;
    if (c.duration > 0 && (c.duration < MIN_SEC || c.duration > MAX_SEC)) continue;
    if (c.videoType === "video") videos.push(c);
    else songs.push(c);
  }

  const picked: Track[] = [];
  const keys = new Set<string>();
  const perArtist = new Map<string, number>();

  const take = (pool: RadioCandidate[]): void => {
    for (const c of pool) {
      if (picked.length >= opts.limit) return;
      const key = recordingKey(c.title, c.artist);
      if (key && (opts.excludeKeys.has(key) || keys.has(key))) continue;
      const who = c.artistId || artistKey(c.artist);
      const cap = who && who === opts.seedArtist ? SEED_ARTIST : PER_ARTIST;
      const n = perArtist.get(who) ?? 0;
      if (who && n >= cap) continue;
      if (who) perArtist.set(who, n + 1);
      if (key) keys.add(key);

      const { videoType: _, ...cleanTrack } = c;
      picked.push(cleanTrack);
    }
  };

  take(songs);
  if (picked.length < opts.limit) take(videos);

  return picked;
}
