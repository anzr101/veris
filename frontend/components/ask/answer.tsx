"use client";

import { Children, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Citation } from "@/lib/types";
import { Cite } from "./cite";

/** Turn inline [n] / [n, m] markers inside text nodes into citation marks. */
function citeify(
  children: ReactNode,
  byIndex: Map<number, Citation>,
  onFocus?: (i: number | null) => void,
): ReactNode {
  return Children.map(children, (child, ci) => {
    if (typeof child !== "string") return child;
    const marker = /^\[(\d+(?:\s*[,;]\s*\d+)*)\]$/;
    const parts = child.split(/(\[\d+(?:\s*[,;]\s*\d+)*\])/g);
    return parts.map((part, pi) => {
      const m = part.match(marker);
      // Hug the mark to the preceding word, as in print ("returns³" not "returns ³").
      if (!m) {
        let text = part;
        if (marker.test(parts[pi + 1] ?? "")) text = text.replace(/\s+$/, "");
        if (marker.test(parts[pi - 1] ?? "")) text = text.replace(/^\s+(?=[.,;:!?)])/, "");
        return text;
      }
      return m[1].split(/\s*[,;]\s*/).map((n, k) => {
        const idx = Number(n);
        return (
          <Cite key={`${ci}-${pi}-${k}`} index={idx} citation={byIndex.get(idx)} onFocus={onFocus} />
        );
      });
    });
  });
}

// Browsing-style markers some open models emit mid-stream: 【3†L4-L6】, [3†source], 【3】.
const ALT_MARKER = /[【[](\d{1,3})†[^】\]]*[】\]]|【(\d{1,3})】/g;

export function Answer({
  markdown,
  citations,
  streaming,
  onCiteFocus,
}: {
  markdown: string;
  citations: Citation[];
  streaming?: boolean;
  onCiteFocus?: (i: number | null) => void;
}) {
  const byIndex = new Map(citations.map((c) => [c.index, c]));
  const cite = (children: ReactNode) => citeify(children, byIndex, onCiteFocus);

  return (
    <div className={`prose-answer ${streaming ? "streaming" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{cite(children)}</p>,
          li: ({ children }) => <li>{cite(children)}</li>,
          strong: ({ children }) => <strong>{cite(children)}</strong>,
          em: ({ children }) => <em>{cite(children)}</em>,
          td: ({ children }) => <td>{cite(children)}</td>,
        }}
      >
        {markdown.replace(ALT_MARKER, (_, a, b) => `[${a ?? b}]`)}
      </ReactMarkdown>
    </div>
  );
}
