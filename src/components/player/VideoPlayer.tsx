"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { X, Loader2, AlertTriangle, Volume2, VolumeX, Maximize2, RefreshCw, Play, SkipForward } from "lucide-react";
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
  manifestLoadingTimeOut:  5000,
  manifestLoadingMaxRetry: 0,
  levelLoadingTimeOut:     5000,
  levelLoadingMaxRetry:    0,
  fragLoadingTimeOut:      8000,
  fragLoadingMaxRetry:     2,
  startLevel:              -1,
};

export default function VideoPlayer({ url, title, logo, onClose }: VideoPlayerProps) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const hlsRef     = useRef<import("hls.js").default | null>(null);
  const mountedRef = useRef(true);
  const wonRef     = useRef(false);
  const failsRef   = useRef(0);

  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [muted,       setMuted]       = useState(false);
  const [blocked,     setBlocked]     = useState(false);
  const [statusLabel, setStatusLabel] = useState("CONNECTING...");

  const destroyHls = useCallback(() => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
  }, []);

  const resetVideo = useCallback(() => {
    destroyHls();
    const v = videoRef.current;
    if (!v) return;
    v.oncanplay = null; v.onerror = null;
    v.pause();
    v.removeAttribute("src");
    try { v.load(); } catch { /* ignore */ }
  }, [destroyHls]);

  // Play unmuted, fall back to muted if browser policy blocks it
  const doPlay = useCallback((video: HTMLVideoElement, onFail: () => void) => {
    video.muted = false;
    video.play()
      .then(() => {
        if (!mountedRef.current) return;
        setLoading(false); setBlocked(false); setMuted(false);
      })
      .catch((err: DOMException) => {
        if (!mountedRef.current) return;
        if (err?.name === "NotAllowedError") {
          video.muted = true; setMuted(true);
          video.play()
            .then(() => { if (mountedRef.current) { setLoading(false); setBlocked(true); } })
            .catch(() => onFail());
        } else {
          onFail();
        }
      });
  }, []);

  const showError = useCallback(() => {
    if (!mountedRef.current) return;
    setError("This channel is currently offline or unavailable.");
    setLoading(false);
  }, []);

  // Called when a strategy wins the race
  const onWin = useCallback((hls: import("hls.js").default, label: string) => {
    if (wonRef.current || !mountedRef.current) { hls.destroy(); return; }
    wonRef.current = true;
    hlsRef.current = hls;
    setStatusLabel(label);
    const video = videoRef.current!;
    doPlay(video, showError);
  }, [doPlay, showError]);

  // Called when a strategy fails
  const onFail = useCallback((hls: import("hls.js").default | null) => {
    hls?.destroy();
    if (wonRef.current || !mountedRef.current) return;
    failsRef.current++;
    if (failsRef.current >= 2) showError(); // both direct + proxy failed
  }, [showError]);

  const startPlayback = useCallback(async (streamUrl: string) => {
    if (!mountedRef.current) return;
    resetVideo();
    wonRef.current  = false;
    failsRef.current = 0;
    setLoading(true); setError(null); setBlocked(false);
    setStatusLabel("CONNECTING...");

    const video = videoRef.current;
    if (!video) return;

    const Hls = (await import("hls.js")).default;
    if (!mountedRef.current) return;

    // Safari — native HLS only
    if (!Hls.isSupported()) {
      video.src = streamUrl; video.load();
      video.oncanplay = () => { if (mountedRef.current) doPlay(video, showError); };
      video.onerror   = () => { if (mountedRef.current) showError(); };
      return;
    }

    // Race direct vs proxy — correct HLS.js order: attachMedia → loadSource
    const makeHls = (src: string, label: string) => {
      const hls = new Hls(HLS_CONFIG);
      // Attach first, then load — this is the correct order per HLS.js docs
      hls.attachMedia(video);
      hls.loadSource(src);
      hls.on(Hls.Events.MANIFEST_PARSED, () => onWin(hls, label));
      hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) onFail(hls); });
      return hls;
    };

    // We can't attach two HLS instances to the same video element simultaneously.
    // So: try direct first with a short head-start, then start proxy in parallel.
    const directHls = makeHls(streamUrl, "LIVE");

    // Give direct 1.5s head-start before starting proxy (avoids src conflicts)
    const proxyTimer = setTimeout(() => {
      if (wonRef.current || !mountedRef.current) return;
      // Detach direct temporarily, race with proxy
      // Actually: just start proxy loading without attaching — check manifest only
      const proxyCheck = new Hls(HLS_CONFIG);
      proxyCheck.loadSource(proxyUrl(streamUrl));
      proxyCheck.on(Hls.Events.MANIFEST_PARSED, () => {
        if (wonRef.current || !mountedRef.current) { proxyCheck.destroy(); return; }
        // Proxy manifest loaded — switch to it
        directHls.destroy();
        wonRef.current = true;
        hlsRef.current = proxyCheck;
        proxyCheck.attachMedia(video);
        setStatusLabel("VIA PROXY");
        doPlay(video, showError);
      });
      proxyCheck.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) onFail(proxyCheck); });
    }, 1500);

    // If direct wins before proxy timer fires, cancel it
    const origOnWin = onWin;
    void origOnWin; // used via closure above

    return () => clearTimeout(proxyTimer);
  }, [resetVideo, doPlay, showError, onWin, onFail]);

  useEffect(() => {
    mountedRef.current = true;
    const cleanup = startPlayback(url);
    return () => {
      mountedRef.current = false;
      resetVideo();
      cleanup?.then?.(fn => fn?.());
    };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = useCallback(() => startPlayback(url), [url, startPlayback]);

  const unblockPlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false; setMuted(false); setBlocked(false);
    v.play().catch(() => {});
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !muted; setMuted(!muted);
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
          <video ref={videoRef} className="w-full h-full" playsInline
            controls={!loading && !error && !blocked} />

          {loading && !error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70">
              <Loader2 className="w-10 h-10 text-cyber-cyan animate-spin" />
              <p className="font-mono text-cyber-cyan text-xs tracking-widest animate-pulse">{statusLabel}</p>
            </div>
          )}

          {blocked && !error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/40 cursor-pointer"
              onClick={unblockPlay}>
              <div className="rounded-full bg-cyber-cyan/20 border border-cyber-cyan/40 p-5 hover:bg-cyber-cyan/30 transition-colors">
                <Play className="w-10 h-10 text-cyber-cyan fill-cyber-cyan" />
              </div>
              <p className="font-mono text-cyber-cyan text-xs tracking-[0.3em]">TAP TO UNMUTE</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 px-6 text-center">
              <AlertTriangle className="w-10 h-10 text-yellow-400" />
              <div>
                <p className="font-mono text-white text-sm font-semibold mb-1">Channel Unavailable</p>
                <p className="text-cyber-muted text-xs max-w-xs leading-relaxed">
                  This stream is currently offline. Try another channel or retry in a moment.
                </p>
              </div>
              <div className="flex gap-2 mt-1">
                <button onClick={retry} className="btn-cyber text-xs flex items-center gap-1.5">
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
                <button onClick={onClose} className="btn-cyber text-xs flex items-center gap-1.5">
                  <SkipForward className="w-3 h-3" /> Try Another
                </button>
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
            {error ? "UNAVAILABLE" : loading ? "BUFFERING" : blocked ? "PAUSED" : "LIVE"}
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
