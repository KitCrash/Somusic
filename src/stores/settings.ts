import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type StreamQuality = "low" | "medium" | "high" | "lossless";

interface SettingsState {
  autoplay: boolean;
  streamingQuality: StreamQuality;
  syncedLyrics: boolean;
  romanizeLyrics: boolean;
  lyricsOffset: number;
  eqEnabled: boolean;
  eqGains: number[];

  setAutoplay: (autoplay: boolean) => void;
  setStreamingQuality: (q: StreamQuality) => void;
  setSyncedLyrics: (v: boolean) => void;
  setRomanizeLyrics: (v: boolean) => void;
  setLyricsOffset: (offset: number) => void;
  setEqEnabled: (enabled: boolean) => void;
  setEqGains: (gains: number[]) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      autoplay: true,
      streamingQuality: "high",
      syncedLyrics: true,
      romanizeLyrics: false,
      lyricsOffset: 0,
      eqEnabled: false,
      eqGains: Array(10).fill(0),

      setAutoplay: (autoplay) => set({ autoplay }),
      setStreamingQuality: (streamingQuality) => set({ streamingQuality }),
      setSyncedLyrics: (syncedLyrics) => set({ syncedLyrics }),
      setRomanizeLyrics: (romanizeLyrics) => set({ romanizeLyrics }),
      setLyricsOffset: (lyricsOffset) => set({ lyricsOffset }),
      setEqEnabled: (eqEnabled) => set({ eqEnabled }),
      setEqGains: (eqGains) => set({ eqGains }),
    }),
    {
      name: "somusic-settings-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
