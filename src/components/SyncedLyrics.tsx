import React, { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { usePlayer } from "../stores/player";
import { fetchLyrics } from "../api/lrclib";
import { LyricsResponse } from "../types";
import { colors } from "../theme/colors";
import { seekTo } from "../audio/audioEngine";

interface SyncedLyricsProps {
  title: string;
  artist: string;
}

export function SyncedLyrics({ title, artist }: SyncedLyricsProps) {
  const [lyricsData, setLyricsData] = useState<LyricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const position = usePlayer((s) => s.position);
  const scrollRef = useRef<any>(null);
  const activeLineIndexRef = useRef<number>(-1);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchLyrics(title, artist).then((res) => {
      if (mounted) {
        setLyricsData(res);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [title, artist]);

  const syncedLines = lyricsData?.synced;

  // Determine current active line based on playback position
  let activeIndex = -1;
  if (syncedLines && syncedLines.length > 0) {
    for (let i = 0; i < syncedLines.length; i++) {
      if (position >= syncedLines[i].time) {
        activeIndex = i;
      } else {
        break;
      }
    }
  }

  // Auto-scroll to active line
  useEffect(() => {
    if (activeIndex !== -1 && activeIndex !== activeLineIndexRef.current) {
      activeLineIndexRef.current = activeIndex;
      // Scroll smoothly to keep active line centered
      scrollRef.current?.scrollTo({
        y: Math.max(0, activeIndex * 48 - 120),
        animated: true,
      });
    }
  }, [activeIndex]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={styles.loadingText}>Fetching lyrics...</Text>
      </View>
    );
  }

  if (!syncedLines && !lyricsData?.plain) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>No lyrics available for this track.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {syncedLines ? (
        syncedLines.map((line, idx) => {
          const isActive = idx === activeIndex;
          return (
            <TouchableOpacity
              key={`${line.time}-${idx}`}
              activeOpacity={0.6}
              onPress={() => seekTo(line.time)}
              style={styles.lineTouch}
            >
              <Text
                style={[
                  styles.lineText,
                  isActive ? styles.activeLine : styles.inactiveLine,
                ]}
              >
                {line.text || "♪"}
              </Text>
            </TouchableOpacity>
          );
        })
      ) : (
        <Text style={styles.plainText}>{lyricsData?.plain}</Text>
      )}

      <Text style={styles.sourceText}>Lyrics from LRCLIB</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    color: colors.textFaint,
    fontSize: 13,
    marginTop: 10,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: "center",
  },
  lineTouch: {
    paddingVertical: 12,
  },
  lineText: {
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 30,
    letterSpacing: -0.4,
  },
  activeLine: {
    color: "#ffffff",
    transform: [{ scale: 1.02 }],
  },
  inactiveLine: {
    color: "rgba(255, 255, 255, 0.28)",
  },
  plainText: {
    color: colors.textFaint,
    fontSize: 17,
    lineHeight: 28,
  },
  sourceText: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 40,
    textAlign: "center",
  },
});
