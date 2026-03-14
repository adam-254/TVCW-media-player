// ─────────────────────────────────────────────
//  TVCW — TMDB API Client
//  Docs: https://developer.themoviedb.org/docs
// ─────────────────────────────────────────────

import axios from "axios";
import type {
  TMDBPaginatedResponse,
  TMDBShow,
  TMDBShowDetails,
  TMDBSeason,
  TMDBEpisode,
  TMDBMovie,
  TMDBGenre,
  SearchResponse,
} from "@/types";

const tmdb = axios.create({
  baseURL: process.env.TMDB_BASE_URL || "https://api.themoviedb.org/3",
  params: {
    api_key: process.env.TMDB_API_KEY,
  },
  headers: {
    ...(process.env.TMDB_ACCESS_TOKEN
      ? { Authorization: `Bearer ${process.env.TMDB_ACCESS_TOKEN}` }
      : {}),
    "Content-Type": "application/json;charset=utf-8",
  },
});

export const TMDB_IMAGE_BASE  = "https://image.tmdb.org/t/p";
export const TMDB_POSTER_SIZE = "w500";
export const TMDB_BACKDROP_SIZE = "w1280";

export const tmdbImage = (
  path: string | null,
  size: string = TMDB_POSTER_SIZE
): string => {
  if (!path) {
    return "/placeholder-poster.png";
  }
  
  // Ensure the path starts with /
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${TMDB_IMAGE_BASE}/${size}${cleanPath}`;
};

// ── TV Shows ─────────────────────────────────
export async function getTrendingShows(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBShow>> {
  const { data } = await tmdb.get("/trending/tv/week", { params: { page } });
  return data;
}

export async function getPopularShows(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBShow>> {
  const { data } = await tmdb.get("/tv/popular", { params: { page } });
  return data;
}

export async function getTopRatedShows(
  page = 1
): Promise<TMDBPaginatedResponse<TMDBShow>> {
  const { data } = await tmdb.get("/tv/top_rated", { params: { page } });
  return data;
}

export async function getShowDetails(showId: number): Promise<TMDBShowDetails> {
  const { data } = await tmdb.get(`/tv/${showId}`);
  return data;
}

export async function getShowSeasons(showId: number): Promise<TMDBSeason[]> {
  const { data } = await tmdb.get(`/tv/${showId}`);
  return data.seasons || [];
}

export async function getSeasonEpisodes(showId: number, seasonNumber: number): Promise<TMDBEpisode[]> {
  const { data } = await tmdb.get(`/tv/${showId}/season/${seasonNumber}`);
  return data.episodes || [];
}

export async function getTrendingShowsByCountry(
  countryCode: string,
  page = 1
): Promise<TMDBPaginatedResponse<TMDBShow>> {
  const { data } = await tmdb.get("/discover/tv", {
    params: {
      sort_by:            "popularity.desc",
      watch_region:       countryCode,
      with_watch_monetization_types: "flatrate|free|ads|rent|buy",
      page,
    },
  });
  return data;
}

export async function getShowsByGenre(
  genreId: number,
  page = 1
): Promise<TMDBPaginatedResponse<TMDBShow>> {
  const { data } = await tmdb.get("/discover/tv", {
    params: { with_genres: genreId, sort_by: "popularity.desc", page },
  });
  return data;
}

export async function getTVGenres(): Promise<TMDBGenre[]> {
  const { data } = await tmdb.get("/genre/tv/list");
  return data.genres;
}

// ── Search ───────────────────────────────────
export async function searchMulti(
  query: string,
  page = 1
): Promise<SearchResponse> {
  const { data } = await tmdb.get("/search/multi", {
    params: { query, page, include_adult: false },
  });
  return data;
}

export async function searchTVShows(
  query: string,
  page = 1
): Promise<TMDBPaginatedResponse<TMDBShow>> {
  const { data } = await tmdb.get("/search/tv", { params: { query, page } });
  return data;
}
