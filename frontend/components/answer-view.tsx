"use client";

import { Children, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Citation } from "@/lib/types";
import { CiteRef } from "./cite-ref";

/** Replace inline [n] markers in text nodes with interactive citation pills. */
function citeify(children: ReactNode, byIndex: Map<number, Citation>): ReactNode {
  return Children.map(children, (child, ci) => {
    if (typeof child !== "string") return child;
    const parts = child.split(/(\[\d+\])/g);
    return parts.map((part, pi) => {
      const m = part.match(/^\[(\d+)\]$/);
      if (m) {
        const idx = Number(m[1]);
        return <CiteRef key={`${ci}-${pi}`} index={idx} citation={byIndex.get(idx)} />;
      }
      return part;
    });
  });
}

export function AnswerView({
  markdown,
  citations,
  streaming,
}: {
  markdown: string;
  citations: Citation[];
  streaming?: boolean;
}) {
  const byIndex = new Map(citations.map((c) => [c.index, c]));
  const cite = (children: ReactNode) => citeify(children, byIndex);

  return (
    <div className={`prose-veris ${streaming ? "streaming-caret" : ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{cite(children)}</p>,
          li: ({ children }) => <li>{cite(children)}</li>,
          strong: ({ children }) => <strong>{cite(children)}</strong>,
          em: ({ children }) => <em>{cite(children)}</em>,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
