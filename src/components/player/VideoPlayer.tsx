"use client";

import { useEffect, useRef, useState } from "react";
import {
  X, Loader2, AlertTriangle, Volume2, VolumeX, Volume1,
  Maximize2, Minimize2, RefreshCw, Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  url:     string;
  title:   string;
  logo?:   string | null;
  onClose: () => void;
}

const SOURCES = (url: string) => [
  { label: "Direct",       streamUrl: url },
  { label: "Proxy",        streamUrl: `/api/stream-proxy?url=${encodeURIComponent(url)}` },
];

export default function VideoPlayer({ url, title, logo, onClose }: VideoPlayerProps) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const hlsRef        = useRef<import("hls.js").default | null>(null);
  const containerRef  = useRef<HTMLDivElement>(null);

  const [sourceIdx,   setSourceIdx]   = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [failed,      setFailed]      = useState(false);
  const [allFailed,   setAllFailed]   = useState(false);
  const [volume,      setVolume]      = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [volOpen,     setVolOpen]     = useState(false);
  const hideTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const muted = volume === 0;

  const sources = SOURCES(url);

  // ── Auto-hide controls after 3s of no mouse movement ─────────────────────
  function showControls() {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
  }

  useEffect(() => {
    showControls();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fullscreen change listener ────────────────────────────────────────────
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // ── HLS loading ───────────────────────────────────────────────────────────
  function destroyHls() {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
  }
  function resetVideo() {
    destroyHls();
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.removeAttribute("src");
    try { v.load(); } catch { /* ignore */ }
  }

  async function loadSource(idx: number) {
    const v = videoRef.current;
    if (!v) return;
    resetVideo();
    setLoading(true); setFailed(false); setAllFailed(false);

    const { streamUrl } = sources[idx];
    const Hls = (await import("hls.js")).default;

    if (!Hls.isSupported()) {
      v.src = streamUrl; v.load();
      v.oncanplay = () => {
        setLoading(false);
        v.volume = volume;
        v.muted  = volume === 0;
        v.play().catch(() => { v.volume = 0; setVolume(0); v.play().catch(() => {}); });
      };
      v.onerror = () => { setLoading(false); setFailed(true); };
      return;
    }

    const hls = new Hls({
      enableWorker: true, lowLatencyMode: true,
      manifestLoadingTimeOut: 10000, manifestLoadingMaxRetry: 1,
      levelLoadingTimeOut: 10000,    levelLoadingMaxRetry: 1,
      fragLoadingTimeOut: 15000,     fragLoadingMaxRetry: 3,
      startLevel: -1,
    });
    hlsRef.current = hls;
    hls.attachMedia(v);
    hls.loadSource(streamUrl);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setLoading(false);
      v.volume = volume;
      v.muted  = volume === 0;
      v.play().catch(() => { v.volume = 0; setVolume(0); v.play().catch(() => {}); });
    });
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      destroyHls(); setLoading(false);
      if (idx >= sources.length - 1) setAllFailed(true);
      else setFailed(true);
    });
  }

  useEffect(() => {
    setSourceIdx(0); loadSource(0);
    return resetVideo;
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  const tryNext = () => { const n = sourceIdx + 1; setSourceIdx(n); loadSource(n); };
  const retry   = () => loadSource(sourceIdx);

  const handleVolume = (v: number) => {
    setVolume(v);
    const vid = videoRef.current; if (!vid) return;
    vid.volume = v;
    vid.muted  = v === 0;
  };
  const toggleMute = () => handleVolume(muted ? 1 : 0);

  // Auto-close volume slider after 2s of no interaction
  const openVol = () => {
    setVolOpen(true);
    if (volTimer.current) clearTimeout(volTimer.current);
    volTimer.current = setTimeout(() => setVolOpen(false), 2500);
  };
  const toggleFullscreen = () => {
    const el = containerRef.current; if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
    else document.exitFullscreen().catch(() => {});
  };

  const hasNext    = sourceIdx < sources.length - 1;
  const statusText = allFailed ? "UNAVAILABLE" : loading ? "BUFFERING" : failed ? "SOURCE FAILED" : "LIVE";
  const statusColor = allFailed || failed ? "text-yellow-400" : loading ? "text-white/40" : "text-emerald-400";

  return (
    <>
      <style>{`
        @keyframes vp-fade-in {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes vp-slide-up {
          from { opacity: 0; transform: translateY(100%); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .vp-modal  { animation: vp-fade-in  0.3s cubic-bezier(0.16,1,0.3,1) both; }
        .vp-mobile { animation: vp-slide-up 0.35s cubic-bezier(0.16,1,0.3,1) both; }

        .vp-controls-fade {
          transition: opacity 0.35s ease;
        }
        .vp-controls-hidden {
          opacity: 0;
          pointer-events: none;
        }

        /* Gradient overlays for controls readability */
        .vp-top-gradient {
          background: linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%);
        }
        .vp-bottom-gradient {
          background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%);
        }

        /* Volume slider */
        .vp-vol-wrap {
          display: flex; align-items: center; gap: 6px;
          position: relative;
        }
        .vp-vol-slider-track {
          overflow: hidden;
          width: 0; opacity: 0;
          transition: width 0.25s ease, opacity 0.25s ease;
          display: flex; align-items: center;
        }
        .vp-vol-wrap:hover .vp-vol-slider-track,
        .vp-vol-open .vp-vol-slider-track {
          width: 80px; opacity: 1;
        }
        @media (min-width: 1024px) {
          .vp-vol-wrap:hover .vp-vol-slider-track,
          .vp-vol-open .vp-vol-slider-track { width: 96px; }
        }
        @media (min-width: 1536px) {
          .vp-vol-wrap:hover .vp-vol-slider-track,
          .vp-vol-open .vp-vol-slider-track { width: 112px; }
        }
        .vp-vol-input {
          -webkit-appearance: none; appearance: none;
          width: 100%; height: 3px; border-radius: 2px;
          background: rgba(255,255,255,0.25);
          outline: none; cursor: pointer;
        }
        .vp-vol-input::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none;
          width: 12px; height: 12px; border-radius: 50%;
          background: white; cursor: pointer;
          box-shadow: 0 0 0 2px rgba(255,255,255,0.3);
        }
        .vp-vol-input::-moz-range-thumb {
          width: 12px; height: 12px; border-radius: 50%;
          background: white; cursor: pointer; border: none;
        }
      `}</style>

      {/* ── Backdrop (tablet+) ── */}
      <div className="fixed inset-0 z-[100] flex flex-col sm:items-center sm:justify-center sm:p-4 lg:p-8 2xl:p-12"
        style={{ background: "rgba(0,0,0,0.92)", backdropFilter: "blur(20px)" }}>

        {/*
          ┌──────────────────────────────────────────────────────────────┐
          │  MOBILE  (<sm)  : full-screen sheet, slides up from bottom   │
          │  TABLET  (sm→lg): centered modal, max-w-3xl, aspect-video    │
          │  DESKTOP (lg→2xl): max-w-5xl, rounded-2xl, bigger controls  │
          │  TV      (2xl+) : max-w-7xl, near-fullscreen, large UI       │
          └──────────────────────────────────────────────────────────────┘
        */}
        <div
          ref={containerRef}
          className={cn(
            "relative flex flex-col bg-black overflow-hidden",
            // Mobile: full screen, no rounding
            "w-full h-full",
            // Tablet: modal card
            "sm:h-auto sm:rounded-xl sm:shadow-2xl sm:max-w-3xl vp-modal",
            // Desktop
            "lg:max-w-5xl lg:rounded-2xl",
            // TV
            "2xl:max-w-7xl 2xl:rounded-3xl",
            // Mobile slide-up (overrides vp-modal on small screens)
            "max-sm:vp-mobile max-sm:rounded-t-2xl max-sm:rounded-b-none",
          )}
          style={{
            boxShadow: "0 0 0 1px rgba(255,255,255,0.07), 0 40px 80px rgba(0,0,0,0.8)",
          }}
          onMouseMove={showControls}
          onTouchStart={showControls}
        >
          {/* ── Video element ── */}
          <div className="relative bg-black w-full flex-1 sm:flex-none sm:aspect-video">
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              playsInline
              controls={false}
            />

            {/* ── Top bar (title + close) ── */}
            <div className={cn(
              "vp-controls-fade absolute top-0 left-0 right-0 vp-top-gradient px-4 pt-4 pb-10",
              "sm:px-5 sm:pt-5 lg:px-7 lg:pt-6 2xl:px-10 2xl:pt-8",
              !controlsVisible && "vp-controls-hidden",
            )}>
              <div className="flex items-center justify-between gap-3">
                {/* Left: logo + title */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logo} alt={title}
                      className="h-7 w-auto object-contain flex-shrink-0 lg:h-9 2xl:h-11 rounded"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  )}
                  <div className="min-w-0">
                    <p className="font-mono text-xs lg:text-sm 2xl:text-base text-white/90 tracking-wider uppercase truncate font-semibold">
                      {title}
                    </p>
                    {!loading && !failed && !allFailed && (
                      <p className="font-mono text-[10px] 2xl:text-xs text-white/35 tracking-widest hidden sm:block">
                        {sources[sourceIdx].label}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: controls */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Volume control — icon + slide-out slider */}
                  <div className={cn("vp-vol-wrap", volOpen && "vp-vol-open")}>
                    <button
                      onClick={() => { if (window.matchMedia("(hover: none)").matches) { openVol(); } else { toggleMute(); } }}
                      onMouseEnter={() => { if (!window.matchMedia("(hover: none)").matches) openVol(); }}
                      className="p-2 lg:p-2.5 2xl:p-3 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
                    >
                      {muted
                        ? <VolumeX className="w-4 h-4 lg:w-5 lg:h-5 2xl:w-6 2xl:h-6" />
                        : volume < 0.5
                        ? <Volume1 className="w-4 h-4 lg:w-5 lg:h-5 2xl:w-6 2xl:h-6" />
                        : <Volume2 className="w-4 h-4 lg:w-5 lg:h-5 2xl:w-6 2xl:h-6" />}
                    </button>
                    <div className="vp-vol-slider-track">
                      <input
                        type="range" min="0" max="1" step="0.02"
                        value={volume}
                        onChange={(e) => { handleVolume(parseFloat(e.target.value)); openVol(); }}
                        className="vp-vol-input"
                        style={{
                          background: `linear-gradient(to right, white ${volume * 100}%, rgba(255,255,255,0.25) ${volume * 100}%)`,
                        }}
                      />
                    </div>
                  </div>
                  <button onClick={toggleFullscreen}
                    className="p-2 lg:p-2.5 2xl:p-3 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-all">
                    {isFullscreen
                      ? <Minimize2 className="w-4 h-4 lg:w-5 lg:h-5 2xl:w-6 2xl:h-6" />
                      : <Maximize2 className="w-4 h-4 lg:w-5 lg:h-5 2xl:w-6 2xl:h-6" />}
                  </button>
                  <button onClick={onClose}
                    className="p-2 lg:p-2.5 2xl:p-3 rounded-full text-white/60 hover:text-red-400 hover:bg-red-400/10 transition-all">
                    <X className="w-4 h-4 lg:w-5 lg:h-5 2xl:w-6 2xl:h-6" />
                  </button>
                </div>
              </div>
            </div>

            {/* ── Bottom status bar ── */}
            <div className={cn(
              "vp-controls-fade absolute bottom-0 left-0 right-0 vp-bottom-gradient px-4 pb-4 pt-10",
              "sm:px-5 sm:pb-5 lg:px-7 lg:pb-6 2xl:px-10 2xl:pb-8",
              !controlsVisible && "vp-controls-hidden",
            )}>
              <div className="flex items-center gap-2.5">
                {/* Live dot */}
                <span className="relative flex h-2 w-2 2xl:h-2.5 2xl:w-2.5 flex-shrink-0">
                  {!loading && !failed && !allFailed && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                  )}
                  <span className={cn("relative inline-flex rounded-full h-full w-full",
                    allFailed || failed ? "bg-yellow-400" : loading ? "bg-white/25" : "bg-emerald-400")} />
                </span>
                <span className={cn("font-mono text-[10px] lg:text-xs 2xl:text-sm tracking-widest font-bold", statusColor)}>
                  {statusText}
                </span>
                {muted && !failed && !allFailed && !loading && (
                  <button onClick={toggleMute}
                    className="ml-auto font-mono text-[10px] lg:text-xs 2xl:text-sm text-white/40 hover:text-white tracking-widest transition-colors flex items-center gap-1.5">
                    <VolumeX className="w-3 h-3 2xl:w-4 2xl:h-4" /> MUTED · TAP TO UNMUTE
                  </button>
                )}              </div>
            </div>

            {/* ── Loading overlay ── */}
            {loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60">
                <Loader2 className="w-10 h-10 lg:w-14 lg:h-14 2xl:w-16 2xl:h-16 text-white/70 animate-spin" />
                <p className="font-mono text-white/50 text-xs lg:text-sm 2xl:text-base tracking-widest animate-pulse uppercase">
                  Loading {sources[sourceIdx].label}…
                </p>
              </div>
            )}

            {/* ── Source failed overlay ── */}
            {failed && !allFailed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/85 px-6 text-center">
                <AlertTriangle className="w-10 h-10 lg:w-12 lg:h-12 2xl:w-14 2xl:h-14 text-yellow-400" />
                <div>
                  <p className="font-mono text-white text-sm lg:text-base 2xl:text-lg font-semibold mb-1">
                    {sources[sourceIdx].label} failed
                  </p>
                  <p className="text-white/45 text-xs lg:text-sm 2xl:text-base max-w-sm">
                    {hasNext ? "Try the next source or retry." : "No more sources available."}
                  </p>
                </div>
                <div className="flex gap-3 flex-wrap justify-center">
                  <button onClick={retry}
                    className="flex items-center gap-2 px-4 py-2 lg:px-5 lg:py-2.5 2xl:px-6 2xl:py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-mono text-xs lg:text-sm 2xl:text-base tracking-wider transition-all border border-white/15">
                    <RefreshCw className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" /> Retry
                  </button>
                  {hasNext && (
                    <button onClick={tryNext}
                      className="flex items-center gap-2 px-4 py-2 lg:px-5 lg:py-2.5 2xl:px-6 2xl:py-3 rounded-full bg-white text-black font-mono text-xs lg:text-sm 2xl:text-base tracking-wider transition-all hover:bg-white/90">
                      <Wifi className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" /> Try {sources[sourceIdx + 1].label}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── All failed overlay ── */}
            {allFailed && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/85 px-6 text-center">
                <AlertTriangle className="w-10 h-10 lg:w-12 lg:h-12 2xl:w-14 2xl:h-14 text-yellow-400" />
                <div>
                  <p className="font-mono text-white text-sm lg:text-base 2xl:text-lg font-semibold mb-1">
                    Channel Unavailable
                  </p>
                  <p className="text-white/45 text-xs lg:text-sm 2xl:text-base max-w-sm leading-relaxed">
                    All sources failed. This channel may be offline or geo-restricted.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={retry}
                    className="flex items-center gap-2 px-4 py-2 lg:px-5 lg:py-2.5 2xl:px-6 2xl:py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-mono text-xs lg:text-sm 2xl:text-base tracking-wider transition-all border border-white/15">
                    <RefreshCw className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" /> Retry
                  </button>
                  <button onClick={onClose}
                    className="flex items-center gap-2 px-4 py-2 lg:px-5 lg:py-2.5 2xl:px-6 2xl:py-3 rounded-full bg-white/10 hover:bg-white/20 text-white font-mono text-xs lg:text-sm 2xl:text-base tracking-wider transition-all border border-white/15">
                    <X className="w-3.5 h-3.5 2xl:w-4 2xl:h-4" /> Close
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Mobile-only bottom handle hint ── */}
          <div className="sm:hidden flex items-center justify-center py-2 bg-black/60">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>
        </div>
      </div>
    </>
  );
}
