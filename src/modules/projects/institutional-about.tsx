"use client";

import { Check, FileText, Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Presence } from "@/components/ui/presence";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TagsInput } from "@/components/ui/tags-input";
import { RichTextField } from "@/components/ui/rich-text-field";
import { saveProjectProfileField } from "@/lib/api/generated/visão-institucional/visão-institucional";
import { reportFailure } from "@/lib/feedback";
import { markdownLength } from "@/lib/rich-text";

import {
  formatSectors,
  parseSectors,
  splitVisible,
} from "./institutional-sectors";
import {
  ExpandableText,
  type FieldData,
  type Overview,
} from "./institutional-shared";
import { Panel, SectionCard } from "./overview-panel";

export type ProfileKey =
  | "PURPOSE"
  | "SCOPE"
  | "PROBLEM"
  | "REQUESTING_AREA"
  | "RESPONSIBLE_COMPANY"
  | "BENEFITED_SECTORS"
  | "SYSTEM_DESCRIPTION"
  | "RESULTS_SUMMARY";
type Key = ProfileKey;

const LABELS: Record<Key, string> = {
  PROBLEM: "Problema a Resolver",
  PURPOSE: "Finalidade",
  SCOPE: "Escopo",
  REQUESTING_AREA: "Área Solicitante",
  RESPONSIBLE_COMPANY: "Empresa Responsável",
  BENEFITED_SECTORS: "Setores Beneficiados",
  SYSTEM_DESCRIPTION: "O que o sistema faz",
  RESULTS_SUMMARY: "Síntese dos Resultados Institucionais",
};

/** Limite do Markdown persistido (igual ao da API): 8.000 nos dois textos narrativos novos, 4.000 nos demais. */
export const MAX_LENGTH: Partial<Record<ProfileKey, number>> = {
  SYSTEM_DESCRIPTION: 8000,
  RESULTS_SUMMARY: 8000,
};
export const maxLengthOf = (key: ProfileKey) => MAX_LENGTH[key] ?? 4000;

const ABOUT_KEYS: Key[] = [
  "SYSTEM_DESCRIPTION",
  "REQUESTING_AREA",
  "BENEFITED_SECTORS",
  "RESPONSIBLE_COMPANY",
];
const CONTEXT_KEYS: Key[] = ["PROBLEM", "PURPOSE", "SCOPE"];

export function fieldOf(data: Overview, key: Key): FieldData {
  switch (key) {
    case "SYSTEM_DESCRIPTION":
      return data.profile.systemDescription;
    case "RESULTS_SUMMARY":
      return data.profile.resultsSummary;
    case "PURPOSE":
      return data.profile.purpose;
    case "SCOPE":
      return data.profile.scope;
    case "PROBLEM":
      return data.profile.problem;
    case "REQUESTING_AREA":
      return data.origin.requestingArea;
    case "RESPONSIBLE_COMPANY":
      return data.profile.responsibleCompany;
    case "BENEFITED_SECTORS":
      return data.profile.benefitedSectors;
  }
}

/** Valor de partida da edição: o rascunho pendente, se houver; senão a versão validada. */
const baseOf = (field: FieldData) =>
  field.draft?.value ?? field.published?.value ?? "";

const NOT_INFORMED = (
  <span className="text-xs font-normal text-muted-foreground">
    Não informado
  </span>
);

