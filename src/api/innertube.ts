import {
  HomeShelf,
  HomeItem,
  MoodEntry,
  MoodPage,
  PodcastShelf,
  RadioPage,
  RadioTrack,
  SearchPageResult,
  SearchRow,
  Track,
} from "../types";

const INNERTUBE_CLIENT = {
  clientName: "WEB_REMIX",
  clientVersion: "1.20240722.01.00",
  hl: "en",
  gl: "US",
};

const HEADERS = {
  "Content-Type": "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "X-YouTube-Client-Name": "67",
  "X-YouTube-Client-Version": "1.20240722.01.00",
  Origin: "https://music.youtube.com",
};

export async function search(query: string, filter = "all"): Promise<SearchPageResult> {
  if (!query.trim()) return { rows: [], continuation: null };

  const filterParam =
    filter === "songs"
      ? "EgWKAQIIAWoKEAkQChAFEAMQBA=="
      : filter === "videos"
      ? "EgWKAQIQAWoKEAkQChAFEAMQBA=="
      : filter === "albums"
      ? "EgWKAQIYAWoKEAkQChAFEAMQBA=="
      : filter === "artists"
      ? "EgWKAQIgAWoKEAkQChAFEAMQBA=="
      : filter === "playlists"
      ? "EgWKAQIoAWoKEAkQChAFEAMQBA=="
      : undefined;

  try {
    const payload: any = {
      context: { client: INNERTUBE_CLIENT },
      query,
    };
    if (filterParam) payload.params = filterParam;

    const res = await fetch("https://music.youtube.com/youtubei/v1/search?prettyPrint=false", {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const json = await res.json();
      const rows: SearchRow[] = [];
      const seenIds = new Set<string>();

      const extractItems = (obj: any) => {
        if (!obj || typeof obj !== "object") return;
        if (obj.musicResponsiveListItemRenderer) {
          const item = obj.musicResponsiveListItemRenderer;
          const flexCols = item.flexColumns || [];
          if (flexCols.length > 0) {
            const col0Runs = flexCols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
            const title = col0Runs?.[0]?.text || "";
            let artist = "";
            if (flexCols.length > 1) {
              const col1Runs = flexCols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs;
              if (col1Runs?.length > 0) artist = col1Runs[0]?.text || "";
            }

            const videoId =
              item.playlistItemData?.videoId ||
              item.navigationEndpoint?.watchEndpoint?.videoId ||
              item.doubleTapCommand?.watchEndpoint?.videoId;

            let thumb = "";
            const thumbs = item.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails;
            if (thumbs?.length > 0) thumb = thumbs[thumbs.length - 1]?.url || "";

            if (videoId && title && !seenIds.has(videoId)) {
              seenIds.add(videoId);
              rows.push({
                kind: "track",
                song: {
                  id: videoId,
                  title,
                  artist: artist || "Popular Artist",
                  duration: 200,
                  thumb: thumb || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                },
              });
            }
          }
        }
        for (const k of Object.keys(obj)) {
          extractItems(obj[k]);
        }
      };

      extractItems(json);
      if (rows.length > 0) return { rows, continuation: null };
    }
  } catch (e) {
    console.warn("InnerTube search failed, using fallback:", e);
  }

  // Curated search fallback
  const curated = [
    { id: "SWY0v8GfY3o", title: "Self Aware", artist: "Temper City", duration: 210 },
    { id: "4NRXx6U8ABQ", title: "Blinding Lights", artist: "The Weeknd", duration: 200 },
    { id: "34Na4j8AVgA", title: "Starboy", artist: "The Weeknd ft. Daft Punk", duration: 230 },
    { id: "hT_nvWreIhg", title: "Counting Stars", artist: "OneRepublic", duration: 257 },
    { id: "fJ9rUzIMcZQ", title: "Bohemian Rhapsody", artist: "Queen", duration: 354 },
    { id: "7wtfhZwyrcc", title: "Believer", artist: "Imagine Dragons", duration: 204 },
    { id: "JGwWNGJdvx8", title: "Shape of You", artist: "Ed Sheeran", duration: 233 },
    { id: "bCuhuePlP8o", title: "Someone You Loved", artist: "Lewis Capaldi", duration: 182 },
  ];

  const filtered = curated.filter(
    (t) =>
      t.title.toLowerCase().includes(query.toLowerCase()) ||
      t.artist.toLowerCase().includes(query.toLowerCase())
  );

  return {
    rows: (filtered.length ? filtered : curated).map((t) => ({
      kind: "track",
      song: {
        ...t,
        thumb: `https://i.ytimg.com/vi/${t.id}/hqdefault.jpg`,
      },
    })),
    continuation: null,
  };
}

export async function getSuggestions(query: string): Promise<string[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch("https://music.youtube.com/youtubei/v1/music/get_search_suggestions", {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        context: { client: INNERTUBE_CLIENT },
        input: query,
      }),
    });
    if (res.ok) {
      const json = await res.json();
      const items: string[] = [];
      const contents =
        json.contents?.[0]?.searchSuggestionsSectionRenderer?.contents;
      if (contents) {
        for (const item of contents) {
          const runs = item.searchSuggestionRenderer?.suggestion?.runs;
          if (runs?.length > 0) {
            items.push(runs.map((r: any) => r.text).join(""));
          }
        }
      }
      if (items.length > 0) return items;
    }
  } catch (e) {
    console.warn("Suggestions error:", e);
  }
  return [query, `${query} live`, `${query} lyrics`, `${query} remix`, `${query} acoustic`];
}

