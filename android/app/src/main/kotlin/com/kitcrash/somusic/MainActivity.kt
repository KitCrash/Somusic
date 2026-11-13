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
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.webkit.WebViewAssetLoader
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
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

        window.statusBarColor = Color.BLACK
        window.navigationBarColor = Color.BLACK

        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
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

        setContentView(webView)

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

            // Auth session
            if (path == "/api/auth/session") {
                val json = """{"mode":"guest","userId":"guest-user","username":"Guest","displayName":"Music Lover","freshInstall":false,"needsUsername":false}"""
                return createJsonResponse(json)
            }

            // Audio Stream Proxy with Range support
            if (path == "/api/stream") {
                val trackId = uri.getQueryParameter("id") ?: return null
                return handleStreamProxy(trackId, request.requestHeaders["Range"])
            }

            // Synced lyrics from LRCLIB
            if (path == "/api/music/lyrics") {
                val title = uri.getQueryParameter("title") ?: ""
                val artist = uri.getQueryParameter("artist") ?: ""
                return fetchLyrics(title, artist)
            }

            // Search fallback / forwarder
            if (path == "/api/music/search") {
                val q = uri.getQueryParameter("q") ?: ""
                return searchPipedOrYTM(q)
            }
        } catch (e: Exception) {
            Log.e("SoMusic", "API intercept error: ${e.message}", e)
        }
        return null
    }

    private fun handleStreamProxy(trackId: String, rangeHeader: String?): WebResourceResponse? {
        // Query Piped/InnerTube stream URL
        val pipedMirrors = listOf(
            "https://pipedapi.kavin.rocks/streams/$trackId",
            "https://pipedapi.adminforge.de/streams/$trackId",
            "https://api.piped.private.coffee/streams/$trackId"
        )

        for (endpoint in pipedMirrors) {
            try {
                val req = Request.Builder()
                    .url(endpoint)
                    .header("User-Agent", "Mozilla/5.0 (Android; Mobile)")
                    .build()
                val res = client.newCall(req).execute()
                if (res.isSuccessful) {
                    val body = res.body?.string() ?: continue
                    val json = JSONObject(body)
                    val audioStreams = json.optJSONArray("audioStreams") ?: continue
                    if (audioStreams.length() > 0) {
                        var streamUrl = audioStreams.getJSONObject(0).optString("url")
                        // Prefer m4a/aac
                        for (i in 0 until audioStreams.length()) {
                            val s = audioStreams.getJSONObject(i)
                            if (s.optString("mimeType").contains("mp4") || s.optString("mimeType").contains("aac")) {
                                streamUrl = s.optString("url")
                                break
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

                            val mime = streamRes.header("Content-Type") ?: "audio/mp4"
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

    private fun searchPipedOrYTM(query: String): WebResourceResponse {
        try {
            val encQ = URLEncoder.encode(query, "UTF-8")
            val url = "https://pipedapi.kavin.rocks/search?q=$encQ&filter=music_songs"
            val req = Request.Builder().url(url).build()
            val res = client.newCall(req).execute()
            if (res.isSuccessful) {
                val body = res.body?.string() ?: ""
                val json = JSONObject(body)
                val items = json.optJSONArray("items") ?: JSONArray()

                val songs = JSONArray()
                for (i in 0 until items.length()) {
                    val item = items.getJSONObject(i)
                    val s = JSONObject()
                    val id = item.optString("url").replace("/watch?v=", "")
                    s.put("id", id)
                    s.put("title", item.optString("title"))
                    s.put("artist", item.optString("uploaderName"))
                    s.put("duration", item.optInt("duration", 0))
                    s.put("thumb", item.optString("thumbnail"))
                    s.put("isVideo", false)
                    songs.put(s)
                }

                val out = JSONObject()
                out.put("songs", songs)
                out.put("videos", JSONArray())
                out.put("albums", JSONArray())
                out.put("artists", JSONArray())
                out.put("playlists", JSONArray())
                out.put("top", null)
                return createJsonResponse(out.toString())
            }
        } catch (e: Exception) {
            Log.w("SoMusic", "Search error: ${e.message}")
        }
        return createJsonResponse("""{"songs":[],"albums":[],"artists":[],"playlists":[]}""")
    }

    private fun createJsonResponse(json: String): WebResourceResponse {
        val stream = ByteArrayInputStream(json.toByteArray(Charsets.UTF_8))
        val headers = mapOf("Access-Control-Allow-Origin" to "*")
        return WebResourceResponse("application/json", "UTF-8", 200, "OK", headers, stream)
    }
}
