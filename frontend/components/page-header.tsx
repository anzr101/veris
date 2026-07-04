import type { ReactNode } from "react";

export function PageHeader({
  index,
  kicker,
  title,
  children,
}: {
  index: string;
  kicker: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-14">
      <div className="eyebrow">
        <span className="index-num">{index}</span>
        <span className="h-px w-12 bg-white/15" />
        <span className="kicker">{kicker}</span>
      </div>
      <h1
        className="font-display font-normal tracking-tight text-bone-bright"
        style={{ fontSize: "clamp(2.4rem, 5vw, 3.6rem)", lineHeight: 1.02 }}
      >
        {title}
      </h1>
      {children && (
        <p className="mt-5 max-w-2xl text-[16.5px] leading-relaxed text-mist">{children}</p>
      )}
    </header>
  );
}
