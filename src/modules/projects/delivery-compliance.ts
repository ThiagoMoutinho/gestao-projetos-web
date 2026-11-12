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
  DISPENSADO: { label: "Dispensado", tone: "info", hint: "Dispensado formalmente pelo ADMIN ou pelo PMO, com justificativa." },
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

/** Percentual de documentos obrigatórios atendidos (aprovados ou dispensados). Sem obrigatórios, a versão está 100% conforme. */
export function conformityPercent(conformity: Pick<Conformity, "required" | "blockingItems">): number {
  if (conformity.required === 0) {
    return 100;
  }
  return Math.round(((conformity.required - conformity.blockingItems.length) / conformity.required) * 100);
}

export type ComplianceSummary = {
  versions: number;
  conformingVersions: number;
  /** Documentos obrigatórios de todas as versões e quantos já estão atendidos (aprovados ou dispensados). */
  required: number;
  satisfied: number;
  percent: number;
  approved: number;
  dispensed: number;
  awaitingValidation: number;
  pending: number;
  rejected: number;
};

/**
 * Totais da Conformidade de Entrega de um projeto (todas as versões registradas): base do quadro da Visão Geral. O percentual
 * considera só os documentos obrigatórios, como o bloqueio da homologação e do encerramento; as contagens incluem os opcionais.
 */
export function complianceSummary(list: ReadonlyArray<Conformity>): ComplianceSummary {
  const sum = (pick: (item: Conformity) => number) => list.reduce((total, item) => total + pick(item), 0);
  const required = sum((item) => item.required);
  const satisfied = sum((item) => item.required - item.blockingItems.length);
  return {
    versions: list.length,
    conformingVersions: list.filter((item) => item.conforming).length,
    required,
    satisfied,
    percent: required === 0 ? 100 : Math.round((satisfied / required) * 100),
    approved: sum((item) => item.approved),
    dispensed: sum((item) => item.dispensed),
    awaitingValidation: sum((item) => item.awaitingValidation),
    pending: sum((item) => item.pending),
    rejected: sum((item) => item.rejected),
  };
}

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

/** ADMIN e PMO dispensam documentos, com justificativa formal (registrada no histórico e na auditoria). */
export function canWaiveDocuments(access: Pick<ViewerAccess, "globalRole">) {
  return access.globalRole === "ADMIN" || access.globalRole === "PMO";
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

// ---------- Validador e histórico do documento ----------

/** Designa ou troca o validador do documento: gestão do projeto (dono ou gestor) e PMO, como na API. */
export function canAssignValidator(access: Pick<ViewerAccess, "globalRole" | "isProjectManager">) {
  return access.globalRole === "PMO" || access.isProjectManager;
}

type PersonRef = { id: string; name: string | null } | null;

export type ValidatorCandidate = { userId: string; name: string; roles: string[] };

/**
 * Quem pode ser validador: participante do projeto ou o dono, nunca o fornecedor (mesma regra da API). Responsáveis
 * técnicos aparecem primeiro; cada pessoa aparece uma vez, com todos os papéis.
 */
export function validatorCandidates(
  members: ReadonlyArray<{ userId: string; name: string; role: string }>,
  owner: { id: string; name: string },
): ValidatorCandidate[] {
  const byUser = new Map<string, ValidatorCandidate>();
  const add = (userId: string, name: string, role: string) => {
    const entry = byUser.get(userId) ?? { userId, name, roles: [] };
    if (!entry.roles.includes(role)) entry.roles.push(role);
    byUser.set(userId, entry);
  };
  add(owner.id, owner.name, "DONO_PROJETO");
  for (const member of members) add(member.userId, member.name, member.role);
  const rank = (entry: ValidatorCandidate) => (entry.roles.includes("RESPONSAVEL_TECNICO") ? 0 : 1);
  return [...byUser.values()]
    .filter((entry) => !entry.roles.includes("FORNECEDOR"))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, "pt-BR"));
}

export type ValidatorInfo = { kind: "designado" | "marco" | "nenhum"; names: string[] };

/** Quem valida o documento: o designado para ele; sem designação, o responsável técnico do marco de homologação. */
export function validatorInfo(validator: PersonRef, defaults: ReadonlyArray<NonNullable<PersonRef>>): ValidatorInfo {
  if (validator) return { kind: "designado", names: [validator.name?.trim() || "Usuário não identificado"] };
  const names = defaults.map((person) => person.name?.trim() || "Usuário não identificado");
  return names.length > 0 ? { kind: "marco", names } : { kind: "nenhum", names: [] };
}

export type HistoryAction = "ENVIO" | "APROVACAO" | "REJEICAO" | "DISPENSA" | "DESIGNACAO";

/**
 * Rótulo e tom de cada registro do histórico, na ordem recebida. Um envio depois de outro envio é um reenvio (após a
 * rejeição); a troca de validador diz se foi designação, alteração ou remoção.
 */
export function describeHistory(events: ReadonlyArray<{ action: HistoryAction; previousValidator: PersonRef; newValidator: PersonRef }>) {
  let sent = false;
  return events.map((event) => {
    switch (event.action) {
      case "ENVIO": {
        const label = sent ? "Reenvio após correção" : "Envio da evidência";
        sent = true;
        return { label, tone: "info" as Tone };
      }
      case "APROVACAO":
        return { label: "Aprovação", tone: "success" as Tone };
      case "REJEICAO":
        return { label: "Rejeição · devolvido para correção", tone: "danger" as Tone };
      case "DISPENSA":
        return { label: "Dispensa formal", tone: "warning" as Tone };
      default:
        return {
          label: !event.newValidator ? "Designação de validador removida" : event.previousValidator ? "Validador alterado" : "Validador designado",
          tone: "neutral" as Tone,
        };
    }
  });
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
