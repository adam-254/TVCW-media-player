<div align="center">
  <img src="public/TVCW-logo.png" alt="TVCW Logo" width="80" />
  <h1>TVCW — Stream The World</h1>
  <p>Free live TV streaming + TV show discovery. No subscriptions. No sign-up.</p>

  ![Next.js](https://img.shields.io/badge/Next.js_14-black?style=flat&logo=next.js)
  ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
  ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=flat&logo=tailwindcss&logoColor=white)
  ![License](https://img.shields.io/badge/license-MIT-green?style=flat)
</div>

---

## Features

- **12,000+ Live TV Channels** — sourced from the open-source `iptv-org` project, filterable by country and category
- **TV Shows** — trending, popular, and top-rated sections via TMDB, with "Trending in Your Country" auto-detection
- **Episode Player** — browse seasons and play episodes directly in-app via embedded sources
- **Search** — instant search across both live channels and TV shows simultaneously
- **HLS Player** — browser-based stream player with automatic CORS proxy fallback
- **Cyberpunk UI** — dark theme with cyan accents, scan-line effects, and per-channel gradient cards
- **Fully Responsive** — mobile, tablet, and large-screen layouts

---

## Tech Stack

| | |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Video | HLS.js |
| Icons | Lucide React |
| TV Data | TMDB API |
| Channel Data | iptv-org (open source, no key) |
| Deployment | Vercel |

---

## Getting Started

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/tvcw.git
cd tvcw
npm install
```

### 2. Set up environment variables

Create a `.env.local` file in the root:

```env
TMDB_API_KEY=your_tmdb_key
TMDB_BASE_URL=https://api.themoviedb.org/3
IPTV_BASE_URL=https://iptv-org.github.io/api
```

Get a free TMDB API key at [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api). The IPTV source requires no key.

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploying to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Push the repo to GitHub
2. Import it in the [Vercel dashboard](https://vercel.com/new)
3. Add your environment variables under **Settings → Environment Variables**:
   - `TMDB_API_KEY`
   - `TMDB_BASE_URL` → `https://api.themoviedb.org/3`
   - `IPTV_BASE_URL` → `https://iptv-org.github.io/api`
4. Deploy

---

## Data Sources

| Source | Provides | Cost |
|--------|----------|------|
| [iptv-org/iptv](https://github.com/iptv-org/iptv) | 12,000+ live M3U streams | Free / Open Source |
| [iptv-org API](https://github.com/iptv-org/api) | Channel metadata, logos, countries | Free / Open Source |
| [TMDB API](https://www.themoviedb.org/documentation/api) | TV show data, posters, ratings | Free (key required) |

---

## Legal Notice

TVCW does not host or store any video content. It aggregates publicly available stream URLs from the open-source `iptv-org` community project. Stream availability and legality vary by region. Use responsibly.

---

## License

MIT © TVCW
