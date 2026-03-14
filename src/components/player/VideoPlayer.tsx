"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  X,
  Loader2,
  AlertTriangle,
  Volume2,
  VolumeX,
  Maximize2,
  RefreshCw,
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  url: string;
  title: string;
  logo?: string | null;
  onClose: () => void;
}

function proxyUrl(url: string) {
  return `/api/stream-proxy?url=${encodeURIComponent(url)}`;
}

type Strategy = { label: string; streamUrl: string; useNative: boolean };

function buildStrategies(url: string): Strategy[] {
  const p = proxyUrl(url);
  return [
    { label: "CONNECTING...",         streamUrl: url, useNative: false },
    { label: "ROUTING VIA PROXY...",  streamUrl: p,   useNative: false },
    { label: "TRYING NATIVE...",      streamUrl: url, useNative: true  },
    { label: "PROXY NATIVE...",       streamUrl: p,   useNative: true  },
  ];
}

const HLS_CONFIG = {
  enableWorker:           true,
  lowLatencyMode:         true,
  backBufferLength:       30,
  maxBufferLength:        60,
  // Fast timeouts so we fail fast and move to next strategy
  manifestLoadingTimeOut: 6_000,
  manifestLoadingMaxRetry: 0,
  levelLoadingTimeOut:    6_000,
  levelLoadingMaxRetry:   1,
  fragLoadingTimeOut:     8_000,
  fragLoadingMaxRetry:    2,
  startLevel:             -1,
  abrEwmaDefaultEstimate: 1_000_000,
};

