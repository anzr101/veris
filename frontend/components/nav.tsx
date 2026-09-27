"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { motion } from "framer-motion";
import { getHealth } from "@/lib/api";

const LINKS = [
  { href: "/", label: "Ask" },
  { href: "/atlas", label: "Atlas" },
  { href: "/papers", label: "Papers" },
];

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL;

export function Nav() {
  const pathname = usePathname();
  const [live, setLive] = useState<boolean | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    getHealth().then(setLive);
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={clsx(
        "sticky top-0 z-40 transition-[background-color,border-color] duration-300",
        scrolled
          ? "border-b border-line bg-paper/85 backdrop-blur-md"
          : "border-b border-transparent bg-paper",
      )}
    >
      <div className="mx-auto flex h-16 max-w-page items-center justify-between px-5 sm:px-8">
        <Link href="/" className="flex items-baseline gap-[3px]" aria-label="Veris home">
          <span className="font-serif text-[26px] leading-none tracking-[-0.01em]">Veris</span>
          <span className="h-[5px] w-[5px] translate-y-[-1px] rounded-full bg-accent" />
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "relative rounded-full px-3 py-1.5 text-[14px] transition-colors duration-200",
                  active ? "text-ink" : "text-muted hover:text-ink",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-pill"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    className="absolute inset-0 rounded-full bg-ink/[0.06]"
                  />
                )}
                <span className="relative">{l.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-5 sm:flex">
          <span className="flex items-center gap-2 font-mono text-[11.5px] text-muted">
            <span className="relative flex h-1.5 w-1.5">
              {live && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok/50" />
              )}
              <span
                className={clsx(
                  "relative inline-flex h-1.5 w-1.5 rounded-full",
                  live === null ? "bg-faint" : live ? "bg-ok" : "bg-warn",
                )}
              />
            </span>
            {live === null ? "Connecting" : live ? "Operational" : "Degraded"}
          </span>
          {REPO_URL && (
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              aria-label="Source on GitHub"
              className="text-muted transition-colors hover:text-ink"
            >
              <svg viewBox="0 0 16 16" className="h-[17px] w-[17px]" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
