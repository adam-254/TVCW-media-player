// ─────────────────────────────────────────────
//  TVCW — IPTV-org Channel Client
//  Source: https://github.com/iptv-org/api
//  Free, open-source, no key required
// ─────────────────────────────────────────────

import type { Channel, ChannelCategory, ChannelCountry } from "@/types";

// ── Cache ─────────────────────────────────────
// Use globalThis so the cache is shared across all Next.js route modules
// (module-level vars get isolated per-route in Next.js dev mode)
declare global {
  // eslint-disable-next-line no-var
  var __iptvCache: { channels: Channel[]; time: number } | undefined;
  // eslint-disable-next-line no-var
  var __iptvFetching: Promise<void> | undefined;
  // eslint-disable-next-line no-var
  var __iptvCountryCache: Map<string, { channels: Channel[]; time: number }> | undefined;
  // eslint-disable-next-line no-var
  var __iptvCountryFetching: Map<string, Promise<void>> | undefined;
}

const CACHE_TTL = 1000 * 60 * 30; // 30 minutes

function getCache() { return globalThis.__iptvCache ?? null; }
function setCache(channels: Channel[]) {
  globalThis.__iptvCache = { channels, time: Date.now() };
}

// ── M3U Parser ────────────────────────────────

interface M3UEntry {
  name:    string;
  logo:    string;
  url:     string;
  group:   string;
  tvgId:   string;
  country: string;
}

function parseM3U(raw: string): M3UEntry[] {
  const lines  = raw.split("\n");
  const result: M3UEntry[] = [];
  let   meta: Partial<M3UEntry> = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      const name    = line.match(/,(.+)$/)          ?.[1]?.trim() ?? "";
      const logo    = line.match(/tvg-logo="([^"]*)"/)  ?.[1] ?? "";
      const group   = line.match(/group-title="([^"]*)"/) ?.[1] ?? "";
      const tvgId   = line.match(/tvg-id="([^"]*)"/)    ?.[1] ?? "";
      const country = line.match(/tvg-country="([^"]*)"/) ?.[1] ??
                      line.match(/tvg-language="([^"]*)"/) ?.[1] ?? "";
      meta = { name, logo, url: "", group, tvgId, country };
    } else if (!line.startsWith("#") && meta.name) {
      meta.url = line;
      if (meta.url && meta.name) {
        result.push(meta as M3UEntry);
      }
      meta = {};
    }
  }

  return result;
}

function inferCountry(entry: M3UEntry): string {
  if (entry.country) return entry.country.toUpperCase().slice(0, 2);

  // Try to infer from group-title (e.g. "Kenya", "United States")
  const group = entry.group.toLowerCase();
  const name  = entry.name.toLowerCase();

  const map: [RegExp, string][] = [
    [/\bkenya\b/,          "KE"],
    [/\bnigeria\b/,        "NG"],
    [/\bghana\b/,          "GH"],
    [/\bsouth africa\b/,   "ZA"],
    [/\bethiopia\b/,       "ET"],
    [/\buganda\b/,         "UG"],
    [/\btanzania\b/,       "TZ"],
    [/\busa?\b|united states/, "US"],
    [/\buk\b|united kingdom|england|britain/, "GB"],
    [/\bcanada\b/,         "CA"],
    [/\baustralia\b/,      "AU"],
    [/\bindia\b/,          "IN"],
    [/\bfrance\b/,         "FR"],
    [/\bgermany\b/,        "DE"],
    [/\bspain\b/,          "ES"],
    [/\bitaly\b/,          "IT"],
    [/\bbrazil\b/,         "BR"],
    [/\bjapan\b/,          "JP"],
    [/\bchina\b/,          "CN"],
    [/\brussia\b/,         "RU"],
    [/\bmexico\b/,         "MX"],
    [/\bturkey\b/,         "TR"],
    [/\bpakistan\b/,       "PK"],
    [/\bbangladesh\b/,     "BD"],
    [/\bindonesia\b/,      "ID"],
    [/\bphilippines\b/,    "PH"],
    [/\bvietnam\b/,        "VN"],
    [/\bthailand\b/,       "TH"],
    [/\bmalaysia\b/,       "MY"],
    [/\barab\b|arabic/,    "SA"],
  ];

  for (const [re, code] of map) {
    if (re.test(group) || re.test(name)) return code;
  }

  return "";
}

function normalizeCategories(group: string): string[] {
  if (!group) return ["general"];
  const g = group.toLowerCase();
  if (g.includes("news"))          return ["news"];
  if (g.includes("sport"))         return ["sports"];
  if (g.includes("music"))         return ["music"];
  if (g.includes("movie") || g.includes("film") || g.includes("cinema")) return ["movies"];
  if (g.includes("kid") || g.includes("child") || g.includes("cartoon")) return ["kids"];
  if (g.includes("entertain"))     return ["entertainment"];
  if (g.includes("docu"))          return ["documentary"];
  if (g.includes("edu") || g.includes("learn")) return ["education"];
  if (g.includes("relig") || g.includes("faith") || g.includes("church")) return ["religious"];
  if (g.includes("shop"))          return ["shopping"];
  if (g.includes("cook") || g.includes("food")) return ["food"];
  if (g.includes("travel"))        return ["travel"];
  if (g.includes("tech"))          return ["technology"];
  return ["general"];
}

// ── Main fetch ────────────────────────────────

