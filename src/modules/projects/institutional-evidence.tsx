"use client";

import { CircleHelp, ExternalLink, FileText, Layers, Plus, Ticket as Ticket2 } from "lucide-react";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EditDialogBody, EditDialogContent, EditDialogFooter, EditDialogHeader } from "@/components/ui/edit-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, useFieldErrors } from "@/components/field-error";
import { OptionCombobox } from "@/components/option-combobox";
import { createEapEvidence, updateEapEvidence } from "@/lib/api/generated/eap/eap";
import { cn } from "@/lib/utils";

import { EvidenceFormFields, EvidenceKindIcon, type EvidenceFieldUi } from "./evidence-form";
import {
  EMPTY_EVIDENCE_DRAFT,
  EVIDENCE_FILTERS,
  evidenceActionLabel,
  evidenceDisplayTitle,
  evidenceDraftChecks,
  evidenceKindLabel,
  evidencePayload,
  matchesEvidenceFilter,
  type EvidenceDraft,
  type EvidenceDraftField,
  type EvidenceFilter,
  type EvidenceKind,
} from "./evidence-kinds";
import { stamp, useAction, type Overview } from "./institutional-shared";
import { DrawerCard, DrawerCount, DrawerEmpty, DrawerNav } from "./overview-detail-drawer";
import { SectionCard } from "./overview-panel";

/** Tom visual por tipo de evidência (ícone e badge). */
const KIND_TONE: Record<EvidenceKind | "UNCLASSIFIED", string> = {
  DOCUMENT: "bg-primary/10 text-primary ring-primary/20",
  MINUTES: "bg-status-validation-soft text-status-validation-ink ring-status-validation/25",
  REPORT: "bg-status-running-soft text-status-running-ink ring-status-running/25",
  GLPI_TICKET: "bg-status-attention-soft text-status-attention-ink ring-status-attention/25",
  OTHER: "bg-muted text-muted-foreground ring-border",
  UNCLASSIFIED: "bg-muted text-muted-foreground ring-border",
};

type OverviewEvidence = Overview["evidences"][number];

/** Nome legível do item da EAP (fase, tarefa ou marco) por id, montado pela tela com os dados que ela já carregou. */
export type EvidenceOrigins = Record<string, string>;

/** Quantas evidências a prévia do cartão lista; o restante abre no painel. */
const PREVIEW = 6;

function originOf(evidence: OverviewEvidence, origins: EvidenceOrigins) {
  const id = evidence.phaseId ?? evidence.taskId ?? evidence.milestoneId;
  if (id) {
    return origins[id] ?? null;
  }
  if (evidence.scheduleRequestId) {
    return "Solicitação de reprogramação";
  }
  if (evidence.projectResultId) {
    return "Resultado do projeto";
  }
  return "Projeto";
}

/** Ícone de cada filtro da barra do painel: o do próprio tipo de evidência (Todos e Sem classificação têm o seu). Criados uma vez, fora da renderização. */
const kindIcon = (kind: EvidenceKind) =>
  function KindFilterIcon({ className }: { className?: string }) {
    return <EvidenceKindIcon kind={kind} className={className} />;
  };
const FILTER_ICON: Record<EvidenceFilter, React.ComponentType<{ className?: string }>> = {
  ALL: Layers,
  DOCUMENT: kindIcon("DOCUMENT"),
  MINUTES: kindIcon("MINUTES"),
  REPORT: kindIcon("REPORT"),
  GLPI_TICKET: kindIcon("GLPI_TICKET"),
  OTHER: kindIcon("OTHER"),
  UNCLASSIFIED: CircleHelp,
};

