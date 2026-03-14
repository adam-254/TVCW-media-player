// ─────────────────────────────────────────────
//  TVCW — Shared TypeScript Types
// ─────────────────────────────────────────────

// ── IPTV / Live TV ──────────────────────────
export interface Channel {
  id:         string;
  name:       string;
  url:        string;           // HLS stream URL
  logo:       string;
  categories: string[];
  country:    string;           // Country code
  countries?: { code: string; name: string }[];
  isNsfw:     boolean;
}

// Raw API response from IPTV-org
export interface IPTVChannel {
  id:          string;
  name:        string;
  alt_names:   string[];
  network:     string | null;
  owners:      string[];
  country:     string;
  categories:  string[];
  is_nsfw:     boolean;
  launched:    string | null;
  closed:      string | null;
  replaced_by: string | null;
  website:     string | null;
}

export interface IPTVStream {
  channel:    string | null;
  feed:       string | null;
  title:      string;
  url:        string;
  quality:    string | null;
  user_agent: string | null;
  referrer:   string | null;
}

export interface ChannelCategory {
  id:   string;
  name: string;
}

export interface ChannelCountry {
  code: string;
  name: string;
  flag: string;
}

// ── TMDB — Movies & TV Shows ─────────────────
export interface TMDBShow {
  id:                number;
  name:              string;
  original_name:     string;
  overview:          string;
  poster_path:       string | null;
  backdrop_path:     string | null;
  vote_average:      number;
  vote_count:        number;
  first_air_date:    string;
  genre_ids:         number[];
  origin_country:    string[];
  original_language: string;
  popularity:        number;
}

export interface TMDBShowDetails extends TMDBShow {
  seasons:           TMDBSeason[];
  number_of_seasons: number;
  number_of_episodes: number;
  genres:            TMDBGenre[];
  status:            string;
  tagline:           string;
}

export interface TMDBSeason {
  id:            number;
  name:          string;
  overview:      string;
  poster_path:   string | null;
  season_number: number;
  episode_count: number;
  air_date:      string;
}

export interface TMDBEpisode {
  id:             number;
  name:           string;
  overview:       string;
  still_path:     string | null;
  episode_number: number;
  season_number:  number;
  air_date:       string;
  vote_average:   number;
  runtime:        number | null;
}

export interface TMDBMovie {
  id:                number;
  title:             string;
  original_title:    string;
  overview:          string;
  poster_path:       string | null;
  backdrop_path:     string | null;
  vote_average:      number;
  vote_count:        number;
  release_date:      string;
  genre_ids:         number[];
  original_language: string;
  popularity:        number;
}

export interface TMDBPaginatedResponse<T> {
  page:          number;
  results:       T[];
  total_pages:   number;
  total_results: number;
}

export interface TMDBGenre {
  id:   number;
  name: string;
}

// ── Search ───────────────────────────────────
export type SearchResult =
  | (TMDBShow  & { media_type: "tv" })
  | (TMDBMovie & { media_type: "movie" });

export interface SearchResponse {
  page:          number;
  results:       SearchResult[];
  total_pages:   number;
  total_results: number;
}

// ── UI State ─────────────────────────────────
export type ActiveSection = "live-tv" | "tv-shows" | "search";

export interface PlayerState {
  isOpen:   boolean;
  url:      string | null;
  title:    string | null;
  logo?:    string | null;
}
