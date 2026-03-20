import { useMemo } from "react";
import { marked } from "marked";

marked.setOptions({
  breaks: true,
  gfm: true,
});

export default function Markdown({ content, className = "" }) {
  const html = useMemo(() => {
    if (!content) return "";
    return marked.parse(content);
  }, [content]);

  return (
    <div
      className={`prose prose-invert prose-sm max-w-none
        prose-headings:text-zinc-200 prose-headings:font-semibold prose-headings:mb-2 prose-headings:mt-4
        prose-p:text-zinc-400 prose-p:leading-relaxed
        prose-li:text-zinc-400 prose-li:marker:text-zinc-600
        prose-strong:text-zinc-300
        prose-code:text-amber-400 prose-code:bg-zinc-800 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
        prose-pre:bg-zinc-800 prose-pre:border prose-pre:border-zinc-700 prose-pre:rounded-lg
        prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
        prose-hr:border-zinc-800
        prose-table:text-sm
        prose-th:text-zinc-300 prose-th:border-zinc-700 prose-th:px-3 prose-th:py-1.5
        prose-td:text-zinc-400 prose-td:border-zinc-700 prose-td:px-3 prose-td:py-1.5
        ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