export async function getHome(): Promise<HomeShelf[]> {
  try {
    const res = await fetch("https://music.youtube.com/youtubei/v1/browse?prettyPrint=false", {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify({
        context: { client: INNERTUBE_CLIENT },
        browseId: "FEmusic_home",
      }),
    });
    if (res.ok) {
      const json = await res.json();
      const shelves = parseInnerTubeBrowseShelves(json);
      if (shelves.length >= 2) return shelves;
    }
  } catch (e) {
    console.warn("Home InnerTube error, using curated shelves:", e);
  }

  return [
    {
      title: "Today's Biggest Hits",
      items: [
        makeTrackItem("SWY0v8GfY3o", "Self Aware", "Temper City", 210),
        makeTrackItem("4NRXx6U8ABQ", "Blinding Lights", "The Weeknd", 200),
        makeTrackItem("34Na4j8AVgA", "Starboy", "The Weeknd ft. Daft Punk", 230),
        makeTrackItem("hT_nvWreIhg", "Counting Stars", "OneRepublic", 257),
        makeTrackItem("fJ9rUzIMcZQ", "Bohemian Rhapsody", "Queen", 354),
        makeTrackItem("7wtfhZwyrcc", "Believer", "Imagine Dragons", 204),
        makeTrackItem("JGwWNGJdvx8", "Shape of You", "Ed Sheeran", 233),
        makeTrackItem("bCuhuePlP8o", "Someone You Loved", "Lewis Capaldi", 182),
      ],
    },
    {
      title: "Chill & Lo-Fi Vibes",
      items: [
        makeTrackItem("jfKfPfyJRdk", "Lofi Hip Hop Radio Beats", "Lofi Girl", 180),
        makeTrackItem("5yx6BWlEVcY", "Coffee Chill Study", "Chill Beats", 200),
        makeTrackItem("PEM0Vs8jf1w", "Golden Hour", "JVKE", 210),
        makeTrackItem("gset79KMmt0", "Snowman", "Sia", 165),
      ],
    },
    {
      title: "Rock Classics",
      items: [
        makeTrackItem("eVTXPUF4Oz4", "In The End", "Linkin Park", 216),
        makeTrackItem("kXYiU_JCYtU", "Numb", "Linkin Park", 187),
        makeTrackItem("hTWKbfoikeg", "Smells Like Teen Spirit", "Nirvana", 301),
        makeTrackItem("1w7OgIMMRc4", "Sweet Child O' Mine", "Guns N' Roses", 356),
      ],
    },
  ];
}

