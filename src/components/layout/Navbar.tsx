"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Search, Film, Radio } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/",         label: "Live TV",  icon: Radio },
  { href: "/tv-shows", label: "TV Shows", icon: Film  },
  { href: "/search",   label: "Search",   icon: Search },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-cyber-dark/80 backdrop-blur-md border-b border-cyber-border/30">
      {/* Glowing top edge */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyber-cyan to-transparent opacity-60" />

      <div className="max-w-screen-2xl mx-auto h-full px-3 sm:px-6 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <Image
            src="/TVCW-logo.png"
            alt="TVCW"
            width={32}
            height={32}
            className="rounded group-hover:drop-shadow-[0_0_8px_#00FFE7] transition-all"
          />
          <span className="font-display text-xl font-black tracking-widest text-white group-hover:text-glow-cyan transition-all">
            TV<span className="text-cyber-cyan">CW</span>
          </span>
        </Link>

        {/* Nav Links */}
        <nav className="flex items-center gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-sm font-semibold tracking-wider uppercase transition-all duration-200",
                  "font-body hover:text-cyber-cyan",
                  isActive
                    ? "text-cyber-cyan border-b-2 border-cyber-cyan"
                    : "text-cyber-muted hover:text-cyber-cyan"
                )}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyber-cyan opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyber-cyan" />
          </span>
          <span className="text-xs font-mono text-cyber-cyan tracking-widest uppercase hidden sm:block">
            Live
          </span>
        </div>
      </div>
    </header>
  );
}