export default function VideoPlayer({ url, title, logo, onClose }: VideoPlayerProps) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const hlsRef        = useRef<import("hls.js").default | null>(null);
  const strategyRef   = useRef(0);
  const mountedRef    = useRef(true);
  const onNextRef     = useRef<() => void>(() => {});

  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [muted,        setMuted]        = useState(true);   // start muted — avoids autoplay block
  const [blocked,      setBlocked]      = useState(false);  // autoplay was blocked, need user tap
  const [statusLabel,  setStatusLabel]  = useState("CONNECTING...");
  const [strategyIdx,  setStrategyIdx]  = useState(0);

  // ── full teardown ──────────────────────────────────────────────────────────
  const destroyHls = useCallback(() => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
    const v = videoRef.current;
    if (!v) return;
    v.onloadedmetadata = null;
    v.oncanplay        = null;
    v.onerror          = null;
    v.pause();
    v.removeAttribute("src");
    try { v.load(); } catch { /* ignore */ }
  }, []);

  // ── attempt playback ───────────────────────────────────────────────────────
  const attemptPlay = useCallback((video: HTMLVideoElement) => {
    // Always start muted to maximise autoplay success
    video.muted = true;
    video.play()
      .then(() => {
        if (!mountedRef.current) return;
        setLoading(false);
        setBlocked(false);
        // After successful play, restore user's mute preference
        // (already muted by default so no jarring audio)
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        // NotAllowedError = browser blocked autoplay
        if (err?.name === "NotAllowedError") {
          setLoading(false);
          setBlocked(true); // show "tap to play" overlay
        } else {
          onNextRef.current();
        }
      });
  }, []);

  // ── core player init ───────────────────────────────────────────────────────
  const initPlayer = useCallback(
    async (strategy: Strategy, idx: number) => {
      if (!mountedRef.current) return;
      const video = videoRef.current;
      if (!video) return;

      destroyHls();
      if (!mountedRef.current) return;

      setLoading(true);
      setError(null);
      setBlocked(false);
      setStatusLabel(strategy.label);
      setStrategyIdx(idx);

      const { streamUrl, useNative } = strategy;

      // ── native <video> path ──────────────────────────────────────────────
      if (useNative) {
        video.src = streamUrl;
        video.load();
        video.oncanplay = () => {
          if (!mountedRef.current) return;
          attemptPlay(video);
        };
        video.onerror = () => {
          if (!mountedRef.current) return;
          onNextRef.current();
        };
        return;
      }

      // ── HLS.js path ──────────────────────────────────────────────────────
      const Hls = (await import("hls.js")).default;
      if (!mountedRef.current) return;

      if (!Hls.isSupported()) {
        // Safari handles HLS natively
        video.src = streamUrl;
        video.load();
        video.oncanplay = () => {
          if (!mountedRef.current) return;
          attemptPlay(video);
        };
        video.onerror = () => {
          if (!mountedRef.current) return;
          onNextRef.current();
        };
        return;
      }

      const hls = new Hls(HLS_CONFIG);
      hlsRef.current = hls;

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!mountedRef.current) return;
        attemptPlay(video);
      });

      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (!mountedRef.current) return;
        if (!data.fatal) return;
        console.warn("[VideoPlayer] fatal HLS error:", data.type, data.details);
        hls.destroy();
        hlsRef.current = null;
        onNextRef.current();
      });
    },
    [destroyHls, attemptPlay]
  );

  // ── next strategy ──────────────────────────────────────────────────────────
  const tryNextStrategy = useCallback(() => {
    if (!mountedRef.current) return;
    const strategies = buildStrategies(url);
    const next = strategyRef.current + 1;
    strategyRef.current = next;

    if (next >= strategies.length) {
      setError("Stream unavailable. The channel may be offline.");
      setLoading(false);
      return;
    }

    setTimeout(() => initPlayer(strategies[next], next), 400);
  }, [url, initPlayer]);

  // Keep ref in sync to avoid stale closures inside initPlayer
  useEffect(() => {
    onNextRef.current = tryNextStrategy;
  }, [tryNextStrategy]);

  // ── start / restart on url change ─────────────────────────────────────────
  useEffect(() => {
    mountedRef.current  = true;
    strategyRef.current = 0;
    initPlayer(buildStrategies(url)[0], 0);

    return () => {
      mountedRef.current = false;
      destroyHls();
    };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── manual retry ───────────────────────────────────────────────────────────
  const retry = useCallback(() => {
    strategyRef.current = 0;
    setError(null);
    setLoading(true);
    setBlocked(false);
    initPlayer(buildStrategies(url)[0], 0);
  }, [url, initPlayer]);

  // ── user-gesture unlock for blocked autoplay ───────────────────────────────
  const unblockPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setBlocked(false);
    v.muted = muted;
    v.play().catch(() => {
      // If still blocked even after gesture, unmute might be the issue
      v.muted = true;
      setMuted(true);
      v.play().catch(() => {});
    });
  }, [muted]);

  // ── controls ───────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    v.muted = next;
    setMuted(next);
  }, [muted]);

  const toggleFullscreen = () =>
    videoRef.current?.requestFullscreen().catch(() => {});

  const totalStrategies = buildStrategies(url).length;

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col sm:items-center sm:justify-center sm:p-4 sm:bg-black/90 sm:backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full h-full sm:h-auto sm:max-w-5xl sm:rounded-sm sm:overflow-hidden sm:animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 bg-cyber-card border-b border-cyber-border/40 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={title}
                className="h-6 w-auto object-contain flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <span className="font-mono text-xs sm:text-sm text-cyber-cyan tracking-wider uppercase truncate">
              {title}
            </span>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={toggleMute}
              className="p-2 text-cyber-muted hover:text-cyber-cyan transition-colors"
              title={muted ? "Unmute" : "Mute"}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 text-cyber-muted hover:text-cyber-cyan transition-colors"
              title="Fullscreen"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-cyber-muted hover:text-red-400 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Video area ── */}
        <div className="relative bg-black flex-1 sm:flex-none sm:aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full"
            playsInline
            muted={muted}
            // Only show native controls when fully loaded and unblocked
            controls={!loading && !error && !blocked}
          />

          {/* Loading overlay */}
          {loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
              <Loader2 className="w-10 h-10 text-cyber-cyan animate-spin" />
              <p className="font-mono text-cyber-cyan text-xs sm:text-sm tracking-widest animate-pulse text-center px-4">
                {statusLabel}
              </p>
              {/* Strategy progress dots */}
              <div className="flex gap-2 mt-1">
                {Array.from({ length: totalStrategies }).map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 w-6 rounded-full transition-all duration-300",
                      i < strategyIdx
                        ? "bg-red-500/60"
                        : i === strategyIdx
                        ? "bg-cyber-cyan animate-pulse"
                        : "bg-cyber-muted/30"
                    )}
                  />
                ))}
              </div>
              <p className="font-mono text-cyber-muted/50 text-[10px] tracking-widest">
                ATTEMPT {strategyIdx + 1} OF {totalStrategies}
              </p>
            </div>
          )}

          {/* Autoplay-blocked overlay — needs a user gesture */}
          {blocked && !error && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/60 cursor-pointer"
              onClick={unblockPlay}
            >
              <div className="rounded-full bg-cyber-cyan/20 border border-cyber-cyan/40 p-5 hover:bg-cyber-cyan/30 transition-colors">
                <Play className="w-10 h-10 text-cyber-cyan fill-cyber-cyan" />
              </div>
              <p className="font-mono text-cyber-cyan text-xs tracking-widest">
                TAP TO PLAY
              </p>
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-4">
              <AlertTriangle className="w-10 h-10 text-red-400" />
              <p className="font-mono text-red-400 text-sm text-center max-w-xs">
                {error}
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={retry}
                  className="btn-cyber text-xs flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
                <button onClick={onClose} className="btn-cyber text-xs">
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-3 py-2 sm:px-4 bg-cyber-card border-t border-cyber-border/20 flex items-center gap-2 flex-shrink-0">
          <span className="relative flex h-2 w-2">
            <span
              className={cn(
                "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                error ? "bg-red-400" : "bg-cyber-cyan"
              )}
            />
            <span
              className={cn(
                "relative inline-flex rounded-full h-2 w-2",
                error ? "bg-red-400" : "bg-cyber-cyan"
              )}
            />
          </span>
          <span className="font-mono text-xs text-cyber-muted tracking-widest">
            {error ? "OFFLINE" : loading ? "BUFFERING" : blocked ? "PAUSED" : "LIVE"}
          </span>
          {muted && !error && !loading && (
            <button
              onClick={toggleMute}
              className="ml-auto font-mono text-[10px] text-cyber-muted/60 hover:text-cyber-cyan tracking-widest transition-colors flex items-center gap-1"
            >
              <VolumeX className="w-3 h-3" /> MUTED — TAP TO UNMUTE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}