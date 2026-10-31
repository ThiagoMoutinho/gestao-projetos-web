/** Classificação das evidências (Documento, Ata, Relatório, Chamado GLPI, Outros): regras puras, sem tela. */

export type EvidenceKind = "DOCUMENT" | "MINUTES" | "REPORT" | "GLPI_TICKET" | "OTHER";

export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  DOCUMENT: "Documento",
  MINUTES: "Ata",
  REPORT: "Relatório",
  GLPI_TICKET: "Chamado GLPI",
  OTHER: "Outros",
};

export const EVIDENCE_KIND_OPTIONS = (Object.keys(EVIDENCE_KIND_LABEL) as EvidenceKind[]).map((value) => ({
  value,
  label: EVIDENCE_KIND_LABEL[value],
}));

/** Evidências anteriores à classificação (kind nulo) aparecem como "Sem classificação", nunca como "Outros". */
export const UNCLASSIFIED_LABEL = "Sem classificação";

export type EvidenceFilter = "ALL" | "DOCUMENT" | "MINUTES" | "REPORT" | "GLPI_TICKET" | "OTHER" | "UNCLASSIFIED";

export const EVIDENCE_FILTERS: ReadonlyArray<readonly [EvidenceFilter, string]> = [
  ["ALL", "Todos"],
  ["DOCUMENT", "Documentos"],
  ["MINUTES", "Atas"],
  ["REPORT", "Relatórios"],
  ["GLPI_TICKET", "GLPI"],
  ["OTHER", "Outros"],
  ["UNCLASSIFIED", "Sem classificação"],
];

export type ClassifiedEvidence = { kind: EvidenceKind | null; title: string; ticketNumber: string | null };

export function matchesEvidenceFilter(evidence: Pick<ClassifiedEvidence, "kind">, filter: EvidenceFilter) {
  if (filter === "ALL") {
    return true;
  }
  return filter === "UNCLASSIFIED" ? evidence.kind === null : evidence.kind === filter;
}

export function evidenceKindLabel(kind: EvidenceKind | null) {
  return kind ? EVIDENCE_KIND_LABEL[kind] : UNCLASSIFIED_LABEL;
}

/** Chamado GLPI sem título aparece como "GLPI #número". */
export function evidenceDisplayTitle(evidence: ClassifiedEvidence) {
  const title = evidence.title.trim();
  if (evidence.kind === "GLPI_TICKET" && evidence.ticketNumber) {
    return title && title !== `GLPI #${evidence.ticketNumber}` ? `GLPI #${evidence.ticketNumber} — ${title}` : `GLPI #${evidence.ticketNumber}`;
  }
  return title;
}

export function evidenceActionLabel(kind: EvidenceKind | null) {
  return kind === "GLPI_TICKET" ? "Abrir chamado" : "Abrir documento";
}

export type EvidenceDraft = { kind: EvidenceKind; title: string; url: string; ticketNumber: string };

export const EMPTY_EVIDENCE_DRAFT: EvidenceDraft = { kind: "DOCUMENT", title: "", url: "", ticketNumber: "" };

export function isHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export type EvidenceDraftField = "title" | "url" | "ticketNumber";

/** Regras do formulário: Chamado GLPI exige número e link (título opcional); os demais tipos exigem título e link. */
export function evidenceDraftChecks(draft: EvidenceDraft): Array<[EvidenceDraftField, string | false]> {
  const glpi = draft.kind === "GLPI_TICKET";
  return [
    ["title", !glpi && !draft.title.trim() && "Informe o título da evidência."],
    ["ticketNumber", glpi && !/^#?\d{1,12}$/.test(draft.ticketNumber.trim()) && "Informe o número do chamado (apenas dígitos)."],
    ["url", !isHttpUrl(draft.url) && (glpi ? "Informe o link do chamado (http ou https)." : "Informe um link http ou https.")],
  ];
}

/** Corpo enviado à API (sem o vínculo, que cada tela acrescenta). */
export function evidencePayload(draft: EvidenceDraft) {
  const url = draft.url.trim();
  if (draft.kind === "GLPI_TICKET") {
    const title = draft.title.trim();
    return { kind: draft.kind, url, ticketNumber: draft.ticketNumber.trim().replace(/^#/, ""), ...(title ? { title } : {}) };
  }
  return { kind: draft.kind, url, title: draft.title.trim() };
}
