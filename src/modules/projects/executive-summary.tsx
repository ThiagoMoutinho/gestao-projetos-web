"use client";

import { ChevronDown, FileText, Layers, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Presence } from "@/components/ui/presence";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  getExecutiveSummary,
  getExecutiveSummaryValidation,
  listExecutiveSummaryValidations,
  validateExecutiveSummary,
} from "@/lib/api/generated/cronograma/cronograma";
import type { GetExecutiveSummary200 } from "@/lib/api/generated/model/getExecutiveSummary200";
import type { GetExecutiveSummaryValidation200 } from "@/lib/api/generated/model/getExecutiveSummaryValidation200";
import { cn } from "@/lib/utils";

import { useAction } from "./institutional-shared";
import { Fact, SectionCard } from "./overview-panel";
import { projectStatusLabel } from "./project-status";

/** Indicadores automáticos (o resumo ao vivo e o snapshot de uma validação têm os mesmos campos). */
type Indicators = Omit<GetExecutiveSummary200, "governance">;
type Governance = GetExecutiveSummary200["governance"];
type ValidationItem = NonNullable<Governance["lastValidation"]>;
type State = { status: "loading" } | { status: "error" } | { status: "ready"; data: GetExecutiveSummary200 };

const DOT: Record<Indicators["situation"]["status"], string> = {
  NAO_INICIADO: "bg-muted-foreground",
  EM_EXECUCAO: "bg-primary",
  EM_ATENCAO: "bg-warning",
  CRITICO: "bg-destructive",
  EM_VALIDACAO: "bg-primary",
  CONCLUIDO: "bg-success",
  SUSPENSO: "bg-muted-foreground",
};

