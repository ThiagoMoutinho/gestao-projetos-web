"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { safeUrl } from "@/lib/rich-text";
import { cn } from "@/lib/utils";

/**
 * Renderização segura do Markdown dos textos narrativos: nenhum HTML bruto é interpretado (o `react-markdown`
 * não executa HTML) e só links http, https e mailto são mantidos. Quebras de linha simples são preservadas,
 * então os textos antigos, gravados como texto puro, continuam com os mesmos parágrafos.
 */
const components: Components = {
  h1: ({ children }) => <h3 className="mt-2 mb-0.5 text-[13px] font-semibold text-foreground first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-2 mb-0.5 text-[13px] font-semibold text-foreground first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-1.5 mb-0.5 text-xs font-semibold text-foreground first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mt-1.5 mb-0.5 text-xs font-semibold text-foreground first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="mb-1.5 list-disc space-y-0.5 pl-5 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="mb-1.5 list-decimal space-y-0.5 pl-5 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
  a: ({ href, children }) => {
    const safe = href ? safeUrl(href) : null;
    return safe ? (
      <a href={safe} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline underline-offset-2 hover:opacity-80">
        {children}
      </a>
    ) : (
      <span>{children}</span>
    );
  },
};

export function RichText({ markdown, className }: { markdown: string; className?: string }) {
  return (
    <div className={cn("text-xs leading-relaxed break-words text-foreground/85", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={components}
        urlTransform={(url) => safeUrl(url) ?? ""}
        disallowedElements={["img", "script", "iframe"]}
        unwrapDisallowed
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
