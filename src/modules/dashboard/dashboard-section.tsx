import type { ReactNode } from "react";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { cn } from "@/lib/utils";

/** Cartão de seção dos painéis: título, descrição curta, ação opcional e rodapé discreto. */
export function DashboardSection({
  title,
  description,
  action,
  footer,
  className,
  contentClassName,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn("min-w-0 gap-0 py-0", className)}>
      <CardHeader className="border-b px-4 py-3.5 [.border-b]:pb-3.5">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {description ? <CardDescription className="text-xs">{description}</CardDescription> : null}
        {action ? <CardAction className="self-center">{action}</CardAction> : null}
      </CardHeader>
      <CardContent className={cn("px-0", contentClassName)}>{children}</CardContent>
      {footer ? <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">{footer}</div> : null}
    </Card>
  );
}

/** Estado vazio compacto para dentro das seções. */
export function SectionEmpty({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <Empty className="gap-3 border-0 px-4 py-8">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle className="text-sm">{title}</EmptyTitle>
        <EmptyDescription className="text-xs">{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/** Ponto colorido com halo suave, o mesmo dos indicadores da listagem. */
export function StatusDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("size-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color, boxShadow: `0 0 0 4px ${color}26` }}
    />
  );
}
