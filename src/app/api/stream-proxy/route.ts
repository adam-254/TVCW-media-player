/**
 * /api/stream-proxy/route.ts
 *
 * VERCEL-OPTIMISED HLS PROXY
 * ─────────────────────────────────────────────────────────────────────────────
 * Vercel serverless functions buffer entire responses before sending them.
 * Proxying binary .ts segments through Vercel = 4.5 MB cap + cold-start lag
 * + burning your function invocation budget.
 *
 * Strategy:
 *   • Manifest requests  → fetch, rewrite segment/key URLs, return text  ✓
 *   • Segment requests   → 302-redirect directly to the origin CDN        ✓
 *   • Key requests       → fetch & return (tiny, ~16 bytes)               ✓
 *
 * This keeps segment bytes off Vercel entirely while still solving CORS for
 * the manifest (which is what actually blocks HLS.js in the browser).
 *
 * For streams whose CDN also blocks direct segment fetches (CORS on segments),
 * we fall back to a lightweight pass-through with a hard 3 MB guard.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 20;

// ─── constants ────────────────────────────────────────────────────────────────

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

// Segments larger than this won't be buffered through Vercel — we 302 instead
const MAX_BUFFER_BYTES = 3 * 1024 * 1024; // 3 MB

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeHeaders(targetUrl: string): Record<string, string> {
  const { origin } = new URL(targetUrl);
  return {
    "User-Agent": UA,
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "identity",
    Referer: `${origin}/`,
    Origin: origin,
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  };
}

function isManifestUrl(url: string, ct: string): boolean {
  return (
    /mpegurl|m3u/i.test(ct) ||
    /\.m3u8($|\?|#)/i.test(url) ||
    /\/m3u8($|\?|#)/i.test(url)
  );
}

function isKeyUrl(url: string, ct: string): boolean {
  return (
    /\.key($|\?)/i.test(url) ||
    ct === "application/octet-stream" && url.includes("key")
  );
}

function isSegmentUrl(url: string): boolean {
  return /\.(ts|aac|mp4|m4s|cmf[ta])($|\?)/i.test(url);
}

function wrap(abs: string): string {
  return `/api/stream-proxy?url=${encodeURIComponent(abs)}`;
}

function resolveAndWrap(raw: string, base: string): string {
  try {
    return wrap(new URL(raw.trim(), base).href);
  } catch {
    return raw;
  }
}

/**
 * Rewrite an M3U8:
 *  - Sub-manifest lines  → proxied  (they're also M3U8, need same treatment)
 *  - Segment lines       → absolute origin URL (no proxy hop)
 *  - URI="…" in tags     → proxied for keys, absolute for everything else
 */
function rewriteManifest(text: string, base: string): string {
  const lines = text.split("\n");
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    // ── blank or comment-only (no URI attr) ────────────────────────────────
    if (!t || (t.startsWith("#") && !t.includes('URI="'))) {
      out.push(line);
      continue;
    }

    // ── plain URL line ──────────────────────────────────────────────────────
    if (!t.startsWith("#")) {
      try {
        const abs = new URL(t, base).href;
        if (isSegmentUrl(abs)) {
          // Segments go direct — no proxy hop on Vercel
          out.push(abs);
        } else {
          // Sub-manifests still need proxying so their segments get rewritten too
          out.push(wrap(abs));
        }
      } catch {
        out.push(line);
      }
      continue;
    }

    // ── tag line with URI="…" ───────────────────────────────────────────────
    const rewritten = line.replace(/URI="([^"]+)"/g, (_m, uri: string) => {
      try {
        const abs = new URL(uri.trim(), base).href;
        // Keys must be proxied (tiny, and often on same CORS-blocked domain)
        // Everything else (EXT-X-MAP init segments, etc.) → direct
        if (/\.key($|\?)/i.test(abs) || abs.includes("/key")) {
          return `URI="${wrap(abs)}"`;
        }
        return `URI="${abs}"`;
      } catch {
        return `URI="${uri}"`;
      }
    });
    out.push(rewritten);
  }

  return out.join("\n");
}

