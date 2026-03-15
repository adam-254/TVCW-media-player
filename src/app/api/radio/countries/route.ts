import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res  = await fetch("https://de1.api.radio-browser.info/json/countries", {
      headers: { "User-Agent": "TVCW/1.0" },
      next:    { revalidate: 3600 },
    });
    const data = await res.json();
    // Return sorted by station count
    const countries = data
      .filter((c: { name: string; iso_3166_1: string; stationcount: number }) => c.iso_3166_1 && c.stationcount > 0)
      .sort((a: { stationcount: number }, b: { stationcount: number }) => b.stationcount - a.stationcount)
      .map((c: { name: string; iso_3166_1: string; stationcount: number }) => ({
        code:  c.iso_3166_1,
        name:  c.name,
        flag:  c.iso_3166_1.length === 2
          ? c.iso_3166_1.toUpperCase().replace(/./g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)))
          : "",
        count: c.stationcount,
      }));
    return NextResponse.json(countries);
  } catch {
    return NextResponse.json([], { status: 500 });
  }
}
