import { NextResponse } from "next/server";
import { getShowDetails } from "@/lib/tmdb";

export const revalidate = 3600; // cache for 1 hour

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const showId = parseInt(params.id);
    if (isNaN(showId)) {
      return NextResponse.json(
        { error: "Invalid show ID" },
        { status: 400 }
      );
    }

    const show = await getShowDetails(showId);
    return NextResponse.json(show);
  } catch (error) {
    console.error("[API /shows/[id]]", error);
    return NextResponse.json(
      { error: "Failed to fetch show details" },
      { status: 500 }
    );
  }
}