import { NextRequest, NextResponse } from "next/server";
import { getTrendingShowsByCountry } from "@/lib/tmdb";

export async function GET(req: NextRequest) {
  const country = req.nextUrl.searchParams.get("country") ?? "US";
  const page    = Number(req.nextUrl.searchParams.get("page") ?? "1");
  try {
    const data = await getTrendingShowsByCountry(country, page);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API /shows/trending-by-country]", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
