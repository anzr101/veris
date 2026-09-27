"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";
import { getHealth } from "@/lib/api";
import { Logo } from "./logo";

export const SECTIONS = [
  { href: "/", label: "Overview" },
  { href: "/ask", label: "Ask" },
  { href: "/atlas", label: "Atlas" },
  { href: "/topics", label: "Topics" },
  { href: "/library", label: "Library" },
  { href: "/method", label: "Method" },
  { href: "/system", label: "System" },
];

// Pages whose top edge is a navy instrument surface.
const DARK = ["/", "/atlas"];

export function Nav() {
  const pathname = usePathname();
  const [live, setLive] = useState<boolean | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const dark = DARK.includes(pathname) && !open;

  useEffect(() => {
    getHealth().then(setLive);
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <header
      className={clsx(
        "sticky top-0 z-50 border-b transition-colors duration-300",
        dark
          ? scrolled
            ? "border-navy-line bg-navy-deep/90 backdrop-blur-md"
            : "border-navy-line bg-navy-deep"
          : scrolled
            ? "border-line bg-paper/90 backdrop-blur-md"
            : "border-line bg-paper",
      )}
    >
      <div className="mx-auto flex h-16 max-w-page items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" aria-label="Veris overview">
          <Logo dark={dark} />
        </Link>

        <nav className="hidden items-center lg:flex">
          {SECTIONS.map((s) => {
            const active = isActive(s.href);
            return (
              <Link
                key={s.href}
                href={s.href}
                className={clsx(
                  "relative px-3.5 py-5 text-[13.5px] transition-colors duration-200",
                  dark
                    ? active
                      ? "text-white"
                      : "text-blue-ice/60 hover:text-white"
                    : active
                      ? "text-ink"
                      : "text-muted hover:text-ink",
                )}
              >
                {s.label}
                {active && (
                  <motion.span
                    layoutId="nav-rule"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    className={clsx(
                      "absolute inset-x-3.5 -bottom-px h-[2px]",
                      dark ? "bg-blue-bright" : "bg-blue",
                    )}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/system"
            className={clsx(
              "hidden items-center gap-2 text-[12px] sm:flex",
              dark ? "text-blue-ice/60 hover:text-white" : "text-muted hover:text-ink",
            )}
          >
            <span className="relative flex h-1.5 w-1.5">
              {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok/60" />}
              <span
                className={clsx(
                  "relative inline-flex h-1.5 w-1.5 rounded-full",
                  live === null ? "bg-faint" : live ? "bg-ok" : "bg-warn",
                )}
              />
            </span>
            {live === null ? "Connecting" : live ? "Online" : "Degraded"}
          </Link>
          <Link href="/ask" className={clsx("hidden md:inline-flex", dark ? "btn-primary" : "btn-primary")}>
            Ask Veris
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Close menu" : "Open menu"}
            className={clsx("rounded-md p-2 lg:hidden", dark ? "text-white" : "text-ink")}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-line bg-paper lg:hidden"
          >
            <ul className="mx-auto max-w-page px-5 py-3 sm:px-8">
              {SECTIONS.map((s, i) => (
                <li key={s.href}>
                  <Link
                    href={s.href}
                    className={clsx(
                      "flex items-center justify-between border-b border-line py-3.5 text-[16px]",
                      isActive(s.href) ? "text-blue" : "text-ink",
                    )}
                  >
                    {s.label}
                    <span className="text-[12px] text-faint">{String(i + 1).padStart(2, "0")}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
