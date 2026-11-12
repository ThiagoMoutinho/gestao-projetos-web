"use client";

import { ChevronDown, CircleAlert, ExternalLink, FileCheck2, PackagePlus, Plus, RotateCcw, Settings2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { OptionCombobox } from "@/components/option-combobox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Presence } from "@/components/ui/presence";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  approveDeliveryItem,
  createDeliveryVersion,
  listDeliveryVersions,
  rejectDeliveryItem,
  submitDeliveryItem,
  waiveDeliveryItem,
} from "@/lib/api/generated/conformidade-de-entrega/conformidade-de-entrega";
import type { ListDeliveryVersions200DataItem } from "@/lib/api/generated/model/listDeliveryVersions200DataItem";
import type { ListDeliveryVersions200DataItemItemsItem } from "@/lib/api/generated/model/listDeliveryVersions200DataItemItemsItem";
import { cn } from "@/lib/utils";

import {
  canManageTemplates,
  canSubmitDocuments,
  canSubmitItem,
  canValidateItem,
  canWaiveDocuments,
  canWaiveItem,
  complianceSummary,
  conformityBadge,
  conformityPercent,
  evidenceDisplay,
  evidenceError,
  EVIDENCE_KIND_OPTIONS,
  ITEM_STATUS,
  NATURE_LABEL,
  NATURES,
  noteError,
  versionLabelError,
  type EvidenceKind,
  type Nature,
  type Tone,
  type ViewerAccess,
} from "./delivery-compliance";
import { DeliveryTemplatesDialog } from "./delivery-templates-dialog";
import { personName, stamp, useAction } from "./institutional-shared";
import { SectionCard } from "./overview-panel";

type Version = ListDeliveryVersions200DataItem;
type Item = ListDeliveryVersions200DataItemItemsItem;
type State = { status: "loading" } | { status: "ready"; versions: Version[] } | { status: "error" };

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  success: "border-success/40 bg-success/10 text-success-foreground",
  warning: "border-warning/50 bg-warning/10 text-warning-foreground",
  danger: "border-destructive/40 bg-status-critical-soft text-status-critical-ink",
  info: "border-primary/30 bg-primary/10 text-primary",
};

function ToneBadge({ tone, children, title }: { tone: Tone; children: React.ReactNode; title?: string }) {
  return (
    <Badge variant="outline" title={title} className={cn("h-5 px-1.5 text-xs font-medium", TONE_CLASS[tone])}>
      {children}
    </Badge>
  );
}

type Decision = { kind: "submit" | "reject" | "waive"; versionId: string; item: Item };

/**
 * Conformidade de Entrega: versões do produto com o checklist documental de cada uma. Mostra o que falta, deixa enviar a
 * evidência (link do SharePoint ou tag/release do GitLab), validar, rejeitar e (ADMIN e PMO) dispensar com justificativa. O servidor
 * confere todas as permissões; a tela só esconde o que a pessoa não pode fazer.
 */
