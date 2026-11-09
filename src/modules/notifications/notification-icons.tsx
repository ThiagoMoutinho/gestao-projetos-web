import { CalendarX2, Hourglass, TriangleAlert, type LucideIcon } from "lucide-react";

import { createElement, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { KIND_TONE, TONE_CLASS, type NotificationKind } from "./notification-state";

/** Ícone de cada tipo de aviso (a Central e o painel do sino usam os mesmos). */
export const KIND_ICON: Record<NotificationKind, LucideIcon> = {
  PREVENTIVE: Hourglass,
  OVERDUE: CalendarX2,
  ESCALATION: TriangleAlert,
};

/** Emblema do tipo de aviso: círculo suave com o ícone em traço fino. Mesmo desenho no sino e na Central. */
export function KindIcon({ kind, muted = false, size = "md", children }: { kind: NotificationKind; muted?: boolean; size?: "sm" | "md"; children?: ReactNode }) {
  const tone = KIND_TONE[kind];
  const Icon = KIND_ICON[kind];
  return createElement(
    "span",
    { "aria-hidden": true, className: cn("relative flex shrink-0 items-center justify-center rounded-full", size === "sm" ? "size-8" : "size-9", TONE_CLASS[tone].icon, muted && "opacity-60") },
    createElement(Icon, { className: size === "sm" ? "size-4" : "size-[18px]", strokeWidth: 1.75 }),
    children,
  );
}
