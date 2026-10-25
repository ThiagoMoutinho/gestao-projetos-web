import type { ReactNode } from "react";

/**
 * Abre e fecha o conteúdo com transição de altura; fechado, fica fora do foco e da leitura de tela.
 * Com `bleed`, sobra uma margem de 4px para o anel de foco dos campos não ser cortado.
 */
export function Reveal({ open, bleed = true, children }: { open: boolean; bleed?: boolean; children: ReactNode }) {
  return (
    <div
      inert={!open}
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${bleed ? "-mx-1" : ""} ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
    >
      <div className="min-h-0 overflow-hidden">
        <div className={bleed ? "px-1 pb-1" : undefined}>{children}</div>
      </div>
    </div>
  );
}
