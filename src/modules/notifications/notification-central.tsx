"use client";

import { Bell, BellOff, List, ShieldAlert, type LucideIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { ComboOption } from "@/components/option-combobox";
import { PageLoadError } from "@/components/page-load-error";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listProjects } from "@/lib/api/generated/projetos/projetos";

import { NotificationCard } from "./notification-card";
import { EMPTY_FILTERS, hasListFilters, type FeedFilters, type FeedTab } from "./notification-feed";
import { notificationAccess } from "./notification-access";
import { NotificationFilters } from "./notification-filters";
import { useNotificationFeed } from "./use-notification-feed";
import { useOpenNotification } from "./use-open-notification";

const TAB_CLASS =
  "h-9 flex-none rounded-none px-0.5 text-xs font-medium text-muted-foreground hover:text-foreground data-active:text-primary after:bg-primary group-data-horizontal/tabs:after:bottom-0";

function FeedSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-2.5">
      <span className="sr-only">Carregando as notificações…</span>
      {Array.from({ length: 3 }, (_, index) => (
        <Skeleton key={index} className="h-[112px] w-full rounded-[10px] motion-reduce:animate-none" />
      ))}
    </div>
  );
}

/** Estado vazio no padrão da lista de Projetos: cartão proporcional ao conteúdo, ícone discreto, título e mensagem. */
function FeedEmpty({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description: string; action?: React.ReactNode }) {
  return (
    <Empty className="mx-auto max-w-xl flex-none gap-3 p-6">
      <EmptyHeader className="gap-1.5">
        <EmptyMedia variant="icon">
          <Icon aria-hidden />
        </EmptyMedia>
        <EmptyTitle className="text-sm font-semibold text-foreground">{title}</EmptyTitle>
        <EmptyDescription className="text-xs text-muted-foreground">{description}</EmptyDescription>
      </EmptyHeader>
      {action}
    </Empty>
  );
}

function unreadText(unread: number | null) {
  if (unread === null) return "Carregando…";
  if (unread === 0) return "nenhuma não lida";
  return unread === 1 ? "1 não lida" : `${unread} não lidas`;
}

/**
 * Central de Notificações: "Minhas" (todos os perfis) e "Todas" (ADMIN e PMO). Mostra somente avisos efetivamente
 * entregues; simulações e avisos adiados não são notificações. Ler não resolve a pendência e nada pode ser excluído.
 * O layout segue a lista de Projetos: cabeçalho institucional e um cartão único com abas, filtros, contagem e lista.
 */
