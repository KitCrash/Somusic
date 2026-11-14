import { autoplayTail, isRadioSeed, usePlayer } from "../stores/player";
import { useSettings } from "../stores/settings";
import { Track } from "../types";
import { getHome, getRadio } from "../api/innertube";
import { artistKey, pickSuggestions, recordingKey } from "./radioFilter";

const LOW_WATER = 5;
const MAX_TAIL = 20;
const MAX_PAGES = 3;
const RETRY_AFTER_MS = 60_000;

let generation = 0;
let inflight = false;
let seed: Track | null = null;
let token: string | null = null;
let failedAt = 0;
let started = false;

const playedIds = new Set<string>();
const playedKeys = new Set<string>();

function addKeys(tracks: readonly Track[]): void {
  for (const t of tracks) {
    playedIds.add(t.id);
    const key = recordingKey(t.title, t.artist);
    if (key) playedKeys.add(key);
  }
}

function wantsMore(): boolean {
  const p = usePlayer.getState();
  if (!useSettings.getState().autoplay || p.repeat !== "off") return false;
  const newest = p.queue[p.queue.length - 1];
  if (!isRadioSeed(newest?.id) || newest?.episode) return false;
  if (p.awaitingAutoplay) return true;
  if (!p.playing || Date.now() - failedAt < RETRY_AFTER_MS) return false;

  const tail = autoplayTail(p);
  const ownLeft = p.queue.length - tail - p.index - 1;
  return ownLeft <= 1 && tail < LOW_WATER;
}

async function fetchBatch(gen: number): Promise<Track[]> {
  const p = usePlayer.getState();
  const excludeIds = new Set<string>(playedIds);
  const excludeKeys = new Set<string>(playedKeys);
  for (const t of p.queue) {
    excludeIds.add(t.id);
    const key = recordingKey(t.title, t.artist);
    if (key) excludeKeys.add(key);
  }

  const limit = MAX_TAIL - autoplayTail(p);
  const newest = p.queue[p.queue.length - 1];

  if (!seed || !token) {
    seed = newest;
    token = null;
  }

  // 1. YouTube Radio for newest track
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await getRadio(seed.id, token || undefined);
    if (gen !== generation) return [];
    token = res.next;
    const picked = pickSuggestions(res.tracks, {
      excludeIds,
      excludeKeys,
      seedArtist: res.seed?.artistId || artistKey(res.seed?.artist || seed.artist),
      limit,
    });
    if (picked.length) return picked;
    if (!token) break;
  }

  // 2. Radio for currently playing track
  const cur = p.queue[p.index];
  if (cur && cur.id !== seed.id && isRadioSeed(cur.id)) {
    seed = cur;
    const res = await getRadio(cur.id);
    if (gen !== generation) return [];
    token = res.next;
    const picked = pickSuggestions(res.tracks, {
      excludeIds,
      excludeKeys,
      seedArtist: res.seed?.artistId || artistKey(cur.artist),
      limit,
    });
    if (picked.length) return picked;
  }

  // 3. Fallback: Curated Home songs
  const shelves = await getHome();
  if (gen !== generation) return [];
  const pool: Track[] = [];
  for (const shelf of shelves) {
    for (const it of shelf.items) {
      if (it.kind === "track" && it.track) pool.push(it.track);
    }
  }
  return pickSuggestions(pool, { excludeIds, excludeKeys, limit }).slice(0, 8);
}

export async function refillAutoplay(): Promise<void> {
  if (inflight || !wantsMore()) return;
  inflight = true;
  const gen = generation;

  try {
    const batch = await fetchBatch(gen);
    if (gen !== generation) return;

    if (batch.length) {
      failedAt = 0;
      usePlayer.getState().appendAutoplay(batch);
    } else {
      failedAt = Date.now();
      usePlayer.getState().stopAwaiting();
    }
  } catch (e) {
    if (gen === generation) {
      failedAt = Date.now();
      usePlayer.getState().stopAwaiting();
    }
  } finally {
    inflight = false;
  }
}

export function initAutoplay(): () => void {
  if (started) return () => {};
  started = true;

  const unsubPlayer = usePlayer.subscribe((state, prev) => {
    const cur = state.queue[state.index];
    if (cur && cur.id !== prev.queue[prev.index]?.id) {
      addKeys([cur]);
    }
    if (wantsMore()) {
      void refillAutoplay();
    }
  });

  const unsubSettings = useSettings.subscribe((state, prev) => {
    if (state.autoplay !== prev.autoplay) {
      generation++;
      seed = null;
      token = null;
      if (!state.autoplay) {
        usePlayer.getState().dropAutoplay();
      } else if (wantsMore()) {
        void refillAutoplay();
      }
    }
  });

  return () => {
    unsubPlayer();
    unsubSettings();
    started = false;
  };
}
