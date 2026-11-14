import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { Search as SearchIcon, X, Music } from "lucide-react-native";
import { getSuggestions, search } from "../api/innertube";
import { SearchFilter, SearchRow } from "../types";
import { colors } from "../theme/colors";
import { usePlayer } from "../stores/player";
import { useUI } from "../stores/ui";
import { shortTitle } from "../lib/format";

const FILTERS: Array<{ id: SearchFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "songs", label: "Songs" },
  { id: "videos", label: "Videos" },
  { id: "albums", label: "Albums" },
  { id: "artists", label: "Artists" },
  { id: "playlists", label: "Playlists" },
];

export function SearchScreen() {
  const storeQuery = useUI((s) => s.searchQuery);
  const setStoreQuery = useUI((s) => s.setSearchQuery);

  const [query, setQuery] = useState(storeQuery);
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [results, setResults] = useState<SearchRow[]>([]);
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<any>(null);
  const playTrack = usePlayer((s) => s.playTrack);

  // Sync if store query changed from outside (e.g. browse chip tap on HomeScreen)
  useEffect(() => {
    if (storeQuery !== query) {
      setQuery(storeQuery);
      if (storeQuery.trim()) {
        executeSearch(storeQuery, filter);
      }
    }
  }, [storeQuery]);

  // Live debounced suggestions & search
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      getSuggestions(query).then((sug) => {
        setSuggestions(sug);
      });
      executeSearch(query, filter);
    }, 400);

    return () => clearTimeout(timer);
  }, [query, filter]);

  const executeSearch = async (q: string, f: SearchFilter) => {
    if (!q.trim()) return;
    setLoading(true);
    try {
      const res = await search(q, f);
      setResults(res.rows);
    } catch (e) {
      console.warn("Search error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleTextChange = (text: string) => {
    setQuery(text);
    setStoreQuery(text);
  };

  const handleSuggestionPress = (item: string) => {
    setQuery(item);
    setStoreQuery(item);
    executeSearch(item, filter);
  };

  const handleClear = () => {
    setQuery("");
    setStoreQuery("");
    setSuggestions([]);
    setResults([]);
    inputRef.current?.focus();
  };

  return (
    <View style={styles.container}>
      {/* Search Input Bar */}
      <View style={styles.inputContainer}>
        <SearchIcon size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          ref={inputRef}
          value={query}
          onChangeText={handleTextChange}
          placeholder="Search songs, albums, artists..."
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          returnKeyType="search"
          autoCorrect={false}
          spellCheck={false}
          blurOnSubmit={false}
          onSubmitEditing={() => executeSearch(query, filter)}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={handleClear} style={styles.clearBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Chips */}
      <View style={styles.filtersWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.filtersScroll}
        >
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                onPress={() => {
                  setFilter(f.id);
                  if (query.trim()) executeSearch(query, f.id);
                }}
                style={[styles.filterChip, active && styles.activeFilterChip]}
              >
                <Text style={[styles.filterChipText, active && styles.activeFilterChipText]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Results / Suggestions Scroll */}
      <ScrollView
        style={styles.resultsScroll}
        contentContainerStyle={styles.resultsContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        )}

        {/* Query Suggestions when typing */}
        {!loading && suggestions.length > 0 && results.length === 0 && (
          <View style={styles.suggestionsContainer}>
            {suggestions.map((item, idx) => (
              <TouchableOpacity
                key={`${item}-${idx}`}
                onPress={() => handleSuggestionPress(item)}
                style={styles.suggestionRow}
              >
                <SearchIcon size={16} color={colors.textMuted} />
                <Text style={styles.suggestionText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Search Results List */}
        {!loading &&
          results.map((row, idx) => {
            if (row.kind === "track" || row.kind === "top") {
              const song = row.song;
              return (
                <TouchableOpacity
                  key={`${song.id}-${idx}`}
                  activeOpacity={0.7}
                  onPress={() => {
                    Keyboard.dismiss();
                    playTrack(song);
                  }}
                  style={styles.resultRow}
                >
                  <Image source={{ uri: song.thumb }} style={styles.resultThumb} />
                  <View style={styles.resultInfo}>
                    <Text numberOfLines={1} style={styles.resultTitle}>
                      {shortTitle(song.title)}
                    </Text>
                    <Text numberOfLines={1} style={styles.resultArtist}>
                      {song.artist}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }
            return null;
          })}

        {!loading && query.trim() !== "" && results.length === 0 && suggestions.length === 0 && (
          <View style={styles.emptyContainer}>
            <Music size={36} color={colors.textMuted} />
            <Text style={styles.emptyText}>No results found for "{query}"</Text>
          </View>
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
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: 6,
  },
  filtersWrapper: {
    marginBottom: 10,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.cardBg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  activeFilterChip: {
    backgroundColor: "#ffffff",
  },
  filterChipText: {
    color: colors.textFaint,
    fontSize: 12.5,
    fontWeight: "500",
  },
  activeFilterChipText: {
    color: "#000000",
    fontWeight: "700",
  },
  resultsScroll: {
    flex: 1,
  },
  resultsContent: {
    paddingHorizontal: 16,
    paddingBottom: 90,
  },
  loader: {
    paddingVertical: 30,
    alignItems: "center",
  },
  suggestionsContainer: {
    paddingVertical: 8,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  suggestionText: {
    color: colors.text,
    fontSize: 14,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  resultThumb: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.surfaceLight,
  },
  resultInfo: {
    flex: 1,
    marginLeft: 12,
  },
  resultTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
  },
  resultArtist: {
    color: colors.textFaint,
    fontSize: 12,
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
});