function segmentContentType(rawCT: string, url: string): string {
  if (rawCT && rawCT !== "application/octet-stream") return rawCT;
  if (/\.ts($|\?)/i.test(url))       return "video/mp2t";
  if (/\.aac($|\?)/i.test(url))      return "audio/aac";
  if (/\.mp4($|\?)/i.test(url))      return "video/mp4";
  if (/\.m4s($|\?)/i.test(url))      return "video/iso.segment";
  if (/\.cmft($|\?)/i.test(url))     return "video/mp4";
  if (/\.cmfa($|\?)/i.test(url))     return "audio/mp4";
  return "video/mp2t"; // safe default for unknown HLS chunks
}

// ─── handlers ─────────────────────────────────────────────────────────────────

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(req: NextRequest) {
  // 1. Parse & validate ──────────────────────────────────────────────────────
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(raw);
    new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  // 2. Fast-path: redirect segments directly to CDN ──────────────────────────
  // Skip the Vercel function body entirely for binary segments.
  // The browser fetches them straight from the origin CDN.
  // NOTE: This only works if the CDN sends permissive CORS headers on segments.
  // If not, we fall through to the buffered proxy below (handled by the fetch).
  if (isSegmentUrl(targetUrl)) {
    // Probe with a HEAD request first to check CORS headers
    try {
      const head = await fetch(targetUrl, {
        method: "HEAD",
        headers: makeHeaders(targetUrl),
        signal: AbortSignal.timeout(4_000),
        redirect: "follow",
      });
      const acao = head.headers.get("access-control-allow-origin");
      if (acao === "*" || acao) {
        // CDN allows CORS — send browser there directly
        return NextResponse.redirect(targetUrl, { status: 302 });
      }
    } catch {
      // HEAD failed or timed out → fall through to buffered proxy
    }
  }

  // 3. Fetch upstream ─────────────────────────────────────────────────────────
  let upstream: Response;
  let finalUrl = targetUrl;

  try {
    upstream = await fetch(targetUrl, {
      method: "GET",
      headers: makeHeaders(targetUrl),
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    if (upstream.url) finalUrl = upstream.url;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[stream-proxy] fetch error:", targetUrl, msg);
    return NextResponse.json({ error: "Stream unreachable" }, { status: 502 });
  }

  if (upstream.status >= 400) {
    console.error("[stream-proxy] upstream error:", upstream.status, targetUrl);
    return NextResponse.json(
      { error: `Upstream ${upstream.status}` },
      { status: 502 }
    );
  }

  const rawCT = upstream.headers.get("content-type") ?? "";

  // 4. Manifest ───────────────────────────────────────────────────────────────
  if (isManifestUrl(rawCT, finalUrl)) {
    let text: string;
    try {
      text = await upstream.text();
    } catch (err) {
      console.error("[stream-proxy] manifest read error:", err);
      return NextResponse.json({ error: "Manifest unreadable" }, { status: 502 });
    }

    if (!text.trim().startsWith("#EXTM3U")) {
      console.error("[stream-proxy] invalid manifest from:", finalUrl, text.slice(0, 200));
      return NextResponse.json({ error: "Invalid manifest" }, { status: 502 });
    }

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

  // 5. Keys (tiny — safe to buffer) ──────────────────────────────────────────
  if (isKeyUrl(finalUrl, rawCT)) {
    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        ...CORS,
        "Cache-Control": "no-store",
      },
    });
  }

  // 6. Segments / other binary (fallback — CDN blocked CORS on segments) ──────
  if (!upstream.body) {
    return NextResponse.json({ error: "Empty body" }, { status: 502 });
  }

  const cl = upstream.headers.get("content-length");
  if (cl && parseInt(cl, 10) > MAX_BUFFER_BYTES) {
    // Too large to safely buffer on Vercel — redirect and hope for the best
    return NextResponse.redirect(finalUrl, { status: 302 });
  }

  const ct = segmentContentType(rawCT, finalUrl);
  const responseHeaders: Record<string, string> = {
    "Content-Type": ct,
    ...CORS,
    "Cache-Control": "no-store",
  };
  if (cl) responseHeaders["Content-Length"] = cl;
  const cr = upstream.headers.get("content-range");
  if (cr) responseHeaders["Content-Range"] = cr;

  return new NextResponse(upstream.body, {
    status: upstream.status === 206 ? 206 : 200,
    headers: responseHeaders,
  });
}