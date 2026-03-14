"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import ShowCard from "@/components/ui/ShowCard";
import { GridSkeleton } from "@/components/ui/Skeleton";
import { Tv2, TrendingUp, Star, Flame, ChevronDown, MapPin } from "lucide-react";
import type { TMDBShow } from "@/types";

interface Section {
  key:      string;
  title:    string;
  icon:     React.ElementType;
  endpoint: string;
}

const BASE_SECTIONS: Section[] = [
  { key: "trending", title: "Trending This Week", icon: TrendingUp, endpoint: "/api/shows/trending"  },
  { key: "popular",  title: "Popular Right Now",  icon: Flame,      endpoint: "/api/shows/popular"   },
  { key: "toprated", title: "Top Rated",          icon: Star,       endpoint: "/api/shows/top-rated" },
];

interface SectionState {
  shows:       TMDBShow[];
  page:        number;
  totalPages:  number;
  loading:     boolean;
  loadingMore: boolean;
}

const initial: SectionState = { shows: [], page: 0, totalPages: 1, loading: true, loadingMore: false };

export default function TVShowsPage() {
  const [sections, setSections] = useState<Record<string, SectionState>>(
    Object.fromEntries(BASE_SECTIONS.map((s) => [s.key, { ...initial }]))
  );
  const [countryCode,    setCountryCode]    = useState<string | null>(null);
  const [countryName,    setCountryName]    = useState<string | null>(null);
  const [localSection,   setLocalSection]   = useState<SectionState>({ ...initial });

  const fetchPage = useCallback(async (key: string, endpoint: string, page: number) => {
    setSections((prev) => ({
      ...prev,
      [key]: { ...prev[key], loading: page === 1, loadingMore: page > 1 },
    }));
    try {
      const res  = await fetch(`${endpoint}?page=${page}`);
      const data = await res.json();
      setSections((prev) => ({
        ...prev,
        [key]: {
          shows:       page === 1 ? data.results : [...prev[key].shows, ...data.results],
          page,
          totalPages:  data.total_pages,
          loading:     false,
          loadingMore: false,
        },
      }));
    } catch {
      setSections((prev) => ({
        ...prev,
        [key]: { ...prev[key], loading: false, loadingMore: false },
      }));
    }
  }, []);

  const fetchLocalPage = useCallback(async (country: string, page: number) => {
    setLocalSection((prev) => ({
      ...prev,
      loading: page === 1,
      loadingMore: page > 1,
    }));
    try {
      const res  = await fetch(`/api/shows/trending-by-country?country=${country}&page=${page}`);
      const data = await res.json();
      setLocalSection((prev) => ({
        shows:       page === 1 ? data.results : [...prev.shows, ...data.results],
        page,
        totalPages:  data.total_pages,
        loading:     false,
        loadingMore: false,
      }));
    } catch {
      setLocalSection((prev) => ({ ...prev, loading: false, loadingMore: false }));
    }
  }, []);

  // Detect country via IP geolocation
  useEffect(() => {
    fetch("https://ipapi.co/json/")
      .then((r) => r.json())
      .then((d) => {
        if (d.country_code) {
          setCountryCode(d.country_code);
          setCountryName(d.country_name ?? d.country_code);
          fetchLocalPage(d.country_code, 1);
        }
      })
      .catch(() => {
        // Silently fail — local section just won't show
      });
  }, [fetchLocalPage]);

  // Load base sections on mount
  useEffect(() => {
    BASE_SECTIONS.forEach((s) => fetchPage(s.key, s.endpoint, 1));
  }, [fetchPage]);

  return (
    <div className="min-h-screen bg-cyber-dark bg-cyber-grid bg-grid">
      <Navbar />

      {/* Hero */}
      <section className="pt-16">
        <div className="relative px-4 sm:px-6 py-10 sm:py-14 bg-glow-radial text-center overflow-hidden">
          <div className="absolute inset-0 scan-lines pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 cyber-badge mb-4">
              <Tv2 className="w-3 h-3" />
              TV SHOWS
            </div>
            <h1 className="font-display text-2xl sm:text-4xl md:text-6xl font-black text-white mb-4">
              BINGE THE <span className="text-cyber-cyan text-glow-cyan">GRID</span>
            </h1>
            <p className="font-body text-cyber-text text-lg max-w-xl mx-auto">
              Discover trending and top-rated TV shows from around the world.
            </p>
          </div>
        </div>
        <div className="cyber-divider" />
      </section>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-14">

        {/* Trending in your country */}
        {countryCode && (
          <section>
              <div className="flex items-center gap-2 sm:gap-3 mb-6 flex-wrap">
              <MapPin className="w-5 h-5 text-cyber-cyan flex-shrink-0" />
              <h2 className="font-display text-base sm:text-lg font-bold text-white tracking-wider">
                Trending in {countryName}
              </h2>
              {!localSection.loading && (
                <span className="cyber-badge font-mono">{localSection.shows.length}</span>
              )}
              <div className="flex-1 h-px bg-cyber-border/30 hidden sm:block" />
            </div>

            {localSection.loading ? (
              <GridSkeleton count={20} />
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4">
                  {localSection.shows.map((show) => (
                    <ShowCard key={`local-${show.id}`} show={show} />
                  ))}
                </div>
                {localSection.page < localSection.totalPages && (
                  <div className="flex justify-center mt-8">
                    <button
                      onClick={() => fetchLocalPage(countryCode, localSection.page + 1)}
                      disabled={localSection.loadingMore}
                      className="btn-cyber flex items-center gap-2 disabled:opacity-50"
                    >
                      {localSection.loadingMore ? "Loading..." : <><ChevronDown className="w-4 h-4" />Show More</>}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* Global sections */}
        {BASE_SECTIONS.map(({ key, title, icon: Icon, endpoint }) => {
          const s = sections[key];
          const hasMore = s.page < s.totalPages;

          return (
            <section key={key}>
              <div className="flex items-center gap-2 sm:gap-3 mb-6 flex-wrap">
                <Icon className="w-5 h-5 text-cyber-cyan flex-shrink-0" />
                <h2 className="font-display text-base sm:text-lg font-bold text-white tracking-wider">
                  {title}
                </h2>
                {!s.loading && (
                  <span className="cyber-badge font-mono">{s.shows.length}</span>
                )}
                <div className="flex-1 h-px bg-cyber-border/30 hidden sm:block" />
              </div>

              {s.loading ? (
                <GridSkeleton count={20} />
              ) : (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3 sm:gap-4">
                    {s.shows.map((show) => (
                      <ShowCard key={`${key}-${show.id}`} show={show} />
                    ))}
                  </div>

                  {hasMore && (
                    <div className="flex justify-center mt-8">
                      <button
                        onClick={() => fetchPage(key, endpoint, s.page + 1)}
                        disabled={s.loadingMore}
                        className="btn-cyber flex items-center gap-2 disabled:opacity-50"
                      >
                        {s.loadingMore ? (
                          <>Loading...</>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            Show More
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          );
        })}
      </main>
    </div>
  );
}