export async function getMoods(): Promise<MoodEntry[]> {
  return [
    {
      title: "Today's Hits",
      browseId: "FEmusic_moods_and_genres_category",
      params: "ggMPOg1uX1JOQWZFeDByc2Jm",
      color: "#E13300",
      section: "Moods & moments",
    },
    {
      title: "Chill",
      browseId: "FEmusic_moods_and_genres_category",
      params: "ggMPOg1uX1JOQWZFeDByc2Jm",
      color: "#2D6A4F",
      section: "Moods & moments",
    },
    {
      title: "Focus",
      browseId: "FEmusic_moods_and_genres_category",
      params: "ggMPOg1uX1JOQWZFeDByc2Jm",
      color: "#023E8A",
      section: "Moods & moments",
    },
    {
      title: "Workout",
      browseId: "FEmusic_moods_and_genres_category",
      params: "ggMPOg1uX1JOQWZFeDByc2Jm",
      color: "#D00000",
      section: "Moods & moments",
    },
    {
      title: "Rock",
      browseId: "FEmusic_moods_and_genres_category",
      params: "ggMPOg1uX1JOQWZFeDByc2Jm",
      color: "#F44336",
      section: "Genres",
    },
    {
      title: "Pop",
      browseId: "FEmusic_moods_and_genres_category",
      params: "ggMPOg1uX1JOQWZFeDByc2Jm",
      color: "#C9184A",
      section: "Genres",
    },
    {
      title: "Hip-Hop",
      browseId: "FEmusic_moods_and_genres_category",
      params: "ggMPOg1uX1JOQWZFeDByc2Jm",
      color: "#FF9800",
      section: "Genres",
    },
    {
      title: "Electronic",
      browseId: "FEmusic_moods_and_genres_category",
      params: "ggMPOg1uX1JOQWZFeDByc2Jm",
      color: "#00BCD4",
      section: "Genres",
    },
  ];
}

