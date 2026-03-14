import { NextResponse } from "next/server";
import { getSeasonEpisodes } from "@/lib/tmdb";

export const revalidate = 3600; // cache for 1 hour

export async function GET(
  request: Request,
  { params }: { params: { id: string; seasonNumber: string } }
) {
  try {
    const showId = parseInt(params.id);
    const seasonNumber = parseInt(params.seasonNumber);
    
    if (isNaN(showId) || isNaN(seasonNumber)) {
      return NextResponse.json(
        { error: "Invalid show ID or season number" },
        { status: 400 }
      );
    }

    const episodes = await getSeasonEpisodes(showId, seasonNumber);
    return NextResponse.json(episodes);
  } catch (error) {
    console.error("[API /shows/[id]/season/[seasonNumber]]", error);
    return NextResponse.json(
      { error: "Failed to fetch episodes" },
      { status: 500 }
    );
  }
}