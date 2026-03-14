import { NextRequest, NextResponse } from "next/server";
import { searchChannels } from "@/lib/iptv";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q") ?? "";

  if (!query.trim()) {
    return NextResponse.json([]);
  }

  try {
    const results = await searchChannels(query);
    // Limit to top 60 for performance
    return NextResponse.json(results.slice(0, 60));
  } catch (error) {
    console.error("[API /channels/search]", error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}
