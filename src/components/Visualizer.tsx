import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated } from "react-native";
import { colors } from "../theme/colors";

interface VisualizerProps {
  playing: boolean;
  barCount?: number;
}

export function Visualizer({ playing, barCount = 18 }: VisualizerProps) {
  const animatedValues = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(4))
  ).current;

  useEffect(() => {
    let timer: any = null;
    if (playing) {
      const animate = () => {
        const animations = animatedValues.map((anim, i) => {
          // Semi-randomized music frequency emulation
          const height = Math.floor(Math.random() * 24) + 4;
          return Animated.timing(anim, {
            toValue: height,
            duration: 120 + (i % 3) * 40,
            useNativeDriver: false,
          });
        });
        Animated.parallel(animations).start(() => {
          if (playing) timer = setTimeout(animate, 50);
        });
      };
      animate();
    } else {
      animatedValues.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 4,
          duration: 200,
          useNativeDriver: false,
        }).start();
      });
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [playing]);

  return (
    <View style={styles.container}>
      {animatedValues.map((anim, idx) => (
        <Animated.View
          key={idx}
          style={[styles.bar, { height: anim }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 32,
    gap: 3.5,
  },
  bar: {
    width: 3.5,
    borderRadius: 2,
    backgroundColor: "rgba(255, 255, 255, 0.45)",
  },
});
