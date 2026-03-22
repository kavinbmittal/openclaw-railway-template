import { useMemo } from"react";
import { marked } from"marked";

marked.setOptions({ breaks: true, gfm: true });

// Auto-bold known labels (e.g. "what:" → "**what:**") so agent descriptions render cleanly
const LABEL_RE = /^(what|why|impact|goal|context|status|priority|assignee|theme|experiment|deliverable|outcome|hypothesis|method|duration|risk|dependencies|metrics|scope|background|proposal|approach|timeline|budget|resources|success criteria|expected outcome|proxy metric|contribution):/gmi;

function autoFormatLabels(text) {
 return text.replace(LABEL_RE, (match, label) => `**${label}:**`);
}

export default function Markdown({ content, className ="" }) {
 const html = useMemo(() => {
  if (!content) return"";
  return marked.parse(autoFormatLabels(content));
 }, [content]);

 return (
  <div
   className={`mc-prose text-[14px] ${className}`}
   dangerouslySetInnerHTML={{ __html: html }}
  />
 );
}
