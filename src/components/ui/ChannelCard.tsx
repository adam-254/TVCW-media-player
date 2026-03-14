"use client";

import { Play, Radio, Tv, Music, Trophy, Newspaper, Film, BookOpen, ShoppingBag, Baby, Globe } from "lucide-react";
import type { Channel } from "@/types";

interface ChannelCardProps {
  channel: Channel;
  onPlay:  (channel: Channel) => void;
}

// Deterministic hue from a string
function strToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

// Pick a gradient pair based on hue
function getGradient(name: string, category: string): string {
  const hue  = strToHue(name + category);
  const hue2 = (hue + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue},70%,18%) 0%, hsl(${hue2},60%,10%) 100%)`;
}

// Accent color for glow / border
function getAccent(name: string, category: string): string {
  const hue = strToHue(name + category);
  return `hsl(${hue},80%,60%)`;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  news:          Newspaper,
  sports:        Trophy,
  music:         Music,
  movies:        Film,
  entertainment: Tv,
  kids:          Baby,
  education:     BookOpen,
  shopping:      ShoppingBag,
  general:       Globe,
};

function CategoryIcon({ categories }: { categories: string[] }) {
  const cat = categories?.[0]?.toLowerCase() ?? "general";
  const Icon = CATEGORY_ICONS[cat] ?? Radio;
  return <Icon className="w-5 h-5" />;
}

function getFlagEmoji(code: string): string {
  if (!code || code.length !== 2) return "";
  return code.toUpperCase().replace(/./g, (c) =>
    String.fromCodePoint(127397 + c.charCodeAt(0))
  );
}

export default function ChannelCard({ channel, onPlay }: ChannelCardProps) {
  const gradient = getGradient(channel.name, channel.categories?.[0] ?? "");
  const accent   = getAccent(channel.name, channel.categories?.[0] ?? "");
  const flag     = getFlagEmoji(channel.country);
  const initials = channel.name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

  return (
    <div
      className="group cursor-pointer rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl"
      onClick={() => onPlay(channel)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onPlay(channel)}
    >
      {/* Visual area */}
      <div
        className="relative aspect-video flex items-center justify-center overflow-hidden"
        style={{ background: gradient }}
      >
        {/* Decorative grid lines */}
        <div className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg,transparent,transparent 20px,${accent}33 20px,${accent}33 21px),
                              repeating-linear-gradient(90deg,transparent,transparent 20px,${accent}33 20px,${accent}33 21px)`,
          }}
        />

        {/* Glowing circle behind logo/initials */}
        <div
          className="absolute w-24 h-24 rounded-full blur-2xl opacity-30"
          style={{ background: accent }}
        />

        {/* Logo or initials */}
        {channel.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.logo}
            alt={channel.name}
            className="relative z-10 max-h-12 max-w-[70%] object-contain drop-shadow-lg"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = "none";
              const fallback = target.nextElementSibling as HTMLElement | null;
              if (fallback) fallback.style.display = "flex";
            }}
          />
        ) : null}

        {/* Initials fallback — always rendered, hidden when logo loads */}
        <div
          className="relative z-10 flex-col items-center justify-center gap-1"
          style={{ display: channel.logo ? "none" : "flex" }}
        >
          <span
            className="font-black text-2xl tracking-tight leading-none"
            style={{ color: accent, textShadow: `0 0 20px ${accent}` }}
          >
            {initials || "TV"}
          </span>
          <span style={{ color: accent }} className="opacity-60">
            <CategoryIcon categories={channel.categories} />
          </span>
        </div>

        {/* Country flag */}
        {flag && (
          <div className="absolute top-2 right-2 text-base leading-none bg-black/50 backdrop-blur-sm rounded px-1 py-0.5">
            {flag}
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ background: `${accent}22` }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: `${accent}33`, border: `2px solid ${accent}`, boxShadow: `0 0 20px ${accent}66` }}
          >
            <Play className="w-5 h-5 ml-0.5" style={{ color: accent, fill: accent }} />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-2.5 bg-black/40 backdrop-blur-sm">
        <p className="font-semibold text-sm text-white leading-tight line-clamp-1 group-hover:text-white transition-colors">
          {channel.name}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          {channel.categories?.slice(0, 1).map((cat) => (
            <span
              key={cat}
              className="text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ color: accent, background: `${accent}18`, border: `1px solid ${accent}33` }}
            >
              {cat}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
