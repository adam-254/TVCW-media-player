"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { X, Play, Star, Clock, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { tmdbImage } from "@/lib/tmdb";
import { formatRating } from "@/lib/utils";
import type { TMDBEpisode } from "@/types";

interface EpisodePlayerProps {
  episode:   TMDBEpisode;
  showId:    string;
  showName:  string;
  sources:   string[];
  onClose:   () => void;
}

export default function EpisodePlayer({
  episode, showId, showName, sources, onClose,
}: EpisodePlayerProps) {
  const containerRef            = useRef<HTMLDivElement>(null);
  const [started,   setStarted] = useState(false);
  const [srcIdx,    setSrcIdx]  = useState(0);
  const [isFs,      setIsFs]    = useState(false);
  const [ctrlsVis,  setCtrlsVis] = useState(true);
  const hideTimer               = useRef<ReturnType<typeof setTimeout> | null>(null);

  const epCode = `S${String(episode.season_number).padStart(2, "0")}E${String(episode.episode_number).padStart(2, "0")}`;

  // ── Auto-hide controls ────────────────────────────────────────────────────
  function showControls() {
    setCtrlsVis(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    // Only auto-hide once the iframe is playing
    if (started) hideTimer.current = setTimeout(() => setCtrlsVis(false), 3000);
  }
  useEffect(() => {
    showControls();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [started]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fullscreen ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFs = () => {
    const el = containerRef.current; if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  // ── Escape key ────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const hasNext = srcIdx < sources.length - 1;

  return (
    <>
      <style>{`
        @keyframes ep-fade-in {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes ep-slide-up {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ep-modal  { animation: ep-fade-in  0.3s cubic-bezier(0.16,1,0.3,1) both; }
        .ep-mobile { animation: ep-slide-up 0.35s cubic-bezier(0.16,1,0.3,1) both; }
        .ep-ctrl-fade { transition: opacity 0.3s ease; }
        .ep-ctrl-hide { opacity: 0; pointer-events: none; }
        .ep-top-grad    { background: linear-gradient(to bottom, rgba(0,0,0,0.82) 0%, transparent 100%); }
        .ep-bottom-grad { background: linear-gradient(to top,   rgba(0,0,0,0.75) 0%, transparent 100%); }
      `}</style>

      {/* Backdrop — no onClick so clicking outside does nothing */}
      <div className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center sm:p-4 lg:p-8 2xl:p-12"
        style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(20px)" }}>

        {/*
          Mobile  (<sm) : full-screen sheet, slides up
          Tablet  (sm→lg): centered modal max-w-3xl, aspect-video
          Desktop (lg→2xl): max-w-5xl, rounded-2xl
          TV      (2xl+): max-w-7xl, rounded-3xl, larger UI
        */}
        <div
          ref={containerRef}
          className={cn(
            "relative flex flex-col bg-black overflow-hidden",
            "w-full h-full",
            "sm:h-auto sm:rounded-xl sm:max-w-3xl ep-modal",
            "lg:max-w-5xl lg:rounded-2xl",
            "2xl:max-w-7xl 2xl:rounded-3xl",
            "max-sm:ep-mobile max-sm:rounded-t-2xl max-sm:rounded-b-none",
          )}
          style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 40px 80px rgba(0,0,0,0.8)" }}
          onMouseMove={showControls}
          onTouchStart={showControls}
        >
          {/* ── Video / thumbnail area ── */}
          <div className="relative bg-black w-full flex-1 sm:flex-none sm:aspect-video">

            {started ? (
              <iframe
                key={`${episode.season_number}-${episode.episode_number}-${srcIdx}`}
                src={sources[srcIdx]}
                className="absolute inset-0 w-full h-full"
                allowFullScreen
                allow="autoplay; fullscreen; picture-in-picture"
                referrerPolicy="origin"
                title={`${showName} ${epCode}`}
              />
            ) : (
              /* ── Thumbnail / play screen ── */
              <div className="relative w-full h-full flex items-center justify-center">
                {episode.still_path ? (
                  <Image
                    src={tmdbImage(episode.still_path, "w780")}
                    alt={episode.name}
                    fill
                    className="object-cover opacity-40"
                  />
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-black" />
                )}
                <div className="absolute inset-0 bg-black/40" />

                <div className="relative z-10 flex flex-col items-center gap-5 px-6 text-center max-w-2xl 2xl:max-w-3xl">
                  {/* Play button */}
                  <button
                    onClick={() => setStarted(true)}
                    className="w-16 h-16 lg:w-20 lg:h-20 2xl:w-24 2xl:h-24 rounded-full bg-white/15 border-2 border-white/60 flex items-center justify-center hover:bg-white/25 hover:border-white transition-all"
                    aria-label="Play episode"
                  >
                    <Play className="w-7 h-7 lg:w-9 lg:h-9 2xl:w-11 2xl:h-11 text-white fill-white ml-1" />
                  </button>

                  <div>
                    <p className="text-white font-semibold text-sm lg:text-base 2xl:text-xl leading-snug">
                      {episode.episode_number}. {episode.name}
                    </p>
                    {episode.overview && (
                      <p className="text-white/50 text-xs lg:text-sm 2xl:text-base mt-2 line-clamp-2 leading-relaxed">
                        {episode.overview}
                      </p>
                    )}
                    <div className="flex items-center justify-center gap-4 mt-3 text-xs lg:text-sm 2xl:text-base text-white/40">
                      {episode.runtime && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3 2xl:w-4 2xl:h-4" />{episode.runtime}m
                        </span>
                      )}
                      {episode.vote_average > 0 && (
                        <span className="flex items-center gap-1.5">
                          <Star className="w-3 h-3 2xl:w-4 2xl:h-4 text-yellow-400 fill-yellow-400" />
                          {formatRating(episode.vote_average)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Top bar (title + controls) ── */}
            <div className={cn(
              "ep-ctrl-fade absolute top-0 left-0 right-0 ep-top-grad",
              "px-4 pt-4 pb-10 sm:px-5 sm:pt-5 lg:px-7 lg:pt-6 2xl:px-10 2xl:pt-8",
              !ctrlsVis && "ep-ctrl-hide",
            )}>
              <div className="flex items-center justify-between gap-3">
                {/* Title */}
                <div className="min-w-0">
                  <p className="font-mono text-xs lg:text-sm 2xl:text-base text-white/90 tracking-wider uppercase font-semibold truncate">
                    {showName}
                  </p>
                  <p className="font-mono text-[10px] lg:text-xs 2xl:text-sm text-white/40 tracking-widest truncate">
                    {epCode} — {episode.name}
                  </p>
                </div>

                {/* Buttons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {started && hasNext && (
                    <button
                      onClick={() => setSrcIdx((i) => i + 1)}
                      className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 2xl:px-4 2xl:py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/70 hover:text-white font-mono text-[10px] lg:text-xs 2xl:text-sm tracking-wider transition-all border border-white/10"
                    >
                      <ChevronRight className="w-3 h-3 2xl:w-4 2xl:h-4" /> Next source
                    </button>
                  )}
                  <button
                    onClick={toggleFs}
                    className="p-2 lg:p-2.5 2xl:p-3 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all"
                  >
                    {isFs
                      ? <Minimize2 className="w-4 h-4 lg:w-5 lg:h-5 2xl:w-6 2xl:h-6" />
                      : <Maximize2 className="w-4 h-4 lg:w-5 lg:h-5 2xl:w-6 2xl:h-6" />}
                  </button>
                  <button
                    onClick={onClose}
                    className="p-2 lg:p-2.5 2xl:p-3 rounded-full text-white/60 hover:text-red-400 hover:bg-red-400/10 transition-all"
                    aria-label="Close player"
                  >
                    <X className="w-4 h-4 lg:w-5 lg:h-5 2xl:w-6 2xl:h-6" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Bottom bar (source switcher on mobile) ── */}
            {started && hasNext && (
              <div className={cn(
                "ep-ctrl-fade sm:hidden absolute bottom-0 left-0 right-0 ep-bottom-grad",
                "px-4 pb-4 pt-10",
                !ctrlsVis && "ep-ctrl-hide",
              )}>
                <button
                  onClick={() => setSrcIdx((i) => i + 1)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/70 font-mono text-[10px] tracking-wider"
                >
                  <ChevronRight className="w-3 h-3" /> Try next source
                </button>
              </div>
            )}
          </div>

          {/* Mobile drag handle */}
          <div className="sm:hidden flex items-center justify-center py-2 bg-black/60">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    </>
  );
}
