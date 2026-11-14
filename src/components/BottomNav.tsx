import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Home, Compass, Search, Library } from "lucide-react-native";
import { useUI, TabName } from "../stores/ui";
import { colors } from "../theme/colors";

export function BottomNav() {
  const activeTab = useUI((s) => s.activeTab);
  const setActiveTab = useUI((s) => s.setActiveTab);

  const tabs: Array<{ name: TabName; label: string; icon: any }> = [
    { name: "home", label: "Home", icon: Home },
    { name: "explore", label: "Explore", icon: Compass },
    { name: "search", label: "Search", icon: Search },
    { name: "library", label: "Library", icon: Library },
  ];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const IconComponent = tab.icon;
        const isActive = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            activeOpacity={0.7}
            onPress={() => setActiveTab(tab.name)}
            style={styles.tab}
          >
            <IconComponent
              size={22}
              color={isActive ? colors.text : colors.textMuted}
            />
            <Text
              style={[
                styles.label,
                { color: isActive ? colors.text : colors.textMuted },
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    height: 58,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceBorder,
    alignItems: "center",
    justifyContent: "space-around",
  },
  tab: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 4,
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 4,
  },
});
