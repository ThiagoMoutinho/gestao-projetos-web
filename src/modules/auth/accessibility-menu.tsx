"use client";

import { Accessibility } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";

const TEXT_SCALES = [100, 112.5, 125] as const;

export function AccessibilityMenu() {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const [scaleIndex, setScaleIndex] = useState(0);

  function applyScale(nextIndex: number) {
    const bounded = Math.min(TEXT_SCALES.length - 1, Math.max(0, nextIndex));
    setScaleIndex(bounded);
    document.documentElement.style.fontSize = `${TEXT_SCALES[bounded]}%`;
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full bg-background px-3"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <Accessibility />
        Acessibilidade
      </Button>
      {open ? (
        <div
          id={menuId}
          role="group"
          aria-label="Ajustes de acessibilidade"
          className="absolute top-full right-0 z-20 mt-2 w-52 space-y-1 rounded-xl border border-border bg-background p-2 shadow-lg"
        >
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start"
            disabled={scaleIndex === TEXT_SCALES.length - 1}
            onClick={() => applyScale(scaleIndex + 1)}
          >
            Aumentar texto
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start"
            disabled={scaleIndex === 0}
            onClick={() => applyScale(scaleIndex - 1)}
          >
            Diminuir texto
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start"
            disabled={scaleIndex === 0}
            onClick={() => applyScale(0)}
          >
            Texto padrão
          </Button>
        </div>
      ) : null}
    </div>
  );
}
