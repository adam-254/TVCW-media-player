"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2, AlertTriangle, Volume2, VolumeX, Maximize2, RefreshCw } from "lucide-react";
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

// All strategies to try in order
function buildStrategies(url: string) {
  return [
    { label: "CONNECTING...",        streamUrl: url,           useNative: false },
    { label: "RETRYING VIA PROXY...", streamUrl: proxyUrl(url), useNative: false },
    { label: "TRYING NATIVE...",     streamUrl: url,           useNative: true  },
    { label: "PROXY NATIVE...",      streamUrl: proxyUrl(url), useNative: true  },
  ];
}

export default function VideoPlayer({ url, title, logo, onClose }: VideoPlayerProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const hlsRef      = useRef<import("hls.js").default | null>(null);
  const strategyRef = useRef(0);

  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);
  const [muted,         setMuted]         = useState(false);
  const [statusLabel,   setStatusLabel]   = useState("CONNECTING...");

  const destroyHls = useCallback(() => {
    hlsRef.current?.destroy();
    hlsRef.current = null;
    if (videoRef.current) videoRef.current.src = "";
  }, []);

  const tryNextStrategy = useCallback(() => {
    const strategies = buildStrategies(url);
    strategyRef.current += 1;
    if (strategyRef.current >= strategies.length) {
      setError("Stream unavailable. Try again later.");
      setLoading(false);
      return;
    }
    // Small delay before next attempt
    setTimeout(() => initPlayer(strategies[strategyRef.current]), 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const initPlayer = useCallback(async (strategy: ReturnType<typeof buildStrategies>[0]) => {
    const video = videoRef.current;
    if (!video) return;

    destroyHls();
    setLoading(true);
    setError(null);
    setStatusLabel(strategy.label);

    const { streamUrl, useNative } = strategy;
    const isHLS = /\.m3u8/i.test(streamUrl) || /hls/i.test(streamUrl) || streamUrl.includes("stream-proxy");

    if (!isHLS || useNative) {
      // Native video element — works for MP4, RTMP-over-HTTP, and Safari HLS
      video.src = streamUrl;
      video.load();
      const onLoaded = () => { video.play().catch(() => {}); setLoading(false); };
      const onErr    = () => tryNextStrategy();
      video.onloadedmetadata = onLoaded;
      video.onerror          = onErr;
      return;
    }

    // HLS.js path
    const Hls = (await import("hls.js")).default;

    if (!Hls.isSupported()) {
      // Fallback to native (Safari)
      video.src = streamUrl;
      video.load();
      video.onloadedmetadata = () => { video.play().catch(() => {}); setLoading(false); };
      video.onerror          = () => tryNextStrategy();
      return;
    }

    const hls = new Hls({
      enableWorker:    true,
      lowLatencyMode:  true,
      backBufferLength: 30,
      maxBufferLength:  60,
      manifestLoadingTimeOut:  12000,
      manifestLoadingMaxRetry: 1,
      levelLoadingTimeOut:     12000,
    });
    hlsRef.current = hls;

    hls.loadSource(streamUrl);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {});
      setLoading(false);
    });

    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      hls.destroy();
      hlsRef.current = null;
      tryNextStrategy();
    });
  }, [destroyHls, tryNextStrategy]);

  // Start from strategy 0 whenever url changes
  useEffect(() => {
    strategyRef.current = 0;
    const strategies = buildStrategies(url);
    initPlayer(strategies[0]);
    return destroyHls;
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = useCallback(() => {
    strategyRef.current = 0;
    setError(null);
    setLoading(true);
    initPlayer(buildStrategies(url)[0]);
  }, [url, initPlayer]);

  const toggleMute = () => {
    if (videoRef.current) { videoRef.current.muted = !muted; setMuted(!muted); }
  };
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
          <video ref={videoRef} className="w-full h-full" playsInline controls={!loading && !error} />

          {loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
              <Loader2 className="w-10 h-10 text-cyber-cyan animate-spin" />
              <p className="font-mono text-cyber-cyan text-xs sm:text-sm tracking-widest animate-pulse text-center px-4">
                {statusLabel}
              </p>
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
        </div>
      </div>
    </div>
  );
}
