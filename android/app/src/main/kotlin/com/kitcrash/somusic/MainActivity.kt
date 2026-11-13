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
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
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

    private val assetLoader by lazy {
        WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        WindowCompat.setDecorFitsSystemWindows(window, false)
        val insetsController = WindowCompat.getInsetsController(window, window.decorView)
        insetsController.isAppearanceLightStatusBars = false
        insetsController.isAppearanceLightNavigationBars = false

        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK

        val rootLayout = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.BLACK)
        }

        webView = WebView(this).apply {
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

        ViewCompat.setOnApplyWindowInsetsListener(rootLayout) { view, insets ->
            val statusBars = insets.getInsets(WindowInsetsCompat.Type.statusBars())
            val navBars = insets.getInsets(WindowInsetsCompat.Type.navigationBars())
            view.setPadding(0, statusBars.top, 0, navBars.bottom)
            insets
        }

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

            // 4. Moods & Genres
            if (path == "/api/music/moods") {
                return handleMoodsRequest()
            }

            // 5. Home Feed
            if (path == "/api/music/home") {
                return handleHomeRequest()
            }

            // 6. Audio Stream Proxy with Range support
            if (path == "/api/stream") {
                val trackId = uri.getQueryParameter("id") ?: return null
                return handleStreamProxy(trackId, request.requestHeaders["Range"])
            }

            // 7. Synced lyrics from LRCLIB
            if (path == "/api/music/lyrics") {
                val title = uri.getQueryParameter("title") ?: ""
                val artist = uri.getQueryParameter("artist") ?: ""
                return fetchLyrics(title, artist)
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

        val filterParam = when (filter) {
            "songs" -> "EgWKAQIIAWoKEAkQChAFEAMQBA=="
            "videos" -> "EgWKAQIQAWoKEAkQChAFEAMQBA=="
            "albums" -> "EgWKAQIYAWoKEAkQChAFEAMQBA=="
            "artists" -> "EgWKAQIgAWoKEAkQChAFEAMQBA=="
            "playlists" -> "EgWKAQIoAWoKEAkQChAFEAMQBA=="
            else -> null
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
                val rows = JSONArray()
                val seenIds = mutableSetOf<String>()

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

                                    if (title.isNotEmpty() && videoId.isNotEmpty() && !seenIds.contains(videoId)) {
                                        seenIds.add(videoId)
                                        val song = JSONObject().apply {
                                            put("id", videoId)
                                            put("title", title)
                                            put("artist", if (artist.isNotEmpty()) artist else "Unknown Artist")
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

                val result = JSONObject().apply {
                    put("rows", rows)
                    put("continuation", null)
                }
                return createJsonResponse(result.toString())
            }
        } catch (e: Exception) {
            Log.e("SoMusic", "Search error: ${e.message}", e)
        }

        return createJsonResponse("""{"rows":[],"continuation":null}""")
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
        val json = """[
            {"title":"Today's hits","browseId":"FEmusic_moods_and_genres_category","params":null,"color":"#E13300"},
            {"title":"Lo-fi beats","browseId":"FEmusic_moods_and_genres_category","params":null,"color":"#4B2AAD"},
            {"title":"Workout energy","browseId":"FEmusic_moods_and_genres_category","params":null,"color":"#D00000"},
            {"title":"Focus flow","browseId":"FEmusic_moods_and_genres_category","params":null,"color":"#023E8A"},
            {"title":"Rock classics","browseId":"FEmusic_moods_and_genres_category","params":null,"color":"#370617"},
            {"title":"Jazz evenings","browseId":"FEmusic_moods_and_genres_category","params":null,"color":"#2B2D42"},
            {"title":"Pop hits","browseId":"FEmusic_moods_and_genres_category","params":null,"color":"#C9184A"},
            {"title":"Chill mix","browseId":"FEmusic_moods_and_genres_category","params":null,"color":"#2D6A4F"}
        ]"""
        return createJsonResponse(json)
    }

    private fun handleHomeRequest(): WebResourceResponse {
        val json = """{"sections":[{"id":"quick_picks","title":"Quick picks","subtitle":"Start listening","layout":"tiles","items":[]}]}"""
        return createJsonResponse(json)
    }

    private fun handleStreamProxy(trackId: String, rangeHeader: String?): WebResourceResponse? {
        val endpoints = listOf(
            "https://yt.chocolatemoo53.com/api/v1/videos/$trackId",
            "https://pipedapi.kavin.rocks/streams/$trackId",
            "https://pipedapi.adminforge.de/streams/$trackId"
        )

        for (endpoint in endpoints) {
            try {
                val req = Request.Builder()
                    .url(endpoint)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
                    .build()
                val res = client.newCall(req).execute()
                if (res.isSuccessful) {
                    val body = res.body?.string() ?: continue
                    val json = JSONObject(body)

                    var streamUrl = ""
                    val adaptiveFormats = json.optJSONArray("adaptiveFormats")
                    if (adaptiveFormats != null) {
                        for (i in 0 until adaptiveFormats.length()) {
                            val f = adaptiveFormats.getJSONObject(i)
                            val type = f.optString("type")
                            if (type.startsWith("audio/")) {
                                streamUrl = f.optString("url")
                                break
                            }
                        }
                    }

                    if (streamUrl.isEmpty()) {
                        val audioStreams = json.optJSONArray("audioStreams")
                        if (audioStreams != null && audioStreams.length() > 0) {
                            for (i in 0 until audioStreams.length()) {
                                val s = audioStreams.getJSONObject(i)
                                if (s.optString("mimeType").contains("mp4") || s.optString("mimeType").contains("aac")) {
                                    streamUrl = s.optString("url")
                                    break
                                }
                            }
                            if (streamUrl.isEmpty()) {
                                streamUrl = audioStreams.getJSONObject(0).optString("url")
                            }
                        }
                    }

                    if (streamUrl.isNotEmpty()) {
                        val streamReqBuilder = Request.Builder().url(streamUrl)
                        if (!rangeHeader.isNullOrEmpty()) {
                            streamReqBuilder.header("Range", rangeHeader)
                        }
                        val streamRes = client.newCall(streamReqBuilder.build()).execute()
                        val responseHeaders = mutableMapOf<String, String>()
                        responseHeaders["Access-Control-Allow-Origin"] = "*"
                        responseHeaders["Accept-Ranges"] = "bytes"
                        streamRes.header("Content-Range")?.let { responseHeaders["Content-Range"] = it }
                        streamRes.header("Content-Length")?.let { responseHeaders["Content-Length"] = it }

                        val mime = streamRes.header("Content-Type") ?: "audio/webm"
                        val statusCode = streamRes.code
                        val statusMsg = if (statusCode == 206) "Partial Content" else "OK"

                        return WebResourceResponse(
                            mime,
                            "identity",
                            statusCode,
                            statusMsg,
                            responseHeaders,
                            streamRes.body?.byteStream()
                        )
                    }
                }
            } catch (e: Exception) {
                Log.w("SoMusic", "Stream mirror $endpoint failed: ${e.message}")
            }
        }
        return null
    }

    private fun fetchLyrics(title: String, artist: String): WebResourceResponse {
        try {
            val encTitle = URLEncoder.encode(title, "UTF-8")
            val encArtist = URLEncoder.encode(artist, "UTF-8")
            val url = "https://lrclib.net/api/get?track_name=$encTitle&artist_name=$encArtist"

            val req = Request.Builder()
                .url(url)
                .header("User-Agent", "SoMusic/1.0 (Android)")
                .build()

            val res = client.newCall(req).execute()
            if (res.isSuccessful) {
                val body = res.body?.string() ?: ""
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
                return createJsonResponse(out.toString())
            }
        } catch (e: Exception) {
            Log.w("SoMusic", "Lyrics error: ${e.message}")
        }
        return createJsonResponse("""{"synced":null,"plain":null,"source":null}""")
    }

    private fun createJsonResponse(json: String): WebResourceResponse {
        val stream = ByteArrayInputStream(json.toByteArray(Charsets.UTF_8))
        val headers = mapOf("Access-Control-Allow-Origin" to "*")
        return WebResourceResponse("application/json", "UTF-8", 200, "OK", headers, stream)
    }
}
