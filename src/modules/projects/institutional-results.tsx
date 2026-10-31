"use client";

import {
  Archive,
  Check,
  ChevronDown,
  ExternalLink,
  Link2,
  Pencil,
  Plus,
  Target,
} from "lucide-react";
import { useState } from "react";

import { OptionCombobox, type ComboOption } from "@/components/option-combobox";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Presence } from "@/components/ui/presence";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveProjectResult,
  createProjectResult,
  decideProjectResult,
  registerProjectResultEvidence,
  updateProjectResult,
} from "@/lib/api/generated/visão-institucional/visão-institucional";
import { cn } from "@/lib/utils";

import { formatCivilDate } from "./eap-date-field";
import { civilDateInput } from "./eap-present";
import {
  maxLengthOf,
  NarrativeField,
  useProfileEditing,
} from "./institutional-about";
import {
  ExpandableText,
  PendingDecision,
  personName,
  stamp,
  useAction,
  type FieldData,
  type Overview,
} from "./institutional-shared";
import { SectionCard } from "./overview-panel";

type ResultItem = Overview["results"]["expected"][number];
type Permissions = Overview["permissions"];
type Evidence = Overview["evidences"][number];
type ResultType = "ESPERADO" | "ALCANCADO";

const iso = (date: string) => (date ? `${date}T15:00:00.000Z` : null);
const dateOf = (value: string | null | undefined) =>
  civilDateInput(value ?? null) ?? "";
const day = (value: string | null | undefined) =>
  value ? formatCivilDate(civilDateInput(value)) : "";

type Draft = {
  text: string;
  date: string;
  milestoneId: string;
  target: string;
  indicator: string;
  dueDate: string;
  obtainedValue: string;
  observation: string;
  unforeseen: boolean;
  expectedIds: string[];
};

const EMPTY_DRAFT: Draft = {
  text: "",
  date: "",
  milestoneId: "",
  target: "",
  indicator: "",
  dueDate: "",
  obtainedValue: "",
  observation: "",
  unforeseen: false,
  expectedIds: [],
};

/** Valores de partida da edição: o esperado parte da versão publicada; o alcançado, do rascunho pendente, se houver. */
function draftOf(item: ResultItem): Draft {
  const content =
    item.type === "ESPERADO"
      ? (item.published?.content ?? item.draft?.content)
      : (item.draft?.content ?? item.published?.content);
  return {
    text: content?.text ?? "",
    date: dateOf(content?.resultDate),
    milestoneId: content?.milestone?.id ?? "",
    target: content?.details?.target ?? "",
    indicator: content?.details?.indicator ?? "",
    dueDate: dateOf(content?.details?.dueDate),
    obtainedValue: content?.details?.obtainedValue ?? "",
    observation: content?.details?.observation ?? "",
    unforeseen: item.unforeseen,
    expectedIds: item.expected.map((link) => link.id),
  };
}

