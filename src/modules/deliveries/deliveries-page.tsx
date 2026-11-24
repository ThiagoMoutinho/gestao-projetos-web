"use client";

import { ListChecks, CircleAlert, CircleCheck, Clock, Eye, PackageCheck, PackagePlus, Plus, Search, SearchX, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { OptionCombobox } from "@/components/option-combobox";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EditDialogBody, EditDialogContent, EditDialogFooter, EditDialogHeader } from "@/components/ui/edit-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NATURE_LABEL } from "@/modules/projects/delivery-compliance";
import { stamp } from "@/modules/projects/institutional-shared";
import { paginate } from "@/modules/projects/project-portfolio";

import { DELIVERY_STATUS, deliveryTitle, deliveryTotals, filterDeliveries, type DeliveryStatus } from "./deliveries-portfolio";
import { DeliveryPagination } from "./delivery-pagination";
import { DeliverySheet, ToneBadge } from "./delivery-sheet";
import { HomologationsView } from "./homologations-view";
import { TemplatesView } from "./templates-view";
import type { DeliveriesSnapshot, DeliveryRecord } from "./load-deliveries";

const STATUS_OPTIONS = [{ value: "", label: "Todos os status" }, ...(Object.keys(DELIVERY_STATUS) as DeliveryStatus[]).map((value) => ({ value, label: DELIVERY_STATUS[value].label }))];

const shortDay = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

function Kpi({ icon: Icon, label, value, tone }: { icon: typeof PackageCheck; label: string; value: number; tone: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card px-3.5 py-3.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:gap-3.5 sm:px-4 dark:border-border">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-black/5 ring-inset sm:size-11 dark:ring-white/10 ${tone}`} aria-hidden="true">
        <Icon className="size-4 sm:size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-xs leading-tight text-muted-foreground">{label}</p>
        <p className="text-2xl leading-tight font-semibold tabular-nums">{value}</p>
      </div>
    </div>
  );
}

/**
 * Tela institucional Entregas e Homologações. Etapa 1: aba Entregas (indicadores, busca, filtros, tabela e paginação) com o painel
 * de detalhes. Homologações e Modelos de checklist aparecem no menu das abas, desativadas, até as próximas etapas.
 */