export function DeliveryComplianceCard({ projectId, access, closed }: { projectId: string; access: ViewerAccess; closed: boolean }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [open, setOpen] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await listDeliveryVersions(projectId);
      setState(response.status === 200 ? { status: "ready", versions: response.data.data } : { status: "error" });
    } catch {
      setState({ status: "error" });
    }
  }, [projectId]);

  const approving = useAction(() => void load());

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial dos dados do servidor
    void load();
  }, [load]);

  const canCreate = canSubmitDocuments(access) && !closed;
  const versions = state.status === "ready" ? state.versions : [];
  const retry = () => {
    setState({ status: "loading" });
    void load();
  };

  return (
    // Widget do quadro da Visão Geral: altura automática (cada versão abre o próprio checklist), sem corte nem "Ver mais".
    <SectionCard
      title="Conformidade de Entrega"
      subtitle="Documentos exigidos por versão para homologar o marco final e encerrar o projeto"
      icon={FileCheck2}
      tone="blue"
      unbounded
      action={
        <div className="flex items-center gap-2">
          {canManageTemplates(access) ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setTemplates(true)}>
              <Settings2 aria-hidden="true" /> Modelos
            </Button>
          ) : null}
          {canCreate ? (
            <Button type="button" size="sm" onClick={() => setCreating(true)}>
              <Plus aria-hidden="true" /> Nova versão
            </Button>
          ) : null}
        </div>
      }
    >
      {state.status === "loading" ? (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando conformidade de entrega">
          <Skeleton className="h-5 w-56 rounded-md" />
          <Skeleton className="h-11 rounded-lg" />
          <Skeleton className="h-11 rounded-lg" />
        </div>
      ) : state.status === "error" ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-status-critical/25 bg-status-critical-soft px-3 py-2.5">
          <CircleAlert aria-hidden="true" className="size-5 shrink-0 text-status-critical-ink" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">Não foi possível carregar a conformidade de entrega.</p>
            <p className="text-xs text-muted-foreground">Nenhum documento foi alterado. Tente novamente em instantes.</p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={retry}>
            <RotateCcw aria-hidden="true" /> Tentar novamente
          </Button>
        </div>
      ) : versions.length === 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
            <PackagePlus className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Nenhuma versão registrada</p>
            <p className="text-xs text-muted-foreground">
              {canCreate ? "Crie a primeira versão em “Nova versão” para abrir o checklist documental do modelo da natureza do projeto." : "O gestor ou o fornecedor cria a versão da entrega."}
            </p>
          </div>
        </div>
      ) : (
        <>
        <ComplianceOverview versions={versions} />
        <ul className="flex flex-col gap-2">
          {versions.map((version) => {
            const badge = conformityBadge(version.conformity as never);
            const expanded = open === version.id;
            return (
              <li key={version.id} className="rounded-lg border border-border">
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpen(expanded ? null : version.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors duration-200 hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none"
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">Versão {version.versionLabel}</span>
                    <span className="text-xs text-muted-foreground">{NATURE_LABEL[version.nature as Nature]}</span>
                    {version.templateIsProposal ? (
                      <ToneBadge tone="info" title="Modelo ainda em validação pela CTIN">Modelo proposto</ToneBadge>
                    ) : null}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums" title="Documentos obrigatórios atendidos">{conformityPercent(version.conformity as never)}%</span>
                    <ToneBadge tone={badge.tone} title={badge.hint}>{badge.label}</ToneBadge>
                    <ChevronDown aria-hidden="true" className={cn("size-4 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", expanded && "rotate-180")} />
                  </span>
                </button>
                <Presence open={expanded}>
                  <div className="border-t border-border px-3 py-2">
                    <p className="mb-2 text-xs text-muted-foreground">
                      Criada por {personName(version.createdBy)} em {stamp(version.createdAt)} · modelo rev. {version.templateRevision} · {version.rounds} {version.rounds === 1 ? "rodada de avaliação" : "rodadas de avaliação"}
                    </p>
                    <ul className="flex flex-col divide-y divide-border">
                      {version.items.map((item) => (
                        <ItemRow
                          key={item.id}
                          item={item}
                          access={access}
                          closed={closed}
                          busy={approving.busy}
                          onAct={(kind) => setDecision({ kind, versionId: version.id, item })}
                          onApprove={() => approving.run(() => approveDeliveryItem(projectId, version.id, item.id, {}), "Documento aprovado.", "Não foi possível aprovar o documento.")}
                        />
                      ))}
                    </ul>
                  </div>
                </Presence>
              </li>
            );
          })}
        </ul>
        </>
      )}

      <NewVersionDialog open={creating} projectId={projectId} onClose={() => setCreating(false)} onDone={() => void load()} />
      <DecisionDialog decision={decision} projectId={projectId} onClose={() => setDecision(null)} onDone={() => void load()} />
      {canManageTemplates(access) ? <DeliveryTemplatesDialog open={templates} onClose={() => setTemplates(false)} /> : null}
    </SectionCard>
  );
}

