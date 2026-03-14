import { NextRequest, NextResponse } from "next/server";
import { getAllChannels, getChannelsByCountry } from "@/lib/iptv";

export const revalidate = 1800;

export async function GET(req: NextRequest) {
  const page     = Math.max(1, Number(req.nextUrl.searchParams.get("page")  ?? "1"));
  const limit    = Math.min(120, Number(req.nextUrl.searchParams.get("limit") ?? "120"));
  const category = req.nextUrl.searchParams.get("category") ?? "";
  const country  = req.nextUrl.searchParams.get("country")  ?? "";

  try {
    // Use the dedicated country playlist when filtering by country —
    // it's authoritative and contains far more channels than the global index
    let channels = country && country !== "all"
      ? await getChannelsByCountry(country)
      : await getAllChannels();

    if (category && category !== "all") {
      channels = channels.filter((ch) => ch.categories.includes(category));
    }

    const total = channels.length;
    const start = (page - 1) * limit;
    const paged = channels.slice(start, start + limit);

    return NextResponse.json({
      results:     paged,
      total,
      page,
      total_pages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("[API /channels]", error);
    return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
  }
}
