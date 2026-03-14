import { NextRequest, NextResponse } from "next/server";
import { getTrendingShows } from "@/lib/tmdb";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
  try {
    const data = await getTrendingShows(page);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API /shows/trending]", error);
    return NextResponse.json({ error: "Failed to fetch trending shows" }, { status: 500 });
  }
}
