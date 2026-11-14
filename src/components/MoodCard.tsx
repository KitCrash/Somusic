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
import { colors } from "../theme/colors";

const { width } = Dimensions.get("window");
export const MOOD_CARD_WIDTH = (width - 48) / 2;

interface MoodCardProps {
  title: string;
  color?: string;
  covers?: string[];
  onPress: () => void;
}

export function MoodCard({
  title,
  color = "#8b5cf6",
  covers = [],
  onPress,
}: MoodCardProps) {
  const pressAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    Animated.spring(pressAnim, {
      toValue: 1,
      friction: 6,
      tension: 60,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, {
      toValue: 0,
      friction: 6,
      tension: 60,
      useNativeDriver: true,
    }).start();
  };

  // Card scale on press
  const cardScale = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.96],
  });

  // Disc slide out & rotation on press
  const discTranslateX = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-24, -36],
  });
  const discRotate = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "60deg"],
  });

  // Sleeve tilt on press
  const sleeveRotate = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["8deg", "3deg"],
  });

  // Default sleeve and label thumbnails if covers aren't loaded yet
  const sleeveThumb = covers[0] || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=300&q=80";
  const labelThumb = covers[1] || covers[0] || sleeveThumb;

  // Darkened gradient colors based on category color
  const darkColor = "#09090b";

  return (
    <Animated.View style={{ transform: [{ scale: cardScale }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.card}
      >
        <LinearGradient
          colors={[color, darkColor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {/* Card Title */}
          <Text style={styles.title} numberOfLines={2}>
            {title}
          </Text>

          {/* Bottom-Right Vinyl Record + Sleeve Art */}
          <View style={styles.artContainer} pointerEvents="none">
            {/* Vinyl Record (sliding out to the left) */}
            <Animated.View
              style={[
                styles.vinylDisc,
                {
                  transform: [
                    { translateX: discTranslateX },
                    { rotate: discRotate },
                  ],
                },
              ]}
            >
              {/* Concentric Grooves */}
              <View style={styles.grooveOuter} />
              <View style={styles.grooveInner} />

              {/* Center Label */}
              <View style={styles.discLabel}>
                <Image source={{ uri: labelThumb }} style={styles.labelImage} />
                <View style={styles.centerHole} />
              </View>
            </Animated.View>

            {/* Album Cover Sleeve (tilted over the disc) */}
            <Animated.View
              style={[
                styles.sleeve,
                {
                  transform: [{ rotate: sleeveRotate }],
                },
              ]}
            >
              <Image source={{ uri: sleeveThumb }} style={styles.sleeveImage} />
            </Animated.View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: MOOD_CARD_WIDTH,
    height: 110,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  gradient: {
    flex: 1,
    padding: 14,
    justifyContent: "space-between",
    position: "relative",
  },
  title: {
    color: "#ffffff",
    fontSize: 16.5,
    fontWeight: "800",
    maxWidth: "55%",
    lineHeight: 20,
    letterSpacing: -0.3,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    zIndex: 2,
  },
  artContainer: {
    position: "absolute",
    right: 2,
    bottom: -8,
    width: 68,
    height: 68,
  },
  vinylDisc: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: "#111113",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 1,
  },
  grooveOuter: {
    position: "absolute",
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  grooveInner: {
    position: "absolute",
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  discLabel: {
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.6)",
  },
  labelImage: {
    width: "100%",
    height: "100%",
  },
  centerHole: {
    position: "absolute",
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#000000",
  },
  sleeve: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 58,
    height: 58,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.14)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 2,
  },
  sleeveImage: {
    width: "100%",
    height: "100%",
  },
});
