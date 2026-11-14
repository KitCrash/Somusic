import React, { useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Play } from "lucide-react-native";
import { colors } from "../theme/colors";

const { width } = Dimensions.get("window");
export const STACK_CARD_WIDTH = (width - 48) / 2;

interface CoverStackProps {
  title: string;
  subtitle: string;
  gradientStops?: readonly [string, string, ...string[]];
  icon?: React.ReactNode;
  covers?: string[];
  onPress: () => void;
  onPlay?: () => void;
  isPinned?: boolean;
}

export function CoverStack({
  title,
  subtitle,
  gradientStops = ["#4310F5", "#8D85E5", "#B4F0D6"],
  icon,
  covers = [],
  onPress,
  onPlay,
  isPinned = false,
}: CoverStackProps) {
  const fanAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.spring(fanAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(fanAnim, {
      toValue: 0,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  // Interpolations for sleeve 1 (left tilt) and sleeve 2 (right tilt)
  const rotateLeft = fanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["-7deg", "-15deg"],
  });
  const translateLeftX = fanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, -16],
  });

  const rotateRight = fanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["7deg", "15deg"],
  });
  const translateRightX = fanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, 16],
  });

  const scaleCenter = fanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  const validCovers = covers.filter(Boolean);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.cardContainer}
    >
      {/* 3-Sleeve Art Stack */}
      <View style={styles.artContainer}>
        {/* Ambient Glow */}
        <View style={[styles.glow, { backgroundColor: gradientStops[0] }]} />

        {/* Back Sleeve 1 (tilted left) */}
        <Animated.View
          style={[
            styles.sleeve,
            styles.sleeveBackLeft,
            {
              transform: [{ rotate: rotateLeft }, { translateX: translateLeftX }],
            },
          ]}
        >
          {validCovers[1] ? (
            <Image source={{ uri: validCovers[1] }} style={styles.sleeveImg} />
          ) : (
            <View style={[styles.sleeveFallback, { backgroundColor: "#ef4444" }]} />
          )}
        </Animated.View>

        {/* Back Sleeve 2 (tilted right) */}
        <Animated.View
          style={[
            styles.sleeve,
            styles.sleeveBackRight,
            {
              transform: [{ rotate: rotateRight }, { translateX: translateRightX }],
            },
          ]}
        >
          {validCovers[2] ? (
            <Image source={{ uri: validCovers[2] }} style={styles.sleeveImg} />
          ) : (
            <View style={[styles.sleeveFallback, { backgroundColor: "#3b82f6" }]} />
          )}
        </Animated.View>

        {/* Front Sleeve 0 (center) */}
        <Animated.View
          style={[
            styles.sleeve,
            styles.sleeveFront,
            {
              transform: [{ scale: scaleCenter }],
            },
          ]}
        >
          {validCovers[0] && !icon ? (
            <Image source={{ uri: validCovers[0] }} style={styles.sleeveImg} />
          ) : (
            <LinearGradient
              colors={gradientStops as [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientSleeve}
            >
              {icon}
            </LinearGradient>
          )}

          {/* Quick Play Button */}
          {onPlay && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation?.();
                onPlay();
              }}
              style={styles.playBtn}
            >
              <Play size={14} color="#000000" fill="#000000" style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>

      {/* Title & Subtitle */}
      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>
        <Text numberOfLines={1} style={styles.subtitle}>
          {isPinned ? "Pinned · " : ""}
          {subtitle}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    width: STACK_CARD_WIDTH,
    marginBottom: 20,
  },
  artContainer: {
    width: STACK_CARD_WIDTH,
    height: STACK_CARD_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  glow: {
    position: "absolute",
    width: STACK_CARD_WIDTH * 0.7,
    height: STACK_CARD_WIDTH * 0.7,
    borderRadius: (STACK_CARD_WIDTH * 0.7) / 2,
    opacity: 0.25,
    top: STACK_CARD_WIDTH * 0.18,
  },
  sleeve: {
    position: "absolute",
    width: STACK_CARD_WIDTH * 0.78,
    height: STACK_CARD_WIDTH * 0.78,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  sleeveBackLeft: {
    zIndex: 1,
  },
  sleeveBackRight: {
    zIndex: 2,
  },
  sleeveFront: {
    zIndex: 3,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  sleeveImg: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surface,
  },
  sleeveFallback: {
    width: "100%",
    height: "100%",
    opacity: 0.85,
  },
  gradientSleeve: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
  info: {
    marginTop: 10,
    paddingHorizontal: 4,
  },
  title: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  subtitle: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 2,
  },
});
