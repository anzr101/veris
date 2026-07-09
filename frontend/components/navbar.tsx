"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Logo } from "./logo";

const LINKS = [
  { href: "/", label: "Ask" },
  { href: "/map", label: "Map" },
  { href: "/position", label: "Position" },
  { href: "/explore", label: "Explore" },
  { href: "/evals", label: "Evals" },
];

export function Navbar() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink/55 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="group flex items-center gap-3">
          <Logo className="h-8 w-8" />
          <span className="leading-none">
            <span className="block font-display text-[20px] tracking-tight text-bone-bright">
              Veris
            </span>
            <span className="kicker mt-[3px] hidden sm:block">Atlas of research</span>
          </span>
        </Link>

        <nav className="flex items-center gap-8">
          {LINKS.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={clsx(
                  "relative pb-1 text-[13.5px] transition-colors duration-200",
                  active ? "text-bone-bright" : "text-mist hover:text-bone-bright",
                )}
              >
                {l.label}
                {active && (
                  <span className="absolute -bottom-px left-0 right-0 h-px bg-signal" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
