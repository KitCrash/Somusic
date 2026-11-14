import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  Alert,
} from "react-native";
import {
  Heart,
  Download,
  FolderOpen,
  Plus,
  Clock,
  Play,
  ListMusic,
} from "lucide-react-native";
import { useLibrary } from "../stores/library";
import { usePlayer } from "../stores/player";
import { colors } from "../theme/colors";
import { shortTitle } from "../lib/format";
import { CoverStack, STACK_CARD_WIDTH } from "../components/CoverStack";

export function LibraryScreen() {
  const history = useLibrary((s) => s.history);
  const likedTracks = useLibrary((s) => s.likedTracks);
  const playlists = useLibrary((s) => s.playlists);
  const createPlaylist = useLibrary((s) => s.createPlaylist);
  const playTrack = usePlayer((s) => s.playTrack);
  const playQueue = usePlayer((s) => s.playQueue);

  const [activeFilter, setActiveFilter] = useState<string>("all");

  const handleCreatePlaylist = () => {
    const defaultName = `My Playlist #${playlists.length + 1}`;
    createPlaylist(defaultName);
  };

  const handlePlayLiked = () => {
    if (likedTracks.length > 0) {
      playQueue(likedTracks, 0);
    }
  };

  // Covers for liked stack
  const likedCovers = likedTracks.slice(0, 3).map((t) => t.thumb);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Page Title */}
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Your Library</Text>
        <TouchableOpacity
          onPress={handleCreatePlaylist}
          style={styles.addBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Plus size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filtersScroll}
      >
        {["all", "playlists", "liked", "downloads"].map((f) => {
          const active = activeFilter === f;
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setActiveFilter(f)}
              style={[styles.filterChip, active && styles.activeFilterChip]}
            >
              <Text style={[styles.filterChipText, active && styles.activeFilterChipText]}>
                {f === "all" ? "All" : f === "liked" ? "Liked Songs" : f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Collections 2-Column Grid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Collections</Text>
        <View style={styles.stackGrid}>
          {/* 1. Liked Songs CoverStack */}
          <CoverStack
            title="Liked Songs"
            subtitle={`${likedTracks.length} ${likedTracks.length === 1 ? "song" : "songs"}`}
            gradientStops={["#4310F5", "#8D85E5", "#B4F0D6"]}
            icon={<Heart size={38} color="#ffffff" fill="#ffffff" />}
            covers={likedCovers}
            isPinned={true}
            onPress={handlePlayLiked}
            onPlay={likedTracks.length > 0 ? handlePlayLiked : undefined}
          />

          {/* 2. Downloads CoverStack */}
          <CoverStack
            title="Downloads"
            subtitle="Offline music"
            gradientStops={["#1238E6", "#3D8BF2", "#CDE9FF"]}
            icon={<Download size={38} color="#ffffff" strokeWidth={2.5} />}
            onPress={() => {}}
          />

          {/* 3. Local Music CoverStack */}
          <CoverStack
            title="Local Music"
            subtitle="On this device"
            gradientStops={["#E2550B", "#F59A2F", "#FFEAB0"]}
            icon={<FolderOpen size={38} color="#ffffff" strokeWidth={2.2} />}
            onPress={() => {}}
          />

          {/* 4. Create New Playlist Stack */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleCreatePlaylist}
            style={styles.newPlaylistCard}
          >
            <View style={styles.newPlaylistInner}>
              <Plus size={32} color={colors.textFaint} />
              <Text style={styles.newPlaylistText}>New Playlist</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* User Custom Playlists (if any) */}
      {playlists.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Playlists</Text>
          <View style={styles.stackGrid}>
            {playlists.map((p) => {
              const pCovers = p.tracks.slice(0, 3).map((t) => t.thumb);
              return (
                <CoverStack
                  key={p.id}
                  title={p.title}
                  subtitle={`${p.tracks.length} songs`}
                  gradientStops={["#6366f1", "#8b5cf6", "#ec4899"]}
                  icon={<ListMusic size={36} color="#ffffff" />}
                  covers={pCovers}
                  onPress={() => {
                    if (p.tracks.length > 0) playQueue(p.tracks, 0);
                  }}
                  onPlay={p.tracks.length > 0 ? () => playQueue(p.tracks, 0) : undefined}
                />
              );
            })}
          </View>
        </View>
      )}

      {/* Recently Played History */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Clock size={16} color={colors.textFaint} style={{ marginRight: 6 }} />
          <Text style={styles.sectionTitle}>Recently Played</Text>
        </View>

        {history.length === 0 ? (
          <Text style={styles.emptyText}>No listening history yet.</Text>
        ) : (
          history.slice(0, 20).map((t, idx) => (
            <TouchableOpacity
              key={`${t.id}-${idx}`}
              activeOpacity={0.7}
              onPress={() => playTrack(t)}
              style={styles.trackRow}
            >
              <Image
                source={{ uri: t.thumb || `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg` }}
                style={styles.trackThumb}
              />
              <View style={styles.trackInfo}>
                <Text numberOfLines={1} style={styles.trackTitle}>
                  {shortTitle(t.title)}
                </Text>
                <Text numberOfLines={1} style={styles.trackArtist}>
                  {t.artist}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => playTrack(t)}
                style={styles.rowPlayBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Play size={14} color={colors.text} fill={colors.text} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 90,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  pageTitle: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.cardBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filtersScroll: {
    gap: 8,
    marginBottom: 24,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  activeFilterChip: {
    backgroundColor: "#ffffff",
  },
  filterChipText: {
    color: colors.textFaint,
    fontSize: 12.5,
    fontWeight: "500",
  },
  activeFilterChipText: {
    color: "#000000",
    fontWeight: "700",
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 14,
  },
  stackGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  newPlaylistCard: {
    width: STACK_CARD_WIDTH,
    height: STACK_CARD_WIDTH,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(255, 255, 255, 0.18)",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  newPlaylistInner: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  newPlaylistText: {
    color: colors.textFaint,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    marginVertical: 10,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  trackThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.surfaceLight,
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
  },
  trackTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  trackArtist: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 2,
  },
  rowPlayBtn: {
    padding: 8,
  },
});
