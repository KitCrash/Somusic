package com.kitcrash.somusic

import android.annotation.SuppressLint
import android.graphics.Color
import android.os.Bundle
import android.util.Log
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.core.view.WindowCompat
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.webkit.WebViewAssetLoader
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .followRedirects(true)
        .build()

    // Infinite read timeout for continuous audio streaming
    private val streamClient = client.newBuilder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .followRedirects(true)
        .build()

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Native window fitting: decor fits system windows so header never collides with status bar/notch
        WindowCompat.setDecorFitsSystemWindows(window, true)
        val insetsController = WindowCompat.getInsetsController(window, window.decorView)
        insetsController.isAppearanceLightStatusBars = false
        insetsController.isAppearanceLightNavigationBars = false

        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK

        val rootLayout = FrameLayout(this).apply {
            fitsSystemWindows = true
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.BLACK)
        }

        webView = WebView(this).apply {
            fitsSystemWindows = false
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.BLACK)

            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = true
                allowContentAccess = true
                useWideViewPort = true
                loadWithOverviewMode = true
                cacheMode = WebSettings.LOAD_DEFAULT
                mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            }

            webChromeClient = WebChromeClient()

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView?,
                    request: WebResourceRequest?
                ): WebResourceResponse? {
                    val uri = request?.url ?: return null
                    val path = uri.path ?: ""

                    // 1. Intercept local asset files
                    val assetResponse = assetLoader.shouldInterceptRequest(uri)
                    if (assetResponse != null) {
                        return assetResponse
                    }

                    // 2. Intercept API and Audio Stream routes
                    if (path.startsWith("/api/")) {
                        return handleApiRequest(uri.toString(), request)
                    }

                    return super.shouldInterceptRequest(view, request)
                }
            }

            // Load SoMusic from secure appassets origin
            loadUrl("https://appassets.androidplatform.net/assets/web/index.html")
        }

        rootLayout.addView(webView)
        setContentView(rootLayout)

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    private fun handleApiRequest(urlStr: String, request: WebResourceRequest): WebResourceResponse? {
        try {
            val uri = android.net.Uri.parse(urlStr)
            val path = uri.path ?: ""

            // 1. Auth session
            if (path == "/api/auth/session") {
                val json = """{"mode":"guest","userId":"guest-user","username":"Guest","displayName":"Music Lover","freshInstall":false,"needsUsername":false}"""
                return createJsonResponse(json)
            }

            // 2. Search Page & Search
            if (path == "/api/music/searchPage" || path == "/api/music/search") {
                return handleSearchRequest(uri)
            }

            // 3. Search Suggestions
            if (path == "/api/music/suggestions") {
                val q = uri.getQueryParameter("q") ?: ""
                return handleSuggestionsRequest(q)
            }

            // 4. Moods & Genres (Explore page)
            if (path == "/api/music/moods") {
                return handleMoodsRequest()
            }

            // 5. Mood covers & Mood page
            if (path == "/api/music/moodCovers") {
                return handleMoodCoversRequest()
            }
            if (path == "/api/music/moodPage") {
                return handleMoodPageRequest(uri)
            }

            // 6. Podcasts
            if (path == "/api/music/podcasts") {
                return handlePodcastsRequest()
            }

            // 7. Home Feed & Charts (Shelves array)
            if (path == "/api/music/home" || path == "/api/music/charts") {
                return handleHomeRequest()
            }

            // 8. Song Radio / AutoPlay Recommendations
            if (path == "/api/music/radio") {
                return handleRadioRequest(uri)
            }

            // 9. Audio Stream Proxy with Range support
            if (path == "/api/stream") {
                val trackId = uri.getQueryParameter("id") ?: return null
                return handleStreamProxy(trackId, request.requestHeaders["Range"])
            }

            // 10. Synced lyrics from LRCLIB
            if (path == "/api/music/lyrics") {
                val title = uri.getQueryParameter("title") ?: ""
                val artist = uri.getQueryParameter("artist") ?: ""
                return fetchLyrics(title, artist)
            }

            // 11. Playlists
            if (path == "/api/music/playlist" || path == "/api/music/playlistPage") {
                return handlePlaylistPageRequest(uri)
            }

            // 12. Other music endpoints (safe fallbacks)
            if (path == "/api/music/searchMore") {
                return createJsonResponse("""{"rows":[],"continuation":null}""")
            }
            if (path == "/api/music/enrich") {
                return createJsonResponse("""{}""")
            }
            if (path == "/api/music/album") {
                return createJsonResponse("""{"album":null,"tracks":[]}""")
            }
            if (path == "/api/music/artist") {
                return createJsonResponse("""{"artist":null,"topSongs":[],"albums":[],"singles":[]}""")
            }
        } catch (e: Exception) {
            Log.e("SoMusic", "API intercept error: ${e.message}", e)
        }
        return null
    }

    private fun handleSearchRequest(url: android.net.Uri): WebResourceResponse {
        val query = url.getQueryParameter("q") ?: ""
        val filter = url.getQueryParameter("filter") ?: "all"

        if (query.isBlank()) {
            return createJsonResponse("""{"rows":[],"continuation":null}""")
        }

        val rows = JSONArray()
        val seenIds = mutableSetOf<String>()

        // 1. Primary: YouTube Music InnerTube search
        try {
            val filterParam = when (filter) {
                "songs" -> "EgWKAQIIAWoKEAkQChAFEAMQBA=="
                "videos" -> "EgWKAQIQAWoKEAkQChAFEAMQBA=="
                "albums" -> "EgWKAQIYAWoKEAkQChAFEAMQBA=="
                "artists" -> "EgWKAQIgAWoKEAkQChAFEAMQBA=="
                "playlists" -> "EgWKAQIoAWoKEAkQChAFEAMQBA=="
                else -> null
            }

            val payload = JSONObject().apply {
                put("context", JSONObject().apply {
                    put("client", JSONObject().apply {
                        put("clientName", "WEB_REMIX")
                        put("clientVersion", "1.20240722.01.00")
                        put("hl", "en")
                        put("gl", "US")
                    })
                })
                put("query", query)
                if (filterParam != null) {
                    put("params", filterParam)
                }
            }

            val reqBody = payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType())

            val req = Request.Builder()
                .url("https://music.youtube.com/youtubei/v1/search?prettyPrint=false")
                .header("Content-Type", "application/json")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
                .header("X-YouTube-Client-Name", "67")
                .header("X-YouTube-Client-Version", "1.20240722.01.00")
                .header("Origin", "https://music.youtube.com")
                .post(reqBody)
                .build()

            val res = client.newCall(req).execute()
            if (res.isSuccessful) {
                val resBody = res.body?.string() ?: ""
                val json = JSONObject(resBody)

                fun extract(obj: Any?) {
                    when (obj) {
                        is JSONObject -> {
                            if (obj.has("musicResponsiveListItemRenderer")) {
                                val item = obj.getJSONObject("musicResponsiveListItemRenderer")
                                val flexCols = item.optJSONArray("flexColumns")
                                if (flexCols != null && flexCols.length() > 0) {
                                    val col0 = flexCols.getJSONObject(0)
                                        .optJSONObject("musicResponsiveListItemFlexColumnRenderer")
                                        ?.optJSONObject("text")
                                        ?.optJSONArray("runs")
                                    val title = if (col0 != null && col0.length() > 0) {
                                        col0.getJSONObject(0).optString("text")
                                    } else ""

                                    var artist = ""
                                    if (flexCols.length() > 1) {
                                        val col1 = flexCols.getJSONObject(1)
                                            .optJSONObject("musicResponsiveListItemFlexColumnRenderer")
                                            ?.optJSONObject("text")
                                            ?.optJSONArray("runs")
                                        if (col1 != null && col1.length() > 0) {
                                            val firstText = col1.getJSONObject(0).optString("text")
                                            if (listOf("Song", "Video", "Single", "EP", "Audio").contains(firstText) && col1.length() > 2) {
                                                artist = col1.getJSONObject(2).optString("text")
                                            } else {
                                                artist = firstText
                                            }
                                        }
                                    }

                                    var videoId = item.optJSONObject("playlistItemData")?.optString("videoId") ?: ""
                                    if (videoId.isEmpty() && col0 != null && col0.length() > 0) {
                                        videoId = col0.getJSONObject(0)
                                            .optJSONObject("navigationEndpoint")
                                            ?.optJSONObject("watchEndpoint")
                                            ?.optString("videoId") ?: ""
                                    }

                                    var thumb = ""
                                    val thumbs = item.optJSONObject("thumbnail")
                                        ?.optJSONObject("musicThumbnailRenderer")
                                        ?.optJSONObject("thumbnail")
                                        ?.optJSONArray("thumbnails")
                                    if (thumbs != null && thumbs.length() > 0) {
                                        thumb = thumbs.getJSONObject(thumbs.length() - 1).optString("url")
                                    }

                                    if (title.isNotEmpty() && videoId.isNotEmpty() && !seenIds.contains(videoId)) {
                                        seenIds.add(videoId)
                                        val song = JSONObject().apply {
                                            put("id", videoId)
                                            put("title", title)
                                            put("artist", if (artist.isNotEmpty() && artist != "Song") artist else "Popular Artist")
                                            put("duration", 0)
                                            put("thumb", thumb)
                                            put("isVideo", false)
                                        }
                                        val row = JSONObject().apply {
                                            put("kind", if (rows.length() == 0 && filter == "all") "top" else "track")
                                            put("song", song)
                                        }
                                        rows.put(row)
                                    }
                                }
                            }
                            val keys = obj.keys()
                            while (keys.hasNext()) {
                                extract(obj.get(keys.next()))
                            }
                        }
                        is JSONArray -> {
                            for (i in 0 until obj.length()) {
                                extract(obj.get(i))
                            }
                        }
                    }
                }

                extract(json)
            }
        } catch (e: Exception) {
            Log.w("SoMusic", "YouTube Music search failed: ${e.message}")
        }

        // 2. High-resilience fallback: Invidious search if 0 rows found
        if (rows.length() == 0) {
            try {
                val encQuery = URLEncoder.encode(query, "UTF-8")
                val invReq = Request.Builder()
                    .url("https://yt.chocolatemoo53.com/api/v1/search?q=$encQuery&type=video")
                    .header("User-Agent", "Mozilla/5.0")
                    .build()
                val invRes = client.newCall(invReq).execute()
                if (invRes.isSuccessful) {
                    val invBody = invRes.body?.string() ?: ""
                    val list = JSONArray(invBody)
                    for (i in 0 until list.length()) {
                        val item = list.getJSONObject(i)
                        val videoId = item.optString("videoId")
                        val title = item.optString("title")
                        val author = item.optString("author")
                        val thumbs = item.optJSONArray("videoThumbnails")
                        val thumb = if (thumbs != null && thumbs.length() > 0) {
                            thumbs.getJSONObject(thumbs.length() - 1).optString("url")
                        } else "https://i.ytimg.com/vi/$videoId/hqdefault.jpg"

                        if (videoId.isNotEmpty() && title.isNotEmpty() && !seenIds.contains(videoId)) {
                            seenIds.add(videoId)
                            val song = JSONObject().apply {
                                put("id", videoId)
                                put("title", title)
                                put("artist", if (author.isNotEmpty()) author else "Popular Artist")
                                put("duration", item.optInt("lengthSeconds", 0))
                                put("thumb", thumb)
                                put("isVideo", false)
                            }
                            val row = JSONObject().apply {
                                put("kind", if (rows.length() == 0 && filter == "all") "top" else "track")
                                put("song", song)
                            }
                            rows.put(row)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.w("SoMusic", "Fallback search error: ${e.message}")
            }
        }

        val result = JSONObject().apply {
            put("rows", rows)
            put("continuation", null)
        }
        return createJsonResponse(result.toString())
    }

    private fun handleSuggestionsRequest(query: String): WebResourceResponse {
        if (query.isBlank()) {
            return createJsonResponse("""{"items":[]}""")
        }

        try {
            val payload = JSONObject().apply {
                put("context", JSONObject().apply {
                    put("client", JSONObject().apply {
                        put("clientName", "WEB_REMIX")
                        put("clientVersion", "1.20240722.01.00")
                        put("hl", "en")
                        put("gl", "US")
                    })
                })
                put("input", query)
            }

            val reqBody = payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType())

            val req = Request.Builder()
                .url("https://music.youtube.com/youtubei/v1/music/get_search_suggestions")
                .header("Content-Type", "application/json")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .header("X-YouTube-Client-Name", "67")
                .header("X-YouTube-Client-Version", "1.20240722.01.00")
                .header("Origin", "https://music.youtube.com")
                .post(reqBody)
                .build()

            val res = client.newCall(req).execute()
            if (res.isSuccessful) {
                val resBody = res.body?.string() ?: ""
                val json = JSONObject(resBody)
                val items = JSONArray()

                val contents = json.optJSONArray("contents")
                    ?.optJSONObject(0)
                    ?.optJSONObject("searchSuggestionsSectionRenderer")
                    ?.optJSONArray("contents")

                if (contents != null) {
                    for (i in 0 until contents.length()) {
                        val runs = contents.getJSONObject(i)
                            .optJSONObject("searchSuggestionRenderer")
                            ?.optJSONObject("suggestion")
                            ?.optJSONArray("runs")
                        if (runs != null && runs.length() > 0) {
                            val text = StringBuilder()
                            for (j in 0 until runs.length()) {
                                text.append(runs.getJSONObject(j).optString("text"))
                            }
                            items.put(text.toString())
                        }
                    }
                }
                val out = JSONObject().apply { put("items", items) }
                return createJsonResponse(out.toString())
            }
        } catch (e: Exception) {
            Log.e("SoMusic", "Suggestions error: ${e.message}", e)
        }

        return createJsonResponse("""{"items":[]}""")
    }

    private fun handleMoodsRequest(): WebResourceResponse {
        val moodsArray = JSONArray().apply {
            put(JSONObject().apply {
                put("title", "Today's Hits")
                put("browseId", "FEmusic_moods_and_genres_category")
                put("params", "ggMPOg1uX1JOQWZFeDByc2Jm")
                put("color", "#E13300")
                put("section", "Moods & moments")
            })
            put(JSONObject().apply {
                put("title", "Chill")
                put("browseId", "FEmusic_moods_and_genres_category")
                put("params", "ggMPOg1uX1JOQWZFeDByc2Jm")
                put("color", "#2D6A4F")
                put("section", "Moods & moments")
            })
            put(JSONObject().apply {
                put("title", "Focus")
                put("browseId", "FEmusic_moods_and_genres_category")
                put("params", "ggMPOg1uX1JOQWZFeDByc2Jm")
                put("color", "#023E8A")
                put("section", "Moods & moments")
            })
            put(JSONObject().apply {
                put("title", "Workout")
                put("browseId", "FEmusic_moods_and_genres_category")
                put("params", "ggMPOg1uX1JOQWZFeDByc2Jm")
                put("color", "#D00000")
                put("section", "Moods & moments")
            })
            put(JSONObject().apply {
                put("title", "Rock")
                put("browseId", "FEmusic_moods_and_genres_category")
                put("params", "ggMPOg1uX1JOQWZFeDByc2Jm")
                put("color", "#F44336")
                put("section", "Genres")
            })
            put(JSONObject().apply {
                put("title", "Pop")
                put("browseId", "FEmusic_moods_and_genres_category")
                put("params", "ggMPOg1uX1JOQWZFeDByc2Jm")
                put("color", "#C9184A")
                put("section", "Genres")
            })
            put(JSONObject().apply {
                put("title", "Hip-Hop")
                put("browseId", "FEmusic_moods_and_genres_category")
                put("params", "ggMPOg1uX1JOQWZFeDByc2Jm")
                put("color", "#FF9800")
                put("section", "Genres")
            })
            put(JSONObject().apply {
                put("title", "Electronic")
                put("browseId", "FEmusic_moods_and_genres_category")
                put("params", "ggMPOg1uX1JOQWZFeDByc2Jm")
                put("color", "#00BCD4")
                put("section", "Genres")
            })
        }
        return createJsonResponse(moodsArray.toString())
    }

    private fun handleMoodCoversRequest(): WebResourceResponse {
        val covers = JSONArray().apply {
            put("https://i.ytimg.com/vi/SWY0v8GfY3o/hqdefault.jpg")
            put("https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg")
        }
        return createJsonResponse(covers.toString())
    }

    private fun handleMoodPageRequest(uri: android.net.Uri): WebResourceResponse {
        val params = uri.getQueryParameter("params") ?: ""
        try {
            val payload = JSONObject().apply {
                put("context", JSONObject().apply {
                    put("client", JSONObject().apply {
                        put("clientName", "WEB_REMIX")
                        put("clientVersion", "1.20240722.01.00")
                        put("hl", "en")
                        put("gl", "US")
                    })
                })
                put("browseId", "FEmusic_moods_and_genres_category")
                if (params.isNotEmpty()) {
                    put("params", params)
                }
            }
            val reqBody = payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
            val req = Request.Builder()
                .url("https://music.youtube.com/youtubei/v1/browse?prettyPrint=false")
                .header("Content-Type", "application/json")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .header("X-YouTube-Client-Name", "67")
                .header("X-YouTube-Client-Version", "1.20240722.01.00")
                .header("Origin", "https://music.youtube.com")
                .post(reqBody)
                .build()
            val res = client.newCall(req).execute()
            if (res.isSuccessful) {
                val json = JSONObject(res.body?.string() ?: "")
                val title = json.optJSONObject("header")?.optJSONObject("musicHeaderRenderer")?.optJSONObject("title")?.optJSONArray("runs")?.optJSONObject(0)?.optString("text") ?: "Mood & Genre"
                val shelves = parseInnerTubeBrowseShelves(json)
                if (shelves.length() > 0) {
                    val out = JSONObject().apply {
                        put("title", title)
                        put("shelves", shelves)
                    }
                    return createJsonResponse(out.toString())
                }
            }
        } catch (e: Exception) {
            Log.w("SoMusic", "MoodPage InnerTube error: ${e.message}")
        }

        // Fallback mood page
        val fallbackTracks = JSONArray().apply {
            put(buildTrackItem("SWY0v8GfY3o", "Self Aware", "Temper City", 210))
            put(buildTrackItem("4NRXx6U8ABQ", "Blinding Lights", "The Weeknd", 200))
            put(buildTrackItem("hT_nvWreIhg", "Counting Stars", "OneRepublic", 257))
            put(buildTrackItem("fJ9rUzIMcZQ", "Bohemian Rhapsody", "Queen", 354))
        }
        val out = JSONObject().apply {
            put("title", "Mood & Genre")
            put("shelves", JSONArray().apply {
                put(buildShelf("Featured Songs", fallbackTracks))
            })
        }
        return createJsonResponse(out.toString())
    }

    private fun handlePodcastsRequest(): WebResourceResponse {
        val shows = JSONArray().apply {
            put(JSONObject().apply {
                put("id", "show-1")
                put("title", "The Joe Rogan Experience")
                put("author", "Joe Rogan")
                put("thumb", "https://i.ytimg.com/vi/SWY0v8GfY3o/hqdefault.jpg")
            })
            put(JSONObject().apply {
                put("id", "show-2")
                put("title", "Huberman Lab")
                put("author", "Andrew Huberman")
                put("thumb", "https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg")
            })
            put(JSONObject().apply {
                put("id", "show-3")
                put("title", "Lex Fridman Podcast")
                put("author", "Lex Fridman")
                put("thumb", "https://i.ytimg.com/vi/hT_nvWreIhg/hqdefault.jpg")
            })
        }
        val shelves = JSONArray().apply {
            put(JSONObject().apply {
                put("title", "Popular Shows")
                put("shows", shows)
            })
        }
        return createJsonResponse(shelves.toString())
    }

    private fun handleHomeRequest(): WebResourceResponse {
        try {
            val payload = JSONObject().apply {
                put("context", JSONObject().apply {
                    put("client", JSONObject().apply {
                        put("clientName", "WEB_REMIX")
                        put("clientVersion", "1.20240722.01.00")
                        put("hl", "en")
                        put("gl", "US")
                    })
                })
                put("browseId", "FEmusic_home")
            }
            val reqBody = payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
            val req = Request.Builder()
                .url("https://music.youtube.com/youtubei/v1/browse?prettyPrint=false")
                .header("Content-Type", "application/json")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .header("X-YouTube-Client-Name", "67")
                .header("X-YouTube-Client-Version", "1.20240722.01.00")
                .header("Origin", "https://music.youtube.com")
                .post(reqBody)
                .build()
            val res = client.newCall(req).execute()
            if (res.isSuccessful) {
                val json = JSONObject(res.body?.string() ?: "")
                val shelves = parseInnerTubeBrowseShelves(json)
                if (shelves.length() >= 2) {
                    return createJsonResponse(shelves.toString())
                }
            }
        } catch (e: Exception) {
            Log.w("SoMusic", "InnerTube home error: ${e.message}")
        }

        // Fallback curated shelves
        val hitsItems = JSONArray().apply {
            put(buildTrackItem("SWY0v8GfY3o", "Self Aware", "Temper City", 210))
            put(buildTrackItem("4NRXx6U8ABQ", "Blinding Lights", "The Weeknd", 200))
            put(buildTrackItem("34Na4j8AVgA", "Starboy", "The Weeknd ft. Daft Punk", 230))
            put(buildTrackItem("hT_nvWreIhg", "Counting Stars", "OneRepublic", 257))
            put(buildTrackItem("fJ9rUzIMcZQ", "Bohemian Rhapsody", "Queen", 354))
            put(buildTrackItem("7wtfhZwyrcc", "Believer", "Imagine Dragons", 204))
            put(buildTrackItem("JGwWNGJdvx8", "Shape of You", "Ed Sheeran", 233))
            put(buildTrackItem("bCuhuePlP8o", "Someone You Loved", "Lewis Capaldi", 182))
        }
        val chillItems = JSONArray().apply {
            put(buildTrackItem("jfKfPfyJRdk", "Lofi Hip Hop Radio Beats", "Lofi Girl", 180))
            put(buildTrackItem("5yx6BWlEVcY", "Coffee Chill Study", "Chill Beats", 200))
            put(buildTrackItem("PEM0Vs8jf1w", "Golden Hour", "JVKE", 210))
            put(buildTrackItem("gset79KMmt0", "Snowman", "Sia", 165))
        }
        val rockItems = JSONArray().apply {
            put(buildTrackItem("eVTXPUF4Oz4", "In The End", "Linkin Park", 216))
            put(buildTrackItem("kXYiU_JCYtU", "Numb", "Linkin Park", 187))
            put(buildTrackItem("hTWKbfoikeg", "Smells Like Teen Spirit", "Nirvana", 301))
            put(buildTrackItem("1w7OgIMMRc4", "Sweet Child O' Mine", "Guns N' Roses", 356))
        }

        val allShelves = JSONArray().apply {
            put(buildShelf("Today's Biggest Hits", hitsItems))
            put(buildShelf("Chill & Lo-Fi Vibes", chillItems))
            put(buildShelf("Rock Classics", rockItems))
        }
        return createJsonResponse(allShelves.toString())
    }

    private fun parseInnerTubeBrowseShelves(json: JSONObject): JSONArray {
        val shelves = JSONArray()
        val sections = json.optJSONObject("contents")
            ?.optJSONObject("singleColumnBrowseResultsRenderer")
            ?.optJSONArray("tabs")
            ?.optJSONObject(0)
            ?.optJSONObject("tabRenderer")
            ?.optJSONObject("content")
            ?.optJSONObject("sectionListRenderer")
            ?.optJSONArray("contents")

        if (sections != null) {
            for (i in 0 until sections.length()) {
                val sec = sections.optJSONObject(i) ?: continue
                val carousel = sec.optJSONObject("musicCarouselShelfRenderer") ?: continue
                val title = carousel.optJSONObject("header")
                    ?.optJSONObject("musicCarouselShelfBasicHeaderRenderer")
                    ?.optJSONObject("title")
                    ?.optJSONArray("runs")
                    ?.optJSONObject(0)
                    ?.optString("text") ?: "Featured"

                val items = JSONArray()
                val rawItems = carousel.optJSONArray("contents") ?: continue
                for (j in 0 until rawItems.length()) {
                    val it = rawItems.optJSONObject(j) ?: continue
                    if (it.has("musicTwoRowItemRenderer")) {
                        val r = it.getJSONObject("musicTwoRowItemRenderer")
                        val itemTitle = r.optJSONObject("title")?.optJSONArray("runs")?.optJSONObject(0)?.optString("text") ?: ""
                        val subtitleRuns = r.optJSONObject("subtitle")?.optJSONArray("runs")
                        val subtitle = if (subtitleRuns != null && subtitleRuns.length() > 0) {
                            subtitleRuns.optJSONObject(0)?.optString("text") ?: ""
                        } else ""

                        var thumb = ""
                        val thumbs = r.optJSONObject("thumbnailRenderer")
                            ?.optJSONObject("musicThumbnailRenderer")
                            ?.optJSONObject("thumbnail")
                            ?.optJSONArray("thumbnails")
                        if (thumbs != null && thumbs.length() > 0) {
                            thumb = thumbs.optJSONObject(thumbs.length() - 1)?.optString("url") ?: ""
                        }

                        val nav = r.optJSONObject("navigationEndpoint")
                        val watchVideoId = nav?.optJSONObject("watchEndpoint")?.optString("videoId")
                        val browseId = nav?.optJSONObject("browseEndpoint")?.optString("browseId")

                        if (!watchVideoId.isNullOrEmpty() && itemTitle.isNotEmpty()) {
                            val trackObj = JSONObject().apply {
                                put("id", watchVideoId)
                                put("title", itemTitle)
                                put("artist", if (subtitle.isNotEmpty()) subtitle else "Popular Artist")
                                put("duration", 200)
                                put("thumb", if (thumb.isNotEmpty()) thumb else "https://i.ytimg.com/vi/$watchVideoId/hqdefault.jpg")
                                put("isVideo", false)
                            }
                            items.put(JSONObject().apply {
                                put("kind", "track")
                                put("track", trackObj)
                            })
                        } else if (!browseId.isNullOrEmpty() && itemTitle.isNotEmpty()) {
                            val playlistObj = JSONObject().apply {
                                put("id", browseId)
                                put("title", itemTitle)
                                put("subtitle", subtitle)
                                put("thumb", thumb)
                                put("trackCount", 20)
                            }
                            items.put(JSONObject().apply {
                                put("kind", "playlist")
                                put("playlist", playlistObj)
                            })
                        }
                    }
                }

                if (items.length() >= 3) {
                    shelves.put(JSONObject().apply {
                        put("title", title)
                        put("items", items)
                    })
                }
            }
        }
        return shelves
    }

    private fun handleRadioRequest(uri: android.net.Uri): WebResourceResponse {
        val videoId = uri.getQueryParameter("id") ?: ""
        val token = uri.getQueryParameter("token")

        if (videoId.isBlank()) {
            return createJsonResponse("""{"tracks":[],"next":null,"seed":null}""")
        }

        try {
            val payload = JSONObject().apply {
                put("context", JSONObject().apply {
                    put("client", JSONObject().apply {
                        put("clientName", "WEB_REMIX")
                        put("clientVersion", "1.20240722.01.00")
                        put("hl", "en")
                        put("gl", "US")
                    })
                })
                put("videoId", videoId)
                put("playlistId", "RDAMVM$videoId")
                put("enablePersistentPlaylistPanel", true)
                put("tunerSettingValue", "AUTOMIX_SETTING_NORMAL")
                if (!token.isNullOrEmpty()) {
                    put("continuation", token)
                }
            }

            val reqBody = payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
            val req = Request.Builder()
                .url("https://music.youtube.com/youtubei/v1/next?prettyPrint=false")
                .header("Content-Type", "application/json")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
                .header("X-YouTube-Client-Name", "67")
                .header("X-YouTube-Client-Version", "1.20240722.01.00")
                .header("Origin", "https://music.youtube.com")
                .post(reqBody)
                .build()

            val res = client.newCall(req).execute()
            if (res.isSuccessful) {
                val resBody = res.body?.string() ?: ""
                val json = JSONObject(resBody)

                val tracks = JSONArray()
                var seedArtist = ""
                var nextToken: String? = null

                fun extractVideos(obj: Any?) {
                    when (obj) {
                        is JSONObject -> {
                            if (obj.has("playlistPanelVideoRenderer")) {
                                val v = obj.getJSONObject("playlistPanelVideoRenderer")
                                val vId = v.optString("videoId")
                                val title = v.optJSONObject("title")?.optJSONArray("runs")?.optJSONObject(0)?.optString("text") ?: ""
                                val artistRuns = v.optJSONObject("longBylineText")?.optJSONArray("runs")
                                var artist = ""
                                if (artistRuns != null && artistRuns.length() > 0) {
                                    artist = artistRuns.optJSONObject(0)?.optString("text") ?: ""
                                }
                                if (seedArtist.isEmpty() && artist.isNotEmpty()) {
                                    seedArtist = artist
                                }
                                var thumb = ""
                                val thumbs = v.optJSONObject("thumbnail")?.optJSONArray("thumbnails")
                                if (thumbs != null && thumbs.length() > 0) {
                                    thumb = thumbs.optJSONObject(thumbs.length() - 1)?.optString("url") ?: ""
                                }
                                val lengthStr = v.optJSONObject("lengthText")?.optJSONArray("runs")?.optJSONObject(0)?.optString("text") ?: ""
                                var duration = 0
                                if (lengthStr.isNotEmpty() && lengthStr.contains(":")) {
                                    val parts = lengthStr.split(":")
                                    duration = if (parts.size == 2) {
                                        (parts[0].toIntOrNull() ?: 0) * 60 + (parts[1].toIntOrNull() ?: 0)
                                    } else if (parts.size == 3) {
                                        (parts[0].toIntOrNull() ?: 0) * 3600 + (parts[1].toIntOrNull() ?: 0) * 60 + (parts[2].toIntOrNull() ?: 0)
                                    } else 0
                                }

                                if (vId.isNotEmpty() && title.isNotEmpty()) {
                                    val tObj = JSONObject().apply {
                                        put("id", vId)
                                        put("title", title)
                                        put("artist", if (artist.isNotEmpty()) artist else "Popular Artist")
                                        put("duration", duration)
                                        put("thumb", if (thumb.isNotEmpty()) thumb else "https://i.ytimg.com/vi/$vId/hqdefault.jpg")
                                        put("isVideo", false)
                                        put("videoType", "song")
                                    }
                                    tracks.put(tObj)
                                }
                            }
                            if (obj.has("continuationItemRenderer")) {
                                val cont = obj.optJSONObject("continuationItemRenderer")
                                    ?.optJSONObject("continuationEndpoint")
                                    ?.optJSONObject("continuationCommand")
                                    ?.optString("token")
                                if (!cont.isNullOrEmpty()) {
                                    nextToken = cont
                                }
                            }
                            val keys = obj.keys()
                            while (keys.hasNext()) {
                                extractVideos(obj.get(keys.next()))
                            }
                        }
                        is JSONArray -> {
                            for (i in 0 until obj.length()) {
                                extractVideos(obj.get(i))
                            }
                        }
                    }
                }

                extractVideos(json)

                if (tracks.length() > 0) {
                    val out = JSONObject().apply {
                        put("tracks", tracks)
                        put("next", if (nextToken != null) nextToken else JSONObject.NULL)
                        put("seed", JSONObject().apply {
                            put("artist", if (seedArtist.isNotEmpty()) seedArtist else "Artist")
                            put("artistId", JSONObject.NULL)
                        })
                    }
                    return createJsonResponse(out.toString())
                }
            }
        } catch (e: Exception) {
            Log.e("SoMusic", "Radio error: ${e.message}", e)
        }

        // High quality fallback radio tracks
        val fallbackTracks = JSONArray().apply {
            put(buildRadioTrack("4NRXx6U8ABQ", "Blinding Lights", "The Weeknd", 200))
            put(buildRadioTrack("34Na4j8AVgA", "Starboy", "The Weeknd ft. Daft Punk", 230))
            put(buildRadioTrack("hT_nvWreIhg", "Counting Stars", "OneRepublic", 257))
            put(buildRadioTrack("fJ9rUzIMcZQ", "Bohemian Rhapsody", "Queen", 354))
            put(buildRadioTrack("7wtfhZwyrcc", "Believer", "Imagine Dragons", 204))
            put(buildRadioTrack("JGwWNGJdvx8", "Shape of You", "Ed Sheeran", 233))
        }
        val fallback = JSONObject().apply {
            put("tracks", fallbackTracks)
            put("next", JSONObject.NULL)
            put("seed", JSONObject().apply {
                put("artist", "Popular Artists")
                put("artistId", JSONObject.NULL)
            })
        }
        return createJsonResponse(fallback.toString())
    }

    private fun handlePlaylistPageRequest(uri: android.net.Uri): WebResourceResponse {
        val id = uri.getQueryParameter("id") ?: ""
        if (id.isEmpty()) {
            return createJsonResponse("""{"playlist":null,"tracks":[],"continuation":null}""")
        }
        val browseId = if (id.startsWith("VL")) id else "VL$id"
        try {
            val payload = JSONObject().apply {
                put("context", JSONObject().apply {
                    put("client", JSONObject().apply {
                        put("clientName", "WEB_REMIX")
                        put("clientVersion", "1.20240722.01.00")
                        put("hl", "en")
                        put("gl", "US")
                    })
                })
                put("browseId", browseId)
            }
            val reqBody = payload.toString().toRequestBody("application/json; charset=utf-8".toMediaType())
            val req = Request.Builder()
                .url("https://music.youtube.com/youtubei/v1/browse?prettyPrint=false")
                .header("Content-Type", "application/json")
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .header("X-YouTube-Client-Name", "67")
                .header("X-YouTube-Client-Version", "1.20240722.01.00")
                .header("Origin", "https://music.youtube.com")
                .post(reqBody)
                .build()
            val res = client.newCall(req).execute()
            if (res.isSuccessful) {
                val json = JSONObject(res.body?.string() ?: "")
                val tracks = JSONArray()
                fun extractItems(obj: Any?) {
                    when (obj) {
                        is JSONObject -> {
                            if (obj.has("musicResponsiveListItemRenderer")) {
                                val item = obj.getJSONObject("musicResponsiveListItemRenderer")
                                val flexCols = item.optJSONArray("flexColumns")
                                if (flexCols != null && flexCols.length() > 0) {
                                    val col0 = flexCols.getJSONObject(0)
                                        .optJSONObject("musicResponsiveListItemFlexColumnRenderer")
                                        ?.optJSONObject("text")
                                        ?.optJSONArray("runs")
                                    val title = if (col0 != null && col0.length() > 0) col0.getJSONObject(0).optString("text") else ""
                                    var artist = ""
                                    if (flexCols.length() > 1) {
                                        val col1 = flexCols.getJSONObject(1)
                                            .optJSONObject("musicResponsiveListItemFlexColumnRenderer")
                                            ?.optJSONObject("text")
                                            ?.optJSONArray("runs")
                                        if (col1 != null && col1.length() > 0) {
                                            artist = col1.getJSONObject(0).optString("text")
                                        }
                                    }
                                    var videoId = item.optJSONObject("playlistItemData")?.optString("videoId") ?: ""
                                    if (videoId.isEmpty() && col0 != null && col0.length() > 0) {
                                        videoId = col0.getJSONObject(0)
                                            .optJSONObject("navigationEndpoint")
                                            ?.optJSONObject("watchEndpoint")
                                            ?.optString("videoId") ?: ""
                                    }
                                    var thumb = ""
                                    val thumbs = item.optJSONObject("thumbnail")
                                        ?.optJSONObject("musicThumbnailRenderer")
                                        ?.optJSONObject("thumbnail")
                                        ?.optJSONArray("thumbnails")
                                    if (thumbs != null && thumbs.length() > 0) {
                                        thumb = thumbs.getJSONObject(thumbs.length() - 1).optString("url")
                                    }
                                    if (videoId.isNotEmpty() && title.isNotEmpty()) {
                                        tracks.put(JSONObject().apply {
                                            put("id", videoId)
                                            put("title", title)
                                            put("artist", if (artist.isNotEmpty()) artist else "Popular Artist")
                                            put("duration", 200)
                                            put("thumb", if (thumb.isNotEmpty()) thumb else "https://i.ytimg.com/vi/$videoId/hqdefault.jpg")
                                            put("isVideo", false)
                                        })
                                    }
                                }
                            }
                            val keys = obj.keys()
                            while (keys.hasNext()) {
                                extractItems(obj.get(keys.next()))
                            }
                        }
                        is JSONArray -> {
                            for (i in 0 until obj.length()) {
                                extractItems(obj.get(i))
                            }
                        }
                    }
                }
                extractItems(json)
                if (tracks.length() > 0) {
                    val out = JSONObject().apply {
                        put("playlist", JSONObject().apply {
                            put("id", id)
                            put("title", "Playlist")
                            put("subtitle", "${tracks.length()} songs")
                            put("thumb", tracks.getJSONObject(0).optString("thumb"))
                            put("trackCount", tracks.length())
                        })
                        put("tracks", tracks)
                        put("continuation", JSONObject.NULL)
                    }
                    return createJsonResponse(out.toString())
                }
            }
        } catch (e: Exception) {
            Log.w("SoMusic", "Playlist error: ${e.message}")
        }
        return createJsonResponse("""{"playlist":null,"tracks":[],"continuation":null}""")
    }

    private fun buildTrackItem(id: String, title: String, artist: String, duration: Int = 200, thumb: String = ""): JSONObject {
        val track = JSONObject().apply {
            put("id", id)
            put("title", title)
            put("artist", artist)
            put("duration", duration)
            put("thumb", if (thumb.isNotEmpty()) thumb else "https://i.ytimg.com/vi/$id/hqdefault.jpg")
            put("isVideo", false)
        }
        return JSONObject().apply {
            put("kind", "track")
            put("track", track)
        }
    }

    private fun buildRadioTrack(id: String, title: String, artist: String, duration: Int = 200): JSONObject {
        return JSONObject().apply {
            put("id", id)
            put("title", title)
            put("artist", artist)
            put("duration", duration)
            put("thumb", "https://i.ytimg.com/vi/$id/hqdefault.jpg")
            put("isVideo", false)
            put("videoType", "song")
        }
    }

    private fun buildShelf(title: String, items: JSONArray): JSONObject {
        return JSONObject().apply {
            put("title", title)
            put("items", items)
        }
    }

    private fun handleStreamProxy(trackId: String, rangeHeader: String?): WebResourceResponse? {
        val streamUrl = "https://yt.chocolatemoo53.com/latest_version?id=$trackId&itag=140&local=true"
        try {
            val streamReqBuilder = Request.Builder()
                .url(streamUrl)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
            if (!rangeHeader.isNullOrEmpty()) {
                streamReqBuilder.header("Range", rangeHeader)
            }
            val streamRes = streamClient.newCall(streamReqBuilder.build()).execute()
            if (streamRes.isSuccessful || streamRes.code == 206) {
                val responseHeaders = mutableMapOf<String, String>()
                responseHeaders["Access-Control-Allow-Origin"] = "*"
                responseHeaders["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
                responseHeaders["Access-Control-Allow-Headers"] = "Range, Content-Type, Authorization"
                responseHeaders["Access-Control-Expose-Headers"] = "Content-Range, Content-Length, Accept-Ranges"
                responseHeaders["Accept-Ranges"] = "bytes"
                streamRes.header("Content-Range")?.let { responseHeaders["Content-Range"] = it }
                streamRes.header("Content-Length")?.let { responseHeaders["Content-Length"] = it }

                val rawMime = streamRes.header("Content-Type") ?: "audio/mp4"
                val cleanMime = rawMime.substringBefore(";").trim()
                val statusCode = streamRes.code
                val statusMsg = if (statusCode == 206) "Partial Content" else "OK"

                return WebResourceResponse(
                    cleanMime,
                    null,
                    statusCode,
                    statusMsg,
                    responseHeaders,
                    streamRes.body?.byteStream()
                )
            }
        } catch (e: Exception) {
            Log.e("SoMusic", "Stream error for $trackId: ${e.message}", e)
        }
        return null
    }

    private fun fetchLyrics(title: String, artist: String): WebResourceResponse {
        val cleanT = cleanSongTitle(title)
        val cleanA = primaryArtist(artist)

        // 1. Try exact match with cleaned title & artist
        try {
            if (cleanT.isNotEmpty()) {
                val encTitle = URLEncoder.encode(cleanT, "UTF-8")
                val encArtist = URLEncoder.encode(cleanA, "UTF-8")
                val url = "https://lrclib.net/api/get?track_name=$encTitle&artist_name=$encArtist"

                val req = Request.Builder().url(url).header("User-Agent", "SoMusic/1.0.0").build()
                val res = client.newCall(req).execute()
                if (res.isSuccessful) {
                    val parsed = parseLrcResponse(res.body?.string() ?: "")
                    if (parsed != null && (parsed.optJSONArray("synced") != null || parsed.optString("plain", "").isNotEmpty())) {
                        return createJsonResponse(parsed.toString())
                    }
                }
            }
        } catch (e: Exception) {
            Log.w("SoMusic", "Exact lyrics failed: ${e.message}")
        }

        // 2. Search LRCLIB with clean title + clean artist
        try {
            if (cleanT.isNotEmpty()) {
                val query = if (cleanA.isNotEmpty()) "$cleanT $cleanA" else cleanT
                val encQ = URLEncoder.encode(query, "UTF-8")
                val searchUrl = "https://lrclib.net/api/search?q=$encQ"
                val req = Request.Builder().url(searchUrl).header("User-Agent", "SoMusic/1.0.0").build()
                val res = client.newCall(req).execute()
                if (res.isSuccessful) {
                    val list = JSONArray(res.body?.string() ?: "[]")
                    for (i in 0 until minOf(5, list.length())) {
                        val parsed = parseLrcResponse(list.getJSONObject(i).toString())
                        if (parsed != null && (parsed.optJSONArray("synced") != null || parsed.optString("plain", "").isNotEmpty())) {
                            return createJsonResponse(parsed.toString())
                        }
                    }
                }
            }
        } catch (e: Exception) {
            Log.w("SoMusic", "Search lyrics with artist failed: ${e.message}")
        }

        // 3. Search LRCLIB with clean title
        try {
            if (cleanT.isNotEmpty()) {
                val encQ = URLEncoder.encode(cleanT, "UTF-8")
                val searchUrl = "https://lrclib.net/api/search?q=$encQ"
                val req = Request.Builder().url(searchUrl).header("User-Agent", "SoMusic/1.0.0").build()
                val res = client.newCall(req).execute()
                if (res.isSuccessful) {
                    val list = JSONArray(res.body?.string() ?: "[]")
                    if (list.length() > 0) {
                        val parsed = parseLrcResponse(list.getJSONObject(0).toString())
                        if (parsed != null) return createJsonResponse(parsed.toString())
                    }
                }
            }
        } catch (e: Exception) {
            Log.w("SoMusic", "Search lyrics title failed: ${e.message}")
        }

        return createJsonResponse("""{"synced":null,"plain":null,"source":null}""")
    }

    private fun cleanSongTitle(raw: String): String {
        return raw
            .replace(Regex("""\([^)]*\)"""), " ")
            .replace(Regex("""\[[^\]]*\]"""), " ")
            .replace(Regex("""["“”']"""), "")
            .replace(Regex("""\s+"""), " ")
            .trim()
    }

    private fun primaryArtist(raw: String): String {
        return raw.split(Regex(""",|&|feat\.|ft\.""", RegexOption.IGNORE_CASE))[0].trim()
    }

    private fun parseLrcResponse(body: String): JSONObject? {
        if (body.isEmpty()) return null
        val json = JSONObject(body)
        val synced = json.optString("syncedLyrics", "")
        val plain = json.optString("plainLyrics", "")

        val out = JSONObject()
        out.put("plain", if (plain.isNotEmpty()) plain else null)
        out.put("source", "LRCLIB")
        out.put("wordSynced", false)

        if (synced.isNotEmpty()) {
            val lines = JSONArray()
            synced.split("\n").forEach { line ->
                val match = Regex("""\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)""").find(line)
                if (match != null) {
                    val (min, sec, ms, text) = match.destructured
                    val time = min.toInt() * 60 + sec.toInt() + ms.toDouble() / (if (ms.length == 2) 100 else 1000)
                    val lineObj = JSONObject()
                    lineObj.put("time", time)
                    lineObj.put("text", text.trim())
                    lines.put(lineObj)
                }
            }
            out.put("synced", lines)
        } else {
            out.put("synced", null)
        }
        return out
    }

    private fun createJsonResponse(json: String): WebResourceResponse {
        val stream = ByteArrayInputStream(json.toByteArray(Charsets.UTF_8))
        val headers = mapOf(
            "Access-Control-Allow-Origin" to "*",
            "Access-Control-Allow-Methods" to "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers" to "Content-Type, Range"
        )
        return WebResourceResponse("application/json", "UTF-8", 200, "OK", headers, stream)
    }
}
