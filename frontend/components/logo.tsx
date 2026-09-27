import clsx from "clsx";

/** Wordmark: a lens (circle) over a crosshair — the instrument through which Veris reads. */
export function Logo({ dark = false, className }: { dark?: boolean; className?: string }) {
  return (
    <span className={clsx("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" aria-hidden>
        <rect x="0.5" y="0.5" width="23" height="23" rx="5" fill={dark ? "#1F4FD8" : "#0A1A3F"} />
        <circle cx="12" cy="12" r="5.2" fill="none" stroke="#fff" strokeWidth="1.6" />
        <path d="M12 3.5v3.2M12 17.3v3.2M3.5 12h3.2M17.3 12h3.2" stroke="#B7CAFF" strokeWidth="1.3" strokeLinecap="round" />
        <circle cx="12" cy="12" r="1.5" fill="#4D7DFF" />
      </svg>
      <span
        className={clsx(
          "text-[17px] font-semibold uppercase tracking-[0.18em]",
          dark ? "text-white" : "text-ink",
        )}
      >
        Veris
      </span>
    </span>
  );
}
