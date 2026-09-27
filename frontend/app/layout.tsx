import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: { default: "Veris", template: "%s · Veris" },
  description: "Grounded answers from the research literature, with every claim verified.",
};

export const viewport: Viewport = {
  themeColor: "#061129",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Loaded by the browser rather than next/font so a blocked font request falls
            back to the system stack instead of failing the build. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='.5' y='.5' width='23' height='23' rx='5' fill='%230A1A3F'/%3E%3Ccircle cx='12' cy='12' r='5.2' fill='none' stroke='%23fff' stroke-width='1.6'/%3E%3Cpath d='M12 3.5v3.2M12 17.3v3.2M3.5 12h3.2M17.3 12h3.2' stroke='%23B7CAFF' stroke-width='1.3' stroke-linecap='round'/%3E%3Ccircle cx='12' cy='12' r='1.5' fill='%234D7DFF'/%3E%3C/svg%3E"
        />
      </head>
      <body>
        <div className="flex min-h-screen flex-col">
          <Nav />
          <main className="flex flex-1 flex-col">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
