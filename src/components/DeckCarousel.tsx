import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
} from "react-native";
import { Play } from "lucide-react-native";
import { Track } from "../types";
import { colors } from "../theme/colors";
import { usePlayer } from "../stores/player";
import { shortTitle } from "../lib/format";

interface DeckCarouselProps {
  title: string;
  count?: number;
  tracks: Track[];
}

export function DeckCarousel({ title, count, tracks }: DeckCarouselProps) {
  const playTrack = usePlayer((s) => s.playTrack);
  const playQueue = usePlayer((s) => s.playQueue);

  if (!tracks.length) return null;

  return (
    <View style={styles.container}>
      {/* Shelf Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {count !== undefined && <Text style={styles.count}>{count}</Text>}
      </View>

      {/* Horizontal Deck Fan */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.deckContent}
      >
        {tracks.map((t, idx) => (
          <TouchableOpacity
            key={`${t.id}-${idx}`}
            activeOpacity={0.88}
            onPress={() => playQueue(tracks, idx)}
            style={[
              styles.deckCard,
              { marginLeft: idx === 0 ? 0 : -20, zIndex: idx + 1 },
            ]}
          >
            <Image
              source={{ uri: t.thumb || `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg` }}
              style={styles.cardImage}
            />

            {/* Play Badge */}
            <View style={styles.playBadge}>
              <Play size={10} color="#ffffff" fill="#ffffff" style={{ marginLeft: 1 }} />
            </View>

            {/* Bottom Label Badge */}
            <View style={styles.bottomLabel}>
              <Text numberOfLines={1} style={styles.labelText}>
                {shortTitle(t.title)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    paddingHorizontal: 16,
    marginBottom: 14,
    gap: 8,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  count: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  deckContent: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  deckCard: {
    width: 128,
    height: 180,
    borderRadius: 14,
    overflow: "hidden",
    position: "relative",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000000",
    shadowOffset: { width: -4, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  playBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  bottomLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
  },
  labelText: {
    color: "#ffffff",
    fontSize: 11.5,
    fontWeight: "700",
  },
});
