"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2, AlertTriangle, Volume2, VolumeX, Maximize2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoPlayerProps {
  url:     string;
  title:   string;
  logo?:   string | null;
  onClose: () => void;
}

type Stage = "direct" | "proxy" | "native" | "failed";

export default function VideoPlayer({ url, title, logo, onClose }: VideoPlayerProps) {
  const videoRef  = useRef<HTMLVideoElement>(null);
  const hlsRef    = useRef<import("hls.js").default | null>(null);
  const stageRef  = useRef<Stage>("direct");

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [muted,   setMuted]   = useState(false);
  const [label,   setLabel]   = useState("CONNECTING...");

  function proxyUrl(u: string) {
    return `/api/stream-proxy?url=${encodeURIComponent(u)}`;
  }

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

  async function load(stage: Stage) {
    const v = videoRef.current;
    if (!v) return;

    stageRef.current = stage;
    setLoading(true);
    setError(false);

    if (stage === "failed") {
      setLoading(false);
      setError(true);
      return;
    }

    resetVideo();

    const streamUrl = stage === "proxy" ? proxyUrl(url) : url;

    if (stage === "native") {
      setLabel("TRYING NATIVE...");
      v.src = streamUrl;
      v.load();
      v.oncanplay = () => { setLoading(false); v.play().catch(() => {}); };
      v.onerror   = () => load("failed");
      return;
    }

    setLabel(stage === "proxy" ? "RETRYING VIA PROXY..." : "CONNECTING...");

    const Hls = (await import("hls.js")).default;

    if (!Hls.isSupported()) {
      // Safari — native HLS
      v.src = streamUrl;
      v.load();
      v.oncanplay = () => { setLoading(false); v.play().catch(() => {}); };
      v.onerror   = () => load("failed");
      return;
    }

    const hls = new Hls({
      enableWorker:            true,
      lowLatencyMode:          true,
      manifestLoadingTimeOut:  6000,
      manifestLoadingMaxRetry: 0,
      levelLoadingTimeOut:     6000,
      levelLoadingMaxRetry:    0,
      fragLoadingTimeOut:      10000,
      fragLoadingMaxRetry:     2,
      startLevel:              -1,
    });

    hlsRef.current = hls;
    hls.attachMedia(v);
    hls.loadSource(streamUrl);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setLoading(false);
      v.play().catch(() => {
        // Autoplay blocked — mute and retry
        v.muted = true;
        setMuted(true);
        v.play().catch(() => {});
      });
    });

    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (!data.fatal) return;
      destroyHls();
      const next: Stage = stage === "direct" ? "proxy" : stage === "proxy" ? "native" : "failed";
      load(next);
    });
  }

  useEffect(() => {
    load("direct");
    return () => { resetVideo(); };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = () => load("direct");
  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !muted;
    setMuted(!muted);
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

          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
              <Loader2 className="w-10 h-10 text-cyber-cyan animate-spin" />
              <p className="font-mono text-cyber-cyan text-xs tracking-widest animate-pulse">{label}</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center">
              <AlertTriangle className="w-10 h-10 text-yellow-400" />
              <div>
                <p className="font-mono text-white text-sm font-semibold mb-1">Channel Unavailable</p>
                <p className="text-cyber-muted text-xs max-w-xs leading-relaxed">
                  This stream is offline. Try another channel or retry.
                </p>
              </div>
              <div className="flex gap-2">
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
            <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", error ? "bg-yellow-400" : "bg-cyber-cyan")} />
            <span className={cn("relative inline-flex rounded-full h-2 w-2", error ? "bg-yellow-400" : "bg-cyber-cyan")} />
          </span>
          <span className="font-mono text-xs text-cyber-muted tracking-widest">
            {error ? "UNAVAILABLE" : loading ? "BUFFERING" : "LIVE"}
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
