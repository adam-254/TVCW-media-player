import { NextResponse } from "next/server";
import { getCategories } from "@/lib/iptv";

export const revalidate = 86400; // cache for 24 hours

export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json(categories);
  } catch (error) {
    console.error("[API /channels/categories]", error);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}
