/**
 * Edição do cartão Equipe: rascunho do formulário e tradução para as operações da API de participantes
 * (adicionar, alterar função, remover). Funções puras, sem React; a autorização fica no backend.
 */

export const TEAM_ROLES = ["GESTOR", "RESPONSAVEL_TECNICO", "FORNECEDOR", "PO", "DESENVOLVEDOR", "OBSERVADOR"] as const;
export type TeamRole = (typeof TEAM_ROLES)[number];

/** Papéis com um responsável principal no cartão (o primeiro participante de cada um). */
export const KEY_ROLES = ["GESTOR", "RESPONSAVEL_TECNICO", "FORNECEDOR"] as const;
export type KeyRole = (typeof KEY_ROLES)[number];

/** A função de dono do projeto é protegida pela API (muda só por transferência de titularidade). */
export const OWNER_ROLE = "DONO_PROJETO";

export type TeamMember = { id: string; userId: string; role: string };

export type DraftRow = { rowId: string; memberId: string | null; userId: string; role: TeamRole };

export type TeamDraft = {
  /** userId escolhido para cada responsável principal; "" = não definido. */
  key: Record<KeyRole, string>;
  /** Demais participantes (inclui gestores ou fornecedores adicionais). */
  others: DraftRow[];
};

export type TeamOperation =
  | { type: "remove"; memberId: string; userId: string; role: string }
  | { type: "update"; memberId: string; userId: string; from: string; role: TeamRole }
  | { type: "add"; userId: string; role: TeamRole };

function isTeamRole(role: string): role is TeamRole {
  return (TEAM_ROLES as readonly string[]).includes(role);
}

function isKeyRole(role: string): role is KeyRole {
  return (KEY_ROLES as readonly string[]).includes(role);
}

/** Responsável principal de cada papel: o primeiro participante com essa função (mesma regra do cartão). */
export function principalMembers(members: ReadonlyArray<TeamMember>) {
  const principal = {} as Record<KeyRole, TeamMember | undefined>;
  for (const role of KEY_ROLES) {
    principal[role] = members.find((member) => member.role === role);
  }
  return principal;
}

export function draftFromMembers(members: ReadonlyArray<TeamMember>): TeamDraft {
  const principal = principalMembers(members);
  const principalIds = new Set(KEY_ROLES.map((role) => principal[role]?.id).filter(Boolean));
  return {
    key: {
      GESTOR: principal.GESTOR?.userId ?? "",
      RESPONSAVEL_TECNICO: principal.RESPONSAVEL_TECNICO?.userId ?? "",
      FORNECEDOR: principal.FORNECEDOR?.userId ?? "",
    },
    others: members
      .filter((member) => member.role !== OWNER_ROLE && !principalIds.has(member.id) && isTeamRole(member.role))
      .map((member) => ({ rowId: member.id, memberId: member.id, userId: member.userId, role: member.role as TeamRole })),
  };
}

/** Problemas que impedem salvar: linha sem pessoa e a mesma pessoa duas vezes na mesma função. */
export function teamProblems(draft: TeamDraft, names: (userId: string) => string = (id) => id): string[] {
  const problems: string[] = [];
  if (draft.others.some((row) => !row.userId)) {
    problems.push("Escolha a pessoa de cada participante adicionado ou remova a linha vazia.");
  }
  const seen = new Set<string>();
  const entries = [
    ...KEY_ROLES.filter((role) => draft.key[role]).map((role) => ({ userId: draft.key[role], role: role as string })),
    ...draft.others.filter((row) => row.userId).map((row) => ({ userId: row.userId, role: row.role as string })),
  ];
  for (const entry of entries) {
    const id = `${entry.userId}|${entry.role}`;
    if (seen.has(id)) {
      problems.push(`${names(entry.userId)} aparece mais de uma vez como ${ROLE_TEXT[entry.role as TeamRole] ?? entry.role}.`);
    }
    seen.add(id);
  }
  return [...new Set(problems)];
}

const ROLE_TEXT: Record<TeamRole, string> = {
  GESTOR: "Gestor",
  RESPONSAVEL_TECNICO: "Responsável técnico",
  FORNECEDOR: "Fornecedor",
  PO: "PO",
  DESENVOLVEDOR: "Desenvolvedor",
  OBSERVADOR: "Observador",
};

/**
 * Operações necessárias para sair do estado atual e chegar ao rascunho, na ordem segura para a API:
 * remoções, depois alterações de função e por fim inclusões (evita conflito de duplicidade no meio do caminho).
 */
export function teamOperations(members: ReadonlyArray<TeamMember>, draft: TeamDraft): TeamOperation[] {
  const removes: TeamOperation[] = [];
  const updates: TeamOperation[] = [];
  const adds: TeamOperation[] = [];
  const principal = principalMembers(members);

  for (const role of KEY_ROLES) {
    const current = principal[role];
    const chosen = draft.key[role];
    if (current && current.userId === chosen) continue;
    if (current) removes.push({ type: "remove", memberId: current.id, userId: current.userId, role });
    if (chosen) adds.push({ type: "add", userId: chosen, role });
  }

  const before = draftFromMembers(members).others;
  const kept = new Map(draft.others.filter((row) => row.memberId).map((row) => [row.memberId as string, row]));
  for (const row of before) {
    const next = kept.get(row.memberId as string);
    if (!next) {
      removes.push({ type: "remove", memberId: row.memberId as string, userId: row.userId, role: row.role });
    } else if (next.role !== row.role) {
      updates.push({ type: "update", memberId: row.memberId as string, userId: row.userId, from: row.role, role: next.role });
    }
  }
  for (const row of draft.others) {
    if (!row.memberId && row.userId) adds.push({ type: "add", userId: row.userId, role: row.role });
  }

  return [...removes, ...updates, ...adds];
}

export function isKeyRoleValue(role: string): role is KeyRole {
  return isKeyRole(role);
}
