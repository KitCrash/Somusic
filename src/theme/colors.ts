/** Theme color definitions for SoMusic Mobile */

export const colors = {
  background: "#000000",
  surface: "#121214",
  surfaceLight: "#1c1c1f",
  surfaceBorder: "rgba(255, 255, 255, 0.08)",

  cardBg: "rgba(255, 255, 255, 0.04)",
  cardBackground: "rgba(255, 255, 255, 0.04)",
  cardBgHover: "rgba(255, 255, 255, 0.08)",
  cardBorder: "rgba(255, 255, 255, 0.06)",

  text: "#ffffff",
  textPrimary: "#ffffff",
  textFaint: "rgba(255, 255, 255, 0.65)",
  textSecondary: "rgba(255, 255, 255, 0.65)",
  textMuted: "rgba(255, 255, 255, 0.4)",

  primary: "#ffffff",
  accent: "#8b5cf6",
  accentGlow: "rgba(139, 92, 246, 0.3)",

  error: "#ef4444",
  success: "#22c55e",

  // Mood / Genre tile gradients
  moods: {
    hits: "#E13300",
    chill: "#2D6A4F",
    focus: "#023E8A",
    workout: "#D00000",
    rock: "#F44336",
    pop: "#C9184A",
    hiphop: "#FF9800",
    electronic: "#00BCD4",
  },

  // Radio pastels
  pastels: [
    ["#a7baf5", "#8ea7ef"],
    ["#c99bf2", "#b57fee"],
    ["#f2a98e", "#ec9377"],
    ["#a9e3c3", "#8fd7ae"],
    ["#d8e07c", "#cbd45f"],
    ["#f3b8cf", "#eda0bd"],
    ["#f0cf8e", "#e9bd6e"],
    ["#9fd8f0", "#7fc7e8"],
  ] as const,
};