/** Totais do projeto: percentual de obrigatórios atendidos, versões conformes e documentos por situação. */
function ComplianceOverview({ versions }: { versions: Version[] }) {
  const summary = complianceSummary(versions.map((version) => version.conformity as never));
  const blocking = summary.required - summary.satisfied;
  const stats: Array<{ label: string; value: number; hint: string | null; tone: string }> = [
    { label: "Aprovados", value: summary.approved, hint: summary.dispensed > 0 ? `+${summary.dispensed} dispensado${summary.dispensed === 1 ? "" : "s"}` : null, tone: "bg-status-done" },
    { label: "Pendentes", value: summary.pending + summary.awaitingValidation, hint: summary.awaitingValidation > 0 ? `${summary.awaitingValidation} em validação` : null, tone: "bg-status-attention" },
    { label: "Rejeitados", value: summary.rejected, hint: summary.rejected > 0 ? "aguardam correção" : null, tone: "bg-status-critical" },
  ];
  return (
    <div className="grid gap-4 rounded-lg border border-border bg-muted/30 p-3.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] dark:bg-muted/40" aria-live="polite">
      <div className="flex min-w-0 flex-col justify-center gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-2xl font-semibold tabular-nums text-foreground">{summary.percent}%</span>
          <span className="text-xs text-muted-foreground">
            de conformidade · {summary.satisfied} de {summary.required} obrigatórios atendidos
          </span>
        </div>
        <Progress
          value={summary.percent}
          aria-label="Conformidade documental do projeto"
          className="[&_[data-slot=progress-indicator]]:bg-primary [&_[data-slot=progress-track]]:h-1.5 [&_[data-slot=progress-track]]:bg-muted"
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {summary.versions} {summary.versions === 1 ? "versão" : "versões"} · {summary.conformingVersions} {summary.conformingVersions === 1 ? "conforme" : "conformes"}
          </span>
          {blocking > 0 ? (
            <ToneBadge tone="warning" title="Documentos obrigatórios pendentes, sem validação ou rejeitados bloqueiam a homologação do marco final e o encerramento.">
              {blocking} {blocking === 1 ? "pendência bloqueia" : "pendências bloqueiam"} o encerramento
            </ToneBadge>
          ) : (
            <ToneBadge tone="success" title="Todos os documentos obrigatórios estão aprovados ou dispensados.">Documentação em conformidade</ToneBadge>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="flex min-w-0 flex-col gap-0.5 rounded-md border border-border bg-card px-2.5 py-2">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("size-2 shrink-0 rounded-full", stat.tone)} aria-hidden="true" />
              {stat.label}
            </dt>
            <dd className="text-lg font-semibold tabular-nums text-foreground">{stat.value}</dd>
            {stat.hint ? <dd className="truncate text-label text-muted-foreground">{stat.hint}</dd> : null}
          </div>
        ))}
      </dl>
    </div>
  );
}

function ItemRow({ item, access, closed, busy, onAct, onApprove }: { item: Item; access: ViewerAccess; closed: boolean; busy: boolean; onAct: (kind: Decision["kind"]) => void; onApprove: () => void }) {
  const status = ITEM_STATUS[item.status as keyof typeof ITEM_STATUS];
  const evidence = evidenceDisplay(item.evidenceKind as EvidenceKind | null, item.evidenceRef);
  const mine = canSubmitDocuments(access) && !closed;
  const validate = !closed && canValidateItem({ status: item.status as never, submittedById: item.submittedBy?.id ?? null, validatorId: item.validator?.id ?? null }, access);
  return (
    <li className="flex flex-col gap-1.5 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{item.title}</span>
          <span className="text-xs text-muted-foreground">{item.required ? "Obrigatório" : "Opcional"}</span>
          <ToneBadge tone={status.tone} title={status.hint}>{status.label}</ToneBadge>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {mine && canSubmitItem(item.status as never) ? (
            <Button type="button" size="sm" variant="outline" onClick={() => onAct("submit")}>
              {item.status === "REJEITADO" ? "Reenviar" : "Enviar evidência"}
            </Button>
          ) : null}
          {validate ? (
            <>
              <Button type="button" size="sm" disabled={busy} onClick={onApprove}>Aprovar</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => onAct("reject")}>Rejeitar</Button>
            </>
          ) : null}
          {!closed && canWaiveDocuments(access) && item.required && canWaiveItem(item.status as never) ? (
            <Button type="button" size="sm" variant="ghost" onClick={() => onAct("waive")}>Dispensar</Button>
          ) : null}
        </div>
      </div>
      {evidence ? (
        <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {evidence.kindLabel}:{" "}
          {evidence.href ? (
            <a href={evidence.href} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 break-all text-primary underline-offset-2 hover:underline">
              {evidence.text} <ExternalLink aria-hidden="true" className="size-3" />
            </a>
          ) : (
            <span className="break-all">{evidence.text}</span>
          )}
          {item.submittedBy ? <> · enviado por {personName(item.submittedBy)}{item.submittedAt ? ` em ${stamp(item.submittedAt)}` : ""}</> : null}
        </p>
      ) : null}
      {item.decisionNote ? (
        <p className="text-xs text-muted-foreground">
          {status.label} por {personName(item.decidedBy)}{item.decidedAt ? ` em ${stamp(item.decidedAt)}` : ""}: {item.decisionNote}
        </p>
      ) : null}
    </li>
  );
}