/** Até quatro setores como badges discretos; os demais ficam em "+N setores", que abre a lista completa. */
function SectorBadges({ text }: { text: string }) {
  const sectors = parseSectors(text);
  const { visible, hidden } = splitVisible(sectors, 4);
  if (sectors.length === 0) {
    return NOT_INFORMED;
  }
  return (
    <span className="flex flex-wrap items-center gap-1">
      {visible.map((sector) => (
        <Badge
          key={sector}
          variant="secondary"
          className="h-5 max-w-full font-medium"
        >
          <span className="truncate">{sector}</span>
        </Badge>
      ))}
      {hidden > 0 ? (
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="rounded-full px-1 text-[11px] font-semibold text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
              />
            }
          >
            +{hidden} {hidden === 1 ? "setor" : "setores"}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64">
            <p className="text-xs font-semibold">
              Setores Beneficiados ({sectors.length})
            </p>
            <ul className="flex flex-wrap gap-1">
              {sectors.map((sector) => (
                <li key={sector}>
                  <Badge variant="secondary" className="h-5 font-medium">
                    {sector}
                  </Badge>
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      ) : null}
    </span>
  );
}

/**
 * Edição inline dos campos de perfil: cada campo é salvo ao sair dele, sem aprovação, e a alteração fica na auditoria.
 * Usado por Sobre o Sistema, Contexto e Planejamento e pela Síntese dos Resultados.
 */
export function useProfileEditing({
  projectId,
  field,
  keys,
  onChanged,
  initialEditing = false,
}: {
  projectId: string;
  field: (key: Key) => FieldData;
  keys: Key[];
  onChanged: () => void;
  /** Abre já em edição (o painel lateral aberto pelo lápis do cartão). */
  initialEditing?: boolean;
}) {
  const [editing, setEditing] = useState(initialEditing);
  const [values, setRawValues] = useState<Record<Key, string>>(
    () =>
      (initialEditing
        ? Object.fromEntries(keys.map((key) => [key, baseOf(field(key))]))
        : {}) as Record<Key, string>,
  );
  const [saving, setSaving] = useState(0);
  const [saved, setSaved] = useState(false);
  /** Há texto digitado ainda não gravado (aviso ao fechar a página). */
  const [dirty, setDirty] = useState(false);
  const setValues: typeof setRawValues = (next) => {
    setRawValues(next);
    setDirty(true);
  };
  /** Último valor já enviado por campo: evita gravar duas vezes o mesmo texto antes da tela recarregar. */
  const sent = useRef<Partial<Record<Key, string>>>({});

  function start() {
    setRawValues(
      Object.fromEntries(
        keys.map((key) => [key, baseOf(field(key))]),
      ) as Record<Key, string>,
    );
    setDirty(false);
    sent.current = {};
    setSaved(false);
    setEditing(true);
  }

  /** Campo vazio volta ao valor anterior: a API exige texto. */
  async function commit(key: Key, raw: string) {
    const next = raw.trim();
    const current = baseOf(field(key)).trim();
    if (next === (sent.current[key] ?? current)) {
      setDirty(false);
      return;
    }
    if (next.length === 0) {
      setValues((previous) => ({ ...previous, [key]: baseOf(field(key)) }));
      return;
    }
    if (markdownLength(next) > maxLengthOf(key)) {
      reportFailure(
        new Error("too long"),
        `"${LABELS[key]}" passa de ${maxLengthOf(key).toLocaleString("pt-BR")} caracteres. Reduza o texto para salvar.`,
      );
      return;
    }
    sent.current[key] = next;
    setSaving((count) => count + 1);
    setSaved(false);
    try {
      await saveProjectProfileField(projectId, key, { value: next });
      setSaved(true);
      setDirty(false);
      onChanged();
    } catch (caught) {
      delete sent.current[key];
      setValues((previous) => ({ ...previous, [key]: baseOf(field(key)) }));
      reportFailure(caught, `Não foi possível salvar "${LABELS[key]}".`);
    } finally {
      setSaving((count) => count - 1);
    }
  }

  /** Alteração digitada e ainda não gravada: avisa antes de fechar ou recarregar a página. */
  useEffect(() => {
    if (!(editing && dirty) && saving === 0) {
      return;
    }
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [editing, dirty, saving]);

  return {
    editing,
    setEditing,
    values,
    setValues,
    saving,
    saved,
    start,
    commit,
  };
}

/** Texto narrativo com editor de texto rico (Markdown), salvo ao sair do campo. */
export function NarrativeField({
  label,
  value,
  onChange,
  onCommit,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onCommit: (value: string) => void;
  maxLength: number;
}) {
  return (
    <RichTextField
      label={label}
      value={value}
      maxLength={maxLength}
      onChange={onChange}
      onCommit={onCommit}
    />
  );
}

export function EditToggle({
  editing,
  label,
  onToggle,
}: {
  editing: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={editing ? `Concluir edição: ${label}` : `Editar: ${label}`}
      aria-pressed={editing}
      onClick={onToggle}
    >
      {editing ? <Check aria-hidden="true" /> : <Pencil aria-hidden="true" />}
    </Button>
  );
}

/** Área Solicitante, Setores Beneficiados e Empresa Responsável (informação curta, igual no cartão e no painel). */
function AboutTiles({ data }: { data: Overview }) {
  return (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(9.5rem,1fr))] gap-2">
      <div className="min-w-0 rounded-md bg-muted/50 px-3 py-2">
        <dt className="text-xs text-muted-foreground">
          {LABELS.REQUESTING_AREA}
        </dt>
        <dd className="text-[12px] font-semibold break-words">
          {fieldOf(data, "REQUESTING_AREA").published?.value ?? NOT_INFORMED}
        </dd>
      </div>
      <div className="min-w-0 rounded-md bg-muted/50 px-3 py-2">
        <dt className="mb-0.5 text-xs text-muted-foreground">
          {LABELS.BENEFITED_SECTORS}
        </dt>
        <dd className="text-[12px] font-semibold">
          <SectorBadges
            text={fieldOf(data, "BENEFITED_SECTORS").published?.value ?? ""}
          />
        </dd>
      </div>
      <div className="min-w-0 rounded-md bg-muted/50 px-3 py-2">
        <dt className="text-xs text-muted-foreground">
          {LABELS.RESPONSIBLE_COMPANY}
        </dt>
        <dd className="text-[12px] font-semibold break-words">
          {fieldOf(data, "RESPONSIBLE_COMPANY").published?.value ??
            NOT_INFORMED}
        </dd>
      </div>
    </dl>
  );
}

/** Campos de edição do Sobre o Sistema (cada campo é salvo ao sair dele, sem aprovação). */
function AboutEditForm({
  values,
  setValues,
  saving,
  saved,
  commit,
}: Pick<ReturnType<typeof useProfileEditing>, "values" | "setValues" | "saving" | "saved" | "commit">) {
  return (
    <div className="flex flex-col gap-3">
          <NarrativeField
            label={LABELS.SYSTEM_DESCRIPTION}
            value={values.SYSTEM_DESCRIPTION ?? ""}
            onChange={(value) =>
              setValues((previous) => ({
                ...previous,
                SYSTEM_DESCRIPTION: value,
              }))
            }
            onCommit={(value) => void commit("SYSTEM_DESCRIPTION", value)}
            maxLength={maxLengthOf("SYSTEM_DESCRIPTION")}
          />
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground">
              {LABELS.REQUESTING_AREA}
            </span>
            <Input
              value={values.REQUESTING_AREA ?? ""}
              onChange={(event) =>
                setValues({ ...values, REQUESTING_AREA: event.target.value })
              }
              onBlur={() =>
                void commit("REQUESTING_AREA", values.REQUESTING_AREA ?? "")
              }
              maxLength={4000}
              className="h-8 text-xs md:text-xs"
            />
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground">
              {LABELS.BENEFITED_SECTORS}
            </span>
            <TagsInput
              aria-label="Setores Beneficiados"
              value={parseSectors(values.BENEFITED_SECTORS)}
              onChange={(next) => {
                const text = formatSectors(next);
                setValues({ ...values, BENEFITED_SECTORS: text });
                void commit("BENEFITED_SECTORS", text);
              }}
              placeholder="Digite o nome ou a sigla e pressione Enter"
            />
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground">
              {LABELS.RESPONSIBLE_COMPANY}
            </span>
            <Input
              value={values.RESPONSIBLE_COMPANY ?? ""}
              onChange={(event) =>
                setValues({
                  ...values,
                  RESPONSIBLE_COMPANY: event.target.value,
                })
              }
              onBlur={() =>
                void commit(
                  "RESPONSIBLE_COMPANY",
                  values.RESPONSIBLE_COMPANY ?? "",
                )
              }
              maxLength={4000}
              className="h-8 text-xs md:text-xs"
            />
          </label>
          <p role="status" className="text-xs text-muted-foreground">
            {saving > 0
              ? "Salvando…"
              : saved
                ? "Alterações salvas. Use o ✓ para concluir a edição."
                : "Cada campo é salvo ao sair dele, sem aprovação, e a alteração fica registrada no histórico."}
          </p>
        </div>
  );
}

/**
 * "Sobre o Sistema" no dashboard: o texto aparece direto (com o próprio "Ver mais") e as três informações curtas ficam no
 * rodapé. O lápis liga a edição no próprio cartão (o ✓ a conclui), com a mesma transição do Contexto e Planejamento:
 * os blocos de visualização e de edição trocam de lugar com altura e opacidade suaves.
 */
export function AboutProject({ projectId, data, onChanged }: { projectId: string; data: Overview; onChanged: () => void }) {
  const { canEdit } = data.permissions;
  const { editing, setEditing, values, setValues, saving, saved, start, commit } = useProfileEditing({
    projectId,
    field: (key) => fieldOf(data, key),
    keys: ABOUT_KEYS,
    onChanged,
  });
  const description = fieldOf(data, "SYSTEM_DESCRIPTION").published?.value ?? null;
  const empty = ABOUT_KEYS.every((key) => !fieldOf(data, key).published);

  return (
    <SectionCard
      title="Sobre o Sistema"
      subtitle="Descrição institucional e principais funcionalidades."
      icon={FileText}
      tone="blue"
      unbounded
      footer={
        <Presence open={!editing}>
          <AboutTiles data={data} />
        </Presence>
      }
      action={
        canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={editing ? "Concluir edição do Sobre o Sistema" : "Editar Sobre o Sistema"}
            aria-pressed={editing}
            onClick={() => (editing ? setEditing(false) : start())}
          >
            {editing ? <Check aria-hidden="true" /> : <Pencil aria-hidden="true" />}
          </Button>
        ) : null
      }
    >
      <Presence open={editing}>
        <AboutEditForm values={values} setValues={setValues} saving={saving} saved={saved} commit={commit} />
      </Presence>
      <Presence open={!editing} className="min-h-0 flex-1">
        {description ? (
          <div className="flex h-full min-h-0 flex-col">
            <p className="text-xs font-semibold text-[#475467]">{LABELS.SYSTEM_DESCRIPTION}</p>
            <ExpandableText text={description} markdown lines={10} chevron fill />
          </div>
        ) : empty ? (
          <p className="text-xs text-muted-foreground">
            {canEdit ? "Nenhuma informação preenchida. Use o lápis para descrever o que o sistema faz." : "Nenhuma informação institucional validada até o momento."}
          </p>
        ) : null}
      </Presence>
    </SectionCard>
  );
}

