"use client";

import { BellRing, CheckCircle2, Clock3, FolderKanban, MailOpen } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { notificationHref } from "./notification-destination";
import type { FeedItem, FeedTab } from "./notification-feed";
import { KindIcon } from "./notification-icons";
import {
  cycleSummary,
  formatMoment,
  KIND_LABEL,
  KIND_TONE,
  pendingState,
  PENDING_LABEL,
  readState,
  READ_LABEL,
  resolutionLabel,
  TONE_CLASS,
  unreadSummary,
} from "./notification-state";

/** Leitura (por destinatário) e pendência (da notificação) são estados diferentes e aparecem sempre lado a lado. */
function StateBadges({ item, tab }: { item: FeedItem; tab: FeedTab }) {
  const pending = pendingState(item.resolvedAt);
  const read = tab === "mine" ? readState(item.readAt) : null;
  const allRead = tab === "all" && item.recipients !== null && item.unread !== null ? item.unread === 0 : null;
  const unread = read === "UNREAD" || allRead === false;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" className={cn("h-6 gap-1 px-2 py-[3px] text-[11px]", unread ? "border-primary/50 bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground")}>
        {unread ? <BellRing data-icon="inline-start" aria-hidden /> : <MailOpen data-icon="inline-start" aria-hidden />}
        {tab === "mine" && read ? READ_LABEL[read] : unreadSummary(item.unread ?? 0, item.recipients ?? 0)}
      </Badge>
      <Badge
        variant="outline"
        className={cn("h-6 gap-1 px-2 py-[3px] text-[11px]", pending === "PENDING" ? "border-warning/40 bg-warning/10 text-warning-foreground" : "border-success/30 bg-success/10 text-success-foreground")}
      >
        {pending === "PENDING" ? <Clock3 data-icon="inline-start" aria-hidden /> : <CheckCircle2 data-icon="inline-start" aria-hidden />}
        {PENDING_LABEL[pending]}
        {pending === "RESOLVED" ? <span className="font-normal">· {resolutionLabel(item.resolutionReason)}</span> : null}
      </Badge>
    </div>
  );
}

export function NotificationCard({
  item,
  tab,
  marking,
  opening,
  onMarkRead,
  onOpen,
}: {
  item: FeedItem;
  tab: FeedTab;
  marking: boolean;
  opening: boolean;
  onMarkRead: (item: FeedItem) => void;
  onOpen: (item: FeedItem, event: React.MouseEvent<HTMLElement>) => void;
}) {
  const tone = KIND_TONE[item.kind];
  const unread = tab === "mine" ? !item.readAt : (item.unread ?? 0) > 0;
  const resolved = pendingState(item.resolvedAt) === "RESOLVED";
  // Exige atenção: ainda não lida (por você, ou por algum destinatário) e a pendência continua aberta.
  const attention = unread && !resolved;
  const cycle = cycleSummary(item);
  // Marcar como lida é individual (só na aba "Minhas") e independente da navegação; ler nunca resolve a pendência.
  const canMarkRead = tab === "mine" && item.deliveryId !== null && !item.readAt;

  return (
    <li>
      <article
        data-state={unread ? "unread" : "read"}
        data-attention={attention || undefined}
        className={cn(
          "relative overflow-hidden rounded-[10px] border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-colors duration-200 motion-reduce:transition-none",
          unread ? "border-primary/25 bg-primary/5" : "border-border",
          !unread && resolved && "bg-muted/50",
        )}
      >
        {/* Faixa lateral só nas que pedem atenção: o resto da lista fica sóbrio. */}
        {attention ? <span aria-hidden className={cn("absolute inset-y-0 left-0 w-[3px] opacity-80", TONE_CLASS[tone].rail)} /> : null}
        <div className="flex flex-col gap-2.5 p-3.5 pl-4">
          {/* Área de abertura: ícone, título e mensagem levam ao projeto. Os botões ficam fora dela (sem interativos aninhados). */}
          <Link
            href={notificationHref(item)}
            onClick={(event) => onOpen(item, event)}
            aria-busy={opening || undefined}
            aria-label={`${unread ? "Não lida. " : ""}${item.title}. Abrir o projeto ${item.projectName}.`}
            className={cn(
              "-m-1.5 flex items-start gap-3 rounded-lg p-1.5 outline-none transition-colors duration-200 hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transition-none",
              opening && "opacity-70",
            )}
          >
            <KindIcon kind={item.kind} muted={!unread} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {unread ? <span aria-hidden className="size-2 shrink-0 rounded-full bg-primary" /> : null}
                <Badge variant="outline" className={cn("h-5 px-2 py-0 text-[11px]", TONE_CLASS[tone].badge)}>
                  {KIND_LABEL[item.kind]}
                </Badge>
                <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                  <span className="sr-only">Recebida em </span>
                  {formatMoment(item.deliveredAt ?? item.createdAt)}
                </span>
              </div>
              <h3 className={cn("text-[13px] leading-snug text-foreground", unread ? "font-semibold" : "font-medium")}>
                {unread ? <span className="sr-only">Não lida. </span> : null}
                {item.title}
              </h3>
              {/* Conteúdo congelado pelo backend, exibido como foi gerado (sem reescrita). */}
              <p className="text-xs leading-relaxed whitespace-pre-line text-muted-foreground">{item.body}</p>
              <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                <span className="flex min-w-0 max-w-full items-center gap-1.5">
                  <FolderKanban className="size-3.5 shrink-0" aria-hidden />
                  <span className="truncate" title={item.projectName}>
                    {item.projectName}
                  </span>
                </span>
                <span aria-hidden className="hidden sm:inline">·</span>
                <span>{cycle.label === "Ciclo" ? `Ciclo ${cycle.value}` : `${cycle.label} ${cycle.value}`}</span>
              </p>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-2 pl-12">
            <StateBadges item={item} tab={tab} />
            {canMarkRead ? (
              <Button type="button" variant="ghost" size="xs" loading={marking} onClick={() => onMarkRead(item)} className="ml-auto text-primary hover:bg-primary/10 hover:text-primary">
                <MailOpen data-icon="inline-start" aria-hidden />
                Marcar como lida
              </Button>
            ) : null}
          </div>
        </div>
      </article>
    </li>
  );
}
