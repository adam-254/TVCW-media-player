import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res  = await fetch(
      "https://de1.api.radio-browser.info/json/tags?order=stationcount&reverse=true&limit=30&hidebroken=true",
      { headers: { "User-Agent": "TVCW/1.0" }, next: { revalidate: 3600 } }
    );
    const data = await res.json();
    return NextResponse.json(
      data
        .filter((t: { name: string; stationcount: number }) => t.name && t.stationcount > 100)
        .map((t: { name: string; stationcount: number }) => ({ id: t.name, name: t.name }))
    );
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
