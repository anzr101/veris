"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";

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
        "group relative flex items-end gap-3 rounded-lg border bg-surface transition-[border-color,box-shadow] duration-200",
        "border-line focus-within:border-blue/50 focus-within:shadow-glow",
        lg ? "py-2.5 pl-5 pr-2.5 shadow-field" : "py-1.5 pl-4 pr-1.5",
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
          lg ? "py-2 text-[17px] leading-[1.5]" : "py-1.5 text-[15px] leading-[1.5]",
        )}
      />
      <button
        type="submit"
        disabled={!ready}
        aria-label="Ask"
        className={clsx(
          "flex flex-none items-center justify-center gap-2 rounded-md font-medium transition-all duration-200",
          lg ? "h-11 px-4 text-[14px]" : "h-9 px-3 text-[13px]",
          ready ? "bg-blue text-white hover:bg-[#1A43BA] active:scale-[0.97]" : "bg-paper-deep text-faint",
        )}
      >
        {lg && <span className="hidden sm:inline">Analyse</span>}
        <ArrowRight className="h-4 w-4" strokeWidth={2} />
      </button>
    </form>
  );
}
