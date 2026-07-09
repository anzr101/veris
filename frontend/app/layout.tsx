import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/navbar";

export const metadata: Metadata = {
  title: "Veris · Research answers you can verify",
  description:
    "A citation-grounded research engine over arXiv. Navigate the research landscape, position your work, and trust every claim.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Loaded via the browser (not next/font) so a blocked Google Fonts request
            degrades gracefully to the CSS fallback stack instead of blank-screening. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="relative z-10 flex min-h-screen flex-col">
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-white/[0.06] py-8 text-center">
            <p className="font-mono text-xs text-mist">
              Veris · grounded synthesis over arXiv · built with FastAPI, pgvector & Claude
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
