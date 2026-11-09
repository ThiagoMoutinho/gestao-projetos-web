/** Lógica pura da Conformidade de Entrega na interface (sem React), testável isoladamente. O servidor repete todas as regras. */

export type ItemStatus = "PENDENTE" | "ENVIADO" | "APROVADO" | "REJEITADO" | "DISPENSADO";
export type EvidenceKind = "SHAREPOINT" | "GITLAB_TAG" | "GITLAB_RELEASE" | "OUTRO";
export type Nature = "SISTEMAS" | "INFRAESTRUTURA" | "PROCESSOS";
export type Tone = "neutral" | "success" | "warning" | "danger" | "info";

export const NATURE_LABEL: Record<Nature, string> = {
  SISTEMAS: "Sistemas e desenvolvimento de software",
  INFRAESTRUTURA: "Infraestrutura e tecnologia",
  PROCESSOS: "Processos e serviços",
};

export const NATURES: Nature[] = ["SISTEMAS", "INFRAESTRUTURA", "PROCESSOS"];

export const ITEM_STATUS: Record<ItemStatus, { label: string; tone: Tone; hint: string }> = {
  PENDENTE: { label: "Pendente", tone: "neutral", hint: "Documento ainda não enviado." },
  ENVIADO: { label: "Aguardando validação", tone: "warning", hint: "Enviado: aguarda a validação do responsável técnico." },
  APROVADO: { label: "Aprovado", tone: "success", hint: "Validado pelo responsável técnico." },
  REJEITADO: { label: "Rejeitado", tone: "danger", hint: "Rejeitado: é preciso reenviar o documento corrigido." },
  DISPENSADO: { label: "Dispensado", tone: "info", hint: "Dispensado formalmente pelo PMO, com justificativa." },
};

export const EVIDENCE_KIND_OPTIONS: ReadonlyArray<{ value: EvidenceKind; label: string }> = [
  { value: "SHAREPOINT", label: "Link do SharePoint" },
  { value: "GITLAB_TAG", label: "Tag do GitLab" },
  { value: "GITLAB_RELEASE", label: "Release do GitLab" },
  { value: "OUTRO", label: "Outro link" },
];

const KIND_LABEL: Record<EvidenceKind, string> = {
  SHAREPOINT: "SharePoint",
  GITLAB_TAG: "Tag GitLab",
  GITLAB_RELEASE: "Release GitLab",
  OUTRO: "Link",
};

/** Mesma validação do servidor: SharePoint exige https; GitLab aceita nome de tag/release ou link; outro exige http(s). */
export function evidenceError(kind: EvidenceKind, reference: string): string | null {
  const ref = reference.trim();
  if (!ref) return "Informe a evidência.";
  if (ref.length > 1000) return "A evidência pode ter no máximo 1000 caracteres.";
  const isUrl = (protocols: string[]) => {
    try {
      return protocols.includes(new URL(ref).protocol);
    } catch {
      return false;
    }
  };
  if (kind === "SHAREPOINT") return isUrl(["https:"]) ? null : "Informe o link (https) do SharePoint.";
  if (kind === "OUTRO") return isUrl(["https:", "http:"]) ? null : "Informe um link http ou https.";
  return /^[A-Za-z0-9][A-Za-z0-9._\-/+]{0,199}$/.test(ref) || isUrl(["https:"]) ? null : "Informe o nome da tag ou release do GitLab, ou o link dela.";
}

/** Texto e, quando for link, o endereço da evidência para exibir. */
export function evidenceDisplay(kind: EvidenceKind | null, reference: string | null) {
  if (!kind || !reference) return null;
  let href: string | null = null;
  try {
    const url = new URL(reference);
    href = url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    href = null;
  }
  return { kindLabel: KIND_LABEL[kind], text: reference, href };
}

export type Conformity = {
  total: number;
  required: number;
  approved: number;
  dispensed: number;
  awaitingValidation: number;
  pending: number;
  rejected: number;
  conforming: boolean;
  blockingItems: Array<{ id: string; title: string; status: ItemStatus }>;
};

/** Selo da conformidade da versão: situação e o que falta. */
export function conformityBadge(conformity: Conformity): { label: string; tone: Tone; hint: string } {
  if (conformity.conforming) {
    return { label: "Conforme", tone: "success", hint: "Todos os documentos obrigatórios estão aprovados ou dispensados." };
  }
  const blocking = conformity.blockingItems.length;
  return {
    label: `Não conforme · ${blocking} ${blocking === 1 ? "pendência" : "pendências"}`,
    tone: conformity.rejected > 0 ? "danger" : "warning",
    hint: "Há documento obrigatório pendente, sem validação ou rejeitado: bloqueia a homologação do marco final e o encerramento do projeto.",
  };
}

