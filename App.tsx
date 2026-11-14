import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { useUI } from "./src/stores/ui";
import { initAudioEngine } from "./src/audio/audioEngine";
import { initAutoplay } from "./src/lib/autoplay";
import { colors } from "./src/theme/colors";

import { HomeScreen } from "./src/screens/HomeScreen";
import { ExploreScreen } from "./src/screens/ExploreScreen";
import { SearchScreen } from "./src/screens/SearchScreen";
import { LibraryScreen } from "./src/screens/LibraryScreen";
import { MiniPlayer } from "./src/components/MiniPlayer";
import { BottomNav } from "./src/components/BottomNav";
import { NowPlayingModal } from "./src/screens/NowPlayingModal";

export default function App() {
  const activeTab = useUI((s) => s.activeTab);

  useEffect(() => {
    // 1. Initialize expo-av background audio engine
    initAudioEngine();

    // 2. Initialize endless autoplay queue replenishment subscriber
    const unsubAutoplay = initAutoplay();

    return () => {
      unsubAutoplay();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <StatusBar style="light" />

        {/* Active Screen Tab */}
        <View style={styles.screenContainer}>
          {activeTab === "home" && <HomeScreen />}
          {activeTab === "explore" && <ExploreScreen />}
          {activeTab === "search" && <SearchScreen />}
          {activeTab === "library" && <LibraryScreen />}
        </View>

        {/* Docked Mini Player */}
        <MiniPlayer />

        {/* Bottom 4-Tab Navigation */}
        <BottomNav />

        {/* Fullscreen Cinematic Now Playing Modal */}
        <NowPlayingModal />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screenContainer: {
    flex: 1,
  },
});
