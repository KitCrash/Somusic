import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RepeatMode, Track } from "../types";

const HISTORY_KEEP = 100;

export function isRadioSeed(id: string | undefined): boolean {
  return !!id && /^[A-Za-z0-9_-]{11}$/.test(id);
}

export function autoplayTail(s: { queue: Track[]; index: number; autoplayCount: number }): number {
  return Math.max(0, Math.min(s.autoplayCount, s.queue.length - s.index - 1));
}

interface PlayerState {
  queue: Track[];
  index: number;
  playing: boolean;
  position: number;
  duration: number;
  volume: number;
  repeat: RepeatMode;
  shuffle: boolean;
  autoplayCount: number;
  awaitingAutoplay: boolean;
  contextId: number;

  playTrack: (track: Track) => void;
  playQueue: (tracks: Track[], startIndex?: number) => void;
  jumpTo: (index: number) => void;
  addToQueue: (tracks: Track | Track[]) => void;
  removeAt: (index: number) => void;
  clearUpcoming: () => void;
  appendAutoplay: (incoming: Track[]) => void;
  dropAutoplay: () => void;
  stopAwaiting: () => void;
  next: (manual?: boolean) => void;
  prev: () => void;
  toggle: () => void;
  setPlaying: (playing: boolean) => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setRepeat: (repeat: RepeatMode) => void;
  setShuffle: (shuffle: boolean) => void;
}

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => ({
      queue: [],
      index: 0,
      playing: false,
      position: 0,
      duration: 0,
      volume: 1,
      repeat: "off",
      shuffle: false,
      autoplayCount: 0,
      awaitingAutoplay: false,
      contextId: 1,

      playTrack(track) {
        set({
          queue: [track],
          index: 0,
          playing: true,
          position: 0,
          autoplayCount: 0,
          awaitingAutoplay: false,
          contextId: get().contextId + 1,
        });
      },

      playQueue(tracks, startIndex = 0) {
        if (!tracks.length) return;
        const validIndex = Math.max(0, Math.min(startIndex, tracks.length - 1));
        set({
          queue: tracks,
          index: validIndex,
          playing: true,
          position: 0,
          autoplayCount: 0,
          awaitingAutoplay: false,
          contextId: get().contextId + 1,
        });
      },

      jumpTo(index) {
        const { queue } = get();
        if (index >= 0 && index < queue.length) {
          set({ index, playing: true, position: 0 });
        }
      },

      addToQueue(items) {
        const list = Array.isArray(items) ? items : [items];
        if (!list.length) return;
        const s = get();
        const tail = autoplayTail(s);
        const ownQueue = s.queue.slice(0, s.queue.length - tail);
        const tailQueue = s.queue.slice(s.queue.length - tail);
        set({ queue: [...ownQueue, ...list, ...tailQueue] });
      },

      removeAt(i) {
        const s = get();
        const { queue, index } = s;
        if (i < 0 || i >= queue.length) return;
        const tail = autoplayTail(s);
        const newQueue = queue.filter((_, idx) => idx !== i);
        set({
          queue: newQueue,
          index: i < index ? index - 1 : Math.min(index, newQueue.length - 1),
          autoplayCount: i >= queue.length - tail ? tail - 1 : tail,
          ...(i === index ? { position: 0 } : {}),
        });
      },

      clearUpcoming() {
        const s = get();
        const tail = autoplayTail(s);
        set({
          queue: [...s.queue.slice(0, s.index + 1), ...s.queue.slice(s.queue.length - tail)],
          autoplayCount: tail,
        });
      },

      appendAutoplay(incoming) {
        const s = get();
        const present = new Set(s.queue.slice(s.index).map((t) => t.id));
        const tracks = incoming.filter((t) => !present.has(t.id) && present.add(t.id));
        if (!tracks.length) return;

        const tail = autoplayTail(s);
        const cut = Math.max(0, s.index - HISTORY_KEEP);
        const queue = [...s.queue.slice(cut), ...tracks];
        const index = s.index - cut;

        if (s.awaitingAutoplay) {
          set({
            queue,
            index: queue.length - tracks.length,
            autoplayCount: tracks.length - 1,
            awaitingAutoplay: false,
            playing: true,
            position: 0,
          });
          return;
        }

        set({
          queue,
          index,
          autoplayCount: tail + tracks.length,
        });
      },

      dropAutoplay() {
        const s = get();
        const tail = autoplayTail(s);
        if (!tail) return;
        set({
          queue: s.queue.slice(0, s.queue.length - tail),
          autoplayCount: 0,
        });
      },

      stopAwaiting() {
        if (get().awaitingAutoplay) set({ awaitingAutoplay: false, playing: false });
      },

      next(manual = false) {
        const s = get();
        if (!s.queue.length) {
          set({ playing: false });
          return;
        }

        if (s.index + 1 >= s.queue.length && s.repeat !== "all") {
          const last = s.queue[s.queue.length - 1];
          const canContinue = s.repeat === "off" && isRadioSeed(last?.id) && !last?.episode;
          if (canContinue) {
            set({ awaitingAutoplay: true });
            return;
          }
          if (!manual) {
            set({ playing: false, position: 0 });
            return;
          }
        }

        const nextIndex = (s.index + 1) % s.queue.length;
        set({
          index: nextIndex,
          playing: true,
          position: 0,
          awaitingAutoplay: false,
        });
      },

      prev() {
        const s = get();
        if (s.position > 3) {
          set({ position: 0 });
          return;
        }
        if (!s.queue.length) return;
        const prevIndex = s.index > 0 ? s.index - 1 : s.queue.length - 1;
        set({ index: prevIndex, playing: true, position: 0 });
      },

      toggle() {
        set({ playing: !get().playing });
      },

      setPlaying(playing) {
        set({ playing });
      },

      setPosition(position) {
        set({ position });
      },

      setDuration(duration) {
        set({ duration });
      },

      setRepeat(repeat) {
        set({ repeat });
      },

      setShuffle(shuffle) {
        set({ shuffle });
      },
    }),
    {
      name: "somusic-player-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        queue: state.queue,
        index: state.index,
        repeat: state.repeat,
        shuffle: state.shuffle,
      }),
    }
  )
);
