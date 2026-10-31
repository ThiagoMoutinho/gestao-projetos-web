"use client";

import { ExternalLink, Plus } from "lucide-react";
import { useId, useState } from "react";

import { AnimatedHeight } from "@/components/ui/animated-height";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { SeeMore, stamp, useAction, type Overview } from "./institutional-shared";
import { Panel } from "./overview-panel";

type OverviewEvidence = Overview["evidences"][number];

/** Nome legível do item da EAP (fase, tarefa ou marco) por id, montado pela tela com os dados que ela já carregou. */
export type EvidenceOrigins = Record<string, string>;

/** Quantas evidências aparecem antes do "Ver todas": o cartão não vira tabela nem ganha rolagem interna. */
const PREVIEW = 5;

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

function Ticket({ label, ticket }: { label: string; ticket: { ticketId: string; url: string | null } | null }) {
  return (
    <div className="min-w-0 rounded-md bg-muted/50 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-xs font-semibold">
        {!ticket ? (
          <span className="font-normal text-muted-foreground">Não informado</span>
        ) : ticket.url ? (
          <a
            href={ticket.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline"
          >
            GLPI #{ticket.ticketId} <ExternalLink className="size-3" aria-hidden="true" />
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{evidence ? "Classificar evidência" : "Registrar evidência do projeto"}</DialogTitle>
          <DialogDescription>
            {draft.kind === "GLPI_TICKET"
              ? "Informe o número e o link de um chamado já existente no GLPI. Nenhum chamado é aberto ou sincronizado."
              : evidence
                ? "Escolha o tipo da evidência. O histórico da alteração fica registrado."
                : "Informe o tipo, um título e o link do documento (por exemplo, no SharePoint)."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <EvidenceFormFields draft={draft} onChange={change} errors={errors} ui={overviewFieldUi} />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" disabled={busy} onClick={() => void save()}>
            {busy ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
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
  const [showAll, setShowAll] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createKey, setCreateKey] = useState(0);
  const [classifying, setClassifying] = useState<OverviewEvidence | null>(null);
  const [classifyOpen, setClassifyOpen] = useState(false);

  const evidences = data.evidences;
  const hasUnclassified = evidences.some((evidence) => evidence.kind === null);
  const filters = EVIDENCE_FILTERS.filter(([value]) => value !== "UNCLASSIFIED" || hasUnclassified);
  const visible = evidences.filter((evidence) => matchesEvidenceFilter(evidence, filter)).reverse();
  const shown = showAll ? visible : visible.slice(0, PREVIEW);

  return (
    <Panel
      title="Evidências do projeto"
      subtitle="Documentos, atas, relatórios e chamados do projeto"
      action={
        canAdd ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
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
      <dl className="grid gap-2 sm:grid-cols-2">
        <Ticket label="Chamado de origem" ticket={data.origin.glpiTicket} />
        <Ticket label="Chamado do PMO" ticket={data.origin.pmoGlpiTicket} />
      </dl>
      {evidences.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma evidência registrada no projeto.</p>
      ) : (
        <>
          <div role="group" aria-label="Filtrar evidências por tipo" className="flex flex-wrap gap-1.5">
            {filters.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => {
                  setFilter(value);
                  setShowAll(false);
                }}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none",
                  filter === value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-[#E4E7EC] bg-background text-muted-foreground hover:bg-muted dark:border-border",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <AnimatedHeight>
            {visible.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma evidência neste filtro.</p>
            ) : (
              <ul className="flex flex-col divide-y">
                {shown.map((evidence) => {
                  const origin = originOf(evidence, origins);
                  const title = evidenceDisplayTitle(evidence);
                  return (
                    <li key={evidence.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <EvidenceKindIcon kind={evidence.kind} className="size-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold break-words">{title}</p>
                        <p className="text-xs text-muted-foreground">
                          {evidenceKindLabel(evidence.kind)} · Registrada em {stamp(evidence.createdAt)}
                        </p>
                        {origin ? <p className="text-xs text-muted-foreground">Vinculado a: {origin}</p> : null}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
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
            )}
          </AnimatedHeight>
          {visible.length > PREVIEW ? (
            <SeeMore onClick={() => setShowAll((value) => !value)} expanded={showAll} className="mt-0 self-start">
              {showAll ? "Ver menos" : `Ver todas (${visible.length})`}
            </SeeMore>
          ) : null}
        </>
      )}
      <EvidenceDialog key={`new-${createKey}`} projectId={projectId} evidence={null} open={creating} onClose={() => setCreating(false)} onDone={onChanged} />
      {classifying ? (
        <EvidenceDialog
          key={classifying.id}
          projectId={projectId}
          evidence={classifying}
          open={classifyOpen}
          onClose={() => setClassifyOpen(false)}
          onDone={onChanged}
        />
      ) : null}
    </Panel>
  );
}
