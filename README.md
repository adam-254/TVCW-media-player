# 📡 TVCW — Stream The World

> Free live TV streaming + TV show discovery. Built with Next.js 14, Tailwind CSS, HLS.js, IPTV-org & TMDB.

---

## ✨ Features

- 📺 **11,000+ Live TV Channels** — sourced from the open-source `iptv-org` project
- 🎬 **TV Shows** — trending, popular, and top-rated via TMDB API
- 🔍 **Search** — search channels and shows simultaneously
- ▶️ **HLS Video Player** — built-in browser-based stream player
- 🌍 **Filter by Country & Category** — find channels from any region
- ⚡ **Next.js 14 App Router** — fast, ISR-cached pages
- 🎨 **Cyberpunk UI** — black & cyan with scan-line effects

---

## 🚀 Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/tvcw.git
cd tvcw
npm install
```

### 2. Set Up Environment Variables

```bash
cp .env.example .env.local
```

Then open `.env.local` and fill in:

```env
TMDB_API_KEY=your_key_here
```

> Get a **free** TMDB API key at: https://www.themoviedb.org/settings/api
> The IPTV source (`iptv-org`) requires **no key** — it's fully public.

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Project Structure

```
tvcw/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Home — Live TV
│   │   ├── tv-shows/page.tsx         # TV Shows
│   │   ├── search/page.tsx           # Search
│   │   ├── layout.tsx                # Root layout
│   │   ├── globals.css               # Global styles + cyberpunk theme
│   │   └── api/
│   │       ├── channels/
│   │       │   ├── route.ts          # GET all channels
│   │       │   ├── search/route.ts   # GET search channels
│   │       │   ├── categories/route.ts
│   │       │   └── countries/route.ts
│   │       └── shows/
│   │           ├── trending/route.ts
│   │           └── search/route.ts
│   ├── components/
│   │   ├── layout/
│   │   │   └── Navbar.tsx
│   │   ├── player/
│   │   │   └── VideoPlayer.tsx       # HLS.js player
│   │   └── ui/
│   │       ├── ChannelCard.tsx
│   │       ├── ShowCard.tsx
│   │       └── Skeleton.tsx
│   ├── hooks/
│   │   ├── usePlayer.ts              # Video player state
│   │   └── useDebounce.ts            # Input debounce
│   ├── lib/
│   │   ├── tmdb.ts                   # TMDB API client
│   │   ├── iptv.ts                   # IPTV-org API client + M3U parser
│   │   └── utils.ts                  # Shared helpers
│   └── types/
│       └── index.ts                  # All TypeScript interfaces
├── public/
├── .env.example
├── next.config.mjs
├── tailwind.config.ts
└── tsconfig.json
```

---

## 🔌 Data Sources

| Source | What it provides | Cost |
|--------|-----------------|------|
| [iptv-org/iptv](https://github.com/iptv-org/iptv) | 11,000+ live channel M3U streams | Free / Open Source |
| [iptv-org API](https://github.com/iptv-org/api) | Channel metadata, logos, countries | Free / Open Source |
| [TMDB API](https://www.themoviedb.org/documentation/api) | TV show data, posters, ratings | Free (key required) |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Video Playback | HLS.js |
| HTTP Client | Axios |
| Icons | Lucide React |
| Fonts | Orbitron, Rajdhani, Share Tech Mono |
| Deployment | Vercel (recommended) |

---

## 🌐 Deploying to Vercel

```bash
npm install -g vercel
vercel
```

Add your environment variables in the Vercel dashboard under **Settings → Environment Variables**.

---

## 📌 Roadmap / What to Build Next

- [ ] Favorites / watchlist (localStorage)
- [ ] Channel EPG (Electronic Program Guide)
- [ ] User authentication (NextAuth.js)
- [ ] Movie section (TMDB movies)
- [ ] Show detail page with episode list
- [ ] Dark/light mode toggle
- [ ] PWA support (watch on mobile)
- [ ] Embed YouTube trailers for shows

---

## ⚠️ Legal Notice

TVCW does not host or store any video content. It aggregates publicly available stream URLs from the open-source `iptv-org` community project. Stream availability and legality vary by region. Use responsibly.

---

## 📄 License

MIT © TVCW
