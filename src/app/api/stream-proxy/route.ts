import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── constants ────────────────────────────────────────────────────────────────

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Build spoofed browser headers that most CDNs accept */
function upstreamHeaders(targetUrl: string): Record<string, string> {
  const { origin } = new URL(targetUrl);
  return {
    "User-Agent": BROWSER_UA,
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    // Tell the server NOT to compress — we need to stream raw bytes
    "Accept-Encoding": "identity",
    Referer: `${origin}/`,
    Origin: origin,
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
}

/** Wrap an absolute URL for routing through this proxy */
function wrap(abs: string): string {
  return `/api/stream-proxy?url=${encodeURIComponent(abs)}`;
}

/** Resolve raw (possibly relative) URL against base, then wrap */
function resolve(raw: string, base: string): string {
  try {
    return wrap(new URL(raw.trim(), base).href);
  } catch {
    return raw; // leave malformed lines untouched
  }
}

/**
 * Rewrite every URL inside an M3U8 text so segments, sub-manifests,
 * encryption keys and init fragments all go through this proxy.
 *
 * Handles:
 *   • bare segment lines  (lines not starting with #)
 *   • URI="…"  attributes (EXT-X-KEY, EXT-X-MAP, EXT-X-MEDIA, …)
 */
function rewriteManifest(text: string, base: string): string {
  return text
    .split("\n")
    .map((line) => {
      const t = line.trim();

      // Empty or pure comment lines — leave untouched
      if (!t || (t.startsWith("#") && !t.includes('URI="'))) return line;

      // Plain URL line (segment, sub-manifest)
      if (!t.startsWith("#")) return resolve(t, base);

      // Tag line that contains URI="…" (EXT-X-KEY, EXT-X-MAP, etc.)
      return line.replace(/URI="([^"]+)"/g, (_m, uri: string) => {
        return `URI="${resolve(uri, base)}"`;
      });
    })
    .join("\n");
}

function looksLikeManifest(contentType: string, url: string): boolean {
  return (
    /mpegurl|m3u/i.test(contentType) ||
    /\.m3u8($|\?|#)/i.test(url) ||
    /\/m3u8($|\?|#)/i.test(url)
  );
}

/** Pick a sensible Content-Type for binary HLS chunks */
function segmentContentType(rawCT: string, url: string): string {
  if (rawCT && rawCT !== "application/octet-stream") return rawCT;
  if (/\.ts($|\?)/i.test(url))  return "video/mp2t";
  if (/\.aac($|\?)/i.test(url)) return "audio/aac";
  if (/\.mp4($|\?)/i.test(url)) return "video/mp4";
  if (/\.m4s($|\?)/i.test(url)) return "video/iso.segment";
  if (/\.key($|\?)/i.test(url)) return "application/octet-stream";
  // Fallback — HLS.js accepts this for .ts
  return "video/mp2t";
}

// ─── route handlers ───────────────────────────────────────────────────────────

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  // 1. Parse & validate ──────────────────────────────────────────────────────
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(raw);
    new URL(targetUrl); // validate; throws on bad input
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  // 2. Fetch upstream ─────────────────────────────────────────────────────────
  let upstream: Response;
  let finalUrl = targetUrl;

  try {
    upstream = await fetch(targetUrl, {
      method: "GET",
      headers: upstreamHeaders(targetUrl),
      redirect: "follow",                 // follow 301/302 transparently
      signal: AbortSignal.timeout(15_000),
    });

    // Capture redirected URL so relative segment paths resolve correctly
    if (upstream.url) finalUrl = upstream.url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stream-proxy] fetch failed:", targetUrl, msg);
    return NextResponse.json({ error: "Stream unreachable" }, { status: 502 });
  }

  // 3. Surface upstream errors ────────────────────────────────────────────────
  if (upstream.status >= 400) {
    console.error("[stream-proxy] upstream error:", upstream.status, targetUrl);
    return NextResponse.json(
      { error: `Upstream ${upstream.status}` },
      { status: 502 }
    );
  }

  const rawCT = upstream.headers.get("content-type") ?? "";

  // 4. M3U8 manifest path ─────────────────────────────────────────────────────
  if (looksLikeManifest(rawCT, finalUrl)) {
    let text: string;
    try {
      text = await upstream.text();
    } catch (err) {
      console.error("[stream-proxy] manifest read error:", err);
      return NextResponse.json({ error: "Manifest unreadable" }, { status: 502 });
    }

    // Sanity-check: a real M3U8 always starts with #EXTM3U
    if (!text.trim().startsWith("#EXTM3U")) {
      console.error("[stream-proxy] bad manifest from:", finalUrl, text.slice(0, 120));
      return NextResponse.json({ error: "Invalid manifest" }, { status: 502 });
    }

    // Base URL for resolving relative segment paths (directory of final URL)
    const base = finalUrl.substring(0, finalUrl.lastIndexOf("/") + 1);
    const rewritten = rewriteManifest(text, base);

    return new NextResponse(rewritten, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl; charset=utf-8",
        ...CORS,
        "Cache-Control": "no-store, no-cache",
        Pragma: "no-cache",
      },
    });
  }

  // 5. Binary segment / key / init-fragment path ──────────────────────────────
  if (!upstream.body) {
    return NextResponse.json({ error: "Empty upstream body" }, { status: 502 });
  }

  const ct = segmentContentType(rawCT, finalUrl);

  const responseHeaders: Record<string, string> = {
    "Content-Type": ct,
    ...CORS,
    "Cache-Control": "no-store",
  };

  // Preserve range headers so HLS seeking works
  const cl = upstream.headers.get("content-length");
  const cr = upstream.headers.get("content-range");
  if (cl) responseHeaders["Content-Length"] = cl;
  if (cr) responseHeaders["Content-Range"] = cr;

  // Stream the body directly — no buffering
  return new NextResponse(upstream.body, {
    status: upstream.status === 206 ? 206 : 200,
    headers: responseHeaders,
  });
}