function Ticket({ label, ticket }: { label: string; ticket: { ticketId: string; url: string | null } | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Ticket2 className="size-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="truncate text-base leading-snug font-semibold text-foreground">
        {!ticket ? (
          <span className="text-sm font-normal text-muted-foreground">Não informado</span>
        ) : ticket.url ? (
          <a href={ticket.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
            GLPI #{ticket.ticketId} <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        ) : (
          `GLPI #${ticket.ticketId}`
        )}
      </dd>
    </div>
  );
}

/** Ticket no cartão compacto (mantém o bloco suave do card; o sheet usa o Fact acima). */
function TicketCard({ label, ticket }: { label: string; ticket: { ticketId: string; url: string | null } | null }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/35 px-3.5 py-2.5 dark:bg-muted/20">
      <dt className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Ticket2 className="size-3.5" aria-hidden="true" />
        {label}
      </dt>
      <dd className="mt-1.5 truncate text-sm font-semibold text-foreground">
        {!ticket ? (
          <span className="font-normal text-muted-foreground">Não informado</span>
        ) : ticket.url ? (
          <a href={ticket.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline">
            GLPI #{ticket.ticketId} <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        ) : (
          `GLPI #${ticket.ticketId}`
        )}
      </dd>
    </div>
  );
}

/** Campos da Visão Geral (shadcn): os mesmos campos da EAP, desenhados com Label e Input. */
const overviewFieldUi: EvidenceFieldUi = {
  Text: function OverviewText({ label, value, onChange, error, placeholder }) {
    const id = useId();
    const errorId = `${id}-error`;
    return (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={2000}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <FieldError id={errorId} message={error} />
      </div>
    );
  },
  Kind: function OverviewKind({ value, onChange, options }) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Tipo de evidência</Label>
        <OptionCombobox
          label="Tipo de evidência"
          value={value}
          onChange={(next) => onChange((next || "DOCUMENT") as EvidenceKind)}
          options={options}
        />
      </div>
    );
  },
};

/** Cadastro de uma evidência do projeto ou classificação de uma evidência antiga (mesmos campos, sem recadastrar). */
function EvidenceDialog({
  projectId,
  evidence,
  open,
  onClose,
  onDone,
}: {
  projectId: string;
  /** Presente: classifica a evidência existente. Ausente: cadastra uma nova, vinculada ao projeto. */
  evidence: OverviewEvidence | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState<EvidenceDraft>(() => initialDraft(evidence));
  const { errors, validate, clear, reset } = useFieldErrors<EvidenceDraftField>();
  const { busy, run } = useAction(() => {
    onDone();
    onClose();
  });

  function change(patch: Partial<EvidenceDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
    (Object.keys(patch) as EvidenceDraftField[]).forEach((key) => clear(key));
    if (patch.kind !== undefined) {
      clear("ticketNumber");
    }
  }

  async function save() {
    if (!validate(evidenceDraftChecks(draft))) {
      return;
    }
    const payload = evidencePayload(draft);
    await run(
      () =>
        evidence
          ? updateEapEvidence(projectId, evidence.id, {
              kind: payload.kind,
              ...("ticketNumber" in payload ? { ticketNumber: payload.ticketNumber } : {}),
              ...(payload.url !== evidence.url ? { url: payload.url } : {}),
              ...("title" in payload && payload.title && payload.title !== evidence.title ? { title: payload.title } : {}),
            })
          : createEapEvidence(projectId, { ...payload, projectLevel: true }),
      evidence ? "Evidência classificada." : "Evidência registrada.",
      evidence ? "Não foi possível classificar a evidência." : "Não foi possível registrar a evidência.",
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy && !next) {
          reset();
          onClose();
        }
      }}
    >
      <EditDialogContent className="sm:max-w-[560px]">
        <EditDialogHeader
          icon={FileText}
          title={evidence ? "Classificar evidência" : "Registrar evidência do projeto"}
          description={
            draft.kind === "GLPI_TICKET"
              ? "Chamado já existente no GLPI."
              : evidence
                ? "Tipo da evidência."
                : "Tipo, título e link do documento."
          }
          details={
            draft.kind === "GLPI_TICKET"
              ? "Informe o número e o link de um chamado já existente. Nenhum chamado é aberto ou sincronizado no GLPI."
              : undefined
          }
          onClose={onClose}
          closeDisabled={busy}
        />
        <EditDialogBody>
          <EvidenceFormFields draft={draft} onChange={change} errors={errors} ui={overviewFieldUi} />
        </EditDialogBody>
        <EditDialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </EditDialogFooter>
      </EditDialogContent>
    </Dialog>
  );
}

