"use client";

import { Play, Music, Radio } from "lucide-react";
import type { RadioStation } from "@/types";

interface RadioCardProps {
  station: RadioStation;
  onPlay:  (station: RadioStation) => void;
}

function strToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

function getFlagEmoji(code: string): string {
  if (!code || code.length !== 2) return "";
  return code.toUpperCase().replace(/./g, (c) =>
    String.fromCodePoint(127397 + c.charCodeAt(0))
  );
}

export default function RadioCard({ station, onPlay }: RadioCardProps) {
  const hue     = strToHue(station.name + station.countrycode);
  const hue2    = (hue + 50) % 360;
  const accent  = `hsl(${hue},80%,60%)`;
  const gradient = `linear-gradient(135deg, hsl(${hue},70%,15%) 0%, hsl(${hue2},60%,8%) 100%)`;
  const flag    = getFlagEmoji(station.countrycode);
  const initials = station.name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0].toUpperCase()).join("") || "R";

  const tag = station.tags?.split(",")[0]?.trim() || "radio";

  return (
    <div
      className="group cursor-pointer rounded-lg overflow-hidden border border-white/10 hover:border-white/30 transition-all duration-300 hover:scale-[1.03] hover:shadow-xl"
      onClick={() => onPlay(station)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onPlay(station)}
    >
      {/* Visual */}
      <div className="relative aspect-square flex items-center justify-center overflow-hidden"
        style={{ background: gradient }}>

        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `repeating-linear-gradient(0deg,transparent,transparent 16px,${accent}33 16px,${accent}33 17px),
                            repeating-linear-gradient(90deg,transparent,transparent 16px,${accent}33 16px,${accent}33 17px)`,
        }} />

        {/* Glow */}
        <div className="absolute w-20 h-20 rounded-full blur-2xl opacity-25" style={{ background: accent }} />

        {/* Favicon or initials */}
        {station.favicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={station.favicon} alt={station.name}
            className="relative z-10 w-12 h-12 object-contain rounded drop-shadow-lg"
            onError={(e) => {
              const t = e.currentTarget;
              t.style.display = "none";
              const fb = t.nextElementSibling as HTMLElement | null;
              if (fb) fb.style.display = "flex";
            }}
          />
        ) : null}
        <div className="relative z-10 flex-col items-center justify-center gap-1"
          style={{ display: station.favicon ? "none" : "flex" }}>
          <span className="font-black text-xl tracking-tight" style={{ color: accent, textShadow: `0 0 16px ${accent}` }}>
            {initials}
          </span>
          <Music className="w-4 h-4 opacity-60" style={{ color: accent }} />
        </div>

        {/* Flag */}
        {flag && (
          <div className="absolute top-2 right-2 text-sm bg-black/50 backdrop-blur-sm rounded px-1 py-0.5">
            {flag}
          </div>
        )}

        {/* Codec/bitrate badge */}
        {station.bitrate > 0 && (
          <div className="absolute bottom-2 left-2 font-mono text-[9px] px-1.5 py-0.5 rounded"
            style={{ color: accent, background: `${accent}18`, border: `1px solid ${accent}33` }}>
            {station.codec} {station.bitrate}k
          </div>
        )}

        {/* Play overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          style={{ background: `${accent}22` }}>
          <div className="w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
            style={{ background: `${accent}33`, border: `2px solid ${accent}`, boxShadow: `0 0 20px ${accent}66` }}>
            <Play className="w-5 h-5 ml-0.5" style={{ color: accent, fill: accent }} />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="px-3 py-2.5 bg-black/40 backdrop-blur-sm">
        <p className="font-semibold text-sm text-white leading-tight line-clamp-1 group-hover:text-white transition-colors">
          {station.name}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          <Radio className="w-3 h-3 flex-shrink-0" style={{ color: accent }} />
          <span className="text-[10px] font-mono uppercase tracking-wider truncate"
            style={{ color: accent }}>
            {tag}
          </span>
        </div>
      </div>
    </div>
  );
}