export function DeliveriesPage({ snapshot, viewerRole }: { snapshot: DeliveriesSnapshot; viewerRole: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<"entregas" | "homologacoes" | "modelos">("entregas");
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [status, setStatus] = useState<DeliveryStatus | "">("");
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<DeliveryRecord | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newProject, setNewProject] = useState("");

  const totals = useMemo(() => deliveryTotals(snapshot.rows), [snapshot.rows]);
  const visible = useMemo(() => filterDeliveries(snapshot.rows, { query, projectId, status }), [snapshot.rows, query, projectId, status]);
  const paged = paginate(visible, page, pageSize);
  const filtered = query.trim() !== "" || projectId !== "" || status !== "";
  const projectOptions = [{ value: "", label: "Todos os projetos" }, ...snapshot.projects.map((project) => ({ value: project.id, label: project.name }))];

  function open(record: DeliveryRecord) {
    setSelected(record);
    setSheetOpen(true);
  }
  function clear() {
    setQuery("");
    setProjectId("");
    setStatus("");
    setPage(1);
  }

  return (
    <div className="mx-auto flex w-full max-w-[90rem] flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground" aria-hidden="true">
            <PackageCheck className="size-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-primary uppercase">Acompanhamento institucional</p>
            <h1 className="text-2xl leading-[1.25] font-semibold tracking-[-0.025em] text-foreground">Entregas e Homologações</h1>
            <p className="text-body text-muted-foreground">Acompanhe as entregas dos projetos, as homologações e os modelos de checklist.</p>
          </div>
        </div>
        <Button type="button" onClick={() => setCreating(true)} disabled={snapshot.projects.length === 0}>
          <Plus aria-hidden="true" /> Nova entrega
        </Button>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as "entregas" | "homologacoes" | "modelos")}>
        <TabsList variant="line" aria-label="Seções de Entregas e Homologações" className="h-auto w-full justify-start gap-5 overflow-x-auto rounded-none border-b border-border p-0">
          <TabsTrigger value="entregas" className="flex-none gap-2 px-1 py-3 text-body">
            <PackageCheck aria-hidden="true" /> Entregas
          </TabsTrigger>
          <TabsTrigger value="homologacoes" className="flex-none gap-2 px-1 py-3 text-body">
            <CircleCheck aria-hidden="true" /> Homologações
          </TabsTrigger>
          <TabsTrigger value="modelos" className="flex-none gap-2 px-1 py-3 text-body">
            <ListChecks aria-hidden="true" /> Modelos de checklist
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {snapshot.unavailable > 0 ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-status-attention/30 bg-status-attention-soft px-3 py-2.5 text-xs text-status-attention-ink">
          <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden="true" />
          {snapshot.unavailable === 1 ? "As entregas de 1 projeto não puderam ser consultadas" : `As entregas de ${snapshot.unavailable} projetos não puderam ser consultadas`}: a lista e os indicadores podem estar incompletos.
        </p>
      ) : null}

      {tab === "entregas" ? (
      <div key="entregas" className="motion-fade flex flex-col gap-5">
      <section aria-label="Indicadores das entregas" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={PackageCheck} label="Total de entregas" value={totals.total} tone="bg-primary/10 text-primary" />
        <Kpi icon={CircleCheck} label="Conformes" value={totals.conforming} tone="bg-status-done-soft text-status-done-ink" />
        <Kpi icon={Clock} label="Em homologação" value={totals.inHomologation} tone="bg-primary/10 text-primary" />
        <Kpi icon={CircleAlert} label="Com pendência" value={totals.withPendency} tone="bg-status-critical-soft text-status-critical-ink" />
      </section>

      <section aria-label="Lista de entregas" className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-border">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[16rem] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar por título, projeto ou fornecedor…"
              aria-label="Buscar entregas"
              className="h-10 pl-9"
            />
          </div>
          <div className="w-full sm:w-56">
            <OptionCombobox
              label="Filtrar por projeto"
              value={projectId}
              onChange={(value) => {
                setProjectId(value);
                setPage(1);
              }}
              options={projectOptions}
            />
          </div>
          <div className="w-full sm:w-48">
            <OptionCombobox
              label="Filtrar por status"
              value={status}
              onChange={(value) => {
                setStatus(value as DeliveryStatus | "");
                setPage(1);
              }}
              options={STATUS_OPTIONS}
            />
          </div>
        </div>

        {snapshot.rows.length === 0 ? (
          <div role="status" className="flex flex-col items-center gap-2 border-t border-border px-4 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
              <PackagePlus className="size-6" />
            </span>
            <p className="text-sm font-medium">Nenhuma entrega registrada nos projetos que você acompanha</p>
            <p className="max-w-md text-xs text-muted-foreground">As entregas (versões do produto com checklist de documentos) são criadas dentro de cada projeto, no cartão Conformidade de Entrega.</p>
          </div>
        ) : visible.length === 0 ? (
          <div role="status" className="flex flex-col items-center gap-2 border-t border-border px-4 py-14 text-center">
            <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-medium">Nenhuma entrega encontrada</p>
            <p className="text-xs text-muted-foreground">Ajuste a busca ou os filtros.</p>
            {filtered ? (
              <Button type="button" variant="outline" size="sm" onClick={clear}>
                Limpar filtros
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="relative w-full min-w-0 overflow-x-auto border-t border-border">
            <table className="w-full text-left">
              <thead className="bg-muted/50 text-label font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  <th scope="col" className="py-3.5 pr-2.5 pl-4">Entrega</th>
                  <th scope="col" className="hidden px-2.5 py-3.5 md:table-cell">Projeto</th>
                  <th scope="col" className="hidden px-2.5 py-3.5 lg:table-cell">Fornecedor</th>
                  <th scope="col" className="hidden px-2.5 py-3.5 lg:table-cell">Registrada em</th>
                  <th scope="col" className="px-2.5 py-3.5">Situação</th>
                  <th scope="col" className="w-12 px-3 py-3.5"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody key={[query, projectId, status, paged.current, pageSize].join("|")} className="motion-fade">
                {paged.items.map((record) => {
                  const info = DELIVERY_STATUS[record.status];
                  return (
                    <tr
                      key={record.id}
                      onClick={() => open(record)}
                      className="cursor-pointer border-b border-border/60 transition-colors duration-150 last:border-b-0 hover:bg-muted/40 motion-reduce:transition-none dark:border-border"
                    >
                      <td className="max-w-[22rem] py-3 pr-2.5 pl-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15 ring-inset" aria-hidden="true">
                            <PackageCheck className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{deliveryTitle(record)}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {NATURE_LABEL[record.nature]} · {record.documents} {record.documents === 1 ? "documento" : "documentos"}
                            </p>
                            <p className="truncate text-xs text-muted-foreground md:hidden">{record.projectName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden max-w-[14rem] px-2.5 py-3 text-sm md:table-cell">
                        <span className="block truncate" title={record.projectName}>{record.projectName}</span>
                      </td>
                      <td className="hidden max-w-[12rem] px-2.5 py-3 text-sm lg:table-cell">
                        <span className="block truncate" title={record.suppliers.join(", ")}>{record.suppliers.length > 0 ? record.suppliers.join(", ") : <span className="text-muted-foreground">Não informado</span>}</span>
                      </td>
                      <td className="hidden px-2.5 py-3 text-sm whitespace-nowrap text-muted-foreground lg:table-cell" title={stamp(record.createdAt)}>
                        {shortDay(record.createdAt)}
                      </td>
                      <td className="px-2.5 py-3">
                        <ToneBadge tone={info.tone} title={info.hint}>
                          {info.label}
                        </ToneBadge>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Abrir detalhes da ${deliveryTitle(record)} de ${record.projectName}`}
                          title="Abrir detalhes"
                          onClick={(event) => {
                            event.stopPropagation();
                            open(record);
                          }}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <Eye aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {visible.length > 0 ? (
          <DeliveryPagination
            label="Paginação das entregas"
            noun={["entrega", "entregas"]}
            total={visible.length}
            shown={paged.items.length}
            current={paged.current}
            pages={paged.pages}
            pageSize={pageSize}
            onPage={setPage}
            onPageSize={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        ) : null}
      </section>
      </div>
      ) : tab === "homologacoes" ? (
        <div key="homologacoes" className="motion-fade">
          <HomologationsView rows={snapshot.rows} projects={snapshot.projects} onOpen={open} />
        </div>
      ) : (
        <div key="modelos" className="motion-fade">
          <TemplatesView viewerRole={viewerRole} />
        </div>
      )}

      <DeliverySheet record={selected} open={sheetOpen} onOpenChange={setSheetOpen} />

      <Dialog open={creating} onOpenChange={(value) => setCreating(value)}>
        <EditDialogContent className="sm:max-w-[520px]">
          <EditDialogHeader
            icon={PackagePlus}
            title="Nova entrega"
            description="Escolha o projeto para criar a versão."
            details="A versão de entrega é criada dentro do projeto, no cartão Conformidade de Entrega, com as regras e permissões dele. Escolha o projeto para ir até lá."
            onClose={() => setCreating(false)}
          />
          <EditDialogBody>
            <div className="flex flex-col gap-1.5">
              <Label>Projeto</Label>
              <OptionCombobox label="Projeto" value={newProject} onChange={setNewProject} options={snapshot.projects.map((project) => ({ value: project.id, label: project.name }))} placeholder="Selecione o projeto…" />
            </div>
          </EditDialogBody>
          <EditDialogFooter>
            <Button type="button" variant="outline" onClick={() => setCreating(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={newProject === ""} onClick={() => startTransition(() => router.push(`/projetos/${newProject}`))}>
              Ir para o projeto
            </Button>
          </EditDialogFooter>
        </EditDialogContent>
      </Dialog>
    </div>
  );
}
