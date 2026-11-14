export function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function shortTitle(title: string): string {
  return title
    .replace(/\s*\([^)]*(?:official|video|audio|lyrics?)[^)]*\)/gi, "")
    .replace(/\s*\[[^\]]*(?:official|video|audio|lyrics?)[^\]]*\]/gi, "")
    .trim();
}
