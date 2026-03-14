import { NextRequest, NextResponse } from "next/server";
import { getPopularShows } from "@/lib/tmdb";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
  try {
    const data = await getPopularShows(page);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API /shows/popular]", error);
    return NextResponse.json({ error: "Failed to fetch popular shows" }, { status: 500 });
  }
}