export function NotificationCentral({ role, initialTab }: { role: string | null; initialTab: FeedTab }) {
  const access = notificationAccess(role);
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<FeedTab>(initialTab === "all" && !access.canViewAll ? "mine" : initialTab);
  const [filters, setFilters] = useState<FeedFilters>(EMPTY_FILTERS);
  const [projects, setProjects] = useState<ComboOption[]>([]);
  const allowed = tab === "mine" || access.canViewAll;
  const { state, marking, loadMore, refresh, markRead } = useNotificationFeed(tab, filters, allowed);
  const { opening, open: openNotification } = useOpenNotification(markRead);

  useEffect(() => {
    let active = true;
    listProjects()
      .then((response) => {
        if (active && response.status === 200) {
          setProjects(response.data.data.map((project) => ({ value: project.id, label: project.name })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR")));
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  function changeTab(next: FeedTab) {
    if (next === tab) return;
    setTab(next);
    setFilters(EMPTY_FILTERS);
    router.replace(`${pathname}?aba=${next === "all" ? "todas" : "minhas"}`, { scroll: false });
  }

  function changeRead(value: string | number | null) {
    setFilters((current) => ({ ...current, read: value === "UNREAD" || value === "READ" ? value : "" }));
  }

  const listFiltered = hasListFilters(filters);
  // Limpar filtros mantém a aba de leitura escolhida (Todas / Não lidas / Lidas).
  const clearFilters = () => setFilters({ ...EMPTY_FILTERS, read: filters.read });
  const shown = state.items.length;
  const scopeLabel = tab === "mine" ? "Minhas notificações" : "Todas as notificações";

  return (
    <div className="mx-auto flex w-full max-w-[90rem] min-w-0 flex-col gap-5">
      <header>
        <span className="block text-[10px] font-bold tracking-[0.14em] text-primary uppercase">Acompanhamento semanal</span>
        <h1 className="mt-1.5 text-2xl font-medium tracking-tight text-foreground">Central de Notificações</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Avisos sobre a validação semanal do resumo executivo dos projetos da CTIN.</p>
      </header>

      <Tabs
        value={tab}
        onValueChange={(value) => changeTab(value === "all" ? "all" : "mine")}
        className="min-w-0 gap-0 overflow-hidden rounded-[10px] border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
      >
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-5 border-b border-border/60 px-4 pt-2">
          <TabsList variant="line" aria-label="Escopo das notificações" className="h-auto justify-start gap-5 overflow-x-auto rounded-none p-0">
            <TabsTrigger value="mine" className={TAB_CLASS}>
              Minhas notificações
              {state.unread && tab === "mine" ? (
                <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-none font-semibold text-primary-foreground">
                  {state.unread > 99 ? "99+" : state.unread}
                </span>
              ) : null}
            </TabsTrigger>
            {access.canViewAll ? (
              <TabsTrigger value="all" className={TAB_CLASS}>
                Todas as notificações
              </TabsTrigger>
            ) : null}
          </TabsList>
          <Tabs value={filters.read || "ALL"} onValueChange={changeRead}>
            <TabsList variant="line" aria-label="Situação de leitura" className="h-auto justify-start gap-5 rounded-none p-0">
              <TabsTrigger value="ALL" className={TAB_CLASS}>
                Todas
              </TabsTrigger>
              <TabsTrigger value="UNREAD" className={TAB_CLASS} title={tab === "all" ? "Ainda há destinatários que não leram" : undefined}>
                Não lidas
              </TabsTrigger>
              <TabsTrigger value="READ" className={TAB_CLASS} title={tab === "all" ? "Todos os destinatários leram" : undefined}>
                Lidas
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <TabsContent value={tab} className="flex flex-col">
          {allowed ? (
            <div className="flex flex-col gap-3 p-4">
              <NotificationFilters filters={filters} projects={projects} onChange={setFilters} />
              <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5" aria-live="polite">
                  <List className="size-3.5" aria-hidden />
                  {state.status === "ready"
                    ? `${shown === 1 ? "1 notificação listada" : `${shown} notificações listadas`}${state.nextCursor ? " (há mais)" : ""} · ${scopeLabel}${tab === "mine" ? ` · ${unreadText(state.unread)}` : ""}`
                    : `${scopeLabel}${tab === "mine" ? ` · ${unreadText(state.unread)}` : ""}`}
                </span>
                {listFiltered ? (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="rounded-sm font-medium text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary/25 focus-visible:outline-none"
                  >
                    Limpar filtros
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div key={`${tab}:${state.status}`} className="motion-fade border-t border-border/60 bg-muted/50 p-4">
            {!allowed || state.status === "forbidden" ? (
              <FeedEmpty
                icon={ShieldAlert}
                title="Sem permissão"
                description='Somente ADMIN e PMO consultam as notificações de todos os destinatários. As suas continuam em "Minhas notificações".'
                action={
                  <Button type="button" variant="outline" size="sm" onClick={() => changeTab("mine")}>
                    Ver minhas notificações
                  </Button>
                }
              />
            ) : state.status === "loading" ? (
              <FeedSkeleton />
            ) : state.status === "error" ? (
              <PageLoadError
                title="Não foi possível carregar as notificações"
                description="Verifique a conexão e tente novamente. Nada foi alterado na sua sessão."
                onRetry={refresh}
                compact
                className="mx-auto max-w-xl"
              />
            ) : state.items.length === 0 ? (
              <FeedEmpty
                icon={listFiltered ? BellOff : Bell}
                title={listFiltered ? "Nenhuma notificação encontrada" : filters.read === "UNREAD" ? "Nenhuma notificação não lida" : filters.read === "READ" ? "Nenhuma notificação lida" : tab === "mine" ? "Nenhuma notificação por aqui" : "Nenhuma notificação entregue"}
                description={
                  listFiltered
                    ? "Os filtros aplicados não encontraram notificações. Ajuste ou limpe os filtros para ver as demais."
                    : filters.read === "UNREAD"
                      ? "Você está em dia: não há avisos aguardando leitura. As já lidas continuam na aba Lidas."
                      : filters.read === "READ"
                        ? "Os avisos que forem lidos ficam guardados aqui, como histórico."
                        : "Quando houver avisos efetivamente entregues, eles aparecem aqui e permanecem no histórico."
                }
                action={
                  listFiltered ? (
                    <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                      Limpar filtros
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <ul aria-label={scopeLabel} className="flex flex-col gap-2.5">
                {state.items.map((item) => (
                  <NotificationCard key={item.key} item={item} tab={tab} marking={marking === item.deliveryId} opening={opening === item.key} onMarkRead={markRead} onOpen={openNotification} />
                ))}
              </ul>
            )}
          </div>

          {allowed && state.status === "ready" && state.items.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
              <span>
                {state.nextCursor
                  ? `Exibindo as ${shown} mais recentes.`
                  : "Fim do histórico. Notificações são registros permanentes: lidas ou resolvidas, elas continuam aqui."}
              </span>
              {state.nextCursor ? (
                <div className="flex items-center gap-2">
                  {state.loadMoreFailed ? <span className="text-destructive">Não foi possível carregar mais.</span> : null}
                  <Button type="button" variant="outline" size="sm" loading={state.loadingMore} onClick={loadMore} className="border-input bg-card">
                    {state.loadMoreFailed ? "Tentar novamente" : "Carregar mais"}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </TabsContent>
      </Tabs>

      <p className="-mt-2 text-[11px] text-muted-foreground">Aqui aparecem somente avisos efetivamente entregues; simulações e avisos adiados não são notificações.</p>
    </div>
  );
}
