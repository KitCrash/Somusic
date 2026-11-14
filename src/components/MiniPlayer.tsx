import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Play, Pause, Heart } from "lucide-react-native";
import { usePlayer } from "../stores/player";
import { useLibrary } from "../stores/library";
import { useUI } from "../stores/ui";
import { colors } from "../theme/colors";
import { shortTitle } from "../lib/format";

export function MiniPlayer() {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const playing = usePlayer((s) => s.playing);
  const toggle = usePlayer((s) => s.toggle);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);

  const setNowPlayingOpen = useUI((s) => s.setNowPlayingOpen);
  const toggleLike = useLibrary((s) => s.toggleLike);
  const isLiked = useLibrary((s) => s.isLiked);

  const cur = queue[index];
  if (!cur) return null;

  const progress = duration > 0 ? Math.min(1, position / duration) : 0;
  const liked = isLiked(cur.id);

  return (
    <View style={styles.wrapper}>
      {/* Mini Progress Bar */}
      <View style={styles.progressTrack}>
        <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
      </View>

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setNowPlayingOpen(true)}
        style={styles.container}
      >
        <Image
          source={{ uri: cur.thumb || `https://i.ytimg.com/vi/${cur.id}/hqdefault.jpg` }}
          style={styles.thumb}
        />
        <View style={styles.info}>
          <Text numberOfLines={1} style={styles.title}>
            {shortTitle(cur.title)}
          </Text>
          <Text numberOfLines={1} style={styles.artist}>
            {cur.artist}
          </Text>
        </View>

        <TouchableOpacity
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={() => toggleLike(cur)}
          style={styles.actionBtn}
        >
          <Heart
            size={20}
            color={liked ? colors.accent : colors.textFaint}
            fill={liked ? colors.accent : "transparent"}
          />
        </TouchableOpacity>

        <TouchableOpacity
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          onPress={toggle}
          style={styles.playBtn}
        >
          {playing ? (
            <Pause size={20} color="#ffffff" fill="#ffffff" />
          ) : (
            <Play size={20} color="#ffffff" fill="#ffffff" style={{ marginLeft: 2 }} />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    overflow: "hidden",
  },
  progressTrack: {
    height: 2,
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  progressBar: {
    height: "100%",
    backgroundColor: colors.accent,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: colors.surfaceLight,
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  artist: {
    color: colors.textFaint,
    fontSize: 12.5,
    marginTop: 2,
  },
  actionBtn: {
    padding: 6,
    marginRight: 6,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
