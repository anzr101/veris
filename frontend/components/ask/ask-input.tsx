"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowUp, CornerDownLeft } from "lucide-react";

const MAX = 500;

export function AskInput({
  onSubmit,
  initial = "",
  size = "lg",
  busy = false,
  autoFocus = false,
}: {
  onSubmit: (q: string) => void;
  initial?: string;
  size?: "lg" | "sm";
  busy?: boolean;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setValue(initial), [initial]);

  // Grow with the question, up to a few lines. Re-measure when the width or the web
  // font changes, since both reflow the text.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "0px";
      el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
    };
    fit();
    let lastW = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth !== lastW) {
        lastW = el.clientWidth;
        fit();
      }
    });
    ro.observe(el);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, [value]);

  useEffect(() => {
    if (autoFocus) ref.current?.focus({ preventScroll: true });
  }, [autoFocus]);

  const submit = () => {
    const q = value.trim();
    if (q.length < 3 || busy) return;
    onSubmit(q);
  };

  const lg = size === "lg";
  const ready = value.trim().length >= 3 && !busy;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className={clsx(
        "group relative flex items-end gap-3 border border-line bg-surface transition-[border-color,box-shadow] duration-200",
        "focus-within:border-ink/25 focus-within:shadow-float",
        lg ? "rounded-[20px] py-3 pl-6 pr-3 shadow-field" : "rounded-2xl py-2 pl-4 pr-2",
      )}
    >
      <textarea
        ref={ref}
        rows={1}
        value={value}
        maxLength={MAX}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder="Ask a research question"
        aria-label="Research question"
        className={clsx(
          "flex-1 resize-none bg-transparent text-ink placeholder:text-faint focus:outline-none",
          lg ? "py-2 text-[18px] leading-[1.5]" : "py-1.5 text-[15px] leading-[1.5]",
        )}
      />
      <span
        className={clsx(
          "mb-2.5 hidden items-center gap-1 font-mono text-[11px] text-faint transition-opacity sm:flex",
          lg && value.trim() ? "opacity-100" : "opacity-0",
        )}
      >
        <CornerDownLeft className="h-3 w-3" />
      </span>
      <button
        type="submit"
        disabled={!ready}
        aria-label="Ask"
        className={clsx(
          "flex flex-none items-center justify-center rounded-full transition-all duration-200",
          lg ? "h-11 w-11" : "h-9 w-9",
          ready
            ? "bg-ink text-paper hover:bg-accent active:scale-95"
            : "bg-ink/[0.06] text-faint",
        )}
      >
        <ArrowUp className={lg ? "h-[18px] w-[18px]" : "h-4 w-4"} strokeWidth={2} />
      </button>
    </form>
  );
}
