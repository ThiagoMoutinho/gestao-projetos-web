"use client";

import { Bell, CircleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listMyNotifications } from "@/lib/api/generated/notificações-do-acompanhamento/notificações-do-acompanhamento";
import { cn } from "@/lib/utils";

import { notificationHref } from "./notification-destination";
import { EMPTY_FILTERS, type FeedItem } from "./notification-feed";
import { KindIcon } from "./notification-icons";
import {
  formatMoment,
  KIND_LABEL,
  pendingState,
  readState,
} from "./notification-state";
import { NOTIFICATIONS_CHANGED_EVENT, useNotificationFeed } from "./use-notification-feed";
import { useOpenNotification } from "./use-open-notification";

/** Intervalo da atualização periódica do contador (além do carregamento e do retorno do foco). */
const REFRESH_MS = 60_000;
/** Quantas notificações recentes o painel mostra; o histórico completo fica na Central. */
export const PANEL_SIZE = 3;

const PANEL_TAB_CLASS =
  "h-9 flex-none rounded-none px-0.5 text-xs font-medium text-[#667085] hover:text-[#344054] data-active:text-[#175cd3] after:bg-[#175cd3] group-data-horizontal/tabs:after:bottom-0";

export function bellLabel(count: number | null) {
  if (count === null) return "Notificações";
  if (count === 0) return "Notificações: nenhuma não lida";
  return count === 1 ? "Notificações: 1 não lida" : `Notificações: ${count} não lidas`;
}

