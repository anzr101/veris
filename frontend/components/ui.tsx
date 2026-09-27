import clsx from "clsx";
import type { ReactNode } from "react";

/** Registration marks at the four corners of a panel — the lab-instrument signature. */
export function Corners({ dark = false, className }: { dark?: boolean; className?: string }) {
  const c = dark ? "border-blue-bright/70" : "border-blue/60";
  const base = clsx("pointer-events-none absolute h-2.5 w-2.5", c);
  return (
    <span aria-hidden className={className}>
      <span className={clsx(base, "-left-px -top-px border-l border-t")} />
      <span className={clsx(base, "-right-px -top-px border-r border-t")} />
      <span className={clsx(base, "-bottom-px -left-px border-b border-l")} />
      <span className={clsx(base, "-bottom-px -right-px border-b border-r")} />
    </span>
  );
}

/** Section heading: figure index, title, optional trailing slot. */
export function SectionHead({
  index,
  title,
  aside,
  dark = false,
}: {
  index: string;
  title: string;
  aside?: ReactNode;
  dark?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className={clsx("flex items-center gap-3", dark ? "label-dark" : "label")}>
          <span className={dark ? "text-blue-bright" : "text-blue"}>{index}</span>
          <span className={clsx("h-px w-8", dark ? "bg-navy-line" : "bg-line")} />
        </div>
        <h2
          className={clsx(
            "mt-3 text-[30px] font-light leading-[1.1] tracking-[-0.02em] sm:text-[38px]",
            dark ? "text-white" : "text-ink",
          )}
        >
          {title}
        </h2>
      </div>
      {aside}
    </div>
  );
}

/** A measured value with its unit and caption. */
export function Readout({
  value,
  unit,
  caption,
  dark = false,
}: {
  value: ReactNode;
  unit?: string;
  caption: string;
  dark?: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span
          className={clsx(
            "text-[40px] font-light leading-none tracking-[-0.03em] sm:text-[48px]",
            dark ? "text-white" : "text-ink",
          )}
        >
          {value}
        </span>
        {unit && <span className={clsx("text-[15px]", dark ? "text-blue-ice/60" : "text-muted")}>{unit}</span>}
      </div>
      <div className={clsx("mt-2.5", dark ? "label-dark" : "label")}>{caption}</div>
    </div>
  );
}

export function PageHead({ index, title, meta }: { index: string; title: string; meta?: ReactNode }) {
  return (
    <header className="border-b border-line pb-8">
      <div className="label flex items-center gap-3">
        <span className="text-blue">{index}</span>
        <span className="h-px w-8 bg-line" />
      </div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-6">
        <h1 className="text-[44px] font-light leading-none tracking-[-0.03em] sm:text-[60px]">{title}</h1>
        {meta && <div className="text-[13px] text-muted">{meta}</div>}
      </div>
    </header>
  );
}
