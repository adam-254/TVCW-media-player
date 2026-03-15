"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Volume2, VolumeX, RefreshCw, Wifi, WifiOff, Radio, Music2, Mic2, Signal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RadioStation } from "@/types";

interface RadioPlayerProps {
  station: RadioStation;
  onClose: () => void;
}

interface IcyMeta {
  track: string | null;
  streamUrl: string | null;
  station: string;
  genre: string;
  description: string;
  stationUrl: string;
  bitrate: string;
  samplerate: string;
  channels: string;
  isPublic: boolean;
  serverSoftware: string;
  contentType: string;
}

function proxyUrl(url: string) {
  return `/api/stream-proxy?url=${encodeURIComponent(url)}`;
}
function strToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}
function getFlagEmoji(code: string): string {
  if (!code || code.length !== 2) return "";
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}
function parseTrack(raw: string): { artist: string | null; title: string } {
  const sep = raw.indexOf(" - ");
  if (sep > 0) return { artist: raw.slice(0, sep).trim(), title: raw.slice(sep + 3).trim() };
  return { artist: null, title: raw };
}

type Stage = "direct" | "proxy" | "failed";
const BAR_COUNT = 52;
const RING_POINTS = 64;

export default function RadioPlayer({ station, onClose }: RadioPlayerProps) {
  const audioRef    = useRef<HTMLAudioElement>(null);
  const stageRef    = useRef<Stage>("direct");
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef     = useRef<number | null>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const cardRef     = useRef<HTMLDivElement>(null);
  const holoPosRef  = useRef({ x: 0.5, y: 0.5 });

  const [loading,   setLoading]   = useState(true);
  const [failed,    setFailed]    = useState(false);
  const [allFailed, setAllFailed] = useState(false);
  const [playing,   setPlaying]   = useState(false);
  const [muted,     setMuted]     = useState(false);
  const [volume,    setVolume]    = useState(1);
  const [bars,      setBars]      = useState(() =>
    Array.from({ length: BAR_COUNT }, () => 0.08 + Math.random() * 0.12)
  );
  const [ringBars, setRingBars]   = useState(() =>
    Array.from({ length: RING_POINTS }, () => 0.1 + Math.random() * 0.15)
  );
  const [tick,      setTick]      = useState(0);
  const [meta,      setMeta]      = useState<IcyMeta | null>(null);
  const [metaRefreshing, setMetaRefreshing] = useState(false);
  const [titleOverflows, setTitleOverflows] = useState(false);
  const [holoPos,   setHoloPos]   = useState({ x: 0.5, y: 0.5 });
  const [isHovered, setIsHovered] = useState(false);
  const [glitching, setGlitching] = useState(false);
  const [vuLeft,    setVuLeft]    = useState(0.3);
  const [vuRight,   setVuRight]   = useState(0.28);
  const [artistImageUrl, setArtistImageUrl] = useState<string | null>(null);

  const titleWrapRef  = useRef<HTMLDivElement>(null);
  const fetchMetaRef  = useRef<(() => Promise<void>) | null>(null);

  const hue  = strToHue(station.name + station.countrycode);
  const hue2 = (hue + 55)  % 360;
  const hue3 = (hue + 110) % 360;
  const accent  = `hsl(${hue},90%,65%)`;
  const accent2 = `hsl(${hue2},80%,58%)`;
  const accent3 = `hsl(${hue3},70%,52%)`;
  const accentRaw = `${hue},90%,65%`;
  const flag = getFlagEmoji(station.countrycode);
  const tag  = station.tags?.split(",")[0]?.trim() || "radio";

  // ── Mouse-tracking holographic sheen ──────────────────────────────────────
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const onMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top)  / rect.height;
      holoPosRef.current = { x, y };
      setHoloPos({ x, y });
    };
    card.addEventListener("mousemove", onMove);
    return () => card.removeEventListener("mousemove", onMove);
  }, []);

  // ── Glitch on station change ───────────────────────────────────────────────
  useEffect(() => {
    setGlitching(true);
    const t = setTimeout(() => setGlitching(false), 900);
    return () => clearTimeout(t);
  }, [station.stationuuid]);

  // ── Visualizer + ring + VU ────────────────────────────────────────────────
  useEffect(() => {
    if (!playing || muted) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      setBars(Array.from({ length: BAR_COUNT }, () => 0.08 + Math.random() * 0.12));
      setRingBars(Array.from({ length: RING_POINTS }, () => 0.1 + Math.random() * 0.15));
      setVuLeft(0.15); setVuRight(0.12);
      return;
    }
    let last = 0;
    const tickFn = (now: number) => {
      if (now - last > 50) {
        last = now;
        setBars((prev) => prev.map((v) => { const t = 0.05 + Math.random() * 0.95; return v + (t - v) * 0.38; }));
        setRingBars((prev) => prev.map((v) => { const t = 0.05 + Math.random() * 0.9; return v + (t - v) * 0.25; }));
        setVuLeft((v)  => { const t = 0.1 + Math.random() * 0.9; return v + (t - v) * 0.3; });
        setVuRight((v) => { const t = 0.1 + Math.random() * 0.9; return v + (t - v) * 0.3; });
        setTick((t) => t + 1);
      }
      animRef.current = requestAnimationFrame(tickFn);
    };
    animRef.current = requestAnimationFrame(tickFn);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [playing, muted]);

  // ── ICY metadata polling ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchMeta() {
      try {
        const res = await fetch(
          `/api/radio/now-playing?url=${encodeURIComponent(station.url_resolved)}`,
          { cache: "no-store" }
        );
        if (!res.ok || cancelled) return;
        const data: IcyMeta = await res.json();
        if (cancelled) return;
        setMeta(data);
      } catch { /* best-effort */ }
    }
    fetchMetaRef.current = fetchMeta;
    if (!playing) return;
    fetchMeta();
    pollRef.current = setInterval(fetchMeta, 8000);
    return () => {
      cancelled = true;
      fetchMetaRef.current = null;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [playing, station.url_resolved]);

  const manualRefresh = async () => {
    if (metaRefreshing || !fetchMetaRef.current) return;
    setMetaRefreshing(true);
    await fetchMetaRef.current();
    setMetaRefreshing(false);
  };

  useEffect(() => {
    setMeta(null);
    setTitleOverflows(false);
    setArtistImageUrl(null);
  }, [station.stationuuid]);

  useEffect(() => {
    if (!titleWrapRef.current) return;
    const el = titleWrapRef.current;
    setTitleOverflows(el.scrollWidth > el.clientWidth + 4);
  }, [meta?.track]);

  // ── Artist image via MusicBrainz / Wikipedia ─────────────────────────────
  useEffect(() => {
    const artist = meta?.track ? parseTrack(meta.track).artist : null;
    if (!artist) { setArtistImageUrl(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const wikiRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artist)}`,
          { headers: { "User-Agent": "TVCW-Radio/1.0" } }
        );
        if (!wikiRes.ok || cancelled) return;
        const wikiData = await wikiRes.json();
        const img = wikiData?.thumbnail?.source;
        if (img && !cancelled) setArtistImageUrl(img);
      } catch { /* best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [meta?.track]);

  // ── Audio loading ─────────────────────────────────────────────────────────
  function clearTimer() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
  }
  function loadStage(stage: Stage) {
    const audio = audioRef.current;
    if (!audio) return;
    clearTimer();
    stageRef.current = stage;
    setLoading(true); setFailed(false);
    audio.pause();
    audio.src = stage === "proxy" ? proxyUrl(station.url_resolved) : station.url_resolved;
    audio.load();
    let resolved = false;
    const succeed = () => {
      if (resolved) return; resolved = true; clearTimer();
      setLoading(false); setFailed(false); setAllFailed(false);
      audio.muted = false;
      audio.play().catch(() => { audio.muted = true; setMuted(true); audio.play().catch(() => {}); });
    };
    const fail = () => {
      if (resolved || !audio) return; resolved = true; clearTimer();
      setLoading(false); setPlaying(false);
      if (stage === "direct") setFailed(true); else setAllFailed(true);
    };
    audio.oncanplay = succeed;
    audio.onplaying = () => { succeed(); setPlaying(true); };
    audio.onpause   = () => setPlaying(false);
    audio.onerror   = fail;
    timerRef.current = setTimeout(() => {
      if (resolved) return;
      if (audio.buffered.length > 0 || !audio.paused) { succeed(); return; }
      fail();
    }, 12000);
  }
  useEffect(() => {
    loadStage("direct");
    return () => {
      clearTimer();
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      const a = audioRef.current;
      if (a) { a.pause(); a.src = ""; }
    };
  }, [station.stationuuid]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleMute = () => {
    const a = audioRef.current; if (!a) return;
    a.muted = !muted; setMuted(!muted);
  };
  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value); setVolume(v);
    if (audioRef.current) { audioRef.current.volume = v; audioRef.current.muted = v === 0; }
    setMuted(v === 0);
  };

  const statusLabel      = allFailed ? "OFFLINE" : loading ? "BUFFERING" : playing ? "ON AIR" : "STANDBY";
  const parsed           = meta?.track ? parseTrack(meta.track) : null;
  const displayBitrate   = meta?.bitrate    || (station.bitrate > 0 ? String(station.bitrate) : "");
  const displaySamplerate = meta?.samplerate || "";
  const displayChannels  = meta?.channels   || "";
  const displayCodec     = station.codec    || (meta?.contentType?.split("/")?.[1]?.toUpperCase() ?? "");
  const displayGenre     = meta?.genre      || tag;
  const displayDesc      = meta?.description || "";
  const serverSw         = meta?.serverSoftware || "";

  // ── Frequency ring (circular spectrum) ───────────────────────────────────
  const FreqRing = ({ size = 200 }: { size?: number }) => {
    const cx = size / 2, cy = size / 2;
    const baseR = size * 0.42;
    const maxSpike = size * 0.09;
    const points = ringBars.map((h, i) => {
      const angle = (i / RING_POINTS) * Math.PI * 2 - Math.PI / 2;
      const r = baseR + (playing && !muted ? h * maxSpike : maxSpike * 0.1);
      return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
    });
    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ") + " Z";
    return (
      <svg width={size} height={size} className="absolute inset-0 pointer-events-none"
        style={{ opacity: playing ? 0.7 : 0.18, transition: "opacity 0.6s" }}>
        <defs>
          <linearGradient id={`ring-grad-${hue}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"   stopColor={`hsl(${hue},90%,65%)`}  stopOpacity="0.9" />
            <stop offset="50%"  stopColor={`hsl(${hue2},80%,58%)`} stopOpacity="0.6" />
            <stop offset="100%" stopColor={`hsl(${hue3},70%,52%)`} stopOpacity="0.4" />
          </linearGradient>
          <filter id={`ring-blur-${hue}`}>
            <feGaussianBlur stdDeviation="1.2" />
          </filter>
        </defs>
        {/* Outer glow copy */}
        <path d={pathD} fill="none" stroke={`url(#ring-grad-${hue})`}
          strokeWidth="3.5" filter={`url(#ring-blur-${hue})`} opacity="0.5" />
        {/* Sharp line */}
        <path d={pathD} fill="none" stroke={`url(#ring-grad-${hue})`}
          strokeWidth="1.5" />
        {/* Inner fill */}
        <path d={pathD} fill={`hsl(${hue},90%,65%)`} opacity="0.04" />
      </svg>
    );
  };

  // ── VU Meter (vertical segments) ─────────────────────────────────────────
  const VuMeter = ({ value, side }: { value: number; side: "L" | "R" }) => {
    const SEGS = 12;
    return (
      <div className="flex flex-col-reverse gap-[2px]" style={{ height: 72 }}>
        {Array.from({ length: SEGS }).map((_, i) => {
          const threshold = i / SEGS;
          const active = playing && !muted && value > threshold;
          const isRed    = i >= 10;
          const isYellow = i >= 7 && i < 10;
          const color = isRed
            ? (active ? `hsl(0,90%,60%)` : `hsl(0,40%,18%)`)
            : isYellow
            ? (active ? `hsl(48,95%,58%)` : `hsl(48,30%,16%)`)
            : (active ? accent : `hsl(${hue},30%,18%)`);
          return (
            <div key={i} className="rounded-[1px] flex-1 transition-all duration-75"
              style={{
                background: color,
                boxShadow: active && i >= 7 ? `0 0 4px ${color}` : "none",
                opacity: active ? 1 : 0.35,
              }} />
          );
        })}
        <div className="rp-mono text-[7px] text-center mt-1" style={{ color: `${accent}45`, letterSpacing: "0.1em" }}>{side}</div>
      </div>
    );
  };

  // ── Disc ──────────────────────────────────────────────────────────────────
  const Disc = ({ size = 112 }: { size?: number }) => (
    <div className="rp-float relative flex items-center justify-center flex-shrink-0"
      style={{ width: size + 80, height: size + 80 }}>

      {/* Frequency ring behind everything */}
      <div className="absolute inset-0 flex items-center justify-center">
        <FreqRing size={size + 80} />
      </div>

      {playing && (
        <>
          <div className="absolute inset-0 rounded-full" style={{ background: `${accent}0e`, animation: "pulse-ring 2.2s cubic-bezier(0.2,0.6,0.4,1) infinite" }} />
          <div className="absolute inset-0 rounded-full" style={{ background: `${accent}07`, animation: "pulse-ring 2.2s cubic-bezier(0.2,0.6,0.4,1) infinite 0.7s" }} />
        </>
      )}

      {/* Outer dashed orbit */}
      <div className={cn("absolute rounded-full border border-dashed", playing ? "rp-spin" : "")}
        style={{ inset: -6, borderColor: `${accent}22`, opacity: playing ? 1 : 0.25, transition: "opacity 0.5s" }} />
      {/* Inner dotted orbit */}
      <div className={cn("absolute rounded-full border border-dotted", playing ? "rp-spin-rev" : "")}
        style={{ inset: 18, borderColor: `${accent2}28`, opacity: playing ? 0.7 : 0.12, transition: "opacity 0.5s" }} />

      {/* Groove rings (vinyl texture) */}
      {[32, 42, 52, 62].map((offset) => (
        <div key={offset} className="absolute rounded-full pointer-events-none"
          style={{
            inset: offset,
            border: `1px solid ${accent}08`,
            opacity: playing ? 0.6 : 0.2,
            transition: "opacity 0.8s",
          }} />
      ))}

      <div className="absolute rounded-full"
        style={{ inset: 14, background: `radial-gradient(circle at 38% 32%, ${accent}22, transparent 65%)`, filter: "blur(10px)" }} />

      {/* Main disc */}
      <div className="relative rounded-full flex items-center justify-center overflow-hidden flex-shrink-0"
        style={{
          width: size, height: size,
          background: `linear-gradient(145deg, hsl(${hue},30%,15%), hsl(${hue},20%,8%))`,
          border: `1.5px solid ${accent}32`,
          boxShadow: `0 0 0 6px hsl(${hue},25%,10%,0.8), 0 0 32px ${accent}22, inset 0 1px 0 ${accent}18`,
        }}>

        {/* Conic grooves overlay */}
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `conic-gradient(from 0deg, ${accent}04 0deg, transparent 3deg, ${accent}04 6deg, transparent 9deg)`,
            opacity: playing ? 1 : 0.4,
          }} />

        {/* Radial shine */}
        <div className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: `radial-gradient(circle at ${holoPos.x * 100}% ${holoPos.y * 100}%, hsl(${hue},100%,95%,0.12) 0%, transparent 60%)`,
            transition: "background 0.1s ease",
          }} />

        {station.favicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={station.favicon} alt={station.name}
            className="object-contain rounded-full relative z-10"
            style={{ width: size * 0.57, height: size * 0.57 }}
            onError={(e) => { const img = e.target as HTMLImageElement; img.style.display = "none"; const fb = img.nextSibling as HTMLElement; if (fb) fb.style.display = "flex"; }} />
        ) : null}
        <div className="flex-col items-center justify-center gap-1 relative z-10" style={{ display: station.favicon ? "none" : "flex" }}>
          <Radio style={{ width: size * 0.25, height: size * 0.25, color: `${accent}70` }} />
          <span className="rp-mono font-bold tracking-widest" style={{ fontSize: size * 0.12, color: accent }}>
            {station.name.slice(0, 2).toUpperCase()}
          </span>
        </div>

        {/* Center spindle dot */}
        <div className="absolute rounded-full pointer-events-none"
          style={{
            width: size * 0.07, height: size * 0.07,
            background: `radial-gradient(circle, hsl(${hue},60%,70%), hsl(${hue},40%,30%))`,
            boxShadow: `0 0 8px ${accent}60`,
            top: "50%", left: "50%",
            transform: "translate(-50%,-50%)",
          }} />
      </div>

      {/* ON AIR badge */}
      <div className={cn("rp-mono absolute -bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[9px] tracking-[0.22em] font-bold transition-all duration-500",
        playing ? "opacity-100 rp-badge-glow" : "opacity-0")}
        style={{ background: `linear-gradient(135deg, hsl(${hue},50%,10%), hsl(${hue},40%,8%))`, border: `1px solid ${accent}48`, color: accent, whiteSpace: "nowrap" }}>
        <span className="w-1.5 h-1.5 rounded-full rp-dot-blink" style={{ background: accent, boxShadow: `0 0 6px ${accent}` }} />
        ON AIR
      </div>
    </div>
  );

  // ── Now Playing ───────────────────────────────────────────────────────────
  // Mini spectrum bars for the now-playing badge (8 bars, driven by ringBars subset)
  const MiniSpectrum = ({ active }: { active: boolean }) => (
    <div className="flex items-end gap-[1.5px]" style={{ height: 14, width: 22 }}>
      {ringBars.slice(0, 8).map((h, i) => (
        <div key={i} style={{
          flex: 1,
          borderRadius: "1px 1px 0 0",
          height: active ? `${Math.max(20, h * 100)}%` : "20%",
          background: `linear-gradient(to top, ${accent}, ${accent2})`,
          opacity: active ? 0.9 : 0.25,
          transition: active ? "height 60ms ease" : "height 500ms ease",
        }} />
      ))}
    </div>
  );

  // Artist avatar — shows real photo if found, otherwise initials
  const ArtistAvatar = ({ artist }: { artist: string }) => {
    const initials = artist.split(" ").slice(0, 2).map(w => w[0] ?? "").join("").toUpperCase() || "♪";
    return (
      <div className="flex-shrink-0 flex items-center justify-center rounded-full rp-avatar overflow-hidden"
        style={{
          width: 44, height: 44,
          background: `linear-gradient(135deg, hsl(${hue},40%,18%), hsl(${hue2},35%,14%))`,
          border: `1.5px solid ${accent}35`,
          boxShadow: playing ? `0 0 0 3px ${accent}14, 0 0 16px ${accent}20` : "none",
          transition: "box-shadow 0.5s ease",
          color: accent,
          fontFamily: "'Space Mono', monospace",
          fontSize: initials.length > 2 ? 11 : 13,
          fontWeight: 700,
          letterSpacing: "0.05em",
        }}>
        {artistImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artistImageUrl}
            alt={artist}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top center" }}
            onError={() => setArtistImageUrl(null)}
          />
        ) : initials}
      </div>
    );
  };

  // ── Now Playing (memoized — only re-renders when track/meta/playing changes) ─
  const NowPlaying = useMemo(() => {
    const hasTrack = Boolean(meta?.track);

    return (
      <div className="w-full" style={{ minHeight: 72 }}>
        {hasTrack ? (
          <div className="w-full rp-track-card" style={{ position: "relative" }}>

            {/* ── Outer shell with layered borders ── */}
            <div style={{
              position: "relative",
              borderRadius: 16,
              background: `linear-gradient(160deg, hsl(${hue},22%,11%) 0%, hsl(${hue2},16%,8%) 100%)`,
              border: `1px solid ${accent}22`,
              overflow: "hidden",
            }}>

              {/* Top chromatic edge line */}
              <div style={{
                position: "absolute", top: 0, left: 0, right: 0, height: 1,
                background: `linear-gradient(90deg, transparent 0%, ${accent}90 30%, ${accent2}70 70%, transparent 100%)`,
              }} />

              {/* Subtle inner glow blob */}
              <div style={{
                position: "absolute", top: -20, right: -20, width: 100, height: 100,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${accent}18, transparent 70%)`,
                filter: "blur(18px)",
                pointerEvents: "none",
              }} />

              {/* ── TOP ROW: label + refresh ── */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "9px 12px 6px 12px",
                borderBottom: `1px solid ${accent}10`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  {/* Broadcast signal icon */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 2,
                    padding: "2px 7px 2px 5px",
                    borderRadius: 999,
                    background: playing ? `${accent}18` : "rgba(255,255,255,0.04)",
                    border: `1px solid ${playing ? accent + "35" : "rgba(255,255,255,0.08)"}`,
                    transition: "all 0.4s ease",
                  }}>
                    <MiniSpectrum active={playing && !muted} />
                    <span className="rp-lcd" style={{
                      fontSize: 9, letterSpacing: "0.2em", fontWeight: 700,
                      color: playing ? accent : "rgba(255,255,255,0.28)",
                      marginLeft: 4,
                      transition: "color 0.4s",
                    }}>
                      NOW PLAYING
                    </span>
                  </div>
                </div>
                <button
                  onClick={manualRefresh}
                  title="Refresh track info"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: 24, height: 24, borderRadius: "50%",
                    background: `${accent}0a`, border: `1px solid ${accent}18`,
                    color: `${accent}50`, cursor: "pointer",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${accent}20`; (e.currentTarget as HTMLButtonElement).style.color = accent; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${accent}0a`; (e.currentTarget as HTMLButtonElement).style.color = `${accent}50`; }}
                >
                  <RefreshCw className={cn("w-3 h-3", metaRefreshing && "animate-spin")} />
                </button>
              </div>

              {/* ── MAIN TRACK ROW ── */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px 12px 12px" }}>

                {/* Artist avatar */}
                <ArtistAvatar artist={parsed?.artist ?? station.name} />

                {/* Track info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Track title with marquee */}
                  <div ref={titleWrapRef} className={cn("rp-marquee-wrap w-full", titleOverflows && "rp-overflow")}
                    style={{ marginBottom: parsed?.artist ? 4 : 0 }}>
                    <div className="rp-marquee-inner">
                      <span style={{
                        fontSize: 15, fontWeight: 800, color: "white", letterSpacing: "-0.01em",
                        fontFamily: "'Syne', sans-serif",
                        textShadow: playing ? `0 0 20px ${accent}40` : "none",
                        transition: "text-shadow 0.5s",
                      }}>
                        {parsed?.title}
                      </span>
                      <span style={{
                        fontSize: 15, fontWeight: 800, color: "white", letterSpacing: "-0.01em",
                        fontFamily: "'Syne', sans-serif",
                      }}>
                        {parsed?.title}
                      </span>
                    </div>
                  </div>

                  {/* Artist name */}
                  {parsed?.artist && (
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <Mic2 style={{ width: 10, height: 10, flexShrink: 0, color: `${accent}60` }} />
                      <span style={{
                        fontSize: 11, color: `${accent}90`, letterSpacing: "0.04em",
                        fontFamily: "'Space Mono', monospace",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {parsed.artist}
                      </span>
                    </div>
                  )}
                </div>

                {/* Live pulse indicator on the right */}
                {playing && (
                  <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <div style={{
                      width: 3, height: 3, borderRadius: "50%",
                      background: accent,
                      boxShadow: `0 0 6px ${accent}`,
                      animation: "dot-blink 1.2s ease-in-out infinite",
                    }} />
                    <div style={{
                      width: 3, height: 3, borderRadius: "50%",
                      background: accent2,
                      boxShadow: `0 0 6px ${accent2}`,
                      animation: "dot-blink 1.2s ease-in-out infinite 0.4s",
                    }} />
                    <div style={{
                      width: 3, height: 3, borderRadius: "50%",
                      background: accent3,
                      boxShadow: `0 0 6px ${accent3}`,
                      animation: "dot-blink 1.2s ease-in-out infinite 0.8s",
                    }} />
                  </div>
                )}
              </div>

              {/* ── TICKER TAPE BOTTOM STRIP ── */}
              {parsed?.artist && (
                <div style={{
                  borderTop: `1px solid ${accent}12`,
                  padding: "5px 0",
                  overflow: "hidden",
                  background: `${accent}06`,
                }}>
                  <div className="rp-ticker-inner">
                    {[0, 1, 2, 3].map((k) => (
                      <span key={k} className="rp-lcd" style={{
                        fontSize: 8, letterSpacing: "0.25em", whiteSpace: "nowrap",
                        color: `${accent}45`, paddingRight: "3rem",
                      }}>
                        {parsed.artist?.toUpperCase()} · {parsed.title.toUpperCase()} ·
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

        ) : (
          /* ── EMPTY / LOADING STATE ── */
          <div style={{
            width: "100%", borderRadius: 16, overflow: "hidden",
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            {/* Skeleton top row */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "9px 12px 6px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 2,
                  padding: "2px 7px 2px 5px",
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <MiniSpectrum active={false} />
                  <span className="rp-lcd" style={{
                    fontSize: 9, letterSpacing: "0.2em", fontWeight: 700,
                    color: "rgba(255,255,255,0.2)", marginLeft: 4,
                  }}>
                    NOW PLAYING
                  </span>
                </div>
              </div>
              <button
                onClick={manualRefresh}
                title="Refresh track info"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 24, height: 24, borderRadius: "50%",
                  background: "transparent", border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.2)", cursor: "pointer",
                  transition: "all 0.2s",
                }}>
                <RefreshCw className={cn("w-3 h-3", metaRefreshing && "animate-spin")} />
              </button>
            </div>

            {/* Skeleton body */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px 12px 12px" }}>
              {/* Ghost avatar */}
              <div style={{
                width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                background: "rgba(255,255,255,0.04)",
                border: "1.5px solid rgba(255,255,255,0.07)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Music2 style={{ width: 16, height: 16, opacity: 0.15, color: "white" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Skeleton bars */}
                {loading ? (
                  <>
                    <div style={{
                      height: 14, borderRadius: 4, marginBottom: 8,
                      background: `linear-gradient(90deg, ${accent}15, ${accent2}10, ${accent}15)`,
                      backgroundSize: "200% 100%",
                      animation: "shimmer-skeleton 1.8s ease-in-out infinite",
                      width: "75%",
                    }} />
                    <div style={{
                      height: 10, borderRadius: 4,
                      background: `linear-gradient(90deg, ${accent}08, ${accent2}06, ${accent}08)`,
                      backgroundSize: "200% 100%",
                      animation: "shimmer-skeleton 1.8s ease-in-out infinite 0.3s",
                      width: "45%",
                    }} />
                  </>
                ) : (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.18)", fontFamily: "'Space Mono', monospace" }}>
                    {playing ? "Fetching track info…" : "—"}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, parsed, playing, muted, loading, metaRefreshing, titleOverflows, artistImageUrl, accent, accent2, accent3, hue, hue2, hue3, station.name]);

  // ── Beat Bars ─────────────────────────────────────────────────────────────
  const BeatBars = ({ count = 40, height = 52 }: { count?: number; height?: number }) => {
    const active = playing && !muted;
    // Sample evenly from bars array
    const step = bars.length / count;
    const samples = Array.from({ length: count }, (_, i) => bars[Math.floor(i * step)]);
    const halfH = height / 2;

    return (
      <div className="w-full px-1" style={{ height, position: "relative" }}>
        <div className="w-full h-full flex items-center justify-center gap-[2.5px]">
          {samples.map((v, i) => {
            // Shape: taller in the center
            const center = 1 - Math.abs(i - count / 2) / (count / 2) * 0.3;
            const barH = active
              ? Math.max(3, v * halfH * 0.92 * center)
              : 2 + Math.sin(i * 0.55) * 1.5;

            // Color shifts from accent → accent2 → accent3 across width
            const t = i / (count - 1);
            const barHue = hue + t * 110;
            const isHot = v > 0.72 && active;

            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, flex: 1, maxWidth: 7 }}>
                {/* Top half */}
                <div style={{
                  width: "100%",
                  height: barH,
                  borderRadius: "3px 3px 1px 1px",
                  background: `linear-gradient(to top, hsl(${barHue},88%,62%), hsl(${barHue + 20},80%,72%))`,
                  opacity: active ? 0.88 + v * 0.12 : 0.18,
                  boxShadow: isHot ? `0 0 8px hsl(${barHue},90%,65%), 0 0 2px hsl(${barHue},90%,80%)` : "none",
                  transition: active ? "height 45ms cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.3s" : "height 500ms ease, opacity 0.5s",
                }} />
                {/* Bottom mirror */}
                <div style={{
                  width: "100%",
                  height: barH * 0.45,
                  borderRadius: "1px 1px 3px 3px",
                  background: `linear-gradient(to bottom, hsl(${barHue},88%,62%), transparent)`,
                  opacity: active ? 0.22 : 0.06,
                  transition: active ? "height 45ms cubic-bezier(0.25,0.46,0.45,0.94)" : "height 500ms ease",
                }} />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ── Waveform + VU ─────────────────────────────────────────────────────────
  const Waveform = ({ barCount = BAR_COUNT, height = 60 }: { barCount?: number; height?: number }) => (
    <div className="w-full flex items-stretch gap-2">
      {/* Left VU */}
      <div className="hidden sm:flex items-end pb-4" style={{ width: 10 }}>
        <VuMeter value={vuLeft} side="L" />
      </div>

      {/* Bars */}
      <div className="flex-1">
        <div className="w-full flex items-end justify-center gap-[2px] px-1" style={{ height }}>
          {bars.slice(0, barCount).map((h, i) => {
            const center  = Math.abs(i - barCount / 2) / (barCount / 2);
            const shapedH = h * (1 - center * 0.22);
            const barH    = loading ? `${14 + Math.sin(i * 0.4 + tick * 0.2) * 8}%` : playing ? `${Math.max(6, shapedH * 100)}%` : "5%";
            return (
              <div key={i} className="rp-bar" style={{
                height: barH,
                background: loading ? `hsl(${hue},40%,28%)` : `linear-gradient(to top, ${accent}cc, ${accent2}aa, ${accent3}88)`,
                opacity: muted ? 0.1 : loading ? 0.28 : playing ? 0.82 + shapedH * 0.18 : 0.12,
                boxShadow: playing && !muted && shapedH > 0.55 ? `0 0 7px ${accent}48` : "none",
                transition: playing ? "height 50ms cubic-bezier(0.25,0.46,0.45,0.94)" : "height 600ms ease",
              }} />
            );
          })}
        </div>
        {/* Reflection */}
        <div className="w-full flex items-start justify-center gap-[2px] px-1 mt-[2px]" style={{ height: Math.round(height * 0.27) }}>
          {bars.slice(0, barCount).map((h, i) => {
            const center  = Math.abs(i - barCount / 2) / (barCount / 2);
            const shapedH = h * (1 - center * 0.22);
            return (
              <div key={i} className="rp-bar" style={{
                height: loading ? "28%" : playing ? `${Math.max(4, shapedH * 38)}%` : "7%",
                background: `linear-gradient(to bottom, ${accent}28, transparent)`,
                opacity: muted ? 0.04 : loading ? 0.08 : playing ? 0.22 : 0.04,
                transition: playing ? "height 50ms cubic-bezier(0.25,0.46,0.45,0.94)" : "height 600ms ease",
              }} />
            );
          })}
        </div>
      </div>

      {/* Right VU */}
      <div className="hidden sm:flex items-end pb-4" style={{ width: 10 }}>
        <VuMeter value={vuRight} side="R" />
      </div>
    </div>
  );

  // ── Status Strip ──────────────────────────────────────────────────────────
  const StatusStrip = () => (
    <div className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.055)" }}>
      <div className="flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5">
          {playing && <span className="animate-ping absolute inline-flex h-full w-full rounded-full" style={{ background: accent, opacity: 0.45 }} />}
          <span className="relative inline-flex rounded-full h-2.5 w-2.5"
            style={{ background: allFailed ? "#f87171" : loading ? `${accent}50` : playing ? accent : `${accent}30`, boxShadow: playing ? `0 0 8px ${accent}` : "none", transition: "background 0.4s, box-shadow 0.4s" }} />
        </span>
        {/* LCD-style status label */}
        <span className="rp-lcd text-[10px] tracking-[0.22em] font-bold"
          style={{ color: allFailed ? "#f87171" : loading ? `${accent}65` : playing ? accent : `${accent}40` }}>
          {statusLabel}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {displayBitrate && (
          <span className="rp-lcd text-[9px] tracking-widest px-2 py-0.5 rounded"
            style={{ color: `${accent}70`, background: `${accent}08`, border: `1px solid ${accent}15` }}>
            {displayCodec && `${displayCodec}·`}{displayBitrate}k
          </span>
        )}
        {serverSw && (
          <span className="rp-mono text-[8px] tracking-widest px-2 py-0.5 rounded-full"
            style={{ color: `${accent}40`, background: `${accent}07`, border: `1px solid ${accent}12` }}>
            {serverSw.split(" ")[0]}
          </span>
        )}
        {stageRef.current === "proxy" && !allFailed && (
          <span className="rp-mono text-[9px] tracking-widest px-2 py-0.5 rounded-full"
            style={{ color: `${accent}50`, background: `${accent}08`, border: `1px solid ${accent}15` }}>
            VIA PROXY
          </span>
        )}
        {loading && <span className="rp-mono text-[9px] animate-pulse tracking-widest" style={{ color: `${accent}50` }}>TUNING IN…</span>}
      </div>
    </div>
  );

  // ── Volume Control ────────────────────────────────────────────────────────
  const VolumeControl = () => (
    <div className="w-full flex items-center gap-3.5 px-1">
      <button onClick={toggleMute} className="flex-shrink-0 transition-all duration-200 hover:scale-110" style={{ color: muted ? `${accent}28` : accent }}>
        {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
      </button>
      <div className="relative flex-1 flex items-center" style={{ height: 20 }}>
        <div className="absolute left-0 right-0 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)" }} />
        {/* Tick marks */}
        {[25, 50, 75].map((pct) => (
          <div key={pct} className="absolute h-2 w-px pointer-events-none"
            style={{ left: `${pct}%`, background: `${accent}18`, top: "50%", transform: "translateY(-50%)" }} />
        ))}
        <div className="absolute left-0 h-1.5 rounded-full transition-all duration-100"
          style={{ width: `${muted ? 0 : volume * 100}%`, background: `linear-gradient(to right, ${accent}, ${accent2})`, boxShadow: `0 0 8px ${accent}48` }} />
        <div className="absolute h-3.5 w-3.5 rounded-full -translate-x-1/2 pointer-events-none transition-all duration-100"
          style={{ left: `${muted ? 0 : volume * 100}%`, background: "white", boxShadow: `0 0 0 2px ${accent}55, 0 2px 6px rgba(0,0,0,0.5)` }} />
        <input type="range" min="0" max="1" step="0.02" value={muted ? 0 : volume} onChange={handleVolume} className="rp-vol-track" />
      </div>
      <span className="rp-lcd text-[10px] w-8 text-right font-bold" style={{ color: `${accent}60` }}>
        {muted ? "---" : `${Math.round(volume * 100)}`}
      </span>
    </div>
  );

  // ── Errors ────────────────────────────────────────────────────────────────
  const Errors = () => (
    <>
      {failed && !allFailed && (
        <div className="w-full rounded-2xl px-5 py-4 flex flex-col items-center gap-3 text-center"
          style={{ background: `${accent}07`, border: `1px solid ${accent}18` }}>
          <WifiOff className="w-5 h-5" style={{ color: accent }} />
          <p className="text-sm" style={{ color: `${accent}aa` }}>Direct stream failed — try via proxy?</p>
          <div className="flex gap-3">
            <button onClick={() => loadStage("direct")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full rp-mono text-[11px] font-bold transition-all hover:opacity-75"
              style={{ border: `1px solid ${accent}35`, color: accent, background: `${accent}0d` }}>
              <RefreshCw className="w-3 h-3" /> Retry
            </button>
            <button onClick={() => loadStage("proxy")}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full rp-mono text-[11px] font-bold transition-all hover:opacity-80"
              style={{ background: accent, color: "#000" }}>
              <Wifi className="w-3 h-3" /> Try Proxy
            </button>
          </div>
        </div>
      )}
      {allFailed && (
        <div className="w-full rounded-2xl px-5 py-4 flex flex-col items-center gap-3 text-center"
          style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.18)" }}>
          <WifiOff className="w-5 h-5 text-red-400" />
          <p className="text-sm text-red-400/75">Station currently unavailable.</p>
          <button onClick={() => loadStage("direct")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full rp-mono text-[11px] font-bold text-red-400 transition-all hover:opacity-75"
            style={{ border: "1px solid rgba(248,113,113,0.28)", background: "rgba(248,113,113,0.08)" }}>
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}
    </>
  );

  // ── Station Info ──────────────────────────────────────────────────────────
  const StationInfo = ({ align = "center" }: { align?: "center" | "left" }) => (
    <div className={align === "left" ? "text-left w-full" : "text-center w-full"}>
      <h2 className={cn(
        "text-2xl lg:text-3xl 2xl:text-4xl font-extrabold text-white tracking-tight leading-none",
        glitching && "rp-glitch"
      )}
        data-text={station.name}
        style={{ letterSpacing: "-0.01em" }}>
        {station.name}
      </h2>
      {displayDesc && (
        <p className="rp-mono text-[10px] lg:text-[11px] mt-1.5 leading-relaxed" style={{ color: `${accent}55` }}>
          {displayDesc}
        </p>
      )}
      <div className={cn("flex items-center gap-2 mt-3 flex-wrap", align === "left" ? "" : "justify-center")}>
        {flag && <span className="text-xl">{flag}</span>}
        <span className="rp-pill rp-mono" style={{ color: accent, background: `${accent}12`, border: `1px solid ${accent}28` }}>
          {displayGenre}
        </span>
        {displayBitrate && (
          <span className="rp-pill rp-mono" style={{ color: `${accent2}bb`, background: `${accent2}0d`, border: `1px solid ${accent2}20` }}>
            <Signal className="w-2.5 h-2.5" />
            {displayCodec && `${displayCodec} · `}{displayBitrate}k
          </span>
        )}
        {displaySamplerate && (
          <span className="rp-pill rp-mono" style={{ color: `${accent3}99`, background: `${accent3}0a`, border: `1px solid ${accent3}18` }}>
            {displaySamplerate}Hz{displayChannels === "2" ? " · stereo" : displayChannels === "1" ? " · mono" : ""}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&family=Share+Tech+Mono&display=swap');

        /* ── Keyframes ─────────────────────────────────────────────── */
        @keyframes spin-slow  { to { transform: rotate(360deg);  } }
        @keyframes spin-rev   { to { transform: rotate(-360deg); } }
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity: 0.18; }
          70%  { transform: scale(1.6); opacity: 0; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes float {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-7px); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes slide-up {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: scale(0.97); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes badge-glow {
          0%,100% { box-shadow: 0 0 8px var(--ac), 0 0 20px var(--ac-dim); }
          50%      { box-shadow: 0 0 18px var(--ac), 0 0 44px var(--ac-dim); }
        }
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes dot-blink {
          0%,100% { opacity: 1; } 50% { opacity: 0.2; }
        }
        /* CRT scanline drift */
        @keyframes scanline-drift {
          0%   { transform: translateY(-100%); }
          100% { transform: translateY(100vh); }
        }
        /* Glitch frames */
        @keyframes glitch-1 {
          0%,100% { clip-path: inset(0 0 100% 0); transform: translate(0); }
          20%     { clip-path: inset(20% 0 50% 0); transform: translate(-3px, 1px); color: hsl(${hue2},100%,70%); }
          40%     { clip-path: inset(60% 0 20% 0); transform: translate(3px, -1px); color: hsl(${hue3},100%,70%); }
          60%     { clip-path: inset(10% 0 80% 0); transform: translate(-2px, 2px); }
          80%     { clip-path: inset(75% 0 5% 0);  transform: translate(2px, -2px); }
        }
        @keyframes glitch-2 {
          0%,100% { clip-path: inset(100% 0 0 0); transform: translate(0); }
          25%     { clip-path: inset(40% 0 30% 0); transform: translate(3px, 0); color: hsl(${hue},100%,80%); }
          50%     { clip-path: inset(70% 0 10% 0); transform: translate(-3px, 1px); }
          75%     { clip-path: inset(5% 0 70% 0);  transform: translate(2px, -1px); }
        }
        /* Neon flicker for ON AIR */
        @keyframes neon-flicker {
          0%,19%,21%,23%,25%,54%,56%,100% { opacity: 1; }
          20%,22%,24%,55% { opacity: 0.4; }
        }
        /* Track card hover lift */
        @keyframes track-appear {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        /* Icon pulse */
        @keyframes icon-pulse {
          0%,100% { transform: scale(1); }
          50%      { transform: scale(1.15); }
        }
        /* Holo shimmer */
        @keyframes holo-shift {
          0%   { background-position: 0% 50%;   }
          50%  { background-position: 100% 50%;  }
          100% { background-position: 0% 50%;   }
        }
        /* Tuner sweep for loading */
        @keyframes tuner-sweep {
          0%   { left: 0%;   }
          100% { left: 100%; }
        }

        /* ── Base ─────────────────────────────────────────────────── */
        .rp-root { font-family: 'Syne', sans-serif; }
        .rp-mono { font-family: 'Space Mono', monospace; }
        .rp-lcd  { font-family: 'Share Tech Mono', monospace; }

        .rp-card-mobile { animation: slide-up 0.42s cubic-bezier(0.16,1,0.3,1) both; }
        .rp-card-center { animation: fade-in 0.38s cubic-bezier(0.16,1,0.3,1) both; }

        .rp-spin     { animation: spin-slow 12s linear infinite; }
        .rp-spin-rev { animation: spin-rev  18s linear infinite; }
        .rp-float    { animation: float 4s ease-in-out infinite; }
        .rp-badge-glow { animation: neon-flicker 4s step-end infinite, badge-glow 2s ease-in-out infinite; }

        .rp-bar {
          border-radius: 3px 3px 0 0;
          flex: 1; min-width: 2px; max-width: 6px;
          transform-origin: bottom;
        }
        .rp-vol-track {
          -webkit-appearance: none; appearance: none;
          background: transparent; cursor: pointer;
          width: 100%; height: 100%;
          position: absolute; inset: 0; opacity: 0; z-index: 2;
        }

        /* CRT scanline overlay */
        .rp-scanlines {
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(0,0,0,0.06) 2px,
            rgba(0,0,0,0.06) 4px
          );
          pointer-events: none;
        }
        /* Moving scanline beam */
        .rp-scanbeam {
          position: absolute;
          left: 0; right: 0;
          height: 60px;
          background: linear-gradient(to bottom,
            transparent 0%,
            rgba(255,255,255,0.015) 40%,
            rgba(255,255,255,0.025) 50%,
            rgba(255,255,255,0.015) 60%,
            transparent 100%
          );
          animation: scanline-drift 8s linear infinite;
          pointer-events: none;
        }

        /* Noise texture */
        .rp-noise {
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
          opacity: 0.025;
          pointer-events: none;
        }

        /* Grid lines */
        .rp-grid {
          background-image:
            linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
          background-size: 28px 28px;
        }

        /* Shimmer sweep */
        .rp-shimmer {
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.07) 50%, transparent 60%);
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }

        /* Holographic card sheen */
        .rp-holo {
          background: linear-gradient(
            125deg,
            hsl(${hue},80%,60%,0.06) 0%,
            hsl(${hue2},80%,60%,0.04) 25%,
            hsl(${hue3},80%,60%,0.06) 50%,
            hsl(${hue},80%,60%,0.04) 75%,
            hsl(${hue2},80%,60%,0.06) 100%
          );
          background-size: 400% 400%;
          animation: holo-shift 6s ease infinite;
          pointer-events: none;
          mix-blend-mode: screen;
        }

        /* Glitch text */
        .rp-glitch {
          position: relative;
          animation: none;
        }
        .rp-glitch::before,
        .rp-glitch::after {
          content: attr(data-text);
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .rp-glitch::before {
          animation: glitch-1 0.9s steps(1) both;
          color: hsl(${hue2},100%,70%);
          text-shadow: -2px 0 hsl(${hue3},100%,65%);
        }
        .rp-glitch::after {
          animation: glitch-2 0.9s steps(1) both;
          color: hsl(${hue3},100%,65%);
          text-shadow: 2px 0 hsl(${hue2},100%,70%);
        }

        /* Track card */
        .rp-track-card {
          animation: track-appear 0.35s ease both;
        }

        /* Ticker tape */
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .rp-ticker-inner {
          display: flex;
          width: max-content;
          animation: ticker 28s linear infinite;
        }

        /* Skeleton shimmer */
        @keyframes shimmer-skeleton {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }

        /* Avatar */
        .rp-avatar { transition: box-shadow 0.5s ease; }

        /* Icon pulse when playing */
        .rp-icon-pulse {
          animation: icon-pulse 2s ease-in-out infinite;
        }

        /* Dot blink */
        .rp-dot-blink { animation: dot-blink 1.2s ease-in-out infinite; }

        /* Tuner loading bar */
        .rp-tuner {
          position: relative;
          overflow: hidden;
          height: 2px;
          background: rgba(255,255,255,0.06);
          border-radius: 1px;
        }
        .rp-tuner-needle {
          position: absolute;
          top: 0; bottom: 0;
          width: 40px;
          background: linear-gradient(to right, transparent, ${accent}cc, transparent);
          animation: tuner-sweep 1.4s ease-in-out infinite alternate;
        }

        /* Marquee */
        .rp-marquee-wrap {
          overflow: hidden;
          mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
          -webkit-mask-image: linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%);
        }
        .rp-marquee-inner { display: flex; width: max-content; animation: marquee 22s linear infinite; }
        .rp-marquee-inner span { padding-right: 4rem; }
        .rp-marquee-wrap:not(.rp-overflow) .rp-marquee-inner { animation: none; }
        .rp-marquee-wrap:not(.rp-overflow) .rp-marquee-inner span:last-child { display: none; }

        /* Pills */
        .rp-pill {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 10px; border-radius: 999px;
          font-size: 9px; letter-spacing: 0.18em; font-weight: 700;
          white-space: nowrap;
        }

        /* Mobile drag handle */
        .rp-handle {
          width: 40px; height: 4px; border-radius: 2px;
          background: rgba(255,255,255,0.15);
          margin: 0 auto 20px;
        }

        /* Desktop divider */
        .rp-divider {
          width: 1px; align-self: stretch; flex-shrink: 0;
          background: linear-gradient(to bottom, transparent, rgba(255,255,255,0.07) 20%, rgba(255,255,255,0.07) 80%, transparent);
        }

        /* Corner brackets decoration */
        .rp-corner {
          position: absolute;
          width: 16px; height: 16px;
          pointer-events: none;
          opacity: 0.35;
        }
        .rp-corner-tl { top: 14px; left: 14px; border-top: 1.5px solid; border-left: 1.5px solid; border-radius: 3px 0 0 0; }
        .rp-corner-tr { top: 14px; right: 14px; border-top: 1.5px solid; border-right: 1.5px solid; border-radius: 0 3px 0 0; }
        .rp-corner-bl { bottom: 14px; left: 14px; border-bottom: 1.5px solid; border-left: 1.5px solid; border-radius: 0 0 0 3px; }
        .rp-corner-br { bottom: 14px; right: 14px; border-bottom: 1.5px solid; border-right: 1.5px solid; border-radius: 0 0 3px 0; }
      `}</style>

      {/* ── Backdrop ── */}
      <div
        className="rp-root fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 lg:p-8"
        style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(28px) saturate(1.6)" }}
      >
        <div
          ref={cardRef}
          className={cn(
            "relative w-full overflow-hidden",
            "rounded-t-[2rem]",
            "sm:max-w-[480px] sm:rounded-[2.2rem]",
            "lg:max-w-[840px] lg:rounded-[2.4rem]",
            "2xl:max-w-[1020px] 2xl:rounded-[2.8rem]",
            "rp-card-mobile sm:rp-card-center",
          )}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            ["--ac" as string]: accent,
            ["--ac2" as string]: accent2,
            ["--ac-dim" as string]: `hsl(${hue},90%,65%,0.22)`,
            background: `linear-gradient(165deg,
              hsl(${hue},28%,9%) 0%,
              hsl(${hue2},20%,6%) 55%,
              hsl(${hue3},16%,4%) 100%)`,
            boxShadow: `
              0 0 0 1px hsl(${hue},38%,22%,0.45),
              0 48px 96px -24px hsl(${hue},60%,10%,0.85),
              0 0 120px hsl(${hue},60%,40%,0.08)
            `,
          }}
        >
          <audio ref={audioRef} preload="none" />

          {/* ── Layered background decorations ── */}
          {/* Grid */}
          <div className="absolute inset-0 rp-grid pointer-events-none" />
          {/* Noise grain */}
          <div className="absolute inset-0 rp-noise" />
          {/* CRT scanlines */}
          <div className="absolute inset-0 rp-scanlines" />
          {/* Moving scanbeam */}
          <div className="rp-scanbeam" />
          {/* Holo sheen */}
          <div className="absolute inset-0 rp-holo" />
          {/* Radial glows */}
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, hsl(${hue},80%,50%,0.15), transparent 70%)`, filter: "blur(52px)" }} />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, hsl(${hue2},70%,45%,0.11), transparent 70%)`, filter: "blur(52px)" }} />
          {/* Mouse-tracked spotlight */}
          <div className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{
              background: `radial-gradient(circle at ${holoPos.x * 100}% ${holoPos.y * 100}%, hsl(${hue},80%,60%,0.07) 0%, transparent 55%)`,
              opacity: isHovered ? 1 : 0,
            }} />
          {/* Shimmer sweep */}
          <div className="absolute inset-0 rp-shimmer pointer-events-none" />
          {/* Top/bottom edge lines */}
          <div className="absolute top-0 left-0 right-0 h-px pointer-events-none"
            style={{ background: `linear-gradient(90deg, transparent, ${accent}65, ${accent2}65, transparent)` }} />
          <div className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
            style={{ background: `linear-gradient(90deg, transparent, ${accent}28, transparent)` }} />

          {/* Corner brackets */}
          <div className="rp-corner rp-corner-tl" style={{ borderColor: accent }} />
          <div className="rp-corner rp-corner-tr" style={{ borderColor: accent }} />
          <div className="rp-corner rp-corner-bl" style={{ borderColor: accent2 }} />
          <div className="rp-corner rp-corner-br" style={{ borderColor: accent2 }} />

          {/* Tuner loading bar at very top */}
          {loading && (
            <div className="absolute top-0 left-0 right-0 z-20 rp-tuner">
              <div className="rp-tuner-needle" />
            </div>
          )}

          {/* Close button */}
          <button onClick={onClose}
            className="absolute top-5 right-5 z-20 p-2 rounded-full transition-all duration-200"
            style={{ background: `${accent}10`, border: `1px solid ${accent}20`, color: `${accent}70` }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${accent}22`; (e.currentTarget as HTMLButtonElement).style.color = accent; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = `${accent}10`; (e.currentTarget as HTMLButtonElement).style.color = `${accent}70`; }}
          >
            <X className="w-4 h-4 lg:w-5 lg:h-5" />
          </button>

          {/* ════ MOBILE + TABLET ════ */}
          <div className="lg:hidden relative z-10 px-6 sm:px-8 pt-6 pb-7 flex flex-col items-center gap-5">
            <div className="rp-handle sm:hidden" />
            <Disc size={100} />
            <div className="mt-4 w-full">
              <StationInfo align="center" />
            </div>
            {NowPlaying}
            <BeatBars count={36} height={48} />
            <Waveform barCount={40} height={52} />
            <StatusStrip />
            <Errors />
            <VolumeControl />
          </div>

          {/* ════ DESKTOP (lg+) ════ */}
          <div className="hidden lg:flex relative z-10 gap-0">
            {/* Left column */}
            <div className="flex flex-col items-center justify-center gap-6 px-10 2xl:px-14 py-10 2xl:py-14"
              style={{ flex: "0 0 auto", width: "clamp(300px, 42%, 420px)" }}>
              <Disc size={140} />
              <div className="mt-5 w-full">
                <StationInfo align="center" />
              </div>
            </div>

            {/* Divider */}
            <div className="rp-divider" />

            {/* Right column */}
            <div className="flex flex-col justify-center gap-5 px-8 2xl:px-12 py-10 2xl:py-14 flex-1 min-w-0">
              {NowPlaying}
              <BeatBars count={48} height={56} />
              <Waveform barCount={BAR_COUNT} height={72} />
              <StatusStrip />
              <Errors />
              <VolumeControl />
            </div>
          </div>

        </div>
      </div>
    </>
  );
}