const zone = { timeZone: "America/Belem" } as const;
const REFERENCE = new Intl.DateTimeFormat("pt-BR", { ...zone, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
const CIVIL_DAY = new Intl.DateTimeFormat("pt-BR", { ...zone, day: "2-digit", month: "2-digit", year: "numeric" });
const MOMENT = new Intl.DateTimeFormat("pt-BR", { ...zone, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

/** Datas civis do ciclo (AAAA-MM-DD) em dd/mm, sem converter fuso. */
function cycleDay(day: string) {
  const [, month, date] = day.split("-");
  return `${date}/${month}`;
}

function percent(basisPoints: number | null) {
  return basisPoints === null ? "Indisponível" : `${(Math.round(basisPoints / 10) / 10).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

const METRIC_TONE = {
  blue: "bg-primary/10 text-primary",
  red: "bg-destructive/10 text-destructive",
} as const;

/** Indicador do cartão: ícone em bloco colorido, número em destaque e rótulo. */
function Metric({ icon: Icon, tone, label, value }: { icon: typeof Layers; tone: keyof typeof METRIC_TONE; label: string; value: string }) {
  return (
    <div data-cut-unit className="flex min-w-0 items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-2.5">
      <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", METRIC_TONE[tone])} aria-hidden="true">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-base leading-none font-semibold">{value}</p>
        <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold text-[#475467]">{title}</h3>
      {children}
    </section>
  );
}

function validationText(item: ValidationItem) {
  const who = item.validatedByName ?? "PMO";
  const kind = item.kind === "EXTRAORDINARY" ? "Validação extraordinária" : "Validação regular";
  return `${kind} por ${who} em ${REFERENCE.format(new Date(item.validatedAt))} · ciclo ${cycleDay(item.cycleStart)} a ${cycleDay(item.cycleEnd)}${item.unchanged ? " · sem alterações" : ""}`;
}

/**
 * Síntese, indicadores, próximas entregas e movimentações: usado no resumo ao vivo e no snapshot de uma validação.
 * `part` separa o essencial (síntese e indicadores, sempre visíveis no cartão) do complementar (próximas entregas e
 * movimentações, que aparecem quando o cartão é expandido).
 */
function SummaryContent({ data, part = "all", generatedAt }: { data: Indicators; part?: "all" | "core" | "extra"; generatedAt?: string }) {
  const core = part !== "extra";
  const extra = part !== "core";
  if (!data.hasData) {
    return core ? <p className="text-xs text-muted-foreground">{data.narrative[0]?.text}</p> : null;
  }
  return (
    <>
      {core ? (
        <>
          <p className="text-xs leading-relaxed text-foreground/85">{data.narrative.map((line) => line.text).join(" ")}</p>
          {part === "core" ? (
            <p className="text-[11px] text-muted-foreground">Dados de {generatedAt ? REFERENCE.format(new Date(generatedAt)) : ""}. Indicadores calculados automaticamente a cada consulta; a validação oficial do PMO fica registrada abaixo.</p>
          ) : null}
          {part === "core" ? (
            <>
              <div data-cut-unit className="flex flex-col gap-1.5 rounded-lg bg-muted/50 px-3 py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[11px] text-muted-foreground">Progresso consolidado</p>
                  <p className="text-base leading-none font-semibold">{percent(data.progress.basisPoints)}</p>
                </div>
                <Progress
                  value={data.progress.basisPoints === null ? 0 : Math.round(data.progress.basisPoints / 100)}
                  aria-label="Progresso consolidado do projeto"
                  className="**:data-[slot=progress-track]:h-1.5"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Metric icon={RefreshCw} tone="blue" label="Reprogramações" value={String(data.reschedules.total)} />
                <Metric icon={Layers} tone="blue" label="Aguardando homologação" value={String(data.homologation.awaiting)} />
                <Metric icon={TriangleAlert} tone="red" label="Em correção" value={String(data.homologation.inCorrections)} />
              </div>
            </>
          ) : (
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Fact label="Progresso consolidado" value={percent(data.progress.basisPoints)} />
              <Fact label="Itens em atraso" value={String(data.overdue.total)} />
              <Fact label="Impedimentos" value={String(data.impediments)} />
              <Fact label="Reprogramações" value={String(data.reschedules.total)} />
              <Fact label="Aguardando homologação" value={String(data.homologation.awaiting)} />
              <Fact label="Em correção" value={String(data.homologation.inCorrections)} />
            </dl>
          )}
        </>
      ) : null}
      {extra ? (
        <>
          <Block title="Próximas entregas">
            {data.nextDeliveries.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma entrega futura prevista.</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {data.nextDeliveries.map((delivery) => (
                  <li key={delivery.id} className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="min-w-0 truncate" title={delivery.title}>
                      {delivery.title}
                      {delivery.phaseName ? <span className="text-muted-foreground"> · {delivery.phaseName}</span> : null}
                    </span>
                    <span className={cn("shrink-0 font-medium", delivery.overdue ? "text-destructive" : "text-muted-foreground")}>
                      {CIVIL_DAY.format(new Date(delivery.plannedAt))}
                      {delivery.overdue ? " · vencido" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Block>
          <Block title="Movimentações relevantes">
            {data.movements.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma movimentação relevante registrada.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {data.movements.map((movement) => (
                  <li key={movement.id} className="text-xs">
                    <span className="break-words">{movement.summary}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {movement.automatic ? "Automático" : (movement.actorName ?? "Usuário não identificado")} · {MOMENT.format(new Date(movement.at))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Block>
        </>
      ) : null}
    </>
  );
}

type Mode = "regular" | "withoutChanges" | "extraordinary";

/** Confirmação da validação: mostra o que será registrado e envia a impressão digital que o PMO viu. */
function ValidationDialog({
  projectId,
  open,
  mode,
  summary,
  onClose,
  onDone,
}: {
  projectId: string;
  open: boolean;
  mode: Mode;
  summary: GetExecutiveSummary200;
  onClose: () => void;
  onDone: () => void;
}) {
  const [observation, setObservation] = useState("");
  const { busy, run } = useAction(onDone);
  const extraordinary = mode === "extraordinary";
  const canSend = !extraordinary || observation.trim().length > 0;

  async function confirm() {
    const done = await run(
      () =>
        validateExecutiveSummary(projectId, {
          fingerprint: summary.governance.fingerprint,
          ...(observation.trim() ? { observation: observation.trim() } : {}),
          ...(extraordinary ? { extraordinary: true } : {}),
          ...(mode === "withoutChanges" ? { withoutChanges: true } : {}),
        }),
      extraordinary ? "Validação extraordinária registrada." : "Resumo executivo validado.",
      "Não foi possível validar o resumo.",
    );
    if (done) {
      setObservation("");
      onClose();
    } else {
      // Indicadores mudaram ou o ciclo já foi validado: mostra de novo o que está valendo agora.
      onDone();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy && !next) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{extraordinary ? "Validação extraordinária" : mode === "withoutChanges" ? "Validar sem alterações" : "Validar resumo executivo"}</DialogTitle>
          <DialogDescription>
            Você registra, como oficial, os indicadores calculados em {REFERENCE.format(new Date(summary.generatedAt))} (ciclo {cycleDay(summary.governance.cycle.start)} a{" "}
            {cycleDay(summary.governance.cycle.end)}). Se eles mudarem antes da confirmação, o sistema pede uma nova revisão.
          </DialogDescription>
        </DialogHeader>
        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs leading-relaxed">{summary.narrative.map((line) => line.text).join(" ")}</p>
        <Textarea
          value={observation}
          onChange={(event) => setObservation(event.target.value)}
          maxLength={2000}
          placeholder={extraordinary ? "Observação (obrigatória na validação extraordinária)" : "Observação (opcional)"}
          aria-label="Observação da validação"
          aria-required={extraordinary}
        />
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={busy || !canSend} onClick={() => void confirm()}>
            {busy ? "Registrando…" : "Confirmar validação"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type HistoryState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; items: ValidationItem[] };

function History({ projectId, open, refreshKey }: { projectId: string; open: boolean; refreshKey: string }) {
  const [state, setState] = useState<HistoryState>({ status: "idle" });
  const [opened, setOpened] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ id: string; data: GetExecutiveSummaryValidation200 } | "error" | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let active = true;
    listExecutiveSummaryValidations(projectId)
      .then((response) => {
        if (active) {
          setState(response.status === 200 ? { status: "ready", items: response.data.data } : { status: "error" });
        }
      })
      .catch(() => {
        if (active) {
          setState({ status: "error" });
        }
      });
    return () => {
      active = false;
    };
  }, [projectId, open, refreshKey]);

  useEffect(() => {
    if (!opened) {
      return;
    }
    let active = true;
    getExecutiveSummaryValidation(projectId, opened)
      .then((response) => {
        if (active) {
          setDetail(response.status === 200 ? { id: opened, data: response.data } : "error");
        }
      })
      .catch(() => {
        if (active) {
          setDetail("error");
        }
      });
    return () => {
      active = false;
    };
  }, [projectId, opened]);

  if (!open) {
    return null;
  }
  if (state.status === "idle" || state.status === "loading") {
    return <Skeleton className="h-10 w-full" />;
  }
  if (state.status === "error") {
    return <p className="text-xs text-muted-foreground">Não foi possível consultar o histórico de validações.</p>;
  }
  if (state.items.length === 0) {
    return <p className="text-xs text-muted-foreground">Nenhuma validação registrada até o momento.</p>;
  }
  return (
    <ul className="flex flex-col divide-y">
      {state.items.map((item) => {
        const expanded = opened === item.id;
        return (
          <li key={item.id} className="py-2 first:pt-0 last:pb-0">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => {
                setDetail(null);
                setOpened(expanded ? null : item.id);
              }}
              className="flex w-full items-start justify-between gap-2 text-left text-xs focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="min-w-0">
                <span className="block font-medium break-words">{validationText(item)}</span>
                {item.observation ? <span className="block break-words text-muted-foreground">Observação: {item.observation}</span> : null}
              </span>
              <ChevronDown className={cn("mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")} aria-hidden="true" />
            </button>
            <Presence open={expanded}>
              <div className="mt-2 flex flex-col gap-3 rounded-md border border-dashed p-3">
                <p className="text-[11px] font-semibold text-muted-foreground">
                  Registro oficial (somente leitura) · dados de {detail && detail !== "error" && detail.id === item.id ? REFERENCE.format(new Date(detail.data.snapshot.generatedAt)) : "…"}
                </p>
                {detail === "error" ? (
                  <p className="text-xs text-muted-foreground">Não foi possível abrir o registro.</p>
                ) : detail && detail.id === item.id ? (
                  <SummaryContent data={detail.data.snapshot} />
                ) : (
                  <Skeleton className="h-16 w-full" />
                )}
              </div>
            </Presence>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Resumo executivo: indicadores automáticos (calculados pela API a cada consulta, sem IA) e, separado, o registro
 * oficial da validação do PMO (ciclo semanal de quinta a quarta, histórico imutável e snapshot em leitura). Só o perfil
 * global PMO valida; os demais consultam.
 *
 * O cartão tem altura limitada como os demais: síntese, indicadores e o estado da validação ficam sempre visíveis (a
 * validação no rodapé) e o restante (próximas entregas, movimentações, responsável e fornecedor) aparece em "Ver mais",
 * que expande o próprio cartão. Abrir o histórico de validações também expande o cartão; "Ver menos" recolhe tudo.
 */
export function ExecutiveSummaryCard({
  projectId,
  ownerName,
  suppliers,
  updatedAt,
  refreshKey,
}: {
  projectId: string;
  ownerName: string;
  suppliers: string[] | null;
  updatedAt: string;
  /** Muda quando o projeto é atualizado: o resumo é consultado de novo. */
  refreshKey: string;
}) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [version, setVersion] = useState(0);
  const [dialog, setDialog] = useState<Mode | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    getExecutiveSummary(projectId)
      .then((response) => {
        if (active) {
          setState(response.status === 200 ? { status: "ready", data: response.data } : { status: "error" });
        }
      })
      .catch(() => {
        if (active) {
          setState({ status: "error" });
        }
      });
    return () => {
      active = false;
    };
  }, [projectId, refreshKey, version]);

  const data = state.status === "ready" ? state.data : null;
  const governance = data?.governance ?? null;

  const validation = governance ? (
    <section aria-label="Validação do PMO" className="flex flex-col gap-1.5 rounded-md border border-primary/20 bg-primary/5 p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <ShieldCheck className="size-3.5" aria-hidden="true" /> Validação do PMO (registro oficial)
      </h3>
      <p className="text-xs">{governance.lastValidation ? validationText(governance.lastValidation) : "Ainda não há resumo validado pelo PMO."}</p>
      {expanded && governance.lastValidation?.observation ? (
        <p className="text-xs break-words text-muted-foreground">Observação: {governance.lastValidation.observation}</p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Ciclo atual: {cycleDay(governance.cycle.start)} a {cycleDay(governance.cycle.end)} ·{" "}
        {governance.currentCycleRegularValidated ? "validado" : governance.periodic ? `pendente (fecha na quarta, ${cycleDay(governance.cycle.end)})` : "projeto fora das cobranças periódicas"}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {governance.canValidate ? (
          !governance.currentCycleRegularValidated ? (
            <>
              <Button type="button" size="xs" onClick={() => setDialog("regular")}>
                Validar resumo
              </Button>
              {governance.unchangedSinceLastValidation ? (
                <Button type="button" size="xs" variant="outline" onClick={() => setDialog("withoutChanges")}>
                  Validar sem alterações
                </Button>
              ) : null}
            </>
          ) : (
            <Button type="button" size="xs" variant="outline" onClick={() => setDialog("extraordinary")}>
              Validação extraordinária
            </Button>
          )
        ) : null}
        <button
          type="button"
          aria-expanded={historyOpen}
          onClick={() => {
            const next = !historyOpen;
            setHistoryOpen(next);
            if (next) {
              // O histórico precisa de espaço: o cartão sai do limite de altura.
              setExpanded(true);
            }
          }}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ChevronDown className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", historyOpen && "rotate-180")} aria-hidden="true" />
          Histórico de validações
        </button>
      </div>
      <Presence open={historyOpen}>
        <div className="pt-1">
          <History projectId={projectId} open={historyOpen} refreshKey={`${refreshKey}:${version}`} />
        </div>
      </Presence>
    </section>
  ) : null;

  return (
    <SectionCard
      title="Resumo executivo"
      subtitle="Panorama consolidado do projeto e validação do PMO."
      icon={FileText}
      tone="blue"
      expanded={expanded}
      expandable={data !== null}
      onExpandedChange={(next) => {
        setExpanded(next);
        if (!next) {
          setHistoryOpen(false);
        }
      }}
      action={
        data ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#E4E7EC] px-2.5 py-1 text-[11px] font-medium dark:border-border">
            <span className={cn("size-2 rounded-full", DOT[data.situation.status])} aria-hidden="true" />
            {projectStatusLabel(data.situation.status)}
          </span>
        ) : null
      }
      footer={validation}
    >
      {state.status === "loading" ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : state.status === "error" ? (
        <p className="text-xs text-muted-foreground">Não foi possível gerar o resumo do projeto agora.</p>
      ) : (
        <>
          <SummaryContent data={state.data} part="core" generatedAt={state.data.generatedAt} />
          {expanded ? (
            <>
              <SummaryContent data={state.data} part="extra" />
              <dl className="grid gap-2 sm:grid-cols-3">
                <Fact label="Responsável principal" value={ownerName} />
                <Fact label="Fornecedor" value={suppliers === null ? "Indisponível" : suppliers.length === 0 ? "Não informado" : suppliers.join(", ")} />
                <Fact label="Última atualização" value={updatedAt} />
              </dl>
            </>
          ) : null}
        </>
      )}
      {data ? (
        <ValidationDialog projectId={projectId} open={dialog !== null} mode={dialog ?? "regular"} summary={data} onClose={() => setDialog(null)} onDone={reload} />
      ) : null}
    </SectionCard>
  );
}
