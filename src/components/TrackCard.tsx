import React from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Play } from "lucide-react-native";
import { Track } from "../types";
import { colors } from "../theme/colors";
import { usePlayer } from "../stores/player";
import { shortTitle } from "../lib/format";

interface TrackCardProps {
  track: Track;
  onPress?: () => void;
}

export function TrackCard({ track, onPress }: TrackCardProps) {
  const playTrack = usePlayer((s) => s.playTrack);

  const handlePress = () => {
    if (onPress) onPress();
    else playTrack(track);
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      style={styles.container}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: track.thumb || `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg` }}
          style={styles.image}
        />
        <View style={styles.playOverlay}>
          <Play size={16} color="#ffffff" fill="#ffffff" />
        </View>
      </View>
      <Text numberOfLines={1} style={styles.title}>
        {shortTitle(track.title)}
      </Text>
      <Text numberOfLines={1} style={styles.artist}>
        {track.artist}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 140,
    marginRight: 14,
  },
  imageContainer: {
    width: 140,
    height: 140,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.surfaceLight,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
  },
  playOverlay: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: "600",
    marginTop: 8,
  },
  artist: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 2,
  },
});
