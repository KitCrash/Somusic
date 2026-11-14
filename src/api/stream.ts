/** Audio streaming URL resolver for SoMusic Mobile */

const PIPED_INSTANCES = [
  "https://pipedapi.kavin.rocks",
  "https://api.piped.private.coffee",
  "https://pipedapi.tokhmi.xyz",
  "https://piped-api.lunar.icu",
];

const INVIDIOUS_INSTANCES = [
  "https://inv.nadeko.net",
  "https://invidious.nerdvpn.de",
  "https://yt.artemislena.eu",
];

export async function resolveStreamUrl(videoId: string): Promise<string> {
  // 1. Try Piped API instances
  for (const base of PIPED_INSTANCES) {
    try {
      const ctl = new AbortController();
      const timeout = setTimeout(() => ctl.abort(), 3500);
      const res = await fetch(`${base}/streams/${encodeURIComponent(videoId)}`, {
        signal: ctl.signal,
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        const audioStreams = json.audioStreams || [];
        // Pick best audio stream
        if (audioStreams.length > 0) {
          const stream =
            audioStreams.find((s: any) => s.mimeType?.includes("audio/mp4") || s.format === "M4A") ||
            audioStreams[0];
          if (stream?.url) return stream.url;
        }
      }
    } catch (e) {
      // Try next instance
    }
  }

  // 2. Try Invidious API instances
  for (const base of INVIDIOUS_INSTANCES) {
    try {
      const ctl = new AbortController();
      const timeout = setTimeout(() => ctl.abort(), 3500);
      const res = await fetch(`${base}/api/v1/videos/${encodeURIComponent(videoId)}`, {
        signal: ctl.signal,
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      clearTimeout(timeout);

      if (res.ok) {
        const json = await res.json();
        const formats = json.adaptiveFormats || [];
        const audio = formats.find((f: any) => f.type?.startsWith("audio/"));
        if (audio?.url) return audio.url;
      }
    } catch (e) {
      // Try next
    }
  }

  // 3. Fallback direct stream endpoint
  return `https://inv.nadeko.net/latest_version?id=${encodeURIComponent(videoId)}&itag=140`;
}
