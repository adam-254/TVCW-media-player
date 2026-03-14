"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/layout/Navbar";
import ChannelCard from "@/components/ui/ChannelCard";
import CountrySelect from "@/components/ui/CountrySelect";
import VideoPlayer from "@/components/player/VideoPlayer";
import { GridSkeleton } from "@/components/ui/Skeleton";
import { usePlayer } from "@/hooks/usePlayer";
import { Radio, Filter } from "lucide-react";
import type { Channel, ChannelCategory, ChannelCountry } from "@/types";

export default function LiveTVPage() {
  const [channels,    setChannels]    = useState<Channel[]>([]);
  const [categories,  setCategories]  = useState<ChannelCategory[]>([]);
  const [countries,   setCountries]   = useState<ChannelCountry[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [activeCountry,  setActiveCountry]  = useState<string>("all");
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [total,       setTotal]       = useState(0);

  const { player, playChannel, closePlayer } = usePlayer();

  // ── Fetch channels (server-filtered + paginated) ──
  const fetchChannels = useCallback(async (cat: string, country: string, pg: number, append = false) => {
    if (pg === 1) setLoading(true); else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(pg), limit: "120" });
      if (cat     && cat     !== "all") params.set("category", cat);
      if (country && country !== "all") params.set("country",  country);

      const res  = await fetch(`/api/channels?${params}`);
      const data = await res.json();

      setChannels((prev) => append ? [...prev, ...data.results] : data.results);
      setTotal(data.total);
      setTotalPages(data.total_pages);
      setPage(pg);
    } catch (err) {
      console.error("Failed to load channels:", err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Load meta (categories + countries) once
  useEffect(() => {
    Promise.all([
      fetch("/api/channels/categories").then((r) => r.json()),
      fetch("/api/channels/countries").then((r) => r.json()),
    ]).then(([cat, cnt]) => {
      setCategories(cat);
      setCountries(cnt);
    });
  }, []);

  // Initial channel load
  useEffect(() => {
    fetchChannels("all", "all", 1);
  }, [fetchChannels]);

  const applyFilter = useCallback((cat: string, country: string) => {
    setActiveCategory(cat);
    setActiveCountry(country);
    fetchChannels(cat, country, 1);
  }, [fetchChannels]);

  const loadMore = useCallback(() => {
    fetchChannels(activeCategory, activeCountry, page + 1, true);
  }, [fetchChannels, activeCategory, activeCountry, page]);

  return (
    <div className="min-h-screen bg-cyber-dark bg-cyber-grid bg-grid">
      <Navbar />

      {/* Hero */}
      <section className="pt-16 pb-0">
        <div className="relative px-4 sm:px-6 py-10 sm:py-14 bg-glow-radial text-center overflow-hidden">
          <div className="absolute inset-0 scan-lines pointer-events-none" />
          <div className="relative z-10">
            <div className="inline-flex items-center gap-2 cyber-badge mb-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-cyan opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyber-cyan" />
              </span>
              LIVE BROADCAST
            </div>
            <h1 className="font-display text-2xl sm:text-4xl md:text-6xl font-black text-white mb-4">
              STREAM THE <span className="text-cyber-cyan text-glow-cyan">WORLD</span>
            </h1>
            <p className="font-body text-cyber-text text-lg max-w-xl mx-auto">
              {total > 0 ? `${total.toLocaleString()}+` : "10,000+"} free live TV channels from every corner of the planet.
              No subscriptions. No fees.
            </p>
          </div>
        </div>
        <div className="cyber-divider" />
      </section>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">

        {/* Filters */}
        <div className="flex flex-col gap-3 mb-8">
          {/* Category filter — horizontally scrollable on mobile */}
          <div className="flex items-center gap-2 min-w-0">
            <Filter className="w-4 h-4 text-cyber-muted flex-shrink-0" />
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1 flex-1">
              <button
                onClick={() => applyFilter("all", activeCountry)}
                className={`cyber-badge cursor-pointer transition-all flex-shrink-0 ${activeCategory === "all" ? "border-glow bg-cyber-cyan/20 text-cyber-cyan" : "hover:border-cyber-cyan"}`}
              >
                All
              </button>
              {categories.slice(0, 10).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => applyFilter(cat.id, activeCountry)}
                  className={`cyber-badge cursor-pointer transition-all flex-shrink-0 ${activeCategory === cat.id ? "border-glow bg-cyber-cyan/20 text-cyber-cyan" : "hover:border-cyber-cyan"}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Country filter */}
          <div className="w-full sm:w-64 sm:self-end">
            <CountrySelect
              countries={countries}
              value={activeCountry}
              onChange={(code) => applyFilter(activeCategory, code)}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 mb-6">
          <Radio className="w-4 h-4 text-cyber-cyan" />
          <span className="font-mono text-xs text-cyber-muted tracking-widest uppercase">
            Showing {channels.length.toLocaleString()} of {total.toLocaleString()} channels
          </span>
        </div>

        {/* Grid */}
        {loading ? (
          <GridSkeleton count={24} aspect="video" />
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
              {channels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  onPlay={playChannel}
                />
              ))}
            </div>

            {/* Load more */}
            {page < totalPages && (
              <div className="flex justify-center mt-12">
                <button onClick={loadMore} disabled={loadingMore} className="btn-cyber disabled:opacity-50">
                  {loadingMore ? "Loading..." : "Load More Channels"}
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Player */}
      {player.isOpen && player.url && (
        <VideoPlayer
          url={player.url}
          title={player.title || ""}
          logo={player.logo}
          onClose={closePlayer}
        />
      )}
    </div>
  );
}
