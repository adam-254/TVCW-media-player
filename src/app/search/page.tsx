"use client";

import { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import ChannelCard from "@/components/ui/ChannelCard";
import ShowCard from "@/components/ui/ShowCard";
import VideoPlayer from "@/components/player/VideoPlayer";
import { GridSkeleton } from "@/components/ui/Skeleton";
import { usePlayer } from "@/hooks/usePlayer";
import { useDebounce } from "@/hooks/useDebounce";
import { Search, Radio, Tv2, X } from "lucide-react";
import type { Channel, TMDBShow } from "@/types";

type Tab = "all" | "channels" | "shows";

export default function SearchPage() {
  const [query,    setQuery]    = useState("");
  const [tab,      setTab]      = useState<Tab>("all");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [shows,    setShows]    = useState<TMDBShow[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const debouncedQuery         = useDebounce(query, 500);
  const { player, playChannel, closePlayer } = usePlayer();

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setChannels([]);
      setShows([]);
      setSearched(false);
      setLoading(false);
      setChannelsLoading(false);
      return;
    }

    async function doSearch() {
      setLoading(true);
      setChannelsLoading(true);
      setSearched(true);
      try {
        // Kick off both in parallel; show TV shows as soon as they arrive
        const showPromise = fetch(`/api/shows/search?q=${encodeURIComponent(debouncedQuery)}`)
          .then((r) => r.json())
          .then((sh) => {
            setShows(sh.results ?? []);
            setLoading(false);
          });

        const channelPromise = fetch(`/api/channels/search?q=${encodeURIComponent(debouncedQuery)}`)
          .then((r) => r.json())
          .then((ch) => {
            setChannels(Array.isArray(ch) ? ch : []);
            setChannelsLoading(false);
          });

        await Promise.all([showPromise, channelPromise]);
      } catch (err) {
        console.error("Search error:", err);
        setLoading(false);
        setChannelsLoading(false);
      }
    }

    doSearch();
  }, [debouncedQuery]);

  const totalResults = channels.length + shows.length;

  const TABS: { id: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { id: "all",      label: "All",      icon: Search, count: totalResults   },
    { id: "channels", label: "Live TV",  icon: Radio,  count: channels.length },
    { id: "shows",    label: "TV Shows", icon: Tv2,    count: shows.length    },
  ];

  return (
    <div className="min-h-screen bg-cyber-dark bg-cyber-grid bg-grid">
      <Navbar />

      <section className="pt-16">
        <div className="relative px-4 sm:px-6 py-10 sm:py-14 bg-glow-radial text-center overflow-hidden">
          <div className="absolute inset-0 scan-lines pointer-events-none" />
          <div className="relative z-10 max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 cyber-badge mb-4">
              <Search className="w-3 h-3" />
              SEARCH
            </div>
            <h1 className="font-display text-2xl sm:text-4xl md:text-5xl font-black text-white mb-8">
              FIND YOUR <span className="text-cyber-cyan text-glow-cyan">SIGNAL</span>
            </h1>

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyber-muted" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search channels, shows..."
                autoFocus
                className="w-full bg-cyber-card border border-cyber-border/60 focus:border-cyber-cyan text-white placeholder-cyber-muted
                           font-body text-base pl-10 pr-10 py-3 sm:py-4 rounded-sm outline-none transition-all
                           focus:shadow-cyan focus:glow-cyan"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-cyber-muted hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="cyber-divider" />
      </section>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">

        {/* Tabs (only shown after search) */}
        {searched && !loading && (
          <div className="flex items-center gap-1 mb-8 border-b border-cyber-border/30 pb-1 overflow-x-auto scrollbar-none">
            {TABS.map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold tracking-wider uppercase transition-all flex-shrink-0
                  ${tab === id
                    ? "text-cyber-cyan border-b-2 border-cyber-cyan"
                    : "text-cyber-muted hover:text-white"
                  }`}
              >
                <Icon className="w-4 h-4" />
                {label}
                <span className="font-mono text-xs bg-cyber-gray px-1.5 py-0.5 rounded">
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {loading && <GridSkeleton count={12} />}

        {/* No results */}
        {!loading && !channelsLoading && searched && totalResults === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-16 h-16 border-2 border-cyber-border/30 rounded-full flex items-center justify-center">
              <Search className="w-8 h-8 text-cyber-muted" />
            </div>
            <p className="font-display text-cyber-muted text-sm tracking-widest uppercase">
              No results for &ldquo;{query}&rdquo;
            </p>
            <p className="font-body text-cyber-muted/60 text-sm">
              Try a different channel name, show title, or country
            </p>
          </div>
        )}

        {/* Empty state (before search) */}
        {!loading && !searched && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-16 h-16 border border-cyber-border/30 rounded-full flex items-center justify-center animate-pulse-cyan">
              <Radio className="w-8 h-8 text-cyber-cyan" />
            </div>
            <p className="font-display text-cyber-muted text-sm tracking-widest uppercase">
              Awaiting signal...
            </p>
            <p className="font-body text-cyber-muted/60 text-sm text-center max-w-xs">
              Search across {" "}
              <span className="text-cyber-cyan">11,000+ live channels</span>{" "}
              and thousands of TV shows
            </p>
          </div>
        )}

        {/* Results */}
        {searched && totalResults > 0 && (
          <div className="space-y-12">

            {/* Channel results */}
            {(tab === "all" || tab === "channels") && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <Radio className="w-5 h-5 text-cyber-cyan" />
                  <h2 className="font-display text-lg font-bold text-white tracking-wider">
                    Live Channels
                  </h2>
                  {channelsLoading ? (
                    <span className="cyber-badge animate-pulse">searching...</span>
                  ) : (
                    <span className="cyber-badge">{channels.length}</span>
                  )}
                  <div className="flex-1 h-px bg-cyber-border/30" />
                </div>
                {channelsLoading ? (
                  <GridSkeleton count={6} />
                ) : channels.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                    {channels.slice(0, tab === "all" ? 12 : channels.length).map((ch) => (
                      <ChannelCard key={ch.id} channel={ch} onPlay={playChannel} />
                    ))}
                  </div>
                ) : (
                  <p className="text-cyber-muted text-sm">No live channels found.</p>
                )}
              </section>
            )}

            {/* Show results */}
            {(tab === "all" || tab === "shows") && shows.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <Tv2 className="w-5 h-5 text-cyber-cyan" />
                  <h2 className="font-display text-lg font-bold text-white tracking-wider">
                    TV Shows
                  </h2>
                  <span className="cyber-badge">{shows.length}</span>
                  <div className="flex-1 h-px bg-cyber-border/30" />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                  {shows.slice(0, tab === "all" ? 12 : shows.length).map((show) => (
                    <ShowCard key={show.id} show={show} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

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
