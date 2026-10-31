"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const DURATION_MS = 300;

/**
 * Mostra e esconde um bloco com transição suave de altura e opacidade (útil ao alternar visualização e edição).
 * O conteúdo só existe na tela enquanto está aberto ou animando: fechado, não ocupa espaço nem recebe foco.
 * Respeita `prefers-reduced-motion`.
 */
export function Presence({
  open,
  children,
  className,
  expansion = false,
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
  /** Marca o bloco como expansão opcional do cartão (Ver todos, detalhes): não conta na altura de referência compartilhada. */
  expansion?: boolean;
}) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);

  // Ao abrir, monta já neste render (começa fechado) e a transição roda no quadro seguinte.
  if (open && !mounted) {
    setMounted(true);
  }

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        setShown(open);
        if (!open) {
          timer = setTimeout(() => setMounted(false), DURATION_MS);
        }
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
      clearTimeout(timer);
    };
  }, [open]);

  if (!mounted) {
    return null;
  }

  return (
    <div
      inert={!open}
      data-expansion={expansion || undefined}
      className={cn("grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none", shown ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0", className)}
    >
      {/* A folga de 4px fica dentro da área recortada (margem negativa + padding) para não cortar o anel de foco dos campos. */}
      <div className="-m-1 min-h-0 overflow-hidden p-1">
        <div className="h-full">{children}</div>
      </div>
    </div>
  );
}
