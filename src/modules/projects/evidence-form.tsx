"use client";

import { FileBarChart, FileText, Paperclip, ScrollText, Ticket } from "lucide-react";

import { EVIDENCE_KIND_OPTIONS, type EvidenceDraft, type EvidenceDraftField, type EvidenceKind } from "./evidence-kinds";

const KIND_ICON = {
  DOCUMENT: FileText,
  MINUTES: ScrollText,
  REPORT: FileBarChart,
  GLPI_TICKET: Ticket,
  OTHER: Paperclip,
} as const;

/** Ícone do tipo de evidência (registros sem classificação usam o ícone de documento). */
export function EvidenceKindIcon({ kind, className }: { kind: EvidenceKind | null; className?: string }) {
  const Icon = kind ? KIND_ICON[kind] : FileText;
  return <Icon className={className} aria-hidden="true" />;
}

/** Como cada tela desenha um campo de texto e o seletor de tipo (a EAP usa os campos do "Editar tarefa"; a Visão Geral, os do shadcn). */
export type EvidenceFieldUi = {
  Text: React.ComponentType<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    error?: string | null;
    placeholder?: string;
  }>;
  Kind: React.ComponentType<{ value: EvidenceKind; onChange: (value: EvidenceKind) => void; options: typeof EVIDENCE_KIND_OPTIONS }>;
};

/**
 * Campos de evidência compartilhados entre a EAP e a Visão Geral: Tipo e, conforme o tipo, título e link ou (Chamado GLPI)
 * número, link e título opcional. O chamado GLPI é apenas uma referência a um chamado já existente; nada é aberto no GLPI.
 */
export function EvidenceFormFields({
  draft,
  onChange,
  errors,
  ui,
}: {
  draft: EvidenceDraft;
  onChange: (patch: Partial<EvidenceDraft>) => void;
  errors: Partial<Record<EvidenceDraftField, string | null>>;
  ui: EvidenceFieldUi;
}) {
  const { Text, Kind } = ui;
  const glpi = draft.kind === "GLPI_TICKET";
  return (
    <>
      <Kind value={draft.kind} onChange={(kind) => onChange({ kind })} options={EVIDENCE_KIND_OPTIONS} />
      {glpi ? (
        <>
          <Text label="Número do chamado *" value={draft.ticketNumber} onChange={(ticketNumber) => onChange({ ticketNumber })} error={errors.ticketNumber} placeholder="Ex.: 352587" />
          <Text label="Link do chamado no GLPI *" value={draft.url} onChange={(url) => onChange({ url })} error={errors.url} placeholder="https://" />
          <Text label="Título ou descrição resumida" value={draft.title} onChange={(title) => onChange({ title })} error={errors.title} placeholder="Opcional" />
        </>
      ) : (
        <>
          <Text label="Título da evidência *" value={draft.title} onChange={(title) => onChange({ title })} error={errors.title} />
          <Text label="Link *" value={draft.url} onChange={(url) => onChange({ url })} error={errors.url} placeholder="https://" />
        </>
      )}
    </>
  );
}
