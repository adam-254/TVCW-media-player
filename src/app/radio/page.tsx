"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import RadioCard from "@/components/ui/RadioCard";
import RadioPlayer from "@/components/player/RadioPlayer";
import CountrySelect from "@/components/ui/CountrySelect";
import { GridSkeleton } from "@/components/ui/Skeleton";
import { Headphones, Filter } from "lucide-react";
import type { RadioStation, ChannelCountry } from "@/types";
export default function RadioPage() {
  const [stations,    setStations]    = useState<RadioStation[]>([]);
  const [countries,   setCountries]   = useState<ChannelCountry[]>([]);
  const [tags,        setTags]        = useState<{ id: string; name: string }[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeTag,   setActiveTag]   = useState("all");
  const [activeCountry, setActiveCountry] = useState("all");
  const [page,        setPage]        = useState(1);
  const [hasMore,     setHasMore]     = useState(true);

  const [playingStation, setPlayingStation] = useState<RadioStation | null>(null);
  const playStation = useCallback((station: RadioStation) => {
    setPlayingStation(station);
  }, []);

  const fetchStations = useCallback(async (tag: string, country: string, pg: number, append = false) => {
    if (pg === 1) setLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(pg), limit: "120" });
      if (tag     && tag     !== "all") params.set("tag",     tag);
      if (country && country !== "all") params.set("country", country);

      const res  = await fetch(`/api/radio?${params}`);
      const data = await res.json();

      setStations((prev) => append ? [...prev, ...data.results] : data.results);
      setHasMore(data.total_pages > pg);
      setPage(pg);
    } catch (err) {
      console.error("Radio fetch error:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Load meta
  useEffect(() => {
    Promise.all([
      fetch("/api/radio/countries").then((r) => r.json()),
      fetch("/api/radio/tags").then((r) => r.json()),
    ]).then(([cnt, tgs]) => {
      setCountries(cnt.slice(0, 100));
      setTags(tgs);
    });
  }, []);

  useEffect(() => {
    fetchStations("all", "all", 1);
  }, [fetchStations]);

  const applyFilter = useCallback((tag: string, country: string) => {
    setActiveTag(tag);
    setActiveCountry(country);
    fetchStations(tag, country, 1);
  }, [fetchStations]);

  const loadMore = useCallback(() => {
    fetchStations(activeTag, activeCountry, page + 1, true);
  }, [fetchStations, activeTag, activeCountry, page]);

  return (
    <div className="min-h-screen bg-cyber-dark bg-cyber-grid bg-grid">
      <Navbar />

      {/* Hero */}
      <section className="pt-16">
        <div className="relative px-4 sm:px-6 py-10 sm:py-14 bg-glow-radial text-center overflow-hidden">
          <div className="absolute inset-0 scan-lines pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 cyber-badge mb-4">
              <Headphones className="w-3 h-3" />
              WORLD RADIO
            </div>
            <h1 className="font-display text-2xl sm:text-4xl md:text-6xl font-black text-white mb-4">
              TUNE INTO THE <span className="text-cyber-cyan text-glow-cyan">WORLD</span>
            </h1>
            <p className="font-body text-cyber-text text-lg max-w-xl mx-auto">
              50,000+ free radio stations from 200+ countries.
              No subscriptions. No fees.
            </p>
          </div>
        </div>
        <div className="cyber-divider" />
      </section>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">

        {/* Filters */}
        <div className="flex flex-col gap-3 mb-8">
          {/* Tag filter */}
          <div className="flex items-center gap-2 min-w-0">
            <Filter className="w-4 h-4 text-cyber-muted flex-shrink-0" />
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 flex-1">
              <button
                onClick={() => applyFilter("all", activeCountry)}
                className={`cyber-badge cursor-pointer transition-all flex-shrink-0 ${activeTag === "all" ? "border-glow bg-cyber-cyan/20 text-cyber-cyan" : "hover:border-cyber-cyan"}`}
              >
                All
              </button>
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => applyFilter(tag.id, activeCountry)}
                  className={`cyber-badge cursor-pointer transition-all flex-shrink-0 capitalize ${activeTag === tag.id ? "border-glow bg-cyber-cyan/20 text-cyber-cyan" : "hover:border-cyber-cyan"}`}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>

          {/* Country filter */}
          <div className="w-full sm:w-64 sm:self-end">
            <CountrySelect
              countries={countries}
              value={activeCountry}
              onChange={(code) => applyFilter(activeTag, code)}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 mb-6">
          <Headphones className="w-4 h-4 text-cyber-cyan" />
          <span className="font-mono text-xs text-cyber-muted tracking-widest uppercase">
            Showing {stations.length.toLocaleString()} stations
          </span>
        </div>

        {/* Grid */}
        {loading ? (
          <GridSkeleton count={24} aspect="square" />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
              {stations.map((station) => (
                <RadioCard key={station.stationuuid} station={station} onPlay={playStation} />
              ))}
            </div>

            {hasMore && (
              <div className="flex justify-center mt-12">
                <button onClick={loadMore} disabled={loadingMore} className="btn-cyber disabled:opacity-50">
                  {loadingMore ? "Loading..." : "Load More Stations"}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Player */}
      {playingStation && (
        <RadioPlayer
          station={playingStation}
          onClose={() => setPlayingStation(null)}
        />
      )}
    </div>
  );
}