function NewVersionDialog({ open, projectId, onClose, onDone }: { open: boolean; projectId: string; onClose: () => void; onDone: () => void }) {
  const [label, setLabel] = useState("");
  const [nature, setNature] = useState<Nature>("SISTEMAS");
  const [notes, setNotes] = useState("");
  const [touched, setTouched] = useState(false);
  const { busy, run } = useAction(() => {
    onDone();
    onClose();
  });
  const error = versionLabelError(label);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia o formulário a cada abertura
      setLabel("");
      setNotes("");
      setTouched(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(value) => (!value && !busy ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova versão da entrega</DialogTitle>
          <DialogDescription>O checklist é copiado da revisão publicada do modelo da natureza escolhida. Modelos posteriores não alteram esta versão.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delivery-version-label">Versão do produto</Label>
            <Input id="delivery-version-label" value={label} placeholder="1.0" aria-invalid={touched && !!error} onChange={(event) => setLabel(event.target.value)} />
            {touched && error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Natureza</Label>
            <OptionCombobox label="Natureza" value={nature} onChange={(value) => setNature(value as Nature)} options={NATURES.map((value) => ({ value, label: NATURE_LABEL[value] }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delivery-version-notes">Observações (opcional)</Label>
            <Textarea id="delivery-version-notes" value={notes} maxLength={2000} onChange={(event) => setNotes(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              setTouched(true);
              if (error) return;
              void run(
                () => createDeliveryVersion(projectId, { versionLabel: label.trim(), nature, notes: notes.trim() ? notes.trim() : null }),
                "Versão criada.",
                "Não foi possível criar a versão.",
              );
            }}
          >
            Criar versão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const DECISION_COPY = {
  submit: { title: "Enviar evidência", description: "Informe onde está o documento. Não anexamos arquivos: use o link do SharePoint ou a tag/release do GitLab.", cta: "Enviar", ok: "Evidência enviada.", fail: "Não foi possível enviar a evidência." },
  reject: { title: "Rejeitar documento", description: "A justificativa é obrigatória e fica no histórico. O fornecedor poderá reenviar o documento corrigido.", cta: "Rejeitar", ok: "Documento rejeitado.", fail: "Não foi possível rejeitar o documento." },
  waive: { title: "Dispensar documento", description: "A dispensa é formal, exige justificativa e fica registrada no histórico e na auditoria do projeto. Só vale para documento obrigatório.", cta: "Dispensar", ok: "Documento dispensado.", fail: "Não foi possível dispensar o documento." },
} as const;

function DecisionDialog({ decision, projectId, onClose, onDone }: { decision: Decision | null; projectId: string; onClose: () => void; onDone: () => void }) {
  const [kind, setKind] = useState<EvidenceKind>("SHAREPOINT");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const { busy, run } = useAction(() => {
    onDone();
    onClose();
  });
  // Mantém o texto do último pedido enquanto o diálogo anima o fechamento.
  const [last, setLast] = useState<Decision | null>(null);
  const current = decision ?? last;

  useEffect(() => {
    if (decision) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia o formulário a cada abertura
      setLast(decision);
      setKind("SHAREPOINT");
      setReference("");
      setNote("");
      setTouched(false);
    }
  }, [decision]);

  if (!current) return null;
  const copy = DECISION_COPY[current.kind];
  const error = current.kind === "submit" ? evidenceError(kind, reference) : noteError(note);

  return (
    <Dialog open={decision !== null} onOpenChange={(value) => (!value && !busy ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{current.item.title}. {copy.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {current.kind === "submit" ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>Tipo de evidência</Label>
                <OptionCombobox label="Tipo de evidência" value={kind} onChange={(value) => setKind(value as EvidenceKind)} options={EVIDENCE_KIND_OPTIONS} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="delivery-evidence-ref">{kind === "GITLAB_TAG" || kind === "GITLAB_RELEASE" ? "Nome ou link" : "Link"}</Label>
                <Input id="delivery-evidence-ref" value={reference} aria-invalid={touched && !!error} onChange={(event) => setReference(event.target.value)} />
                {touched && error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="delivery-evidence-note">Observação (opcional)</Label>
                <Textarea id="delivery-evidence-note" value={note} maxLength={2000} onChange={(event) => setNote(event.target.value)} />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delivery-decision-note">Justificativa</Label>
              <Textarea id="delivery-decision-note" value={note} maxLength={2000} aria-invalid={touched && !!error} onChange={(event) => setNote(event.target.value)} />
              {touched && error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancelar</Button>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              setTouched(true);
              if (error) return;
              const { versionId, item } = current;
              const task =
                current.kind === "submit"
                  ? () => submitDeliveryItem(projectId, versionId, item.id, { evidenceKind: kind, evidenceRef: reference.trim(), note: note.trim() ? note.trim() : null })
                  : current.kind === "reject"
                    ? () => rejectDeliveryItem(projectId, versionId, item.id, { note: note.trim() })
                    : () => waiveDeliveryItem(projectId, versionId, item.id, { note: note.trim() });
              void run(task, copy.ok, copy.fail);
            }}
          >
            {copy.cta}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
