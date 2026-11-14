import React from "react";
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Trash2, Sparkles, X } from "lucide-react-native";
import { usePlayer, autoplayTail } from "../stores/player";
import { colors } from "../theme/colors";
import { shortTitle } from "../lib/format";

export function QueuePanel() {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const jumpTo = usePlayer((s) => s.jumpTo);
  const removeAt = usePlayer((s) => s.removeAt);
  const clearUpcoming = usePlayer((s) => s.clearUpcoming);

  const tail = autoplayTail(usePlayer.getState());
  const cur = queue[index];
  const upcomingOwn = queue.slice(index + 1, queue.length - tail);
  const autoplayTracks = queue.slice(queue.length - tail);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Current Song */}
      {cur && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NOW PLAYING</Text>
          <View style={styles.row}>
            <Image
              source={{ uri: cur.thumb || `https://i.ytimg.com/vi/${cur.id}/hqdefault.jpg` }}
              style={styles.thumb}
            />
            <View style={styles.info}>
              <Text numberOfLines={1} style={[styles.title, { color: colors.accent }]}>
                {shortTitle(cur.title)}
              </Text>
              <Text numberOfLines={1} style={styles.artist}>
                {cur.artist}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Up Next (User's Songs) */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>UP NEXT ({upcomingOwn.length})</Text>
          {upcomingOwn.length > 0 && (
            <TouchableOpacity onPress={clearUpcoming}>
              <Text style={styles.clearBtn}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {upcomingOwn.length === 0 && autoplayTracks.length === 0 ? (
          <Text style={styles.emptyText}>Your queue is empty.</Text>
        ) : (
          upcomingOwn.map((track, i) => {
            const actualIndex = index + 1 + i;
            return (
              <TouchableOpacity
                key={`${track.id}-${actualIndex}`}
                activeOpacity={0.7}
                onPress={() => jumpTo(actualIndex)}
                style={styles.row}
              >
                <Image
                  source={{ uri: track.thumb || `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg` }}
                  style={styles.thumb}
                />
                <View style={styles.info}>
                  <Text numberOfLines={1} style={styles.title}>
                    {shortTitle(track.title)}
                  </Text>
                  <Text numberOfLines={1} style={styles.artist}>
                    {track.artist}
                  </Text>
                </View>
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => removeAt(actualIndex)}
                  style={styles.removeBtn}
                >
                  <X size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      {/* AutoPlay Recommendations Tail */}
      {autoplayTracks.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.autoplayBadge}>
              <Sparkles size={14} color={colors.accent} />
              <Text style={styles.autoplayBadgeText}>AUTOPLAY RECOMMENDATIONS</Text>
            </View>
          </View>

          {autoplayTracks.map((track, i) => {
            const actualIndex = queue.length - tail + i;
            return (
              <TouchableOpacity
                key={`${track.id}-${actualIndex}`}
                activeOpacity={0.7}
                onPress={() => jumpTo(actualIndex)}
                style={styles.row}
              >
                <Image
                  source={{ uri: track.thumb || `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg` }}
                  style={styles.thumb}
                />
                <View style={styles.info}>
                  <Text numberOfLines={1} style={styles.title}>
                    {shortTitle(track.title)}
                  </Text>
                  <Text numberOfLines={1} style={styles.artist}>
                    {track.artist}
                  </Text>
                </View>
                <TouchableOpacity
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  onPress={() => removeAt(actualIndex)}
                  style={styles.removeBtn}
                >
                  <X size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  clearBtn: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: "600",
  },
  autoplayBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  autoplayBadgeText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
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
    marginRight: 10,
  },
  title: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  artist: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 2,
  },
  removeBtn: {
    padding: 6,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    marginVertical: 12,
  },
});
