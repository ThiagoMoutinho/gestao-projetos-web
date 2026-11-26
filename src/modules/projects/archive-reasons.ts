/** Categorias padronizadas do motivo de arquivamento (espelham a API). */
export const ARCHIVE_REASONS = [
  "CONCLUIDO_ADMINISTRATIVAMENTE",
  "CANCELADO_DECISAO_INSTITUCIONAL",
  "DESCONTINUADO",
  "SUBSTITUIDO_POR_OUTRA_INICIATIVA",
  "OUTRO",
] as const;

export type ArchiveReason = (typeof ARCHIVE_REASONS)[number];

export const ARCHIVE_REASON_LABEL: Record<ArchiveReason, string> = {
  CONCLUIDO_ADMINISTRATIVAMENTE: "Concluído administrativamente",
  CANCELADO_DECISAO_INSTITUCIONAL: "Cancelado por decisão institucional",
  DESCONTINUADO: "Descontinuado",
  SUBSTITUIDO_POR_OUTRA_INICIATIVA: "Substituído por outra iniciativa",
  OUTRO: "Outro motivo",
};

export const ARCHIVE_REASON_OPTIONS = ARCHIVE_REASONS.map((value) => ({
  value,
  label: ARCHIVE_REASON_LABEL[value],
}));

export function archiveReasonLabel(reason: string | null | undefined) {
  if (!reason) {
    return null;
  }
  return ARCHIVE_REASON_LABEL[reason as ArchiveReason] ?? reason;
}
