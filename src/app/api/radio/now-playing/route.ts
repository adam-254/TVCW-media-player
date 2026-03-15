/**
 * /api/radio/now-playing
 * Extracts every piece of ICY metadata a stream exposes:
 *   Headers : icy-name, icy-genre, icy-description, icy-url, icy-br, icy-sr,
 *             icy-pub, icy-audio-info, content-type, server
 *   In-band : StreamTitle, StreamUrl (from the ICY metaint block)
 *
 * The StreamTitle is usually "Artist - Title" but some stations use
 * "Title - Artist", "Title (Artist)", or just a title. We return the raw
 * string and let the client decide how to display it.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 10;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function parseAudioInfo(raw: string): Record<string, string> {
  // icy-audio-info: bitrate=128;samplerate=44100;channels=2
  const out: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const [k, v] = part.split("=");
    if (k && v) out[k.trim().toLowerCase()] = v.trim();
  }
  return out;
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw)
    return NextResponse.json({ error: "Missing url" }, { status: 400, headers: CORS });

  let streamUrl: string;
  try {
    streamUrl = decodeURIComponent(raw);
    new URL(streamUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400, headers: CORS });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(streamUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ICY-metadata-reader/1.0)",
        "Icy-MetaData": "1",
        Accept: "*/*",
        "Cache-Control": "no-cache",
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    // ── ICY response headers ──────────────────────────────────────────────
    const h = res.headers;
    const metaInt   = parseInt(h.get("icy-metaint") ?? "0", 10);
    const icyName   = h.get("icy-name")        ?? "";
    const icyGenre  = h.get("icy-genre")       ?? "";
    const icyDesc   = h.get("icy-description") ?? "";
    const icyUrl    = h.get("icy-url")         ?? "";
    const icyBr     = h.get("icy-br")          ?? h.get("icy-bitrate") ?? "";
    const icySr     = h.get("icy-sr")          ?? "";
    const icyPub    = h.get("icy-pub")         ?? "";
    const icyAudio  = h.get("icy-audio-info")  ?? "";
    const serverSw  = h.get("server")          ?? "";
    const contentType = h.get("content-type")  ?? "";

    const audioInfo = icyAudio ? parseAudioInfo(icyAudio) : {};
    // Prefer icy-audio-info values, fall back to top-level headers
    const bitrate    = audioInfo["bitrate"]    || icyBr  || "";
    const samplerate = audioInfo["samplerate"] || icySr  || "";
    const channels   = audioInfo["channels"]   || "";

    const base = {
      station: icyName,
      genre: icyGenre,
      description: icyDesc,
      stationUrl: icyUrl,
      bitrate,
      samplerate,
      channels,
      isPublic: icyPub === "1",
      serverSoftware: serverSw,
      contentType,
      track: null as string | null,
      streamUrl: null as string | null,
    };

    if (!metaInt || !res.body) {
      return NextResponse.json(base, {
        headers: { ...CORS, "Cache-Control": "no-store" },
      });
    }

    // ── Read just enough bytes to hit the first ICY metadata block ────────
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    const needed = metaInt + 4080; // audio chunk + max metadata block

    while (totalBytes < needed) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      totalBytes += value.byteLength;
    }
    reader.cancel();

    const buffer = new Uint8Array(totalBytes);
    let off = 0;
    for (const c of chunks) { buffer.set(c, off); off += c.byteLength; }

    // ── Parse ICY in-band metadata block ─────────────────────────────────
    // Layout: [metaInt bytes audio][1 byte: metaLen/16][metaLen bytes of KV string]
    if (buffer.length > metaInt) {
      const metaLen = buffer[metaInt] * 16;
      if (metaLen > 0 && buffer.length >= metaInt + 1 + metaLen) {
        const raw = new TextDecoder("utf-8")
          .decode(buffer.slice(metaInt + 1, metaInt + 1 + metaLen))
          .replace(/\0/g, "")
          .trim();

        // Extract all key='value'; pairs
        const kvRe = /(\w+)='([^']*)'/g;
        let m: RegExpExecArray | null;
        while ((m = kvRe.exec(raw)) !== null) {
          const key = m[1].toLowerCase();
          const val = m[2].trim();
          if (key === "streamtitle" && val) base.track = val;
          if (key === "streamurl"   && val) base.streamUrl = val;
        }
      }
    }

    return NextResponse.json(base, {
      headers: { ...CORS, "Cache-Control": "no-store" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/abort/i.test(msg)) {
      return NextResponse.json(
        { track: null, station: "", genre: "", description: "" },
        { headers: { ...CORS, "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch metadata", detail: msg },
      { status: 502, headers: CORS }
    );
  }
}
