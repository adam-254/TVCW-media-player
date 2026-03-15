import { NextRequest, NextResponse } from "next/server";

const BASE = "https://de1.api.radio-browser.info/json";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page     = parseInt(searchParams.get("page")    || "1");
  const limit    = parseInt(searchParams.get("limit")   || "120");
  const country  = searchParams.get("country") || "";
  const tag      = searchParams.get("tag")     || "";
  const search   = searchParams.get("q")       || "";
  const offset   = (page - 1) * limit;

  const params = new URLSearchParams({
    limit:       String(limit),
    offset:      String(offset),
    hidebroken:  "true",
    order:       "clickcount",
    reverse:     "true",
  });

  if (country) params.set("countrycode", country.toUpperCase());
  if (tag)     params.set("tag", tag);
  if (search)  params.set("name", search);

  try {
    const endpoint = search
      ? `${BASE}/stations/search?${params}`
      : `${BASE}/stations/search?${params}`;

    const res  = await fetch(endpoint, {
      headers: { "User-Agent": "TVCW/1.0" },
      next:    { revalidate: 300 },
    });

    if (!res.ok) throw new Error(`Radio API ${res.status}`);

    const stations = await res.json();

    // Get total count for pagination
    const countParams = new URLSearchParams(params);
    countParams.delete("limit");
    countParams.delete("offset");
    const countRes = await fetch(`${BASE}/stations/search?${countParams}&limit=1&offset=0`, {
      headers: { "User-Agent": "TVCW/1.0" },
    });
    // Radio Browser doesn't return total count — estimate from results
    const hasMore = stations.length === limit;

    return NextResponse.json({
      results:     stations,
      page,
      total_pages: hasMore ? page + 1 : page,
    });
  } catch (err) {
    console.error("[radio]", err);
    return NextResponse.json({ error: "Failed to fetch stations" }, { status: 500 });
  }
}