function buildBody(type: ResultType, draft: Draft) {
  const clean = (value: string) => (value.trim() ? value.trim() : null);
  const details =
    type === "ESPERADO"
      ? {
          target: clean(draft.target),
          indicator: clean(draft.indicator),
          dueDate: iso(draft.dueDate),
        }
      : {
          indicator: clean(draft.indicator),
          obtainedValue: clean(draft.obtainedValue),
          observation: clean(draft.observation),
        };
  return {
    text: draft.text.trim(),
    resultDate: type === "ALCANCADO" ? iso(draft.date) : null,
    milestoneId: draft.milestoneId || null,
    details,
    ...(type === "ALCANCADO"
      ? {
          unforeseen: draft.unforeseen,
          expectedIds: draft.unforeseen ? [] : draft.expectedIds,
        }
      : {}),
  };
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-semibold text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function ResultForm({
  type,
  initial,
  milestones,
  expectedOptions,
  busy,
  onSave,
  onCancel,
}: {
  type: ResultType;
  initial: Draft;
  milestones: ComboOption[];
  expectedOptions: { id: string; text: string }[];
  busy: boolean;
  onSave: (draft: Draft) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const unchanged =
    JSON.stringify({ ...draft, text: draft.text.trim() }) ===
    JSON.stringify({ ...initial, text: initial.text.trim() });
  const small = "h-8 text-xs md:text-xs";

  return (
    <div className="motion-fade flex flex-col gap-2.5 rounded-md border bg-background p-3">
      <Field
        label={
          type === "ESPERADO" ? "Benefício esperado" : "Resultado alcançado"
        }
      >
        <Textarea
          value={draft.text}
          onChange={(event) => set("text", event.target.value)}
          maxLength={2000}
          autoFocus
          placeholder={
            type === "ESPERADO"
              ? "Ex.: Reduzir em 70% os chamados de recuperação de senha."
              : "Ex.: Os chamados diminuíram 55%, conforme relatório do GLPI."
          }
          className="min-h-16 text-xs md:text-xs"
        />
      </Field>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {type === "ESPERADO" ? (
          <>
            <Field label="Meta (opcional)">
              <Input
                value={draft.target}
                onChange={(event) => set("target", event.target.value)}
                maxLength={1000}
                className={small}
              />
            </Field>
            <Field label="Indicador (opcional)">
              <Input
                value={draft.indicator}
                onChange={(event) => set("indicator", event.target.value)}
                maxLength={1000}
                className={small}
              />
            </Field>
            <Field label="Prazo previsto (opcional)">
              <Input
                type="date"
                value={draft.dueDate}
                onChange={(event) => set("dueDate", event.target.value)}
                className={small}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Data de aferição (opcional)">
              <Input
                type="date"
                value={draft.date}
                onChange={(event) => set("date", event.target.value)}
                className={small}
              />
            </Field>
            <Field label="Indicador (opcional)">
              <Input
                value={draft.indicator}
                onChange={(event) => set("indicator", event.target.value)}
                maxLength={1000}
                className={small}
              />
            </Field>
            <Field label="Valor obtido (opcional)">
              <Input
                value={draft.obtainedValue}
                onChange={(event) => set("obtainedValue", event.target.value)}
                maxLength={1000}
                className={small}
              />
            </Field>
          </>
        )}
      </div>
      {type === "ALCANCADO" ? (
        <Field label="Observações (opcional)">
          <Textarea
            value={draft.observation}
            onChange={(event) => set("observation", event.target.value)}
            maxLength={1000}
            className="min-h-12 text-xs md:text-xs"
          />
        </Field>
      ) : null}
      {milestones.length > 0 ? (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-muted-foreground">
            Marco da EAP (opcional, não gera homologação)
          </span>
          <OptionCombobox
            label="Marco da EAP (opcional)"
            value={draft.milestoneId}
            onChange={(value) => set("milestoneId", value)}
            options={milestones}
            placeholder="Vincular a um marco"
            clearable
            compact
            disabled={busy}
          />
        </div>
      ) : null}
      {type === "ALCANCADO" ? (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-semibold text-muted-foreground">
            Resultados esperados aferidos (opcional)
          </legend>
          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={draft.unforeseen}
              onCheckedChange={(checked) => set("unforeseen", checked === true)}
            />
            Resultado não previsto inicialmente
          </label>
          {draft.unforeseen ? null : expectedOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum resultado esperado cadastrado para vincular.
            </p>
          ) : (
            expectedOptions.map((option) => (
              <label key={option.id} className="flex items-start gap-2 text-xs">
                <Checkbox
                  checked={draft.expectedIds.includes(option.id)}
                  onCheckedChange={(checked) =>
                    set(
                      "expectedIds",
                      checked === true
                        ? [...draft.expectedIds, option.id]
                        : draft.expectedIds.filter((id) => id !== option.id),
                    )
                  }
                />
                <span className="line-clamp-2 break-words">{option.text}</span>
              </label>
            ))
          )}
        </fieldset>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="button"
          size="xs"
          disabled={busy || draft.text.trim().length === 0 || unchanged}
          onClick={() => onSave(draft)}
        >
          {busy ? "Salvando…" : "Salvar"}
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={busy}
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ item }: { item: ResultItem }) {
  const tone = {
    VALIDATED: [
      "Validado",
      "border-success/40 bg-success/10 text-success-foreground",
    ],
    PENDING_VALIDATION: [
      "Aguardando validação",
      "border-warning/50 bg-warning/10 text-warning-foreground",
    ],
    CORRECTIONS_REQUESTED: [
      "Correções solicitadas",
      "border-destructive/40 bg-destructive/10 text-destructive",
    ],
    EMPTY: null,
  } as const;
  // Esperados são publicados direto: o selo "Publicado" evita sugerir uma validação que não existe.
  const entry =
    item.type === "ESPERADO"
      ? item.published
        ? ([
            "Publicado",
            "border-primary/30 bg-primary/10 text-primary",
          ] as const)
        : null
      : tone[item.status];
  return entry ? (
    <Badge variant="outline" className={cn("h-5 px-1.5 text-[11px]", entry[1])}>
      {entry[0]}
    </Badge>
  ) : null;
}

function detailsLine(
  item: ResultItem,
  content: NonNullable<ResultItem["published"]>["content"],
) {
  const details = content.details;
  return [
    item.type === "ALCANCADO" && content.resultDate
      ? `Aferido em ${day(content.resultDate)}`
      : null,
    details?.target ? `Meta: ${details.target}` : null,
    details?.indicator ? `Indicador: ${details.indicator}` : null,
    details?.obtainedValue ? `Valor obtido: ${details.obtainedValue}` : null,
    details?.dueDate ? `Prazo previsto: ${day(details.dueDate)}` : null,
    content.milestone ? `Marco: ${content.milestone.title}` : null,
  ].filter(Boolean) as string[];
}

function EvidenceList({
  projectId,
  resultId,
  evidences,
  canAdd,
  onChanged,
}: {
  projectId: string;
  resultId: string;
  evidences: Evidence[];
  canAdd: boolean;
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const { busy, run } = useAction(onChanged);

  async function save() {
    const saved = await run(
      () =>
        registerProjectResultEvidence(projectId, resultId, {
          title: title.trim(),
          url: url.trim(),
        }),
      "Evidência vinculada ao resultado.",
      "Não foi possível vincular a evidência.",
    );
    if (saved) {
      setAdding(false);
      setTitle("");
      setUrl("");
    }
  }

  if (evidences.length === 0 && !canAdd) {
    return null;
  }
  return (
    <div className="flex flex-col gap-1">
      {evidences.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {evidences.map((evidence) => (
            <li key={evidence.id}>
              <a
                href={evidence.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-56 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-primary hover:bg-primary/5"
                title={evidence.title}
              >
                <Link2 className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{evidence.title}</span>
                <ExternalLink
                  className="size-2.5 shrink-0"
                  aria-hidden="true"
                />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {canAdd && !adding ? (
        <button
          type="button"
          className="w-fit text-xs font-semibold text-primary hover:underline"
          onClick={() => setAdding(true)}
        >
          + Adicionar evidência
        </button>
      ) : null}
      {adding ? (
        <div className="flex flex-col gap-1.5 rounded-md border bg-background p-2">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={255}
            placeholder="Título do documento"
            aria-label="Título da evidência"
            className="h-7 text-xs md:text-xs"
          />
          <Input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            maxLength={2000}
            placeholder="https://"
            aria-label="Link da evidência"
            className="h-7 text-xs md:text-xs"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="xs"
              disabled={busy || !title.trim() || !url.trim()}
              onClick={() => void save()}
            >
              {busy ? "Salvando…" : "Salvar"}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="outline"
              disabled={busy}
              onClick={() => setAdding(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ResultRow({
  projectId,
  item,
  permissions,
  userId,
  managing,
  milestones,
  expectedOptions,
  evidences,
  onChanged,
}: {
  projectId: string;
  item: ResultItem;
  permissions: Permissions;
  userId: string;
  managing: boolean;
  milestones: ComboOption[];
  expectedOptions: { id: string; text: string }[];
  evidences: Evidence[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const { busy, run } = useAction(onChanged);
  const expected = item.type === "ESPERADO";
  const content = item.published?.content;
  const pending = item.draft?.content;
  const mine = !permissions.ownResultsOnly || item.createdBy.id === userId;
  const canManage = managing && permissions.canRegisterResults && mine;

  async function save(draft: Draft) {
    const done = await run(
      () =>
        updateProjectResult(projectId, item.id, buildBody(item.type, draft)),
      expected
        ? "Resultado esperado atualizado."
        : item.status === "CORRECTIONS_REQUESTED"
          ? "Correções enviadas para nova validação."
          : "Resultado salvo. Aguarda validação.",
      "Não foi possível salvar o resultado.",
    );
    if (done) {
      setEditing(false);
    }
  }

  const decide = (decision: "VALIDATE" | "REJECT", reason?: string) =>
    run(
      () =>
        decideProjectResult(projectId, item.id, {
          decision,
          ...(reason ? { reason } : {}),
        }),
      decision === "VALIDATE"
        ? "Resultado validado."
        : "Correções solicitadas ao responsável.",
      "Não foi possível registrar a decisão.",
    );

  async function archive() {
    if (
      await run(
        () => archiveProjectResult(projectId, item.id),
        "Resultado arquivado.",
        "Não foi possível arquivar o resultado.",
      )
    ) {
      setArchiving(false);
    }
  }

  if (editing) {
    return (
      <li>
        <ResultForm
          type={item.type}
          initial={draftOf(item)}
          milestones={milestones}
          expectedOptions={expectedOptions}
          busy={busy}
          onSave={(draft) => void save(draft)}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  const shown = content ?? pending;
  const meta = shown ? detailsLine(item, shown) : [];

  return (
    <li className="flex flex-col gap-1.5">
      {item.status !== "EMPTY" || canManage ? (
        <div className="flex min-h-6 items-center justify-between gap-2">
          <StatusBadge item={item} />
          {canManage ? (
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Editar resultado"
                onClick={() => setEditing(true)}
              >
                <Pencil aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Arquivar resultado"
                onClick={() => setArchiving(true)}
              >
                <Archive aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
      {content ? (
        <div className="min-w-0">
          <ExpandableText text={content.text} />
          {meta.length > 0 ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {meta.join(" · ")}
            </p>
          ) : null}
          {content.details?.observation ? (
            <p className="mt-0.5 text-xs break-words text-muted-foreground">
              Obs.: {content.details.observation}
            </p>
          ) : null}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {expected
              ? `Informado por ${personName(item.published?.author)} · ${stamp(item.published?.authoredAt ?? "")}`
              : `Validado por ${personName(item.published?.validatedBy)} · ${stamp(item.published?.validatedAt ?? "")}`}
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {!expected && item.unforeseen ? (
          <Badge variant="outline" className="h-5 px-1.5 text-[11px]">
            Não previsto
          </Badge>
        ) : null}
        {!expected ? (
          item.expected.map((link) => (
            <Badge
              key={link.id}
              variant="secondary"
              className="h-5 max-w-56 gap-1 px-1.5 text-[11px]"
              title={`Afere: ${link.text}`}
            >
              <Link2 aria-hidden="true" />
              <span className="truncate">Afere: {link.text}</span>
            </Badge>
          ))
        ) : item.achievedCount > 0 ? (
          <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[11px]">
            <Link2 aria-hidden="true" />
            {item.achievedCount}{" "}
            {item.achievedCount === 1 ? "aferição" : "aferições"}
          </Badge>
        ) : null}
      </div>

      {item.correction ? (
        <div
          role="status"
          className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2"
        >
          <p className="text-xs font-semibold text-destructive">
            Correções solicitadas
            {content
              ? " · a versão publicada acima continua válida"
              : " · ainda não aprovado"}
          </p>
          {item.draft ? (
            <div className="mt-1 rounded-sm border border-dashed border-destructive/30 bg-background/60 px-2 py-1.5">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Conteúdo não aprovado
              </p>
              <ExpandableText text={item.draft.content.text} />
            </div>
          ) : null}
          <p className="mt-1.5 text-xs font-semibold text-muted-foreground">
            Justificativa
          </p>
          <p className="text-xs break-words whitespace-pre-wrap">
            {item.correction.reason}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {personName(item.correction.by)} · {stamp(item.correction.at)}
            {mine && permissions.canRegisterResults
              ? " · Use o lápis do modo de edição para corrigir e reenviar."
              : ""}
          </p>
        </div>
      ) : null}

      {!expected && item.draft && item.status === "PENDING_VALIDATION" ? (
        <PendingDecision
          authorLine={`Salvo por ${personName(item.draft.author)} · ${stamp(item.draft.savedAt)}`}
          canDecide={permissions.canValidateResults}
          ownDraft={item.draft.author.id === userId}
          busy={busy}
          rejectTitle="Solicitar correções do resultado"
          onValidate={() => decide("VALIDATE")}
          onReject={(reason) => decide("REJECT", reason)}
        >
          {item.draft.content.text}
        </PendingDecision>
      ) : null}

      {expected && item.draft ? (
        <Collapsible>
          <CollapsibleTrigger
            render={
              <button
                type="button"
                className="group/draft inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              />
            }
          >
            <ChevronDown
              className="size-3 transition-transform group-data-panel-open/draft:rotate-180 motion-reduce:transition-none"
              aria-hidden="true"
            />
            Rascunho anterior (não publicado)
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1.5 rounded-md border border-dashed px-3 py-2">
              <ExpandableText
                text={item.draft.content.text}
                className="text-foreground/80"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {personName(item.draft.author)} · {stamp(item.draft.savedAt)}
                {canManage ? " · Edite e salve para publicar." : ""}
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      <EvidenceList
        projectId={projectId}
        resultId={item.id}
        evidences={evidences}
        canAdd={canManage}
        onChanged={onChanged}
      />

      <AlertDialog
        open={archiving}
        onOpenChange={(next) => {
          if (!busy) {
            setArchiving(next);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Arquivar resultado?</AlertDialogTitle>
            <AlertDialogDescription>
              O resultado deixa de aparecer na Visão Geral, mas o registro e o
              histórico são mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void archive()}
            >
              {busy ? "Arquivando…" : "Arquivar"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  );
}

/** Linha "Acompanhamento Detalhado" com seta que gira: abre e recolhe a seção dentro do cartão. */
function DetailsTrigger({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className="inline-flex items-center gap-2 self-start text-xs font-semibold text-muted-foreground hover:text-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <ChevronDown
        className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")}
        aria-hidden="true"
      />
      Acompanhamento Detalhado
    </button>
  );
}

function ResultColumn({
  projectId,
  type,
  title,
  items,
  permissions,
  userId,
  managing,
  milestones,
  expectedOptions,
  evidences,
  onChanged,
}: {
  projectId: string;
  type: ResultType;
  title: string;
  items: ResultItem[];
  permissions: Permissions;
  userId: string;
  managing: boolean;
  milestones: ComboOption[];
  expectedOptions: { id: string; text: string }[];
  evidences: Evidence[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const { busy, run } = useAction(onChanged);

  async function create(draft: Draft) {
    const done = await run(
      () => createProjectResult(projectId, { type, ...buildBody(type, draft) }),
      type === "ESPERADO"
        ? "Resultado esperado publicado."
        : "Resultado registrado. Aguarda validação.",
      "Não foi possível registrar o resultado.",
    );
    if (done) {
      setAdding(false);
    }
  }

  return (
    <section className="flex min-w-0 flex-col gap-2.5" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold">
          {title}
          <span
            className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground"
            aria-label={`${items.length} registrados`}
          >
            {String(items.length).padStart(2, "0")}
          </span>
        </h3>
        {managing && permissions.canRegisterResults && !adding ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => setAdding(true)}
          >
            <Plus aria-hidden="true" /> Adicionar
          </Button>
        ) : null}
      </div>
      {adding ? (
        <ResultForm
          type={type}
          initial={EMPTY_DRAFT}
          milestones={milestones}
          expectedOptions={expectedOptions}
          busy={busy}
          onSave={(draft) => void create(draft)}
          onCancel={() => setAdding(false)}
        />
      ) : null}
      {items.length === 0 && !adding ? (
        <p className="text-xs text-muted-foreground">
          Nenhum resultado registrado.
        </p>
      ) : (
        <ul className="flex flex-col gap-3 divide-y [&>li:not(:first-child)]:pt-3">
          {items.map((item) => (
            <ResultRow
              key={item.id}
              projectId={projectId}
              item={item}
              permissions={permissions}
              userId={userId}
              managing={managing}
              milestones={milestones}
              expectedOptions={expectedOptions}
              evidences={evidences.filter(
                (evidence) => evidence.projectResultId === item.id,
              )}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Acompanhamento Detalhado dos Resultados Esperados e Alcançados (colunas lado a lado), com vínculos, evidências, validação
 * e permissões. O gerenciamento (adicionar, editar, arquivar) liga e desliga junto com o lápis do cartão (`managing`).
 */
export function ResultsPanel({
  projectId,
  results,
  permissions,
  evidences,
  userId,
  milestones,
  onChanged,
  managing,
}: {
  projectId: string;
  results: Overview["results"];
  permissions: Permissions;
  evidences: Evidence[];
  userId: string;
  milestones: ComboOption[];
  onChanged: () => void;
  managing: boolean;
}) {
  const expectedOptions = results.expected
    .filter((item) => item.published)
    .map((item) => ({ id: item.id, text: item.published?.content.text ?? "" }));

  return (
    <div className="@container">
      <section aria-label="Acompanhamento Detalhado" className="flex flex-col gap-4">
        <div className="grid items-start gap-5 @lg:grid-cols-2">
          <ResultColumn
            projectId={projectId}
            type="ESPERADO"
            title="Resultados esperados"
            items={results.expected}
            permissions={permissions}
            userId={userId}
            managing={managing}
            milestones={milestones}
            expectedOptions={expectedOptions}
            evidences={evidences}
            onChanged={onChanged}
          />
          <ResultColumn
            projectId={projectId}
            type="ALCANCADO"
            title="Resultados alcançados"
            items={results.achieved}
            permissions={permissions}
            userId={userId}
            managing={managing}
            milestones={milestones}
            expectedOptions={expectedOptions}
            evidences={evidences}
            onChanged={onChanged}
          />
        </div>
      </section>
    </div>
  );
}

/**
 * Resultados para o IGEPPS no dashboard: a síntese aparece direto (o cartão cresce até o limite) e os totais de resultados
 * esperados e alcançados ficam sempre visíveis, com os que aguardam validação em destaque. "Ver detalhes" (Acompanhamento
 * Detalhado, validação e evidências) e a edição abrem no painel lateral; "Ver mais" aparece se a síntese passar do limite.
 */
export function ResultsCard(props: {
  projectId: string;
  summary: FieldData;
  canEditSummary: boolean;
  results: Overview["results"];
  permissions: Permissions;
  evidences: Evidence[];
  userId: string;
  milestones: ComboOption[];
  onChanged: () => void;
}) {
  const { summary, canEditSummary, results, permissions } = props;
  // Síntese (com o próprio "Ver mais") e Acompanhamento Detalhado são independentes: abrir um não abre o outro.
  // O lápis liga a edição da síntese e o gerenciamento dos resultados no próprio cartão, com a mesma transição do Sobre.
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const summaryEditing = useProfileEditing({
    projectId: props.projectId,
    field: () => summary,
    keys: ["RESULTS_SUMMARY"],
    onChanged: props.onChanged,
  });
  const canManage = permissions.canRegisterResults || canEditSummary;
  const closeDetails = () => {
    setDetailsOpen(false);
    setManaging(false);
    summaryEditing.setEditing(false);
  };
  const pending = [...results.expected, ...results.achieved].filter(
    (item) => item.status === "PENDING_VALIDATION",
  ).length;

  return (
    <SectionCard
      title="Resultados para o IGEPPS"
      subtitle="Benefícios esperados e resultados efetivamente alcançados."
      icon={Target}
      tone="green"
      unbounded
      action={
        canManage ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={managing ? "Concluir edição dos resultados" : "Editar resultados"}
            aria-pressed={managing}
            onClick={() => {
              if (managing) {
                closeDetails();
                return;
              }
              setManaging(true);
              setDetailsOpen(true);
              if (canEditSummary) {
                summaryEditing.start();
              }
            }}
          >
            {managing ? <Check aria-hidden="true" /> : <Pencil aria-hidden="true" />}
          </Button>
        ) : null
      }
    >
      <Presence open={summaryEditing.editing}>
        <div className="flex flex-col gap-1">
          <NarrativeField
            label="Síntese dos Resultados Institucionais"
            value={summaryEditing.values.RESULTS_SUMMARY ?? ""}
            onChange={(value) =>
              summaryEditing.setValues((previous) => ({ ...previous, RESULTS_SUMMARY: value }))
            }
            onCommit={(value) => void summaryEditing.commit("RESULTS_SUMMARY", value)}
            maxLength={maxLengthOf("RESULTS_SUMMARY")}
          />
          <p role="status" className="text-xs text-muted-foreground">
            {summaryEditing.saving > 0
              ? "Salvando…"
              : summaryEditing.saved
                ? "Síntese salva e registrada no histórico. Use o ✓ para concluir."
                : "A síntese é publicada ao sair do campo, sem homologação, e fica registrada no histórico."}
          </p>
        </div>
      </Presence>
      <Presence open={!summaryEditing.editing} className="min-h-0 flex-1">
        {summary.published ? (
          <div className="flex h-full min-h-0 flex-col">
            <p className="text-xs font-semibold text-[#475467]">
              Síntese dos Resultados Institucionais
            </p>
            <ExpandableText
              text={summary.published.value}
              markdown
              lines={10}
              chevron
              fill
            />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {canEditSummary
              ? "Nenhuma síntese registrada. Use o lápis para descrever os benefícios gerais do sistema."
              : "Nenhuma síntese dos resultados institucionais registrada."}
          </p>
        )}
      </Presence>
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <DetailsTrigger
          open={detailsOpen}
          onClick={() => (detailsOpen ? closeDetails() : setDetailsOpen(true))}
        />
        {pending > 0 ? (
          <span className="rounded-md bg-warning/20 px-2 py-1 text-xs font-medium text-warning-foreground">
            {pending} aguardando validação
          </span>
        ) : null}
      </div>
      <Presence open={detailsOpen}>
        <ResultsPanel
          projectId={props.projectId}
          results={results}
          permissions={permissions}
          evidences={props.evidences}
          userId={props.userId}
          milestones={props.milestones}
          onChanged={props.onChanged}
          managing={managing}
        />
      </Presence>
    </SectionCard>
  );
}
