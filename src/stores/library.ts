import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Track } from "../types";

interface LibraryState {
  history: Track[];
  likedTracks: Track[];
  playlists: Array<{ id: string; title: string; tracks: Track[] }>;

  addToHistory: (track: Track) => void;
  toggleLike: (track: Track) => void;
  isLiked: (trackId: string) => boolean;
  createPlaylist: (title: string) => void;
  addToPlaylist: (playlistId: string, track: Track) => void;
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      history: [],
      likedTracks: [],
      playlists: [],

      addToHistory(track) {
        const history = [track, ...get().history.filter((t) => t.id !== track.id)].slice(0, 100);
        set({ history });
      },

      toggleLike(track) {
        const { likedTracks } = get();
        const exists = likedTracks.some((t) => t.id === track.id);
        if (exists) {
          set({ likedTracks: likedTracks.filter((t) => t.id !== track.id) });
        } else {
          set({ likedTracks: [track, ...likedTracks] });
        }
      },

      isLiked(trackId) {
        return get().likedTracks.some((t) => t.id === trackId);
      },

      createPlaylist(title) {
        const newPl = {
          id: `pl-${Date.now()}`,
          title,
          tracks: [],
        };
        set({ playlists: [newPl, ...get().playlists] });
      },

      addToPlaylist(playlistId, track) {
        set({
          playlists: get().playlists.map((p) =>
            p.id === playlistId
              ? {
                  ...p,
                  tracks: p.tracks.some((t) => t.id === track.id)
                    ? p.tracks
                    : [...p.tracks, track],
                }
              : p
          ),
        });
      },
    }),
    {
      name: "somusic-library-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
