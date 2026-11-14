/** Shared data models for SoMusic Mobile (React Native + Expo) */

export interface Track {
  /** YouTube video id */
  id: string;
  title: string;
  artist: string;
  artistId?: string;
  album?: string;
  albumId?: string;
  /** duration in seconds (0 = unknown) */
  duration: number;
  /** best available thumbnail url */
  thumb: string;
  /** catalogue explicit-content flag */
  explicit?: boolean;
  artistImage?: string;
  localPath?: string;
  episode?: boolean;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  year?: string;
  thumb: string;
  releaseType?: string;
  description?: string | null;
  artistId?: string;
}

export interface Artist {
  id: string;
  name: string;
  thumb: string;
  subtitle?: string;
}

export interface PlaylistCard {
  id: string;
  title: string;
  thumb: string;
  count?: number;
  subtitle?: string;
}

export type SearchFilter = "all" | "songs" | "videos" | "albums" | "artists" | "playlists" | "podcasts";

export type BrowseType = "album" | "artist" | "playlist" | "podcast" | "other";

export interface BrowseItem {
  browseId: string;
  title: string;
  subtitle: string;
  thumb: string;
  type: BrowseType;
}

export type SearchRow =
  | { kind: "top"; song: Track }
  | { kind: "track"; song: Track }
  | { kind: "browse"; item: BrowseItem; top?: boolean };

export interface SearchPageResult {
  rows: SearchRow[];
  continuation: string | null;
}

export interface RadioTrack extends Track {
  videoType: "song" | "video" | "upload" | "episode";
}

export interface RadioPage {
  tracks: RadioTrack[];
  next: string | null;
  seed: { artist: string; artistId?: string } | null;
}

export type HomeItemKind = "track" | "album" | "artist" | "playlist";

export interface HomeItem {
  kind: HomeItemKind;
  track?: Track;
  album?: Album;
  artist?: Artist;
  playlist?: PlaylistCard;
}

export interface HomeShelf {
  title: string;
  items: HomeItem[];
}

export interface MoodEntry {
  title: string;
  browseId: string;
  params: string;
  color: string;
  section: string;
}

export interface MoodPage {
  title: string;
  shelves: HomeShelf[];
}

export interface PodcastShow {
  id: string;
  title: string;
  author: string;
  thumb: string;
}

export interface PodcastShelf {
  title: string;
  shows: PodcastShow[];
}

export interface SyncedLine {
  time: number; // in seconds
  text: string;
}

export interface LyricsResponse {
  plain: string | null;
  synced: SyncedLine[] | null;
  source: string | null;
  wordSynced?: boolean;
}

export type RepeatMode = "off" | "all" | "one";
