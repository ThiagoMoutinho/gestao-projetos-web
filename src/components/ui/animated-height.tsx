"use client";

import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Anima as mudanças de altura do conteúdo (por exemplo, quando um esqueleto de carregamento dá lugar ao conteúdo
 * real), em vez de deixar a altura saltar. A primeira medição não anima; as seguintes sim. Respeita `motion-reduce`.
 */
export function AnimatedHeight({ children, className }: { children: React.ReactNode; className?: string }) {
  const [height, setHeight] = useState<number | null>(null);
  const observer = useRef<ResizeObserver | null>(null);

  // Ref de callback: o observador nasce com o elemento e é desligado quando ele sai da tela.
  const attach = (element: HTMLDivElement | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (element) {
      observer.current = new ResizeObserver(() => setHeight(element.offsetHeight));
      observer.current.observe(element);
    }
  };

  return (
    <div
      className={cn("overflow-hidden ease-out motion-reduce:transition-none", height !== null && "transition-[height] duration-300", className)}
      style={height === null ? undefined : { height }}
    >
      <div ref={attach}>{children}</div>
    </div>
  );
}
