"use client";

import Image from "next/image";
import Link from "next/link";
import { Star, Calendar } from "lucide-react";
import { tmdbImage, TMDB_POSTER_SIZE } from "@/lib/tmdb";
import { formatYear, formatRating, truncate } from "@/lib/utils";
import type { TMDBShow } from "@/types";

interface ShowCardProps {
  show: TMDBShow;
}

export default function ShowCard({ show }: ShowCardProps) {
  const posterUrl = tmdbImage(show.poster_path, TMDB_POSTER_SIZE);
  const year      = formatYear(show.first_air_date);
  const rating    = formatRating(show.vote_average);

  return (
    <Link href={`/tv-shows/${show.id}`}>
      <div className="tvcw-card group cursor-pointer overflow-hidden">
        {/* Poster */}
        <div className="relative aspect-[2/3] overflow-hidden bg-cyber-gray">
          <Image
            src={posterUrl}
            alt={show.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              // Replace with placeholder on error
              e.currentTarget.src = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjYwMCIgdmlld0JveD0iMCAwIDQwMCA2MDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iNjAwIiBmaWxsPSIjMUExQTFBIi8+CjxwYXRoIGQ9Ik0yMDAgMjUwSDI1MFYzNTBIMjAwVjI1MFoiIGZpbGw9IiM0QTRBNEEiLz4KPHN2Zz4K";
            }}
          />

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-cyber-dark via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

          {/* Rating badge */}
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-sm border border-cyber-border/40">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="font-mono text-xs text-white">{rating}</span>
          </div>

          {/* Hover detail */}
          <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
            <p className="text-xs text-cyber-text leading-relaxed line-clamp-3">
              {truncate(show.overview, 120)}
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="p-3 flex flex-col gap-1.5">
          <h3 className="font-body font-semibold text-sm text-white leading-tight line-clamp-2 group-hover:text-cyber-cyan transition-colors">
            {show.name}
          </h3>
          <div className="flex items-center gap-3 text-cyber-muted">
            <span className="flex items-center gap-1 text-xs">
              <Calendar className="w-3 h-3" />
              {year}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
