import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  StatusBar,
  PanResponder,
} from "react-native";
import {
  ChevronDown,
  Heart,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  Repeat1,
  ListMusic,
  Mic2,
} from "lucide-react-native";
import { usePlayer } from "../stores/player";
import { useUI } from "../stores/ui";
import { useLibrary } from "../stores/library";
import { colors } from "../theme/colors";
import { formatTime, shortTitle } from "../lib/format";
import { seekTo } from "../audio/audioEngine";
import { Visualizer } from "../components/Visualizer";
import { SyncedLyrics } from "../components/SyncedLyrics";
import { QueuePanel } from "../components/QueuePanel";

const { width } = Dimensions.get("window");

export function NowPlayingModal() {
  const open = useUI((s) => s.nowPlayingOpen);
  const close = () => useUI.getState().setNowPlayingOpen(false);

  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const cur = queue[index];

  const playing = usePlayer((s) => s.playing);
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const shuffle = usePlayer((s) => s.shuffle);
  const repeat = usePlayer((s) => s.repeat);

  const toggle = usePlayer((s) => s.toggle);
  const next = usePlayer((s) => s.next);
  const prev = usePlayer((s) => s.prev);
  const setShuffle = usePlayer((s) => s.setShuffle);
  const setRepeat = usePlayer((s) => s.setRepeat);

  const isLiked = useLibrary((s) => (cur ? s.isLiked(cur.id) : false));
  const toggleLike = useLibrary((s) => s.toggleLike);

  const [mode, setMode] = useState<"player" | "lyrics" | "queue">("player");
  const [seekingPosition, setSeekingPosition] = useState<number | null>(null);

  if (!cur) return null;

  const currentSec = seekingPosition !== null ? seekingPosition : position;
  const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentSec / duration)) : 0;

  // Handle tap or scrub on the seek bar
  const handleSeekPress = (event: any) => {
    const { locationX } = event.nativeEvent;
    const barWidth = width - 48; // padding 24 on each side
    const ratio = Math.max(0, Math.min(1, locationX / barWidth));
    const targetSec = ratio * duration;
    seekTo(targetSec);
  };

  const handleRepeatCycle = () => {
    if (repeat === "off") setRepeat("all");
    else if (repeat === "all") setRepeat("one");
    else setRepeat("off");
  };

  return (
    <Modal visible={open} animationType="slide" transparent={false} onRequestClose={close}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Header Bar */}
        <View style={styles.header}>
          <TouchableOpacity onPress={close} style={styles.headerBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <ChevronDown color={colors.textPrimary} size={26} />
          </TouchableOpacity>

          {/* Mode Switcher */}
          <View style={styles.modeSwitch}>
            <TouchableOpacity
              style={[styles.modeTab, mode === "player" && styles.modeTabActive]}
              onPress={() => setMode("player")}
            >
              <Text style={[styles.modeText, mode === "player" && styles.modeTextActive]}>Song</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, mode === "lyrics" && styles.modeTabActive]}
              onPress={() => setMode("lyrics")}
            >
              <Text style={[styles.modeText, mode === "lyrics" && styles.modeTextActive]}>Lyrics</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, mode === "queue" && styles.modeTabActive]}
              onPress={() => setMode("queue")}
            >
              <Text style={[styles.modeText, mode === "queue" && styles.modeTextActive]}>Queue</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={() => toggleLike(cur)}
            style={styles.headerBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Heart
              color={isLiked ? colors.accent : colors.textSecondary}
              fill={isLiked ? colors.accent : "none"}
              size={22}
            />
          </TouchableOpacity>
        </View>

        {/* Mode Content */}
        {mode === "player" && (
          <View style={styles.playerBody}>
            {/* Artwork Hero */}
            <View style={styles.artContainer}>
              <View style={styles.artGlow} />
              <Image
                source={{ uri: cur.thumb || `https://i.ytimg.com/vi/${cur.id}/hqdefault.jpg` }}
                style={styles.artwork}
                resizeMode="cover"
              />
            </View>

            {/* Song Meta */}
            <View style={styles.metaRow}>
              <View style={styles.metaInfo}>
                <Text style={styles.title} numberOfLines={1}>
                  {shortTitle(cur.title)}
                </Text>
                <Text style={styles.artist} numberOfLines={1}>
                  {cur.artist}
                </Text>
              </View>
            </View>

            {/* Animated Waveform Visualizer */}
            <View style={styles.vizRow}>
              <Visualizer playing={playing} />
            </View>

            {/* Progress / Seek Bar */}
            <View style={styles.progressSection}>
              <TouchableOpacity
                style={styles.progressBarTouch}
                activeOpacity={1}
                onPress={handleSeekPress}
              >
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
                  <View style={[styles.progressHandle, { left: `${progressRatio * 100}%` }]} />
                </View>
              </TouchableOpacity>
              <View style={styles.timeRow}>
                <Text style={styles.timeText}>{formatTime(currentSec)}</Text>
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>
            </View>

            {/* Transport Controls */}
            <View style={styles.controlsRow}>
              {/* Shuffle */}
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => setShuffle(!shuffle)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Shuffle color={shuffle ? colors.accent : colors.textSecondary} size={20} />
                {shuffle && <View style={styles.activeDot} />}
              </TouchableOpacity>

              {/* Prev */}
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => prev()}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <SkipBack color={colors.textPrimary} size={28} />
              </TouchableOpacity>

              {/* Play / Pause Disc */}
              <TouchableOpacity
                style={styles.playDisc}
                onPress={toggle}
                activeOpacity={0.85}
              >
                {playing ? (
                  <Pause color={colors.background} size={28} />
                ) : (
                  <Play color={colors.background} size={28} style={{ marginLeft: 3 }} />
                )}
              </TouchableOpacity>

              {/* Next */}
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={() => next(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <SkipForward color={colors.textPrimary} size={28} />
              </TouchableOpacity>

              {/* Repeat */}
              <TouchableOpacity
                style={styles.controlBtn}
                onPress={handleRepeatCycle}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {repeat === "one" ? (
                  <Repeat1 color={colors.accent} size={20} />
                ) : (
                  <Repeat color={repeat === "all" ? colors.accent : colors.textSecondary} size={20} />
                )}
                {repeat !== "off" && <View style={styles.activeDot} />}
              </TouchableOpacity>
            </View>

            {/* Quick switcher buttons at bottom */}
            <View style={styles.quickBar}>
              <TouchableOpacity style={styles.quickPill} onPress={() => setMode("lyrics")}>
                <Mic2 color={colors.textSecondary} size={15} />
                <Text style={styles.quickText}>Lyrics</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickPill} onPress={() => setMode("queue")}>
                <ListMusic color={colors.textSecondary} size={15} />
                <Text style={styles.quickText}>Up Next</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {mode === "lyrics" && (
          <View style={styles.fullPane}>
            <SyncedLyrics title={cur.title} artist={cur.artist} />
            {/* Mini playback bar in lyrics view */}
            <View style={styles.miniTransport}>
              <TouchableOpacity onPress={() => prev()}>
                <SkipBack color={colors.textPrimary} size={22} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.miniPlayBtn} onPress={toggle}>
                {playing ? (
                  <Pause color={colors.background} size={20} />
                ) : (
                  <Play color={colors.background} size={20} style={{ marginLeft: 2 }} />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => next(true)}>
                <SkipForward color={colors.textPrimary} size={22} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {mode === "queue" && (
          <View style={styles.fullPane}>
            <QueuePanel />
            {/* Mini playback bar in queue view */}
            <View style={styles.miniTransport}>
              <TouchableOpacity onPress={() => prev()}>
                <SkipBack color={colors.textPrimary} size={22} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.miniPlayBtn} onPress={toggle}>
                {playing ? (
                  <Pause color={colors.background} size={20} />
                ) : (
                  <Play color={colors.background} size={20} style={{ marginLeft: 2 }} />
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => next(true)}>
                <SkipForward color={colors.textPrimary} size={22} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  headerBtn: {
    padding: 6,
  },
  modeSwitch: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    padding: 3,
  },
  modeTab: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
  },
  modeTabActive: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  modeText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  modeTextActive: {
    color: colors.textPrimary,
  },
  playerBody: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "space-between",
    paddingBottom: 24,
  },
  artContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    position: "relative",
  },
  artGlow: {
    position: "absolute",
    width: width * 0.75,
    height: width * 0.75,
    borderRadius: (width * 0.75) / 2,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
  },
  artwork: {
    width: width - 80,
    height: width - 80,
    borderRadius: 20,
    backgroundColor: colors.cardBackground,
  },
  metaRow: {
    marginTop: 16,
    alignItems: "center",
  },
  metaInfo: {
    alignItems: "center",
  },
  title: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  artist: {
    color: colors.textSecondary,
    fontSize: 15,
    marginTop: 4,
    textAlign: "center",
  },
  vizRow: {
    height: 36,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 4,
  },
  progressSection: {
    marginVertical: 4,
  },
  progressBarTouch: {
    paddingVertical: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 2,
    position: "relative",
    justifyContent: "center",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 2,
  },
  progressHandle: {
    position: "absolute",
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.textPrimary,
    marginLeft: -6,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  timeText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginVertical: 8,
  },
  controlBtn: {
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  activeDot: {
    position: "absolute",
    bottom: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  playDisc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.textPrimary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  quickBar: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginTop: 4,
  },
  quickPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  quickText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  fullPane: {
    flex: 1,
  },
  miniTransport: {
    height: 64,
    backgroundColor: "rgba(18, 18, 18, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 36,
  },
  miniPlayBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.textPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
});