function PanelItem({ item, opening, onOpen }: { item: FeedItem; opening: boolean; onOpen: (item: FeedItem, event: React.MouseEvent<HTMLElement>) => void }) {
  const unread = readState(item.readAt) === "UNREAD";
  const resolved = pendingState(item.resolvedAt) === "RESOLVED";
  return (
    <li data-state={unread ? "unread" : "read"} className="border-b border-[#edf0f3] last:border-b-0">
      <Link
        href={notificationHref(item)}
        onClick={(event) => onOpen(item, event)}
        aria-busy={opening || undefined}
        aria-label={`${unread ? "Não lida. " : ""}${item.title}. Abrir o projeto ${item.projectName}.`}
        className={cn(
          "flex gap-3 px-4 py-2.5 outline-none transition-colors duration-200 hover:bg-[#f2f6fd] focus-visible:ring-2 focus-visible:ring-[#175cd3]/40 focus-visible:ring-inset motion-reduce:transition-none",
          unread && "bg-[#f8fbff]",
          opening && "opacity-70",
        )}
      >
        <KindIcon kind={item.kind} muted={!unread} size="sm">
          {unread ? <span className="absolute -top-0.5 -left-0.5 size-2.5 rounded-full bg-[#175cd3] ring-2 ring-white" /> : null}
        </KindIcon>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.04em] text-[#667085] uppercase">
            <span className={cn(unread && "text-[#175cd3]")}>{KIND_LABEL[item.kind]}</span>
            <span aria-hidden className="size-0.5 rounded-full bg-[#98a2b3]" />
            <span className="font-normal normal-case tracking-normal">{formatMoment(item.deliveredAt ?? item.createdAt)}</span>
          </span>
          <span className={cn("line-clamp-2 text-[13px] leading-snug", unread ? "font-semibold text-[#172033]" : "font-normal text-[#667085]")}>{item.title}</span>
          <span className="truncate text-[11px] text-[#98a2b3]" title={item.projectName}>
            {item.projectName}
            {resolved ? " · Resolvida" : ""}
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * Sino do cabeçalho: contador de não lidas e painel suspenso com as notificações mais recentes (mesma fonte da Central:
 * a caixa de entrada do usuário). Abrir o painel não marca nada como lido; a leitura só aparece depois da confirmação da
 * API. O contador é atualizado ao carregar, ao recuperar o foco, a cada 60 s (aba visível) e quando uma leitura muda.
 */
export function NotificationBell() {
  const [count, setCount] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<"UNREAD" | "READ">("UNREAD");
  const headerRef = useRef<HTMLDivElement>(null);
  const filters = useMemo(() => ({ ...EMPTY_FILTERS, read: panelTab }), [panelTab]);
  const { state, refresh, markRead } = useNotificationFeed("mine", filters, open, PANEL_SIZE);
  const { opening, open: openNotification } = useOpenNotification(markRead, () => setOpen(false));
  // Na aba "Não lidas", o que acabou de ser lido (confirmado pela API) sai da lista; ele aparece em "Lidas".
  const visible = panelTab === "UNREAD" ? state.items.filter((item) => !item.readAt) : state.items;

  useEffect(() => {
    let active = true;
    const refreshCount = () => {
      listMyNotifications({ read: "false", limit: 1 })
        .then((response) => {
          if (active && response.status === 200) setCount(response.data.unread);
        })
        .catch(() => undefined); // Sem toast: o sino é secundário; mantém o último valor conhecido.
    };
    refreshCount();
    const visibleRefresh = () => {
      if (document.visibilityState === "visible") refreshCount();
    };
    const interval = window.setInterval(visibleRefresh, REFRESH_MS);
    window.addEventListener("focus", visibleRefresh);
    document.addEventListener("visibilitychange", visibleRefresh);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshCount);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", visibleRefresh);
      document.removeEventListener("visibilitychange", visibleRefresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refreshCount);
    };
  }, []);

  // Com o painel aberto e carregado, o total vem da própria consulta (o valor real do servidor).
  const shown = open && state.status === "ready" && state.unread !== null ? state.unread : count;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="outline" size="icon" aria-label={bellLabel(shown)} className="relative size-9 shrink-0 rounded-xl border-[#d7dce3] bg-white text-[#344054] transition-colors duration-200 hover:bg-[#f2f6fd] motion-reduce:transition-none" />}>
        <Bell className="size-[18px]" strokeWidth={1.75} aria-hidden />
        {shown ? (
          <span
            aria-hidden
            data-testid="notification-bell-count"
            className="absolute -top-2 -right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#175cd3] px-1 text-[11px] leading-none font-semibold text-white ring-2 ring-white"
          >
            {shown > 99 ? "99+" : shown}
          </span>
        ) : null}
        <span className="sr-only" aria-live="polite">
          {bellLabel(shown)}
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        // O foco inicial vai ao cabeçalho do painel (não ao último botão, como acontecia enquanto a lista carregava).
        initialFocus={headerRef}
        // 200 ms; com movimento reduzido nenhuma animação (a variante data-open vence animate-none, por isso as duas).
        className="w-[min(24rem,calc(100vw-1.5rem))] gap-0 p-0 duration-200 motion-reduce:data-closed:animate-none motion-reduce:data-open:animate-none"
      >
        <div ref={headerRef} tabIndex={-1} className="flex items-center justify-between gap-2 border-b border-[#edf0f3] px-3 py-2.5 outline-none">
          <PopoverTitle className="text-[13px] font-semibold text-[#172033]">Notificações</PopoverTitle>
          {shown ? <Badge className="h-5 bg-[#175cd3] px-2 text-[11px] text-white">{shown > 99 ? "99+" : shown} não lida{shown === 1 ? "" : "s"}</Badge> : null}
        </div>

        <Tabs value={panelTab} onValueChange={(value) => setPanelTab(value === "READ" ? "READ" : "UNREAD")} className="gap-0 border-b border-[#edf0f3] px-3">
          <TabsList variant="line" aria-label="Filtro de leitura" className="h-auto w-full justify-start gap-5 rounded-none p-0">
            <TabsTrigger value="UNREAD" className={PANEL_TAB_CLASS}>
              Não lidas
            </TabsTrigger>
            <TabsTrigger value="READ" className={PANEL_TAB_CLASS}>
              Lidas
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div role="tabpanel" aria-label={panelTab === "UNREAD" ? "Notificações não lidas" : "Notificações lidas"} className="max-h-[min(26rem,60vh)] overflow-y-auto">
          {state.status === "loading" ? (
            <div role="status" aria-busy="true" className="flex flex-col gap-2 p-3">
              <span className="sr-only">Carregando as notificações…</span>
              {Array.from({ length: 3 }, (_, index) => (
                <Skeleton key={index} className="h-14 w-full rounded-md motion-reduce:animate-none" />
              ))}
            </div>
          ) : state.status === "error" || state.status === "forbidden" ? (
            <div role="alert" className="flex flex-col items-start gap-2 p-4 text-sm">
              <span className="flex items-center gap-1.5 font-medium text-destructive">
                <CircleAlert className="size-4" aria-hidden /> Não foi possível carregar
              </span>
              <p className="text-xs text-muted-foreground">Verifique a conexão e tente novamente. Nada foi alterado.</p>
              <Button type="button" variant="outline" size="sm" onClick={refresh}>
                Tentar novamente
              </Button>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
              <Bell className="size-5 text-[#98a2b3]" aria-hidden />
              <p className="text-[13px] font-semibold text-[#172033]">{panelTab === "UNREAD" ? "Nenhuma notificação não lida" : "Nenhuma notificação lida"}</p>
              <p className="text-xs text-[#667085]">{panelTab === "UNREAD" ? "Você está em dia com os avisos." : "Os avisos que você ler ficam guardados aqui."}</p>
            </div>
          ) : (
            <ul aria-label="Notificações mais recentes">
              {visible.map((item) => (
                <PanelItem key={item.key} item={item} opening={opening === item.key} onOpen={openNotification} />
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-[#edf0f3] p-1.5">
          <Link href="/notificacoes" onClick={() => setOpen(false)} className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "w-full justify-center font-medium text-[#175cd3] hover:bg-[#eff4ff] hover:text-[#175cd3]")}>
            Ver todas
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