export async function getMoodPage(params?: string): Promise<MoodPage> {
  try {
    const payload: any = {
      context: { client: INNERTUBE_CLIENT },
      browseId: "FEmusic_moods_and_genres_category",
    };
    if (params) payload.params = params;

    const res = await fetch("https://music.youtube.com/youtubei/v1/browse?prettyPrint=false", {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const json = await res.json();
      const title =
        json.header?.musicHeaderRenderer?.title?.runs?.[0]?.text || "Mood & Genre";
      const shelves = parseInnerTubeBrowseShelves(json);
      if (shelves.length > 0) return { title, shelves };
    }
  } catch (e) {
    console.warn("MoodPage error:", e);
  }

  return {
    title: "Mood & Genre",
    shelves: [
      {
        title: "Featured Songs",
        items: [
          makeTrackItem("SWY0v8GfY3o", "Self Aware", "Temper City", 210),
          makeTrackItem("4NRXx6U8ABQ", "Blinding Lights", "The Weeknd", 200),
          makeTrackItem("hT_nvWreIhg", "Counting Stars", "OneRepublic", 257),
          makeTrackItem("fJ9rUzIMcZQ", "Bohemian Rhapsody", "Queen", 354),
        ],
      },
    ],
  };
}

export async function getPodcasts(): Promise<PodcastShelf[]> {
  return [
    {
      title: "Popular Shows",
      shows: [
        {
          id: "show-1",
          title: "The Joe Rogan Experience",
          author: "Joe Rogan",
          thumb: "https://i.ytimg.com/vi/SWY0v8GfY3o/hqdefault.jpg",
        },
        {
          id: "show-2",
          title: "Huberman Lab",
          author: "Andrew Huberman",
          thumb: "https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg",
        },
        {
          id: "show-3",
          title: "Lex Fridman Podcast",
          author: "Lex Fridman",
          thumb: "https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg",
        },
      ],
    },
  ];
}

export async function getRadio(videoId: string, token?: string): Promise<RadioPage> {
  if (!videoId) return { tracks: [], next: null, seed: null };

  try {
    const payload: any = {
      context: { client: INNERTUBE_CLIENT },
      videoId,
      playlistId: `RDAMVM${videoId}`,
      enablePersistentPlaylistPanel: true,
      tunerSettingValue: "AUTOMIX_SETTING_NORMAL",
    };
    if (token) payload.continuation = token;

    const res = await fetch("https://music.youtube.com/youtubei/v1/next?prettyPrint=false", {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const json = await res.json();
      const tracks: RadioTrack[] = [];
      let seedArtist = "";
      let nextToken: string | null = null;

      const extractVideos = (obj: any) => {
        if (!obj || typeof obj !== "object") return;
        if (obj.playlistPanelVideoRenderer) {
          const v = obj.playlistPanelVideoRenderer;
          const vId = v.videoId;
          const title = v.title?.runs?.[0]?.text || "";
          const artistRuns = v.longBylineText?.runs;
          let artist = "";
          if (artistRuns && artistRuns.length > 0) {
            artist = artistRuns[0]?.text || "";
          }
          if (!seedArtist && artist) seedArtist = artist;

          let thumb = "";
          const thumbs = v.thumbnail?.thumbnails;
          if (thumbs?.length > 0) thumb = thumbs[thumbs.length - 1]?.url || "";

          const lengthStr = v.lengthText?.runs?.[0]?.text || "";
          let duration = 0;
          if (lengthStr.includes(":")) {
            const parts = lengthStr.split(":");
            if (parts.length === 2) {
              duration = (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
            } else if (parts.length === 3) {
              duration =
                (parseInt(parts[0]) || 0) * 3600 +
                (parseInt(parts[1]) || 0) * 60 +
                (parseInt(parts[2]) || 0);
            }
          }

          if (vId && title) {
            tracks.push({
              id: vId,
              title,
              artist: artist || "Popular Artist",
              duration,
              thumb: thumb || `https://i.ytimg.com/vi/${vId}/hqdefault.jpg`,
              videoType: "song",
            });
          }
        }

        if (obj.continuationItemRenderer) {
          const cont =
            obj.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
          if (cont) nextToken = cont;
        }

        for (const k of Object.keys(obj)) {
          extractVideos(obj[k]);
        }
      };

      extractVideos(json);

      if (tracks.length > 0) {
        return {
          tracks,
          next: nextToken,
          seed: { artist: seedArtist || "Artist" },
        };
      }
    }
  } catch (e) {
    console.warn("InnerTube radio error, using fallback recommendations:", e);
  }

  // Fallback recommendations pool
  const fallbackPool: RadioTrack[] = [
    { id: "4NRXx6U8ABQ", title: "Blinding Lights", artist: "The Weeknd", duration: 200, thumb: "https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg", videoType: "song" },
    { id: "34Na4j8AVgA", title: "Starboy", artist: "The Weeknd ft. Daft Punk", duration: 230, thumb: "https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg", videoType: "song" },
    { id: "hT_nvWreIhg", title: "Counting Stars", artist: "OneRepublic", duration: 257, thumb: "https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg", videoType: "song" },
    { id: "fJ9rUzIMcZQ", title: "Bohemian Rhapsody", artist: "Queen", duration: 354, thumb: "https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg", videoType: "song" },
    { id: "7wtfhZwyrcc", title: "Believer", artist: "Imagine Dragons", duration: 204, thumb: "https://i.ytimg.com/vi/7wtfhZwyrcc/hqdefault.jpg", videoType: "song" },
    { id: "JGwWNGJdvx8", title: "Shape of You", artist: "Ed Sheeran", duration: 233, thumb: "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg", videoType: "song" },
  ];

  return {
    tracks: fallbackPool,
    next: null,
    seed: { artist: "Popular Artists" },
  };
}

function parseInnerTubeBrowseShelves(json: any): HomeShelf[] {
  const shelves: HomeShelf[] = [];
  const sections =
    json.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content
      ?.sectionListRenderer?.contents;

  if (sections && Array.isArray(sections)) {
    for (const sec of sections) {
      const carousel = sec.musicCarouselShelfRenderer;
      if (!carousel) continue;

      const title =
        carousel.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs?.[0]?.text ||
        "Featured";

      const items: HomeItem[] = [];
      const rawItems = carousel.contents || [];
      for (const it of rawItems) {
        if (it.musicTwoRowItemRenderer) {
          const r = it.musicTwoRowItemRenderer;
          const itemTitle = r.title?.runs?.[0]?.text || "";
          const subtitleRuns = r.subtitle?.runs;
          const subtitle = subtitleRuns?.length > 0 ? subtitleRuns[0]?.text || "" : "";

          let thumb = "";
          const thumbs = r.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails;
          if (thumbs?.length > 0) thumb = thumbs[thumbs.length - 1]?.url || "";

          const watchVideoId = r.navigationEndpoint?.watchEndpoint?.videoId;
          const browseId = r.navigationEndpoint?.browseEndpoint?.browseId;

          if (watchVideoId && itemTitle) {
            items.push({
              kind: "track",
              track: {
                id: watchVideoId,
                title: itemTitle,
                artist: subtitle || "Popular Artist",
                duration: 200,
                thumb: thumb || `https://i.ytimg.com/vi/${watchVideoId}/hqdefault.jpg`,
              },
            });
          } else if (browseId && itemTitle) {
            items.push({
              kind: "playlist",
              playlist: {
                id: browseId,
                title: itemTitle,
                subtitle,
                thumb,
                count: 20,
              },
            });
          }
        }
      }

      if (items.length >= 2) {
        shelves.push({ title, items });
      }
    }
  }
  return shelves;
}

function makeTrackItem(id: string, title: string, artist: string, duration: number): HomeItem {
  return {
    kind: "track",
    track: {
      id,
      title,
      artist,
      duration,
      thumb: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    },
  };
}
