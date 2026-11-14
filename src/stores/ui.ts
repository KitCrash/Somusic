import { create } from "zustand";

export type TabName = "home" | "explore" | "search" | "library";

interface UIState {
  activeTab: TabName;
  nowPlayingOpen: boolean;
  searchQuery: string;
  selectedMoodParams: string | null;
  selectedMoodTitle: string | null;

  setActiveTab: (tab: TabName) => void;
  setNowPlayingOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  openMood: (title: string, params: string) => void;
  closeMood: () => void;
}

export const useUI = create<UIState>((set) => ({
  activeTab: "home",
  nowPlayingOpen: false,
  searchQuery: "",
  selectedMoodParams: null,
  selectedMoodTitle: null,

  setActiveTab: (activeTab) => set({ activeTab }),
  setNowPlayingOpen: (nowPlayingOpen) => set({ nowPlayingOpen }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  openMood: (selectedMoodTitle, selectedMoodParams) =>
    set({ selectedMoodTitle, selectedMoodParams, activeTab: "explore" }),
  closeMood: () => set({ selectedMoodTitle: null, selectedMoodParams: null }),
}));
