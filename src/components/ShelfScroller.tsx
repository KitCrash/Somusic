import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { HomeShelf } from "../types";
import { colors } from "../theme/colors";
import { TrackCard } from "./TrackCard";

interface ShelfScrollerProps {
  shelf: HomeShelf;
  onTrackPress?: (track: any) => void;
}

export function ShelfScroller({ shelf, onTrackPress }: ShelfScrollerProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{shelf.title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {shelf.items.map((item, idx) => {
          if (item.kind === "track" && item.track) {
            return (
              <TrackCard
                key={`${item.track.id}-${idx}`}
                track={item.track}
                onPress={() => onTrackPress?.(item.track)}
              />
            );
          }
          return null;
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 28,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 14,
    paddingHorizontal: 16,
    letterSpacing: -0.3,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
});