const SUBMITTER_ROLES = ["DONO_PROJETO", "GESTOR", "FORNECEDOR", "PO", "DESENVOLVEDOR", "RESPONSAVEL_TECNICO"];

export type ViewerAccess = {
  userId: string;
  globalRole: string;
  memberRoles: readonly string[];
  isProjectManager: boolean;
};

/** Cria versões e envia documentos: dono, gestor, fornecedor, PO, desenvolvedores e responsável técnico (não PMO, ADMIN, coordenação nem observador). */
export function canSubmitDocuments(access: ViewerAccess) {
  return access.isProjectManager || access.memberRoles.some((role) => SUBMITTER_ROLES.includes(role));
}

/** Só o PMO dispensa documentos, com justificativa formal. */
export function canWaiveDocuments(access: Pick<ViewerAccess, "globalRole">) {
  return access.globalRole === "PMO";
}

/** ADMIN e PMO criam, editam e publicam modelos. */
export function canManageTemplates(access: Pick<ViewerAccess, "globalRole">) {
  return access.globalRole === "ADMIN" || access.globalRole === "PMO";
}

/**
 * Mostra aprovar e rejeitar: documento enviado, que não foi enviado pela própria pessoa, e fornecedor nunca valida. Com validador
 * designado, só ele; sem designação, o servidor confere o responsável técnico do marco (a tela não o conhece).
 */
export function canValidateItem(
  item: { status: ItemStatus; submittedById: string | null; validatorId: string | null },
  access: ViewerAccess,
) {
  if (item.status !== "ENVIADO" || item.submittedById === access.userId) return false;
  if (access.globalRole === "FORNECEDOR" || access.memberRoles.includes("FORNECEDOR")) return false;
  if (item.validatorId) return item.validatorId === access.userId;
  return access.memberRoles.length > 0 || access.isProjectManager;
}

/** Reenvio é possível para pendente e rejeitado; enviado aguarda decisão. */
export function canSubmitItem(status: ItemStatus) {
  return status === "PENDENTE" || status === "REJEITADO";
}

/** Dispensa vale para documento ainda não decidido (pendente, enviado ou rejeitado). */
export function canWaiveItem(status: ItemStatus) {
  return status === "PENDENTE" || status === "ENVIADO" || status === "REJEITADO";
}

export const MIN_NOTE = 10;

/** Rejeição e dispensa exigem justificativa de pelo menos 10 caracteres. */
export function noteError(note: string) {
  return note.trim().length >= MIN_NOTE ? null : `Informe a justificativa (mínimo de ${MIN_NOTE} caracteres).`;
}

export function versionLabelError(label: string) {
  return /^[0-9]+(\.[0-9]+){0,2}$/.test(label.trim()) ? null : "Use o formato 1.0, 1.1 ou 2.0.";
}

// ---------- Editor de modelo (ADMIN e PMO) ----------

export type DraftItem = { key: string; documentType: string; title: string; description: string; required: boolean; existing: boolean };

export function toDraftItems(
  items: ReadonlyArray<{ documentType: string; title: string; description: string | null; required: boolean }>,
): DraftItem[] {
  return items.map((item, index) => ({
    key: `item-${index}-${item.documentType}`,
    documentType: item.documentType,
    title: item.title,
    description: item.description ?? "",
    required: item.required,
    existing: true,
  }));
}

/** Tipo de documento proposto a partir do título: maiúsculas, sem acentos, com sublinhado. */
export function suggestDocumentType(title: string) {
  return title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/** Valida o rascunho antes de enviar: mensagem do primeiro problema ou null. */
export function draftError(items: ReadonlyArray<DraftItem>): string | null {
  if (items.length === 0) return "O modelo precisa de ao menos um documento.";
  if (items.length > 60) return "O modelo pode ter no máximo 60 documentos.";
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    if (item.title.trim().length < 3) return `Documento ${index + 1}: informe o título (mínimo de 3 caracteres).`;
    const type = item.documentType.trim();
    if (!/^[A-Z0-9_]{2,60}$/.test(type)) return `Documento ${index + 1}: o tipo deve ter letras maiúsculas, números e sublinhado (2 a 60 caracteres).`;
    if (seen.has(type)) return `Tipo de documento repetido: ${type}.`;
    seen.add(type);
  }
  return null;
}

export function draftPayload(items: ReadonlyArray<DraftItem>, notes: string, ctinValidated: boolean) {
  return {
    items: items.map((item) => ({
      documentType: item.documentType.trim(),
      title: item.title.trim(),
      description: item.description.trim() ? item.description.trim() : null,
      required: item.required,
    })),
    notes: notes.trim() ? notes.trim() : null,
    ...(ctinValidated ? { ctinValidated: true } : {}),
  };
}