/**
 * "Contexto e Planejamento" (em Mais informações do projeto): Problema a Resolver, Finalidade e Escopo,
 * preservados com seus valores, permissões e histórico. Editáveis por quem já pode editar o perfil.
 */
export function ContextPlanning({
  projectId,
  data,
  onChanged,
}: {
  projectId: string;
  data: Overview;
  onChanged: () => void;
}) {
  const { canEdit } = data.permissions;
  const {
    editing,
    setEditing,
    values,
    setValues,
    saving,
    saved,
    start,
    commit,
  } = useProfileEditing({
    projectId,
    field: (key) => fieldOf(data, key),
    keys: CONTEXT_KEYS,
    onChanged,
  });
  const filled = CONTEXT_KEYS.filter((key) => fieldOf(data, key).published);

  return (
    <Panel
      title="Contexto e Planejamento"
      subtitle="Problema a resolver, finalidade e escopo do projeto."
      action={
        canEdit ? (
          <EditToggle
            editing={editing}
            label="Contexto e Planejamento"
            onToggle={() => (editing ? setEditing(false) : start())}
          />
        ) : null
      }
    >
      <Presence open={editing}>
        <div className="flex flex-col gap-3">
          {CONTEXT_KEYS.map((key) => (
            <NarrativeField
              key={key}
              label={LABELS[key]}
              value={values[key] ?? ""}
              onChange={(value) =>
                setValues((previous) => ({ ...previous, [key]: value }))
              }
              onCommit={(value) => void commit(key, value)}
              maxLength={maxLengthOf(key)}
            />
          ))}
          <p role="status" className="text-xs text-muted-foreground">
            {saving > 0
              ? "Salvando…"
              : saved
                ? "Alterações salvas. Use o ✓ para concluir a edição."
                : "Cada campo é salvo ao sair dele e fica registrado no histórico."}
          </p>
        </div>
      </Presence>
      <Presence open={!editing}>
        {filled.length > 0 ? (
          <div className="flex flex-col gap-3">
            {filled.map((key) => (
              <div key={key}>
                <p className="text-xs font-semibold text-[#475467]">
                  {LABELS[key]}
                </p>
                <ExpandableText
                  text={fieldOf(data, key).published?.value ?? ""}
                  lines={6}
                  markdown
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            {canEdit
              ? "Nenhuma informação preenchida. Use o lápis para descrever o contexto."
              : "Nenhuma informação de contexto registrada."}
          </p>
        )}
      </Presence>
    </Panel>
  );
}
