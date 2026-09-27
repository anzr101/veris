"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { Logo } from "./logo";
import { SECTIONS } from "./nav";

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL;

export function Footer() {
  const pathname = usePathname();
  // The atlas is a full-viewport instrument; no footer beneath it.
  if (pathname.startsWith("/atlas")) return null;

  return (
    <footer className="grid-navy bg-navy-deep text-white">
      <div className="mx-auto max-w-page px-5 py-14 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-10">
          <div>
            <Logo dark />
            <p className="mt-4 max-w-[260px] text-[13.5px] leading-relaxed text-blue-ice/60">
              Grounded answers from the research literature.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-16 gap-y-2.5 sm:grid-cols-3">
            {SECTIONS.map((s) => (
              <Link key={s.href} href={s.href} className="text-[13.5px] text-blue-ice/70 transition-colors hover:text-white">
                {s.label}
              </Link>
            ))}
            <a
              href="/api/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[13.5px] text-blue-ice/70 transition-colors hover:text-white"
            >
              API <ArrowUpRight className="h-3 w-3" />
            </a>
            {REPO_URL && (
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[13.5px] text-blue-ice/70 transition-colors hover:text-white"
              >
                Source <ArrowUpRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
        <div className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-navy-line pt-6 text-[12px] text-blue-ice/50">
          <span>© {new Date().getFullYear()} Veris</span>
          <span>arXiv · FastAPI · LangGraph · Next.js</span>
        </div>
      </div>
    </footer>
  );
}
