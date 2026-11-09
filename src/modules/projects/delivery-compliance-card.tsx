"use client";

import { ChevronDown, ExternalLink, FileCheck2, Plus, Settings2 } from "lucide-react";
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
  conformityBadge,
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
import { Panel } from "./overview-panel";

type Version = ListDeliveryVersions200DataItem;
type Item = ListDeliveryVersions200DataItemItemsItem;
type State = { status: "loading" } | { status: "ready"; versions: Version[] } | { status: "error" };

const TONE_CLASS: Record<Tone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  success: "border-success/40 bg-success/10 text-success-foreground",
  warning: "border-warning/50 bg-warning/10 text-warning-foreground",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
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
 * evidência (link do SharePoint ou tag/release do GitLab), validar, rejeitar e (PMO) dispensar com justificativa. O servidor
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
  const pendingTotal = versions.reduce((sum, version) => sum + version.conformity.blockingItems.length, 0);

  return (
    <Panel
      title="Conformidade de Entrega"
      subtitle="Documentos exigidos por versão para homologar o marco final e encerrar o projeto"
      icon={FileCheck2}
      count={state.status === "ready" ? pendingTotal : null}
      countTone="amber"
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
        <Skeleton className="h-24 rounded-xl" aria-busy="true" aria-label="Carregando conformidade de entrega" />
      ) : state.status === "error" ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Não foi possível carregar a conformidade de entrega.</p>
          <Button type="button" size="sm" variant="outline" onClick={() => { setState({ status: "loading" }); void load(); }}>
            Tentar novamente
          </Button>
        </div>
      ) : versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma versão registrada. {canCreate ? "Crie a primeira versão para abrir o checklist documental do modelo da natureza do projeto." : "O gestor ou o fornecedor cria a versão da entrega."}
        </p>
      ) : (
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
      )}

      <NewVersionDialog open={creating} projectId={projectId} onClose={() => setCreating(false)} onDone={() => void load()} />
      <DecisionDialog decision={decision} projectId={projectId} onClose={() => setDecision(null)} onDone={() => void load()} />
      {canManageTemplates(access) ? <DeliveryTemplatesDialog open={templates} onClose={() => setTemplates(false)} /> : null}
    </Panel>
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
  waive: { title: "Dispensar documento", description: "A dispensa é formal, exige justificativa e fica registrada no histórico. Só vale para documento obrigatório.", cta: "Dispensar", ok: "Documento dispensado.", fail: "Não foi possível dispensar o documento." },
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
