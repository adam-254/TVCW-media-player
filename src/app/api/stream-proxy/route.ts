import { NextRequest, NextResponse } from "next/server";

/**
 * Proxies HLS stream requests to bypass CORS restrictions.
 * Also used as a health-check endpoint: ?check=1 returns 200/502 without body.
 */
export async function GET(req: NextRequest) {
  const url   = req.nextUrl.searchParams.get("url");
  const check = req.nextUrl.searchParams.get("check") === "1";

  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(url);
    new URL(targetUrl);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: check ? "HEAD" : "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; IPTV-Player/1.0)",
        "Referer":    new URL(targetUrl).origin,
        "Accept":     "*/*",
      },
      signal: AbortSignal.timeout(check ? 5000 : 10000),
    });

    if (!upstream.ok) {
      return NextResponse.json({ error: `Upstream ${upstream.status}` }, { status: 502 });
    }

    // Health check — just return status, no body
    if (check) {
      return new NextResponse(null, { status: 200 });
    }

    const contentType = upstream.headers.get("content-type") ?? "application/octet-stream";
    const body        = await upstream.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type":                contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control":               "no-store",
      },
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    const isRefused = err instanceof Error && (
      err.message.includes("ECONNREFUSED") ||
      err.message.includes("ENOTFOUND") ||
      err.message.includes("ETIMEDOUT")
    );

    // Log only unexpected errors
    if (!isTimeout && !isRefused) console.error("[stream-proxy]", err);

    return NextResponse.json(
      { error: isTimeout ? "Stream timed out" : "Stream unreachable", dead: isRefused || isTimeout },
      { status: 502 }
    );
  }
}
