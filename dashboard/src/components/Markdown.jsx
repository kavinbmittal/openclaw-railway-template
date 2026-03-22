import { useMemo } from"react";
import { marked } from"marked";

marked.setOptions({ breaks: true, gfm: true });

export default function Markdown({ content, className ="" }) {
 const html = useMemo(() => {
  if (!content) return"";
  return marked.parse(content);
 }, [content]);

 return (
  <div
   className={`mc-prose text-[14px] ${className}`}
   dangerouslySetInnerHTML={{ __html: html }}
  />
 );
}
