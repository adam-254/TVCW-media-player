import { NextRequest, NextResponse } from "next/server";
import { searchTVShows } from "@/lib/tmdb";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") ?? "";
  const page  = Number(req.nextUrl.searchParams.get("page") ?? "1");

  if (!query.trim()) {
    return NextResponse.json({ results: [], total_results: 0, page: 1, total_pages: 0 });
  }

  try {
    const data = await searchTVShows(query, page);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API /shows/search]", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
