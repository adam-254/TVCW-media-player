import { NextResponse } from "next/server";
import { getCountries } from "@/lib/iptv";

export const revalidate = 86400; // cache for 24 hours

export async function GET() {
  try {
    const countries = await getCountries();
    return NextResponse.json(countries);
  } catch (error) {
    console.error("[API /channels/countries]", error);
    return NextResponse.json(
      { error: "Failed to fetch countries" },
      { status: 500 }
    );
  }
}
