"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Globe, ChevronDown, Search, X } from "lucide-react";
import type { ChannelCountry } from "@/types";

interface CountrySelectProps {
  countries:     ChannelCountry[];
  value:         string;
  onChange:      (code: string) => void;
}

export default function CountrySelect({ countries, value, onChange }: CountrySelectProps) {
  const [open,   setOpen]   = useState(false);
  const [query,  setQuery]  = useState("");
  const ref      = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = countries.find((c) => c.code === value);

  const filtered = query.trim()
    ? countries.filter((c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.code.toLowerCase().includes(query.toLowerCase())
      )
    : countries;

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else setQuery("");
  }, [open]);

  const select = useCallback((code: string) => {
    onChange(code);
    setOpen(false);
  }, [onChange]);

  return (
    <div ref={ref} className="relative w-full sm:w-auto">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full sm:w-52 flex items-center gap-2 bg-cyber-card border border-cyber-border/40 hover:border-cyber-cyan/60 text-cyber-text text-sm px-3 py-2 rounded-sm font-mono transition-colors focus:outline-none focus:border-cyber-cyan"
      >
        <Globe className="w-4 h-4 text-cyber-muted flex-shrink-0" />
        <span className="flex-1 text-left truncate">
          {selected ? (
            <span className="flex items-center gap-1.5">
              <span>{selected.flag}</span>
              <span>{selected.name}</span>
            </span>
          ) : (
            <span className="text-cyber-muted">All Countries</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-cyber-muted flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Mobile backdrop */}
          <div className="fixed inset-0 bg-black/60 z-40 sm:hidden" onClick={() => setOpen(false)} />

          <div className="
            fixed bottom-0 left-0 right-0 z-50 rounded-t-2xl
            sm:absolute sm:bottom-auto sm:left-auto sm:right-0 sm:top-full sm:mt-1 sm:rounded-t-none sm:rounded-sm sm:w-64
            bg-cyber-card border border-cyber-border/40 shadow-2xl overflow-hidden
            animate-slide-up sm:animate-none
          ">
            {/* Mobile drag handle */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 rounded-full bg-cyber-border/60" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-cyber-border/30">
              <span className="font-mono text-xs text-cyber-muted tracking-widest uppercase">Country</span>
              <button onClick={() => setOpen(false)} className="text-cyber-muted hover:text-white p-1 sm:hidden">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search */}
            <div className="px-3 py-2 border-b border-cyber-border/20">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyber-muted" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search countries..."
                  className="w-full bg-black/40 border border-cyber-border/30 focus:border-cyber-cyan text-white text-sm pl-8 pr-3 py-1.5 rounded-sm outline-none font-mono placeholder-cyber-muted/60"
                />
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto max-h-60 sm:max-h-72">
              {/* All option */}
              <button
                onClick={() => select("all")}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors hover:bg-cyber-cyan/10 ${
                  value === "all" ? "bg-cyber-cyan/10 text-cyber-cyan" : "text-cyber-text"
                }`}
              >
                <span className="text-base w-6 text-center">🌍</span>
                <span className="font-mono">All Countries</span>
                {value === "all" && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-cyber-cyan" />}
              </button>

              {filtered.length === 0 && (
                <p className="text-center text-cyber-muted text-xs py-6 font-mono">No results</p>
              )}

              {filtered.map((c) => (
                <button
                  key={c.code}
                  onClick={() => select(c.code)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors hover:bg-cyber-cyan/10 ${
                    value === c.code ? "bg-cyber-cyan/10 text-cyber-cyan" : "text-cyber-text"
                  }`}
                >
                  <span className="text-base w-6 text-center leading-none">{c.flag}</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="font-mono text-xs text-cyber-muted/60">{c.code}</span>
                  {value === c.code && <span className="w-1.5 h-1.5 rounded-full bg-cyber-cyan flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
