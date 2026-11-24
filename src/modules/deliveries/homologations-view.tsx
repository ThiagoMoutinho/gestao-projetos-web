"use client";

import { CircleCheck, ClipboardCheck, ExternalLink, Eye, Search, SearchX, Undo2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { OptionCombobox } from "@/components/option-combobox";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { NATURE_LABEL } from "@/modules/projects/delivery-compliance";
import { paginate } from "@/modules/projects/project-portfolio";

import {
  DELIVERY_STATUS,
  HOMOLOGATION_STAGE,
  HOMOLOGATION_STAGES,
  deliveryTitle,
  filterHomologations,
  homologationCounts,
  homologationStage,
  type HomologationStage,
} from "./deliveries-portfolio";
import { DeliveryPagination } from "./delivery-pagination";
import { ToneBadge } from "./delivery-sheet";
import type { DeliveryRecord } from "./load-deliveries";

const STAGE_VISUAL: Record<HomologationStage, { icon: typeof ClipboardCheck; tone: string; ring: string; empty: string; action: string }> = {
  AGUARDANDO_VALIDACAO: {
    icon: ClipboardCheck,
    tone: "bg-primary/10 text-primary",
    ring: "ring-primary/50",
    empty: "Nenhuma entrega aguarda validação no momento.",
    action: "Validar no projeto",
  },
  DEVOLVIDA: {
    icon: Undo2,
    tone: "bg-status-critical-soft text-status-critical-ink",
    ring: "ring-status-critical/50",
    empty: "Nenhuma entrega foi devolvida para correção.",
    action: "Ver no projeto",
  },
  HOMOLOGADA: {
    icon: CircleCheck,
    tone: "bg-status-done-soft text-status-done-ink",
    ring: "ring-status-done/50",
    empty: "Nenhuma entrega foi homologada ainda.",
    action: "Ver no projeto",
  },
};

/**
 * Aba Homologações: as entregas que já têm documento em decisão ou decidido, separadas pelas etapas que a API realmente tem
 * (aguardando validação, devolvida para correção e homologada). Não decide nada aqui: os detalhes abrem no mesmo painel das Entregas e
 * as ações (validar, rejeitar, dispensar) seguem no cartão Conformidade de Entrega do projeto, com as permissões dele.
 */
export function HomologationsView({
  rows,
  projects,
  onOpen,
}: {
  rows: DeliveryRecord[];
  projects: Array<{ id: string; name: string }>;
  onOpen: (record: DeliveryRecord) => void;
}) {
  const [stage, setStage] = useState<HomologationStage | "">("");
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [pageSize, setPageSize] = useState(5);
  const [page, setPage] = useState(1);

  const counts = useMemo(() => homologationCounts(rows), [rows]);
  const inHomologation = counts.AGUARDANDO_VALIDACAO + counts.DEVOLVIDA + counts.HOMOLOGADA;
  const visible = useMemo(() => filterHomologations(rows, { query, projectId, stage }), [rows, query, projectId, stage]);
  const paged = paginate(visible, page, pageSize);
  const filtered = query.trim() !== "" || projectId !== "" || stage !== "";
  const onlyStage = stage !== "" && query.trim() === "" && projectId === "";
  const projectOptions = [{ value: "", label: "Todos os projetos" }, ...projects.map((project) => ({ value: project.id, label: project.name }))];

  function pick(next: HomologationStage | "") {
    setStage(next);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Etapas da homologação" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {HOMOLOGATION_STAGES.map((item) => {
          const visual = STAGE_VISUAL[item];
          const Icon = visual.icon;
          const selected = stage === item;
          return (
            <button
              key={item}
              type="button"
              aria-pressed={selected}
              onClick={() => pick(selected ? "" : item)}
              title={HOMOLOGATION_STAGE[item].hint}
              className={`flex min-w-0 items-center gap-3 rounded-2xl border border-border/70 bg-card px-3.5 py-3.5 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition-shadow duration-200 outline-none hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none sm:px-4 dark:border-border ${selected ? `ring-2 ${visual.ring}` : ""}`}
            >
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-black/5 ring-inset sm:size-11 dark:ring-white/10 ${visual.tone}`} aria-hidden="true">
                <Icon className="size-4 sm:size-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs leading-tight text-muted-foreground">{HOMOLOGATION_STAGE[item].label}</span>
                <span className="block text-2xl leading-tight font-semibold tabular-nums">{counts[item]}</span>
              </span>
            </button>
          );
        })}
      </section>

      <section aria-label="Lista de homologações" className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)] dark:border-border">
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
              aria-label="Buscar homologações"
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
          <div className="w-full sm:w-56">
            <OptionCombobox
              label="Filtrar por etapa"
              value={stage}
              onChange={(value) => pick(value as HomologationStage | "")}
              options={[{ value: "", label: "Todas as etapas" }, ...HOMOLOGATION_STAGES.map((item) => ({ value: item, label: HOMOLOGATION_STAGE[item].label }))]}
            />
          </div>
        </div>

        {inHomologation === 0 ? (
          <div role="status" className="flex flex-col items-center gap-2 border-t border-border px-4 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground" aria-hidden="true">
              <ClipboardCheck className="size-6" />
            </span>
            <p className="text-sm font-medium">Nenhuma entrega em homologação</p>
            <p className="max-w-md text-xs text-muted-foreground">Uma entrega entra aqui quando o fornecedor envia o primeiro documento do checklist para validação.</p>
          </div>
        ) : visible.length === 0 ? (
          <div role="status" className="flex flex-col items-center gap-2 border-t border-border px-4 py-14 text-center">
            {onlyStage ? <ClipboardCheck className="size-6 text-muted-foreground" aria-hidden="true" /> : <SearchX className="size-6 text-muted-foreground" aria-hidden="true" />}
            <p className="text-sm font-medium">{onlyStage ? STAGE_VISUAL[stage].empty : "Nenhuma entrega encontrada"}</p>
            {filtered ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setQuery("");
                  setProjectId("");
                  pick("");
                }}
              >
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
                  <th scope="col" className="hidden px-2.5 py-3.5 lg:table-cell">Documentos</th>
                  <th scope="col" className="px-2.5 py-3.5">Etapa</th>
                  <th scope="col" className="px-3 py-3.5 text-right"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody key={[query, projectId, stage, paged.current, pageSize].join("|")} className="motion-fade">
                {paged.items.map((record) => {
                  const current = homologationStage(record.status) ?? "AGUARDANDO_VALIDACAO";
                  const conformity = record.version.conformity;
                  const settled = conformity.approved + conformity.dispensed;
                  return (
                    <tr
                      key={record.id}
                      onClick={() => onOpen(record)}
                      className="cursor-pointer border-b border-border/60 transition-colors duration-150 last:border-b-0 hover:bg-muted/40 motion-reduce:transition-none dark:border-border"
                    >
                      <td className="max-w-[20rem] py-3 pr-2.5 pl-4">
                        <p className="truncate text-sm font-semibold text-foreground">{deliveryTitle(record)}</p>
                        <p className="truncate text-xs text-muted-foreground">{NATURE_LABEL[record.nature]}</p>
                        <p className="truncate text-xs text-muted-foreground md:hidden">{record.projectName}</p>
                      </td>
                      <td className="hidden max-w-[14rem] px-2.5 py-3 text-sm md:table-cell">
                        <span className="block truncate" title={record.projectName}>{record.projectName}</span>
                      </td>
                      <td className="hidden px-2.5 py-3 text-xs lg:table-cell">
                        <p className="text-foreground">
                          {settled} de {record.documents} {settled === 1 ? "decidido" : "decididos"}
                        </p>
                        <p className="text-muted-foreground">
                          {conformity.awaitingValidation} aguardando · {conformity.rejected} {conformity.rejected === 1 ? "rejeitado" : "rejeitados"}
                        </p>
                      </td>
                      <td className="px-2.5 py-3">
                        <ToneBadge tone={DELIVERY_STATUS[record.status].tone} title={HOMOLOGATION_STAGE[current].hint}>
                          {HOMOLOGATION_STAGE[current].badge}
                        </ToneBadge>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Abrir detalhes da ${deliveryTitle(record)} de ${record.projectName}`}
                            title="Abrir detalhes"
                            onClick={(event) => {
                              event.stopPropagation();
                              onOpen(record);
                            }}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <Eye aria-hidden="true" />
                          </Button>
                          <Link
                            href={`/projetos/${record.projectId}`}
                            title={STAGE_VISUAL[current].action}
                            aria-label={`${STAGE_VISUAL[current].action}: ${deliveryTitle(record)} de ${record.projectName}`}
                            onClick={(event) => event.stopPropagation()}
                            className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), "text-muted-foreground hover:text-primary")}
                          >
                            <ExternalLink aria-hidden="true" />
                          </Link>
                        </div>
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
            label="Paginação das homologações"
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
  );
}
