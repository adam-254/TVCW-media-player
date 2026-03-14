"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Navbar from "@/components/layout/Navbar";
import { tmdbImage, TMDB_BACKDROP_SIZE, TMDB_POSTER_SIZE } from "@/lib/tmdb";
import { formatYear, formatRating } from "@/lib/utils";
import { ArrowLeft, Star, Calendar, Clock, X, Play } from "lucide-react";
import type { TMDBShowDetails, TMDBSeason, TMDBEpisode } from "@/types";

export default function ShowDetailsPage() {
  const params = useParams();
  const showId = params.id as string;

  const [show, setShow] = useState<TMDBShowDetails | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [episodes, setEpisodes] = useState<TMDBEpisode[]>([]);
  const [loading, setLoading] = useState(true);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [playingEpisode, setPlayingEpisode] = useState<TMDBEpisode | null>(null);
  const [playerStarted, setPlayerStarted] = useState(false);
  const [sourceIndex, setSourceIndex] = useState(0);

  // Fetch show details
  useEffect(() => {
    async function fetchShow() {
      try {
        const response = await fetch(`/api/shows/${showId}`);
        const data = await response.json();
        setShow(data);

        // Load first season episodes by default
        if (data.seasons && data.seasons.length > 0) {
          const firstSeason = data.seasons.find((s: TMDBSeason) => s.season_number > 0);
          if (firstSeason) {
            setSelectedSeason(firstSeason.season_number);
          }
        }
      } catch (error) {
        console.error("Failed to fetch show:", error);
      } finally {
        setLoading(false);
      }
    }

    if (showId) {
      fetchShow();
    }
  }, [showId]);

  // Fetch episodes when season changes
  useEffect(() => {
    async function fetchEpisodes() {
      if (!show || selectedSeason === 0) return;

      setEpisodesLoading(true);
      try {
        const response = await fetch(`/api/shows/${showId}/season/${selectedSeason}`);
        const data = await response.json();
        setEpisodes(data);
      } catch (error) {
        console.error("Failed to fetch episodes:", error);
      } finally {
        setEpisodesLoading(false);
      }
    }

    fetchEpisodes();
  }, [showId, selectedSeason, show]);

  // Close player on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPlayingEpisode(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleEpisodeClick = (episode: TMDBEpisode) => {
    setPlayingEpisode(episode);
    setPlayerStarted(false);
    setSourceIndex(0);
  };

  const closePlayer = () => {
    setPlayingEpisode(null);
    setPlayerStarted(false);
    setSourceIndex(0);
  };

  // Embed sources in priority order — all support TMDB IDs and allow iframing
  const embedSources = (episode: TMDBEpisode) => [
    `https://vidsrc.xyz/embed/tv?tmdb=${showId}&season=${episode.season_number}&episode=${episode.episode_number}`,
    `https://vidbinge.dev/embed/tv/${showId}/${episode.season_number}/${episode.episode_number}`,
    `https://www.2embed.cc/embedtv/${showId}&s=${episode.season_number}&e=${episode.episode_number}`,
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-cyber-dark bg-cyber-grid bg-grid">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-cyber-text">Loading...</div>
        </div>
      </div>
    );
  }

  if (!show) {
    return (
      <div className="min-h-screen bg-cyber-dark bg-cyber-grid bg-grid">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-cyber-text">Show not found</div>
        </div>
      </div>
    );
  }

  const backdropUrl = tmdbImage(show.backdrop_path, TMDB_BACKDROP_SIZE);
  const posterUrl = tmdbImage(show.poster_path, TMDB_POSTER_SIZE);
  const year = formatYear(show.first_air_date);
  const rating = formatRating(show.vote_average);
  const seasons = show.seasons?.filter((s) => s.season_number > 0) || [];

  return (
    <div className="min-h-screen bg-cyber-dark bg-cyber-grid bg-grid">
      <Navbar />

      {/* Player Modal */}
      {playingEpisode && (
        <div
          className="fixed inset-0 z-50 flex flex-col sm:items-center sm:justify-center bg-black/95 sm:bg-black/90 sm:backdrop-blur-sm sm:p-4"
          onClick={closePlayer}
        >
          <div
            className="flex flex-col w-full h-full sm:h-auto sm:max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between bg-cyber-card border-b border-cyber-border/40 sm:border sm:border-b-0 sm:rounded-t-lg px-3 py-2.5 sm:px-4 sm:py-3 flex-shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Play className="w-4 h-4 text-cyber-cyan flex-shrink-0" />
                <span className="text-white font-semibold text-xs sm:text-sm truncate">
                  {show.name}
                  <span className="text-cyber-muted font-normal ml-1 hidden sm:inline">
                    S{String(playingEpisode.season_number).padStart(2, "0")}E
                    {String(playingEpisode.episode_number).padStart(2, "0")} — {playingEpisode.name}
                  </span>
                </span>
              </div>
              <button
                onClick={closePlayer}
                className="text-cyber-muted hover:text-white transition-colors p-1.5 rounded flex-shrink-0"
                aria-label="Close player"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Episode label on mobile (hidden on desktop, shown in header) */}
            <div className="sm:hidden px-3 py-1.5 bg-cyber-card/80 border-b border-cyber-border/20 flex-shrink-0">
              <p className="text-cyber-muted text-xs font-mono truncate">
                S{String(playingEpisode.season_number).padStart(2, "0")}E
                {String(playingEpisode.episode_number).padStart(2, "0")} — {playingEpisode.name}
              </p>
            </div>

            {/* Player area — fills height on mobile, aspect-video on desktop */}
            <div className="relative flex-1 sm:flex-none sm:aspect-video bg-black sm:border sm:border-cyber-border/40 sm:border-t-0 sm:rounded-b-lg overflow-hidden">
              {playerStarted ? (
                <iframe
                  key={`${playingEpisode.season_number}-${playingEpisode.episode_number}-${sourceIndex}`}
                  src={embedSources(playingEpisode)[sourceIndex]}
                  className="absolute inset-0 w-full h-full"
                  allowFullScreen
                  allow="autoplay; fullscreen; picture-in-picture"
                  referrerPolicy="origin"
                  title={`${show.name} S${playingEpisode.season_number}E${playingEpisode.episode_number}`}
                />
              ) : (
                <div className="relative w-full h-full flex items-center justify-center">
                  {playingEpisode.still_path ? (
                    <Image
                      src={tmdbImage(playingEpisode.still_path, "w780")}
                      alt={playingEpisode.name}
                      fill
                      className="object-cover opacity-50"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-cyber-card to-cyber-dark" />
                  )}
                  <div className="absolute inset-0 bg-black/40" />
                  <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
                    <button
                      onClick={() => setPlayerStarted(true)}
                      className="w-16 h-16 rounded-full bg-cyber-cyan/20 border-2 border-cyber-cyan flex items-center justify-center hover:bg-cyber-cyan/40 transition-colors"
                      aria-label="Play episode"
                    >
                      <Play className="w-7 h-7 text-cyber-cyan fill-cyber-cyan ml-1" />
                    </button>
                    <div>
                      <p className="text-white font-semibold text-sm sm:text-base">
                        {playingEpisode.episode_number}. {playingEpisode.name}
                      </p>
                      {playingEpisode.overview && (
                        <p className="text-cyber-muted text-xs sm:text-sm mt-1 max-w-lg line-clamp-2">
                          {playingEpisode.overview}
                        </p>
                      )}
                      <div className="flex items-center justify-center gap-3 mt-2 text-xs text-cyber-muted">
                        {playingEpisode.runtime && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />{playingEpisode.runtime}m
                          </span>
                        )}
                        {playingEpisode.vote_average > 0 && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            {formatRating(playingEpisode.vote_average)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-3 py-2 sm:px-0 sm:mt-3 bg-cyber-card sm:bg-transparent border-t border-cyber-border/20 sm:border-0 flex-shrink-0 text-xs text-cyber-muted">
              <span className="hidden sm:inline">
                Press <kbd className="bg-cyber-card border border-cyber-border/40 px-1.5 py-0.5 rounded font-mono">Esc</kbd> or click outside to close
              </span>
              <span className="sm:hidden font-mono tracking-widest">TAP OUTSIDE TO CLOSE</span>
              {playerStarted && sourceIndex < embedSources(playingEpisode).length - 1 && (
                <button onClick={() => setSourceIndex((i) => i + 1)} className="text-cyber-cyan hover:underline">
                  Try next source →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative pt-16">
        {/* Backdrop */}
        <div className="absolute inset-0 h-[60vh]">
          {show.backdrop_path ? (
            <Image
              src={backdropUrl}
              alt={show.name}
              fill
              className="object-cover"
              priority
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-cyber-card to-cyber-dark" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-cyber-dark via-cyber-dark/60 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-screen-2xl mx-auto px-4 sm:px-6 pt-8">
          {/* Back button */}
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 text-cyber-text hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to TV Shows
          </button>

          <div className="flex flex-col sm:flex-row gap-6 sm:gap-8 pb-16">
            {/* Poster — hidden on very small screens, shown from sm up */}
            <div className="flex-shrink-0 hidden sm:block">
              <div className="w-40 md:w-56 lg:w-64 aspect-[2/3] relative overflow-hidden rounded-lg border border-cyber-border/40 bg-cyber-gray">
                {show.poster_path ? (
                  <Image
                    src={posterUrl}
                    alt={show.name}
                    fill
                    className="object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-cyber-muted">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📺</div>
                      <div className="text-sm">No Image</div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Details */}
            <div className="flex-1 space-y-6">
              <div>
                <h1 className="font-display text-2xl sm:text-4xl md:text-5xl font-black text-white mb-2">
                  {show.name}
                </h1>
                {show.tagline && (
                  <p className="text-cyber-cyan text-base sm:text-lg italic mb-4">{show.tagline}</p>
                )}

                <div className="flex flex-wrap items-center gap-3 text-cyber-text mb-4">
                  <span className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    {rating}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {year}
                  </span>
                  <span>
                    {show.number_of_seasons} Season
                    {show.number_of_seasons !== 1 ? "s" : ""}
                  </span>
                  <span>{show.number_of_episodes} Episodes</span>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  {show.genres?.map((genre) => (
                    <span key={genre.id} className="cyber-badge">
                      {genre.name}
                    </span>
                  ))}
                </div>
              </div>

              <p className="text-cyber-text leading-relaxed max-w-3xl">{show.overview}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Episodes Section */}
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">
        {/* Season Selector */}
        <div className="flex flex-wrap items-center gap-3 mb-8">
          <h2 className="font-display text-xl font-bold text-white">Episodes</h2>
          <select
            value={selectedSeason}
            onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
            className="flex-1 sm:flex-none bg-cyber-card border border-cyber-border/40 text-cyber-text px-3 py-2 rounded-sm font-mono focus:border-cyber-cyan focus:outline-none min-w-0"
          >
            {seasons.map((season) => (
              <option key={season.id} value={season.season_number}>
                {season.name}
              </option>
            ))}
          </select>
        </div>

        {/* Episodes Grid */}
        {episodesLoading ? (
          <div className="text-cyber-text">Loading episodes...</div>
        ) : (
          <div className="grid gap-4">
            {episodes.map((episode) => (
              <div
                key={episode.id}
                className="tvcw-card group cursor-pointer p-4 hover:border-cyber-cyan transition-all"
                onClick={() => handleEpisodeClick(episode)}
              >
                <div className="flex gap-3 sm:gap-4">
                  {/* Episode thumbnail */}
                  <div className="relative w-24 sm:w-32 aspect-video bg-cyber-gray rounded overflow-hidden flex-shrink-0">
                    {episode.still_path ? (
                      <Image
                        src={tmdbImage(episode.still_path, "w300")}
                        alt={episode.name}
                        fill
                        className="object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/60 transition-colors flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Play className="w-8 h-8 text-white drop-shadow-lg" />
                      </div>
                    </div>
                  </div>

                  {/* Episode info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1 sm:mb-2">
                      <h3 className="font-semibold text-sm sm:text-base text-white group-hover:text-cyber-cyan transition-colors leading-tight">
                        {episode.episode_number}. {episode.name}
                      </h3>
                      <div className="flex items-center gap-2 text-cyber-muted text-xs flex-shrink-0">
                        {episode.runtime && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {episode.runtime}m
                          </span>
                        )}
                        {episode.vote_average > 0 && (
                          <span className="flex items-center gap-1">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            {formatRating(episode.vote_average)}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-cyber-text text-xs sm:text-sm leading-relaxed line-clamp-2">
                      {episode.overview || "No description available."}
                    </p>
                    {episode.air_date && (
                      <p className="text-cyber-muted text-xs mt-1 sm:mt-2">
                        Aired: {new Date(episode.air_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}