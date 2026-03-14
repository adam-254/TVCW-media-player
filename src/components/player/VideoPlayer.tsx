"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2, AlertTriangle, Volume2, VolumeX, Maximize2, RefreshCw, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  url:     string;
  title:   string;
  logo?:   string | null;
  onClose: () => void;
}

function proxyUrl(url: string) {
  return `/api/stream-proxy?url=${encodeURIComponent(url)}`;
}

const HLS_CONFIG = {
  enableWorker:            true,
  lowLatencyMode:          true,
  backBufferLength:        20,
  maxBufferLength:         40,
  manifestLoadingTimeOut:  4000,
  manifestLoadingMaxRetry: 0,
  levelLoadingTimeOut:     4000,
  levelLoadingMaxRetry:    0,
  fragLoadingTimeOut:      8000,
  fragLoadingMaxRetry:     2,
  startLevel:              -1,
};

export default function VideoPlayer({ url, title, logo, onClose }: VideoPlayerProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const hlsRef      = useRef<import("hls.js").default | null>(null);
  const mountedRef  = useRef(true);
  // tracks which attempt "won" the race so the loser is ignored
  const winnerRef   = useRef<string | null>(null);

  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [muted,       setMuted]       = useState(false);
  const [blocked,     setBlocked]     = useState(false);
  const [statusLabel, setStatusLabel] = useState("CONNECTING...");

  // ── destroy HLS instance only, don't touch video.src ──────────────────────
  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  // ── full reset of video element ────────────────────────────────────────────
  const resetVideo = useCallback(() => {
    destroyHls();
    const v = videoRef.current;
    if (!v) return;
    v.oncanplay        = null;
    v.onloadedmetadata = null;
    v.onerror          = null;
    v.pause();
    v.removeAttribute("src");
    try { v.load(); } catch { /* ignore */ }
  }, [destroyHls]);

  // ── play without muting ────────────────────────────────────────────────────
  const doPlay = useCallback((video: HTMLVideoElement, onFail: () => void) => {
    video.muted = false;
    video.play()
      .then(() => {
        if (!mountedRef.current) return;
        setLoading(false);
        setBlocked(false);
        setMuted(false);
      })
      .catch((err: DOMException) => {
        if (!mountedRef.current) return;
        if (err?.name === "NotAllowedError") {
          // Browser blocked unmuted autoplay — mute and retry once
          video.muted = true;
          setMuted(true);
          video.play()
            .then(() => {
              if (!mountedRef.current) return;
              setLoading(false);
              setBlocked(true); // show "tap to unmute"
            })
            .catch(() => onFail());
        } else {
          onFail();
        }
      });
  }, []);

  // ── start playback: race direct vs proxy ──────────────────────────────────
  const startPlayback = useCallback(async (streamUrl: string) => {
    if (!mountedRef.current) return;
    resetVideo();
    winnerRef.current = null;
    setLoading(true);
    setError(null);
    setBlocked(false);
    setStatusLabel("CONNECTING...");

    const video = videoRef.current;
    if (!video) return;

    const Hls = (await import("hls.js")).default;
    if (!mountedRef.current) return;

    // If HLS.js not supported (Safari), go native directly
    if (!Hls.isSupported()) {
      video.src = streamUrl;
      video.load();
      video.oncanplay = () => {
        if (!mountedRef.current) return;
        doPlay(video, () => {
          setError("Stream unavailable.");
          setLoading(false);
        });
      };
      video.onerror = () => {
        if (!mountedRef.current) return;
        setError("Stream unavailable.");
        setLoading(false);
      };
      return;
    }

    // Race: direct HLS.js vs proxied HLS.js
    // Whichever fires MANIFEST_PARSED first wins; the other is destroyed
    let directHls: import("hls.js").default | null = null;
    let proxyHls:  import("hls.js").default | null = null;
    let failCount = 0;

    const onWin = (winner: "direct" | "proxy", hls: import("hls.js").default) => {
      if (winnerRef.current || !mountedRef.current) {
        hls.destroy();
        return;
      }
      winnerRef.current = winner;

      // Destroy the loser
      if (winner === "direct") { proxyHls?.destroy();  proxyHls  = null; }
      else                     { directHls?.destroy(); directHls = null; }

      // Attach the winner to the video element
      hlsRef.current = hls;
      hls.attachMedia(video);
      hls.once(Hls.Events.MEDIA_ATTACHED, () => {
        if (!mountedRef.current) return;
        setStatusLabel(winner === "proxy" ? "VIA PROXY" : "LIVE");
        doPlay(video, () => {
          // play() failed — try native as last resort
          setStatusLabel("TRYING NATIVE...");
          destroyHls();
          video.src = streamUrl;
          video.load();
          video.oncanplay = () => {
            if (!mountedRef.current) return;
            doPlay(video, () => {
              setError("Stream unavailable. The channel may be offline.");
              setLoading(false);
            });
          };
          video.onerror = () => {
            if (!mountedRef.current) return;
            setError("Stream unavailable. The channel may be offline.");
            setLoading(false);
          };
        });
      });
    };

    const onFail = () => {
      if (winnerRef.current || !mountedRef.current) return;
      failCount++;
      if (failCount < 2) return; // wait for both to fail
      // Both HLS attempts failed — try native <video>
      setStatusLabel("TRYING NATIVE...");
      video.src = streamUrl;
      video.load();
      video.oncanplay = () => {
        if (!mountedRef.current) return;
        doPlay(video, () => {
          setError("Stream unavailable. The channel may be offline.");
          setLoading(false);
        });
      };
      video.onerror = () => {
        if (!mountedRef.current) return;
        setError("Stream unavailable. The channel may be offline.");
        setLoading(false);
      };
    };

    // Create both HLS instances — do NOT attachMedia yet (avoids src conflicts)
    directHls = new Hls(HLS_CONFIG);
    proxyHls  = new Hls(HLS_CONFIG);

    directHls.loadSource(streamUrl);
    proxyHls.loadSource(proxyUrl(streamUrl));

    directHls.on(Hls.Events.MANIFEST_PARSED, () => onWin("direct", directHls!));
    proxyHls.on( Hls.Events.MANIFEST_PARSED, () => onWin("proxy",  proxyHls!));

    directHls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) { directHls?.destroy(); directHls = null; onFail(); } });
    proxyHls.on( Hls.Events.ERROR, (_e, d) => { if (d.fatal) { proxyHls?.destroy();  proxyHls  = null; onFail(); } });

  }, [resetVideo, doPlay, destroyHls]);

  useEffect(() => {
    mountedRef.current = true;
    startPlayback(url);
    return () => {
      mountedRef.current = false;
      resetVideo();
    };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = useCallback(() => {
    startPlayback(url);
  }, [url, startPlayback]);

  const unblockPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    setMuted(false);
    setBlocked(false);
    v.play().catch(() => {});
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !muted;
    setMuted(!muted);
  }, [muted]);

  const toggleFullscreen = () => videoRef.current?.requestFullscreen().catch(() => {});

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/95 flex flex-col sm:items-center sm:justify-center sm:p-4 sm:bg-black/90 sm:backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full h-full sm:h-auto sm:max-w-5xl sm:rounded-sm sm:overflow-hidden sm:animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2.5 sm:px-4 sm:py-3 bg-cyber-card border-b border-cyber-border/40 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt={title} className="h-6 w-auto object-contain flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
            )}
            <span className="font-mono text-xs sm:text-sm text-cyber-cyan tracking-wider uppercase truncate">
              {title}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={toggleMute} className="p-2 text-cyber-muted hover:text-cyber-cyan transition-colors">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button onClick={toggleFullscreen} className="p-2 text-cyber-muted hover:text-cyber-cyan transition-colors">
              <Maximize2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-2 text-cyber-muted hover:text-red-400 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Video */}
        <div className="relative bg-black flex-1 sm:flex-none sm:aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full"
            playsInline
            controls={!loading && !error && !blocked}
          />

          {loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
              <Loader2 className="w-10 h-10 text-cyber-cyan animate-spin" />
              <p className="font-mono text-cyber-cyan text-xs tracking-widest animate-pulse">
                {statusLabel}
              </p>
            </div>
          )}

          {/* Tap to unmute overlay */}
          {blocked && !error && !loading && (
            <div
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40 cursor-pointer"
              onClick={unblockPlay}
            >
              <div className="rounded-full bg-cyber-cyan/20 border border-cyber-cyan/40 p-5 hover:bg-cyber-cyan/30 transition-colors">
                <Play className="w-10 h-10 text-cyber-cyan fill-cyber-cyan" />
              </div>
              <p className="font-mono text-cyber-cyan text-xs tracking-[0.3em]">TAP TO UNMUTE</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-4">
              <AlertTriangle className="w-10 h-10 text-red-400" />
              <p className="font-mono text-red-400 text-sm text-center max-w-xs">{error}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={retry} className="btn-cyber text-xs flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
                <button onClick={onClose} className="btn-cyber text-xs">Close</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 sm:px-4 bg-cyber-card border-t border-cyber-border/20 flex items-center gap-2 flex-shrink-0">
          <span className="relative flex h-2 w-2">
            <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", error ? "bg-red-400" : "bg-cyber-cyan")} />
            <span className={cn("relative inline-flex rounded-full h-2 w-2", error ? "bg-red-400" : "bg-cyber-cyan")} />
          </span>
          <span className="font-mono text-xs text-cyber-muted tracking-widest">
            {error ? "OFFLINE" : loading ? "BUFFERING" : "LIVE"}
          </span>
          {muted && !error && !loading && (
            <button onClick={toggleMute}
              className="ml-auto font-mono text-[10px] text-cyber-muted/50 hover:text-cyber-cyan tracking-widest transition-colors flex items-center gap-1">
              <VolumeX className="w-3 h-3" /> MUTED · TAP TO UNMUTE
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
