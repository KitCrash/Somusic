import { createAudioPlayer, setAudioModeAsync, AudioPlayer, AudioStatus } from "expo-audio";
import { usePlayer } from "../stores/player";
import { resolveStreamUrl } from "../api/stream";
import { useLibrary } from "../stores/library";

let playerInstance: AudioPlayer | null = null;
let currentTrackId: string | null = null;
let isLoading = false;

export async function initAudioEngine(): Promise<void> {
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    });
  } catch (e) {
    console.warn("Audio mode error:", e);
  }

  // Subscribe to store changes to control playback
  usePlayer.subscribe(async (state, prev) => {
    const cur = state.queue[state.index];

    // 1. Track changed
    if (cur && cur.id !== currentTrackId) {
      currentTrackId = cur.id;
      useLibrary.getState().addToHistory(cur);
      await loadAndPlayTrack(cur.id, state.playing);
      return;
    }

    // 2. Play/Pause toggle
    if (state.playing !== prev.playing) {
      if (playerInstance) {
        if (state.playing) {
          playerInstance.play();
        } else {
          playerInstance.pause();
        }
      } else if (state.playing && cur) {
        await loadAndPlayTrack(cur.id, true);
      }
    }
  });
}

async function loadAndPlayTrack(trackId: string, shouldPlay = true): Promise<void> {
  if (isLoading) return;
  isLoading = true;

  try {
    const streamUrl = await resolveStreamUrl(trackId);

    if (playerInstance) {
      playerInstance.pause();
      playerInstance.replace({ uri: streamUrl });
    } else {
      playerInstance = createAudioPlayer(
        { uri: streamUrl },
        { updateInterval: 250, keepAudioSessionActive: true }
      );
      playerInstance.addListener("playbackStatusUpdate", onPlaybackStatusUpdate);
    }

    if (shouldPlay) {
      playerInstance.play();
    }
  } catch (e) {
    console.warn("Failed to load audio stream:", e);
  } finally {
    isLoading = false;
  }
}

function onPlaybackStatusUpdate(status: AudioStatus): void {
  const player = usePlayer.getState();
  const posSec = status.currentTime || 0;
  const durSec = status.duration || 0;

  if (Math.abs(player.position - posSec) > 0.5) {
    player.setPosition(posSec);
  }
  if (durSec > 0 && Math.abs(player.duration - durSec) > 1) {
    player.setDuration(durSec);
  }

  // Track finished
  if (status.playbackState === "ended" || (durSec > 0 && posSec >= durSec - 0.2)) {
    if (player.repeat === "one") {
      playerInstance?.seekTo(0);
      playerInstance?.play();
    } else {
      player.next(false);
    }
  }
}

export async function seekTo(seconds: number): Promise<void> {
  if (playerInstance) {
    try {
      playerInstance.seekTo(Math.max(0, seconds));
      usePlayer.getState().setPosition(seconds);
    } catch (e) {
      console.warn("Seek error:", e);
    }
  }
}
