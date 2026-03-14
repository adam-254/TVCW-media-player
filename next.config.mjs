/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "**.githubusercontent.com" },
    ],
  },
  env: {
    TMDB_API_KEY:      process.env.TMDB_API_KEY,
    TMDB_ACCESS_TOKEN: process.env.TMDB_ACCESS_TOKEN,
    TMDB_BASE_URL:     process.env.TMDB_BASE_URL,
    IPTV_BASE_URL:     process.env.IPTV_BASE_URL,
  },
};

export default nextConfig;
