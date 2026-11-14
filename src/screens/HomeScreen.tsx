import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Search as SearchIcon, Settings } from "lucide-react-native";
import { getHome, getMoods } from "../api/innertube";
import { HomeShelf, MoodEntry } from "../types";
import { colors } from "../theme/colors";
import { ShelfScroller } from "../components/ShelfScroller";
import { DeckCarousel } from "../components/DeckCarousel";
import { useUI } from "../stores/ui";

export function HomeScreen() {
  const [shelves, setShelves] = useState<HomeShelf[]>([]);
  const [moods, setMoods] = useState<MoodEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const setActiveTab = useUI((s) => s.setActiveTab);
  const setSearchQuery = useUI((s) => s.setSearchQuery);

  const loadData = async () => {
    try {
      const [hShelves, mEntries] = await Promise.all([getHome(), getMoods()]);
      setShelves(hShelves);
      setMoods(mEntries);
    } catch (e) {
      console.warn("Home load error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  return (
    <View style={styles.container}>
      {/* Top Bar Header */}
      <View style={styles.topBar}>
        <Text style={styles.logoText}>
          <Text style={{ color: "#ec4899" }}>So</Text>Music
        </Text>
        <View style={styles.topBarActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setActiveTab("search")}
          >
            <SearchIcon size={20} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.avatarBtn}>
            <Text style={styles.avatarText}>M</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accent}
          />
        }
      >
        {/* Browse Chips */}
        <View style={styles.chipsSection}>
          <Text style={styles.chipsTitle}>Browse</Text>
          <Text style={styles.chipsSubtitle}>Common searches to get you started</Text>
          <View style={styles.chipsGrid}>
            {moods.map((m) => (
              <TouchableOpacity
                key={m.title}
                activeOpacity={0.7}
                onPress={() => {
                  setSearchQuery(m.title);
                  setActiveTab("search");
                }}
                style={styles.chip}
              >
                <Text style={styles.chipText}>{m.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Music Shelves */}
        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : (
          shelves.map((shelf, idx) => {
            const shelfTracks = shelf.items.flatMap((i) => (i.track ? [i.track] : []));
            if (idx === 0 && shelfTracks.length > 0) {
              return (
                <DeckCarousel
                  key={`${shelf.title}-${idx}`}
                  title={shelf.title}
                  count={shelfTracks.length}
                  tracks={shelfTracks}
                />
              );
            }
            return <ShelfScroller key={`${shelf.title}-${idx}`} shelf={shelf} />;
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  logoText: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  topBarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    padding: 6,
  },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ec4899",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  chipsSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  chipsTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  chipsSubtitle: {
    color: colors.textFaint,
    fontSize: 13,
    marginTop: 2,
    marginBottom: 12,
  },
  chipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "500",
  },
  loaderContainer: {
    paddingVertical: 40,
    alignItems: "center",
  },
});
