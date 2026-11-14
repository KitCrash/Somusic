import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from "react-native";
import { ArrowLeft, Play, Radio, Sparkles } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { getMoodPage, getMoods, getPodcasts } from "../api/innertube";
import { MoodEntry, MoodPage, PodcastShelf, Track } from "../types";
import { colors } from "../theme/colors";
import { useUI } from "../stores/ui";
import { usePlayer } from "../stores/player";
import { shortTitle } from "../lib/format";
import { MoodCard } from "../components/MoodCard";

export function ExploreScreen() {
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [podcasts, setPodcasts] = useState<PodcastShelf[]>([]);
  const [activeMoodData, setActiveMoodData] = useState<MoodPage | null>(null);
  const [loadingMood, setLoadingMood] = useState(false);

  const selectedMoodTitle = useUI((s) => s.selectedMoodTitle);
  const selectedMoodParams = useUI((s) => s.selectedMoodParams);
  const openMood = useUI((s) => s.openMood);
  const closeMood = useUI((s) => s.closeMood);
  const playQueue = usePlayer((s) => s.playQueue);
  const playTrack = usePlayer((s) => s.playTrack);

  useEffect(() => {
    getMoods().then(setMoods);
    getPodcasts().then(setPodcasts);
  }, []);

  useEffect(() => {
    if (selectedMoodTitle) {
      setLoadingMood(true);
      getMoodPage(selectedMoodParams || undefined).then((res) => {
        setActiveMoodData(res);
        setLoadingMood(false);
      });
    } else {
      setActiveMoodData(null);
    }
  }, [selectedMoodTitle, selectedMoodParams]);

  // If a mood is selected, render the dedicated Mood View with Turntable
  if (selectedMoodTitle) {
    const tracks: Track[] =
      activeMoodData?.shelves.flatMap((s) =>
        s.items.flatMap((i) => (i.kind === "track" && i.track ? [i.track] : []))
      ) || [];

    return (
      <View style={styles.container}>
        {/* Header with Back button */}
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={closeMood} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ArrowLeft size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.detailHeaderTitle}>{selectedMoodTitle}</Text>
          <View style={{ width: 40 }} />
        </View>

        {loadingMood ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.detailContent} showsVerticalScrollIndicator={false}>
            {/* Hero Turntable Banner */}
            <View style={styles.turntableBanner}>
              <View style={styles.vinylRecord}>
                <View style={styles.vinylCenter}>
                  <Radio size={20} color="#ffffff" />
                </View>
              </View>
              <Text style={styles.moodHeroTitle}>{selectedMoodTitle}</Text>
              <Text style={styles.moodHeroSubtitle}>
                A curated SoMusic mix · {tracks.length} songs
              </Text>

              {tracks.length > 0 && (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => playQueue(tracks, 0)}
                  style={styles.playMixBtn}
                >
                  <Play size={18} color="#000000" fill="#000000" style={{ marginRight: 6 }} />
                  <Text style={styles.playMixText}>Play Mix</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Tracklist */}
            <Text style={styles.tracklistTitle}>Up first in the mix</Text>
            {tracks.map((t, idx) => (
              <TouchableOpacity
                key={`${t.id}-${idx}`}
                activeOpacity={0.7}
                onPress={() => playTrack(t)}
                style={styles.trackRow}
              >
                <Text style={styles.trackIndex}>
                  {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                </Text>
                <Image source={{ uri: t.thumb || `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg` }} style={styles.trackThumb} />
                <View style={styles.trackInfo}>
                  <Text numberOfLines={1} style={styles.trackRowTitle}>
                    {shortTitle(t.title)}
                  </Text>
                  <Text numberOfLines={1} style={styles.trackRowArtist}>
                    {t.artist}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>
    );
  }

  const moodsAndMoments = moods.filter((m) => m.section === "Moods & moments");
  const genres = moods.filter((m) => m.section === "Genres");

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Title Header */}
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Sparkles size={22} color="#ffffff" style={{ marginRight: 8 }} />
          <Text style={styles.title}>Explore</Text>
        </View>
        <Text style={styles.subtitle}>Picked for your region by YouTube Music</Text>
      </View>

      {/* Podcasts Hero Card */}
      <TouchableOpacity activeOpacity={0.9} style={styles.podcastsCard}>
        <LinearGradient
          colors={["#4338ca", "#1e1b4b"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.podcastsGradient}
        >
          <View style={styles.podcastsInfo}>
            <Text style={styles.podcastsTitle}>Podcasts</Text>
            <Text style={styles.podcastsSubtitle}>
              Popular shows and episodes in your region
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Moods & Moments 2x2 Grid with Vinyl and Sleeve Animation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Moods & moments <Text style={styles.sectionCount}>{moodsAndMoments.length}</Text>
        </Text>
        <View style={styles.grid}>
          {moodsAndMoments.map((m) => (
            <MoodCard
              key={m.title}
              title={m.title}
              color={m.color || "#8b5cf6"}
              onPress={() => openMood(m.title, m.params)}
            />
          ))}
        </View>
      </View>

      {/* Genres 2x2 Grid with Vinyl and Sleeve Animation */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Genres <Text style={styles.sectionCount}>{genres.length}</Text>
        </Text>
        <View style={styles.grid}>
          {genres.map((m) => (
            <MoodCard
              key={m.title}
              title={m.title}
              color={m.color || "#ec4899"}
              onPress={() => openMood(m.title, m.params)}
            />
          ))}
        </View>
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
    marginBottom: 20,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: colors.textFaint,
    fontSize: 13,
    marginTop: 4,
  },
  podcastsCard: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 28,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  podcastsGradient: {
    padding: 22,
    minHeight: 100,
    justifyContent: "center",
  },
  podcastsInfo: {
    maxWidth: "80%",
  },
  podcastsTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  podcastsSubtitle: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 13,
    marginTop: 6,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "800",
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  sectionCount: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 14,
  },
  detailHeader: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  backBtn: {
    padding: 8,
  },
  detailHeaderTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
  },
  detailContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 90,
  },
  turntableBanner: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    marginBottom: 24,
  },
  vinylRecord: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "#111113",
    borderWidth: 6,
    borderColor: "#222226",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 12,
  },
  vinylCenter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  moodHeroTitle: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    marginTop: 18,
  },
  moodHeroSubtitle: {
    color: colors.textFaint,
    fontSize: 13,
    marginTop: 4,
  },
  playMixBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 22,
    marginTop: 18,
  },
  playMixText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "700",
  },
  tracklistTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 14,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  trackIndex: {
    color: colors.textMuted,
    fontSize: 13,
    width: 28,
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
  trackRowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  trackRowArtist: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 2,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