export async function getAllChannels(): Promise<Channel[]> {
  const cached = getCache();
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.channels;
  }

  // Prevent parallel fetches — if a fetch is already in flight, wait for it
  if (globalThis.__iptvFetching) {
    await globalThis.__iptvFetching;
    const c = getCache();
    if (c) return c.channels;
  }

  let resolveFlight!: () => void;
  globalThis.__iptvFetching = new Promise<void>((r) => { resolveFlight = r; });

  try {
    const res = await fetch("https://iptv-org.github.io/iptv/index.m3u", {
      signal:  AbortSignal.timeout(60000),
      headers: { "User-Agent": "TVCW/1.0" },
      // no next: revalidate — Next.js can't cache files >2MB
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`M3U fetch failed: ${res.status}`);

    const raw     = await res.text();
    const entries = parseM3U(raw);

    const result: Channel[] = entries
      .filter((e) => e.url && e.name && !e.name.toLowerCase().includes("test"))
      .map((e, i) => ({
        id:         e.tvgId || `ch-${i}`,
        name:       e.name.replace(/\s*\(.*?\)\s*/g, "").replace(/\s*\[.*?\]\s*/g, "").trim(),
        url:        e.url,
        logo:       e.logo || "",
        categories: normalizeCategories(e.group),
        country:    inferCountry(e),
        isNsfw:     false,
      }));

    console.log(`Loaded ${result.length} channels from M3U`);
    setCache(result);
    return result;
  } catch (error) {
    console.error("Error fetching M3U:", error);
    const stale = getCache();
    if (stale) return stale.channels;
    throw new Error("Failed to load channels");
  } finally {
    resolveFlight();
    globalThis.__iptvFetching = undefined;
  }
}

// ── Filters ───────────────────────────────────

/**
 * Fetch ALL channels for a specific country using the dedicated
 * per-country M3U playlist from IPTV-org. Much more complete than
 * filtering the global index.
 */
export async function getChannelsByCountry(countryCode: string): Promise<Channel[]> {
  const code = countryCode.toLowerCase();

  // Init maps if needed
  if (!globalThis.__iptvCountryCache)    globalThis.__iptvCountryCache    = new Map();
  if (!globalThis.__iptvCountryFetching) globalThis.__iptvCountryFetching = new Map();

  const countryCache   = globalThis.__iptvCountryCache;
  const countryFlight  = globalThis.__iptvCountryFetching;

  const cached = countryCache.get(code);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.channels;
  }

  // Wait if already fetching this country
  const inflight = countryFlight.get(code);
  if (inflight) {
    await inflight;
    return countryCache.get(code)?.channels ?? [];
  }

  let resolve!: () => void;
  countryFlight.set(code, new Promise<void>((r) => { resolve = r; }));

  try {
    const url = `https://iptv-org.github.io/iptv/countries/${code}.m3u`;
    const res = await fetch(url, {
      signal:  AbortSignal.timeout(30000),
      headers: { "User-Agent": "TVCW/1.0" },
      cache:   "no-store",
    });

    if (!res.ok) throw new Error(`Country M3U fetch failed: ${res.status}`);

    const raw     = await res.text();
    const entries = parseM3U(raw);

    const channels: Channel[] = entries
      .filter((e) => e.url && e.name && !e.name.toLowerCase().includes("test"))
      .map((e, i) => ({
        id:         e.tvgId || `${code}-${i}`,
        name:       e.name.replace(/\s*\(.*?\)\s*/g, "").replace(/\s*\[.*?\]\s*/g, "").trim(),
        url:        e.url,
        logo:       e.logo || "",
        categories: normalizeCategories(e.group),
        country:    countryCode.toUpperCase(),
        isNsfw:     false,
      }));

    console.log(`Loaded ${channels.length} channels for ${code.toUpperCase()} from country M3U`);
    countryCache.set(code, { channels, time: Date.now() });
    return channels;
  } catch (error) {
    console.error(`Error fetching country M3U for ${code}:`, error);
    return countryCache.get(code)?.channels ?? [];
  } finally {
    resolve();
    countryFlight.delete(code);
  }
}

export async function getChannelsByCategory(categoryId: string): Promise<Channel[]> {
  const all = await getAllChannels();
  return all.filter((ch) => ch.categories?.includes(categoryId));
}

export async function searchChannels(query: string): Promise<Channel[]> {
  const all = await getAllChannels();
  const q   = query.toLowerCase();
  return all.filter((ch) => ch.name.toLowerCase().includes(q));
}

// ── Meta ──────────────────────────────────────

export async function getCategories(): Promise<ChannelCategory[]> {
  const channels = await getAllChannels();
  const seen     = new Set<string>();
  channels.forEach((ch) => ch.categories.forEach((c) => seen.add(c)));
  return Array.from(seen).sort().map((id) => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1).replace(/-/g, " "),
  }));
}

export async function getCountries(): Promise<ChannelCountry[]> {
  const channels = await getAllChannels();
  const seen     = new Set<string>();
  channels.forEach((ch) => { if (ch.country) seen.add(ch.country); });
  const display  = new Intl.DisplayNames(["en"], { type: "region" });
  return Array.from(seen).sort().map((code) => ({
    code,
    name: display.of(code) ?? code,
    flag: getFlagEmoji(code),
  }));
}

function getFlagEmoji(code: string): string {
  if (!code || code.length !== 2) return "🌍";
  return code.toUpperCase().replace(/./g, (c) =>
    String.fromCodePoint(127397 + c.charCodeAt(0))
  );
}