function initialDraft(evidence: OverviewEvidence | null): EvidenceDraft {
  if (!evidence) {
    return EMPTY_EVIDENCE_DRAFT;
  }
  return {
    kind: evidence.kind ?? EMPTY_EVIDENCE_DRAFT.kind,
    title: evidence.title,
    url: evidence.url,
    ticketNumber: evidence.ticketNumber ?? "",
  };
}

/**
 * Evidências do projeto: documentos, atas, relatórios e chamados GLPI, com filtro por tipo. Mostra as evidências de todo o
 * projeto (as cadastradas diretamente nas fases, tarefas e marcos da EAP aparecem aqui sem duplicação, com o item de
 * origem). O chamado GLPI é só uma referência: não há integração com o GLPI.
 */
export function EvidencesAndTickets({
  projectId,
  data,
  canAdd,
  origins,
  onChanged,
}: {
  projectId: string;
  data: Overview;
  canAdd: boolean;
  origins: EvidenceOrigins;
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState<EvidenceFilter>("ALL");
  const [creating, setCreating] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [classifying, setClassifying] = useState<OverviewEvidence | null>(null);
  const [classifyOpen, setClassifyOpen] = useState(false);

  const evidences = data.evidences;
  const hasUnclassified = evidences.some((evidence) => evidence.kind === null);
  const filters = EVIDENCE_FILTERS.filter(([value]) => value !== "UNCLASSIFIED" || hasUnclassified);
  const newestFirst = [...evidences].reverse();
  const visible = newestFirst.filter((evidence) => matchesEvidenceFilter(evidence, filter));

  const ticketsCard = (
    <dl className="grid gap-2.5 sm:grid-cols-2">
      <TicketCard label="Chamado de origem" ticket={data.origin.glpiTicket} />
      <TicketCard label="Chamado do PMO" ticket={data.origin.pmoGlpiTicket} />
    </dl>
  );
  const summary = [
    { label: "Total", value: evidences.length },
    { label: "Documentos", value: evidences.filter((item) => item.kind === "DOCUMENT").length },
    { label: "Atas", value: evidences.filter((item) => item.kind === "MINUTES").length },
    { label: "GLPI", value: evidences.filter((item) => item.kind === "GLPI_TICKET").length },
  ];

  const list = (items: OverviewEvidence[], comfortable = false) => (
    <ul className="flex flex-col divide-y divide-border/70 dark:divide-border">
      {items.map((evidence) => {
        const origin = originOf(evidence, origins);
        const title = evidenceDisplayTitle(evidence);
        const toneKey = evidence.kind ?? "UNCLASSIFIED";
        return (
          <li
            key={evidence.id}
            data-cut-unit
            className={cn("flex items-start gap-3", comfortable ? "gap-4 py-5 first:pt-0 last:pb-0" : "py-3")}
          >
            <span
              className={cn(
                "flex shrink-0 items-center justify-center ring-1 ring-inset",
                comfortable ? "size-9 rounded-full" : "size-9 rounded-xl",
                KIND_TONE[toneKey],
              )}
              aria-hidden="true"
            >
              <EvidenceKindIcon kind={evidence.kind} className="size-4" />
            </span>
            <div className={cn("min-w-0 flex-1", comfortable ? "space-y-1.5 pt-0.5" : "space-y-1")}>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm leading-snug font-semibold break-words text-foreground">{title}</p>
                <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {evidenceKindLabel(evidence.kind)}
                </span>
              </div>
              <p className={cn("leading-relaxed text-muted-foreground", comfortable ? "text-[13px]" : "text-xs line-clamp-2")}>
                Enviada em {stamp(evidence.createdAt)}
                {evidence.ticketNumber ? ` · GLPI #${evidence.ticketNumber}` : ""}
                {origin ? ` · Vinculado a: ${origin}` : ""}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                <a
                  href={evidence.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${evidenceActionLabel(evidence.kind)}: ${title}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline-offset-2 hover:underline"
                >
                  {evidenceActionLabel(evidence.kind)} <ExternalLink className="size-3" aria-hidden="true" />
                </a>
                {canAdd && evidence.kind === null && !evidence.deliveryId ? (
                  <button
                    type="button"
                    onClick={() => {
                      setClassifying(evidence);
                      setClassifyOpen(true);
                    }}
                    className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    Classificar
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );

  return (
    <>
      <SectionCard
        title="Evidências do projeto"
        subtitle="Documentos, atas, relatórios e chamados do projeto"
        icon={FileText}
        tone="blue"
        moreLabel={`Ver todas (${evidences.length})`}
        expandable={evidences.length > 0}
        drawer={{
          title: "Evidências do projeto",
          description: "Documentos, atas, relatórios e chamados do projeto.",
          content: (
            <div className="flex flex-col gap-5">
              {evidences.length > 0 ? (
                <DrawerNav
                  label="Filtrar evidências por tipo"
                  active={filter}
                  onSelect={(id) => setFilter(id as EvidenceFilter)}
                  items={filters
                    .map(([value, label]) => ({
                      id: value,
                      label,
                      icon: FILTER_ICON[value],
                      count: evidences.filter((evidence) => matchesEvidenceFilter(evidence, value)).length,
                    }))
                    // Só os tipos que têm evidências (mais "Todos" e o filtro escolhido): sem pílulas zeradas poluindo a barra.
                    .filter((item) => item.id === "ALL" || item.id === filter || item.count > 0)}
                />
              ) : null}
              <DrawerCard icon={Ticket2} title="Chamados" className="p-6">
                <dl className="grid gap-x-6 gap-y-4 rounded-xl bg-muted/40 px-5 py-4 dark:bg-muted/25 sm:grid-cols-2">
                  <Ticket label="Chamado de origem" ticket={data.origin.glpiTicket} />
                  <Ticket label="Chamado do PMO" ticket={data.origin.pmoGlpiTicket} />
                </dl>
              </DrawerCard>
              <DrawerCard icon={FileText} title="Evidências" aside={<DrawerCount value={visible.length} />} className="p-6">
                {visible.length === 0 ? (
                  <DrawerEmpty>{evidences.length === 0 ? "Nenhuma evidência registrada no projeto." : "Nenhuma evidência neste filtro."}</DrawerEmpty>
                ) : (
                  list(visible, true)
                )}
              </DrawerCard>
            </div>
          ),
        }}
        action={
          canAdd ? (
            <Button
              type="button"
              size="xs"
              onClick={() => {
                setCreateKey((value) => value + 1);
                setCreating(true);
              }}
            >
              <Plus aria-hidden="true" /> Evidência
            </Button>
          ) : undefined
        }
      >
        <div className="flex min-h-0 flex-1 flex-col gap-3.5">
          {evidences.length > 0 ? (
            <ul
              data-cut-unit
              aria-label="Resumo de evidências"
              className="grid shrink-0 grid-cols-4 overflow-hidden rounded-xl bg-muted/35 dark:bg-muted/20"
            >
              {summary.map((item, index) => (
                <li key={item.label} className={cn("flex flex-col gap-1 px-2.5 py-2.5", index > 0 && "border-l border-border/50 dark:border-border")}>
                  <span className="text-lg leading-none font-semibold tabular-nums text-foreground">{item.value}</span>
                  <span className="text-[10px] leading-tight text-muted-foreground">{item.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <div data-cut-unit className="shrink-0">
            {ticketsCard}
          </div>
          {evidences.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma evidência registrada no projeto.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <p data-cut-unit className="text-label font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                Mais recentes
              </p>
              {list(newestFirst.slice(0, PREVIEW))}
            </div>
          )}
        </div>
      </SectionCard>
      <EvidenceDialog key={`new-${createKey}`} projectId={projectId} evidence={null} open={creating} onClose={() => setCreating(false)} onDone={onChanged} />
      {classifying ? (
        <EvidenceDialog key={classifying.id} projectId={projectId} evidence={classifying} open={classifyOpen} onClose={() => setClassifyOpen(false)} onDone={onChanged} />
      ) : null}
    </>
  );
}
