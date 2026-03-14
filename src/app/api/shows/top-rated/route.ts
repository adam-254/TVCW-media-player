import { NextRequest, NextResponse } from "next/server";
import { getTopRatedShows } from "@/lib/tmdb";

export const revalidate = 3600;

export async function GET(req: NextRequest) {
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
  try {
    const data = await getTopRatedShows(page);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API /shows/top-rated]", error);
    return NextResponse.json({ error: "Failed to fetch top rated shows" }, { status: 500 });
  }
}
